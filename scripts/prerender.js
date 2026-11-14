import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://codegame.shop';

const GAME_CANONICAL_ALIASES = {
  'dau-truong-chan-ly-mobile': 'dau-truong-chan-ly',
  'ta-la-hac-ngo-khong-vplay': 'ta-la-hac-ngo-khong',
  'tam-quoc-huyen-tuong': 'tam-quoc-huyen-tuong-vng',
  'x-wukong-dai-chien-tam-gioi': 'x-wukong',
  'huyen-thoai-hai-tac': 'pirate-legends',
  'seven-deadly-sins-grand-cross': 'the-seven-deadly-sins-grand-cross',
  'where-winds-meet-mobile': 'yen-van-thap-luc-thanh',
  'loan-the-3q': 'loan-the-3q-than-ma-lenh-oeg',
};

function escapeHtml(unsafe = '') {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isCodeExpired(c) {
  if (!c) return false;
  const status = String(c.status || '').toLowerCase();
  if (status === 'expired' || status === 'rejected') return true;

  const exp = c.expiresAt || c.expires_at || c.expiry || '';
  if (!exp) return false;
  if (exp === '2026-12-31' || exp === '2026-12-31T23:59:59Z' || exp === '31/12/2026') return false;

  const nowMs = Date.now();
  const nowVn = new Date(nowMs + 7 * 60 * 60 * 1000);
  const todayVnStr = `${nowVn.getUTCFullYear()}-${String(nowVn.getUTCMonth() + 1).padStart(2, '0')}-${String(nowVn.getUTCDate()).padStart(2, '0')}`;

  const isoMatch = String(exp).trim().match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const hasTime = isoMatch[4] !== undefined;
    const hours = hasTime ? parseInt(isoMatch[4], 10) : 23;
    const minutes = isoMatch[5] !== undefined ? parseInt(isoMatch[5], 10) : 59;
    const seconds = isoMatch[6] !== undefined ? parseInt(isoMatch[6], 10) : 59;
    const formatted = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const utcTimestamp = Date.UTC(year, month - 1, day, hours - 7, minutes, seconds, 999);
    return hasTime ? (utcTimestamp < nowMs) : (formatted < todayVnStr || utcTimestamp < nowMs);
  }

  const d = new Date(exp);
  if (isNaN(d.getTime())) return false;
  const hasTime = String(exp).includes(':') || String(exp).includes('T');
  if (!hasTime) {
    const vnD = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    const y = vnD.getUTCFullYear();
    const m = String(vnD.getUTCMonth() + 1).padStart(2, '0');
    const day = String(vnD.getUTCDate()).padStart(2, '0');
    const formatted = `${y}-${m}-${day}`;
    return formatted < todayVnStr || d.getTime() < nowMs;
  }
  return d.getTime() < nowMs;
}

const TOPIC_CLUSTERS = [
  {
    slug: 'kiem-hiep-tien-hiep',
    name: 'Kiếm Hiệp & Tiên Hiệp',
    badge: '⚔️ Kiếm Hiệp & Tiên Hiệp',
    description: 'Tổng hợp giftcode các tựa game Kiếm Hiệp, Tiên Hiệp, Tu Chân, Võ Lâm mobile mới nhất 2026. Nhận KNB, Vàng khóa, Thú Cưỡi và Pháp Bảo miễn phí.',
    match: (c) => /kiếm hiệp|tiên hiệp|võ hiệp|tu tiên/i.test(c),
  },
  {
    slug: 'nhap-vai-gacha-anime',
    name: 'Nhập Vai Gacha & Anime',
    badge: '✨ Nhập Vai Gacha & Anime',
    description: 'Kho giftcode game nhập vai phong cách Anime, Gacha Waifu, Turn-based và Thế giới mở hot nhất 2026. Nhận Vé Quay, Đá Quý, Kim Cương tân thủ.',
    match: (c) => /anime|gacha|waifu/i.test(c),
  },
  {
    slug: 'ban-sung-sinh-ton',
    name: 'Bắn Súng & Sinh Tồn',
    badge: '🎯 Bắn Súng & Sinh Tồn',
    description: 'Danh sách code game Bắn Súng Sinh Tồn, FPS, Battle Royale, Tactical Shooter mới nhất 2026. Nhận Skin Súng, Trang Phục, Thẻ Vô Cực và Hòm Quà VIP.',
    match: (c) => /bắn súng|sinh tồn|battle royale/i.test(c),
  },
  {
    slug: 'tam-quoc-chien-thuat',
    name: 'Tam Quốc & Chiến Thuật',
    badge: '🏰 Tam Quốc & Chiến Thuật',
    description: 'Cập nhật giftcode game Tam Quốc, Chiến Thuật SLG, Thủ Thành và Thẻ Tướng mới nhất 2026. Nhận Tướng Đỏ, Lệnh Chiêu Mộ, Lương Thảo và Vàng miễn phí.',
    match: (c) => /tam quốc|chiến thuật|chiến lược|slg|đế chế|thẻ tướng/i.test(c),
  },
  {
    slug: 'roblox-mini-game',
    name: 'Roblox & Mini Game',
    badge: '🎮 Roblox & Mini Game',
    description: 'Tổng hợp mã code Roblox các chế độ hot nhất: Blox Fruits, King Legacy, Anime Defenders, Fruit Battlegrounds... Nhận Beli, Gems, Reset Stats mới nhất 2026.',
    match: (c) => /roblox|mini game/i.test(c),
  },
  {
    slug: 'nhap-vai-mmorpg',
    name: 'Nhập Vai & MMORPG',
    badge: '🛡️ Nhập Vai & MMORPG',
    description: 'Trọn bộ giftcode game MMORPG, Hành Động RPG và Thế Giới Mở cày cuốc hay nhất 2026. Hướng dẫn nhập code nhận Trang Bị Cam, Thể Lực và Danh Hiệu độc quyền.',
    match: (c) => /mmorpg|nhập vai|arpg/i.test(c),
  },
];

function getClusterSlug(category = '') {
  const c = String(category || '').toLowerCase();
  for (const cluster of TOPIC_CLUSTERS) {
    if (cluster.match(c)) return cluster.slug;
  }
  return 'nhap-vai-mmorpg';
}

function parseHowToSteps(instructions, gameName) {
  const text = (instructions || '').trim();
  if (text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 5);
    const stepLines = lines.filter((l) => /^(bước|\d+[\.\)]|b\d+:)/i.test(l));
    if (stepLines.length >= 2) {
      return stepLines.slice(0, 6).map((line, idx) => {
        const cleanText = line.replace(/^(bước\s*\d+[:\.]*|\d+[\.\)]|b\d+[:\.]*)\s*/i, '').trim();
        return {
          '@type': 'HowToStep',
          position: idx + 1,
          name: cleanText.slice(0, 60),
          text: line,
        };
      });
    }
  }
  return [
    {
      '@type': 'HowToStep',
      position: 1,
      name: 'Mở game và đăng nhập',
      text: `Khởi động trò chơi ${gameName} trên thiết bị và đăng nhập vào tài khoản nhân vật của bạn.`,
    },
    {
      '@type': 'HowToStep',
      position: 2,
      name: 'Tìm mục Đổi Quà / Phúc Lợi',
      text: `Nhấp vào biểu tượng Sự Kiện, Phúc Lợi hoặc Cài Đặt theo giao diện của ${gameName}.`,
    },
    {
      '@type': 'HowToStep',
      position: 3,
      name: 'Nhập mã giftcode',
      text: `Sao chép mã giftcode từ CodeGame.shop và dán chính xác vào ô nhập mã quà tặng.`,
    },
    {
      '@type': 'HowToStep',
      position: 4,
      name: 'Xác nhận và nhận quà',
      text: `Bấm Đổi Quà và kiểm tra hòm Thư trong game ${gameName} để nhận vật phẩm ngay tức thì.`,
    },
  ];
}

async function runPrerender() {
  const distDir = path.resolve(__dirname, '../dist');
  const templatePath = path.join(distDir, 'index.html');

  if (!fs.existsSync(templatePath)) {
    console.error('[Prerender] Không tìm thấy dist/index.html. Hãy chạy vite build trước!');
    process.exit(1);
  }

  const templateHtml = fs.readFileSync(templatePath, 'utf8');

  // Load games data and crawled codes
  const gamesPath = fs.existsSync(path.resolve(__dirname, '../public/data/games188.json'))
    ? path.resolve(__dirname, '../public/data/games188.json')
    : path.resolve(__dirname, '../src/data/games188.json');
  const games = JSON.parse(fs.readFileSync(gamesPath, 'utf8'));

  let crawledCodes = [];
  try {
    const codesPath = fs.existsSync(path.resolve(__dirname, '../public/data/crawled_codes_188.json'))
      ? path.resolve(__dirname, '../public/data/crawled_codes_188.json')
      : path.resolve(__dirname, '../src/data/crawled_codes_188.json');
    crawledCodes = JSON.parse(fs.readFileSync(codesPath, 'utf8'));
  } catch {}

  console.log(`[Prerender] Bắt đầu sinh HTML tĩnh cho ${games.length} tựa game và các trang chính...`);

  function buildPageHtml({
    title,
    description,
    canonicalPath,
    ogImage = 'https://codegame.shop/og-image.jpg',
    ogType = 'website',
    noindex = false,
    jsonLd = [],
    bodyContent = '',
  }) {
    const canonicalUrl = `${BASE_URL}${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`;
    const fullOgImage = ogImage.startsWith('http') ? ogImage : `${BASE_URL}${ogImage.startsWith('/') ? ogImage : `/${ogImage}`}`;
    const schemas = Array.isArray(jsonLd) ? jsonLd : [jsonLd];

    const headInjections = `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    <link rel="alternate" hreflang="vi" href="${escapeHtml(canonicalUrl)}">
    <link rel="alternate" hreflang="x-default" href="${escapeHtml(canonicalUrl)}">
    ${noindex ? '<meta name="robots" content="noindex, nofollow, noarchive">' : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">'}
    
    <!-- Open Graph Tags -->
    <meta property="og:site_name" content="CodeGame.shop">
    <meta property="og:type" content="${escapeHtml(ogType)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
    <meta property="og:image" content="${escapeHtml(fullOgImage)}">
    <meta property="og:image:secure_url" content="${escapeHtml(fullOgImage)}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${escapeHtml(title)}">
    <meta property="og:locale" content="vi_VN">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(fullOgImage)}">
    <meta name="twitter:image:alt" content="${escapeHtml(title)}">

    <!-- JSON-LD Structured Data -->
    ${schemas.map((s) => `<script type="application/ld+json">\n${JSON.stringify(s, null, 2)}\n</script>`).join('\n')}
`;

    // Replace <title> and meta tags in template, and clean up any template JSON-LD scripts to avoid duplication
    let html = templateHtml;
    html = html.replace(/<title>[\s\S]*?<\/title>/i, '');
    html = html.replace(/<meta\s+name="description"[\s\S]*?>/i, '');
    html = html.replace(/<link\s+rel="canonical"[\s\S]*?>/i, '');
    html = html.replace(/<meta\s+name="robots"[\s\S]*?>/i, '');
    html = html.replace(/<meta\s+property="og:[\s\S]*?>/gi, '');
    html = html.replace(/<meta\s+name="twitter:[\s\S]*?>/gi, '');
    html = html.replace(/<script\s+type=["']application\/ld\+json["']>[\s\S]*?<\/script>\s*/gi, '');

    // Transform synchronous render-blocking CSS into non-blocking preload with onload swap
    html = html.replace(
      /<link\s+rel="stylesheet"\s+crossorigin\s+href="(\/assets\/index-[^"]+\.css)">/i,
      '<link rel="preload" as="style" href="$1" onload="this.onload=null;this.rel=\'stylesheet\'">\n    <noscript><link rel="stylesheet" href="$1"></noscript>'
    );

    html = html.replace('</head>', `${headInjections}\n</head>`);

    // Extract only JS module scripts from templateHtml to preserve hydration (exclude JSON-LD to prevent duplicate injection before </body>)
    const scriptMatches = (templateHtml.match(/<script[\s\S]*?<\/script>/gi) || []).filter((s) => !s.includes('application/ld+json'));
    const scriptTags = scriptMatches.join('\n  ');

    // Replace <div id="root"> content and preserve all scripts before </body>
    const rootStartIdx = html.indexOf('<div id="root">');
    const bodyEndIdx = html.indexOf('</body>');
    const bodyStartIdx = html.indexOf('<body');
    let preRootHtml = html.slice(0, rootStartIdx);
    if (bodyStartIdx !== -1) {
      const bodyTagEndIdx = html.indexOf('>', bodyStartIdx);
      if (bodyTagEndIdx !== -1 && rootStartIdx > bodyTagEndIdx) {
        // Strip #app-preloader from prerendered static HTML so the static content paints at 0ms
        preRootHtml = html.slice(0, bodyTagEndIdx + 1) + '\n    ';
      }
    }
    if (rootStartIdx !== -1 && bodyEndIdx !== -1) {
      html = preRootHtml + `<div id="root">${bodyContent}</div>\n  ${scriptTags}\n` + html.slice(bodyEndIdx);
    } else {
      html = html.replace(/<div id="root">[\s\S]*<\/div>/i, `<div id="root">${bodyContent}</div>\n  ${scriptTags}`);
    }

    return html;
  }

  // Load news articles early for Homepage & News prerendering
  let newsArticles = [];
  try {
    const seedNewsMod = await import('../src/data/seedNews.ts');
    newsArticles = seedNewsMod.DEFAULT_NEWS_ARTICLES || [];
  } catch (err) {
    console.warn('[Prerender] Không thể nạp seedNews.ts:', err?.message);
  }

  // 1. Prerender Homepage (dist/index.html)
  const homeTopGames = games.slice(0, 60);
  const homeLatestNews = newsArticles.slice(0, 6);
  const totalCodesFormatted = (crawledCodes.length >= 14000 ? crawledCodes.length.toLocaleString('vi-VN') : '14.739');
  const canonicalGamesList = games.filter(g => !GAME_CANONICAL_ALIASES[g.slug || g.id]);
  const canonicalGamesCount = games.length >= 590 ? games.length : 595;
  const homeDescription = `Kho tổng hợp hơn ${totalCodesFormatted}+ giftcode game mobile và webgame mới nhất 2026 của ${canonicalGamesCount} tựa game chuẩn. Cập nhật liên tục 24/7 từ các NPH VNG, Garena, VTC, SohaGame, Funtap.`;

  // Load default upcoming games for prerendered banner (CLS optimization)
  let prerenderUpcoming = [];
  try {
    const upcomingPath = path.resolve(__dirname, '../src/data/defaultUpcomingGames.ts');
    if (fs.existsSync(upcomingPath)) {
      const upStr = fs.readFileSync(upcomingPath, 'utf8');
      const startIdx = upStr.indexOf('[');
      const endIdx = upStr.lastIndexOf(']');
      if (startIdx >= 0 && endIdx > startIdx) {
        const upList = eval(upStr.substring(startIdx, endIdx + 1));
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        const now = Date.now();
        prerenderUpcoming = upList
          .filter(g => g && g.status !== 'CANCELLED' && g.status !== 'PENDING' && g.status !== 'LAUNCHED' && g.releaseDate && (now - new Date(g.releaseDate).getTime() <= ONE_DAY_MS))
          .sort((a, b) => {
            const timeA = a.releaseDate ? new Date(a.releaseDate).getTime() : NaN;
            const timeB = b.releaseDate ? new Date(b.releaseDate).getTime() : NaN;
            if (timeA !== timeB) return timeA - timeB;
            return (a.order || 0) - (b.order || 0);
          })
          .slice(0, 6);
      }
    }
  } catch (err) {
    console.warn('[Prerender] Lỗi nạp upcoming games:', err.message);
  }

  const upcomingCardsHtml = prerenderUpcoming.map(g => {
    const slug = escapeHtml(g.slug || g.id);
    const thumb1x = `/game_icons/${slug}-thumb.webp`;
    const thumb2x = `/game_icons/${slug}-thumb-256.webp`;
    return `
      <div class="min-w-[145px] max-w-[155px] sm:min-w-[240px] sm:max-w-[260px] lg:min-w-0 lg:max-w-none shrink-0 bg-background/90 hover:bg-background border border-border/80 hover:border-cyan-500/60 rounded-xl p-2 sm:p-3 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-cyan-500/10 group cursor-pointer snap-start relative">
        <div>
          <div class="flex items-center justify-between gap-1 mb-1 sm:mb-2">
            <span class="text-[9px] sm:text-[10px] font-semibold text-muted-foreground truncate max-w-[85px] sm:max-w-[100px]">${escapeHtml(g.category || 'Game')}</span>
            <span class="px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded text-[8px] sm:text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">Mobile</span>
          </div>
          <div class="flex items-center gap-1.5 sm:gap-2.5 mb-1.5 sm:mb-2.5">
            <div class="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl overflow-hidden bg-slate-800 border border-cyan-500/30 shrink-0 flex items-center justify-center">
              <img src="${thumb1x}" srcset="${thumb1x} 1x, ${thumb2x} 2x" alt="${escapeHtml(g.name)}" width="44" height="44" loading="lazy" decoding="async" class="w-full h-full object-cover">
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="font-heading font-bold text-[11px] sm:text-sm text-foreground truncate">${escapeHtml(g.name)}</h3>
              <p class="text-[9px] sm:text-[11px] text-muted-foreground truncate">${escapeHtml(g.publisher || 'NPH')}</p>
            </div>
          </div>
          <div class="mb-1.5 sm:mb-2 p-1 sm:p-2 rounded-lg bg-slate-900/90 border border-cyan-500/30 text-center shadow-inner">
            <div class="font-mono font-bold text-[10px] sm:text-[13px] text-cyan-300 tracking-tight flex items-center justify-center gap-0.5 sm:gap-1">
              <span class="px-1 py-0.2 sm:py-0.5 bg-cyan-950/70 rounded text-cyan-200">01d</span>
              <span class="text-cyan-500">:</span>
              <span class="px-1 py-0.2 sm:py-0.5 bg-cyan-950/70 rounded text-cyan-200">12h</span>
              <span class="text-cyan-500">:</span>
              <span class="px-1 py-0.2 sm:py-0.5 bg-cyan-950/70 rounded text-cyan-200">00m</span>
            </div>
          </div>
          <div class="mb-1.5 sm:mb-3 flex items-center justify-between text-[9px] sm:text-[11px]">
            <span class="inline-flex items-center gap-1 text-amber-400 font-medium truncate">
              <span>🎁 Dự kiến 4 code</span>
            </span>
          </div>
        </div>
        <div class="pt-1 sm:pt-2 border-t border-border/50 flex items-center gap-1 sm:gap-2">
          <button class="flex-1 py-1 sm:py-1.5 px-1 sm:px-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950">
            <span>Báo Code</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  const homeHtml = buildPageHtml({
    title: 'CodeGame.shop - Săn Giftcode Miễn Phí & Giao Dịch Mã Game Uy Tín',
    description: homeDescription,
    canonicalPath: '/',
    ogType: 'website',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'CodeGame.shop',
        url: 'https://codegame.shop/',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://codegame.shop/?q={search_term_string}',
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'CodeGame.shop',
        url: 'https://codegame.shop',
        logo: 'https://codegame.shop/logo.webp',
        description: 'Cổng thông tin chia sẻ giftcode game mobile và giao dịch mã tự động.',
        sameAs: [
          'https://t.me/webcodegame_vn',
          'https://zalo.me/g/qdtlmj2tebfa0baraedg',
          'https://zalo.me/0386767888',
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Giftcode trên CodeGame.shop có miễn phí không?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Tất cả mã giftcode trong mục Mã Miễn Phí và Đợt Phát Code đều hoàn toàn miễn phí 100%, được tổng hợp và kiểm duyệt từ các Nhà phát hành game chính thức tại Việt Nam.',
            },
          },
          {
            '@type': 'Question',
            name: 'Làm thế nào để sao chép mã code nhanh chóng?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Bạn chỉ cần nhấp vào nút Sao Chép bên cạnh mỗi mã giftcode hoặc chọn Sao Chép Toàn Bộ Mã Còn Hạn để lưu tất cả giftcode vào bộ nhớ tạm trong 1 giây.',
            },
          },
          {
            '@type': 'Question',
            name: 'Các tựa game trên CodeGame.shop có hợp pháp không?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Hệ thống cập nhật và đối soát thông tin pháp lý, Giấy phép phê duyệt nội dung kịch bản G1 từ Cục PTTH&TTĐT đối với từng tựa game phát hành tại Việt Nam.',
            },
          },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://codegame.shop/' },
          { '@type': 'ListItem', position: 2, name: 'Mã Miễn Phí', item: 'https://codegame.shop/' },
        ],
      },
    ],
    bodyContent: `
      <div class="min-h-screen flex flex-col bg-dark-950 text-gray-100">
        <!-- Announcement Bar: Exactly matches AnnouncementBar.tsx to eliminate Desktop/Mobile CLS -->
        <div class="site-announcement-bar relative w-full max-w-full bg-gradient-to-r from-indigo-950 via-primary-dark to-purple-950 text-white border-b border-primary/30 text-xs z-30 shadow-md select-none overflow-hidden h-8 sm:h-9 flex items-center box-border" style="contain: paint;">
          <div class="relative z-20 flex items-center gap-1.5 pl-3 pr-3.5 sm:pl-4 sm:pr-4 py-1 bg-gradient-to-r from-indigo-950 via-indigo-950/95 to-indigo-950/70 backdrop-blur-md shrink-0 border-r border-white/10 shadow-sm">
            <div class="w-4 h-4 sm:w-5 sm:h-5 rounded-md bg-amber-400/20 flex items-center justify-center shrink-0">
              <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
            </div>
            <span class="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-300">Thông báo</span>
          </div>
          <div class="relative flex-1 min-w-0 max-w-full overflow-hidden h-full flex items-center">
            <div class="pointer-events-none absolute left-0 top-0 bottom-0 w-6 sm:w-10 bg-gradient-to-r from-indigo-950 to-transparent z-10"></div>
            <div class="pointer-events-none absolute right-0 top-0 bottom-0 w-6 sm:w-10 bg-gradient-to-l from-purple-950 to-transparent z-10"></div>
            <div class="flex w-max animate-marquee hover:[animation-play-state:paused] active:[animation-play-state:paused] cursor-pointer" title="Rê chuột hoặc chạm để tạm dừng đọc thông báo">
              <div class="inline-flex items-center gap-3 px-6 whitespace-nowrap">
                <span class="font-extrabold text-amber-200 tracking-wide drop-shadow-sm">Chào mừng đến với CodeGame.shop</span>
                <span class="text-slate-100 font-medium">• Tra cứu và nhận mã giftcode miễn phí mới nhất.</span>
                <span class="text-amber-400/70 font-bold px-2 select-none">✦</span>
              </div>
              <div class="inline-flex items-center gap-3 px-6 whitespace-nowrap">
                <span class="font-extrabold text-amber-200 tracking-wide drop-shadow-sm">Chào mừng đến với CodeGame.shop</span>
                <span class="text-slate-100 font-medium">• Tra cứu và nhận mã giftcode miễn phí mới nhất.</span>
                <span class="text-amber-400/70 font-bold px-2 select-none">✦</span>
              </div>
              <div class="inline-flex items-center gap-3 px-6 whitespace-nowrap">
                <span class="font-extrabold text-amber-200 tracking-wide drop-shadow-sm">Chào mừng đến với CodeGame.shop</span>
                <span class="text-slate-100 font-medium">• Tra cứu và nhận mã giftcode miễn phí mới nhất.</span>
                <span class="text-amber-400/70 font-bold px-2 select-none">✦</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Navbar Header: Aligned with Header.tsx to prevent CLS -->
        <header class="sticky top-0 z-50 w-full max-w-full box-border bg-background/95 backdrop-blur-md border-b border-border shadow-md shadow-black/10 transition-all overflow-visible">
          <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-3">
              <a href="/" class="header-logo flex items-center gap-1.5 sm:gap-2 text-brand-400 font-extrabold text-base sm:text-lg">
                <img src="/logo.webp" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg object-cover" />
                <span class="text-white font-bold">CodeGame.Shop</span>
              </a>
              <nav class="header-nav-tabs hidden md:flex items-center space-x-3 sm:space-x-6 text-xs sm:text-sm font-bold text-gray-300">
                <a href="/" class="text-brand-400 font-black">Mã Miễn Phí</a>
                <a href="/giveaways" class="hover:text-white transition-colors">Đợt Phát Code</a>
                <a href="/store" class="hover:text-white transition-colors">Chợ Code VIP</a>
              </nav>
            </div>
          </div>
        </header>

        <!-- Main Content Area: Aligned with App.tsx React structure to eliminate CLS -->
        <main class="flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
          <!-- Hero Section: Exactly matched with HeroBanner.tsx to prevent CLS -->
          <div class="relative overflow-hidden pt-1 pb-1.5 sm:pt-7 sm:pb-7 border-b border-border/50">
            <div class="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8">
              <div class="text-center max-w-2xl mx-auto">
                <!-- Top Pill Badge (Single-line guaranteed without wrapping bugs) -->
                <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-primary/10 border border-primary/30 text-primary-light text-[9px] sm:text-xs font-semibold uppercase tracking-wider mb-1 sm:mb-3 shadow-sm max-w-full whitespace-nowrap overflow-hidden">
                  <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 animate-spin shrink-0" style="animation-duration: 6s;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
                  <span class="truncate">CẬP NHẬT 24/7</span>
                  <span class="text-primary/30 shrink-0">•</span>
                  <span class="text-emerald-400 font-bold font-mono inline-flex items-center gap-1 shrink-0">
                    <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400 animate-pulse shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    <span>14.739</span>
                    <span class="text-[9px] sm:text-[10px] text-slate-300 font-normal lowercase hidden xs:inline">mã code</span>
                  </span>
                </div>

                <!-- Main Title - Compact on mobile -->
                <h1 class="text-sm xs:text-base sm:text-3xl lg:text-4xl font-display font-extrabold tracking-tight text-foreground leading-snug mb-1 sm:mb-2.5 min-h-[44px] xs:min-h-[50px] sm:min-h-0">
                  Kho Giftcode Game Mobile & Webgame Mới Nhất 2026 <span class="bg-gradient-to-r from-purple-400 via-primary-light to-cyan-400 bg-clip-text text-transparent">Chính Thức</span>
                </h1>

                <!-- Shortened Subtitle - Hidden on mobile to prioritize instant game visibility -->
                <p class="hidden sm:block text-[11px] sm:text-sm text-slate-300 max-w-xl mx-auto leading-normal mb-2 sm:mb-3.5 font-sans px-1">
                  Tổng hợp và chia sẻ mã quà tặng game mobile, webgame bản quyền chính hãng tại Việt Nam.
                </p>

                <!-- Smart Autocomplete Search Bar -->
                <div id="hero-search-container" class="max-w-xl mx-auto mb-1 sm:mb-3.5">
                  <div class="relative w-full">
                    <input type="text" placeholder="Tìm nhanh tên game, giftcode mới nhất..." class="w-full border border-border text-foreground placeholder-slate-400 shadow-xl transition-all outline-none bg-card py-3 sm:py-3.5 text-base sm:text-sm pl-10 sm:pl-12 pr-20 sm:pr-24 rounded-2xl" readonly />
                  </div>
                </div>

                <!-- Quick search tags - Hidden on mobile, shown on desktop -->
                <div class="hidden sm:block w-full max-w-full overflow-hidden mb-1 sm:mb-4">
                  <div class="flex items-center gap-1 sm:gap-1.5 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-none py-0.5 sm:flex-wrap sm:justify-center w-full max-w-full">
                    <span class="text-[10px] sm:text-xs text-slate-300 font-medium flex items-center gap-1 shrink-0">
                      <svg class="w-3 h-3 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg> Tìm nhanh:
                    </span>
                    <span class="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-xs bg-card border border-border text-slate-200 font-medium shrink-0">Genshin Impact</span>
                    <span class="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-xs bg-card border border-border text-slate-200 font-medium shrink-0">Where Winds Meet</span>
                    <span class="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-xs bg-card border border-border text-slate-200 font-medium shrink-0">Delta Force</span>
                    <span class="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-xs bg-card border border-border text-slate-200 font-medium shrink-0">Liên Quân Mobile</span>
                    <span class="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-xs bg-card border border-border text-slate-200 font-medium shrink-0">Honkai: Star Rail</span>
                    <span class="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-xs bg-card border border-border text-slate-200 font-medium shrink-0">Free Fire</span>
                  </div>
                </div>

                <!-- Stats Cards: Exactly matched with HeroBanner.tsx to eliminate Desktop CLS -->
                <div class="hidden sm:grid grid-cols-4 gap-3 max-w-2xl mx-auto pt-1">
                  <div class="p-3 rounded-xl bg-card/70 border border-border text-center shadow-sm">
                    <div class="flex items-center justify-center gap-1 text-primary mb-0.5">
                      <svg class="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
                      <span class="font-display font-bold text-base text-foreground">${canonicalGamesCount}+</span>
                    </div>
                    <span class="text-[11px] text-slate-300 font-medium">Tựa Game</span>
                  </div>

                  <div class="p-3 rounded-xl bg-card/70 border border-border text-center shadow-sm">
                    <div class="flex items-center justify-center gap-1 text-secondary mb-0.5">
                      <svg class="w-3.5 h-3.5 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                      <span class="font-display font-bold text-base text-foreground">11,700+</span>
                    </div>
                    <span class="text-[11px] text-slate-300 font-medium">Mã Giftcode</span>
                  </div>

                  <div class="p-3 rounded-xl bg-card/70 border border-border text-center shadow-sm">
                    <div class="flex items-center justify-center gap-1 text-emerald-400 mb-0.5">
                      <svg class="w-3.5 h-3.5 text-emerald-400 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                      <span class="font-display font-bold text-base text-emerald-400 font-mono transition-all duration-300">107.509</span>
                    </div>
                    <span class="text-[11px] text-slate-300 font-medium">Tổng lượt sao chép</span>
                  </div>

                  <div class="p-3 rounded-xl bg-card/70 border border-border text-center shadow-sm">
                    <div class="flex items-center justify-center gap-1 text-cyan-400 mb-0.5">
                      <svg class="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      <span class="font-display font-bold text-base text-foreground">Hôm nay</span>
                    </div>
                    <span class="text-[11px] text-slate-300 font-medium">Cập Nhật Mới Nhất</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Main Catalog Section Container: Exactly matches React DOM to prevent CLS -->
          <div id="game-catalog-section" class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-1.5 sm:py-8">
            <!-- 1. PinnedGamesBar Initial Invitation -->
            <div class="mb-2.5 sm:mb-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-primary/5 to-cyan-500/10 border border-amber-500/20 p-2 sm:p-4 backdrop-blur-sm shadow-sm transition-all">
              <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                <div class="flex items-center gap-2 sm:gap-3">
                  <div class="w-6 h-6 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
                    <svg class="w-3.5 h-3.5 sm:w-5 sm:h-5 fill-amber-400/50" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5 sm:gap-2">
                      <span class="font-heading font-bold text-xs sm:text-base text-foreground flex items-center gap-1.5">Game Đang Theo Dõi</span>
                      <span class="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">Tự Động Ghim</span>
                    </div>
                    <p class="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-none">
                      Nhấn <span class="text-amber-400 font-semibold">🔖 Lưu</span> trên thẻ game hoặc <span class="text-cyan-400 font-semibold">🔔 Báo Code</span> để ghim ưu tiên lên đầu trang.
                    </p>
                  </div>
                </div>
                <div class="px-2 py-0.5 sm:px-3.5 sm:py-1.5 rounded-lg sm:rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] sm:text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap self-end sm:self-auto shrink-0 shadow-sm">
                  <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
                  <span>Xem Game Sắp Ra Mắt</span>
                  <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
                </div>
              </div>
            </div>

            <!-- 2. Upcoming Games Banner Section -->
            <div id="upcoming-games-banner-section">
              <section class="mb-3 sm:mb-8 rounded-2xl bg-gradient-to-br from-card via-card/95 to-secondary/30 border border-cyan-500/25 p-2.5 sm:p-5 backdrop-blur-md shadow-lg shadow-cyan-500/5 transition-all relative overflow-hidden">
                <div class="flex items-center justify-between gap-2 mb-2 sm:mb-4 pb-1.5 sm:pb-3 border-b border-border/50 relative z-10">
                  <div class="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                    <div class="w-6 h-6 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-slate-950 shadow-md shadow-cyan-500/20 shrink-0">
                      <svg class="w-3.5 h-3.5 sm:w-5 sm:h-5 text-slate-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5 sm:gap-2">
                        <h2 class="font-heading font-bold text-xs sm:text-base md:text-lg text-foreground tracking-tight whitespace-nowrap flex items-center gap-1.5">
                          <span>Game Sắp Ra Mắt</span>
                        </h2>
                        <span class="hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                          Lịch Mở Server
                        </span>
                      </div>
                      <p class="hidden sm:block text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
                        Đồng hồ đếm ngược sống • Quà tân thủ dự kiến • Nhận code ngay khi mở server
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] sm:text-xs font-semibold whitespace-nowrap shrink-0 shadow-sm">
                    <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                    <span>Xem tất cả (${prerenderUpcoming.length})</span>
                    <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                </div>
                <div class="flex lg:grid lg:grid-cols-6 gap-2 sm:gap-3.5 overflow-x-auto pb-1 sm:pb-1.5 lg:pb-0 scrollbar-none snap-x snap-mandatory relative z-10">
                  ${upcomingCardsHtml}
                </div>
              </section>
            </div>

            <!-- 3. CategoryFilter Horizontal Chips Bar -->
            <div class="mb-3 sm:mb-6 w-full max-w-full">
              <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none w-full max-w-full flex-nowrap">
                <span class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary text-white shadow-glow-primary shrink-0">
                  🔥 <span>Tất cả</span>
                  <span class="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/25 text-white/90">${canonicalGamesCount}</span>
                </span>
                <span class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-card border border-border text-slate-300 shrink-0">
                  ✨ <span>Mới Cập Nhật</span>
                </span>
                <span class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-card border border-border text-slate-300 shrink-0">
                  🎁 <span>Nhiều Code Nhất</span>
                </span>
              </div>
            </div>

            <!-- 5. GameGrid View Switcher Header Bar -->
            <div class="space-y-4 sm:space-y-5 w-full max-w-full overflow-hidden box-border">
              <div class="hidden sm:flex items-center justify-between gap-2.5 pb-1">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="text-xs sm:text-sm text-muted-foreground truncate">
                    Hiển thị <strong class="text-foreground font-bold">60</strong> / ${canonicalGamesCount} game tìm thấy
                  </span>
                </div>
                <div class="flex items-center gap-0.5 sm:gap-1 bg-card/90 backdrop-blur-sm border border-border p-1 rounded-xl shadow-sm shrink-0">
                  <div class="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-semibold text-muted-foreground">
                    <span class="hidden sm:inline text-[11px] sm:text-xs">Lưới thẻ</span>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 w-full max-w-full box-border">
                ${homeTopGames
                  .map(
                    (g) => `
                  <a href="/game/${escapeHtml(g.slug)}" class="group relative flex flex-col justify-between bg-card hover:bg-card-hover rounded-xl sm:rounded-2xl border border-border/80 hover:border-primary/50 transition-all duration-200 p-2 sm:p-2.5 shadow-cyber-card cursor-pointer overflow-visible">
                    <div>
                      <div class="flex items-start justify-between gap-1 mb-1.5 relative">
                        <img src="/game_icons/${escapeHtml(g.slug)}-thumb.webp" srcset="/game_icons/${escapeHtml(g.slug)}-thumb.webp 1x, /game_icons/${escapeHtml(g.slug)}-thumb-256.webp 2x" alt="${escapeHtml(g.name)}" width="48" height="48" loading="lazy" decoding="async" class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover border border-border/60 shrink-0">
                      </div>
                      <div class="min-w-0">
                        <h3 class="font-bold text-xs sm:text-sm text-foreground line-clamp-1">${escapeHtml(g.name)}</h3>
                        <span class="text-[10px] sm:text-[11px] text-muted-foreground truncate block mt-0.5">${escapeHtml(g.publisher || 'NPH Việt Nam')}</span>
                      </div>
                    </div>
                    <div class="mt-2 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md self-start border border-emerald-500/30">
                      🎁 ${g.free_codes_count || 10}+ Giftcode
                    </div>
                  </a>`
                  )
                  .join('')}
              </div>
            </div>

            <!-- Tin Tức & Cẩm Nang Giftcode Mới Nhất (P2-3) -->
            <section class="mt-12 pt-8 border-t border-gray-800">
              <div class="flex items-center justify-between mb-5">
                <h2 class="text-lg sm:text-xl font-black text-white flex items-center space-x-2">
                  <span>📰 Tin Tức & Cẩm Nang Giftcode Mới Nhất 2026</span>
                </h2>
                <a href="/news/" class="text-xs font-bold text-brand-400 hover:text-brand-300">Xem tất cả ${newsArticles.length}+ bài viết →</a>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                ${homeLatestNews.map(a => {
                  let cover = a.cover_url || a.thumbnail_url || (a.game_slug ? `/game_icons/${a.game_slug}-thumb.webp` : '/og-image-thumb.webp');
                  if (cover.startsWith('/game_icons/') && !cover.includes('-thumb')) {
                    cover = cover.replace(/\.webp$/i, '-thumb.webp');
                  }
                  return `
                  <a href="/news/${escapeHtml(a.slug || a.id)}" class="flex flex-col justify-between bg-[#11162B] hover:bg-[#161D36] p-2.5 rounded-xl border border-gray-800/80 hover:border-emerald-500/40 transition-all text-left group">
                    <div>
                      <img src="${escapeHtml(cover)}" alt="${escapeHtml(a.title)}" width="180" height="100" loading="lazy" decoding="async" class="w-full aspect-video rounded-lg object-cover mb-2 border border-gray-700/60" />
                      <h3 class="font-bold text-xs text-gray-100 group-hover:text-emerald-400 line-clamp-2">${escapeHtml(a.title)}</h3>
                    </div>
                    <span class="text-[10px] text-gray-400 mt-2 block">${escapeHtml(a.published_at ? a.published_at.slice(0, 10) : '2026-11-09')}</span>
                  </a>`;
                }).join('')}
              </div>
            </section>
          </div>
        </main>

          <!-- FAQ Section -->
          <section class="mt-14 pt-8 border-t border-gray-800">
            <h2 class="text-lg sm:text-xl font-bold text-white mb-4">Câu Hỏi Thường Gặp Khi Nhận Giftcode (FAQ)</h2>
            <div class="grid md:grid-cols-3 gap-4 text-xs text-gray-300">
              <div class="p-4 rounded-xl bg-dark-900 border border-gray-800">
                <h3 class="font-bold text-gray-100 text-sm mb-2">1. Giftcode trên CodeGame.shop có miễn phí không?</h3>
                <p>Tất cả mã giftcode trong mục Mã Miễn Phí và Đợt Phát Code đều hoàn toàn miễn phí 100%, được tổng hợp và kiểm duyệt từ các Nhà phát hành game chính thức.</p>
              </div>
              <div class="p-4 rounded-xl bg-dark-900 border border-gray-800">
                <h3 class="font-bold text-gray-100 text-sm mb-2">2. Làm thế nào để sao chép mã code nhanh chóng?</h3>
                <p>Bạn chỉ cần nhấp vào nút Sao Chép bên cạnh mỗi mã giftcode hoặc chọn Sao Chép Toàn Bộ Mã Còn Hạn để lưu tất cả giftcode vào bộ nhớ tạm trong 1 giây.</p>
              </div>
              <div class="p-4 rounded-xl bg-dark-900 border border-gray-800">
                <h3 class="font-bold text-gray-100 text-sm mb-2">3. Các tựa game trên CodeGame.shop có hợp pháp không?</h3>
                <p>Hệ thống cập nhật thông tin pháp lý và giấy phép phê duyệt nội dung kịch bản trò chơi G1 được cấp bởi Cục PTTH&TTĐT cho từng game theo dữ liệu công khai.</p>
              </div>
            </div>
          </section>
        </main>

        <!-- Footer -->
        <footer class="mt-auto border-t border-gray-800/80 bg-dark-900/50 py-8 px-4 text-xs text-gray-400">
          <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 mb-6 text-left">
            <div class="md:col-span-2 space-y-2">
              <div class="flex items-center gap-2">
                <img src="/logo.webp" alt="CodeGame.shop" width="24" height="24" loading="lazy" decoding="async" class="w-6 h-6 rounded-md" />
                <span class="font-bold text-white text-sm">CodeGame.Shop</span>
              </div>
              <p class="text-gray-400 text-xs leading-relaxed">
                Kho tổng hợp hơn ${totalCodesFormatted}+ giftcode game mobile và webgame mới nhất 2026 của ${canonicalGamesCount} tựa game chuẩn. Cập nhật liên tục 24/7 từ các NPH VNG, Garena, VTC, SohaGame, Funtap.
              </p>
            </div>
            <div>
              <h4 class="font-bold text-white text-xs mb-2">Chuyên Mục Hot</h4>
              <ul class="space-y-1 text-[11px]">
                <li><a href="/danh-sach-game-a-z" class="text-brand-400 hover:underline">📚 Danh Mục Game A-Z (${canonicalGamesCount} Game)</a></li>
                <li><a href="/the-loai/kiem-hiep-tien-hiep" class="hover:text-white">⚔️ Kiếm Hiệp & Tiên Hiệp</a></li>
                <li><a href="/the-loai/nhap-vai-gacha-anime" class="hover:text-white">✨ Nhập Vai Gacha & Anime</a></li>
                <li><a href="/the-loai/ban-sung-sinh-ton" class="hover:text-white">🎯 Bắn Súng & Sinh Tồn</a></li>
                <li><a href="/the-loai/tam-quoc-chien-thuat" class="hover:text-white">🏰 Tam Quốc & Chiến Thuật</a></li>
                <li><a href="/the-loai/roblox-mini-game" class="hover:text-white">🎮 Roblox & Mini Game</a></li>
                <li><a href="/the-loai/nhap-vai-mmorpg" class="hover:text-white">🛡️ Nhập Vai (MMORPG)</a></li>
              </ul>
            </div>
            <div>
              <h4 class="font-bold text-white text-xs mb-2">Liên Kết Nhanh</h4>
              <ul class="space-y-1 text-[11px]">
                <li><a href="/" class="hover:text-white">Trang Chủ</a></li>
                <li><a href="/news" class="hover:text-white">Tin Tức Game</a></li>
                <li><a href="/giveaways" class="hover:text-white">Đợt Phát Code</a></li>
                <li><a href="/store" class="hover:text-white">Chợ Code VIP</a></li>
              </ul>
            </div>
          </div>
          <div class="pt-4 border-t border-gray-800/80 text-center text-[11px] text-gray-500">
            <p>© 2026 CodeGame.shop. Nền tảng chia sẻ giftcode cộng đồng & đối chiếu minh bạch Giấy phép G1 theo Cục PTTH&TTĐT (giayphep.abei.gov.vn).</p>
          </div>
        </footer>
      </div>
    `,
  });

  fs.writeFileSync(templatePath, homeHtml, 'utf8');
  console.log(`[Prerender] Đã xuất bản dist/index.html (Trang chủ hoàn chỉnh)`);

  // 2. Prerender News Page (dist/news/index.html)
  const newsDir = path.join(distDir, 'news');
  if (!fs.existsSync(newsDir)) fs.mkdirSync(newsDir, { recursive: true });

  const newsHtml = buildPageHtml({
    title: 'Tin Tức Game & Sự Kiện Giftcode Mới Nhất 2026 | CodeGame.shop',
    description: 'Tổng hợp tin tức làng game Việt, bản cập nhật mới nhất, sự kiện phát quà và danh sách giftcode game mobile, PC hot nhất 2026 cập nhật 24/7.',
    canonicalPath: '/news',
    ogType: 'website',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'NewsMediaOrganization',
        name: 'CodeGame.shop - Chuyên Mục Tin Tức',
        url: `${BASE_URL}/news`,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://codegame.shop/' },
          { '@type': 'ListItem', position: 2, name: 'Tin Tức Game', item: 'https://codegame.shop/news' },
        ],
      },
    ],
    bodyContent: `
      <div class="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <header class="site-header sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between">
          <a href="/" class="header-logo flex items-center gap-2 text-blue-500 font-extrabold text-base sm:text-lg">
            <img src="/logo.webp" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg object-cover" />
            <span class="text-white font-bold">CodeGame.Shop</span>
          </a>
          <nav class="header-nav-tabs hidden md:flex items-center space-x-3 sm:space-x-6 text-xs sm:text-sm font-bold text-slate-300">
            <a href="/" class="hover:text-blue-400 transition-colors">Tra Cứu Code</a>
            <a href="/news" class="text-blue-400 font-black">Tin Tức Game</a>
            <a href="/giveaways" class="hover:text-blue-400 transition-colors">Săn Giveaway</a>
            <a href="/store" class="hover:text-blue-400 transition-colors">Cửa Hàng</a>
          </nav>
        </header>
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div class="rounded-3xl border border-slate-800 p-6 sm:p-10 shadow-md bg-slate-900 text-center">
            <div class="inline-block px-3.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/30 mb-3">
              📰 Tin Tức & Sự Kiện Quà Tặng 24/7
            </div>
            <h1 class="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Điểm Tin Game & Danh Sách Giftcode Mới Nhất
            </h1>
            <p class="text-xs sm:text-sm text-slate-400 leading-relaxed font-medium mt-2 max-w-2xl mx-auto">
              Cập nhật thông tin các tựa game hot nhất, bản cập nhật mới, sự kiện khai mở máy chủ và mã quà tặng kèm theo độc quyền mỗi ngày.
            </p>
          </div>
        </main>
      </div>
    `,
  });

  fs.writeFileSync(path.join(newsDir, 'index.html'), newsHtml, 'utf8');
  console.log(`[Prerender] Đã xuất bản dist/news/index.html`);

  // 2.0.1. Prerender Game Events Page (dist/su-kien/index.html & dist/events/index.html)
  const eventsHtml = buildPageHtml({
    title: 'Sự Kiện Game Mới Nhất 2026 & Lịch Khuyến Mãi | CodeGame.shop',
    description: 'Tổng hợp sự kiện có thời hạn từ Fanpage, Group cộng đồng và Website chính thức của game. Tóm tắt nhanh cách tham gia, hạn nhận quà và link tham gia trực tiếp.',
    canonicalPath: '/su-kien',
    ogType: 'website',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Sự Kiện Game Mới Nhất 2026',
        description: 'Tổng hợp sự kiện game chính thức có thời hạn tại Việt Nam.',
        url: `${BASE_URL}/su-kien`,
      },
    ],
    bodyContent: `
      <div class="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
        <header class="site-header sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/85 backdrop-blur-md px-4 py-3 flex items-center justify-between">
          <a href="/" class="flex items-center gap-2 text-primary font-bold">
            <img src="/logo.webp" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg" />
            <span class="text-white">CodeGame.Shop</span>
          </a>
          <nav class="flex items-center gap-4 text-xs font-bold text-slate-300">
            <a href="/" class="hover:text-white">Trang Chủ</a>
            <a href="/news" class="hover:text-white">Tin Tức</a>
            <a href="/su-kien" class="text-amber-400 font-black">Sự Kiện Game</a>
            <a href="/giveaways" class="hover:text-white">Săn Giveaway</a>
          </nav>
        </header>
        <main class="max-w-7xl mx-auto px-4 py-8 space-y-6">
          <div class="rounded-3xl border border-amber-500/30 p-6 sm:p-10 bg-slate-900 text-center">
            <div class="inline-block px-3.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/30 mb-3">
              ⚡ SỰ KIỆN GAME & KHUYẾN MÃI NGOÀI GAME
            </div>
            <h1 class="text-2xl sm:text-4xl font-black text-white">Sự Kiện Game Mới Nhất 2026</h1>
            <p class="text-xs sm:text-sm text-slate-400 mt-2 max-w-2xl mx-auto">
              Tổng hợp sự kiện có thời hạn từ Fanpage, Group cộng đồng và Website chính thức của game.
            </p>
          </div>
        </main>
      </div>
    `,
  });

  const suKienDir = path.join(distDir, 'su-kien');
  if (!fs.existsSync(suKienDir)) fs.mkdirSync(suKienDir, { recursive: true });
  fs.writeFileSync(path.join(suKienDir, 'index.html'), eventsHtml, 'utf8');

  const eventsDir = path.join(distDir, 'events');
  if (!fs.existsSync(eventsDir)) fs.mkdirSync(eventsDir, { recursive: true });
  fs.writeFileSync(path.join(eventsDir, 'index.html'), eventsHtml, 'utf8');
  console.log(`[Prerender] Đã xuất bản dist/su-kien/index.html & dist/events/index.html`);

  // 2.0.2. Prerender Telegram Community Page (dist/telegram/index.html)
  const tgHtml = buildPageHtml({
    title: 'Cộng Đồng Telegram & Nhận Giftcode Tự Động | CodeGame.shop',
    description: 'Tham gia nhóm Telegram CodeGame.Shop để nhận Giftcode mới nhất, thông báo sự kiện hot và theo dõi mã quà tặng riêng tư tự động.',
    canonicalPath: '/telegram',
    ogType: 'website',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://codegame.shop/' },
          { '@type': 'ListItem', position: 2, name: 'Cộng Đồng Telegram', item: 'https://codegame.shop/telegram' },
        ],
      },
    ],
    bodyContent: `
      <div class="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <header class="site-header sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 py-3 flex items-center justify-between">
          <a href="/" class="flex items-center gap-2 text-primary font-bold">
            <img src="/logo.webp" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg" />
            <span class="text-white">CodeGame.Shop</span>
          </a>
          <nav class="flex items-center gap-4 text-xs font-bold text-slate-300">
            <a href="/" class="hover:text-white">Trang Chủ</a>
            <a href="/news" class="hover:text-white">Tin Tức</a>
            <a href="/su-kien" class="hover:text-white">Sự Kiện Game</a>
            <a href="/telegram" class="text-blue-400 font-black">Telegram</a>
          </nav>
        </header>
        <main class="max-w-4xl mx-auto px-4 py-12 text-center space-y-6">
          <div class="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/30">
            ✈️ KÊNH THÔNG BÁO & NHÓM THẢO LUẬN TELEGRAM
          </div>
          <h1 class="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Cộng Đồng CodeGame.Shop Trên Telegram
          </h1>
          <p class="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
            Nhận thông báo Giftcode mới nhất, theo dõi sự kiện game hot và trao đổi kinh nghiệm cùng hàng nghìn game thủ.
          </p>
        </main>
      </div>
    `,
  });

  const tgDir = path.join(distDir, 'telegram');
  if (!fs.existsSync(tgDir)) fs.mkdirSync(tgDir, { recursive: true });
  fs.writeFileSync(path.join(tgDir, 'index.html'), tgHtml, 'utf8');
  console.log(`[Prerender] Đã xuất bản dist/telegram/index.html`);

  // 2.0.2. Prerender Today Codes Page (/ma-hom-nay)
  const todayCodesHtml = buildPageHtml({
    title: 'Giftcode Hôm Nay - Tổng Hợp Mã Code Game Có Hạn Trong Ngày 2026 | CodeGame.shop',
    description: 'Danh sách giftcode game chỉ có hiệu lực hôm nay, hết hạn lúc 22:30 tối nay. Nhận trọn bộ mã code mới nhất, không bỏ lỡ quà tặng giới hạn.',
    canonicalPath: '/ma-hom-nay',
    ogType: 'website',
    bodyContent: `
      <div class="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <header class="site-header sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 py-3 flex items-center justify-between">
          <a href="/" class="flex items-center gap-2 text-primary font-bold">
            <img src="/logo.webp" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg" />
            <span class="text-white">CodeGame.Shop</span>
          </a>
          <nav class="flex items-center gap-4 text-xs font-bold text-slate-300">
            <a href="/" class="hover:text-white">Trang Chủ</a>
            <a href="/ma-hom-nay" class="text-amber-400 font-black">Mã Hôm Nay</a>
            <a href="/news" class="hover:text-white">Tin Tức</a>
            <a href="/su-kien" class="hover:text-white">Sự Kiện Game</a>
          </nav>
        </header>
        <main class="max-w-4xl mx-auto px-4 py-12 text-center space-y-6">
          <div class="inline-block px-4 py-1.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/30">
            🔥 MÃ QUÀ TẶNG HẠN NGÀY • CHỈ DÙNG HÔM NAY
          </div>
          <h1 class="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Giftcode Game Có Hạn Hôm Nay
          </h1>
          <p class="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
            Mã quà tặng sự kiện giới hạn chỉ có hiệu lực trong ngày hôm nay, tự động đóng lúc 22:30 tối nay. Hãy sao chép và nhập ngay vào game!
          </p>
        </main>
      </div>
    `,
  });

  const todayDir = path.join(distDir, 'ma-hom-nay');
  if (!fs.existsSync(todayDir)) fs.mkdirSync(todayDir, { recursive: true });
  fs.writeFileSync(path.join(todayDir, 'index.html'), todayCodesHtml, 'utf8');
  console.log(`[Prerender] Đã xuất bản dist/ma-hom-nay/index.html`);

  // 2.1. Prerender Individual News Articles
  if (newsArticles.length === 0) {
    try {
      const seedNewsMod = await import('../src/data/seedNews.ts');
      newsArticles = seedNewsMod.DEFAULT_NEWS_ARTICLES || [];
    } catch (err) {
      console.warn('[Prerender] Không thể nạp seedNews.ts:', err?.message);
    }
  }

  console.log(`[Prerender] Bắt đầu sinh HTML tĩnh cho ${newsArticles.length} bài viết tin tức...`);

  newsArticles.forEach((article) => {
    const artSlug = (article.slug || article.id || '').trim();
    if (!artSlug) return;

    const artDir = path.join(newsDir, artSlug);
    if (!fs.existsSync(artDir)) fs.mkdirSync(artDir, { recursive: true });

    const artTitle = `${article.title} | CodeGame.shop`;
    const artDesc = article.excerpt || (article.content || '').slice(0, 160).replace(/\n/g, ' ').trim();
    const artCover = article.cover_url || (article.game_slug ? `/game_icons/${article.game_slug}.webp` : '/og-image.jpg');
    const artCanonical = `/news/${artSlug}`;

    const articleHtml = buildPageHtml({
      title: artTitle,
      description: artDesc,
      canonicalPath: artCanonical,
      ogImage: artCover,
      ogType: 'article',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          headline: article.title,
          description: artDesc,
          image: [artCover.startsWith('http') ? artCover : `${BASE_URL}${artCover}`],
          datePublished: article.published_at || '2026-10-13T00:00:00.000Z',
          dateModified: article.updated_at || article.published_at || '2026-10-13T00:00:00.000Z',
          author: {
            '@type': 'Person',
            name: article.author || 'CodeGame Editorial',
          },
          publisher: {
            '@type': 'Organization',
            name: 'CodeGame.shop',
            logo: {
              '@type': 'ImageObject',
              url: `${BASE_URL}/logo.webp`,
            },
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `${BASE_URL}${artCanonical}`,
          },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${BASE_URL}/` },
            { '@type': 'ListItem', position: 2, name: 'Tin Tức Game', item: `${BASE_URL}/news` },
            { '@type': 'ListItem', position: 3, name: article.title, item: `${BASE_URL}${artCanonical}` },
          ],
        },
      ],
      bodyContent: `
        <div class="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
          <header class="site-header sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between">
            <a href="/" class="header-logo flex items-center gap-2 text-blue-500 font-extrabold text-base sm:text-lg">
              <img src="/logo.webp" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg object-cover" />
              <span class="text-white font-bold">CodeGame.Shop</span>
            </a>
            <nav class="header-nav-tabs hidden md:flex items-center space-x-3 sm:space-x-6 text-xs sm:text-sm font-bold text-slate-300">
              <a href="/" class="hover:text-blue-400 transition-colors">Tra Cứu Code</a>
              <a href="/news" class="text-blue-400 font-black">Tin Tức Game</a>
              <a href="/giveaways" class="hover:text-blue-400 transition-colors">Săn Giveaway</a>
              <a href="/store" class="hover:text-blue-400 transition-colors">Cửa Hàng</a>
            </nav>
          </header>

          <main class="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <nav class="flex items-center space-x-2 text-xs text-slate-400">
              <a href="/" class="hover:text-blue-400">Trang chủ</a>
              <span>/</span>
              <a href="/news" class="hover:text-blue-400">Tin tức game</a>
              <span>/</span>
              <span class="text-slate-200 truncate max-w-xs">${escapeHtml(article.title)}</span>
            </nav>

            <article class="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
              <div class="space-y-3">
                <div class="flex items-center gap-2 text-xs text-blue-400 font-bold">
                  <span>📰 TIN TỨC GAME</span>
                  ${article.game_name ? `<span>•</span><span>${escapeHtml(article.game_name)}</span>` : ''}
                </div>
                <h1 class="text-2xl sm:text-3xl font-black text-white leading-tight">
                  ${escapeHtml(article.title)}
                </h1>
                <div class="flex items-center gap-3 text-xs text-slate-400 border-b border-slate-800 pb-4">
                  <span>Đăng ngày: ${new Date(article.published_at || Date.now()).toLocaleDateString('vi-VN')}</span>
                  <span>•</span>
                  <span>Tác giả: ${escapeHtml(article.author || 'Ban Biên Tập CodeGame')}</span>
                  <span>•</span>
                  <span>${article.read_time_minutes || 3} phút đọc</span>
                </div>
              </div>

              ${artCover ? `
                <div class="rounded-2xl overflow-hidden bg-slate-950 aspect-[16/9] flex items-center justify-center">
                  <img src="${artCover}" alt="${escapeHtml(article.title)}" class="w-full h-full object-cover" />
                </div>
              ` : ''}

              <p class="text-sm sm:text-base text-slate-300 leading-relaxed font-medium italic bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                ${escapeHtml(article.excerpt || '')}
              </p>

              ${article.codes && article.codes.length > 0 ? `
                <div class="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                  <div class="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <span>🎁 Danh sách Giftcode đính kèm (${article.codes.length} mã)</span>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    ${article.codes.map((c) => `
                      <span class="font-mono text-xs sm:text-sm font-bold bg-amber-500/20 text-amber-300 px-3 py-1 rounded-lg border border-amber-500/30">
                        ${escapeHtml(c)}
                      </span>
                    `).join('')}
                  </div>
                </div>
              ` : ''}

              <div class="pt-6 border-t border-slate-800 flex justify-between items-center text-xs">
                <a href="/news" class="text-blue-400 font-bold hover:underline">← Xem tất cả bài viết tin tức</a>
                <a href="/" class="text-slate-400 hover:text-white">Tra cứu thêm 486+ game khác</a>
              </div>
            </article>
          </main>
        </div>
      `,
    });

    fs.writeFileSync(path.join(artDir, 'index.html'), articleHtml, 'utf8');
    fs.writeFileSync(path.join(newsDir, `${artSlug}.html`), articleHtml, 'utf8');
  });

  console.log(`[Prerender] Đã xuất bản thành công ${newsArticles.length} bài viết tin tức chi tiết!`);

  // 3. Prerender Giveaways Page (dist/giveaways/index.html)
  const giveawaysDir = path.join(distDir, 'giveaways');
  if (!fs.existsSync(giveawaysDir)) fs.mkdirSync(giveawaysDir, { recursive: true });

  const giveawaysHtml = buildPageHtml({
    title: 'Săn Code Phát & Giveaway Game Độc Quyền Miễn Phí | CodeGame.shop',
    description: 'Nhận giftcode giới hạn độc quyền miễn phí từ các đợt phát triên game thủ. Hệ thống kiểm tra điều kiện tài khoản tự động và phát mã tức thì.',
    canonicalPath: '/giveaways',
    ogType: 'website',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: 'Săn Code Phát & Giveaway Game Độc Quyền Miễn Phí',
        description: 'Nhận giftcode giới hạn độc quyền miễn phí từ các đợt phát triên game thủ. Hệ thống kiểm tra điều kiện tự động và phát mã ngay.',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
        location: { '@type': 'VirtualLocation', url: `${BASE_URL}/giveaways` },
        organizer: { '@type': 'Organization', name: 'CodeGame.shop', url: BASE_URL },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'VND', availability: 'https://schema.org/InStock', url: `${BASE_URL}/giveaways` },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://codegame.shop/' },
          { '@type': 'ListItem', position: 2, name: 'Đợt Phát Code', item: 'https://codegame.shop/giveaways' },
        ],
      },
    ],
    bodyContent: `
      <div class="min-h-screen flex flex-col bg-dark-950 text-[#431407]" style="background-color: var(--bg-sourcecode, #FFF3E0);">
        <header class="site-header sticky top-0 z-40 w-full border-b border-orange-200 bg-white/90 backdrop-blur-md px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between">
          <a href="/" class="header-logo flex items-center gap-2 text-orange-600 font-extrabold text-base sm:text-lg">
            <img src="/logo.webp" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg object-cover" />
            <span class="font-bold">CodeGame.Shop</span>
          </a>
          <nav class="header-nav-tabs hidden md:flex items-center space-x-3 sm:space-x-6 text-xs sm:text-sm font-bold text-amber-900">
            <a href="/" class="hover:text-orange-600 transition-colors">Mã Miễn Phí</a>
            <a href="/giveaways" class="text-orange-600 font-black">Đợt Phát Code</a>
            <a href="/store" class="hover:text-orange-600 transition-colors">Chợ Code VIP</a>
          </nav>
        </header>

        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div class="rounded-3xl border border-orange-200 p-6 sm:p-10 shadow-md bg-gradient-to-b from-[#ffe8cc] to-[#fff3e0]">
            <div class="inline-block px-3.5 py-1 rounded-full bg-orange-800/10 text-orange-950 text-xs font-bold border border-orange-600/30 mb-3">
              🎁 Đợt Phát Code Riêng Miễn Phí
            </div>
            <h1 class="text-2xl sm:text-4xl font-black text-amber-950 tracking-tight">
              Nhận Giftcode Giới Hạn <span class="text-orange-700">Có Điều Kiện</span>
            </h1>
            <p class="text-xs sm:text-sm text-amber-900/80 leading-relaxed font-medium mt-2 max-w-2xl">
              Các gói giftcode độc quyền do Ban Quản Trị phát tặng tri ân game thủ. Hoàn toàn miễn phí, hệ thống tự động kiểm tra điều kiện tài khoản và phát mã tức thì cho người hợp lệ!
            </p>
          </div>
        </main>
      </div>
    `,
  });

  fs.writeFileSync(path.join(giveawaysDir, 'index.html'), giveawaysHtml, 'utf8');
  console.log(`[Prerender] Đã xuất bản dist/giveaways/index.html`);

  // 2.5. Prerender Individual Giveaway Detail Pages (dist/giveaways/:id/index.html)
  let giveawaysList = [];
  try {
    const gwPath = fs.existsSync(path.resolve(__dirname, '../public/data/giveaways.json'))
      ? path.resolve(__dirname, '../public/data/giveaways.json')
      : path.resolve(__dirname, '../src/data/giveaways.json');
    giveawaysList = JSON.parse(fs.readFileSync(gwPath, 'utf8'));
  } catch (err) {
    console.warn('[Prerender] Không thể nạp giveaways.json:', err?.message);
  }

  console.log(`[Prerender] Bắt đầu sinh HTML tĩnh cho ${giveawaysList.length} sự kiện Giveaway...`);

  for (const gw of giveawaysList) {
    if (!gw || !gw.id) continue;
    const gwId = gw.id;
    const gwDetailDir = path.join(giveawaysDir, gwId);
    if (!fs.existsSync(gwDetailDir)) fs.mkdirSync(gwDetailDir, { recursive: true });

    const gameSlug = gw.game_slug || '';
    const gameName = gw.game_name || 'Game Mobile';

    // Thuật toán xác định ảnh đại diện chính xác 100% cho Giveaway
    let rawImage = gw.cover_image_url || gw.game_icon_url || '';
    if (!rawImage && gameSlug) {
      const matched = games.find((g) => g && (g.slug?.toLowerCase() === gameSlug.toLowerCase() || g.id?.toLowerCase() === gameSlug.toLowerCase()));
      if (matched?.icon_url) {
        rawImage = matched.icon_url;
      } else {
        rawImage = `/game_icons/${gameSlug}.jpg`;
      }
    }
    if (!rawImage) rawImage = '/og-image.jpg';
    const jpgImage = rawImage.replace(/\.webp$/i, '.jpg');
    const ogGameIcon = jpgImage.startsWith('http') ? jpgImage : `${BASE_URL}${jpgImage.startsWith('/') ? jpgImage : `/${jpgImage}`}`;

    const gwTitle = `🎁 Nhận Code: ${gw.title} - ${gameName} | CodeGame.shop`;
    const gwDesc = gw.description
      ? `${gw.description} Nhận mã quà tặng độc quyền ${gameName} miễn phí tại CodeGame.shop.`
      : `Nhận ngay ${gw.title} cho tựa game ${gameName}. Số lượng có hạn, kiểm tra điều kiện tài khoản và nhận mã tức thì!`;

    const gwHtml = buildPageHtml({
      title: gwTitle,
      description: gwDesc,
      canonicalPath: `/giveaways/${encodeURIComponent(gwId)}`,
      ogImage: ogGameIcon,
      ogType: 'article',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Event',
          name: `Săn Mã: ${gw.title} - ${gameName}`,
          description: gwDesc,
          image: ogGameIcon,
          startDate: gw.start_time || '2026-01-01',
          endDate: gw.end_time || '2026-12-31',
          eventStatus: 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
          location: { '@type': 'VirtualLocation', url: `${BASE_URL}/giveaways/${encodeURIComponent(gwId)}` },
          organizer: { '@type': 'Organization', name: 'CodeGame.shop', url: BASE_URL },
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'VND', availability: 'https://schema.org/InStock', url: `${BASE_URL}/giveaways/${encodeURIComponent(gwId)}` },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://codegame.shop/' },
            { '@type': 'ListItem', position: 2, name: 'Đợt Phát Code', item: 'https://codegame.shop/giveaways' },
            { '@type': 'ListItem', position: 3, name: gameName, item: `${BASE_URL}/giveaways/${encodeURIComponent(gwId)}` },
          ],
        },
      ],
      bodyContent: `
        <div class="min-h-screen flex flex-col bg-dark-950 text-[#431407]" style="background-color: var(--bg-sourcecode, #FFF3E0);">
          <header class="site-header sticky top-0 z-40 w-full border-b border-orange-200 bg-white/90 backdrop-blur-md px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between">
            <a href="/" class="header-logo flex items-center gap-2 text-orange-600 font-extrabold text-base sm:text-lg">
              <img src="/logo.webp" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg object-cover" />
              <span class="font-bold">CodeGame.Shop</span>
            </a>
            <nav class="header-nav-tabs hidden md:flex items-center space-x-3 sm:space-x-6 text-xs sm:text-sm font-bold text-amber-900">
              <a href="/" class="hover:text-orange-600 transition-colors">Mã Miễn Phí</a>
              <a href="/giveaways" class="text-orange-600 font-black">Đợt Phát Code</a>
              <a href="/store" class="hover:text-orange-600 transition-colors">Chợ Code VIP</a>
            </nav>
          </header>

          <main class="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <div class="rounded-3xl border border-orange-200 p-6 sm:p-8 shadow-md bg-white flex flex-col sm:flex-row items-center gap-6">
              <img src="${ogGameIcon}" alt="${escapeHtml(gameName)}" class="w-24 h-24 rounded-2xl object-cover shadow-md border border-orange-100" />
              <div class="flex-1 text-center sm:text-left">
                <div class="inline-block px-3 py-0.5 rounded-full bg-orange-100 text-orange-800 text-xs font-bold mb-2">
                  🎁 Sự Kiện Phát Mã Quà Tặng
                </div>
                <h1 class="text-xl sm:text-2xl font-black text-amber-950">
                  ${escapeHtml(gw.title)} - ${escapeHtml(gameName)}
                </h1>
                <p class="text-xs sm:text-sm text-amber-900/80 mt-1.5 font-medium leading-relaxed">
                  ${escapeHtml(gw.description || 'Tham gia nhận mã quà tặng độc quyền hoàn toàn miễn phí.')}
                </p>
                <div class="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                  <a href="/giveaways#gw=${encodeURIComponent(gwId)}" class="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-md transition-all">
                    👉 Vào Nhận Mã Ngay
                  </a>
                </div>
              </div>
            </div>
          </main>
        </div>
      `,
    });

    fs.writeFileSync(path.join(gwDetailDir, 'index.html'), gwHtml, 'utf8');
  }
  console.log(`[Prerender] Đã xuất bản hoàn tất ${giveawaysList.length} trang chi tiết sự kiện Giveaway!`);

  // 3. Prerender Store Page (dist/store/index.html)
  const storeDir = path.join(distDir, 'store');
  if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });

  const storeHtml = buildPageHtml({
    title: 'Cửa Hàng Giftcode VIP & Giao Dịch Mã Game Tự Động 24/7 | CodeGame.shop',
    description: 'Mua bán giftcode VIP, gói nạp game bản quyền chiết khấu tới 40%. Giao dịch tự động 24/7 qua SePay, nhận mã ngay trên màn hình trong 30 giây.',
    canonicalPath: '/store',
    ogType: 'website',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Store',
        name: 'Chợ Code VIP - CodeGame.shop',
        description: 'Cửa hàng giao dịch mã game bản quyền và giftcode VIP tự động 24/7 qua SePay.',
        url: `${BASE_URL}/store`,
        priceRange: '10.000 VND - 500.000 VND',
        paymentAccepted: 'Chuyển khoản Ngân hàng (SePay), Ví điện tử',
        currenciesAccepted: 'VND',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://codegame.shop/' },
          { '@type': 'ListItem', position: 2, name: 'Chợ Code VIP', item: 'https://codegame.shop/store' },
        ],
      },
    ],
    bodyContent: `
      <div class="min-h-screen flex flex-col bg-[var(--bg-market,#E3F2FD)] text-[#082f49]">
        <header class="site-header sticky top-0 z-40 w-full border-b border-sky-200 bg-white/90 backdrop-blur-md px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between">
          <a href="/" class="header-logo flex items-center gap-2 text-sky-600 font-extrabold text-base sm:text-lg">
            <img src="/logo.webp" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg object-cover" />
            <span class="font-bold">CodeGame.Shop</span>
          </a>
          <nav class="header-nav-tabs hidden md:flex items-center space-x-3 sm:space-x-6 text-xs sm:text-sm font-bold text-sky-950">
            <a href="/" class="hover:text-sky-600 transition-colors">Mã Miễn Phí</a>
            <a href="/giveaways" class="hover:text-sky-600 transition-colors">Đợt Phát Code</a>
            <a href="/store" class="text-sky-600 font-black">Chợ Code VIP</a>
          </nav>
        </header>

        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div class="rounded-3xl border border-sky-200 p-6 sm:p-10 shadow-md bg-gradient-to-b from-[#d2ebfd] to-[#e3f2fd] text-center">
            <div class="inline-block px-3.5 py-1 rounded-full bg-white border border-sky-300 text-sky-900 text-xs font-bold mb-3">
              💎 Mã Code Bản Quyền Chiết Khấu Đến 40%
            </div>
            <h1 class="text-3xl sm:text-5xl font-black tracking-tight text-sky-950">
              Cửa Hàng Giftcode VIP & Tự Động
            </h1>
            <p class="text-sm sm:text-base text-sky-900/80 max-w-xl mx-auto font-medium mt-2">
              Giao dịch hoàn toàn tự động qua chuyển khoản ngân hàng (SePay). Mã quà tặng được trả về ngay trên màn hình trong 30 giây.
            </p>
          </div>
        </main>
      </div>
    `,
  });

  fs.writeFileSync(path.join(storeDir, 'index.html'), storeHtml, 'utf8');
  console.log(`[Prerender] Đã xuất bản dist/store/index.html`);

  // 3.5. Prerender Admin Page (dist/admin/index.html)
  const adminDir = path.join(distDir, 'admin');
  if (!fs.existsSync(adminDir)) fs.mkdirSync(adminDir, { recursive: true });

  const adminHtml = buildPageHtml({
    title: 'Quản Trị Hệ Thống | CodeGame.shop',
    description: 'Bảng điều khiển quản trị hệ thống CodeGame.shop.',
    canonicalPath: '/admin',
    noindex: true,
    bodyContent: `
      <div class="min-h-screen flex items-center justify-center bg-dark-950 text-gray-100">
        <div class="flex flex-col items-center space-y-3">
          <div class="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-xs font-semibold text-gray-400">Đang khởi tạo trang quản trị...</span>
        </div>
      </div>
    `,
  });

  fs.writeFileSync(path.join(adminDir, 'index.html'), adminHtml, 'utf8');
  console.log(`[Prerender] Đã xuất bản dist/admin/index.html`);

  // 3.6. Prerender Missions Page (dist/nhiem-vu/index.html & dist/missions/index.html)
  const missionsDir = path.join(distDir, 'nhiem-vu');
  if (!fs.existsSync(missionsDir)) fs.mkdirSync(missionsDir, { recursive: true });
  const missionsEnDir = path.join(distDir, 'missions');
  if (!fs.existsSync(missionsEnDir)) fs.mkdirSync(missionsEnDir, { recursive: true });

  const missionsHtml = buildPageHtml({
    title: 'Nhiệm Vụ Nhận Quà & Tiền Ví Miễn Phí 2026 | CodeGame.shop',
    description: 'Tham gia làm nhiệm vụ chia sẻ bài viết, lan tỏa cộng đồng để nhận ngay Giftcode độc quyền và số dư ví mua sắm miễn phí trên sàn CodeGame.Shop.',
    canonicalPath: '/nhiem-vu',
    ogType: 'website',
    bodyContent: `
      <div class="min-h-screen flex flex-col bg-slate-900 text-white">
        <header class="site-header sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 py-3 flex items-center justify-between">
          <a href="/" class="header-logo flex items-center gap-2 text-primary font-bold text-lg">
            <img src="/logo.webp" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg object-cover" />
            <span>CodeGame.Shop</span>
          </a>
          <nav class="hidden md:flex items-center space-x-6 text-sm font-semibold">
            <a href="/" class="hover:text-primary transition-colors">Tra Code</a>
            <a href="/news" class="hover:text-primary transition-colors">Tin Tức</a>
            <a href="/giveaways" class="hover:text-primary transition-colors">Giveaway</a>
            <a href="/store" class="hover:text-primary transition-colors">Cửa Hàng</a>
            <a href="/utilities" class="hover:text-primary transition-colors">Tiện Ích</a>
            <a href="/nhiem-vu" class="text-primary font-bold">Nhiệm Vụ</a>
          </nav>
        </header>
        <main class="max-w-6xl mx-auto px-4 py-12 text-center space-y-4">
          <div class="inline-block px-3 py-1 rounded-full bg-primary/20 text-primary-light text-xs font-bold uppercase">
            Hệ Thống Nhiệm Vụ & Nhận Quà
          </div>
          <h1 class="text-3xl sm:text-5xl font-black text-white">
            Làm Nhiệm Vụ — Nhận Mã Code & Tiền Ví Miễn Phí
          </h1>
          <p class="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
            Chia sẻ bài viết, lan tỏa cộng đồng game thủ để nhận ngay những mã Giftcode độc quyền và số dư ví mua sắm không giới hạn trên sàn.
          </p>
        </main>
      </div>
    `,
  });

  fs.writeFileSync(path.join(missionsDir, 'index.html'), missionsHtml, 'utf8');
  fs.writeFileSync(path.join(missionsEnDir, 'index.html'), missionsHtml, 'utf8');
  console.log(`[Prerender] Đã xuất bản dist/nhiem-vu/index.html & dist/missions/index.html`);

  // 4. Prerender all 189 Game Detail Pages (dist/game/${slug}/index.html)
  for (const game of games) {
    const slug = game.slug || game.id;
    const gameDir = path.join(distDir, 'game', slug);
    if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });

    // Filter codes for this game with exact matching consistent with functions/api/games.ts
    const normSlug = String(slug).toLowerCase().trim();
    const cleanWithoutMobile = normSlug.replace(/-mobile$/i, '');
    const cleanId = String(game.id || '').toLowerCase().trim();
    const exactKeys = new Set([
      normSlug,
      cleanWithoutMobile,
      cleanId,
      cleanId.replace(/-mobile$/i, ''),
      ...(normSlug === 'huyen-thoai-hai-tac' || normSlug === 'pirate-legends' ? ['huyen-thoai-hai-tac', 'pirate-legends'] : []),
      ...(normSlug === 'yen-van-thap-luc-thanh' || normSlug === 'where-winds-meet-mobile' ? ['yen-van-thap-luc-thanh', 'where-winds-meet-mobile'] : []),
    ]);

    const seenCodeVals = new Set();
    const gameCodes = [];
    for (const c of crawledCodes) {
      if (!c) continue;
      const cSlug = String(c.gameSlug || c.slug || c.gameId || '').toLowerCase().trim();
      const cName = String(c.gameName || '').toLowerCase().trim();
      const gName = String(game.name || '').toLowerCase().trim();
      const isMatch = exactKeys.has(cSlug) || (cName && gName && cName === gName);
      if (isMatch) {
        const val = String(c.codeValue || c.code_value || c.code || '').trim().toUpperCase();
        if (val && !seenCodeVals.has(val)) {
          seenCodeVals.add(val);
          gameCodes.push(c);
        }
      }
    }

    const activeCodes = gameCodes.filter((c) => !isCodeExpired(c));
    const displayCodes = activeCodes;

    // Calculate authentic lastmod / update date
    let maxTime = 0;
    if (game.updated_at) {
      const t = new Date(game.updated_at).getTime();
      if (!isNaN(t)) maxTime = Math.max(maxTime, t);
    }
    if (game.created_at) {
      const t = new Date(game.created_at).getTime();
      if (!isNaN(t)) maxTime = Math.max(maxTime, t);
    }
    for (const c of gameCodes) {
      if (c.added_at) {
        const t = new Date(c.added_at).getTime();
        if (!isNaN(t)) maxTime = Math.max(maxTime, t);
      }
    }
    if (maxTime === 0) {
      maxTime = new Date('2026-10-26T12:00:00Z').getTime();
    }
    const dateObj = new Date(maxTime);
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    const formattedDate = `${dd}/${mm}/${yyyy}`;
    const lastmodIso = dateObj.toISOString();
    const clusterSlug = getClusterSlug(game.category);

    const rawImg = game.cover_image_url || game.icon_url || `/game_icons/${slug}.jpg`;
    const jpgImg = rawImg.replace(/\.webp$/i, '.jpg');
    const ogCoverImg = jpgImg.startsWith('http') ? jpgImg : `${BASE_URL}${jpgImg.startsWith('/') ? jpgImg : `/${jpgImg}`}`;
    const coverImg = game.cover_image_url || game.icon_url || `${BASE_URL}/game_icons/${slug}.webp`;
    const isWwm = slug === 'where-winds-meet' || slug === 'where-winds-meet-mobile' || slug === 'yen-van-thap-luc-thanh';
    const codeCount = displayCodes.length;
    const countSuffix = codeCount > 0
      ? ` - Nhận ${codeCount} Mã Code`
      : ` - Hướng Dẫn Nhập & Nhận Quà`;
    const title = `Giftcode ${game.name} Mới Nhất 2026${countSuffix} | CodeGame.shop`;
    const hasVerifiedLicense = Boolean(
      game.so_giay_phep &&
      game.co_quan_cap &&
      game.ngay_cap_phep &&
      game.publisher
    );
    const licenseSuffix = hasVerifiedLicense
      ? ` Bản quyền G1 số ${game.so_giay_phep} cấp ngày ${game.ngay_cap_phep}.`
      : '';
    const description = codeCount > 0
      ? `Tổng hợp ${codeCount} mã giftcode ${game.name} còn hạn mới nhất 2026. Hướng dẫn nhập code chi tiết và nhận quà tân thủ miễn phí.${licenseSuffix}`
      : `Hướng dẫn nhập code ${game.name} chi tiết và cập nhật các đợt phát quà tặng tân thủ mới nhất 2026 từ ${game.publisher || 'NPH'}.${licenseSuffix}`;

    const canonicalSlug = GAME_CANONICAL_ALIASES[slug] || slug;

    // Compute related games for Internal Linking Spider Matrix
    const relatedGames = games
      .filter((g) => (g.slug || g.id) !== slug && (g.category === game.category || g.publisher === game.publisher))
      .slice(0, 6);
    const displayRelated = relatedGames.length >= 4
      ? relatedGames
      : games.filter((g) => (g.slug || g.id) !== slug).slice(0, 6);

    const gameHtml = buildPageHtml({
      title,
      description,
      canonicalPath: `/game/${encodeURIComponent(canonicalSlug)}`,
      ogImage: ogCoverImg,
      ogType: 'article',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'VideoGame',
          name: game.name,
          description: game.description || description,
          genre: game.category || 'Nhập Vai',
          gamePlatform: 'Android, iOS, PC',
          author: {
            '@type': 'Organization',
            name: game.publisher || 'Nhà phát hành Việt Nam',
          },
          image: coverImg,
          dateModified: lastmodIso,
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'VND',
            availability: 'https://schema.org/InStock',
          },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${BASE_URL}/` },
            { '@type': 'ListItem', position: 2, name: 'Tra Cứu Giftcode', item: `${BASE_URL}/` },
            { '@type': 'ListItem', position: 3, name: game.name, item: `${BASE_URL}/game/${encodeURIComponent(canonicalSlug)}` },
          ],
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: `Giftcode ${game.name} có hạn sử dụng không?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: `Các mã giftcode ${game.name} có thời hạn tùy thuộc vào sự kiện của ${game.publisher || 'Nhà phát hành'}. Bạn nên nhập ngay khi lấy mã để tránh hết hạn hoặc hết lượt kích hoạt.`,
              },
            },
            {
              '@type': 'Question',
              name: `Làm sao để nhận thêm mã code ${game.name} mới nhất 2026?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: `CodeGame.shop tự động theo dõi và cập nhật giftcode ${game.name} 24/7 từ các sự kiện bảo trì, ra mắt máy chủ và fanpage chính thức của ${game.publisher || 'NPH'}.`,
              },
            },
          ],
        },
        {
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: `Cách nhập Giftcode ${game.name} nhận quà tân thủ`,
          description: `Hướng dẫn từng bước cách nhập mã giftcode ${game.name} thành công 100% để nhận Kim Cương, KNB và quà VIP.`,
          image: coverImg,
          step: parseHowToSteps(game.instructions, game.name),
        },
      ],
      bodyContent: (() => {
        const isG1 = (game.trang_thai_gp && /G1\b/i.test(game.trang_thai_gp)) || /(QĐ|QD)-(BTTTT|PTTH&TTĐT|BVHTTDL)/i.test(game.so_giay_phep || '');
        return `
        <div class="min-h-screen flex flex-col bg-dark-950 text-gray-100">
          <header class="site-header sticky top-0 z-40 w-full border-b border-gray-800/80 bg-dark-950/85 backdrop-blur-md px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between">
            <a href="/" class="header-logo flex items-center gap-2 text-brand-400 font-extrabold text-base sm:text-lg">
              <img src="/logo.webp" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg object-cover" />
              <span class="text-white font-bold">CodeGame.Shop</span>
            </a>
            <nav class="header-nav-tabs hidden md:flex items-center space-x-3 sm:space-x-6 text-xs sm:text-sm font-bold text-gray-300">
              <a href="/" class="text-brand-400 font-black">Mã Miễn Phí</a>
              <a href="/giveaways" class="hover:text-white transition-colors">Đợt Phát Code</a>
              <a href="/store" class="hover:text-white transition-colors">Chợ Code VIP</a>
            </nav>
          </header>

          <main class="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <div class="flex items-center space-x-4 p-5 rounded-3xl bg-dark-900 border border-gray-800 shadow-xl">
              <img src="${escapeHtml(coverImg)}" alt="${escapeHtml(game.name)}" class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-gray-700">
              <div>
                <div class="flex items-center gap-1.5 flex-wrap mb-1">
                  <a href="/the-loai/${clusterSlug}" class="inline-block px-2.5 py-0.5 rounded-full bg-brand-500/10 hover:bg-brand-500/25 text-brand-400 hover:text-brand-300 text-[11px] font-bold border border-brand-500/20 transition-all">
                    ${escapeHtml(game.category || 'Game Mobile')}
                  </a>
                  ${
                    isG1
                      ? `<span class="inline-block px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/40">✓ Đã xác minh (G1)</span>`
                      : `<span class="inline-block px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 text-[11px] font-bold border border-cyan-500/30">🌐 Quốc Tế</span>`
                  }
                </div>
                <h1 class="text-xl sm:text-3xl font-black text-white">${escapeHtml(game.name)}</h1>
                <p class="text-xs sm:text-sm text-gray-400 font-semibold mt-0.5">${escapeHtml(game.publisher || 'NPH Chính Thức VN')}</p>
                <div class="mt-2 text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                  <span>📅 Cập nhật: ${formattedDate} (Kiểm tra thực tế)</span>
                </div>
              </div>
            </div>

            ${
              isG1
                ? `<!-- License Box (G1) -->
            <div class="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-xs sm:text-sm text-emerald-200 space-y-1">
              <div class="font-bold text-emerald-400 text-sm mb-1">📜 Thông Tin Pháp Lý & Giấy Phép G1 (Đã Xác Minh):</div>
              <div>• <strong>Số giấy phép:</strong> ${escapeHtml(game.so_giay_phep || game.license_number || 'Đã cấp phép G1')}</div>
              <div>• <strong>Ngày cấp phép:</strong> ${escapeHtml(game.ngay_cap_phep || game.license_date || game.release_date || '2026')}</div>
              <div>• <strong>Nhà phát hành:</strong> ${escapeHtml(game.publisher || 'NPH Chính Thức VN')}</div>
              <div>• <strong>Nguồn đối chiếu:</strong> Cục PTTH&TTĐT (giayphep.abei.gov.vn)</div>
            </div>`
                : `<!-- International Box -->
            <div class="p-4 rounded-2xl bg-slate-900/60 border border-cyan-500/30 text-xs sm:text-sm text-cyan-200 space-y-1">
              <div class="font-bold text-cyan-400 text-sm mb-1">🌐 Tựa Game Quốc Tế (Phát Hành Toàn Cầu):</div>
              <div>• <strong>Định danh / Bản quyền:</strong> Phiên bản phát hành quốc tế</div>
              <div>• <strong>Nhà phát hành / Studio:</strong> ${escapeHtml(game.publisher || 'Quốc Tế')}</div>
              <div>• <strong>Trạng thái:</strong> Phát hành toàn cầu & Cập nhật giftcode tự động</div>
            </div>`
            }

            ${(() => {
              const playUrl = game.google_play_url || game.download_android;
              const iosUrl = game.app_store_url || game.download_ios;
              if (!playUrl && !iosUrl) return '';
              return `
            <!-- Download Section (Pre-rendered for SEO & no-JS) -->
            <div class="p-5 rounded-2xl bg-dark-900 border border-gray-800 space-y-3">
              <h2 class="text-base sm:text-lg font-bold text-white flex items-center justify-between">
                <span>📲 Tải Game Chính Thức</span>
                <span class="text-xs text-emerald-400 font-semibold">Official Store</span>
              </h2>
              <div class="flex items-center gap-3 flex-wrap">
                ${playUrl ? `<a href="${escapeHtml(playUrl)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md">Tải trên CH Play</a>` : ''}
                ${iosUrl ? `<a href="${escapeHtml(iosUrl)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm shadow-md">Tải trên App Store</a>` : ''}
              </div>
              <p class="text-xs text-gray-400">Nếu CH Play/App Store báo &quot;không có ở quốc gia của bạn&quot;, đó là giới hạn vùng theo tài khoản của bạn — link tải vẫn đúng. Hãy thử tài khoản thuộc vùng game đã phát hành.</p>
            </div>`;
            })()}

            <!-- Codes List -->
            <div class="p-5 rounded-2xl bg-dark-900 border border-gray-800 space-y-3">
              <h2 class="text-base sm:text-lg font-bold text-white flex items-center justify-between">
                <span>🎁 Danh Sách Giftcode ${escapeHtml(game.name)} Còn Hạn</span>
                <span class="text-xs text-brand-400 font-semibold">${displayCodes.length} mã khả dụng</span>
              </h2>

              <div class="space-y-2">
                ${
                  displayCodes.length > 0
                    ? displayCodes
                        .map((c) => {
                          const val = escapeHtml(c.codeValue || c.code_value || c.code);
                          const rew = c.rewards ? `🎁 ${escapeHtml(c.rewards)}` : `🎁 Chưa rõ phần thưởng`;
                          const exp = (c.expiresAt || c.expires_at || c.expiry || '').trim();
                          const isDummyExp = exp.includes('2026-12-31') || exp.includes('31/12/2026');
                          const expText = exp && !isDummyExp ? `⏱️ HSD: ${escapeHtml(exp)}` : `⏱️ HSD: Chưa rõ hạn dùng`;
                          return `
                  <div class="flex items-center justify-between p-3 rounded-xl bg-dark-850 border border-gray-800">
                    <div>
                      <code class="font-mono font-bold text-brand-400 text-sm sm:text-base">${val}</code>
                      <div class="text-xs text-gray-400 mt-0.5">${rew} • ${expText}</div>
                    </div>
                    <span class="text-xs px-2.5 py-1 rounded-lg bg-brand-600/20 text-brand-400 border border-brand-500/30 font-bold">Mới nhất</span>
                  </div>`;
                        })
                        .join('')
                    : `
                  <div class="p-6 rounded-2xl bg-dark-850/80 border border-gray-800 text-center space-y-2">
                    <div class="text-2xl">⏳</div>
                    <h3 class="text-sm sm:text-base font-bold text-gray-200">Hiện Chưa Có Mã Giftcode Mới Cho ${escapeHtml(game.name)}</h3>
                    <p class="text-xs text-gray-400 max-w-lg mx-auto leading-relaxed">
                      Hệ thống CodeGame.shop đang tự động theo dõi và kiểm tra mã quà tặng mới từ nhà phát hành ${escapeHtml(game.publisher || 'chính thức')} 24/7.
                      <br>📅 <strong>Kiểm tra lần cuối:</strong> ${formattedDate} (Chưa phát sinh mã mới).
                    </p>
                    <p class="text-xs text-brand-400 font-semibold pt-1">
                      👉 Bạn có thể xem hướng dẫn nhập code bên dưới hoặc khám phá các tựa game cùng thể loại đang có mã khả dụng!
                    </p>
                  </div>`
                }
              </div>
            </div>

            <!-- Instructions -->
            ${
              game.instructions && game.instructions.trim().length > 0
                ? `
            <div class="p-5 rounded-2xl bg-dark-900 border border-gray-800 space-y-2">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <h2 class="text-base sm:text-lg font-bold text-white">📖 Hướng Dẫn Nhập Code ${escapeHtml(game.name)}</h2>
                ${game.redeem_url ? `<a href="${escapeHtml(game.redeem_url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all">🌐 Mở Trang Đổi Code</a>` : ''}
              </div>
              <div class="text-xs sm:text-sm text-gray-300 whitespace-pre-line leading-relaxed">${escapeHtml(game.instructions.trim())}</div>
            </div>`
                : ''
            }

            <!-- Description -->
            ${
              game.description
                ? `
            <div class="p-5 rounded-2xl bg-dark-900 border border-gray-800 space-y-2">
              <h2 class="text-base sm:text-lg font-bold text-white">ℹ️ Giới Thiệu Trò Chơi</h2>
              <p class="text-xs sm:text-sm text-gray-300 leading-relaxed">${escapeHtml(game.description)}</p>
            </div>`
                : ''
            }

            <!-- Game-Specific FAQ matching FAQPage Schema -->
            <section class="p-5 rounded-2xl bg-dark-900 border border-gray-800 space-y-4">
              <h2 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>❓ Câu Hỏi Thường Gặp Về Giftcode ${escapeHtml(game.name)}</span>
              </h2>
              <div class="space-y-3 text-xs sm:text-sm text-gray-300">
                <div class="p-4 rounded-xl bg-dark-850 border border-gray-800/80">
                  <h3 class="font-bold text-gray-100 mb-1">1. Giftcode ${escapeHtml(game.name)} có hạn sử dụng không?</h3>
                  <p class="text-gray-400 leading-relaxed">Các mã giftcode ${escapeHtml(game.name)} có thời hạn tùy thuộc vào từng sự kiện của ${escapeHtml(game.publisher || 'Nhà phát hành')}. Bạn nên nhập ngay khi lấy mã để tránh hết hạn hoặc hết lượt kích hoạt.</p>
                </div>
                <div class="p-4 rounded-xl bg-dark-850 border border-gray-800/80">
                  <h3 class="font-bold text-gray-100 mb-1">2. Làm sao để nhận thêm mã code ${escapeHtml(game.name)} mới nhất 2026?</h3>
                  <p class="text-gray-400 leading-relaxed">Hệ thống CodeGame.shop tự động theo dõi và cập nhật mã mới 24/7 từ các sự kiện bảo trì, ra mắt máy chủ và fanpage chính thức của ${escapeHtml(game.publisher || 'NPH')}. Hãy lưu trang này để nhận thông báo sớm nhất.</p>
                </div>
              </div>
            </section>

            <!-- Related Games Matrix (Deep Crawl Spider) -->
            <section class="p-5 rounded-2xl bg-dark-900 border border-gray-800 space-y-3">
              <h2 class="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
                <span>🎮 Tựa Game Cùng Thể Loại & NPH Đang Có Giftcode</span>
              </h2>
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                ${displayRelated
                  .map(
                    (rg) => `
                  <a href="/game/${escapeHtml(rg.slug || rg.id)}" class="flex flex-col bg-dark-850 hover:bg-dark-800 p-2.5 rounded-xl border border-gray-800 hover:border-brand-500/40 transition-all text-left group">
                    <img src="/game_icons/${escapeHtml(rg.slug || rg.id)}-thumb.webp" srcset="/game_icons/${escapeHtml(rg.slug || rg.id)}-thumb.webp 1x, /game_icons/${escapeHtml(rg.slug || rg.id)}-thumb-256.webp 2x" alt="${escapeHtml(rg.name)}" loading="lazy" class="w-full aspect-square rounded-lg object-cover mb-2 border border-gray-700/60">
                    <h3 class="font-bold text-xs text-gray-200 group-hover:text-brand-400 line-clamp-1">${escapeHtml(rg.name)}</h3>
                    <span class="text-[10px] text-gray-400 truncate mt-0.5">${escapeHtml(rg.publisher || 'NPH Việt Nam')}</span>
                  </a>`
                  )
                  .join('')}
              </div>
            </section>

            <div class="text-center pt-4">
              <a href="/" class="inline-block px-6 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold transition-all">
                ← Quay Lại Danh Sách Game
              </a>
            </div>
          </main>

          <footer class="mt-auto border-t border-gray-800/80 bg-dark-900/50 py-8 px-4 text-xs text-gray-400">
            <div class="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
              <p>© 2026 CodeGame.shop. Cập nhật mã ${escapeHtml(game.name)}.</p>
              <div class="flex items-center gap-3 text-xs">
                <a href="/danh-sach-game-a-z" class="text-brand-400 hover:underline">Danh Mục A-Z</a>
                <span>•</span>
                <a href="/the-loai/${clusterSlug}" class="text-gray-300 hover:text-white">${escapeHtml(game.category || 'Thể loại')}</a>
                <span>•</span>
                <a href="/" class="hover:text-white">Trang Chủ</a>
              </div>
            </div>
          </footer>
        </div>
      `;
      })(),
    });

    fs.writeFileSync(path.join(gameDir, 'index.html'), gameHtml, 'utf8');
    fs.writeFileSync(path.join(distDir, 'game', `${slug}.html`), gameHtml, 'utf8');
  }

  // Dọn dẹp dist/g/ nếu còn tồn tại để Edge Worker xử lý 301 chuẩn hóa
  const legacyGDir = path.join(distDir, 'g');
  if (fs.existsSync(legacyGDir)) {
    fs.rmSync(legacyGDir, { recursive: true, force: true });
  }

  console.log(`[Prerender] Đã xuất bản hoàn tất ${games.length} trang chi tiết tựa game chuẩn SEO!`);

  // 5. Prerender 404 Page (dist/404.html)
  const notFoundHtml = buildPageHtml({
    title: '404 - Không Tìm Thấy Trang | CodeGame.shop',
    description: 'Trang bạn đang tìm kiếm không tồn tại trên CodeGame.shop.',
    canonicalPath: '/404',
    noindex: true,
    bodyContent: `
      <div class="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-dark-950 text-gray-100">
        <h1 class="text-4xl sm:text-6xl font-black text-brand-400 mb-2">404</h1>
        <h2 class="text-xl sm:text-2xl font-bold text-white mb-4">Không Tìm Thấy Trang</h2>
        <p class="text-gray-400 text-sm max-w-md mb-6">Nội dung bạn đang tìm kiếm không tồn tại hoặc đã thay đổi địa chỉ.</p>
        <a href="/" class="px-6 py-3 rounded-2xl bg-brand-600 text-white font-bold text-sm hover:bg-brand-500 transition-all">
          Về Trang Chủ CodeGame.shop
        </a>
      </div>
    `,
  });

  fs.writeFileSync(path.join(distDir, '404.html'), notFoundHtml, 'utf8');
  console.log(`[Prerender] Đã xuất bản dist/404.html`);

  // 4.5. Prerender Topic Cluster Pages (/the-loai/:slug)
  const theLoaiDir = path.join(distDir, 'the-loai');
  if (!fs.existsSync(theLoaiDir)) fs.mkdirSync(theLoaiDir, { recursive: true });

  for (const cluster of TOPIC_CLUSTERS) {
    const clusterDir = path.join(theLoaiDir, cluster.slug);
    if (!fs.existsSync(clusterDir)) fs.mkdirSync(clusterDir, { recursive: true });

    const clusterGames = games.filter((g) => cluster.match(g.category || ''));
    const clusterTitle = `Giftcode Game ${cluster.name} Mới Nhất 2026 - Nhận Mã Quà Tặng | CodeGame.shop`;
    const clusterDesc = `Tổng hợp giftcode mới nhất 2026 của ${clusterGames.length}+ tựa game ${cluster.name}. Mã code còn hạn, hướng dẫn nhập chi tiết và thông tin bản quyền G1.`;

    const clusterHtml = buildPageHtml({
      title: clusterTitle,
      description: clusterDesc,
      canonicalPath: `/the-loai/${cluster.slug}`,
      ogImage: 'https://codegame.shop/og-image.jpg',
      ogType: 'website',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: clusterTitle,
          description: clusterDesc,
          url: `${BASE_URL}/the-loai/${cluster.slug}`,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${BASE_URL}/` },
            { '@type': 'ListItem', position: 2, name: 'Thể Loại Game', item: `${BASE_URL}/danh-sach-game-a-z` },
            { '@type': 'ListItem', position: 3, name: cluster.name, item: `${BASE_URL}/the-loai/${cluster.slug}` },
          ],
        },
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListElement: clusterGames.slice(0, 30).map((g, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            name: g.name,
            url: `${BASE_URL}/game/${g.slug || g.id}`,
          })),
        },
      ],
      bodyContent: `
        <div class="min-h-screen flex flex-col bg-dark-950 text-gray-100 font-sans">
          <header class="site-header sticky top-0 z-40 w-full border-b border-gray-800/80 bg-dark-950/85 backdrop-blur-md px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between">
            <a href="/" class="header-logo flex items-center gap-2 text-brand-400 font-extrabold text-base sm:text-lg">
              <img src="/logo.webp" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg object-cover" />
              <span class="text-white font-bold">CodeGame.Shop</span>
            </a>
            <nav class="header-nav-tabs hidden md:flex items-center space-x-3 sm:space-x-6 text-xs sm:text-sm font-bold text-gray-300">
              <a href="/" class="hover:text-white transition-colors">Trang Chủ</a>
              <a href="/danh-sach-game-a-z" class="hover:text-white transition-colors">Danh Mục A-Z</a>
              <a href="/the-loai/${cluster.slug}" class="text-brand-400 font-black">Chuyên Mục</a>
              <a href="/giveaways" class="hover:text-white transition-colors">Đợt Phát Code</a>
            </nav>
          </header>

          <main class="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
            <!-- Breadcrumbs -->
            <nav class="flex items-center gap-2 text-xs text-gray-400">
              <a href="/" class="hover:text-brand-400">Trang chủ</a>
              <span>/</span>
              <a href="/danh-sach-game-a-z" class="hover:text-brand-400">Thể loại</a>
              <span>/</span>
              <span class="text-white">${escapeHtml(cluster.name)}</span>
            </nav>

            <!-- Hero Header -->
            <div class="p-6 sm:p-10 rounded-3xl bg-gradient-to-br from-dark-900 via-dark-850 to-dark-900 border border-gray-800 text-center space-y-4">
              <div class="inline-block px-3.5 py-1 rounded-full bg-brand-500/10 text-brand-400 text-xs font-bold border border-brand-500/30">
                ${escapeHtml(cluster.badge)}
              </div>
              <h1 class="text-2xl sm:text-4xl font-black text-white">
                Giftcode Game ${escapeHtml(cluster.name)} Mới Nhất 2026
              </h1>
              <p class="text-xs sm:text-sm text-gray-300 max-w-2xl mx-auto leading-relaxed">
                ${escapeHtml(cluster.description)} Tổng hợp ${clusterGames.length}+ tựa game có bản quyền và phát hành chính thức.
              </p>

              <!-- Topic Clusters Filter Pills -->
              <div class="pt-4 flex flex-wrap items-center justify-center gap-2">
                ${TOPIC_CLUSTERS.map((c) => `
                  <a href="/the-loai/${c.slug}" class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${c.slug === cluster.slug ? 'bg-brand-600 text-white shadow-md' : 'bg-dark-800 text-gray-300 hover:bg-dark-750 hover:text-white border border-gray-700/60'}">
                    ${escapeHtml(c.name)}
                  </a>
                `).join('')}
                <a href="/danh-sach-game-a-z" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-dark-800 text-brand-400 hover:bg-dark-750 border border-brand-500/30 transition-all">
                  Toàn bộ A-Z →
                </a>
              </div>
            </div>

            <!-- Games Grid -->
            <section class="space-y-4">
              <div class="flex items-center justify-between">
                <h2 class="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <span>🎮 Danh Sách ${clusterGames.length} Game ${escapeHtml(cluster.name)}</span>
                </h2>
                <span class="text-xs text-gray-400">Sắp xếp theo độ hot</span>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                ${clusterGames.map((g) => {
                  const gSlug = g.slug || g.id;
                  const gCover = g.cover_image_url || g.icon_url || `/game_icons/${gSlug}.webp`;
                  const gCodes = (g.codes_count || g.total_codes_count || g.free_codes_count || 0);
                  return `
                  <a href="/game/${escapeHtml(gSlug)}" class="flex flex-col bg-dark-900 hover:bg-dark-850 p-3 rounded-2xl border border-gray-800 hover:border-brand-500/50 transition-all group">
                    <img src="${escapeHtml(gCover)}" alt="${escapeHtml(g.name)}" loading="lazy" class="w-full aspect-square rounded-xl object-cover mb-2 border border-gray-700/60 group-hover:scale-105 transition-transform" />
                    <h3 class="font-bold text-xs text-gray-100 group-hover:text-brand-400 line-clamp-1">${escapeHtml(g.name)}</h3>
                    <span class="text-[10px] text-gray-400 truncate mt-0.5">${escapeHtml(g.publisher || 'NPH Chính Thức')}</span>
                    <div class="mt-2 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md self-start border border-emerald-500/30">
                      🎁 ${gCodes > 0 ? `${gCodes} Mã Code` : 'Hướng Dẫn Code'}
                    </div>
                  </a>`;
                }).join('')}
              </div>
            </section>

            <!-- Topic Cluster Genre FAQ -->
            <section class="p-6 rounded-2xl bg-dark-900 border border-gray-800 space-y-4">
              <h2 class="text-base sm:text-lg font-bold text-white">
                ❓ Câu Hỏi Thường Gặp Về Game ${escapeHtml(cluster.name)}
              </h2>
              <div class="space-y-3 text-xs sm:text-sm text-gray-300">
                <div class="p-4 rounded-xl bg-dark-850 border border-gray-800/80">
                  <h3 class="font-bold text-gray-100 mb-1">Giftcode dòng game ${escapeHtml(cluster.name)} gồm những gì?</h3>
                  <p class="text-gray-400">Thông thường mã code mang lại tài nguyên cày cuốc như Vé Quay Gacha, Kim Cương, KNB, Thể Lực và Trang Bị cao cấp dành riêng cho tân thủ.</p>
                </div>
                <div class="p-4 rounded-xl bg-dark-850 border border-gray-800/80">
                  <h3 class="font-bold text-gray-100 mb-1">Bao lâu thì có giftcode mới?</h3>
                  <p class="text-gray-400">Nhà phát hành thường tung giftcode vào các dịp bảo trì máy chủ hàng tuần, sự kiện mừng phiên bản mới hoặc các mốc người chơi đạt thưởng lớn.</p>
                </div>
              </div>
            </section>
          </main>

          <footer class="mt-auto border-t border-gray-800/80 bg-dark-900/50 py-8 px-4 text-xs text-gray-400">
            <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
              <p>© 2026 CodeGame.shop. Chuyên mục game ${escapeHtml(cluster.name)}.</p>
              <div class="flex items-center gap-3 text-xs">
                <a href="/danh-sach-game-a-z" class="text-brand-400 hover:underline">Danh Mục A-Z</a>
                <span>•</span>
                <a href="/" class="hover:text-white">Trang Chủ</a>
              </div>
            </div>
          </footer>
        </div>
      `,
    });

    fs.writeFileSync(path.join(clusterDir, 'index.html'), clusterHtml, 'utf8');
    fs.writeFileSync(path.join(theLoaiDir, `${cluster.slug}.html`), clusterHtml, 'utf8');
  }
  console.log(`[Prerender] Đã xuất bản hoàn tất ${TOPIC_CLUSTERS.length} trang chuyên mục thể loại (/the-loai/)!`);

  // 4.6. Prerender A-Z Game Directory (/danh-sach-game-a-z)
  const azDir = path.join(distDir, 'danh-sach-game-a-z');
  if (!fs.existsSync(azDir)) fs.mkdirSync(azDir, { recursive: true });

  const sortedGames = [...games].filter(g => !GAME_CANONICAL_ALIASES[g.slug || g.id]).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
  const alphabetMap = new Map();

  for (const g of sortedGames) {
    const firstChar = (g.name || '').trim().charAt(0).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
    if (!alphabetMap.has(letter)) alphabetMap.set(letter, []);
    alphabetMap.get(letter).push(g);
  }

  const lettersList = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')].filter((l) => alphabetMap.has(l));

  const azHtml = buildPageHtml({
    title: 'Danh Sách Tựa Game A-Z & Tra Cứu Giftcode Toàn Diện | CodeGame.shop',
    description: `Tra cứu danh bạ toàn bộ ${sortedGames.length} tựa game mobile và webgame theo bảng chữ cái A-Z. Cập nhật giftcode còn hạn, hướng dẫn nhập và bản quyền G1.`,
    canonicalPath: '/danh-sach-game-a-z',
    ogImage: 'https://codegame.shop/og-image.jpg',
    ogType: 'website',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Danh Sách Tựa Game A-Z - CodeGame.shop',
        description: `Danh bạ ${sortedGames.length} tựa game cập nhật giftcode mới nhất 2026.`,
        url: `${BASE_URL}/danh-sach-game-a-z`,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Danh Sách Game A-Z', item: `${BASE_URL}/danh-sach-game-a-z` },
        ],
      },
    ],
    bodyContent: `
      <div class="min-h-screen flex flex-col bg-dark-950 text-gray-100 font-sans">
        <header class="site-header sticky top-0 z-40 w-full border-b border-gray-800/80 bg-dark-950/85 backdrop-blur-md px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between">
          <a href="/" class="header-logo flex items-center gap-2 text-brand-400 font-extrabold text-base sm:text-lg">
            <img src="/logo.webp" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg object-cover" />
            <span class="text-white font-bold">CodeGame.Shop</span>
          </a>
          <nav class="header-nav-tabs hidden md:flex items-center space-x-3 sm:space-x-6 text-xs sm:text-sm font-bold text-gray-300">
            <a href="/" class="hover:text-white transition-colors">Trang Chủ</a>
            <a href="/danh-sach-game-a-z" class="text-brand-400 font-black">Danh Mục A-Z</a>
            <a href="/giveaways" class="hover:text-white transition-colors">Đợt Phát Code</a>
            <a href="/store" class="hover:text-white transition-colors">Chợ Code VIP</a>
          </nav>
        </header>

        <style>
          .az-sec{margin-bottom:24px;scroll-margin-top:90px}
          .az-head{font-size:14px;font-weight:700;color:#f3f4f6;border-bottom:1px solid #1f2937;padding-bottom:6px;margin-bottom:8px;display:flex;align-items:center;gap:6px}
          .az-head i{font-style:normal;font-size:11px;color:#9ca3af;font-weight:400}
          .az-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px}
          .az-c{display:flex;align-items:center;gap:8px;padding:5px 8px;background:#111827;border:1px solid #1f2937;border-radius:8px;text-decoration:none;min-width:0}
          .az-c:hover{border-color:#3b82f6;background:#182234}
          .az-c img{width:32px;height:32px;border-radius:6px;object-fit:cover;flex-shrink:0}
          .az-c div{min-width:0;flex:1}
          .az-c b{font-size:11px;font-weight:700;color:#f3f4f6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
          .az-c span{font-size:9px;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
        </style>

        <main class="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          <div class="p-6 sm:p-10 rounded-3xl bg-dark-900 border border-gray-800 text-center space-y-4">
            <div class="inline-block px-3.5 py-1 rounded-full bg-brand-500/10 text-brand-400 text-xs font-bold border border-brand-500/30">
              📚 Thư Viện Tra Cứu Game Toàn Diện
            </div>
            <h1 class="text-2xl sm:text-4xl font-black text-white">
              Danh Mục ${sortedGames.length} Tựa Game Theo Bảng Chữ Cái (A - Z)
            </h1>
            <p class="text-xs sm:text-sm text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Dễ dàng tra cứu thông tin giftcode, hướng dẫn nhập quà và số giấy phép G1 ABEI của tất cả các tựa game đang phát hành tại Việt Nam và quốc tế.
            </p>

            <!-- Alphabet Quick Anchor Jump -->
            <div class="pt-2 flex flex-wrap items-center justify-center gap-1.5 max-w-3xl mx-auto">
              ${lettersList.map((l) => `
                <a href="#letter-${l === '#' ? 'num' : l}" class="w-8 h-8 rounded-lg bg-dark-800 hover:bg-brand-600 hover:text-white text-xs font-bold flex items-center justify-center transition-all border border-gray-700/60">
                  ${l}
                </a>
              `).join('')}
            </div>
          </div>

          <!-- Grouped Sections -->
          <div>
            ${lettersList.map((letter) => {
              const groupGames = alphabetMap.get(letter) || [];
              const anchorId = letter === '#' ? 'letter-num' : `letter-${letter}`;
              return `
              <section id="${anchorId}" class="az-sec">
                <h2 class="az-head">Ký tự ${letter} <i>(${groupGames.length} game)</i></h2>
                <div class="az-grid">
                  ${groupGames.map((g) => {
                    const gSlug = escapeHtml(g.slug || g.id);
                    return `<a href="/game/${gSlug}" class="az-c"><img src="/game_icons/${gSlug}-thumb.webp" srcset="/game_icons/${gSlug}-thumb.webp 1x, /game_icons/${gSlug}-thumb-256.webp 2x" alt="${escapeHtml(g.name)}" width="32" height="32" loading="lazy"><div><b>${escapeHtml(g.name)}</b><span>${escapeHtml(g.category || 'Game Mobile')}</span></div></a>`;
                  }).join('')}
                </div>
              </section>`;
            }).join('')}
          </div>
        </main>

        <footer class="mt-auto border-t border-gray-800/80 bg-dark-900/50 py-8 px-4 text-xs text-gray-400">
          <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <p>© 2026 CodeGame.shop. Toàn bộ ${games.length}+ tựa game A-Z.</p>
            <div class="flex items-center gap-3 text-xs">
              <a href="#letter-${lettersList[0] === '#' ? 'num' : lettersList[0]}" class="text-brand-400 hover:underline">↑ Lên đầu trang</a>
              <span>•</span>
              <a href="/" class="hover:text-white">Trang Chủ</a>
            </div>
          </div>
        </footer>
      </div>
    `,
  });

  fs.writeFileSync(path.join(azDir, 'index.html'), azHtml, 'utf8');
  fs.writeFileSync(path.join(distDir, 'danh-sach-game-a-z.html'), azHtml, 'utf8');
  console.log(`[Prerender] Đã xuất bản trang Mục Lục Toàn Bộ Game A-Z (/danh-sach-game-a-z)!`);

  // 5. Generate Dynamic Sitemap.xml with 100% Canonical Games, News, and Giveaways
  const todayStr = new Date().toISOString().slice(0, 10);

  // Pre-index max code timestamps for authentic O(1) lastmod calculation
  const maxCodeTimeBySlug = new Map();
  let latestGlobalCodeTime = 0;
  for (const c of crawledCodes) {
    if (!c) continue;
    const cSlug = String(c.gameSlug || c.slug || c.gameId || '').toLowerCase().trim();
    const rawDate = c.added_at || c.added || c.updated_at || c.updatedAt || c.created_at || c.createdAt;
    if (rawDate) {
      const t = new Date(rawDate).getTime();
      if (!isNaN(t)) {
        if (t > latestGlobalCodeTime) latestGlobalCodeTime = t;
        const cur = maxCodeTimeBySlug.get(cSlug) || 0;
        if (t > cur) maxCodeTimeBySlug.set(cSlug, t);
      }
    }
  }

  let latestNewsTime = 0;
  newsArticles.forEach((a) => {
    const t = new Date(a.updated_at || a.published_at || a.created_at || '2026-10-13').getTime();
    if (!isNaN(t) && t > latestNewsTime) latestNewsTime = t;
  });

  let latestGwTime = 0;
  giveawaysList.forEach((gw) => {
    const t = new Date(gw.updated_at || gw.start_time || gw.created_at || '2026-10-25').getTime();
    if (!isNaN(t) && t > latestGwTime) latestGwTime = t;
  });

  const homeLastmod = latestGlobalCodeTime > 0 ? new Date(latestGlobalCodeTime).toISOString().slice(0, 10) : todayStr;
  const newsLastmod = latestNewsTime > 0 ? new Date(latestNewsTime).toISOString().slice(0, 10) : todayStr;
  const gwLastmod = latestGwTime > 0 ? new Date(latestGwTime).toISOString().slice(0, 10) : todayStr;

  const sitemapUrls = [
    { loc: `${BASE_URL}/`, priority: '1.0', changefreq: 'daily', lastmod: homeLastmod },
    { loc: `${BASE_URL}/danh-sach-game-a-z`, priority: '0.9', changefreq: 'daily', lastmod: todayStr },
    { loc: `${BASE_URL}/news/`, priority: '0.9', changefreq: 'daily', lastmod: newsLastmod },
    { loc: `${BASE_URL}/su-kien`, priority: '0.9', changefreq: 'daily', lastmod: todayStr },
    { loc: `${BASE_URL}/giveaways`, priority: '0.9', changefreq: 'daily', lastmod: gwLastmod },
    { loc: `${BASE_URL}/store`, priority: '0.9', changefreq: 'daily', lastmod: '2026-11-06' },
    { loc: `${BASE_URL}/utilities`, priority: '0.9', changefreq: 'daily', lastmod: '2026-10-27' },
  ];

  // Add all Topic Clusters to sitemap
  TOPIC_CLUSTERS.forEach((c) => {
    let maxClusterTime = 0;
    games.forEach((g) => {
      if (c.match(g.category || '')) {
        const slug = g.slug || g.id;
        const normSlug = String(slug).toLowerCase().trim();
        const cleanWithoutMobile = normSlug.replace(/-mobile$/i, '');
        const cleanId = String(g.id || '').toLowerCase().trim();
        const codeTime = Math.max(
          maxCodeTimeBySlug.get(normSlug) || 0,
          maxCodeTimeBySlug.get(cleanWithoutMobile) || 0,
          maxCodeTimeBySlug.get(cleanId) || 0
        );
        let gTime = codeTime;
        if (g.updated_at) {
          const t = new Date(g.updated_at).getTime();
          if (!isNaN(t) && t > gTime) gTime = t;
        }
        if (g.created_at) {
          const t = new Date(g.created_at).getTime();
          if (!isNaN(t) && t > gTime) gTime = t;
        }
        if (gTime > maxClusterTime) maxClusterTime = gTime;
      }
    });

    const clusterLastmod = maxClusterTime > 0
      ? new Date(maxClusterTime).toISOString().slice(0, 10)
      : todayStr;

    sitemapUrls.push({
      loc: `${BASE_URL}/the-loai/${c.slug}`,
      priority: '0.85',
      changefreq: 'daily',
      lastmod: clusterLastmod > todayStr ? todayStr : clusterLastmod,
    });
  });

  // Add all canonical games (Excluding alias duplicates, preserving 0-code genuine ABEI games)
  games.forEach((g) => {
    const slug = g.slug || g.id;
    if (!slug || GAME_CANONICAL_ALIASES[slug]) {
      // Bỏ qua các slug bí danh để chỉ giữ duy nhất URL chuẩn trong sitemap
      return;
    }

    let maxTime = 0;
    if (g.updated_at) {
      const t = new Date(g.updated_at).getTime();
      if (!isNaN(t)) maxTime = Math.max(maxTime, t);
    }
    if (g.created_at) {
      const t = new Date(g.created_at).getTime();
      if (!isNaN(t)) maxTime = Math.max(maxTime, t);
    }

    const normSlug = String(slug).toLowerCase().trim();
    const cleanWithoutMobile = normSlug.replace(/-mobile$/i, '');
    const cleanId = String(g.id || '').toLowerCase().trim();

    const isWwm = normSlug === 'yen-van-thap-luc-thanh' || normSlug === 'where-winds-meet' || normSlug === 'where-winds-meet-mobile';
    const isTienNghich = normSlug === 'tien-nghich' || normSlug === 'tien-nghich-mobile';
    const isKiemDe = normSlug === 'kiem-de' || normSlug === 'kiem-de-origin';
    const isDttl = normSlug === 'dau-truong-chan-ly' || normSlug === 'dau-truong-chan-ly-mobile';
    const isSds = normSlug === 'the-seven-deadly-sins-grand-cross' || normSlug === 'seven-deadly-sins-grand-cross';
    const isTqht = normSlug === 'tam-quoc-huyen-tuong-vng' || normSlug === 'tam-quoc-huyen-tuong';
    const isWukong = normSlug === 'x-wukong' || normSlug === 'x-wukong-dai-chien-tam-gioi';
    const isHkht = normSlug === 'pirate-legends' || normSlug === 'huyen-thoai-hai-tac';
    const isHnk = normSlug === 'ta-la-hac-ngo-khong' || normSlug === 'ta-la-hac-ngo-khong-vplay';

    const codeTime = Math.max(
      maxCodeTimeBySlug.get(normSlug) || 0,
      maxCodeTimeBySlug.get(cleanWithoutMobile) || 0,
      maxCodeTimeBySlug.get(cleanId) || 0,
      isWwm ? (maxCodeTimeBySlug.get('where-winds-meet-mobile') || maxCodeTimeBySlug.get('yen-van-thap-luc-thanh') || maxCodeTimeBySlug.get('where-winds-meet') || 0) : 0,
      isTienNghich ? (maxCodeTimeBySlug.get('tien-nghich-mobile') || maxCodeTimeBySlug.get('tien-nghich') || 0) : 0,
      isKiemDe ? (maxCodeTimeBySlug.get('kiem-de-origin') || maxCodeTimeBySlug.get('kiem-de') || 0) : 0,
      isDttl ? (maxCodeTimeBySlug.get('dau-truong-chan-ly-mobile') || maxCodeTimeBySlug.get('dau-truong-chan-ly') || 0) : 0,
      isSds ? (maxCodeTimeBySlug.get('seven-deadly-sins-grand-cross') || maxCodeTimeBySlug.get('the-seven-deadly-sins-grand-cross') || 0) : 0,
      isTqht ? (maxCodeTimeBySlug.get('tam-quoc-huyen-tuong') || maxCodeTimeBySlug.get('tam-quoc-huyen-tuong-vng') || 0) : 0,
      isWukong ? (maxCodeTimeBySlug.get('x-wukong-dai-chien-tam-gioi') || maxCodeTimeBySlug.get('x-wukong') || 0) : 0,
      isHkht ? (maxCodeTimeBySlug.get('huyen-thoai-hai-tac') || maxCodeTimeBySlug.get('pirate-legends') || 0) : 0,
      isHnk ? (maxCodeTimeBySlug.get('ta-la-hac-ngo-khong-vplay') || maxCodeTimeBySlug.get('ta-la-hac-ngo-khong') || 0) : 0
    );
    if (codeTime > 0) maxTime = Math.max(maxTime, codeTime);

    const lastmodDate = maxTime > 0
      ? new Date(maxTime).toISOString().slice(0, 10)
      : '2026-10-22';

    sitemapUrls.push({
      loc: `${BASE_URL}/game/${encodeURIComponent(slug)}`,
      priority: '0.8',
      changefreq: 'weekly',
      lastmod: lastmodDate,
    });
  });

  // Add all news articles with authentic lastmod
  newsArticles.forEach((a) => {
    const slug = a.slug || a.id;
    if (slug) {
      const artDate = (a.updated_at || a.published_at || a.created_at)
        ? new Date(a.updated_at || a.published_at || a.created_at).toISOString().slice(0, 10)
        : '2026-10-13';
      sitemapUrls.push({
        loc: `${BASE_URL}/news/${encodeURIComponent(slug)}`,
        priority: '0.8',
        changefreq: 'weekly',
        lastmod: artDate,
      });
    }
  });

  // Add all giveaways with authentic lastmod
  giveawaysList.forEach((gw) => {
    if (gw && gw.id) {
      const gwDate = (gw.updated_at || gw.start_time || gw.created_at)
        ? new Date(gw.updated_at || gw.start_time || gw.created_at).toISOString().slice(0, 10)
        : '2026-10-25';
      sitemapUrls.push({
        loc: `${BASE_URL}/giveaways/${encodeURIComponent(gw.id)}`,
        priority: '0.8',
        changefreq: 'daily',
        lastmod: gwDate,
      });
    }
  });

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf8');
  const publicDir = path.resolve(__dirname, '../public');
  if (fs.existsSync(publicDir)) {
    fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapXml, 'utf8');
  }
  console.log(`[Prerender] Đã xuất bản sitemap.xml với ${sitemapUrls.length} liên kết chuẩn SEO!`);

  console.log('[Prerender] TẤT CẢ 100% CÁC TRANG ĐÃ ĐƯỢC PRERENDER THÀNH CÔNG!');
}

runPrerender().catch((err) => {
  console.error('[Prerender] Lỗi:', err);
  process.exit(1);
});
