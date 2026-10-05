// lib/services/floodEvidence.ts

import type { FloodEvidenceResponse } from "../types/floodEvidence";

/**
 * Fetch flood‑evidence data from the internal `/api/flood-event` route.
 * Returns the parsed JSON response if the request succeeds, otherwise `null`.
 * Errors are caught and logged – the function never throws.
 */
export async function fetchFloodEvidence(
  lat: number,
  lon: number
): Promise<FloodEvidenceResponse | null> {
  try {
    const url = `/api/flood-event?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn(`Flood evidence request failed: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as FloodEvidenceResponse;
    return data;
  } catch (err) {
    console.error('Error fetching flood evidence:', err);
    return null;
  }
}
