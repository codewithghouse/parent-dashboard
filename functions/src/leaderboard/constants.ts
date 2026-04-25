// Constants for the Edullent leaderboard cron + insights generator.
// Tweak with care — changing weights mid-term will discontinuously shift
// every student's composite score, which can cause confusing rank jumps.

export const REGION = "asia-south1" as const;
export const TIMEZONE = "Asia/Kolkata" as const;

// Composite score weights — must sum to 1.0.
export const WEIGHTS = {
  marks: 0.45,
  attendance: 0.20,
  assignments: 0.20,
  behavior: 0.15,
} as const;

// Schedule expressions in cron format (UTC interpreted via TIMEZONE).
export const SCHEDULE = {
  // ⚠️ TEMPORARY for testing — runs every 15 minutes so a fresh leaderboard
  //    appears within 15 min of deploy. REVERT TO "0 2 * * 1" before production.
  //    Original Mon-02:00-IST schedule:  "0 2 * * 1"
  leaderboardCron: "*/15 * * * *",
  // Daily 06:00 IST — runs every morning to update action progress.
  actionCheckCron: "0 6 * * *",
};

// OpenAI request bounds.
//
// Model choice is constrained by what your OpenAI Project has enabled.
// Verified at deploy time via `GET /v1/models` — your project (proj_8RkR4...)
// has only gpt-4.1-mini accessible. If you enable additional models in the
// OpenAI dashboard later, change this constant and redeploy.
export const OPENAI = {
  model: "gpt-4.1-mini" as const,
  temperature: 0.7,
  // 600 was hitting the cap on full action plans (4-6 actions × ~250 tokens
  // each + diagnosis + forecast). Truncated JSON → parse failure → fallback.
  // 1500 leaves headroom; gpt-4.1-mini output cost is negligible.
  maxTokens: 1500,
  // Run insights for N students concurrently, then sleep before the next batch.
  // Keeps us comfortably under OpenAI's RPM limits and lets the function
  // complete inside the 540s timeout for typical class sizes.
  batchSize: 5,
  delayBetweenBatchesMs: 1000,
};

// Action plan size scales with how much room the student has to grow —
// a student already at #1 needs fewer recommendations than one at #28.
export const ACTION_COUNT_BY_RANK_TIER = {
  top3: { min: 1, max: 2 },
  midRange: { min: 3, max: 4 },
  lowerHalf: { min: 4, max: 5 },
  struggling: { min: 5, max: 6 },
};

// Default behavior score when a student has no teacher remarks this week.
// Tuned to the middle of "good" so the absence of data isn't penalising.
export const DEFAULT_BEHAVIOR_SCORE = 70;

// Behavior score adjustment per teacher remark (read from parent_notes).
export const BEHAVIOR_DELTA_POSITIVE = 5;
export const BEHAVIOR_DELTA_NEGATIVE = -5;

// Keep the rolling history bounded so reads stay cheap.
export const RANK_HISTORY_MAX_WEEKS = 12;

// Per-function memory + timeout budget.
export const RUNTIME = {
  cron: { memory: "512MB" as const, timeoutSeconds: 540 },
  trigger: { memory: "512MB" as const, timeoutSeconds: 540 },
  callable: { memory: "256MB" as const, timeoutSeconds: 60 },
};
