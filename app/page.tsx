'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, Bell, Bot, CheckCircle2, CloudRain, Database, Droplets, History, MapPin, RefreshCw, Satellite, ShieldAlert, Waves } from 'lucide-react';
import FloodMap, { type FloodMapOverlay } from '../components/FloodMap';
import AiChatWidget from '../components/AiChatWidget';
import { districts } from '../lib/districts';
import { districtNamesEnByThai, messages, type Locale, type RiskKey } from '../lib/i18n';

type WeatherData = {
  hourly?: {
    time?: string[];
    precipitation?: number[];
    precipitation_probability?: number[];
  };
};

type ApiData<T> = {
  provider?: string;
  fetchedAt?: string;
  data?: T;
};

type FloodEvent = {
  status?: 'evidence' | 'no_evidence' | 'unavailable' | string;
  httpStatus?: number | null;
  provider?: string;
  timestamp?: string | null;
  fetchedAt?: string | null;
  floodDetected?: boolean | null;
  evidence?: {
    numberMatched?: number;
    numberReturned?: number;
    features?: unknown[];
  } | null;
  telemetryEvidence?: {
    hasCriticalOrOverflow?: boolean;
    stationsCount?: number;
    stations?: unknown[];
    features?: unknown[];
  } | null;
  historicalEvidence?: {
    count?: number;
    events?: unknown[];
  } | null;
  message?: string;
  coverageLimitation?: string;
};

type RainfallStation = {
  observationMetadata?: {
    observeAgencyCode?: string;
    observeAgencyName?: string;
    originality?: number;
  };
  resultTime?: string;
  station: {
    stationCode: string;
    stationName?: { th?: string; en?: string };
    lat: number | null;
    long: number | null;
    amphoe: string;
    tumbon: string;
    province?: string;
    provinceCode?: string;
    basin?: string;
  };
  measurementResults: Array<{
    measureTime?: string;
    variable?: string;
    interval?: string;
    value: number;
    uom?: string;
    qualityFlag?: string;
    comment?: string;
  }>;
};

type RainfallApiResponse = {
  status?: string;
  provider?: string;
  provinceCode?: string;
  provinceName?: string;
  checkedAt?: string;
  responseTimeMs?: number;
  summary?: {
    totalStations: number;
    averageRain24h_mm: number;
    maxRain24h_mm: number;
    maxRainStation: string;
  };
  standardData?: {
    metadata?: {
      version?: string;
      dataProviderCode?: string;
      dataProviderName?: string;
      documentGenerateTime?: string;
      waterDatatype?: string;
      interval?: string;
    };
    timeSeriesObservation?: RainfallStation[];
  };
};

type RiskSummary = {
  key: RiskKey;
  rain: number | null;
  probability: number | null;
  discharge: number | null;
};
type ToastKey = 'unableToLoad' | 'notificationsUnsupported' | 'notificationsEnabled' | 'notificationsDenied';

function formatTimestamp(value: string | null | undefined, locale: Locale = 'en') {
  if (!value || !Number.isFinite(Date.parse(value))) return messages[locale].timestampUnavailable;
  return new Date(value).toLocaleString(locale === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Home() {
  const [locale, setLocale] = useState<Locale>('th');
  const text = messages[locale];
  const [idx, setIdx] = useState(0);
  const [weather, setWeather] = useState<ApiData<WeatherData> | null>(null);
  const [flood, setFlood] = useState<ApiData<any> | null>(null);
  const [floodEvent, setFloodEvent] = useState<FloodEvent | null>(null);
  const [rainfall, setRainfall] = useState<RainfallApiResponse | null>(null);
  const [waterLevel, setWaterLevel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastKey | null>(null);
  const district = districts[idx];
  const districtName = locale === 'th' ? district.name : districtNamesEnByThai[district.name] ?? district.name;

  useEffect(() => {
    try {
      const savedLocale = window.localStorage.getItem('floodwatch-language');
      if (savedLocale === 'en' || savedLocale === 'th') setLocale(savedLocale);
    } catch {
      window.document.documentElement.lang = 'th';
    }
  }, []);

  useEffect(() => {
    window.document.documentElement.lang = locale;
  }, [locale]);

  const changeLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
    try {
      window.localStorage.setItem('floodwatch-language', nextLocale);
    } catch {
      window.document.documentElement.lang = nextLocale;
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [weatherResponse, floodResponse, eventResponse, rainfallResponse, waterLevelResponse] = await Promise.all([
        fetch(`/api/weather?lat=${district.lat}&lon=${district.lon}`).then((response) => response.json()),
        fetch(`/api/flood?lat=${district.lat}&lon=${district.lon}`).then((response) => response.json()),
        fetch(`/api/flood-event?lat=${district.lat}&lon=${district.lon}`).then((response) => response.json()),
        fetch(`/api/rainfall?provinceCode=14`).then((response) => response.json()),
        fetch(`/api/water-level?provinceCode=14`).then((response) => response.json()),
      ]);
      setWeather(weatherResponse);
      setFlood(floodResponse);
      setFloodEvent(eventResponse);
      setRainfall(rainfallResponse);
      setWaterLevel(waterLevelResponse);
    } catch {
      setToast('unableToLoad');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [idx]);

  // Match stations in currently selected district
  const districtStations = useMemo<RainfallStation[]>(() => {
    const allStations = rainfall?.standardData?.timeSeriesObservation ?? [];
    if (allStations.length === 0) return [];
    return allStations.filter((st) => {
      const amphoe = st.station.amphoe || '';
      return amphoe.includes(district.name) || district.name.includes(amphoe);
    });
  }, [rainfall, district.name]);

  // Top stations across Ayutthaya (sorted by 24h rainfall descending)
  const topStations = useMemo<RainfallStation[]>(() => {
    const allStations = [...(rainfall?.standardData?.timeSeriesObservation ?? [])];
    return allStations
      .sort((a, b) => {
        const rA = a.measurementResults.find((m) => m.interval === '24h')?.value;
        const rB = b.measurementResults.find((m) => m.interval === '24h')?.value;
        return (rB ?? Number.NEGATIVE_INFINITY) - (rA ?? Number.NEGATIVE_INFINITY);
      })
      .slice(0, 5);
  }, [rainfall]);

  // Map overlays for 32 ThaiWater observation stations
  const mapOverlays = useMemo<FloodMapOverlay[]>(() => {
    const stations = rainfall?.standardData?.timeSeriesObservation ?? [];
    if (stations.length === 0) return [];

    const features = stations
      .filter((st) => st.station.long !== null && st.station.lat !== null)
      .map((st) => {
        const rain24 = st.measurementResults.find((m) => m.interval === '24h')?.value ?? null;
        const rain1 = st.measurementResults.find((m) => m.interval === '1h')?.value ?? null;
        const name = locale === 'th' ? st.station.stationName?.th : (st.station.stationName?.en || st.station.stationName?.th);
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [st.station.long!, st.station.lat!],
          },
          properties: {
            code: st.station.stationCode,
            name: name || st.station.stationCode,
            amphoe: st.station.amphoe,
            tumbon: st.station.tumbon,
            rain24,
            rain1,
          },
        };
      });

    const overlay: FloodMapOverlay = {
      id: 'thaiwater-rainfall-stations',
      data: {
        type: 'FeatureCollection',
        features,
      },
      layer: {
        type: 'circle',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8.5, 6,
            12, 12,
          ],
          'circle-color': ['case', ['==', ['get', 'rain24'], null], '#94a3b8', ['step', ['get', 'rain24'], '#06b6d4', 10, '#eab308', 35, '#f97316', 90, '#ef4444']],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      },
    };

    return [overlay];
  }, [rainfall, locale]);

  const risk = useMemo<RiskSummary>(() => {
    const hourly = weather?.data?.hourly;
    const stations = waterLevel?.stations ?? [];

    // Check water level telemetry in or near this district
    const districtStations = stations.filter(
      (st: any) => st.district && (st.district.includes(district.name) || district.name.includes(st.district))
    );
    const hasOverflow = districtStations.some((st: any) => st.situationLevel >= 5);
    const hasCritical = districtStations.some((st: any) => st.situationLevel === 4);
    const hasWarning = districtStations.some((st: any) => st.situationLevel === 3);

    const precipitation = hourly?.precipitation ?? [];
    const probabilities = hourly?.precipitation_probability ?? [];
    const rain = hourly ? precipitation.slice(0, 24).reduce((sum: number, value: number) => sum + Number(value ?? 0), 0) : null;
    const chance = hourly ? probabilities.slice(0, 24).reduce((maximum: number, value: number) => Math.max(maximum, Number(value ?? 0)), 0) : null;
    const discharge = Number(flood?.data?.daily?.river_discharge?.[0] ?? 0);

    // Rule-based deterministic risk: Telemetry overflow is highest ground truth
    if (hasOverflow || (rain !== null && rain >= 80) || (chance !== null && chance >= 85)) {
      return { key: 'high', rain, probability: chance, discharge };
    }
    if (hasCritical || (rain !== null && rain >= 40) || (chance !== null && chance >= 70)) {
      return { key: 'elevated', rain, probability: chance, discharge };
    }
    if (hasWarning || (rain !== null && rain >= 15) || (chance !== null && chance >= 50)) {
      return { key: 'monitor', rain, probability: chance, discharge };
    }
    if (hourly) {
      return { key: 'low', rain, probability: chance, discharge };
    }
    return { key: 'awaiting', rain: null, probability: null, discharge: null };
  }, [weather, flood, waterLevel, district.name]);

  const riskReasons = risk.key === 'awaiting'
    ? [text.awaitingRisk]
    : risk.key === 'low'
      ? [text.noHeavyRain]
      : [
        text.forecastRainfall24(risk.rain == null ? '—' : risk.rain.toFixed(1)),
        text.maxRainProbability(risk.probability == null ? '—' : risk.probability),
        ...(risk.key === 'high' ? [text.modelledFlowToday(flood?.data?.daily?.river_discharge?.[0] == null ? '—' : Number(flood.data.daily.river_discharge[0]).toFixed(0))] : []),
      ];

  const notify = async () => {
    if (!('Notification' in window)) {
      setToast('notificationsUnsupported');
      return;
    }
    const permission = await Notification.requestPermission();
    setToast(permission === 'granted' ? 'notificationsEnabled' : 'notificationsDenied');
  };

  const hourly = weather?.data?.hourly;
  const rain24 = hourly?.precipitation?.slice(0, 24).reduce((sum, value) => sum + Number(value ?? 0), 0);
  const maxProbability = hourly?.precipitation_probability?.slice(0, 24).reduce((maximum, value) => Math.max(maximum, Number(value ?? 0)), 0);
  const eventStatus = floodEvent?.status;
  const eventTitle = !floodEvent && loading
    ? text.checkingFlood
    : eventStatus === 'evidence'
      ? text.floodEvidence
      : eventStatus === 'no_evidence'
        ? text.noConfirmedFlood
        : text.dataUnavailable;
  const eventClass = eventStatus === 'no_evidence' ? 'event-ok' : 'event-warn';
  const eventStyle = eventStatus === 'evidence'
    ? { background: '#321a1a', borderColor: '#8f3434' }
    : eventStatus === 'no_evidence'
      ? { background: '#162738', borderColor: '#34506a' }
      : undefined;
  const eventIconStyle = eventStatus === 'evidence'
    ? { color: '#f87171' }
    : eventStatus === 'no_evidence'
      ? { color: '#91a4b8' }
      : undefined;
  const riskToneClass = risk.key === 'high'
    ? 'red'
    : risk.key === 'elevated'
      ? 'orange'
      : risk.key === 'low'
        ? 'green'
        : 'yellow';

  return (
    <main className="shell">
      <header className="top">
        <div className="brand">
          <div className="logo">🌊</div>
          <div>
            <div className="title">FloodWatch Ayutthaya</div>
            <div className="sub">{text.tagline}</div>
          </div>
        </div>
        <nav className="top-nav" aria-label={locale === 'th' ? 'นำทางใน FloodWatch' : 'FloodWatch navigation'}>
          <a href="#current">{locale === 'th' ? 'สถานการณ์' : 'Situation'}</a>
          <a href="#map">{locale === 'th' ? 'แผนที่' : 'Map'}</a>
          <a href="#rainfall">{locale === 'th' ? 'ฝน' : 'Rain'}</a>
          <a href="#water-level">{locale === 'th' ? 'ระดับน้ำ' : 'Water'}</a>
          <a href="#data-sources">{locale === 'th' ? 'แหล่งข้อมูล' : 'Sources'}</a>
        </nav>
        <div className="controls">
          <div className="locale-switch" role="group" aria-label={locale === 'th' ? 'เลือกภาษา' : 'Select language'}>
            <button className="btn" aria-pressed={locale === 'th'} onClick={() => changeLocale('th')} style={{ background: locale === 'th' ? '#153b5f' : undefined }}>TH</button>
            <button className="btn" aria-pressed={locale === 'en'} onClick={() => changeLocale('en')} style={{ background: locale === 'en' ? '#153b5f' : undefined }}>EN</button>
          </div>
          <select className="select" value={idx} onChange={(event) => setIdx(Number(event.target.value))} aria-label={text.selectDistrict}>
            {districts.map((item, index) => <option key={index} value={index}>{locale === 'th' ? item.name : districtNamesEnByThai[item.name] ?? item.name}</option>)}
          </select>
          <Link
            href="/ai-analysis"
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #0284c7, #0891b2)',
              color: '#ffffff',
              borderColor: 'rgba(56, 189, 248, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
              fontWeight: 600,
            }}
            title={locale === 'th' ? 'วิเคราะห์สถานการณ์น้ำจริงด้วย AI' : 'Real-time AI Situation Analysis'}
          >
            <Activity size={16} />
            <span>{locale === 'th' ? 'AI วิเคราะห์สถานการณ์' : 'AI Analysis'}</span>
          </Link>
          <Link
            href="/ai-test"
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #1d4ed8, #0284c7)',
              color: '#ffffff',
              borderColor: 'rgba(56, 189, 248, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
              fontWeight: 600,
            }}
            title={locale === 'th' ? 'เปิดระบบถาม-ตอบ AI เต็มจอ' : 'AI Assistant Full Screen'}
          >
            <Bot size={16} />
            <span>{locale === 'th' ? 'AI ผู้ช่วย' : 'AI Assistant'}</span>
          </Link>
          <button className="btn" onClick={notify}><Bell size={16} /> {text.notifications}</button>
          <button className="btn" onClick={() => void load()} aria-label={text.refresh} title={text.refresh}><RefreshCw size={16} /></button>
        </div>
      </header>

      <section className="grid section situation-section" id="current" aria-labelledby="situation-title">
        <div className="card hero">
          <div className="section-kicker" id="situation-title">{locale === 'th' ? 'สถานการณ์ปัจจุบัน' : 'Current situation'} <span className="data-tag observed-tag">{locale === 'th' ? 'สรุปสถานการณ์' : 'SITUATION'}</span></div>
          <div className="sub"><MapPin size={14} style={{ verticalAlign: 'middle' }} /> {text.provinceArea(districtName)}</div>
          <div className="risk" style={{ marginTop: 18 }}>
            <div className={`riskdot ${riskToneClass}`} style={{ background: 'currentColor' }} />
            <div>
              <div className="muted">{text.floodRisk}</div>
              <div className={`riskname ${riskToneClass}`}>{text.riskNames[risk.key]}</div>
            </div>
          </div>
          <div className="metrics">
            <div className="metric"><CloudRain size={17} /><div className="muted">{text.rainfallMetric}</div><b>{rain24 == null ? '—' : rain24.toFixed(1)} <small>{locale === 'th' ? 'มม.' : 'mm'}</small></b></div>
            <div className="metric"><Droplets size={17} /><div className="muted">{text.probabilityMetric}</div><b>{maxProbability == null ? '—' : `${maxProbability}%`}</b></div>
            <div className="metric"><Database size={17} /><div className="muted">{text.flowMetric}</div><b>{flood?.data?.daily?.river_discharge?.[0] == null ? '—' : flood.data.daily.river_discharge[0]} <small>{locale === 'th' ? 'ม³/วินาที' : 'm³/s'}</small></b></div>
          </div>
          <div className="source">
            {riskReasons.join(' • ')}<br />
            {text.source}: {weather?.provider ?? 'Open-Meteo Forecast'} / {flood?.provider ?? 'Open-Meteo Flood / GloFAS'}<br />
            {text.lastUpdated}: {formatTimestamp(weather?.fetchedAt, locale)} / {formatTimestamp(flood?.fetchedAt, locale)}
          </div>
        </div>

        <div className="card evidence-panel" id="flood-evidence" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>{text.currentFloodEvidence}</h2>
              <span
                className={`evidence-source-badge ${eventStatus === 'evidence' ? 'is-evidence' : eventStatus === 'no_evidence' ? 'is-neutral' : 'is-unavailable'}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', padding: '4px 7px', fontWeight: 650 }}
              >
                <Satellite size={12} />
                <span>GISTDA 24h Radar</span>
              </span>
            </div>

            <div
              className={`${eventClass}${eventStatus === 'evidence' ? ' evidence-confirmed' : ''}`}
              style={{
                ...eventStyle,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px',
                borderRadius: '10px',
              }}
            >
              {eventStatus === 'evidence' ? (
                <ShieldAlert size={22} style={{ color: '#f87171', flexShrink: 0, marginTop: '2px' }} />
              ) : eventStatus === 'no_evidence' ? (
                <Satellite size={22} style={{ color: '#91a4b8', flexShrink: 0, marginTop: '2px' }} />
              ) : (
                <ShieldAlert size={22} style={eventIconStyle} />
              )}
              <div>
                <b style={{ fontSize: '0.95rem', color: eventStatus === 'evidence' ? '#fecaca' : '#f8fafc', lineHeight: 1.4 }}>
                  {eventTitle}
                </b>
                <div className="sub" style={{ marginTop: 4, fontSize: '0.78rem', color: '#94a3b8' }}>
                  {text.coordinates}: {district.lat.toFixed(4)}, {district.lon.toFixed(4)}
                </div>
                {eventStatus === 'no_evidence' && <div className="evidence-caveat">{locale === 'th' ? 'การไม่พบหลักฐานดาวเทียมล่าสุดไม่ได้ยืนยันว่าพื้นที่แห้งหรือไม่ได้รับผลกระทบ' : 'No recent satellite evidence does not confirm the area is dry or unaffected.'}</div>}
              </div>
            </div>

            {/* Quick Metrics Bar for Satellite & DB Observation */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '8px',
                marginTop: '12px',
              }}
            >
              <div
                style={{
                  background: '#eef1ec',
                  border: '1px solid #cbd2cc',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{locale === 'th' ? 'ตรวจพบภาพถ่ายดาวเทียม' : 'Satellite Detected'}</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: eventStatus === 'evidence' ? '#f87171' : '#38bdf8', marginTop: 2 }}>
                  {eventStatus === 'evidence'
                    ? `${floodEvent?.evidence?.numberMatched ?? 1} ${locale === 'th' ? 'พื้นที่' : 'areas'}`
                    : eventStatus === 'no_evidence'
                    ? locale === 'th' ? '0 พื้นที่' : '0 areas'
                    : '—'}
                </div>
              </div>

              <div
                style={{
                  background: '#eef1ec',
                  border: '1px solid #cbd2cc',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{locale === 'th' ? 'ประวัติน้ำท่วมในฐานข้อมูล' : 'Historical Archives'}</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#30372e', marginTop: 2, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <History size={14} style={{ color: '#94a3b8' }} />
                  <span>
                    {(floodEvent as any)?.historicalEvidence?.count ?? '—'} {locale === 'th' ? 'เหตุการณ์' : 'events'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="source" style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #c6cec8' }}>
            {text.source}: {floodEvent?.provider ?? 'GISTDA FloodCheck'}<br />
            {text.sourceTimestamp}: {formatTimestamp(floodEvent?.timestamp, locale)}<br />
            {text.lastUpdated}: {formatTimestamp(floodEvent?.fetchedAt, locale)}
            {Boolean((floodEvent as any)?.coverageLimitation) && (
              <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', lineHeight: 1.4 }}>
                * {(floodEvent as any).coverageLimitation}
              </div>
            )}
          </div>
        </div>
      </section>


      <section id="map" className="section relative h-[58vh] min-h-80 md:h-[65vh] md:min-h-[34rem] map-stage" aria-label={locale === 'th' ? 'แผนที่สถานการณ์น้ำอยุธยา' : 'Ayutthaya flood situation map'}>
        <FloodMap
          locale={locale}
          rainfallData={rainfall}
          waterLevelData={waterLevel}
          floodEventData={floodEvent}
          selectedDistrict={district}
          riskSummary={risk}
          modelledDischarge={risk.discharge}
          overlays={mapOverlays}
        />
      </section>

      <div className="card install install-strip">
        <div><b>{text.installTitle}</b><div className="sub">{text.installSubtitle}</div></div>
        <span className="status">{text.installStatus}</span>
      </div>


      <section className="grid section insight-grid" aria-label={locale === 'th' ? 'ข้อมูลตรวจวัดและพยากรณ์' : 'Observations and forecast'}>
        {/* Real Live Ground Observation Data from ThaiWater */}
        <div className="card insight-panel rainfall-panel" id="rainfall">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2>{text.observedConditions}</h2>
            {rainfall?.summary && (
              <span className="status" style={{ background: '#0e3a5a', color: '#67c9ff', borderColor: '#1d547e', fontSize: '0.75rem' }}>
                {text.stationsCount(rainfall.summary.totalStations)}
              </span>
            )}
          </div>

          {rainfall?.summary ? (
            <div>
              <div className="event-ok" style={{ background: '#e6efe5', borderColor: '#b8cbb5', padding: '12px 15px' }}>
                <CloudRain size={20} style={{ color: '#688765', flexShrink: 0 }} />
                <div>
                  <b style={{ color: '#eff8fc' }}>{text.liveObservationConnected(rainfall.summary.totalStations)}</b>
                  <div className="sub" style={{ marginTop: 2, color: '#94a3b8', fontSize: '0.8rem' }}>
                    {text.maxObservedRainfall(rainfall.summary.maxRainStation, rainfall.summary.maxRain24h_mm)}
                  </div>
                </div>
              </div>

              {/* Station observations in the currently selected district */}
              {districtStations.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 6 }}>
                    {locale === 'th' ? `สถานีในอำเภอ${district.name}:` : `Stations in ${districtName}:`}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                    {districtStations.map((st) => {
                      const stRain24 = st.measurementResults.find((m) => m.interval === '24h')?.value;
                      const stRain1 = st.measurementResults.find((m) => m.interval === '1h')?.value;
                      const stName = locale === 'th' ? st.station.stationName?.th : (st.station.stationName?.en || st.station.stationName?.th);
                      return (
                        <div key={st.station.stationCode} className="rain-station-row" style={{ background: '#f6f6f0', border: '1px solid #dfe2d8', borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#252a24' }}>{stName}</div>
                          <div className="sub" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{st.station.tumbon}</div>
                          <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>24h:</span>
                            <span className={`rain-reading${stRain24 != null && stRain24 > 35 ? ' high-rain' : ''}`} style={{ fontWeight: 700, color: stRain24 != null && stRain24 != null && stRain24 > 35 ? '#fb923c' : '#688765' }}>{stRain24 == null ? '—' : stRain24.toFixed(1)} <small>{locale === 'th' ? 'มม.' : 'mm'}</small></span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>1h:</span>
                            <span style={{ fontWeight: 600, color: '#30372e', fontSize: '0.8rem' }}>{stRain1 == null ? '—' : stRain1.toFixed(1)} <small>{locale === 'th' ? 'มม.' : 'mm'}</small></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 12 }}>
                  <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 6 }}>
                    {locale === 'th' ? `สถานีที่มีฝนตกสูงสุดในอยุธยา:` : `Top rainfall stations in Ayutthaya:`}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                    {topStations.slice(0, 3).map((st) => {
                      const stRain24 = st.measurementResults.find((m) => m.interval === '24h')?.value;
                      const stName = locale === 'th' ? st.station.stationName?.th : (st.station.stationName?.en || st.station.stationName?.th);
                      return (
                        <div key={st.station.stationCode} className="rain-station-row" style={{ background: '#f6f6f0', border: '1px solid #dfe2d8', borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#252a24' }}>{stName}</div>
                          <div className="sub" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>อ.{st.station.amphoe}</div>
                          <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>24h:</span>
                            <span className={`rain-reading${stRain24 != null && stRain24 > 35 ? ' high-rain' : ''}`} style={{ fontWeight: 700, color: stRain24 != null && stRain24 > 35 ? '#fb923c' : '#688765' }}>{stRain24 == null ? '—' : stRain24.toFixed(1)} <small>{locale === 'th' ? 'มม.' : 'mm'}</small></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="source" style={{ marginTop: 14 }}>
                {text.source}: {rainfall.provider} ({rainfall.standardData?.metadata?.dataProviderCode ?? 'HII'})<br />
                {text.sourceTimestamp}: {rainfall.standardData?.timeSeriesObservation?.[0]?.resultTime || rainfall.checkedAt}<br />
                {text.lastUpdated}: {formatTimestamp(rainfall.checkedAt, locale)}
              </div>
            </div>
          ) : (
            <div>
              <div className="event-warn"><Activity size={18} /><div><b>{text.noObservationStations}</b><div className="sub">{text.observationDisclaimer}</div></div></div>
              <div className="source">{text.source}: {text.noObservationSource} • {text.sourceTimestamp}: —</div>
            </div>
          )}
        </div>

        {/* Real Live Water Level Telemetry Card (ThaiWater / RID 22 Stations) */}
        <div className="card insight-panel water-panel" id="water-level">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2>{locale === 'th' ? 'ระดับน้ำลำน้ำจริง (RID Telemetry)' : 'River Water Level Telemetry'}</h2>
            {waterLevel?.totalStations && (
              <span className="status" style={{ background: '#0e3a5a', color: '#67c9ff', borderColor: '#1d547e', fontSize: '0.75rem' }}>
                {waterLevel.totalStations} {locale === 'th' ? 'สถานีโทรมาตร' : 'Stations'}
              </span>
            )}
          </div>

          {waterLevel?.stations?.length ? (
            <div>
              {/* Filter stations in current district or show top nearby */}
              {(() => {
                const inDistrict = (waterLevel.stations as any[]).filter(
                  (st) => st.district && (st.district.includes(district.name) || district.name.includes(st.district))
                );
                const displayStations = inDistrict.length > 0 ? inDistrict : (waterLevel.stations as any[]).slice(0, 3);
                const isNearbyRef = inDistrict.length === 0;

                return (
                  <div>
                    {isNearbyRef && (
                      <div className="event-warn" style={{ background: '#fff1d2', borderColor: '#d2a348', padding: '10px 12px', marginBottom: 10, fontSize: '0.86rem', color: '#684710' }}>
                        ⚠️ {locale === 'th' ? `ไม่มีสถานีโทรมาตรแม่น้ำหลักใน อ.${district.name} โดยตรง — แสดงสถานีอ้างอิงใกล้เคียง:` : `No river station in ${districtName} directly — showing nearby reference stations:`}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                      {displayStations.map((st) => {
                        const name = locale === 'th' ? st.name.th : st.name.en || st.name.th;
                        const isOverflow = st.situationLevel >= 5;
                        const isCritical = st.situationLevel === 4;
                        const isWarning = st.situationLevel === 3;
                        const badgeColor = isOverflow ? '#b7463c' : isCritical || isWarning ? '#b87a28' : '#527b56';
                        const changeStr = st.changeM !== null && st.changeM !== undefined ? `${st.changeM > 0 ? '+' : ''}${st.changeM.toFixed(2)}m` : '—';
                        const trendSymbol = st.trend === 'rising' ? '↑ ขึ้น' : st.trend === 'falling' ? '↓ ลง' : '→ ทรงตัว';

                        return (
                          <div key={st.stationCode || st.id} className="water-station-row" style={{ background: '#fff', border: `1px solid ${isOverflow ? '#c4473c' : '#c7d0c8'}`, borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#252a24' }}>{name}</div>
                              <span style={{ fontSize: '0.7rem', color: badgeColor, fontWeight: 700 }}>{st.situationText}</span>
                            </div>
                            <div className="sub" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{st.district ? `อ.${st.district}` : ''} {st.riverBasin ? `• ${st.riverBasin}` : ''}</div>
                            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ระดับน้ำ:</span>
                              <b className="water-reading" style={{ color: '#252a24', fontSize: '0.95rem' }}>{st.waterLevelMsl !== null ? `${st.waterLevelMsl.toFixed(2)} ม.รทก.` : 'ข้อมูลไม่พร้อมใช้'}</b>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.75rem' }}>
                              <span style={{ color: '#94a3b8' }}>แนวโน้ม ({trendSymbol}):</span>
                              <span style={{ color: st.trend === 'rising' ? '#f87171' : st.trend === 'falling' ? '#4ade80' : '#cbd5e1' }}>{changeStr}</span>
                            </div>
                            {st.diffBankM !== null && st.diffBankM !== undefined && (
                              <div style={{ marginTop: 4, fontSize: '0.75rem', color: isOverflow ? '#fca5a5' : '#fbbf24', fontWeight: 600 }}>
                                {st.diffBankText || (isOverflow ? 'ล้นตลิ่ง' : 'ต่ำกว่าตลิ่ง')} {Math.abs(st.diffBankM).toFixed(2)} ม.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="source" style={{ marginTop: 14 }}>
                      {text.source}: ThaiWater / กรมชลประทาน (โทรมาตร 22 สถานี)<br />
                      {text.lastUpdated}: {formatTimestamp(waterLevel.checkedAt, locale)}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div>
              <div className="event-warn"><Activity size={18} /><div><b>ข้อมูลโทรมาตรระดับน้ำกำลังโหลด</b><div className="sub">เชื่อมต่อกับ ThaiWater / กรมชลประทาน</div></div></div>
              <div className="source">{text.source}: ThaiWater • {text.sourceTimestamp}: —</div>
            </div>
          )}
        </div>

        <div className="card forecast-panel" id="forecast">
          <div className="section-kicker"><CloudRain size={15}/><span>{locale === 'th' ? 'พยากรณ์' : 'FORECAST'}</span></div>
          <h2>{text.rainfallForecast}</h2>
          <div className="source">{text.source}: {weather?.provider ?? 'Open-Meteo Forecast'} • {text.lastUpdated}: {formatTimestamp(weather?.fetchedAt, locale)}</div>
          {loading ? <div className="muted">{text.loadingForecast}</div> : <div className="forecast">
            {hourly?.time?.slice(0, 12).map((time, index) => {
              const chance = Number(hourly.precipitation_probability?.[index] ?? 0);
              return <div className="hour" key={time}>
                <div className="muted">{new Date(time).toLocaleTimeString(locale === 'th' ? 'th-TH' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                <b>{Number(hourly.precipitation?.[index] ?? 0).toFixed(1)} {locale === 'th' ? 'มม.' : 'mm'}</b>
                <div className="muted">{text.chance(chance)}</div>
                <div className="rainbar"><i style={{ width: `${Math.min(100, chance)}%` }} /></div>
              </div>;
            })}
          </div>}
        </div>
      </section>

      <section className="grid section district-and-context">
        <div className="card district-panel">
          <h2>{text.ayutthayaDistricts}</h2>
          <div className="districts">{districts.map((item, index) => <button className={`district ${index === idx ? 'active' : ''}`} key={item.name} onClick={() => setIdx(index)}>{locale === 'th' ? item.name : districtNamesEnByThai[item.name] ?? item.name}</button>)}</div>
        </div>
        <aside className="signal-key" aria-label={locale === 'th' ? 'ความหมายประเภทข้อมูล' : 'Data type key'}>
          <span className="signal-heading">{locale === 'th' ? 'อ่านข้อมูลให้ตรงประเภท' : 'Read each signal correctly'}</span>
          <span><i className="signal-dot observed-dot"/>OBSERVED <small>{locale === 'th' ? 'ค่าจากสถานี' : 'Station reading'}</small></span>
          <span><i className="signal-dot forecast-dot"/>FORECAST <small>{locale === 'th' ? 'การคาดการณ์' : 'Prediction'}</small></span>
          <span><i className="signal-dot model-dot"/>MODELLED <small>{locale === 'th' ? 'ผลแบบจำลอง' : 'Model output'}</small></span>
          <span><i className="signal-dot evidence-dot"/>EVIDENCE <small>{locale === 'th' ? 'หลักฐานดาวเทียม' : 'Satellite evidence'}</small></span>
        </aside>
      </section>

      <section className="assistant-entry" aria-labelledby="assistant-title">
        <div className="assistant-entry-mark"><Bot size={24}/></div>
        <div className="assistant-entry-copy">
          <span className="section-kicker">{locale === 'th' ? 'ผู้ช่วย FloodWatch' : 'FLOODWATCH ASSISTANT'}</span>
          <h2 id="assistant-title">{locale === 'th' ? 'ถามสถานการณ์จากข้อมูลที่มี' : 'Ask about the information available'}</h2>
          <p>{locale === 'th' ? 'ผู้ช่วย AI ใช้ข้อมูลสถานีและแหล่งข้อมูลของระบบประกอบคำตอบ ตรวจสอบเวลาสังเกตและข้อจำกัดก่อนตัดสินใจ' : 'The AI assistant uses this service’s station and provider data. Check observation times and limitations before acting.'}</p>
        </div>
        <Link href="/ai-test" className="assistant-entry-link"><Bot size={16}/>{locale === 'th' ? 'เปิดผู้ช่วย AI' : 'Open AI assistant'}<span aria-hidden="true">↗</span></Link>
      </section>

      <section className="section info-grid" id="data-limitations">
        <div className="card info-card" id="data-sources">
          <div className="section-kicker"><Database size={15} /> {locale === 'th' ? 'แหล่งข้อมูล' : 'Data sources'}</div>
          <h2>{locale === 'th' ? 'ข้อมูลจากหน่วยงานและแบบจำลอง' : 'Agency observations and models'}</h2>
          <div className="source-list">
            <a href="https://api-v3.thaiwater.net/api/v1/thaiwater30/public/thailand_main_rain?province_code=14" target="_blank" rel="noreferrer"><CloudRain size={17}/><span><b>ThaiWater · HII</b><small>{locale === 'th' ? 'ฝนตรวจวัดจากสถานีภาคพื้นดิน' : 'Ground rainfall observations'}</small></span><span className="data-tag observed-tag">OBSERVED</span></a>
            <a href="https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load?province_code=14" target="_blank" rel="noreferrer"><Waves size={17}/><span><b>Royal Irrigation Department · RID</b><small>{locale === 'th' ? 'ระดับน้ำจากสถานีโทรมาตร' : 'River levels from telemetry stations'}</small></span><span className="data-tag observed-tag">OBSERVED</span></a>
            <a href="https://api-gateway.gistda.or.th/api/2.0/resources/features/flood/1day" target="_blank" rel="noreferrer"><Satellite size={17}/><span><b>GISTDA FloodCheck</b><small>{locale === 'th' ? 'หลักฐานน้ำท่วมจากดาวเทียม' : 'Satellite flood evidence'}</small></span><span className="data-tag evidence-tag">EVIDENCE</span></a>
            <a href="https://api.open-meteo.com/v1/forecast" target="_blank" rel="noreferrer"><CloudRain size={17}/><span><b>Open-Meteo</b><small>{locale === 'th' ? 'พยากรณ์อากาศและฝน' : 'Weather and rainfall forecast'}</small></span><span className="data-tag forecast-tag">FORECAST</span></a>
            <a href="https://flood-api.open-meteo.com/v1/flood" target="_blank" rel="noreferrer"><Waves size={17}/><span><b>GloFAS · Open-Meteo Flood API</b><small>{locale === 'th' ? 'แบบจำลองการไหลของแม่น้ำ' : 'Modelled river discharge'}</small></span><span className="data-tag model-tag">MODELLED</span></a>
          </div>
        </div>
        <div className="card info-card limitations-card">
          <div className="section-kicker"><ShieldAlert size={15} /> {locale === 'th' ? 'ข้อจำกัดข้อมูล' : 'Data limitations'}</div>
          <h2>{locale === 'th' ? 'ใช้ข้อมูลอย่างเข้าใจข้อจำกัด' : 'Read each signal in context'}</h2>
          <ul className="limitation-list">
            {(locale === 'th' ? [
              'ข้อมูลจาก API ภายนอกอาจล่าช้าหรือไม่พร้อมใช้งาน',
              'ดาวเทียมมีข้อจำกัดด้านพื้นที่และรอบเวลาถ่ายภาพ การไม่พบหลักฐานล่าสุดไม่ได้แปลว่าไม่มีน้ำท่วม',
              'ค่าจากสถานีเป็นค่าที่จุดตรวจวัด ไม่ได้แทนทุกพื้นที่โดยรอบ',
              'พยากรณ์และแบบจำลอง GloFAS เป็นคนละประเภทกับค่าตรวจวัดจริง',
              'ระดับน้ำวิกฤตที่สถานีไม่ได้ยืนยันว่าพื้นที่โดยรอบถูกน้ำท่วม',
              'ระบบนี้ไม่ทดแทนประกาศเตือนภัยจากหน่วยงานทางการ',
            ] : [
              'External APIs can be delayed or unavailable.',
              'Satellite coverage and revisit times are limited; no recent evidence does not prove there is no flooding.',
              'Station readings describe the gauge location, not every nearby place.',
              'Forecasts and GloFAS model outputs are not direct observations.',
              'A critical station level does not confirm flooded land nearby.',
              'This service does not replace official emergency warnings.',
            ]).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>

      <footer className="footer site-footer"><b>FloodWatch Ayutthaya</b><nav aria-label={locale === 'th' ? 'ลิงก์ท้ายหน้า' : 'Footer links'}><a href="#data-limitations">{locale === 'th' ? 'แหล่งข้อมูลและข้อจำกัด' : 'Sources & limitations'}</a><Link href="/about-developer">{locale === 'th' ? 'เกี่ยวกับผู้พัฒนา' : 'About developer'}</Link></nav></footer>
      {toast && <div className="toast">{text[toast]}</div>}

      {/* Floating AI Chat Assistant Widget */}
      <AiChatWidget currentDistrictName={district.name} locale={locale} />
    </main>
  );
}
