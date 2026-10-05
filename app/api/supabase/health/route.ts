import { NextResponse } from 'next/server';
import { getSupabaseClient, getSupabaseConfiguration } from '../../../../lib/supabase';

export async function GET() {
  const checkedAt = new Date().toISOString();
  const configuration = getSupabaseConfiguration();

  if (!configuration) {
    return NextResponse.json({
      provider: 'Supabase',
      status: 'not_configured',
      checkedAt,
      message: 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const supabase = getSupabaseClient();

    // Test SELECT query against public.districts without modifying data
    const { data, count, error, status } = await supabase
      .from('districts')
      .select('*', { count: 'exact' });

    if (error) {
      const isRlsError =
        error.code === '42501' ||
        status === 403 ||
        error.message.toLowerCase().includes('policy') ||
        error.message.toLowerCase().includes('security') ||
        error.message.toLowerCase().includes('permission denied');

      return NextResponse.json({
        provider: 'Supabase',
        connection: 'connected',
        queryStatus: 'error',
        checkedAt,
        httpStatus: status,
        error: error.message,
        errorCode: error.code,
        isRlsError,
        rlsFixPolicy: isRlsError
          ? 'CREATE POLICY "Allow public read access" ON public.districts FOR SELECT TO anon, authenticated USING (true);'
          : null,
      }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json({
      provider: 'Supabase',
      connection: 'connected',
      queryStatus: 'success',
      checkedAt,
      httpStatus: status,
      rowCount: count ?? data?.length ?? 0,
      data,
      message: 'Supabase connection successful. Database query against public.districts successful.',
    }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    return NextResponse.json({
      provider: 'Supabase',
      connection: 'unavailable',
      queryStatus: 'error',
      checkedAt,
      message: err?.message || 'Could not reach Supabase.',
    }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}