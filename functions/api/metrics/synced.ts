import { getOrRefreshSnapshot } from '../../services/snapshotService';

interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, waitUntil } = context;

  try {
    const snapshot = await getOrRefreshSnapshot(env, waitUntil ? (p) => waitUntil(p) : undefined);

    return new Response(JSON.stringify({
      success: true,
      snapshot,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  } catch (err: any) {
    console.error('[API /api/metrics/synced] Error generating snapshot:', err);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to retrieve metrics snapshot',
      message: err?.message,
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};
