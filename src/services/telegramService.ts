/**
 * Telegram Client Service for CodeGame.Shop
 * Interacts with /api/telegram/* endpoints and manages client-side caching.
 */

export interface TelegramPublicConfig {
  enabled: boolean;
  bot_username: string | null;
  group_link: string | null;
}

export interface TelegramUserStatus {
  is_linked: boolean;
  telegram_username: string | null;
  telegram_linked_at: string | null;
  subscriptions: {
    game_slug: string;
    notify_types: string;
    created_at: string;
    updated_at: string;
  }[];
}

class TelegramService {
  private configCache: TelegramPublicConfig | null = null;
  private configPromise: Promise<TelegramPublicConfig> | null = null;

  /**
   * Lấy cấu hình công khai của Telegram Bot & Nhóm
   */
  async getConfig(): Promise<TelegramPublicConfig> {
    if (this.configCache) return this.configCache;
    if (this.configPromise) return this.configPromise;

    this.configPromise = (async () => {
      try {
        const res = await fetch('/api/telegram/config');
        if (res.ok) {
          const data: any = await res.json();
          this.configCache = {
            enabled: Boolean(data.enabled),
            bot_username: data.bot_username || null,
            group_link: data.group_link || null,
          };
          return this.configCache;
        }
      } catch (err) {
        console.warn('[TelegramService] Lỗi lấy config:', err);
      }
      return {
        enabled: false,
        bot_username: null,
        group_link: null,
      };
    })();

    return this.configPromise;
  }

  /**
   * Lấy trạng thái liên kết Telegram của người dùng hiện tại
   */
  async getUserStatus(token: string): Promise<TelegramUserStatus> {
    if (!token) {
      return { is_linked: false, telegram_username: null, telegram_linked_at: null, subscriptions: [] };
    }
    try {
      const res = await fetch('/api/telegram/user', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data: any = await res.json();
        return {
          is_linked: Boolean(data.is_linked),
          telegram_username: data.telegram_username || null,
          telegram_linked_at: data.telegram_linked_at || null,
          subscriptions: Array.isArray(data.subscriptions) ? data.subscriptions : [],
        };
      }
    } catch (err) {
      console.warn('[TelegramService] Lỗi lấy user status:', err);
    }
    return { is_linked: false, telegram_username: null, telegram_linked_at: null, subscriptions: [] };
  }

  /**
   * Sinh mã liên kết tài khoản 1 lần (hết hạn 15 phút)
   */
  async generateLinkToken(token: string): Promise<{ success: boolean; link_url?: string; error?: string }> {
    try {
      const res = await fetch('/api/telegram/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'generate_link' }),
      });
      const data: any = await res.json();
      if (data.success && data.link_url) {
        return { success: true, link_url: data.link_url };
      }
      return { success: false, error: data.message || data.error || 'Không thể tạo link liên kết' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Lỗi mạng khi kết nối máy chủ' };
    }
  }

  /**
   * Hủy liên kết Telegram khỏi tài khoản
   */
  async unlinkTelegram(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/telegram/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'unlink' }),
      });
      const data: any = await res.json();
      return { success: Boolean(data.success), error: data.error };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  }

  /**
   * Cập nhật tùy chọn nhận thông báo
   */
  async updatePreferences(
    token: string,
    notifyTypes: string,
    gameSlug?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/telegram/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'update_preferences',
          notify_types: notifyTypes,
          game_slug: gameSlug,
        }),
      });
      const data: any = await res.json();
      return { success: Boolean(data.success), error: data.error };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  }

  /**
   * Bật/tắt theo dõi một game
   */
  async toggleFollowGame(
    token: string,
    gameSlug: string,
    follow: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/telegram/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'toggle_follow_game',
          game_slug: gameSlug,
          follow,
        }),
      });
      const data: any = await res.json();
      return { success: Boolean(data.success), error: data.message || data.error };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  }

  /**
   * Tạo link chia sẻ qua Telegram theo chuẩn https://t.me/share/url
   */
  getShareUrl(url: string, text?: string): string {
    const fullUrl = url.startsWith('http') ? url : `https://codegame.shop${url}`;
    const params = new URLSearchParams();
    params.set('url', fullUrl);
    if (text) {
      params.set('text', text);
    }
    return `https://t.me/share/url?${params.toString()}`;
  }
}

export const telegramService = new TelegramService();
