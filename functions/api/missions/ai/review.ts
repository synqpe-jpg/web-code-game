import {
  CORS_HEADERS,
  Env,
  verifyAiKeyAuth,
  executeApproveReward,
  executeRejectSubmission,
} from '../../../services/mission_service';
import { ensureMissionSchema } from '../../../services/d1_service';

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa được cấu hình.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const aiAuth = await verifyAiKeyAuth(request, env.DB);
    if (!aiAuth.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: aiAuth.error || 'Quyền truy cập AI API Key bị từ chối.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureMissionSchema(env.DB);

    const body: any = await request.json().catch(() => ({}));
    const { submission_id, recommendation, reason = '' } = body;

    if (!submission_id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Thiếu submission_id.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!recommendation || !['APPROVE', 'REJECT', 'NEEDS_HUMAN'].includes(recommendation)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "recommendation phải là một trong các giá trị: 'APPROVE', 'REJECT', 'NEEDS_HUMAN'.",
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const submission = await env.DB.prepare('SELECT * FROM mission_submissions WHERE id = ? LIMIT 1')
      .bind(submission_id)
      .first<any>();

    if (!submission) {
      return new Response(
        JSON.stringify({ success: false, message: 'Không tìm thấy hồ sơ nộp bài.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (submission.status !== 'PENDING') {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Hồ sơ này không còn ở trạng thái chờ duyệt (hiện tại: ${submission.status}).`,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const mission = await env.DB.prepare('SELECT * FROM missions WHERE id = ? LIMIT 1')
      .bind(submission.mission_id)
      .first<any>();

    if (!mission) {
      return new Response(
        JSON.stringify({ success: false, message: 'Nhiệm vụ không tồn tại.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const aiActor = `AI:${aiAuth.keyRecord?.key_name || 'AI Reviewer'}`;
    const nowIso = new Date().toISOString();

    // MODE 1: AI_AUTO (AI has authority to immediately approve or reject)
    if (mission.review_mode === 'AI_AUTO') {
      if (recommendation === 'APPROVE') {
        const approveRes = await executeApproveReward(env.DB, submission.id, aiActor);
        if (!approveRes.success) {
          return new Response(
            JSON.stringify({ success: false, message: approveRes.error || 'Lỗi khi AI thực thi duyệt tự động.' }),
            { status: 400, headers: CORS_HEADERS }
          );
        }

        // Also record AI reasoning
        await env.DB.prepare(`
          UPDATE mission_submissions SET
            ai_recommendation = 'APPROVE',
            ai_reason = ?,
            ai_reviewed_at = ?
          WHERE id = ?
        `).bind(String(reason || '').trim(), nowIso, submission.id).run();

        return new Response(
          JSON.stringify({
            success: true,
            actionTaken: 'AUTO_APPROVED',
            message: 'AI đã tự động duyệt và trao thưởng thành công!',
            rewardDelivered: approveRes.rewardDelivered,
          }),
          { status: 200, headers: CORS_HEADERS }
        );
      } else if (recommendation === 'REJECT') {
        const rejectRes = await executeRejectSubmission(env.DB, submission.id, aiActor, reason);
        if (!rejectRes.success) {
          return new Response(
            JSON.stringify({ success: false, message: rejectRes.error || 'Lỗi khi AI thực thi từ chối tự động.' }),
            { status: 400, headers: CORS_HEADERS }
          );
        }

        // Also record AI reasoning
        await env.DB.prepare(`
          UPDATE mission_submissions SET
            ai_recommendation = 'REJECT',
            ai_reason = ?,
            ai_reviewed_at = ?
          WHERE id = ?
        `).bind(String(reason || '').trim(), nowIso, submission.id).run();

        return new Response(
          JSON.stringify({
            success: true,
            actionTaken: 'AUTO_REJECTED',
            message: 'AI đã tự động từ chối hồ sơ bài nộp.',
          }),
          { status: 200, headers: CORS_HEADERS }
        );
      }
    }

    // MODE 2: AI_ASSISTED or recommendation === 'NEEDS_HUMAN'
    // Record AI proposal for Admin to review in queue
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE mission_submissions SET
          ai_recommendation = ?,
          ai_reason = ?,
          ai_reviewed_at = ?,
          updated_at = ?
        WHERE id = ?
      `).bind(
        recommendation,
        String(reason || '').trim(),
        nowIso,
        nowIso,
        submission.id
      ),
      env.DB.prepare(`
        INSERT INTO mission_audit_logs (id, mission_id, submission_id, user_id, action, actor, details, created_at)
        VALUES (?, ?, ?, ?, 'AI_RECOMMEND', ?, ?, ?)
      `).bind(
        `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        mission.id,
        submission.id,
        submission.user_id,
        aiActor,
        `AI gửi đề xuất ${recommendation}: ${String(reason || '').trim()}`,
        nowIso
      ),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        actionTaken: 'RECOMMENDATION_RECORDED',
        message: 'Đã ghi nhận đề xuất của AI vào hàng chờ duyệt.',
        recommendation,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error?.message || 'Lỗi khi AI gửi kết quả duyệt.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
