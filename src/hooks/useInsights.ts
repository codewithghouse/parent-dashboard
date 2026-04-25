// useInsights — real-time onSnapshot subscription on the most recent
// student_insights doc for the signed-in parent's child.
//
// Why we don't list-then-subscribe (the obvious design):
//   The Phase-3 Firestore rule for /student_insights/.../weeks/* gates
//   `list` to staff only. Parents have `get` permission only. So a list
//   query (orderBy doc id desc, limit 1) returns permission-denied for
//   every parent — which would render the leaderboard insights page as
//   broken even though the data is there.
//
// Approach: compute the candidate weekId on the client (matches what the
// cron writes), `getDoc()` directly, and if missing fall back to the
// week before that. Subscribe via onSnapshot to the resolved doc so
// daily action-progress updates flow live.
//
// Re-resolves every 60s in case a newer week's insights become available
// while the page is open (e.g., Monday-morning cron just wrote them).

import { useEffect, useState, useRef } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { getCurrentWeekId, getPreviousWeekId } from '@/lib/week';
import type { InsightsDoc } from '@/lib/leaderboardTypes';

export interface UseInsightsResult {
  data: InsightsDoc | null;
  loading: boolean;
  error: Error | null;
  notReady: boolean;
}

const REPOLL_LATEST_MS = 60_000;
// How many weeks back we'll probe before giving up. The cron writes to
// `getPreviousWeekId(now)`, so on a normal Monday-after-cron the doc lives
// at that ID. We probe up to 4 weeks back to absorb a missed cron run or
// a brand-new student whose first insights are a few weeks old.
const MAX_WEEKS_BACK = 4;

const MS_PER_DAY = 86_400_000;

/**
 * Walk back from this week probing for an existing insights doc. Returns
 * the resolved weekId (and verifies access via getDoc). Falls through to
 * null only if NO doc exists in the last MAX_WEEKS_BACK weeks.
 *
 * Each probe is a single getDoc — costs at most MAX_WEEKS_BACK reads on
 * a brand-new student, just 1 read on the common path.
 */
async function findExistingInsightsWeekId(studentId: string): Promise<string | null> {
  let probeDate = new Date();
  // Try this week first, then walk back week by week.
  const candidates: string[] = [getCurrentWeekId(probeDate)];
  for (let i = 0; i < MAX_WEEKS_BACK; i++) {
    probeDate = new Date(probeDate.getTime() - 7 * MS_PER_DAY);
    candidates.push(getCurrentWeekId(probeDate));
  }
  // Deduplicate (current week may equal previous-week-of-tomorrow on edge cases).
  const seen = new Set<string>();
  for (const wid of candidates) {
    if (seen.has(wid)) continue;
    seen.add(wid);
    const ref = doc(db, `student_insights/${studentId}/weeks/${wid}`);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) return wid;
    } catch (err) {
      // permission-denied at this path is unexpected (rule allows
      // isParentOf(studentId) for get) — surface to caller via throw.
      throw err;
    }
  }
  return null;
}

export function useInsights(): UseInsightsResult {
  const { studentData, loading: authLoading } = useAuth();
  const studentId: string | undefined = studentData?.id;

  const [weekId, setWeekId] = useState<string | null>(null);
  const [data, setData] = useState<InsightsDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Lets us cancel a stale onSnapshot when the latest weekId rolls forward.
  const unsubRef = useRef<(() => void) | null>(null);
  // Track whether we've shown data so transient repoll failures don't blank
  // the UI — see comment in the resolve loop below.
  const hasDataRef = useRef(false);
  hasDataRef.current = data !== null;

  // First resolve + 60s repoll loop. Deps: only studentId so the interval
  // lives across snapshot updates as intended.
  useEffect(() => {
    if (!studentId) return;

    const resolveLatestWeek = async () => {
      try {
        const latest = await findExistingInsightsWeekId(studentId);
        setWeekId((current) => (current === latest ? current : latest));
      } catch (err) {
        // Suppress transient poll failures once we already have data —
        // existing snapshot keeps the UI alive.
        if (!hasDataRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    };

    resolveLatestWeek();
    const interval = setInterval(resolveLatestWeek, REPOLL_LATEST_MS);
    return () => clearInterval(interval);
  }, [studentId]);

  // Live-subscribe to the resolved doc.
  useEffect(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (!studentId || !weekId) {
      // No weekId resolved yet — could be loading, or no doc exists.
      // Caller distinguishes via `loading` vs `notReady`.
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = doc(db, `student_insights/${studentId}/weeks/${weekId}`);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setData(snap.data() as InsightsDoc);
          setError(null);
        } else {
          // Doc disappeared — admin delete or weekId race. Fall back to
          // "not ready" so the page shows the friendly "preparing" card.
          setData(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      },
    );
    unsubRef.current = unsub;
    return () => {
      unsub();
      unsubRef.current = null;
    };
  }, [studentId, weekId]);

  const enabled = Boolean(studentId);
  return {
    data,
    loading: authLoading || (enabled && loading),
    error,
    notReady: enabled && !loading && data === null && !error,
  };
}
