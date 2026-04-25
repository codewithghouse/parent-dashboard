// Type definitions for the Class Leaderboard feature.
// Shared by frontend hooks, components, and (in Phase 4) Cloud Functions.

export type TrendDirection = 'up' | 'down' | 'same' | 'new';
export type ActionStatus = 'in_progress' | 'completed' | 'pending';
export type ActionTracking =
  | 'auto_assignments'
  | 'auto_test_score'
  | 'auto_attendance'
  | 'manual_teacher';

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
  status: 'strong' | 'good' | 'weak';
}

export interface TrajectoryPoint {
  weekId: string;
  weekLabel: string;
  rank: number;
}

export interface ActionProgress {
  current: number;
  target: number;
  type?: 'count' | 'percentage';
}

export interface ActionDetail {
  label: string;
  done: boolean;
  date?: string;
}

export interface DiagnosisItem {
  type: 'good' | 'concern' | 'note';
  text: string;
}

export interface ActionItem {
  id: string;
  title: string;
  reason: string;
  tracking: ActionTracking;
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
  diagnosis: DiagnosisItem[];
  subjects: SubjectScore[];
  trajectory: TrajectoryPoint[];
  topper: InsightsTopper;
  actions: ActionItem[];
  forecast: ForecastData;
  generatedAt: number;
  // Historical 'gpt-4o-mini' kept for back-compat with docs written before the
  // model migration; new docs use 'gpt-4.1-mini' (the only model the OpenAI
  // project has access to).
  aiModel: 'gpt-4.1-mini' | 'gpt-4o-mini' | 'fallback';
}
