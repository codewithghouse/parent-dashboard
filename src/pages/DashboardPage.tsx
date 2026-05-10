import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { CheckCircle, AlertCircle, Calendar, Star, Clock, Loader2, ShieldCheck, BrainCircuit, Sparkles, TrendingUp, BookOpen, Download, Trophy, ArrowRight, BarChart3, ClipboardList, Award, RefreshCw } from "lucide-react";
import { selectParentingTips } from "../ai/system/parenting-tips";
import { generateWeeklyReport } from "../ai/engines/weekly-report-engine";
import WeeklyReportPDF from "../components/WeeklyReportPDF";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDocs, Timestamp } from "firebase/firestore";
import { subscribeEnrollments } from "@/lib/enrollmentQuery";
import { fetchPerStudent, subscribePerStudent } from "@/lib/perStudentQuery";
import { buildAlerts } from "@/lib/alertBuilder";
import { useSchoolSettings, resolveAcademicYear } from "@/hooks/useSchoolSettings";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

function timeAgo(date: Date): string {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 172800) return "Yesterday";
  return date.toLocaleDateString();
}

// IST-anchored day-of-week (0=Sun..6=Sat). Avoids the "Friday window shifts by
// timezone" bug where a parent in EST sees the wrong report-generate state.
function istDayOfWeek(d: Date = new Date()): number {
  const istString = d.toLocaleString("en-US", { timeZone: "Asia/Kolkata", weekday: "short" });
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[istString] ?? d.getDay();
}

// Smart class label — avoids "Grade Grade 10B" when className already starts
// with "Grade" or "Class".
function classDisplay(className: string | undefined | null): string {
  const c = (className || "").trim();
  if (!c || c === "—") return "—";
  if (/^(grade|class)\s/i.test(c)) return c;
  return `Grade ${c}`;
}

// Module-level design tokens (P1-4 partial refactor). Single source of truth
// for the Blue Apple palette used by both mobile and desktop branches —
// previously duplicated 22 const declarations × 2 = 44 lines.
const T_DASH = {
  IND: "#0055FF",
  IND2: "#1166FF",
  IND3: "#4499FF",
  BG: "#EEF4FF",
  T1: "#001040",
  T2: "#002080",
  T3: "#5070B0",
  T4: "#99AACC",
  SEP: "rgba(0,85,255,0.07)",
  IND_BDR: "rgba(0,85,255,0.10)",
  IND_SOFT: "rgba(0,85,255,0.05)",
  GREEN: "#00C853",
  GREEN_S: "rgba(0,200,83,0.12)",
  GREEN_B: "rgba(0,200,83,0.25)",
  ORANGE: "#FF8800",
  ORANGE_S: "rgba(255,136,0,0.12)",
  ORANGE_B: "rgba(255,136,0,0.25)",
  ROSE: "#FF3355",
  ROSE_S: "rgba(255,51,85,0.10)",
  IND_DARK_GRAD: "linear-gradient(140deg, #001888 0%, #0033CC 48%, #0055FF 100%)",
  SH: "0 0 0 0.5px rgba(0,85,255,0.08), 0 2px 8px rgba(0,85,255,0.09), 0 10px 28px rgba(0,85,255,0.11)",
  SH_LG: "0 0 0 0.5px rgba(0,85,255,0.10), 0 4px 16px rgba(0,85,255,0.12), 0 20px 48px rgba(0,85,255,0.14)",
  SH_BTN: "0 4px 14px rgba(0,85,255,0.32), 0 1px 4px rgba(0,85,255,0.18)",
} as const;

// P3-2: Tiny isolated sub-component for the desktop greeting date display.
// Holds its own currentTime ticker so the parent's 1900-line tree doesn't
// re-render every minute. Only the date/day text re-renders.
const LiveDateDisplay = ({ T2, T4 }: { T2: string; T4: string }) => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-end">
      <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T4 }}>
        {now.toLocaleDateString("en-US", { weekday: "long" })}
      </span>
      <span className="text-[14px] font-semibold mt-[2px]" style={{ color: T2 }}>
        {now.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
      </span>
    </div>
  );
};

// Rule-based child summary narrative — replaces the AI dashboard-insights
// call (memory: parent_dashboard_ai_strategy + ai_cleanup_progress). The AI
// version cost ~$0.001-0.005 per dashboard load and just restated the
// numbers already on the cards above. Pure rule-based, deterministic, free.
function buildChildSummaryNarrative(opts: {
  childName: string;
  attendance: number | null;
  avgScore: number;
  pending: number | null;
  tests: number | null;
  recentGrade: string;
  recentSubject: string;
  trendPct: number;
  hasAnyData: boolean;
}): string {
  if (!opts.hasAnyData) {
    return "is just getting started — no data on record yet. Performance signals will appear as scores and attendance roll in.";
  }
  const parts: string[] = [];

  // Headline — academic standing
  if (opts.avgScore > 0) {
    if (opts.avgScore >= 80) parts.push(`is performing strongly with a ${opts.avgScore}% average`);
    else if (opts.avgScore >= 60) parts.push(`is holding steady at a ${opts.avgScore}% average`);
    else parts.push(`is averaging ${opts.avgScore}% — room for improvement`);
  }

  // Trend
  if (opts.trendPct > 5) parts.push(`recent tests are up ${opts.trendPct}% versus the prior set`);
  else if (opts.trendPct < -5) parts.push(`recent tests are down ${Math.abs(opts.trendPct)}% versus the prior set — worth a check-in`);

  // Attendance
  if (opts.attendance !== null) {
    if (opts.attendance >= 90) parts.push(`attendance is excellent at ${opts.attendance}%`);
    else if (opts.attendance >= 85) parts.push(`attendance is on track at ${opts.attendance}%`);
    else parts.push(`attendance has slipped to ${opts.attendance}% — below the 85% target`);
  }

  // Pending work
  if (opts.pending !== null && opts.pending > 0) {
    parts.push(opts.pending === 1
      ? `has 1 assignment pending`
      : `has ${opts.pending} assignments pending`);
  }

  // Upcoming tests
  if (opts.tests !== null && opts.tests > 0) {
    parts.push(opts.tests === 1
      ? `has 1 test in the next 7 days`
      : `has ${opts.tests} tests in the next 7 days`);
  }

  // Recent test highlight
  if (opts.recentGrade !== "N/A" && opts.recentSubject !== "—") {
    parts.push(`most recent grade is ${opts.recentGrade} in ${opts.recentSubject}`);
  }

  if (parts.length === 0) return "is enrolled but no graded activity yet — nothing to summarise.";
  return parts.join("; ") + ".";
}

// Parenting tips are now sourced from a curated 50-tip library (signal-tagged).
// See src/ai/system/parenting-tips.ts. Kept this thin adapter so the existing
// callsite stays a single line.
function generateSmartParentingTips(
  stats: { attendance: number | null; avgScore: number; pending: number | null; tests: number | null },
  childName: string,
  grade?: string | number | null,
) {
  return selectParentingTips({
    attendance: stats.attendance,
    avgScore: stats.avgScore,
    pending: stats.pending,
    tests: stats.tests,
    childName,
    grade: grade ?? null,
  }, 3);
}

function getInitials(name: string): string {
  return (name || "")
    .split(" ")
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || "")
    .join("");
}

/** Thin horizontal bar */
function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}80` }} />
    </div>
  );
}

/** Score arc (half-circle gauge) */
function ScoreArc({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const stroke = 9;
  const r = (size - stroke * 2) / 2;
  const circ = Math.PI * r; // half circle
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  const cx = size / 2, cy = size / 2 + 8;
  return (
    <div className="relative flex items-end justify-center" style={{ width: size, height: size / 2 + 14 }}>
      <svg width={size} height={size / 2 + 10} style={{ overflow: "visible" }}>
        <path d={`M ${stroke} ${cy} A ${r} ${r} 0 0 1 ${size - stroke} ${cy}`}
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} strokeLinecap="round" />
        <path d={`M ${stroke} ${cy} A ${r} ${r} 0 0 1 ${size - stroke} ${cy}`}
          fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease", filter: `drop-shadow(0 0 6px ${color}90)` }} />
      </svg>
      <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
        <span className="text-sm font-black text-white leading-none">{pct > 0 ? `${pct}%` : "N/A"}</span>
      </div>
    </div>
  );
}

const DashboardPage = () => {
  const { studentData, user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const settings = useSchoolSettings();
  // Real academic year — replaces two hardcoded "2025-26" strings.
  const academicYear = resolveAcademicYear(settings);
  // aiInsights is now rule-based (no AI call) — see useMemo below the
  // listeners. Kept the same shape `{ child_summary_narrative: string }`
  // so the JSX that consumes it doesn't have to change.
  // Initial defaults must NOT look like real data. attendance:100 was showing
  // "100% attendance" for brand-new students who had zero records — making
  // the dashboard appear to have data that didn't exist in Firestore.
  // Use null to mean "no data yet"; UI renders "—" instead of a fake percentage.
  const [liveStats, setLiveStats] = useState<{
    attendance: number | null;
    pending: number | null;
    tests: number | null;
    avgScore: number;
    recentGrade: string;
    recentSubject: string;
    trendPct: number;
    hasAttendanceData: boolean;
    hasAssignmentData: boolean;
    hasTestData: boolean;
    hasScoreData: boolean;
  }>({
    attendance: null,
    pending: null,
    tests: null,
    avgScore: 0,
    recentGrade: "N/A",
    recentSubject: "—",
    trendPct: 0,
    hasAttendanceData: false,
    hasAssignmentData: false,
    hasTestData: false,
    hasScoreData: false,
  });
  // Raw alert sources — fed to buildAlerts() (shared with AlertsPage).
  // recentAlerts is DERIVED via useMemo from these + raw assignments/scores
  // already collected for the stat cards. Single source of truth (lib/alertBuilder.ts)
  // means Dashboard and AlertsPage can never drift apart again.
  const [risksRaw, setRisksRaw] = useState<any[]>([]);
  const [attendanceRaw, setAttendanceRaw] = useState<any[]>([]);
  const [scoresRaw, setScoresRaw] = useState<any[]>([]);
  const [notesRaw, setNotesRaw] = useState<any[]>([]);
  const [assignmentsRaw, setAssignmentsRaw] = useState<any[]>([]);
  const [submissionsRaw, setSubmissionsRaw] = useState<any[]>([]);
  const [teacherInfo, setTeacherInfo] = useState({ name: "—" });
  const [studentMeta, setStudentMeta] = useState({ className: "—", rollNo: "—" });
  // currentTime here is only used for the morning/afternoon/evening greeting
  // (calculated once per day boundary). The minute-by-minute date display lives
  // in <LiveDateDisplay /> so this parent doesn't re-render every 60s.
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dataLoading, setDataLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [smartTips, setSmartTips] = useState<{ tip: string; reason: string }[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<any>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfData, setPdfData] = useState<any>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Refresh `currentTime` only every 30 minutes — enough to flip the greeting
  // ("Good Morning"→"Good Afternoon" etc.) without forcing a full rerender on
  // a 1900-line tree once a minute.
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 30 * 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!studentData?.id) return;
    const schoolId = studentData.schoolId;

    // Helper: build a scoped query (schoolId filter when available prevents cross-school reads).
    // Used ONLY for class-scoped queries (assignments/tests by classId).
    // Per-student reads (attendance/risks/results/gradebook_scores/submissions)
    // MUST use subscribePerStudent / fetchPerStudent for the dual-key (id+email)
    // pattern — single-key sq() silently drops legacy docs (memory: dual_query_pattern_studentid_email).
    const sq = (collName: string, field = "studentId", value = studentData.id) =>
      schoolId
        ? query(collection(db, collName), where("schoolId", "==", schoolId), where(field, "==", value))
        : query(collection(db, collName), where(field, "==", value));

    // Shared error handler — all listeners below route here so a rule rejection
    // or network blip can't leave the UI stuck in an indeterminate state.
    const onListenerError = (label: string) => (err: Error) => {
      console.error(`[Dashboard] ${label} listener error:`, err);
      setDataLoading(false);
    };

    // 1. Attendance — DUAL-KEY (id + email merge) per dual_query_pattern memory.
    // Single-query missed any attendance doc written with only studentEmail.
    const u1 = subscribePerStudent({
      collection: "attendance",
      student: studentData,
      onChange: (docs) => {
        const records = docs.map(d => ({ id: d.id, ...d.data() as any }));
        setAttendanceRaw(records); // for buildAlerts
        if (records.length === 0) {
          setLiveStats(prev => ({ ...prev, attendance: null, hasAttendanceData: false }));
          return;
        }
        const present = records.filter((r: any) => r.status === "present" || r.status === "late").length;
        const pct = Math.round((present / records.length) * 100);
        setLiveStats(prev => ({ ...prev, attendance: pct, hasAttendanceData: true }));
      },
      onError: onListenerError("attendance"),
    });

    // 2. Enrollments → assignments + tests (single listener, was 2 + unbounded classIds)
    let enSnap: any = null;
    const processEnroll = async () => {
      const docs = enSnap?.docs || [];
      if (!docs.length) {
        // No enrollments → student not in any class → no pending/tests data exists.
        // Mark explicitly as "no data" so UI can render empty state instead of "0".
        setLiveStats(prev => ({
          ...prev,
          pending: null,
          tests: null,
          hasAssignmentData: false,
          hasTestData: false,
        }));
        setTeacherInfo({ name: "—" });
        setStudentMeta({ className: "—", rollNo: "—" });
        setDataLoading(false);
        return;
      }
      const first = docs[0].data();
      setTeacherInfo({ name: first.teacherName || "—" });
      setStudentMeta({
        className: first.className || studentData?.grade || "—",
        rollNo: first.rollNo || studentData?.rollNo || "—",
      });
      const classIds = [...new Set(docs.map((d: any) => d.data().classId).filter(Boolean))] as string[];
      if (!classIds.length) {
        setLiveStats(prev => ({
          ...prev,
          pending: null,
          tests: null,
          hasAssignmentData: false,
          hasTestData: false,
        }));
        setDataLoading(false);
        return;
      }

      // Chunk classIds to handle >10 (Firestore "in" operator limit)
      const chunks: string[][] = [];
      for (let i = 0; i < classIds.length; i += 10) chunks.push(classIds.slice(i, i + 10));

      // CRITICAL: every assignments/tests query MUST include schoolId — otherwise
      // a colliding classId across schools leaks another school's data into this
      // parent's dashboard. Same pattern enforced via Firestore rules but we
      // belt-and-braces it client-side too.
      const buildQ = (coll: string, ids: string[]) =>
        schoolId
          ? query(collection(db, coll), where("schoolId", "==", schoolId), where("classId", "in", ids))
          : query(collection(db, coll), where("classId", "in", ids));

      // submissions: dual-key (id + email merge) — single-query was missing
      // submissions where only studentEmail was set on the write.
      const [aSnaps, tSnaps, subDocs] = await Promise.all([
        Promise.all(chunks.map(c => getDocs(buildQ("assignments", c)))),
        Promise.all(chunks.map(c => getDocs(buildQ("tests", c)))),
        fetchPerStudent({ collection: "submissions", student: studentData }),
      ]);
      const allAssignments = aSnaps.flatMap(s => s.docs);
      const allTests = tSnaps.flatMap(s => s.docs);
      const subIds = new Set(subDocs.flatMap(d => [d.data().homeworkId, d.data().assignmentId].filter(Boolean)));
      // Stash raw assignments + submissions so buildAlerts can synthesize
      // overdue / due-soon alerts. Single source of truth with AlertsPage.
      setAssignmentsRaw(allAssignments.map(d => ({ id: d.id, ...d.data() as any })));
      setSubmissionsRaw(subDocs.map(d => ({ id: d.id, ...d.data() as any })));
      const today = new Date().toISOString().split("T")[0];
      const nw = new Date(); nw.setDate(nw.getDate() + 7);
      const nextWeekStr = nw.toISOString().split("T")[0];
      // P1-2: pending = NOT submitted AND (no due date OR due in future or
      // recently due within 14 days). Old assignments stay archived, not
      // counted as pending forever.
      const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const pendingCutoff = fourteenDaysAgo.toISOString().split("T")[0];
      const pending = allAssignments.filter(d => {
        if (subIds.has(d.id)) return false;
        const due = (d.data().dueDate as string) || "";
        if (!due) return true; // no due date — count as pending
        return due >= pendingCutoff;
      }).length;
      // Tests writer (CreateTest.tsx) writes `testDate`. Some legacy docs may
      // have `date` instead — be tolerant. Filter to "scheduled within next 7
      // days" (already-past tests are not "upcoming").
      const tests = allTests.filter(d => {
        const data = d.data();
        const dt = (data.testDate as string) || (data.date as string) || "";
        if (!dt) return false;
        return dt >= today && dt <= nextWeekStr;
      }).length;
      setLiveStats(prev => ({
        ...prev,
        pending,
        tests,
        hasAssignmentData: allAssignments.length > 0,
        hasTestData: allTests.length > 0,
      }));
      setDataLoading(false);
    };
    // Use the dual-listener helper so legacy enrollments (where studentId
    // was set to email by older teacher/principal-dashboard code) are also
    // picked up — otherwise pending/tests show "no data" for those students.
    const u2 = subscribeEnrollments(studentData, (docs) => {
      enSnap = { docs };
      processEnroll();
    });

    // 3. Results + gradebook — single listener each (was 4).
    // P1-3: wait until BOTH snapshots have arrived once before computing,
    // so the avg doesn't briefly flash a partial value on the first render.
    let rSnap: any = null, gSnap: any = null;
    const processResults = () => {
      if (rSnap === null || gSnap === null) return;
      const testRes = (rSnap?.docs || []).map((d: any) => ({ id: d.id, ...d.data() as any }));
      const gbRes = (gSnap?.docs || []).map((d: any) => {
        const data = d.data();
        // P0-2: type-safe Timestamp.fromMillis — string/NaN/etc. would throw
        // and crash this listener, blanking out the entire avg score.
        const ts = (typeof data.updatedAt === "number" && Number.isFinite(data.updatedAt))
          ? Timestamp.fromMillis(data.updatedAt)
          : Timestamp.now();
        return { id: d.id, ...data, score: (data.mark / (data.maxMarks || 100)) * 100, subject: data.subject || data.className || "General", timestamp: ts };
      });
      // Stash merged scores so buildAlerts can synthesize Excellent/Below-Passing alerts
      setScoresRaw([...testRes, ...gbRes]);
      const all = Array.from(new Map([...testRes, ...gbRes].map(d => [d.id, d])).values())
        .sort((a, b) => (b.timestamp?.toDate()?.getTime() || 0) - (a.timestamp?.toDate()?.getTime() || 0));
      if (!all.length) {
        // No scores at all → keep defaults but mark as "no data" so UI knows.
        setLiveStats(prev => ({
          ...prev,
          avgScore: 0,
          recentGrade: "N/A",
          recentSubject: "—",
          trendPct: 0,
          hasScoreData: false,
        }));
        return;
      }
      const avg = all.reduce((s, r) => s + (parseFloat(r.score) || 0), 0) / all.length;
      const latest = all[0];
      const grade = (s: number) => s >= 90 ? "A+" : s >= 80 ? "A" : s >= 70 ? "A-" : s >= 60 ? "B" : "C";

      // P3-3: trend bucketed by ACTUAL week boundaries (last 7 days vs prior
      // 7 days), not the last-3-vs-prior-3 sample which could span 6 tests
      // taken across 2 days and call that a "trend".
      const nowMs = Date.now();
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const lastWeekStart = nowMs - weekMs;
      const priorWeekStart = nowMs - 2 * weekMs;
      const lastWeek: number[] = [];
      const priorWeek: number[] = [];
      for (const r of all) {
        const ts = r.timestamp?.toDate?.()?.getTime?.() ?? 0;
        const score = parseFloat(r.score);
        if (!Number.isFinite(score)) continue;
        if (ts >= lastWeekStart) lastWeek.push(score);
        else if (ts >= priorWeekStart) priorWeek.push(score);
      }
      let trendPct = 0;
      if (lastWeek.length > 0 && priorWeek.length > 0) {
        const recentAvg = lastWeek.reduce((a, b) => a + b, 0) / lastWeek.length;
        const prevAvg = priorWeek.reduce((a, b) => a + b, 0) / priorWeek.length;
        trendPct = Math.round(recentAvg - prevAvg);
      }
      setLiveStats(prev => ({
        ...prev,
        avgScore: Math.round(avg),
        recentGrade: grade(parseFloat(latest.score) || 0),
        recentSubject: latest.className || latest.subject || "—",
        trendPct,
        hasScoreData: true,
      }));
    };
    // results + gradebook_scores: DUAL-KEY per dual_query_pattern memory.
    // Wraps the dual-snapshot helper to keep the same {docs:[]} shape that
    // processResults expects.
    const u3 = subscribePerStudent({
      collection: "results",
      student: studentData,
      onChange: (docs) => { rSnap = { docs }; processResults(); },
      onError: onListenerError("results"),
    });
    const u4 = subscribePerStudent({
      collection: "gradebook_scores",
      student: studentData,
      onChange: (docs) => { gSnap = { docs }; processResults(); },
      onError: onListenerError("gradebook_scores"),
    });

    // 4. Risks — DUAL-KEY (id + email merge) per dual_query_pattern memory.
    // Just stashes raw — synthesis happens in the buildAlerts useMemo below.
    const u5 = subscribePerStudent({
      collection: "risks",
      student: studentData,
      onChange: (docs) => {
        setRisksRaw(docs.map(d => ({ id: d.id, ...d.data() as any })));
      },
      onError: onListenerError("risks"),
    });

    // 5. Parent notes — drives the "Note from teacher" alerts. Was missing
    // from Dashboard entirely until 2026-05-21; AlertsPage had it from day 1.
    const u6 = subscribePerStudent({
      collection: "parent_notes",
      student: studentData,
      onChange: (docs) => {
        setNotesRaw(docs.map(d => ({ id: d.id, ...d.data() as any })));
      },
      onError: onListenerError("parent_notes"),
    });

    // Stamp the last successful data load so the "Updated <time>" badge is honest.
    setLastUpdatedAt(new Date());

    return () => [u1, u2, u3, u4, u5, u6].forEach(u => u());
    // studentData?.email IS REQUIRED in deps — per memory dual_query_pattern_studentid_email.
    // Without it, listeners that race ahead of email resolution never re-subscribe
    // with the email-side query, silently dropping any per-student doc whose
    // studentId field doesn't match the parent's auth doc id.
  }, [studentData?.id, studentData?.schoolId, studentData?.email, studentData?.studentEmail, refreshKey]);

  // P0-3: assignments + tests are one-shot getDocs (live-onSnapshot would
  // require nested listener management). To keep the UI honest about freshness,
  // refetch when the parent returns to the tab. Combined with the visible
  // "Updated <time>" badge replacing the dishonest "LIVE" pulse pill.
  useEffect(() => {
    const onFocus = () => {
      if (mountedRef.current) setRefreshKey(k => k + 1);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    if (dataLoading) return;
    setSmartTips(generateSmartParentingTips(liveStats, studentData?.name?.split(" ")[0] || "", studentData?.grade));
  }, [dataLoading, liveStats.attendance, liveStats.avgScore, liveStats.pending, liveStats.tests, studentData?.grade, studentData?.name]);

  // Week config: Fri/Sat/Sun = generate window; Mon = prev week report + block.
  // P2-1: anchored to IST so a parent in another timezone doesn't see the
  // wrong report-generate state.
  const getWeekConfig = () => {
    const now = new Date();
    const day = istDayOfWeek(now); // 0=Sun..6=Sat in IST
    // This week's Sunday (end of this reporting week)
    const thisSunday = new Date(now);
    thisSunday.setDate(now.getDate() + (day === 0 ? 0 : 7 - day));
    const thisWeekKey = `weekly_report_${studentData?.id}_${thisSunday.toISOString().split("T")[0]}`;
    // Previous week's Sunday
    const prevSunday = new Date(thisSunday);
    prevSunday.setDate(prevSunday.getDate() - 7);
    const prevWeekKey = `weekly_report_${studentData?.id}_${prevSunday.toISOString().split("T")[0]}`;
    const canGenerate = day === 5 || day === 6 || day === 0;
    const daysLeft = ({ 1: 4, 2: 3, 3: 2, 4: 1 } as any)[day] ?? 0;
    return { canGenerate, thisWeekKey, prevWeekKey, isMonday: day === 1, daysLeft, day };
  };

  // Load cached weekly report on mount
  useEffect(() => {
    if (!studentData?.id) return;
    const { thisWeekKey, prevWeekKey, isMonday, canGenerate } = getWeekConfig();
    // Try current week first
    const cached = localStorage.getItem(thisWeekKey);
    if (cached) { try { setWeeklyReport(JSON.parse(cached)); return; } catch {} }
    // Monday with no current report → load prev week's report (read-only)
    if (isMonday || !canGenerate) {
      const prevCached = localStorage.getItem(prevWeekKey);
      if (prevCached) { try { setWeeklyReport(JSON.parse(prevCached)); } catch {} }
    }
  }, [studentData?.id]);

  const handleGenerateWeeklyReport = async () => {
    if (!studentData?.id || weeklyLoading) return;
    setWeeklyLoading(true);
    try {
      const now = new Date();
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - 6); weekStart.setHours(0, 0, 0, 0);
      const weekStartStr = weekStart.toISOString().split("T")[0];
      const weekEndStr = now.toISOString().split("T")[0];
      const { thisWeekKey: weekCacheKey } = getWeekConfig();

      // Dual-query (studentId + studentEmail) helper — see lib/perStudentQuery.ts
      // for why this matters. Range filters go via studentIdOnlyFilters so the
      // email listener doesn't FAILED_PRECONDITION on missing composite indexes;
      // we post-filter the email-matched docs client-side.

      // Attendance — fetch broadly, post-filter to this week
      const attDocsRaw = await fetchPerStudent({
        collection: "attendance",
        student: studentData,
        studentIdOnlyFilters: [where("date", ">=", weekStartStr)],
      });
      const attDocs = attDocsRaw
        .map(d => d.data())
        .filter((d: any) => !d.date || d.date >= weekStartStr);
      const attPresent = attDocs.filter((d: any) => d.status === "present").length;
      const attLate = attDocs.filter((d: any) => d.status === "late").length;
      const attAbsent = attDocs.filter((d: any) => d.status === "absent").length;
      const attTotal = attDocs.length;
      // Don't fake 100% when there are zero attendance records this week —
      // 0 conveys "no data" without misleading the parent.
      const attPct = attTotal === 0 ? 0 : Math.round(((attPresent + attLate) / attTotal) * 100);

      // Results — no range filter, post-filter on date string
      const resDocsRaw = await fetchPerStudent({ collection: "results", student: studentData });
      const resDocs = resDocsRaw.map(d => d.data());
      const weekTests = resDocs
        .filter((d: any) => { const dt = d.date || d.createdAt?.toDate?.()?.toISOString?.()?.split?.("T")?.[0] || ""; return dt >= weekStartStr; })
        .map((d: any) => {
          const score = parseFloat(d.score) || 0;
          const max = parseFloat(d.maxScore || d.totalMarks || 100);
          const pct = (score / max) * 100;
          return { subject: d.subject || d.className || "General", score, max, grade: pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B+" : pct >= 60 ? "B" : "C" };
        });

      // Submissions this week (range filter on studentId side, post-filter on email side)
      const subDocsRaw = await fetchPerStudent({
        collection: "submissions",
        student: studentData,
        studentIdOnlyFilters: [where("submittedAt", ">=", Timestamp.fromDate(weekStart))],
      });
      const submittedThisWeek = subDocsRaw.filter((d) => {
        const sa = (d.data() as any).submittedAt;
        const ms = sa?.toMillis?.() ?? (sa?.seconds ? sa.seconds * 1000 : 0);
        return ms >= weekStart.getTime();
      }).length;
      const pendingNow = liveStats.pending ?? 0;

      const reportData = {
        child_name: studentData.name,
        grade: studentData.grade || "—",
        week_start: weekStartStr,
        week_end: weekEndStr,
        attendance: { present: attPresent, absent: attAbsent, late: attLate, total: attTotal, pct: attPct },
        tests: weekTests,
        assignments: {
          total: submittedThisWeek + pendingNow,
          submitted: submittedThisWeek,
          pending: pendingNow,
        },
        overall_avg: liveStats.avgScore,
        recent_alerts: recentAlerts.map(a => a.title).slice(0, 3),
      };

      const report = await generateWeeklyReport(reportData);
      if (report) {
        setWeeklyReport(report);
        setPdfData({ ...reportData, weekEnd: weekEndStr });
        // P3-1: surface storage-quota errors so the parent knows the report
        // wasn't cached (will need re-generate on next visit). Other errors
        // (private mode, etc.) we still swallow silently — non-critical.
        try {
          localStorage.setItem(weekCacheKey, JSON.stringify(report));
        } catch (storageErr: unknown) {
          const err = storageErr as { name?: string };
          if (err?.name === "QuotaExceededError") {
            toast.warning("Report shown but couldn't be saved — browser storage is full.");
          }
        }
      }
    } catch (e) {
      console.error("Weekly report generation failed:", e);
      toast.error("Couldn't generate weekly report. Please try again.");
    } finally {
      setWeeklyLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!pdfRef.current || !weeklyReport) return;
    setPdfDownloading(true);

    const el = pdfRef.current;
    const wrapper = el.parentElement as HTMLElement | null;

    // Temporarily bring into viewport so html2canvas can render SVGs correctly
    const origStyle = wrapper?.style.cssText || "";
    if (wrapper) {
      wrapper.style.cssText =
        "position:fixed;top:0;left:0;z-index:99999;background:#fff;overflow:auto;";
    }

    // P3-5: capture wrapper ref locally — if user navigates away mid-render,
    // wrapper.style assignment in the catch/finally still works on the
    // (still-DOM-attached) original element rather than the unmounted one.
    const restoreWrapper = () => {
      if (wrapper && wrapper.isConnected) wrapper.style.cssText = origStyle;
    };

    try {
      await new Promise(r => setTimeout(r, 300));

      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).jsPDF;

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#060e1c",
        logging: false,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });

      restoreWrapper();

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;

      let y = 0;
      while (y < imgH) {
        pdf.addImage(imgData, "PNG", 0, -y, pageW, imgH);
        if (y + pageH < imgH) pdf.addPage();
        y += pageH;
      }
      pdf.save(`${studentData?.name || "Student"}_WeeklyReport_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (e) {
      console.error("PDF generation failed:", e);
      restoreWrapper();
      toast.error("Couldn't generate PDF. Please try again.");
    } finally {
      if (mountedRef.current) setPdfDownloading(false);
    }
  };

  // Derived recent alerts — synthesized via the SHARED buildAlerts lib that
  // AlertsPage also uses. Single source of truth: extending alert logic here
  // automatically improves the AlertsPage too. Slice to top 3 (already sorted
  // by priority: High → Medium → Good News → General). Maps to the small UI
  // shape with subject chip + urgency color.
  const recentAlerts = useMemo(() => {
    const all = buildAlerts({
      studentName: studentData?.name || "Student",
      risks: risksRaw,
      attendance: attendanceRaw,
      scores: scoresRaw,
      assignments: assignmentsRaw,
      submissions: submissionsRaw,
      notes: notesRaw,
    });
    const top3 = all.slice(0, 3);
    return top3.map(a => ({
      id: a.id,
      title: a.title,
      time: a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt instanceof Date ? a.createdAt : new Date()),
      urgent: a.priority === "High Priority",
      subject: a.subject || "",
      category: a.subject || a.category || "General",
    }));
  }, [studentData?.name, risksRaw, attendanceRaw, scoresRaw, assignmentsRaw, submissionsRaw, notesRaw]);

  // P0-1: rule-based child summary — replaces ParentAIController.getDashboardInsights
  // which was a real AI call (~$0.001-0.005 per dashboard load) just narrating
  // the same numbers already on the cards above. Per memory parent_dashboard_ai_strategy.
  const aiInsights = useMemo(() => {
    if (dataLoading) return null;
    const hasAnyData =
      liveStats.hasAttendanceData ||
      liveStats.hasAssignmentData ||
      liveStats.hasTestData ||
      liveStats.hasScoreData;
    if (!hasAnyData) return null;
    return {
      child_summary_narrative: buildChildSummaryNarrative({
        childName: studentData?.name?.split(" ")[0] || "Student",
        attendance: liveStats.attendance,
        avgScore: liveStats.avgScore,
        pending: liveStats.pending,
        tests: liveStats.tests,
        recentGrade: liveStats.recentGrade,
        recentSubject: liveStats.recentSubject,
        trendPct: liveStats.trendPct,
        hasAnyData,
      }),
    };
  }, [
    dataLoading,
    liveStats.hasAttendanceData, liveStats.hasAssignmentData, liveStats.hasTestData, liveStats.hasScoreData,
    liveStats.attendance, liveStats.avgScore, liveStats.pending, liveStats.tests,
    liveStats.recentGrade, liveStats.recentSubject, liveStats.trendPct,
    studentData?.name,
  ]);

  if (studentData?.status === "Invited") return (
    <div className="h-[80vh] flex flex-col items-center justify-center p-10 text-center gap-4">
      <Loader2 className="w-12 h-12 text-[#1e3a8a] animate-spin opacity-40" />
      <h2 className="text-xl font-bold text-slate-700">Setting up your account...</h2>
      <p className="text-sm text-slate-400">Your access is being provisioned. Please wait.</p>
    </div>
  );

  const greeting = currentTime.getHours() < 12 ? "Good Morning" : currentTime.getHours() < 17 ? "Good Afternoon" : "Good Evening";
  const parentFirstName = user?.displayName?.split(" ")[0] || "Parent";
  const childFirstName = studentData?.name?.split(" ")[0] || "your child";
  const userInitials = getInitials(user?.displayName || "") || "P";
  const studentInitials = getInitials(studentData?.name || "") || "S";
  const weekConfig = getWeekConfig();
  const isPrevWeekReport = !!weeklyReport && !weekConfig.canGenerate && !localStorage.getItem(weekConfig.thisWeekKey);

  // Null-safe display strings — used by BOTH mobile and desktop branches.
  // Defined here (function scope) so neither return path duplicates the logic.
  const attDisplay = liveStats.attendance === null ? "—" : `${liveStats.attendance}%`;
  const pendingDisplay = liveStats.pending === null ? "—" : liveStats.pending.toString();
  const testsDisplay = liveStats.tests === null ? "—" : liveStats.tests.toString();

  /* ═══════════════════════════════════════════════════════════════
     MOBILE — Edullent Indigo Apple UI
     ═══════════════════════════════════════════════════════════════ */
  if (isMobile) {
    // P1-4: tokens sourced from module-level T_DASH — single source of truth.
    // Destructure all 22 tokens (noUnusedLocals:false in tsconfig) to avoid
    // "X is not defined" runtime errors from any usage we might have missed.
    const {
      IND, IND2, IND3, BG, T1, T2, T3, T4, SEP, IND_BDR, IND_SOFT,
      GREEN, GREEN_S, GREEN_B, ORANGE, ORANGE_S, ORANGE_B, ROSE, ROSE_S,
      IND_DARK_GRAD, SH, SH_LG, SH_BTN,
    } = T_DASH;
    void IND2; void T2; void ROSE_S; // suppress unused warnings if any branch doesn't use these
    // Academic Health ring
    const scorePct = Math.min(liveStats.avgScore, 100);
    const ringR = 40, ringCirc = 2 * Math.PI * ringR;
    const ringOffset = ringCirc - (scorePct / 100) * ringCirc;
    // Status flags — null means "no data", which is NOT the same as 0% / on-track.
    const attOnTrack = liveStats.attendance !== null && liveStats.attendance >= 85;
    const noPending = liveStats.pending === 0;
    const isImproving = liveStats.trendPct > 0;
    const isDeclining = liveStats.trendPct < 0;
    const trendStable = liveStats.trendPct === 0;

    return (
      <div className="animate-in fade-in duration-500 -mx-3 -mt-3 md:mx-0 md:mt-0" style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", background: BG, minHeight: "100vh" }}>

        {/* ── Greeting ── */}
        <div className="px-6 pt-6 pb-0">
          <h1 className="text-[32px] font-bold leading-[1.10]" style={{ color: T1, letterSpacing: "-0.8px" }}>
            {greeting},<br />
            <span style={{ background: `linear-gradient(130deg, ${IND} 0%, ${IND3} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {parentFirstName}
            </span> 👋
          </h1>
          <p className="text-[14px] mt-[5px]" style={{ color: T3, letterSpacing: "-0.1px" }}>Here's how {childFirstName} is doing today</p>
        </div>

        {/* ── Academic Health Card ── */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Open performance page"
          onClick={() => navigate("/performance")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/performance"); } }}
          className="mx-5 mt-[22px] bg-white rounded-[28px] p-6 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
          style={{ boxShadow: SH_LG, border: `0.5px solid ${IND_BDR}` }}>
          <div className="absolute -top-[70px] -right-[50px] w-[220px] h-[220px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(0,85,255,0.05) 0%, transparent 70%)" }} />
          <div className="absolute -bottom-[50px] left-5 w-[160px] h-[160px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(0,85,255,0.03) 0%, transparent 70%)" }} />
          <div className="relative z-10">
            <h3 className="text-[18px] font-bold" style={{ color: T1, letterSpacing: "-0.4px" }}>Academic Health</h3>
            <p className="text-[13px] mt-0.5" style={{ color: T3 }}>Overall performance indicator</p>
            <div className="inline-flex items-center gap-[5px] mt-[14px] px-[13px] py-[5px] rounded-full text-[12px] font-semibold"
              style={{
                background: trendStable || isImproving ? GREEN_S : ORANGE_S,
                color: trendStable || isImproving ? "#0A6A2E" : "#905800",
                border: `0.5px solid ${trendStable || isImproving ? GREEN_B : ORANGE_B}`,
                letterSpacing: "-0.1px"
              }}>
              <TrendingUp className={`w-3 h-3 ${isDeclining ? "rotate-180" : ""}`} />
              {trendStable ? "Stable performance" : isImproving ? `Improved by ${liveStats.trendPct}%` : `Declined by ${Math.abs(liveStats.trendPct)}%`}
            </div>
            <div className="flex items-end justify-between mt-[22px]">
              <div className="flex flex-col gap-1">
                <div className="text-[56px] font-bold leading-none" style={{ color: IND, letterSpacing: "-3px" }}>
                  {liveStats.avgScore > 0 ? `${liveStats.avgScore}%` : "—"}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.09em] mt-1" style={{ color: T4 }}>
                  {liveStats.avgScore >= 75 ? "Good Standing" : liveStats.avgScore > 0 ? "Needs Attention" : "No data yet"}
                </div>
              </div>
              <div className="relative w-[96px] h-[96px] shrink-0">
                <svg viewBox="0 0 96 96" width="96" height="96" style={{ transform: "rotate(-90deg)" }}>
                  <defs>
                    <linearGradient id="indGradMobile" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={IND3} />
                      <stop offset="100%" stopColor={IND} />
                    </linearGradient>
                  </defs>
                  <circle cx="48" cy="48" r={ringR} fill="none" stroke="rgba(0,85,255,0.09)" strokeWidth="7" />
                  <circle cx="48" cy="48" r={ringR} fill="none" stroke="url(#indGradMobile)" strokeWidth="7" strokeLinecap="round"
                    strokeDasharray={ringCirc} strokeDashoffset={ringOffset}
                    style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[15px] font-bold" style={{ color: T1, letterSpacing: "-0.4px" }}>
                  {liveStats.avgScore > 0 ? `${liveStats.avgScore}%` : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats Grid 2×2 ── */}
        <div className="grid grid-cols-2 gap-3 mx-5 mt-[14px]">
          {[
            { icon: CheckCircle, decorIcon: TrendingUp, iconColor: GREEN, cardBg: "linear-gradient(135deg, rgba(0,200,83,0.13) 0%, rgba(0,200,83,0.04) 100%)", cardBdr: "rgba(0,200,83,0.20)", iconBoxBg: "rgba(0,200,83,0.18)", iconBoxBdr: "rgba(0,200,83,0.30)", label: "Attendance", value: attDisplay, status: liveStats.attendance === null ? "No records yet" : attOnTrack ? "On track ✓" : "Below target", statusColor: liveStats.attendance === null ? T4 : attOnTrack ? GREEN : ORANGE, route: "/attendance" },
            { icon: AlertCircle, decorIcon: BarChart3, iconColor: ORANGE, cardBg: "linear-gradient(135deg, rgba(255,136,0,0.13) 0%, rgba(255,136,0,0.04) 100%)", cardBdr: "rgba(255,136,0,0.22)", iconBoxBg: "rgba(255,136,0,0.18)", iconBoxBdr: "rgba(255,136,0,0.32)", label: "Pending Work", value: pendingDisplay, status: liveStats.pending === null ? "No assignments yet" : noPending ? "All clear ✓" : "Due this week", statusColor: liveStats.pending === null ? T4 : noPending ? GREEN : ORANGE, route: "/assignments" },
            { icon: Calendar, decorIcon: ClipboardList, iconColor: IND, cardBg: "linear-gradient(135deg, rgba(0,85,255,0.10) 0%, rgba(0,85,255,0.03) 100%)", cardBdr: "rgba(0,85,255,0.20)", iconBoxBg: "rgba(0,85,255,0.14)", iconBoxBdr: "rgba(0,85,255,0.28)", label: "Upcoming Tests", value: testsDisplay, status: liveStats.tests === null ? "No tests scheduled" : "Next 7 days", statusColor: T4, route: "/tests" },
            { icon: Star, decorIcon: Award, iconColor: ROSE, cardBg: "linear-gradient(135deg, rgba(255,51,85,0.10) 0%, rgba(255,51,85,0.03) 100%)", cardBdr: "rgba(255,51,85,0.20)", iconBoxBg: "rgba(255,51,85,0.14)", iconBoxBdr: "rgba(255,51,85,0.30)", label: "Recent Grade", value: liveStats.recentGrade !== "N/A" ? liveStats.recentGrade : "—", status: liveStats.recentSubject, statusColor: T4, route: "/tests" },
          ].map(({ icon: Icon, decorIcon: DecorIcon, iconColor, cardBg, cardBdr, iconBoxBg, iconBoxBdr, label, value, status, statusColor, route }) => (
            <div
              key={label}
              role="button"
              tabIndex={0}
              aria-label={`Open ${label} page`}
              onClick={() => navigate(route)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(route); } }}
              className="rounded-[22px] px-4 pt-[18px] pb-[18px] relative overflow-hidden cursor-pointer active:scale-[0.96] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
              style={{ background: cardBg, boxShadow: SH, border: `0.5px solid ${cardBdr}`, transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)" }}>
              <div className="absolute pointer-events-none" style={{ bottom: 10, right: 10 }}>
                <DecorIcon style={{ width: 60, height: 60, color: iconColor, opacity: 0.20, strokeWidth: 1.6 }} />
              </div>
              <div className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center mb-[14px] relative"
                style={{ background: iconBoxBg, border: `0.5px solid ${iconBoxBdr}` }}>
                <Icon className="w-[17px] h-[17px]" style={{ color: iconColor }} />
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] relative" style={{ color: T4 }}>{label}</div>
              <div className="text-[28px] font-bold mt-1 leading-none relative" style={{ color: T1, letterSpacing: "-0.8px" }}>{value}</div>
              <div className="text-[12px] font-medium mt-[6px] relative truncate" style={{ color: statusColor }}>{status}</div>
            </div>
          ))}
        </div>

        {/* ── Class Leaderboard Card (Edullent leaderboard entry point) ── */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Open class leaderboard"
          onClick={() => navigate("/leaderboard")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/leaderboard"); } }}
          className="bg-white rounded-[22px] mx-5 mt-[14px] px-4 py-[16px] flex items-center gap-3 relative overflow-hidden cursor-pointer active:scale-[0.96] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
          style={{ boxShadow: SH, border: `0.5px solid ${IND_BDR}`, transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)" }}>
          <div className="absolute -top-[18px] -right-[18px] w-[72px] h-[72px] rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, rgba(255,170,0,0.16) 0%, transparent 70%)`, opacity: 0.7 }} />
          <div className="w-[40px] h-[40px] rounded-[12px] flex items-center justify-center relative flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #FFD700 0%, #FFAA00 100%)", boxShadow: "0 4px 12px rgba(255,170,0,0.30)" }}>
            <Trophy className="w-[19px] h-[19px] text-white" />
          </div>
          <div className="flex-1 min-w-0 relative">
            <div className="text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: T4 }}>Class Leaderboard</div>
            <div className="text-[15px] font-bold mt-[2px] truncate" style={{ color: T1, letterSpacing: "-0.3px" }}>See where you stand this week</div>
          </div>
          <ArrowRight className="w-[16px] h-[16px] flex-shrink-0 relative" style={{ color: IND }} />
        </div>

        {/* ── AI Live Summary Card (light, dashboard 4-stat-card vibe) ── */}
        <div className="mx-5 mt-4 rounded-[22px] overflow-hidden relative bg-white"
          style={{ boxShadow: SH_LG, border: `0.5px solid ${IND_BDR}` }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-[14px] pb-[12px]" style={{ borderBottom: `0.5px solid ${IND_BDR}` }}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-[12px] h-[12px]" style={{ color: IND }} strokeWidth={2.4} />
              <span className="text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: T4 }}>Edullent · Live Summary</span>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setRefreshKey(k => k + 1); setLastUpdatedAt(new Date()); }}
              className="flex items-center gap-[5px] px-[10px] py-[3px] rounded-full active:scale-[0.96] transition-transform"
              style={{ background: IND_SOFT, border: `0.5px solid ${IND_BDR}` }}
              aria-label="Refresh dashboard data">
              <RefreshCw className="w-[10px] h-[10px]" style={{ color: T3 }} />
              <span className="text-[10px] font-bold tracking-[0.06em]" style={{ color: T3 }}>
                {lastUpdatedAt ? `Updated ${timeAgo(lastUpdatedAt)}` : "Updating…"}
              </span>
            </button>
          </div>

          {dataLoading ? (
            <div className="flex items-center gap-3 py-10 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: IND }} />
              <span className="text-xs" style={{ color: T4 }}>Loading {childFirstName}'s data...</span>
            </div>
          ) : (
            <>
              {/* 2×2 pastel mini-cards */}
              <div className="grid grid-cols-2 gap-[10px] p-[14px]">
                {[
                  {
                    label: "Attendance",
                    value: liveStats.attendance !== null ? `${liveStats.attendance}%` : "—",
                    status: liveStats.attendance === null ? "No data" : attOnTrack ? "✓ On Track" : "Below 85% target",
                    statusColor: liveStats.attendance === null ? T4 : attOnTrack ? GREEN : ORANGE,
                    icon: CheckCircle, iconColor: GREEN,
                    cardBg: "linear-gradient(135deg, rgba(0,200,83,0.13) 0%, rgba(0,200,83,0.04) 100%)",
                    cardBdr: "rgba(0,200,83,0.20)",
                    iconBoxBg: "rgba(0,200,83,0.18)", iconBoxBdr: "rgba(0,200,83,0.30)",
                    route: "/attendance",
                  },
                  {
                    label: "Avg Score",
                    value: liveStats.avgScore > 0 ? `${liveStats.avgScore}%` : "—",
                    status: liveStats.avgScore >= 80 ? "Excellent" : liveStats.avgScore >= 60 ? "Good" : liveStats.avgScore > 0 ? "Needs Work" : "No Data",
                    statusColor: liveStats.avgScore >= 80 ? GREEN : liveStats.avgScore >= 60 ? IND : liveStats.avgScore > 0 ? ORANGE : T4,
                    icon: TrendingUp, iconColor: IND,
                    cardBg: "linear-gradient(135deg, rgba(0,85,255,0.10) 0%, rgba(0,85,255,0.03) 100%)",
                    cardBdr: "rgba(0,85,255,0.20)",
                    iconBoxBg: "rgba(0,85,255,0.14)", iconBoxBdr: "rgba(0,85,255,0.28)",
                    route: "/performance",
                  },
                  {
                    label: "Assignments",
                    value: pendingDisplay,
                    status: liveStats.pending === null ? "No assignments yet" : noPending ? "✓ All Done" : `${liveStats.pending} to complete`,
                    statusColor: liveStats.pending === null ? T4 : noPending ? GREEN : ORANGE,
                    icon: AlertCircle, iconColor: ORANGE,
                    cardBg: "linear-gradient(135deg, rgba(255,136,0,0.13) 0%, rgba(255,136,0,0.04) 100%)",
                    cardBdr: "rgba(255,136,0,0.22)",
                    iconBoxBg: "rgba(255,136,0,0.18)", iconBoxBdr: "rgba(255,136,0,0.32)",
                    route: "/assignments",
                  },
                  {
                    label: "Recent Test",
                    value: liveStats.recentGrade !== "N/A" ? liveStats.recentGrade : "—",
                    status: liveStats.recentSubject || "No tests yet",
                    statusColor: T4,
                    icon: Star, iconColor: ROSE,
                    cardBg: "linear-gradient(135deg, rgba(255,51,85,0.10) 0%, rgba(255,51,85,0.03) 100%)",
                    cardBdr: "rgba(255,51,85,0.20)",
                    iconBoxBg: "rgba(255,51,85,0.14)", iconBoxBdr: "rgba(255,51,85,0.30)",
                    route: "/tests",
                  },
                ].map(({ label, value, status, statusColor, icon: Icon, iconColor, cardBg, cardBdr, iconBoxBg, iconBoxBdr, route }) => (
                  <div key={label}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${label} page`}
                    onClick={() => navigate(route)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(route); } }}
                    className="rounded-[16px] px-[14px] pt-[14px] pb-[14px] cursor-pointer active:scale-[0.96] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/30"
                    style={{ background: cardBg, border: `0.5px solid ${cardBdr}`, transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)" }}>
                    <div className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center mb-[10px]"
                      style={{ background: iconBoxBg, border: `0.5px solid ${iconBoxBdr}` }}>
                      <Icon className="w-[15px] h-[15px]" style={{ color: iconColor }} strokeWidth={2.4} />
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-[0.08em]" style={{ color: T4 }}>{label}</div>
                    <div className="text-[24px] font-bold mt-[2px] leading-none" style={{ color: T1, letterSpacing: "-0.7px" }}>{value}</div>
                    <div className="text-[10px] font-medium mt-[5px] truncate" style={{ color: statusColor }}>{status}</div>
                  </div>
                ))}
              </div>

              {/* AI Insight Strip (light) */}
              <div className="px-[18px] py-[12px] flex items-start gap-[10px]" style={{ borderTop: `0.5px solid ${IND_BDR}`, background: IND_SOFT }}>
                <BrainCircuit className="w-4 h-4 shrink-0 mt-[1px]" style={{ color: IND }} />
                {aiInsights?.child_summary_narrative ? (
                  <p className="text-[12px] leading-[1.65]" style={{ color: T3, letterSpacing: "-0.1px" }}>
                    <strong style={{ color: T1, fontWeight: 700 }}>{studentData?.name}</strong>{" "}
                    {aiInsights.child_summary_narrative.replace(studentData?.name || "", "").trim()}
                  </p>
                ) : (
                  <p className="text-[11px] italic" style={{ color: T4 }}>
                    No activity yet — summary will appear when scores or attendance are recorded.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Profile Card (Indigo gradient) ── */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Open my child profile"
          onClick={() => navigate("/my-child")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/my-child"); } }}
          className="mx-5 mt-5 rounded-[28px] p-6 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          style={{
            background: IND_DARK_GRAD,
            boxShadow: "0 10px 36px rgba(0,85,255,0.22), 0 0 0 0.5px rgba(255,255,255,0.18)",
            border: "0.5px solid rgba(255,255,255,0.18)"
          }}>
          <div className="absolute -top-[55px] -right-[35px] w-[210px] h-[210px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.11) 0%, transparent 70%)" }} />
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)",
            backgroundSize: "26px 26px"
          }} />

          <div className="relative z-10">
            <div className="w-[68px] h-[68px] rounded-[22px] flex items-center justify-center text-[24px] font-bold text-white mb-4"
              style={{ background: "rgba(255,255,255,0.18)", border: "0.5px solid rgba(255,255,255,0.26)", boxShadow: "0 4px 20px rgba(0,0,0,0.18)" }}>
              {studentInitials}
            </div>
            <div className="text-[22px] font-bold text-white" style={{ letterSpacing: "-0.6px" }}>{studentData?.name || "Student"}</div>
            <div className="text-[14px] mt-[3px]" style={{ color: "rgba(255,255,255,0.52)" }}>
              {studentMeta.className !== "—"
                ? classDisplay(studentMeta.className)
                : studentData?.grade
                  ? classDisplay(String(studentData.grade))
                  : "Grade —"}
              {teacherInfo.name !== "—" ? ` — ${teacherInfo.name}` : ""}
            </div>
            <div className="grid grid-cols-2 mt-5 rounded-[15px] overflow-hidden" style={{ gap: "1px", background: "rgba(255,255,255,0.10)" }}>
              <div className="px-[15px] py-[13px]" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div className="text-[10px] font-bold uppercase tracking-[0.09em]" style={{ color: "rgba(255,255,255,0.38)" }}>Class Teacher</div>
                <div className="text-[15px] font-semibold mt-1 text-white" style={{ letterSpacing: "-0.2px" }}>{teacherInfo.name}</div>
              </div>
              <div className="px-[15px] py-[13px]" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div className="text-[10px] font-bold uppercase tracking-[0.09em]" style={{ color: "rgba(255,255,255,0.38)" }}>Academic Year</div>
                <div className="text-[15px] font-semibold mt-1 text-white" style={{ letterSpacing: "-0.2px" }}>{academicYear}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Recent Alerts ── */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Open alerts page"
          onClick={() => navigate("/alerts")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/alerts"); } }}
          className="mx-5 mt-[14px] bg-white rounded-[22px] p-5 cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
          style={{ boxShadow: SH, border: `0.5px solid ${IND_BDR}` }}>
          <h3 className="text-[18px] font-bold mb-5" style={{ color: T1, letterSpacing: "-0.4px" }}>Recent Alerts</h3>
          {recentAlerts.length > 0 ? (
            <div className="space-y-3">
              {recentAlerts.map(alert => (
                <div key={alert.id} className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: alert.urgent ? "rgba(255,136,0,0.08)" : "rgba(0,200,83,0.08)" }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: alert.urgent ? "rgba(255,136,0,0.15)" : "rgba(0,200,83,0.15)", color: alert.urgent ? ORANGE : GREEN }}>
                    {alert.urgent ? <Clock className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {alert.category && (
                        <span className="text-[9px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded"
                          style={{ background: alert.urgent ? "rgba(255,136,0,0.16)" : "rgba(0,85,255,0.10)", color: alert.urgent ? ORANGE : IND, letterSpacing: "0.4px" }}>
                          {alert.category}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium leading-snug" style={{ color: T1 }}>{alert.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: T3 }}>{timeAgo(alert.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-[10px] p-4">
              <div className="w-[54px] h-[54px] rounded-[17px] flex items-center justify-center"
                style={{ background: IND_SOFT, border: `0.5px solid ${IND_BDR}`, boxShadow: "0 0 0 5px rgba(0,85,255,0.03)" }}>
                <ShieldCheck className="w-6 h-6" style={{ color: T4 }} />
              </div>
              <p className="text-[14px]" style={{ color: T3 }}>No alerts right now</p>
            </div>
          )}
        </div>

        {/* ── Weekly AI Report Card ── */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Open reports page"
          onClick={() => navigate("/reports")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/reports"); } }}
          className="mx-5 mt-[14px] bg-white rounded-[22px] px-5 py-[18px] cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
          style={{ boxShadow: SH, border: `0.5px solid ${IND_BDR}` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center"
                style={{ background: IND_SOFT, border: `0.5px solid ${IND_BDR}` }}>
                <BookOpen className="w-[18px] h-[18px]" style={{ color: IND }} />
              </div>
              <div>
                <div className="text-[15px] font-bold" style={{ color: T1, letterSpacing: "-0.3px" }}>Weekly AI Report</div>
                <div className="text-[12px] mt-0.5" style={{ color: T3 }}>
                  {isPrevWeekReport ? "Last week's report" : weekConfig.canGenerate ? (weeklyReport ? "This week's digest" : "Generate this week's report") : "New report available Friday"}
                </div>
              </div>
            </div>
            {weekConfig.canGenerate && !weeklyReport ? (
              <button onClick={(e) => { e.stopPropagation(); handleGenerateWeeklyReport(); }} disabled={weeklyLoading || dataLoading}
                className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-[12px] font-semibold text-white disabled:opacity-50"
                style={{ background: IND, boxShadow: "0 2px 8px rgba(0,85,255,0.28)" }}>
                {weeklyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {weeklyLoading ? "..." : "Generate"}
              </button>
            ) : !weekConfig.canGenerate ? (
              <div className="flex items-center gap-1 px-[11px] py-[7px] rounded-[12px] text-[11px] font-semibold whitespace-nowrap"
                style={{ background: "#E5E5EC", color: T3, border: `0.5px solid ${IND_BDR}` }}>
                <Clock className="w-[11px] h-[11px]" />
                Fri{weekConfig.daysLeft > 0 ? ` · ${weekConfig.daysLeft}d` : ""}
              </div>
            ) : null}
          </div>

          {weeklyLoading && (
            <div className="flex flex-col items-center py-6 gap-3">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: IND }} />
              <p className="text-xs" style={{ color: T3 }}>Analysing {childFirstName}'s week...</p>
            </div>
          )}

          {!weeklyReport && !weeklyLoading && (
            <div className="flex items-start gap-2 mt-[14px] pt-[14px]" style={{ borderTop: `0.5px solid ${SEP}` }}>
              <Clock className="w-[14px] h-[14px] shrink-0 mt-0.5" style={{ color: T4 }} />
              <p className="text-[13px] leading-[1.6]" style={{ color: T3, letterSpacing: "-0.1px" }}>
                {weekConfig.canGenerate
                  ? `Tap "Generate" to get ${childFirstName}'s weekly digest.`
                  : `You can generate ${childFirstName}'s weekly report every Friday, Saturday & Sunday.`}
              </p>
            </div>
          )}

          {weeklyReport && !weeklyLoading && isPrevWeekReport && (
            <div className="flex items-start gap-2 mt-[14px] pt-[14px]" style={{ borderTop: `0.5px solid ${SEP}` }}>
              <Clock className="w-[14px] h-[14px] shrink-0 mt-0.5" style={{ color: T4 }} />
              <p className="text-[13px] leading-[1.55]" style={{ color: T3 }}>
                This is last week's report. A new report can be generated this Friday.
              </p>
            </div>
          )}
        </div>

        {/* ── AI Message (Indigo gradient) ── */}
        {weeklyReport && !weeklyLoading && (
          <div className="mx-5 mt-3 rounded-[24px] px-[22px] py-5 relative overflow-hidden"
            style={{
              background: IND_DARK_GRAD,
              border: "0.5px solid rgba(0,85,255,0.22)",
              boxShadow: "0 6px 28px rgba(0,85,255,0.22), 0 2px 8px rgba(0,85,255,0.14)"
            }}>
            <div className="absolute -top-8 -right-5 w-[160px] h-[160px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 65%)" }} />
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)",
              backgroundSize: "26px 26px"
            }} />
            <div className="relative z-10">
              <div className="flex items-center gap-[6px] text-[10px] font-bold uppercase tracking-[0.10em] mb-3" style={{ color: "rgba(255,255,255,0.52)" }}>
                <Sparkles className="w-3 h-3" />
                AI Message
              </div>
              <p className="text-[14px] leading-[1.72] font-normal" style={{ color: "rgba(255,255,255,0.92)", letterSpacing: "-0.1px" }}>
                {weeklyReport.message}
              </p>
            </div>
          </div>
        )}

        {/* ── Detail Sections ── */}
        {weeklyReport && !weeklyLoading && (
          <div className="mx-5 mt-3 bg-white rounded-[22px] overflow-hidden" style={{ boxShadow: SH, border: `0.5px solid ${IND_BDR}` }}>
            {[
              { tag: "Attendance", text: weeklyReport.attendance_summary },
              { tag: "Tests", text: weeklyReport.test_analysis },
              { tag: "Assignments", text: weeklyReport.assignment_status },
            ].map(({ tag, text }, i, arr) => (
              <div key={tag} className="px-[18px] py-[15px] flex flex-col gap-[5px]"
                style={{ borderBottom: i < arr.length - 1 ? `0.5px solid ${SEP}` : "none" }}>
                <span className="text-[10px] font-bold uppercase tracking-[0.09em]" style={{ color: IND3 }}>{tag}</span>
                <p className="text-[13px] leading-[1.58]" style={{ color: T2, letterSpacing: "-0.1px" }}>{text}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Overall Performance Card ── */}
        {weeklyReport?.overall_performance && (
          <div className="mx-5 mt-[14px] bg-white rounded-[22px] px-5 py-[18px] flex items-start justify-between gap-[14px] relative overflow-hidden"
            style={{ border: `0.5px solid ${ORANGE_B}`, boxShadow: SH }}>
            <div className="absolute -top-4 -right-4 w-[60px] h-[60px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(245,160,0,0.10) 0%, transparent 70%)" }} />
            <div className="relative z-10">
              <div className="text-[10px] font-bold uppercase tracking-[0.09em] mb-[5px]" style={{ color: ORANGE }}>Overall Performance</div>
              <div className="text-[17px] font-bold" style={{ color: T1, letterSpacing: "-0.3px" }}>{weeklyReport.overall_performance.verdict}</div>
              <p className="text-[12px] mt-[5px] leading-[1.58]" style={{ color: T3, letterSpacing: "-0.1px" }}>{weeklyReport.overall_performance.score_context}</p>
            </div>
            <div className="flex items-center gap-1 px-[14px] py-[9px] rounded-[14px] text-[12px] font-bold shrink-0 relative z-10"
              style={{
                background: weeklyReport.overall_performance.trend === "Declining" ? ORANGE_S : GREEN_S,
                border: `0.5px solid ${weeklyReport.overall_performance.trend === "Declining" ? ORANGE_B : GREEN_B}`,
                color: weeklyReport.overall_performance.trend === "Declining" ? "#905800" : "#0A6A2E",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
              }}>
              <TrendingUp className={`w-3 h-3 ${weeklyReport.overall_performance.trend === "Declining" ? "rotate-180" : ""}`} />
              {weeklyReport.overall_performance.trend}
            </div>
          </div>
        )}

        {/* ── AI Improvement Tips ── */}
        {weeklyReport?.improvement_tips?.length > 0 && (
          <>
            <div className="px-6 pt-5 pb-0 text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: T4 }}>
              AI Improvement Tips
            </div>
            {weeklyReport.improvement_tips.map((t: { tip: string; reason: string }, i: number) => (
              <div key={i} className="mx-5 mt-[10px] bg-white rounded-[20px] px-[18px] py-4 flex items-start gap-[14px] active:scale-[0.97] transition-transform"
                style={{ boxShadow: SH, border: `0.5px solid ${IND_BDR}` }}>
                <div className="w-[42px] h-[42px] rounded-[13px] flex items-center justify-center shrink-0 text-[20px]"
                  style={{
                    background: i === 0 ? "rgba(255,215,0,0.12)" : IND_SOFT,
                    border: `0.5px solid ${i === 0 ? "rgba(255,215,0,0.22)" : IND_BDR}`
                  }}>
                  {i === 0 ? "💡" : "🎯"}
                </div>
                <div>
                  <div className="text-[14px] font-semibold leading-[1.35]" style={{ color: T1, letterSpacing: "-0.2px" }}>{t.tip}</div>
                  <p className="text-[12px] mt-[3px] leading-[1.5]" style={{ color: T3, letterSpacing: "-0.1px" }}>{t.reason}</p>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Download PDF Button ── */}
        {weeklyReport && !weeklyLoading && (
          <button onClick={handleDownloadPDF} disabled={pdfDownloading}
            className="mx-5 mt-5 w-[calc(100%-40px)] rounded-[18px] py-[17px] flex items-center justify-center gap-[9px] text-[16px] font-bold text-white disabled:opacity-50 active:scale-[0.97] transition-transform relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, #001888 0%, #0033CC 50%, #0055FF 100%)`, boxShadow: SH_BTN, letterSpacing: "-0.2px" }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.13) 0%, transparent 52%)" }} />
            <span className="relative z-10 flex items-center gap-[9px]">
              {pdfDownloading ? (
                <><Loader2 className="w-[17px] h-[17px] animate-spin" /> Generating PDF...</>
              ) : (
                <><Download className="w-[17px] h-[17px]" /> Download PDF Report</>
              )}
            </span>
          </button>
        )}

        {/* ── AI Parenting Tips ── */}
        <div className="mx-5 mt-5 mb-2 bg-white rounded-[22px] overflow-hidden" style={{ boxShadow: SH, border: `0.5px solid ${IND_BDR}` }}>
          {/* Indigo-gradient header */}
          <div className="flex items-center gap-3 px-5 py-4 relative overflow-hidden"
            style={{ background: IND_DARK_GRAD, borderBottom: `0.5px solid ${IND_BDR}` }}>
            <div className="absolute -top-7 -right-4 w-[120px] h-[120px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.09) 0%, transparent 65%)" }} />
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)",
              backgroundSize: "24px 24px"
            }} />
            <span className="text-[22px] relative z-10">💡</span>
            <div className="relative z-10">
              <div className="text-[16px] font-bold text-white" style={{ letterSpacing: "-0.3px" }}>AI Parenting Tips</div>
              <div className="text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.52)" }}>Based on {childFirstName}'s current data</div>
            </div>
          </div>

          {/* Tips list */}
          {(() => {
            const tips = smartTips;
            return tips.length > 0 ? tips.map((item: { tip: string; reason: string }, i: number) => (
              <div key={i} className="px-[18px] py-[15px] flex items-start gap-[14px]"
                style={{ borderBottom: i < tips.length - 1 ? `0.5px solid ${SEP}` : "none" }}>
                <div className="w-7 h-7 rounded-[9px] flex items-center justify-center text-[12px] font-bold shrink-0 mt-0.5"
                  style={{ background: IND_SOFT, border: `0.5px solid ${IND_BDR}`, color: IND }}>
                  {i + 1}
                </div>
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: T1, letterSpacing: "-0.2px" }}>{item.tip}</div>
                  <p className="text-[12px] mt-[3px] leading-[1.5]" style={{ color: T3, letterSpacing: "-0.1px" }}>{item.reason}</p>
                </div>
              </div>
            )) : (
              <div className="px-[18px] py-6 flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: IND }} />
                <p className="text-sm italic" style={{ color: T3 }}>Loading {childFirstName}'s tips...</p>
              </div>
            );
          })()}
        </div>

        <div className="h-6" />

        {/* Hidden PDF render target */}
        {weeklyReport && pdfData && (
          <div style={{ position: "fixed", top: "-9999px", left: "-9999px", zIndex: -1 }}>
            <WeeklyReportPDF
              ref={pdfRef}
              report={weeklyReport}
              studentName={pdfData.child_name}
              grade={pdfData.grade}
              attendance={pdfData.attendance}
              tests={pdfData.tests}
              assignments={pdfData.assignments}
              avgScore={pdfData.overall_avg}
              weekEnd={pdfData.weekEnd}
              onDownload={() => {}}
            />
          </div>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     DESKTOP — Edullent Indigo Apple UI (matches mobile language)
     ═══════════════════════════════════════════════════════════════ */
  {
    // P1-4: tokens sourced from module-level T_DASH — single source of truth.
    // Destructure all 22 tokens (noUnusedLocals:false in tsconfig) to avoid
    // "X is not defined" runtime errors from any usage we might have missed.
    const {
      IND, IND2, IND3, BG, T1, T2, T3, T4, SEP, IND_BDR, IND_SOFT,
      GREEN, GREEN_S, GREEN_B, ORANGE, ORANGE_S, ORANGE_B, ROSE, ROSE_S,
      IND_DARK_GRAD, SH, SH_LG, SH_BTN,
    } = T_DASH;
    void ROSE_S; // suppress unused warning

    const scorePct = Math.min(liveStats.avgScore, 100);
    const ringR = 56, ringCirc = 2 * Math.PI * ringR;
    const ringOffset = ringCirc - (scorePct / 100) * ringCirc;
    const attOnTrack = liveStats.attendance !== null && liveStats.attendance >= 85;
    const noPending = liveStats.pending === 0;
    const isImproving = liveStats.trendPct > 0;
    const isDeclining = liveStats.trendPct < 0;
    const trendStable = liveStats.trendPct === 0;

    return (
      <div className="animate-in fade-in duration-500 -m-4 sm:-m-6 md:-m-8 min-h-[calc(100vh-64px)]"
        style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", background: BG }}>
        <div className="w-full px-6 pt-8 pb-12">

          {/* ── Greeting + Date ── */}
          <div className="flex items-start justify-between gap-6 flex-wrap mb-8">
            <div>
              <h1 className="text-[42px] font-bold leading-[1.05]" style={{ color: T1, letterSpacing: "-1.2px" }}>
                {greeting},{" "}
                <span style={{ background: `linear-gradient(130deg, ${IND} 0%, ${IND3} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {parentFirstName}
                </span> 👋
              </h1>
              <p className="text-[15px] mt-2" style={{ color: T3, letterSpacing: "-0.1px" }}>Here's how {childFirstName} is doing today</p>
            </div>
            <div className="flex items-center gap-3">
              <LiveDateDisplay T2={T2} T4={T4} />
              <div className="w-12 h-12 rounded-[14px] flex items-center justify-center text-[14px] font-bold text-white"
                style={{ background: `linear-gradient(140deg, ${IND} 0%, ${IND2} 100%)`, boxShadow: "0 4px 14px rgba(0,85,255,0.28)" }}>
                {userInitials}
              </div>
            </div>
          </div>

          {/* ── Row 1: Academic Health + Profile Card ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-5">

            {/* Academic Health (lg:col-span-3) */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Open performance page"
              onClick={() => navigate("/performance")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/performance"); } }}
              className="lg:col-span-3 bg-white rounded-[28px] p-8 relative overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
              style={{ boxShadow: SH_LG, border: `0.5px solid ${IND_BDR}` }}>
              <div className="absolute -top-[80px] -right-[60px] w-[260px] h-[260px] rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(0,85,255,0.05) 0%, transparent 70%)" }} />
              <div className="absolute -bottom-[60px] left-6 w-[200px] h-[200px] rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(0,85,255,0.03) 0%, transparent 70%)" }} />
              <div className="relative z-10">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-[22px] font-bold" style={{ color: T1, letterSpacing: "-0.5px" }}>Academic Health</h3>
                    <p className="text-[14px] mt-1" style={{ color: T3 }}>Overall performance indicator</p>
                  </div>
                  <div className="inline-flex items-center gap-[6px] px-[14px] py-[7px] rounded-full text-[13px] font-semibold"
                    style={{
                      background: trendStable || isImproving ? GREEN_S : ORANGE_S,
                      color: trendStable || isImproving ? "#0A6A2E" : "#905800",
                      border: `0.5px solid ${trendStable || isImproving ? GREEN_B : ORANGE_B}`,
                      letterSpacing: "-0.1px"
                    }}>
                    <TrendingUp className={`w-[13px] h-[13px] ${isDeclining ? "rotate-180" : ""}`} />
                    {trendStable ? "Stable performance" : isImproving ? `Improved by ${liveStats.trendPct}%` : `Declined by ${Math.abs(liveStats.trendPct)}%`}
                  </div>
                </div>
                <div className="flex items-end justify-between gap-6 mt-8">
                  <div className="flex flex-col gap-2">
                    <div className="text-[80px] font-bold leading-none" style={{ color: IND, letterSpacing: "-4.5px" }}>
                      {liveStats.avgScore > 0 ? `${liveStats.avgScore}%` : "—"}
                    </div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.10em] mt-2" style={{ color: T4 }}>
                      {liveStats.avgScore >= 75 ? "Good Standing" : liveStats.avgScore > 0 ? "Needs Attention" : "No data yet"}
                    </div>
                  </div>
                  <div className="relative w-[140px] h-[140px] shrink-0">
                    <svg viewBox="0 0 140 140" width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
                      <defs>
                        <linearGradient id="indGradDesk" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={IND3} />
                          <stop offset="100%" stopColor={IND} />
                        </linearGradient>
                      </defs>
                      <circle cx="70" cy="70" r={ringR} fill="none" stroke="rgba(0,85,255,0.09)" strokeWidth="10" />
                      <circle cx="70" cy="70" r={ringR} fill="none" stroke="url(#indGradDesk)" strokeWidth="10" strokeLinecap="round"
                        strokeDasharray={ringCirc} strokeDashoffset={ringOffset}
                        style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-[22px] font-bold" style={{ color: T1, letterSpacing: "-0.5px" }}>
                      {liveStats.avgScore > 0 ? `${liveStats.avgScore}%` : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Card (lg:col-span-2) */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Open my child profile"
              onClick={() => navigate("/my-child")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/my-child"); } }}
              className="lg:col-span-2 rounded-[28px] p-7 relative overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:scale-[1.02] hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              style={{
                background: IND_DARK_GRAD,
                boxShadow: "0 10px 36px rgba(0,85,255,0.22), 0 0 0 0.5px rgba(255,255,255,0.18)",
                border: "0.5px solid rgba(255,255,255,0.18)"
              }}>
              <div className="absolute -top-[55px] -right-[35px] w-[210px] h-[210px] rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(255,255,255,0.11) 0%, transparent 70%)" }} />
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: "linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)",
                backgroundSize: "26px 26px"
              }} />
              <div className="relative z-10">
                <div className="w-[68px] h-[68px] rounded-[22px] flex items-center justify-center text-[24px] font-bold text-white mb-4"
                  style={{ background: "rgba(255,255,255,0.18)", border: "0.5px solid rgba(255,255,255,0.26)", boxShadow: "0 4px 20px rgba(0,0,0,0.18)" }}>
                  {studentInitials}
                </div>
                <div className="text-[24px] font-bold text-white" style={{ letterSpacing: "-0.6px" }}>{studentData?.name || "Student"}</div>
                <div className="text-[14px] mt-[3px]" style={{ color: "rgba(255,255,255,0.52)" }}>
                  {studentMeta.className !== "—"
                    ? classDisplay(studentMeta.className)
                    : studentData?.grade
                      ? classDisplay(String(studentData.grade))
                      : "Grade —"}
                  {studentMeta.rollNo !== "—" ? ` · Roll ${studentMeta.rollNo}` : ""}
                </div>
                <div className="grid grid-cols-2 mt-5 rounded-[15px] overflow-hidden" style={{ gap: "1px", background: "rgba(255,255,255,0.10)" }}>
                  <div className="px-[15px] py-[13px]" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <div className="text-[10px] font-bold uppercase tracking-[0.09em]" style={{ color: "rgba(255,255,255,0.38)" }}>Class Teacher</div>
                    <div className="text-[15px] font-semibold mt-1 text-white truncate" style={{ letterSpacing: "-0.2px" }}>{teacherInfo.name}</div>
                  </div>
                  <div className="px-[15px] py-[13px]" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <div className="text-[10px] font-bold uppercase tracking-[0.09em]" style={{ color: "rgba(255,255,255,0.38)" }}>Academic Year</div>
                    <div className="text-[15px] font-semibold mt-1 text-white" style={{ letterSpacing: "-0.2px" }}>{academicYear}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Row 2: 4 Stat Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            {[
              { icon: CheckCircle, decorIcon: TrendingUp, iconColor: GREEN, cardBg: "linear-gradient(135deg, rgba(0,200,83,0.13) 0%, rgba(0,200,83,0.04) 100%)", cardBdr: "rgba(0,200,83,0.20)", iconBoxBg: "rgba(0,200,83,0.18)", iconBoxBdr: "rgba(0,200,83,0.30)", label: "Attendance", value: attDisplay, status: liveStats.attendance === null ? "No records yet" : attOnTrack ? "On track ✓" : "Below target", statusColor: liveStats.attendance === null ? T4 : attOnTrack ? GREEN : ORANGE, route: "/attendance" },
              { icon: AlertCircle, decorIcon: BarChart3, iconColor: ORANGE, cardBg: "linear-gradient(135deg, rgba(255,136,0,0.13) 0%, rgba(255,136,0,0.04) 100%)", cardBdr: "rgba(255,136,0,0.22)", iconBoxBg: "rgba(255,136,0,0.18)", iconBoxBdr: "rgba(255,136,0,0.32)", label: "Pending Work", value: pendingDisplay, status: liveStats.pending === null ? "No assignments yet" : noPending ? "All clear ✓" : "Due this week", statusColor: liveStats.pending === null ? T4 : noPending ? GREEN : ORANGE, route: "/assignments" },
              { icon: Calendar, decorIcon: ClipboardList, iconColor: IND, cardBg: "linear-gradient(135deg, rgba(0,85,255,0.10) 0%, rgba(0,85,255,0.03) 100%)", cardBdr: "rgba(0,85,255,0.20)", iconBoxBg: "rgba(0,85,255,0.14)", iconBoxBdr: "rgba(0,85,255,0.28)", label: "Upcoming Tests", value: testsDisplay, status: liveStats.tests === null ? "No tests scheduled" : "Next 7 days", statusColor: T4, route: "/tests" },
              { icon: Star, decorIcon: Award, iconColor: ROSE, cardBg: "linear-gradient(135deg, rgba(255,51,85,0.10) 0%, rgba(255,51,85,0.03) 100%)", cardBdr: "rgba(255,51,85,0.20)", iconBoxBg: "rgba(255,51,85,0.14)", iconBoxBdr: "rgba(255,51,85,0.30)", label: "Recent Grade", value: liveStats.recentGrade !== "N/A" ? liveStats.recentGrade : "—", status: liveStats.recentSubject, statusColor: T4, route: "/tests" },
            ].map(({ icon: Icon, decorIcon: DecorIcon, iconColor, cardBg, cardBdr, iconBoxBg, iconBoxBdr, label, value, status, statusColor, route }) => (
              <div
                key={label}
                role="button"
                tabIndex={0}
                aria-label={`Open ${label} page`}
                onClick={() => navigate(route)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(route); } }}
                className="rounded-[22px] px-5 pt-5 pb-5 relative overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
                style={{ background: cardBg, boxShadow: SH, border: `0.5px solid ${cardBdr}`, transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)" }}>
                <div className="absolute pointer-events-none" style={{ bottom: 14, right: 14 }}>
                  <DecorIcon style={{ width: 80, height: 80, color: iconColor, opacity: 0.20, strokeWidth: 1.6 }} />
                </div>
                <div className="w-[38px] h-[38px] rounded-[12px] flex items-center justify-center mb-4 relative"
                  style={{ background: iconBoxBg, border: `0.5px solid ${iconBoxBdr}` }}>
                  <Icon className="w-[18px] h-[18px]" style={{ color: iconColor }} />
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] relative" style={{ color: T4 }}>{label}</div>
                <div className="text-[34px] font-bold mt-1 leading-none relative" style={{ color: T1, letterSpacing: "-1px" }}>{value}</div>
                <div className="text-[12px] font-medium mt-[6px] relative truncate" style={{ color: statusColor }}>{status}</div>
              </div>
            ))}
          </div>

          {/* ── Class Leaderboard Card (desktop) ── */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Open class leaderboard"
            onClick={() => navigate("/leaderboard")}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/leaderboard"); } }}
            className="bg-white rounded-[22px] px-6 py-5 mb-5 flex items-center gap-4 relative overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:scale-[1.01] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
            style={{ boxShadow: SH, border: `0.5px solid ${IND_BDR}`, transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)" }}>
            <div className="absolute -top-[24px] -right-[24px] w-[120px] h-[120px] rounded-full pointer-events-none"
              style={{ background: `radial-gradient(circle, rgba(255,170,0,0.18) 0%, transparent 70%)`, opacity: 0.7 }} />
            <div className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center relative flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #FFD700 0%, #FFAA00 100%)", boxShadow: "0 6px 16px rgba(255,170,0,0.32)" }}>
              <Trophy className="w-[22px] h-[22px] text-white" />
            </div>
            <div className="flex-1 min-w-0 relative">
              <div className="text-[11px] font-bold uppercase tracking-[0.10em]" style={{ color: T4 }}>Class Leaderboard</div>
              <div className="text-[18px] font-bold mt-[2px]" style={{ color: T1, letterSpacing: "-0.4px" }}>See where you stand this week</div>
              <div className="text-[12px] font-medium mt-[2px]" style={{ color: T3 }}>Weekly ranking · AI insights · personalised plan</div>
            </div>
            <ArrowRight className="w-[20px] h-[20px] flex-shrink-0 relative" style={{ color: IND }} />
          </div>

          {/* ── AI Live Summary Card (light, dashboard 4-stat-card vibe) ── */}
          <div className="rounded-[22px] overflow-hidden relative mb-5 bg-white"
            style={{ boxShadow: SH_LG, border: `0.5px solid ${IND_BDR}` }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-[14px] pb-[12px]" style={{ borderBottom: `0.5px solid ${IND_BDR}` }}>
              <div className="flex items-center gap-2">
                <Sparkles className="w-[13px] h-[13px]" style={{ color: IND }} strokeWidth={2.4} />
                <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: T4 }}>Edullent · Live Summary</span>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setRefreshKey(k => k + 1); setLastUpdatedAt(new Date()); }}
                className="flex items-center gap-[5px] px-3 py-[4px] rounded-full active:scale-[0.96] transition-transform hover:opacity-80"
                style={{ background: IND_SOFT, border: `0.5px solid ${IND_BDR}` }}
                aria-label="Refresh dashboard data">
                <RefreshCw className="w-[11px] h-[11px]" style={{ color: T3 }} />
                <span className="text-[10px] font-bold tracking-[0.06em]" style={{ color: T3 }}>
                  {lastUpdatedAt ? `Updated ${timeAgo(lastUpdatedAt)}` : "Updating…"}
                </span>
              </button>
            </div>

            {dataLoading ? (
              <div className="flex items-center gap-3 py-14 justify-center">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: IND }} />
                <span className="text-sm" style={{ color: T4 }}>Loading {childFirstName}'s data...</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4">
                  {[
                    {
                      label: "Attendance",
                      value: liveStats.attendance !== null ? `${liveStats.attendance}%` : "—",
                      status: liveStats.attendance === null ? "No data" : attOnTrack ? "✓ On Track" : "Below 85% target",
                      statusColor: liveStats.attendance === null ? T4 : attOnTrack ? GREEN : ORANGE,
                      icon: CheckCircle, iconColor: GREEN,
                      cardBg: "linear-gradient(135deg, rgba(0,200,83,0.13) 0%, rgba(0,200,83,0.04) 100%)",
                      cardBdr: "rgba(0,200,83,0.20)",
                      iconBoxBg: "rgba(0,200,83,0.18)", iconBoxBdr: "rgba(0,200,83,0.30)",
                      route: "/attendance",
                    },
                    {
                      label: "Avg Score",
                      value: liveStats.avgScore > 0 ? `${liveStats.avgScore}%` : "—",
                      status: liveStats.avgScore >= 80 ? "Excellent" : liveStats.avgScore >= 60 ? "Good" : liveStats.avgScore > 0 ? "Needs Work" : "No Data",
                      statusColor: liveStats.avgScore >= 80 ? GREEN : liveStats.avgScore >= 60 ? IND : liveStats.avgScore > 0 ? ORANGE : T4,
                      icon: TrendingUp, iconColor: IND,
                      cardBg: "linear-gradient(135deg, rgba(0,85,255,0.10) 0%, rgba(0,85,255,0.03) 100%)",
                      cardBdr: "rgba(0,85,255,0.20)",
                      iconBoxBg: "rgba(0,85,255,0.14)", iconBoxBdr: "rgba(0,85,255,0.28)",
                      route: "/performance",
                    },
                    {
                      label: "Assignments",
                      value: pendingDisplay,
                      status: liveStats.pending === null ? "No assignments yet" : noPending ? "✓ All Done" : `${liveStats.pending} to complete`,
                      statusColor: liveStats.pending === null ? T4 : noPending ? GREEN : ORANGE,
                      icon: AlertCircle, iconColor: ORANGE,
                      cardBg: "linear-gradient(135deg, rgba(255,136,0,0.13) 0%, rgba(255,136,0,0.04) 100%)",
                      cardBdr: "rgba(255,136,0,0.22)",
                      iconBoxBg: "rgba(255,136,0,0.18)", iconBoxBdr: "rgba(255,136,0,0.32)",
                      route: "/assignments",
                    },
                    {
                      label: "Recent Test",
                      value: liveStats.recentGrade !== "N/A" ? liveStats.recentGrade : "—",
                      status: liveStats.recentSubject || "No tests yet",
                      statusColor: T4,
                      icon: Star, iconColor: ROSE,
                      cardBg: "linear-gradient(135deg, rgba(255,51,85,0.10) 0%, rgba(255,51,85,0.03) 100%)",
                      cardBdr: "rgba(255,51,85,0.20)",
                      iconBoxBg: "rgba(255,51,85,0.14)", iconBoxBdr: "rgba(255,51,85,0.30)",
                      route: "/tests",
                    },
                  ].map(({ label, value, status, statusColor, icon: Icon, iconColor, cardBg, cardBdr, iconBoxBg, iconBoxBdr, route }) => (
                    <div key={label}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${label} page`}
                      onClick={() => navigate(route)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(route); } }}
                      className="rounded-[18px] px-5 pt-5 pb-5 cursor-pointer transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/30"
                      style={{ background: cardBg, border: `0.5px solid ${cardBdr}` }}>
                      <div className="w-[36px] h-[36px] rounded-[12px] flex items-center justify-center mb-[14px]"
                        style={{ background: iconBoxBg, border: `0.5px solid ${iconBoxBdr}` }}>
                        <Icon className="w-[18px] h-[18px]" style={{ color: iconColor }} strokeWidth={2.3} />
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: T4 }}>{label}</div>
                      <div className="text-[32px] font-bold mt-1 leading-none" style={{ color: T1, letterSpacing: "-1px" }}>{value}</div>
                      <div className="text-[12px] font-medium mt-[8px] truncate" style={{ color: statusColor }}>{status}</div>
                    </div>
                  ))}
                </div>

                {/* AI Insight Strip (light) */}
                <div className="px-7 py-[14px] flex items-start gap-3" style={{ borderTop: `0.5px solid ${IND_BDR}`, background: IND_SOFT }}>
                  <BrainCircuit className="w-4 h-4 shrink-0 mt-[2px]" style={{ color: IND }} />
                  {aiInsights?.child_summary_narrative ? (
                    <p className="text-[13px] leading-[1.65]" style={{ color: T3, letterSpacing: "-0.1px" }}>
                      <strong style={{ color: T1, fontWeight: 700 }}>{studentData?.name}</strong>{" "}
                      {aiInsights.child_summary_narrative.replace(studentData?.name || "", "").trim()}
                    </p>
                  ) : (
                    <p className="text-[12px] italic" style={{ color: T4 }}>
                      No activity yet — summary will appear when scores or attendance are recorded.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Row 3: Recent Alerts + Weekly Report Card ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

            {/* Recent Alerts */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Open alerts page"
              onClick={() => navigate("/alerts")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/alerts"); } }}
              className="bg-white rounded-[22px] p-6 cursor-pointer transition-all hover:-translate-y-1 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
              style={{ boxShadow: SH, border: `0.5px solid ${IND_BDR}` }}>
              <h3 className="text-[18px] font-bold mb-5" style={{ color: T1, letterSpacing: "-0.4px" }}>Recent Alerts</h3>
              {recentAlerts.length > 0 ? (
                <div className="space-y-3">
                  {recentAlerts.map(alert => (
                    <div key={alert.id} className="flex items-start gap-3 p-3 rounded-xl"
                      style={{ background: alert.urgent ? "rgba(255,136,0,0.08)" : "rgba(0,200,83,0.08)" }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: alert.urgent ? "rgba(255,136,0,0.15)" : "rgba(0,200,83,0.15)", color: alert.urgent ? ORANGE : GREEN }}>
                        {alert.urgent ? <Clock className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          {alert.category && (
                            <span className="text-[9px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded"
                              style={{ background: alert.urgent ? "rgba(255,136,0,0.16)" : "rgba(0,85,255,0.10)", color: alert.urgent ? ORANGE : IND, letterSpacing: "0.4px" }}>
                              {alert.category}
                            </span>
                          )}
                        </div>
                        <p className="text-[14px] font-medium leading-snug" style={{ color: T1 }}>{alert.title}</p>
                        <p className="text-[12px] mt-0.5" style={{ color: T3 }}>{timeAgo(alert.time)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-10">
                  <div className="w-[60px] h-[60px] rounded-[18px] flex items-center justify-center"
                    style={{ background: IND_SOFT, border: `0.5px solid ${IND_BDR}`, boxShadow: "0 0 0 5px rgba(0,85,255,0.03)" }}>
                    <ShieldCheck className="w-7 h-7" style={{ color: T4 }} />
                  </div>
                  <p className="text-[14px]" style={{ color: T3 }}>No alerts right now</p>
                </div>
              )}
            </div>

            {/* Weekly AI Report header */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Open reports page"
              onClick={() => navigate("/reports")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/reports"); } }}
              className="bg-white rounded-[22px] px-6 py-6 cursor-pointer transition-all hover:-translate-y-1 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
              style={{ boxShadow: SH, border: `0.5px solid ${IND_BDR}` }}>
              <div className="flex items-center justify-between gap-3 mb-[14px]">
                <div className="flex items-center gap-3">
                  <div className="w-[46px] h-[46px] rounded-[14px] flex items-center justify-center"
                    style={{ background: IND_SOFT, border: `0.5px solid ${IND_BDR}` }}>
                    <BookOpen className="w-5 h-5" style={{ color: IND }} />
                  </div>
                  <div>
                    <div className="text-[16px] font-bold" style={{ color: T1, letterSpacing: "-0.3px" }}>Weekly AI Report</div>
                    <div className="text-[12px] mt-0.5" style={{ color: T3 }}>
                      {isPrevWeekReport ? "Last week's report" : weekConfig.canGenerate ? (weeklyReport ? "This week's digest" : "Generate this week's report") : "New report available Friday"}
                    </div>
                  </div>
                </div>
                {weekConfig.canGenerate && !weeklyReport ? (
                  <button onClick={(e) => { e.stopPropagation(); handleGenerateWeeklyReport(); }} disabled={weeklyLoading || dataLoading}
                    className="flex items-center gap-2 px-4 py-[10px] rounded-[12px] text-[12px] font-semibold text-white disabled:opacity-50 transition-transform hover:scale-[1.02]"
                    style={{ background: IND, boxShadow: "0 4px 14px rgba(0,85,255,0.28)" }}>
                    {weeklyLoading ? <Loader2 className="w-[14px] h-[14px] animate-spin" /> : <Sparkles className="w-[14px] h-[14px]" />}
                    {weeklyLoading ? "Generating..." : "Generate"}
                  </button>
                ) : weekConfig.canGenerate && weeklyReport ? (
                  <button onClick={(e) => { e.stopPropagation(); setWeeklyReport(null); }}
                    className="text-[11px] font-medium px-3 py-[8px] rounded-[10px]"
                    style={{ color: T3, border: `0.5px solid ${IND_BDR}`, background: "white" }}>
                    Regenerate
                  </button>
                ) : (
                  <div className="flex items-center gap-1 px-3 py-[8px] rounded-[12px] text-[11px] font-semibold whitespace-nowrap"
                    style={{ background: "#E5E5EC", color: T3, border: `0.5px solid ${IND_BDR}` }}>
                    <Clock className="w-[12px] h-[12px]" />
                    Fri{weekConfig.daysLeft > 0 ? ` · ${weekConfig.daysLeft}d` : ""}
                  </div>
                )}
              </div>

              {weeklyLoading && (
                <div className="flex flex-col items-center py-6 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: IND }} />
                  <p className="text-[12px]" style={{ color: T3 }}>Analysing {childFirstName}'s week...</p>
                </div>
              )}

              {!weeklyReport && !weeklyLoading && (
                <div className="flex items-start gap-2 pt-[14px]" style={{ borderTop: `0.5px solid ${SEP}` }}>
                  <Clock className="w-[15px] h-[15px] shrink-0 mt-0.5" style={{ color: T4 }} />
                  <p className="text-[13px] leading-[1.6]" style={{ color: T3, letterSpacing: "-0.1px" }}>
                    {weekConfig.canGenerate
                      ? `Click "Generate" to get ${childFirstName}'s weekly digest.`
                      : `You can generate ${childFirstName}'s weekly report every Friday, Saturday & Sunday.`}
                  </p>
                </div>
              )}

              {weeklyReport && !weeklyLoading && isPrevWeekReport && (
                <div className="flex items-start gap-2 pt-[14px]" style={{ borderTop: `0.5px solid ${SEP}` }}>
                  <Clock className="w-[15px] h-[15px] shrink-0 mt-0.5" style={{ color: T4 }} />
                  <p className="text-[13px] leading-[1.55]" style={{ color: T3 }}>
                    This is last week's report. A new report can be generated this Friday.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── AI Message gradient card ── */}
          {weeklyReport && !weeklyLoading && (
            <div className="rounded-[24px] px-7 py-6 relative overflow-hidden mb-5"
              style={{
                background: IND_DARK_GRAD,
                border: "0.5px solid rgba(0,85,255,0.22)",
                boxShadow: "0 6px 28px rgba(0,85,255,0.22), 0 2px 8px rgba(0,85,255,0.14)"
              }}>
              <div className="absolute -top-10 -right-8 w-[200px] h-[200px] rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 65%)" }} />
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: "linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)",
                backgroundSize: "26px 26px"
              }} />
              <div className="relative z-10">
                <div className="flex items-center gap-[6px] text-[10px] font-bold uppercase tracking-[0.10em] mb-3" style={{ color: "rgba(255,255,255,0.52)" }}>
                  <Sparkles className="w-3 h-3" />
                  AI Message
                </div>
                <p className="text-[16px] leading-[1.72] font-normal max-w-[900px]" style={{ color: "rgba(255,255,255,0.92)", letterSpacing: "-0.1px" }}>
                  {weeklyReport.message}
                </p>
              </div>
            </div>
          )}

          {/* ── Detail Sections (3-col table) ── */}
          {weeklyReport && !weeklyLoading && (
            <div className="bg-white rounded-[22px] overflow-hidden grid grid-cols-1 lg:grid-cols-3 mb-5" style={{ boxShadow: SH, border: `0.5px solid ${IND_BDR}` }}>
              {[
                { tag: "Attendance", text: weeklyReport.attendance_summary },
                { tag: "Tests", text: weeklyReport.test_analysis },
                { tag: "Assignments", text: weeklyReport.assignment_status },
              ].map(({ tag, text }, i, arr) => (
                <div key={tag} className="px-6 py-5 flex flex-col gap-[6px]"
                  style={{
                    borderRight: i < arr.length - 1 ? `0.5px solid ${SEP}` : "none",
                    borderBottom: i < arr.length - 1 ? `0.5px solid ${SEP}` : "none",
                  }}>
                  <span className="text-[10px] font-bold uppercase tracking-[0.09em]" style={{ color: IND3 }}>{tag}</span>
                  <p className="text-[13px] leading-[1.58]" style={{ color: T2, letterSpacing: "-0.1px" }}>{text}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Overall Performance + Tips row ── */}
          {weeklyReport && !weeklyLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

              {/* Overall Performance */}
              {weeklyReport?.overall_performance ? (
                <div className="bg-white rounded-[22px] px-6 py-6 flex items-start justify-between gap-4 relative overflow-hidden"
                  style={{ border: `0.5px solid ${ORANGE_B}`, boxShadow: SH }}>
                  <div className="absolute -top-5 -right-5 w-[80px] h-[80px] rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(245,160,0,0.10) 0%, transparent 70%)" }} />
                  <div className="relative z-10">
                    <div className="text-[10px] font-bold uppercase tracking-[0.09em] mb-[5px]" style={{ color: ORANGE }}>Overall Performance</div>
                    <div className="text-[20px] font-bold" style={{ color: T1, letterSpacing: "-0.3px" }}>{weeklyReport.overall_performance.verdict}</div>
                    <p className="text-[13px] mt-[6px] leading-[1.58]" style={{ color: T3, letterSpacing: "-0.1px" }}>{weeklyReport.overall_performance.score_context}</p>
                  </div>
                  <div className="flex items-center gap-1 px-[14px] py-[9px] rounded-[14px] text-[12px] font-bold shrink-0 relative z-10"
                    style={{
                      background: weeklyReport.overall_performance.trend === "Declining" ? ORANGE_S : GREEN_S,
                      border: `0.5px solid ${weeklyReport.overall_performance.trend === "Declining" ? ORANGE_B : GREEN_B}`,
                      color: weeklyReport.overall_performance.trend === "Declining" ? "#905800" : "#0A6A2E",
                    }}>
                    <TrendingUp className={`w-3 h-3 ${weeklyReport.overall_performance.trend === "Declining" ? "rotate-180" : ""}`} />
                    {weeklyReport.overall_performance.trend}
                  </div>
                </div>
              ) : <div />}

              {/* Download PDF button */}
              <button onClick={handleDownloadPDF} disabled={pdfDownloading}
                className="rounded-[22px] py-[22px] px-6 flex items-center justify-center gap-3 text-[15px] font-bold text-white disabled:opacity-50 transition-transform hover:scale-[1.01] relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, #001888 0%, #0033CC 50%, #0055FF 100%)`, boxShadow: SH_BTN, letterSpacing: "-0.2px" }}>
                <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.13) 0%, transparent 52%)" }} />
                <span className="relative z-10 flex items-center gap-3">
                  {pdfDownloading ? (
                    <><Loader2 className="w-[18px] h-[18px] animate-spin" /> Generating PDF...</>
                  ) : (
                    <><Download className="w-[18px] h-[18px]" /> Download PDF Report</>
                  )}
                </span>
              </button>
            </div>
          )}

          {/* ── AI Improvement Tips ── */}
          {weeklyReport?.improvement_tips?.length > 0 && (
            <div className="mb-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.10em] mb-3 px-1" style={{ color: T4 }}>
                AI Improvement Tips
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {weeklyReport.improvement_tips.map((t: { tip: string; reason: string }, i: number) => (
                  <div key={i} className="bg-white rounded-[20px] px-5 py-5 flex items-start gap-4 transition-transform hover:-translate-y-1 hover:scale-[1.02]"
                    style={{ boxShadow: SH, border: `0.5px solid ${IND_BDR}` }}>
                    <div className="w-[46px] h-[46px] rounded-[14px] flex items-center justify-center shrink-0 text-[22px]"
                      style={{
                        background: i === 0 ? "rgba(255,215,0,0.12)" : IND_SOFT,
                        border: `0.5px solid ${i === 0 ? "rgba(255,215,0,0.22)" : IND_BDR}`
                      }}>
                      {i === 0 ? "💡" : "🎯"}
                    </div>
                    <div>
                      <div className="text-[15px] font-semibold leading-[1.35]" style={{ color: T1, letterSpacing: "-0.2px" }}>{t.tip}</div>
                      <p className="text-[13px] mt-[4px] leading-[1.5]" style={{ color: T3, letterSpacing: "-0.1px" }}>{t.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AI Parenting Tips ── */}
          <div className="bg-white rounded-[22px] overflow-hidden" style={{ boxShadow: SH, border: `0.5px solid ${IND_BDR}` }}>
            <div className="flex items-center gap-3 px-6 py-5 relative overflow-hidden"
              style={{ background: IND_DARK_GRAD, borderBottom: `0.5px solid ${IND_BDR}` }}>
              <div className="absolute -top-7 -right-4 w-[140px] h-[140px] rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(255,255,255,0.09) 0%, transparent 65%)" }} />
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: "linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)",
                backgroundSize: "24px 24px"
              }} />
              <span className="text-[26px] relative z-10">💡</span>
              <div className="relative z-10">
                <div className="text-[17px] font-bold text-white" style={{ letterSpacing: "-0.3px" }}>AI Parenting Tips</div>
                <div className="text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.52)" }}>Based on {childFirstName}'s current data</div>
              </div>
            </div>

            {(() => {
              const tips = smartTips;
              return tips.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-3">
                  {tips.map((item: { tip: string; reason: string }, i: number, arr: any[]) => (
                    <div key={i} className="px-6 py-5 flex items-start gap-3"
                      style={{
                        borderRight: i < arr.length - 1 ? `0.5px solid ${SEP}` : "none",
                        borderBottom: i < arr.length - 1 ? `0.5px solid ${SEP}` : "none",
                      }}>
                      <div className="w-8 h-8 rounded-[10px] flex items-center justify-center text-[13px] font-bold shrink-0 mt-0.5"
                        style={{ background: IND_SOFT, border: `0.5px solid ${IND_BDR}`, color: IND }}>
                        {i + 1}
                      </div>
                      <div>
                        <div className="text-[14px] font-semibold" style={{ color: T1, letterSpacing: "-0.2px" }}>{item.tip}</div>
                        <p className="text-[12px] mt-[4px] leading-[1.5]" style={{ color: T3, letterSpacing: "-0.1px" }}>{item.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-10 flex items-center gap-3 justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: IND }} />
                  <p className="text-[14px] italic" style={{ color: T3 }}>Loading {childFirstName}'s tips...</p>
                </div>
              );
            })()}
          </div>

          {/* Hidden PDF render target */}
          {weeklyReport && pdfData && (
            <div style={{ position: "fixed", top: "-9999px", left: "-9999px", zIndex: -1 }}>
              <WeeklyReportPDF
                ref={pdfRef}
                report={weeklyReport}
                studentName={pdfData.child_name}
                grade={pdfData.grade}
                attendance={pdfData.attendance}
                tests={pdfData.tests}
                assignments={pdfData.assignments}
                avgScore={pdfData.overall_avg}
                weekEnd={pdfData.weekEnd}
                onDownload={() => {}}
              />
            </div>
          )}

        </div>
      </div>
    );
  }

};

export default DashboardPage;
