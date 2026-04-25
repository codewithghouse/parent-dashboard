import { ArrowRight } from 'lucide-react';
import { T, FONT } from '@/lib/edullentTokens';
import { TrendArrow } from './primitives/TrendArrow';
import { StatItem } from './primitives/StatItem';

interface HeroPositionCardProps {
  rank: number;
  previousRank: number | null;
  totalStudents: number;
  score: number;
  percentile: number;
  classAverage: number;
  onViewInsights: () => void;
}

export function HeroPositionCard({
  rank,
  previousRank,
  totalStudents,
  score,
  percentile,
  classAverage,
  onViewInsights,
}: HeroPositionCardProps) {
  const climbed = previousRank !== null && previousRank > rank ? previousRank - rank : 0;
  const dropped = previousRank !== null && previousRank < rank ? rank - previousRank : 0;
  const trendDirection = climbed > 0 ? 'up' : dropped > 0 ? 'down' : 'same';
  const trendLabel =
    climbed > 0
      ? `Up ${climbed} place${climbed === 1 ? '' : 's'}`
      : dropped > 0
      ? `Down ${dropped}`
      : 'No change';
  const trendBg =
    climbed > 0
      ? 'rgba(52,199,89,0.18)'
      : dropped > 0
      ? 'rgba(255,69,58,0.18)'
      : 'rgba(255,255,255,0.10)';
  const trendBorder =
    climbed > 0
      ? 'rgba(52,199,89,0.3)'
      : dropped > 0
      ? 'rgba(255,69,58,0.3)'
      : 'rgba(255,255,255,0.15)';
  const trendColor = climbed > 0 ? T.GREEN : dropped > 0 ? T.RED : 'rgba(255,255,255,0.6)';

  return (
    <div
      style={{
        background: T.HERO_GRAD,
        borderRadius: 26,
        padding: '24px 22px',
        boxShadow: T.SH_LG,
        marginBottom: 22,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-40%',
          right: '-20%',
          width: '80%',
          height: '140%',
          background:
            'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 20,
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
            background: 'rgba(255,255,255,0.10)',
            border: '0.5px solid rgba(255,255,255,0.15)',
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: T.GREEN,
              boxShadow: `0 0 6px ${T.GREEN}`,
            }}
          />
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '1.4px',
              color: '#FFFFFF',
              textTransform: 'uppercase',
            }}
          >
            Live
          </span>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 11px',
            borderRadius: 999,
            background: trendBg,
            border: `0.5px solid ${trendBorder}`,
          }}
        >
          <TrendArrow direction={trendDirection} color={trendColor} />
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '1px',
              color: trendColor,
              textTransform: 'uppercase',
            }}
          >
            {trendLabel}
          </span>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 22, position: 'relative' }}>
        <p
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '2px',
            color: 'rgba(255,255,255,0.55)',
            margin: '0 0 2px',
            textTransform: 'uppercase',
          }}
        >
          Rank
        </p>
        <div
          style={{
            fontSize: 88,
            fontWeight: 800,
            letterSpacing: '-5px',
            color: '#FFFFFF',
            lineHeight: 0.9,
            background: 'linear-gradient(180deg, #FFFFFF 0%, rgba(255,255,255,0.7) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          #{rank}
        </div>
        <p
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.6)',
            margin: '4px 0 0',
          }}
        >
          of {totalStudents} students
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          padding: '16px 0',
          borderTop: '0.5px solid rgba(255,255,255,0.12)',
          borderBottom: '0.5px solid rgba(255,255,255,0.12)',
          marginBottom: 18,
          position: 'relative',
        }}
      >
        <StatItem label="Score" value={score} />
        <div style={{ width: 0.5, background: 'rgba(255,255,255,0.12)' }} />
        <StatItem label="Percentile" value={percentile} suffix="%" />
        <div style={{ width: 0.5, background: 'rgba(255,255,255,0.12)' }} />
        <StatItem label="Class Avg" value={classAverage} />
      </div>

      <div style={{ marginBottom: 18, position: 'relative' }}>
        <div
          style={{
            height: 4,
            background: 'rgba(255,255,255,0.10)',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${percentile}%`,
              background: 'linear-gradient(90deg, #4499FF 0%, #FFFFFF 100%)',
              borderRadius: 999,
              boxShadow: '0 0 12px rgba(255,255,255,0.4)',
            }}
          />
        </div>
        <p
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.6)',
            margin: '8px 0 0',
            textAlign: 'center',
          }}
        >
          Top {100 - percentile}% in your class
        </p>
      </div>

      <button
        type="button"
        onClick={onViewInsights}
        style={{
          width: '100%',
          padding: 15,
          background: '#FFFFFF',
          border: 'none',
          borderRadius: 14,
          fontSize: 13,
          color: T.B1,
          cursor: 'pointer',
          fontFamily: FONT,
          fontWeight: 800,
          letterSpacing: '-0.1px',
          boxShadow:
            '0 8px 24px rgba(0,0,0,0.20), 0 2px 6px rgba(0,0,0,0.10)',
          transition: 'transform 0.22s cubic-bezier(0.2,0.8,0.2,1)',
          position: 'relative',
        }}
        onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
        onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          View detailed insights
          <ArrowRight size={14} strokeWidth={2.2} />
        </span>
      </button>
    </div>
  );
}
