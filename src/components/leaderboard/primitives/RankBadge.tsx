import { T } from '@/lib/edullentTokens';

interface RankBadgeProps {
  rank: number;
  size?: 'md' | 'lg';
}

export function RankBadge({ rank, size = 'md' }: RankBadgeProps) {
  const dimensions = size === 'lg' ? 38 : 34;
  const fontSize = size === 'lg' ? 15 : 13;

  const podiumStyle = (gradient: string, shadow: string) => ({
    width: dimensions,
    height: dimensions,
    borderRadius: 14,
    background: gradient,
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize,
    letterSpacing: '-0.4px',
    boxShadow: shadow,
    flexShrink: 0,
  });

  if (rank === 1) {
    return (
      <div
        style={podiumStyle(
          'linear-gradient(135deg, #FFD700 0%, #FFAA00 100%)',
          '0 6px 16px rgba(255,170,0,0.35)',
        )}
      >
        1
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div
        style={podiumStyle(
          'linear-gradient(135deg, #E8E8F0 0%, #A8A8B5 100%)',
          '0 6px 16px rgba(168,168,181,0.35)',
        )}
      >
        2
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div
        style={podiumStyle(
          'linear-gradient(135deg, #D89060 0%, #8B5A2B 100%)',
          '0 6px 16px rgba(139,90,43,0.35)',
        )}
      >
        3
      </div>
    );
  }

  return (
    <div
      style={{
        width: dimensions,
        height: dimensions,
        borderRadius: 12,
        background: 'rgba(0,85,255,0.06)',
        color: T.T3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: 13,
        flexShrink: 0,
      }}
    >
      {rank}
    </div>
  );
}
