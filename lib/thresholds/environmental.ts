/**
 * Centralized Rainfall and Environmental Threshold Configurations
 *
 * Clearly distinguishes between:
 * - TMD_OFFICIAL: Official Thai Meteorological Department 24h classification standards
 * - APP_CLASSIFICATION: Application-level risk evaluation thresholds
 */

export const RAINFALL_THRESHOLDS = {
  // Official TMD standard 24-hour rainfall classification (กรมอุตุนิยมวิทยา)
  TMD_OFFICIAL_24H: {
    VERY_HEAVY: { min: 90.1, labelTh: 'ฝนตกหนักมาก', labelEn: 'Very Heavy Rain', source: 'Thai Meteorological Department (TMD)' },
    HEAVY: { min: 35.1, max: 90.0, labelTh: 'ฝนตกหนัก', labelEn: 'Heavy Rain', source: 'Thai Meteorological Department (TMD)' },
    MODERATE: { min: 10.1, max: 35.0, labelTh: 'ฝนปานกลาง', labelEn: 'Moderate Rain', source: 'Thai Meteorological Department (TMD)' },
    LIGHT: { min: 0.1, max: 10.0, labelTh: 'ฝนเล็กน้อย', labelEn: 'Light Rain', source: 'Thai Meteorological Department (TMD)' },
    NONE: { max: 0.0, labelTh: 'ไม่มีฝน', labelEn: 'No Rain', source: 'Thai Meteorological Department (TMD)' },
  },

  // Application Rain Risk classification (Rain intensity only — NOT flood risk)
  APP_RAIN_RISK: {
    VERY_HIGH: {
      min24hMm: 90.0,
      min1hMm: 35.0,
      labelTh: 'ระดับสูงมาก (Very High Rain Intensity)',
      labelEn: 'Very High',
      color: '#ef4444',
      type: 'application_classification',
      description: 'เกณฑ์ระบบ: ฝนตกสะสม 24 ชม. เกิน 90 มม. หรือฝนหนักชั่วโมงละเกิน 35 มม.',
    },
    HIGH: {
      min24hMm: 50.0,
      min1hMm: 20.0,
      labelTh: 'ระดับสูง (High Rain Intensity)',
      labelEn: 'High',
      color: '#f97316',
      type: 'application_classification',
      description: 'เกณฑ์ระบบ: ฝนตกสะสม 24 ชม. 50-90 มม. หรือฝนหนักชั่วโมงละ 20-35 มม.',
    },
    MODERATE: {
      min24hMm: 20.0,
      min1hMm: 10.0,
      labelTh: 'ระดับปานกลาง (Moderate Rain Intensity)',
      labelEn: 'Moderate',
      color: '#eab308',
      type: 'application_classification',
      description: 'เกณฑ์ระบบ: ฝนสะสม 24 ชม. 20-50 มม. หรือฝนชั่วโมงละ 10-20 มม.',
    },
    LOW: {
      min24hMm: 0.1,
      min1hMm: 0.1,
      labelTh: 'ระดับต่ำ (Low Rain Intensity)',
      labelEn: 'Low',
      color: '#06b6d4',
      type: 'application_classification',
      description: 'เกณฑ์ระบบ: ฝนตกเล็กน้อย ต่ำกว่า 20 มม./24 ชม.',
    },
    NONE: {
      maxMm: 0.0,
      labelTh: 'ไม่มีฝน (No Rain)',
      labelEn: 'None',
      color: '#64748b',
      type: 'application_classification',
      description: 'เกณฑ์ระบบ: ไม่พบปริมาณฝนตรวจวัดในรอบ 24 ชั่วโมง',
    },
  },
} as const;

export const WATER_LEVEL_THRESHOLDS = {
  // Situation levels based on ThaiWater / RID criteria
  SITUATION_LEVELS: {
    OVERFLOW: { level: 5, labelTh: 'ล้นตลิ่ง', labelEn: 'Overflow', color: '#ef4444' },
    CRITICAL: { level: 4, labelTh: 'วิกฤต', labelEn: 'Critical', color: '#dc2626' },
    WARNING: { level: 3, labelTh: 'เตือนภัย', labelEn: 'Warning', color: '#f97316' },
    WATCH: { level: 2, labelTh: 'เฝ้าระวัง', labelEn: 'Watch', color: '#eab308' },
    NORMAL: { level: 1, labelTh: 'ปกติ', labelEn: 'Normal', color: '#0284c7' },
  },
  // Minimum difference threshold in meters to declare a trend as rising or falling
  TREND_MIN_DELTA_M: 0.02,
} as const;

export const RIVER_DISCHARGE_THRESHOLDS = {
  // Chao Phraya river flow threshold at C.13 / C.29 stations in m³/s (Application benchmark)
  CHAO_PHRAYA_M3S: {
    CRITICAL_OVERFLOW: { min: 2800, labelTh: 'วิกฤตล้นตลิ่งรุนแรง (> 2,800 ลบ.ม./วินาที)' },
    WARNING_BANKFULL: { min: 2000, max: 2800, labelTh: 'เฝ้าระวังระดับน้ำปริ่มตลิ่ง (2,000 - 2,800 ลบ.ม./วินาที)' },
    ALERT: { min: 1500, max: 2000, labelTh: 'เริ่มส่งผลกระทบพื้นที่ลุ่มต่ำนอกคันกั้นน้ำ (1,500 - 2,000 ลบ.ม./วินาที)' },
    NORMAL: { max: 1500, labelTh: 'ระบายน้ำในเกณฑ์ปกติ (< 1,500 ลบ.ม./วินาที)' },
  },
} as const;
