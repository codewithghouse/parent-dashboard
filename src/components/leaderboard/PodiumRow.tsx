import { T } from '@/lib/edullentTokens';
import type { RankingEntry } from '@/lib/leaderboardTypes';
import { Avatar } from './primitives/Avatar';
import { RankBadge } from './primitives/RankBadge';
import { TrendArrow } from './primitives/TrendArrow';

interface PodiumRowProps {
  data: RankingEntry;
  isFirst: boolean;
}

export function PodiumRow({ data, isFirst }: PodiumRowProps) {
  const trendColor =
    data.trend === 'up' ? T.GREEN : data.trend === 'down' ? T.RED : T.GREEN;

  // Trend label fallback so the row still reads cleanly when the AI/cron
  // didn't emit a custom string.
  const label =
    data.trendLabel ||
    (data.trend === 'up'
      ? `Up from #${(data.previousRank ?? data.rank + 1)}`
      : data.trend === 'down'
      ? `Down from #${(data.previousRank ?? data.rank - 1)}`
      : data.trend === 'new'
      ? 'New entry'
      : `Holding #${data.rank}`);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 10px',
        borderRadius: 16,
        borderTop: isFirst ? 'none' : '0.5px solid rgba(0,85,255,0.06)',
      }}
    >
      <RankBadge rank={data.rank} size="lg" />
      <Avatar
        initials={data.initials}
        bg={data.avatarBg}
        color={data.avatarText}
        size={38}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 15,
            fontWeight: 700,
            margin: 0,
            color: T.T1,
            letterSpacing: '-0.3px',
          }}
        >
          {data.name}
        </p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <TrendArrow direction={data.trend} color={trendColor} />
          <span style={{ fontSize: 11, fontWeight: 700, color: trendColor }}>{label}</span>
        </div>
      </div>
      <span
        style={{
          fontSize: 19,
          fontWeight: 800,
          color: T.T1,
          letterSpacing: '-0.6px',
        }}
      >
        {data.compositeScore}
      </span>
    </div>
  );
}
