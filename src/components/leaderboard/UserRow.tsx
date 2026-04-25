import { T } from '@/lib/edullentTokens';
import type { RankingEntry } from '@/lib/leaderboardTypes';
import { Avatar } from './primitives/Avatar';

interface UserRowProps {
  user: RankingEntry;
}

export function UserRow({ user }: UserRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 12px',
        borderRadius: 16,
        background:
          'linear-gradient(90deg, rgba(0,85,255,0.08) 0%, rgba(0,85,255,0.04) 100%)',
        border: `2px solid ${T.B1}`,
        margin: '6px 0',
        boxShadow: '0 4px 16px rgba(0,85,255,0.18)',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #0055FF 0%, #1166FF 100%)',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 14,
          flexShrink: 0,
          letterSpacing: '-0.4px',
          boxShadow: '0 4px 12px rgba(0,85,255,0.35)',
        }}
      >
        {user.rank}
      </div>
      <Avatar initials={user.initials} bg={T.B1} color="#FFFFFF" size={36} />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <p
          style={{
            fontSize: 15,
            fontWeight: 800,
            margin: 0,
            color: T.T1,
            letterSpacing: '-0.3px',
          }}
        >
          {user.name}
        </p>
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.1em',
            padding: '3px 8px',
            borderRadius: 999,
            background: T.B1,
            color: '#FFFFFF',
            textTransform: 'uppercase',
          }}
        >
          You
        </span>
      </div>
      <span
        style={{
          fontSize: 19,
          fontWeight: 800,
          color: T.B1,
          letterSpacing: '-0.6px',
        }}
      >
        {user.compositeScore}
      </span>
    </div>
  );
}
