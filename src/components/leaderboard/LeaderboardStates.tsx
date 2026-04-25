// Loading / empty / error fallback components for the leaderboard +
// insights pages. Same dimensions as the real cards so layout doesn't
// jump when data arrives. Match Edullent design tokens directly — no
// shadcn skeletons, because the page uses inline-styled card frames
// already and we want pixel-stable swaps.

import { ReactNode } from 'react';
import { ArrowLeft, Loader2, Trophy, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { T, FONT } from '@/lib/edullentTokens';
import { Eyebrow } from './primitives/Eyebrow';

interface PageShellProps {
  showBack?: boolean;
  eyebrow?: string;
  children: ReactNode;
}

function PageShell({ showBack, eyebrow, children }: PageShellProps) {
  const navigate = useNavigate();
  return (
    <div
      style={{
        background: T.pageBg,
        padding: showBack ? '20px 16px 32px' : '28px 18px',
        fontFamily: FONT,
        minHeight: '100vh',
      }}
    >
      {showBack && (
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
            <span style={{ fontSize: 12, fontWeight: 700, color: T.B1, letterSpacing: '-0.1px' }}>
              Back
            </span>
          </button>
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        </div>
      )}
      {children}
    </div>
  );
}

function CenteredCard({
  icon,
  title,
  body,
  cta,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  cta?: ReactNode;
}) {
  return (
    <div
      style={{
        background: T.cardBg,
        border: T.BORDER,
        borderRadius: 24,
        padding: '40px 24px',
        boxShadow: T.SH_LG,
        textAlign: 'center',
        marginTop: 32,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          background: 'rgba(0,85,255,0.08)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        {icon}
      </div>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: '-0.4px',
          color: T.T1,
          margin: '0 0 8px',
          fontFamily: FONT,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: T.T3,
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {body}
      </p>
      {cta && <div style={{ marginTop: 16 }}>{cta}</div>}
    </div>
  );
}

// ── Loading skeletons ──────────────────────────────────────────────────────

export function LeaderboardSkeleton() {
  return (
    <PageShell>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <Eyebrow>Loading...</Eyebrow>
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
      </div>
      <div
        style={{
          background: T.HERO_GRAD,
          borderRadius: 26,
          padding: '60px 22px',
          boxShadow: T.SH_LG,
          marginBottom: 22,
          textAlign: 'center',
          minHeight: 380,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Loader2 size={32} color="rgba(255,255,255,0.5)" className="animate-spin" />
      </div>
      <div
        style={{
          background: T.cardBg,
          border: T.BORDER,
          borderRadius: 24,
          padding: 24,
          boxShadow: T.SH_LG,
          minHeight: 360,
        }}
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 0',
              borderTop: i === 0 ? 'none' : '0.5px solid rgba(0,85,255,0.06)',
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 12, background: 'rgba(0,85,255,0.06)' }} />
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,85,255,0.06)' }} />
            <div style={{ flex: 1, height: 14, borderRadius: 7, background: 'rgba(0,85,255,0.06)' }} />
            <div style={{ width: 36, height: 18, borderRadius: 9, background: 'rgba(0,85,255,0.06)' }} />
          </div>
        ))}
      </div>
    </PageShell>
  );
}

export function InsightsSkeleton() {
  return (
    <PageShell showBack eyebrow="Insights · loading">
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
          Loading personalized insights…
        </p>
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: T.cardBg,
            border: T.BORDER,
            borderRadius: 22,
            padding: 22,
            boxShadow: T.SH_LG,
            marginBottom: 16,
            minHeight: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Loader2 size={20} color={T.T4} className="animate-spin" />
        </div>
      ))}
    </PageShell>
  );
}

// ── Empty state — leaderboard not yet generated ────────────────────────────

export function LeaderboardNotReady() {
  return (
    <PageShell>
      <CenteredCard
        icon={<Trophy size={26} color={T.B1} strokeWidth={2.2} />}
        title="Leaderboard is being prepared"
        body="The first leaderboard for your class will appear after Monday's update. Check back then to see where you stand."
      />
    </PageShell>
  );
}

export function InsightsNotReady() {
  return (
    <PageShell showBack eyebrow="Insights">
      <CenteredCard
        icon={<Loader2 size={26} color={T.B1} strokeWidth={2.2} className="animate-spin" />}
        title="Generating personalized insights"
        body="We're analyzing the latest week's data to build your action plan. This usually completes within minutes of the leaderboard update."
      />
    </PageShell>
  );
}

// ── Error states ───────────────────────────────────────────────────────────

interface ErrorProps {
  error: Error;
  onRetry?: () => void;
  variant: 'leaderboard' | 'insights';
}

export function LeaderboardError({ error, onRetry, variant }: ErrorProps) {
  return (
    <PageShell showBack={variant === 'insights'} eyebrow={variant === 'insights' ? 'Insights' : undefined}>
      <CenteredCard
        icon={<AlertCircle size={26} color={T.RED} strokeWidth={2.2} />}
        title={variant === 'leaderboard' ? "Couldn't load the leaderboard" : "Couldn't load your insights"}
        body={error.message || 'Something went wrong on our side. Please try again in a moment.'}
        cta={
          onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                padding: '10px 18px',
                background: T.B1,
                border: 'none',
                borderRadius: 12,
                fontSize: 13,
                color: '#FFFFFF',
                cursor: 'pointer',
                fontFamily: FONT,
                fontWeight: 700,
                boxShadow: T.SH_BTN,
              }}
            >
              Try again
            </button>
          )
        }
      />
    </PageShell>
  );
}

// ── Empty state — user not in this week's ranking ──────────────────────────

export function UserNotInRanking() {
  return (
    <PageShell>
      <CenteredCard
        icon={<AlertCircle size={26} color={T.ORANGE} strokeWidth={2.2} />}
        title="You weren't included this week"
        body="This usually means we don't have any test scores, attendance, or assignment data for the week yet. Talk to your class teacher if this looks wrong."
      />
    </PageShell>
  );
}
