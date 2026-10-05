import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, getSupabaseConfiguration } from '../../../lib/supabase';

const BASE = 'https://api-gateway.gistda.or.th/api/2.0/resources/features/flood/1day';
const PROVIDER = 'GISTDA FloodCheck';
const MAX_DATA_AGE_MS = 24 * 60 * 60 * 1000;

function redactApiKey(body: string, key: string) {
  return body
    .split(key).join('[REDACTED]')
    .split(encodeURIComponent(key)).join('[REDACTED]');
}

export async function GET(request: NextRequest) {
  const requestedAt = new Date().toISOString();
  const key = process.env.GISTDA_API_KEY?.trim();
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get('lat');
  const lonParam = searchParams.get('lon');
  const lat = Number(latParam);
  const lon = Number(lonParam);
  const location = latParam !== null && lonParam !== null && Number.isFinite(lat) && Number.isFinite(lon)
    ? { lat, lon }
    : null;
  const source = new URL(BASE);
  if (location) {
    source.searchParams.set('lat', String(lat));
    source.searchParams.set('lon', String(lon));
  }
  const sourceUrl = source.toString();

  const unavailable = (message: string, httpStatus: number | null, fetchedAt: string | null = null, contentType: string | null = null, raw: unknown = null, responseStatus = 503) => NextResponse.json({
    status: 'unavailable',
    provider: PROVIDER,
    requestedAt,
    fetchedAt,
    httpStatus,
    contentType,
    timestamp: null,
    location,
    floodDetected: null,
    confidence: null,
    evidence: [],
    sourceUrl,
    raw,
    message,
  }, { status: responseStatus, headers: { 'Cache-Control': 'no-store' } });

  if (!location || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return unavailable('Valid latitude and longitude are required.', null, null, null, null, 400);
  }
  if (!key) {
    console.error('❗️ GISTDA_API_KEY is missing – check .env.local and restart dev server');
    return unavailable('GISTDA_API_KEY is not configured.', null);
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.GISTDA_TIMEOUT_MS) || 15000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const proxy = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
  if (proxy) {
    console.log(`🔌 Using proxy for GISTDA request: ${proxy}`);
  }

  try {
    const response = await fetch(source, {
      headers: { Accept: 'application/json', 'API-Key': key },
      signal: controller.signal,
      cache: 'no-store',
    });
    const fetchedAt = new Date().toISOString();
    const contentType = response.headers.get('content-type');
    const responseText = await response.text();
    const safeText = redactApiKey(responseText, key);
    let raw: unknown = safeText;
    try {
      raw = JSON.parse(safeText);
    } catch {
      // Preserve a non-JSON provider response as raw text.
    }

    // If a proxy requires authentication the fetch will return 407.
    if (response.status === 407) {
      return unavailable('Proxy authentication required (HTTP 407). Please configure HTTP_PROXY/HTTPS_PROXY with valid credentials.', 407, fetchedAt, contentType, raw, 502);
    }
    if (!response.ok) {
      return unavailable('GISTDA FloodCheck request failed.', response.status, fetchedAt, contentType, raw, 502);
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return unavailable('GISTDA response is not a JSON object.', response.status, fetchedAt, contentType, raw, 502);
    }

    const body = raw as Record<string, unknown>;
    const features = body.features;
    const numberMatched = body.numberMatched;
    const numberReturned = body.numberReturned;
    const timestamp = body.timeStamp;
    const parsedTimestamp = typeof timestamp === 'string' ? Date.parse(timestamp) : Number.NaN;
    const validFeatureCollection = body.type === 'FeatureCollection'
      && Array.isArray(features)
      && typeof numberMatched === 'number'
      && Number.isFinite(numberMatched)
      && typeof numberReturned === 'number'
      && Number.isFinite(numberReturned)
      && Number.isFinite(parsedTimestamp);

    if (!validFeatureCollection) {
      return unavailable('GISTDA response does not match the observed FeatureCollection schema.', response.status, fetchedAt, contentType, raw, 502);
    }

    const age = Date.now() - parsedTimestamp;
    if (age < 0 || age > MAX_DATA_AGE_MS) {
      return unavailable('GISTDA FloodCheck data is stale or has an invalid timestamp.', response.status, fetchedAt, contentType, raw, 502);
    }

    const floodDetectedBySatellite = numberMatched > 0 || numberReturned > 0 || features.length > 0;
    const combinedFeatures: any[] = [...features];

    // 4. Incorporate Real Ground Telemetry (ThaiWater 22 Stations):
    // If river water level at any station in Ayutthaya is currently overflowing (Level 5) or Critical (Level 4),
    // this is 100% verified ground flood evidence!
    let groundOverflowStations: any[] = [];
    try {
      const waterRes = await fetch('https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load?province_code=14', {
        headers: { Accept: 'application/json', 'User-Agent': 'FloodWatchAyutthaya/1.0' },
        next: { revalidate: 120 },
      });
      if (waterRes.ok) {
        const waterJson = await waterRes.json();
        const rawStations = waterJson.waterlevel_data?.data || waterJson.waterlevel_data || [];
        rawStations.forEach((item: any) => {
          const lat = item.station?.tele_station_lat;
          const lon = item.station?.tele_station_long;
          const sitLevel = item.situation_level;
          const stName = item.station?.tele_station_name?.th || item.station?.tele_station_oldcode || 'สถานีวัดน้ำ';
          const amphoe = item.geocode?.amphoe_name?.th || '';
          const riverBasin = item.basin?.basin_name?.th || '';

          // Level 5 = Overflow (ล้นตลิ่ง), Level 4 = Critical (วิกฤต)
          if (typeof lat === 'number' && typeof lon === 'number' && (sitLevel === 5 || sitLevel === 4)) {
            groundOverflowStations.push({
              name: stName,
              amphoe,
              situationLevel: sitLevel,
              waterLevelMsl: item.waterlevel_msl,
              diffBankM: item.diff_ground,
              time: item.tele_station_datetime,
            });

            // Add as verified Point feature to combined features
            combinedFeatures.push({
              type: 'Feature',
              id: `ground-overflow-${item.station?.id || item.id}`,
              geometry: {
                type: 'Point',
                coordinates: [lon, lat],
              },
              properties: {
                title: `${stName} (${sitLevel === 5 ? 'ล้นตลิ่ง' : 'วิกฤต'})`,
                description: `โทรมาตรตรวจวัดจริงพบระดับน้ำ${sitLevel === 5 ? 'ล้นตลิ่ง' : 'วิกฤต'} ในลุ่มน้ำ${riverBasin} อ.${amphoe}`,
                source: 'ThaiWater / กรมชลประทาน (โทรมาตรตรวจวัดจริง)',
                evidenceType: 'ground_telemetry_overflow',
                situationLevel: sitLevel,
                waterLevelMsl: item.waterlevel_msl,
                amphoe,
                timestamp: item.tele_station_datetime || fetchedAt,
              },
            });
          }
        });
      }
    } catch {
      // Telemetry lookup failure shouldn't crash endpoint
    }

    // 5. Query Historical Flood Evidence from Supabase (if available)
    let historicalEvents: any[] = [];
    try {
      const supabaseConfig = getSupabaseConfiguration();
      if (supabaseConfig) {
        const supabase = getSupabaseClient();
        const { data: dbEvents } = await supabase
          .from('flood_events')
          .select('id, title, description, geometry, source, observed_at, status, latitude, longitude, confidence')
          .order('observed_at', { ascending: false })
          .limit(20);
        if (Array.isArray(dbEvents)) {
          historicalEvents = dbEvents;
        }
      }
    } catch {
      // Historical lookup failure shouldn't crash the live endpoint
    }

    const hasGroundOverflow = groundOverflowStations.length > 0;
    // Strict distinction: satellite inundation vs telemetry water level
    const floodDetected = floodDetectedBySatellite;

    return NextResponse.json({
      status: floodDetected ? 'evidence' : 'no_evidence',
      provider: PROVIDER,
      requestedAt,
      fetchedAt,
      httpStatus: response.status,
      contentType,
      timestamp,
      location,
      floodDetected,
      confidence: floodDetected ? 'high (satellite radar)' : null,
      evidence: {
        numberMatched: features.length,
        numberReturned: features.length,
        features,
      },
      currentEvidence: {
        detected: floodDetected,
        featuresCount: features.length,
        satelliteDetected: floodDetectedBySatellite,
        geoJson: {
          type: 'FeatureCollection',
          features,
        },
        rawMatched: numberMatched,
      },
      telemetryEvidence: {
        hasCriticalOrOverflow: hasGroundOverflow,
        stationsCount: groundOverflowStations.length,
        stations: groundOverflowStations,
        features: combinedFeatures.filter((f: any) => f.properties?.evidenceType === 'ground_telemetry_overflow'),
      },
      historicalEvidence: {
        count: historicalEvents.length,
        events: historicalEvents,
      },
      coverageLimitation: hasGroundOverflow
        ? `โทรมาตรตรวจวัดจริงพบสถานีระดับน้ำล้นตลิ่ง/วิกฤต ${groundOverflowStations.length} สถานีในอยุธยา แต่ภาพถ่ายดาวเทียม 24h ล่าสุดยังไม่พบผืนน้ำท่วมแผ่กว้างตามรอบสแกน`
        : 'ดาวเทียมตรวจจับตามรอบโคจรเท่านั้น การไม่พบร่องรอยน้ำท่วมไม่ได้ยืนยันว่าไม่มีน้ำท่วมขังในจุดอับสัญญาณหรือใต้ร่มไม้',
      sourceUrl,
      raw,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown GISTDA request error.';
    return unavailable(`GISTDA FloodCheck is unavailable: ${message}`, 502, new Date().toISOString(), null, null, 502);
  } finally {
    clearTimeout(timeout);
  }
}