export type Locale = 'en' | 'th';
export type RiskKey = 'awaiting' | 'high' | 'elevated' | 'monitor' | 'low';

export type AppMessages = {
  tagline: string;
  selectDistrict: string;
  notifications: string;
  refresh: string;
  installTitle: string;
  installSubtitle: string;
  provinceArea: (districtName: string) => string;
  floodRisk: string;
  riskNames: Record<RiskKey, string>;
  awaitingRisk: string;
  forecastRainfall24: (value: string) => string;
  maxRainProbability: (value: number | string) => string;
  modelledFlowToday: (value: string) => string;
  noHeavyRain: string;
  rainfallMetric: string;
  probabilityMetric: string;
  flowMetric: string;
  currentFloodEvidence: string;
  checkingFlood: string;
  floodEvidence: string;
  noConfirmedFlood: string;
  dataUnavailable: string;
  satelliteScanActive: string;
  satelliteScanConfidence: string;
  historicalArchiveCount: (count: number) => string;
  noHistoricalEvents: string;
  coordinates: string;
  source: string;
  sourceTimestamp: string;
  lastUpdated: string;
  matched: string;
  returned: string;
  observedConditions: string;
  noObservationStations: string;
  observationDisclaimer: string;
  noObservationSource: string;
  liveObservationConnected: (count: number) => string;
  maxObservedRainfall: (station: string, val: number) => string;
  rainfall24hLabel: string;
  rainfall1hLabel: string;
  stationsCount: (count: number) => string;
  rainfallMapLayer: string;
  rainfallForecast: string;
  loadingForecast: string;
  chance: (value: number) => string;
  ayutthayaDistricts: string;
  dataSources: string;
  flowModelContext: string;
  floodEvidenceSource: string;
  installStatus: string;
  unableToLoad: string;
  notificationsUnsupported: string;
  notificationsEnabled: string;
  notificationsDenied: string;
  timestampUnavailable: string;
  mapTitle: string;
  mapSubtitle: (count: number) => string;
  mapLoading: string;
  mapUnavailable: string;
  mapLoadError: string;
  tryAgain: string;
  mapControls: string;
  zoomIn: string;
  zoomOut: string;
  resetView: string;
  myLocation: string;
  locationUnavailable: string;
  requestingLocation: string;
  locationShown: string;
  locationDenied: string;
  locationPositionUnavailable: string;
  locationTimeout: string;
  boundaryCredits: string;
  locationPrivacy: string;
  statusFormula: string;
};

export const messages: Record<Locale, AppMessages> = {
  en: {
    tagline: 'Forecasts, flood risk, and verified flood evidence',
    selectDistrict: 'Select district',
    notifications: 'Notifications',
    refresh: 'Refresh data',
    installTitle: 'Install FloodWatch',
    installSubtitle: 'Progressive web app',
    provinceArea: (districtName) => `Ayutthaya Province / ${districtName}`,
    floodRisk: 'Flood Risk',
    riskNames: {
      awaiting: 'Awaiting forecast',
      high: 'High risk',
      elevated: 'Elevated risk',
      monitor: 'Monitor conditions',
      low: 'Low forecast risk',
    },
    awaitingRisk: 'Risk cannot be estimated until forecast data is available.',
    forecastRainfall24: (value) => `Forecast rainfall (24h): ${value} mm`,
    maxRainProbability: (value) => `Maximum precipitation probability: ${value}%`,
    modelledFlowToday: (value) => `Modelled flow today: ${value} m³/s`,
    noHeavyRain: 'No heavy rainfall signal in the 24-hour forecast.',
    rainfallMetric: 'Forecast Rainfall (24h)',
    probabilityMetric: 'Max Rain Probability',
    flowMetric: 'Modelled Flow Today',
    currentFloodEvidence: 'Current Flood Evidence',
    checkingFlood: 'Scanning GISTDA Satellite Radar…',
    floodEvidence: 'Satellite radar detected active flood inundation in this area',
    noConfirmedFlood: 'No flood inundation detected by satellite (24h)',
    dataUnavailable: 'Data unavailable / Provider offline',
    satelliteScanActive: 'GISTDA Satellite Radar Connected',
    satelliteScanConfidence: 'High (Synthetic Aperture Radar)',
    historicalArchiveCount: (count) => `Historical flood archives: ${count} recorded events`,
    noHistoricalEvents: 'No historical flood records in local database',
    coordinates: 'Coordinates',
    source: 'Source',
    sourceTimestamp: 'Source timestamp',
    lastUpdated: 'Last updated',
    matched: 'Matched',
    returned: 'Returned',
    observedConditions: 'Observed Conditions',
    noObservationStations: 'No live observation stations are connected.',
    observationDisclaimer: 'Forecasts and model outputs are not presented as measured values.',
    noObservationSource: 'No observation provider connected',
    liveObservationConnected: (count) => `Live ground rainfall data connected (${count} stations across Ayutthaya)`,
    maxObservedRainfall: (station, val) => `Max 24h observed: ${val.toFixed(1)} mm at ${station}`,
    rainfall24hLabel: '24h Rainfall (Observed)',
    rainfall1hLabel: '1h Rainfall (Observed)',
    stationsCount: (count) => `${count} stations`,
    rainfallMapLayer: 'ThaiWater Rainfall Stations',
    rainfallForecast: 'Rainfall Forecast',
    loadingForecast: 'Loading forecast…',
    chance: (value) => `Chance ${value}%`,
    ayutthayaDistricts: 'Ayutthaya Districts',
    dataSources: 'Data Sources',
    flowModelContext: 'Flow model, for risk context only',
    floodEvidenceSource: 'Flood evidence',
    installStatus: 'PWA',
    unableToLoad: 'Unable to load data from one or more sources.',
    notificationsUnsupported: 'Notifications are not supported in this browser.',
    notificationsEnabled: 'Notifications enabled.',
    notificationsDenied: 'Notification permission was not granted.',
    timestampUnavailable: 'No timestamp available',
    mapTitle: 'Ayutthaya Province',
    mapSubtitle: (count) => `Province boundary · ${count} districts`,
    mapLoading: 'Loading map…',
    mapUnavailable: 'Map unavailable',
    mapLoadError: 'The province map could not be loaded. Check the local boundary data.',
    tryAgain: 'Try again',
    mapControls: 'Map controls',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    resetView: 'Reset View',
    myLocation: 'My Location',
    locationUnavailable: 'Location is not available in this browser.',
    requestingLocation: 'Requesting your location…',
    locationShown: 'Your location is shown on this device only.',
    locationDenied: 'Location permission was denied. You can enable it in your browser settings.',
    locationPositionUnavailable: 'Your current location is unavailable.',
    locationTimeout: 'Location request timed out. Please try again.',
    boundaryCredits: 'Boundaries: geoBoundaries ADM1 (ODbL 1.0) · ADM2 (CC BY 3.0 IGO)',
    locationPrivacy: 'Your location stays on this device.',
    statusFormula: 'Forecast ≠ Observation ≠ Flood Risk ≠ Flood Event',
  },
  th: {
    tagline: 'พยากรณ์ ความเสี่ยง และหลักฐานน้ำท่วม',
    selectDistrict: 'เลือกอำเภอ',
    notifications: 'การแจ้งเตือน',
    refresh: 'รีเฟรชข้อมูล',
    installTitle: 'ติดตั้ง FloodWatch',
    installSubtitle: 'เว็บแอป Progressive Web App',
    provinceArea: (districtName) => `จังหวัดพระนครศรีอยุธยา / ${districtName}`,
    floodRisk: 'ความเสี่ยงน้ำท่วม',
    riskNames: {
      awaiting: 'รอข้อมูลพยากรณ์',
      high: 'ความเสี่ยงสูง',
      elevated: 'ความเสี่ยงเพิ่มขึ้น',
      monitor: 'เฝ้าระวัง',
      low: 'ความเสี่ยงจากพยากรณ์ต่ำ',
    },
    awaitingRisk: 'ยังประเมินความเสี่ยงไม่ได้จนกว่าจะมีข้อมูลพยากรณ์',
    forecastRainfall24: (value) => `ฝนพยากรณ์ 24 ชม.: ${value} มม.`,
    maxRainProbability: (value) => `โอกาสฝนสูงสุด: ${value}%`,
    modelledFlowToday: (value) => `แบบจำลองการไหลวันนี้: ${value} ม³/วินาที`,
    noHeavyRain: 'พยากรณ์ยังไม่พบสัญญาณฝนหนักใน 24 ชั่วโมง',
    rainfallMetric: 'ฝนพยากรณ์ 24 ชม.',
    probabilityMetric: 'โอกาสฝนสูงสุด',
    flowMetric: 'แบบจำลองการไหลวันนี้',
    currentFloodEvidence: 'หลักฐานน้ำท่วมปัจจุบัน (GISTDA)',
    checkingFlood: 'กำลังสแกนเรดาร์ดาวเทียม GISTDA…',
    floodEvidence: 'เรดาร์ดาวเทียมตรวจพบร่องรอยน้ำท่วมขังในพื้นที่นี้',
    noConfirmedFlood: 'ไม่พบร่องรอยน้ำท่วมขังจากดาวเทียมใน 24 ชม. ล่าสุด',
    dataUnavailable: 'ข้อมูลดาวเทียมไม่พร้อมใช้งานชั่วคราว',
    satelliteScanActive: 'เชื่อมต่อเรดาร์ดาวเทียม GISTDA สด',
    satelliteScanConfidence: 'สูง (ภาพถ่ายเรดาร์ SAR)',
    historicalArchiveCount: (count) => `บันทึกน้ำท่วมในอดีต: ${count} เหตุการณ์`,
    noHistoricalEvents: 'ไม่มีประวัติน้ำท่วมขังบันทึกในฐานข้อมูล',
    coordinates: 'พิกัด',
    source: 'แหล่งข้อมูล',
    sourceTimestamp: 'เวลาจากแหล่งข้อมูล',
    lastUpdated: 'อัปเดตล่าสุด',
    matched: 'ตรงเงื่อนไข',
    returned: 'ส่งกลับ',
    observedConditions: 'ค่าตรวจวัดฝนจริง (ThaiWater)',
    noObservationStations: 'ยังไม่มีสถานีตรวจวัดจริงเชื่อมต่อ',
    observationDisclaimer: 'ไม่นำค่าพยากรณ์หรือแบบจำลองมาแสดงเป็นค่าตรวจวัดจริง',
    noObservationSource: 'ไม่มีแหล่งข้อมูลตรวจวัดจริง',
    liveObservationConnected: (count) => `เชื่อมต่อข้อมูลฝนตรวจวัดจริงแล้ว (${count} สถานีทั่วอยุธยา)`,
    maxObservedRainfall: (station, val) => `ฝนสะสม 24 ชม. สูงสุด: ${val.toFixed(1)} มม. ที่สถานี${station}`,
    rainfall24hLabel: 'ฝนสะสม 24 ชม. (ตรวจวัดจริง)',
    rainfall1hLabel: 'ฝนสะสม 1 ชม. (ตรวจวัดจริง)',
    stationsCount: (count) => `${count} สถานี`,
    rainfallMapLayer: 'สถานีตรวจวัดน้ำฝน ThaiWater',
    rainfallForecast: 'พยากรณ์ฝน',
    loadingForecast: 'กำลังโหลดพยากรณ์…',
    chance: (value) => `โอกาส ${value}%`,
    ayutthayaDistricts: 'อำเภอในอยุธยา',
    dataSources: 'แหล่งข้อมูล',
    flowModelContext: 'แบบจำลองการไหล ใช้ประกอบความเสี่ยงเท่านั้น',
    floodEvidenceSource: 'หลักฐานพื้นที่น้ำท่วม',
    installStatus: 'PWA',
    unableToLoad: 'ไม่สามารถโหลดข้อมูลจากบางแหล่งได้',
    notificationsUnsupported: 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน',
    notificationsEnabled: 'เปิดการแจ้งเตือนแล้ว',
    notificationsDenied: 'ยังไม่ได้รับอนุญาตให้แจ้งเตือน',
    timestampUnavailable: 'ไม่มีเวลาของข้อมูล',
    mapTitle: 'จังหวัดพระนครศรีอยุธยา',
    mapSubtitle: (count) => `ขอบเขตจังหวัด · ${count} อำเภอ`,
    mapLoading: 'กำลังโหลดแผนที่…',
    mapUnavailable: 'แผนที่ไม่พร้อมใช้งาน',
    mapLoadError: 'โหลดแผนที่จังหวัดไม่ได้ โปรดตรวจสอบไฟล์ขอบเขตในเครื่อง',
    tryAgain: 'ลองอีกครั้ง',
    mapControls: 'เครื่องมือแผนที่',
    zoomIn: 'ซูมเข้า',
    zoomOut: 'ซูมออก',
    resetView: 'กลับไปที่อยุธยา',
    myLocation: 'ตำแหน่งของฉัน',
    locationUnavailable: 'เบราว์เซอร์นี้ไม่สามารถระบุตำแหน่งได้',
    requestingLocation: 'กำลังขอตำแหน่งของคุณ…',
    locationShown: 'แสดงตำแหน่งนี้บนอุปกรณ์ของคุณเท่านั้น',
    locationDenied: 'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง เปลี่ยนสิทธิ์ได้ในการตั้งค่าเบราว์เซอร์',
    locationPositionUnavailable: 'ไม่สามารถระบุตำแหน่งปัจจุบันได้',
    locationTimeout: 'หมดเวลาระบุตำแหน่ง โปรดลองอีกครั้ง',
    boundaryCredits: 'ขอบเขต: geoBoundaries ADM1 (ODbL 1.0) · ADM2 (CC BY 3.0 IGO)',
    locationPrivacy: 'ตำแหน่งของคุณอยู่บนอุปกรณ์นี้เท่านั้น',
    statusFormula: 'พยากรณ์ ≠ ค่าตรวจวัดจริง ≠ ความเสี่ยงน้ำท่วม ≠ เหตุการณ์น้ำท่วม',
  },
};

export const districtNamesThByCode: Record<string, string> = {
  '78962969B93937525115566': 'บางบาล',
  '78962969B12192393501307': 'บางปะหัน',
  '78962969B94424905183361': 'บางปะอิน',
  '78962969B26505935473539': 'บางไทร',
  '78962969B611560347556': 'บางซ้าย',
  '78962969B33149444798126': 'บ้านแพรก',
  '78962969B9054765011768': 'ลาดบัวหลวง',
  '78962969B63768229045772': 'มหาราช',
  '78962969B25127824305120': 'นครหลวง',
  '78962969B2031869857401': 'ภาชี',
  '78962969B77944548728252': 'ผักไห่',
  '78962969B15942215938926': 'พระนครศรีอยุธยา',
  '78962969B95009717183464': 'เสนา',
  '78962969B60015542915267': 'ท่าเรือ',
  '78962969B29377906715784': 'อุทัย',
  '78962969B3503763709973': 'วังน้อย',
};

export const districtNamesEnByThai: Record<string, string> = {
  'พระนครศรีอยุธยา': 'Phra Nakhon Si Ayutthaya',
  'ท่าเรือ': 'Tha Ruea',
  'นครหลวง': 'Nakhon Luang',
  'บางไทร': 'Bang Sai',
  'บางบาล': 'Bang Ban',
  'บางปะอิน': 'Bang Pa-In',
  'บางปะหัน': 'Bang Pahan',
  'บางซ้าย': 'Bang Sai',
  'บ้านแพรก': 'Ban Phraek',
  'ผักไห่': 'Phak Hai',
  'ภาชี': 'Phachi',
  'ลาดบัวหลวง': 'Lat Bua Luang',
  'วังน้อย': 'Wang Noi',
  'เสนา': 'Sena',
  'อุทัย': 'Uthai',
  'มหาราช': 'Maha Rat',
};