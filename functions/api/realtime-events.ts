import { getRealEventsHub } from '../services/realEventsHub';

interface Env {
  DB?: D1Database;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const nowMs = Date.now();
  const hub = await getRealEventsHub(env);
  const vnToday = new Date(nowMs + 7 * 3600 * 1000).toISOString().slice(0, 10);

  const payload = {
    success: true,
    server_time: nowMs,
    events: hub.events.slice(0, 15),
    master_copy_clicks: (hub.date === vnToday && typeof hub.masterCopyClicks === 'number') ? hub.masterCopyClicks : 0,
    master_copy_clicks_date: vnToday,
    real_product_sold_counts: hub.realProductSoldCounts || {},
    real_giveaway_claimed_counts: hub.realGiveawayClaimedCounts || {},
    peak_product_sold_counts: hub.peakProductSoldCounts || {},
    peak_giveaway_claimed_counts: hub.peakGiveawayClaimedCounts || {},
    lowest_product_stock: hub.lowestProductStock || {},
    lowest_giveaway_remaining: hub.lowestGiveawayRemaining || {},
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      ...CORS_HEADERS,
      // Edge response: ensure fresh real-user events across all clients without browser/PoP stale caching
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};
