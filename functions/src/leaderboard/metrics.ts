// Per-student weekly metric derivation.
//
// We do NOT require a teacher-written `student_metrics` doc. Instead, the
// cron derives all four scores from the existing source-of-truth collections
// the rest of the parent dashboard already writes/reads:
//
//   - test_scores     → marksAvg + per-subject scores
//   - attendance      → attendancePct
//   - assignments + submissions → assignmentsPct (on-time submissions)
//   - parent_notes    → behaviorScore (heuristic from teacher remarks)
//
// One Firestore query per source per student is fine inside the per-class
// Promise.all batch (see cron.ts). Memory budget: a class of 50 students
// each holding ~1KB of scores is ~50KB — comfortable inside 512MB.

import * as admin from "firebase-admin";
import {
  WEIGHTS,
  DEFAULT_BEHAVIOR_SCORE,
  BEHAVIOR_DELTA_POSITIVE,
  BEHAVIOR_DELTA_NEGATIVE,
} from "./constants";
import { isoDatesInRange } from "./weekUtil";
import type {
  DerivedStudentSnapshot,
  ScoreBreakdown,
} from "./types";

const MS_PER_DAY = 86_400_000;
const MARKS_LOOKBACK_DAYS = 30; // smooth marks across the last month so a
                                // week with no tests doesn't tank the score

/**
 * Read a Firestore Timestamp / Date / number / undefined and normalise to
 * milliseconds. Returns 0 if unparseable — the caller decides what 0 means.
 */
function tsToMillis(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  return 0;
}

/**
 * Dual-key per-student fetch — runs TWO queries (by `studentId` AND by
 * `studentEmail`) in parallel and merges by doc id.
 *
 * Why this exists in the cron (not just on the client):
 * Per memory `dual_query_pattern_studentid_email`, teacher / principal write
 * paths don't always carry the canonical `studentId` — many docs are written
 * with only `studentEmail`. A single-key query on the cron silently misses
 * those docs, producing per-student snapshots with marks: 0, enrolledSubjects: 0,
 * etc. This was caught 2026-05-21 in the leaderboard cron logs: most students
 * had `enrolledSubjects: 0` even though they were enrolled in classes.
 *
 * Email side falls back to empty docs[] if the composite index isn't deployed
 * — keeps the studentId side working unconditionally.
 */
async function fetchPerStudentDual(
  collection: string,
  schoolId: string,
  studentId: string,
  studentEmail: string,
): Promise<admin.firestore.QueryDocumentSnapshot[]> {
  const db = admin.firestore();
  const queries: Array<Promise<admin.firestore.QuerySnapshot | { docs: admin.firestore.QueryDocumentSnapshot[] }>> = [
    db.collection(collection)
      .where("schoolId", "==", schoolId)
      .where("studentId", "==", studentId)
      .get(),
  ];
  if (studentEmail) {
    queries.push(
      db.collection(collection)
        .where("schoolId", "==", schoolId)
        .where("studentEmail", "==", studentEmail)
        .get()
        .catch(() => ({ docs: [] as admin.firestore.QueryDocumentSnapshot[] })),
    );
  }
  const snaps = await Promise.all(queries);
  const map = new Map<string, admin.firestore.QueryDocumentSnapshot>();
  for (const s of snaps) {
    for (const d of s.docs) map.set(d.id, d);
  }
  return Array.from(map.values());
}

/**
 * Try every field name the codebase has used for an assignment's due date.
 * Order matters: pick the first non-zero value. If a school migrated their
 * data they might have multiple variants on the same doc.
 */
function readDueDate(data: admin.firestore.DocumentData): number {
  return (
    tsToMillis(data.dueDate) ||
    tsToMillis(data.due_date) ||
    tsToMillis(data.deadline) ||
    tsToMillis(data.due) ||
    tsToMillis(data.dueOn) ||
    0
  );
}

/**
 * Detect sentiment from a parent_notes entry. Heuristic — keyword match on
 * the structured `category` field first, falling back to content keywords.
 * Conservative: returns 0 if neither positive nor negative tokens match,
 * so an ambiguous note doesn't move the score.
 */
function noteSentiment(category: string, content: string): -1 | 0 | 1 {
  const haystack = `${category.toLowerCase()} ${content.toLowerCase()}`;
  const POS = ["positive", "good", "praise", "excellent", "well done", "improvement", "appreciate"];
  const NEG = ["negative", "warning", "concern", "issue", "disturb", "disrupt", "incident"];
  if (POS.some((k) => haystack.includes(k))) return 1;
  if (NEG.some((k) => haystack.includes(k))) return -1;
  return 0;
}

/**
 * Infer a normalised subject key from a test_scores doc. Falls back to
 * "general" so the histogram has somewhere to put data without a label.
 */
function readSubject(data: admin.firestore.DocumentData): string {
  const raw = (data.subject || data.subjectName || "").toString().trim().toLowerCase();
  if (!raw) return "general";
  // Common name normalisations so "Maths"/"Mathematics"/"math" all bucket together.
  if (/^math/.test(raw)) return "mathematics";
  if (/^sci/.test(raw)) return "science";
  if (/^eng/.test(raw)) return "english";
  if (/^hindi/.test(raw)) return "hindi";
  if (/^social/.test(raw) || /^sst/.test(raw)) return "social";
  return raw;
}

/**
 * Compute the four-score breakdown + composite + per-subject map for one
 * student in one week. The class-wide pre-fetched assignment set is reused
 * across all students in the class — passing it in beats N redundant fetches.
 */
export async function deriveStudentSnapshot(
  studentDoc: admin.firestore.QueryDocumentSnapshot,
  classAssignmentDocs: admin.firestore.QueryDocumentSnapshot[],
  weekStart: number,
  weekEnd: number,
): Promise<DerivedStudentSnapshot> {
  const data = studentDoc.data();
  const studentId = studentDoc.id;
  const schoolId: string = data.schoolId;
  const classId: string = data.classId;
  const name: string = data.name || "Unknown";
  const enrolledAt =
    tsToMillis(data.enrolledAt) || tsToMillis(data.createdAt) || Date.now();
  // DUAL-KEY: read student's email so all per-student fetches can merge
  // by-id + by-email matches (memory: dual_query_pattern_studentid_email).
  const studentEmail: string = (data.email || data.studentEmail || "").toString().trim().toLowerCase();

  const db = admin.firestore();

  // ── 1. Marks (smoothed: last 30 days, not just this week) ────────────
  // Source-of-truth for "what subjects this student has" is the `enrollments`
  // collection — each enrollment doc represents one student-class-subject combo.
  // Parent ClassesPage renders 1 card per enrollment using exactly this source.
  // We seed `subjectScores` with EVERY enrolled subject (score = 0 until data
  // arrives) so the leaderboard subject grid covers ALL of the child's subjects,
  // not just ones with scores yet.
  //
  // Read BOTH test_scores AND gradebook_scores — they are co-canonical per
  // memory `owner_dashboard_alternate_data_sources`. Reading only one drops
  // ~40% of records and (worse) leaves entire subjects out of the leaderboard
  // breakdown when teachers use the gradebook column workflow.
  const lookbackStart = weekEnd - MARKS_LOOKBACK_DAYS * MS_PER_DAY;
  // ALL per-student reads use dual-key (id + email merge). Was previously
  // single-key which silently dropped any doc whose teacher writer used only
  // studentEmail. Logs 2026-05-21 showed most students with marks: 0 +
  // enrolledSubjects: 0 — root cause of "leaderboard missing breakdown".
  const [testScoresDocs, gradebookScoresDocs, enrollmentDocs] = await Promise.all([
    fetchPerStudentDual("test_scores", schoolId, studentId, studentEmail),
    fetchPerStudentDual("gradebook_scores", schoolId, studentId, studentEmail),
    fetchPerStudentDual("enrollments", schoolId, studentId, studentEmail),
  ]);

  // Per-collection time field is different (memory: bug_pattern_filterbytime_field_drift):
  //   test_scores      → timestamp (Firestore Timestamp)
  //   gradebook_scores → updatedAt (number ms)
  const recentTestScores = testScoresDocs.filter((d) => {
    const ts = tsToMillis(d.data().timestamp);
    return ts >= lookbackStart && ts <= weekEnd;
  });
  const recentGradebookScores = gradebookScoresDocs.filter((d) => {
    const v = d.data();
    const ts = tsToMillis(v.updatedAt) || tsToMillis(v.createdAt);
    return ts >= lookbackStart && ts <= weekEnd;
  });

  // Normalise each doc to a percentage. test_scores writes `percentage`,
  // gradebook_scores writes `mark` + `maxMarks` (memory: bug_pattern_score_field_singular_mark).
  type ScoreRow = { pct: number; subject: string };
  const rows: ScoreRow[] = [];
  for (const d of recentTestScores) {
    const v = d.data();
    const pct =
      typeof v.percentage === "number"
        ? v.percentage
        : typeof v.score === "number" && typeof v.maxScore === "number" && v.maxScore > 0
        ? (v.score / v.maxScore) * 100
        : null;
    if (pct === null) continue;
    rows.push({ pct, subject: readSubject(v) });
  }
  for (const d of recentGradebookScores) {
    const v = d.data();
    const pct =
      typeof v.percentage === "number"
        ? v.percentage
        : typeof v.mark === "number" && typeof v.maxMarks === "number" && v.maxMarks > 0
        ? (v.mark / v.maxMarks) * 100
        : typeof v.marks === "number" && typeof v.maxMarks === "number" && v.maxMarks > 0
        ? (v.marks / v.maxMarks) * 100
        : null;
    if (pct === null) continue;
    rows.push({ pct, subject: readSubject(v) });
  }

  const marksAvg = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.pct, 0) / rows.length)
    : 0;

  // H1 FIX: average per subject across all tests in the lookback window.
  // Previously the code did `subjectScores[subj] = pct` (last-write-wins),
  // which produced non-deterministic rankings when a student took the same
  // subject's test multiple times — Firestore returned docs in random order
  // so the displayed score depended on storage-layer arbitrary ordering.
  // Now also covers gradebook_scores so EVERY subject the teacher records
  // shows up in the breakdown, not just the ones with formal tests.
  const subjectAccumulator: Record<string, { sum: number; n: number }> = {};
  for (const r of rows) {
    if (!subjectAccumulator[r.subject]) subjectAccumulator[r.subject] = { sum: 0, n: 0 };
    subjectAccumulator[r.subject].sum += r.pct;
    subjectAccumulator[r.subject].n += 1;
  }
  const subjectScores: Record<string, number> = {};
  for (const [subj, { sum, n }] of Object.entries(subjectAccumulator)) {
    subjectScores[subj] = Math.round(sum / n);
  }

  // Seed every enrolled subject with 0 if not already present from scores.
  // This ensures the leaderboard subject grid covers ALL subjects the child
  // is enrolled in (matching ClassesPage), even when no score has been
  // recorded yet — so a parent looking at the breakdown sees the complete
  // picture instead of a half-filled list.
  for (const e of enrollmentDocs) {
    const v = e.data();
    const enrolledSubjectRaw = v.subject || v.subjectName || v.Subject || v.name || v.title || v.courseName || v.course || "";
    if (!enrolledSubjectRaw) continue;
    const subj = readSubject({ subject: enrolledSubjectRaw });
    if (!(subj in subjectScores)) subjectScores[subj] = 0;
  }

  // ── 2. Attendance (this week only) ───────────────────────────────────
  // Dual-key: fetch ALL attendance for this student (by id OR email) then
  // post-filter by date string in-memory. Combining `where("date","in",...)`
  // with the email side requires the same composite index — to avoid that
  // deploy step, post-filter instead.
  const dateStrings = isoDatesInRange(weekStart, weekEnd);
  const dateSet = new Set(dateStrings);
  const allAttendanceDocs = await fetchPerStudentDual("attendance", schoolId, studentId, studentEmail);
  const attendanceDocsThisWeek = allAttendanceDocs.filter((d) => {
    const dateStr = (d.data().date as string) || "";
    return dateSet.has(dateStr);
  });
  const totalDays = attendanceDocsThisWeek.length;
  const presentDays = attendanceDocsThisWeek.filter(
    (d) => d.data().status === "present",
  ).length;
  // No recorded school days → don't penalise (return 100). A genuinely
  // absent student still has docs marked "absent" so this only triggers
  // for holidays / closed schools.
  const attendancePct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

  // ── 3. Assignments on-time % (this week's due assignments) ───────────
  const dueThisWeek = classAssignmentDocs.filter((a) => {
    const due = readDueDate(a.data());
    return due >= weekStart && due <= weekEnd;
  });

  let assignmentsPct = 100; // default if nothing due
  if (dueThisWeek.length > 0) {
    // Dual-key: get all submissions for this student (id + email merged).
    const subsDocs = await fetchPerStudentDual("submissions", schoolId, studentId, studentEmail);
    const subsByAssignment = new Map<string, number>();
    for (const s of subsDocs) {
      const sd = s.data();
      const ts = tsToMillis(sd.submittedAt) || tsToMillis(sd.timestamp);
      if (!ts || ts < weekStart - MS_PER_DAY * 14) continue; // ignore very old subs
      const aid = sd.homeworkId || sd.assignmentId;
      if (aid && (!subsByAssignment.has(aid) || subsByAssignment.get(aid)! > ts)) {
        // Keep the EARLIEST submission per assignment.
        subsByAssignment.set(aid, ts);
      }
    }
    let onTime = 0;
    for (const a of dueThisWeek) {
      const due = readDueDate(a.data());
      const subTs = subsByAssignment.get(a.id);
      if (subTs !== undefined && subTs <= due) onTime++;
    }
    assignmentsPct = Math.round((onTime / dueThisWeek.length) * 100);
  }

  // ── 4. Behavior score (this week's teacher remarks) ──────────────────
  // Dual-key: parent_notes can be written with studentEmail only (legacy
  // teacher writes), so merge id + email matches.
  const noteDocs = await fetchPerStudentDual("parent_notes", schoolId, studentId, studentEmail);
  let behaviorScore = DEFAULT_BEHAVIOR_SCORE;
  for (const n of noteDocs) {
    const nd = n.data();
    if (nd.from !== "teacher") continue;
    const ts = tsToMillis(nd.createdAt);
    if (ts < weekStart || ts > weekEnd) continue;
    const sentiment = noteSentiment(nd.category || "", nd.content || "");
    if (sentiment === 1) behaviorScore += BEHAVIOR_DELTA_POSITIVE;
    else if (sentiment === -1) behaviorScore += BEHAVIOR_DELTA_NEGATIVE;
  }
  behaviorScore = Math.max(0, Math.min(100, behaviorScore));

  // ── 5. Composite score ──────────────────────────────────────────────
  const breakdown: ScoreBreakdown = {
    marks: marksAvg,
    attendance: attendancePct,
    assignments: assignmentsPct,
    behavior: behaviorScore,
  };
  const compositeScore =
    Math.round(
      (breakdown.marks * WEIGHTS.marks +
        breakdown.attendance * WEIGHTS.attendance +
        breakdown.assignments * WEIGHTS.assignments +
        breakdown.behavior * WEIGHTS.behavior) *
        100,
    ) / 100;

  // Diagnostic log — RAW counts of source data found per student. Lets us
  // tell apart "student has no data in source collections" from "cron's
  // queries are broken". A leaderboard full of 50.5 composites with all
  // diagnostic counts == 0 means no source data; same composite with
  // counts > 0 means a query bug. Read once, never log PII.
  console.log(JSON.stringify({
    event: "metrics.derived",
    studentId,
    schoolId,
    classId,
    weekStart,
    weekEnd,
    counts: {
      testScoresLookback: recentTestScores.length,
      gradebookScoresLookback: recentGradebookScores.length,
      testScoresAll: testScoresDocs.length,
      gradebookScoresAll: gradebookScoresDocs.length,
      enrolledSubjects: enrollmentDocs.length,
      attendanceAll: allAttendanceDocs.length,
      attendanceWeek: totalDays,
      assignmentsDueThisWeek: dueThisWeek.length,
      teacherNotesAll: noteDocs.length,
      hasEmail: !!studentEmail,
    },
    breakdown,
    compositeScore,
    subjectCount: Object.keys(subjectScores).length,
  }));

  return {
    studentId,
    name,
    classId,
    schoolId,
    enrolledAt,
    breakdown,
    compositeScore,
    subjectScores,
  };
}

/**
 * Average each subject across a list of student snapshots, used for the
 * `classAverages` field on the per-subject metrics doc.
 */
export function aggregateSubjectAverages(
  snapshots: DerivedStudentSnapshot[],
): Record<string, number> {
  const sums: Record<string, { total: number; n: number }> = {};
  for (const s of snapshots) {
    for (const [subj, score] of Object.entries(s.subjectScores)) {
      if (!sums[subj]) sums[subj] = { total: 0, n: 0 };
      sums[subj].total += score;
      sums[subj].n += 1;
    }
  }
  const out: Record<string, number> = {};
  for (const [subj, { total, n }] of Object.entries(sums)) {
    out[subj] = n > 0 ? Math.round(total / n) : 0;
  }
  return out;
}
