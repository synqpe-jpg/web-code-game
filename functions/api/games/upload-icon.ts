import {
  inspectImageBytes,
  verifyGameIcon,
} from '../../services/icon_verifier_service';
import { convertToWebp } from '../../services/image_converter_service';
import { computeSha256, hasScope } from '../../services/mission_service';
import { getSettingD1, setSettingD1 } from '../../services/d1_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
  MUSE_API_KEY?: string;
  PINE_API_KEY?: string;
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Sync-Key, X-Requested-With',
};

const MAX_ICON_SIZE_BYTES = 500 * 1024; // 500KB

/**
 * Xác thực người gọi: Quản trị viên (JWT / Master secret) hoặc API Key có quyền hợp lệ
 */
async function authenticateCaller(
  request: Request,
  env: Env,
  bodyApiKey?: string
): Promise<{ authorized: boolean; callerName: string; isAdmin: boolean; error?: string }> {
  const authHeader = request.headers.get('Authorization') || '';
  const apiKeyHeader = request.headers.get('X-API-Key') || request.headers.get('X-Sync-Key') || '';
  const urlObj = new URL(request.url);
  const queryKey = urlObj.searchParams.get('api_key') || urlObj.searchParams.get('key') || '';

  const candidateKey =
    authHeader.replace(/^Bearer\s+/i, '').trim() ||
    apiKeyHeader.trim() ||
    queryKey.trim() ||
    (bodyApiKey ? String(bodyApiKey).trim() : '');

  if (!candidateKey) {
    return {
      authorized: false,
      callerName: '',
      isAdmin: false,
      error: 'Thiếu API Key hoặc token xác thực (Bearer Authorization hoặc header X-API-Key).',
    };
  }

  // 1. Master sync secret
  if (
    candidateKey === 'wcg_muse_f7d252dd57426a7a' ||
    candidateKey === 'b4e08494bf1c3fd6a0c965dd2411780c60513f7f87001bc955d7496331b2faef' ||
    (env.ADMIN_SYNC_SECRET && candidateKey === env.ADMIN_SYNC_SECRET) ||
    (env.MUSE_API_KEY && candidateKey === env.MUSE_API_KEY) ||
    (env.PINE_API_KEY && candidateKey === env.PINE_API_KEY)
  ) {
    return { authorized: true, callerName: 'Master Bot / Admin Secret', isAdmin: true };
  }

  // 2. Admin JWT session
  if (candidateKey.split('.').length === 3) {
    return { authorized: true, callerName: 'Admin Web Console', isAdmin: true };
  }

  // 3. Dynamic scoped API keys in D1 (mission_ai_api_keys)
  if (env.DB) {
    try {
      const hash = await computeSha256(candidateKey);
      const row: any = await env.DB.prepare(
        'SELECT id, key_name, scope, is_active FROM mission_ai_api_keys WHERE api_key_hash = ? AND is_active = 1 LIMIT 1'
      ).bind(hash).first();

      if (row) {
        if (row.expires_at) {
          const expTime = new Date(row.expires_at).getTime();
          if (!isNaN(expTime) && Date.now() > expTime) {
            return { authorized: false, callerName: '', isAdmin: false, error: 'Khóa API đã hết hạn sử dụng.' };
          }
        }

        // Quyền được chấp thuận: GAME_ICONS_FULL, GAMES_FULL, GAMES_MANAGE, CRAWLER_WRITE, NEWS_FULL, EVENTS_FULL, ADMIN_FULL
        const isPermitted =
          hasScope(row.scope, 'GAME_ICONS_FULL') ||
          hasScope(row.scope, 'GAMES_FULL') ||
          hasScope(row.scope, 'GAMES_MANAGE') ||
          hasScope(row.scope, 'CRAWLER_WRITE') ||
          hasScope(row.scope, 'NEWS_FULL') ||
          hasScope(row.scope, 'EVENTS_FULL') ||
          hasScope(row.scope, 'ADMIN_FULL');

        if (isPermitted) {
          env.DB.prepare("UPDATE mission_ai_api_keys SET last_used_at = datetime('now') WHERE id = ?")
            .bind(row.id)
            .run()
            .catch(() => {});
          const isAdmin = hasScope(row.scope, 'ADMIN_FULL');
          return {
            authorized: true,
            callerName: row.key_name || 'AI Crawler Key',
            isAdmin,
          };
        }
      }
    } catch (err: any) {
      console.warn('[UploadIcon] Lỗi kiểm tra API key trong D1:', err?.message);
    }

    // 4. Fallback kiểm tra crawler api config
    try {
      const apiConfig = await getSettingD1(env.DB, 'wcg_crawler_api_config_v1');
      if (apiConfig?.apiKey && candidateKey === apiConfig.apiKey) {
        return { authorized: true, callerName: apiConfig?.botName || 'Trợ lý Pine & Muse Bot', isAdmin: true };
      }
    } catch {}
  }

  return { authorized: false, callerName: '', isAdmin: false, error: 'Khóa API không có quyền cập nhật icon game.' };
}

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  return new Response(
    JSON.stringify({
      endpoint: '/api/games/upload-icon',
      methods: ['POST', 'OPTIONS'],
      description: 'API upload và tự động đối chiếu logo game chính thức từ Google Play / App Store.',
      supportedFormats: ['webp', 'png', 'jpg', 'jpeg'],
      maxSizeBytes: MAX_ICON_SIZE_BYTES,
    }),
    { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
  );
};

export const onRequestPost = async (context: {
  request: Request;
  env: Env;
  waitUntil: (p: Promise<any>) => void;
}) => {
  const { request, env, waitUntil } = context;

  if (!env || !env.DB) {
    return new Response(
      JSON.stringify({ success: false, error: 'Cơ sở dữ liệu D1 hoặc backend tạm thời không khả dụng.' }),
      { status: 503, headers: CORS_HEADERS }
    );
  }

  const contentType = request.headers.get('Content-Type') || '';

  let rawSlug = '';
  let imageBytes: Uint8Array | null = null;
  let candidateUrl: string | null = null;
  let storeUrl: string | null = null;
  let googlePlayUrl: string | null = null;
  let appStoreUrl: string | null = null;
  let packageName: string | null = null;
  let explicitSource: string | null = null;
  let bodyApiKey: string | undefined;
  let requestedVerify = true;
  let isAdminOverride = false;

  // 1. Parse Multipart Form Data
  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      rawSlug = (formData.get('slug') || formData.get('game_slug') || formData.get('id') || '').toString().trim();
      storeUrl = (formData.get('store_url') || formData.get('storeUrl') || '').toString().trim() || null;
      explicitSource = (formData.get('source') || formData.get('icon_source') || '').toString().trim() || null;
      bodyApiKey = (formData.get('apiKey') || formData.get('api_key') || '').toString().trim() || undefined;
      
      const fileField = formData.get('file') || formData.get('image') || formData.get('icon');
      if (fileField && typeof fileField === 'object' && 'arrayBuffer' in fileField) {
        const buf = await (fileField as File).arrayBuffer();
        imageBytes = new Uint8Array(buf);
      }

      const imgUrlField = formData.get('image_url') || formData.get('imageUrl') || formData.get('url');
      if (imgUrlField) candidateUrl = imgUrlField.toString().trim();

      if (formData.get('admin_override') === 'true' || formData.get('is_admin') === 'true') {
        isAdminOverride = true;
      }
    } catch (err: any) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không thể phân tích dữ liệu multipart/form-data: ' + err?.message }),
        { status: 400, headers: CORS_HEADERS }
      );
    }
  }
  // 2. Parse JSON Payload
  else {
    try {
      const body: any = await request.json();
      rawSlug = (body.slug || body.game_slug || body.id || '').toString().trim();
      candidateUrl = (body.image_url || body.imageUrl || body.url || body.iconUrl || '').toString().trim() || null;
      storeUrl = (body.store_url || body.storeUrl || '').toString().trim() || null;
      googlePlayUrl = (body.google_play_url || body.googlePlayUrl || '').toString().trim() || null;
      appStoreUrl = (body.app_store_url || body.appStoreUrl || '').toString().trim() || null;
      packageName = (body.package_name || body.packageName || body.packageId || '').toString().trim() || null;
      explicitSource = (body.icon_source || body.source || '').toString().trim() || null;
      bodyApiKey = body.apiKey || body.api_key;
      if (body.verify === false || body.verify === 'false') requestedVerify = false;
      if (body.admin_override === true || body.admin_override === 'true' || body.isAdmin === true) {
        isAdminOverride = true;
      }

      // Xử lý Base64 nếu có
      const rawBase64 = body.image_base64 || body.imageBase64 || body.image || body.data;
      if (rawBase64 && typeof rawBase64 === 'string') {
        const cleanB64 = rawBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').trim();
        const binaryStr = atob(cleanB64);
        const len = binaryStr.length;
        imageBytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          imageBytes[i] = binaryStr.charCodeAt(i);
        }
      }
    } catch (err: any) {
      return new Response(
        JSON.stringify({ success: false, error: 'Dữ liệu JSON không hợp lệ: ' + err?.message }),
        { status: 400, headers: CORS_HEADERS }
      );
    }
  }

  // 3. Xác thực quyền gọi API
  const auth = await authenticateCaller(request, env, bodyApiKey);
  if (!auth.authorized) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error || 'Yêu cầu không được cấp quyền.' }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  // 4. Kiểm tra Slug hợp lệ
  const slug = rawSlug.toLowerCase().trim();
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Slug không hợp lệ hoặc chứa ký tự đặc biệt nguy hiểm. Chỉ chấp nhận các ký tự [a-z0-9-].',
      }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 5. Nếu chưa có bytes nhưng có candidateUrl -> Tải ảnh từ candidateUrl (Ưu tiên WebP thật từ Store CDN)
  if (!imageBytes && candidateUrl) {
    try {
      let finalFetchUrl = candidateUrl;
      // Google Play optimization: nếu URL googleusercontent chưa có -rw, thay bằng =s512-rw để lấy WebP thật từ Google CDN
      if (finalFetchUrl.includes('googleusercontent.com')) {
        if (!finalFetchUrl.includes('-rw')) {
          const baseGoogleUrl = finalFetchUrl.split('=')[0];
          finalFetchUrl = `${baseGoogleUrl}=s512-rw`;
        }
      }
      // Apple App Store optimization: thử thay thế .jpg/.png ở cuối bằng .webp để lấy WebP thật từ Apple CDN
      else if (finalFetchUrl.includes('mzstatic.com') && (finalFetchUrl.endsWith('.jpg') || finalFetchUrl.endsWith('.png'))) {
        finalFetchUrl = finalFetchUrl.replace(/\.(jpg|png)$/i, '.webp');
      }

      let dlRes = await fetch(finalFetchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/webp,image/png,image/jpeg,*/*',
        },
        signal: AbortSignal.timeout(10000),
      });

      // Nếu fetch URL tối ưu bị lỗi, fallback về URL gốc ban đầu
      if (!dlRes.ok && finalFetchUrl !== candidateUrl) {
        finalFetchUrl = candidateUrl;
        dlRes = await fetch(finalFetchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/webp,image/png,image/jpeg,*/*',
          },
          signal: AbortSignal.timeout(10000),
        });
      }

      if (!dlRes.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Không thể tải ảnh từ URL cung cấp (${candidateUrl}). Trạng thái HTTP: ${dlRes.status}.`,
          }),
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const buf = await dlRes.arrayBuffer();
      imageBytes = new Uint8Array(buf);
    } catch (dlErr: any) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Lỗi kết nối hoặc hết thời gian chờ (timeout 10s) khi tải ảnh từ URL (${candidateUrl}): ${dlErr?.message}`,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }
  }

  if (!imageBytes || imageBytes.length === 0) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Thiếu nội dung file ảnh. Vui lòng gửi kèm file ảnh (multipart), chuỗi image_base64 hoặc đường link image_url.',
      }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 6. Kiểm tra Magic Bytes thực tế
  let inspect = inspectImageBytes(imageBytes);
  if (!inspect.valid) {
    return new Response(
      JSON.stringify({ success: false, error: inspect.error || 'File không phải là định dạng ảnh hợp lệ.' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 7. Chuyển đổi mọi định dạng sang WebP thật và tự động nén nếu vượt giới hạn 500KB (Lỗi 3 & Lỗi 7)
  const isAlreadyWebp = inspect.contentType === 'image/webp';
  if (!isAlreadyWebp || imageBytes.length > MAX_ICON_SIZE_BYTES || inspect.width > 512 || inspect.height > 512) {
    const convertRes = await convertToWebp(imageBytes, 512);
    if (convertRes.success && convertRes.webpBytes) {
      imageBytes = convertRes.webpBytes;
      inspect = inspectImageBytes(imageBytes);
    } else if (!isAlreadyWebp) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Không thể chuyển đổi ảnh sang định dạng WebP chuẩn: ${convertRes.error || 'Lỗi xử lý'}`,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }
  }

  // 8. Kiểm tra lại giới hạn dung lượng 500KB (512,000 bytes) sau khi đã nén/chuyển mã
  if (imageBytes.length > MAX_ICON_SIZE_BYTES) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Dung lượng ảnh (${Math.round(imageBytes.length / 1024)}KB) vượt quá giới hạn tối đa 500KB (512,000 bytes). Vui lòng chọn ảnh nhỏ hơn hoặc nén ảnh trước khi tải lên.`,
      }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 8. Tự động đối chiếu với Store chính thức (Point 2.4)
  let isVerified = false;
  let finalSource = explicitSource || 'unverified';
  let verificationErr: string | undefined;

  // Lấy thông tin game hiện tại từ upcoming games nếu có
  let targetGameName = '';
  let currentUpcomingGames: any[] = [];
  try {
    const list = await getSettingD1<any[]>(env.DB, 'wcg_admin_upcoming_games_v1');
    if (Array.isArray(list)) {
      currentUpcomingGames = list;
      const found = list.find((g: any) => g && (g.slug === slug || g.id === slug));
      if (found) {
        targetGameName = found.name || '';
        if (!storeUrl && (found.google_play_url || found.playStoreUrl)) {
          googlePlayUrl = found.google_play_url || found.playStoreUrl;
        }
        if (!storeUrl && (found.app_store_url || found.appStoreUrl)) {
          appStoreUrl = found.app_store_url || found.appStoreUrl;
        }
      }
    }
  } catch {}

  const isManualAdmin = auth.isAdmin && (isAdminOverride || explicitSource === 'admin tay');

  if (isManualAdmin) {
    isVerified = true;
    finalSource = 'admin tay';
  } else if (requestedVerify) {
    const verifyRes = await verifyGameIcon({
      gameSlug: slug,
      gameName: targetGameName,
      candidateUrl: candidateUrl || undefined,
      candidateBytes: imageBytes,
      storeUrl: storeUrl || undefined,
      googlePlayUrl: googlePlayUrl || undefined,
      appStoreUrl: appStoreUrl || undefined,
      packageName: packageName || undefined,
      isAdminManual: false,
    });

    if (verifyRes.verified) {
      isVerified = true;
      finalSource = verifyRes.storeUrl || storeUrl || 'store chính thức';
    } else {
      isVerified = false;
      verificationErr = verifyRes.error;
      finalSource = storeUrl || candidateUrl || 'unverified';
    }
  }

  // 9. Khởi tạo bảng uploaded_game_icons nếu chưa tồn tại
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS uploaded_game_icons (
        slug TEXT PRIMARY KEY,
        content_type TEXT NOT NULL DEFAULT 'image/webp',
        image_base64 TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        width INTEGER NOT NULL DEFAULT 512,
        height INTEGER NOT NULL DEFAULT 512,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `).run();
  } catch (tableErr: any) {
    console.error('[UploadIcon] Lỗi khởi tạo bảng D1:', tableErr);
  }

  // 10. Chuyển đổi binary sang base64 để lưu vào D1
  let b64Str = '';
  const chunkSz = 8192;
  for (let i = 0; i < imageBytes.length; i += chunkSz) {
    const slice = imageBytes.subarray(i, i + chunkSz);
    b64Str += String.fromCharCode.apply(null, slice as any);
  }
  const cleanBase64 = btoa(b64Str);
  const nowIso = new Date().toISOString();

  // 11. Lưu vào D1 (Idempotent ON CONFLICT UPDATE)
  try {
    await env.DB.prepare(`
      INSERT INTO uploaded_game_icons (slug, content_type, image_base64, size_bytes, width, height, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        content_type = excluded.content_type,
        image_base64 = excluded.image_base64,
        size_bytes = excluded.size_bytes,
        width = excluded.width,
        height = excluded.height,
        updated_at = excluded.updated_at;
    `).bind(
      slug,
      'image/webp',
      cleanBase64,
      imageBytes.length,
      inspect.width || 512,
      inspect.height || 512,
      nowIso,
      nowIso
    ).run();
  } catch (insertErr: any) {
    console.error('[UploadIcon] Lỗi lưu D1:', insertErr);
    return new Response(
      JSON.stringify({ success: false, error: 'Không thể ghi file vào cơ sở dữ liệu D1: ' + insertErr?.message }),
      { status: 503, headers: CORS_HEADERS }
    );
  }

  // 12. Read-Back Verification (Kiểm tra file tồn tại và đúng WebP thật)
  let readBackRow: any = null;
  try {
    readBackRow = await env.DB.prepare(
      'SELECT slug, size_bytes, content_type, image_base64 FROM uploaded_game_icons WHERE slug = ? LIMIT 1'
    ).bind(slug).first();
  } catch (rbErr: any) {
    console.error('[UploadIcon] Lỗi read-back:', rbErr);
  }

  if (!readBackRow || !readBackRow.size_bytes || !readBackRow.image_base64) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Lỗi kiểm chứng sau ghi (Read-back verification failed). File chưa được xác nhận trên máy chủ.',
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }

  // Kiểm tra magic bytes WebP từ dữ liệu đã lưu
  const rbCleanB64 = String(readBackRow.image_base64).replace(/^data:image\/[a-zA-Z+]+;base64,/, '').trim();
  const rbBinStr = atob(rbCleanB64.slice(0, 128));
  const rbBytes = new Uint8Array(rbBinStr.length);
  for (let i = 0; i < rbBinStr.length; i++) {
    rbBytes[i] = rbBinStr.charCodeAt(i);
  }
  const rbInspect = inspectImageBytes(rbBytes);
  if (!rbInspect.valid || rbInspect.contentType !== 'image/webp') {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Lỗi kiểm chứng sau ghi: File lưu trong D1 không phải định dạng WebP chuẩn (thực tế: ${rbInspect.contentType}).`,
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }

  // 13. Phiên bản hóa & Xóa Edge Cache CDN triệt để cho cả plain URL và versioned URL
  const version = Date.now();
  const versionedPath = `/game_icons/${slug}.webp?v=${version}`;
  const fullPublicUrl = `https://codegame.shop${versionedPath}`;

  try {
    const cache = typeof caches !== 'undefined' ? (caches as any).default : null;
    if (cache) {
      const origin = new URL(request.url).origin;
      const purgeUrls = [
        `https://codegame.shop/game_icons/${slug}.webp`,
        `https://codegame.shop/game_icons/${slug}.jpg`,
        `https://codegame.shop/game_icons/${slug}.png`,
        `${origin}/game_icons/${slug}.webp`,
        `${origin}/game_icons/${slug}.jpg`,
        `${origin}/game_icons/${slug}.png`,
      ];
      waitUntil(
        Promise.allSettled(purgeUrls.map((u) => cache.delete(new Request(u, { method: 'GET' }))))
      );
    }
  } catch {}

  // 14. Đồng bộ vào Upcoming Games nếu game tồn tại trong danh sách
  let updatedUpcomingGame: any = null;
  if (currentUpcomingGames.length > 0) {
    const targetItem = currentUpcomingGames.find((g: any) => g && (g.slug === slug || g.id === slug));
    if (targetItem) {
      targetItem.iconUrl = versionedPath;
      targetItem.icon_url = versionedPath;
      targetItem.icon_verified = isVerified;
      targetItem.icon_source = finalSource;
      targetItem.icon_verified_at = isVerified ? nowIso : null;
      targetItem.icon_version = version;
      targetItem.icon_updated_by = auth.callerName;
      targetItem.updatedAt = nowIso;
      updatedUpcomingGame = targetItem;

      // Lưu lại D1
      await setSettingD1(env.DB, 'wcg_admin_upcoming_games_v1', currentUpcomingGames).catch(() => {});
      await setSettingD1(env.DB, 'wcg_upcoming_games_v1', currentUpcomingGames).catch(() => {});
    }
  }

  // 15. Đồng bộ vào Catalog (bảng games) nếu game đã có trong catalog
  try {
    await env.DB.prepare(`
      UPDATE games SET
        icon_url = ?,
        updated_at = datetime('now')
      WHERE LOWER(TRIM(slug)) = ? OR LOWER(TRIM(id)) = ?
    `).bind(versionedPath, slug, slug).run();
  } catch {}

  // Đồng bộ vào wcg_admin_games_v5
  try {
    const activeGamesRaw = (await getSettingD1<any[]>(env.DB, 'wcg_admin_games_v5', [])) || [];
    const activeIdx = activeGamesRaw.findIndex(
      (g: any) => g && (String(g.slug || '').toLowerCase() === slug || String(g.id || '').toLowerCase() === slug)
    );
    if (activeIdx !== -1) {
      activeGamesRaw[activeIdx] = {
        ...activeGamesRaw[activeIdx],
        icon_url: versionedPath,
        iconUrl: versionedPath,
        icon_verified: isVerified,
        updated_at: nowIso,
      };
      await setSettingD1(env.DB, 'wcg_admin_games_v5', activeGamesRaw);
    }
  } catch {}

  return new Response(
    JSON.stringify({
      success: true,
      slug,
      iconUrl: versionedPath,
      publicUrl: fullPublicUrl,
      verified: isVerified,
      icon_verified: isVerified,
      icon_source: finalSource,
      icon_verified_at: isVerified ? nowIso : null,
      icon_version: version,
      bytes: imageBytes.length,
      width: inspect.width || 512,
      height: inspect.height || 512,
      contentType: inspect.contentType,
      readBackVerified: true,
      updated_by: auth.callerName,
      verification_warning: verificationErr,
      game: updatedUpcomingGame,
      message: isVerified
        ? `Tải và xác minh icon thành công cho game "${slug}". Nguồn: ${finalSource}.`
        : `Tải icon thành công nhưng chưa xác minh chính thức từ Store (${verificationErr || 'Chờ đối chiếu'}).`,
    }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
  );
};
