// lib/types/floodEvidence.d.ts

/**
 * Interface representing the response from the internal `/api/flood-event` route.
 * Mirrors the JSON structure defined in `app/api/flood-event/route.ts`.
 */
export interface FloodEvidenceResponse {
  status: 'evidence' | 'no_evidence' | 'unavailable' | string;
  provider?: string;
  requestedAt?: string;
  fetchedAt?: string | null;
  httpStatus?: number | null;
  contentType?: string | null;
  timestamp?: string; // GISTDA payload timestamp
  location?: { lat: number; lon: number } | null;
  floodDetected?: boolean | null;
  confidence?: null; // placeholder – GISTDA does not provide confidence currently
  evidence?: {
    numberMatched?: number;
    numberReturned?: number;
    features?: any[]; // GeoJSON Feature objects
  } | null;
  sourceUrl?: string;
  raw?: unknown;
  message?: string;
}
