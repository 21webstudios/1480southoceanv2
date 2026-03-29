// Cloudflare Pages Function — proxies iCal feeds to avoid CORS issues
// Endpoint: /ical-proxy?url=ENCODED_ICAL_URL

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const icalUrl = url.searchParams.get('url');

  if (!icalUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  try {
    const response = await fetch(decodeURIComponent(icalUrl), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 1480SouthOcean/1.0)' }
    });

    if (!response.ok) {
      return new Response('Failed to fetch calendar', { status: response.status });
    }

    const text = await response.text();

    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=900' // cache 15 minutes
      }
    });
  } catch (err) {
    return new Response('Error fetching calendar: ' + err.message, { status: 500 });
  }
}
