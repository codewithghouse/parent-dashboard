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

  const db = admin.firestore();

  // ── 1. Marks (smoothed: last 30 days, not just this week) ────────────
  const lookbackStart = weekEnd - MARKS_LOOKBACK_DAYS * MS_PER_DAY;
  const testScoresSnap = await db
    .collection("test_scores")
    .where("schoolId", "==", schoolId)
    .where("studentId", "==", studentId)
    .get();
  const recentScores = testScoresSnap.docs.filter((d) => {
    const ts = tsToMillis(d.data().timestamp);
    return ts >= lookbackStart && ts <= weekEnd;
  });
  const marksAvg = recentScores.length
    ? Math.round(
        recentScores.reduce((sum, d) => {
          const v = d.data();
          // Prefer percentage; fall back to score/maxScore if percentage is missing.
          const pct =
            typeof v.percentage === "number"
              ? v.percentage
              : typeof v.score === "number" && typeof v.maxScore === "number" && v.maxScore > 0
              ? (v.score / v.maxScore) * 100
              : 0;
          return sum + pct;
        }, 0) / recentScores.length,
      )
    : 0;

  // H1 FIX: average per subject across all tests in the lookback window.
  // Previously the code did `subjectScores[subj] = pct` (last-write-wins),
  // which produced non-deterministic rankings when a student took the same
  // subject's test multiple times — Firestore returned docs in random order
  // so the displayed score depended on storage-layer arbitrary ordering.
  const subjectAccumulator: Record<string, { sum: number; n: number }> = {};
  for (const d of recentScores) {
    const v = d.data();
    const subj = readSubject(v);
    const pct =
      typeof v.percentage === "number"
        ? v.percentage
        : typeof v.score === "number" && typeof v.maxScore === "number" && v.maxScore > 0
        ? (v.score / v.maxScore) * 100
        : 0;
    if (!subjectAccumulator[subj]) subjectAccumulator[subj] = { sum: 0, n: 0 };
    subjectAccumulator[subj].sum += pct;
    subjectAccumulator[subj].n += 1;
  }
  const subjectScores: Record<string, number> = {};
  for (const [subj, { sum, n }] of Object.entries(subjectAccumulator)) {
    subjectScores[subj] = Math.round(sum / n);
  }

  // ── 2. Attendance (this week only) ───────────────────────────────────
  const dateStrings = isoDatesInRange(weekStart, weekEnd);
  // Firestore `in` clause caps at 30 values; a week is 7 — safe.
  const attendanceSnap = await db
    .collection("attendance")
    .where("schoolId", "==", schoolId)
    .where("studentId", "==", studentId)
    .where("date", "in", dateStrings)
    .get();
  const totalDays = attendanceSnap.size;
  const presentDays = attendanceSnap.docs.filter(
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
    // Single submissions query per student → build a map of {assignmentId → submitTs}
    const subsSnap = await db
      .collection("submissions")
      .where("schoolId", "==", schoolId)
      .where("studentId", "==", studentId)
      .get();
    const subsByAssignment = new Map<string, number>();
    for (const s of subsSnap.docs) {
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
  const notesSnap = await db
    .collection("parent_notes")
    .where("schoolId", "==", schoolId)
    .where("studentId", "==", studentId)
    .get();
  let behaviorScore = DEFAULT_BEHAVIOR_SCORE;
  for (const n of notesSnap.docs) {
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
      testScoresLookback: recentScores.length,
      attendanceWeek: totalDays,
      assignmentsDueThisWeek: dueThisWeek.length,
      teacherNotesAll: notesSnap.size,
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
