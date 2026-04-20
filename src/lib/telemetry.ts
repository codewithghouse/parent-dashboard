/**
 * Telemetry scaffold — framework-agnostic.
 *
 * ErrorBoundary and other crash paths call `reportUncaught(err, info)`. At
 * runtime this either forwards to a configured backend (Sentry, Firebase
 * Crashlytics, a custom endpoint) or no-ops in development.
 *
 * To wire a backend, set one of the supported env vars at build time and add
 * the SDK's initialisation in `main.tsx`. Keeping the backend selection here
 * (rather than hard-coding Sentry everywhere) means we can swap providers
 * without touching every catch block.
 *
 * Supported env vars (Vite-prefixed):
 *   VITE_SENTRY_DSN          — if set, you should init @sentry/react in main.tsx
 *   VITE_TELEMETRY_ENDPOINT  — optional POST endpoint for custom collection
 *
 * NEVER include PII (email, name, parent names) in what you pass here. Only
 * schoolId, role, and the error itself.
 */

import type { ErrorInfo } from "react";

interface ReportContext {
  /** Free-form tag so we can filter by call site (e.g. "ErrorBoundary", "syncClaims"). */
  source?: string;
  /** Non-PII user metadata. schoolId is OK; email / name are NOT. */
  user?: { schoolId?: string; role?: string };
  /** Arbitrary non-sensitive metadata (route, feature flag, etc.). */
  extra?: Record<string, unknown>;
}

type Reporter = (err: unknown, ctx?: ReportContext | ErrorInfo) => void;

let backend: Reporter | null = null;

/** Called once from main.tsx after backend init (if any). */
export function registerTelemetryBackend(fn: Reporter): void {
  backend = fn;
}

export function reportUncaught(err: unknown, ctx?: ReportContext | ErrorInfo): void {
  // Always log locally so the browser console still has the signal in dev.
  console.error("[telemetry]", err, ctx);
  if (!backend) return;
  try {
    backend(err, ctx);
  } catch {
    // A broken reporter must never take down the caller — swallow and move on.
  }
}

/**
 * Install the global window hook that ErrorBoundary looks for. This keeps the
 * ErrorBoundary component free of any specific telemetry SDK dependency.
 */
export function installGlobalErrorHook(): void {
  if (typeof window === "undefined") return;
  (window as unknown as { __reportUncaught?: Reporter }).__reportUncaught = reportUncaught;
}