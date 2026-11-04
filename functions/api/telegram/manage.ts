/**
 * Telegram Management Endpoint: POST /api/telegram/manage
 * Cổng điều hành nhóm Telegram bảo mật dành cho AI Agent (Muse) và Quản trị viên.
 * 
 * Bảo mật & Ràng buộc:
 * 1. Yêu cầu khóa API mang scope TELEGRAM_FULL hoặc ADMIN_FULL / Master Secret.
 * 2. Token bot và ID nhóm chat lấy từ Cloudflare Env và D1 system_settings (SSOT).
 *    Tuyệt đối không nhận group_id tùy ý từ body để cô lập an toàn nhóm chat.
 *    (Hỗ trợ target: 'admin' đối với gửi/ghim/xóa tin test để kiểm chứng live an toàn không làm phiền nhóm thật).
 * 3. Mọi hành động đều ghi log đầy đủ vào bảng telegram_admin_log trong Cloudflare D1.
 * 4. Tuyệt đối không mở các quyền nguy hiểm: promoteChatMember, xóa nhóm, đổi/đọc token bot.
 */

import {
  ensureTelegramSchema,
  getEffectiveTelegramConfig,
  callTelegramBotApi,
  recordTelegramAdminLog,
  sendTelegramApiMessage,
} from '../../services/telegram_service';
import { verifyAiKeyAuth } from '../../services/mission_service';

interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_GROUP_ID?: string;
  TELEGRAM_ADMIN_CHAT_ID?: string;
  ADMIN_SYNC_SECRET?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key, X-Admin-Key, X-Sync-Key, x-admin-sync-key',
};

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'Database not available' }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }

  // 1. Xác thực bắt buộc bằng scope TELEGRAM_FULL (hoặc ADMIN_FULL / Master Key)
  const authCheck = await verifyAiKeyAuth(request, env.DB, env, 'TELEGRAM_FULL');
  if (!authCheck.authorized) {
    return new Response(
      JSON.stringify({
        success: false,
        error: authCheck.error || 'Unauthorized: Yêu cầu khóa API mang scope TELEGRAM_FULL.',
      }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const callerIdentity = authCheck.keyRecord?.key_name || authCheck.keyRecord?.id || 'master_key';

  // 2. Bảo đảm schema D1 sẵn sàng (telegram_messages & telegram_admin_log)
  await ensureTelegramSchema(env.DB);

  // 3. Đọc cấu hình kết nối Telegram có hiệu lực
  const effectiveConfig = await getEffectiveTelegramConfig(env);
  const botToken = (effectiveConfig.bot_token || '').trim();
  const defaultGroupId = (effectiveConfig.group_id || '').trim();
  const adminChatId = (effectiveConfig.admin_chat_id || '').trim();

  if (!botToken) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Telegram Bot Token chưa được cấu hình trên website.',
      }),
      { status: 503, headers: CORS_HEADERS }
    );
  }

  // 4. Phân tích request body
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid JSON body' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const action = String(body.action || '').trim().toLowerCase();
  if (!action) {
    return new Response(
      JSON.stringify({ success: false, error: 'Thiếu trường action trong yêu cầu.' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Cách ly an toàn chat_id: Mặc định luôn là defaultGroupId.
  // Cho phép target === 'admin' đối với send_message / delete_message / pin_message / unpin_message để kiểm chứng an toàn.
  const isTargetAdmin = body.target === 'admin' && Boolean(adminChatId);
  const targetChatId = isTargetAdmin ? adminChatId : defaultGroupId;

  if (!targetChatId && action !== 'get_recent_messages') {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Chưa cấu hình Telegram Group ID trên website.',
      }),
      { status: 503, headers: CORS_HEADERS }
    );
  }

  // -------------------------------------------------------------
  // XỬ LÝ TỪNG ACTION VÀ GHI LOG AUDIT
  // -------------------------------------------------------------

  try {
    // -----------------------------------------------------------
    // NHÓM 1: ĐỌC TRẠNG THÁI
    // -----------------------------------------------------------

    // Action 1: get_chat
    if (action === 'get_chat') {
      const chatRes = await callTelegramBotApi(botToken, 'getChat', { chat_id: targetChatId });
      if (!chatRes.ok) {
        await recordTelegramAdminLog(env.DB, {
          action,
          target_type: 'chat',
          target_id: targetChatId,
          caller_identity: callerIdentity,
          success: false,
          error_message: chatRes.error,
        });
        return new Response(
          JSON.stringify({ success: false, error: chatRes.error, details: chatRes }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // Lấy thêm số lượng thành viên
      const countRes = await callTelegramBotApi(botToken, 'getChatMemberCount', { chat_id: targetChatId });
      const memberCount = countRes.ok ? countRes.result : null;

      const chatData = {
        id: chatRes.result.id,
        title: chatRes.result.title,
        type: chatRes.result.type,
        description: chatRes.result.description || '',
        invite_link: chatRes.result.invite_link || null,
        permissions: chatRes.result.permissions || null,
        slow_mode_delay: chatRes.result.slow_mode_delay || 0,
        member_count: memberCount,
      };

      await recordTelegramAdminLog(env.DB, {
        action,
        target_type: 'chat',
        target_id: targetChatId,
        caller_identity: callerIdentity,
        payload_summary: `getChat on ${targetChatId}`,
        success: true,
      });

      return new Response(
        JSON.stringify({ success: true, chat: chatData }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Action 2: get_administrators
    if (action === 'get_administrators') {
      const adminRes = await callTelegramBotApi(botToken, 'getChatAdministrators', { chat_id: targetChatId });
      if (!adminRes.ok) {
        await recordTelegramAdminLog(env.DB, {
          action,
          target_type: 'chat',
          target_id: targetChatId,
          caller_identity: callerIdentity,
          success: false,
          error_message: adminRes.error,
        });
        return new Response(
          JSON.stringify({ success: false, error: adminRes.error }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const admins = (adminRes.result || []).map((adm: any) => ({
        user_id: adm.user?.id,
        username: adm.user?.username || null,
        first_name: adm.user?.first_name || '',
        last_name: adm.user?.last_name || '',
        is_bot: Boolean(adm.user?.is_bot),
        status: adm.status,
        custom_title: adm.custom_title || null,
        can_delete_messages: adm.can_delete_messages,
        can_restrict_members: adm.can_restrict_members,
        can_pin_messages: adm.can_pin_messages,
        can_invite_users: adm.can_invite_users,
      }));

      await recordTelegramAdminLog(env.DB, {
        action,
        target_type: 'chat',
        target_id: targetChatId,
        caller_identity: callerIdentity,
        payload_summary: `Found ${admins.length} administrators`,
        success: true,
      });

      return new Response(
        JSON.stringify({ success: true, count: admins.length, administrators: admins }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Action 3: get_recent_messages (Đọc từ D1 telegram_messages)
    if (action === 'get_recent_messages') {
      const limit = Math.min(Math.max(Number(body.limit) || 30, 1), 100);
      const offset = Math.max(Number(body.offset) || 0, 0);
      const userIdFilter = body.user_id ? String(body.user_id).trim() : null;

      let query = `
        SELECT id, message_id, chat_id, user_id, username, first_name, last_name, text, reply_to_message_id, message_thread_id, created_at
        FROM telegram_messages
      `;
      const params: any[] = [];

      if (userIdFilter) {
        query += ` WHERE user_id = ? `;
        params.push(userIdFilter);
      }

      query += ` ORDER BY id DESC LIMIT ? OFFSET ? `;
      params.push(limit, offset);

      const rowsRes: any = await env.DB.prepare(query).bind(...params).all();
      const messages = rowsRes?.results || [];

      // Tổng số tin nhắn đã lưu
      const countRes: any = await env.DB.prepare('SELECT COUNT(*) as total FROM telegram_messages').first();
      const totalMessages = countRes?.total || 0;

      await recordTelegramAdminLog(env.DB, {
        action,
        target_type: 'messages',
        target_id: userIdFilter || 'all',
        caller_identity: callerIdentity,
        payload_summary: `Read ${messages.length} messages (limit=${limit}, offset=${offset})`,
        success: true,
      });

      return new Response(
        JSON.stringify({
          success: true,
          total: totalMessages,
          limit,
          offset,
          messages,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // -----------------------------------------------------------
    // NHÓM 2: GỬI, XÓA & GHIM TIN NHẮN
    // -----------------------------------------------------------

    // Action 4: send_message
    if (action === 'send_message') {
      const text = String(body.text || body.content || body.message || '').trim();
      if (!text) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nội dung tin nhắn (text) không được để trống.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const parseMode = body.parse_mode || 'HTML';
      const threadId = typeof body.thread_id === 'number' ? body.thread_id : undefined;
      const disablePreview = Boolean(body.disable_web_page_preview);

      const sendRes = await sendTelegramApiMessage(botToken, targetChatId, text, {
        parse_mode: parseMode,
        message_thread_id: threadId,
        disable_web_page_preview: disablePreview,
      });

      if (!sendRes.ok) {
        await recordTelegramAdminLog(env.DB, {
          action,
          target_type: 'message',
          target_id: targetChatId,
          caller_identity: callerIdentity,
          payload_summary: `Send failed: ${text.slice(0, 80)}`,
          success: false,
          error_message: sendRes.error,
        });
        return new Response(
          JSON.stringify({ success: false, error: sendRes.error }),
          { status: 500, headers: CORS_HEADERS }
        );
      }

      const sentMsgId = sendRes.message_id;

      await recordTelegramAdminLog(env.DB, {
        action,
        target_type: 'message',
        target_id: String(sentMsgId),
        caller_identity: callerIdentity,
        payload_summary: `Sent message to ${targetChatId} (id=${sentMsgId})`,
        success: true,
        result_json: JSON.stringify({ message_id: sentMsgId }),
      });

      return new Response(
        JSON.stringify({
          success: true,
          chat_id: targetChatId,
          message_id: sentMsgId,
          target: isTargetAdmin ? 'admin' : 'group',
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Action 5: delete_message
    if (action === 'delete_message') {
      const messageId = body.message_id || body.message_ids;
      if (!messageId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Thiếu trường message_id.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // Hỗ trợ xóa danh sách mảng message_ids hoặc 1 message_id
      const idList = Array.isArray(messageId) ? messageId : [messageId];
      const deletedIds: number[] = [];
      const failedIds: { id: any; error: string }[] = [];

      for (const mId of idList) {
        const delRes = await callTelegramBotApi(botToken, 'deleteMessage', {
          chat_id: targetChatId,
          message_id: Number(mId),
        });
        if (delRes.ok) {
          deletedIds.push(Number(mId));
        } else {
          failedIds.push({ id: mId, error: delRes.error || 'Failed' });
        }
      }

      const allOk = failedIds.length === 0;

      await recordTelegramAdminLog(env.DB, {
        action,
        target_type: 'message',
        target_id: idList.join(','),
        caller_identity: callerIdentity,
        payload_summary: `Deleted ${deletedIds.length}/${idList.length} messages on ${targetChatId}`,
        success: allOk,
        result_json: JSON.stringify({ deleted: deletedIds, failed: failedIds }),
        error_message: failedIds.length > 0 ? failedIds[0].error : undefined,
      });

      return new Response(
        JSON.stringify({
          success: deletedIds.length > 0,
          deleted_ids: deletedIds,
          failed: failedIds,
          chat_id: targetChatId,
        }),
        { status: deletedIds.length > 0 ? 200 : 400, headers: CORS_HEADERS }
      );
    }

    // Action 6: pin_message
    if (action === 'pin_message') {
      const messageId = Number(body.message_id);
      if (!messageId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Thiếu trường message_id hợp lệ.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const disableNotification = Boolean(body.disable_notification);
      const pinRes = await callTelegramBotApi(botToken, 'pinChatMessage', {
        chat_id: targetChatId,
        message_id: messageId,
        disable_notification: disableNotification,
      });

      if (!pinRes.ok) {
        await recordTelegramAdminLog(env.DB, {
          action,
          target_type: 'message',
          target_id: String(messageId),
          caller_identity: callerIdentity,
          success: false,
          error_message: pinRes.error,
        });
        return new Response(
          JSON.stringify({ success: false, error: pinRes.error }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      await recordTelegramAdminLog(env.DB, {
        action,
        target_type: 'message',
        target_id: String(messageId),
        caller_identity: callerIdentity,
        payload_summary: `Pinned message ${messageId} on ${targetChatId}`,
        success: true,
      });

      return new Response(
        JSON.stringify({ success: true, message_id: messageId, pinned: true, chat_id: targetChatId }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Action 7: unpin_message
    if (action === 'unpin_message') {
      const unpinAll = Boolean(body.unpin_all);
      const messageId = body.message_id ? Number(body.message_id) : undefined;

      let unpinRes: any;
      if (unpinAll) {
        unpinRes = await callTelegramBotApi(botToken, 'unpinAllChatMessages', {
          chat_id: targetChatId,
        });
      } else {
        const payload: any = { chat_id: targetChatId };
        if (messageId) payload.message_id = messageId;
        unpinRes = await callTelegramBotApi(botToken, 'unpinChatMessage', payload);
      }

      if (!unpinRes.ok) {
        await recordTelegramAdminLog(env.DB, {
          action,
          target_type: 'message',
          target_id: messageId ? String(messageId) : (unpinAll ? 'all' : 'top'),
          caller_identity: callerIdentity,
          success: false,
          error_message: unpinRes.error,
        });
        return new Response(
          JSON.stringify({ success: false, error: unpinRes.error }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      await recordTelegramAdminLog(env.DB, {
        action,
        target_type: 'message',
        target_id: messageId ? String(messageId) : (unpinAll ? 'all' : 'top'),
        caller_identity: callerIdentity,
        payload_summary: unpinAll ? `Unpinned all messages on ${targetChatId}` : `Unpinned message ${messageId || 'top'}`,
        success: true,
      });

      return new Response(
        JSON.stringify({ success: true, unpinned: true, unpin_all: unpinAll, message_id: messageId || null }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // -----------------------------------------------------------
    // NHÓM 3: QUẢN LÝ THÀNH VIÊN (CHỈ THAO TÁC TRÊN GROUP_ID)
    // -----------------------------------------------------------

    // Action 8: ban_member
    if (action === 'ban_member') {
      const userId = Number(body.user_id);
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Thiếu trường user_id hợp lệ.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const revokeMessages = Boolean(body.revoke_messages);
      let untilDate = body.until_date ? Number(body.until_date) : undefined;

      // Hỗ trợ duration_seconds hoặc duration_hours
      if (!untilDate && body.duration_seconds) {
        untilDate = Math.floor(Date.now() / 1000) + Number(body.duration_seconds);
      } else if (!untilDate && body.duration_hours) {
        untilDate = Math.floor(Date.now() / 1000) + Number(body.duration_hours) * 3600;
      }

      const banPayload: any = {
        chat_id: defaultGroupId,
        user_id: userId,
        revoke_messages: revokeMessages,
      };
      if (untilDate) banPayload.until_date = untilDate;

      const banRes = await callTelegramBotApi(botToken, 'banChatMember', banPayload);

      if (!banRes.ok) {
        await recordTelegramAdminLog(env.DB, {
          action,
          target_type: 'member',
          target_id: String(userId),
          caller_identity: callerIdentity,
          success: false,
          error_message: banRes.error,
        });
        return new Response(
          JSON.stringify({ success: false, error: banRes.error }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      await recordTelegramAdminLog(env.DB, {
        action,
        target_type: 'member',
        target_id: String(userId),
        caller_identity: callerIdentity,
        payload_summary: `Banned member ${userId} (until=${untilDate || 'forever'}, revoke=${revokeMessages})`,
        success: true,
      });

      return new Response(
        JSON.stringify({
          success: true,
          banned: true,
          user_id: userId,
          until_date: untilDate || null,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Action 9: unban_member
    if (action === 'unban_member') {
      const userId = Number(body.user_id);
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Thiếu trường user_id hợp lệ.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const unbanRes = await callTelegramBotApi(botToken, 'unbanChatMember', {
        chat_id: defaultGroupId,
        user_id: userId,
        only_if_banned: true,
      });

      if (!unbanRes.ok) {
        await recordTelegramAdminLog(env.DB, {
          action,
          target_type: 'member',
          target_id: String(userId),
          caller_identity: callerIdentity,
          success: false,
          error_message: unbanRes.error,
        });
        return new Response(
          JSON.stringify({ success: false, error: unbanRes.error }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      await recordTelegramAdminLog(env.DB, {
        action,
        target_type: 'member',
        target_id: String(userId),
        caller_identity: callerIdentity,
        payload_summary: `Unbanned member ${userId}`,
        success: true,
      });

      return new Response(
        JSON.stringify({ success: true, unbanned: true, user_id: userId }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Action 10: restrict_member
    if (action === 'restrict_member') {
      const userId = Number(body.user_id);
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Thiếu trường user_id hợp lệ.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      let untilDate = body.until_date ? Number(body.until_date) : undefined;
      if (!untilDate && body.duration_seconds) {
        untilDate = Math.floor(Date.now() / 1000) + Number(body.duration_seconds);
      } else if (!untilDate && body.duration_hours) {
        untilDate = Math.floor(Date.now() / 1000) + Number(body.duration_hours) * 3600;
      }

      // Quyền mặc định khi bị restrict: Tắt gửi tin nhắn nếu không chỉ định rõ
      const permissions = body.permissions || {
        can_send_messages: false,
        can_send_audios: false,
        can_send_documents: false,
        can_send_photos: false,
        can_send_videos: false,
        can_send_video_notes: false,
        can_send_voice_notes: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false,
      };

      const restrictPayload: any = {
        chat_id: defaultGroupId,
        user_id: userId,
        permissions,
      };
      if (untilDate) restrictPayload.until_date = untilDate;

      const restRes = await callTelegramBotApi(botToken, 'restrictChatMember', restrictPayload);

      if (!restRes.ok) {
        await recordTelegramAdminLog(env.DB, {
          action,
          target_type: 'member',
          target_id: String(userId),
          caller_identity: callerIdentity,
          success: false,
          error_message: restRes.error,
        });
        return new Response(
          JSON.stringify({ success: false, error: restRes.error }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      await recordTelegramAdminLog(env.DB, {
        action,
        target_type: 'member',
        target_id: String(userId),
        caller_identity: callerIdentity,
        payload_summary: `Restricted member ${userId} (until=${untilDate || 'forever'})`,
        success: true,
      });

      return new Response(
        JSON.stringify({
          success: true,
          restricted: true,
          user_id: userId,
          permissions,
          until_date: untilDate || null,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // -----------------------------------------------------------
    // NHÓM 4: QUYỀN & THÔNG TIN NHÓM
    // -----------------------------------------------------------

    // Action 11: set_chat_permissions
    if (action === 'set_chat_permissions') {
      const permissions = body.permissions;
      if (!permissions || typeof permissions !== 'object') {
        return new Response(
          JSON.stringify({ success: false, error: 'Thiếu đối tượng permissions hợp lệ.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const permRes = await callTelegramBotApi(botToken, 'setChatPermissions', {
        chat_id: defaultGroupId,
        permissions,
      });

      if (!permRes.ok) {
        await recordTelegramAdminLog(env.DB, {
          action,
          target_type: 'permissions',
          target_id: defaultGroupId,
          caller_identity: callerIdentity,
          success: false,
          error_message: permRes.error,
        });
        return new Response(
          JSON.stringify({ success: false, error: permRes.error }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // Nếu có thiết lập slow_mode_delay (0..21600 giây)
      if (typeof body.slow_mode_delay === 'number') {
        await callTelegramBotApi(botToken, 'setChatSlowModeDelay', {
          chat_id: defaultGroupId,
          slow_mode_delay: body.slow_mode_delay,
        });
      }

      await recordTelegramAdminLog(env.DB, {
        action,
        target_type: 'permissions',
        target_id: defaultGroupId,
        caller_identity: callerIdentity,
        payload_summary: `Updated group permissions (slow_mode=${body.slow_mode_delay ?? 'unchanged'})`,
        success: true,
      });

      return new Response(
        JSON.stringify({ success: true, permissions, slow_mode_delay: body.slow_mode_delay ?? null }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Action 12: set_chat_title
    if (action === 'set_chat_title') {
      const title = String(body.title || '').trim();
      if (!title) {
        return new Response(
          JSON.stringify({ success: false, error: 'Tên nhóm (title) không được để trống.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const titleRes = await callTelegramBotApi(botToken, 'setChatTitle', {
        chat_id: defaultGroupId,
        title,
      });

      if (!titleRes.ok) {
        await recordTelegramAdminLog(env.DB, {
          action,
          target_type: 'chat',
          target_id: defaultGroupId,
          caller_identity: callerIdentity,
          success: false,
          error_message: titleRes.error,
        });
        return new Response(
          JSON.stringify({ success: false, error: titleRes.error }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      await recordTelegramAdminLog(env.DB, {
        action,
        target_type: 'chat',
        target_id: defaultGroupId,
        caller_identity: callerIdentity,
        payload_summary: `Changed title to "${title}"`,
        success: true,
      });

      return new Response(
        JSON.stringify({ success: true, title }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Action 13: set_chat_description
    if (action === 'set_chat_description') {
      const description = String(body.description ?? '').trim();
      const descRes = await callTelegramBotApi(botToken, 'setChatDescription', {
        chat_id: defaultGroupId,
        description,
      });

      if (!descRes.ok) {
        await recordTelegramAdminLog(env.DB, {
          action,
          target_type: 'chat',
          target_id: defaultGroupId,
          caller_identity: callerIdentity,
          success: false,
          error_message: descRes.error,
        });
        return new Response(
          JSON.stringify({ success: false, error: descRes.error }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      await recordTelegramAdminLog(env.DB, {
        action,
        target_type: 'chat',
        target_id: defaultGroupId,
        caller_identity: callerIdentity,
        payload_summary: `Changed description: "${description.slice(0, 50)}"`,
        success: true,
      });

      return new Response(
        JSON.stringify({ success: true, description }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Action 14: create_invite_link
    if (action === 'create_invite_link') {
      const linkPayload: any = { chat_id: defaultGroupId };
      if (body.name) linkPayload.name = String(body.name).trim();
      if (body.expire_date) linkPayload.expire_date = Number(body.expire_date);
      if (body.member_limit) linkPayload.member_limit = Number(body.member_limit);
      if (typeof body.creates_join_request === 'boolean') {
        linkPayload.creates_join_request = body.creates_join_request;
      }

      const linkRes = await callTelegramBotApi(botToken, 'createChatInviteLink', linkPayload);

      if (!linkRes.ok) {
        await recordTelegramAdminLog(env.DB, {
          action,
          target_type: 'invite_link',
          target_id: defaultGroupId,
          caller_identity: callerIdentity,
          success: false,
          error_message: linkRes.error,
        });
        return new Response(
          JSON.stringify({ success: false, error: linkRes.error }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const inviteLink = linkRes.result.invite_link;

      await recordTelegramAdminLog(env.DB, {
        action,
        target_type: 'invite_link',
        target_id: inviteLink,
        caller_identity: callerIdentity,
        payload_summary: `Created invite link: ${inviteLink}`,
        success: true,
      });

      return new Response(
        JSON.stringify({ success: true, link: linkRes.result }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Action 15: revoke_invite_link
    if (action === 'revoke_invite_link') {
      const inviteLink = String(body.invite_link || '').trim();
      if (!inviteLink) {
        return new Response(
          JSON.stringify({ success: false, error: 'Thiếu chuỗi invite_link cần thu hồi.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const revRes = await callTelegramBotApi(botToken, 'revokeChatInviteLink', {
        chat_id: defaultGroupId,
        invite_link: inviteLink,
      });

      if (!revRes.ok) {
        await recordTelegramAdminLog(env.DB, {
          action,
          target_type: 'invite_link',
          target_id: inviteLink,
          caller_identity: callerIdentity,
          success: false,
          error_message: revRes.error,
        });
        return new Response(
          JSON.stringify({ success: false, error: revRes.error }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      await recordTelegramAdminLog(env.DB, {
        action,
        target_type: 'invite_link',
        target_id: inviteLink,
        caller_identity: callerIdentity,
        payload_summary: `Revoked invite link: ${inviteLink}`,
        success: true,
      });

      return new Response(
        JSON.stringify({ success: true, revoked: true, link: revRes.result }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Action không hợp lệ
    return new Response(
      JSON.stringify({
        success: false,
        error: `Action '${action}' không được hỗ trợ. Các action hợp lệ: get_chat, get_administrators, get_recent_messages, send_message, delete_message, pin_message, unpin_message, ban_member, unban_member, restrict_member, set_chat_permissions, set_chat_title, set_chat_description, create_invite_link, revoke_invite_link.`,
      }),
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    await recordTelegramAdminLog(env.DB, {
      action,
      target_type: 'error',
      caller_identity: callerIdentity,
      success: false,
      error_message: err?.message || 'Server Exception',
    });
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Internal server error' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
