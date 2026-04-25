import { T } from '@/lib/edullentTokens';
import type { ActionItem } from '@/lib/leaderboardTypes';

interface PlanProgressSummaryProps {
  actions: ActionItem[];
  projectedRank?: number;
}

export function PlanProgressSummary({ actions, projectedRank }: PlanProgressSummaryProps) {
  const completed = actions.filter((a) => a.status === 'completed').length;
  const totalReward = actions
    .filter((a) => a.status === 'completed')
    .reduce((sum, a) => sum + (a.scoreReward ?? 0), 0);

  return (
    <div
      style={{
        background:
          'linear-gradient(135deg, rgba(52,199,89,0.06) 0%, rgba(0,85,255,0.04) 100%)',
        border: '0.5px solid rgba(52,199,89,0.18)',
        borderRadius: 18,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #34C759 0%, #00C853 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 14,
            boxShadow: '0 4px 12px rgba(52,199,89,0.3)',
          }}
        >
          ⚡
        </div>
        <div style={{ flex: 1 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: T.T1,
              margin: 0,
              letterSpacing: '-0.2px',
            }}
          >
            Plan progress: {completed} of {actions.length} actions complete
          </p>
          <p style={{ fontSize: 11, fontWeight: 500, color: T.T3, margin: '2px 0 0' }}>
            Score boost so far: +{totalReward}
            {projectedRank !== undefined && ` · Projected new rank #${projectedRank}`}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, paddingTop: 4 }}>
        {actions.map((a, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 999,
              background:
                a.status === 'completed'
                  ? T.GREEN
                  : a.status === 'in_progress'
                  ? 'rgba(52,199,89,0.30)'
                  : 'rgba(0,85,255,0.10)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
