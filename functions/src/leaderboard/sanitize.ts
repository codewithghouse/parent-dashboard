// Whitelist HTML sanitizer for AI-generated diagnosis text.
//
// We persist sanitized HTML in Firestore so client renders are safe even
// if a frontend bug forgets to defend. The whitelist is intentionally
// tiny: only <strong> and <em>, both with NO attributes. Inline color
// styles are dropped — DiagnosisCard re-applies semantic colors based on
// the diagnostic `type` (good/concern/note), which is a stronger contract
// than trusting the AI to pick the right hex code.
//
// Algorithm: walk the string once, escape all HTML special chars, then
// re-emit canonical lowercase tags ONLY for the whitelist matches. Anything
// that looks like a tag but isn't whitelisted becomes literal &lt;blah&gt;.

const ALLOWED_TAG = /<\/?(strong|em)\b[^>]*>/gi;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizeDiagnosisHtml(input: unknown): string {
  if (typeof input !== "string") return "";
  let result = "";
  let last = 0;
  for (const match of input.matchAll(ALLOWED_TAG)) {
    const idx = match.index ?? 0;
    // Escape any text/garbage before this tag.
    result += escapeHtml(input.slice(last, idx));
    // Re-emit ONLY <strong>, </strong>, <em>, </em> in canonical form.
    // Strip any attributes — we only allow the bare tag.
    const closing = /^<\//.test(match[0]);
    const tag = /strong/i.test(match[0]) ? "strong" : "em";
    result += closing ? `</${tag}>` : `<${tag}>`;
    last = idx + match[0].length;
  }
  result += escapeHtml(input.slice(last));
  return result;
}
