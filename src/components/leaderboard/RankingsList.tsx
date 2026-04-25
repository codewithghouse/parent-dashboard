import { T } from '@/lib/edullentTokens';
import type { RankingEntry } from '@/lib/leaderboardTypes';
import { SectionHead } from './primitives/SectionHead';
import { PodiumRow } from './PodiumRow';
import { PlainRow } from './PlainRow';
import { UserRow } from './UserRow';

interface RankingsListProps {
  rankings: RankingEntry[];
  userRank: number;
}

/**
 * Pick which rows to show given a user's rank. Top-8 users see 1..max(5,rank+1)
 * continuously (always at least the top 5 — a rank-1 user with only themselves
 * + rank 2 visible looks broken); users below that see top 5 plus a small
 * neighbourhood window (rank-2 .. rank+1). The boundary at 8 keeps the
 * total visible rows ≤ 9 so the card stays a phone-screen tall.
 */
export function getDisplayedRankings(
  rankings: RankingEntry[],
  userRank: number,
): RankingEntry[] {
  const total = rankings.length;
  if (userRank <= 8) {
    const cutoff = Math.max(5, userRank + 1);
    return rankings.slice(0, Math.min(cutoff, total));
  }
  const top5 = rankings.slice(0, 5);
  const neighborhood = rankings.slice(
    Math.max(5, userRank - 2),
    Math.min(total, userRank + 1),
  );
  return [...top5, ...neighborhood];
}

export function RankingsList({ rankings, userRank }: RankingsListProps) {
  const display = getDisplayedRankings(rankings, userRank);

  // When there's a gap between the top-5 block and the neighbourhood block
  // (i.e. user is rank 9+), insert visual breathing room — never a text
  // divider. Detect by spotting non-consecutive ranks in the displayed list.
  const rows: { entry: RankingEntry; gapBefore: boolean }[] = display.map((entry, i) => {
    const prev = display[i - 1];
    const gapBefore = !!prev && entry.rank - prev.rank > 1;
    return { entry, gapBefore };
  });

  let firstPodium = true;

  return (
    <div
      style={{
        background: T.cardBg,
        border: T.BORDER,
        borderRadius: 24,
        padding: '14px 12px 8px',
        boxShadow: T.SH_LG,
        marginBottom: 14,
      }}
    >
      <SectionHead title="Class rankings" subtitle={`You're #${userRank}`} />
      {rows.map(({ entry, gapBefore }) => {
        const isUser = entry.rank === userRank;
        const isPodium = entry.rank <= 3;
        const wrapperStyle = gapBefore ? { marginTop: 12 } : undefined;

        if (isUser) {
          return (
            <div key={entry.studentId} style={wrapperStyle}>
              <UserRow user={entry} />
            </div>
          );
        }
        if (isPodium) {
          const isFirst = firstPodium;
          firstPodium = false;
          return (
            <div key={entry.studentId} style={wrapperStyle}>
              <PodiumRow data={entry} isFirst={isFirst} />
            </div>
          );
        }
        return (
          <div key={entry.studentId} style={wrapperStyle}>
            <PlainRow data={entry} />
          </div>
        );
      })}
    </div>
  );
}
