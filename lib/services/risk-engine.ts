/**
 * Deterministic Auditable Risk Engine for FloodWatch Ayutthaya
 *
 * Implements strict separation between:
 * Dimension A: Rain Risk (ฝนจริง/พยากรณ์ - NOT Flood Risk)
 * Dimension B: Water Status (ระดับน้ำ/แนวโน้มรายสถานี - NOT District-wide conclusion)
 * Dimension C: Flood Evidence (หลักฐานน้ำท่วมจริงจากดาวเทียม GISTDA)
 * Dimension D: Overall Flood Risk (ความเสี่ยงอุทกภัยรวมตามเกณฑ์ที่ตรวจสอบได้)
 *
 * Rule: NO arbitrary scores (e.g., 50mm = 70% risk). Every level has verifiable contributing factors.
 */

import {
  RAINFALL_THRESHOLDS,
  WATER_LEVEL_THRESHOLDS,
  RIVER_DISCHARGE_THRESHOLDS,
} from '../thresholds/environmental';
import type {
  AreaSituation,
  RainRisk,
  RainRiskLevel,
  WaterStatusAssessment,
  FloodRisk,
  RiskLevel,
  ContributingFactor,
} from '../types/situation';

export const RISK_ENGINE_VERSION = '2.1.0-auditable';

/**
 * Dimension A: Evaluate Rain Risk (Rain intensity & accumulation only)
 */
export function evaluateRainRisk(situation: Pick<AreaSituation, 'rain'>): RainRisk {
  const rain = situation.rain;
  const observed24 = rain.observed_24h_mm;
  const observed1 = rain.observed_1h_mm;
  const forecast24 = rain.forecast_24h_mm;
  const probability = rain.forecast_probability_pct;

  if (rain.status === 'unavailable' && observed24 === null && forecast24 === null) {
    return {
      level: 'unavailable',
      levelTh: 'ข้อมูลฝนไม่พร้อมใช้งาน',
      levelEn: 'Unavailable',
      observed24hMm: null,
      observed1hMm: null,
      forecast24hMm: null,
      forecastProbabilityPct: null,
      intensityDescription: 'ไม่มีข้อมูลตรวจวัดหรือพยากรณ์ฝนในขณะนี้',
      classificationType: 'application_classification',
      source: rain.source || 'ThaiWater / Open-Meteo',
      timestamp: rain.observed_timestamp,
      reasons: ['ไม่พบข้อมูลสถานีตรวจวัดฝนหรือค่าพยากรณ์สำหรับพื้นที่นี้'],
    };
  }

  // Determine highest rain pressure among observed and forecast
  const maxRain = Math.max(observed24 ?? 0, forecast24 ?? 0);
  const reasons: string[] = [];
  let level: RainRiskLevel = 'none';

  const cfg = RAINFALL_THRESHOLDS.APP_RAIN_RISK;

  if (maxRain >= cfg.VERY_HIGH.min24hMm || (observed1 !== null && observed1 >= cfg.VERY_HIGH.min1hMm)) {
    level = 'very_high';
    reasons.push(`ปริมาณฝนสะสมสูงมาก (วัดได้/คาดการณ์สูงสุด ${maxRain.toFixed(1)} มม.) เข้าเกณฑ์ฝนตกหนักมาก`);
  } else if (maxRain >= cfg.HIGH.min24hMm || (observed1 !== null && observed1 >= cfg.HIGH.min1hMm)) {
    level = 'high';
    reasons.push(`ปริมาณฝนสะสมระดับสูง (${maxRain.toFixed(1)} มม.) เข้าเกณฑ์ฝนตกหนัก`);
  } else if (maxRain >= cfg.MODERATE.min24hMm || (observed1 !== null && observed1 >= cfg.MODERATE.min1hMm)) {
    level = 'moderate';
    reasons.push(`ปริมาณฝนสะสมปานกลาง (${maxRain.toFixed(1)} มม.) เข้าเกณฑ์ฝนตกปานกลาง`);
  } else if (maxRain >= cfg.LOW.min24hMm) {
    level = 'low';
    reasons.push(`มีฝนตกเล็กน้อย (${maxRain.toFixed(1)} มม.) ยังไม่กระทบการระบายน้ำ`);
  } else {
    level = 'none';
    reasons.push('ไม่พบปริมาณฝนตรวจวัดหรือพยากรณ์ในเกณฑ์ต้องเฝ้าระวัง');
  }

  if (probability !== null && probability >= 75 && level === 'low') {
    reasons.push(`โอกาสเกิดฝนตกพยากรณ์ค่อนข้างสูง (${probability}%)`);
  }

  const thLabels: Record<RainRiskLevel, string> = {
    very_high: 'ฝนตกหนักมาก (Very High Rain)',
    high: 'ฝนตกหนัก (High Rain)',
    moderate: 'ฝนปานกลาง (Moderate Rain)',
    low: 'ฝนเล็กน้อย (Low Rain)',
    none: 'ไม่มีฝนหรือมีฝนน้อยมาก (No Significant Rain)',
    unavailable: 'ข้อมูลไม่พร้อมใช้งาน (Unavailable)',
  };

  const enLabels: Record<RainRiskLevel, string> = {
    very_high: 'Very High',
    high: 'High',
    moderate: 'Moderate',
    low: 'Low',
    none: 'None',
    unavailable: 'Unavailable',
  };

  return {
    level,
    levelTh: thLabels[level],
    levelEn: enLabels[level],
    observed24hMm: observed24,
    observed1hMm: observed1,
    forecast24hMm: forecast24,
    forecastProbabilityPct: probability,
    intensityDescription: reasons[0] || '',
    classificationType: 'application_classification',
    source: rain.source || 'ThaiWater / Open-Meteo',
    timestamp: rain.observed_timestamp,
    reasons,
  };
}

/**
 * Dimension B: Evaluate Water Status (River telemetry stations only)
 */
export function evaluateWaterStatus(situation: Pick<AreaSituation, 'water'>): WaterStatusAssessment {
  const water = situation.water;
  const primary = water.primary_station;
  const stations = water.district_stations || [];

  if (water.status === 'unavailable' || !primary) {
    return {
      level: 'unavailable',
      levelTh: 'ข้อมูลระดับน้ำไม่พร้อมใช้งาน',
      trend: 'unknown',
      trendTh: 'ไม่มีข้อมูลเปรียบเทียบแนวโน้ม',
      primaryStationName: null,
      primaryStationCode: null,
      isStationInDistrict: false,
      nearbyDistrictName: null,
      currentLevelMsl: null,
      previousLevelMsl: null,
      changeM: null,
      diffBankM: null,
      timestamp: null,
      source: water.source,
      isTrendCalculated: false,
      stationCount: 0,
    };
  }

  // Trend is valid only when current and previous measurements exist
  const isTrendCalculated =
    primary.current_level_msl !== null &&
    primary.previous_level_msl !== null &&
    primary.change_m !== null;

  let trend = primary.trend;
  if (!isTrendCalculated) {
    trend = 'unknown';
  }

  const trendThMap: Record<string, string> = {
    rising: 'ระดับน้ำกำลังเพิ่มขึ้น (Rising)',
    falling: 'ระดับน้ำกำลังลดลง (Falling)',
    stable: 'ระดับน้ำทรงตัว (Stable)',
    unknown: 'ไม่มีข้อมูลเปรียบเทียบแนวโน้ม (Trend Unknown)',
  };

  // Check highest severity across available stations
  const maxLevel = Math.max(...stations.map((s) => s.situation_level || 1), primary.situation_level || 1);

  let statusLevel: WaterStatusAssessment['level'] = 'normal';
  let levelTh = 'ปกติ (Normal)';

  if (maxLevel >= 5) {
    statusLevel = 'overflow';
    levelTh = 'ล้นตลิ่ง (Overflow)';
  } else if (maxLevel === 4) {
    statusLevel = 'critical';
    levelTh = 'วิกฤต (Critical)';
  } else if (maxLevel === 3) {
    statusLevel = 'warning';
    levelTh = 'เตือนภัย (Warning)';
  } else if (maxLevel === 2) {
    statusLevel = 'watch';
    levelTh = 'เฝ้าระวัง (Watch)';
  }

  return {
    level: statusLevel,
    levelTh,
    trend,
    trendTh: trendThMap[trend] || trendThMap.unknown,
    primaryStationName: primary.station_name,
    primaryStationCode: primary.station_code,
    isStationInDistrict: !water.is_nearby_reference,
    nearbyDistrictName: water.nearby_district_name,
    currentLevelMsl: primary.current_level_msl,
    previousLevelMsl: primary.previous_level_msl,
    changeM: primary.change_m,
    diffBankM: primary.diff_bank_m,
    timestamp: primary.timestamp,
    source: primary.source,
    isTrendCalculated,
    stationCount: stations.length,
  };
}

/**
 * Dimension D: Evaluate Overall Flood Risk
 * Deterministic, auditable rule-based system integrating all dimensions.
 */
export function calculateFloodRisk(situation: AreaSituation): FloodRisk {
  const now = new Date().toISOString();
  const contributingFactors: ContributingFactor[] = [];
  const reasons: string[] = [];

  const rainRisk = evaluateRainRisk(situation);
  const waterStatus = evaluateWaterStatus(situation);
  const flood = situation.flood;
  const river = situation.river;

  let riskLevel: RiskLevel = 'normal';

  // 1. FACTOR: River Telemetry Station Status (Ground Truth for Water Overflow)
  if (waterStatus.level === 'overflow') {
    riskLevel = 'high';
    const desc = waterStatus.isStationInDistrict
      ? `สถานี ${waterStatus.primaryStationName} ตรวจพบระดับน้ำล้นตลิ่งแล้ว (สูงกว่าตลิ่ง ${waterStatus.diffBankM ?? ''} ม.)`
      : `สถานีตรวจวัดอ้างอิงใกล้เคียง (${waterStatus.primaryStationName} อ.${waterStatus.nearbyDistrictName}) ตรวจพบระดับน้ำล้นตลิ่ง`;
    reasons.push(desc);
    contributingFactors.push({
      dimension: 'water',
      titleTh: 'ระดับน้ำในลำน้ำล้นตลิ่ง',
      severity: 'critical',
      detailsTh: desc,
      value: waterStatus.currentLevelMsl ? `${waterStatus.currentLevelMsl} ม.รทก.` : null,
      source: waterStatus.source,
      timestamp: waterStatus.timestamp,
    });
  } else if (waterStatus.level === 'critical') {
    riskLevel = 'high';
    const desc = `ระดับน้ำสถานี ${waterStatus.primaryStationName} อยู่ในเกณฑ์วิกฤต (ใกล้แตะขอบตลิ่ง)`;
    reasons.push(desc);
    contributingFactors.push({
      dimension: 'water',
      titleTh: 'ระดับน้ำในลำน้ำวิกฤต',
      severity: 'high',
      detailsTh: desc,
      value: waterStatus.currentLevelMsl ? `${waterStatus.currentLevelMsl} ม.รทก.` : null,
      source: waterStatus.source,
      timestamp: waterStatus.timestamp,
    });
  } else if (waterStatus.level === 'warning') {
    riskLevel = 'increased';
    const desc = `ระดับน้ำสถานี ${waterStatus.primaryStationName} อยู่ในระดับเตือนภัย`;
    reasons.push(desc);
    contributingFactors.push({
      dimension: 'water',
      titleTh: 'ระดับน้ำในลำน้ำเตือนภัย',
      severity: 'moderate',
      detailsTh: desc,
      value: waterStatus.currentLevelMsl ? `${waterStatus.currentLevelMsl} ม.รทก.` : null,
      source: waterStatus.source,
      timestamp: waterStatus.timestamp,
    });
  } else if (waterStatus.level === 'watch') {
    if (riskLevel === 'normal') riskLevel = 'watch';
    const desc = `ระดับน้ำสถานี ${waterStatus.primaryStationName} อยู่ในระดับเฝ้าระวัง`;
    reasons.push(desc);
    contributingFactors.push({
      dimension: 'water',
      titleTh: 'ระดับน้ำในลำน้ำเฝ้าระวัง',
      severity: 'low',
      detailsTh: desc,
      value: waterStatus.currentLevelMsl ? `${waterStatus.currentLevelMsl} ม.รทก.` : null,
      source: waterStatus.source,
      timestamp: waterStatus.timestamp,
    });
  }

  // 1.1 Water Trend Impact
  if (waterStatus.trend === 'rising' && waterStatus.changeM && waterStatus.changeM > 0.05) {
    const trendNote = `สถานี ${waterStatus.primaryStationName} ตรวจวัดพบระดับน้ำมีแนวโน้มเพิ่มขึ้น (+${waterStatus.changeM} ม.)`;
    reasons.push(trendNote);
    contributingFactors.push({
      dimension: 'water',
      titleTh: 'แนวโน้มน้ำกำลังสูงขึ้น',
      severity: waterStatus.level === 'critical' || waterStatus.level === 'overflow' ? 'critical' : 'moderate',
      detailsTh: trendNote,
      value: `+${waterStatus.changeM} ม.`,
      source: waterStatus.source,
      timestamp: waterStatus.timestamp,
    });
  }

  // 2. FACTOR: Satellite Flood Evidence (GISTDA)
  if (flood.evidence_status === 'evidence_detected') {
    riskLevel = 'high';
    const areaKm = flood.flood_polygon_area_sqkm ? `ครอบคลุมพื้นที่ประมาณ ${flood.flood_polygon_area_sqkm} ตร.กม.` : '';
    const desc = `ภาพถ่ายดาวเทียมตรวจพบหลักฐานพื้นที่น้ำท่วมขังจริง ${areaKm}`;
    reasons.push(desc);
    contributingFactors.push({
      dimension: 'flood_evidence',
      titleTh: 'ตรวจพบหลักฐานน้ำท่วมจากดาวเทียม',
      severity: 'critical',
      detailsTh: desc,
      value: flood.flood_polygon_area_sqkm ? `${flood.flood_polygon_area_sqkm} ตร.กม.` : 'ตรวจพบรอยน้ำท่วม',
      source: flood.source,
      timestamp: flood.timestamp,
    });
  }

  // 3. FACTOR: Rain Risk (Precipitation accumulation & forecast)
  if (rainRisk.level === 'very_high') {
    if (riskLevel !== 'high') riskLevel = 'high';
    reasons.push(`ปริมาณฝนสะสม/พยากรณ์อยู่ในเกณฑ์ฝนตกหนักมาก (${rainRisk.forecast24hMm ?? rainRisk.observed24hMm} มม.)`);
    contributingFactors.push({
      dimension: 'rain',
      titleTh: 'ฝนตกหนักมากในพื้นที่',
      severity: 'high',
      detailsTh: rainRisk.reasons[0] || 'ฝนตกหนักมาก',
      value: `${rainRisk.forecast24hMm ?? rainRisk.observed24hMm ?? 0} มม.`,
      source: rainRisk.source,
      timestamp: rainRisk.timestamp,
    });
  } else if (rainRisk.level === 'high') {
    if (riskLevel === 'normal' || riskLevel === 'watch') riskLevel = 'increased';
    reasons.push(`ปริมาณฝนสะสม/พยากรณ์อยู่ในเกณฑ์ฝนตกหนัก (${rainRisk.forecast24hMm ?? rainRisk.observed24hMm} มม.)`);
    contributingFactors.push({
      dimension: 'rain',
      titleTh: 'ฝนตกหนักในพื้นที่',
      severity: 'moderate',
      detailsTh: rainRisk.reasons[0] || 'ฝนตกหนัก',
      value: `${rainRisk.forecast24hMm ?? rainRisk.observed24hMm ?? 0} มม.`,
      source: rainRisk.source,
      timestamp: rainRisk.timestamp,
    });
  } else if (rainRisk.level === 'moderate') {
    if (riskLevel === 'normal') riskLevel = 'watch';
    contributingFactors.push({
      dimension: 'rain',
      titleTh: 'มีฝนตกปานกลางในพื้นที่',
      severity: 'low',
      detailsTh: rainRisk.reasons[0] || 'ฝนตกปานกลาง',
      value: `${rainRisk.forecast24hMm ?? rainRisk.observed24hMm ?? 0} มม.`,
      source: rainRisk.source,
      timestamp: rainRisk.timestamp,
    });
  }

  // 4. FACTOR: River Discharge (GloFAS Modelled Flow)
  const discharge = river.discharge_m3s;
  if (discharge !== null && discharge >= RIVER_DISCHARGE_THRESHOLDS.CHAO_PHRAYA_M3S.CRITICAL_OVERFLOW.min) {
    if (riskLevel !== 'high') riskLevel = 'increased';
    const desc = `แบบจำลองการไหลของแม่น้ำเจ้าพระยา (GloFAS) คำนวณได้ ${discharge.toFixed(0)} ม.³/วิ (เกณฑ์วิกฤตระบายน้ำสูง)`;
    reasons.push(desc);
    contributingFactors.push({
      dimension: 'river',
      titleTh: 'แบบจำลองการไหลแม่น้ำเจ้าพระยาสูง',
      severity: 'high',
      detailsTh: desc,
      value: `${discharge.toFixed(0)} ม.³/วิ`,
      source: river.source,
      timestamp: river.timestamp,
    });
  } else if (discharge !== null && discharge >= RIVER_DISCHARGE_THRESHOLDS.CHAO_PHRAYA_M3S.WARNING_BANKFULL.min) {
    if (riskLevel === 'normal') riskLevel = 'watch';
    const desc = `แบบจำลองการไหลของแม่น้ำเจ้าพระยา (GloFAS) คำนวณได้ ${discharge.toFixed(0)} ม.³/วิ (เกณฑ์เฝ้าระวังปริ่มตลิ่ง)`;
    reasons.push(desc);
    contributingFactors.push({
      dimension: 'river',
      titleTh: 'แบบจำลองการไหลแม่น้ำเจ้าพระยาปริ่มตลิ่ง',
      severity: 'moderate',
      detailsTh: desc,
      value: `${discharge.toFixed(0)} ม.³/วิ`,
      source: river.source,
      timestamp: river.timestamp,
    });
  }

  // Check critical data unavailability
  if (waterStatus.level === 'unavailable' && rainRisk.level === 'unavailable') {
    riskLevel = 'unavailable';
    reasons.push('ข้อมูลโทรมาตรระดับน้ำและข้อมูลฝนไม่พร้อมใช้งาน ไม่สามารถคำนวณความเสี่ยงได้อย่างแม่นยำ');
  } else if (reasons.length === 0) {
    reasons.push('ระดับน้ำและปริมาณฝนอยู่ในเกณฑ์ปกติ ไม่พบปัจจัยเสี่ยงน้ำหลากล้นตลิ่งในขณะนี้');
  }

  // Determine Data Completeness
  let dataCompleteness: FloodRisk['dataCompleteness'] = 'complete';
  if (waterStatus.level === 'unavailable' || rainRisk.level === 'unavailable') {
    dataCompleteness = 'insufficient';
  } else if (flood.evidence_status === 'unavailable' || river.status === 'unavailable') {
    dataCompleteness = 'partial';
  }

  const levelThMap: Record<RiskLevel, { text: string; en: string; color: string }> = {
    high: { text: 'ความเสี่ยงสูง (High Risk - น้ำล้นตลิ่ง/ท่วมขัง)', en: 'High', color: '#ef4444' },
    increased: { text: 'ความเสี่ยงเพิ่มขึ้น (Increased Risk - เฝ้าระวังเข้มงวด)', en: 'Increased', color: '#f97316' },
    watch: { text: 'เฝ้าระวังสถานการณ์ (Watch)', en: 'Watch', color: '#eab308' },
    normal: { text: 'สถานการณ์ปกติ (Normal / Low Risk)', en: 'Normal', color: '#22c55e' },
    unavailable: { text: 'ข้อมูลไม่เพียงพอสำหรับสรุป (Unavailable)', en: 'Unavailable', color: '#94a3b8' },
  };

  return {
    level: riskLevel,
    levelTh: levelThMap[riskLevel].text,
    levelEn: levelThMap[riskLevel].en,
    color: levelThMap[riskLevel].color,
    reasons,
    contributingFactors,
    calculatedAt: now,
    methodologyVersion: RISK_ENGINE_VERSION,
    dataCompleteness,
    methodologyDescription:
      'ระบบคำนวณความเสี่ยงแบบกำหนดเกณฑ์โปร่งใส (Deterministic Auditable Engine) ตรวจสอบระดับน้ำจริง (ThaiWater 22 สถานี) + ฝนสะสม/พยากรณ์ (ThaiWater/Open-Meteo) + ดาวเทียมตรวจน้ำท่วม (GISTDA) + แบบจำลอง GloFAS',
  };
}
