import { T } from '@/lib/edullentTokens';
import type { TrajectoryPoint } from '@/lib/leaderboardTypes';

interface TrajectoryChartProps {
  data: TrajectoryPoint[];
}

export function TrajectoryChart({ data }: TrajectoryChartProps) {
  if (data.length === 0) return null;

  // Y-axis range — fixed window so the line is comparable across weeks.
  const minRank = 1;
  const maxRank = 15;
  const yRange = 180;
  const yStart = 10;

  // Distribute X positions across the chart width regardless of how many
  // points the trajectory contains. Phase-2 mock has 8 points; in
  // production it might be 4 (new student) or 12+ (full term).
  const xLeft = 50;
  const xRight = 380;
  const points = data.map((d, i) => {
    const x = data.length === 1
      ? (xLeft + xRight) / 2
      : xLeft + ((xRight - xLeft) * i) / (data.length - 1);
    const clampedRank = Math.max(minRank, Math.min(maxRank, d.rank));
    const y = yStart + (yRange * (clampedRank - minRank)) / (maxRank - minRank);
    return { x, y, weekLabel: d.weekLabel, rank: d.rank };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`)
    .join(' ');
  const fillD = `${pathD} L ${points[points.length - 1].x},200 L ${points[0].x},200 Z`;
  const last = points[points.length - 1];

  return (
    <svg
      viewBox="0 0 400 220"
      style={{ width: '100%', height: 'auto', display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="lineFillEd" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0055FF" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0055FF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lineStrokeEd" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4499FF" />
          <stop offset="100%" stopColor="#0055FF" />
        </linearGradient>
      </defs>
      {[40, 100, 160].map((y) => (
        <line
          key={y}
          x1="30"
          y1={y}
          x2="380"
          y2={y}
          stroke="rgba(0,85,255,0.06)"
          strokeWidth="0.5"
          strokeDasharray="2 4"
        />
      ))}
      {[
        { y: 44, label: '#1' },
        { y: 104, label: '#7' },
        { y: 164, label: '#15' },
      ].map((l) => (
        <text
          key={l.label}
          x="22"
          y={l.y}
          textAnchor="end"
          fill={T.T4}
          fontSize="9"
          fontWeight="700"
          fontFamily="Montserrat, sans-serif"
        >
          {l.label}
        </text>
      ))}
      <path d={fillD} fill="url(#lineFillEd)" />
      <path
        d={pathD}
        stroke="url(#lineStrokeEd)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.slice(0, -1).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#FFFFFF" stroke={T.B1} strokeWidth="2" />
      ))}
      <circle cx={last.x} cy={last.y} r="6" fill={T.B1} />
      <circle cx={last.x} cy={last.y} r="10" fill="none" stroke={T.B1} strokeWidth="1" opacity="0.3" />
      <text
        x={last.x}
        y={last.y - 14}
        textAnchor="middle"
        fill={T.B1}
        fontSize="11"
        fontWeight="800"
        fontFamily="Montserrat, sans-serif"
      >
        #{last.rank}
      </text>
      {points.map((p, i) => (
        <text
          key={p.weekLabel}
          x={p.x}
          y="195"
          textAnchor="middle"
          fill={i === points.length - 1 ? T.B1 : T.T4}
          fontSize="9"
          fontWeight="700"
          fontFamily="Montserrat, sans-serif"
        >
          {i === points.length - 1 ? 'Now' : p.weekLabel}
        </text>
      ))}
    </svg>
  );
}

interface TrajectoryStatProps {
  label: string;
  value: string;
  color?: string;
}

export function TrajectoryStat({ label, value, color = T.T1 }: TrajectoryStatProps) {
  return (
    <div style={{ flex: 1 }}>
      <p
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: '1.2px',
          color: T.T4,
          margin: '0 0 2px',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 14, fontWeight: 800, color, margin: 0, letterSpacing: '-0.2px' }}>
        {value}
      </p>
    </div>
  );
}
