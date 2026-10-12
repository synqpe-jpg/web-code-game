/**
 * Content Script - CodeGame.Shop Facebook Scanner Extension v1.2.0
 * Tính năng nâng cao:
 * 1. Tự động bung toàn bộ nút "Xem thêm" / "See more" trên bài viết Facebook
 * 2. Quét sâu toàn trang (Deep Auto-Scroll) cuộn mượt và đọc toàn bộ bài viết quá khứ
 * 3. Bóc tách toàn bộ đường LINK: Link bài viết (permalink), link website NPH, link sự kiện nhận code (giải mã l.facebook.com)
 * 4. Bóc tách mã code từ cả text bài viết và tham số query URL
 */

const STOP_WORDS = new Set([
  'FANPAGE', 'FACEBOOK', 'ONLINE', 'UPDATE', 'ANDROID', 'IPHONE',
  'GOOGLE', 'YOUTUBE', 'DISCORD', 'SERVER', 'GROUP', 'EVENT',
  'JOYGAMES', 'GARENA', 'VTCMOBILE', 'VNGGAMES', 'FUNTAP', 'SOHAGAME',
  'GIFTCODE', 'DOWNLOAD', 'HOTLINE', 'ADMIN', 'CHOINGAY', 'DANGNHAP',
  'CODEGAME', 'STORE', 'PAPATECH', 'WINDOW', 'CHPLAY', 'APPSTORE',
  'STATUS', 'SCRIPT', 'VERSION', 'THEO', 'TRONG', 'TRUNG', 'TAROT',
  'MEME', 'MMORPG', 'GAME', 'CODE', 'NHAN', 'TANG', 'DANG', 'CHON',
  'NGAY', 'THANG', 'NAM', 'HOAC', 'THOI', 'GIAN', 'TRANG', 'CHU',
  'THONG', 'TIN', 'DANH', 'SACH', 'HUONG', 'DAN', 'NHAP', 'DUNG',
  'CHIA', 'SE', 'BINH', 'LUAN', 'CONG', 'DONG', 'QUAN', 'TRI', 'FOLLOW',
  'TIENNGHICH', 'JOYPLAY', 'MOBILE', 'GAMOTA', 'ZING'
]);

function isValidCode(code = '') {
  if (!code || typeof code !== 'string') return false;
  const clean = code.trim().toUpperCase();
  if (clean.length < 4 || clean.length > 24) return false;
  // Bắt buộc phải có chữ cái
  if (!/[A-Z]/.test(clean)) return false;
  // Chỉ gồm A-Z, 0-9, dấu gạch nối hoặc gạch dưới
  if (!/^[A-Z0-9_-]+$/.test(clean)) return false;
  // Không nằm trong danh sách từ dừng
  if (STOP_WORDS.has(clean)) return false;
  return true;
}

// ========================================================
// 1. TỰ ĐỘNG BUNG NÚT "XEM THÊM" / "SEE MORE"
// ========================================================
function expandAllSeeMoreButtons() {
  let clickedCount = 0;
  const seeMoreRegex = /^(?:xem thêm|see more|xem chi tiết|đọc thêm)$/i;

  // Quét các nút role="button" hoặc span có text "Xem thêm"
  const candidates = document.querySelectorAll('div[role="button"], span[role="button"], span[dir="auto"]');
  candidates.forEach(el => {
    if (el.dataset && el.dataset.wcgExpanded) return;
    const txt = el.innerText?.trim();
    if (txt && seeMoreRegex.test(txt)) {
      try {
        el.click();
        el.dataset.wcgExpanded = 'true';
        clickedCount++;
      } catch (e) {
        // Bỏ qua lỗi click nếu có
      }
    }
  });

  return clickedCount;
}

// ========================================================
// 2. GIẢI MÃ & BÓC TÁCH TOÀN BỘ ĐƯỜNG LINK (LINKS EXTRACTOR)
// ========================================================
function decodeFacebookShimUrl(rawHref = '') {
  if (!rawHref || typeof rawHref !== 'string') return '';
  try {
    const url = new URL(rawHref, window.location.origin);

    // Xử lý link chuyển tiếp của Facebook (l.facebook.com/l.php?u=...)
    if (url.hostname.includes('facebook.com') && url.pathname.includes('/l.php')) {
      const targetParam = url.searchParams.get('u');
      if (targetParam) {
        return decodeURIComponent(targetParam);
      }
    }

    // Nếu là link facebook nội bộ (bài viết, ảnh, trang)
    if (url.hostname.includes('facebook.com') || url.hostname.includes('fb.watch') || url.hostname.includes('fb.me')) {
      // Loại bỏ các tham số tracking cồng kềnh (__cft__, __tn__, fbclid)
      ['__cft__', '__tn__', 'fbclid', 'ref', 'source'].forEach(p => url.searchParams.delete(p));
      return url.toString();
    }

    // Link bên ngoài trực tiếp
    return rawHref;
  } catch (e) {
    return rawHref;
  }
}

function classifyUrl(url = '', anchorText = '') {
  const lower = (url + ' ' + anchorText).toLowerCase();
  
  if (/facebook\.com\/(?:[^\/]+\/posts|story\.php|permalink|photo|video|pfbid)/i.test(url)) {
    return { type: 'POST_PERMALINK', label: '📌 Bài Viết Facebook', priority: 1 };
  }
  if (/(?:code|giftcode|nhan-qua|doi-code|nhap-code|su-kien|event|landing|minigame|claim)/i.test(lower)) {
    return { type: 'REWARD_LINK', label: '🎯 Link Nhận / Đổi Code', priority: 3 };
  }
  if (/(?:nap\.|pay\.|shop\.|store\.)/i.test(lower)) {
    return { type: 'PAY_LINK', label: '💳 Cổng Nạp NPH', priority: 2 };
  }
  if (/(?:game|play|vn|com|net|mobi|joyplay|garena|vng|gamota|vtc|funtap)/i.test(lower) && !lower.includes('facebook.com')) {
    return { type: 'OFFICIAL_WEB', label: '🌐 Website / Trang Chủ NPH', priority: 2 };
  }
  return { type: 'EXTERNAL_LINK', label: '🔗 Liên Kết Ngoài', priority: 1 };
}

function extractCodesFromUrl(url = '') {
  const foundCodes = [];
  try {
    const parsed = new URL(url);
    const codeParams = ['code', 'giftcode', 'gc', 'event_code', 'voucher', 'c'];
    for (const p of codeParams) {
      const val = parsed.searchParams.get(p);
      if (val && isValidCode(val)) {
        foundCodes.push(val.trim().toUpperCase());
      }
    }
  } catch (e) {}
  return foundCodes;
}

// ========================================================
// 3. TRÍCH XUẤT GIFTCODE TỪ NỘI DUNG VĂN BẢN
// ========================================================
function extractGiftcodesFromText(text = '', pageName = '', postUrl = '') {
  if (!text) return [];
  const clean = text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  const codes = [];
  const seen = new Set();

  const addCode = (code, reward, score) => {
    const raw = code.trim().toUpperCase();
    if (isValidCode(raw) && !seen.has(raw)) {
      seen.add(raw);
      codes.push({
        code: raw,
        rewards: reward || `Quà tặng sự kiện Fanpage ${pageName}`.trim(),
        expiresAt: '2026-12-31',
        sourceUrl: postUrl || window.location.href,
        score: score || 90
      });
    }
  };

  // 1. Keyword regex
  const keywordRegex = /(?:code|giftcode|mã quà tặng|nhập ngay|mã code|nhận ngay|quà tặng|mã quà|tặng bạn|nhập mã|code tuần|code mới)[:\s*]+([A-Za-z0-9_-]{4,24})\b/gi;
  let match;
  while ((match = keywordRegex.exec(clean)) !== null) {
    addCode(match[1], `Mã sự kiện Fanpage ${pageName}`, 95);
  }

  // 2. Bullet point regex
  const bulletRegex = /(?:^|[\n\r])[•\-*+]\s*([A-Za-z0-9_-]{5,24})(?:\s*[:–-]\s*([^\n\r]+))?/gm;
  while ((match = bulletRegex.exec(clean)) !== null) {
    addCode(match[1], match[2]?.trim() || `Quà tặng Fanpage ${pageName}`, 90);
  }

  // 3. Standalone code regex
  const isCodeContext = /giftcode|mã quà|phát code|tặng code|nhập code|code sự kiện|tri ân|mừng update|nhập giftcode/i.test(clean);
  if (isCodeContext) {
    const standaloneRegex = /\b([A-Z0-9]{5,20})\b/g;
    while ((match = standaloneRegex.exec(clean)) !== null) {
      const raw = match[1].trim();
      const hasLetter = /[A-Z]/.test(raw);
      const hasNumber = /\d/.test(raw);
      const hasCodePrefix = /^(VIP|SVIP|GIFT|CODE|TANTHU|SSVIP)/i.test(raw);
      if (hasLetter && (hasNumber || hasCodePrefix)) {
        addCode(raw, `Mã quà tặng sự kiện ${pageName}`, 85);
      }
    }
  }

  return codes;
}

// ========================================================
// 4. BÓC TÁCH TOÀN BỘ BÀI VIẾT, ĐƯỜNG LINK & CODE TRÊN TRANG
// ========================================================
function getPageInfoAndText(options = { expandSeeMore: true }) {
  if (options.expandSeeMore) {
    expandAllSeeMoreButtons();
  }

  // Lấy tên Fanpage
  let pageName = '';
  const h1El = document.querySelector('h1');
  if (h1El) pageName = h1El.innerText.trim();
  if (!pageName) {
    const metaTitle = document.querySelector('meta[property="og:title"]');
    if (metaTitle) pageName = metaTitle.content.trim();
  }
  if (!pageName) {
    pageName = document.title.replace(/\s*\|.*$/, '').replace(/\s*-.*Facebook.*$/i, '').trim();
  }

  // Tìm tất cả các khối bài viết Facebook
  const postContainers = document.querySelectorAll([
    'div[role="feed"] > div',
    'div[role="article"]',
    'div[data-ad-preview="message"]'
  ].join(', '));

  const allCodes = [];
  const seenCodes = new Set();
  const allLinks = [];
  const seenLinks = new Set();
  const postSnippets = [];

  // Lọc link không hợp lệ (link chính sách, đăng nhập Facebook...)
  const isIgnoredUrl = (u) => {
    return !u || /facebook\.com\/(?:policies|help|login|recover|privacy|legal|settings)/i.test(u);
  };

  const addUniqueLink = (url, title, postUrl) => {
    const cleanUrl = decodeFacebookShimUrl(url);
    if (!cleanUrl || isIgnoredUrl(cleanUrl) || seenLinks.has(cleanUrl)) return;
    seenLinks.add(cleanUrl);

    const classification = classifyUrl(cleanUrl, title);
    allLinks.push({
      url: cleanUrl,
      title: title || cleanUrl,
      type: classification.type,
      label: classification.label,
      priority: classification.priority,
      postUrl: postUrl || window.location.href
    });

    // Bóc tách giftcode từ URL nếu có
    const urlCodes = extractCodesFromUrl(cleanUrl);
    urlCodes.forEach(c => {
      if (!seenCodes.has(c)) {
        seenCodes.add(c);
        allCodes.push({
          code: c,
          rewards: `Mã nhận từ đường link: ${cleanUrl.substring(0, 40)}...`,
          expiresAt: '2026-12-31',
          sourceUrl: cleanUrl,
          score: 95
        });
      }
    });
  };

  postContainers.forEach((postEl) => {
    const text = postEl.innerText?.trim() || '';
    if (text.length < 15) return;

    // Tìm permalink bài viết (thẻ <a> chứa link post)
    let postUrl = '';
    const linkEls = postEl.querySelectorAll('a[href]');
    linkEls.forEach(a => {
      const rawHref = a.getAttribute('href') || a.href;
      if (/(?:\/posts\/|\/permalink\/|\/photos\/|\/videos\/|story\.php|pfbid)/i.test(rawHref)) {
        if (!postUrl) {
          postUrl = decodeFacebookShimUrl(a.href);
        }
      }
    });

    if (postUrl) {
      addUniqueLink(postUrl, `Bài viết Fanpage: ${text.substring(0, 50)}...`, postUrl);
    }

    // Thu thập các link ngoài có trong bài viết
    linkEls.forEach(a => {
      const rawHref = a.getAttribute('href') || a.href;
      const anchorText = a.innerText?.trim() || '';
      addUniqueLink(rawHref, anchorText || `Liên kết trong bài viết`, postUrl);
    });

    // Bóc tách giftcode trong nội dung bài viết
    const postCodes = extractGiftcodesFromText(text, pageName, postUrl);
    postCodes.forEach(c => {
      if (!seenCodes.has(c.code)) {
        seenCodes.add(c.code);
        allCodes.push(c);
      }
    });

    postSnippets.push({
      postUrl: postUrl || window.location.href,
      snippet: text.substring(0, 120),
      codesCount: postCodes.length
    });
  });

  // Nếu không gom được theo container, quét dự phòng toàn bộ text và links trên document
  if (allCodes.length === 0) {
    const fullText = document.body.innerText || '';
    const fallbackCodes = extractGiftcodesFromText(fullText, pageName, window.location.href);
    fallbackCodes.forEach(c => {
      if (!seenCodes.has(c.code)) {
        seenCodes.add(c.code);
        allCodes.push(c);
      }
    });
  }

  // Sắp xếp link theo mức độ ưu tiên (Link nhận code -> Website NPH -> Bài viết)
  allLinks.sort((a, b) => b.priority - a.priority);

  return {
    pageName: pageName || 'Facebook Fanpage',
    pageUrl: window.location.href,
    codes: allCodes,
    links: allLinks,
    postsCount: postSnippets.length || postContainers.length,
    allTextLength: document.body.innerText?.length || 0
  };
}

// ========================================================
// 5. QUÉT SÂU TOÀN TRANG (DEEP AUTO-SCROLL SCAN)
// ========================================================
async function runDeepScrollScan(rounds = 8, delayMs = 1200, onProgress) {
  showProgressToast(`🌀 Đang bắt đầu quét sâu ${rounds} lượt cuộn trang...`, 0);

  const accumulatedCodes = new Map();
  const accumulatedLinks = new Map();
  let latestPageName = '';

  for (let round = 1; round <= rounds; round++) {
    // 1. Tự động click bung tất cả nút Xem thêm
    expandAllSeeMoreButtons();

    // 2. Trích xuất dữ liệu của khung nhìn hiện tại
    const currentData = getPageInfoAndText({ expandSeeMore: false });
    latestPageName = currentData.pageName;

    currentData.codes.forEach(c => accumulatedCodes.set(c.code, c));
    currentData.links.forEach(l => accumulatedLinks.set(l.url, l));

    const percent = Math.round((round / rounds) * 100);
    const progressMsg = `🌀 Đang cuộn bài viết: Lượt ${round}/${rounds} (${accumulatedCodes.size} code, ${accumulatedLinks.size} link)...`;
    showProgressToast(progressMsg, percent);

    if (onProgress) {
      onProgress({
        round,
        rounds,
        percent,
        codesCount: accumulatedCodes.size,
        linksCount: accumulatedLinks.size,
        postsCount: currentData.postsCount
      });
    }

    // 3. Cuộn trang mượt mà xuống dưới để Facebook nạp thêm bài cũ
    window.scrollBy({ top: window.innerHeight * 1.6, behavior: 'smooth' });

    // 4. Chờ mạng và Facebook render DOM
    await new Promise(r => setTimeout(r, delayMs));
  }

  // Một lượt quét cuối sau khi hoàn tất cuộn
  expandAllSeeMoreButtons();
  const finalPass = getPageInfoAndText({ expandSeeMore: false });
  finalPass.codes.forEach(c => accumulatedCodes.set(c.code, c));
  finalPass.links.forEach(l => accumulatedLinks.set(l.url, l));

  hideProgressToast();

  const finalCodes = Array.from(accumulatedCodes.values());
  const finalLinks = Array.from(accumulatedLinks.values()).sort((a, b) => b.priority - a.priority);

  showNotification(
    `Quét sâu hoàn tất! 🌀`,
    `Đã quét sâu qua ${rounds} lượt cuộn: Phát hiện tổng cộng ${finalCodes.length} mã giftcode và ${finalLinks.length} đường link sự kiện!`,
    true
  );

  return {
    pageName: latestPageName || finalPass.pageName,
    pageUrl: window.location.href,
    codes: finalCodes,
    links: finalLinks,
    postsCount: finalPass.postsCount,
    roundsExecuted: rounds
  };
}

// ========================================================
// 6. GIAO DIỆN NỔI & TOAST TIẾN TRÌNH TRÊN TRANG
// ========================================================
function showProgressToast(text, percent = 0) {
  let toast = document.getElementById('wcg-progress-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'wcg-progress-toast';
    toast.className = 'wcg-progress-toast';
    document.body.appendChild(toast);
  }

  toast.innerHTML = `
    <div class="wcg-prog-header">
      <span class="wcg-prog-spinner"></span>
      <span class="wcg-prog-text">${text}</span>
    </div>
    <div class="wcg-prog-bar-wrap">
      <div class="wcg-prog-bar-fill" style="width: ${percent}%;"></div>
    </div>
  `;
  toast.style.display = 'block';
}

function hideProgressToast() {
  const toast = document.getElementById('wcg-progress-toast');
  if (toast) toast.style.display = 'none';
}

function showNotification(title, message, isSuccess = true) {
  const existing = document.getElementById('wcg-notify-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'wcg-notify-toast';
  toast.className = `wcg-toast ${isSuccess ? 'wcg-toast-success' : 'wcg-toast-error'}`;
  toast.innerHTML = `
    <div class="wcg-toast-header">
      <strong>${title}</strong>
      <button class="wcg-toast-close">&times;</button>
    </div>
    <div class="wcg-toast-body">${message}</div>
  `;

  toast.querySelector('.wcg-toast-close').addEventListener('click', () => toast.remove());
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 7000);
}

// Nút nổi FAB trên Facebook
function injectFloatingButton() {
  if (document.getElementById('wcg-floating-scan-btn')) return;

  const btn = document.createElement('div');
  btn.id = 'wcg-floating-scan-btn';
  btn.className = 'wcg-fab-button';
  btn.title = 'Bấm để quét mã giftcode và link sự kiện trên trang này';
  btn.innerHTML = `
    <div class="wcg-fab-inner">
      <svg class="wcg-fab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      <span class="wcg-fab-text">⚡ Quét Code & Link</span>
      <button id="wcg-quick-deep-btn" class="wcg-fab-deep-sub" title="Quét sâu tự động cuộn trang">🌀 Quét Sâu</button>
    </div>
  `;

  btn.querySelector('.wcg-fab-text').addEventListener('click', (e) => {
    e.stopPropagation();
    handleFloatingScanClick(false);
  });

  const deepBtn = btn.querySelector('#wcg-quick-deep-btn');
  deepBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleFloatingScanClick(true);
  });

  document.body.appendChild(btn);
}

async function handleFloatingScanClick(isDeep = false) {
  let info;
  if (isDeep) {
    info = await runDeepScrollScan(8, 1200);
  } else {
    expandAllSeeMoreButtons();
    info = getPageInfoAndText();
  }

  if ((!info.codes || info.codes.length === 0) && (!info.links || info.links.length === 0)) {
    showNotification(
      'Chưa tìm thấy mã mới',
      `Không phát hiện giftcode hoặc link sự kiện trong các bài viết đang hiển thị trên "${info.pageName}". Hãy bấm nút "🌀 Quét Sâu" để tự động cuộn trang lấy thêm bài cũ nhé!`,
      false
    );
    return;
  }

  showConfirmModal(info);
}

// ========================================================
// 7. MODAL XÁC NHẬN ĐẨY MÃ & DUYỆT ĐƯỜNG LINK (TABBED MODAL)
// ========================================================
function showConfirmModal(info) {
  const existing = document.getElementById('wcg-modal-confirm');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'wcg-modal-confirm';
  modal.className = 'wcg-modal-overlay';
  modal.innerHTML = `
    <div class="wcg-modal-box">
      <div class="wcg-modal-header">
        <div class="wcg-modal-title">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#6366f1" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span>Thu Thập Được ${info.codes.length} Code & ${info.links.length} Link!</span>
        </div>
        <button class="wcg-modal-close">&times;</button>
      </div>

      <div class="wcg-modal-tabs">
        <button class="wcg-modal-tab active" data-tab="codes">🎁 Danh Sách Mã (${info.codes.length})</button>
        <button class="wcg-modal-tab" data-tab="links">🔗 Đường Link & Sự Kiện (${info.links.length})</button>
      </div>

      <div class="wcg-modal-body">
        <p class="wcg-modal-desc">
          Fanpage: <strong>${info.pageName}</strong> • Đã quét: <strong>${info.postsCount || 'toàn bộ'} bài viết</strong>
        </p>

        <!-- Tab 1: Codes -->
        <div id="tab-content-codes" class="wcg-tab-pane active">
          ${info.codes.length === 0 ? `
            <div style="text-align: center; color: #64748b; padding: 20px;">Không tìm thấy mã code trực tiếp. Hãy kiểm tra các link sự kiện ở Tab bên cạnh nhé!</div>
          ` : `
            <div class="wcg-code-list">
              ${info.codes.map(c => `
                <div class="wcg-code-item">
                  <div style="display: flex; flex-direction: column; gap: 2px;">
                    <span class="wcg-code-badge">${c.code}</span>
                    <span class="wcg-code-reward">${c.rewards}</span>
                  </div>
                  ${c.sourceUrl ? `
                    <a href="${c.sourceUrl}" target="_blank" class="wcg-link-open-btn" title="Mở bài viết gốc">🔗 Xem bài</a>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Tab 2: Links -->
        <div id="tab-content-links" class="wcg-tab-pane">
          ${info.links.length === 0 ? `
            <div style="text-align: center; color: #64748b; padding: 20px;">Không có liên kết ngoài nào trong các bài viết.</div>
          ` : `
            <div class="wcg-link-list">
              ${info.links.map(l => `
                <div class="wcg-link-item">
                  <div class="wcg-link-info">
                    <span class="wcg-link-badge ${l.type}">${l.label}</span>
                    <span class="wcg-link-url" title="${l.url}">${l.url}</span>
                  </div>
                  <div class="wcg-link-actions">
                    <button class="wcg-btn-copy-url" data-url="${encodeURIComponent(l.url)}">Sao chép</button>
                    <a href="${l.url}" target="_blank" rel="noopener noreferrer" class="wcg-link-open-btn">Mở</a>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>

      <div class="wcg-modal-footer">
        <button class="wcg-btn-cancel">Đóng</button>
        <button class="wcg-btn-push" ${info.codes.length === 0 ? 'disabled' : ''}>
          🚀 Bắn ${info.codes.length} Mã Lên Web codegame.shop
        </button>
      </div>
    </div>
  `;

  // Tab switching
  modal.querySelectorAll('.wcg-modal-tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      modal.querySelectorAll('.wcg-modal-tab').forEach(b => b.classList.remove('active'));
      modal.querySelectorAll('.wcg-tab-pane').forEach(p => p.classList.remove('active'));
      tabBtn.classList.add('active');
      const target = tabBtn.dataset.tab;
      modal.querySelector(`#tab-content-${target}`).classList.add('active');
    });
  });

  // Copy link action
  modal.querySelectorAll('.wcg-btn-copy-url').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const url = decodeURIComponent(e.target.dataset.url);
      navigator.clipboard.writeText(url).then(() => {
        e.target.innerText = 'Đã chép!';
        setTimeout(() => { e.target.innerText = 'Sao chép'; }, 2000);
      });
    });
  });

  modal.querySelector('.wcg-modal-close').addEventListener('click', () => modal.remove());
  modal.querySelector('.wcg-btn-cancel').addEventListener('click', () => modal.remove());

  const pushBtn = modal.querySelector('.wcg-btn-push');
  pushBtn.addEventListener('click', () => {
    pushBtn.disabled = true;
    pushBtn.innerText = 'Đang đẩy lên máy chủ...';

    // Nhận diện tựa game slug
    const pageUrlLower = info.pageUrl.toLowerCase();
    let gameSlug = '';
    if (pageUrlLower.includes('tiennghich')) gameSlug = 'tien-nghich-mobile';

    chrome.runtime.sendMessage({
      action: 'PUSH_CODES_TO_SERVER',
      payload: {
        codes: info.codes,
        gameSlug: gameSlug || 'tien-nghich-mobile',
        gameName: info.pageName,
        sourceLinks: info.links
      }
    }, (res) => {
      modal.remove();
      if (res && res.success) {
        showNotification(
          'Đẩy mã thành công rực rỡ! 🚀',
          `Đã kích hoạt thành công ${res.approvedCount}/${info.codes.length} mã lên web codegame.shop kèm link bài viết gốc! Khách hàng có thể sao chép và xem ngay bây giờ.`,
          true
        );
      } else {
        showNotification(
          'Lỗi đẩy mã',
          res?.errors?.join(', ') || 'Không thể kết nối đến máy chủ sync.',
          false
        );
      }
    });
  });

  document.body.appendChild(modal);
}

// ========================================================
// 8. LẮNG NGHE YÊU CẦU TỪ POPUP EXTENSION
// ========================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SCAN_PAGE') {
    expandAllSeeMoreButtons();
    const result = getPageInfoAndText();
    sendResponse(result);
    return true;
  }

  if (request.action === 'DEEP_SCAN_PAGE') {
    const rounds = request.rounds || 8;
    runDeepScrollScan(rounds, 1200, (prog) => {
      // Có thể gửi tiến trình ngược lại nếu cần
    }).then(result => {
      sendResponse(result);
    }).catch(err => {
      sendResponse({ error: err.message, codes: [], links: [] });
    });
    return true; // async response
  }
});

// Tự động gắn nút nổi FAB sau khi trang tải
setTimeout(injectFloatingButton, 2000);
setInterval(injectFloatingButton, 5000);
