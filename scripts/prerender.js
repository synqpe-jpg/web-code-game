import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://codegame.shop';

function escapeHtml(unsafe = '') {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="512">
    <meta property="og:image:height" content="512">
    <meta property="og:image:alt" content="${escapeHtml(title)}">
    <meta property="og:locale" content="vi_VN">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(fullOgImage)}">

    <!-- JSON-LD Structured Data -->
    ${schemas.map((s) => `<script type="application/ld+json">\n${JSON.stringify(s, null, 2)}\n</script>`).join('\n')}
`;

    // Replace <title> and meta tags in template
    let html = templateHtml;
    html = html.replace(/<title>[\s\S]*?<\/title>/i, '');
    html = html.replace(/<meta\s+name="description"[\s\S]*?>/i, '');
    html = html.replace(/<link\s+rel="canonical"[\s\S]*?>/i, '');
    html = html.replace(/<meta\s+name="robots"[\s\S]*?>/i, '');
    html = html.replace(/<meta\s+property="og:[\s\S]*?>/gi, '');
    html = html.replace(/<meta\s+name="twitter:[\s\S]*?>/gi, '');

    html = html.replace('</head>', `${headInjections}\n</head>`);

    // Extract all scripts from templateHtml (Vite JS bundles, module scripts) to preserve hydration
    const scriptMatches = templateHtml.match(/<script[\s\S]*?<\/script>/gi) || [];
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

  // 1. Prerender Homepage (dist/index.html)
  const homeTopGames = games.slice(0, 60);
  const homeHtml = buildPageHtml({
    title: 'CodeGame.shop - Săn Giftcode Miễn Phí & Giao Dịch Mã Game Uy Tín',
    description: 'Kho tổng hợp hơn 3.400+ giftcode game mobile và webgame bản quyền G1 mới nhất 2026. Cập nhật liên tục 24/7 từ các NPH VNG, Garena, VTC, SohaGame, Funtap.',
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
        logo: 'https://codegame.shop/game_icons/anh-hung-tien-len.webp',
        description: 'Cổng thông tin chia sẻ giftcode game bản quyền G1 và giao dịch mã tự động.',
        sameAs: [
          'https://www.facebook.com/codegame.shop',
          'https://t.me/codegame_shop',
          'https://www.tiktok.com/@codegame.shop',
          'https://youtube.com/@codegame.shop',
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
              text: 'Toàn bộ 188+ tựa game trên hệ thống đều có số Giấy phép phê duyệt nội dung kịch bản trò chơi G1 được cấp bởi Cục PTTH&TTĐT (Bộ Thông tin & Truyền thông).',
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
        <!-- Announcement Bar -->
        <div class="bg-gradient-to-r from-brand-600 via-emerald-600 to-teal-600 py-2 px-4 text-center text-xs font-bold text-white shadow-sm">
          🔥 Chào mừng đến với CodeGame.shop • Tra cứu và nhận mã giftcode miễn phí mới nhất.
        </div>

        <!-- Navbar Header -->
        <header class="site-header sticky top-0 z-40 w-full border-b border-gray-800/80 bg-[#0B0D19]/95 backdrop-blur-md px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between">
          <a href="/" class="header-logo flex items-center gap-2 text-brand-400 font-extrabold text-base sm:text-lg">
            <img src="/logo.png" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg object-cover" />
            <span class="text-white font-bold">CodeGame.Shop</span>
          </a>
          <nav class="header-nav-tabs hidden md:flex items-center space-x-3 sm:space-x-6 text-xs sm:text-sm font-bold text-gray-300">
            <a href="/" class="text-brand-400 font-black">Mã Miễn Phí</a>
            <a href="/giveaways" class="hover:text-white transition-colors">Đợt Phát Code</a>
            <a href="/store" class="hover:text-white transition-colors">Chợ Code VIP</a>
          </nav>
        </header>

        <!-- Hero Section -->
        <section class="critical-hero-banner py-6 sm:py-10 px-4 sm:px-6 lg:px-8 text-center bg-[#0e1222] text-gray-100 border-b border-gray-800/80">
          <div class="max-w-4xl mx-auto space-y-3">
            <div class="inline-block px-3 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/30">
              ✨ Cập nhật liên tục 24/7 từ các Nhà phát hành Game
            </div>
            <h1 class="text-xl sm:text-3xl md:text-4xl font-black tracking-tight text-white">
              Kho Giftcode Game Mobile & Webgame Bản Quyền G1 Mới Nhất 2026
            </h1>
            <p class="text-xs sm:text-sm text-gray-400 max-w-2xl mx-auto font-normal">
              Tìm kiếm và nhận mã thưởng game mới nhất. Đối chiếu minh bạch Giấy phép G1 từ Cục PTTH&TTĐT.
            </p>
          </div>
        </section>

        <!-- Main Catalog Container -->
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div class="p-4 rounded-2xl bg-emerald-900/10 border border-emerald-500/20 text-xs text-emerald-300 mb-8">
            <strong>Thông Tin Pháp Lý & Giấy Phép G1:</strong> Toàn bộ 188+ trò chơi được đối chiếu minh bạch từ Cục Phát thanh, Truyền hình và Thông tin điện tử (giayphep.abei.gov.vn).
          </div>

          <h2 class="text-lg sm:text-xl font-black text-white mb-5 flex items-center space-x-2">
            <span>Danh Sách 188+ Tựa Game Bản Quyền Có Giftcode Hoạt Động</span>
          </h2>

          <div class="critical-cards-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-4">
            ${homeTopGames
              .map(
                (g) => `
              <a href="/game/${escapeHtml(g.slug)}" class="critical-card-item flex flex-col justify-between bg-[#11162B] hover:bg-[#161D36] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-gray-800/80 hover:border-emerald-500/40 transition-all text-left group">
                <div>
                  <div class="flex items-start justify-between gap-1 mb-2">
                    <img src="${escapeHtml(g.icon_url || `/game_icons/${g.slug}.webp`)}" alt="${escapeHtml(g.name)}" width="48" height="48" loading="lazy" decoding="async" class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover border border-gray-700/60 shrink-0">
                  </div>
                  <h3 class="font-bold text-xs sm:text-sm text-gray-100 group-hover:text-emerald-400 line-clamp-1">${escapeHtml(g.name)}</h3>
                  <span class="text-[11px] text-gray-400 truncate block mt-0.5">${escapeHtml(g.publisher || 'NPH Việt Nam')}</span>
                </div>
                <div class="mt-2 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md self-start border border-emerald-500/30">
                  🎁 ${g.free_codes_count || 10}+ Giftcode
                </div>
              </a>`
              )
              .join('')}
          </div>

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
                <p>Toàn bộ 188+ tựa game trên hệ thống đều có số Giấy phép phê duyệt nội dung kịch bản trò chơi G1 được cấp bởi Cục PTTH&TTĐT.</p>
              </div>
            </div>
          </section>
        </main>

        <!-- Footer -->
        <footer class="mt-auto border-t border-gray-800/80 bg-dark-900/50 py-8 px-4 text-center text-xs text-gray-500">
          <p>© 2026 CodeGame.shop. Nền tảng chia sẻ giftcode cộng đồng & đối chiếu minh bạch Giấy phép G1 theo Cục PTTH&TTĐT (giayphep.abei.gov.vn).</p>
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
            <img src="/logo.png" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg object-cover" />
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

  // 2.1. Prerender Individual News Articles
  let newsArticles = [];
  try {
    const seedNewsMod = await import('../src/data/seedNews.ts');
    newsArticles = seedNewsMod.DEFAULT_NEWS_ARTICLES || [];
  } catch (err) {
    console.warn('[Prerender] Không thể nạp seedNews.ts:', err?.message);
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
              url: `${BASE_URL}/logo.png`,
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
              <img src="/logo.png" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg object-cover" />
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
            <img src="/logo.png" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg object-cover" />
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

    // Ưu tiên ảnh JPG chuẩn cho Zalo/Facebook preview
    const rawJpg = path.resolve(__dirname, `../public/game_icons/${gameSlug}.jpg`);
    const rawWebp = path.resolve(__dirname, `../public/game_icons/${gameSlug}.webp`);
    let ogGameIcon = `${BASE_URL}/og-image.jpg`;
    if (fs.existsSync(rawJpg)) {
      ogGameIcon = `${BASE_URL}/game_icons/${gameSlug}.jpg`;
    } else if (fs.existsSync(rawWebp)) {
      ogGameIcon = `${BASE_URL}/game_icons/${gameSlug}.webp`;
    }

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
              <img src="/logo.png" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg object-cover" />
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
            <img src="/logo.png" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg object-cover" />
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

    const activeCodes = gameCodes.filter((c) => (c.status || 'approved') !== 'expired' && c.status !== 'rejected');
    const displayCodes = activeCodes.length > 0 ? activeCodes : gameCodes.slice(0, 10);

    const rawImg = game.cover_image_url || game.icon_url || `/game_icons/${slug}.jpg`;
    const jpgImg = rawImg.replace(/\.webp$/i, '.jpg');
    const ogCoverImg = jpgImg.startsWith('http') ? jpgImg : `${BASE_URL}${jpgImg.startsWith('/') ? jpgImg : `/${jpgImg}`}`;
    const coverImg = game.cover_image_url || game.icon_url || `${BASE_URL}/game_icons/${slug}.webp`;
    const title = `Giftcode ${game.name} Mới Nhất 2026 - Hướng Dẫn Nhập & Nhận Quà | CodeGame.shop`;
    const description = `Tổng hợp trọn bộ giftcode ${game.name} còn hạn mới nhất 2026. Hướng dẫn chi tiết cách nhập code nhận Kim Cương, KNB và quà VIP từ ${game.publisher || 'Nhà phát hành'}.`;

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
      canonicalPath: `/game/${encodeURIComponent(slug)}`,
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
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'VND',
            availability: 'https://schema.org/InStock',
          },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: `Cách nhập Giftcode ${game.name} nhận quà tân thủ`,
          description: `Hướng dẫn từng bước cách nhập mã giftcode ${game.name} thành công 100% để nhận Kim Cương, KNB và quà VIP.`,
          image: coverImg,
          step: [
            {
              '@type': 'HowToStep',
              position: 1,
              name: 'Mở game và đăng nhập',
              text: `Khởi động trò chơi ${game.name} trên điện thoại hoặc máy tính và đăng nhập vào tài khoản của bạn.`,
            },
            {
              '@type': 'HowToStep',
              position: 2,
              name: 'Vào mục Phúc Lợi hoặc Cài Đặt',
              text: 'Bấm vào biểu tượng Avatar nhân vật hoặc biểu tượng Cài Đặt / Phúc Lợi / Sự Kiện trong giao diện chính của game.',
            },
            {
              '@type': 'HowToStep',
              position: 3,
              name: 'Nhập mã giftcode và xác nhận',
              text: `Nhập hoặc dán mã giftcode lấy từ CodeGame.shop vào ô quà tặng và nhấn nút Đổi Quà (Xác Nhận).`,
            },
            {
              '@type': 'HowToStep',
              position: 4,
              name: 'Nhận quà trong hộp thư',
              text: 'Mở hòm Thư trong game để kiểm tra và nhận các vật phẩm đính kèm ngay lập tức.',
            },
          ],
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${BASE_URL}/` },
            { '@type': 'ListItem', position: 2, name: 'Giftcode Miễn Phí', item: `${BASE_URL}/` },
            { '@type': 'ListItem', position: 3, name: game.name, item: `${BASE_URL}/game/${slug}` },
          ],
        },
      ],
      bodyContent: (() => {
        const isG1 = (game.trang_thai_gp && /G1\b/i.test(game.trang_thai_gp)) || /(QĐ|QD)-(BTTTT|PTTH&TTĐT|BVHTTDL)/i.test(game.so_giay_phep || '');
        return `
        <div class="min-h-screen flex flex-col bg-dark-950 text-gray-100">
          <header class="site-header sticky top-0 z-40 w-full border-b border-gray-800/80 bg-dark-950/85 backdrop-blur-md px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between">
            <a href="/" class="header-logo flex items-center gap-2 text-brand-400 font-extrabold text-base sm:text-lg">
              <img src="/logo.png" alt="CodeGame.shop" width="32" height="32" class="w-8 h-8 rounded-lg object-cover" />
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
                  <span class="inline-block px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 text-[11px] font-bold border border-brand-500/20">
                    ${escapeHtml(game.category || 'Game Mobile')}
                  </span>
                  ${
                    isG1
                      ? `<span class="inline-block px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/40">✓ Đã xác minh (G1)</span>`
                      : `<span class="inline-block px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 text-[11px] font-bold border border-cyan-500/30">🌐 Quốc Tế</span>`
                  }
                </div>
                <h1 class="text-xl sm:text-3xl font-black text-white">${escapeHtml(game.name)}</h1>
                <p class="text-xs sm:text-sm text-gray-400 font-semibold mt-0.5">${escapeHtml(game.publisher || 'NPH Chính Thức VN')}</p>
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
                        .map(
                          (c) => `
                  <div class="flex items-center justify-between p-3 rounded-xl bg-dark-850 border border-gray-800">
                    <div>
                      <code class="font-mono font-bold text-brand-400 text-sm sm:text-base">${escapeHtml(c.codeValue || c.code_value || c.code)}</code>
                      <div class="text-xs text-gray-400 mt-0.5">${escapeHtml(c.rewards || 'Giftcode tân thủ / Sự kiện')}</div>
                    </div>
                    <span class="text-xs px-2.5 py-1 rounded-lg bg-brand-600/20 text-brand-400 border border-brand-500/30 font-bold">Mới nhất</span>
                  </div>`
                        )
                        .join('')
                    : `<p class="text-xs text-gray-400">Đang cập nhật thêm mã mới cho tựa game này...</p>`
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
                    <img src="${escapeHtml(rg.icon_url || rg.cover_image_url || `/game_icons/${rg.slug || rg.id}.webp`)}" alt="${escapeHtml(rg.name)}" loading="lazy" class="w-full aspect-square rounded-lg object-cover mb-2 border border-gray-700/60">
                    <h3 class="font-bold text-xs text-gray-200 group-hover:text-brand-400 line-clamp-1">${escapeHtml(rg.name)}</h3>
                    <span class="text-[10px] text-gray-400 truncate mt-0.5">${escapeHtml(rg.publisher || 'NPH Việt Nam')}</span>
                  </a>`
                  )
                  .join('')}
              </div>
            </section>

            <div class="text-center pt-4">
              <a href="/" class="inline-block px-6 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold transition-all">
                ← Quay Lại Danh Sách 188+ Game
              </a>
            </div>
          </main>

          <footer class="mt-auto border-t border-gray-800/80 bg-dark-900/50 py-6 px-4 text-center text-xs text-gray-500">
            <p>© 2026 CodeGame.shop. Nền tảng chia sẻ giftcode cộng đồng.</p>
          </footer>
        </div>
      `;
      })(),
    });

    fs.writeFileSync(path.join(gameDir, 'index.html'), gameHtml, 'utf8');
    fs.writeFileSync(path.join(distDir, 'game', `${slug}.html`), gameHtml, 'utf8');

    // Also write shortened route: dist/g/${slug}/index.html and dist/g/${slug}.html
    const shortGameDir = path.join(distDir, 'g', slug);
    if (!fs.existsSync(shortGameDir)) fs.mkdirSync(shortGameDir, { recursive: true });
    fs.writeFileSync(path.join(shortGameDir, 'index.html'), gameHtml, 'utf8');
    fs.writeFileSync(path.join(distDir, 'g', `${slug}.html`), gameHtml, 'utf8');
  }

  console.log(`[Prerender] Đã xuất bản hoàn tất ${games.length} trang chi tiết tựa game (bao gồm cả /game/ và /g/)!`);

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

  // 5. Generate Dynamic Sitemap.xml with 100% Games and News Articles
  const todayStr = new Date().toISOString().slice(0, 10);
  const sitemapUrls = [
    { loc: `${BASE_URL}/`, priority: '1.0', changefreq: 'daily', lastmod: todayStr },
    { loc: `${BASE_URL}/news`, priority: '0.9', changefreq: 'daily', lastmod: todayStr },
    { loc: `${BASE_URL}/giveaways`, priority: '0.9', changefreq: 'daily', lastmod: todayStr },
    { loc: `${BASE_URL}/store`, priority: '0.9', changefreq: 'daily', lastmod: todayStr },
    { loc: `${BASE_URL}/utilities`, priority: '0.9', changefreq: 'daily', lastmod: todayStr },
  ];

  // Add all games
  games.forEach((g) => {
    const slug = g.slug || g.id;
    if (slug) {
      sitemapUrls.push({
        loc: `${BASE_URL}/game/${encodeURIComponent(slug)}`,
        priority: '0.8',
        changefreq: 'weekly',
        lastmod: todayStr,
      });
    }
  });

  // Add all news articles
  newsArticles.forEach((a) => {
    const slug = a.slug || a.id;
    if (slug) {
      const artDate = a.published_at ? new Date(a.published_at).toISOString().slice(0, 10) : todayStr;
      sitemapUrls.push({
        loc: `${BASE_URL}/news/${encodeURIComponent(slug)}`,
        priority: '0.8',
        changefreq: 'weekly',
        lastmod: artDate,
      });
    }
  });

  // Add all giveaways
  giveawaysList.forEach((gw) => {
    if (gw && gw.id) {
      sitemapUrls.push({
        loc: `${BASE_URL}/giveaways/${encodeURIComponent(gw.id)}`,
        priority: '0.8',
        changefreq: 'daily',
        lastmod: todayStr,
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
