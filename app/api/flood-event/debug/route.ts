import { NextRequest, NextResponse } from 'next/server';

const BASE = 'https://api-gateway.gistda.or.th/api/2.0/resources/features/flood/1day';
const PROVIDER = 'GISTDA FloodCheck';

export async function GET(request: NextRequest) {
  const requestedAt = new Date().toISOString();
  const key = process.env.GISTDA_API_KEY?.trim();
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!key || lat === null || lon === null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    return NextResponse.json({
      provider: PROVIDER,
      requestedAt,
      fetchedAt: null,
      httpStatus: null,
      contentType: null,
      raw: !key ? 'Missing GISTDA_API_KEY in server environment.' : 'Valid lat and lon query parameters are required.',
    }, { status: !key ? 500 : 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const url = new URL(BASE);
  url.searchParams.set('lat', lat);
  url.searchParams.set('lon', lon);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'API-Key': key },
      signal: controller.signal,
      cache: 'no-store',
    });
    const responseBody = await response.text();
    const raw = responseBody
      .split(key).join('[REDACTED]')
      .split(encodeURIComponent(key)).join('[REDACTED]');
    const payload = {
      provider: PROVIDER,
      requestedAt,
      fetchedAt: new Date().toISOString(),
      httpStatus: response.status,
      contentType: response.headers.get('content-type'),
      raw,
    };

    return NextResponse.json(payload, {
      status: response.ok ? 200 : response.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return NextResponse.json({
      provider: PROVIDER,
      requestedAt,
      fetchedAt: new Date().toISOString(),
      httpStatus: 502,
      contentType: null,
      raw: error instanceof Error ? error.message : 'Unknown GISTDA request error.',
    }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  } finally {
    clearTimeout(timeout);
  }
}