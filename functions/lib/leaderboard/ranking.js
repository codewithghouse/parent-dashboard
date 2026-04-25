"use strict";
// Pure ranking + tie-break logic. No Firestore imports — keeps this
// trivially unit-testable and easy to reason about. The ordering decisions
// here are LOAD-BEARING for fairness and stability of the leaderboard.
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareForRanking = compareForRanking;
exports.buildRanking = buildRanking;
exports.updateRankHistory = updateRankHistory;
const weekUtil_1 = require("./weekUtil");
/**
 * Sort comparator. Lower is better (so students[0] is rank #1).
 *
 * Tie-break order — applied left to right, the first decisive comparison wins:
 *   1. Composite score        (DESC) — the headline metric
 *   2. Previous rank          (ASC)  — already-strong students hold position
 *                                       on a tie, preventing churn
 *   3. Marks alone            (DESC) — pure academic when composites tie
 *   4. Attendance             (DESC) — reward consistent presence
 *   5. enrolledAt             (ASC)  — older student wins, fully deterministic
 *
 * The previous-rank tie-break needs care: a NEW student with no prior rank
 * gets MAX_SAFE_INTEGER so they slot BELOW any returning student on a tie —
 * intentional, because returning students should not lose ground to newcomers
 * absent any other signal.
 */
function compareForRanking(a, b) {
    if (a.compositeScore !== b.compositeScore) {
        return b.compositeScore - a.compositeScore;
    }
    const aPrev = a.previousRank ?? Number.MAX_SAFE_INTEGER;
    const bPrev = b.previousRank ?? Number.MAX_SAFE_INTEGER;
    if (aPrev !== bPrev)
        return aPrev - bPrev;
    if (a.breakdown.marks !== b.breakdown.marks) {
        return b.breakdown.marks - a.breakdown.marks;
    }
    if (a.breakdown.attendance !== b.breakdown.attendance) {
        return b.breakdown.attendance - a.breakdown.attendance;
    }
    return a.enrolledAt - b.enrolledAt;
}
/** Avatar palette — recycled deterministically by student index so ranking
 *  re-runs produce stable colours for the same student. */
const AVATAR_PALETTE = [
    { bg: "rgba(0,85,255,0.12)", text: "#0055FF" },
    { bg: "rgba(123,63,244,0.12)", text: "#7B3FF4" },
    { bg: "rgba(0,200,83,0.12)", text: "#00C853" },
    { bg: "rgba(255,170,0,0.12)", text: "#B47A00" },
    { bg: "rgba(229,48,74,0.10)", text: "#E5304A" },
];
function avatarFor(studentId) {
    // Tiny hash → stable palette index across runs.
    let h = 0;
    for (let i = 0; i < studentId.length; i++) {
        h = (h * 31 + studentId.charCodeAt(i)) | 0;
    }
    return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}
function initialsFor(name) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || "")
        .join("");
}
function trendOf(rank, previousRank) {
    if (previousRank == null)
        return "new";
    if (previousRank === rank)
        return "same";
    return previousRank > rank ? "up" : "down";
}
function trendLabel(rank, previousRank) {
    if (previousRank == null)
        return "New entry";
    if (previousRank === rank)
        return `Holding #${rank}`;
    if (previousRank > rank)
        return `Up from #${previousRank}`;
    return `Down from #${previousRank}`;
}
/**
 * Take derived snapshots + a map of {studentId → previous-week rank} and
 * produce the final ordered RankingEntry[] ready to write into the
 * leaderboard document.
 */
function buildRanking(snapshots, previousRankByStudentId) {
    const enriched = snapshots.map((s) => ({
        ...s,
        previousRank: previousRankByStudentId.get(s.studentId) ?? null,
    }));
    enriched.sort(compareForRanking);
    return enriched.map((s, i) => {
        const rank = i + 1;
        const previousRank = s.previousRank;
        const trend = trendOf(rank, previousRank);
        const avatar = avatarFor(s.studentId);
        return {
            studentId: s.studentId,
            name: s.name,
            initials: initialsFor(s.name),
            rank,
            previousRank,
            rankChange: previousRank == null ? 0 : previousRank - rank,
            trend,
            trendLabel: trendLabel(rank, previousRank),
            compositeScore: s.compositeScore,
            breakdown: s.breakdown,
            avatarBg: avatar.bg,
            avatarText: avatar.text,
        };
    });
}
/**
 * Append the current week's entry to the rolling history, capped at maxWeeks.
 * Preserves chronological order (oldest first). Idempotent: re-running the
 * cron for the same weekId replaces, never duplicates.
 */
function updateRankHistory(existing, weekId, rank, score, maxWeeks) {
    const prev = existing?.weeks ?? [];
    const filtered = prev.filter((w) => w.weekId !== weekId);
    filtered.push({ weekId, weekLabel: (0, weekUtil_1.formatWeekShort)(weekId), rank, score });
    // Keep only the last N (oldest first → take from the end if too long).
    if (filtered.length > maxWeeks) {
        return filtered.slice(filtered.length - maxWeeks);
    }
    return filtered;
}
//# sourceMappingURL=ranking.js.map