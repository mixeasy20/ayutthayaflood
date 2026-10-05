'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  Crosshair,
  Minus,
  Plus,
  RotateCcw,
  MapPin,
  Waves,
  CloudRain,
  Droplets,
  Building2,
  ShieldAlert,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  TrendingUp,
  TrendingDown,
  Minus as MinusIcon,
} from 'lucide-react';
import type {
  CircleLayerSpecification,
  FillLayerSpecification,
  GeoJSONSource,
  GeoJSONSourceSpecification,
  LayerSpecification,
  LineLayerSpecification,
  Map as MapLibreMap,
  Marker,
  Popup,
  StyleSpecification,
} from 'maplibre-gl';
import { districtNamesThByCode, messages, type Locale, type RiskKey } from '../lib/i18n';
import { WATER_CONTROL_STRUCTURES, type WaterControlStructure } from '../lib/water-control';
import type { WaterLevelStation } from '../app/api/water-level/route';

export type GeoJSONLayerStyle =
  | Omit<FillLayerSpecification, 'id' | 'source'>
  | Omit<LineLayerSpecification, 'id' | 'source'>
  | Omit<CircleLayerSpecification, 'id' | 'source'>;

export type FloodMapOverlay = {
  id: string;
  data: GeoJSONSourceSpecification['data'];
  layer: GeoJSONLayerStyle;
};

export type FloodMapProps = {
  locale?: Locale;
  rainfallData?: any;
  waterLevelData?: { stations?: WaterLevelStation[] } | null;
  floodEventData?: {
    status?: string;
    timestamp?: string | null;
    provider?: string;
    evidence?: {
      numberMatched?: number;
      numberReturned?: number;
      features?: any[];
    } | null;
    telemetryEvidence?: {
      hasCriticalOrOverflow?: boolean;
      stationsCount?: number;
      stations?: any[];
      features?: any[];
    } | null;
    historicalEvidence?: {
      count?: number;
      events?: any[];
    } | null;
  } | null;
  selectedDistrict?: { name: string; lat: number; lon: number } | null;
  riskSummary?: { key: RiskKey; rain: number | null; probability: number | null; discharge: number | null } | null;
  modelledDischarge?: number | null;
  overlays?: FloodMapOverlay[];
};

type MapStatus = 'loading' | 'ready' | 'error';
type MapLibreMarkerConstructor = typeof import('maplibre-gl').Marker;
type MapLibrePopupConstructor = typeof import('maplibre-gl').Popup;
type BoundaryPosition = [longitude: number, latitude: number];

type AyutthayaBoundaryCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: { shapeName: string; shapeISO: 'TH-14' };
    geometry: { type: 'Polygon'; coordinates: BoundaryPosition[][] };
  }>;
};

type DistrictBoundaryCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: {
      districtCode: string;
      districtName: string;
      labelPoint: BoundaryPosition;
    };
    geometry: { type: 'Polygon'; coordinates: BoundaryPosition[][] };
  }>;
};

const AYUTTHAYA_CENTER: [number, number] = [100.56, 14.35];
const AYUTTHAYA_BOUNDS_OPTIONS = {
  padding: { top: 80, right: 80, bottom: 60, left: 60 },
  maxZoom: 9.8,
};

const PROVINCE_SOURCE_ID = 'ayutthaya-province-boundary';
const DISTRICT_SOURCE_ID = 'ayutthaya-district-boundaries';
const FLOOD_EVIDENCE_SOURCE_ID = 'flood-evidence-source';
const RAINFALL_SOURCE_ID = 'rainfall-stations-source';
const WATER_LEVEL_SOURCE_ID = 'water-level-stations-source';
const WATER_CONTROL_SOURCE_ID = 'water-control-source';
const RISK_SOURCE_ID = 'risk-district-source';

const BASEMAP_STYLE = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'neutral-background',
      type: 'background',
      paint: { 'background-color': '#eeefe8' },
    },
  ],
} satisfies StyleSpecification;

function isAyutthayaBoundary(value: unknown): value is AyutthayaBoundaryCollection {
  if (!value || typeof value !== 'object') return false;
  const collection = value as Partial<AyutthayaBoundaryCollection>;
  const feature = collection.features?.[0];
  const ring = feature?.geometry?.coordinates?.[0];

  return (
    collection.type === 'FeatureCollection' &&
    feature?.type === 'Feature' &&
    feature.properties.shapeISO === 'TH-14' &&
    feature.geometry.type === 'Polygon' &&
    Array.isArray(ring) &&
    ring.length >= 4 &&
    ring.every(
      (pos) => Array.isArray(pos) && typeof pos[0] === 'number' && typeof pos[1] === 'number'
    )
  );
}

function isDistrictBoundaryCollection(value: unknown): value is DistrictBoundaryCollection {
  if (!value || typeof value !== 'object') return false;
  const collection = value as Partial<DistrictBoundaryCollection>;

  return (
    collection.type === 'FeatureCollection' &&
    Array.isArray(collection.features) &&
    collection.features.length > 0 &&
    collection.features.every(
      (feature) =>
        feature.type === 'Feature' &&
        typeof feature.properties.districtCode === 'string' &&
        typeof feature.properties.districtName === 'string' &&
        Array.isArray(feature.properties.labelPoint) &&
        typeof feature.properties.labelPoint[0] === 'number' &&
        typeof feature.properties.labelPoint[1] === 'number' &&
        feature.geometry.type === 'Polygon' &&
        Array.isArray(feature.geometry.coordinates[0])
    )
  );
}

function getBoundaryBounds(boundary: BoundaryPosition[]): [[number, number], [number, number]] {
  const longitudes = boundary.map(([lon]) => lon);
  const latitudes = boundary.map(([, lat]) => lat);
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
}

// Compute a representative center point for Polygon geometry without inventing false data
function getPolygonRepresentativePoint(coordinates: any): [number, number] | null {
  try {
    const ring = Array.isArray(coordinates[0][0]) ? coordinates[0] : coordinates;
    let sumLon = 0;
    let sumLat = 0;
    let count = 0;
    for (const [lon, lat] of ring) {
      if (typeof lon === 'number' && typeof lat === 'number') {
        sumLon += lon;
        sumLat += lat;
        count++;
      }
    }
    return count > 0 ? [sumLon / count, sumLat / count] : null;
  } catch {
    return null;
  }
}

export default function FloodMap({
  locale = 'en',
  rainfallData,
  waterLevelData,
  floodEventData,
  selectedDistrict,
  riskSummary,
  modelledDischarge,
  overlays = [],
}: FloodMapProps) {
  const text = messages[locale];
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const boundsRef = useRef<[[number, number], [number, number]] | null>(null);
  const markerConstructorRef = useRef<MapLibreMarkerConstructor | null>(null);
  const popupConstructorRef = useRef<MapLibrePopupConstructor | null>(null);
  const activePopupRef = useRef<Popup | null>(null);

  const locationMarkerRef = useRef<Marker | null>(null);
  const districtLabelMarkersRef = useRef<Marker[]>([]);
  const floodEvidenceMarkersRef = useRef<Marker[]>([]);
  const waterControlMarkersRef = useRef<Marker[]>([]);
  const districtBoundariesGeoJSONRef = useRef<DistrictBoundaryCollection | null>(null);

  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const [mapError, setMapError] = useState('');
  const [locationMessage, setLocationMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [districtCount, setDistrictCount] = useState(16);

  // Situation Layer Toggles
  const [showFloodEvidence, setShowFloodEvidence] = useState(true);
  const [showRainfall, setShowRainfall] = useState(true);
  const [showWaterLevel, setShowWaterLevel] = useState(true);
  const [showWaterControl, setShowWaterControl] = useState(false);
  const [showRiskModel, setShowRiskModel] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(true);

  // Prepare GeoJSON for Rainfall Stations (32 ThaiWater stations)
  const rainfallGeoJSON = useMemo(() => {
    const stations = rainfallData?.standardData?.timeSeriesObservation ?? [];
    if (!stations.length) return { type: 'FeatureCollection', features: [] };

    const features = stations
      .filter((st: any) => st.station?.lat !== null && st.station?.long !== null)
      .map((st: any) => {
        const rain24 = st.measurementResults?.find((m: any) => m.interval === '24h')?.value ?? 0;
        const rain1 = st.measurementResults?.find((m: any) => m.interval === '1h')?.value ?? 0;
        const name =
          locale === 'th'
            ? st.station.stationName?.th || st.station.stationCode
            : st.station.stationName?.en || st.station.stationName?.th || st.station.stationCode;
        const time = st.resultTime || st.measurementResults?.[0]?.measureTime || null;

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [st.station.long, st.station.lat],
          },
          properties: {
            id: st.station.stationCode,
            name,
            code: st.station.stationCode,
            amphoe: st.station.amphoe || '',
            tumbon: st.station.tumbon || '',
            rain24,
            rain1,
            time,
            agency: st.observationMetadata?.observeAgencyShortName || 'ThaiWater / HII',
          },
        };
      });

    return { type: 'FeatureCollection', features };
  }, [rainfallData, locale]);

  // Prepare GeoJSON for Water Level Stations (22 ThaiWater telemetry stations)
  const waterLevelGeoJSON = useMemo(() => {
    const stations = waterLevelData?.stations ?? [];
    if (!stations.length) return { type: 'FeatureCollection', features: [] };

    const features = stations
      .filter((st) => st.lat !== null && st.lon !== null)
      .map((st) => {
        const name = locale === 'th' ? st.name.th : st.name.en || st.name.th;
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [st.lon, st.lat],
          },
          properties: {
            id: st.id,
            name,
            code: st.stationCode,
            district: st.district,
            subdistrict: st.subdistrict,
            riverBasin: st.riverBasin,
            waterLevelMsl: st.waterLevelMsl,
            previousWaterLevelMsl: st.previousWaterLevelMsl,
            changeM: st.changeM,
            trend: st.trend,
            situationLevel: st.situationLevel,
            situationText: st.situationText,
            diffBankM: st.diffBankM,
            diffBankText: st.diffBankText,
            observationTime: st.observationTime,
            source: st.source,
          },
        };
      });

    return { type: 'FeatureCollection', features };
  }, [waterLevelData, locale]);

  // Prepare GeoJSON for Flood Evidence (GISTDA satellite + telemetry overflow + Supabase history)
  const floodEvidenceGeoJSON = useMemo(() => {
    const currentFeatures = (floodEventData as any)?.evidence?.features ?? [];
    const telemetryFeatures = (floodEventData as any)?.telemetryEvidence?.features ?? [];
    const historicalEvents = (floodEventData as any)?.historicalEvidence?.events ?? [];

    const resultFeatures: any[] = [];

    // 1. Current Live Satellite Features from GISTDA (Red polygons)
    currentFeatures.forEach((f: any, idx: number) => {
      if (f && f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon' || f.geometry.type === 'Point')) {
        resultFeatures.push({
          ...f,
          properties: {
            ...f.properties,
            featureId: f.id || `flood-evidence-current-${idx}`,
            source: (floodEventData as any)?.provider || 'GISTDA FloodCheck',
            timestamp: (floodEventData as any)?.timestamp || null,
            evidenceType: 'current',
          },
        });
      }
    });

    // 2. Ground Telemetry Overflow Stations from ThaiWater (Orange circles)
    //    These are real Level 4/5 critical overflow stations — distinct from satellite evidence
    telemetryFeatures.forEach((f: any, idx: number) => {
      if (f && f.geometry && (f.geometry.type === 'Point' || f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')) {
        resultFeatures.push({
          ...f,
          properties: {
            ...f.properties,
            featureId: f.id || `flood-telemetry-${idx}`,
            evidenceType: f.properties?.evidenceType || 'ground_telemetry_overflow',
          },
        });
      }
    });

    // 3. Historical Flood Events from Supabase (Deep Orange)
    historicalEvents.forEach((ev: any, idx: number) => {
      if (ev.geometry && (ev.geometry.type === 'Polygon' || ev.geometry.type === 'MultiPolygon' || ev.geometry.type === 'Point')) {
        resultFeatures.push({
          type: 'Feature',
          geometry: ev.geometry,
          properties: {
            featureId: ev.id || `flood-evidence-hist-${idx}`,
            title: ev.title || 'Historical Flood Observation',
            description: ev.description,
            source: ev.source || 'Historical Archive',
            timestamp: ev.observed_at || null,
            evidenceType: 'historical',
            confidence: ev.confidence,
          },
        });
      } else if (typeof ev.latitude === 'number' && typeof ev.longitude === 'number') {
        resultFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [ev.longitude, ev.latitude],
          },
          properties: {
            featureId: ev.id || `flood-evidence-hist-${idx}`,
            title: ev.title || 'Historical Flood Point',
            description: ev.description,
            source: ev.source || 'Historical Archive',
            timestamp: ev.observed_at || null,
            evidenceType: 'historical',
            confidence: ev.confidence,
          },
        });
      }
    });

    return {
      type: 'FeatureCollection',
      features: resultFeatures,
    };
  }, [floodEventData]);

  // Prepare GeoJSON for Dams & Water Control Structures
  const waterControlGeoJSON = useMemo(() => {
    const features = WATER_CONTROL_STRUCTURES.map((wc) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [wc.lon, wc.lat],
      },
      properties: {
        id: wc.id,
        name: locale === 'th' ? wc.name.th : wc.name.en,
        typeLabel: locale === 'th' ? wc.typeLabel.th : wc.typeLabel.en,
        waterway: locale === 'th' ? wc.waterway.th : wc.waterway.en,
        province: locale === 'th' ? wc.province.th : wc.province.en,
        district: wc.district ? (locale === 'th' ? wc.district.th : wc.district.en) : '',
        agency: wc.agency,
        description: locale === 'th' ? wc.description.th : wc.description.en,
      },
    }));

    return { type: 'FeatureCollection', features };
  }, [locale]);

  // Prepare GeoJSON for Selected District Predictive Risk Highlight (Never entire province)
  const riskDistrictGeoJSON = useMemo(() => {
    if (!selectedDistrict || !districtBoundariesGeoJSONRef.current || !riskSummary) {
      return { type: 'FeatureCollection', features: [] };
    }

    const feature = districtBoundariesGeoJSONRef.current.features.find((f) => {
      const name = f.properties.districtName;
      const thName = districtNamesThByCode[f.properties.districtCode] || name;
      return name === selectedDistrict.name || thName === selectedDistrict.name;
    });

    if (!feature) return { type: 'FeatureCollection', features: [] };

    return {
      type: 'FeatureCollection',
      features: [
        {
          ...feature,
          properties: {
            ...feature.properties,
            riskKey: riskSummary.key,
            rainForecast: riskSummary.rain,
            rainProbability: riskSummary.probability,
            modelledDischarge: riskSummary.discharge ?? modelledDischarge,
          },
        },
      ],
    };
  }, [selectedDistrict, riskSummary, modelledDischarge]);

  // Initialize MapLibre Map
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    setMapStatus('loading');
    setMapError('');

    void Promise.all([
      import('maplibre-gl'),
      fetch('/data/ayutthaya-province.geojson').then((res) => {
        if (!res.ok) throw new Error('Ayutthaya province boundary could not be loaded.');
        return res.json() as Promise<unknown>;
      }),
      fetch('/data/ayutthaya-districts.geojson').then((res) => {
        if (!res.ok) throw new Error('Ayutthaya district boundaries could not be loaded.');
        return res.json() as Promise<unknown>;
      }),
    ])
      .then(([maplibre, boundaryValue, districtValue]) => {
        if (cancelled || !containerRef.current) return;
        if (!isAyutthayaBoundary(boundaryValue)) throw new Error('Ayutthaya province boundary data is invalid.');
        if (!isDistrictBoundaryCollection(districtValue)) throw new Error('Ayutthaya district boundary data is invalid.');

        districtBoundariesGeoJSONRef.current = districtValue;
        setDistrictCount(districtValue.features.length);

        const provinceFeature = boundaryValue.features[0];
        const outerRing = provinceFeature.geometry.coordinates[0];
        const provinceBounds = getBoundaryBounds(outerRing);
        boundsRef.current = provinceBounds;

        const { Map, Marker: MapMarker, Popup: MapPopup, setWorkerUrl } = maplibre;
        setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
        markerConstructorRef.current = MapMarker;
        popupConstructorRef.current = MapPopup;

        map = new Map({
          container: containerRef.current,
          style: BASEMAP_STYLE,
          center: AYUTTHAYA_CENTER,
          zoom: 9.1,
          minZoom: 8.5,
          maxZoom: 16,
          maxBounds: [
            [provinceBounds[0][0] - 0.5, provinceBounds[0][1] - 0.5],
            [provinceBounds[1][0] + 0.5, provinceBounds[1][1] + 0.5],
          ],
          attributionControl: false,
          pitchWithRotate: false,
          dragRotate: false,
        });
        mapRef.current = map;

        map.once('load', () => {
          if (cancelled || !map) return;

          // 1. Province & District Base Boundaries
          map.addSource(PROVINCE_SOURCE_ID, { type: 'geojson', data: boundaryValue });
          map.addSource(DISTRICT_SOURCE_ID, { type: 'geojson', data: districtValue });

          map.addLayer({
            id: 'ayutthaya-province-fill',
            type: 'fill',
            source: PROVINCE_SOURCE_ID,
            paint: { 'fill-color': '#dce7d6', 'fill-opacity': 0.48 },
          });

          map.addLayer({
            id: 'ayutthaya-district-lines',
            type: 'line',
            source: DISTRICT_SOURCE_ID,
            paint: { 'line-color': '#8c9b82', 'line-width': 1, 'line-opacity': 0.62 },
          });

          map.addLayer({
            id: 'ayutthaya-province-outline',
            type: 'line',
            source: PROVINCE_SOURCE_ID,
            paint: { 'line-color': '#586f4f', 'line-width': 2.2, 'line-opacity': 0.9 },
          });

          // 2. Predictive Risk Layer (Dashed highlight for selected district only)
          map.addSource(RISK_SOURCE_ID, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          map.addLayer({
            id: 'risk-district-fill',
            type: 'fill',
            source: RISK_SOURCE_ID,
            paint: {
              'fill-color': '#f59e0b',
              'fill-opacity': 0.15,
            },
          });
          map.addLayer({
            id: 'risk-district-outline',
            type: 'line',
            source: RISK_SOURCE_ID,
            paint: {
              'line-color': '#f59e0b',
              'line-width': 2.5,
              'line-dasharray': [3, 2],
              'line-opacity': 0.85,
            },
          });

          // 3. Flood Evidence Polygons & Points (Current: Red, Historical: Orange)
          map.addSource(FLOOD_EVIDENCE_SOURCE_ID, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          map.addLayer({
            id: 'flood-evidence-polygons-fill',
            type: 'fill',
            source: FLOOD_EVIDENCE_SOURCE_ID,
            filter: ['any', ['==', '$type', 'Polygon'], ['==', '$type', 'MultiPolygon']],
            paint: {
              'fill-color': [
                'case',
                ['==', ['get', 'evidenceType'], 'historical'],
                '#ea580c', // Historical: Orange
                '#dc2626', // Current: Red
              ],
              'fill-opacity': 0.55,
            },
          });
          map.addLayer({
            id: 'flood-evidence-polygons-outline',
            type: 'line',
            source: FLOOD_EVIDENCE_SOURCE_ID,
            filter: ['any', ['==', '$type', 'Polygon'], ['==', '$type', 'MultiPolygon']],
            paint: {
              'line-color': [
                'case',
                ['==', ['get', 'evidenceType'], 'historical'],
                '#c2410c',
                '#991b1b',
              ],
              'line-width': 2.5,
              'line-opacity': 0.95,
            },
          });
          map.addLayer({
            id: 'flood-evidence-points-circle',
            type: 'circle',
            source: FLOOD_EVIDENCE_SOURCE_ID,
            filter: ['==', '$type', 'Point'],
            paint: {
              'circle-radius': 8,
              'circle-color': [
                'case',
                ['==', ['get', 'evidenceType'], 'historical'],
                '#ea580c',
                '#dc2626',
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0.9,
            },
          });

          // 4. Rainfall Stations Circles (ThaiWater)
          map.addSource(RAINFALL_SOURCE_ID, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          map.addLayer({
            id: 'rainfall-stations-circle',
            type: 'circle',
            source: RAINFALL_SOURCE_ID,
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 8.5, 6, 12, 10, 15, 14],
              'circle-color': [
                'step',
                ['get', 'rain24'],
                '#a4a79c', // 0 mm (No rain)
                0.1,
                '#688765', // <10 mm (Light)
                10,
                '#eab308', // 10-35 mm (Moderate)
                35,
                '#f97316', // 35-90 mm (Heavy)
                90,
                '#ef4444', // >=90 mm (Very heavy)
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0.95,
            },
          });

          // 5. Water Level Stations Circles (ThaiWater)
          map.addSource(WATER_LEVEL_SOURCE_ID, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          map.addLayer({
            id: 'water-level-stations-circle',
            type: 'circle',
            source: WATER_LEVEL_SOURCE_ID,
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 8.5, 7, 12, 11, 15, 15],
              'circle-color': [
                'step',
                ['get', 'situationLevel'],
                '#688765', // 1: Normal (sage)
                2,
                '#eab308', // 2: Watch (Yellow)
                3,
                '#f97316', // 3: Warning (Orange)
                4,
                '#ef4444', // 4/5: Critical / Overflow (Red)
              ],
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0.95,
            },
          });

          // 6. Water Control & Dams Circles (RID Infrastructure)
          map.addSource(WATER_CONTROL_SOURCE_ID, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          map.addLayer({
            id: 'water-control-circle',
            type: 'circle',
            source: WATER_CONTROL_SOURCE_ID,
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 8.5, 7, 12, 11, 15, 15],
              'circle-color': '#887f67', // Neutral infrastructure
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#f3e8ff',
              'circle-opacity': 0.95,
            },
          });

          // District Label Markers
          districtLabelMarkersRef.current = districtValue.features.map((feature) => {
            const label = document.createElement('span');
            const { districtCode, districtName } = feature.properties;
            label.textContent = locale === 'th' ? districtNamesThByCode[districtCode] ?? districtName : districtName;
            label.setAttribute('aria-label', label.textContent);
            Object.assign(label.style, {
              color: '#394537',
              textShadow: '0 1px 2px rgba(255,255,250,.95)',
              fontSize: '10px',
              fontWeight: '600',
              lineHeight: '1.2',
              background: 'rgba(255, 254, 250, .92)',
              border: '1px solid #cbd2c5',
              borderRadius: '4px',
              padding: '2px 5px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            });
            return new MapMarker({ element: label, anchor: 'center' })
              .setLngLat(feature.properties.labelPoint)
              .addTo(map!);
          });

          map.fitBounds(provinceBounds, AYUTTHAYA_BOUNDS_OPTIONS);

          const updateDistrictLabels = () => {
            const visible = (map?.getZoom() ?? 0) >= 9.2;
            districtLabelMarkersRef.current.forEach((marker) => {
              marker.getElement().style.visibility = visible ? 'visible' : 'hidden';
            });
          };
          map.on('zoom', updateDistrictLabels);
          updateDistrictLabels();

          // Interactive Click & Hover Listeners
          const interactiveLayers = [
            'rainfall-stations-circle',
            'water-level-stations-circle',
            'water-control-circle',
            'flood-evidence-polygons-fill',
            'flood-evidence-points-circle',
          ];

          interactiveLayers.forEach((layerId) => {
            map?.on('mouseenter', layerId, () => {
              map!.getCanvas().style.cursor = 'pointer';
            });
            map?.on('mouseleave', layerId, () => {
              map!.getCanvas().style.cursor = '';
            });
          });

          // CLICK: Rainfall Station Popup
          map.on('click', 'rainfall-stations-circle', (e) => {
            const feature = e.features?.[0];
            if (!feature || !feature.properties) return;
            const props = feature.properties;
            const coords = (feature.geometry as any).coordinates.slice();

            const rain24Val = typeof props.rain24 === 'number' ? `${props.rain24.toFixed(1)} mm` : `${props.rain24 ?? '—'} mm`;
            const rain1Val = typeof props.rain1 === 'number' ? `${props.rain1.toFixed(1)} mm` : `${props.rain1 ?? '—'} mm`;
            const timeStr = props.time ? new Date(props.time).toLocaleString(locale === 'th' ? 'th-TH' : 'en-GB') : 'Not available';

            const html = `
              <div style="font-family: inherit; font-size: 13px; line-height: 1.5;">
                <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; color: #55714d; margin-bottom: 6px; font-size: 14px;">
                  🌧️ ${props.name} <span style="font-size: 11px; background: #e9eee2; color: #465c41; padding: 1px 6px; border-radius: 4px;">${props.code}</span>
                </div>
                <div style="color: #6d756b; font-size: 12px; margin-bottom: 8px;">
                  ${props.tumbon ? `ต.${props.tumbon} ` : ''}${props.amphoe ? `อ.${props.amphoe}` : ''}
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: #f4f4ee; padding: 8px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #d9ddd2;">
                  <div>
                    <div style="font-size: 11px; color: #6d756b;">1-Hour Rain</div>
                    <div style="font-weight: 700; color: #252a24; font-size: 15px;">${rain1Val}</div>
                  </div>
                  <div>
                    <div style="font-size: 11px; color: #6d756b;">24-Hour Rain</div>
                    <div style="font-weight: 700; color: #55714d; font-size: 15px;">${rain24Val}</div>
                  </div>
                </div>
                <div style="font-size: 11px; color: #737a70;">
                  <div>⏱️ <b>Observed:</b> ${timeStr}</div>
                  <div>📡 <b>Source:</b> ${props.agency || 'ThaiWater / HII'}</div>
                  <div style="margin-top: 4px; font-style: italic; color: #596257; font-size: 10px;">*Point sensor observation; does not represent whole district.</div>
                </div>
              </div>
            `;

            activePopupRef.current?.remove();
            activePopupRef.current = new MapPopup({ closeButton: true, maxWidth: '300px' })
              .setLngLat(coords)
              .setHTML(html)
              .addTo(map!);
          });

          // CLICK: Water Level Station Popup
          map.on('click', 'water-level-stations-circle', (e) => {
            const feature = e.features?.[0];
            if (!feature || !feature.properties) return;
            const props = feature.properties;
            const coords = (feature.geometry as any).coordinates.slice();

            const curLevel = props.waterLevelMsl !== null && props.waterLevelMsl !== undefined ? `${Number(props.waterLevelMsl).toFixed(2)} m MSL` : 'Data Unavailable';
            const prevLevel = props.previousWaterLevelMsl !== null && props.previousWaterLevelMsl !== undefined ? `${Number(props.previousWaterLevelMsl).toFixed(2)} m MSL` : '—';
            const changeVal = props.changeM !== null && props.changeM !== undefined ? `${Number(props.changeM) > 0 ? '+' : ''}${Number(props.changeM).toFixed(2)} m` : '—';

            let trendBadge = `<span style="background: #efeee8; color: #585d53; padding: 2px 6px; border-radius: 4px; font-size: 11px;">→ Stable (ทรงตัว)</span>`;
            if (props.trend === 'rising') {
              trendBadge = `<span style="background: #f8e9e5; color: #9c3e35; padding: 2px 6px; border-radius: 4px; font-size: 11px;">↑ Rising (สูงขึ้น)</span>`;
            } else if (props.trend === 'falling') {
              trendBadge = `<span style="background: #e9f0e6; color: #446c4a; padding: 2px 6px; border-radius: 4px; font-size: 11px;">↓ Falling (ลดลง)</span>`;
            }

            const timeStr = props.observationTime ? new Date(props.observationTime).toLocaleString(locale === 'th' ? 'th-TH' : 'en-GB') : 'Not available';

            const html = `
              <div style="font-family: inherit; font-size: 13px; line-height: 1.5;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 4px;">
                  <div style="font-weight: 700; color: #55714d; font-size: 14px;">💧 ${props.name}</div>
                  <span style="font-size: 11px; background: #e9eee2; color: #465c41; padding: 1px 6px; border-radius: 4px;">${props.code}</span>
                </div>
                <div style="color: #6d756b; font-size: 12px; margin-bottom: 8px;">
                  ${props.subdistrict ? `ต.${props.subdistrict} ` : ''}${props.district ? `อ.${props.district}` : ''} ${props.riverBasin ? `• ${props.riverBasin}` : ''}
                </div>
                <div style="background: #f4f4ee; padding: 8px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #d9ddd2;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 12px; color: #6d756b;">Current Level:</span>
                    <b style="font-size: 15px; color: #252a24;">${curLevel}</b>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #6d756b; margin-bottom: 4px;">
                    <span>Previous Level:</span>
                    <span>${prevLevel}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #6d756b; margin-bottom: 4px;">
                    <span>Change:</span>
                    <b style="color: #252a24;">${changeVal}</b>
                  </div>
                  <div style="margin-top: 6px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 11px; color: #6d756b;">Trend:</span>
                    ${trendBadge}
                  </div>
                  ${props.diffBankText ? `<div style="margin-top: 6px; font-size: 11px; color: #fbbf24; font-weight: 600;">📊 ${props.diffBankText} ${props.diffBankM !== null ? `${props.diffBankM} m` : ''}</div>` : ''}
                </div>
                <div style="font-size: 11px; color: #737a70;">
                  <div>⏱️ <b>Observed:</b> ${timeStr}</div>
                  <div>📡 <b>Source:</b> ${props.source || 'Royal Irrigation Dept (RID) / ThaiWater'}</div>
                </div>
              </div>
            `;

            activePopupRef.current?.remove();
            activePopupRef.current = new MapPopup({ closeButton: true, maxWidth: '300px' })
              .setLngLat(coords)
              .setHTML(html)
              .addTo(map!);
          });

          // CLICK: Water Control & Dams Popup
          map.on('click', 'water-control-circle', (e) => {
            const feature = e.features?.[0];
            if (!feature || !feature.properties) return;
            const props = feature.properties;
            const coords = (feature.geometry as any).coordinates.slice();

            const html = `
              <div style="font-family: inherit; font-size: 13px; line-height: 1.5;">
                <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; color: #c084fc; margin-bottom: 4px; font-size: 14px;">
                  🏗️ ${props.name}
                </div>
                <div style="color: #6d756b; font-size: 12px; margin-bottom: 8px;">
                  ${props.typeLabel} • ${props.waterway}
                </div>
                <div style="background: #19162e; padding: 8px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #3b2a59; color: #e2e8f0; font-size: 12px;">
                  ${props.description}
                </div>
                <div style="font-size: 11px; color: #6d756b;">
                  <div>📍 <b>Location:</b> ${props.district ? `${props.district}, ` : ''}${props.province}</div>
                  <div>📡 <b>Managing Agency:</b> ${props.agency}</div>
                </div>
              </div>
            `;

            activePopupRef.current?.remove();
            activePopupRef.current = new MapPopup({ closeButton: true, maxWidth: '320px' })
              .setLngLat(coords)
              .setHTML(html)
              .addTo(map!);
          });

          // CLICK: Flood Evidence Polygon / Point Popup
          const handleFloodEvidenceClick = (e: any) => {
            const feature = e.features?.[0];
            if (!feature || !feature.properties) return;
            const coords = e.lngLat;
            const props = feature.properties;
            const timeStr = props.timestamp ? new Date(props.timestamp).toLocaleString(locale === 'th' ? 'th-TH' : 'en-GB') : 'Recent observation';

            const title = props.title || (locale === 'th' ? '🌊 หลักฐานพื้นที่น้ำท่วมขัง' : '🌊 Confirmed Flood Evidence');
            const desc = props.description || (locale === 'th' ? 'ตรวจพบร่องรอยน้ำท่วมขังบนผิวดินหรือน้ำล้นตลิ่งจากแม่น้ำ' : 'Confirmed ground inundation boundary detected by satellite or river telemetry.');

            const html = `
              <div style="font-family: inherit; font-size: 13px; line-height: 1.5;">
                <div style="font-weight: 700; color: #f87171; font-size: 14px; margin-bottom: 4px;">
                  ${title}
                </div>
                <div style="background: #1e1b2e; border: 1px solid #7f1d1d; color: #fecaca; padding: 8px; border-radius: 6px; margin-bottom: 8px; font-size: 12px;">
                  ${desc}
                </div>
                <div style="font-size: 11px; color: #6d756b;">
                  <div>⏱️ <b>เวลาตรวจพบ:</b> ${timeStr}</div>
                  <div>📡 <b>แหล่งข้อมูล:</b> ${props.source || 'GISTDA FloodCheck'}</div>
                  ${props.waterLevelMsl ? `<div>📏 <b>ระดับน้ำ:</b> ${props.waterLevelMsl} ม.รทก.</div>` : ''}
                </div>
              </div>
            `;

            activePopupRef.current?.remove();
            activePopupRef.current = new MapPopup({ closeButton: true, maxWidth: '280px' })
              .setLngLat([coords.lng, coords.lat])
              .setHTML(html)
              .addTo(map!);
          };

          map.on('click', 'flood-evidence-polygons-fill', handleFloodEvidenceClick);
          map.on('click', 'flood-evidence-points-circle', handleFloodEvidenceClick);

          setMapError('');
          setMapStatus('ready');
        });

        map.on('error', () => {
          if (!cancelled) {
            setMapError('error');
            setMapStatus('error');
          }
        });
      })
      .catch(() => {
        if (!cancelled) {
          setMapError('error');
          setMapStatus('error');
        }
      });

    return () => {
      cancelled = true;
      activePopupRef.current?.remove();
      locationMarkerRef.current?.remove();
      districtLabelMarkersRef.current.forEach((m) => m.remove());
      districtLabelMarkersRef.current = [];
      floodEvidenceMarkersRef.current.forEach((m) => m.remove());
      floodEvidenceMarkersRef.current = [];
      waterControlMarkersRef.current.forEach((m) => m.remove());
      waterControlMarkersRef.current = [];
      map?.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [retryCount]);

  // Sync Rainfall Station Data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapStatus !== 'ready') return;
    const source = map.getSource(RAINFALL_SOURCE_ID) as GeoJSONSource | undefined;
    if (source) source.setData(rainfallGeoJSON as any);
  }, [mapStatus, rainfallGeoJSON]);

  // Sync Water Level Station Data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapStatus !== 'ready') return;
    const source = map.getSource(WATER_LEVEL_SOURCE_ID) as GeoJSONSource | undefined;
    if (source) source.setData(waterLevelGeoJSON as any);
  }, [mapStatus, waterLevelGeoJSON]);

  // Sync Flood Evidence GeoJSON & Centroid Wave Markers
  useEffect(() => {
    const map = mapRef.current;
    const MapMarker = markerConstructorRef.current;
    if (!map || mapStatus !== 'ready' || !MapMarker) return;

    const source = map.getSource(FLOOD_EVIDENCE_SOURCE_ID) as GeoJSONSource | undefined;
    if (source) source.setData(floodEvidenceGeoJSON as any);

    // Remove old flood evidence markers
    floodEvidenceMarkersRef.current.forEach((m) => m.remove());
    floodEvidenceMarkersRef.current = [];

    // If flood evidence features exist and layer is toggled ON, create distinguishable icons for flood vs telemetry overflow
    if (showFloodEvidence && floodEvidenceGeoJSON.features.length > 0) {
      floodEvidenceGeoJSON.features.forEach((feat: any) => {
        let centerCoords: [number, number] | null = null;
        if (feat.geometry.type === 'Point') {
          centerCoords = feat.geometry.coordinates;
        } else if (feat.geometry.type === 'Polygon' || feat.geometry.type === 'MultiPolygon') {
          centerCoords = getPolygonRepresentativePoint(feat.geometry.coordinates);
        }

        if (centerCoords) {
          const isTelemetryOverflow = feat.properties?.evidenceType === 'ground_telemetry_overflow';
          const isHistorical = feat.properties?.evidenceType === 'historical';

          const el = document.createElement('div');
          el.className = 'pulse-flood flood-event-marker';
          el.tabIndex = 0;
          el.setAttribute('role', 'button');
          el.setAttribute('aria-label', isTelemetryOverflow
            ? (locale === 'th' ? 'ระดับน้ำวิกฤตที่สถานีตรวจวัด' : 'Critical water level at monitoring station')
            : isHistorical
              ? (locale === 'th' ? 'บันทึกน้ำท่วมในอดีต' : 'Historical flood archive')
              : (locale === 'th' ? 'หลักฐานน้ำท่วมจากดาวเทียม' : 'Satellite flood evidence'));

          if (isTelemetryOverflow) {
            // Distinct Warning / Telemetry Icon (Amber/Orange Triangle)
            el.innerHTML = `
              <div style="background: #f97316; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; border: 2px solid #ffffff; box-shadow: 0 4px 12px rgba(249,115,22,0.6); cursor: pointer;" title="Water Level Telemetry Critical / Overflow Warning">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
            `;
          } else if (isHistorical) {
            // Historical Flood Archive (Deep Orange)
            el.innerHTML = `
              <div style="background: #ea580c; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; border: 2px solid #ffffff; box-shadow: 0 3px 10px rgba(234,88,12,0.5); cursor: pointer;" title="Historical Flood Archive">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                  <path d="M12 7v5l4 2"/>
                </svg>
              </div>
            `;
          } else {
            // Confirmed Satellite Flood Inundation (Waves Icon)
            el.innerHTML = `
              <div style="background: #dc2626; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; border: 2px solid #ffffff; box-shadow: 0 4px 12px rgba(220,38,38,0.6); cursor: pointer;" title="Confirmed Satellite Flood Inundation">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
                  <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
                  <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
                </svg>
              </div>
            `;
          }

          el.addEventListener('click', () => {
            const timeStr = feat.properties?.timestamp ? new Date(feat.properties.timestamp).toLocaleString(locale === 'th' ? 'th-TH' : 'en-GB') : 'Recent observation';

            let title = '🌊 Confirmed Satellite Flood Inundation';
            let desc = 'Satellite radar detected active flood inundation boundary.';
            let bannerBg = '#1e1b2e';
            let bannerBorder = '#7f1d1d';
            let bannerColor = '#fecaca';

            if (isTelemetryOverflow) {
              title = locale === 'th' ? '⚠️ ข้อมูลโทรมาตร: ระดับน้ำวิกฤต/ล้นตลิ่ง' : '⚠️ Telemetry Warning: River Overflow / Critical Level';
              desc = locale === 'th' ? 'ระดับน้ำในลำน้ำแตะระดับเตือนภัย/ล้นตลิ่ง (เป็นข้อมูลระดับน้ำจากเซนเซอร์ ไม่ใช่การยืนยันน้ำท่วมผิวดินทั้งหมด)' : 'River water reached critical/overflow stage at this telemetry gauge station (Water level telemetry, not verified land flood).';
              bannerBg = '#271708';
              bannerBorder = '#c2410c';
              bannerColor = '#fed7aa';
            } else if (isHistorical) {
              title = locale === 'th' ? '📜 บันทึกพื้นที่น้ำท่วมในอดีต' : '📜 Historical Flood Archive';
              desc = feat.properties?.description || (locale === 'th' ? 'บันทึกเหตุการณ์น้ำท่วมในอดีตจากฐานข้อมูล' : 'Recorded historical flood event from database archives.');
            }

            const html = `
              <div style="font-family: inherit; font-size: 13px; line-height: 1.5;">
                <div style="font-weight: 700; color: ${isTelemetryOverflow ? '#fb923c' : '#f87171'}; font-size: 14px; margin-bottom: 4px;">
                  ${feat.properties?.title || title}
                </div>
                <div style="background: ${bannerBg}; border: 1px solid ${bannerBorder}; color: ${bannerColor}; padding: 8px; border-radius: 6px; margin-bottom: 8px; font-size: 12px;">
                  ${desc}
                </div>
                <div style="font-size: 11px; color: #6d756b;">
                  <div>⏱️ <b>เวลาตรวจวัด/บันทึก:</b> ${timeStr}</div>
                  <div>📡 <b>แหล่งข้อมูล:</b> ${feat.properties?.source || 'GISTDA FloodCheck'}</div>
                  ${feat.properties?.waterLevelMsl ? `<div>📏 <b>ระดับน้ำโทรมาตร:</b> ${feat.properties.waterLevelMsl} ม.รทก.</div>` : ''}
                </div>
              </div>
            `;
            activePopupRef.current?.remove();
            activePopupRef.current = new popupConstructorRef.current!({ closeButton: true, maxWidth: '280px' })
              .setLngLat(centerCoords!)
              .setHTML(html)
              .addTo(map);
          });

          el.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              el.click();
            }
          });
          const marker = new MapMarker({ element: el, anchor: 'center' }).setLngLat(centerCoords).addTo(map);
          floodEvidenceMarkersRef.current.push(marker);
        }
      });
    }
  }, [mapStatus, floodEvidenceGeoJSON, showFloodEvidence, locale]);

  // Sync Water Control GeoJSON
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapStatus !== 'ready') return;
    const source = map.getSource(WATER_CONTROL_SOURCE_ID) as GeoJSONSource | undefined;
    if (source) source.setData(waterControlGeoJSON as any);
  }, [mapStatus, waterControlGeoJSON]);

  // Sync Predictive Risk District GeoJSON
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapStatus !== 'ready') return;
    const source = map.getSource(RISK_SOURCE_ID) as GeoJSONSource | undefined;
    if (source) source.setData(riskDistrictGeoJSON as any);
  }, [mapStatus, riskDistrictGeoJSON]);

  // Smooth Fly-to selected district when changed in dropdown
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapStatus !== 'ready' || !selectedDistrict) return;
    if (typeof selectedDistrict.lat === 'number' && typeof selectedDistrict.lon === 'number') {
      map.flyTo({
        center: [selectedDistrict.lon, selectedDistrict.lat],
        zoom: 11.2,
        duration: 900,
        essential: true,
      });
    }
  }, [mapStatus, selectedDistrict]);

  // Toggle Layer Visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapStatus !== 'ready') return;

    // 1. Flood Evidence (Polygons + Outlines + Points)
    if (map.getLayer('flood-evidence-polygons-fill')) {
      map.setLayoutProperty('flood-evidence-polygons-fill', 'visibility', showFloodEvidence ? 'visible' : 'none');
      map.setLayoutProperty('flood-evidence-polygons-outline', 'visibility', showFloodEvidence ? 'visible' : 'none');
    }
    if (map.getLayer('flood-evidence-points-circle')) {
      map.setLayoutProperty('flood-evidence-points-circle', 'visibility', showFloodEvidence ? 'visible' : 'none');
    }
    floodEvidenceMarkersRef.current.forEach((m) => {
      m.getElement().style.display = showFloodEvidence ? 'block' : 'none';
    });

    // 2. Rainfall Stations
    if (map.getLayer('rainfall-stations-circle')) {
      map.setLayoutProperty('rainfall-stations-circle', 'visibility', showRainfall ? 'visible' : 'none');
    }

    // 3. Water Level Stations
    if (map.getLayer('water-level-stations-circle')) {
      map.setLayoutProperty('water-level-stations-circle', 'visibility', showWaterLevel ? 'visible' : 'none');
    }

    // 4. Water Control & Dams
    if (map.getLayer('water-control-circle')) {
      map.setLayoutProperty('water-control-circle', 'visibility', showWaterControl ? 'visible' : 'none');
    }

    // 5. Predictive Risk
    if (map.getLayer('risk-district-fill')) {
      map.setLayoutProperty('risk-district-fill', 'visibility', showRiskModel ? 'visible' : 'none');
      map.setLayoutProperty('risk-district-outline', 'visibility', showRiskModel ? 'visible' : 'none');
    }
  }, [mapStatus, showFloodEvidence, showRainfall, showWaterLevel, showWaterControl, showRiskModel]);

  // Navigation handlers
  const zoomIn = () => mapRef.current?.zoomIn({ duration: 250 });
  const zoomOut = () => mapRef.current?.zoomOut({ duration: 250 });
  const resetView = () => {
    const bounds = boundsRef.current;
    if (!bounds) return;
    mapRef.current?.fitBounds(bounds, { ...AYUTTHAYA_BOUNDS_OPTIONS, duration: 700 });
  };

  const showMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage(text.locationUnavailable);
      return;
    }

    setLocationMessage(text.requestingLocation);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates: [number, number] = [position.coords.longitude, position.coords.latitude];
        const map = mapRef.current;
        const MapMarker = markerConstructorRef.current;
        if (!map || !MapMarker) return;

        map.flyTo({ center: coordinates, zoom: 13.5, duration: 800 });
        if (!locationMarkerRef.current) {
          const markerElement = document.createElement('div');
          markerElement.className = 'flood-map-location-marker';
          Object.assign(markerElement.style, {
            width: '18px',
            height: '18px',
            border: '3px solid white',
            borderRadius: '50%',
            background: '#0284c7',
            boxShadow: '0 0 0 6px rgb(2 132 199 / 30%)',
          });
          locationMarkerRef.current = new MapMarker({ element: markerElement, anchor: 'center' })
            .setLngLat(coordinates)
            .addTo(map);
        } else {
          locationMarkerRef.current.setLngLat(coordinates).addTo(map);
        }
        setLocationMessage(text.locationShown);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationMessage(text.locationDenied);
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationMessage(text.locationPositionUnavailable);
        } else {
          setLocationMessage(text.locationTimeout);
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const buttonClass =
    'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/90 px-2.5 text-xs font-medium text-slate-200 shadow-md backdrop-blur-md transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-50';
  const iconButtonClass =
    'inline-flex size-9 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900/90 text-slate-200 shadow-md backdrop-blur-md transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <section className="relative h-full min-h-0 overflow-hidden bg-[#07111f]" aria-labelledby="flood-map-title">
      {/* Map Container */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full bg-[#07111f]" aria-label={text.mapTitle} />
      </div>

      {/* Header gradient banner */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-[#07111f]/95 via-[#07111f]/60 to-transparent px-4 pb-6 pt-3 sm:px-6">
        <div className="flex items-center gap-2">
          <h2 id="flood-map-title" className="text-base font-bold text-white sm:text-lg">
            {text.mapTitle}
          </h2>
          <span className="rounded-full bg-sky-950 px-2 py-0.5 text-[10px] font-semibold text-sky-300 border border-sky-800/60">
            Real Situation Map
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-300">
          {locale === 'th'
            ? 'ข้อมูลจริงจากสถานีตรวจวัดภาคสนามและภาพถ่ายดาวเทียม (ไม่สมมุติตัวเลข)'
            : 'Live ground observations & satellite evidence (Zero fabricated metrics)'}
        </p>
      </div>

      {/* Loading state */}
      {mapStatus === 'loading' && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-slate-950/70 text-sm font-medium text-white" role="status">
          <div className="flex items-center gap-2">
            <div className="size-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
            {text.mapLoading}
          </div>
        </div>
      )}

      {/* Error state */}
      {mapStatus === 'error' && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-slate-950/85 p-6 text-center" role="alert">
          <div className="max-w-sm">
            <p className="font-semibold text-white">{text.mapUnavailable}</p>
            <p className="mt-2 text-sm text-slate-300">{mapError === 'error' ? text.mapLoadError : mapError}</p>
            <button className={`${buttonClass} mt-4`} onClick={() => setRetryCount((c) => c + 1)}>
              {text.tryAgain}
            </button>
          </div>
        </div>
      )}

      {/* Top Floating Layer Toggle Bar */}
      <div
        className="absolute left-3 top-16 z-20 flex flex-wrap items-center gap-1.5 max-w-[calc(100%-4rem)] sm:max-w-none"
        role="group"
        aria-label="Map Layer Toggles"
      >
        {/* Toggle 1: Flood Evidence */}
        <button
          onClick={() => setShowFloodEvidence((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium shadow-md backdrop-blur-md transition ${showFloodEvidence
              ? 'border-red-500 bg-red-950/90 text-red-200'
              : 'border-slate-700 bg-slate-900/80 text-slate-400 hover:text-slate-200'
            }`}
          title="Toggle confirmed satellite flood inundation (GISTDA & Supabase Archive)"
        >
          <Waves size={13} className={showFloodEvidence ? 'text-red-400' : 'text-slate-500'} />
          <span>
            {locale === 'th' ? 'น้ำท่วมขังจริง' : 'Flood Evidence'} (
            {floodEvidenceGeoJSON.features.filter((f: any) => f.properties?.evidenceType === 'current').length > 0
              ? `${floodEvidenceGeoJSON.features.filter((f: any) => f.properties?.evidenceType === 'current').length} 🔴`
              : floodEvidenceGeoJSON.features.length}
            )
          </span>
          {floodEvidenceGeoJSON.features.some((f: any) => f.properties?.evidenceType === 'current') && (
            <span className="size-2 rounded-full bg-red-400 animate-pulse" />
          )}
        </button>

        {/* Toggle 2: Rainfall Stations */}
        <button
          onClick={() => setShowRainfall((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium shadow-md backdrop-blur-md transition ${showRainfall
              ? 'border-cyan-500 bg-cyan-950/90 text-cyan-200'
              : 'border-slate-700 bg-slate-900/80 text-slate-400 hover:text-slate-200'
            }`}
          title="Toggle ThaiWater ground rain gauge stations"
        >
          <CloudRain size={13} className={showRainfall ? 'text-cyan-400' : 'text-slate-500'} />
          <span>{locale === 'th' ? 'สถานีฝน' : 'Rainfall'} ({rainfallGeoJSON.features.length})</span>
        </button>

        {/* Toggle 3: Water Level Stations */}
        <button
          onClick={() => setShowWaterLevel((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium shadow-md backdrop-blur-md transition ${showWaterLevel
              ? 'border-sky-500 bg-sky-950/90 text-sky-200'
              : 'border-slate-700 bg-slate-900/80 text-slate-400 hover:text-slate-200'
            }`}
          title="Toggle ThaiWater river water level telemetry stations"
        >
          <Droplets size={13} className={showWaterLevel ? 'text-sky-400' : 'text-slate-500'} />
          <span>{locale === 'th' ? 'ระดับน้ำ' : 'Water Level'} ({waterLevelGeoJSON.features.length})</span>
        </button>

        {/* Toggle 4: Dams & Water Control */}
        <button
          onClick={() => setShowWaterControl((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium shadow-md backdrop-blur-md transition ${showWaterControl
              ? 'border-purple-500 bg-purple-950/90 text-purple-200'
              : 'border-slate-700 bg-slate-900/80 text-slate-400 hover:text-slate-200'
            }`}
          title="Toggle RID dams and regulator gates"
        >
          <Building2 size={13} className={showWaterControl ? 'text-purple-400' : 'text-slate-500'} />
          <span>{locale === 'th' ? 'เขื่อน/ปตร.' : 'Dams & Gates'} ({WATER_CONTROL_STRUCTURES.length})</span>
        </button>

        {/* Toggle 5: Predictive Risk Highlight */}
        <button
          onClick={() => setShowRiskModel((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium shadow-md backdrop-blur-md transition ${showRiskModel
              ? 'border-amber-500 bg-amber-950/90 text-amber-200'
              : 'border-slate-700 bg-slate-900/80 text-slate-400 hover:text-slate-200'
            }`}
          title="Toggle predictive forecast risk model (Not confirmed flood)"
        >
          <ShieldAlert size={13} className={showRiskModel ? 'text-amber-400' : 'text-slate-500'} />
          <span>{locale === 'th' ? 'แบบจำลองความเสี่ยง' : 'Risk Model'}</span>
        </button>
      </div>

      {/* Map Control Buttons (Top-Right) */}
      <div className="absolute right-3 top-3 z-20 flex flex-col gap-1.5" role="group" aria-label={text.mapControls}>
        <button className={iconButtonClass} onClick={zoomIn} disabled={mapStatus !== 'ready'} aria-label={text.zoomIn} title={text.zoomIn}>
          <Plus size={16} />
        </button>
        <button className={iconButtonClass} onClick={zoomOut} disabled={mapStatus !== 'ready'} aria-label={text.zoomOut} title={text.zoomOut}>
          <Minus size={16} />
        </button>
        <button className={iconButtonClass} onClick={resetView} disabled={mapStatus !== 'ready'} aria-label={text.resetView} title={text.resetView}>
          <RotateCcw size={15} />
        </button>
        <button className={iconButtonClass} onClick={showMyLocation} disabled={mapStatus !== 'ready'} aria-label={text.myLocation} title={text.myLocation}>
          <Crosshair size={15} />
        </button>
      </div>

      {/* Collapsible Clean Situation Legend (Bottom-Right) */}
      <div className="absolute bottom-6 right-3 z-20 max-w-[calc(100%-1.5rem)] sm:max-w-xs">
        <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/90 shadow-xl backdrop-blur-md">
          {/* Legend Header */}
          <button
            onClick={() => setIsLegendOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-900/60 transition"
          >
            <div className="flex items-center gap-1.5">
              <Layers size={13} className="text-sky-400" />
              <span>{locale === 'th' ? 'สัญลักษณ์บนแผนที่' : 'Map Legend & Sources'}</span>
            </div>
            {isLegendOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
          </button>

          {/* Legend Body */}
          {isLegendOpen && (
            <div className="border-t border-slate-800 px-3 py-2.5 text-[11px] text-slate-300 space-y-2">
              {/* 1. Flood Evidence (Current Red & Historical Orange) */}
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
                  <Waves size={10} />
                </span>
                <div>
                  <div className="font-semibold text-red-300">
                    {locale === 'th' ? 'หลักฐานน้ำท่วมจริง (ดาวเทียม/ประวัติ)' : 'Confirmed Flood Evidence'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    <span className="inline-block size-2 rounded-full bg-[#dc2626] mr-1" />
                    {locale === 'th' ? 'ปัจจุบัน (รอบ 24 ชม.)' : 'Current (24h)'}
                    <span className="inline-block size-2 rounded-full bg-[#ea580c] ml-2 mr-1" />
                    {locale === 'th' ? 'บันทึกในอดีต' : 'Historical Archive'}
                  </div>
                </div>
              </div>

              {/* 2. Rainfall Stations */}
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-white">
                  <CloudRain size={10} />
                </span>
                <div className="flex-1">
                  <div className="font-semibold text-cyan-300">
                    {locale === 'th' ? 'สถานีวัดน้ำฝน (ThaiWater)' : 'Rainfall Stations'}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[#737a70]" /> 0mm</span>
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[#06b6d4]" /> &lt;10mm</span>
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[#eab308]" /> 10-35mm</span>
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[#ef4444]" /> &gt;35mm</span>
                  </div>
                </div>
              </div>

              {/* 3. Water Level Stations */}
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white">
                  <Droplets size={10} />
                </span>
                <div className="flex-1">
                  <div className="font-semibold text-sky-300">
                    {locale === 'th' ? 'สถานีวัดระดับน้ำ (ชป./ThaiWater)' : 'Water Level Telemetry'}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[#0284c7]" /> {locale === 'th' ? 'ปกติ' : 'Normal'}</span>
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[#eab308]" /> {locale === 'th' ? 'เฝ้าระวัง' : 'Watch'}</span>
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[#f97316]" /> {locale === 'th' ? 'เตือนภัย' : 'Warning'}</span>
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[#ef4444]" /> {locale === 'th' ? 'ล้นตลิ่ง' : 'Overflow'}</span>
                  </div>
                </div>
              </div>

              {/* 4. Dams & Gates */}
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white">
                  <Building2 size={10} />
                </span>
                <div>
                  <div className="font-semibold text-purple-300">
                    {locale === 'th' ? 'เขื่อน / ประตูระบายน้ำ' : 'Dams & Regulator Gates'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {locale === 'th' ? 'เขื่อนพระราม 6, เจ้าพระยา, ปตร.บางบาล ฯลฯ' : 'Rama VI, Chao Phraya, Bang Ban gates'}
                  </div>
                </div>
              </div>

              {/* 5. Predictive Risk Model */}
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-600 text-white">
                  <ShieldAlert size={10} />
                </span>
                <div>
                  <div className="font-semibold text-amber-300">
                    {locale === 'th' ? 'แบบจำลองความเสี่ยง' : 'Predictive Flood Risk'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {locale === 'th' ? 'การคาดการณ์ฝนและการไหล (ไม่ใช่น้ำท่วมขังจริง)' : 'Model forecast from GloFAS (Not flood water)'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Geolocation Toast Message */}
      {locationMessage && (
        <div
          className="absolute bottom-3 left-3 z-20 flex max-w-[min(24rem,calc(100%-1.5rem))] items-start gap-2 rounded-lg border border-slate-600 bg-slate-950/95 px-3 py-2 text-xs text-white shadow-lg"
          role="status"
          aria-live="polite"
        >
          <MapPin className="mt-0.5 shrink-0 text-sky-300" size={14} />
          <span>{locationMessage}</span>
        </div>
      )}

      {/* Footer attribution */}
      <p className="pointer-events-none absolute bottom-0 left-0 z-10 bg-gradient-to-t from-[#07111f]/90 to-transparent px-4 pb-1.5 pt-4 text-[10px] text-slate-400 sm:px-6">
        <a className="underline decoration-slate-500 underline-offset-2" href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer">
          {text.boundaryCredits}
        </a>
      </p>
    </section>
  );
}