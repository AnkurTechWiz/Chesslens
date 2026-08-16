import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const white = searchParams.get('white') || 'White';
  const black = searchParams.get('black') || 'Black';
  const whiteElo = searchParams.get('whiteElo') || '';
  const blackElo = searchParams.get('blackElo') || '';
  const whiteAcc = searchParams.get('whiteAcc') || '';
  const blackAcc = searchParams.get('blackAcc') || '';
  const result = searchParams.get('result') || '*';
  const eco = searchParams.get('eco') || '';
  const opening = searchParams.get('opening') || '';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#020617',
          backgroundImage:
            'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.15), transparent 60%)',
          padding: '60px 80px',
          fontFamily: 'sans-serif',
          color: '#ffffff',
        }}
      >
        {/* Top Branding */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                backgroundColor: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                fontWeight: 900,
                color: '#020617',
              }}
            >
              ♞
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '28px',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  color: '#ffffff',
                }}
              >
                Chess<span style={{ color: '#34d399' }}>Lens</span>
              </span>
              <span style={{ fontSize: '14px', color: '#94a3b8' }}>
                Game Review & Engine Analysis
              </span>
            </div>
          </div>

          {eco && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '999px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                fontSize: '16px',
                fontWeight: 700,
                color: '#34d399',
              }}
            >
              <span>{eco}</span>
              {opening && <span style={{ color: '#94a3b8' }}>· {opening}</span>}
            </div>
          )}
        </div>

        {/* Match Details Hero */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            border: '2px solid #1e293b',
            borderRadius: '28px',
            padding: '40px 50px',
          }}
        >
          {/* White Player */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              width: '40%',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
              White {whiteElo && `(${whiteElo})`}
            </span>
            <span
              style={{
                fontSize: '34px',
                fontWeight: 900,
                color: '#f8fafc',
                marginTop: '4px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '360px',
              }}
            >
              {white}
            </span>
            {whiteAcc && (
              <span
                style={{
                  fontSize: '44px',
                  fontWeight: 900,
                  color: '#34d399',
                  marginTop: '12px',
                }}
              >
                {whiteAcc}% <span style={{ fontSize: '18px', color: '#94a3b8' }}>Accuracy</span>
              </span>
            )}
          </div>

          {/* VS / Result */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                padding: '12px 24px',
                borderRadius: '16px',
                backgroundColor: '#020617',
                border: '2px solid #334155',
                fontSize: '24px',
                fontWeight: 900,
                color: '#38bdf8',
                letterSpacing: '0.05em',
              }}
            >
              {result}
            </div>
            <span style={{ fontSize: '14px', color: '#64748b', marginTop: '8px' }}>
              Final Result
            </span>
          </div>

          {/* Black Player */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              width: '40%',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
              Black {blackElo && `(${blackElo})`}
            </span>
            <span
              style={{
                fontSize: '34px',
                fontWeight: 900,
                color: '#f8fafc',
                marginTop: '4px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '360px',
              }}
            >
              {black}
            </span>
            {blackAcc && (
              <span
                style={{
                  fontSize: '44px',
                  fontWeight: 900,
                  color: '#34d399',
                  marginTop: '12px',
                }}
              >
                {blackAcc}% <span style={{ fontSize: '18px', color: '#94a3b8' }}>Accuracy</span>
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            fontSize: '16px',
            color: '#64748b',
          }}
        >
          <span>Free, Account-Free Chess Review Powered by Stockfish WASM</span>
          <span>chesslens.vercel.app</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
