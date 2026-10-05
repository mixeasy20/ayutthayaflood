import { NextResponse } from 'next/server';

/**
 * ThaiWater Water Level Data Pipeline - Ayutthaya Province (Code: 14)
 *
 * Official Reference:
 * - Operational HII ThaiWater Base: https://api-v3.thaiwater.net/api/v1/thaiwater30/
 * - Resource: /public/waterlevel_load?province_code=14
 */

export interface WaterLevelStation {
  id: number | string;
  stationCode: string;
  name: {
    th: string;
    en?: string;
  };
  lat: number | null;
  lon: number | null;
  district: string;
  subdistrict: string;
  riverBasin: string;
  agency: {
    nameTh: string;
    nameEn: string;
    shortName: string;
  };
  waterLevelMsl: number | null;
  previousWaterLevelMsl: number | null;
  changeM: number | null;
  trend: 'rising' | 'falling' | 'stable' | 'unknown';
  situationLevel: number; // 1: Normal, 2: Watch, 3: Warning, 4: Critical, 5: Overflow
  situationText: string;
  diffBankM: number | null;
  diffBankText: string | null;
  observationTime: string | null;
  source: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const provinceCode = searchParams.get('provinceCode') || '14';
  const startTime = Date.now();
  const checkedAt = new Date().toISOString();

  const targetUrl = `https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load?province_code=${provinceCode}`;

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'FloodWatchAyutthaya/1.0',
      },
      next: { revalidate: 300 }, // Cache 5 minutes
    });

    const responseTimeMs = Date.now() - startTime;

    if (!res.ok) {
      return NextResponse.json(
        {
          status: 'error',
          provider: 'ThaiWater',
          httpStatus: res.status,
          responseTimeMs,
          checkedAt,
          message: `ThaiWater water level endpoint responded with HTTP ${res.status}`,
          stations: [],
        },
        { status: 502 }
      );
    }

    const payload = await res.json();
    const rawList: any[] = payload.waterlevel_data?.data || payload.waterlevel_data || [];

    const stations: WaterLevelStation[] = rawList
      .filter((item) => {
        const lat = item.station?.tele_station_lat;
        const lon = item.station?.tele_station_long;
        return typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon);
      })
      .map((item) => {
        const lat = item.station?.tele_station_lat ?? null;
        const lon = item.station?.tele_station_long ?? null;
        const stationCode = item.station?.tele_station_oldcode || String(item.station?.id || item.id);
        const nameTh = item.station?.tele_station_name?.th || stationCode;
        const district = item.geocode?.amphoe_name?.th || '';
        const subdistrict = item.geocode?.tumbon_name?.th || '';
        const riverBasin = item.basin?.basin_name?.th || '';

        const agencyNameTh = item.agency?.agency_name?.th || 'กรมชลประทาน';
        const agencyNameEn = item.agency?.agency_name?.en || 'Royal Irrigation Department';
        const agencyShortName = item.agency?.agency_shortname?.th || 'ชป.';

        const currentWl = item.waterlevel_msl !== null && item.waterlevel_msl !== undefined && item.waterlevel_msl !== ''
          ? Number(item.waterlevel_msl)
          : null;
        const prevWl = item.waterlevel_msl_previous !== null && item.waterlevel_msl_previous !== undefined && item.waterlevel_msl_previous !== ''
          ? Number(item.waterlevel_msl_previous)
          : null;

        let changeM: number | null = null;
        let trend: 'rising' | 'falling' | 'stable' | 'unknown' = 'unknown';

        if (currentWl !== null && prevWl !== null && Number.isFinite(currentWl) && Number.isFinite(prevWl)) {
          changeM = Number((currentWl - prevWl).toFixed(2));
          if (changeM > 0.01) trend = 'rising';
          else if (changeM < -0.01) trend = 'falling';
          else trend = 'stable';
        }

        const situationLevel = typeof item.situation_level === 'number' ? item.situation_level : 1;
        let situationText = 'ปกติ (Normal)';
        if (situationLevel === 2) situationText = 'เฝ้าระวัง (Watch)';
        else if (situationLevel === 3) situationText = 'เตือนภัย (Warning)';
        else if (situationLevel === 4) situationText = 'วิกฤต (Critical)';
        else if (situationLevel === 5) situationText = 'ล้นตลิ่ง (Overflow)';

        const diffBankM = item.diff_wl_bank !== null && item.diff_wl_bank !== undefined && item.diff_wl_bank !== ''
          ? Number(item.diff_wl_bank)
          : null;
        const diffBankText = item.diff_wl_bank_text || null;

        return {
          id: item.id || stationCode,
          stationCode,
          name: {
            th: nameTh,
            en: item.station?.tele_station_name?.en,
          },
          lat,
          lon,
          district,
          subdistrict,
          riverBasin,
          agency: {
            nameTh: agencyNameTh,
            nameEn: agencyNameEn,
            shortName: agencyShortName,
          },
          waterLevelMsl: currentWl,
          previousWaterLevelMsl: prevWl,
          changeM,
          trend,
          situationLevel,
          situationText,
          diffBankM,
          diffBankText,
          observationTime: item.waterlevel_datetime || null,
          source: `${agencyShortName} / ThaiWater`,
        };
      });

    return NextResponse.json({
      status: 'success',
      provider: 'ThaiWater (HII / RID)',
      provinceCode,
      checkedAt,
      responseTimeMs,
      totalStations: stations.length,
      stations,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        provider: 'ThaiWater',
        responseTimeMs: Date.now() - startTime,
        checkedAt,
        message: error?.message || 'Failed to fetch water level stations from ThaiWater',
        stations: [],
      },
      { status: 502 }
    );
  }
}
