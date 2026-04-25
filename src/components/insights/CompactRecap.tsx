import { T } from '@/lib/edullentTokens';
import { TrendArrow } from '@/components/leaderboard/primitives/TrendArrow';

interface CompactRecapProps {
  rank: number;
  previousRank: number | null;
  score: number;
}

export function CompactRecap({ rank, previousRank, score }: CompactRecapProps) {
  const climbed = previousRank !== null && previousRank > rank ? previousRank - rank : 0;
  const dropped = previousRank !== null && previousRank < rank ? rank - previousRank : 0;
  const trend = climbed > 0 ? 'up' : dropped > 0 ? 'down' : 'same';
  const label = climbed > 0 ? `Up ${climbed}` : dropped > 0 ? `Down ${dropped}` : 'Steady';
  const color = climbed > 0 ? T.GREEN : dropped > 0 ? T.RED : 'rgba(255,255,255,0.6)';
  const bg =
    climbed > 0
      ? 'rgba(52,199,89,0.20)'
      : dropped > 0
      ? 'rgba(255,69,58,0.20)'
      : 'rgba(255,255,255,0.10)';
  const border =
    climbed > 0
      ? 'rgba(52,199,89,0.4)'
      : dropped > 0
      ? 'rgba(255,69,58,0.4)'
      : 'rgba(255,255,255,0.20)';

  return (
    <div
      style={{
        background: T.HERO_GRAD,
        borderRadius: 22,
        padding: '18px 20px',
        boxShadow: T.SH_LG,
        marginBottom: 32,
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
            'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
        <div>
          <p
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '1.6px',
              color: 'rgba(255,255,255,0.55)',
              margin: '0 0 2px',
              textTransform: 'uppercase',
            }}
          >
            Current rank
          </p>
          <p
            style={{
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: '-1.6px',
              color: '#FFFFFF',
              margin: 0,
              lineHeight: 1,
            }}
          >
            #{rank}
          </p>
        </div>
        <div style={{ width: 0.5, alignSelf: 'stretch', background: 'rgba(255,255,255,0.15)' }} />
        <div>
          <p
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '1.6px',
              color: 'rgba(255,255,255,0.55)',
              margin: '0 0 2px',
              textTransform: 'uppercase',
            }}
          >
            Score
          </p>
          <p
            style={{
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: '-1px',
              color: '#FFFFFF',
              margin: 0,
              lineHeight: 1,
            }}
          >
            {score}
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 11px',
            borderRadius: 999,
            background: bg,
            border: `0.5px solid ${border}`,
          }}
        >
          <TrendArrow direction={trend} color={color} />
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '1px',
              color,
              textTransform: 'uppercase',
            }}
          >
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
