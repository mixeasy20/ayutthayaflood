# FloodWatch Ayutthaya

ระบบติดตามสถานการณ์น้ำท่วม พยากรณ์ฝน ค่าตรวจวัดฝนจริงจากสถานีภาคพื้นดิน และภาพถ่ายดาวเทียมตรวจจับพื้นที่น้ำท่วมขัง สำหรับจังหวัดพระนครศรีอยุธยา

---

## แหล่งข้อมูลจริงในระบบ (4 มิติ)

1. **ปริมาณน้ำฝนตรวจวัดจริง (Ground Observation)**:
   - **ThaiWater / สสน. (HII)**: ข้อมูลตรวจวัดจริงจาก **32 สถานีทั่วพระนครศรีอยุธยา** (`/api/rainfall` และ `/api/rainfall-test`) ตามมาตรฐาน [standard.thaiwater.net](https://standard.thaiwater.net/) (Resource `/Rainfall`)
2. **หลักฐานพื้นที่น้ำท่วมขังจากดาวเทียม (Satellite Flood Inundation)**:
   - **GISTDA FloodCheck**: ตรวจจับพื้นที่น้ำท่วมขังจากภาพถ่ายดาวเทียม 1 วันล่าสุด (`/api/flood-event`)
3. **พยากรณ์อากาศและฝนล่วงหน้า (Rainfall Forecast)**:
   - **Open-Meteo**: พยากรณ์ฝนรายชั่วโมง 3 วันล่วงหน้า, ความน่าจะเป็น, อุณหภูมิ, ความชื้น (`/api/weather`)
4. **แบบจำลองอัตราการไหลของแม่น้ำ (River Discharge)**:
   - **GloFAS (Copernicus)**: อัตราการไหลของแม่น้ำ $m^3/s$ (`/api/flood`)
5. **ฐานข้อมูลคลาวด์ (Cloud Database)**:
   - **Supabase PostgreSQL**: จัดเก็บและจัดการข้อมูลเขตอำเภอ (`/api/supabase/health`)

---

## หลักการสำคัญของระบบ (Core Philosophy)

> **`พยากรณ์ฝน ≠ ค่าตรวจวัดฝนจริง ≠ ความเสี่ยงน้ำท่วม ≠ เหตุการณ์น้ำท่วมขังจริง`**
> - **ฝนตกหนัก** ไม่ได้แปลว่ามีน้ำท่วมขังเสมอไป
> - **น้ำท่วม** อาจเกิดจากน้ำเหนือไหลหลากแม้ในพื้นที่ไม่มีฝนตกเลย
> - **GISTDA FloodCheck** รายงานเฉพาะหลักฐานที่ดาวเทียมตรวจพบ ไม่นำค่าพยากรณ์มาแทนที่

---

## การตั้งค่า Environment Variables (`.env.local`)

```bash
# GISTDA Disaster Platform (สำหรับพื้นที่น้ำท่วมจากดาวเทียม)
GISTDA_API_KEY=your_gistda_api_key_here

# Supabase Cloud Database (สำหรับฐานข้อมูล)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_anon_key_here

# ThaiWater (Optional: ค่าเริ่มต้นใช้ HII Public Service ให้อัตโนมัติ)
# THAIWATER_API_BASE_URL=https://...
# THAIWATER_API_KEY=your_token_here
```

---

## การติดตั้งและรันโปรเจกต์

```bash
npm install
npm run dev
```
เปิดใช้งานที่: `http://localhost:3000`

---

## คู่มือสำหรับ AI & นักพัฒนา (Developer & AI Guide)
ดูรายละเอียดสถาปัตยกรรมและ Schema ทั้งหมดได้ที่ [`AGENTS.md`](./AGENTS.md)
