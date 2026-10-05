// app/api/area-situation/route.ts
import { NextResponse } from 'next/server';
import { getAreaSituation } from '../../../lib/services/area-situation';

export const dynamic = 'force-dynamic';

/**
 * GET endpoint that returns the assembled AreaSituation JSON for the requested district.
 * Query parameters:
 *   - district (default: "พระนครศรีอยุธยา")
 *   - subdistrict (optional)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const district = searchParams.get('district') || 'พระนครศรีอยุธยา';
  const subdistrict = searchParams.get('subdistrict') ?? undefined;
  try {
    const situation = await getAreaSituation(district, subdistrict);
    return NextResponse.json({ situation });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'failed_to_gather_data', message: err?.message ?? 'Unable to assemble AreaSituation' },
      { status: 502 }
    );
  }
}

// Also support POST for symmetry (optional)
export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const district = body.district || 'พระนครศรีอยุธยา';
  const subdistrict = body.subdistrict || undefined;
  try {
    const situation = await getAreaSituation(district, subdistrict);
    return NextResponse.json({ situation });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'failed_to_gather_data', message: err?.message ?? 'Unable to assemble AreaSituation' },
      { status: 502 }
    );
  }
}
