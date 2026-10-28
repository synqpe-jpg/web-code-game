import {
  CORS_HEADERS,
  Env,
  verifyAdminAuth,
  verifyMemberAuth,
} from '../../services/mission_service';
import { ensureMissionSchema } from '../../services/d1_service';

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;
  const missionId = String(params.id || '');

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa được cấu hình.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    await ensureMissionSchema(env.DB);

    const mission = await env.DB.prepare('SELECT * FROM missions WHERE id = ? LIMIT 1')
      .bind(missionId)
      .first<any>();

    if (!mission) {
      return new Response(
        JSON.stringify({ success: false, message: 'Không tìm thấy nhiệm vụ.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    let guideSteps: string[] = [];
    try {
      guideSteps = typeof mission.guide_steps === 'string' ? JSON.parse(mission.guide_steps) : mission.guide_steps || [];
    } catch {
      guideSteps = [];
    }

    let availableCodesCount = 0;
    if (mission.reward_type === 'CODE') {
      const countRow = await env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM mission_reward_pools WHERE mission_id = ? AND status = 'AVAILABLE'"
      )
        .bind(mission.id)
        .first<any>();
      availableCodesCount = Number(countRow?.cnt) || 0;
    }

    // Check member submission
    const memberCheck = await verifyMemberAuth(request, env);
    let userSubmission = null;
    if (memberCheck.authorized && memberCheck.member?.id) {
      userSubmission = await env.DB.prepare(
        'SELECT * FROM mission_submissions WHERE mission_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1'
      )
        .bind(mission.id, memberCheck.member.id)
        .first<any>();
    }

    return new Response(
      JSON.stringify({
        success: true,
        mission: {
          ...mission,
          guide_steps: guideSteps,
          available_codes_count: availableCodesCount,
          user_submission: userSubmission,
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error?.message || 'Lỗi lấy chi tiết nhiệm vụ.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;
  const missionId = String(params.id || '');

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa được cấu hình.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const adminCheck = await verifyAdminAuth(request, env);
    if (!adminCheck.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: adminCheck.error || 'Quyền truy cập bị từ chối.' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    await ensureMissionSchema(env.DB);

    const existing = await env.DB.prepare('SELECT * FROM missions WHERE id = ? LIMIT 1')
      .bind(missionId)
      .first<any>();

    if (!existing) {
      return new Response(
        JSON.stringify({ success: false, message: 'Không tìm thấy nhiệm vụ để cập nhật.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const body: any = await request.json().catch(() => ({}));
    const {
      title = existing.title,
      description = existing.description,
      task_type = existing.task_type,
      target_channel_name = existing.target_channel_name,
      target_channel_url = existing.target_channel_url,
      guide_steps = existing.guide_steps,
      content_requirements = existing.content_requirements,
      reward_type = existing.reward_type,
      reward_value = existing.reward_value,
      quota = existing.quota,
      min_account_age_days = existing.min_account_age_days,
      max_resubmissions = existing.max_resubmissions,
      review_mode = existing.review_mode,
      ai_prompt_guidelines = existing.ai_prompt_guidelines,
      allowed_domains = existing.allowed_domains,
      recurrence_type = existing.recurrence_type,
      start_time = existing.start_time,
      end_time = existing.end_time,
      status = existing.status,
      sort_order = existing.sort_order,
    } = body;

    const guideStepsJson = typeof guide_steps === 'string' ? guide_steps : JSON.stringify(Array.isArray(guide_steps) ? guide_steps : []);
    const nowIso = new Date().toISOString();

    await env.DB.prepare(`
      UPDATE missions SET
        title = ?,
        description = ?,
        task_type = ?,
        target_channel_name = ?,
        target_channel_url = ?,
        guide_steps = ?,
        content_requirements = ?,
        reward_type = ?,
        reward_value = ?,
        quota = ?,
        min_account_age_days = ?,
        max_resubmissions = ?,
        review_mode = ?,
        ai_prompt_guidelines = ?,
        allowed_domains = ?,
        recurrence_type = ?,
        start_time = ?,
        end_time = ?,
        status = ?,
        sort_order = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(
      title.trim(),
      description.trim(),
      task_type,
      target_channel_name.trim(),
      target_channel_url.trim(),
      guideStepsJson,
      content_requirements.trim(),
      reward_type,
      Number(reward_value) || 0,
      Math.max(1, Number(quota) || 1),
      Math.max(0, Number(min_account_age_days) || 0),
      Math.max(0, Number(max_resubmissions) || 2),
      review_mode,
      ai_prompt_guidelines.trim(),
      allowed_domains.trim() || 'facebook.com,fb.com,fb.watch',
      recurrence_type,
      start_time || '',
      end_time || '',
      status,
      Number(sort_order) || 0,
      nowIso,
      missionId
    ).run();

    return new Response(
      JSON.stringify({ success: true, message: 'Cập nhật nhiệm vụ thành công!' }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error?.message || 'Lỗi cập nhật nhiệm vụ.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;
  const missionId = String(params.id || '');

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa được cấu hình.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const adminCheck = await verifyAdminAuth(request, env);
    if (!adminCheck.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: adminCheck.error || 'Quyền truy cập bị từ chối.' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    await ensureMissionSchema(env.DB);

    // Rule: Chỉ xóa được khi chưa có ai nộp bài
    const subCountRow = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM mission_submissions WHERE mission_id = ?'
    )
      .bind(missionId)
      .first<any>();

    const subCount = Number(subCountRow?.cnt) || 0;
    if (subCount > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Không thể xóa nhiệm vụ này vì đã có ${subCount} hồ sơ nộp bài. Bạn có thể đổi trạng thái sang TẠM DỪNG hoặc ĐÃ KẾT THÚC.`,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Delete related reward pool codes if any, then delete mission
    await env.DB.batch([
      env.DB.prepare('DELETE FROM mission_reward_pools WHERE mission_id = ?').bind(missionId),
      env.DB.prepare('DELETE FROM missions WHERE id = ?').bind(missionId),
    ]);

    return new Response(
      JSON.stringify({ success: true, message: 'Xóa nhiệm vụ thành công!' }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error?.message || 'Lỗi khi xóa nhiệm vụ.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
