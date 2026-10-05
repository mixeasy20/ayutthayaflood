/**
 * Reusable Central Data Model for FloodWatch Ayutthaya Area Situation & Risk Engine
 * Strictly grounded in real verified environmental telemetry.
 */

export interface AreaLocation {
  province: string;
  district: string;
  subdistrict: string | null;
  latitude: number | null;
  longitude: number | null;
}

export type RainRiskLevel = 'none' | 'low' | 'moderate' | 'high' | 'very_high' | 'unavailable';

export interface RainRisk {
  level: RainRiskLevel;
  levelTh: string;
  levelEn: string;
  observed24hMm: number | null;
  observed1hMm: number | null;
  forecast24hMm: number | null;
  forecastProbabilityPct: number | null;
  intensityDescription: string;
  classificationType: 'tmd_official' | 'application_classification';
  source: string;
  timestamp: string | null;
  reasons: string[];
}

export interface RainSituation {
  status: 'available' | 'unavailable' | 'stale';
  observed_24h_mm: number | null;
  observed_1h_mm: number | null;
  observed_timestamp: string | null;
  observed_station_code: string | null;
  observed_station_name: string | null;
  forecast_24h_mm: number | null;
  forecast_probability_pct: number | null;
  intensity_status: string | null;
  source: string;
  freshness: string;
  rainRisk?: RainRisk;
}

export interface WaterStationReading {
  station_code: string;
  station_name: string;
  district: string;
  subdistrict: string | null;
  current_level_msl: number | null;
  previous_level_msl: number | null;
  change_m: number | null;
  trend: 'rising' | 'falling' | 'stable' | 'unknown';
  diff_bank_m: number | null;
  situation_level: number; // 1: Normal, 2: Watch, 3: Warning, 4: Critical, 5: Overflow
  situation_text: string;
  timestamp: string | null;
  source: string;
}

export interface WaterStatusAssessment {
  level: 'normal' | 'watch' | 'warning' | 'critical' | 'overflow' | 'unavailable';
  levelTh: string;
  trend: 'rising' | 'falling' | 'stable' | 'unknown';
  trendTh: string;
  primaryStationName: string | null;
  primaryStationCode: string | null;
  isStationInDistrict: boolean;
  nearbyDistrictName: string | null;
  currentLevelMsl: number | null;
  previousLevelMsl: number | null;
  changeM: number | null;
  diffBankM: number | null;
  timestamp: string | null;
  source: string;
  isTrendCalculated: boolean;
  stationCount: number;
}

export interface WaterSituation {
  status: 'available' | 'unavailable' | 'no_station_in_district';
  primary_station: WaterStationReading | null;
  district_stations: WaterStationReading[];
  is_nearby_reference: boolean;
  nearby_district_name: string | null;
  source: string;
  freshness: string;
  waterStatus?: WaterStatusAssessment;
}

export interface FloodEvidenceSituation {
  evidence_status: 'evidence_detected' | 'no_evidence_detected' | 'unavailable' | 'stale';
  flood_detected: boolean | null;
  actual_flood_locations: Array<{
    name: string;
    lat: number;
    lon: number;
  }>;
  flood_polygon_area_sqkm: number | null;
  confidence: string | null;
  timestamp: string | null;
  source: string;
  message?: string;
}

export interface RiverDischargeSituation {
  status: 'available' | 'unavailable';
  discharge_m3s: number | null;
  mean_discharge_m3s: number | null;
  max_discharge_m3s: number | null;
  timestamp: string | null;
  source: string;
  data_nature: 'modelled_forecast' | 'observed_telemetry';
}

export type RiskLevel = 'normal' | 'watch' | 'increased' | 'high' | 'unavailable';

export interface ContributingFactor {
  dimension: 'rain' | 'water' | 'river' | 'flood_evidence';
  titleTh: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  detailsTh: string;
  value: string | number | null;
  source: string;
  timestamp: string | null;
}

export interface FloodRisk {
  level: RiskLevel;
  levelTh: string;
  levelEn: string;
  color: string;
  reasons: string[];
  contributingFactors: ContributingFactor[];
  calculatedAt: string;
  methodologyVersion: string;
  dataCompleteness: 'complete' | 'partial' | 'insufficient';
  methodologyDescription: string;
}

// Backward compatible with existing app components
export interface RiskAssessment {
  overall_risk: 'low' | 'monitor' | 'elevated' | 'high' | 'awaiting';
  overall_risk_th: string;
  reasons: string[];
  methodology: string;
}

export interface AreaSituation {
  fetched_at: string;
  area: AreaLocation;
  rain: RainSituation;
  water: WaterSituation;
  flood: FloodEvidenceSituation;
  river: RiverDischargeSituation;
  risk: RiskAssessment;
  floodRisk?: FloodRisk;
  data_completeness: 'complete' | 'partial' | 'minimal';
}
