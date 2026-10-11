/**
 * Facebook Fanpage Scraper & Feed Parser
 * Trích xuất bài đăng tặng giftcode từ Fanpage chính thức của các NPH Game
 */

class FacebookScraper {
  /**
   * Phân tích nội dung bài viết Fanpage
   * @param {string} postContent - Nội dung bài đăng
   * @param {string} pageName - Tên Fanpage (vd: Genshin Impact VN, Delta Force VN, Garena Liên Quân Mobile)
   */
  parsePost(postContent = '', pageName = '') {
    if (!postContent) return { codes: [], success: false };

    const codes = [];

    // Tìm các chuỗi code trong bài viết: "Code: XXXXX", "Giftcode: XXXXX", "Mã quà tặng: XXXXX"
    const regex = /(?:code|giftcode|mã quà tặng|nhập ngay|mã code)[:\s*]+([A-Z0-9_-]{5,24})\b/gi;
    let match;
    while ((match = regex.exec(postContent)) !== null) {
      const c = match[1].trim();
      if (/^[A-Z0-9_-]{5,24}$/.test(c) && !/^(FANPAGE|FACEBOOK|ONLINE|UPDATE)$/i.test(c)) {
        codes.push({
          code: c,
          rewards: `Quà tặng sự kiện Fanpage ${pageName || ''}`.trim(),
          expiresAt: '2026-12-31',
        });
      }
    }

    return {
      title: `Fanpage ${pageName}: ${postContent.slice(0, 70)}...`,
      sourceType: 'official_fb',
      codes,
      contextText: postContent,
      success: codes.length > 0,
    };
  }
}

module.exports = {
  FacebookScraper,
};
