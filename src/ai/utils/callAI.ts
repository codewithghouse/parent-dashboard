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

  const result = await proxyFn({ prompt, systemPrompt, jsonMode, imageBase64, model });
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
