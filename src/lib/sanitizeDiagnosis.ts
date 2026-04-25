// Client-side mirror of functions/src/leaderboard/sanitize.ts.
// We sanitize at write-time on the function side AND at render-time here —
// belt-and-suspenders. The render-time defence specifically catches any
// historical insight docs that were written before the function-side
// sanitizer landed.

const ALLOWED_TAG = /<\/?(strong|em)\b[^>]*>/gi;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeDiagnosisHtml(input: unknown): string {
  if (typeof input !== 'string') return '';
  let result = '';
  let last = 0;
  for (const match of input.matchAll(ALLOWED_TAG)) {
    const idx = match.index ?? 0;
    result += escapeHtml(input.slice(last, idx));
    const closing = /^<\//.test(match[0]);
    const tag = /strong/i.test(match[0]) ? 'strong' : 'em';
    result += closing ? `</${tag}>` : `<${tag}>`;
    last = idx + match[0].length;
  }
  result += escapeHtml(input.slice(last));
  return result;
}
