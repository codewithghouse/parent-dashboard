/**
 * syncClaims.ts
 * Calls the `syncUserClaims` Cloud Function to populate Firebase custom claims
 * ({ schoolId, role, branchId }) on the user's ID token, then force-refreshes
 * the token so Firestore security rules see the new claims.
 *
 * Call this immediately after onAuthStateChanged fires with a valid user,
 * BEFORE running any tenant-scoped Firestore queries.
 */
import { getFunctions, httpsCallable } from "firebase/functions";
import type { User } from "firebase/auth";

const FUNCTIONS_REGION = "us-central1"; // Same region as deployed functions

/**
 * Thrown when the claim-sync call fails with a transient/unknown error. The
 * caller can retry. Distinct from a successful call that returns
 * `{ schoolId: null }` — which means the user genuinely isn't enrolled and
 * should NOT be retried.
 */
export class SyncClaimsTransientError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "SyncClaimsTransientError";
  }
}

async function callSyncOnce(user: User): Promise<{
  role: string;
  schoolId: string | null;
  branchId?: string | null;
} | null> {
  const fns = getFunctions(undefined, FUNCTIONS_REGION);
  const call = httpsCallable<unknown, { role: string; schoolId: string; branchId?: string }>(
    fns,
    "syncUserClaims",
  );
  const res = await call({});
  // Force-refresh the ID token so the new custom claims take effect immediately.
  await user.getIdToken(true);
  return res.data ?? null;
}

/**
 * Sync the user's custom claims, retrying up to `maxAttempts` times with
 * exponential backoff on transient failures. If every attempt fails, the
 * final error is thrown as a `SyncClaimsTransientError` so the caller can
 * distinguish this from a legitimate "no schoolId" result.
 */
export async function syncClaimsAndRefreshToken(
  user: User,
  maxAttempts = 3,
): Promise<{
  role: string;
  schoolId: string | null;
  branchId?: string | null;
} | null> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await callSyncOnce(user);
    } catch (err: any) {
      lastErr = err;
      const transient =
        err?.code === "functions/unavailable" ||
        err?.code === "functions/deadline-exceeded" ||
        err?.code === "functions/internal" ||
        err?.message?.toLowerCase?.().includes("network") ||
        err?.message?.toLowerCase?.().includes("timeout");
      console.warn(
        `[syncClaims] attempt ${attempt}/${maxAttempts} failed:`,
        err?.code || err?.message || err,
      );
      if (!transient || attempt === maxAttempts) break;
      // Exponential backoff: 300ms, 900ms, ...
      await new Promise((r) => setTimeout(r, 300 * Math.pow(3, attempt - 1)));
    }
  }
  throw new SyncClaimsTransientError(
    "Failed to sync custom claims after retries",
    lastErr,
  );
}