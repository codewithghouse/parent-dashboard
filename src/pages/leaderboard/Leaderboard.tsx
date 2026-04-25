import { useNavigate } from 'react-router-dom';
import { T, FONT } from '@/lib/edullentTokens';
import { Eyebrow } from '@/components/leaderboard/primitives/Eyebrow';
import { HeroPositionCard } from '@/components/leaderboard/HeroPositionCard';
import { RankingsList } from '@/components/leaderboard/RankingsList';
import {
  LeaderboardSkeleton,
  LeaderboardNotReady,
  LeaderboardError,
  UserNotInRanking,
} from '@/components/leaderboard/LeaderboardStates';
import {
  formatCountdown,
  formatGeneratedAt,
  formatWeekLabel,
} from '@/lib/week';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useAuth } from '@/lib/AuthContext';
import type { LeaderboardDoc, ScoreBreakdown } from '@/lib/leaderboardTypes';

// "6A" → "6-A"; "10C" → "10-C"; falls back to the raw classId.
function formatClassName(classId: string): string {
  const match = /^(\d+)([A-Za-z])$/.exec(classId);
  return match ? `${match[1]}-${match[2].toUpperCase()}` : classId;
}

interface UserViewModel {
  rank: number;
  previousRank: number | null;
  compositeScore: number;
  percentile: number;
  breakdown: ScoreBreakdown;
}

/**
 * Locate the signed-in parent's child in the ranking + derive the small
 * view-model the hero card needs. Returns null if the student isn't in
 * this week's ranking (zero data → cron skipped them).
 */
function deriveUserView(data: LeaderboardDoc, studentId: string): UserViewModel | null {
  const me = data.rankings.find((r) => r.studentId === studentId);
  if (!me) return null;
  const breakdown = me.breakdown ?? { marks: 0, attendance: 0, assignments: 0, behavior: 0 };
  // Percentile: rank 1 of 32 → top 1 → percentile 100. Rank 32 of 32 → percentile ≈ 3.
  // Round to integer for display.
  const percentile = data.totalStudents > 0
    ? Math.round(((data.totalStudents - me.rank + 1) / data.totalStudents) * 100)
    : 0;
  return {
    rank: me.rank,
    previousRank: me.previousRank,
    compositeScore: me.compositeScore,
    percentile,
    breakdown,
  };
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const { studentData } = useAuth();
  const { data, loading, error, notReady, refetch } = useLeaderboard();

  if (loading) return <LeaderboardSkeleton />;
  if (error) return <LeaderboardError error={error} onRetry={refetch} variant="leaderboard" />;
  if (notReady || !data) return <LeaderboardNotReady />;

  const userView = studentData?.id ? deriveUserView(data, studentData.id) : null;
  if (!userView) return <UserNotInRanking />;

  const weekLabel = formatWeekLabel(data.weekId);
  const className = formatClassName(data.classId);
  const resetIn = formatCountdown(data.weekEnd);
  const updatedAt = formatGeneratedAt(data.generatedAt);

  return (
    <div
      style={{
        background: T.pageBg,
        padding: '28px 18px',
        fontFamily: FONT,
        minHeight: '100vh',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <Eyebrow>{weekLabel} · Class {className}</Eyebrow>
        <h1
          style={{
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: '-1.4px',
            color: T.T1,
            margin: '8px 0',
            lineHeight: 1,
            fontFamily: FONT,
          }}
        >
          Leaderboard
        </h1>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px',
            borderRadius: 999,
            background: 'rgba(0,85,255,0.08)',
            border: '0.5px solid rgba(0,85,255,0.12)',
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.B1 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: T.B1 }}>
            Resets in {resetIn} · {data.totalStudents} students
          </span>
        </div>
      </div>

      <HeroPositionCard
        rank={userView.rank}
        previousRank={userView.previousRank}
        totalStudents={data.totalStudents}
        score={userView.compositeScore}
        percentile={userView.percentile}
        classAverage={data.classAverage}
        onViewInsights={() => navigate('/leaderboard/insights')}
      />

      <RankingsList rankings={data.rankings} userRank={userView.rank} />

      <button
        type="button"
        style={{
          width: '100%',
          padding: 14,
          marginTop: 14,
          background: T.cardBg,
          border: '0.5px solid rgba(0,85,255,0.15)',
          borderRadius: 16,
          fontSize: 13,
          color: T.B1,
          cursor: 'pointer',
          fontFamily: FONT,
          fontWeight: 700,
          letterSpacing: '-0.2px',
          boxShadow: T.SH,
        }}
      >
        View all {data.totalStudents} students
      </button>

      <p
        style={{
          textAlign: 'center',
          fontSize: 10,
          fontWeight: 500,
          color: T.T4,
          margin: '18px 0 0',
        }}
      >
        {updatedAt} · Edullent AI
      </p>
    </div>
  );
}
