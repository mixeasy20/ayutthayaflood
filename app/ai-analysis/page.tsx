'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Database,
  ExternalLink,
  Layers,
  MapPin,
  RefreshCw,
  Satellite,
  ShieldAlert,
  Sparkles,
  Waves,
} from 'lucide-react';
import { districts } from '../../lib/districts';
import type { AreaSituation } from '../../lib/types/situation';

const EXAMPLE_QUESTIONS = [
  { label: 'ตอนนี้วังน้อยเป็นอย่างไร?', district: 'วังน้อย', q: 'ตอนนี้วังน้อยเป็นอย่างไร?' },
  { label: 'ตรวจสอบอำเภอเสนา (จุดวิกฤต)', district: 'เสนา', q: 'สถานการณ์น้ำและจุดล้นตลิ่งที่อำเภอเสนาเป็นอย่างไร?' },
  { label: 'พื้นที่ไหนในอยุธยาควรเฝ้าระวัง?', district: 'พระนครศรีอยุธยา', q: 'พื้นที่ไหนควรเฝ้าระวังเป็นพิเศษ?' },
  { label: 'สถานการณ์น้ำกำลังดีขึ้นหรือแย่ลง?', district: 'บางบาล', q: 'แนวโน้มสถานการณ์น้ำกำลังดีขึ้นหรือแย่ลง?' },
];

export default function AiAnalysisPage() {
  const [selectedDistrict, setSelectedDistrict] = useState('วังน้อย');
  const [loading, setLoading] = useState(false);
  const [situation, setSituation] = useState<AreaSituation | null>(null);
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);

  const runAnalysis = async (district: string, question?: string) => {
    setLoading(true);
    setError(null);
    setActiveQuestion(question || null);
    const start = performance.now();

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ district, question }),
      });

      const elapsed = Math.round(performance.now() - start);
      setResponseTimeMs(elapsed);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `HTTP ${res.status}: Failed to analyze`);
      }

      const data = await res.json();
      setSituation(data.situation);
      setAnalysisText(data.analysis);
      setModelUsed(data.model);
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลหรือวิเคราะห์สถานการณ์');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-run analysis for default district on mount
    void runAnalysis('วังน้อย');
  }, []);

  const getRiskBadgeColor = (risk?: string) => {
    switch (risk) {
    case 'high':
        return { bg: '#fde9e7', border: '#b42318', text: '#9d2017' };
      case 'elevated':
        return { bg: '#fff0e3', border: '#c45d11', text: '#93400c' };
      case 'monitor':
        return { bg: '#fff7d9', border: '#a4770c', text: '#805d00' };
      default:
        return { bg: '#e8f2e6', border: '#416d43', text: '#285c32' };
    }
  };

  const riskStyle = getRiskBadgeColor(situation?.risk?.overall_risk);

  return (
    <div className="ai-analysis-page" style={{ minHeight: '100vh', padding: '24px 16px' }}>
      <div className="ai-analysis-shell" style={{ maxWidth: '960px', margin: '0 auto' }}>
        {/* Navigation Bar */}
        <div className="ai-analysis-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#33443a',
              textDecoration: 'none',
              fontSize: '13px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #b4c0b6',
            }}
          >
            <ArrowLeft size={16} />
            <span>กลับหน้าหลัก (แผนที่)</span>
          </Link>

          <div style={{ display: 'flex', gap: '8px' }}>
            <Link
              href="/ai-test"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#ffffff',
                textDecoration: 'none',
                fontSize: '13px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: '#28502f',
                border: '1px solid #28502f',
              }}
            >
              <Bot size={15} />
              <span>ห้องแชท AI</span>
            </Link>
          </div>
        </div>

        {/* Header Title */}
          <div className="ai-analysis-heading" style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div
              className="ai-analysis-mark"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: '#28502f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Activity size={22} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#1d2721' }}>
                AI วิเคราะห์สถานการณ์น้ำจริง (Real Situation Analysis)
              </h1>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#4e5a52' }}>
                วิเคราะห์ข้อมูลโทรมาตรระดับน้ำ (ThaiWater), ฝนจริง/พยากรณ์ (Open-Meteo), ภาพดาวเทียม (GISTDA) และ GloFAS
              </p>
            </div>
          </div>
        </div>

        {/* Control Box: Area Selector & Action Button */}
        <div
          className="ai-analysis-controls"
          style={{
            background: '#ffffff',
            border: '1px solid #cbd2cc',
            borderRadius: '14px',
            padding: '18px 20px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 240px' }}>
              <MapPin size={18} style={{ color: '#416d43' }} />
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#37463c' }}>เลือกอำเภอ:</label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                style={{
                  flex: 1,
                  background: '#ffffff',
                  border: '1px solid #aeb9b1',
                  color: '#1d2721',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  outline: 'none',
                }}
              >
                {districts.map((d) => (
                  <option key={d.name} value={d.name}>
                    อำเภอ{d.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="ai-analysis-run"
              onClick={() => runAnalysis(selectedDistrict)}
              disabled={loading}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                background: loading ? '#d9e0da' : '#28502f',
                color: '#ffffff',
                border: 'none',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'opacity 0.2s',
              }}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'กำลังรวบรวมข้อมูลสด...' : 'วิเคราะห์สถานการณ์'}</span>
            </button>
          </div>

          {/* Quick Example Prompt Buttons */}
          <div className="ai-analysis-prompts" style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #1e293b' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              คำถามตัวอย่างที่ใช้ข้อมูลจริง (REAL DATA PIPELINE):
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {EXAMPLE_QUESTIONS.map((ex, i) => (
                <button
                  key={i}
                  className="ai-analysis-prompt"
                  onClick={() => {
                    setSelectedDistrict(ex.district);
                    void runAnalysis(ex.district, ex.q);
                  }}
                  disabled={loading}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '9999px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#93c5fd',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#38bdf8')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#334155')}
                >
                  <Sparkles size={12} style={{ color: '#38bdf8' }} />
                  <span>{ex.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div
            className="ai-analysis-error"
            style={{
              background: '#3b1212',
              border: '1px solid #7f1d1d',
              borderRadius: '10px',
              padding: '14px 18px',
              marginBottom: '20px',
              color: '#fca5a5',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div
            className="ai-analysis-loading"
            style={{
              padding: '40px',
              textAlign: 'center',
              background: '#131e32',
              borderRadius: '14px',
              border: '1px solid #1e293b',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid #334155',
                borderTopColor: '#38bdf8',
                borderRadius: '50%',
                margin: '0 auto 12px auto',
                animation: 'spin 1s linear infinite',
              }}
            />
            <div style={{ color: '#cbd5e1', fontSize: '14px', fontWeight: 600 }}>
              กำลังรวบรวมโทรมาตรจาก 4 หน่วยงาน (ThaiWater, Open-Meteo, GISTDA, GloFAS)...
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              ประมวลผลข้อมูลสดสำหรับ อำเภอ{selectedDistrict}
            </div>
          </div>
        )}

        {/* Main Analysis Card */}
        {!loading && situation && (
          <div className="ai-analysis-results" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Telemetry Summary Badges */}
            <div
              className="ai-analysis-metrics"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
              }}
            >
              {/* Overall Flood Risk Badge */}
              <div
                className={`ai-analysis-metric risk-metric risk-${situation.risk.overall_risk}`}
                style={{
                  background: riskStyle.bg,
                  border: `1px solid ${riskStyle.border}`,
                  borderRadius: '12px',
                  padding: '14px 16px',
                }}
              >
            <div style={{ fontSize: '11px', color: '#4e5a52', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldAlert size={14} style={{ color: riskStyle.border }} />
                  <span>ความเสี่ยงอุทกภัยรวม (Flood Risk)</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: riskStyle.text, marginTop: '4px' }}>
                  {situation.floodRisk?.levelTh || situation.risk.overall_risk_th}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  คำนวณโดย Risk Engine v{situation.floodRisk?.methodologyVersion || '2.1'}
                </div>
              </div>

              {/* Water Status & Trend Badge */}
              <div
                className="ai-analysis-metric water-metric"
                style={{
                  background: '#131e32',
                  border: '1px solid #1e293b',
                  borderRadius: '12px',
                  padding: '14px 16px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#4e5a52', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Waves size={14} style={{ color: '#38bdf8' }} />
                  <span>สถานะระดับน้ำ (Water Status)</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                  {situation.water.primary_station?.current_level_msl !== null && situation.water.primary_station?.current_level_msl !== undefined
                    ? `${situation.water.primary_station.current_level_msl} ม.รทก.`
                    : 'ไม่มีสถานีในพื้นที่'}
                  {situation.water.waterStatus?.trend === 'rising' && ' (↑ ขึ้น)'}
                  {situation.water.waterStatus?.trend === 'falling' && ' (↓ ลง)'}
                  {situation.water.waterStatus?.trend === 'stable' && ' (→ ทรงตัว)'}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  {situation.water.is_nearby_reference
                    ? `(อ้างอิง: ${situation.water.nearby_district_name})`
                    : situation.water.primary_station?.station_name || 'สถานีชลประทาน'}
                  {situation.water.primary_station?.diff_bank_m !== null && situation.water.primary_station?.diff_bank_m !== undefined && (
                    <span> • ล้นตลิ่ง {situation.water.primary_station.diff_bank_m} ม.</span>
                  )}
                </div>
              </div>

              {/* Rain Risk Badge (Separate from Flood Risk) */}
              <div
                className="ai-analysis-metric rain-metric"
                style={{
                  background: '#131e32',
                  border: '1px solid #1e293b',
                  borderRadius: '12px',
                  padding: '14px 16px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#4e5a52', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CloudRain size={14} style={{ color: '#60a5fa' }} />
                  <span>ความเสี่ยงฝน (Rain Risk)</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                  {situation.rain.rainRisk?.levelTh || (situation.rain.observed_24h_mm ? `${situation.rain.observed_24h_mm} มม.` : 'ไม่มีฝน')}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  จริง: {situation.rain.observed_24h_mm !== null ? `${situation.rain.observed_24h_mm} มม.` : 'ข้อมูลไม่พร้อมใช้'} | คาด: {situation.rain.forecast_24h_mm !== null ? `${situation.rain.forecast_24h_mm} มม.` : '—'} (โอกาส {situation.rain.forecast_probability_pct ?? 0}%)
                </div>
              </div>

              {/* Satellite Evidence Badge */}
              <div
                className={`ai-analysis-metric satellite-metric ${situation.flood.flood_detected ? 'evidence-found' : situation.flood.evidence_status === 'no_evidence_detected' ? 'evidence-clear' : 'evidence-unknown'}`}
                style={{
                  background: '#131e32',
                  border: '1px solid #1e293b',
                  borderRadius: '12px',
                  padding: '14px 16px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#4e5a52', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Satellite size={14} style={{ color: '#a78bfa' }} />
                  <span>หลักฐานดาวเทียม (GISTDA)</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: situation.flood.flood_detected ? '#f87171' : situation.flood.evidence_status === 'no_evidence_detected' ? '#86efac' : '#94a3b8', marginTop: '4px' }}>
                  {situation.flood.flood_detected
                    ? 'ตรวจพบน้ำท่วมขัง'
                    : situation.flood.evidence_status === 'no_evidence_detected'
                    ? 'ไม่พบร่องรอยน้ำท่วมขัง'
                    : 'ข้อมูลไม่พร้อมใช้งาน'}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  {situation.flood.flood_polygon_area_sqkm
                    ? `พื้นที่ท่วม ~${situation.flood.flood_polygon_area_sqkm} ตร.กม.`
                    : 'ภาพถ่ายดาวเทียมรอบ 1 วัน'}
                </div>
              </div>
            </div>

            {/* Contributing Factors Card (Audit Trail) */}
            {situation.floodRisk?.contributingFactors && situation.floodRisk.contributingFactors.length > 0 && (
              <div
                className="ai-analysis-factors"
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd2cc',
                  borderRadius: '12px',
                  padding: '14px 18px',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} />
                  <span>ปัจจัยที่ส่งผลต่อการประเมินความเสี่ยง (Auditable Contributing Factors):</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {situation.floodRisk.contributingFactors.map((factor, idx) => (
                    <div
                      key={idx}
                      className="ai-analysis-factor"
                      style={{
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '8px',
                        color: '#cbd5e1',
                        borderLeft: `3px solid ${factor.severity === 'critical' ? '#ef4444' : factor.severity === 'high' ? '#f97316' : factor.severity === 'moderate' ? '#eab308' : '#38bdf8'}`,
                        paddingLeft: '10px',
                      }}
                    >
                      <strong style={{ color: '#f8fafc' }}>{factor.titleTh}:</strong>
                      <span>{factor.detailsTh}</span>
                      <span style={{ fontSize: '10px', color: '#64748b' }}>({factor.source})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Generated Report Card */}
            <div
              className="ai-analysis-report"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd2cc',
                borderRadius: '14px',
                padding: '24px',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
              }}
            >
              <div className="ai-analysis-report-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bot size={20} style={{ color: '#38bdf8' }} />
                  <span style={{ fontWeight: 700, fontSize: '16px', color: '#f8fafc' }}>
                    บทวิเคราะห์สถานการณ์โดย AI (สรุปจากข้อมูลตรวจวัดจริง)
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {responseTimeMs ? `ประมวลผลใน ${responseTimeMs} ms • ` : ''}
                  โมเดล: {modelUsed || 'Gemini Flash'}
                </div>
              </div>

              {activeQuestion && (
                <div
                  className="ai-analysis-question"
                  style={{
                    background: '#e8f0e7',
                    border: '1px solid #bdcdbb',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    marginBottom: '16px',
                    fontSize: '13px',
                    color: '#29372e',
                  }}
                >
                  <strong>คำถาม:</strong> {activeQuestion}
                </div>
              )}

              {/* Formatted Markdown Analysis Text */}
              <div
                className="ai-analysis-text"
                style={{
                  fontSize: '14px',
                  lineHeight: '1.7',
                  color: '#27332b',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {analysisText}
              </div>
            </div>

            {/* Collapsible Raw AreaSituation Data Card */}
            <div
              className="ai-analysis-raw"
              style={{
                background: '#ffffff',
                border: '1px solid #bdc8bf',
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              <button
                className="ai-analysis-raw-toggle"
                onClick={() => setShowRawJson(!showRawJson)}
                style={{
                  width: '100%',
                  padding: '12px 18px',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Database size={15} style={{ color: '#38bdf8' }} />
                  <span>ดูข้อมูลดิบที่ส่งให้ AI ตรวจสอบ (Structured AreaSituation JSON)</span>
                </div>
                {showRawJson ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showRawJson && (
                <div className="ai-analysis-raw-data" style={{ padding: '16px', borderTop: '1px solid #1e293b', background: '#090d16' }}>
                  <pre
                    style={{
                      margin: 0,
                      fontSize: '11px',
                      color: '#7dd3fc',
                      overflowX: 'auto',
                      maxHeight: '350px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {JSON.stringify(situation, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
