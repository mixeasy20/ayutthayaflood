/**
 * Verified Water Control Infrastructure & Regulators impacting Ayutthaya
 * Data source: Royal Irrigation Department (RID / กรมชลประทาน)
 */

export interface WaterControlStructure {
  id: string;
  name: {
    th: string;
    en: string;
  };
  type: 'dam' | 'regulator_gate' | 'weir' | 'siphon';
  typeLabel: {
    th: string;
    en: string;
  };
  waterway: {
    th: string;
    en: string;
  };
  district?: {
    th: string;
    en: string;
  };
  province: {
    th: string;
    en: string;
  };
  lat: number;
  lon: number;
  agency: string;
  description: {
    th: string;
    en: string;
  };
}

export const WATER_CONTROL_STRUCTURES: WaterControlStructure[] = [
  {
    id: 'rama-6-dam',
    name: {
      th: 'เขื่อนพระราม 6',
      en: 'Rama VI Dam',
    },
    type: 'dam',
    typeLabel: {
      th: 'เขื่อนทดน้ำ (Barrage Dam)',
      en: 'Barrage Dam',
    },
    waterway: {
      th: 'แม่น้ำป่าสัก',
      en: 'Pasak River',
    },
    district: {
      th: 'ท่าเรือ',
      en: 'Tha Ruea',
    },
    province: {
      th: 'พระนครศรีอยุธยา',
      en: 'Phra Nakhon Si Ayutthaya',
    },
    lat: 14.5367,
    lon: 100.7303,
    agency: 'กรมชลประทาน (RID)',
    description: {
      th: 'เขื่อนทดน้ำแห่งแรกของไทย ควบคุมและทดน้ำในแม่น้ำป่าสักเข้าสู่คลองระพีพัฒน์และพื้นที่ลุ่มเจ้าพระยาฝั่งตะวันออก',
      en: 'First barrage dam in Thailand, regulating Pasak River flow into Raphiphat Canal and Eastern Chao Phraya plains.',
    },
  },
  {
    id: 'chao-phraya-dam',
    name: {
      th: 'เขื่อนเจ้าพระยา',
      en: 'Chao Phraya Dam',
    },
    type: 'dam',
    typeLabel: {
      th: 'เขื่อนทดน้ำหลัก (Key Upstream Barrage)',
      en: 'Key Upstream Barrage',
    },
    waterway: {
      th: 'แม่น้ำเจ้าพระยา',
      en: 'Chao Phraya River',
    },
    province: {
      th: 'ชัยนาท',
      en: 'Chai Nat',
    },
    lat: 15.1583,
    lon: 100.1794,
    agency: 'กรมชลประทาน (RID)',
    description: {
      th: 'เขื่อนทดน้ำหลักต้นน้ำ ควบคุมปริมาณน้ำหลากทั้งหมดในแม่น้ำเจ้าพระยาก่อนไหลเข้าสู่จังหวัดอยุธยา',
      en: 'Primary upstream barrage regulating total Chao Phraya flood discharge before reaching Ayutthaya Province.',
    },
  },
  {
    id: 'pasak-jolasid-dam',
    name: {
      th: 'เขื่อนป่าสักชลสิทธิ์',
      en: 'Pasak Jolasid Dam',
    },
    type: 'dam',
    typeLabel: {
      th: 'เขื่อนกักเก็บน้ำหลัก (Storage Dam)',
      en: 'Main Storage Dam',
    },
    waterway: {
      th: 'แม่น้ำป่าสัก',
      en: 'Pasak River',
    },
    province: {
      th: 'ลพบุรี / สระบุรี',
      en: 'Lopburi / Saraburi',
    },
    lat: 14.8608,
    lon: 101.0772,
    agency: 'กรมชลประทาน (RID)',
    description: {
      th: 'เขื่อนกักเก็บน้ำหลักในลุ่มน้ำป่าสัก ควบคุมการปล่อยน้ำลงสู่เขื่อนพระราม 6 และอยุธยา',
      en: 'Major storage reservoir in Pasak Basin, regulating release downstream toward Rama VI Dam and Ayutthaya.',
    },
  },
  {
    id: 'bang-ban-regulator',
    name: {
      th: 'ประตูระบายน้ำบางบาล',
      en: 'Bang Ban Water Regulator',
    },
    type: 'regulator_gate',
    typeLabel: {
      th: 'ประตูระบายน้ำ (Regulator Gate)',
      en: 'Water Regulator Gate',
    },
    waterway: {
      th: 'คลองบางบาล / แม่น้ำเจ้าพระยา',
      en: 'Khlong Bang Ban / Chao Phraya',
    },
    district: {
      th: 'บางบาล',
      en: 'Bang Ban',
    },
    province: {
      th: 'พระนครศรีอยุธยา',
      en: 'Phra Nakhon Si Ayutthaya',
    },
    lat: 14.3768,
    lon: 100.4851,
    agency: 'กรมชลประทาน (RID)',
    description: {
      th: 'ควบคุมการตัดยอดน้ำหลากและระบายน้ำเข้า-ออกพื้นที่ลุ่มต่ำทุ่งบางบาล',
      en: 'Regulates flood peak diversion and drainage in and out of the Bang Ban low-lying retention basin.',
    },
  },
  {
    id: 'sena-regulator',
    name: {
      th: 'ประตูระบายน้ำคลองเสนา',
      en: 'Sena Canal Water Regulator',
    },
    type: 'regulator_gate',
    typeLabel: {
      th: 'ประตูระบายน้ำ (Regulator Gate)',
      en: 'Water Regulator Gate',
    },
    waterway: {
      th: 'คลองเสนา / แม่น้ำน้อย',
      en: 'Khlong Sena / Noi River',
    },
    district: {
      th: 'เสนา',
      en: 'Sena',
    },
    province: {
      th: 'พระนครศรีอยุธยา',
      en: 'Phra Nakhon Si Ayutthaya',
    },
    lat: 14.3314,
    lon: 100.4042,
    agency: 'กรมชลประทาน (RID)',
    description: {
      th: 'ควบคุมระดับน้ำระหว่างแม่น้ำน้อยกับระบบคลองส่งน้ำและระบายน้ำเกษตรกรรมอำเภอเสนา',
      en: 'Controls water levels between Noi River and Sena agricultural canal drainage networks.',
    },
  },
  {
    id: 'phak-hai-regulator',
    name: {
      th: 'ประตูระบายน้ำผักไห่',
      en: 'Phak Hai Water Regulator',
    },
    type: 'regulator_gate',
    typeLabel: {
      th: 'ประตูระบายน้ำ (Regulator Gate)',
      en: 'Water Regulator Gate',
    },
    waterway: {
      th: 'แม่น้ำน้อย',
      en: 'Noi River',
    },
    district: {
      th: 'ผักไห่',
      en: 'Phak Hai',
    },
    province: {
      th: 'พระนครศรีอยุธยา',
      en: 'Phra Nakhon Si Ayutthaya',
    },
    lat: 14.4589,
    lon: 100.3705,
    agency: 'กรมชลประทาน (RID)',
    description: {
      th: 'ควบคุมการรับน้ำจากแม่น้ำน้อยเข้าสู่ทุ่งผักไห่และทุ่งเจ้าเจ็ดเพื่อชะลอน้ำหลาก',
      en: 'Regulates water intake from Noi River into Phak Hai and Chao Chet retention fields to buffer flood surges.',
    },
  },
  {
    id: 'bang-sai-regulator',
    name: {
      th: 'ประตูระบายน้ำบางไทร',
      en: 'Bang Sai Water Regulator',
    },
    type: 'regulator_gate',
    typeLabel: {
      th: 'ประตูระบายน้ำ (Regulator Gate)',
      en: 'Water Regulator Gate',
    },
    waterway: {
      th: 'คลองบางไทร / แม่น้ำเจ้าพระยา',
      en: 'Khlong Bang Sai / Chao Phraya',
    },
    district: {
      th: 'บางไทร',
      en: 'Bang Sai',
    },
    province: {
      th: 'พระนครศรีอยุธยา',
      en: 'Phra Nakhon Si Ayutthaya',
    },
    lat: 14.2185,
    lon: 100.5187,
    agency: 'กรมชลประทาน (RID)',
    description: {
      th: 'จุดระบายน้ำตอนใต้สุดของอยุธยา ควบคุมการไหลออกสู่ปทุมธานีและอ่าวไทย',
      en: 'Southernmost drainage exit of Ayutthaya, controlling downstream outflow toward Pathum Thani and the Gulf.',
    },
  },
  {
    id: 'chulamani-regulator',
    name: {
      th: 'ประตูระบายน้ำวัดจุฬามณี',
      en: 'Wat Chulamani Regulator',
    },
    type: 'regulator_gate',
    typeLabel: {
      th: 'ประตูระบายน้ำ (Regulator Gate)',
      en: 'Water Regulator Gate',
    },
    waterway: {
      th: 'คลองบางบาล',
      en: 'Khlong Bang Ban',
    },
    district: {
      th: 'บางบาล',
      en: 'Bang Ban',
    },
    province: {
      th: 'พระนครศรีอยุธยา',
      en: 'Phra Nakhon Si Ayutthaya',
    },
    lat: 14.3582,
    lon: 100.523,
    agency: 'กรมชลประทาน (RID)',
    description: {
      th: 'ควบคุมการระบายน้ำเชื่อมต่อระหว่างแม่น้ำเจ้าพระยากับคลองบางบาลตอนล่าง',
      en: 'Regulates water exchange between Chao Phraya River and lower Khlong Bang Ban canal network.',
    },
  },
];
