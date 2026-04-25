import { T } from '@/lib/edullentTokens';
import type { RankingEntry } from '@/lib/leaderboardTypes';
import { Avatar } from './primitives/Avatar';
import { RankBadge } from './primitives/RankBadge';

interface PlainRowProps {
  data: RankingEntry;
  subtitle?: string;
}

export function PlainRow({ data, subtitle }: PlainRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 10px',
        borderRadius: 14,
        borderTop: '0.5px solid rgba(0,85,255,0.06)',
      }}
    >
      <RankBadge rank={data.rank} />
      <Avatar initials={data.initials} bg={data.avatarBg} color={data.avatarText} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 700,
            margin: 0,
            color: T.T1,
            letterSpacing: '-0.2px',
          }}
        >
          {data.name}
        </p>
        {subtitle && (
          <p
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: T.T3,
              margin: '1px 0 0',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <span
        style={{
          fontSize: 17,
          fontWeight: 800,
          color: T.T1,
          letterSpacing: '-0.4px',
        }}
      >
        {data.compositeScore}
      </span>
    </div>
  );
}
