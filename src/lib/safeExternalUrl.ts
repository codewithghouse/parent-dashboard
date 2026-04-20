/**
 * Open an externally-sourced URL in a new tab, refusing anything that isn't a
 * plain HTTPS or blob: URL. Defends against:
 *   - javascript: URLs (XSS via stored data)
 *   - data: URLs (binary payload smuggling)
 *   - http: (non-TLS, MITM and mixed-content)
 *   - relative URLs that a future refactor could mistake for absolute
 *
 * Always uses noopener,noreferrer so the opened page cannot reach back into
 * our Firebase Auth context via window.opener.
 *
 * Returns true if the URL was opened, false if it was rejected.
 */
export function openSafeExternalUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!/^(https:\/\/|blob:)/i.test(trimmed)) return false;
  window.open(trimmed, "_blank", "noopener,noreferrer");
  return true;
}