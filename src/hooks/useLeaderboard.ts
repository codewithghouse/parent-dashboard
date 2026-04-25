// useLeaderboard — fetches the most recent class leaderboard for the
// signed-in parent's child. Uses a subcollection list query ordered by
// document id (== weekId) descending with limit 1, so we always show the
// freshest snapshot the cron has written, regardless of whether the
// current ISO week's run has happened yet.
//
// Wrapped in react-query (already configured app-wide in App.tsx) so we
// get caching, dedup across pages, and automatic refetch on window-focus.

import { useQuery } from '@tanstack/react-query';
import {
  collection,
  query,
  orderBy,
  limit,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import type { LeaderboardDoc } from '@/lib/leaderboardTypes';

/** What the leaderboard page actually consumes. */
export interface UseLeaderboardResult {
  data: LeaderboardDoc | null;
  loading: boolean;
  error: Error | null;
  /** True when auth/profile is ready but there's no leaderboard doc yet. */
  notReady: boolean;
  refetch: () => Promise<void>;
}

async function fetchLatestLeaderboard(
  schoolId: string,
  classId: string,
): Promise<LeaderboardDoc | null> {
  // Path: /leaderboards/{schoolId}_{classId}/weeks/{weekId}
  //
  // The Firestore rule for this subcollection's `list` is `inSameSchool()`,
  // which evaluates `resource.data.schoolId == claimSchoolId()`. Per
  // Firestore's rules-consistency requirement ("rules are not filters"),
  // any list query whose rule references a field MUST also `.where()` on
  // that field — otherwise the query is rejected upfront with
  // permission-denied, regardless of actual document contents. So the
  // `where('schoolId', ...)` below is logically redundant (every doc in
  // this subcollection has the same schoolId by construction) but
  // load-bearing for rules-consistency.
  //
  // Doc IDs are weekIds like "2026-W17"; lexicographic desc == chronological
  // desc because we always pad the week number to 2 digits.
  const weeksRef = collection(db, `leaderboards/${schoolId}_${classId}/weeks`);
  const q = query(
    weeksRef,
    where('schoolId', '==', schoolId),
    orderBy('__name__', 'desc'),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as LeaderboardDoc;
}

export function useLeaderboard(): UseLeaderboardResult {
  const { studentData, loading: authLoading } = useAuth();
  const schoolId: string | undefined = studentData?.schoolId;
  const classId: string | undefined = studentData?.classId;

  const enabled = Boolean(schoolId && classId);

  const q = useQuery<LeaderboardDoc | null, Error>({
    queryKey: ['leaderboard', schoolId, classId],
    queryFn: () => fetchLatestLeaderboard(schoolId!, classId!),
    enabled,
  });

  return {
    data: q.data ?? null,
    loading: authLoading || (enabled && q.isLoading),
    error: q.error ?? null,
    notReady: enabled && !q.isLoading && q.data === null && !q.error,
    refetch: async () => {
      await q.refetch();
    },
  };
}
