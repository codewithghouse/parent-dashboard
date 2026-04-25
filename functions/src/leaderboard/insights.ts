// AI insights generator + rule-based fallback.
//
// Triggered by writes to `leaderboards/{classKey}/weeks/{weekId}`. For each
// student in the ranking, builds a personalised gpt-4o-mini prompt around
// their metrics + the topper's metrics + their 8-week trajectory, parses
// the JSON response, and writes `student_insights/{studentId}/weeks/{weekId}`.
//
// Idempotent: skips students whose insights doc already exists for this
// week. Batched to keep within OpenAI RPM limits + the function timeout.
// On any per-student error we fall back to a rule-based stub so the parent
// always sees SOMETHING — silence is worse than a generic plan.

import * as admin from "firebase-admin";
import OpenAI from "openai";
import axios from "axios";
import {
  ACTION_COUNT_BY_RANK_TIER,
  OPENAI,
} from "./constants";
import { sanitizeDiagnosisHtml } from "./sanitize";
import type {
  ActionItem,
  ActionTracking,
  DiagnosisItem,
  ForecastData,
  InsightsDoc,
  InsightsTopper,
  LeaderboardDoc,
  RankHistoryDoc,
  RankingEntry,
  ScoreBreakdown,
  SubjectMetricsDoc,
  SubjectScore,
  TrajectoryPoint,
} from "./types";

interface OpenAiActionPayload {
  id: string;
  title: string;
  reason: string;
  tracking: ActionTracking;
  targetSubject?: string | null;
  targetValue?: number;
  targetPeriod?: "this_week" | "next_week" | "next_test";
  scoreReward?: number;
}

interface OpenAiPayload {
  diagnosis: DiagnosisItem[];
  actions: OpenAiActionPayload[];
  forecast: ForecastData;
}

const SYSTEM_PROMPT =
  "You are a friendly mentor for school students in India. Be encouraging, " +
  "specific, and never demoralize a student. Reply ONLY in valid JSON. Use " +
  "simple language a 12-year-old understands. You can mix Hindi and English " +
  "(Hinglish) naturally — use Hinglish for diagnosis and action plan reasons. " +
  "Keep titles in English.";

function actionRangeForRank(rank: number, total: number): { min: number; max: number } {
  if (rank <= 3) return ACTION_COUNT_BY_RANK_TIER.top3;
  if (rank <= Math.floor(total / 2)) return ACTION_COUNT_BY_RANK_TIER.midRange;
  if (rank <= Math.floor((3 * total) / 4)) return ACTION_COUNT_BY_RANK_TIER.lowerHalf;
  return ACTION_COUNT_BY_RANK_TIER.struggling;
}

function classifySubjectStatus(score: number, classAvg: number): SubjectScore["status"] {
  if (score >= classAvg + 5) return "strong";
  if (score < classAvg - 2) return "weak";
  return "good";
}

function buildSubjectsArray(
  subjectMetrics: SubjectMetricsDoc | null,
): SubjectScore[] {
  if (!subjectMetrics) return [];
  const out: SubjectScore[] = [];
  for (const [name, score] of Object.entries(subjectMetrics.subjects)) {
    const classAvg = subjectMetrics.classAverages[name] ?? score;
    out.push({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      score,
      classAvg,
      status: classifySubjectStatus(score, classAvg),
    });
  }
  // Strong → Good → Weak ordering — puts wins at the top, gives "weak" the
  // visual emphasis the SubjectBar component already designs around.
  const order = { strong: 0, good: 1, weak: 2 } as const;
  return out.sort((a, b) => order[a.status] - order[b.status]);
}

function buildTrajectoryArray(
  rankHistory: RankHistoryDoc | null,
  currentEntry: { weekId: string; weekLabel: string; rank: number },
): TrajectoryPoint[] {
  const fromHistory =
    rankHistory?.weeks?.map((w) => ({
      weekId: w.weekId,
      weekLabel: w.weekLabel,
      rank: w.rank,
    })) ?? [];
  // Ensure the current week is the last point — history is updated AFTER
  // this trigger reads it, so we may need to append manually.
  if (!fromHistory.find((w) => w.weekId === currentEntry.weekId)) {
    fromHistory.push(currentEntry);
  }
  return fromHistory;
}

/** Build the per-student user prompt sent to gpt-4o-mini. */
function buildUserPrompt(args: {
  studentName: string;
  totalStudents: number;
  rank: number;
  score: number;
  classAverage: number;
  breakdown: ScoreBreakdown;
  classAvgBreakdown: ScoreBreakdown;
  topper: InsightsTopper;
  topperRank: number;
  subjects: SubjectScore[];
  trajectory: TrajectoryPoint[];
  actionRange: { min: number; max: number };
  isTopper: boolean;
}): string {
  const subjectLine = args.subjects
    .map((s) => `${s.name}: ${s.score} (class ${s.classAvg})`)
    .join(", ") || "No subject data this week.";
  const trajectoryLine = args.trajectory
    .map((p) => `${p.weekLabel}:#${p.rank}`)
    .join(", ");
  const trajLastFour = args.trajectory.slice(-4);
  const climbStr =
    trajLastFour.length >= 2
      ? `${trajLastFour[0].weekLabel}#${trajLastFour[0].rank} → ${trajLastFour[trajLastFour.length - 1].weekLabel}#${trajLastFour[trajLastFour.length - 1].rank}`
      : "single data point";

  const ask = args.isTopper
    ? `Student is currently #1. Generate ${args.actionRange.min}-${args.actionRange.max} actions focused on MAINTAINING the lead, not climbing. Confidence should reflect risk of being overtaken.`
    : `Generate ${args.actionRange.min}-${args.actionRange.max} action items based on biggest gaps. Each action MUST be: trackable by the system OR honestly marked as teacher-tracked, specific with numbers (target score, % to reach, count to complete), doable in 1-2 weeks.`;

  return `Student data:
- Name: ${args.studentName}
- Current rank: #${args.rank} of ${args.totalStudents}
- Score: ${args.score}
- Class average: ${args.classAverage}

Their breakdown:
- Marks: ${args.breakdown.marks} (class avg ${args.classAvgBreakdown.marks})
- Attendance: ${args.breakdown.attendance}% (class avg ${args.classAvgBreakdown.attendance}%)
- Assignments: ${args.breakdown.assignments}% (class avg ${args.classAvgBreakdown.assignments}%)
- Behavior: ${args.breakdown.behavior} (class avg ${args.classAvgBreakdown.behavior})

Subject-wise:
${subjectLine}

Top student data:
- Score: ${args.topper.score}
- Marks: ${args.topper.breakdown.marks}, Attendance: ${args.topper.breakdown.attendance}%, Assignments: ${args.topper.breakdown.assignments}%, Behavior: ${args.topper.breakdown.behavior}

Trajectory (recent ranks): ${trajectoryLine}
Recent climb summary: ${climbStr}

${ask}

Return JSON in this EXACT shape:
{
  "diagnosis": [
    { "type": "good", "text": "Hinglish: highlight what's working" },
    { "type": "concern", "text": "Hinglish: explain biggest weakness with specific numbers" },
    { "type": "note", "text": "Hinglish: optional teacher remarks context" }
  ],
  "actions": [
    {
      "id": "a1",
      "title": "English title with concrete target",
      "reason": "Hinglish reason with specific historical data",
      "tracking": "<exactly ONE of: auto_assignments OR auto_test_score OR auto_attendance OR manual_teacher>",
      "targetSubject": "<exactly ONE of: math, science, english, hindi, social, OR null>",
      "targetValue": <number>,
      "targetPeriod": "<exactly ONE of: this_week, next_week, OR next_test>",
      "scoreReward": <number 5-15>
    }
  ],
  "forecast": {
    "projectedRank": <number>,
    "rankChange": <number>,
    "confidence": <number 50-95>,
    "scenarios": [
      { "actions": 1, "rank": <number>, "label": "Complete 1 action" },
      { "actions": 2, "rank": <number>, "label": "Complete 2 actions" },
      { "actions": 3, "rank": <number>, "label": "Complete all actions", "highlight": true }
    ]
  }
}`;
}

/**
 * Validate the parsed AI response. Throws on any structural mismatch so we
 * fall through to the rule-based fallback rather than persisting garbage.
 */
const VALID_TRACKING = ["auto_assignments", "auto_test_score", "auto_attendance", "manual_teacher"];

/**
 * Salvage common AI output mistakes on the `tracking` field. The AI
 * sometimes emits the prompt's pipe-separated enum verbatim
 * ("auto_assignments | auto_test_score") instead of picking one. We extract
 * the first valid value rather than reject the whole action.
 */
function normalizeTracking(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (VALID_TRACKING.includes(trimmed)) return trimmed;
  // Try to pick the first valid token from a pipe/comma/slash-separated list.
  const tokens = trimmed.split(/[|,/]/).map((s) => s.trim());
  for (const t of tokens) {
    if (VALID_TRACKING.includes(t)) return t;
  }
  return null;
}

function validateAiPayload(p: any): asserts p is OpenAiPayload {
  if (!p || typeof p !== "object") throw new Error("payload not an object");
  if (!Array.isArray(p.diagnosis) || p.diagnosis.length === 0) throw new Error("diagnosis missing");
  if (!Array.isArray(p.actions) || p.actions.length === 0) throw new Error("actions missing");
  if (!p.forecast || typeof p.forecast.projectedRank !== "number") throw new Error("forecast missing");
  for (const a of p.actions) {
    if (!a.id || !a.title || !a.tracking) throw new Error(`action missing fields: ${JSON.stringify(a)}`);
    // Repair the tracking field in-place if AI sent a pipe-separated string.
    const normalized = normalizeTracking(a.tracking);
    if (!normalized) throw new Error(`bad tracking: ${a.tracking}`);
    a.tracking = normalized;
  }
}

/**
 * Convert OpenAI's action payload to the on-disk ActionItem with fresh
 * status fields. Auto-tracked actions get a 0/target progress baseline so
 * the daily progress cron can update from there.
 */
function actionFromAi(a: OpenAiActionPayload, now: number): ActionItem {
  const target = a.targetValue ?? 0;
  let progress: ActionItem["progress"];
  if (a.tracking === "auto_assignments") {
    progress = { current: 0, target: Math.max(1, target || 4), type: "count" };
  } else if (a.tracking === "auto_attendance") {
    progress = { current: 0, target: Math.max(1, target || 95), type: "percentage" };
  }
  // For auto_test_score and manual_teacher, no baseline progress object.
  return {
    id: a.id,
    title: a.title,
    reason: a.reason,
    tracking: a.tracking,
    targetSubject: a.targetSubject ?? null,
    targetValue: a.targetValue,
    targetPeriod: a.targetPeriod,
    status: "pending",
    progress,
    scoreReward: a.scoreReward ?? 5,
    createdAt: now,
  };
}

/**
 * Rule-based stub used when OpenAI fails or returns garbage. Generates
 * 2-3 actions targeting the student's weakest metric. Hinglish reasons
 * use the SAME tone as the AI so parents don't notice the regression.
 */
function fallbackInsights(args: {
  studentId: string;
  weekId: string;
  schoolId: string;
  rank: number;
  totalStudents: number;
  breakdown: ScoreBreakdown;
  classAvgBreakdown: ScoreBreakdown;
  topper: InsightsTopper;
  subjects: SubjectScore[];
  trajectory: TrajectoryPoint[];
}): InsightsDoc {
  const now = Date.now();
  const { breakdown, classAvgBreakdown } = args;
  const gaps = [
    { key: "marks" as const, gap: breakdown.marks - classAvgBreakdown.marks },
    { key: "attendance" as const, gap: breakdown.attendance - classAvgBreakdown.attendance },
    { key: "assignments" as const, gap: breakdown.assignments - classAvgBreakdown.assignments },
    { key: "behavior" as const, gap: breakdown.behavior - classAvgBreakdown.behavior },
  ].sort((a, b) => a.gap - b.gap);
  const weakest = gaps[0];

  const actions: ActionItem[] = [];
  if (weakest.key === "assignments") {
    actions.push({
      id: "a1",
      title: "Submit all assignments on time this week",
      reason: `Tumhara assignments score ${breakdown.assignments}% hai (class avg ${classAvgBreakdown.assignments}%). Time pe submit karoge to score badhega.`,
      tracking: "auto_assignments",
      status: "pending",
      progress: { current: 0, target: 4, type: "count" },
      scoreReward: 8,
      createdAt: now,
    });
  }
  if (weakest.key === "attendance" || breakdown.attendance < 90) {
    actions.push({
      id: "a2",
      title: `Push attendance to ${Math.min(100, breakdown.attendance + 5)}% this week`,
      reason: `Abhi attendance ${breakdown.attendance}% hai. Har class attend karoge to easily target hit ho jayega.`,
      tracking: "auto_attendance",
      status: "pending",
      progress: {
        current: breakdown.attendance,
        target: Math.min(100, breakdown.attendance + 5),
        type: "percentage",
      },
      scoreReward: 6,
      createdAt: now,
    });
  }
  if (weakest.key === "marks" || actions.length === 0) {
    actions.push({
      id: "a3",
      title: "Score 80+ in next test",
      reason: `Marks improvement sabse zyada impact karega — class topper ${args.topper.breakdown.marks}, tum ${breakdown.marks}.`,
      tracking: "auto_test_score",
      status: "pending",
      scoreReward: 10,
      createdAt: now,
    });
  }
  if (weakest.key === "behavior") {
    actions.push({
      id: "a4",
      title: "Earn one positive teacher remark",
      reason: `Behavior ${breakdown.behavior} hai. Class participation badhao — ek acchi remark = +5 score.`,
      tracking: "manual_teacher",
      status: "pending",
      hint: "Try: ask 1 question per period · volunteer for activities",
      scoreReward: 5,
      createdAt: now,
    });
  }

  const projectedRank = Math.max(1, args.rank - 2);
  return {
    studentId: args.studentId,
    weekId: args.weekId,
    schoolId: args.schoolId,
    // Run interpolated strings through the sanitizer too — defends against
    // any future fallback addition that interpolates user-controlled fields.
    diagnosis: [
      {
        type: "good",
        text: sanitizeDiagnosisHtml(
          `Tumhara strong area <strong>${gaps[gaps.length - 1].key}</strong> hai (${breakdown[gaps[gaps.length - 1].key]} score).`,
        ),
      },
      {
        type: "concern",
        text: sanitizeDiagnosisHtml(
          `Sabse bada gap <strong>${weakest.key}</strong> mein hai — ${breakdown[weakest.key]} vs class avg ${classAvgBreakdown[weakest.key]}.`,
        ),
      },
    ],
    subjects: args.subjects,
    trajectory: args.trajectory,
    topper: args.topper,
    actions,
    forecast: {
      projectedRank,
      rankChange: args.rank - projectedRank,
      confidence: 65,
      scenarios: [
        { actions: 1, rank: Math.max(1, args.rank - 1), label: "Complete 1 action" },
        { actions: 2, rank: Math.max(1, args.rank - 2), label: "Complete 2 actions" },
        { actions: actions.length, rank: projectedRank, label: `Complete all ${actions.length} actions`, highlight: true },
      ],
    },
    generatedAt: now,
    aiModel: "fallback",
  };
}

async function generateForOneStudent(args: {
  // Raw API key — passed in instead of an OpenAI SDK instance because the
  // SDK was throwing APIConnectionError from this Cloud Functions runtime.
  // We call the REST endpoint directly via axios; see the request below.
  openaiApiKey: string;
  entry: RankingEntry;
  leaderboard: LeaderboardDoc;
  topper: InsightsTopper;
  classAvgBreakdown: ScoreBreakdown;
  subjectMetrics: SubjectMetricsDoc | null;
  rankHistory: RankHistoryDoc | null;
}): Promise<InsightsDoc> {
  const subjects = buildSubjectsArray(args.subjectMetrics);
  const trajectory = buildTrajectoryArray(args.rankHistory, {
    weekId: args.leaderboard.weekId,
    weekLabel: args.leaderboard.weekId.replace(/^\d{4}-/, ""),
    rank: args.entry.rank,
  });

  const baseFallbackArgs = {
    studentId: args.entry.studentId,
    weekId: args.leaderboard.weekId,
    schoolId: args.leaderboard.schoolId,
    rank: args.entry.rank,
    totalStudents: args.leaderboard.totalStudents,
    breakdown: args.entry.breakdown ?? { marks: 0, attendance: 0, assignments: 0, behavior: 0 },
    classAvgBreakdown: args.classAvgBreakdown,
    topper: args.topper,
    subjects,
    trajectory,
  };

  const startedAt = Date.now();
  try {
    const userPrompt = buildUserPrompt({
      studentName: args.entry.name,
      totalStudents: args.leaderboard.totalStudents,
      rank: args.entry.rank,
      score: args.entry.compositeScore,
      classAverage: args.leaderboard.classAverage,
      breakdown: baseFallbackArgs.breakdown,
      classAvgBreakdown: args.classAvgBreakdown,
      topper: args.topper,
      topperRank: 1,
      subjects,
      trajectory,
      actionRange: actionRangeForRank(args.entry.rank, args.leaderboard.totalStudents),
      isTopper: args.entry.rank === 1,
    });

    // Raw axios call — bypasses the OpenAI SDK because it was throwing
    // APIConnectionError from Cloud Functions asia-south1 even when the
    // same API key + endpoint worked from `curl` outside the function.
    // Same payload shape as the SDK; we just hit the REST endpoint
    // directly. axios is already in functions/package.json.
    const completionResp = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: OPENAI.model,
        temperature: OPENAI.temperature,
        max_tokens: OPENAI.maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      },
      {
        headers: {
          // .trim() — Secret Manager values may include a trailing newline;
          // Node's HTTP layer rejects newlines in header values with
          // "Invalid character in header content". The OpenAI SDK was
          // silently trimming this (which is why its error path was
          // misleading APIConnectionError instead of a clearer 400).
          Authorization: `Bearer ${args.openaiApiKey.trim()}`,
          "Content-Type": "application/json",
        },
        timeout: 60_000,
      },
    );
    const completion = completionResp.data;
    const raw = completion.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);
    validateAiPayload(parsed);

    const now = Date.now();
    console.log(JSON.stringify({
      event: "insights.ai_success",
      studentId: args.entry.studentId,
      weekId: args.leaderboard.weekId,
      tokensUsed: completion.usage?.total_tokens,
      durationMs: now - startedAt,
    }));

    return {
      studentId: args.entry.studentId,
      weekId: args.leaderboard.weekId,
      schoolId: args.leaderboard.schoolId,
      // C1 FIX: sanitize AI HTML before persisting. Whitelists <strong>/<em>
      // only; everything else is escaped. Defends against prompt-injection
      // XSS via student names / subject labels in the prompt.
      diagnosis: parsed.diagnosis.map((d: DiagnosisItem) => ({
        type: d.type,
        text: sanitizeDiagnosisHtml(d.text),
      })),
      subjects,
      trajectory,
      topper: args.topper,
      actions: parsed.actions.map((a: OpenAiActionPayload) => actionFromAi(a, now)),
      forecast: parsed.forecast,
      generatedAt: now,
      aiModel: OPENAI.model,
    };
  } catch (err: any) {
    // Never log the prompt or completion text — PII risk.
    // Surface ENOUGH error metadata to debug without leaking content:
    // OpenAI SDK errors expose `.status` (HTTP code), `.code` (error code
    // string like 'model_not_found'), and `.error?.message` (sanitised
    // server message). The bare `.message` ("Connection error.") was
    // historically all we logged — masked a 403 model-access bug for hours.
    console.warn(JSON.stringify({
      event: "insights.ai_fallback",
      studentId: args.entry.studentId,
      weekId: args.leaderboard.weekId,
      reason: err?.message || String(err),
      status: err?.status,
      errorCode: err?.code,
      apiMessage: err?.error?.message,
      type: err?.constructor?.name,
      durationMs: Date.now() - startedAt,
    }));
    return fallbackInsights(baseFallbackArgs);
  }
}

/**
 * Trigger entry point. Called by Firestore onWrite on the leaderboard doc.
 * Iterates students in batches, skipping any whose insights doc already
 * exists for this week (idempotency).
 */
export async function generateInsightsForLeaderboard(
  leaderboard: LeaderboardDoc,
  openaiApiKey: string,
): Promise<{ generated: number; skipped: number; failed: number }> {
  const db = admin.firestore();
  // Note: SDK instance no longer constructed — generateForOneStudent calls
  // the OpenAI REST API directly via axios (see comments there).
  const weekId = leaderboard.weekId;

  if (!leaderboard.rankings || leaderboard.rankings.length === 0) {
    return { generated: 0, skipped: 0, failed: 0 };
  }

  const topperEntry = leaderboard.rankings[0];
  const topper: InsightsTopper = {
    name: topperEntry.name,
    initials: topperEntry.initials,
    score: topperEntry.compositeScore,
    breakdown:
      topperEntry.breakdown ?? { marks: 0, attendance: 0, assignments: 0, behavior: 0 },
  };

  // Class average breakdown — average each metric across all rankings.
  const sumBreakdown: ScoreBreakdown = { marks: 0, attendance: 0, assignments: 0, behavior: 0 };
  let n = 0;
  for (const r of leaderboard.rankings) {
    if (!r.breakdown) continue;
    sumBreakdown.marks += r.breakdown.marks;
    sumBreakdown.attendance += r.breakdown.attendance;
    sumBreakdown.assignments += r.breakdown.assignments;
    sumBreakdown.behavior += r.breakdown.behavior;
    n++;
  }
  const classAvgBreakdown: ScoreBreakdown =
    n === 0
      ? { marks: 0, attendance: 0, assignments: 0, behavior: 0 }
      : {
          marks: Math.round(sumBreakdown.marks / n),
          attendance: Math.round(sumBreakdown.attendance / n),
          assignments: Math.round(sumBreakdown.assignments / n),
          behavior: Math.round(sumBreakdown.behavior / n),
        };

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < leaderboard.rankings.length; i += OPENAI.batchSize) {
    const batch = leaderboard.rankings.slice(i, i + OPENAI.batchSize);
    await Promise.all(
      batch.map(async (entry) => {
        const insightRef = db.doc(
          `student_insights/${entry.studentId}/weeks/${weekId}`,
        );
        // Idempotency: skip if a NON-FALLBACK insight doc already exists
        // for this student+week. Fallback docs ARE retried — they signal
        // a transient OpenAI failure that may now succeed (e.g., after a
        // model-access issue is fixed or the SDK is replaced with axios).
        const existing = await insightRef.get();
        if (existing.exists) {
          const existingData = existing.data() as InsightsDoc | undefined;
          if (existingData?.aiModel !== "fallback") {
            skipped++;
            return;
          }
        }
        try {
          const [subjectSnap, historySnap] = await Promise.all([
            db.doc(`student_subject_metrics/${entry.studentId}/weeks/${weekId}`).get(),
            db.doc(`student_rank_history/${entry.studentId}`).get(),
          ]);
          const subjectMetrics = subjectSnap.exists
            ? (subjectSnap.data() as SubjectMetricsDoc)
            : null;
          const rankHistory = historySnap.exists
            ? (historySnap.data() as RankHistoryDoc)
            : null;

          const insights = await generateForOneStudent({
            openaiApiKey,
            entry,
            leaderboard,
            topper,
            classAvgBreakdown,
            subjectMetrics,
            rankHistory,
          });
          await insightRef.set(insights);
          generated++;
        } catch (err: any) {
          failed++;
          console.error(JSON.stringify({
            event: "insights.write_failed",
            studentId: entry.studentId,
            weekId,
            message: err?.message || String(err),
          }));
        }
      }),
    );
    // Brief pause between batches keeps OpenAI RPM headroom.
    if (i + OPENAI.batchSize < leaderboard.rankings.length) {
      await new Promise((r) => setTimeout(r, OPENAI.delayBetweenBatchesMs));
    }
  }

  console.log(JSON.stringify({
    event: "insights.leaderboard_done",
    weekId, classKey: `${leaderboard.schoolId}_${leaderboard.classId}`,
    generated, skipped, failed,
  }));
  return { generated, skipped, failed };
}
