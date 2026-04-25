import { T } from '@/lib/edullentTokens';
import type { SubjectScore } from '@/lib/leaderboardTypes';

interface SubjectBarProps {
  subject: SubjectScore;
  isLast: boolean;
}

export function SubjectBar({ subject, isLast }: SubjectBarProps) {
  const isWeak = subject.status === 'weak';
  const isStrong = subject.status === 'strong';

  if (isWeak) {
    return (
      <div
        style={{
          padding: 12,
          borderRadius: 12,
          background: 'rgba(255,69,58,0.06)',
          border: '0.5px solid rgba(255,69,58,0.15)',
          marginTop: 4,
          marginBottom: isLast ? 0 : 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: T.T1,
              letterSpacing: '-0.2px',
            }}
          >
            {subject.name} ⚠
          </span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: T.RED,
              letterSpacing: '-0.4px',
            }}
          >
            {subject.score}
          </span>
        </div>
        <div
          style={{
            position: 'relative',
            height: 6,
            background: 'rgba(0,85,255,0.06)',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${subject.score}%`,
              background: 'linear-gradient(90deg, #FF8800 0%, #FF453A 100%)',
              borderRadius: 999,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: `${subject.classAvg}%`,
              top: -3,
              bottom: -3,
              width: 1.5,
              background: T.T1,
            }}
          />
        </div>
        <p style={{ fontSize: 11, fontWeight: 700, color: T.RED, margin: '4px 0 0' }}>
          {subject.score - subject.classAvg} below class avg of {subject.classAvg} · Your weakest subject
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: isLast ? 0 : 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: T.T1,
            letterSpacing: '-0.2px',
          }}
        >
          {subject.name}
        </span>
        <span
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: T.T1,
            letterSpacing: '-0.4px',
          }}
        >
          {subject.score}
        </span>
      </div>
      <div
        style={{
          position: 'relative',
          height: 6,
          background: 'rgba(0,85,255,0.06)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${subject.score}%`,
            background: isStrong
              ? 'linear-gradient(90deg, #34C759 0%, #00C853 100%)'
              : T.B1,
            borderRadius: 999,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${subject.classAvg}%`,
            top: -3,
            bottom: -3,
            width: 1.5,
            background: T.T1,
          }}
        />
      </div>
      <p
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: isStrong ? T.GREEN : T.T3,
          margin: '4px 0 0',
        }}
      >
        +{subject.score - subject.classAvg} above class avg of {subject.classAvg}
      </p>
    </div>
  );
}
