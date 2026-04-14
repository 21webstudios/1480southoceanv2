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
    const decoded = decodeURIComponent(icalUrl);
    const isLodgify = decoded.includes('lodgify.com');
    const userAgent = isLodgify
      ? 'CalendarProxy/1.0'
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

    const response = await fetch(decoded, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/calendar, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      return new Response('Failed to fetch calendar: ' + response.status, { status: response.status });
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
