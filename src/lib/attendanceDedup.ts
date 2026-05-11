/**
 * Attendance dedup helper — one canonical record per (student, day).
 *
 * THE LOOPHOLE THIS SOLVES
 * ────────────────────────
 * `MarkAttendance.tsx` writes attendance docs with composite doc-id
 * `${studentId}_${classId}_${date}`. Any teacher with a class that
 * includes the student can mark — so subject teachers + the class
 * teacher may each create a record for the same day. The result:
 *
 *   teacherA_classMath_2024-11-15  → status: "present"
 *   teacherB_classScience_2024-11-15 → status: "absent"   (different teacher
 *                                                          marked separately)
 *
 * Both surface as separate attendance docs. Counting them as separate
 * days double-counts presence and skews the daily percentage.
 *
 * Indian schools (the product's market): the CLASS TEACHER takes the
 * day's roll call ONCE in the morning. That's the day's attendance.
 * Subject teachers seeing the student in class shouldn't create
 * separate per-period records — but the writer doesn't enforce that
 * today.
 *
 * Until the writer is hardened (Phase 2 — gate marking to class teacher
 * only via classes.classTeacherId + Firestore rule), every reader MUST
 * dedup by `(date)` to present one honest record per student per day.
 *
 * Conflict resolution: latest `createdAt` wins. Defensible because
 * - the latest edit is closest to ground truth (corrections happen)
 * - simple, deterministic, no special-case "absent wins" or "present
 *   wins" rules that could surprise a parent or a principal
 *
 * USAGE
 * ─────
 *   const deduped = dedupAttendanceByDay(rawLogs);
 *   // ↑ same shape as input array, but one record per `date`
 *
 * Apply at every attendance READ site in parent-dashboard. The shape
 * is duck-typed so different RawAttendance interfaces across pages
 * work without rewiring imports.
 */

interface AttendanceLike {
  id?: string;
  date?: string;
  status?: string;
  createdAt?: { toMillis?: () => number; seconds?: number } | string | number | null;
  // Allow other fields — we don't read them but the caller might.
  [k: string]: unknown;
}

const tsMs = (v: AttendanceLike["createdAt"]): number => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return isNaN(t) ? 0 : t;
  }
  if (typeof v === "object") {
    if (typeof v.toMillis === "function") return v.toMillis();
    if (typeof v.seconds === "number") return v.seconds * 1000;
  }
  return 0;
};

export function dedupAttendanceByDay<T extends AttendanceLike>(logs: T[]): T[] {
  if (logs.length < 2) return logs.slice();
  const byDay = new Map<string, T>();
  logs.forEach((l) => {
    if (!l.date) return;          // skip malformed entries — surfaces upstream
    const existing = byDay.get(l.date);
    if (!existing) {
      byDay.set(l.date, l);
      return;
    }
    // Latest createdAt wins. Falls back to keeping the existing record
    // when neither has a timestamp.
    const existingMs = tsMs(existing.createdAt);
    const newMs = tsMs(l.createdAt);
    if (newMs > existingMs) byDay.set(l.date, l);
  });
  return Array.from(byDay.values());
}

/**
 * Convenience: dedup + sort by date desc (most common read pattern).
 * Returns a NEW array — does not mutate input.
 */
export function dedupAndSortAttendance<T extends AttendanceLike>(logs: T[]): T[] {
  return dedupAttendanceByDay(logs).sort((a, b) =>
    (b.date || "").localeCompare(a.date || ""),
  );
}
