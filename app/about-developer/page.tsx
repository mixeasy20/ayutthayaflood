'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Code2, Mail, Map, Sparkles } from 'lucide-react';

type Tech = { name: string; note: string; mark: React.ReactNode };

function BrandMark({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className={`tech-mark ${tone}`} aria-hidden="true">{children}</span>;
}

export default function AboutDeveloperPage() {
  const [locale, setLocale] = useState<'th' | 'en'>('th');
  useEffect(() => {
    try { if (window.localStorage.getItem('floodwatch-language') === 'en') setLocale('en'); } catch { /* Keep Thai default. */ }
  }, []);
  const th = locale === 'th';
  const technologies: Tech[] = [
    { name: 'Next.js', note: th ? 'เว็บแอปและ API routes' : 'Web app and API routes', mark: <BrandMark tone="next-mark"><b>N</b></BrandMark> },
    { name: 'React', note: th ? 'ส่วนติดต่อผู้ใช้' : 'User interface', mark: <BrandMark tone="react-mark"><svg viewBox="0 0 40 40"><ellipse cx="20" cy="20" rx="17" ry="7"/><ellipse cx="20" cy="20" rx="17" ry="7" transform="rotate(60 20 20)"/><ellipse cx="20" cy="20" rx="17" ry="7" transform="rotate(120 20 20)"/><circle cx="20" cy="20" r="2.8" className="react-core"/></svg></BrandMark> },
    { name: 'TypeScript', note: th ? 'ชนิดข้อมูลของแอป' : 'Application types', mark: <BrandMark tone="ts-mark"><b>TS</b></BrandMark> },
    { name: 'MapLibre GL JS', note: th ? 'แผนที่และชั้นข้อมูล' : 'Maps and data layers', mark: <BrandMark tone="map-mark"><Map size={23}/></BrandMark> },
    { name: 'Supabase', note: th ? 'ฐานข้อมูล PostgreSQL' : 'PostgreSQL database', mark: <BrandMark tone="supabase-mark"><svg viewBox="0 0 32 32"><path d="M18.4 2.8 5.2 18.2a1.5 1.5 0 0 0 1.1 2.5h8.1l-.8 8.5a.8.8 0 0 0 1.4.6l11.8-15a1.5 1.5 0 0 0-1.2-2.4h-7.5l1.3-8.7a.7.7 0 0 0-1.2-.9Z"/></svg></BrandMark> },
    { name: 'Gemini', note: th ? 'AI ช่วยวิเคราะห์' : 'AI assisted analysis', mark: <BrandMark tone="gemini-mark"><Sparkles size={23}/></BrandMark> },
  ];
  return (
    <main className="about-shell">
      <header className="about-top"><Link href="/" className="back-link"><ArrowLeft size={17}/>{th ? 'กลับสู่แผนที่' : 'Back to map'}</Link><div className="locale-switch" role="group" aria-label={th ? 'เลือกภาษา' : 'Select language'}><button className="btn" aria-pressed={th} onClick={() => { setLocale('th'); try { localStorage.setItem('floodwatch-language', 'th'); } catch {} }}>TH</button><button className="btn" aria-pressed={!th} onClick={() => { setLocale('en'); try { localStorage.setItem('floodwatch-language', 'en'); } catch {} }}>EN</button></div></header>
      <section className="about-hero"><span className="about-eyebrow">FLOODWATCH AYUTTHAYA</span><h1>{th ? 'เกี่ยวกับผู้พัฒนา' : 'About the developer'}</h1><p>{th ? 'พื้นที่แนะนำผู้สร้างและที่มาของโครงการ แก้ไขข้อความในวงเล็บเหลี่ยมให้เป็นข้อมูลจริงก่อนเผยแพร่' : 'A space to introduce the creator and story behind this project. Replace the bracketed placeholders with verified details before publishing.'}</p></section>
      <section className="about-profile-grid" aria-label={th ? 'ข้อมูลผู้พัฒนา' : 'Developer details'}>
        <article className="about-profile-card"><div className="profile-avatar" aria-hidden="true">FW</div><span className="about-eyebrow">{th ? 'ผู้พัฒนา' : 'DEVELOPER'}</span><h2>[Developer Name]</h2><p>[Education / Grade]</p><p>[School]</p><div className="placeholder-line"><BookOpen size={17}/><span>[About the Developer]</span></div></article>
        <article className="about-story-card"><div className="section-kicker"><Sparkles size={16}/>{th ? 'ที่มาของโครงการ' : 'PROJECT STORY'}</div><h2>{th ? 'ทำไมจึงสร้าง FloodWatch' : 'Why I created FloodWatch'}</h2><p>[Why I Created FloodWatch]</p><div className="contact-placeholder"><Mail size={16}/>[Contact Information]</div></article>
      </section>
      <section className="tech-section"><div className="section-kicker"><Code2 size={16}/>{th ? 'เทคโนโลยี' : 'TECHNOLOGIES'}</div><h2>{th ? 'เครื่องมือที่ใช้ในโครงการนี้' : 'Tools used in this project'}</h2><div className="tech-grid">{technologies.map((tech) => <article key={tech.name} className="tech-card">{tech.mark}<span><b>{tech.name}</b><small>{tech.note}</small></span></article>)}</div></section>
      <footer className="about-footer"><span>FloodWatch Ayutthaya</span><Link href="/">{th ? 'กลับไปดูสถานการณ์' : 'Return to situation map'}</Link></footer>
    </main>
  );
}
