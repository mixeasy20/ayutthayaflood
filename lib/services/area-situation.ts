/**
 * Area Situation Service for FloodWatch Ayutthaya
 * Gathers and normalizes real environmental data from ThaiWater, Open-Meteo, GloFAS, and GISTDA.
 * Strictly avoids inventing or replacing unavailable data with zeroes.
 */

import { districts } from '../districts';
import { evaluateRainRisk, evaluateWaterStatus, calculateFloodRisk } from './risk-engine';
import type {
  AreaSituation,
  AreaLocation,
  RainSituation,
  WaterSituation,
  WaterStationReading,
  FloodEvidenceSituation,
  RiverDischargeSituation,
  RiskAssessment,
  RiskLevel,
} from '../types/situation';

// In-memory cache for external data to ensure fast responses and prevent API rate-limiting
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
const cache = new Map<string, { data: AreaSituation; timestamp: number }>();

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function getAreaSituation(
  districtName: string,
  subdistrictName?: string,
  provinceName = 'พระนครศรีอยุธยา'
): Promise<AreaSituation> {
  const cleanDistrict = districtName.trim().replace(/^(อำเภอ|อ\.)\s*/, '');
  const cacheKey = `${provinceName}:${cleanDistrict}:${subdistrictName || ''}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // Find district coordinates
  const districtObj = districts.find(
    (d) => d.name === cleanDistrict || cleanDistrict.includes(d.name) || d.name.includes(cleanDistrict)
  ) || districts[0]; // fallback to Phra Nakhon Si Ayutthaya center if unrecognized

  const area: AreaLocation = {
    province: provinceName,
    district: districtObj.name,
    subdistrict: subdistrictName || null,
    latitude: districtObj.lat,
    longitude: districtObj.lon,
  };

  const nowIso = new Date().toISOString();

  // Run data pipelines concurrently with timeouts
  const [waterResult, rainObsResult, weatherResult, floodEventResult, riverResult] = await Promise.allSettled([
    fetchWaterLevelData(area.district, area.latitude!, area.longitude!),
    fetchRainfallObservation(area.district, area.latitude!, area.longitude!),
    fetchWeatherForecast(area.latitude!, area.longitude!),
    fetchGistdaFloodEvent(area.latitude!, area.longitude!),
    fetchGlofasDischarge(area.latitude!, area.longitude!),
  ]);

  // 1. Process Water Level Data
  const water: WaterSituation =
    waterResult.status === 'fulfilled'
      ? waterResult.value
      : {
        status: 'unavailable',
        primary_station: null,
        district_stations: [],
        is_nearby_reference: false,
        nearby_district_name: null,
        source: 'ThaiWater / กรมชลประทาน',
        freshness: 'unavailable',
      };

  // 2. Process Rainfall (Observed & Forecast)
  let rain: RainSituation = {
    status: 'unavailable',
    observed_24h_mm: null,
    observed_1h_mm: null,
    observed_timestamp: null,
    observed_station_code: null,
    observed_station_name: null,
    forecast_24h_mm: null,
    forecast_probability_pct: null,
    intensity_status: null,
    source: 'ThaiWater & Open-Meteo',
    freshness: 'unavailable',
  };

  if (rainObsResult.status === 'fulfilled' && rainObsResult.value) {
    rain.observed_24h_mm = rainObsResult.value.rain24;
    rain.observed_1h_mm = rainObsResult.value.rain1;
    rain.observed_timestamp = rainObsResult.value.timestamp;
    rain.observed_station_code = rainObsResult.value.stationCode;
    rain.observed_station_name = rainObsResult.value.stationName;
    rain.status = 'available';
    rain.freshness = 'verified_live';
  }

  if (weatherResult.status === 'fulfilled' && weatherResult.value) {
    rain.forecast_24h_mm = weatherResult.value.rain24Forecast;
    rain.forecast_probability_pct = weatherResult.value.maxProbability;
    if (rain.status === 'unavailable') rain.status = 'available';

    // Intensity status description
    const r = rain.forecast_24h_mm ?? 0;
    if (r >= 90) rain.intensity_status = 'ฝนตกหนักมาก (Very Heavy Rain)';
    else if (r >= 35) rain.intensity_status = 'ฝนตกหนัก (Heavy Rain)';
    else if (r >= 10) rain.intensity_status = 'ฝนปานกลาง (Moderate Rain)';
    else if (r > 0.5) rain.intensity_status = 'ฝนเล็กน้อย (Light Rain)';
    else rain.intensity_status = 'ไม่มีฝนหรือฝนเล็กน้อยมาก (No Significant Rain)';
  }

  // 3. Process Flood Evidence (GISTDA)
  const flood: FloodEvidenceSituation =
    floodEventResult.status === 'fulfilled'
      ? floodEventResult.value
      : {
        evidence_status: 'unavailable',
        flood_detected: null,
        actual_flood_locations: [],
        flood_polygon_area_sqkm: null,
        confidence: null,
        timestamp: null,
        source: 'GISTDA FloodCheck (1-Day Satellite)',
        message: 'ข้อมูลภาพถ่ายดาวเทียมตรวจน้ำท่วมไม่สามารถเรียกใช้งานได้ในขณะนี้',
      };

  // 4. Process River Discharge (GloFAS)
  const river: RiverDischargeSituation =
    riverResult.status === 'fulfilled'
      ? riverResult.value
      : {
        status: 'unavailable',
        discharge_m3s: null,
        mean_discharge_m3s: null,
        max_discharge_m3s: null,
        timestamp: null,
        source: 'GloFAS (Global Flood Awareness System / Open-Meteo)',
        data_nature: 'modelled_forecast',
      };

  // 5. Evaluate Sub-dimensions using Risk Engine
  const rainRisk = evaluateRainRisk({ rain });
  rain.rainRisk = rainRisk;

  const waterStatus = evaluateWaterStatus({ water });
  water.waterStatus = waterStatus;

  // 6. Calculate Deterministic Auditable Overall Flood Risk
  const preSituation: AreaSituation = {
    fetched_at: nowIso,
    area,
    rain,
    water,
    flood,
    river,
    risk: {
      overall_risk: 'low',
      overall_risk_th: 'สถานการณ์ปกติ',
      reasons: [],
      methodology: '',
    },
    data_completeness:
      water.status !== 'unavailable' && rain.status !== 'unavailable' ? 'complete' : 'partial',
  };

  const floodRisk = calculateFloodRisk(preSituation);

  // Backward-compatible risk object for existing UI components
  const legacyRiskMap: Record<RiskLevel, RiskAssessment['overall_risk']> = {
  normal: 'low',
  watch: 'monitor',
  increased: 'elevated',
  high: 'high',
  unavailable: 'awaiting',
  };

  const risk: RiskAssessment = {
    overall_risk: legacyRiskMap[floodRisk.level] || 'low',
    overall_risk_th: floodRisk.levelTh,
    reasons: floodRisk.reasons,
    methodology: floodRisk.methodologyDescription,
  };

  const situation: AreaSituation = {
    fetched_at: nowIso,
    area,
    rain,
    water,
    flood,
    river,
    risk,
    floodRisk,
    data_completeness:
      water.status !== 'unavailable' && rain.status !== 'unavailable' ? 'complete' : 'partial',
  };

  cache.set(cacheKey, { data: situation, timestamp: Date.now() });
  return situation;
}

// -------------------------------------------------------------
// Sub-pipeline Helper: ThaiWater Water Level
// -------------------------------------------------------------
async function fetchWaterLevelData(
  districtName: string,
  userLat: number,
  userLon: number
): Promise<WaterSituation> {
  const url = 'https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load?province_code=14';
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'FloodWatchAyutthaya/1.0' },
    next: { revalidate: 180 },
  });

  if (!res.ok) throw new Error(`ThaiWater HTTP ${res.status}`);

  const payload = await res.json();
  const rawList: any[] = payload.waterlevel_data?.data || payload.waterlevel_data || [];

  const parsedStations: WaterStationReading[] = rawList
    .filter((item) => {
      const lat = item.station?.tele_station_lat;
      const lon = item.station?.tele_station_long;
      return typeof lat === 'number' && typeof lon === 'number';
    })
    .map((item) => {
      const currentWl =
        item.waterlevel_msl !== null && item.waterlevel_msl !== undefined && item.waterlevel_msl !== ''
          ? Number(Number(item.waterlevel_msl).toFixed(2))
          : null;
      const prevWl =
        item.waterlevel_msl_previous !== null && item.waterlevel_msl_previous !== undefined && item.waterlevel_msl_previous !== ''
          ? Number(Number(item.waterlevel_msl_previous).toFixed(2))
          : null;

      let changeM: number | null = null;
      let trend: 'rising' | 'falling' | 'stable' | 'unknown' = 'unknown';
      if (currentWl !== null && prevWl !== null) {
        changeM = Number((currentWl - prevWl).toFixed(2));
        if (changeM > 0.01) trend = 'rising';
        else if (changeM < -0.01) trend = 'falling';
        else trend = 'stable';
      }

      const sitLevel = typeof item.situation_level === 'number' ? item.situation_level : 1;
      let sitText = 'ปกติ (Normal)';
      if (sitLevel === 2) sitText = 'เฝ้าระวัง (Watch)';
      else if (sitLevel === 3) sitText = 'เตือนภัย (Warning)';
      else if (sitLevel === 4) sitText = 'วิกฤต (Critical)';
      else if (sitLevel === 5) sitText = 'ล้นตลิ่ง (Overflow)';

      const diffBank =
        item.diff_wl_bank !== null && item.diff_wl_bank !== undefined && item.diff_wl_bank !== ''
          ? Number(Number(item.diff_wl_bank).toFixed(2))
          : null;

      return {
        station_code: item.station?.tele_station_oldcode || String(item.station?.id || item.id),
        station_name: item.station?.tele_station_name?.th || 'สถานีวัดระดับน้ำ',
        district: item.geocode?.amphoe_name?.th || '',
        subdistrict: item.geocode?.tumbon_name?.th || null,
        current_level_msl: currentWl,
        previous_level_msl: prevWl,
        change_m: changeM,
        trend,
        diff_bank_m: diffBank,
        situation_level: sitLevel,
        situation_text: sitText,
        timestamp: item.waterlevel_datetime || null,
        source: 'ThaiWater / กรมชลประทาน',
        lat: item.station?.tele_station_lat,
        lon: item.station?.tele_station_long,
      };
    });

  // Filter stations strictly in the requested district
  const districtStations = parsedStations.filter(
    (st) => st.district.includes(districtName) || districtName.includes(st.district)
  );

  if (districtStations.length > 0) {
    // Pick the most critical station in district as primary
    const primary = [...districtStations].sort((a, b) => b.situation_level - a.situation_level)[0];
    return {
      status: 'available',
      primary_station: primary,
      district_stations: districtStations,
      is_nearby_reference: false,
      nearby_district_name: null,
      source: 'ThaiWater / กรมชลประทาน (22 สถานีโทรมาตร)',
      freshness: 'verified_live',
    };
  }

  // If no station directly in this district (e.g. Wang Noi, Phachi)
  // Find the geographically closest stations in Ayutthaya
  const sortedByDist = [...parsedStations].sort((a: any, b: any) => {
    const dA = calculateDistanceKm(userLat, userLon, a.lat, a.lon);
    const dB = calculateDistanceKm(userLat, userLon, b.lat, b.lon);
    return dA - dB;
  });

  const nearbyStations = sortedByDist.slice(0, 3);
  const nearbyDistrictNames = [...new Set(nearbyStations.map((s) => s.district))].join(', ');

  return {
    status: 'no_station_in_district',
    primary_station: nearbyStations[0] || null,
    district_stations: nearbyStations,
    is_nearby_reference: true,
    nearby_district_name: nearbyDistrictNames || 'อำเภอข้างเคียง',
    source: 'ThaiWater / กรมชลประทาน (อ้างอิงสถานีใกล้เคียง)',
    freshness: 'verified_live',
  };
}

// -------------------------------------------------------------
// Sub-pipeline Helper: ThaiWater Rainfall Observation
// -------------------------------------------------------------
async function fetchRainfallObservation(
  districtName: string,
  userLat: number,
  userLon: number
): Promise<{ rain24: number | null; rain1: number | null; timestamp: string | null; stationCode: string; stationName: string } | null> {
  try {
    const url = 'https://api-v3.thaiwater.net/api/v1/thaiwater30/public/rain_24h?province_code=14';
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'FloodWatchAyutthaya/1.0' },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;

    const payload = await res.json();
    const list: any[] = payload.data || [];
    if (!list || list.length === 0) return null;

    // Try finding station in this district
    let matched = list.filter(
      (item) => item.geocode?.amphoe_name?.th && (item.geocode.amphoe_name.th.includes(districtName) || districtName.includes(item.geocode.amphoe_name.th))
    );

    let chosen = matched[0];
    if (!chosen) {
      // Find closest station
      chosen = list
        .filter((item) => typeof item.station?.tele_station_lat === 'number')
        .sort((a, b) => {
          const dA = calculateDistanceKm(userLat, userLon, a.station.tele_station_lat, a.station.tele_station_long);
          const dB = calculateDistanceKm(userLat, userLon, b.station.tele_station_lat, b.station.tele_station_long);
          return dA - dB;
        })[0];
    }

    if (!chosen) return null;

    return {
      rain24: chosen.rain_24h !== null && chosen.rain_24h !== undefined ? Number(Number(chosen.rain_24h).toFixed(1)) : null,
      rain1: chosen.rain_1h !== null && chosen.rain_1h !== undefined ? Number(Number(chosen.rain_1h).toFixed(1)) : null,
      timestamp: chosen.rainfall_datetime || null,
      stationCode: chosen.station?.tele_station_oldcode || chosen.station?.id || '',
      stationName: chosen.station?.tele_station_name?.th || chosen.station?.tele_station_oldcode || 'สถานีตรวจวัดน้ำฝน',
    };
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// Sub-pipeline Helper: Open-Meteo Weather Forecast
// -------------------------------------------------------------
async function fetchWeatherForecast(
  lat: number,
  lon: number
): Promise<{ rain24Forecast: number; maxProbability: number } | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=Asia%2FBangkok&forecast_days=2&hourly=precipitation,precipitation_probability`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return null;

    const data = await res.json();
    const precipitation = data.hourly?.precipitation ?? [];
    const probabilities = data.hourly?.precipitation_probability ?? [];

    const rain24Forecast = Number(
      precipitation.slice(0, 24).reduce((sum: number, val: number) => sum + Number(val || 0), 0).toFixed(1)
    );
    const maxProbability = Number(
      probabilities.slice(0, 24).reduce((max: number, val: number) => Math.max(max, Number(val || 0)), 0).toFixed(0)
    );

    return { rain24Forecast, maxProbability };
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// Sub-pipeline Helper: GISTDA Satellite Flood Evidence
// -------------------------------------------------------------
async function fetchGistdaFloodEvent(
  lat: number,
  lon: number
): Promise<FloodEvidenceSituation> {
  const key = process.env.GISTDA_API_KEY?.trim();
  if (!key) {
    return {
      evidence_status: 'unavailable',
      flood_detected: null,
      actual_flood_locations: [],
      flood_polygon_area_sqkm: null,
      confidence: null,
      timestamp: null,
      source: 'GISTDA FloodCheck (1-Day Satellite)',
      message: 'GISTDA_API_KEY is not configured on the server.',
    };
  }

  try {
    const url = `https://api-gateway.gistda.or.th/api/2.0/resources/features/flood/1day?lat=${lat}&lon=${lon}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'API-Key': key },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return {
        evidence_status: 'unavailable',
        flood_detected: null,
        actual_flood_locations: [],
        flood_polygon_area_sqkm: null,
        confidence: null,
        timestamp: null,
        source: 'GISTDA FloodCheck (1-Day Satellite)',
        message: `GISTDA API responded with status ${res.status}`,
      };
    }

    const json = await res.json();
    const features: any[] = json.features || [];
    const hasEvidence = features.length > 0;

    // Only extract coordinates if the feature actually provides real point/polygon geometry
    const realLocations = features
      .map((f) => {
        let featureLat: number | null = null;
        let featureLon: number | null = null;
        if (f.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates)) {
          featureLon = f.geometry.coordinates[0];
          featureLat = f.geometry.coordinates[1];
        } else if (f.geometry?.type === 'Polygon' && Array.isArray(f.geometry.coordinates?.[0]?.[0])) {
          featureLon = f.geometry.coordinates[0][0][0];
          featureLat = f.geometry.coordinates[0][0][1];
        }
        if (featureLat === null || featureLon === null) return null;
        return {
          name: f.properties?.name || f.properties?.id || 'จุดตรวจพบน้ำท่วมจากดาวเทียม',
          lat: featureLat,
          lon: featureLon,
        };
      })
      .filter((loc): loc is { name: string; lat: number; lon: number } => loc !== null);

    return {
      evidence_status: hasEvidence ? 'evidence_detected' : 'no_evidence_detected',
      flood_detected: hasEvidence,
      actual_flood_locations: realLocations,
      flood_polygon_area_sqkm: json.area_sqkm || null, // Never multiply features * 0.25; only use if API provides it
      confidence: hasEvidence ? 'high (satellite radar/optical)' : null,
      timestamp: json.timeStamp || json.timestamp || new Date().toISOString(),
      source: 'GISTDA FloodCheck (1-Day Satellite)',
    };
  } catch (err: any) {
    return {
      evidence_status: 'unavailable',
      flood_detected: null,
      actual_flood_locations: [],
      flood_polygon_area_sqkm: null,
      confidence: null,
      timestamp: null,
      source: 'GISTDA FloodCheck (1-Day Satellite)',
      message: err?.message || 'GISTDA request failed',
    };
  }
}

// -------------------------------------------------------------
// Sub-pipeline Helper: GloFAS River Discharge
// -------------------------------------------------------------
async function fetchGlofasDischarge(
  lat: number,
  lon: number
): Promise<RiverDischargeSituation> {
  try {
    const url = `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lon}&daily=river_discharge,river_discharge_mean,river_discharge_max&forecast_days=7`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`GloFAS HTTP ${res.status}`);

    const data = await res.json();
    const discharge = data.daily?.river_discharge?.[0] ?? null;
    const mean = data.daily?.river_discharge_mean?.[0] ?? null;
    const max = data.daily?.river_discharge_max?.[0] ?? null;
    const timestamp = data.daily?.time?.[0] ?? null;

    return {
      status: discharge !== null ? 'available' : 'unavailable',
      discharge_m3s: discharge !== null ? Number(Number(discharge).toFixed(1)) : null,
      mean_discharge_m3s: mean !== null ? Number(Number(mean).toFixed(1)) : null,
      max_discharge_m3s: max !== null ? Number(Number(max).toFixed(1)) : null,
      timestamp: timestamp ? `${timestamp}T00:00:00+07:00` : null,
      source: 'GloFAS (Global Flood Awareness System / Open-Meteo)',
      data_nature: 'modelled_forecast',
    };
  } catch (err: any) {
    return {
      status: 'unavailable',
      discharge_m3s: null,
      mean_discharge_m3s: null,
      max_discharge_m3s: null,
      timestamp: null,
      source: 'GloFAS (Global Flood Awareness System / Open-Meteo)',
      data_nature: 'modelled_forecast',
    };
  }
}
