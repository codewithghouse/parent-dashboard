import { T } from '@/lib/edullentTokens';
import { Eyebrow } from '@/components/leaderboard/primitives/Eyebrow';

interface MetricCardProps {
  label: string;
  value: number;
  classAvg: number;
  isPercentage?: boolean;
}

export function MetricCard({ label, value, classAvg, isPercentage }: MetricCardProps) {
  const diff = value - classAvg;
  const diffColor = diff >= 5 ? T.GREEN : diff >= 0 ? T.T3 : T.RED;
  const barColor = diff >= 5 ? T.GREEN : diff >= 0 ? T.B1 : T.ORANGE;

  return (
    <div
      style={{
        background: T.cardBg,
        border: T.BORDER,
        borderRadius: 18,
        padding: 16,
        boxShadow: T.SH,
      }}
    >
      <Eyebrow>{label}</Eyebrow>
      <p
        style={{
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: '-1px',
          color: T.T1,
          margin: '8px 0 0',
          lineHeight: 1,
        }}
      >
        {value}
        {isPercentage && <span style={{ fontSize: 18, color: T.T3 }}>%</span>}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
        <div
          style={{
            flex: 1,
            height: 4,
            background: 'rgba(0,85,255,0.06)',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, Math.max(0, value))}%`,
              background: barColor,
              borderRadius: 999,
            }}
          />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: diffColor }}>
          {diff >= 0 ? '+' : ''}
          {diff} vs class
        </span>
      </div>
    </div>
  );
}
