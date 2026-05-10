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
}

// Singleton callable — created once, reused across all calls
const proxyFn = httpsCallable<
  { prompt: string; systemPrompt?: string; jsonMode?: boolean; imageBase64?: string; model?: string },
  { content: string }
>(functions, "parentAIProxy", { timeout: 60000 });

export async function callAI(prompt: string, options: CallAIOptions = {}): Promise<any> {
  const { jsonMode = true, imageBase64, model, systemPrompt } = options;

  // Build payload with only DEFINED keys. Firebase Callable SDK serializes
  // explicit `undefined`/`null` values as `null` server-side — which then
  // bypasses the server's destructure default and fails type validation
  // with a misleading "systemPrompt too long" error. Skip the key entirely
  // so the server's default kicks in.
  const payload: Record<string, unknown> = { prompt, jsonMode };
  if (typeof systemPrompt === "string" && systemPrompt.length > 0) payload.systemPrompt = systemPrompt;
  if (typeof imageBase64 === "string" && imageBase64.length > 0) payload.imageBase64 = imageBase64;
  if (typeof model === "string" && model.length > 0) payload.model = model;

  const result = await proxyFn(payload as Parameters<typeof proxyFn>[0]);
  const content = result.data?.content;

  if (!content) throw new Error("Empty AI response from server.");

  // Plain text or vision — return as-is
  if (!jsonMode || imageBase64) return content;

  // JSON mode — parse with markdown-fence fallback
  try {
    return JSON.parse(content);
  } catch {
    const stripped = content.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(stripped);
  }
}
