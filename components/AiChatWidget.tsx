'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bot, Sparkles, X, Send, RotateCcw, ChevronDown, Maximize2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: string;
}

interface AiChatWidgetProps {
  currentDistrictName?: string;
  locale?: 'th' | 'en';
}

export default function AiChatWidget({ currentDistrictName = 'พระนครศรีอยุธยา', locale = 'th' }: AiChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        locale === 'th'
          ? `สวัสดีครับ! ผมคือ **FloodWatch AI Assistant** ผู้ช่วยตรวจสอบสถานการณ์น้ำอยุธยา เชื่อมต่อข้อมูลโทรมาตรสด 22 สถานี (ThaiWater / กรมชลประทาน) สอบถามระดับน้ำหรือสถานการณ์ในอำเภอต่างๆ ได้เลยครับ`
          : `Hello! I am **FloodWatch AI Assistant**, connected to 22 live river telemetry stations in Ayutthaya. Feel free to ask about water levels or flood conditions.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const quickPrompts = locale === 'th' ? [
    `อำเภอ${currentDistrictName} สถานการณ์น้ำเป็นอย่างไร?`,
    'จุดไหนในอยุธยามีระดับน้ำล้นตลิ่งบ้าง?',
    'อำเภอวังน้อยตอนนี้มีน้ำท่วมไหม?',
    'แนวทางเตรียมพร้อมรับมือน้ำหลาก',
  ] : [
    `What is the water level in ${currentDistrictName}?`,
    'Which stations in Ayutthaya are currently overflowing?',
    'Is Wang Noi district flooded right now?',
    'Emergency safety precautions for flood',
  ];

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `ai-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    setInputMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  role: 'error',
                  content: data.message || `เกิดข้อผิดพลาดจากระบบ (${res.status})`,
                }
              : m
          )
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            accumulated += parsed.text ?? '';
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: accumulated } : m))
            );
          } catch {
            // ignore malformed SSE line
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, role: 'error', content: err?.message || 'การเชื่อมต่อขัดข้อง กรุณาลองใหม่อีกครั้ง' }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          locale === 'th'
            ? 'ล้างประวัติการสนทนาแล้วครับ สอบถามสถานการณ์น้ำล่าสุดได้เลยครับ'
            : 'Chat history cleared. Feel free to ask about live flood conditions.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <>
      {/* Floating Action Button (Bottom Right) */}
      {!isOpen && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}>
          <button
            className="ai-fab"
            onClick={() => setIsOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 20px',
              borderRadius: '9999px',
              background: '#596e50',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 5px 15px rgba(55, 75, 47, 0.24)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              transition: 'all 0.2s ease-in-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)';
              e.currentTarget.style.boxShadow = '0 7px 18px rgba(55, 75, 47, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 5px 15px rgba(55, 75, 47, 0.24)';
            }}
            aria-label="Open FloodWatch AI Assistant"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.2)',
              }}
            >
              <Bot size={18} />
            </div>
            <span>{locale === 'th' ? 'ถาม AI สถานการณ์น้ำ' : 'Ask Flood AI'}</span>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#4ade80',
                boxShadow: '0 0 8px #4ade80',
              }}
            />
          </button>
        </div>
      )}

      {/* Floating Chat Panel */}
      {isOpen && (
        <div
          className="ai-panel"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: 'min(420px, calc(100vw - 32px))',
            height: 'min(620px, calc(100vh - 80px))',
            background: '#fffefa',
            backdropFilter: 'blur(16px)',
            border: '1px solid #d9ddd2',
            borderRadius: '18px',
            boxShadow: '0 16px 42px rgba(41, 49, 34, 0.2)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'inherit',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 18px',
              background: '#eef0e7',
              borderBottom: '1px solid #d9ddd2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: '#637a58',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                }}
              >
                <Bot size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: '#252a24' }}>FloodWatch AI</span>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(74, 222, 128, 0.15)',
                      color: '#4ade80',
                      border: '1px solid rgba(74, 222, 128, 0.3)',
                      fontWeight: 600,
                    }}
                  >
                    LIVE SENSOR
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#6d756b' }}>
                  {locale === 'th' ? 'โทรมาตรสด 22 สถานี (ThaiWater / ชป.)' : 'Live RID Telemetry (22 Stations)'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Link
                href="/ai-test"
                title={locale === 'th' ? 'เปิดโหมดเต็มจอ' : 'Full Screen'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#6d756b',
                  padding: '6px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ExternalLink size={16} />
              </Link>
              <button
                onClick={handleClear}
                title={locale === 'th' ? 'ล้างการสนทนา' : 'Clear Chat'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#6d756b',
                  padding: '6px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <RotateCcw size={15} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title={locale === 'th' ? 'ปิด' : 'Close'}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: '#596257',
                  padding: '6px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Quick Prompts Bar */}
          <div
            style={{
              padding: '8px 12px',
              background: '#f8f8f2',
              borderBottom: '1px solid #e1e2d9',
              overflowX: 'auto',
              display: 'flex',
              gap: '6px',
              whiteSpace: 'nowrap',
              scrollbarWidth: 'none',
            }}
          >
            {quickPrompts.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(q)}
                disabled={loading}
                style={{
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  background: '#fffefa',
                  border: '1px solid #d9ddd2',
                  color: '#596257',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e8eee2';
                  e.currentTarget.style.borderColor = '#aab8a1';
                  e.currentTarget.style.color = '#40583a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fffefa';
                  e.currentTarget.style.borderColor = '#d9ddd2';
                  e.currentTarget.style.color = '#596257';
                }}
              >
                <Sparkles size={11} style={{ color: '#637a58' }} />
                <span>{q}</span>
              </button>
            ))}
          </div>

          {/* Message List */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {messages.map((m) => {
              const isUser = m.role === 'user';
              const isError = m.role === 'error';
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '100%',
                  }}
                >
                  <div
                    className={`ai-message${isUser ? ' user-message' : isError ? ' error-message' : ''}`}
                    style={{
                      maxWidth: '85%',
                      padding: '10px 14px',
                      borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: isUser
                        ? '#596e50'
                        : isError
                        ? '#f8e9e5'
                        : '#1e293b',
                      color: isError ? '#9c3e35' : '#30372e',
                      fontSize: '13px',
                      lineHeight: '1.55',
                      border: isUser
                        ? 'none'
                        : isError
                        ? '1px solid #7f1d1d'
                        : '1px solid #e2e3da',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {m.content || (
                      <span style={{ color: '#6d756b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#38bdf8',
                            animation: 'pulse 1s infinite',
                          }}
                        />
                        กำลังประมวลผลข้อมูลสถานี...
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#858b80',
                      marginTop: '3px',
                      padding: '0 4px',
                    }}
                  >
                    {m.timestamp}
                  </span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div
            style={{
              padding: '12px 14px',
              background: '#f8f8f2',
              borderTop: '1px solid #e1e2d9',
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              style={{ display: 'flex', gap: '8px' }}
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={
                  locale === 'th'
                    ? `ถามเกี่ยวกับอำเภอ ${currentDistrictName} หรือระดับน้ำ...`
                    : `Ask about ${currentDistrictName} or water levels...`
                }
                disabled={loading}
                style={{
                  flex: 1,
                  background: '#fffefa',
                  border: '1px solid #d9ddd2',
                  borderRadius: '10px',
                  padding: '9px 12px',
                  color: '#252a24',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={loading || !inputMessage.trim()}
                style={{
                  background: loading || !inputMessage.trim() ? '#d9ddd2' : '#596e50',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0 14px',
                  cursor: loading || !inputMessage.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
