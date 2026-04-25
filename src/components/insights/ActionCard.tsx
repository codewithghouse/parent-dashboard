import { Check } from 'lucide-react';
import { T } from '@/lib/edullentTokens';
import type { ActionItem } from '@/lib/leaderboardTypes';

interface ActionCardProps {
  action: ActionItem;
  index: number;
}

export function ActionCard({ action, index }: ActionCardProps) {
  const isCompleted = action.status === 'completed';
  const isInProgress = action.status === 'in_progress';
  const isManual = action.tracking === 'manual_teacher';
  const numStr = String(index).padStart(2, '0');

  if (isCompleted) {
    return <CompletedCard action={action} numStr={numStr} />;
  }

  return (
    <div
      style={{
        background: T.cardBg,
        border: T.BORDER,
        borderRadius: 20,
        padding: 18,
        boxShadow: T.SH_LG,
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
        <span
          style={{
            flexShrink: 0,
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: '-1.2px',
            color: T.B1,
            lineHeight: 1,
            minWidth: 36,
          }}
        >
          {numStr}
        </span>
        <div style={{ flex: 1 }}>
          <p
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: T.T1,
              margin: '0 0 4px',
              letterSpacing: '-0.2px',
              lineHeight: 1.3,
            }}
          >
            {action.title}
          </p>
          <p
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: T.T3,
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {action.reason}
          </p>
        </div>
      </div>

      {isInProgress && action.progress && <InProgressTrack action={action} />}
      {!isInProgress && !isManual && action.progress && <PendingAutoTrack action={action} />}
      {isManual && <ManualTrack action={action} />}
    </div>
  );
}

function CompletedCard({ action, numStr }: { action: ActionItem; numStr: string }) {
  return (
    <div
      style={{
        background: T.cardBg,
        border: T.BORDER,
        borderRadius: 20,
        padding: 18,
        boxShadow: T.SH_LG,
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: 14, right: 14 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: T.GREEN,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(52,199,89,0.4)',
          }}
        >
          <Check size={12} color="#FFFFFF" strokeWidth={2.5} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
        <span
          style={{
            flexShrink: 0,
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: '-1.2px',
            color: T.B1,
            lineHeight: 1,
            minWidth: 36,
          }}
        >
          {numStr}
        </span>
        <div style={{ flex: 1, paddingRight: 28 }}>
          <p
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: T.T1,
              margin: '0 0 4px',
              letterSpacing: '-0.2px',
              lineHeight: 1.3,
            }}
          >
            {action.title}
          </p>
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: T.GREEN,
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {action.reason}
          </p>
        </div>
      </div>
      <div
        style={{
          padding: 12,
          borderRadius: 12,
          background: 'rgba(0,85,255,0.04)',
          border: '0.5px solid rgba(0,85,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '1.2px',
              color: T.GREEN,
              textTransform: 'uppercase',
            }}
          >
            Completed
          </span>
          <div
            style={{
              flex: 1,
              height: 4,
              borderRadius: 999,
              background: 'linear-gradient(90deg, #34C759 0%, #00C853 100%)',
              boxShadow: '0 0 10px rgba(52,199,89,0.45)',
            }}
          />
          {action.reward && (
            <span style={{ fontSize: 11, fontWeight: 800, color: T.GREEN }}>
              {action.reward}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function InProgressTrack({ action }: { action: ActionItem }) {
  if (!action.progress) return null;
  const { current, target } = action.progress;
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        background: 'rgba(52,199,89,0.06)',
        border: '0.5px solid rgba(52,199,89,0.15)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: T.GREEN,
              boxShadow: `0 0 6px ${T.GREEN}`,
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '1.2px',
              color: T.GREEN,
              textTransform: 'uppercase',
            }}
          >
            Live · Auto-tracked
          </span>
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: T.GREEN }}>
          {current} / {target} done
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: target }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 999,
              background: i < current ? T.GREEN : 'rgba(0,85,255,0.10)',
              boxShadow: i < current ? `0 0 6px rgba(52,199,89,0.4)` : 'none',
            }}
          />
        ))}
      </div>
      {action.details && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 8,
            gap: 4,
            flexWrap: 'wrap',
          }}
        >
          {action.details.map((d, i) => (
            <span
              key={i}
              style={{
                fontSize: 10,
                fontWeight: d.done ? 700 : 500,
                color: d.done ? T.GREEN : T.T3,
              }}
            >
              {d.done ? '✓' : ''} {d.label}
              {d.date ? ` · ${d.date}` : d.done ? '' : ' · pending'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PendingAutoTrack({ action }: { action: ActionItem }) {
  if (!action.progress) return null;
  const { current, target, type } = action.progress;
  const suffix = type === 'percentage' ? '%' : '';
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        background: 'rgba(0,85,255,0.04)',
        border: '0.5px solid rgba(0,85,255,0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: T.B1,
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '1.2px',
              color: T.B1,
              textTransform: 'uppercase',
            }}
          >
            Auto-tracked daily
          </span>
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: T.B1 }}>
          {current}
          {suffix} → {target}
          {suffix}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.T3 }}>Now {current}</span>
        <div
          style={{
            flex: 1,
            height: 4,
            background: 'rgba(0,85,255,0.10)',
            borderRadius: 999,
            position: 'relative',
          }}
        >
          {/* Locked design: bar is a 0-100 scale; fill = current value, marker = target value. */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${Math.min(100, Math.max(0, current))}%`,
              background: T.B1,
              borderRadius: 999,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: `${Math.min(100, Math.max(0, target))}%`,
              top: -3,
              bottom: -3,
              width: 2,
              background: T.GREEN,
              borderRadius: 1,
            }}
          />
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: T.GREEN }}>Goal {target}</span>
      </div>
    </div>
  );
}

function ManualTrack({ action }: { action: ActionItem }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        background: 'rgba(123,63,244,0.04)',
        border: '0.5px solid rgba(123,63,244,0.10)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: T.VIOLET,
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '1.2px',
              color: T.VIOLET,
              textTransform: 'uppercase',
            }}
          >
            Teacher-tracked
          </span>
        </span>
        <span style={{ fontSize: 11, fontWeight: 800, color: T.VIOLET }}>Manual update</span>
      </div>
      {action.hint && (
        <p
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: T.T3,
            margin: '4px 0 0',
            lineHeight: 1.5,
          }}
        >
          {action.hint}
        </p>
      )}
    </div>
  );
}
