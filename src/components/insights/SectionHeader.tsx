import { T, FONT } from '@/lib/edullentTokens';
import { Eyebrow } from '@/components/leaderboard/primitives/Eyebrow';

interface SectionHeaderProps {
  number: string;
  eyebrow: string;
  title: string;
  subtitle: string;
}

export function SectionHeader({ number, eyebrow, title, subtitle }: SectionHeaderProps) {
  return (
    <div style={{ marginBottom: 14 }}>
      <Eyebrow>
        {number} · {eyebrow}
      </Eyebrow>
      <h2
        style={{
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: '-0.9px',
          color: T.T1,
          margin: '4px 0',
          lineHeight: 1.1,
          fontFamily: FONT,
        }}
      >
        {title}
      </h2>
      <p style={{ fontSize: 13, fontWeight: 500, color: T.T3, margin: 0 }}>{subtitle}</p>
    </div>
  );
}
