"use strict";
// Daily action-progress auto-tracker.
//
// Fires every morning at 06:00 IST. For every student with an active
// student_insights doc for the CURRENT week, recomputes progress on each
// non-completed action by re-querying the source-of-truth collections.
// Marks an action `completed` the moment its target is hit, applying the
// scoreReward for the plan-summary card.
//
// Idempotent by construction: progress fields are recomputed from absolute
// query counts each run, so re-firing the cron the same day produces the
// same end state — never double-applies a reward.
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshActionsForStudent = refreshActionsForStudent;
exports.runActionTrackerCron = runActionTrackerCron;
const admin = require("firebase-admin");
const weekUtil_1 = require("./weekUtil");
const MS_PER_DAY = 86400000;
/**
 * Count this week's on-time submissions for one student. Mirrors the
 * `assignmentsPct` slice of metrics.ts but returns a raw count (not a
 * percentage) — actions are usually framed as "submit 4 assignments".
 */
async function countOnTimeSubmissionsThisWeek(schoolId, studentId, classId, weekStart, weekEnd) {
    const db = admin.firestore();
    const assignmentsSnap = await db
        .collection("assignments")
        .where("schoolId", "==", schoolId)
        .where("classId", "==", classId)
        .get();
    const dueIds = new Map(); // assignmentId → due timestamp
    for (const a of assignmentsSnap.docs) {
        const data = a.data();
        const due = (data.dueDate?.toMillis?.() ||
            data.due_date?.toMillis?.() ||
            data.deadline?.toMillis?.() ||
            0);
        if (due >= weekStart && due <= weekEnd)
            dueIds.set(a.id, due);
    }
    if (dueIds.size === 0)
        return 0;
    const subsSnap = await db
        .collection("submissions")
        .where("schoolId", "==", schoolId)
        .where("studentId", "==", studentId)
        .get();
    let onTime = 0;
    for (const s of subsSnap.docs) {
        const sd = s.data();
        const aid = sd.homeworkId || sd.assignmentId;
        if (!aid || !dueIds.has(aid))
            continue;
        const ts = (sd.submittedAt?.toMillis?.() || sd.timestamp?.toMillis?.() || 0);
        if (ts && ts <= dueIds.get(aid))
            onTime++;
    }
    return onTime;
}
async function attendancePctThisWeek(schoolId, studentId, weekStart, weekEnd) {
    const db = admin.firestore();
    const dates = (0, weekUtil_1.isoDatesInRange)(weekStart, weekEnd);
    const snap = await db
        .collection("attendance")
        .where("schoolId", "==", schoolId)
        .where("studentId", "==", studentId)
        .where("date", "in", dates)
        .get();
    if (snap.empty)
        return 100;
    const present = snap.docs.filter((d) => d.data().status === "present").length;
    return Math.round((present / snap.size) * 100);
}
/**
 * Find the highest test score for a subject since `sinceTs`, returning the
 * percentage. Returns null if no matching test exists.
 */
async function bestTestScoreSince(schoolId, studentId, subject, sinceTs) {
    const db = admin.firestore();
    const snap = await db
        .collection("test_scores")
        .where("schoolId", "==", schoolId)
        .where("studentId", "==", studentId)
        .get();
    let best = null;
    for (const d of snap.docs) {
        const v = d.data();
        const ts = (v.timestamp?.toMillis?.() || 0);
        if (ts < sinceTs)
            continue;
        const subj = (v.subject || v.subjectName || "").toString().trim().toLowerCase();
        // Loose match — "Maths"/"math"/"mathematics" all map together.
        const normalized = subject.toLowerCase();
        const matches = subj === normalized ||
            subj.startsWith(normalized.slice(0, 4)) ||
            normalized.startsWith(subj.slice(0, 4));
        if (!matches)
            continue;
        const pct = typeof v.percentage === "number"
            ? v.percentage
            : typeof v.score === "number" && typeof v.maxScore === "number" && v.maxScore > 0
                ? (v.score / v.maxScore) * 100
                : 0;
        if (best === null || pct > best)
            best = Math.round(pct);
    }
    return best;
}
/**
 * Recompute one action's progress in-place. Returns the (possibly updated)
 * action and a boolean indicating whether anything actually changed —
 * lets the caller skip the Firestore write when nothing did.
 */
async function refreshAction(action, ctx) {
    if (action.status === "completed" || action.tracking === "manual_teacher") {
        return { next: action, changed: false };
    }
    const now = Date.now();
    const before = JSON.stringify(action);
    if (action.tracking === "auto_assignments") {
        const onTime = await countOnTimeSubmissionsThisWeek(ctx.schoolId, ctx.studentId, ctx.classId, ctx.weekStart, ctx.weekEnd);
        const target = action.progress?.target ?? 4;
        action.progress = { current: Math.min(onTime, target), target, type: "count" };
        if (action.progress.current === 0)
            action.status = "pending";
        else if (action.progress.current >= target) {
            action.status = "completed";
            action.completedAt = now;
            action.reward = action.reward ?? `+${action.scoreReward ?? 5} score`;
        }
        else {
            action.status = "in_progress";
        }
    }
    else if (action.tracking === "auto_attendance") {
        const pct = await attendancePctThisWeek(ctx.schoolId, ctx.studentId, ctx.weekStart, ctx.weekEnd);
        const target = action.progress?.target ?? 95;
        action.progress = { current: pct, target, type: "percentage" };
        if (pct >= target) {
            action.status = "completed";
            action.completedAt = now;
            action.reward = action.reward ?? `+${action.scoreReward ?? 5} score`;
        }
        else {
            action.status = "pending";
        }
    }
    else if (action.tracking === "auto_test_score") {
        const subject = action.targetSubject || "";
        if (subject) {
            const best = await bestTestScoreSince(ctx.schoolId, ctx.studentId, subject, action.createdAt);
            const target = action.targetValue ?? 80;
            if (best !== null && best >= target) {
                action.status = "completed";
                action.completedAt = now;
                action.reward = action.reward ?? `+${action.scoreReward ?? 5} score`;
                // Record the achieved score in `reason` for the parent UI.
                action.reason = `You scored ${best} on a recent ${subject} test — exceeded the goal!`;
            }
        }
    }
    const after = JSON.stringify(action);
    return { next: action, changed: before !== after };
}
/**
 * One-shot tracker for one student. Public so the manual trigger can run
 * it on demand without waiting for the daily cron.
 */
async function refreshActionsForStudent(studentId) {
    const db = admin.firestore();
    const weekId = (0, weekUtil_1.getCurrentWeekId)();
    const { start: weekStart, end: weekEnd } = (0, weekUtil_1.weekIdToRange)(weekId);
    const insightRef = db.doc(`student_insights/${studentId}/weeks/${weekId}`);
    const insightSnap = await insightRef.get();
    if (!insightSnap.exists)
        return { updated: false, completedCount: 0 };
    const insight = insightSnap.data();
    // Need schoolId + classId — fetch from students/{id}.
    const studentSnap = await db.doc(`students/${studentId}`).get();
    if (!studentSnap.exists)
        return { updated: false, completedCount: 0 };
    const sd = studentSnap.data();
    let anyChanged = false;
    const refreshed = [];
    for (const action of insight.actions) {
        const { next, changed } = await refreshAction(action, {
            schoolId: sd.schoolId,
            studentId,
            classId: sd.classId,
            weekStart,
            weekEnd,
        });
        if (changed)
            anyChanged = true;
        refreshed.push(next);
    }
    if (anyChanged) {
        await insightRef.update({ actions: refreshed });
    }
    const completedCount = refreshed.filter((a) => a.status === "completed").length;
    return { updated: anyChanged, completedCount };
}
/**
 * Cron entry point. Iterates every student, refreshes the current week's
 * insights doc if it exists. Failures are isolated per student.
 */
async function runActionTrackerCron() {
    const startedAt = Date.now();
    const db = admin.firestore();
    // Iterate the source of truth for student membership. ~1 read per
    // student. For schools with thousands of students this is the dominant
    // cost; consider sharding by schoolId if it becomes a problem.
    const studentsSnap = await db.collection("students").select().get();
    const studentIds = studentsSnap.docs.map((d) => d.id);
    console.log(JSON.stringify({
        event: "actions.cron_start",
        studentCount: studentIds.length,
    }));
    let updated = 0;
    let unchanged = 0;
    let failed = 0;
    const BATCH = 20;
    for (let i = 0; i < studentIds.length; i += BATCH) {
        const slice = studentIds.slice(i, i + BATCH);
        const results = await Promise.allSettled(slice.map(refreshActionsForStudent));
        for (const r of results) {
            if (r.status === "rejected")
                failed++;
            else if (r.value.updated)
                updated++;
            else
                unchanged++;
        }
    }
    console.log(JSON.stringify({
        event: "actions.cron_done",
        studentCount: studentIds.length,
        updated, unchanged, failed,
        durationMs: Date.now() - startedAt,
    }));
}
//# sourceMappingURL=actions.js.map