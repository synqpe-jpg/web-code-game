/**
 * Bộ Máy So Khớp Tựa Game Thông Minh (Fuzzy Game Matcher)
 * Đối chiếu tiêu đề bài viết với toàn bộ 486+ tựa game hiện có trên hệ thống
 */

const fs = require('fs');
const path = require('path');

function removeAccents(str = '') {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

class GameMatcher {
  constructor(gamesList = []) {
    this.games = [];
    this.gameIndex = [];
    if (gamesList && gamesList.length > 0) {
      this.init(gamesList);
    } else {
      this.loadDefaultGames();
    }
  }

  loadDefaultGames() {
    try {
      const p = path.resolve(__dirname, '../../../src/data/games188.json');
      if (fs.existsSync(p)) {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        this.init(raw);
      }
    } catch (e) {
      console.warn('GameMatcher: Không thể tải games188.json cục bộ', e.message);
    }
  }

  init(games) {
    this.games = games || [];
    this.gameIndex = this.games.map((g) => {
      const slug = String(g.slug || g.id || '').toLowerCase();
      const name = String(g.name || '');
      const cleanName = removeAccents(name);
      const nameWords = cleanName.split(/[^a-z0-9]+/).filter((w) => w.length > 1);

      // Tạo các từ khóa viết tắt (Initials)
      const initials = nameWords.map((w) => w[0]).join('');

      return {
        id: g.id || slug,
        slug,
        name,
        cleanName,
        publisher: g.publisher || '',
        nameWords,
        initials,
        slugClean: slug.replace(/[-_]/g, ' '),
      };
    });
  }

  /**
   * So khớp bài viết với 486 game
   * @param {string} text - Tiêu đề bài viết hoặc nội dung đoạn văn
   * @returns {{ game: any, confidence: number, matchedBy: string } | null}
   */
  match(text = '') {
    if (!text || this.gameIndex.length === 0) return null;

    const cleanInput = removeAccents(text);
    const compactInput = cleanInput.replace(/\s+/g, '');

    let bestMatch = null;
    let highestScore = 0;
    let matchedReason = '';

    for (const g of this.gameIndex) {
      let score = 0;
      let reason = '';

      // 1. Khớp chính xác tên đầy đủ trong văn bản
      if (cleanInput.includes(g.cleanName)) {
        score = 1.0;
        reason = `Khớp chính xác tên: "${g.name}"`;
      }
      // 2. Khớp chính xác slug dạng không dấu
      else if (cleanInput.includes(g.slugClean) && g.slugClean.length > 4) {
        score = 0.95;
        reason = `Khớp slug sạch: "${g.slugClean}"`;
      }
      // 3. Khớp tên không khoảng trắng (VD: piratelegends, deltaforce)
      else if (compactInput.includes(g.cleanName.replace(/\s+/g, '')) && g.cleanName.length > 4) {
        score = 0.9;
        reason = `Khớp chuỗi liền: "${g.name}"`;
      }
      // 4. Khớp các từ khóa chính (> 2 từ chính khớp liên tiếp)
      else if (g.nameWords.length >= 2) {
        let matchedWordCount = 0;
        for (const w of g.nameWords) {
          if (cleanInput.includes(w)) {
            matchedWordCount++;
          }
        }
        const wordRatio = matchedWordCount / g.nameWords.length;
        if (wordRatio >= 0.75) {
          score = Math.max(score, 0.75 + wordRatio * 0.15);
          reason = `Khớp ${matchedWordCount}/${g.nameWords.length} từ khóa chính`;
        }
      }

      // Xử lý từ viết tắt đặc biệt (Acronyms nổi tiếng)
      if (score < 0.8) {
        if (cleanInput.includes('delta force') && g.slug === 'delta-force') {
          score = 1.0;
          reason = 'Khớp từ khóa đặc biệt Delta Force';
        } else if ((cleanInput.includes('hai tac') || cleanInput.includes('huyen thoai hai tac')) && (g.slug === 'pirate-legends' || g.slug === 'huyen-thoai-hai-tac')) {
          score = 1.0;
          reason = 'Khớp từ khóa Hải Tặc / Pirate Legends';
        } else if (cleanInput.includes('genshin') && g.slug === 'genshin-impact') {
          score = 1.0;
          reason = 'Khớp Genshin Impact';
        } else if ((cleanInput.includes('star rail') || cleanInput.includes('hsr')) && g.slug === 'honkai-star-rail') {
          score = 0.95;
          reason = 'Khớp Honkai: Star Rail';
        } else if (cleanInput.includes('roblox') && g.slug === 'roblox') {
          score = 1.0;
          reason = 'Khớp Roblox';
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = g;
        matchedReason = reason;
      }
    }

    if (bestMatch && highestScore >= 0.4) {
      const originalGame = this.games.find((x) => (x.slug || x.id) === bestMatch.slug) || bestMatch;
      return {
        game: originalGame,
        confidence: Math.min(1.0, highestScore),
        matchedBy: matchedReason,
      };
    }

    return null;
  }
}

module.exports = {
  GameMatcher,
};
