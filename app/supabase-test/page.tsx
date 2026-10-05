'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient, getSupabaseConfiguration } from '../../lib/supabase';

type QueryState = {
  loading: boolean;
  connectionSuccessful: boolean;
  querySuccessful: boolean;
  rowCount: number | null;
  rows: any[] | null;
  errorMessage: string | null;
  isRlsError: boolean;
  requiredRlsPolicy: string | null;
  responseTimeMs: number | null;
  checkedAt: string | null;
};

export default function SupabaseTestPage() {
  const [state, setState] = useState<QueryState>({
    loading: true,
    connectionSuccessful: false,
    querySuccessful: false,
    rowCount: null,
    rows: null,
    errorMessage: null,
    isRlsError: false,
    requiredRlsPolicy: null,
    responseTimeMs: null,
    checkedAt: null,
  });

  const runTest = async () => {
    const startTime = performance.now();
    setState((prev) => ({
      ...prev,
      loading: true,
      errorMessage: null,
      isRlsError: false,
      requiredRlsPolicy: null,
    }));

    const config = getSupabaseConfiguration();
    if (!config) {
      setState({
        loading: false,
        connectionSuccessful: false,
        querySuccessful: false,
        rowCount: null,
        rows: null,
        errorMessage: 'Supabase configuration missing in .env.local (NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).',
        isRlsError: false,
        requiredRlsPolicy: null,
        responseTimeMs: null,
        checkedAt: new Date().toISOString(),
      });
      return;
    }

    try {
      // 1. Use the existing Supabase client
      const supabase = getSupabaseClient();

      // 2. Query public.districts
      const { data, count, error, status } = await supabase
        .from('districts')
        .select('*', { count: 'exact' });

      const elapsed = Math.round(performance.now() - startTime);

      if (error) {
        const isRls =
          error.code === '42501' ||
          status === 403 ||
          error.message?.toLowerCase().includes('policy') ||
          error.message?.toLowerCase().includes('security') ||
          error.message?.toLowerCase().includes('permission denied');

        setState({
          loading: false,
          connectionSuccessful: true, // Connected to Supabase PostgREST, but rejected by policy/query
          querySuccessful: false,
          rowCount: null,
          rows: null,
          errorMessage: `[Error ${error.code || status}]: ${error.message}`,
          isRlsError: isRls,
          requiredRlsPolicy: isRls
            ? `ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;\n\nCREATE POLICY "Allow public read access"\nON public.districts\nFOR SELECT\nTO anon, authenticated\nUSING (true);`
            : null,
          responseTimeMs: elapsed,
          checkedAt: new Date().toISOString(),
        });
        return;
      }

      // Success
      setState({
        loading: false,
        connectionSuccessful: true,
        querySuccessful: true,
        rowCount: count ?? data?.length ?? 0,
        rows: data ?? [],
        errorMessage: null,
        isRlsError: false,
        requiredRlsPolicy: null,
        responseTimeMs: elapsed,
        checkedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      setState({
        loading: false,
        connectionSuccessful: false,
        querySuccessful: false,
        rowCount: null,
        rows: null,
        errorMessage: err?.message || 'Failed to establish connection to Supabase.',
        isRlsError: false,
        requiredRlsPolicy: null,
        responseTimeMs: elapsed,
        checkedAt: new Date().toISOString(),
      });
    }
  };

  useEffect(() => {
    void runTest();
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b131e',
      color: '#e2e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        maxWidth: '620px',
        width: '100%',
        background: '#121d2d',
        borderRadius: '16px',
        border: '1px solid #1e293b',
        padding: '32px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0, color: '#f8fafc' }}>
              Supabase Database Test
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
              Target: <code style={{ color: '#38bdf8' }}>public.districts</code> (SELECT query)
            </p>
          </div>
          <span style={{
            fontSize: '12px',
            padding: '4px 10px',
            borderRadius: '999px',
            background: '#1e293b',
            color: '#94a3b8',
          }}>
            Temporary Test
          </span>
        </div>

        {/* Status Indicators */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {/* 1. Connection Status */}
          <div style={{
            padding: '16px',
            borderRadius: '10px',
            border: '1px solid',
            background: state.loading
              ? '#1a2333'
              : state.connectionSuccessful
                ? 'rgba(16, 185, 129, 0.12)'
                : 'rgba(239, 68, 68, 0.12)',
            borderColor: state.loading
              ? '#334155'
              : state.connectionSuccessful
                ? '#10b981'
                : '#ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: state.loading
                ? '#f59e0b'
                : state.connectionSuccessful
                  ? '#10b981'
                  : '#ef4444',
            }} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '15px',
                fontWeight: 600,
                color: state.loading
                  ? '#f59e0b'
                  : state.connectionSuccessful
                    ? '#10b981'
                    : '#ef4444',
              }}>
                {state.loading
                  ? 'Testing Supabase connection...'
                  : state.connectionSuccessful
                    ? 'Supabase connection successful'
                    : 'Supabase connection failed'}
              </div>
              {state.connectionSuccessful && (
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  Client initialized & reached Supabase endpoint ({state.responseTimeMs} ms)
                </div>
              )}
            </div>
          </div>

          {/* 2. Query Status */}
          <div style={{
            padding: '16px',
            borderRadius: '10px',
            border: '1px solid',
            background: state.loading
              ? '#1a2333'
              : state.querySuccessful
                ? 'rgba(16, 185, 129, 0.12)'
                : 'rgba(239, 68, 68, 0.12)',
            borderColor: state.loading
              ? '#334155'
              : state.querySuccessful
                ? '#10b981'
                : '#ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: state.loading
                ? '#f59e0b'
                : state.querySuccessful
                  ? '#10b981'
                  : '#ef4444',
            }} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '15px',
                fontWeight: 600,
                color: state.loading
                  ? '#f59e0b'
                  : state.querySuccessful
                    ? '#10b981'
                    : '#ef4444',
              }}>
                {state.loading
                  ? 'Executing query on public.districts...'
                  : state.querySuccessful
                    ? 'Database query successful'
                    : 'Database query failed'}
              </div>
              {state.querySuccessful && (
                <div style={{ fontSize: '12px', color: '#a7f3d0', marginTop: '2px' }}>
                  SELECT * executed against public.districts
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row Count & Result Box */}
        <div style={{
          background: '#0a1019',
          borderRadius: '10px',
          padding: '16px',
          border: '1px solid #172436',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: state.rows && state.rows.length > 0 ? '12px' : 0 }}>
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>Number of rows returned from districts:</span>
            <span style={{
              fontSize: '16px',
              fontWeight: 700,
              color: state.querySuccessful ? '#38bdf8' : '#64748b',
              background: '#0f172a',
              padding: '2px 10px',
              borderRadius: '6px',
              border: '1px solid #1e293b',
            }}>
              {state.loading ? '...' : (state.rowCount ?? 0)}
            </span>
          </div>

          {/* District list preview if any records exist */}
          {state.rows && state.rows.length > 0 && (
            <div style={{
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid #1e293b',
              maxHeight: '160px',
              overflowY: 'auto',
            }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Rows sample:</div>
              <pre style={{
                fontSize: '11px',
                background: '#020617',
                padding: '10px',
                borderRadius: '6px',
                overflowX: 'auto',
                color: '#cbd5e1',
                margin: 0,
              }}>
                {JSON.stringify(state.rows.slice(0, 5), null, 2)}
              </pre>
            </div>
          )}

          {state.querySuccessful && state.rowCount === 0 && (
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
              Note: The <code>districts</code> table is currently empty (0 records), but the SELECT query executed and returned HTTP 200 OK.
            </div>
          )}
        </div>

        {/* RLS Policy Advice (if query fails due to RLS) */}
        {state.isRlsError && state.requiredRlsPolicy && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid #d97706',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '24px',
          }}>
            <div style={{ fontWeight: 600, color: '#fbbf24', fontSize: '14px', marginBottom: '8px' }}>
              🔒 Row Level Security (RLS) Policy Required
            </div>
            <p style={{ fontSize: '12px', color: '#fde68a', margin: '0 0 10px 0', lineHeight: 1.5 }}>
              The table <code>districts</code> has RLS enabled, but lacks a SELECT policy for anon/authenticated clients.
              Run this in your <b>Supabase SQL Editor</b> (do not disable security globally):
            </p>
            <pre style={{
              background: '#18181b',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#a7f3d0',
              overflowX: 'auto',
              border: '1px solid #27272a',
              margin: 0,
            }}>
              {state.requiredRlsPolicy}
            </pre>
          </div>
        )}

        {/* Error message (general) */}
        {!state.isRlsError && state.errorMessage && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            borderRadius: '10px',
            padding: '14px',
            marginBottom: '24px',
            color: '#fca5a5',
            fontSize: '13px',
          }}>
            <b>Error Details:</b> {state.errorMessage}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => void runTest()}
            disabled={state.loading}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: state.loading ? 'not-allowed' : 'pointer',
              opacity: state.loading ? 0.6 : 1,
              transition: 'background 0.2s',
            }}
          >
            {state.loading ? 'Querying...' : 'Retest Query'}
          </button>

          <Link
            href="/"
            style={{
              padding: '12px 20px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: 'transparent',
              color: '#cbd5e1',
              fontSize: '14px',
              fontWeight: 500,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Back to App
          </Link>
        </div>
      </div>
    </div>
  );
}
