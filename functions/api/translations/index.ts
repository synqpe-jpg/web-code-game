import { getTranslationsD1, saveTranslationD1 } from '../../services/d1_service';

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ request, env }) => {
  const url = new URL(request.url);
  const lang = url.searchParams.get('lang') || undefined;
  const objectType = url.searchParams.get('object_type') || undefined;

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'Database binding missing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const translations = await getTranslationsD1(env.DB, lang, objectType);
    return new Response(JSON.stringify({ success: true, translations }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestPost: PagesFunction<{ DB: D1Database }> = async ({ request, env }) => {
  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'Database binding missing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: any = await request.json();
    const { object_type, object_id, field, language, content, reviewer, status } = body;

    if (!object_type || !object_id || !field || !language || content === undefined) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required translation fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const res = await saveTranslationD1(env.DB, {
      object_type,
      object_id,
      field,
      language,
      content,
      reviewer,
      status: status || 'approved',
    });

    return new Response(JSON.stringify(res), {
      status: res.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
