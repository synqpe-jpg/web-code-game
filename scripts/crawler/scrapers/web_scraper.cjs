/**
 * Web Scraper: Quét bài viết tổng hợp giftcode từ các chuyên trang game uy tín
 */

const https = require('https');
const http = require('http');
const { isValidGiftCode } = require('../engine/code_filter.cjs');

function fetchUrl(url, maxRedirects = 3) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) return reject(new Error('Too many redirects'));
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
      },
      timeout: 8000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectTarget = res.headers.location;
        if (!redirectTarget.startsWith('http')) {
          redirectTarget = new URL(redirectTarget, url).href;
        }
        return fetchUrl(redirectTarget, maxRedirects - 1).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function cleanCodeCandidate(raw = '') {
  return String(raw || '').trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
}

function extractCodesFromHtml(html = '') {
  const extracted = [];
  if (!html) return extracted;

  // 1. Tìm trong các thẻ <table>, <code>, <strong>, <b>, <td>
  const tableRows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  for (const row of tableRows) {
    const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map((c) =>
      c.replace(/<[^>]+>/g, '').trim()
    );
    if (cells.length >= 2) {
      const codeCand = cleanCodeCandidate(cells[0]);
      const rewardCand = cells[1];
      const expiryCand = cells[2] || '';

      // Kiểm tra tính hợp lệ bằng bộ lọc đa tầng
      if (isValidGiftCode(codeCand)) {
        extracted.push({
          code: codeCand,
          rewards: rewardCand || 'Quà tân thủ & vật phẩm ingame',
          expiresAt: expiryCand.includes('202') ? expiryCand : '2026-12-31',
        });
      }
    }
  }

  // 2. Tìm pattern dạng "Code: XXXXX", "Giftcode: XXXXX" hoặc thẻ <li><strong>CODE</strong>
  const regexPatterns = [
    /(?:code|giftcode|mã quà tặng|mã code|promo code)[:\s*]+([A-Za-z0-9_<>-]{4,28})\b/gi,
    /<(?:strong|b)>([A-Za-z0-9_<>-]{4,28})<\/(?:strong|b)>\s*[:–—\-]\s*([^<\n]+)/gi,
    /<li>\s*<(?:strong|b|code)>([A-Za-z0-9_<>-]{4,28})<\/(?:strong|b|code)>\s*[:–—\-]?\s*([^<\n]+)/gi,
    /<code>([A-Za-z0-9_<>-]{4,28})<\/code>\s*[:–—\-]\s*([^<\n]+)/gi,
  ];

  for (const reg of regexPatterns) {
    let match;
    while ((match = reg.exec(html)) !== null) {
      const c = cleanCodeCandidate(match[1]);
      const r = match[2]?.trim() || 'Quà tặng tân thủ';
      if (isValidGiftCode(c)) {
        if (!extracted.some((x) => x.code === c)) {
          extracted.push({
            code: c,
            rewards: r.replace(/<[^>]+>/g, '').trim() || 'Quà tặng sự kiện',
            expiresAt: '2026-12-31',
          });
        }
      }
    }
  }

  return extracted;
}

class WebScraper {
  async scrapeSource(sourceUrl) {
    try {
      // Hỗ trợ đặc biệt cho GamerPower API (Giveaways & Loot Tracker)
      if (sourceUrl.includes('gamerpower.com')) {
        const apiUrl = 'https://www.gamerpower.com/api/giveaways?type=loot';
        const rawJson = await fetchUrl(apiUrl);
        try {
          const list = JSON.parse(rawJson);
          if (Array.isArray(list)) {
            const codes = list.slice(0, 15).map(item => ({
              code: `GP-${item.id}-${(item.title || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase()}`,
              rewards: `${item.title}: ${item.platforms || 'PC/Mobile'} Free Loot Pack`,
              expiresAt: '2026-12-31',
            }));
            return {
              url: sourceUrl,
              title: 'GamerPower Loot & Giveaway Tracker',
              sourceType: 'reputable_web',
              codes,
              success: true,
            };
          }
        } catch {}
      }

      const html = await fetchUrl(sourceUrl);
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';

      const codes = extractCodesFromHtml(html);

      return {
        url: sourceUrl,
        title,
        sourceType: 'reputable_web',
        codes,
        success: true,
      };
    } catch (e) {
      return {
        url: sourceUrl,
        title: '',
        sourceType: 'reputable_web',
        codes: [],
        success: false,
        error: e.message,
      };
    }
  }
}

module.exports = {
  WebScraper,
  extractCodesFromHtml,
};
