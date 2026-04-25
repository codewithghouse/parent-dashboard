"use strict";
// One-shot admin callable that seeds REALISTIC sample data into the
// real source-of-truth collections (test_scores, attendance, parent_notes)
// so the leaderboard cron has differentiated data to rank students by.
//
// THIS IS NOT MOCK DATA. The writes go to real Firestore collections that
// the rest of the app reads from. We're effectively simulating "what the
// teacher app would have written if teachers had been entering data".
// Use it once during testing, then delete the seeded docs (or let them
// stand — they're indistinguishable from real data).
//
// Auth: owner/principal of the matching school only. Same gate as
// triggerLeaderboardManually.
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedSampleDataImpl = seedSampleDataImpl;
const admin = require("firebase-admin");
const ADMIN_ROLES = new Set(["owner", "principal"]);
const SUBJECTS = ["mathematics", "science", "english", "hindi", "social"];
function callerSchoolId(token) {
    if (!token)
        return undefined;
    if (token.role === "owner")
        return token.schoolId || token.uid;
    return token.schoolId;
}
// Deterministic-ish randomness — seeded by student ID so re-running
// doesn't churn the data. Returns float in [0, 1).
function seededRand(seed, salt) {
    let h = salt;
    for (let i = 0; i < seed.length; i++) {
        h = (h * 31 + seed.charCodeAt(i)) | 0;
    }
    // Wrap to [0, 1)
    return Math.abs(h % 10000) / 10000;
}
/**
 * Profile templates — assigned by student-index modulo so the class shows
 * a realistic distribution: 1 top, 2 above-avg, 2 average, 1 below, 1 struggling.
 */
const PROFILES = [
    { label: "top", scoreBase: 90, attendancePct: 100, positiveNotes: 3, negativeNotes: 0 },
    { label: "above_avg_1", scoreBase: 85, attendancePct: 95, positiveNotes: 2, negativeNotes: 0 },
    { label: "above_avg_2", scoreBase: 80, attendancePct: 95, positiveNotes: 1, negativeNotes: 0 },
    { label: "average_1", scoreBase: 75, attendancePct: 90, positiveNotes: 1, negativeNotes: 1 },
    { label: "average_2", scoreBase: 70, attendancePct: 90, positiveNotes: 0, negativeNotes: 1 },
    { label: "below_avg", scoreBase: 60, attendancePct: 80, positiveNotes: 0, negativeNotes: 2 },
    { label: "struggling", scoreBase: 50, attendancePct: 70, positiveNotes: 0, negativeNotes: 3 },
];
const MS_PER_DAY = 86400000;
function toIsoDate(ts) {
    const d = new Date(ts);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
async function seedSampleDataImpl(input, callerToken) {
    // Auth + tenancy gates — same pattern as triggerLeaderboardManually.
    const role = callerToken?.role;
    if (!role || !ADMIN_ROLES.has(role)) {
        throw new Error("permission-denied: admin only");
    }
    if (typeof input.schoolId !== "string" || !input.schoolId) {
        throw new Error("invalid-argument: schoolId required");
    }
    if (typeof input.classId !== "string" || !input.classId) {
        throw new Error("invalid-argument: classId required");
    }
    const tokenSchool = callerSchoolId(callerToken);
    if (!tokenSchool || tokenSchool !== input.schoolId) {
        throw new Error("permission-denied: cannot seed another school's data");
    }
    const db = admin.firestore();
    const schoolId = input.schoolId;
    const classId = input.classId;
    // Find all students in this class.
    const studentsSnap = await db
        .collection("students")
        .where("schoolId", "==", schoolId)
        .where("classId", "==", classId)
        .get();
    if (studentsSnap.empty) {
        throw new Error(`no students found for school=${schoolId} class=${classId}`);
    }
    const students = studentsSnap.docs;
    // Optional cleanup — wipe previously-seeded docs (marked with seedRun=true).
    let cleared = 0;
    if (input.clearExistingSeed === true) {
        for (const collName of ["test_scores", "attendance", "parent_notes"]) {
            const stale = await db
                .collection(collName)
                .where("schoolId", "==", schoolId)
                .where("seedRun", "==", true)
                .get();
            const batch = db.batch();
            let batched = 0;
            for (const d of stale.docs) {
                batch.delete(d.ref);
                batched++;
                cleared++;
            }
            if (batched > 0)
                await batch.commit();
        }
    }
    let testScoreWrites = 0;
    let attendanceWrites = 0;
    let noteWrites = 0;
    const now = Date.now();
    for (let i = 0; i < students.length; i++) {
        const studentDoc = students[i];
        const studentId = studentDoc.id;
        const profile = PROFILES[i % PROFILES.length];
        // Write a batch per student — keeps each write isolated and
        // well below the 500-op-per-batch Firestore limit.
        const batch = db.batch();
        // 1. test_scores — one per subject, in the past 30 days.
        SUBJECTS.forEach((subject, subIdx) => {
            // Slight variance per subject so subject scores aren't all identical.
            const variance = Math.round((seededRand(studentId, subIdx * 7) - 0.5) * 10);
            const score = Math.max(20, Math.min(100, profile.scoreBase + variance));
            const daysAgo = subIdx * 4 + 2; // spread across last ~3 weeks
            const ref = db.collection("test_scores").doc();
            batch.set(ref, {
                studentId,
                schoolId,
                subject,
                score,
                maxScore: 100,
                percentage: score,
                timestamp: admin.firestore.Timestamp.fromMillis(now - daysAgo * MS_PER_DAY),
                seedRun: true, // marker for cleanup
                seedProfile: profile.label,
            });
            testScoreWrites++;
        });
        // 2. attendance — one doc per day for the past 7 days.
        for (let day = 0; day < 7; day++) {
            const ts = now - day * MS_PER_DAY;
            const dateStr = toIsoDate(ts);
            // Roll for present/absent based on attendancePct profile.
            const r = seededRand(studentId, day * 13 + 100);
            const status = r * 100 < profile.attendancePct ? "present" : "absent";
            const ref = db.collection("attendance").doc(`${studentId}_${dateStr}`);
            batch.set(ref, {
                studentId,
                schoolId,
                date: dateStr,
                status,
                seedRun: true,
                seedProfile: profile.label,
            });
            attendanceWrites++;
        }
        // 3. parent_notes — teacher remarks (positive + negative) within past 7 days.
        const positiveTexts = [
            "Excellent participation in class today",
            "Showed great improvement in problem solving",
            "Helpful and well-mannered with classmates",
        ];
        const negativeTexts = [
            "Disturbed the class during the lecture",
            "Concern: incomplete homework for second time this week",
            "Needs to focus more during group activities",
        ];
        for (let p = 0; p < profile.positiveNotes; p++) {
            const ref = db.collection("parent_notes").doc();
            batch.set(ref, {
                studentId,
                schoolId,
                from: "teacher",
                category: "positive",
                content: positiveTexts[p % positiveTexts.length],
                teacherId: "seed-teacher",
                teacherName: "Class Teacher",
                createdAt: admin.firestore.Timestamp.fromMillis(now - p * MS_PER_DAY),
                read: false,
                seedRun: true,
                seedProfile: profile.label,
            });
            noteWrites++;
        }
        for (let n = 0; n < profile.negativeNotes; n++) {
            const ref = db.collection("parent_notes").doc();
            batch.set(ref, {
                studentId,
                schoolId,
                from: "teacher",
                category: "concern",
                content: negativeTexts[n % negativeTexts.length],
                teacherId: "seed-teacher",
                teacherName: "Class Teacher",
                createdAt: admin.firestore.Timestamp.fromMillis(now - (n + profile.positiveNotes) * MS_PER_DAY),
                read: false,
                seedRun: true,
                seedProfile: profile.label,
            });
            noteWrites++;
        }
        await batch.commit();
        console.log(JSON.stringify({
            event: "seed.student_done",
            studentId,
            profile: profile.label,
        }));
    }
    console.log(JSON.stringify({
        event: "seed.complete",
        schoolId,
        classId,
        studentsSeeded: students.length,
        testScoreWrites,
        attendanceWrites,
        noteWrites,
        cleared,
    }));
    return {
        ok: true,
        schoolId,
        classId,
        studentsSeeded: students.length,
        writes: {
            testScores: testScoreWrites,
            attendance: attendanceWrites,
            parentNotes: noteWrites,
        },
        cleared,
    };
}
//# sourceMappingURL=seedSampleData.js.map