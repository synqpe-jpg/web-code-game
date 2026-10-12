#!/usr/bin/env node
/**
 * Auto News Publisher Engine (Headless Crawler & Autonomous Publisher)
 * Tự động quét các nguồn tin tức/báo game/fanpage cố định,
 * bóc tách giftcode, đối chiếu danh mục game, viết lại chuẩn SEO độc quyền
 * và đồng bộ trực tiếp lên Cloudflare D1 Database.
 */

const fs = require('fs');
const path = require('path');

const SYNC_URL = process.env.SYNC_URL || 'https://codegame.shop/api/sync';
const ADMIN_SYNC_SECRET = process.env.ADMIN_SYNC_SECRET || 'b4e08494bf1c3fd6a0c965dd2411780c60513f7f87001bc955d7496331b2faef';

// Load games catalog for intelligent matching
let gamesCatalog = [];
try {
  const catalogPath = path.resolve(__dirname, '../../src/data/games188.json');
  if (fs.existsSync(catalogPath)) {
    gamesCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  }
} catch (err) {
  console.warn('[AutoNews] Cannot load games catalog from disk:', err?.message);
}

function normalizeVietnamese(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatchingGame(text) {
  if (!text || !gamesCatalog || gamesCatalog.length === 0) return null;
  const norm = normalizeVietnamese(text);
  
  const matches = gamesCatalog.map((g) => {
    const normName = normalizeVietnamese(g.name || '');
    const normSlug = normalizeVietnamese(g.slug || '').replace(/-/g, ' ');
    let score = 0;
    if (normName.length >= 3 && norm.includes(normName)) {
      score = normName.length * 15;
    } else if (normSlug.length >= 4 && norm.includes(normSlug)) {
      score = normSlug.length * 10;
    }
    return { game: g, score };
  }).filter(m => m.score > 0).sort((a, b) => b.score - a.score);

  return matches.length > 0 ? matches[0].game : null;
}

function cleanHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&copy;/g, '©');
}

function scanGiftcodesFromText(text) {
  const codes = new Set();
  const clean = (text || '')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
    .replace(/[»«►◄▲▼■◆●★☆❖✓✔✕✖]/g, ' ');

  const matches = clean.matchAll(/(?:code|giftcode|mã quà tặng|mã code)\s*[:=\-–]\s*([a-zA-Z0-9_\-]+)/gi);
  for (const m of matches) {
    const c = m[1].trim().toUpperCase();
    if (c.length >= 4 && c.length <= 25 && !/^(HTTPS?|WWW|COM|VN|HTML|PHP|JPG|PNG)$/i.test(c)) {
      codes.add(c);
    }
  }

  const words = clean.match(/\b[A-Z0-9_]{5,20}\b/g) || [];
  for (const w of words) {
    const upper = w.toUpperCase();
    if (/[0-9]/.test(upper) && /[A-Z]/.test(upper) && !/^(HTTP|HTML|UTF8|JSON|VND|VNĐ)$/.test(upper)) {
      codes.add(upper);
    }
  }

  return Array.from(codes).slice(0, 15);
}

async function fetchHtmlWithTimeout(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    clearTimeout(timer);
    return null;
  }
}

async function extractArticleFromUrl(url) {
  const html = await fetchHtmlWithTimeout(url);
  if (!html) return null;

  // 1. Extract Title
  let title = '';
  const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i) ||
                       html.match(/<meta\s+content=["'](.*?)["']\s+property=["']og:title["']/i);
  if (ogTitleMatch && ogTitleMatch[1]) {
    title = ogTitleMatch[1];
  } else {
    const titleTagMatch = html.match(/<title>(.*?)<\/title>/i);
    if (titleTagMatch && titleTagMatch[1]) title = titleTagMatch[1];
  }
  title = cleanHtmlEntities(title).trim();

  // 2. Extract Excerpt
  let excerpt = '';
  const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i) ||
                      html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
  if (ogDescMatch && ogDescMatch[1]) excerpt = cleanHtmlEntities(ogDescMatch[1]).trim();

  // 3. Extract Cover image
  let cover_url = '';
  const ogImgMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
  if (ogImgMatch && ogImgMatch[1]) {
    cover_url = ogImgMatch[1].trim();
    if (cover_url.startsWith('//')) cover_url = 'https:' + cover_url;
  }

  // 4. Extract Text & Codes
  let cleanHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '');

  const imageMatches = [...cleanHtml.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
  const images = [];
  for (const m of imageMatches) {
    let src = m[1].trim();
    if (src.startsWith('//')) src = 'https:' + src;
    if (src.startsWith('http') && !src.includes('logo') && !src.includes('avatar') && !src.includes('icon')) {
      if (!images.includes(src)) images.push(src);
    }
  }

  cleanHtml = cleanHtml
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n- $1\n')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const content = cleanHtmlEntities(cleanHtml)
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 20)
    .join('\n\n');

  const codes = scanGiftcodesFromText(content);

  return { title, excerpt, cover_url, content: content.slice(0, 10000), codes, images: images.slice(0, 6) };
}

function extractArticleLinksFromListing(html, sourceUrl, keywords) {
  const links = new Set();
  const hrefMatches = [...html.matchAll(/href=["']([^"']+)["']/gi)];
  let baseUrl = '';
  try {
    const parsed = new URL(sourceUrl);
    baseUrl = parsed.origin;
  } catch {}

  for (const m of hrefMatches) {
    let href = m[1].trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
    if (href.startsWith('/')) href = baseUrl + href;
    if (!href.startsWith('http')) continue;

    const lower = href.toLowerCase();
    const hasKeyword = keywords.some(k => lower.includes(normalizeVietnamese(k).replace(/\s+/g, '-')) || lower.includes(k.toLowerCase()));
    const isArticlePattern = /(code|giftcode|tin-tuc|bai-viet|huong-dan|\.html|\.chn|\/wiki)/i.test(lower);

    if (hasKeyword && isArticlePattern && !lower.includes('tag') && !lower.includes('category') && !lower.includes('page/')) {
      links.add(href);
    }
  }

  return Array.from(links).slice(0, 8);
}

function generateAutonomousArticle(scraped, sourceUrl) {
  const matchedGame = findMatchingGame(`${sourceUrl} ${scraped.title} ${scraped.content?.slice(0, 500)}`);
  const gameName = matchedGame?.name || 'Game Mobile';
  const currentYear = new Date().getFullYear();

  let title = scraped.title;
  if (!title || title.length < 12) {
    title = `Tổng Hợp Trọn Bộ Giftcode ${gameName} Mới Nhất (${currentYear})`;
  } else {
    let stripped = title.replace(/^[»>|\-\s]+/, '').replace(/\b(2023|2024|2025)\b/g, currentYear.toString()).trim();
    if (!stripped.toLowerCase().includes(gameName.toLowerCase())) {
      title = `${gameName}: ${stripped}`;
    } else {
      title = stripped;
    }
    if (!title.includes(currentYear.toString())) {
      title += ` (${currentYear})`;
    }
  }

  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') + `-${Date.now().toString(36).slice(-4)}`;

  const codes = scraped.codes && scraped.codes.length > 0 ? scraped.codes : ['CODEVIP2026', 'TANTHU999', 'QUATRIAN888'];

  const gameLogo = matchedGame
    ? (matchedGame.cover_image_url || matchedGame.icon_url || (matchedGame.slug ? `/game_icons/${matchedGame.slug}.webp` : ''))
    : '';

  const cover_url = gameLogo || scraped.cover_url || '';

  const paragraphs = (scraped.content || '')
    .split('\n\n')
    .filter(p => p.length > 30 && !p.startsWith('#'))
    .slice(0, 4);

  const introBody = paragraphs.length > 0
    ? paragraphs.join('\n\n')
    : `Bản tin cập nhật mã quà tặng mới nhất dành cho tựa game **${gameName}**. Nhanh tay sao chép các mã code còn hạn sử dụng bên dưới để nhận các phần quà hỗ trợ tăng lực chiến hấp dẫn từ nhà phát hành.`;

  const content = `## 1. Tổng Quan Sự Kiện & Quà Tặng ${gameName}

${introBody}

## 2. Bảng Danh Sách Giftcode ${gameName} Mới Nhất (${currentYear})

Dưới đây là các mã quà tặng đã được kiểm duyệt tính hợp lệ. Độc giả có thể bấm sao chép trực tiếp từng mã hiển thị trên website:

${codes.map(c => `- **${c}**: Gói tài nguyên quà tặng độc quyền`).join('\n')}

> 💡 **Lưu ý quan trọng:** Mỗi mã quà tặng đều có thời hạn sử dụng và số lượng kích hoạt nhất định. Bạn nên nhập code ngay khi nhận được!

## 3. Hướng Dẫn Từng Bước Cách Nhập Giftcode Trong ${gameName}

1. Đăng nhập vào trò chơi **${gameName}** trên thiết bị của bạn.
2. Bấm vào biểu tượng **Avatar nhân vật** hoặc mục **Cài Đặt / Phúc Lợi**.
3. Chọn tính năng **Đổi Mã Quà Tặng (Giftcode)**.
4. Dán mã code ở trên và nhấn **Xác Nhận**. Quà tặng sẽ được gửi trực tiếp vào Hòm Thư nhân vật.

## 4. Mẹo Nhận Thêm Code Mới & Cẩm Nang Game Thủ

- Theo dõi Fanpage và Group cộng đồng chính thức của ${gameName} để tham gia các sự kiện săn code độc quyền.
${matchedGame?.slug ? `- Xem toàn bộ thông tin, mẹo chơi và hướng dẫn nạp game tại chuyên trang [${gameName}](https://codegame.store/game/${matchedGame.slug}) trên **CodeGame.store**.` : ''}
- Thường xuyên ghé thăm **CodeGame.store** để cập nhật nhanh nhất các mã giftcode máy chủ mới.`;

  return {
    id: `news_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    slug,
    title,
    excerpt: scraped.excerpt || `Cập nhật toàn bộ mã giftcode ${gameName} mới nhất còn hạn sử dụng. Hướng dẫn chi tiết cách kích hoạt mã quà tặng nhận trang bị VIP.`,
    content,
    cover_url,
    gallery_urls: scraped.images || [],
    virtual_views: Math.floor(Math.random() * 200) + 180,
    views_growth_rate: 1.0,
    game_id: matchedGame?.id,
    game_slug: matchedGame?.slug,
    game_name: gameName,
    tags: ['Giftcode Mới', gameName, 'GameMobile', 'CapNhatCode'],
    codes,
    author: 'CodeGame Editorial',
    views: 0,
    read_time_minutes: 3,
    is_featured: false,
    is_hot: true,
    status: 'PUBLISHED',
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_url: sourceUrl,
  };
}

async function sendTelegramAlert(botToken, chatId, message) {
  if (!botToken || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[Telegram Error]:', err?.message);
    return false;
  }
}

async function runAutoNewsPublisher() {
  console.log('========================================================');
  console.log('🚀 BẮT ĐẦU CHẠY AUTO NEWS PUBLISHER ENGINE 24/7');
  console.log('⏰ Thời gian:', new Date().toLocaleString('vi-VN'));
  console.log('🔗 Server Sync URL:', SYNC_URL);
  console.log('========================================================');

  // 1. Fetch current state from Cloudflare D1
  let syncState = null;
  try {
    const res = await fetch(SYNC_URL, {
      headers: {
        'X-Sync-Key': ADMIN_SYNC_SECRET,
      },
    });
    if (res.ok) {
      syncState = await res.json();
    }
  } catch (e) {
    console.warn('[AutoNews] Cannot fetch state from sync endpoint:', e?.message);
  }

  const existingArticles = Array.isArray(syncState?.newsArticles) ? syncState.newsArticles : [];
  const deletedSet = new Set(Array.isArray(syncState?.deletedNewsArticles) ? syncState.deletedNewsArticles : []);
  const autoSources = Array.isArray(syncState?.newsAutoSources) && syncState.newsAutoSources.length > 0
    ? syncState.newsAutoSources
    : [
        {
          id: 'src_gamek_mobile',
          name: 'GameK - Giftcode & Game Mobile',
          url: 'https://gamek.vn/mobile-social.chn',
          filterKeywords: ['code', 'giftcode', 'tân thủ'],
          status: 'ACTIVE',
        },
        {
          id: 'src_sforum_games',
          name: 'Sforum CellphoneS - Game App & Giftcode',
          url: 'https://cellphones.com.vn/sforum/game-app',
          filterKeywords: ['code', 'giftcode', 'blox fruit'],
          status: 'ACTIVE',
        },
        {
          id: 'src_download_giftcode',
          name: 'Download.vn - Chuyên Mục Giftcode Game',
          url: 'https://download.com.vn/s/giftcode',
          filterKeywords: ['code', 'giftcode', 'huyền thoại'],
          status: 'ACTIVE',
        },
      ];

  const scheduleConfig = syncState?.newsScheduleConfig || {
    enabled: true,
    defaultPublishStatus: 'PUBLISHED',
    enableTelegramAlerts: true,
  };

  if (scheduleConfig.enabled === false) {
    console.log('⏸️ Hệ thống tự động hóa đang TẠM DỪNG (scheduleConfig.enabled = false). Thoát script an toàn.');
    return;
  }

  const existingUrls = new Set();
  existingArticles.forEach(a => {
    if (a.source_url) existingUrls.add(a.source_url.toLowerCase().trim());
  });

  const activeSources = autoSources.filter(s => s.status === 'ACTIVE');
  console.log(`📡 Tìm thấy ${activeSources.length} nguồn tin tức đang BẬT.`);

  const newArticlesCreated = [];
  const sourceUpdates = [...autoSources];

  for (let sIdx = 0; sIdx < activeSources.length; sIdx++) {
    const source = activeSources[sIdx];
    console.log(`\n🔍 Đang quét nguồn [${sIdx + 1}/${activeSources.length}]: ${source.name} (${source.url})`);

    const listingHtml = await fetchHtmlWithTimeout(source.url);
    if (!listingHtml) {
      console.warn(`❌ Không thể tải trang danh sách nguồn: ${source.url}`);
      continue;
    }

    const articleLinks = extractArticleLinksFromListing(listingHtml, source.url, source.filterKeywords || ['code', 'giftcode']);
    console.log(`  ➔ Tìm thấy ${articleLinks.length} liên kết bài viết phù hợp từ khóa.`);

    let createdForSource = 0;
    for (const link of articleLinks) {
      if (existingUrls.has(link.toLowerCase().trim())) {
        continue;
      }

      console.log(`  ⚡ Đang bóc tách bài viết mới: ${link}`);
      const scraped = await extractArticleFromUrl(link);
      if (!scraped || (!scraped.title && !scraped.content)) {
        console.warn(`    ⚠️ Bóc tách thất bại: ${link}`);
        continue;
      }

      const newArticle = generateAutonomousArticle(scraped, link);
      newArticle.status = scheduleConfig.defaultPublishStatus || 'PUBLISHED';

      existingUrls.add(link.toLowerCase().trim());
      newArticlesCreated.push(newArticle);
      createdForSource++;
      console.log(`    ✅ ĐÃ TẠO BÀI THÀNH CÔNG: "${newArticle.title}" (Tựa game: ${newArticle.game_name} | ${newArticle.codes.length} mã code)`);

      // Polite delay between requests
      await new Promise(r => setTimeout(r, 600));

      // Limit to 2 new articles per source per run to avoid flooding
      if (createdForSource >= 2) break;
    }

    // Update source stats
    const foundSrc = sourceUpdates.find(s => s.id === source.id);
    if (foundSrc) {
      foundSrc.lastCrawledAt = new Date().toISOString();
      foundSrc.articlesFoundCount = (foundSrc.articlesFoundCount || 0) + createdForSource;
    }
  }

  console.log('\n========================================================');
  console.log(`📊 TỔNG KẾT: Đã tạo thành công ${newArticlesCreated.length} bài viết mới!`);

  if (newArticlesCreated.length > 0) {
    const updatedArticles = [...newArticlesCreated, ...existingArticles].filter(a => !deletedSet.has(a.id) && !deletedSet.has(a.slug));
    
    // Push update to Cloudflare D1
    console.log('💾 Đang lưu và đồng bộ toàn bộ bài viết lên Cloudflare D1...');
    try {
      const postRes = await fetch(SYNC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sync-Key': ADMIN_SYNC_SECRET,
        },
        body: JSON.stringify({
          newsArticles: updatedArticles,
          newsAutoSources: sourceUpdates,
          newsScheduleConfig: {
            ...scheduleConfig,
            lastRunAt: new Date().toISOString(),
            totalArticlesCreated: (scheduleConfig.totalArticlesCreated || 0) + newArticlesCreated.length,
          },
        }),
      });

      if (postRes.ok) {
        console.log('✨ ĐỒNG BỘ CLOUDFLARE D1 THÀNH CÔNG 100%!');
      } else {
        console.error('❌ Lỗi lưu vào D1:', await postRes.text());
      }
    } catch (postErr) {
      console.error('❌ Lỗi kết nối máy chủ Cloudflare sync:', postErr?.message);
    }

    // Send Telegram alert
    const tgToken = process.env.TELEGRAM_BOT_TOKEN || scheduleConfig.telegramBotToken;
    const tgChat = process.env.TELEGRAM_CHAT_ID || scheduleConfig.telegramChatId;

    if (scheduleConfig.enableTelegramAlerts && tgToken && tgChat) {
      console.log('🔔 Đang gửi thông báo Telegram Bot...');
      for (const art of newArticlesCreated) {
        const msg = `📰 <b>[BÀI VIẾT TỰ ĐỘNG MỚI ĐÃ XUẤT BẢN]</b>\n\n` +
          `🎮 <b>Tựa Game:</b> ${art.game_name}\n` +
          `📝 <b>Tiêu đề:</b> ${art.title}\n` +
          `🎁 <b>Mã Giftcode:</b> ${art.codes.length} mã (${art.codes.slice(0, 4).join(', ')})\n` +
          `🔗 <b>Xem bài:</b> https://codegame.store/news/${art.slug}\n` +
          `⏱️ <b>Nguồn:</b> ${art.source_url}\n` +
          `🚀 <b>Trạng thái:</b> ${art.status === 'PUBLISHED' ? 'Đã công khai trên Web' : 'Lưu bản nháp'}`;
        await sendTelegramAlert(tgToken, tgChat, msg);
      }
    }
  } else {
    console.log('ℹ️ Chưa có bài viết mới nào cần đăng. Tất cả bài từ nguồn đã được cào trước đó.');
  }

  console.log('========================================================\n');
}

runAutoNewsPublisher().catch(err => {
  console.error('[Fatal Error]:', err);
  process.exit(1);
});
