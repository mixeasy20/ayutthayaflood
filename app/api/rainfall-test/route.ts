import { NextResponse } from 'next/server';

/**
 * ThaiWater Rainfall Data Pipeline - Diagnostic & Observation Route
 *
 * Official Reference:
 * - ThaiWater Standard: https://standard.thaiwater.net/
 * - Resource: /Rainfall (API ID: A001.1)
 * - Operational HII ThaiWater Base: https://api-v3.thaiwater.net/api/v1/thaiwater30/
 * - Supported filter: provinceCode=14 (Phra Nakhon Si Ayutthaya)
 */

interface ThaiWaterRawStation {
  id: number;
  rain_24h?: number;
  rain_1h?: number;
  rainfall_datetime?: string;
  station_type?: string;
  agency?: {
    agency_name?: { th?: string; en?: string };
    agency_shortname?: { th?: string; en?: string };
  };
  geocode?: {
    warning_zone?: string;
    area_code?: string;
    area_name?: { th?: string; en?: string };
    amphoe_name?: { th?: string; en?: string };
    tumbon_name?: { th?: string; en?: string };
    province_code?: string;
    province_name?: { th?: string; en?: string };
  };
  station?: {
    id?: number;
    tele_station_name?: { th?: string; en?: string };
    tele_station_lat?: number;
    tele_station_long?: number;
    tele_station_oldcode?: string;
    tele_station_type?: string;
    sub_basin_id?: string;
  };
  basin?: {
    id?: number;
    basin_code?: number;
    basin_name?: { th?: string; en?: string };
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const provinceCode = searchParams.get('provinceCode') || '14'; // Default: 14 (Ayutthaya)
  const interval = searchParams.get('interval') || 'C-15';
  const latest = searchParams.get('latest') !== 'false';

  const startTime = Date.now();
  const checkedAt = new Date().toISOString();

  // 1. Check for custom configured ThaiWater API Base URL or API Key
  const customBaseUrl = process.env.THAIWATER_API_BASE_URL;
  const apiKey = process.env.THAIWATER_API_KEY;

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'FloodWatchAyutthaya/1.0',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Determine the endpoint to query
  // Priority 1: Custom configured base URL (if agency provides twsapi)
  // Priority 2: Operational ThaiWater / HII live endpoint
  const targetUrl = customBaseUrl
    ? `${customBaseUrl.replace(/\/+$/, '')}/Rainfall?interval=${interval}&latest=${latest}&provinceCode=${provinceCode}`
    : `https://api-v3.thaiwater.net/api/v1/thaiwater30/public/thailand_main_rain?province_code=${provinceCode}`;

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const responseTimeMs = Date.now() - startTime;

    if (!res.ok) {
      return NextResponse.json({
        status: 'error',
        provider: 'ThaiWater',
        endpoint: targetUrl,
        httpStatus: res.status,
        responseTimeMs,
        checkedAt,
        message: `ThaiWater endpoint responded with HTTP ${res.status}: ${res.statusText}`,
      }, { status: res.status });
    }

    const payload = await res.json();

    // Check if payload is already in official ThaiWater Standard TimeSeriesObservation schema
    if (payload.timeSeriesObservation && Array.isArray(payload.timeSeriesObservation)) {
      return NextResponse.json({
        status: 'success',
        provider: 'ThaiWater Standard API (TWSAPI)',
        format: 'ThaiWater Standard (A001.1)',
        endpoint: targetUrl,
        provinceCode,
        responseTimeMs,
        checkedAt,
        totalObservations: payload.timeSeriesObservation.length,
        data: payload,
      }, { status: 200 });
    }

    // Process HII Operational Format (result: "OK", data: [...])
    const rawStations: ThaiWaterRawStation[] = Array.isArray(payload.data) ? payload.data : [];

    // Transform into official ThaiWater Standard Schema (standard.thaiwater.net)
    const standardizedTimeSeries = rawStations.map((st) => {
      const stationCode = st.station?.tele_station_oldcode || String(st.station?.id || st.id);
      const agencyName = st.agency?.agency_name?.en || st.agency?.agency_name?.th || 'Hydro – Informatics Institute';
      const agencyCode = st.agency?.agency_shortname?.en || 'HII';
      const measureTime = st.rainfall_datetime || checkedAt;

      const measurementResults = [];
      if (typeof st.rain_24h === 'number') {
        measurementResults.push({
          measureTime,
          variable: 'Rainfall',
          interval: '24h',
          value: st.rain_24h,
          uom: 'mm',
          qualityFlag: 'U',
          comment: 'Operational live 24-hour observation',
        });
      }
      if (typeof st.rain_1h === 'number') {
        measurementResults.push({
          measureTime,
          variable: 'Rainfall',
          interval: '1h',
          value: st.rain_1h,
          uom: 'mm',
          qualityFlag: 'U',
          comment: 'Operational live 1-hour observation',
        });
      }

      return {
        observationMetadata: {
          observeAgencyCode: agencyCode,
          observeAgencyName: agencyName,
          originality: 1,
        },
        resultTime: measureTime,
        station: {
          stationCode,
          stationName: st.station?.tele_station_name || { th: 'Unknown', en: 'Unknown' },
          lat: st.station?.tele_station_lat ?? null,
          long: st.station?.tele_station_long ?? null,
          amphoe: st.geocode?.amphoe_name?.th || '',
          tumbon: st.geocode?.tumbon_name?.th || '',
          province: st.geocode?.province_name?.th || 'พระนครศรีอยุธยา',
          provinceCode: st.geocode?.province_code || provinceCode,
          basin: st.basin?.basin_name?.th || '',
        },
        measurementResults,
      };
    });

    // Summary calculations
    let totalRain24h = 0;
    let maxRain24h = 0;
    let maxStation: string = 'N/A';

    rawStations.forEach((st) => {
      const r24 = st.rain_24h ?? 0;
      totalRain24h += r24;
      if (r24 > maxRain24h) {
        maxRain24h = r24;
        maxStation = `${st.station?.tele_station_name?.th || st.station?.tele_station_name?.en || st.id} (${st.geocode?.amphoe_name?.th || ''})`;
      }
    });

    const avgRain24h = rawStations.length > 0 ? +(totalRain24h / rawStations.length).toFixed(2) : 0;

    return NextResponse.json({
      status: 'success',
      provider: 'ThaiWater (สถาบันสารสนเทศทรัพยากรน้ำ - HII)',
      endpoint: targetUrl,
      provinceCode,
      provinceName: 'พระนครศรีอยุธยา',
      checkedAt,
      responseTimeMs,
      summary: {
        totalStations: rawStations.length,
        averageRain24h_mm: avgRain24h,
        maxRain24h_mm: maxRain24h,
        maxRainStation: maxStation,
      },
      // Official ThaiWater Standard Schema
      standardData: {
        metadata: {
          version: '1.0',
          dataProviderCode: 'HII',
          dataProviderName: 'Hydro – Informatics Institute (Public Organization)',
          documentGenerateTime: checkedAt,
          waterDatatype: 'A001',
          interval: '24h/1h',
        },
        timeSeriesObservation: standardizedTimeSeries,
      },
      // Raw payload from live API
      rawPayloadCount: rawStations.length,
      sampleRawStation: rawStations[0] || null,
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error while connecting to ThaiWater';
    return NextResponse.json({
      status: 'error',
      provider: 'ThaiWater',
      endpoint: targetUrl,
      checkedAt,
      message,
    }, { status: 502 });
  }
}
