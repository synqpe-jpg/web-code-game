/**
 * Content Script - CodeGame.Shop Facebook Scanner Extension
 * Tự động phân tích DOM bài viết Fanpage Facebook & gắn nút quét 1-Click
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
  'CHIA', 'SE', 'BINH', 'LUAN', 'CONG', 'DONG', 'QUAN', 'TRI', 'FOLLOW'
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

function extractGiftcodesFromText(text = '', pageName = '') {
  if (!text) return [];
  const clean = text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  const codes = [];
  const seen = new Set();

  // 1. Keyword regex
  const keywordRegex = /(?:code|giftcode|mã quà tặng|nhập ngay|mã code|nhận ngay|quà tặng|mã quà|tặng bạn|nhập mã|code tuần|code mới)[:\s*]+([A-Za-z0-9_-]{4,24})\b/gi;
  let match;
  while ((match = keywordRegex.exec(clean)) !== null) {
    const raw = match[1].trim().toUpperCase();
    if (isValidCode(raw) && !seen.has(raw)) {
      seen.add(raw);
      codes.push({
        code: raw,
        rewards: `Quà tặng sự kiện Fanpage ${pageName}`.trim(),
        expiresAt: '2026-12-31',
        score: 95
      });
    }
  }

  // 2. Bullet point regex
  const bulletRegex = /(?:^|[\n\r])[•\-*+]\s*([A-Za-z0-9_-]{5,24})(?:\s*[:–-]\s*([^\n\r]+))?/gm;
  while ((match = bulletRegex.exec(clean)) !== null) {
    const raw = match[1].trim().toUpperCase();
    const rawReward = match[2]?.trim() || '';
    if (isValidCode(raw) && !seen.has(raw)) {
      seen.add(raw);
      codes.push({
        code: raw,
        rewards: rawReward || `Quà tặng sự kiện Fanpage ${pageName}`.trim(),
        expiresAt: '2026-12-31',
        score: 90
      });
    }
  }

  // 3. Standalone code regex
  const isCodeContext = /giftcode|mã quà|phát code|tặng code|nhập code|code sự kiện|tri ân|mừng update|nhập giftcode/i.test(clean);
  if (isCodeContext) {
    const standaloneRegex = /\b([A-Z0-9]{5,20})\b/g;
    while ((match = standaloneRegex.exec(clean)) !== null) {
      const raw = match[1].trim();
      const hasLetter = /[A-Z]/.test(raw);
      const hasNumber = /\d/.test(raw);
      const hasCodePrefix = /^(VIP|SVIP|GIFT|CODE|TANTHU)/i.test(raw);
      if (isValidCode(raw) && (hasLetter && (hasNumber || hasCodePrefix)) && !seen.has(raw)) {
        seen.add(raw);
        codes.push({
          code: raw,
          rewards: `Quà tặng sự kiện Fanpage ${pageName}`.trim(),
          expiresAt: '2026-12-31',
          score: 85
        });
      }
    }
  }

  return codes;
}

function getPageInfoAndText() {
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

  // Thu thập text của các bài viết trên trang
  const textBlocks = [];
  const selectors = [
    'div[role="feed"] div[dir="auto"]',
    'div[role="article"] div[dir="auto"]',
    'div[data-ad-preview="message"]',
    'div[role="main"] div[dir="auto"]'
  ];

  const elements = document.querySelectorAll(selectors.join(', '));
  elements.forEach((el) => {
    const t = el.innerText?.trim();
    if (t && t.length > 10 && !textBlocks.includes(t)) {
      textBlocks.push(t);
    }
  });

  const allText = textBlocks.join('\n\n');
  const codes = extractGiftcodesFromText(allText, pageName);

  return {
    pageName: pageName || 'Facebook Fanpage',
    pageUrl: window.location.href,
    codes,
    allTextLength: allText.length
  };
}

// Lắng nghe yêu cầu từ Popup Extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SCAN_PAGE') {
    const result = getPageInfoAndText();
    sendResponse(result);
    return true;
  }
});

// ========================================================
// GẮN NÚT NỔI 1-CLICK TRỰC TIẾP TRÊN GIAO DIỆN FACEBOOK
// ========================================================
function injectFloatingButton() {
  if (document.getElementById('wcg-floating-scan-btn')) return;

  const btn = document.createElement('div');
  btn.id = 'wcg-floating-scan-btn';
  btn.className = 'wcg-fab-button';
  btn.title = 'Bấm để quét mã giftcode trang này và bắn thẳng lên codegame.shop';
  btn.innerHTML = `
    <div class="wcg-fab-inner">
      <svg class="wcg-fab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      <span class="wcg-fab-text">⚡ Quét Code Cho CodeGame.shop</span>
    </div>
  `;

  btn.addEventListener('click', () => {
    handleFloatingScanClick();
  });

  document.body.appendChild(btn);
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
  }, 6000);
}

function handleFloatingScanClick() {
  const info = getPageInfoAndText();

  if (!info.codes || info.codes.length === 0) {
    showNotification(
      'Không tìm thấy mã mới',
      `Không phát hiện giftcode hợp lệ trong các bài viết đang hiển thị trên "${info.pageName}". Bạn hãy thử cuộn xuống để Facebook tải thêm bài đăng nhé!`,
      false
    );
    return;
  }

  // Hiển thị modal xác nhận đẩy
  showConfirmModal(info);
}

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
          <span>Phát Hiện ${info.codes.length} Giftcode!</span>
        </div>
        <button class="wcg-modal-close">&times;</button>
      </div>

      <div class="wcg-modal-body">
        <p class="wcg-modal-desc">
          Trang: <strong>${info.pageName}</strong>
        </p>

        <div class="wcg-code-list">
          ${info.codes.map(c => `
            <div class="wcg-code-item">
              <span class="wcg-code-badge">${c.code}</span>
              <span class="wcg-code-reward">${c.rewards}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="wcg-modal-footer">
        <button class="wcg-btn-cancel">Hủy</button>
        <button class="wcg-btn-push">🚀 Bắn Thẳng Lên Web codegame.shop</button>
      </div>
    </div>
  `;

  modal.querySelector('.wcg-modal-close').addEventListener('click', () => modal.remove());
  modal.querySelector('.wcg-btn-cancel').addEventListener('click', () => modal.remove());

  const pushBtn = modal.querySelector('.wcg-btn-push');
  pushBtn.addEventListener('click', () => {
    pushBtn.disabled = true;
    pushBtn.innerText = 'Đang đẩy lên máy chủ...';

    // Đoán game slug từ URL hoặc tên trang
    const pageUrlLower = info.pageUrl.toLowerCase();
    let gameSlug = '';
    if (pageUrlLower.includes('tiennghich')) gameSlug = 'tien-nghich-mobile';

    chrome.runtime.sendMessage({
      action: 'PUSH_CODES_TO_SERVER',
      payload: {
        codes: info.codes,
        gameSlug: gameSlug || 'tien-nghich-mobile',
        gameName: info.pageName
      }
    }, (res) => {
      modal.remove();
      if (res && res.success) {
        showNotification(
          'Đẩy mã thành công rực rỡ! 🚀',
          `Đã kích hoạt thành công ${res.approvedCount}/${info.codes.length} mã lên web codegame.shop! Khách hàng có thể sao chép và sử dụng ngay bây giờ.`,
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

// Tự động kiểm tra và chèn nút nổi sau khi trang load
setTimeout(injectFloatingButton, 2000);
setInterval(injectFloatingButton, 5000);
