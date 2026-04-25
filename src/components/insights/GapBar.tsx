import { T } from '@/lib/edullentTokens';

interface GapBarProps {
  label: 'marks' | 'attendance' | 'assignments' | 'behavior';
  userValue: number;
  topperValue: number;
  gap: number;
  isBiggest?: boolean;
}

const LABEL_MAP: Record<GapBarProps['label'], string> = {
  marks: 'Marks',
  attendance: 'Attendance',
  assignments: 'Assignments',
  behavior: 'Behavior',
};

export function GapBar({ label, userValue, topperValue, gap, isBiggest }: GapBarProps) {
  const gapColor = gap >= 15 ? T.RED : gap >= 5 ? T.ORANGE : T.GREEN;

  return (
    <div>
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
            fontSize: 11,
            fontWeight: 700,
            color: T.T3,
            letterSpacing: '-0.1px',
          }}
        >
          {LABEL_MAP[label]}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: gapColor }}>
          −{gap}
          {label === 'attendance' ? '%' : ''} {isBiggest ? '· biggest gap' : 'gap'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <div
          style={{
            flex: '0 0 30px',
            fontSize: 11,
            fontWeight: 800,
            color: T.T1,
            textAlign: 'right',
          }}
        >
          {userValue}
        </div>
        <div
          style={{
            flex: 1,
            height: 8,
            background: 'rgba(0,85,255,0.06)',
            borderRadius: 999,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${userValue}%`,
              background: T.B1,
              borderRadius: 999,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: `${topperValue}%`,
              top: -2,
              bottom: -2,
              width: 2,
              background: T.GOLD,
              borderRadius: 1,
            }}
          />
        </div>
        <div
          style={{
            flex: '0 0 30px',
            fontSize: 11,
            fontWeight: 800,
            color: T.GOLD,
            textAlign: 'left',
          }}
        >
          {topperValue}
        </div>
      </div>
    </div>
  );
}
