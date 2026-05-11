/**
 * callAI — universal client-side AI caller
 *
 * Routes ALL OpenAI requests through the `parentAIProxy` Cloud Function.
 * The OpenAI API key NEVER leaves the server — this file contains zero secrets.
 *
 * Usage:
 *   const result = await callAI(prompt);              // JSON response
 *   const text   = await callAI(prompt, { jsonMode: false }); // plain text
 *   const ans    = await callAI(prompt, { imageBase64: "..." }); // vision
 */

import { functions } from "../../lib/firebase";
import { httpsCallable } from "firebase/functions";

export interface CallAIOptions {
  jsonMode?: boolean;
  imageBase64?: string;
  model?: string;
  systemPrompt?: string;
  /**
   * Optional hint for the server-side `max_tokens` cap. Use for prompts that
   * may produce long output (AI Practice 20-Q exam, full reports, etc.).
   * Server clamps to [256, 6000]. Omit for default (4096).
   */
  maxTokens?: number;
}

// Singleton callable — created once, reused across all calls
const proxyFn = httpsCallable<
  { prompt: string; systemPrompt?: string; jsonMode?: boolean; imageBase64?: string; model?: string; maxTokens?: number },
  { content: string }
>(functions, "parentAIProxy", { timeout: 60000 });

/**
 * Recover usable JSON from a truncated AI response. OpenAI sometimes cuts off
 * mid-string when max_tokens is reached — `JSON.parse` then throws. This
 * walks backwards to the last complete `}` after a valid sibling, balances
 * brackets, and returns a closeable fragment. Returns null if unrecoverable.
 *
 * Specifically designed for the common case of an `{ items: [...] }` shape
 * where the last item got truncated — we drop the partial trailing item and
 * close the array + outer object.
 */
function tryRepairTruncatedJson(raw: string): string | null {
  if (typeof raw !== "string" || raw.length < 20) return null;
  // Find the last closing `}` that's followed by either `,` (mid-list item)
  // or a structural end. Walk backwards from a safe point.
  // Heuristic: find the last balanced `}` preceded by sufficient nesting.
  let depth = 0;
  let inString = false;
  let escape = false;
  let lastSafePos = -1;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      // Snapshot positions where we close an inner object inside an array.
      // Those are safe truncation points — we can lop off everything after.
      if (depth === 2) lastSafePos = i;
    }
  }
  if (lastSafePos < 0) return null;
  const head = raw.slice(0, lastSafePos + 1);
  // Append `]}` to close the array + outer object. Works for the common
  // shape `{ "title": "...", "questions": [ {...}, {...}, ` and similar.
  const candidate = head + "]}";
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    return null;
  }
}

export async function callAI(prompt: string, options: CallAIOptions = {}): Promise<any> {
  const { jsonMode = true, imageBase64, model, systemPrompt, maxTokens } = options;

  // Build payload with only DEFINED keys. Firebase Callable SDK serializes
  // explicit `undefined`/`null` values as `null` server-side — which then
  // bypasses the server's destructure default and fails type validation
  // with a misleading "systemPrompt too long" error. Skip the key entirely
  // so the server's default kicks in.
  const payload: Record<string, unknown> = { prompt, jsonMode };
  if (typeof systemPrompt === "string" && systemPrompt.length > 0) payload.systemPrompt = systemPrompt;
  if (typeof imageBase64 === "string" && imageBase64.length > 0) payload.imageBase64 = imageBase64;
  if (typeof model === "string" && model.length > 0) payload.model = model;
  if (typeof maxTokens === "number" && Number.isFinite(maxTokens)) payload.maxTokens = maxTokens;

  const result = await proxyFn(payload as Parameters<typeof proxyFn>[0]);
  const content = result.data?.content;

  if (!content) throw new Error("Empty AI response from server.");

  // Plain text or vision — return as-is
  if (!jsonMode || imageBase64) return content;

  // JSON mode — try direct parse, then strip markdown fences, then attempt
  // recovery if the response was truncated mid-token.
  try {
    return JSON.parse(content);
  } catch (firstErr) {
    const stripped = content.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    try {
      return JSON.parse(stripped);
    } catch {
      // Last-resort: truncation recovery. Lops off the broken trailing item
      // and closes the structure so downstream code gets the questions /
      // evaluations that DID come through cleanly.
      const repaired = tryRepairTruncatedJson(stripped);
      if (repaired != null) {
        console.warn("[callAI] AI response was truncated; recovered partial JSON via repair fallback");
        return JSON.parse(repaired);
      }
      throw firstErr;
    }
  }
}
