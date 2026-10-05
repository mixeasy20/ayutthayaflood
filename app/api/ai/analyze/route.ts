import { NextResponse } from 'next/server';
import { getGeminiClient, isGeminiConfigured } from '../../../../lib/ai/gemini';
import { getAreaSituation } from '../../../../lib/services/area-situation';
import type { AreaSituation } from '../../../../lib/types/situation';

export const dynamic = 'force-dynamic';

export const AI_ANALYSIS_SYSTEM_PROMPT = `You are the FloodWatch Ayutthaya Real-time Situation Analyst.
You are analyzing verified environmental telemetry, satellite flood observations, and deterministic Risk Engine results for Phra Nakhon Si Ayutthaya province.

CORE MANDATE - STRICT TRUTHFULNESS & ZERO HALLUCINATION:
1. You must ONLY use the provided structured AreaSituation and FloodRisk data.
2. NEVER invent, extrapolate, or guess rainfall, water levels, flood evidence, discharge, forecast values, timestamps, or locations.
3. NEVER claim an area is flooded without direct flood evidence.
4. NEVER claim an area is completely safe or not flooded merely because no evidence was found — explain the limitation of observation coverage.
5. NEVER convert forecast rain into observed rain. Clearly distinguish:
   - "ปริมาณฝนจริงที่ตรวจวัดได้ (Observed Rainfall)" vs
   - "ฝนพยากรณ์ล่วงหน้า 24 ชม. (Forecast Precipitation)"
6. Rain Risk (ระดับความรุนแรงของฝน) is strictly independent of Flood Risk (ความเสี่ยงน้ำท่วม). A low rain area can still have high flood risk if river water overflows!
7. NEVER convert modelled GloFAS river discharge into ground-truth station observations — state that it is a mathematical simulation model (แบบจำลองคาดการณ์).
8. NEVER claim an entire district has identical conditions when data is from individual point stations. State station name and whether it is within the district or a nearby reference station.
9. WATER TREND: Only state that water is rising or falling if supported by historical station readings (isTrendCalculated = true).
10. DATA CONFLICTS: If observations conflict (e.g., rainfall is 0 mm but river water is overflowing), explicitly explain why (e.g., overflow is caused by upstream dam discharge or runoff from upper basins, not local rainfall).
11. DO NOT INVENT OR RECALCULATE the risk score — you MUST use the exact overall_risk, levelTh, and contributingFactors provided in the Risk Engine block.
12. If data is unavailable or insufficient for any aspect, explicitly state: "ข้อมูลไม่เพียงพอสำหรับสรุป" or "ข้อมูลไม่พร้อมใช้งาน".

OUTPUT STRUCTURE (STRICT THAI FORMAT):
Structure your response clearly using markdown with this exact hierarchy:

### 📋 สถานการณ์ล่าสุด: [อำเภอ] (ข้อมูล ณ [เวลา])

🌧️ **สถานการณ์ฝน (Rain Risk)**
- **ฝนตรวจวัดจริง:** [ระบุค่าที่วัดได้จริง สถานี และเวลา หรือระบุหากไม่มีข้อมูล]
- **พยากรณ์ล่วงหน้า 24 ชม.:** [ปริมาณฝนคาดการณ์ และโอกาสเกิดฝนตก %]
- **ระดับความรุนแรงของฝน:** [ระบุค่า Rain Risk เช่น ฝนเล็กน้อย, ปานกลาง หรือ ฝนตกหนักมาก]

🌊 **สถานการณ์น้ำในลำน้ำ (Water Status)**
- **สถานีตรวจวัด:** [ชื่อสถานี และระบุว่าเป็นสถานีในพื้นที่ หรือสถานีอ้างอิงของอำเภอข้างเคียง]
- **ระดับน้ำปัจจุบัน:** [ระดับน้ำ ม.รทก. และระยะห่างจากตลิ่ง/ล้นตลิ่งกี่เมตร]
- **แนวโน้มการเปลี่ยนแปลง:** [ทรงตัว / กำลังขึ้น (+...ม.) / กำลังลดลง (-...ม.)]

🗺️ **หลักฐานร่องรอยน้ำท่วม (Flood Evidence - GISTDA)**
- [ระบุผลการตรวจสอบภาพถ่ายดาวเทียม GISTDA: ตรวจพบร่องรอยน้ำท่วมขังหรือไม่ หรือข้อมูลไม่พร้อมใช้งาน พร้อมระบุว่าการไม่พบหลักฐานไม่ได้แปลว่าไม่มีน้ำท่วมในจุดที่ดาวเทียมมองไม่เห็น]

⚠️ **การประเมินความเสี่ยงน้ำท่วมภาพรวม (Overall Flood Risk - Risk Engine)**
- **ระดับความเสี่ยง:** [ใช้ค่า levelTh จาก Risk Engine เท่านั้น เช่น เสี่ยงสูง / เฝ้าระวัง / ปกติ]
- **ปัจจัยที่ส่งผลต่อความเสี่ยง (Contributing Factors):** [สรุปปัจจัยจริงที่นำมาคำนวณ เช่น ระดับน้ำล้นตลิ่ง, ปริมาณฝน หรือการระบายน้ำ]
- **คำอธิบายความสอดคล้อง/ความขัดแย้งของข้อมูล:** [อธิบายความสัมพันธ์ เช่น ฝนในพื้นที่ไม่ตกแต่น้ำล้นจากแม่น้ำสายหลัก]

📌 **ข้อควรติดตามและคำแนะนำ**
- [ข้อแนะนำที่เหมาะสมสำหรับประชาชนในพื้นที่ลุ่มต่ำ/ริมน้ำ และหมายเลขฉุกเฉิน ปภ. 1784 / ชลประทาน 1460]

📊 **แหล่งที่มาของข้อมูลและความสมบูรณ์:**
- ThaiWater / กรมชลประทาน (ระดับน้ำและฝนจริง)
- Open-Meteo (พยากรณ์อากาศ)
- GloFAS (แบบจำลองการไหลของน้ำ)
- GISTDA FloodCheck (ดาวเทียม)
`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const district = searchParams.get('district') || 'พระนครศรีอยุธยา';
  const subdistrict = searchParams.get('subdistrict') || undefined;

  return handleAnalysis(district, subdistrict);
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const district = body.district || 'พระนครศรีอยุธยา';
  const subdistrict = body.subdistrict || undefined;
  const userQuestion = body.question || undefined;

  return handleAnalysis(district, subdistrict, userQuestion);
}

async function handleAnalysis(district: string, subdistrict?: string, question?: string) {
  // 1. Gather real AreaSituation data
  let situation: AreaSituation;
  try {
    situation = await getAreaSituation(district, subdistrict);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'failed_to_gather_data', message: err?.message || 'Could not assemble area situation' },
      { status: 502 }
    );
  }

  // 2. If Gemini is not configured, return the structured data directly
  if (!isGeminiConfigured()) {
    return NextResponse.json({
      situation,
      analysis: null,
      message: 'GEMINI_API_KEY is not configured. Returning raw structured data.',
    });
  }

  // 3. Generate analysis from Gemini using the grounded JSON
  try {
    const ai = getGeminiClient();
    const models = [
      process.env.GEMINI_MODEL,
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
    ].filter(Boolean) as string[];

    const userPrompt = question
      ? `โปรดตอบคำถามของผู้ใช้: "${question}" โดยวิเคราะห์จากข้อมูลสถานการณ์จริงของ ${situation.area.province} อำเภอ${situation.area.district} ต่อไปนี้:\n\n${JSON.stringify(situation, null, 2)}`
      : `โปรดวิเคราะห์สถานการณ์น้ำ ฝน และความเสี่ยงของ ${situation.area.province} อำเภอ${situation.area.district} ตามโครงสร้างที่กำหนด จากข้อมูลจริงต่อไปนี้:\n\n${JSON.stringify(situation, null, 2)}`;

    let analysisText = '';
    let usedModel = models[0];

    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            systemInstruction: AI_ANALYSIS_SYSTEM_PROMPT,
          },
        });
        const text = response.text || '';
        if (text) {
          analysisText = text;
          usedModel = model;
          break;
        }
      } catch (err: any) {
        const s = err?.status || err?.code || 0;
        const msg = String(err?.message || '');
        if (s === 503 || s === 429 || s === 404 || msg.includes('503') || msg.includes('429') || msg.includes('high demand') || msg.includes('UNAVAILABLE')) {
          continue;
        }
        throw err;
      }
    }

    if (!analysisText) {
      throw new Error('All models failed to return content');
    }

    return NextResponse.json({
      situation,
      analysis: analysisText,
      model: usedModel,
      provider: 'Google Gemini',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[AI Analysis Error]:', err);
    // Return situation data even if Gemini generation had an issue
    return NextResponse.json({
      situation,
      analysis: `เกิดข้อผิดพลาดในการประมวลผลคำอธิบายจาก AI (${err?.message || 'Gemini error'}) อย่างไรก็ดี ท่านสามารถดูข้อมูลตรวจวัดจริงด้านบนได้ครับ`,
      model: 'none',
      error: err?.message,
    });
  }
}
