'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: string;
  meta?: {
    model?: string;
    durationMs?: number;
    errorType?: string;
  };
}

const SAMPLE_QUESTIONS = [
  'อำเภอวังน้อยตอนนี้สถานการณ์น้ำเป็นอย่างไร?',
  'อำเภอเสนาน้ำท่วมไหม มีจุดไหนล้นตลิ่งบ้าง?',
  'ระดับน้ำที่เกาะเมืองพระนครศรีอยุธยาและบางปะอินตอนนี้เป็นอย่างไร?',
  'What is FloodWatch Ayutthaya and how does it work?',
];

export default function AiTestPage() {
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRawResponse, setLastRawResponse] = useState<any>(null);

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const newMessages: ChatMessage[] = [
      ...messages,
      {
        id: userMsgId,
        role: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString(),
      },
    ];

    setMessages(newMessages);
    setInputMessage('');
    setLoading(true);
    setLastRawResponse(null);

    const startTime = performance.now();
    const assistantId = `ai-${Date.now()}`;

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json();
        setMessages([
          ...newMessages,
          {
            id: `err-${Date.now()}`,
            role: 'error',
            content: data.message || `API Error (HTTP ${res.status}): ${data.error || 'Unknown error'}`,
            timestamp: new Date().toLocaleTimeString(),
            meta: { durationMs: Math.round(performance.now() - startTime), errorType: data.error },
          },
        ]);
        return;
      }

      // Add a placeholder assistant message that will be filled progressively
      setMessages([
        ...newMessages,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: new Date().toLocaleTimeString(),
          meta: { model: undefined, durationMs: undefined },
        },
      ]);

      // Read SSE stream and append each chunk
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let usedModel = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE lines are separated by \n\n
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            fullText += parsed.text ?? '';
            usedModel = parsed.model ?? usedModel;
            // Update the assistant bubble in place
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: fullText, meta: { model: usedModel, durationMs: Math.round(performance.now() - startTime) } }
                  : m
              )
            );
          } catch {
            // skip malformed chunk
          }
        }
      }
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      setMessages([
        ...newMessages,
        {
          id: `err-${Date.now()}`,
          role: 'error',
          content: err?.message || 'Network error failed to communicate with /api/ai/chat',
          timestamp: new Date().toLocaleTimeString(),
          meta: { durationMs: elapsed },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };


  const clearChat = () => {
    setMessages([]);
    setLastRawResponse(null);
  };

  return (
    <div
      className="chat-page"
      style={{
        minHeight: '100vh',
        background: '#0a0f18',
        color: '#f1f5f9',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '24px 16px',
      }}
    >
      <div className="chat-shell" style={{ maxWidth: '840px', margin: '0 auto' }}>
        {/* Header */}
        <div
          className="chat-header"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: '1px solid #1e293b',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#38bdf8' }}>
                🌊 FloodWatch Ayutthaya AI Assistant
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  background: '#0369a1',
                  color: '#e0f2fe',
                  padding: '2px 8px',
                  borderRadius: '999px',
                }}
              >
                Gemini Live Telemetry & Area Situation
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
              Endpoint: <code style={{ color: '#7dd3fc' }}>/api/ai/chat</code> (POST) • Strict Live-Data Grounding
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <Link
              href="/supabase-test"
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                borderRadius: '6px',
                background: '#1e293b',
                color: '#94a3b8',
                textDecoration: 'none',
              }}
            >
              Supabase Test
            </Link>
            <Link
              href="/"
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                borderRadius: '6px',
                background: '#2563eb',
                color: '#ffffff',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Back to App
            </Link>
          </div>
        </div>

        {/* Notice Card */}
        <div
          className="chat-notice"
          style={{
            background: 'rgba(37, 99, 235, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '12px',
            color: '#93c5fd',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: '#ffffff' }}>⚡ ระบบเชื่อมต่อโทรมาตรตรวจวัดจริง (ThaiWater / กรมชลประทาน):</strong> AI Assistant สามารถเข้าถึงข้อมูลระดับน้ำจริง 22 สถานีรอบจังหวัดพระนครศรีอยุธยา โดยจะตอบอิงตามค่าตรวจวัดจริง หากอำเภอใดไม่มีสถานีติดตั้ง (เช่น วังน้อย) ระบบจะอ้างอิงสถานีข้างเคียงให้อัตโนมัติ ป้องกันการมโนข้อมูลอย่างเข้มงวด
        </div>

        {/* Quick Question Prompts */}
        <div className="chat-prompts" style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>
            SAMPLE PROMPTS:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {SAMPLE_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                onClick={() => void sendMessage(q)}
                disabled={loading}
                style={{
                  fontSize: '12px',
                  background: '#131e30',
                  color: '#cbd5e1',
                  border: '1px solid #1e293b',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Chat History Container */}
        <div
          className="chat-thread"
          style={{
            background: '#0e1626',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '16px',
            minHeight: '340px',
            maxHeight: '520px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            marginBottom: '16px',
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                margin: 'auto',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '14px',
                padding: '40px 20px',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
              <div>No messages yet. Send a message below or click a sample prompt.</div>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.role === 'user';
              const isError = m.role === 'error';

              return (
                <div
                  key={m.id}
                  className="chat-message-row"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    className={`chat-bubble${isUser ? ' user-message' : isError ? ' error-message' : ''}`}
                    style={{
                      maxWidth: '85%',
                      padding: '12px 16px',
                      borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      background: isUser
                        ? '#2563eb'
                        : isError
                        ? '#7f1d1d'
                        : '#182438',
                      color: isUser ? '#ffffff' : isError ? '#fecaca' : '#e2e8f0',
                      border: isError ? '1px solid #ef4444' : isUser ? 'none' : '1px solid #23334d',
                      fontSize: '14px',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {m.content}
                  </div>

                  <div
                    className="chat-message-time"
                    style={{
                      fontSize: '11px',
                      color: '#64748b',
                      marginTop: '4px',
                      display: 'flex',
                      gap: '8px',
                    }}
                  >
                    <span>{m.timestamp}</span>
                    {m.meta?.durationMs && <span>• {m.meta.durationMs}ms</span>}
                    {m.meta?.model && <span>• {m.meta.model}</span>}
                  </div>
                </div>
              );
            })
          )}

          {loading && (
            <div className="chat-loading" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '13px' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#38bdf8',
                  animation: 'pulse 1s infinite',
                }}
              />
              Generating AI response from OpenAI Responses API...
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
          style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}
        >
          <input
            className="chat-input"
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask about FloodWatch Ayutthaya, flood risks, districts, or sensors..."
            disabled={loading}
            style={{
              flex: 1,
              background: '#101a2b',
              border: '1px solid #23334d',
              borderRadius: '8px',
              padding: '12px 16px',
              color: '#f8fafc',
              fontSize: '14px',
              outline: 'none',
            }}
          />

          <button
            className="chat-send"
            type="submit"
            disabled={loading || !inputMessage.trim()}
            style={{
              background: loading || !inputMessage.trim() ? '#1e293b' : '#2563eb',
              color: loading || !inputMessage.trim() ? '#64748b' : '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0 20px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: loading || !inputMessage.trim() ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Sending...' : 'Send'}
          </button>

          {messages.length > 0 && (
            <button
              className="chat-clear"
              type="button"
              onClick={clearChat}
              disabled={loading}
              style={{
                background: 'transparent',
                border: '1px solid #334155',
                color: '#94a3b8',
                borderRadius: '8px',
                padding: '0 14px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
        </form>

        {/* Raw Response Debug (if available) */}
        {lastRawResponse && (
          <div
            className="chat-debug"
            style={{
              background: '#090d14',
              border: '1px solid #1a2333',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '11px',
            }}
          >
            <div style={{ color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>
              DEBUG / RAW RESPONSE INSPECTOR:
            </div>
            <pre
              style={{
                margin: 0,
                color: '#94a3b8',
                overflowX: 'auto',
                fontFamily: 'monospace',
              }}
            >
              {JSON.stringify(lastRawResponse, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
