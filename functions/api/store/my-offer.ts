import {
  ensureSchemaUpgrades,
  getFirstPurchaseConfigD1,
  isProductExcludedFromFirstPurchase,
  getProductFirstPurchaseOffer,
  isMemberEmailVerified,
  getEscalatingPriceD1,
} from '../../services/d1_service';
import { verifyToken, extractUserIdFromToken } from '../../services/auth_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa được cấu hình.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);
    const fpConfig = await getFirstPurchaseConfigD1(env.DB);

    const url = new URL(request.url);
    const gameSlug = (url.searchParams.get('game') || '').trim();

    // 1. Authenticate user via Authorization header
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    let member: any = null;
    if (token) {
      const { valid, userId: tokenUserId } = await verifyToken(token, [env.JWT_SECRET, env.ADMIN_SYNC_SECRET]);
      member = await env.DB.prepare(
        'SELECT * FROM members WHERE session_token = ? LIMIT 1'
      ).bind(token).first<any>();

      if (!member && valid && tokenUserId) {
        member = await env.DB.prepare(
          'SELECT * FROM members WHERE id = ? OR username = ? OR email = ? LIMIT 1'
        ).bind(tokenUserId, tokenUserId, tokenUserId).first<any>();
      }

      if (!member && token) {
        const extractedUserId = extractUserIdFromToken(token);
        if (extractedUserId) {
          member = await env.DB.prepare(
            'SELECT * FROM members WHERE id = ? OR username = ? LIMIT 1'
          ).bind(extractedUserId, extractedUserId).first<any>();
        }
      }
    }

    // 2. Fetch products for this game (or all active products if no slug provided)
    let productRows: any[] = [];
    const selectFields = 'id, title, game_slug, game_name, current_price, original_price, is_active, sale_mode, escalating_base_price, escalating_step, escalating_max_price, first_purchase_enabled, first_purchase_price, first_purchase_max_price';
    if (gameSlug) {
      const res = await env.DB.prepare(
        `SELECT ${selectFields} FROM store_products WHERE game_slug = ? AND is_active = 1`
      ).bind(gameSlug).all<any>();
      productRows = res.results || [];
      const utRes = await env.DB.prepare(
        `SELECT id, title, COALESCE(game_slug, '') as game_slug, COALESCE(game_name, '') as game_name, current_price, original_price, is_active, 'normal' as sale_mode, 0 as escalating_base_price, 0 as escalating_step, null as escalating_max_price, first_purchase_enabled, first_purchase_price, first_purchase_max_price FROM utilities WHERE (game_slug = ? OR category = ?) AND is_active = 1`
      ).bind(gameSlug, gameSlug).all<any>().catch(() => ({ results: [] }));
      if (utRes?.results && utRes.results.length > 0) {
        productRows = productRows.concat(utRes.results);
      }
    } else {
      const res = await env.DB.prepare(
        `SELECT ${selectFields} FROM store_products WHERE is_active = 1 LIMIT 500`
      ).all<any>();
      productRows = res.results || [];
      const utRes = await env.DB.prepare(
        `SELECT id, title, COALESCE(game_slug, '') as game_slug, COALESCE(game_name, '') as game_name, current_price, original_price, is_active, 'normal' as sale_mode, 0 as escalating_base_price, 0 as escalating_step, null as escalating_max_price, first_purchase_enabled, first_purchase_price, first_purchase_max_price FROM utilities WHERE is_active = 1`
      ).all<any>().catch(() => ({ results: [] }));
      if (utRes?.results && utRes.results.length > 0) {
        productRows = productRows.concat(utRes.results);
      }
    }

    // Nếu chưa đăng nhập hoặc token không hợp lệ, trả về offers ở trạng thái 'login_required' để client hiển thị huy hiệu ưu đãi
    if (!member) {
      const anonymousOffers: Record<string, any> = {};
      for (const prod of productRows) {
        const isEscalating = String(prod.sale_mode || '').toLowerCase() === 'escalating';
        let escalatingData: any = null;
        let prodPrice = Number(prod.current_price) || 0;

        if (isEscalating) {
          const escInfo = await getEscalatingPriceD1(env.DB, prod);
          prodPrice = Number(escInfo.current_calculated_price ?? escInfo.current_price) || (Number(prod.current_price) || 0);
          escalatingData = {
            is_escalating: true,
            base_price: escInfo.escalating_base_price ?? escInfo.base_price,
            step: escInfo.escalating_step ?? escInfo.step,
            max_price: escInfo.escalating_max_price ?? escInfo.max_price,
            completed_count: escInfo.completed_count,
            current_price: prodPrice,
            next_price: Number(escInfo.next_step_price ?? escInfo.next_price) || (prodPrice + (escInfo.escalating_step ?? escInfo.step ?? 0)),
          };
        }

        const fpOffer = getProductFirstPurchaseOffer(prod, fpConfig);

        let eligible = false;
        let reason: string | null = null;
        let offerPrice = prodPrice;
        let discountAmount = 0;

        if (isEscalating) {
          eligible = false;
          reason = 'escalating_mode';
          offerPrice = prodPrice;
          discountAmount = 0;
        } else if (!fpOffer.enabled) {
          reason = !fpConfig.enabled ? 'campaign_disabled' : 'excluded';
        } else if (fpOffer.max_original_price !== null && prodPrice > fpOffer.max_original_price) {
          reason = 'exceeds_max_price';
        } else {
          reason = 'login_required';
          offerPrice = Math.min(prodPrice, fpOffer.offer_price);
          discountAmount = Math.max(0, prodPrice - offerPrice);
        }

        anonymousOffers[prod.id] = {
          eligible,
          current_price: prodPrice,
          offer_price: offerPrice,
          discount_amount: discountAmount,
          first_purchase_enabled: fpOffer.enabled,
          first_purchase_price: prod.first_purchase_price !== undefined ? prod.first_purchase_price : null,
          first_purchase_max_price: prod.first_purchase_max_price !== undefined ? prod.first_purchase_max_price : null,
          reason,
          escalating: escalatingData,
        };
      }

      return new Response(
        JSON.stringify({
          success: true,
          isAuthenticated: false,
          campaign: {
            enabled: fpConfig.enabled,
            offer_price: fpConfig.offer_price,
            max_original_price: fpConfig.max_original_price,
            require_verified_email: fpConfig.require_verified_email,
          },
          message: 'Đăng nhập để nhận ưu đãi mua lần đầu',
          offers: anonymousOffers,
        }),
        { headers: { ...CORS_HEADERS, 'Cache-Control': 'no-cache, no-store, must-revalidate' } }
      );
    }

    // 3. Query all completed purchases by this user for these products after last reset
    const pastPurchasesRes = await env.DB.prepare(`
      SELECT o.product_id, MAX(o.created_at) as last_purchased_at
      FROM orders o
      WHERE (o.member_id = ? OR o.buyer_email = ?)
        AND o.status = 'COMPLETED'
        AND o.created_at > (
          SELECT COALESCE(MAX(r.reset_at), '1970-01-01T00:00:00.000Z')
          FROM first_purchase_resets r
          WHERE (r.member_id = ? OR r.member_id = ?) AND r.product_id = o.product_id
        )
      GROUP BY o.product_id;
    `).bind(member.id, member.email || '', member.id, member.email || '').all<any>();

    const purchasedIds = new Set<string>((pastPurchasesRes.results || []).map((r: any) => String(r.product_id)));
    const isEmailVerified = isMemberEmailVerified(member);

    // 4. Build per-package offer status
    const offers: Record<string, {
      eligible: boolean;
      current_price: number;
      offer_price: number;
      discount_amount: number;
      first_purchase_enabled?: boolean;
      first_purchase_price?: number | null;
      first_purchase_max_price?: number | null;
      reason: string | null;
      escalating?: any;
    }> = {};

    for (const prod of productRows) {
      const isEscalating = String(prod.sale_mode || '').toLowerCase() === 'escalating';
      let escalatingData: any = null;
      let prodPrice = Number(prod.current_price) || 0;

      if (isEscalating) {
        const escInfo = await getEscalatingPriceD1(env.DB, prod);
        prodPrice = Number(escInfo.current_calculated_price ?? escInfo.current_price) || (Number(prod.current_price) || 0);
        escalatingData = {
          is_escalating: true,
          base_price: escInfo.escalating_base_price ?? escInfo.base_price,
          step: escInfo.escalating_step ?? escInfo.step,
          max_price: escInfo.escalating_max_price ?? escInfo.max_price,
          completed_count: escInfo.completed_count,
          current_price: prodPrice,
          next_price: Number(escInfo.next_step_price ?? escInfo.next_price) || (prodPrice + (escInfo.escalating_step ?? escInfo.step ?? 0)),
        };
      }

      const fpOffer = getProductFirstPurchaseOffer(prod, fpConfig);

      let eligible = false;
      let reason: string | null = null;
      let offerPrice = prodPrice;
      let discountAmount = 0;

      if (isEscalating) {
        eligible = false;
        reason = 'escalating_mode';
        offerPrice = prodPrice;
        discountAmount = 0;
      } else if (!fpOffer.enabled) {
        reason = !fpConfig.enabled ? 'campaign_disabled' : 'excluded';
      } else if (fpOffer.max_original_price !== null && prodPrice > fpOffer.max_original_price) {
        reason = 'exceeds_max_price';
      } else if (fpConfig.require_verified_email && !isEmailVerified) {
        reason = 'email_unverified';
      } else if (purchasedIds.has(String(prod.id))) {
        reason = 'already_purchased';
      } else {
        eligible = true;
        offerPrice = Math.min(prodPrice, fpOffer.offer_price);
        discountAmount = Math.max(0, prodPrice - offerPrice);
      }

      offers[prod.id] = {
        eligible,
        current_price: prodPrice,
        offer_price: offerPrice,
        discount_amount: discountAmount,
        first_purchase_enabled: fpOffer.enabled,
        first_purchase_price: prod.first_purchase_price !== undefined ? prod.first_purchase_price : null,
        first_purchase_max_price: prod.first_purchase_max_price !== undefined ? prod.first_purchase_max_price : null,
        reason,
        escalating: escalatingData,
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        isAuthenticated: true,
        member: {
          id: member.id,
          email: member.email,
          email_verified: isEmailVerified,
        },
        campaign: {
          enabled: fpConfig.enabled,
          offer_price: fpConfig.offer_price,
          max_original_price: fpConfig.max_original_price,
          require_verified_email: fpConfig.require_verified_email,
        },
        offers,
      }),
      { headers: { ...CORS_HEADERS, 'Cache-Control': 'no-cache, no-store, must-revalidate' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Lỗi kiểm tra ưu đãi: ' + (err?.message || 'Không xác định'),
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
