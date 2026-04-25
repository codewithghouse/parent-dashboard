// Server-side type definitions for the leaderboard pipeline.
// Mirrors the frontend types in src/lib/leaderboardTypes.ts. We DO NOT
// import the frontend types because functions/ has its own tsconfig and
// node_modules; symbol drift between the two is caught by the rules-level
// schema validators (see firestore.rules §11.5) and by the tests.

export type TrendDirection = "up" | "down" | "same" | "new";
export type ActionStatus = "in_progress" | "completed" | "pending";
export type ActionTracking =
  | "auto_assignments"
  | "auto_test_score"
  | "auto_attendance"
  | "manual_teacher";

export interface ScoreBreakdown {
  marks: number;
  attendance: number;
  assignments: number;
  behavior: number;
}

export interface RankingEntry {
  studentId: string;
  name: string;
  initials: string;
  profileImage?: string;
  rank: number;
  previousRank: number | null;
  rankChange: number;
  trend: TrendDirection;
  trendLabel?: string;
  compositeScore: number;
  breakdown?: ScoreBreakdown;
  avatarBg: string;
  avatarText: string;
}

export interface LeaderboardDoc {
  classId: string;
  schoolId: string;
  weekId: string;
  weekStart: number;
  weekEnd: number;
  totalStudents: number;
  classAverage: number;
  rankings: RankingEntry[];
  generatedAt: number;
}

export interface SubjectScore {
  name: string;
  score: number;
  classAvg: number;
  status: "strong" | "good" | "weak";
}

export interface TrajectoryPoint {
  weekId: string;
  weekLabel: string;
  rank: number;
}

export interface ActionProgress {
  current: number;
  target: number;
  type?: "count" | "percentage";
}

export interface ActionDetail {
  label: string;
  done: boolean;
  date?: string;
}

export interface DiagnosisItem {
  type: "good" | "concern" | "note";
  text: string;
}

export interface ActionItem {
  id: string;
  title: string;
  reason: string;
  tracking: ActionTracking;
  // OpenAI extras the cron uses to auto-track:
  targetSubject?: string | null;
  targetValue?: number;
  targetPeriod?: "this_week" | "next_week" | "next_test";
  status: ActionStatus;
  progress?: ActionProgress;
  details?: ActionDetail[];
  hint?: string;
  reward?: string;
  scoreReward?: number;
  createdAt: number;
  completedAt?: number;
}

export interface ForecastScenario {
  actions: number;
  rank: number;
  label: string;
  highlight?: boolean;
}

export interface ForecastData {
  projectedRank: number;
  rankChange: number;
  confidence: number;
  scenarios: ForecastScenario[];
}

export interface InsightsTopper {
  name: string;
  initials: string;
  score: number;
  breakdown: ScoreBreakdown;
}

export interface InsightsDoc {
  studentId: string;
  weekId: string;
  schoolId: string;
  diagnosis: DiagnosisItem[];
  subjects: SubjectScore[];
  trajectory: TrajectoryPoint[];
  topper: InsightsTopper;
  actions: ActionItem[];
  forecast: ForecastData;
  generatedAt: number;
  aiModel: "gpt-4.1-mini" | "gpt-4o-mini" | "fallback";
}

export interface StudentMetricsDoc {
  studentId: string;
  schoolId: string;
  classId: string;
  weekId: string;
  marksAvg: number;
  attendancePct: number;
  assignmentsPct: number;
  behaviorScore: number;
  compositeScore: number;
  weekStart: number;
  weekEnd: number;
  updatedAt: number;
}

export interface SubjectMetricsDoc {
  studentId: string;
  schoolId: string;
  weekId: string;
  subjects: Record<string, number>;
  classAverages: Record<string, number>;
  updatedAt: number;
}

export interface RankHistoryDoc {
  studentId: string;
  schoolId: string;
  weeks: { weekId: string; weekLabel: string; rank: number; score: number }[];
  updatedAt: number;
}

// What the cron computes per student before ranking.
export interface DerivedStudentSnapshot {
  studentId: string;
  name: string;
  classId: string;
  schoolId: string;
  enrolledAt: number;        // tie-break fallback (older wins)
  breakdown: ScoreBreakdown;
  compositeScore: number;
  subjectScores: Record<string, number>;
}
