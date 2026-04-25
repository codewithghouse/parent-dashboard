import { T } from '@/lib/edullentTokens';
import type { ScoreBreakdown, InsightsTopper } from '@/lib/leaderboardTypes';
import { ComparisonCard } from './ComparisonCard';
import { GapBar } from './GapBar';

interface GapAnalysisProps {
  topper: InsightsTopper;
  topperRank: number;
  userRank: number;
  userScore: number;
  userBreakdown: ScoreBreakdown;
}

const KEYS: (keyof ScoreBreakdown)[] = ['marks', 'attendance', 'assignments', 'behavior'];

export function GapAnalysis({
  topper,
  topperRank,
  userRank,
  userScore,
  userBreakdown,
}: GapAnalysisProps) {
  // Identify the single largest gap so we can flag it as "biggest gap" in
  // the bar list. If multiple metrics tie, the first wins (deterministic).
  const gaps = KEYS.map((k) => ({
    key: k,
    gap: topper.breakdown[k] - userBreakdown[k],
  }));
  const biggestGap = gaps.reduce((a, b) => (b.gap > a.gap ? b : a)).key;

  return (
    <div
      style={{
        background: T.cardBg,
        border: T.BORDER,
        borderRadius: 22,
        padding: 22,
        boxShadow: T.SH_LG,
        marginBottom: 32,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <ComparisonCard
          type="topper"
          rank={topperRank}
          name={topper.name}
          score={topper.score}
        />
        <ComparisonCard type="user" rank={userRank} name="You" score={userScore} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {KEYS.map((k) => (
          <GapBar
            key={k}
            label={k}
            userValue={userBreakdown[k]}
            topperValue={topper.breakdown[k]}
            gap={topper.breakdown[k] - userBreakdown[k]}
            isBiggest={k === biggestGap}
          />
        ))}
      </div>
    </div>
  );
}
