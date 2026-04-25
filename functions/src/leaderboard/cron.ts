// Weekly leaderboard cron orchestrator.
//
// Iterates every (schoolId, classId) tuple, derives per-student metrics
// from source collections (see metrics.ts), ranks them (ranking.ts), and
// writes 4 things per class:
//
//   1. leaderboards/{schoolId}_{classId}/weeks/{weekId}            (1 doc)
//   2. student_metrics/{studentId}/weeks/{weekId}                  (N docs)
//   3. student_subject_metrics/{studentId}/weeks/{weekId}          (N docs)
//   4. student_rank_history/{studentId}                            (N upserts)
//
// All writes use Admin SDK so they bypass firestore.rules. Per-class
// failures are isolated — one bad class does not block the rest.

import * as admin from "firebase-admin";
import { RANK_HISTORY_MAX_WEEKS } from "./constants";
import {
  getCurrentWeekId,
  getPreviousWeekId,
  weekIdToRange,
} from "./weekUtil";
import { deriveStudentSnapshot, aggregateSubjectAverages } from "./metrics";
import { buildRanking, updateRankHistory } from "./ranking";
import type {
  DerivedStudentSnapshot,
  LeaderboardDoc,
  RankHistoryDoc,
  StudentMetricsDoc,
  SubjectMetricsDoc,
} from "./types";

interface ClassResult {
  schoolId: string;
  classId: string;
  weekId: string;
  studentCount: number;
  classAverage: number;
  durationMs: number;
}

/**
 * Discover every distinct (schoolId, classId) pair from the students
 * collection. We could read from `classes` instead, but enrollment is the
 * source of truth for "is this class active this term".
 */
async function listActiveClasses(): Promise<{ schoolId: string; classId: string }[]> {
  const db = admin.firestore();
  // Collection-group-style scan: one query, group in memory. Students
  // collection has indexes on (schoolId, classId) so this is cheap.
  const snap = await db.collection("students").select("schoolId", "classId").get();
  const seen = new Set<string>();
  const out: { schoolId: string; classId: string }[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    const schoolId: string | undefined = data.schoolId;
    const classId: string | undefined = data.classId;
    if (!schoolId || !classId) continue;
    const key = `${schoolId}__${classId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ schoolId, classId });
  }
  return out;
}

/**
 * Read the previous-week ranking document so we can compute rank deltas
 * (trend up/down) and feed the tie-break "previous rank" field.
 */
async function fetchPreviousRanks(
  schoolId: string,
  classId: string,
  previousWeekId: string,
): Promise<Map<string, number>> {
  const db = admin.firestore();
  const docRef = db.doc(
    `leaderboards/${schoolId}_${classId}/weeks/${previousWeekId}`,
  );
  const snap = await docRef.get();
  const out = new Map<string, number>();
  if (!snap.exists) return out;
  const data = snap.data() as LeaderboardDoc | undefined;
  if (!data?.rankings) return out;
  for (const r of data.rankings) {
    out.set(r.studentId, r.rank);
  }
  return out;
}

/**
 * Process one class end-to-end. Public so the manual trigger can call it.
 */
export async function processClass(
  schoolId: string,
  classId: string,
  weekId: string,
): Promise<ClassResult> {
  const startTs = Date.now();
  const db = admin.firestore();
  const { start: weekStart, end: weekEnd } = weekIdToRange(weekId);

  // 1. Pull all students in this class — source of truth for membership.
  const studentsSnap = await db
    .collection("students")
    .where("schoolId", "==", schoolId)
    .where("classId", "==", classId)
    .get();

  if (studentsSnap.empty) {
    console.log(JSON.stringify({
      event: "leaderboard.skip_empty_class",
      schoolId, classId, weekId,
    }));
    return { schoolId, classId, weekId, studentCount: 0, classAverage: 0, durationMs: 0 };
  }

  // 2. Pre-fetch the class's full assignment list once — reused by every
  //    per-student snapshot, beating N redundant fetches.
  const assignmentsSnap = await db
    .collection("assignments")
    .where("schoolId", "==", schoolId)
    .where("classId", "==", classId)
    .get();

  // 3. Derive snapshots in parallel. Capped at students.length but in
  //    practice that's <= 60 per class, well within Firestore quotas.
  const snapshots: DerivedStudentSnapshot[] = await Promise.all(
    studentsSnap.docs.map((s) =>
      deriveStudentSnapshot(s, assignmentsSnap.docs, weekStart, weekEnd),
    ),
  );

  // 4. Look up last week's ranks for trend deltas + tie-breaks.
  const previousRanks = await fetchPreviousRanks(
    schoolId,
    classId,
    getPreviousWeekId(new Date(weekStart + 1)),
  );

  // 5. Build the ordered ranking + class average.
  const rankings = buildRanking(snapshots, previousRanks);
  const classAverage =
    rankings.length === 0
      ? 0
      : Math.round(
          (rankings.reduce((sum, r) => sum + r.compositeScore, 0) / rankings.length) *
            100,
        ) / 100;

  // 6. Write everything in one batched commit per class. Firestore caps
  //    batches at 500 ops; for ~60 students we write ~4 docs each = 240
  //    ops, comfortable. Larger classes would need multi-batch chunking.
  const now = Date.now();
  const generatedAt = now;
  const subjectClassAvgs = aggregateSubjectAverages(snapshots);

  const leaderboardDoc: LeaderboardDoc = {
    classId,
    schoolId,
    weekId,
    weekStart,
    weekEnd,
    totalStudents: rankings.length,
    classAverage,
    rankings,
    generatedAt,
  };

  const batch = db.batch();
  batch.set(
    db.doc(`leaderboards/${schoolId}_${classId}/weeks/${weekId}`),
    leaderboardDoc,
  );

  for (const snap of snapshots) {
    const metricsDoc: StudentMetricsDoc = {
      studentId: snap.studentId,
      schoolId: snap.schoolId,
      classId: snap.classId,
      weekId,
      marksAvg: snap.breakdown.marks,
      attendancePct: snap.breakdown.attendance,
      assignmentsPct: snap.breakdown.assignments,
      behaviorScore: snap.breakdown.behavior,
      compositeScore: snap.compositeScore,
      weekStart,
      weekEnd,
      updatedAt: now,
    };
    batch.set(
      db.doc(`student_metrics/${snap.studentId}/weeks/${weekId}`),
      metricsDoc,
    );

    const subjectDoc: SubjectMetricsDoc = {
      studentId: snap.studentId,
      schoolId: snap.schoolId,
      weekId,
      subjects: snap.subjectScores,
      classAverages: subjectClassAvgs,
      updatedAt: now,
    };
    batch.set(
      db.doc(`student_subject_metrics/${snap.studentId}/weeks/${weekId}`),
      subjectDoc,
    );
  }

  // Rank-history upsert — read-then-write per student. Cannot be batched
  // with the metrics writes because we need the existing doc to merge.
  // Fire in parallel.
  await Promise.all(
    rankings.map(async (r) => {
      const ref = db.doc(`student_rank_history/${r.studentId}`);
      const existing = await ref.get();
      const existingDoc = existing.exists ? (existing.data() as RankHistoryDoc) : null;
      const weeks = updateRankHistory(
        existingDoc,
        weekId,
        r.rank,
        r.compositeScore,
        RANK_HISTORY_MAX_WEEKS,
      );
      const next: RankHistoryDoc = {
        studentId: r.studentId,
        schoolId,
        weeks,
        updatedAt: now,
      };
      await ref.set(next);
    }),
  );

  await batch.commit();

  const durationMs = Date.now() - startTs;
  console.log(JSON.stringify({
    event: "leaderboard.class_processed",
    schoolId, classId, weekId,
    studentCount: rankings.length,
    classAverage,
    durationMs,
  }));

  return { schoolId, classId, weekId, studentCount: rankings.length, classAverage, durationMs };
}

/**
 * Cron entry point. Runs every (schoolId, classId), isolating failures.
 */
export async function runLeaderboardCron(): Promise<void> {
  const startedAt = Date.now();
  // ⚠️ TEMPORARY for testing — process the CURRENT ISO week so any data
  //    added today shows up in the leaderboard within ~15 min.
  //    REVERT to getPreviousWeekId() before going to production (the cron
  //    fires Mon 02:00 IST and SHOULD roll up the week that just ended).
  const weekId = getCurrentWeekId();

  const classes = await listActiveClasses();
  console.log(JSON.stringify({
    event: "leaderboard.cron_start",
    weekId, classCount: classes.length,
  }));

  let succeeded = 0;
  let failed = 0;
  for (const { schoolId, classId } of classes) {
    try {
      await processClass(schoolId, classId, weekId);
      succeeded++;
    } catch (err: any) {
      // Do NOT rethrow — one bad class must not block the rest.
      failed++;
      console.error(JSON.stringify({
        event: "leaderboard.class_failed",
        schoolId, classId, weekId,
        message: err?.message || String(err),
      }));
    }
  }

  console.log(JSON.stringify({
    event: "leaderboard.cron_done",
    weekId, succeeded, failed,
    durationMs: Date.now() - startedAt,
  }));
}
