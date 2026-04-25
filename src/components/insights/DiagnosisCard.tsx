import { useMemo } from 'react';
import { T } from '@/lib/edullentTokens';
import { sanitizeDiagnosisHtml } from '@/lib/sanitizeDiagnosis';
import type { DiagnosisItem } from '@/lib/leaderboardTypes';

interface DiagnosisCardProps {
  items: DiagnosisItem[];
}

// Color the diagnostic's <strong> tags based on its semantic type.
// We do this via CSS rather than trusting the AI to emit inline styles —
// safer (no style-attribute attack surface) and consistent across runs.
const TYPE_COLORS: Record<DiagnosisItem['type'], string> = {
  good: T.GREEN,
  concern: T.RED,
  note: T.T3,
};

export function DiagnosisCard({ items }: DiagnosisCardProps) {
  // Sanitize every render — defense-in-depth on top of the function-side
  // sanitizer. Memoized so we don't re-parse on unrelated re-renders.
  const sanitized = useMemo(
    () => items.map((d) => ({ ...d, text: sanitizeDiagnosisHtml(d.text) })),
    [items],
  );

  return (
    <div
      style={{
        background: T.cardBg,
        border: T.BORDER,
        borderRadius: 22,
        padding: 22,
        boxShadow: T.SH_LG,
        marginBottom: 32,
      }}
    >
      {sanitized.map((d, i) => (
        <p
          key={i}
          // Inline CSS variable lets nested <strong> inherit the type color
          // without needing a stylesheet rule per type.
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: T.T1,
            margin: i === sanitized.length - 1 ? 0 : '0 0 14px',
            lineHeight: 1.65,
            letterSpacing: '-0.1px',
            // Custom property consumed by the inline <style> below.
            ['--diag-strong-color' as string]: TYPE_COLORS[d.type],
          }}
          dangerouslySetInnerHTML={{ __html: d.text }}
        />
      ))}
      <style>{`
        .diag-good strong, .diag-concern strong, .diag-note strong { color: inherit; }
        p strong { color: var(--diag-strong-color, inherit); }
      `}</style>
    </div>
  );
}
