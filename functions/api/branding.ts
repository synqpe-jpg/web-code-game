import { getBrandingConfig } from '../services/branding_service';

interface Env {
  DB: D1Database;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  try {
    const branding = await getBrandingConfig(env?.DB);
    return new Response(
      JSON.stringify({
        success: true,
        ...branding,
        branding,
        data: branding,
      }),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': 'public, max-age=60, s-maxage=180, stale-while-revalidate=600',
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: err?.message || 'Lỗi khi tải thông tin thương hiệu.',
      }),
      {
        status: 500,
        headers: CORS_HEADERS,
      }
    );
  }
};
