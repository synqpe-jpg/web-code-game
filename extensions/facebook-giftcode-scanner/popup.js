/**
 * Popup Script - CodeGame.Shop Facebook Scanner Extension
 */

let allGames = [];
let currentTabId = null;
let currentCodes = [];
let currentPageInfo = { pageName: '', pageUrl: '' };

const DEFAULT_SETTINGS = {
  apiUrl: 'https://web-code-game.pages.dev/api/sync',
  syncKey: 'b4e08494bf1c3fd6a0c965dd2411780c60513f7f87001bc955d7496331b2faef'
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadGamesCatalog();
  await loadSettings();
  initTabInfo();
  bindEvents();
});

async function loadGamesCatalog() {
  try {
    const res = await fetch(chrome.runtime.getURL('games.json'));
    allGames = await res.json();
    populateGameSelect(allGames);
  } catch (e) {
    console.error('Không thể nạp games.json', e);
  }
}

function populateGameSelect(gamesList, selectedSlug = '') {
  const select = document.getElementById('game-select');
  select.innerHTML = '<option value="">-- Chọn tựa game --</option>';

  gamesList.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.slug || g.id;
    opt.textContent = g.name;
    if (selectedSlug && (g.slug === selectedSlug || g.id === selectedSlug)) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

function normalizeStr(str = '') {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim();
}

function autoMatchGame(pageName = '', pageUrl = '') {
  if (!allGames.length) return '';
  const cleanName = normalizeStr(pageName);
  const cleanUrl = normalizeStr(pageUrl);

  // 1. Khớp theo URL (ví dụ tiennghich -> tien-nghich-mobile)
  for (const g of allGames) {
    const gSlugNorm = normalizeStr(g.slug);
    if (cleanUrl.includes(gSlugNorm) || cleanUrl.includes(gSlugNorm.replace(/\s+/g, ''))) {
      return g.slug;
    }
  }

  // 2. Khớp theo tên game chính xác
  for (const g of allGames) {
    const gNameNorm = normalizeStr(g.name);
    if (cleanName.includes(gNameNorm) || gNameNorm.includes(cleanName)) {
      return g.slug;
    }
  }

  // 3. Khớp một phần từ khóa
  for (const g of allGames) {
    const words = normalizeStr(g.name).split(/\s+/).filter(w => w.length > 2);
    if (words.length >= 2 && words.every(w => cleanName.includes(w))) {
      return g.slug;
    }
  }

  return '';
}

function initTabInfo() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) return;
    const tab = tabs[0];
    currentTabId = tab.id;

    if (!tab.url || !tab.url.includes('facebook.com')) {
      document.getElementById('page-name').innerText = 'Không phải trang Facebook';
      document.getElementById('page-url').innerText = 'Vui lòng mở một Fanpage Facebook để quét.';
      document.getElementById('btn-scan').disabled = true;
      document.getElementById('btn-scan').style.opacity = '0.5';
      return;
    }

    document.getElementById('page-url').innerText = tab.url;

    // Gửi yêu cầu trích xuất dữ liệu ban đầu
    triggerScan();
  });
}

function triggerScan() {
  if (!currentTabId) return;

  const btnScan = document.getElementById('btn-scan');
  btnScan.disabled = true;
  btnScan.innerHTML = '<span>⏳ Đang quét bài viết...</span>';

  chrome.tabs.sendMessage(currentTabId, { action: 'SCAN_PAGE' }, (response) => {
    btnScan.disabled = false;
    btnScan.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      <span>⚡ Quét Lại Bài Viết Trên Trang</span>
    `;

    if (chrome.runtime.lastError || !response) {
      document.getElementById('page-name').innerText = 'Chưa thể kết nối tới trang';
      document.getElementById('page-url').innerText = 'Hãy tải lại trang Facebook (F5) rồi bấm Quét nhé.';
      return;
    }

    currentPageInfo = { pageName: response.pageName, pageUrl: response.pageUrl };
    document.getElementById('page-name').innerText = response.pageName;
    document.getElementById('page-name').title = response.pageName;

    // Tự động nhận diện tựa game
    const matchedSlug = autoMatchGame(response.pageName, response.pageUrl);
    if (matchedSlug) {
      document.getElementById('game-select').value = matchedSlug;
    }

    // Hiển thị danh sách mã
    currentCodes = response.codes || [];
    renderResults(currentCodes);
  });
}

function renderResults(codes = []) {
  const section = document.getElementById('results-section');
  const countEl = document.getElementById('results-count');
  const listEl = document.getElementById('code-list');
  const alertEl = document.getElementById('status-alert');
  alertEl.style.display = 'none';

  if (!codes || codes.length === 0) {
    section.style.display = 'block';
    countEl.innerText = 'Chưa tìm thấy mã mới (0)';
    countEl.style.color = '#94a3b8';
    listEl.innerHTML = `
      <div style="text-align: center; padding: 16px; color: #64748b; font-size: 12px;">
        Không tìm thấy giftcode nào trong các bài viết đang hiển thị. Hãy thử cuộn trang Facebook xuống để tải thêm bài viết nhé!
      </div>
    `;
    document.getElementById('btn-push').style.display = 'none';
    return;
  }

  section.style.display = 'block';
  countEl.innerText = `Tìm thấy ${codes.length} mã giftcode!`;
  countEl.style.color = '#34d399';
  document.getElementById('btn-push').style.display = 'flex';
  document.getElementById('btn-push').disabled = false;
  document.getElementById('btn-push').innerHTML = '<span>🚀 BẮN THẲNG LÊN WEB CODEGAME.SHOP</span>';

  listEl.innerHTML = codes.map((c, index) => `
    <div class="code-row">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="code-badge">${c.code}</span>
        <span class="code-reward" title="${c.rewards}">${c.rewards}</span>
      </div>
      <button class="btn-remove-code" data-index="${index}" style="background: none; border: none; color: #64748b; cursor: pointer; padding: 2px 4px;">&times;</button>
    </div>
  `).join('');

  // Gắn sự kiện xóa mã đơn lẻ
  document.querySelectorAll('.btn-remove-code').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      currentCodes.splice(idx, 1);
      renderResults(currentCodes);
    });
  });
}

function pushCodesToServer() {
  const gameSelect = document.getElementById('game-select');
  const selectedSlug = gameSelect.value;
  const selectedName = gameSelect.options[gameSelect.selectedIndex]?.text || selectedSlug;

  if (!selectedSlug) {
    showAlert('Vui lòng chọn tựa game áp dụng trước khi đẩy lên web!', false);
    return;
  }

  if (!currentCodes || currentCodes.length === 0) {
    showAlert('Không có mã nào để đẩy lên.', false);
    return;
  }

  const btnPush = document.getElementById('btn-push');
  btnPush.disabled = true;
  btnPush.innerHTML = '<span>⏳ Đang đẩy lên máy chủ codegame.shop...</span>';

  chrome.runtime.sendMessage({
    action: 'PUSH_CODES_TO_SERVER',
    payload: {
      codes: currentCodes,
      gameSlug: selectedSlug,
      gameName: selectedName
    }
  }, (res) => {
    btnPush.disabled = false;
    btnPush.innerHTML = '<span>🚀 BẮN THẲNG LÊN WEB CODEGAME.SHOP</span>';

    if (res && res.success) {
      showAlert(
        `🎉 Tuyệt vời! Đã kích hoạt thành công ${res.approvedCount}/${currentCodes.length} mã cho game "${selectedName}" lên web codegame.shop!`,
        true
      );
    } else {
      showAlert(`Lỗi: ${res?.errors?.join(', ') || 'Không thể kết nối đến máy chủ API.'}`, false);
    }
  });
}

function showAlert(msg, isSuccess = true) {
  const alertEl = document.getElementById('status-alert');
  alertEl.style.display = 'block';
  alertEl.className = `status-alert ${isSuccess ? 'status-success' : 'status-error'}`;
  alertEl.innerHTML = msg;
}

function bindEvents() {
  document.getElementById('btn-scan').addEventListener('click', triggerScan);
  document.getElementById('btn-push').addEventListener('click', pushCodesToServer);

  document.getElementById('btn-clear').addEventListener('click', () => {
    currentCodes = [];
    renderResults([]);
  });

  // Tìm kiếm nhanh danh mục game
  document.getElementById('game-search').addEventListener('input', (e) => {
    const q = normalizeStr(e.target.value);
    if (!q) {
      populateGameSelect(allGames, document.getElementById('game-select').value);
      return;
    }
    const filtered = allGames.filter(g => normalizeStr(g.name).includes(q) || normalizeStr(g.slug).includes(q));
    populateGameSelect(filtered, document.getElementById('game-select').value);
  });

  // Chuyển tab Cài đặt
  document.getElementById('btn-toggle-settings').addEventListener('click', () => {
    document.getElementById('main-panel').style.display = 'none';
    document.getElementById('settings-panel').style.display = 'block';
  });

  document.getElementById('btn-back-main').addEventListener('click', () => {
    document.getElementById('settings-panel').style.display = 'none';
    document.getElementById('main-panel').style.display = 'block';
  });

  document.getElementById('btn-save-settings').addEventListener('click', () => {
    const apiUrl = document.getElementById('setting-api-url').value.trim();
    const syncKey = document.getElementById('setting-sync-key').value.trim();

    chrome.storage.local.set({ apiUrl, syncKey }, () => {
      alert('Đã lưu cấu hình kết nối API thành công!');
      document.getElementById('settings-panel').style.display = 'none';
      document.getElementById('main-panel').style.display = 'block';
    });
  });
}

async function loadSettings() {
  chrome.storage.local.get(['apiUrl', 'syncKey'], (res) => {
    document.getElementById('setting-api-url').value = res.apiUrl || DEFAULT_SETTINGS.apiUrl;
    document.getElementById('setting-sync-key').value = res.syncKey || DEFAULT_SETTINGS.syncKey;
  });
}
