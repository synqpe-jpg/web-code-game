/**
 * Cloudflare Pages Function: Marketing & FOMO Independent Audit API
 * Route: /api/crawler/marketing
 * 
 * Cung cấp endpoint chỉ-đọc (Read-only) bảo mật cao cho Muse Bot hoặc bên kiểm chứng độc lập:
 * 1. Đọc cấu hình live: get_marketing_config
 * 2. Đọc nhật ký tối đa 100 sự kiện toast gần đây: list_marketing_events
 * 3. Xác thực ĐỘC QUYỀN qua header: "Authorization: Bearer <KEY>". Không hỗ trợ ?api_key= trên URL.
 * 4. Nghiêm cấm mọi thao tác ghi (HTTP 403 Forbidden).
 * 5. Giới hạn tần suất 60 requests/phút chống cào ồ ạt (HTTP 429).
 */

import {
  authenticateMarketingAuditor,
  getLiveMarketingConfig,
  getRecentMarketingEvents,
  checkAuditorRateLimit,
} from '../../services/marketingAuditService';
import { getOrRefreshSnapshot } from '../../services/snapshotService';
import { initializeVirtualLayer, processCurrentTimeSlot } from '../../services/virtualLayerService';
import { getD1QuotaStatus, getPaginatedVirtualEventsD1 } from '../../services/d1_service';

export interface Env {
  DB?: D1Database;
  ADMIN_SYNC_SECRET?: string;
  MUSE_MARKETING_AUDIT_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

/**
 * GET: Hỗ trợ đọc nhanh cấu hình live nếu có Bearer token,
 * hoặc trả về tài liệu hướng dẫn công khai nếu không có token.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const urlObj = new URL(request.url);
  const authHeader = request.headers.get('Authorization') || '';

  // 0. Nghiêm cấm truyền api_key qua URL query để chống rò rỉ token trong server logs
  const queryKey = urlObj.searchParams.get('api_key') || urlObj.searchParams.get('key');
  if (queryKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Xác thực qua URL (?api_key=...) bị nghiêm cấm vì nguy cơ rò rỉ log. Vui lòng cung cấp khóa Bearer qua Header "Authorization: Bearer <KEY>".',
        status: 401,
      }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  // 1. Nếu có gửi Bearer token -> Thực hiện xác thực và trả dữ liệu kiểm chứng
  if (authHeader.startsWith('Bearer ')) {
    const auth = await authenticateMarketingAuditor(request, env);
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({
          success: false,
          error: auth.error || 'Quyền truy cập bị từ chối.',
          status: auth.status || 401,
        }),
        { status: auth.status || 401, headers: CORS_HEADERS }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateCheck = checkAuditorRateLimit(`${clientIp}_${token}`);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Tần suất yêu cầu vượt quá giới hạn (Rate limit: tối đa 60 requests/phút). Vui lòng thử lại sau.',
          status: 429,
        }),
        { status: 429, headers: CORS_HEADERS }
      );
    }

    const action = urlObj.searchParams.get('action') || 'get_marketing_config';
    if (action === 'get_metrics_snapshot') {
      const snapshot = await getOrRefreshSnapshot(env, undefined, true);
      return new Response(
        JSON.stringify({
          success: true,
          action: 'get_metrics_snapshot',
          botName: auth.botName,
          snapshot,
        }, null, 2),
        { headers: { ...CORS_HEADERS, 'Cache-Control': 'no-cache' } }
      );
    }

    if (action === 'list_marketing_events') {
      const limit = Number(urlObj.searchParams.get('limit')) || 100;
      const events = await getRecentMarketingEvents(env, limit);
      return new Response(
        JSON.stringify({
          success: true,
          action: 'list_marketing_events',
          botName: auth.botName,
          total: events.length,
          limit,
          events,
        }, null, 2),
        { headers: { ...CORS_HEADERS, 'Cache-Control': 'no-cache' } }
      );
    }

    if (action === 'get_virtual_analytics') {
      const page = Number(urlObj.searchParams.get('page')) || 1;
      const limit = Number(urlObj.searchParams.get('limit')) || 20;

      const layerState = await initializeVirtualLayer(env);
      processCurrentTimeSlot(layerState);

      const products3Col = Array.from(layerState.products.values()).map(p => ({
        id: p.productId,
        title: p.title,
        item_type: p.itemType,
        real_sold: p.realSold,
        real_stock: p.realStock,
        virtual_sold: p.virtualSold,
        virtual_buffer: p.virtualBuffer,
        virtual_restock_count: p.virtualRestockCount,
        display_sold: p.realSold + p.virtualSold,
        display_stock: p.realStock > 0 ? (p.realStock + p.virtualBuffer) : 0,
        last_restock_at: p.lastRestockAt,
      }));

      const giveaways3Col = Array.from(layerState.giveaways.values()).map(g => ({
        id: g.campaignId,
        title: g.title,
        real_claimed: g.realClaimed,
        real_remaining: g.realRemaining,
        virtual_claimed: g.virtualClaimed,
        virtual_buffer: g.virtualRemainingBuffer,
        virtual_restock_count: g.virtualRestockCount,
        display_claimed: g.realClaimed + g.virtualClaimed,
        display_remaining: g.realRemaining > 0 ? (g.realRemaining + g.virtualRemainingBuffer) : 0,
        last_restock_at: g.lastRestockAt,
      }));

      const paginatedEvents = env.DB ? await getPaginatedVirtualEventsD1(env.DB, page, limit) : { events: [], total: 0, page, limit, totalPages: 1 };
      const quotaStatus = getD1QuotaStatus();

      return new Response(
        JSON.stringify({
          success: true,
          action: 'get_virtual_analytics',
          botName: auth.botName,
          timestamp: new Date().toISOString(),
          d1_quota: quotaStatus,
          products: products3Col,
          giveaways: giveaways3Col,
          master_copy: {
            real_clicks: layerState.masterCopy.realClicks,
            virtual_copy: layerState.masterCopy.virtualCopy,
            total_display: layerState.masterCopy.realClicks + layerState.masterCopy.virtualCopy,
          },
          paginated_events: paginatedEvents,
        }, null, 2),
        { headers: { ...CORS_HEADERS, 'Cache-Control': 'no-cache' } }
      );
    }

    // Mặc định: get_marketing_config
    const config = await getLiveMarketingConfig(env);
    return new Response(
      JSON.stringify({
        success: true,
        action: 'get_marketing_config',
        botName: auth.botName,
        config,
      }, null, 2),
      { headers: { ...CORS_HEADERS, 'Cache-Control': 'no-cache' } }
    );
  }

  // 2. Không kèm Bearer token -> Trả về tài liệu hướng dẫn API công khai (TUYỆT ĐỐI KHÔNG lộ key)
  const doc = {
    service: 'CodeGame Marketing & FOMO Independent Audit API (Muse Integration)',
    version: '1.0.0',
    status: 'ONLINE',
    endpoint: `${urlObj.origin}/api/crawler/marketing`,
    compatibleAlternativeEndpoint: `${urlObj.origin}/api/crawler/ingest-codes`,
    authInstructions: {
      method: 'Header Authorization: Bearer <KEY>',
      securityNote: 'Xác thực ĐỘC QUYỀN bằng Header Authorization. Không chấp nhận ?api_key= trên URL để bảo vệ an toàn log.',
    },
    supportedActions: [
      {
        action: 'get_marketing_config',
        method: 'POST hoặc GET',
        description: 'Đọc cấu hình live hệ thống Marketing & FOMO (Trạng thái, tỷ lệ 7 loại, chu kỳ nổ toast, giờ vàng, số nick mô phỏng).',
      },
      {
        action: 'list_marketing_events',
        method: 'POST hoặc GET',
        description: 'Đọc nhật ký tối đa 100 sự kiện toast gần đây (mỗi sự kiện có cờ bắt buộc is_simulated: true/false, không lộ PII người dùng thật).',
      },
    ],
    permissionsPolicy: {
      role: 'READ_ONLY_AUDITOR',
      allowedActions: ['get_marketing_config', 'list_marketing_events'],
      writeActions: 'STRICTLY_FORBIDDEN (HTTP 403)',
      rateLimit: '60 requests / phút',
    },
    sampleCurlGetConfig: `curl -X GET "${urlObj.origin}/api/crawler/marketing" \\
  -H "Authorization: Bearer <MUSE_MARKETING_AUDIT_KEY>"`,
    sampleCurlListEvents: `curl -X POST "${urlObj.origin}/api/crawler/marketing" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <MUSE_MARKETING_AUDIT_KEY>" \\
  -d '{"action": "list_marketing_events", "limit": 100}'`,
    sampleIngestAlternativeCurl: `curl -X POST "${urlObj.origin}/api/crawler/ingest-codes" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <MUSE_MARKETING_AUDIT_KEY>" \\
  -d '{"action": "get_marketing_config"}'`,
  };

  return new Response(JSON.stringify(doc, null, 2), {
    headers: { ...CORS_HEADERS, 'Cache-Control': 'no-cache' },
  });
};

/**
 * POST: Thực thi các action kiểm chứng chỉ đọc
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const urlObj = new URL(request.url);

  // 0. Nghiêm cấm truyền api_key qua URL query để chống rò rỉ token trong server logs
  const queryKey = urlObj.searchParams.get('api_key') || urlObj.searchParams.get('key');
  if (queryKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Xác thực qua URL (?api_key=...) bị nghiêm cấm vì nguy cơ rò rỉ log. Vui lòng cung cấp khóa Bearer qua Header "Authorization: Bearer <KEY>".',
        status: 401,
      }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  // 1. Xác thực Bearer Key
  const auth = await authenticateMarketingAuditor(request, env);
  if (!auth.authorized) {
    return new Response(
      JSON.stringify({
        success: false,
        error: auth.error || 'Quyền truy cập bị từ chối.',
        hint: 'Cung cấp API Key qua Header "Authorization: Bearer <KEY>"',
        status: auth.status || 401,
      }),
      { status: auth.status || 401, headers: CORS_HEADERS }
    );
  }

  // 2. Giới hạn tần suất 60 req/phút
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateCheck = checkAuditorRateLimit(`${clientIp}_${token}`);
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Tần suất yêu cầu vượt quá giới hạn (Rate limit: tối đa 60 requests/phút). Vui lòng thử lại sau.',
        status: 429,
      }),
      { status: 429, headers: CORS_HEADERS }
    );
  }

  // 3. Phân tích Payload
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const action = String(body.action || 'get_marketing_config').trim();

  // 4. Kiểm tra quyền hạn: Từ chối MỌI thao tác ghi với mã HTTP 403 Forbidden
  const writeActions = [
    'update_marketing_config', 'save_marketing_config', 'test_trigger',
    'ingest_codes', 'queue_game', 'publish_game', 'approve_codes', 'reject_codes',
    'update_instructions', 'cleanup_test_codes', 'delete_pending_game'
  ];

  const allowedAuditActions = ['get_marketing_config', 'list_marketing_events', 'get_metrics_snapshot', 'get_virtual_analytics'];
  if (writeActions.includes(action) || (auth.role === 'marketing_auditor' && !allowedAuditActions.includes(action))) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Quyền truy cập bị từ chối: Khóa kiểm toán chỉ có quyền đọc (Read-only) cho ${allowedAuditActions.join(', ')}. Mọi thao tác ghi "${action}" đều bị nghiêm cấm. Cấu hình chỉ được chỉnh sửa trên Admin UI.`,
        status: 403,
      }),
      { status: 403, headers: CORS_HEADERS }
    );
  }

  // 5. Action: get_metrics_snapshot
  if (action === 'get_metrics_snapshot') {
    const snapshot = await getOrRefreshSnapshot(env, undefined, true);
    return new Response(
      JSON.stringify({
        success: true,
        action: 'get_metrics_snapshot',
        botName: auth.botName,
        snapshot,
      }, null, 2),
      { headers: CORS_HEADERS }
    );
  }

  // 6. Action: get_marketing_config
  if (action === 'get_marketing_config') {
    const config = await getLiveMarketingConfig(env);
    return new Response(
      JSON.stringify({
        success: true,
        action: 'get_marketing_config',
        botName: auth.botName,
        config,
      }, null, 2),
      { headers: CORS_HEADERS }
    );
  }

  // 7. Action: list_marketing_events
  if (action === 'list_marketing_events') {
    const limit = Number(body.limit) || 100;
    const events = await getRecentMarketingEvents(env, limit);
    return new Response(
      JSON.stringify({
        success: true,
        action: 'list_marketing_events',
        botName: auth.botName,
        total: events.length,
        limit,
        events,
      }, null, 2),
      { headers: CORS_HEADERS }
    );
  }

  // 8. Action: get_virtual_analytics
  if (action === 'get_virtual_analytics') {
    const page = Number(body.page) || 1;
    const limit = Number(body.limit) || 20;

    const layerState = await initializeVirtualLayer(env);
    processCurrentTimeSlot(layerState);

    const products3Col = Array.from(layerState.products.values()).map(p => ({
      id: p.productId,
      title: p.title,
      item_type: p.itemType,
      real_sold: p.realSold,
      real_stock: p.realStock,
      virtual_sold: p.virtualSold,
      virtual_buffer: p.virtualBuffer,
      virtual_restock_count: p.virtualRestockCount,
      display_sold: p.realSold + p.virtualSold,
      display_stock: p.realStock > 0 ? (p.realStock + p.virtualBuffer) : 0,
      last_restock_at: p.lastRestockAt,
    }));

    const giveaways3Col = Array.from(layerState.giveaways.values()).map(g => ({
      id: g.campaignId,
      title: g.title,
      real_claimed: g.realClaimed,
      real_remaining: g.realRemaining,
      virtual_claimed: g.virtualClaimed,
      virtual_buffer: g.virtualRemainingBuffer,
      virtual_restock_count: g.virtualRestockCount,
      display_claimed: g.realClaimed + g.virtualClaimed,
      display_remaining: g.realRemaining > 0 ? (g.realRemaining + g.virtualRemainingBuffer) : 0,
      last_restock_at: g.lastRestockAt,
    }));

    const paginatedEvents = env.DB ? await getPaginatedVirtualEventsD1(env.DB, page, limit) : { events: [], total: 0, page, limit, totalPages: 1 };
    const quotaStatus = getD1QuotaStatus();

    return new Response(
      JSON.stringify({
        success: true,
        action: 'get_virtual_analytics',
        botName: auth.botName,
        timestamp: new Date().toISOString(),
        d1_quota: quotaStatus,
        products: products3Col,
        giveaways: giveaways3Col,
        master_copy: {
          real_clicks: layerState.masterCopy.realClicks,
          virtual_copy: layerState.masterCopy.virtualCopy,
          total_display: layerState.masterCopy.realClicks + layerState.masterCopy.virtualCopy,
        },
        paginated_events: paginatedEvents,
      }, null, 2),
      { headers: CORS_HEADERS }
    );
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: `Hành động "${action}" không được hỗ trợ. Chỉ hỗ trợ "get_marketing_config", "list_marketing_events", và "get_metrics_snapshot".`,
      status: 400,
    }),
    { status: 400, headers: CORS_HEADERS }
  );
};
