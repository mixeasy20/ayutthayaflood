/**
 * Live FloodWatch Context Provider for Gemini AI Chat
 * Builds a structured text context from real data:
 *   - Water Level Telemetry (OBSERVED) from ThaiWater / กรมชลประทาน
 *   - Rainfall Observation (OBSERVED) from ThaiWater
 *   - Weather Forecast (FORECAST) from Open-Meteo
 *   - River Discharge Model (MODELLED) from GloFAS / Open-Meteo
 *
 * Explicitly labels each data type to prevent AI from conflating them.
 */

interface CachedData {
  summary: string;
  timestamp: number;
}

let cache: CachedData | null = null;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

// Center of Phra Nakhon Si Ayutthaya province for province-wide context
const PROVINCE_CENTER = { lat: 14.3692, lon: 100.5877 };

export async function getLiveWaterTelemetryContext(): Promise<string> {
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.summary;
  }

  const fetchedAt = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

  // Fetch all data sources concurrently
  const [waterResult, rainResult, weatherResult, glofasResult] = await Promise.allSettled([
    fetchWaterLevels(),
    fetchRainfallData(),
    fetchWeatherForecast(PROVINCE_CENTER.lat, PROVINCE_CENTER.lon),
    fetchGlofasDischarge(PROVINCE_CENTER.lat, PROVINCE_CENTER.lon),
  ]);

  const lines: string[] = [
    `╔══ ข้อมูลสถานการณ์จริงสำหรับ AI (FloodWatch Ayutthaya Context) ══╗`,
    `║ อัปเดตเวลา: ${fetchedAt} (เวลาประเทศไทย)                       ║`,
    `╚════════════════════════════════════════════════════════════════════╝`,
    '',
  ];

  // ─── Section 1: Water Level Telemetry (OBSERVED) ───────────────────────────
  lines.push('📍 [1] ระดับน้ำโทรมาตรตรวจวัดจริง — DATA TYPE: OBSERVED');
  lines.push('   แหล่งข้อมูล: ThaiWater / กรมชลประทาน (22 สถานี, จ.พระนครศรีอยุธยา)');

  if (waterResult.status === 'fulfilled') {
    const { stations, overflowList, warningList, districtMap } = waterResult.value;
    lines.push(`   จำนวนสถานี: ${stations.length} สถานี`);

    if (overflowList.length > 0) {
      lines.push(`   🚨 สถานีระดับน้ำล้นตลิ่ง: ${overflowList.join(', ')}`);
    } else {
      lines.push(`   ✅ ยังไม่มีสถานีรายงานน้ำล้นตลิ่ง`);
    }

    if (warningList.length > 0) {
      lines.push(`   ⚠️  สถานีเฝ้าระวัง/เตือนภัย: ${warningList.join(', ')}`);
    }

    lines.push('   ข้อมูลแยกตามอำเภอ:');
    for (const [district, stList] of districtMap.entries()) {
      const stDetails = stList
        .map((s: any) => `${s.name} (${s.code}): ${s.levelMsl} ม.รทก. — ${s.status}${s.diffBank !== null ? ` (ต่างจากตลิ่ง ${s.diffBank} ม.)` : ''}`)
        .join('; ');
      lines.push(`     อ.${district}: ${stDetails}`);
    }
    lines.push(
      '   หมายเหตุ: อ.วังน้อย, ภาชี, มหาราช, บางซ้าย, บ้านแพรก ไม่มีสถานีวัดโดยตรง → อ้างอิงสถานีข้างเคียง'
    );
  } else {
    lines.push('   ❌ ไม่สามารถดึงข้อมูลระดับน้ำได้ในขณะนี้ (ThaiWater API ไม่ตอบสนอง)');
  }

  lines.push('');

  // ─── Section 2: Rainfall Observation (OBSERVED) ────────────────────────────
  lines.push('🌧️  [2] ปริมาณฝนตรวจวัดจริง — DATA TYPE: OBSERVED');
  lines.push('   แหล่งข้อมูล: ThaiWater / HII (สถานีฝนอยุธยา)');

  if (rainResult.status === 'fulfilled' && rainResult.value) {
    const { maxRain24h, maxStation, avgRain24h, totalStations } = rainResult.value;
    lines.push(`   จำนวนสถานีฝน: ${totalStations} สถานี`);
    lines.push(`   ปริมาณฝนเฉลี่ย 24 ชม.: ${avgRain24h.toFixed(1)} มม. (ค่าเฉลี่ยทุกสถานีในจังหวัด)`);
    lines.push(`   ปริมาณฝนสูงสุด 24 ชม.: ${maxRain24h.toFixed(1)} มม. (สถานี: ${maxStation})`);
  } else {
    lines.push('   ❌ ไม่สามารถดึงข้อมูลปริมาณฝนได้ในขณะนี้');
  }

  lines.push('');

  // ─── Section 3: Weather Forecast (FORECAST) ────────────────────────────────
  lines.push('☁️  [3] พยากรณ์อากาศและฝน — DATA TYPE: FORECAST (ยังไม่เกิดขึ้นจริง)');
  lines.push('   แหล่งข้อมูล: Open-Meteo (พยากรณ์สำหรับ จ.พระนครศรีอยุธยา ศูนย์จังหวัด)');

  if (weatherResult.status === 'fulfilled' && weatherResult.value) {
    const w = weatherResult.value;
    lines.push(`   ฝนพยากรณ์ล่วงหน้า 24 ชม.: ${w.rain24h.toFixed(1)} มม.`);
    lines.push(`   โอกาสเกิดฝน (สูงสุด 24 ชม.): ${w.maxProbability.toFixed(0)}%`);
    lines.push(`   อุณหภูมิปัจจุบัน: ${w.currentTemp !== null ? `${w.currentTemp} °C` : 'ไม่พร้อมใช้งาน'}`);
    lines.push(`   ความชื้นสัมพัทธ์: ${w.humidity !== null ? `${w.humidity}%` : 'ไม่พร้อมใช้งาน'}`);
    lines.push(
      `   ⚠️ ข้อสังเกต: ค่านี้คือพยากรณ์ล่วงหน้า ยังไม่ใช่ฝนที่ตกจริง อย่านำไปเปรียบเทียบกับค่าตรวจวัดจริงในส่วน [2]`
    );
  } else {
    lines.push('   ❌ ไม่สามารถดึงข้อมูลพยากรณ์อากาศได้ในขณะนี้');
  }

  lines.push('');

  // ─── Section 4: GloFAS River Discharge (MODELLED) ──────────────────────────
  lines.push('🌊 [4] การระบายน้ำแม่น้ำ (แบบจำลอง) — DATA TYPE: MODELLED (ไม่ใช่ค่าตรวจวัดจริง)');
  lines.push('   แหล่งข้อมูล: GloFAS / Open-Meteo (Global Flood Awareness System)');

  if (glofasResult.status === 'fulfilled' && glofasResult.value) {
    const g = glofasResult.value;
    lines.push(`   อัตราการไหล (วันนี้, แบบจำลอง): ${g.discharge !== null ? `${g.discharge.toFixed(1)} ม.³/วิ` : 'ไม่พร้อมใช้งาน'}`);
    lines.push(`   ค่าเฉลี่ยอ้างอิง (historical mean): ${g.mean !== null ? `${g.mean.toFixed(1)} ม.³/วิ` : 'ไม่พร้อมใช้งาน'}`);
    lines.push(`   สูงสุดพยากรณ์ 7 วัน: ${g.max !== null ? `${g.max.toFixed(1)} ม.³/วิ` : 'ไม่พร้อมใช้งาน'}`);
    lines.push(
      `   ⚠️ ข้อสังเกต: ค่านี้คือผลการจำลองทางคณิตศาสตร์ (modelled) ไม่ใช่ค่าจากเซ็นเซอร์ตรวจวัดจริง อ้างอิงเป็น "บริบทเสริม" เท่านั้น`
    );
  } else {
    lines.push('   ❌ ไม่สามารถดึงข้อมูลแบบจำลองการระบายน้ำได้ในขณะนี้');
  }

  lines.push('');
  lines.push('══════════════════════════════════════════════════════════════════');
  lines.push('📌 หมายเหตุสำคัญ:');
  lines.push('   • OBSERVED = ตรวจวัดจากเซ็นเซอร์จริง (เชื่อถือได้มากที่สุด)');
  lines.push('   • FORECAST = พยากรณ์ล่วงหน้า (มีความไม่แน่นอน)');
  lines.push('   • MODELLED = ผลการจำลองทางคณิตศาสตร์ (ใช้เป็นบริบทประกอบ)');
  lines.push('   • FLOOD_EVIDENCE = หลักฐานน้ำท่วมจากภาพดาวเทียม GISTDA (เฉพาะเมื่อถามเรื่องอำเภอใดอำเภอหนึ่ง)');
  lines.push(
    '   • ระดับน้ำกำลังขึ้น ≠ น้ำท่วมยืนยัน — ต้องมีหลักฐานจาก GISTDA หรือสถานีรายงาน "ล้นตลิ่ง (5)" เท่านั้น'
  );
  lines.push('══════════════════════════════════════════════════════════════════');

  const summary = lines.join('\n');
  cache = { summary, timestamp: now };
  return summary;
}

// ─── Internal Helpers ──────────────────────────────────────────────────────────

async function fetchWaterLevels() {
  const res = await fetch(
    'https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load?province_code=14',
    { headers: { Accept: 'application/json', 'User-Agent': 'FloodWatchAyutthaya/1.0' } }
  );
  if (!res.ok) throw new Error(`ThaiWater HTTP ${res.status}`);

  const payload = await res.json();
  const rawList: any[] = payload.waterlevel_data?.data || payload.waterlevel_data || [];

  const districtMap = new Map<string, any[]>();
  const overflowList: string[] = [];
  const warningList: string[] = [];

  for (const item of rawList) {
    const district = item.geocode?.amphoe_name?.th || 'ไม่ระบุอำเภอ';
    const name = item.station?.tele_station_name?.th || item.station?.tele_station_oldcode || 'สถานี';
    const code = item.station?.tele_station_oldcode || '';
    const levelMsl =
      item.waterlevel_msl !== null && item.waterlevel_msl !== undefined
        ? Number(item.waterlevel_msl).toFixed(2)
        : '-';
    const diffBank =
      item.diff_wl_bank !== null && item.diff_wl_bank !== undefined
        ? Number(item.diff_wl_bank).toFixed(2)
        : null;
    const sitLevel = item.situation_level || 1;

    let status = 'ปกติ';
    if (sitLevel === 5) {
      status = `ล้นตลิ่ง`;
      overflowList.push(`${name} (อ.${district})`);
    } else if (sitLevel === 4) {
      status = 'วิกฤต';
      warningList.push(`${name} (อ.${district})`);
    } else if (sitLevel === 3) {
      status = 'เตือนภัย';
      warningList.push(`${name} (อ.${district})`);
    } else if (sitLevel === 2) {
      status = 'เฝ้าระวัง';
    }

    if (!districtMap.has(district)) districtMap.set(district, []);
    districtMap.get(district)!.push({ name, code, levelMsl, diffBank, status });
  }

  return { stations: rawList, overflowList, warningList, districtMap };
}

async function fetchRainfallData() {
  const res = await fetch(
    'https://api-v3.thaiwater.net/api/v1/thaiwater30/public/rain_24h?province_code=14',
    { headers: { Accept: 'application/json', 'User-Agent': 'FloodWatchAyutthaya/1.0' } }
  );
  if (!res.ok) throw new Error(`ThaiWater Rainfall HTTP ${res.status}`);

  const payload = await res.json();
  const list: any[] = payload.data || [];
  if (!list.length) return null;

  let totalRain24h = 0;
  let maxRain24h = 0;
  let maxStation = 'ไม่ระบุ';

  for (const item of list) {
    const r24 = typeof item.rain_24h === 'number' ? item.rain_24h : 0;
    totalRain24h += r24;
    if (r24 > maxRain24h) {
      maxRain24h = r24;
      const stName = item.station?.tele_station_name?.th || item.station?.tele_station_oldcode || '';
      const amphoe = item.geocode?.amphoe_name?.th || '';
      maxStation = `${stName} (อ.${amphoe})`;
    }
  }

  return {
    totalStations: list.length,
    avgRain24h: list.length > 0 ? totalRain24h / list.length : 0,
    maxRain24h,
    maxStation,
  };
}

async function fetchWeatherForecast(lat: number, lon: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=Asia%2FBangkok&forecast_days=2&hourly=precipitation,precipitation_probability&current=temperature_2m,relative_humidity_2m`;
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);

  const data = await res.json();
  const precipitation: number[] = data.hourly?.precipitation ?? [];
  const probabilities: number[] = data.hourly?.precipitation_probability ?? [];

  const rain24h = precipitation.slice(0, 24).reduce((s, v) => s + Number(v || 0), 0);
  const maxProbability = probabilities.slice(0, 24).reduce((m, v) => Math.max(m, Number(v || 0)), 0);
  const currentTemp = data.current?.temperature_2m ?? null;
  const humidity = data.current?.relative_humidity_2m ?? null;

  return { rain24h, maxProbability, currentTemp, humidity };
}

async function fetchGlofasDischarge(lat: number, lon: number) {
  const url = `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lon}&daily=river_discharge,river_discharge_mean,river_discharge_max&forecast_days=7`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`GloFAS HTTP ${res.status}`);

  const data = await res.json();
  const discharge = data.daily?.river_discharge?.[0] ?? null;
  const mean = data.daily?.river_discharge_mean?.[0] ?? null;
  const max = data.daily?.river_discharge_max
    ? Math.max(...(data.daily.river_discharge_max as number[]))
    : null;

  return { discharge, mean, max };
}
