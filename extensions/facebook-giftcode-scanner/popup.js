/**
 * Popup Script - CodeGame.Shop Facebook Scanner Extension v1.2.0
 */

let allGames = [];
let currentTabId = null;
let currentCodes = [];
let currentLinks = [];
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
      document.getElementById('btn-scan-quick').disabled = true;
      document.getElementById('btn-scan-deep').disabled = true;
      return;
    }

    document.getElementById('page-url').innerText = tab.url;

    // Quét nhanh ban đầu
    triggerQuickScan();
  });
}

function triggerQuickScan() {
  if (!currentTabId) return;

  const btn = document.getElementById('btn-scan-quick');
  btn.disabled = true;
  btn.innerHTML = '<span>⏳ Đang quét...</span>';

  chrome.tabs.sendMessage(currentTabId, { action: 'SCAN_PAGE' }, (response) => {
    btn.disabled = false;
    btn.innerHTML = '<span>⚡ Quét Nhanh</span>';

    if (chrome.runtime.lastError || !response) {
      document.getElementById('page-name').innerText = 'Chưa thể kết nối tới trang';
      document.getElementById('page-url').innerText = 'Hãy tải lại trang Facebook (F5) rồi bấm Quét nhé.';
      return;
    }

    handleScanResponse(response);
  });
}

function triggerDeepScan() {
  if (!currentTabId) return;

  const depthSelect = document.getElementById('scroll-depth');
  const rounds = parseInt(depthSelect.value, 10) || 8;

  const btnDeep = document.getElementById('btn-scan-deep');
  const btnQuick = document.getElementById('btn-scan-quick');
  const progressBox = document.getElementById('progress-box');
  const progressMsg = document.getElementById('progress-msg');
  const progressBarFill = document.getElementById('progress-bar-fill');

  btnDeep.disabled = true;
  btnQuick.disabled = true;
  progressBox.style.display = 'block';
  progressMsg.innerHTML = `<span>🌀 Đang cuộn trang ${rounds} lượt & mở bung bài viết...</span>`;
  progressBarFill.style.width = '15%';

  let currentPercent = 15;
  const interval = setInterval(() => {
    if (currentPercent < 90) {
      currentPercent += 8;
      progressBarFill.style.width = `${currentPercent}%`;
    }
  }, 1000);

  chrome.tabs.sendMessage(currentTabId, { action: 'DEEP_SCAN_PAGE', rounds }, (response) => {
    clearInterval(interval);
    progressBarFill.style.width = '100%';
    setTimeout(() => { progressBox.style.display = 'none'; }, 800);

    btnDeep.disabled = false;
    btnQuick.disabled = false;

    if (chrome.runtime.lastError || !response) {
      showAlert('Không thể thực hiện quét sâu. Vui lòng thử lại hoặc tải lại trang.', false);
      return;
    }

    handleScanResponse(response);
    showAlert(`Đã quét sâu hoàn tất! Tìm thấy ${response.codes?.length || 0} mã code và ${response.links?.length || 0} đường link.`, true);
  });
}

function handleScanResponse(response) {
  currentPageInfo = { pageName: response.pageName, pageUrl: response.pageUrl };
  document.getElementById('page-name').innerText = response.pageName;
  document.getElementById('page-name').title = response.pageName;

  // Tự động nhận diện tựa game
  const matchedSlug = autoMatchGame(response.pageName, response.pageUrl);
  if (matchedSlug) {
    document.getElementById('game-select').value = matchedSlug;
  }

  currentCodes = response.codes || [];
  currentLinks = response.links || [];

  renderResults(currentCodes, currentLinks);
}

function renderResults(codes = [], links = []) {
  const section = document.getElementById('results-section');
  const codesBadge = document.getElementById('badge-codes-count');
  const linksBadge = document.getElementById('badge-links-count');
  const codeListEl = document.getElementById('code-list');
  const linkListEl = document.getElementById('link-list');
  const alertEl = document.getElementById('status-alert');
  alertEl.style.display = 'none';

  codesBadge.innerText = codes.length;
  linksBadge.innerText = links.length;
  section.style.display = 'block';

  // 1. Render Codes
  if (codes.length === 0) {
    codeListEl.innerHTML = `
      <div style="text-align: center; padding: 14px; color: #64748b; font-size: 11px;">
        Chưa tìm thấy mã trong các bài viết. Hãy thử bấm <strong>🌀 Quét Sâu Toàn Trang</strong> để cuộn lấy thêm bài cũ nhé!
      </div>
    `;
    document.getElementById('btn-push').style.display = 'none';
  } else {
    document.getElementById('btn-push').style.display = 'flex';
    document.getElementById('btn-push').disabled = false;
    document.getElementById('btn-push').innerHTML = `<span>🚀 BẮN ${codes.length} MÃ LÊN WEB CODEGAME.SHOP</span>`;

    codeListEl.innerHTML = codes.map((c, index) => `
      <div class="code-row">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="code-badge">${c.code}</span>
          <span class="code-reward" title="${c.rewards}">${c.rewards}</span>
        </div>
        <button class="btn-remove-code" data-index="${index}" style="background: none; border: none; color: #64748b; cursor: pointer; padding: 2px 4px;">&times;</button>
      </div>
    `).join('');

    document.querySelectorAll('.btn-remove-code').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        currentCodes.splice(idx, 1);
        renderResults(currentCodes, currentLinks);
      });
    });
  }

  // 2. Render Links
  if (links.length === 0) {
    linkListEl.innerHTML = `
      <div style="text-align: center; padding: 14px; color: #64748b; font-size: 11px;">
        Không tìm thấy đường link nào trong bài viết.
      </div>
    `;
  } else {
    linkListEl.innerHTML = links.map(l => `
      <div class="link-row">
        <div class="link-details">
          <span class="link-badge ${l.type}">${l.label}</span>
          <span class="link-url-text" title="${l.url}">${l.url}</span>
        </div>
        <div class="link-actions-btn">
          <button class="btn-sm-action btn-copy-single-link" data-url="${encodeURIComponent(l.url)}">Chép</button>
          <a href="${l.url}" target="_blank" class="btn-sm-action">Mở</a>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.btn-copy-single-link').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const url = decodeURIComponent(e.target.dataset.url);
        navigator.clipboard.writeText(url).then(() => {
          e.target.innerText = '✓';
          setTimeout(() => { e.target.innerText = 'Chép'; }, 1500);
        });
      });
    });
  }
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
      gameName: selectedName,
      sourceLinks: currentLinks
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
  document.getElementById('btn-scan-quick').addEventListener('click', triggerQuickScan);
  document.getElementById('btn-scan-deep').addEventListener('click', triggerDeepScan);
  document.getElementById('btn-push').addEventListener('click', pushCodesToServer);

  // Tab switching
  const tabCodes = document.getElementById('tab-btn-codes');
  const tabLinks = document.getElementById('tab-btn-links');
  const paneCodes = document.getElementById('pane-codes');
  const paneLinks = document.getElementById('pane-links');

  tabCodes.addEventListener('click', () => {
    tabCodes.classList.add('active');
    tabLinks.classList.remove('active');
    paneCodes.classList.add('active');
    paneLinks.classList.remove('active');
  });

  tabLinks.addEventListener('click', () => {
    tabLinks.classList.add('active');
    tabCodes.classList.remove('active');
    paneLinks.classList.add('active');
    paneCodes.classList.remove('active');
  });

  // Chép toàn bộ link
  document.getElementById('btn-copy-all-links').addEventListener('click', () => {
    if (!currentLinks.length) return;
    const text = currentLinks.map(l => `${l.label}: ${l.url}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      showAlert(`Đã sao chép toàn bộ ${currentLinks.length} đường link vào bộ nhớ tạm!`, true);
    });
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
      showAlert('Đã lưu cấu hình kết nối API thành công!', true);
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
