import {
  CORS_HEADERS,
  Env,
  verifyAdminAuth,
  executeApproveReward,
  executeRejectSubmission,
} from '../../services/mission_service';
import { ensureMissionSchema } from '../../services/d1_service';

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

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

    const url = new URL(request.url);
    const missionId = url.searchParams.get('mission_id');
    const statusFilter = url.searchParams.get('status');

    let query = `
      SELECT s.*, m.title as mission_title, m.reward_type, m.reward_value, m.review_mode
      FROM mission_submissions s
      LEFT JOIN missions m ON s.mission_id = m.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (missionId && missionId !== 'all') {
      query += ' AND s.mission_id = ?';
      params.push(missionId);
    }

    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'NEEDS_HUMAN') {
        query += " AND s.status = 'PENDING' AND s.ai_recommendation = 'NEEDS_HUMAN'";
      } else {
        query += ' AND s.status = ?';
        params.push(statusFilter);
      }
    }

    query += ' ORDER BY s.created_at DESC LIMIT 200';

    const result = await env.DB.prepare(query).bind(...params).all<any>();

    return new Response(
      JSON.stringify({
        success: true,
        submissions: result?.results || [],
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error?.message || 'Lỗi tải hàng chờ duyệt.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
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

    const adminCheck = await verifyAdminAuth(request, env);
    if (!adminCheck.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: adminCheck.error || 'Quyền truy cập bị từ chối.' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    await ensureMissionSchema(env.DB);

    const body: any = await request.json().catch(() => ({}));
    const { action, submission_id, rejection_reason = '', mission_id } = body;
    const adminActor = `ADMIN:${adminCheck.adminName || adminCheck.adminId || 'Admin'}`;

    if (action === 'APPROVE') {
      if (!submission_id) {
        return new Response(
          JSON.stringify({ success: false, message: 'Thiếu submission_id.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const res = await executeApproveReward(env.DB, submission_id, adminActor);
      if (!res.success) {
        return new Response(
          JSON.stringify({ success: false, message: res.error || 'Không thể duyệt hồ sơ.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Duyệt bài thành công! Phần thưởng đã được giao ngay.',
          rewardDelivered: res.rewardDelivered,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (action === 'REJECT') {
      if (!submission_id) {
        return new Response(
          JSON.stringify({ success: false, message: 'Thiếu submission_id.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const res = await executeRejectSubmission(env.DB, submission_id, adminActor, rejection_reason);
      if (!res.success) {
        return new Response(
          JSON.stringify({ success: false, message: res.error || 'Không thể từ chối hồ sơ.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Đã từ chối hồ sơ nộp bài.' }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (action === 'BATCH_APPROVE_AI') {
      let query = "SELECT id FROM mission_submissions WHERE status = 'PENDING' AND ai_recommendation = 'APPROVE'";
      const params: any[] = [];
      if (mission_id && mission_id !== 'all') {
        query += ' AND mission_id = ?';
        params.push(mission_id);
      }
      query += ' LIMIT 50';

      const candidateRows = await env.DB.prepare(query).bind(...params).all<any>();
      const candidateIds = (candidateRows?.results || []).map((r: any) => r.id);

      let successCount = 0;
      const errors: string[] = [];

      for (const id of candidateIds) {
        const res = await executeApproveReward(env.DB, id, `${adminActor} (Batch AI)`);
        if (res.success) {
          successCount++;
        } else if (res.error) {
          errors.push(`ID ${id}: ${res.error}`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Đã duyệt thành công ${successCount} hồ sơ theo đề xuất của AI.`,
          successCount,
          totalCandidates: candidateIds.length,
          errors: errors.length > 0 ? errors : undefined,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (action === 'BATCH_APPROVE') {
      const { submission_ids } = body;
      if (!Array.isArray(submission_ids) || submission_ids.length === 0) {
        return new Response(
          JSON.stringify({ success: false, message: 'Yêu cầu mảng submission_ids (danh sách ID hồ sơ cần duyệt).' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      let successCount = 0;
      const errors: string[] = [];

      for (const id of submission_ids) {
        const res = await executeApproveReward(env.DB, id, `${adminActor} (Batch API)`);
        if (res.success) {
          successCount++;
        } else if (res.error) {
          errors.push(`ID ${id}: ${res.error}`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Đã duyệt thành công ${successCount}/${submission_ids.length} hồ sơ.`,
          successCount,
          total: submission_ids.length,
          errors: errors.length > 0 ? errors : undefined,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (action === 'BATCH_REJECT') {
      const { submission_ids, rejection_reason = 'Không đạt yêu cầu qua kiểm tra tự động.' } = body;
      if (!Array.isArray(submission_ids) || submission_ids.length === 0) {
        return new Response(
          JSON.stringify({ success: false, message: 'Yêu cầu mảng submission_ids (danh sách ID hồ sơ cần từ chối).' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      let successCount = 0;
      const errors: string[] = [];

      for (const id of submission_ids) {
        const res = await executeRejectSubmission(env.DB, id, `${adminActor} (Batch API)`, rejection_reason);
        if (res.success) {
          successCount++;
        } else if (res.error) {
          errors.push(`ID ${id}: ${res.error}`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Đã từ chối ${successCount}/${submission_ids.length} hồ sơ.`,
          successCount,
          total: submission_ids.length,
          errors: errors.length > 0 ? errors : undefined,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: 'Hành động không hợp lệ (hỗ trợ APPROVE, REJECT, BATCH_APPROVE, BATCH_REJECT, BATCH_APPROVE_AI).' }),
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error?.message || 'Lỗi xử lý duyệt hồ sơ.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
