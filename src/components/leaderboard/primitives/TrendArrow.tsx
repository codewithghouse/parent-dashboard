import { T } from '@/lib/edullentTokens';
import type { TrendDirection } from '@/lib/leaderboardTypes';

interface TrendArrowProps {
  direction: TrendDirection;
  color?: string;
}

export function TrendArrow({ direction, color }: TrendArrowProps) {
  const fill =
    color || (direction === 'up' ? T.GREEN : direction === 'down' ? T.RED : T.T4);

  if (direction === 'up') {
    return (
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <path d="M4 1L7 5.5H1L4 1Z" fill={fill} />
      </svg>
    );
  }
  if (direction === 'down') {
    return (
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <path d="M4 7L1 2.5H7L4 7Z" fill={fill} />
      </svg>
    );
  }
  return (
    <span
      style={{ display: 'inline-block', width: 8, height: 1.5, background: fill }}
    />
  );
}
