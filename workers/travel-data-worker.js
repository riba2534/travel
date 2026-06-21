function contentTypeForKey(key) {
  if (key.endsWith('.geojson')) return 'application/geo+json; charset=utf-8';
  if (key.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const prefix = '/data/';
    if (!url.pathname.startsWith(prefix)) {
      return new Response('Not found', { status: 404 });
    }

    let key = url.pathname.slice(prefix.length);
    if (!key || key.endsWith('/')) key += 'manifest.json';

    const object = await env.TRAVEL_DATA.get(key);
    if (!object) {
      return new Response('Not found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    if (!headers.has('content-type')) headers.set('content-type', contentTypeForKey(key));
    if (!headers.has('cache-control')) {
      headers.set(
        'cache-control',
        key === 'manifest.json'
          ? 'public, max-age=60, must-revalidate'
          : 'public, max-age=31536000, immutable',
      );
    }

    if (request.method === 'HEAD') {
      return new Response(null, { headers });
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
    }
    return new Response(object.body, { headers });
  },
};
