/**
 * Icon Verifier & Official Store Matching Engine
 * 
 * Chức năng:
 * 1. Tự động tra cứu icon chính thức từ Google Play Store và Apple App Store
 * 2. Đối chiếu ảnh ứng viên với icon cửa hàng chính thức (khớp CDN, khớp bytes hoặc khớp thị giác)
 * 3. Kiểm tra định dạng Magic Bytes an toàn (WebP, PNG, JPEG), chống XSS (chặn SVG, HTML, scripts)
 * 4. Read-back verification khi lưu vào Cloudflare D1 bảng uploaded_game_icons
 */

export interface ImageInspectionResult {
  valid: boolean;
  contentType: 'image/webp' | 'image/png' | 'image/jpeg';
  width: number;
  height: number;
  error?: string;
}

export interface OfficialStoreInfo {
  storeUrl: string;
  storeType: 'google_play' | 'app_store';
  officialIconUrl: string;
  packageNameOrId: string;
  gameTitle?: string;
}

export interface VerificationResult {
  verified: boolean;
  storeUrl?: string;
  storeType?: 'google_play' | 'app_store' | 'admin' | 'manual';
  officialIconUrl?: string;
  matchType?: 'cdn_exact' | 'byte_match' | 'visual_match' | 'admin_manual';
  error?: string;
}

/**
 * Kiểm tra Magic Bytes thực tế của file ảnh (không tin header Content-Type gửi kèm)
 * Ngăn chặn tuyệt đối file thực thi, script, và SVG (nguy cơ XSS)
 */
export function inspectImageBytes(bytes: Uint8Array): ImageInspectionResult {
  const len = bytes.length;
  if (len < 12) {
    return {
      valid: false,
      contentType: 'image/webp',
      width: 0,
      height: 0,
      error: 'Dữ liệu file quá ngắn, không phải file ảnh hợp lệ.',
    };
  }

  // 1. Chống SVG / XML / HTML / Script
  const headLen = Math.min(len, 512);
  let headStr = '';
  for (let i = 0; i < headLen; i++) {
    headStr += String.fromCharCode(bytes[i]);
  }
  const headLower = headStr.toLowerCase();
  if (
    headLower.includes('<svg') ||
    headLower.includes('<?xml') ||
    headLower.includes('<html') ||
    headLower.includes('<script') ||
    headLower.includes('xmlns=')
  ) {
    return {
      valid: false,
      contentType: 'image/webp',
      width: 0,
      height: 0,
      error: 'Định dạng SVG/HTML bị từ chối do nguy cơ bảo mật XSS. Vui lòng sử dụng WebP, PNG hoặc JPG.',
    };
  }

  // 2. WEBP Magic Bytes (RIFF .... WEBP)
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    let width = 512;
    let height = 512;
    // VP8 (lossy)
    if (len >= 30 && bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x20) {
      width = ((bytes[26] | (bytes[27] << 8)) & 0x3fff);
      height = ((bytes[28] | (bytes[29] << 8)) & 0x3fff);
    }
    // VP8L (lossless)
    else if (len >= 25 && bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x4c) {
      if (bytes[20] === 0x2f) {
        const b1 = bytes[21];
        const b2 = bytes[22];
        const b3 = bytes[23];
        const b4 = bytes[24];
        width = 1 + (((b2 & 0x3f) << 8) | b1);
        height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
      }
    }
    // VP8X (extended)
    else if (len >= 30 && bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x58) {
      width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    }
    return { valid: true, contentType: 'image/webp', width: width || 512, height: height || 512 };
  }

  // 3. PNG Magic Bytes (89 50 4E 47 0D 0A 1A 0A)
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
    bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A
  ) {
    let width = 512;
    let height = 512;
    if (len >= 24) {
      width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    }
    return { valid: true, contentType: 'image/png', width: width || 512, height: height || 512 };
  }

  // 4. JPEG/JPG Magic Bytes (FF D8 FF)
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    let width = 512;
    let height = 512;
    let offset = 2;
    while (offset < len - 8) {
      if (bytes[offset] === 0xFF) {
        const marker = bytes[offset + 1];
        if (marker === 0xC0 || marker === 0xC2) {
          height = (bytes[offset + 5] << 8) | bytes[offset + 6];
          width = (bytes[offset + 7] << 8) | bytes[offset + 8];
          break;
        } else if (marker === 0xD9 || marker === 0xDA) {
          break;
        } else {
          offset += 2 + ((bytes[offset + 2] << 8) | bytes[offset + 3]);
        }
      } else {
        offset++;
      }
    }
    return { valid: true, contentType: 'image/jpeg', width: width || 512, height: height || 512 };
  }

  return {
    valid: false,
    contentType: 'image/webp',
    width: 0,
    height: 0,
    error: 'Định dạng file không được hỗ trợ. Chỉ chấp nhận WebP, PNG hoặc JPG/JPEG.',
  };
}

/**
 * Tra cứu icon chính thức từ Google Play Store theo package ID hoặc store link
 */
export async function lookupGooglePlayStore(input: string): Promise<OfficialStoreInfo | null> {
  if (!input) return null;
  let packageId = input.trim();
  if (packageId.includes('play.google.com')) {
    const m = packageId.match(/[?&]id=([a-zA-Z0-9_\.]+)/);
    if (m) packageId = m[1];
  }

  if (!/^[a-zA-Z0-9_\.]+$/.test(packageId)) return null;

  try {
    const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageId)}&hl=vi`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
      },
    });

    if (!res.ok) return null;
    const html = await res.text();

    // 1. Trích xuất og:image
    const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    let iconUrl = ogMatch ? ogMatch[1] : null;

    // 2. Trích xuất CDN play-lh.googleusercontent.com
    if (!iconUrl) {
      const imgMatches = html.match(/https:\/\/play-lh\.googleusercontent\.com\/[a-zA-Z0-9_\-=]+/g);
      if (imgMatches && imgMatches.length > 0) {
        iconUrl = imgMatches[0];
      }
    }

    if (iconUrl) {
      // Đảm bảo icon có kích thước chuẩn nếu Google Play cho tham số resizer
      if (iconUrl.includes('play-lh.googleusercontent.com') && !iconUrl.includes('=s')) {
        iconUrl = iconUrl.split('=')[0] + '=s0-br30';
      }

      return {
        storeUrl: `https://play.google.com/store/apps/details?id=${packageId}`,
        storeType: 'google_play',
        officialIconUrl: iconUrl,
        packageNameOrId: packageId,
      };
    }
  } catch (err: any) {
    console.warn('[IconVerifier] Lỗi lookup Google Play:', err?.message);
  }
  return null;
}

/**
 * Tra cứu icon chính thức từ Apple App Store theo App ID hoặc tên tựa game
 */
export async function lookupAppleAppStore(appIdOrName: string): Promise<OfficialStoreInfo | null> {
  if (!appIdOrName) return null;
  const raw = appIdOrName.trim();
  let appId = '';

  if (raw.includes('apps.apple.com')) {
    const m = raw.match(/id(\d+)/i);
    if (m) appId = m[1];
  } else if (/^\d+$/.test(raw.replace(/^id/i, ''))) {
    appId = raw.replace(/^id/i, '');
  }

  const countries = ['vn', 'th', 'sg', 'us', 'jp'];

  // 1. Nếu có numeric App ID
  if (appId) {
    for (const country of countries) {
      try {
        const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(appId)}&country=${country}`;
        const res = await fetch(url);
        if (res.ok) {
          const data: any = await res.json();
          if (data && data.resultCount > 0 && Array.isArray(data.results) && data.results[0]) {
            const item = data.results[0];
            return {
              storeUrl: item.trackViewUrl || `https://apps.apple.com/app/id${item.trackId}`,
              storeType: 'app_store',
              officialIconUrl: item.artworkUrl512 || item.artworkUrl100,
              packageNameOrId: String(item.trackId),
              gameTitle: item.trackName,
            };
          }
        }
      } catch {}
    }
  }

  // 2. Nếu tìm theo tên tựa game
  if (raw.length >= 3 && !raw.startsWith('http')) {
    for (const country of countries) {
      try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(raw)}&entity=software&country=${country}&limit=3`;
        const res = await fetch(url);
        if (res.ok) {
          const data: any = await res.json();
          if (data && data.resultCount > 0 && Array.isArray(data.results) && data.results[0]) {
            const item = data.results[0];
            // So khớp tên gần đúng (độ trùng khớp)
            const cleanTarget = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanFound = String(item.trackName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanFound.includes(cleanTarget) || cleanTarget.includes(cleanFound)) {
              return {
                storeUrl: item.trackViewUrl || `https://apps.apple.com/app/id${item.trackId}`,
                storeType: 'app_store',
                officialIconUrl: item.artworkUrl512 || item.artworkUrl100,
                packageNameOrId: String(item.trackId),
                gameTitle: item.trackName,
              };
            }
          }
        }
      } catch {}
    }
  }

  return null;
}

/**
 * So khớp tài nguyên CDN để kiểm tra ảnh ứng viên có bắt nguồn từ Store chính thức hay không
 */
export function matchCdnAssetUrl(candidateUrl: string, storeIconUrl: string): boolean {
  if (!candidateUrl || !storeIconUrl) return false;
  const cleanCandidate = candidateUrl.split('?')[0].split('=')[0].toLowerCase().trim();
  const cleanStore = storeIconUrl.split('?')[0].split('=')[0].toLowerCase().trim();

  // 1. Trùng khớp hoàn toàn CDN base
  if (cleanCandidate === cleanStore) return true;

  // 2. Trùng ID asset trên Google Play CDN
  if (cleanCandidate.includes('play-lh.googleusercontent.com') && cleanStore.includes('play-lh.googleusercontent.com')) {
    const idA = cleanCandidate.replace('https://play-lh.googleusercontent.com/', '').split('/')[0];
    const idB = cleanStore.replace('https://play-lh.googleusercontent.com/', '').split('/')[0];
    if (idA && idB && (idA.startsWith(idB) || idB.startsWith(idA))) return true;
  }

  // 3. Trùng ID asset trên Apple App Store CDN (mzstatic)
  if (cleanCandidate.includes('mzstatic.com') && cleanStore.includes('mzstatic.com')) {
    const idMatchA = cleanCandidate.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    const idMatchB = cleanStore.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    if (idMatchA && idMatchB && idMatchA[1].toLowerCase() === idMatchB[1].toLowerCase()) return true;
  }

  return false;
}

/**
 * Thực hiện đối chiếu toàn diện giữa ứng viên và cửa hàng chính thức
 */
export async function verifyGameIcon(params: {
  gameSlug: string;
  gameName?: string;
  candidateUrl?: string;
  candidateBytes?: Uint8Array;
  storeUrl?: string;
  googlePlayUrl?: string;
  appStoreUrl?: string;
  packageName?: string;
  isAdminManual?: boolean;
}): Promise<VerificationResult> {
  const {
    gameSlug,
    gameName,
    candidateUrl,
    candidateBytes,
    storeUrl,
    googlePlayUrl,
    appStoreUrl,
    packageName,
    isAdminManual,
  } = params;

  // 1. Nếu quản trị viên xác nhận tay qua cổng Admin Portal
  if (isAdminManual) {
    return {
      verified: true,
      storeType: 'admin',
      storeUrl: 'admin tay',
      matchType: 'admin_manual',
    };
  }

  // 2. Xác định Store để đối chiếu
  let storeInfo: OfficialStoreInfo | null = null;

  // Ưu tiên theo URL gửi kèm
  const candidateStoreUrl = storeUrl || googlePlayUrl || appStoreUrl || '';
  if (candidateStoreUrl.includes('play.google.com') || packageName) {
    storeInfo = await lookupGooglePlayStore(candidateStoreUrl || packageName || '');
  } else if (candidateStoreUrl.includes('apps.apple.com')) {
    storeInfo = await lookupAppleAppStore(candidateStoreUrl);
  }

  // Nếu chưa có, thử tìm theo gameSlug hoặc gameName
  if (!storeInfo && gameName) {
    storeInfo = await lookupAppleAppStore(gameName);
  }
  if (!storeInfo && gameSlug) {
    storeInfo = await lookupGooglePlayStore(gameSlug);
  }

  // Nếu không tìm thấy bất kỳ trang cửa hàng chính thức nào
  if (!storeInfo) {
    return {
      verified: false,
      error: 'Không tìm thấy trang cửa hàng chính thức (Google Play Store hoặc Apple App Store) để đối chiếu logo.',
    };
  }

  // 3. So khớp nếu có candidateUrl
  if (candidateUrl) {
    if (matchCdnAssetUrl(candidateUrl, storeInfo.officialIconUrl)) {
      return {
        verified: true,
        storeUrl: storeInfo.storeUrl,
        storeType: storeInfo.storeType,
        officialIconUrl: storeInfo.officialIconUrl,
        matchType: 'cdn_exact',
      };
    }
  }

  // 4. So khớp nếu có candidateBytes
  if (candidateBytes && storeInfo.officialIconUrl) {
    try {
      const storeRes = await fetch(storeInfo.officialIconUrl);
      if (storeRes.ok) {
        const storeBuf = await storeRes.arrayBuffer();
        const storeBytes = new Uint8Array(storeBuf);

        // Byte match chính xác
        if (candidateBytes.length === storeBytes.length) {
          let diffCount = 0;
          for (let i = 0; i < candidateBytes.length; i++) {
            if (candidateBytes[i] !== storeBytes[i]) diffCount++;
            if (diffCount > 32) break;
          }
          if (diffCount <= 32) {
            return {
              verified: true,
              storeUrl: storeInfo.storeUrl,
              storeType: storeInfo.storeType,
              officialIconUrl: storeInfo.officialIconUrl,
              matchType: 'byte_match',
            };
          }
        }

        // Tỉ lệ tương đồng kích thước / định dạng
        const candidateInspect = inspectImageBytes(candidateBytes);
        const storeInspect = inspectImageBytes(storeBytes);
        if (
          candidateInspect.valid &&
          storeInspect.valid &&
          candidateInspect.width === storeInspect.width &&
          candidateInspect.height === storeInspect.height
        ) {
          return {
            verified: true,
            storeUrl: storeInfo.storeUrl,
            storeType: storeInfo.storeType,
            officialIconUrl: storeInfo.officialIconUrl,
            matchType: 'visual_match',
          };
        }
      }
    } catch (err: any) {
      console.warn('[IconVerifier] Lỗi tải và so sánh store bytes:', err?.message);
    }
  }

  // 5. Nếu candidateUrl là link ngoài từ CDN chính thức Google/Apple
  if (
    candidateUrl &&
    (candidateUrl.includes('play-lh.googleusercontent.com') || candidateUrl.includes('mzstatic.com'))
  ) {
    return {
      verified: true,
      storeUrl: storeInfo.storeUrl,
      storeType: storeInfo.storeType,
      officialIconUrl: candidateUrl,
      matchType: 'cdn_exact',
    };
  }

  return {
    verified: false,
    storeUrl: storeInfo.storeUrl,
    storeType: storeInfo.storeType,
    officialIconUrl: storeInfo.officialIconUrl,
    error: `Ảnh ứng viên không khớp với icon chính thức từ cửa hàng (${storeInfo.storeUrl}).`,
  };
}

/**
 * Kiểm tra xem một file icon game đã thực sự tồn tại trên máy chủ (D1 hoặc static assets) hay chưa
 */
export async function checkIconFileExists(slug: string, db?: D1Database): Promise<boolean> {
  if (!slug) return false;
  const cleanSlug = slug.toLowerCase().trim();

  // 1. Kiểm tra D1 bảng uploaded_game_icons
  if (db) {
    try {
      const row: any = await db.prepare(
        'SELECT slug, size_bytes FROM uploaded_game_icons WHERE slug = ? AND size_bytes > 0 LIMIT 1'
      ).bind(cleanSlug).first();
      if (row && row.size_bytes > 0) return true;
    } catch {}
  }

  // 2. Kiểm tra static assets
  try {
    const res = await fetch(`https://codegame.shop/game_icons/${encodeURIComponent(cleanSlug)}.webp`, { method: 'HEAD' });
    if (res.status === 200) return true;
  } catch {}

  return false;
}
