const ALLOWED_STORAGE_HOSTS = new Set(['firebasestorage.googleapis.com', 'storage.googleapis.com']);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Vary': 'Origin',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const requestUrl = new URL(req.url);
    const target = requestUrl.searchParams.get('url');
    if (!target) return new Response('Missing image URL', { status: 400, headers: corsHeaders });

    const targetUrl = new URL(target);
    if (targetUrl.protocol !== 'https:' || !ALLOWED_STORAGE_HOSTS.has(targetUrl.hostname)) {
      return new Response('Unsupported image host', { status: 400, headers: corsHeaders });
    }

    const upstream = await fetch(targetUrl);
    if (!upstream.ok) {
      return new Response('Unable to fetch image', { status: upstream.status, headers: corsHeaders });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('[StorageImageProxy] Error:', error);
    return new Response('Storage image proxy error', { status: 502, headers: corsHeaders });
  }
}

export const config = {
  path: '/.netlify/functions/storage-image'
};
