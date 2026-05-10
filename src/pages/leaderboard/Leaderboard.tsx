import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
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
import { useInsights } from '@/hooks/useInsights';
import { useAuth } from '@/lib/AuthContext';
import type { LeaderboardDoc, ScoreBreakdown, SubjectRankingEntry } from '@/lib/leaderboardTypes';

// Pretty-printed subject name. Cron normalises subjects to lowercase keys
// like "mathematics", "english"; UI shows them title-cased.
function prettySubject(key: string): string {
  return key
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

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
  // useInsights hits the same Firestore-backed weekly cache that Insights.tsx
  // reads, so this strip is free (no extra OpenAI call). The cron-deployed
  // generateInsights Cloud Function writes the doc once weekly per student.
  const insights = useInsights();

  // Active subject tab. "" = Overall (composite ranking).
  // Per-subject keys come from data.subjectRankings (cron writes them).
  const [activeSubject, setActiveSubject] = useState<string>('');

  // Subject keys available — sorted alphabetically for stable UX.
  // Memoised so we don't recompute on every render.
  const subjectKeys = useMemo(() => {
    const keys = Object.keys(data?.subjectRankings || {});
    return keys.sort((a, b) => a.localeCompare(b));
  }, [data?.subjectRankings]);

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

      {/* AI insight strip — pulls the first diagnosis line from the same
          weekly-cached `student_insights` doc that the Insights page reads.
          Zero additional AI cost. Click → full insights page. */}
      {insights.data && insights.data.diagnosis && insights.data.diagnosis.length > 0 && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate('/leaderboard/insights')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/leaderboard/insights');
            }
          }}
          aria-label="Open full AI insights"
          style={{
            background: T.cardBg,
            border: '0.5px solid rgba(123,63,244,0.20)',
            borderRadius: 18,
            padding: '14px 16px',
            margin: '14px 0',
            boxShadow: T.SH,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            fontFamily: FONT,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'rgba(123,63,244,0.10)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Sparkles size={16} color="#7B3FF4" strokeWidth={2.4} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '1.2px',
                color: '#7B3FF4',
                margin: '0 0 4px',
                textTransform: 'uppercase',
              }}
            >
              Edullent AI · This week
            </p>
            <p
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: T.T1,
                margin: 0,
                lineHeight: 1.55,
                letterSpacing: '-0.1px',
              }}
            >
              {insights.data.diagnosis[0]?.text || 'Open insights for your weekly read.'}
            </p>
          </div>
          <ArrowRight size={14} color={T.B1} strokeWidth={2.2} style={{ marginTop: 8, flexShrink: 0 }} />
        </div>
      )}

      {/* Subject tabs — Overall + every subject the cron has rankings for.
          Tab strip stays compact + horizontally scrollable on mobile so a
          class with 8 subjects doesn't overflow. */}
      {subjectKeys.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '4px',
            margin: '14px 0 10px',
            background: 'rgba(0,85,255,0.04)',
            border: '0.5px solid rgba(0,85,255,0.10)',
            borderRadius: 14,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {[{ key: '', label: 'Overall' }, ...subjectKeys.map((k) => ({ key: k, label: prettySubject(k) }))].map(
            (tab) => {
              const isActive = activeSubject === tab.key;
              return (
                <button
                  key={tab.key || 'overall'}
                  type="button"
                  onClick={() => setActiveSubject(tab.key)}
                  style={{
                    flex: '0 0 auto',
                    padding: '8px 14px',
                    borderRadius: 10,
                    background: isActive ? T.cardBg : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: FONT,
                    fontSize: 12,
                    fontWeight: 700,
                    color: isActive ? T.B1 : T.T3,
                    letterSpacing: '-0.1px',
                    boxShadow: isActive ? '0 1px 3px rgba(0,85,255,0.10)' : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </button>
              );
            },
          )}
        </div>
      )}

      {activeSubject === '' ? (
        <RankingsList rankings={data.rankings} userRank={userView.rank} />
      ) : (
        <SubjectRankingsList
          subject={activeSubject}
          entries={data.subjectRankings?.[activeSubject] || []}
          classAvg={data.classSubjectAverages?.[activeSubject]}
          userStudentId={studentData?.id || ''}
        />
      )}

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

/* ═════════════════════════════════════════════════════════════════════════
   Per-subject rankings list — shown when a subject tab is active.
   Highlights the parent's child via `isUser` flag if their studentId is in
   the entries. Same Blue Apple visual language as the overall RankingsList
   but each row shows the SUBJECT score (not composite).
   ═════════════════════════════════════════════════════════════════════════ */
function SubjectRankingsList({
  subject,
  entries,
  classAvg,
  userStudentId,
}: {
  subject: string;
  entries: SubjectRankingEntry[];
  classAvg?: number;
  userStudentId: string;
}) {
  if (entries.length === 0) {
    return (
      <div
        style={{
          background: T.cardBg,
          border: T.BORDER,
          borderRadius: 22,
          padding: 24,
          boxShadow: T.SH,
          textAlign: 'center',
          marginBottom: 14,
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 700, color: T.T1, margin: '0 0 4px', letterSpacing: '-0.2px' }}>
          No data for {prettySubject(subject)} yet
        </p>
        <p style={{ fontSize: 12, fontWeight: 500, color: T.T3, margin: 0, lineHeight: 1.5 }}>
          Once test or gradebook scores are recorded for this subject, the ranking will appear.
        </p>
      </div>
    );
  }

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
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          padding: '4px 8px 14px',
          borderBottom: '0.5px solid rgba(0,85,255,0.06)',
        }}
      >
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.4px', color: T.T4, margin: 0, textTransform: 'uppercase' }}>
            {prettySubject(subject)} Ranking
          </p>
          <p style={{ fontSize: 11, fontWeight: 500, color: T.T3, margin: '2px 0 0' }}>
            {entries.length} student{entries.length === 1 ? '' : 's'} with scores in this subject
          </p>
        </div>
        {typeof classAvg === 'number' && (
          <span style={{ fontSize: 11, fontWeight: 700, color: T.B1, letterSpacing: '-0.1px' }}>
            Class avg {classAvg}%
          </span>
        )}
      </div>

      {entries.map((e, i) => {
        const isUser = e.studentId === userStudentId;
        const isPodium = e.rank <= 3;
        const podiumColors: Record<number, string> = {
          1: 'linear-gradient(135deg, #FFD700 0%, #FFAA00 100%)',
          2: 'linear-gradient(135deg, #E8E8F0 0%, #A8A8B5 100%)',
          3: 'linear-gradient(135deg, #D89060 0%, #8B5A2B 100%)',
        };
        return (
          <div
            key={e.studentId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: isPodium ? '14px 10px' : '12px 10px',
              borderRadius: isPodium ? 16 : 14,
              borderTop: i > 0 ? '0.5px solid rgba(0,85,255,0.06)' : 'none',
              background: isUser
                ? 'linear-gradient(90deg, rgba(0,85,255,0.06) 0%, rgba(0,85,255,0.02) 100%)'
                : 'transparent',
              border: isUser ? '2px solid #0055FF' : 'none',
              marginTop: isUser ? 6 : 0,
            }}
          >
            <div
              style={{
                width: isPodium ? 38 : 34,
                height: isPodium ? 38 : 34,
                borderRadius: 14,
                background: isPodium ? podiumColors[e.rank] : 'rgba(0,85,255,0.06)',
                color: isPodium ? '#FFF' : T.T3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: isPodium ? 15 : 13,
                letterSpacing: '-0.4px',
                flexShrink: 0,
              }}
            >
              {e.rank}
            </div>
            <div
              style={{
                width: isPodium ? 38 : 34,
                height: isPodium ? 38 : 34,
                borderRadius: '50%',
                background: e.avatarBg,
                color: e.avatarText,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 12,
                flexShrink: 0,
                letterSpacing: '-0.2px',
              }}
            >
              {e.initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: isPodium ? 15 : 14,
                  fontWeight: 700,
                  margin: 0,
                  color: T.T1,
                  letterSpacing: isPodium ? '-0.3px' : '-0.2px',
                }}
              >
                {e.name}
                {isUser && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      marginLeft: 8,
                      padding: '2px 6px',
                      borderRadius: 999,
                      background: 'rgba(0,85,255,0.10)',
                      color: T.B1,
                      letterSpacing: '0.6px',
                    }}
                  >
                    YOU
                  </span>
                )}
              </p>
            </div>
            <span
              style={{
                fontSize: isPodium ? 19 : 17,
                fontWeight: 800,
                color: T.T1,
                letterSpacing: '-0.5px',
              }}
            >
              {e.score}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
