import { getGeminiClient, isGeminiConfigured } from '../../../../lib/ai/gemini';
import { getFloodWatchSystemPrompt } from '../../../../lib/ai/prompts';
import { getLiveWaterTelemetryContext } from '../../../../lib/ai/liveWaterContext';
import { getAreaSituation } from '../../../../lib/services/area-situation';
import { districts } from '../../../../lib/districts';

export const dynamic = 'force-dynamic';

interface ChatRequestBody {
  message?: unknown;
}

export async function POST(req: Request) {
  // 1. Verify API key
  if (!isGeminiConfigured()) {
    return Response.json(
      { error: 'missing_api_key', message: 'GEMINI_API_KEY is not configured on the server.' },
      { status: 503 }
    );
  }

  // 2. Parse and validate body
  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body || typeof body.message !== 'string' || body.message.trim() === '') {
    return Response.json(
      { error: 'invalid_request', message: 'Field "message" must be a non-empty string.' },
      { status: 400 }
    );
  }

  const userMessage = body.message.trim();

  // 3. Detect if user message mentions any specific district in Ayutthaya
  const matchedDistrict = districts.find(
    (d) => userMessage.includes(d.name) || userMessage.includes(`อ.${d.name}`) || userMessage.includes(`อำเภอ${d.name}`)
  );

  let systemInstruction: string;
  let dynamicContextPrefix = '';

  if (matchedDistrict) {
    // Ground response with full AreaSituation (Water + Rain + GloFAS + GISTDA + Risk)
    try {
      const situation = await getAreaSituation(matchedDistrict.name);
      dynamicContextPrefix = `\n[ข้อมูลตรวจวัดและวิเคราะห์สถานการณ์จริงล่าสุดของ ${situation.area.province} อำเภอ${situation.area.district}]:\n${JSON.stringify(situation, null, 2)}\n`;
    } catch {
      // fallback to water telemetry
    }
  }

  const liveTelemetryContext = await getLiveWaterTelemetryContext();
  systemInstruction = getFloodWatchSystemPrompt(
    dynamicContextPrefix ? `${dynamicContextPrefix}\n${liveTelemetryContext}` : liveTelemetryContext
  );

  // 4. Stream from Gemini — prioritized by currently operational & low-latency models
  const ai = getGeminiClient();
  const models = [
    process.env.GEMINI_MODEL,
    'gemini-3.5-flash-lite',      // Proven high-availability & fast ~1.2s response time
    'gemini-3.1-flash-lite',      // High-availability fallback
    'gemini-flash-lite-latest',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
  ].filter(Boolean) as string[];

  for (const model of models) {
    try {
      const stream = await ai.models.generateContentStream({
        model,
        contents: userMessage,
        config: {
          systemInstruction,
        },
      });

      // Stream chunks as Server-Sent Events so text appears progressively in the UI
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const text = chunk.text ?? '';
              if (text) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text, model })}\n\n`)
                );
              }
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        },
      });
    } catch (err: any) {
      const s = err?.status || err?.code || 0;
      const msg = String(err?.message || '');
      // If model is overloaded (503/429), deprecated/not found (404), or high demand -> try next model!
      if (s === 503 || s === 429 || s === 404 || msg.includes('503') || msg.includes('429') || msg.includes('high demand') || msg.includes('UNAVAILABLE')) {
        continue;
      }
      return Response.json(
        { error: err?.code || 'gemini_error', message: err?.message || 'Gemini error' },
        { status: typeof s === 'number' && s >= 400 && s < 600 ? s : 502 }
      );
    }
  }

  return Response.json(
    { error: 'all_models_unavailable', message: 'โมเดล AI กำลังมีผู้ใช้งานหนาแน่นในขณะนี้ กรุณาลองใหม่อีกครั้งใน 1-2 นาทีครับ' },
    { status: 503 }
  );
}
