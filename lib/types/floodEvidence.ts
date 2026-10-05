import type { FeatureCollection, Geometry } from 'geojson';

export type FloodEvidenceStatus = 
  | 'evidence_detected' 
  | 'no_evidence_detected' 
  | 'unavailable' 
  | 'stale';

export interface NormalizedFloodEvent {
  id: string | number;
  eventId?: string;
  source: string;
  sourceUrl?: string;
  sourceType: 'satellite_radar' | 'satellite_optical' | 'ground_inspection' | 'unknown';
  observedAt: string | null;
  firstDetectedAt?: string | null;
  lastDetectedAt?: string | null;
  fetchedAt: string;
  status: 'active' | 'receded' | 'historical' | 'unconfirmed';
  freshness: 'live_24h' | 'recent_7d' | 'historical';
  confidence: string | null;
  title?: string | null;
  description?: string | null;
  latitude: number | null;
  longitude: number | null;
  geometry: Geometry | null;
  rawData?: unknown;
}

export interface FloodEvidenceApiResponse {
  status: FloodEvidenceStatus;
  provider: string;
  requestedAt: string;
  fetchedAt: string | null;
  timestamp: string | null;
  location?: { lat: number; lon: number } | null;
  floodDetected: boolean | null;
  confidence: string | null;
  evidence: {
    numberMatched: number;
    numberReturned: number;
    features: any[];
  } | null;
  currentEvidence: {
    detected: boolean;
    featuresCount: number;
    geoJson: FeatureCollection | null;
    rawMatched: number;
  };
  historicalEvidence: {
    count: number;
    events: NormalizedFloodEvent[];
  };
  coverageLimitation: string;
}

export type FloodEvidenceResponse = FloodEvidenceApiResponse;
