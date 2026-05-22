/**
 * Registers the Edullent service worker.
 * Dispatches custom events:
 *   'sw-update-available' — a new SW version is waiting
 *   'sw-registered'       — SW registered successfully
 *
 * Registered in PRODUCTION ONLY. In development the SW aggressively cached the
 * app shell (`index.html`) which made Vite HMR updates + CSP/code changes
 * invisible until the SW was manually unregistered. We now skip registration
 * in dev AND proactively unregister any previously installed worker so a
 * stale dev SW from an earlier run can't keep serving an old `index.html`.
 */
export function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  // Dev mode: tear down any existing SW + caches so Vite serves fresh files.
  // If we actually find a stale SW, force a one-time reload so the user lands
  // on the page with the fresh (uncached) HTML in a single visit instead of
  // having to manually refresh twice.
  if (import.meta.env.DEV) {
    const RELOAD_FLAG = '__edu_sw_reloaded';
    (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        const hadAnySW = regs.length > 0;

        await Promise.all(regs.map(r => r.unregister().catch(() => false)));

        if ('caches' in self) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k).catch(() => false)));
        }

        // Auto-reload only the first time — guarded by sessionStorage so we
        // don't loop if anything goes wrong with the reload itself.
        if (hadAnySW && !sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, '1');
          window.location.reload();
        }
      } catch {
        /* ignore — dev cleanup is best-effort */
      }
    })();
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      window.dispatchEvent(new CustomEvent('sw-registered', { detail: reg }));

      // Check for waiting worker (update available on page load)
      if (reg.waiting && navigator.serviceWorker.controller) {
        window.dispatchEvent(new CustomEvent('sw-update-available', { detail: reg }));
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('sw-update-available', { detail: reg }));
          }
        });
      });
    } catch (err) {
      console.error('[SW] Registration failed:', err);
    }
  });
}

/**
 * Tell the waiting SW to take over immediately, then reload.
 *
 * Robustness:
 * 1. Always wire the controllerchange→reload handler BEFORE messaging the SW
 *    (avoids missing the event if activation is fast).
 * 2. If `reg.waiting` is null (e.g. the new SW already auto-activated by the
 *    time the user clicks Reload), just reload immediately — that was the bug
 *    where the button silently did nothing.
 * 3. 3-second safety timeout: if controllerchange never fires (some browsers/
 *    edge cases skip it), force-reload anyway so the user is never stuck.
 */
export function applyUpdate(reg: ServiceWorkerRegistration) {
  let reloaded = false;
  const reload = () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  };

  // Wire the handler first
  navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });

  if (reg.waiting) {
    try {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch (err) {
      console.warn('[SW] postMessage failed, reloading anyway:', err);
      reload();
      return;
    }
    // Safety net: if controllerchange doesn't fire within 3s, reload anyway.
    setTimeout(reload, 3000);
  } else {
    // No waiting worker — the update was already activated. Just reload.
    reload();
  }
}