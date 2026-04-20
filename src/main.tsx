import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "./registerSW";
import { installGlobalErrorHook } from "./lib/telemetry";

// Install the window.__reportUncaught hook BEFORE first render so the
// ErrorBoundary has something to forward to if it catches a bootstrap crash.
// A specific backend (Sentry / Firebase Crashlytics) should be registered
// via `registerTelemetryBackend(...)` here once configured.
installGlobalErrorHook();

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker in all environments for offline + native PWA support
registerSW();
