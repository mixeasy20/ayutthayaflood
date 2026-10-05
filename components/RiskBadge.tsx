import React from 'react';
import { ShieldAlert } from 'lucide-react';

export type RiskLevel = 'normal' | 'watch' | 'increased' | 'high' | 'unavailable';

export const RiskBadge: React.FC<{ level?: RiskLevel }> = ({ level }) => {
  const styles = {
    normal: {
      bg: 'rgba(34,197,94,0.15)',
      border: '#22c55e',
      text: '#86efac',
      label: 'ปกติ',
    },
    watch: {
      bg: 'rgba(234,179,8,0.15)',
      border: '#eab308',
      text: '#fde047',
      label: 'เฝ้าระวัง',
    },
    increased: {
      bg: 'rgba(249,115,22,0.15)',
      border: '#f97316',
      text: '#fdba74',
      label: 'เพิ่มความเสี่ยง',
    },
    high: {
      bg: 'rgba(239,68,68,0.15)',
      border: '#ef4444',
      text: '#fca5a5',
      label: 'สูง',
    },
    unavailable: {
      bg: 'rgba(156,163,175,0.15)',
      border: '#9ea3af',
      text: '#d1d5db',
      label: 'ข้อมูลไม่พร้อม',
    },
  }[level ?? 'unavailable'];

  return (
    <div
      style={{
        background: styles.bg,
        border: `2px solid ${styles.border}`,
        borderRadius: '12px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        animation: level === 'high' ? 'pulse 2s infinite' : undefined,
      }}
    >
      <ShieldAlert size={18} style={{ color: styles.border }} />
      <span style={{ color: styles.text, fontWeight: 700, fontSize: '15px' }}>{styles.label}</span>
    </div>
  );
};

/* Add keyframes for pulse animation */
const style = document.createElement('style');
style.innerHTML = `@keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.9; } 100% { transform: scale(1); opacity: 1; }}`;
document.head.appendChild(style);
