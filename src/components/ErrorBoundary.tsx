import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface State { hasError: boolean; error?: Error }

/**
 * ErrorBoundary — catches unexpected JS errors inside any page component.
 *
 * Without this, a single runtime error (e.g. .map() on undefined from a bad
 * Firestore payload) crashes the entire app to a blank white screen with no
 * recovery path. This gives parents a friendly error + reload button.
 *
 * Usage in App.tsx:
 *   <Route element={<ErrorBoundary><SomePage /></ErrorBoundary>} />
 *
 * OR wrap the entire ParentLayout outlet:
 *   <ErrorBoundary><Outlet /></ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // TELEMETRY GAP — production errors only surface to the browser console
    // today. 400 schools × thousands of parents means we are blind to crashes
    // until a user emails support. Wire Sentry / Firebase Crashlytics here
    // before the next major rollout; capturing the error + componentStack +
    // the current user's schoolId (without PII) is enough to diagnose most
    // regressions. Avoid capturing raw studentData — it's PII.
    console.error("[ErrorBoundary]", error, info.componentStack);
    // Best-effort: forward to a global hook if the host app wired one up.
    // This lets us inject Sentry from App.tsx without editing this file
    // whenever we change telemetry backends.
    try {
      const sink = (window as unknown as { __reportUncaught?: (e: Error, ci: React.ErrorInfo) => void }).__reportUncaught;
      if (typeof sink === "function") sink(error, info);
    } catch {
      // A broken reporter must never take down the fallback UI.
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 p-6 animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center shadow-sm">
          <AlertCircle className="w-8 h-8 text-rose-400" />
        </div>
        <div className="text-center max-w-xs">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Something went wrong</h2>
          <p className="text-sm text-slate-500 mb-5 leading-relaxed">
            This page ran into an unexpected issue. Your data is safe — nothing was lost.
          </p>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
        {import.meta.env.DEV && this.state.error && (
          <pre className="text-[10px] text-rose-400 bg-rose-50 rounded-xl p-3 max-w-sm overflow-auto">
            {this.state.error.message}
          </pre>
        )}
      </div>
    );
  }
}
