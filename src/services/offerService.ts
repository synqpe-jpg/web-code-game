/**
 * Shared Offer & Campaign Cache Service
 * Prefetches and caches /api/store/my-offer to guarantee zero UI latency and zero price flickering.
 */

export interface CachedOfferData {
  campaign?: { enabled: boolean; offer_price: number; max_original_price: number | null };
  offers: Record<
    string,
    {
      eligible: boolean;
      offer_price: number;
      discount_amount: number;
      reason: string | null;
      escalating?: any;
      first_purchase_enabled?: boolean;
      first_purchase_price?: number | null;
      first_purchase_max_price?: number | null;
    }
  >;
  timestamp: number;
}

class OfferService {
  private cache = new Map<string, CachedOfferData>();
  private inflight = new Map<string, Promise<CachedOfferData | null>>();
  private listeners = new Set<() => void>();

  public getCached(gameSlug: string = ''): CachedOfferData | null {
    const key = (gameSlug || 'all').toLowerCase();
    const hit = this.cache.get(key) || this.cache.get('all');
    if (hit && Date.now() - hit.timestamp < 60000) {
      return hit;
    }
    return null;
  }

  public async fetchOffers(gameSlug: string = '', token?: string): Promise<CachedOfferData | null> {
    const key = (gameSlug || 'all').toLowerCase();

    if (this.inflight.has(key)) {
      return this.inflight.get(key)!;
    }

    const promise = (async () => {
      try {
        const authToken =
          token ||
          (typeof localStorage !== 'undefined' && localStorage.getItem('wcg_auth_token')) ||
          (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('wcg_auth_token')) ||
          '';

        const headers: Record<string, string> = {};
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        const url = gameSlug
          ? `/api/store/my-offer?game=${encodeURIComponent(gameSlug)}&_t=${Date.now()}`
          : `/api/store/my-offer?_t=${Date.now()}`;

        const res = await fetch(url, { headers });
        if (!res.ok) return null;
        const data = await res.json();
        if (data && data.success) {
          const cachedData: CachedOfferData = {
            campaign: data.campaign,
            offers: data.offers || {},
            timestamp: Date.now(),
          };
          this.cache.set(key, cachedData);
          this.cache.set('all', cachedData);
          this.notify();
          return cachedData;
        }
      } catch (err) {
        console.warn('[offerService] fetchOffers error:', err);
      } finally {
        this.inflight.delete(key);
      }
      return null;
    })();

    this.inflight.set(key, promise);
    return promise;
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch {}
    });
  }
}

export const offerService = new OfferService();
