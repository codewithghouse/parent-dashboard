import { T } from '@/lib/edullentTokens';
import { Eyebrow } from './Eyebrow';

interface SectionHeadProps {
  title: string;
  subtitle: string;
}

export function SectionHead({ title, subtitle }: SectionHeadProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 8px 14px',
        borderBottom: '0.5px solid rgba(0,85,255,0.08)',
      }}
    >
      <Eyebrow>{title}</Eyebrow>
      <span style={{ fontSize: 11, fontWeight: 500, color: T.T3 }}>{subtitle}</span>
    </div>
  );
}
