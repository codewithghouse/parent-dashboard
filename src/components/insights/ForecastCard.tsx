import { Sparkles } from 'lucide-react';
import { T } from '@/lib/edullentTokens';
import type { ForecastData } from '@/lib/leaderboardTypes';

interface ForecastCardProps {
  data: ForecastData;
}

export function ForecastCard({ data }: ForecastCardProps) {
  return (
    <div
      style={{
        background: T.FORECAST_GRAD,
        borderRadius: 24,
        padding: 24,
        boxShadow: T.SH_LG,
        position: 'relative',
        overflow: 'hidden',
        marginBottom: 24,
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: '-50%',
          left: '-20%',
          width: '80%',
          height: '140%',
          background:
            'radial-gradient(circle, rgba(123,63,244,0.18) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 11px',
            borderRadius: 999,
            background: 'rgba(123,63,244,0.20)',
            border: '0.5px solid rgba(123,63,244,0.4)',
          }}
        >
          <Sparkles size={10} color={T.VIOLET_LIGHT} strokeWidth={2.2} />
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: T.VIOLET_LIGHT,
              letterSpacing: '1.4px',
              textTransform: 'uppercase',
            }}
          >
            Edullent AI
          </span>
        </div>
      </div>

      <p
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '1.6px',
          color: 'rgba(255,255,255,0.55)',
          margin: '0 0 8px',
          textTransform: 'uppercase',
          position: 'relative',
        }}
      >
        Predicted next week
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 14,
          marginBottom: 18,
          position: 'relative',
        }}
      >
        <span
          style={{
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: '-3.5px',
            lineHeight: 0.9,
            color: '#FFFFFF',
            background:
              'linear-gradient(180deg, #FFFFFF 0%, rgba(255,255,255,0.7) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          #{data.projectedRank}
        </span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
            {data.rankChange > 0 ? `Up ${data.rankChange} spots` : data.rankChange < 0 ? `Down ${-data.rankChange}` : 'Holding rank'}
          </p>
          <p
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.55)',
              margin: '2px 0 0',
            }}
          >
            If all {data.scenarios.length} actions complete
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: 14,
          borderRadius: 14,
          background: 'rgba(255,255,255,0.06)',
          border: '0.5px solid rgba(255,255,255,0.12)',
          position: 'relative',
        }}
      >
        {data.scenarios.map((s, i) => (
          <div key={i}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: s.highlight ? 800 : 700,
                  color: s.highlight ? T.VIOLET_LIGHT : 'rgba(255,255,255,0.7)',
                }}
              >
                {s.label}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: s.highlight ? T.VIOLET_LIGHT : '#FFFFFF',
                  letterSpacing: '-0.2px',
                }}
              >
                {s.highlight ? `Projected #${s.rank}` : `Likely #${s.rank}`}
              </span>
            </div>
            {i < data.scenarios.length - 1 && (
              <div
                style={{
                  height: 0.5,
                  background: 'rgba(255,255,255,0.10)',
                  marginTop: 10,
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 14,
          paddingTop: 14,
          borderTop: '0.5px solid rgba(255,255,255,0.10)',
          position: 'relative',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>
          Confidence
        </span>
        <div
          style={{
            flex: 1,
            height: 3,
            background: 'rgba(255,255,255,0.10)',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${data.confidence}%`,
              background: T.VIOLET_LIGHT,
              borderRadius: 999,
            }}
          />
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: T.VIOLET_LIGHT }}>
          {data.confidence}%
        </span>
      </div>
    </div>
  );
}
