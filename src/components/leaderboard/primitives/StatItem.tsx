interface StatItemProps {
  label: string;
  value: number | string;
  suffix?: string;
}

export function StatItem({ label, value, suffix = '' }: StatItemProps) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <p
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: '1.4px',
          color: 'rgba(255,255,255,0.5)',
          margin: '0 0 4px',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: '-0.6px',
          color: '#FFFFFF',
          margin: 0,
        }}
      >
        {value}
        {suffix && (
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}
