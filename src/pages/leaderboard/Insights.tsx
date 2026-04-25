import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { T, FONT } from '@/lib/edullentTokens';
import { Eyebrow } from '@/components/leaderboard/primitives/Eyebrow';
import { CompactRecap } from '@/components/insights/CompactRecap';
import { SectionHeader } from '@/components/insights/SectionHeader';
import { MetricCard } from '@/components/insights/MetricCard';
import { DiagnosisCard } from '@/components/insights/DiagnosisCard';
import { SubjectBar } from '@/components/insights/SubjectBar';
import {
  TrajectoryChart,
  TrajectoryStat,
} from '@/components/insights/TrajectoryChart';
import { GapAnalysis } from '@/components/insights/GapAnalysis';
import { ActionCard } from '@/components/insights/ActionCard';
import { PlanProgressSummary } from '@/components/insights/PlanProgressSummary';
import { ForecastCard } from '@/components/insights/ForecastCard';
import {
  InsightsSkeleton,
  InsightsNotReady,
  LeaderboardError,
} from '@/components/leaderboard/LeaderboardStates';
import { formatWeekLabel } from '@/lib/week';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useInsights } from '@/hooks/useInsights';
import { useAuth } from '@/lib/AuthContext';
import type { LeaderboardDoc, ScoreBreakdown } from '@/lib/leaderboardTypes';

const METRIC_KEYS: ('marks' | 'attendance' | 'assignments' | 'behavior')[] = [
  'marks',
  'attendance',
  'assignments',
  'behavior',
];

interface UserContext {
  rank: number;
  previousRank: number | null;
  compositeScore: number;
  breakdown: ScoreBreakdown;
}

/** Locate the user's row in rankings + derive class-average breakdown. */
function deriveContext(
  leaderboard: LeaderboardDoc,
  studentId: string,
): { user: UserContext; classAvgBreakdown: ScoreBreakdown } | null {
  const me = leaderboard.rankings.find((r) => r.studentId === studentId);
  if (!me) return null;

  const sums: ScoreBreakdown = { marks: 0, attendance: 0, assignments: 0, behavior: 0 };
  let n = 0;
  for (const r of leaderboard.rankings) {
    if (!r.breakdown) continue;
    sums.marks += r.breakdown.marks;
    sums.attendance += r.breakdown.attendance;
    sums.assignments += r.breakdown.assignments;
    sums.behavior += r.breakdown.behavior;
    n++;
  }
  const classAvgBreakdown: ScoreBreakdown =
    n === 0
      ? { marks: 0, attendance: 0, assignments: 0, behavior: 0 }
      : {
          marks: Math.round(sums.marks / n),
          attendance: Math.round(sums.attendance / n),
          assignments: Math.round(sums.assignments / n),
          behavior: Math.round(sums.behavior / n),
        };

  return {
    user: {
      rank: me.rank,
      previousRank: me.previousRank,
      compositeScore: me.compositeScore,
      breakdown: me.breakdown ?? { marks: 0, attendance: 0, assignments: 0, behavior: 0 },
    },
    classAvgBreakdown,
  };
}

export default function Insights() {
  const navigate = useNavigate();
  const { studentData } = useAuth();

  const lb = useLeaderboard();
  const ins = useInsights();

  // Wait for either source. Insights is the slower path on first run because
  // the OpenAI trigger lags the leaderboard write; surface that case as
  // "preparing" rather than a blank loader.
  if (lb.loading || ins.loading) return <InsightsSkeleton />;
  if (lb.error) return <LeaderboardError error={lb.error} onRetry={lb.refetch} variant="insights" />;
  if (ins.error) return <LeaderboardError error={ins.error} variant="insights" />;
  if (lb.notReady || !lb.data) return <InsightsNotReady />;
  if (ins.notReady || !ins.data) return <InsightsNotReady />;

  const ctx = studentData?.id ? deriveContext(lb.data, studentData.id) : null;
  if (!ctx) return <InsightsNotReady />;
  const { user, classAvgBreakdown } = ctx;
  const insights = ins.data;

  const trajectory = insights.trajectory ?? [];
  const trajectoryBest = trajectory.length
    ? trajectory.reduce((best, p) => (p.rank < best.rank ? p : best), trajectory[0])
    : null;
  const trajectoryAvg = trajectory.length
    ? (trajectory.reduce((sum, p) => sum + p.rank, 0) / trajectory.length).toFixed(1)
    : '—';
  const trajectoryClimb = trajectory.length >= 2
    ? trajectory[0].rank - trajectory[trajectory.length - 1].rank
    : 0;

  const topperFirstName = insights.topper.name.split(' ')[0];
  const gapToTopper = (insights.topper.score - user.compositeScore).toFixed(1);
  const weekLabel = formatWeekLabel(insights.weekId);
  const topperRank = lb.data.rankings[0]?.rank ?? 1;

  // Show the projection scenario matching the count of completed actions
  // so "Projected new rank #X" reflects current progress, not the AI's
  // best-case all-actions projection.
  const completedCount = insights.actions.filter((a) => a.status === 'completed').length;
  const projectedNow =
    insights.forecast.scenarios.find((s) => s.actions === completedCount)?.rank ??
    insights.forecast.projectedRank;

  return (
    <div
      style={{
        background: T.pageBg,
        padding: '20px 16px 32px',
        fontFamily: FONT,
        minHeight: '100vh',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          padding: '0 4px',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/leaderboard')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px 8px 10px',
            borderRadius: 999,
            background: T.cardBg,
            border: T.BORDER,
            cursor: 'pointer',
            fontFamily: FONT,
            boxShadow: T.SH,
          }}
        >
          <ArrowLeft size={14} color={T.B1} strokeWidth={2.2} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: T.B1,
              letterSpacing: '-0.1px',
            }}
          >
            Back
          </span>
        </button>
        <Eyebrow>{weekLabel} · Insights</Eyebrow>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <h1
          style={{
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: '-1.4px',
            color: T.T1,
            margin: '0 0 6px',
            lineHeight: 1,
            fontFamily: FONT,
          }}
        >
          Your deep dive
        </h1>
        <p style={{ fontSize: 13, fontWeight: 500, color: T.T3, margin: 0 }}>
          Built from {trajectory.length} {trajectory.length === 1 ? 'week' : 'weeks'} of your data
        </p>
      </div>

      <CompactRecap
        rank={user.rank}
        previousRank={user.previousRank}
        score={user.compositeScore}
      />

      <SectionHeader
        number="01"
        eyebrow="Breakdown"
        title="Where each metric stands"
        subtitle="Compared to your class average"
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
          marginBottom: 32,
        }}
      >
        {METRIC_KEYS.map((key) => (
          <MetricCard
            key={key}
            label={key}
            value={user.breakdown[key]}
            classAvg={classAvgBreakdown[key]}
            isPercentage={key === 'attendance' || key === 'assignments'}
          />
        ))}
      </div>

      <SectionHeader
        number="02"
        eyebrow="Diagnosis"
        title={`Why you're at #${user.rank}`}
        subtitle="The honest read from your data"
      />
      <DiagnosisCard items={insights.diagnosis} />

      {insights.subjects.length > 0 && (
        <>
          <SectionHeader
            number="03"
            eyebrow="Subjects"
            title="Where you're strong"
            subtitle="Subject-wise vs your class average"
          />
          <div
            style={{
              background: T.cardBg,
              border: T.BORDER,
              borderRadius: 22,
              padding: 20,
              boxShadow: T.SH_LG,
              marginBottom: 32,
            }}
          >
            {insights.subjects.map((s, i) => (
              <SubjectBar
                key={s.name}
                subject={s}
                isLast={i === insights.subjects.length - 1}
              />
            ))}
          </div>
        </>
      )}

      {trajectory.length > 0 && trajectoryBest && (
        <>
          <SectionHeader
            number="04"
            eyebrow="Trajectory"
            title={`Your last ${trajectory.length} ${trajectory.length === 1 ? 'week' : 'weeks'}`}
            subtitle={
              trajectory.length >= 2
                ? `From #${trajectory[0].rank} to #${user.rank}`
                : 'First week of data'
            }
          />
          <div
            style={{
              background: T.cardBg,
              border: T.BORDER,
              borderRadius: 22,
              padding: '20px 16px',
              boxShadow: T.SH_LG,
              marginBottom: 32,
            }}
          >
            <TrajectoryChart data={trajectory} />
            <div
              style={{
                display: 'flex',
                gap: 16,
                paddingTop: 14,
                borderTop: '0.5px solid rgba(0,85,255,0.06)',
                marginTop: 8,
              }}
            >
              <TrajectoryStat
                label="Best week"
                value={`${trajectoryBest.weekLabel} · #${trajectoryBest.rank}`}
              />
              <TrajectoryStat label="Avg rank" value={`#${trajectoryAvg}`} />
              <TrajectoryStat
                label="Climb"
                value={`${trajectoryClimb >= 0 ? '+' : ''}${trajectoryClimb} spots`}
                color={trajectoryClimb >= 0 ? T.GREEN : T.RED}
              />
            </div>
          </div>
        </>
      )}

      <SectionHeader
        number="05"
        eyebrow="The gap"
        title={`You vs ${topperFirstName}`}
        subtitle={`Where the ${gapToTopper}-point gap to #1 lives`}
      />
      <GapAnalysis
        topper={insights.topper}
        topperRank={topperRank}
        userRank={user.rank}
        userScore={user.compositeScore}
        userBreakdown={user.breakdown}
      />

      <SectionHeader
        number="06"
        eyebrow="Your plan"
        title={`${insights.actions.length} doable ${insights.actions.length === 1 ? 'move' : 'moves'}`}
        subtitle="System auto-tracks where it can"
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22 }}>
        {insights.actions.map((action, i) => (
          <ActionCard key={action.id} action={action} index={i + 1} />
        ))}
      </div>
      <PlanProgressSummary actions={insights.actions} projectedRank={projectedNow} />

      <div style={{ marginTop: 32 }}>
        <SectionHeader
          number="07"
          eyebrow="Forecast"
          title="If you follow this plan"
          subtitle="Predicted next week's rank"
        />
      </div>
      <ForecastCard data={insights.forecast} />

      <p
        style={{
          textAlign: 'center',
          fontSize: 10,
          fontWeight: 500,
          color: T.T4,
          margin: '24px 0 0',
          letterSpacing: '0.2px',
          lineHeight: 1.6,
        }}
      >
        Insights regenerate every Monday at 2:00 AM
        <br />
        Powered by Edullent AI{insights.aiModel === 'fallback' ? ' (rule-based fallback)' : ''}
      </p>
    </div>
  );
}
