import { ensureSchemaUpgrades, getSettingD1, setSettingD1 } from '../../../services/d1_service';
import { verifyAdminAuth } from '../../../services/mission_service';
import { getRealEventsHub, saveRealEventsHub } from '../../../services/realEventsHub';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

async function broadcastRealDepositToHub(env: Env, member: any, amount: number): Promise<void> {
  try {
    const hub = await getRealEventsHub(env);
    const rawMemberName = member?.display_name || member?.username || member?.displayName || 'Thành viên';
    const maskedName = rawMemberName.length > 3
      ? `${rawMemberName.slice(0, 2)}***${rawMemberName.slice(-1)}`
      : `${rawMemberName.slice(0, 1)}**`;
    hub.events.unshift({
      id: `dep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'DEPOSIT_WALLET',
      title: 'Cộng Core tài khoản thành công',
      message: `${maskedName} vừa được nạp +${amount.toLocaleString('vi-VN')} Core vào ví`,
      timeAgo: 'vừa xong',
      userName: maskedName,
      depositAmount: amount,
      isRealUser: true,
      timestamp: Date.now(),
      scheduledFireTime: Date.now(),
    });
    await saveRealEventsHub(env, hub);
  } catch (e) {
    console.warn('[Adjust Balance] Hub broadcast error:', e);
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cơ sở dữ liệu Cloudflare D1 chưa được kích hoạt.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // 1. Xác thực Quản trị viên (Master Secret, Session Token D1, Scoped API Key)
    const adminCheck = await verifyAdminAuth(request, env as any, 'MEMBERS_FULL');
    if (!adminCheck.authorized) {
      return new Response(
        JSON.stringify({
          success: false,
          error: adminCheck.error || 'Yêu cầu quyền Quản trị viên (ADMIN hoặc SUPER_ADMIN) hoặc API Key có quyền MEMBERS_FULL.',
        }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // 2. Parse payload JSON
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Dữ liệu yêu cầu không hợp lệ (JSON format required).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const memberId = String(body.memberId || body.member_id || body.userId || body.id || '').trim();
    const rawAmount = body.amount ?? body.coreAmount ?? body.core;
    const typeStr = String(body.type || body.action_type || '').toUpperCase().trim();
    const reason = String(body.reason || body.note || body.description || '').trim();
    const idempotencyKey = String(body.idempotencyKey || body.idempotency_key || '').trim();

    // 3. Validation nghiêm ngặt
    if (!memberId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vui lòng cung cấp mã thành viên (memberId).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const numAmount = Number(rawAmount);
    if (rawAmount === undefined || rawAmount === null || rawAmount === '' || isNaN(numAmount) || !Number.isFinite(numAmount)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Số tiền điều chỉnh không hợp lệ (phải là số nguyên > 0).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (numAmount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Số tiền điều chỉnh phải lớn hơn 0 (không chấp nhận số 0 hoặc số âm).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const amount = Math.floor(numAmount);
    if (amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Số tiền điều chỉnh tối thiểu là 1 Core.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let adjType: 'ADD' | 'SUBTRACT' = 'ADD';
    if (typeStr === 'SUBTRACT' || typeStr === 'SUB' || typeStr === 'TRU' || typeStr === 'DEDUCT') {
      adjType = 'SUBTRACT';
    } else if (typeStr === 'ADD' || typeStr === 'CONG' || typeStr === 'PLUS' || typeStr === 'CREDIT' || typeStr === '') {
      adjType = 'ADD';
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Loại điều chỉnh không hợp lệ (chỉ chấp nhận ADD hoặc SUBTRACT).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    // 4. Chống bấm đúp (Idempotency Guard trong vòng 60 giây)
    if (idempotencyKey) {
      const recentLog = await env.DB.prepare(
        "SELECT details, created_at FROM security_logs WHERE details LIKE ? AND created_at >= datetime('now', '-60 seconds') LIMIT 1"
      ).bind(`%"idempotencyKey":"${idempotencyKey}"%`).first<any>();

      if (recentLog && recentLog.details) {
        let parsedDetails: any = {};
        try { parsedDetails = JSON.parse(recentLog.details); } catch {}
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Giao dịch đã được xử lý thành công trước đó (Idempotent Guard).',
            isDuplicate: true,
            member: parsedDetails.member || { id: memberId },
            transaction: parsedDetails.transaction || null,
          }),
          { status: 200, headers: CORS_HEADERS }
        );
      }
    }

    // 5. Tra cứu thành viên trong D1 SQL
    const member = await env.DB.prepare(`
      SELECT id, username, display_name, email, phone, role, balance, total_spent, status
      FROM members
      WHERE id = ? OR username = ? OR email = ?
      LIMIT 1
    `).bind(memberId, memberId, memberId).first<any>();

    if (!member) {
      return new Response(
        JSON.stringify({ success: false, error: `Không tìm thấy thành viên khớp với "${memberId}".` }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (member.status === 'BANNED') {
      return new Response(
        JSON.stringify({ success: false, error: 'Tài khoản thành viên này đã bị khóa (BANNED).' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // 6. Tính toán số dư mới
    const balanceBefore = Math.max(0, Number(member.balance) || 0);
    let balanceAfter = balanceBefore;
    const delta = adjType === 'ADD' ? amount : -amount;

    if (adjType === 'ADD') {
      balanceAfter = balanceBefore + amount;
    } else {
      if (balanceBefore < amount) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Số dư hiện tại của thành viên (${balanceBefore.toLocaleString('vi-VN')} Core) không đủ để trừ ${amount.toLocaleString('vi-VN')} Core.`,
            currentBalance: balanceBefore,
            requestedDeduction: amount,
          }),
          { status: 400, headers: CORS_HEADERS }
        );
      }
      balanceAfter = balanceBefore - amount;
    }

    // 7. Thực thi ACID Transaction Batch trên Cloudflare D1
    const txId = `tx_adj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const logId = `sec_adj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();
    const noteText = reason || (adjType === 'ADD' ? `Admin cộng +${amount.toLocaleString('vi-VN')} Core` : `Admin trừ -${amount.toLocaleString('vi-VN')} Core`);

    const actorName = adminCheck.adminName || 'Admin';
    const actorEmail = adminCheck.adminId || 'admin@codegame.shop';
    const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';

    const logDetails = JSON.stringify({
      actionType: adjType,
      amount,
      delta,
      balanceBefore,
      balanceAfter,
      memberId: member.id,
      memberUsername: member.username,
      memberEmail: member.email,
      reason: noteText,
      idempotencyKey: idempotencyKey || null,
      transactionId: txId,
      member: {
        id: member.id,
        username: member.username,
        displayName: member.display_name || member.username,
        email: member.email,
        balance: balanceAfter,
        balanceBefore,
        balanceAfter,
      },
      transaction: {
        id: txId,
        type: 'ADMIN_ADJUST',
        amount: delta,
        balanceBefore,
        balanceAfter,
        description: noteText,
        createdAt: nowIso,
      },
    });

    await env.DB.batch([
      env.DB.prepare('UPDATE members SET balance = ?, updated_at = ? WHERE id = ?').bind(balanceAfter, nowIso, member.id),
      env.DB.prepare(`
        INSERT INTO wallet_transactions (id, member_id, member_email, type, amount, balance_before, balance_after, description, status, created_at)
        VALUES (?, ?, ?, 'ADMIN_ADJUST', ?, ?, ?, ?, 'COMPLETED', ?)
      `).bind(txId, member.id, member.email, delta, balanceBefore, balanceAfter, noteText, nowIso),
      env.DB.prepare(`
        INSERT INTO security_logs (id, actor_name, actor_email, action, target_id, ip_address, severity, details, created_at)
        VALUES (?, ?, ?, 'ADJUST_MEMBER_BALANCE', ?, ?, 'CRITICAL', ?, ?)
      `).bind(logId, actorName, actorEmail, member.id, clientIp, logDetails, nowIso),
    ]);

    // 8. Tự động đồng bộ vào wcg_admin_members_v4 trong system_settings (nếu có cache)
    try {
      const rawMembers = await getSettingD1(env.DB, 'wcg_admin_members_v4', []);
      if (Array.isArray(rawMembers)) {
        let changed = false;
        const updatedRaw = rawMembers.map((m: any) => {
          if (m.id === member.id || m.username === member.username || m.email === member.email) {
            changed = true;
            return { ...m, balance: balanceAfter, wallet_balance: balanceAfter };
          }
          return m;
        });
        if (changed) {
          await setSettingD1(env.DB, 'wcg_admin_members_v4', updatedRaw);
        }
      }
    } catch {}

    // 9. Broadcast sự kiện realtime nếu là nạp Core
    if (adjType === 'ADD' && amount >= 1000) {
      await broadcastRealDepositToHub(env, member, amount).catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã ${adjType === 'ADD' ? 'cộng' : 'trừ'} ${amount.toLocaleString('vi-VN')} Core cho tài khoản ${member.display_name || member.username}.`,
        member: {
          id: member.id,
          username: member.username,
          displayName: member.display_name || member.username,
          email: member.email,
          balanceBefore,
          balanceAfter,
          balance: balanceAfter,
          wallet_balance: balanceAfter,
        },
        transaction: {
          id: txId,
          type: 'ADMIN_ADJUST',
          amount: delta,
          balanceBefore,
          balanceAfter,
          description: noteText,
          createdAt: nowIso,
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Lỗi máy chủ khi điều chỉnh số dư ví: ${error.message || 'Unknown error'}`,
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
