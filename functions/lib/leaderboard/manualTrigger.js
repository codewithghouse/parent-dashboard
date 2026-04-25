"use strict";
// Admin-only callable for triggering the leaderboard pipeline on demand.
// Used during dev/QA so we don't have to wait until Monday morning to see
// changes, and as a recovery hatch if the scheduled cron has a bad week.
//
// Inputs:
//   { schoolId, classId, weekId } — required, all three.
// Auth:
//   Caller must hold role in {"owner", "principal"} (the existing
//   ADMIN_ROLES set in functions/src/index.ts).
Object.defineProperty(exports, "__esModule", { value: true });
exports.manualTriggerImpl = manualTriggerImpl;
const admin = require("firebase-admin");
const cron_1 = require("./cron");
const insights_1 = require("./insights");
const ADMIN_ROLES = new Set(["owner", "principal"]);
// The owner UID happens to equal schoolId for owner-role accounts in this
// codebase (see helper isOwnerOf in firestore.rules). Principals carry an
// explicit schoolId claim. Both paths surface here so we can compare.
function callerSchoolId(token) {
    if (!token)
        return undefined;
    if (token.role === "owner")
        return token.schoolId || token.uid;
    return token.schoolId;
}
/**
 * Validate input + auth, then run processClass(). Returns a structured
 * result the caller can show in a debug UI.
 */
async function manualTriggerImpl(input, callerToken, openaiApiKey) {
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
    if (typeof input.weekId !== "string" || !/^\d{4}-W\d{1,2}$/.test(input.weekId)) {
        throw new Error("invalid-argument: weekId must look like 2026-W17");
    }
    // C2 FIX: enforce tenant isolation. Cloud Functions use the Admin SDK,
    // which bypasses Firestore rules — so this is the only layer enforcing
    // "owners/principals can only operate inside their own school".
    const tokenSchool = callerSchoolId(callerToken);
    if (!tokenSchool) {
        throw new Error("permission-denied: no schoolId on caller token");
    }
    if (tokenSchool !== input.schoolId) {
        throw new Error("permission-denied: cannot trigger another school's leaderboard");
    }
    const result = await (0, cron_1.processClass)(input.schoolId, input.classId, input.weekId);
    let insightsSummary;
    if (input.generateInsights === true) {
        // Re-read the freshly written leaderboard doc and run insights.
        const db = admin.firestore();
        const ref = db.doc(`leaderboards/${input.schoolId}_${input.classId}/weeks/${input.weekId}`);
        const snap = await ref.get();
        if (snap.exists) {
            const lb = snap.data();
            insightsSummary = await (0, insights_1.generateInsightsForLeaderboard)(lb, openaiApiKey);
        }
    }
    return {
        ok: true,
        schoolId: input.schoolId,
        classId: input.classId,
        weekId: input.weekId,
        studentCount: result.studentCount,
        classAverage: result.classAverage,
        cronDurationMs: result.durationMs,
        insights: insightsSummary,
    };
}
//# sourceMappingURL=manualTrigger.js.map