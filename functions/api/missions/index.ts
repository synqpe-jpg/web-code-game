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
  const { request, env } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa được cấu hình.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    await ensureMissionSchema(env.DB);

    const url = new URL(request.url);
    const statusParam = url.searchParams.get('status')?.trim().toUpperCase();

    // Check if requester is Admin or API Key Holder
    const adminCheck = await verifyAdminAuth(request, env);
    const isAdmin = adminCheck.authorized;

    // Check if requester is Member
    const memberCheck = await verifyMemberAuth(request, env);
    const currentMember = memberCheck.authorized ? memberCheck.member : null;

    let missionsQuery = 'SELECT * FROM missions';
    const queryParams: any[] = [];

    if (isAdmin) {
      if (statusParam && statusParam !== 'ALL') {
        missionsQuery += ' WHERE status = ?';
        queryParams.push(statusParam);
      }
    } else {
      // Clients only see ACTIVE or ENDED missions (not DRAFT)
      missionsQuery += " WHERE status IN ('ACTIVE', 'ENDED')";
    }
    missionsQuery += ' ORDER BY sort_order ASC, created_at DESC';

    const missionsResult = queryParams.length > 0
      ? await env.DB.prepare(missionsQuery).bind(...queryParams).all<any>()
      : await env.DB.prepare(missionsQuery).all<any>();
    const missions = missionsResult?.results || [];

    // Augment missions with real-time available codes count and user_submission if logged in
    const augmentedMissions = await Promise.all(
      missions.map(async (m: any) => {
        // Parse guide_steps
        let guideSteps: string[] = [];
        try {
          guideSteps = typeof m.guide_steps === 'string' ? JSON.parse(m.guide_steps) : m.guide_steps || [];
        } catch {
          guideSteps = [];
        }

        // Available code count
        let availableCodesCount = 0;
        if (m.reward_type === 'CODE') {
          const countRow = await env.DB.prepare(
            "SELECT COUNT(*) as cnt FROM mission_reward_pools WHERE mission_id = ? AND status = 'AVAILABLE'"
          )
            .bind(m.id)
            .first<any>();
          availableCodesCount = Number(countRow?.cnt) || 0;
        }

        // User submission
        let userSubmission = null;
        if (currentMember?.id) {
          userSubmission = await env.DB.prepare(
            'SELECT * FROM mission_submissions WHERE mission_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1'
          )
            .bind(m.id, currentMember.id)
            .first<any>();
        }

        // Extended stats for Admin & API callers
        let adminStats = undefined;
        if (isAdmin) {
          const statsRow = await env.DB.prepare(`
            SELECT 
              COUNT(*) as total_submissions,
              SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_submissions,
              SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved_submissions,
              SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected_submissions
            FROM mission_submissions
            WHERE mission_id = ?
          `).bind(m.id).first<any>();

          adminStats = {
            total_submissions: Number(statsRow?.total_submissions) || 0,
            pending_submissions: Number(statsRow?.pending_submissions) || 0,
            approved_submissions: Number(statsRow?.approved_submissions) || 0,
            rejected_submissions: Number(statsRow?.rejected_submissions) || 0,
          };
        }

        return {
          ...m,
          guide_steps: guideSteps,
          available_codes_count: availableCodesCount,
          user_submission: userSubmission,
          stats: adminStats,
        };
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        missions: augmentedMissions,
        total: augmentedMissions.length,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error?.message || 'Lỗi tải danh sách nhiệm vụ.' }),
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
    const {
      title,
      description = '',
      task_type = 'POST_SHARE_GROUP_PAGE',
      target_channel_name = '',
      target_channel_url = '',
      guide_steps = [],
      content_requirements = '',
      reward_type = 'CODE',
      reward_value = 0,
      quota = 10,
      min_account_age_days = 0,
      max_resubmissions = 2,
      review_mode = 'AI_ASSISTED',
      ai_prompt_guidelines = '',
      allowed_domains = 'facebook.com,fb.com,fb.watch',
      recurrence_type = 'ONCE',
      start_time = '',
      end_time = '',
      status = 'ACTIVE',
      sort_order = 0,
    } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return new Response(
        JSON.stringify({ success: false, message: 'Tiêu đề nhiệm vụ không được để trống.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const missionId = `ms_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();
    const guideStepsJson = JSON.stringify(Array.isArray(guide_steps) ? guide_steps : []);

    await env.DB.prepare(`
      INSERT INTO missions (
        id, title, description, task_type, target_channel_name, target_channel_url,
        guide_steps, content_requirements, reward_type, reward_value, quota, completed_count,
        min_account_age_days, max_resubmissions, review_mode, ai_prompt_guidelines,
        allowed_domains, recurrence_type, start_time, end_time, status, sort_order,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, 0,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?
      )
    `).bind(
      missionId,
      title.trim(),
      description.trim(),
      task_type,
      target_channel_name.trim(),
      target_channel_url.trim(),
      guideStepsJson,
      content_requirements.trim(),
      reward_type,
      Number(reward_value) || 0,
      Math.max(1, Number(quota) || 10),
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
      nowIso
    ).run();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tạo nhiệm vụ mới thành công!',
        missionId,
      }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error?.message || 'Lỗi khi tạo nhiệm vụ.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
