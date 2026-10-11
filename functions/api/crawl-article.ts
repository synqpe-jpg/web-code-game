/**
 * Cloudflare Pages Function: /api/crawl-article
 * Proxy bóc tách bài viết từ URL để phục vụ tính năng AI viết lại nội dung:
 * - Tránh lỗi CORS khi client fetch trực tiếp các trang tin tức
 * - Bóc tách Title, Meta Description, OG Image, Text content, Code patterns, và Image URLs
 */

interface Env {
  DB?: D1Database;
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request } = context;

  // CORS headers
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method.toUpperCase() === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method.toUpperCase() !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  try {
    const body: any = await request.json().catch(() => ({}));
    const rawUrl = body.url?.trim();

    if (!rawUrl || !rawUrl.startsWith('http')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vui lòng cung cấp URL hợp lệ (bắt đầu bằng http/https)' }),
        { status: 400, headers }
      );
    }

    // Fetch the target webpage with realistic browser User-Agent
    const response = await fetch(rawUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Không thể tải trang web (HTTP ${response.status}). Bạn có thể copy và dán trực tiếp nội dung bài viết vào ô bên dưới.`,
        }),
        { status: 200, headers }
      );
    }

    const html = await response.text();

    // 1. Extract Title
    let title = '';
    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i) ||
                         html.match(/<meta\s+content=["'](.*?)["']\s+property=["']og:title["']/i);
    if (ogTitleMatch && ogTitleMatch[1]) {
      title = ogTitleMatch[1];
    } else {
      const titleTagMatch = html.match(/<title>(.*?)<\/title>/i);
      if (titleTagMatch && titleTagMatch[1]) {
        title = titleTagMatch[1];
      }
    }
    title = cleanHtmlEntities(title).trim();

    // 2. Extract Description / Excerpt
    let excerpt = '';
    const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i) ||
                        html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
    if (ogDescMatch && ogDescMatch[1]) {
      excerpt = cleanHtmlEntities(ogDescMatch[1]).trim();
    }

    // 3. Extract Cover Image
    let cover_url = '';
    const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i) ||
                         html.match(/<meta\s+name=["']twitter:image["']\s+content=["'](.*?)["']/i);
    if (ogImageMatch && ogImageMatch[1]) {
      cover_url = ogImageMatch[1].trim();
      if (cover_url.startsWith('//')) cover_url = 'https:' + cover_url;
    }

    // 4. Extract Article text content
    // Remove scripts, styles, iframes, nav, footer, header
    let cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '');

    // Extract images from article body
    const imageMatches = [...cleanHtml.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
    const images: string[] = [];
    for (const m of imageMatches) {
      let src = m[1].trim();
      if (src.startsWith('//')) src = 'https:' + src;
      if (src.startsWith('http') && !src.includes('logo') && !src.includes('avatar') && !src.includes('icon')) {
        if (!images.includes(src)) images.push(src);
      }
    }

    // Convert headings and paragraphs to text
    cleanHtml = cleanHtml
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n- $1\n')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');

    let content = cleanHtmlEntities(cleanHtml)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join('\n\n');

    // Limit text length to avoid token blowups
    if (content.length > 15000) {
      content = content.slice(0, 15000) + '...';
    }

    // 5. Scan Giftcodes from content
    const codeCandidates = scanGiftcodesFromText(content);

    return new Response(
      JSON.stringify({
        success: true,
        title,
        excerpt,
        cover_url,
        content,
        codes: codeCandidates,
        images: images.slice(0, 8),
      }),
      { status: 200, headers }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Lỗi khi bóc tách bài viết từ link. Bạn có thể dán trực tiếp nội dung bài báo vào ô.',
      }),
      { status: 200, headers }
    );
  }
}

/**
 * Clean common HTML entities
 */
function cleanHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&hellip;/g, '...')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '--');
}

/**
 * Scan giftcode strings from plain text
 */
function scanGiftcodesFromText(text: string): string[] {
  const codes = new Set<string>();
  const ignored = new Set([
    'ANDROID', 'FACEBOOK', 'YOUTUBE', 'DISCORD', 'TWITTER', 'TIKTOK', 'ONLINE', 'MOBILE',
    'VIP', 'PRO', 'HOT', 'NEW', 'CODE', 'GAME', 'LINK', 'GIFTCODE', 'GIFTCODES', 'GOOGLE',
    'PLAY', 'STORE', 'APPLE', 'UPDATE', 'SERVER', 'EVENT', 'VERSION', 'SYSTEM', 'GAMER',
    'FREE', 'ITEM', 'GOLD', 'COIN', 'COINS', 'DIAMOND', 'DIAMONDS', 'LEVEL', 'DAILY',
    'VIETNAM', 'VIET', 'NAM', 'LOGIN', 'SHARE', 'FOLLOW', 'LIKE', 'COMMENT', 'GROUP',
    'THANKS', 'SPECIAL', 'REWARD', 'REWARDS', 'GIFT', 'PACKAGE', 'BANNER', 'CLIENT',
  ]);

  // Pattern 1: Look for explicit Code tags: "Code: XYZ123", "Giftcode: ABC888"
  const tagMatches = text.matchAll(/(?:code|giftcode|mã quà tặng|mã code)\s*[:=\-–]\s*([a-zA-Z0-9_\-]+)/gi);
  for (const m of tagMatches) {
    const candidate = m[1].trim().toUpperCase();
    if (candidate.length >= 4 && candidate.length <= 25 && !ignored.has(candidate)) {
      codes.add(candidate);
    }
  }

  // Pattern 2: Uppercase alphanumeric words between 5 and 20 chars
  const words = text.match(/\b[A-Z0-9_]{5,20}\b/g) || [];
  for (const w of words) {
    const upper = w.toUpperCase();
    if (!ignored.has(upper) && /[0-9]/.test(upper) && /[A-Z]/.test(upper)) {
      // Must contain both letters and digits or underscore (typical giftcode)
      codes.add(upper);
    }
  }

  return Array.from(codes).slice(0, 20);
}
