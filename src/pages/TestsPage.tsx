import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar, CheckCircle, Clock, User,
  GraduationCap, Trophy, Medal, Target, TrendingDown,
  AlertTriangle, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useSchoolSettings, resolveAcademicYear } from "@/hooks/useSchoolSettings";
import { where, onSnapshot, limit } from "firebase/firestore";
import { scopedQuery } from "@/lib/scopedQuery";
import { subscribeEnrollments } from "@/lib/enrollmentQuery";
import { subscribePerStudent } from "@/lib/perStudentQuery";
import { useIsMobile } from "@/hooks/use-mobile";

// ── Brand tokens (Blue Apple) — shared mobile + desktop ──────────────────────
const TOK = {
  B1: "#0055FF", B2: "#1166FF", B4: "#4499FF",
  BG: "#EEF4FF", BG2: "#E0ECFF",
  T1: "#001040", T3: "#5070B0", T4: "#99AACC",
  GREEN: "#00C853",
  RED: "#FF3355",
  ORANGE: "#FF8800",
  SH: "0 0 0 0.5px rgba(0,85,255,0.08), 0 2px 8px rgba(0,85,255,0.09), 0 10px 24px rgba(0,85,255,0.10)",
  SH_LG: "0 0 0 0.5px rgba(0,85,255,0.10), 0 4px 16px rgba(0,85,255,0.11), 0 18px 44px rgba(0,85,255,0.13)",
} as const;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

// Default grade-scale fallbacks. Stays in sync with other parent pages so
// the same student gets the same A/B/C banding across TestsPage / Performance.
const DEFAULT_GRADE_SCALE = { A: 85, B: 70, C: 50 } as const;

// Safe Date parser — handles Firestore Timestamp, {seconds}, string, number.
const toSafeDate = (v: any): Date | null => {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

// Null-aware percentage normalizer for score docs. Returns `null` for
// missing/invalid data so callers can EXCLUDE no-data rows from grade
// distribution instead of fabricating "Below C" (memory `bug_pattern_score_
// zero_no_data`). Handles 3 collection shapes:
//   • test_scores → percentage | (score / maxScore * 100)
//   • gradebook_scores → percentage | (mark / maxMarks * 100)  ← singular 'mark'
//   • results → percentage | score (assumed already 0-100)
const pctOf = (d: any): number | null => {
  if (!d) return null;
  // Direct percentage field wins when present and finite.
  const direct = typeof d.percentage === "number" ? d.percentage : Number(d.percentage);
  if (Number.isFinite(direct) && direct >= 0) return Math.min(100, Math.max(0, direct));
  // score + maxScore pair (test_scores convention).
  const score = typeof d.score === "number" ? d.score : Number(d.score);
  const maxScore = typeof d.maxScore === "number" ? d.maxScore : Number(d.maxScore);
  if (Number.isFinite(score) && Number.isFinite(maxScore) && maxScore > 0) {
    return Math.min(100, Math.max(0, (score / maxScore) * 100));
  }
  // mark + maxMarks pair (gradebook_scores convention — singular 'mark').
  const mark = typeof d.mark === "number" ? d.mark : Number(d.mark);
  const maxMarks = typeof d.maxMarks === "number" ? d.maxMarks : Number(d.maxMarks);
  if (Number.isFinite(mark) && Number.isFinite(maxMarks) && maxMarks > 0) {
    return Math.min(100, Math.max(0, (mark / maxMarks) * 100));
  }
  // results legacy — raw score interpreted as percentage when no max field.
  if (Number.isFinite(score) && score >= 0 && score <= 100 && !d.maxScore && !d.maxMarks) {
    return score;
  }
  return null;
};

// Per-collection timestamp resolver — each writer uses a different field name
// (memory `bug_pattern_filterbytime_field_drift`). Returns null when no
// usable timestamp exists so monthly-activity buckets don't double-count.
const eventTimestampMs = (d: any): number | null => {
  if (!d) return null;
  const cand = d.timestamp ?? d.updatedAt ?? d.submittedAt ?? d.gradedAt ?? d.date ?? d.createdAt;
  if (cand == null) return null;
  if (typeof cand?.toMillis === "function") return cand.toMillis();
  if (typeof cand?.seconds === "number") return cand.seconds * 1000;
  if (typeof cand === "number" && Number.isFinite(cand)) return cand;
  if (typeof cand === "string") {
    const t = new Date(cand).getTime();
    return Number.isFinite(t) ? t : null;
  }
  return null;
};

// IST date-key in "YYYY-MM-DD" form — matches what MarkAttendance / CreateTest
// write (memory `bug_pattern_ist_vs_utc_date_filter`). Used to compare a test's
// `testDate` string against today without UTC parse drift.
const istTodayKey = (): string =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

// IST-aware "upcoming" check — a test scheduled for TODAY stays in upcoming
// for the whole day (until next day's IST midnight). Without this, naive
// `new Date(testDate) >= now` parses "2026-05-25" as midnight UTC = 5:30 AM
// IST → drops the test from upcoming after 5:30 AM on the test day.
const isTestUpcoming = (testDateRaw: any, todayKey: string): boolean => {
  if (!testDateRaw) return false;
  // If it's a YYYY-MM-DD string, compare directly to todayKey.
  if (typeof testDateRaw === "string" && /^\d{4}-\d{2}-\d{2}/.test(testDateRaw)) {
    return testDateRaw.slice(0, 10) >= todayKey;
  }
  // Otherwise parse to Date and produce an IST date-key for comparison.
  const dt = toSafeDate(testDateRaw);
  if (!dt) return false;
  const key = dt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return key >= todayKey;
};

// Test-type classification for tag label. Two-stage:
//   1. Honor a canonical `t.testType` value when the writer set one explicitly.
//   2. Otherwise, fall back to a substring search over name/type/mode fields.
//      The keyword set covers the common writer conventions in Indian schools
//      including vernacular variants (mauklik = oral, prayogik = practical).
const TYPE_KEYWORDS: Array<{ label: string; cls: "blue" | "green" | "orange"; needles: readonly string[] }> = [
  { label: "Oral",      cls: "orange", needles: ["oral", "viva", "speak", "spoken", "mauklik", "vivek"] },
  { label: "Practical", cls: "green",  needles: ["practical", "prayogik", "lab", "experiment"] },
  { label: "Quiz",      cls: "blue",   needles: ["quiz", "mcq", "rapid"] },
];

const getTestTypeTag = (t: any): { label: string; cls: "blue" | "green" | "orange" } => {
  // Canonical field wins when teacher set it explicitly.
  const canonical = String(t?.testType ?? "").trim().toLowerCase();
  if (canonical === "oral")      return { label: "Oral", cls: "orange" };
  if (canonical === "practical") return { label: "Practical", cls: "green" };
  if (canonical === "quiz")      return { label: "Quiz", cls: "blue" };
  if (canonical === "written")   return { label: "Written", cls: "blue" };
  // Heuristic fallback — search the union of name-shaped fields.
  const raw = [t?.type, t?.testType, t?.mode, t?.testName, t?.title]
    .filter(Boolean)
    .map(v => String(v).toLowerCase())
    .join(" ");
  for (const entry of TYPE_KEYWORDS) {
    if (entry.needles.some(n => raw.includes(n))) return { label: entry.label, cls: entry.cls };
  }
  return { label: "Written", cls: "blue" };
};

const TAG_STYLE: Record<"blue" | "green" | "orange", { bg: string; color: string; border: string }> = {
  blue:   { bg: "rgba(0,85,255,0.10)",  color: TOK.B1,    border: "rgba(0,85,255,0.20)" },
  green:  { bg: "rgba(0,200,83,0.10)",  color: "#007830", border: "rgba(0,200,83,0.22)" },
  orange: { bg: "rgba(255,136,0,0.10)", color: "#884400", border: "rgba(255,136,0,0.22)" },
};

const dateChipStyle = (urgent: boolean) => ({
  background: urgent ? "linear-gradient(135deg, #FF6600, #FFAA33)" : "linear-gradient(135deg, #0044EE, #2277FF)",
  boxShadow: urgent ? "0 3px 10px rgba(255,102,0,0.24)" : "0 3px 10px rgba(0,68,238,0.28)",
});

const scoreGradient = (pct: number) => {
  if (pct >= 80) return { bg: "linear-gradient(135deg, #00A040, #00C853)", shadow: "0 3px 10px rgba(0,160,64,0.30)" };
  if (pct >= 60) return { bg: `linear-gradient(135deg, ${TOK.B1}, ${TOK.B2})`, shadow: "0 3px 10px rgba(0,85,255,0.30)" };
  if (pct >= 40) return { bg: "linear-gradient(135deg, #FF6600, #FFAA33)", shadow: "0 3px 10px rgba(255,102,0,0.28)" };
  return { bg: "linear-gradient(135deg, #FF3355, #FF6688)", shadow: "0 3px 10px rgba(255,51,85,0.28)" };
};

const dayCountLabel = (days: number) =>
  days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`;

const TestsPage = () => {
  const { studentData } = useAuth();
  const navigate = useNavigate();
  const settings = useSchoolSettings();
  const { gradeScale } = settings;
  // Real academic year — replaces the two hardcoded "2025–26" strings that
  // showed the same year to every school regardless of date.
  const academicYear = resolveAcademicYear(settings);
  const isMobile = useIsMobile();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const [loading, setLoading] = useState(true);
  // Raw upcoming-by-date list straight from the listener. The visible
  // `upcomingTests` derived below subtracts any test the student has already
  // been scored on — so a test that the teacher marked early stops haunting
  // the parent's "Upcoming" view.
  const [upcomingTestsRaw, setUpcomingTestsRaw] = useState<any[]>([]);
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [stats, setStats] = useState({ aGrade: 0, bGrade: 0, cGrade: 0, belowC: 0, ungraded: 0, totalTaken: 0 });
  // Listener error surface + retry handshake — matches the pattern used on
  // AssignmentsPage / DashboardPage / MyChildPage. Without this, a transient
  // permission/network failure leaves TestsPage silently empty.
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!studentData?.id) return;
    // Hard schoolId guard — scopedQuery's silent fallback drops the schoolId
    // filter when schoolId is falsy; we want to fail closed during the brief
    // window before AuthContext hydrates schoolId. Memory
    // `bug_pattern_unscoped_collection_reads`.
    if (!studentData.schoolId) {
      setLoading(false);
      return;
    }
    // Clear any stale data from a prior student before the new listeners
    // start firing — prevents the previous child's tests/results from
    // briefly bleeding through when a parent switches between children.
    setUpcomingTestsRaw([]);
    setRecentResults([]);
    setStats({ aGrade: 0, bGrade: 0, cGrade: 0, belowC: 0, ungraded: 0, totalTaken: 0 });
    setLoading(true);
    setListenerError(null);
    const schoolId = studentData.schoolId;

    // ── Tests listener (chunked by classId; up to 30 per Firestore `in`) ────
    let enrollSnap: any = null;
    // Each chunk pushes its own unsub so cleanup tears down ALL of them.
    let testUnsubs: Array<() => void> = [];
    const cleanupTests = () => {
      testUnsubs.forEach(u => { try { u(); } catch { /* noop */ } });
      testUnsubs = [];
    };

    const processEnrollments = () => {
      const classIds = Array.from(new Set((enrollSnap?.docs || []).map((d: any) => d.data().classId).filter(Boolean))) as string[];
      // Short-circuit: if the student has zero enrollments AND no direct
      // `classId` on their record, there is nothing meaningful to query for.
      // Previously we hit Firestore with `classId == "General"` which always
      // returned empty — a wasted round trip on every effect re-run.
      const fallbackClassId = (studentData.classId || "").toString().trim();
      const searchIds = classIds.length > 0
        ? classIds
        : fallbackClassId
          ? [fallbackClassId]
          : [];

      cleanupTests();

      if (searchIds.length === 0) {
        setUpcomingTestsRaw([]);
        return;
      }

      const chunks: string[][] = [];
      for (let i = 0; i < searchIds.length; i += 10) chunks.push(searchIds.slice(i, i + 10));

      const allTests: any[] = [];
      let resolved = 0;
      chunks.forEach(chunk => {
        const q = scopedQuery("tests", schoolId, where("classId", "in", chunk));
        const unsub = onSnapshot(
          q,
          (snap) => {
            if (!mountedRef.current) return;
            snap.docs.forEach(d => {
              const idx = allTests.findIndex(t => t.id === d.id);
              const item = { id: d.id, ...(d.data() as any) };
              if (idx >= 0) allTests[idx] = item; else allTests.push(item);
            });
            resolved++;
            if (resolved >= chunks.length) {
              // IST-aware upcoming filter: a test scheduled for TODAY stays
              // visible the WHOLE day. Read `testDate` first per memory
              // `bug_pattern_tests_testdate_field` (CreateTest writes
              // `testDate`, never `date`). Drop docs with no usable date.
              const todayKey = istTodayKey();
              const filtered = allTests
                .filter(t => isTestUpcoming(t.testDate || t.date, todayKey))
                .map(t => {
                  // Cache a sort timestamp so a single parse pass drives the order.
                  const dt = toSafeDate(t.testDate || t.date);
                  return { ...t, __sortMs: dt ? dt.getTime() : 0 };
                })
                .sort((a, b) => a.__sortMs - b.__sortMs);
              setUpcomingTestsRaw(filtered);
            }
          },
          (err) => {
            console.error("[Tests] tests listener error:", err);
            setListenerError("Couldn't load upcoming tests. Tap retry.");
          },
        );
        testUnsubs.push(unsub);
      });
    };

    const unsubEnroll = subscribeEnrollments(
      studentData,
      (docs) => {
        enrollSnap = { docs };
        processEnrollments();
      },
      (err) => {
        console.error("[Tests] enrollments listener error:", err);
        setListenerError("Couldn't load your enrollments. Tap retry.");
      },
    );

    // ── Score sources — 3-source merge (test_scores + gradebook_scores + ──
    // results). Memory P0-1: gradebook_scores carries ~40% of grades for
    // schools using the teacher Gradebook bulk upload flow; missing this
    // source silently under-counted Recent Results, Term stats, and the
    // Monthly Activity chart. Mirrors the proven MyChildPage 2026-05-21 fix.
    let tsCache: any[] = [];
    let gbCache: any[] = [];
    let rsCache: any[] = [];
    let scoreReady = { ts: false, gb: false, rs: false };

    const emitScores = () => {
      if (!mountedRef.current) return;
      // Dedup by doc id across sources; later listeners' docs win on collision.
      const map = new Map<string, any>();
      [...tsCache, ...gbCache, ...rsCache].forEach((d: any) => map.set(d.id, d));
      const scores = Array.from(map.values())
        .map(d => ({ ...d, __ts: eventTimestampMs(d) ?? 0 }))
        .sort((a: any, b: any) => b.__ts - a.__ts);
      setRecentResults(scores);

      // Null-aware stats — score=0 must NOT be conflated with "no data".
      // Memory `bug_pattern_score_zero_no_data`. New `ungraded` bucket
      // surfaces docs without a usable percentage.
      let a = 0, b = 0, c = 0, d = 0, ungraded = 0;
      scores.forEach(s => {
        const pct = pctOf(s);
        if (pct == null) { ungraded++; return; }
        if (pct >= (gradeScale?.A ?? DEFAULT_GRADE_SCALE.A)) a++;
        else if (pct >= (gradeScale?.B ?? DEFAULT_GRADE_SCALE.B)) b++;
        else if (pct >= (gradeScale?.C ?? DEFAULT_GRADE_SCALE.C)) c++;
        else d++;
      });
      setStats({ aGrade: a, bGrade: b, cGrade: c, belowC: d, ungraded, totalTaken: scores.length });

      if (scoreReady.ts && scoreReady.gb && scoreReady.rs) setLoading(false);
    };

    const subScoreSource = (collName: string, cacheSetter: (docs: any[]) => void, readyKey: keyof typeof scoreReady) =>
      subscribePerStudent({
        collection: collName,
        student: studentData,
        // Cap per-source — 50 × 3 sources = 150 max merged. Enough for a
        // full term of grading without falsely truncating Term stats.
        filters: [limit(50)],
        onChange: (docs) => {
          cacheSetter(docs.map((d: any) => ({ id: d.id, ...d.data() })));
          scoreReady[readyKey] = true;
          emitScores();
        },
        onError: (err) => {
          console.error(`[Tests] ${collName} listener error:`, err);
          setListenerError("Couldn't load your test results. Tap retry.");
          // Mark ready anyway so the page doesn't spin forever; user can retry.
          scoreReady[readyKey] = true;
          emitScores();
        },
      });

    const unsubTS = subScoreSource("test_scores",      (d) => { tsCache = d; }, "ts");
    const unsubGB = subScoreSource("gradebook_scores", (d) => { gbCache = d; }, "gb");
    const unsubRS = subScoreSource("results",          (d) => { rsCache = d; }, "rs");

    return () => {
      unsubEnroll();
      unsubTS(); unsubGB(); unsubRS();
      cleanupTests();
    };
  }, [studentData?.id, studentData?.schoolId, studentData?.email, refreshKey]);

  // Day-diff with IST awareness — a test on "today IST" reads "Today" not "0".
  const getDayDiff = (testDateRaw: any): number => {
    if (!testDateRaw) return 0;
    // Treat the test as living in IST date space; compare IST date-keys to
    // avoid UTC parse drift around midnight.
    const todayKey = istTodayKey();
    if (typeof testDateRaw === "string" && /^\d{4}-\d{2}-\d{2}/.test(testDateRaw)) {
      // Days between two YYYY-MM-DD strings via Date diff.
      const [y1, m1, d1] = todayKey.split("-").map(Number);
      const [y2, m2, d2] = testDateRaw.slice(0, 10).split("-").map(Number);
      const a = Date.UTC(y1, (m1 ?? 1) - 1, d1 ?? 1);
      const b = Date.UTC(y2, (m2 ?? 1) - 1, d2 ?? 1);
      return Math.max(0, Math.round((b - a) / 86400000));
    }
    const dt = toSafeDate(testDateRaw);
    if (!dt) return 0;
    const key = dt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const [y1, m1, d1] = istTodayKey().split("-").map(Number);
    const [y2, m2, d2] = key.split("-").map(Number);
    const a = Date.UTC(y1, (m1 ?? 1) - 1, d1 ?? 1);
    const b = Date.UTC(y2, (m2 ?? 1) - 1, d2 ?? 1);
    return Math.max(0, Math.round((b - a) / 86400000));
  };

  const formatDate = (date: any) => {
    const d = toSafeDate(date);
    if (!d) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // Set of testIds the student has already been scored on (any source —
  // test_scores, gradebook_scores, results). The instant a teacher enters
  // a score for a test, it disappears from the parent's "Upcoming" list.
  const scoredTestIds = useMemo(() => {
    const set = new Set<string>();
    recentResults.forEach((r: any) => {
      const tid = r?.testId ?? r?.test_id;
      if (tid) set.add(String(tid));
    });
    return set;
  }, [recentResults]);

  // Visible upcoming list — raw date-future tests MINUS:
  //   (a) any test the student already has a score for (teacher entered marks
  //       early — test is "done" from the parent's perspective even if its
  //       calendar date is still in the future).
  //   (b) any test whose `tests/{id}.status` was synced to "Completed" by the
  //       EnterScores bulk flow (memory `bug_pattern_score_writer_overwrite`)
  //       — covers the case where the parent's own score doc hasn't loaded
  //       yet but the school-wide test is closed.
  const upcomingTests = useMemo(() => {
    return upcomingTestsRaw.filter((t: any) => {
      if (t?.id && scoredTestIds.has(String(t.id))) return false;
      const status = String(t?.status ?? "").toLowerCase();
      if (status === "completed" || status === "graded") return false;
      return true;
    });
  }, [upcomingTestsRaw, scoredTestIds]);

  // Hero needs an honest title — fall back to subject when teacher didn't
  // set a testName (some writers stamp only `subject`).
  const nextTest = upcomingTests[0];
  const nextTestTitle = nextTest
    ? (nextTest.testName || nextTest.subject || "Untitled test")
    : "No upcoming tests";

  // Monthly Activity — memoised so we don't re-walk all results each render.
  // Last 6 ISO months (anchored to today's local month).
  const monthlyActivity = useMemo(() => {
    const now = new Date();
    const slots = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { label: MONTHS[d.getMonth()], year: d.getFullYear(), month: d.getMonth(), count: 0, isCurrent: i === 5 };
    });
    recentResults.forEach((r: any) => {
      const ms = eventTimestampMs(r);
      if (ms == null) return;
      const ts = new Date(ms);
      const slot = slots.find(s => s.year === ts.getFullYear() && s.month === ts.getMonth());
      if (slot) slot.count += 1;
    });
    return slots;
  }, [recentResults]);
  const maxMonthly = Math.max(1, ...monthlyActivity.map(m => m.count));

  /* ═══════════════════════════════════════════════════════════════
     MOBILE — Bright Blue Apple UI
     ═══════════════════════════════════════════════════════════════ */
  if (isMobile) {
    // Brand tokens come from module scope (TOK) — no per-branch shadow.
    const { B1, B4, BG, T1, T3, T4, GREEN, RED, ORANGE, SH, SH_LG } = TOK;

    return (
      <div className="animate-in fade-in duration-500 -mx-3 -mt-3 md:mx-0 md:mt-0"
        style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", background: BG, minHeight: "100vh" }}>

        {/* ── Page Head ── */}
        <div className="px-[22px] pt-[18px]">
          <div className="text-[26px] font-bold mb-[3px]" style={{ color: T1, letterSpacing: "-0.7px" }}>Tests &amp; Examinations</div>
          <div className="text-[12px] font-normal" style={{ color: T3 }}>Track upcoming assessments and latest outcomes</div>
        </div>

        {/* ── Listener error banner (retry) ── */}
        {listenerError && (
          <div role="alert" aria-live="polite" className="mx-[22px] mt-3 rounded-[16px] px-4 py-3 flex items-center gap-3"
            style={{ background: "rgba(255,136,0,0.10)", border: "0.5px solid rgba(255,136,0,0.28)" }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: ORANGE }} />
            <p className="text-[12px] font-semibold flex-1" style={{ color: "#884400" }}>{listenerError}</p>
            <button
              onClick={() => { setListenerError(null); setRefreshKey(k => k + 1); }}
              className="px-3 py-1.5 rounded-[10px] text-[11px] font-bold flex items-center gap-1.5"
              style={{ background: "white", color: ORANGE, border: "0.5px solid rgba(255,136,0,0.28)" }}>
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {/* ── Hero Banner (dashboard 4-stat-card vibe) ── */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Open syllabus page to prepare for upcoming test"
          onClick={() => navigate("/syllabus")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/syllabus"); } }}
          className="mx-5 mt-[18px] rounded-[22px] px-4 pt-[18px] pb-[18px] relative overflow-hidden cursor-pointer active:scale-[0.96] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
          style={{
            background: "linear-gradient(135deg, rgba(0,85,255,0.10) 0%, rgba(0,85,255,0.03) 100%)",
            boxShadow: SH,
            border: "0.5px solid rgba(0,85,255,0.20)",
            transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
          }}>
          <div className="absolute pointer-events-none" style={{ bottom: 10, right: 10 }}>
            <GraduationCap style={{ width: 72, height: 72, color: B1, opacity: 0.20, strokeWidth: 1.6 }} />
          </div>
          <div className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center mb-[14px] relative"
            style={{ background: "rgba(0,85,255,0.14)", border: "0.5px solid rgba(0,85,255,0.28)" }}>
            <Calendar className="w-[17px] h-[17px]" style={{ color: B1 }} />
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] relative" style={{ color: T4 }}>Coming Up Next</div>
          <div className="text-[22px] font-bold mt-1 leading-[1.15] relative" style={{ color: T1, letterSpacing: "-0.6px" }}>
            {nextTestTitle}
          </div>
          {nextTest && (
            <div className="flex items-center gap-[7px] mt-[10px] relative flex-wrap">
              <span className="text-[12px] font-semibold" style={{ color: T3, letterSpacing: "-0.1px" }}>
                {formatDate(nextTest.testDate || nextTest.date)}
              </span>
              {/* Only render time when the test doc provides one —
                  previously defaulted to "9:00 AM" which looked real. */}
              {nextTest.time && (
                <>
                  <div className="w-1 h-1 rounded-full" style={{ background: T4 }} />
                  <span className="text-[12px] font-semibold" style={{ color: T3 }}>{nextTest.time}</span>
                </>
              )}
              <div className="w-1 h-1 rounded-full" style={{ background: T4 }} />
              <span className="text-[12px] font-semibold" style={{ color: B1 }}>
                {dayCountLabel(getDayDiff(nextTest.testDate || nextTest.date))}
              </span>
            </div>
          )}
        </div>

        {/* ── Upcoming Tests Section ── */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Open syllabus page"
          onClick={() => navigate("/syllabus")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/syllabus"); } }}
          className="mx-5 mt-[14px] bg-white rounded-[24px] p-5 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
          style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
          <div className="absolute -top-10 -right-8 w-[120px] h-[120px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(0,85,255,0.05) 0%, transparent 70%)" }} />
          <div className="flex items-center justify-between mb-[14px]">
            <div className="text-[17px] font-bold" style={{ color: T1, letterSpacing: "-0.3px" }}>Upcoming Tests</div>
            <div className="text-[11px] font-bold px-[10px] py-[3px] rounded-full tracking-[0.02em]"
              style={{ color: B1, background: "rgba(0,85,255,0.10)", border: "0.5px solid rgba(0,85,255,0.18)" }}>
              {upcomingTests.length} test{upcomingTests.length === 1 ? "" : "s"}
            </div>
          </div>

          {loading ? (
            // 3-row skeleton matches the actual row shape so the layout doesn't
            // jump when data arrives. Replaces the plain spinner (P3 polish).
            <div className="flex flex-col gap-[10px]" aria-busy="true" aria-live="polite">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex items-center gap-[13px] px-[15px] py-[13px] rounded-[18px] animate-pulse"
                  style={{ background: BG, border: "0.5px solid rgba(0,85,255,0.08)" }}>
                  <div className="w-11 h-11 rounded-[14px] shrink-0" style={{ background: "rgba(0,85,255,0.12)" }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 rounded-full" style={{ background: "rgba(0,85,255,0.10)", width: `${65 + i * 8}%` }} />
                    <div className="h-2 rounded-full" style={{ background: "rgba(0,85,255,0.07)", width: `${40 + i * 6}%` }} />
                  </div>
                  <div className="w-14 h-5 rounded-full shrink-0" style={{ background: "rgba(0,85,255,0.10)" }} />
                </div>
              ))}
            </div>
          ) : upcomingTests.length === 0 ? (
            <div className="flex flex-col items-center gap-[10px] pt-6 pb-4 relative z-10">
              <div className="w-14 h-14 rounded-[18px] flex items-center justify-center"
                style={{ background: "rgba(0,200,83,0.10)", border: "0.5px solid rgba(0,200,83,0.22)", boxShadow: "0 0 0 8px rgba(0,85,255,0.04)" }}>
                <CheckCircle className="w-[26px] h-[26px]" style={{ color: GREEN }} strokeWidth={2.2} />
              </div>
              <div className="text-[13px] font-medium" style={{ color: T4, letterSpacing: "-0.1px" }}>No upcoming tests</div>
              <div className="text-[11px] font-normal text-center max-w-[200px] leading-[1.55]" style={{ color: T4 }}>
                You're all clear! New tests will appear here when scheduled by your teacher.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-[10px] relative z-10">
              {upcomingTests.map((t: any, i: number) => {
                const d = toSafeDate(t.testDate || t.date);
                const days = getDayDiff(t.testDate || t.date);
                const urgent = days <= 3;
                const type = getTestTypeTag(t);
                const tag = TAG_STYLE[type.cls];
                const subject = t.subject || t.testName || "";
                const openRow = () => navigate("/syllabus", { state: { subject } });
                return (
                  <div key={t.id || i}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open syllabus for ${subject || "test"}`}
                    onClick={(e) => { e.stopPropagation(); openRow(); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); openRow(); } }}
                    className="flex items-center gap-[13px] px-[15px] py-[13px] rounded-[18px] active:scale-[0.97] transition-transform cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
                    style={{ background: BG, border: "0.5px solid rgba(0,85,255,0.12)", transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)" }}>
                    <div className="w-11 h-11 rounded-[14px] flex flex-col items-center justify-center gap-[1px] shrink-0"
                      style={dateChipStyle(urgent)}>
                      <div className="text-[17px] font-bold text-white leading-none">{d ? d.getDate() : "—"}</div>
                      <div className="text-[8px] font-bold uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.68)" }}>
                        {d ? MONTHS[d.getMonth()] : ""}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold truncate" style={{ color: T1, letterSpacing: "-0.2px", marginBottom: 3 }}>
                        {t.testName || t.subject || "Test"}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {t.teacherName && (
                          <div className="flex items-center gap-[4px] text-[11px] font-medium" style={{ color: T3 }}>
                            <User className="w-[10px] h-[10px]" strokeWidth={2.5} />
                            <span className="truncate max-w-[90px]">{t.teacherName}</span>
                          </div>
                        )}
                        {(t.time || d) && (
                          <div className="flex items-center gap-[4px] text-[11px] font-medium" style={{ color: T3 }}>
                            <Clock className="w-[10px] h-[10px]" strokeWidth={2.5} />
                            {t.time || dayCountLabel(days)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="px-[10px] py-1 rounded-full text-[10px] font-bold shrink-0"
                      style={{ background: tag.bg, color: tag.color, border: `0.5px solid ${tag.border}` }}>
                      {type.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Recent Results Section ── */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Open performance page for detailed results"
          onClick={() => navigate("/performance")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/performance"); } }}
          className="mx-5 mt-[14px] bg-white rounded-[24px] p-5 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
          style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
          <div className="absolute -top-10 -right-8 w-[120px] h-[120px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(0,85,255,0.05) 0%, transparent 70%)" }} />
          <div className="flex items-center justify-between mb-[14px]">
            <div className="text-[17px] font-bold" style={{ color: T1, letterSpacing: "-0.3px" }}>Recent Results</div>
            <div className="text-[11px] font-bold px-[10px] py-[3px] rounded-full tracking-[0.02em]"
              style={{ color: B1, background: "rgba(0,85,255,0.10)", border: "0.5px solid rgba(0,85,255,0.18)" }}>
              {recentResults.length} result{recentResults.length === 1 ? "" : "s"}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col gap-[10px]" aria-busy="true" aria-live="polite">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex items-center gap-[13px] px-[15px] py-[13px] rounded-[18px] animate-pulse"
                  style={{ background: BG, border: "0.5px solid rgba(0,85,255,0.08)" }}>
                  <div className="w-11 h-11 rounded-[14px] shrink-0" style={{ background: "rgba(0,85,255,0.12)" }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 rounded-full" style={{ background: "rgba(0,85,255,0.10)", width: `${60 + i * 10}%` }} />
                    <div className="h-2 rounded-full" style={{ background: "rgba(0,85,255,0.07)", width: `${35 + i * 8}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : recentResults.length === 0 ? (
            <div className="flex flex-col items-center gap-[10px] pt-6 pb-4 relative z-10">
              <div className="w-14 h-14 rounded-[18px] flex items-center justify-center"
                style={{ background: "rgba(0,85,255,0.08)", border: "0.5px solid rgba(0,85,255,0.16)", boxShadow: "0 0 0 8px rgba(0,85,255,0.04)" }}>
                <Clock className="w-[26px] h-[26px]" style={{ color: "rgba(0,85,255,0.5)" }} strokeWidth={2.2} />
              </div>
              <div className="text-[13px] font-medium" style={{ color: T4, letterSpacing: "-0.1px" }}>No results yet</div>
              <div className="text-[11px] font-normal text-center max-w-[200px] leading-[1.55]" style={{ color: T4 }}>
                Completed test results will be shown here after grading.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-[10px] relative z-10">
              {recentResults.slice(0, 5).map((r: any, i: number) => {
                const pct = pctOf(r);
                // Honest score chip: render the percentage when present, otherwise
                // a neutral "—" so an ungraded entry isn't styled as a failure.
                const grad = pct == null ? null : scoreGradient(pct);
                const subject = r.subject || r.testName || "";
                const openRow = () => navigate("/performance", { state: { subject } });
                // Mirror the writer's actual raw / max-field shape. Avoid the
                // silent default "100" — if no max-marks field exists, just
                // omit the fraction altogether.
                const rawNum = (typeof r.score === "number" ? r.score : Number(r.score));
                const markNum = (typeof r.mark === "number" ? r.mark : Number(r.mark));
                const maxScore = (typeof r.maxScore === "number" ? r.maxScore : Number(r.maxScore));
                const maxMarks = (typeof r.maxMarks === "number" ? r.maxMarks : Number(r.maxMarks));
                const ratioStr =
                  Number.isFinite(rawNum) && Number.isFinite(maxScore) && maxScore > 0
                    ? `${rawNum}/${maxScore}`
                    : Number.isFinite(markNum) && Number.isFinite(maxMarks) && maxMarks > 0
                    ? `${markNum}/${maxMarks}`
                    : null;
                return (
                  <div key={r.id || i}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open performance for ${subject || "result"}`}
                    onClick={(e) => { e.stopPropagation(); openRow(); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); openRow(); } }}
                    className="flex items-center gap-[13px] px-[15px] py-[13px] rounded-[18px] active:scale-[0.97] transition-transform cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
                    style={{ background: BG, border: "0.5px solid rgba(0,85,255,0.12)", transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)" }}>
                    <div className="w-11 h-11 rounded-[14px] flex items-center justify-center text-[13px] font-bold shrink-0"
                      style={
                        grad
                          ? { background: grad.bg, boxShadow: grad.shadow, color: "white" }
                          : { background: "rgba(0,85,255,0.08)", border: "0.5px solid rgba(0,85,255,0.16)", color: T3 }
                      }>
                      {pct == null ? "—" : `${Math.round(pct)}%`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold truncate" style={{ color: T1, letterSpacing: "-0.2px", marginBottom: 3 }}>
                        {r.testName || r.subject || "Test"}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {ratioStr && (
                          <>
                            <span className="text-[11px] font-medium" style={{ color: T3 }}>{ratioStr}</span>
                            <span className="text-[11px] font-medium" style={{ color: T4 }}>·</span>
                          </>
                        )}
                        <span className="text-[11px] font-medium" style={{ color: T3 }}>
                          {formatDate(r.timestamp || r.updatedAt || r.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── This Term Performance (Grade grid) ── */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Open performance page for term breakdown"
          onClick={() => navigate("/performance")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/performance"); } }}
          className="mx-5 mt-[14px] bg-white rounded-[24px] p-5 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
          style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
          <div className="absolute -top-10 -right-8 w-[120px] h-[120px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(0,85,255,0.05) 0%, transparent 70%)" }} />
          <div className="flex items-center justify-between mb-1">
            <div className="text-[17px] font-bold" style={{ color: T1, letterSpacing: "-0.3px" }}>This Term Performance</div>
            <div className="text-[11px] font-bold" style={{ color: B1 }}>{stats.totalTaken} taken</div>
          </div>
          <div className="grid grid-cols-2 gap-[10px] mt-3 relative z-10">
            {[
              { val: stats.aGrade, label: "A Grade", color: GREEN,  decorIcon: Trophy,        cardBg: "linear-gradient(135deg, rgba(0,200,83,0.13) 0%, rgba(0,200,83,0.04) 100%)",   cardBdr: "rgba(0,200,83,0.20)" },
              { val: stats.bGrade, label: "B Grade", color: B1,     decorIcon: Medal,         cardBg: "linear-gradient(135deg, rgba(0,85,255,0.10) 0%, rgba(0,85,255,0.03) 100%)",   cardBdr: "rgba(0,85,255,0.20)" },
              { val: stats.cGrade, label: "C Grade", color: ORANGE, decorIcon: Target,        cardBg: "linear-gradient(135deg, rgba(255,136,0,0.13) 0%, rgba(255,136,0,0.04) 100%)", cardBdr: "rgba(255,136,0,0.22)" },
              { val: stats.belowC, label: "Below C", color: RED,    decorIcon: TrendingDown,  cardBg: "linear-gradient(135deg, rgba(255,51,85,0.10) 0%, rgba(255,51,85,0.03) 100%)", cardBdr: "rgba(255,51,85,0.20)" },
            ].map(({ val, label, color, decorIcon: DecorIcon, cardBg, cardBdr }) => (
              <div key={label} className="rounded-[18px] px-4 py-[18px] relative overflow-hidden active:scale-[0.96] transition-transform"
                style={{ background: cardBg, border: `0.5px solid ${cardBdr}`, transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)" }}>
                <div className="absolute pointer-events-none" style={{ bottom: 8, right: 8 }}>
                  <DecorIcon style={{ width: 56, height: 56, color, opacity: 0.20, strokeWidth: 1.6 }} />
                </div>
                <div className="text-[36px] font-bold leading-none relative" style={{ color, letterSpacing: "-1.2px" }}>{val}</div>
                <div className="text-[11px] font-bold uppercase tracking-[0.06em] mt-[6px] relative" style={{ color }}>{label}</div>
              </div>
            ))}
          </div>
          {/* Awaiting-grading hint — only shows when at least one score doc
              exists but has no usable percentage. Surfaces the gap honestly
              instead of silently absorbing those into "Below C". */}
          {stats.ungraded > 0 && (
            <div className="mt-3 px-3 py-2 rounded-[12px] text-[11px] font-medium flex items-center gap-2"
              style={{ background: "rgba(140,146,164,0.10)", color: T3, border: "0.5px solid rgba(140,146,164,0.18)" }}>
              <Clock className="w-3 h-3" />
              {stats.ungraded} result{stats.ungraded === 1 ? "" : "s"} awaiting grading
            </div>
          )}
        </div>

        {/* ── Monthly Activity ── */}
        {!loading && stats.totalTaken > 0 && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Open performance page for monthly activity"
            onClick={() => navigate("/performance")}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/performance"); } }}
            className="mx-5 mt-3 bg-white rounded-[20px] px-[18px] py-4 cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
            style={{ boxShadow: SH, border: "0.5px solid rgba(0,85,255,0.10)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[14px] font-bold" style={{ color: T1, letterSpacing: "-0.2px" }}>Monthly Activity</div>
              <div className="text-[11px] font-bold" style={{ color: B1 }}>{academicYear} Term</div>
            </div>
            <div className="flex items-end gap-[7px] h-12 mb-[7px]">
              {monthlyActivity.map((m, i) => {
                const h = 6 + (m.count / maxMonthly) * 36;
                const opacity = m.isCurrent ? 1 : m.count === 0 ? 0.22 : 0.55;
                return (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className="w-full rounded-t-[5px] min-h-[4px]"
                      style={{
                        height: h,
                        background: `linear-gradient(180deg, ${B1}, ${B4})`,
                        opacity,
                        boxShadow: m.isCurrent ? "0 0 0 3px rgba(0,85,255,0.18)" : "none",
                      }}
                    />
                    <span className="text-[9px] font-bold uppercase tracking-[0.04em]" style={{ color: m.isCurrent ? B1 : T4 }}>
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="h-6" />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     DESKTOP — Bright Blue Apple UI (matches mobile)
     Brand tokens, MONTHS, helpers come from module scope. No per-branch
     shadow definitions any more.
     ═══════════════════════════════════════════════════════════════ */
  const { B1, B4, BG, T1, T3, T4, GREEN, RED, ORANGE, SH, SH_LG } = TOK;

  return (
    <div className="animate-in fade-in duration-500 -m-4 sm:-m-6 md:-m-8 min-h-[calc(100vh-64px)]"
      style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", background: BG }}>
      <div className="w-full px-6 pt-8 pb-12">

        {/* ── Toolbar ── */}
        <div className="flex items-start justify-between gap-6 flex-wrap mb-5">
          <div>
            <div className="text-[32px] font-bold" style={{ color: T1, letterSpacing: "-0.9px" }}>Tests &amp; Examinations</div>
            <div className="text-[14px] mt-2 font-normal" style={{ color: T3 }}>Track upcoming assessments and latest outcomes</div>
          </div>
          {stats.totalTaken > 0 && (
            <div className="px-4 py-[10px] rounded-full text-[13px] font-bold tracking-[0.02em] whitespace-nowrap"
              style={{ background: "rgba(0,85,255,0.10)", color: B1, border: "0.5px solid rgba(0,85,255,0.20)" }}>
              {stats.totalTaken} Completed
            </div>
          )}
        </div>

        {/* ── Listener error banner (retry) ── */}
        {listenerError && (
          <div role="alert" aria-live="polite" className="mb-5 rounded-[16px] px-5 py-3 flex items-center gap-3"
            style={{ background: "rgba(255,136,0,0.10)", border: "0.5px solid rgba(255,136,0,0.28)" }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: ORANGE }} />
            <p className="text-[13px] font-semibold flex-1" style={{ color: "#884400" }}>{listenerError}</p>
            <button
              onClick={() => { setListenerError(null); setRefreshKey(k => k + 1); }}
              className="px-3 py-1.5 rounded-[10px] text-[12px] font-bold flex items-center gap-1.5"
              style={{ background: "white", color: ORANGE, border: "0.5px solid rgba(255,136,0,0.28)" }}>
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {/* ── Hero Banner (dashboard 4-stat-card vibe) ── */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Open syllabus page to prepare for upcoming test"
          onClick={() => navigate("/syllabus")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/syllabus"); } }}
          className="rounded-[24px] px-6 py-6 relative overflow-hidden mb-5 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
          style={{
            background: "linear-gradient(135deg, rgba(0,85,255,0.10) 0%, rgba(0,85,255,0.03) 100%)",
            boxShadow: SH,
            border: "0.5px solid rgba(0,85,255,0.20)",
          }}>
          <div className="absolute pointer-events-none" style={{ bottom: 16, right: 20 }}>
            <GraduationCap style={{ width: 110, height: 110, color: B1, opacity: 0.18, strokeWidth: 1.6 }} />
          </div>

          <div className="flex items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="w-[44px] h-[44px] rounded-[14px] flex items-center justify-center shrink-0"
                style={{ background: "rgba(0,85,255,0.14)", border: "0.5px solid rgba(0,85,255,0.28)" }}>
                <Calendar className="w-[22px] h-[22px]" style={{ color: B1 }} strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: T4 }}>Coming Up Next</div>
                <div className="text-[28px] font-bold mt-1 leading-[1.1] truncate" style={{ color: T1, letterSpacing: "-0.8px" }}>
                  {nextTestTitle}
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {nextTest && (
                    <span className="text-[13px] font-semibold" style={{ color: T3, letterSpacing: "-0.1px" }}>
                      {formatDate(nextTest.testDate || nextTest.date)}
                    </span>
                  )}
                  {/* Only render time when the test doc provides one —
                      previously defaulted to "9:00 AM" which looked real. */}
                  {nextTest?.time && (
                    <>
                      <div className="w-1 h-1 rounded-full" style={{ background: T4 }} />
                      <span className="text-[13px] font-semibold" style={{ color: T3, letterSpacing: "-0.1px" }}>
                        {nextTest.time}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {nextTest && (() => {
              // "Today" / "Tomorrow" / "X" — for the big-number callout we
              // still want a numeral when N≥2, but text when N=0 or 1.
              const days = getDayDiff(nextTest.testDate || nextTest.date);
              const isText = days === 0 || days === 1;
              return (
                <div className="px-6 py-4 rounded-[18px] text-center shrink-0"
                  style={{ background: "rgba(0,85,255,0.08)", border: "0.5px solid rgba(0,85,255,0.20)", minWidth: 120 }}>
                  <div className={`font-bold leading-none ${isText ? "text-[26px]" : "text-[44px]"}`} style={{ color: B1, letterSpacing: "-1.4px" }}>
                    {isText ? (days === 0 ? "Today" : "Tomorrow") : days}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: T4 }}>
                    {isText ? "Test day" : "Days Left"}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── Row: Upcoming + Recent ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

          {/* Upcoming Tests */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Open syllabus page"
            onClick={() => navigate("/syllabus")}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/syllabus"); } }}
            className="bg-white rounded-[24px] p-6 relative overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
            style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
            <div className="absolute -top-10 -right-8 w-[140px] h-[140px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(0,85,255,0.05) 0%, transparent 70%)" }} />
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="text-[18px] font-bold" style={{ color: T1, letterSpacing: "-0.3px" }}>Upcoming Tests</div>
              <div className="text-[11px] font-bold px-3 py-[4px] rounded-full tracking-[0.02em]"
                style={{ color: B1, background: "rgba(0,85,255,0.10)", border: "0.5px solid rgba(0,85,255,0.18)" }}>
                {upcomingTests.length} test{upcomingTests.length === 1 ? "" : "s"}
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col gap-[10px] relative z-10" aria-busy="true" aria-live="polite">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-[13px] px-4 py-[13px] rounded-[18px] animate-pulse"
                    style={{ background: BG, border: "0.5px solid rgba(0,85,255,0.08)" }}>
                    <div className="w-12 h-12 rounded-[14px] shrink-0" style={{ background: "rgba(0,85,255,0.12)" }} />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 rounded-full" style={{ background: "rgba(0,85,255,0.10)", width: `${65 + i * 6}%` }} />
                      <div className="h-2 rounded-full" style={{ background: "rgba(0,85,255,0.07)", width: `${40 + i * 5}%` }} />
                    </div>
                    <div className="w-16 h-5 rounded-full shrink-0" style={{ background: "rgba(0,85,255,0.10)" }} />
                  </div>
                ))}
              </div>
            ) : upcomingTests.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 relative z-10">
                <div className="w-[60px] h-[60px] rounded-[20px] flex items-center justify-center"
                  style={{ background: "rgba(0,200,83,0.10)", border: "0.5px solid rgba(0,200,83,0.22)", boxShadow: "0 0 0 8px rgba(0,85,255,0.04)" }}>
                  <CheckCircle className="w-7 h-7" style={{ color: GREEN }} strokeWidth={2.2} />
                </div>
                <div className="text-[14px] font-medium" style={{ color: T4, letterSpacing: "-0.1px" }}>No upcoming tests</div>
                <div className="text-[12px] font-normal text-center max-w-[260px] leading-[1.55]" style={{ color: T4 }}>
                  You're all clear! New tests will appear here when scheduled by your teacher.
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-[10px] relative z-10">
                {upcomingTests.map((t: any, i: number) => {
                  const d = toSafeDate(t.testDate || t.date);
                  const days = getDayDiff(t.testDate || t.date);
                  const urgent = days <= 3;
                  const type = getTestTypeTag(t);
                  const tag = TAG_STYLE[type.cls];
                  const subject = t.subject || t.testName || "";
                  const openRow = () => navigate("/syllabus", { state: { subject } });
                  return (
                    <div key={t.id || i}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open syllabus for ${subject || "test"}`}
                      onClick={(e) => { e.stopPropagation(); openRow(); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); openRow(); } }}
                      className="flex items-center gap-[13px] px-4 py-[13px] rounded-[18px] transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
                      style={{ background: BG, border: "0.5px solid rgba(0,85,255,0.12)" }}>
                      <div className="w-12 h-12 rounded-[14px] flex flex-col items-center justify-center gap-[1px] shrink-0"
                        style={dateChipStyle(urgent)}>
                        <div className="text-[18px] font-bold text-white leading-none">{d ? d.getDate() : "—"}</div>
                        <div className="text-[9px] font-bold uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.72)" }}>
                          {d ? MONTHS[d.getMonth()] : ""}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-bold truncate mb-[3px]" style={{ color: T1, letterSpacing: "-0.2px" }}>
                          {t.testName || t.subject || "Test"}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {t.teacherName && (
                            <div className="flex items-center gap-1 text-[11px] font-medium" style={{ color: T3 }}>
                              <User className="w-[11px] h-[11px]" strokeWidth={2.5} />
                              <span className="truncate max-w-[120px]">{t.teacherName}</span>
                            </div>
                          )}
                          {(t.time || d) && (
                            <div className="flex items-center gap-1 text-[11px] font-medium" style={{ color: T3 }}>
                              <Clock className="w-[11px] h-[11px]" strokeWidth={2.5} />
                              {t.time || dayCountLabel(days)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="px-3 py-[5px] rounded-full text-[10px] font-bold shrink-0"
                        style={{ background: tag.bg, color: tag.color, border: `0.5px solid ${tag.border}` }}>
                        {type.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Results */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Open performance page for detailed results"
            onClick={() => navigate("/performance")}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/performance"); } }}
            className="bg-white rounded-[24px] p-6 relative overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
            style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
            <div className="absolute -top-10 -right-8 w-[140px] h-[140px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(0,85,255,0.05) 0%, transparent 70%)" }} />
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="text-[18px] font-bold" style={{ color: T1, letterSpacing: "-0.3px" }}>Recent Results</div>
              <div className="text-[11px] font-bold px-3 py-[4px] rounded-full tracking-[0.02em]"
                style={{ color: B1, background: "rgba(0,85,255,0.10)", border: "0.5px solid rgba(0,85,255,0.18)" }}>
                {recentResults.length} result{recentResults.length === 1 ? "" : "s"}
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col gap-[10px] relative z-10" aria-busy="true" aria-live="polite">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-[13px] px-4 py-[13px] rounded-[18px] animate-pulse"
                    style={{ background: BG, border: "0.5px solid rgba(0,85,255,0.08)" }}>
                    <div className="w-12 h-12 rounded-[14px] shrink-0" style={{ background: "rgba(0,85,255,0.12)" }} />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 rounded-full" style={{ background: "rgba(0,85,255,0.10)", width: `${60 + i * 8}%` }} />
                      <div className="h-2 rounded-full" style={{ background: "rgba(0,85,255,0.07)", width: `${35 + i * 7}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentResults.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 relative z-10">
                <div className="w-[60px] h-[60px] rounded-[20px] flex items-center justify-center"
                  style={{ background: "rgba(0,85,255,0.08)", border: "0.5px solid rgba(0,85,255,0.16)", boxShadow: "0 0 0 8px rgba(0,85,255,0.04)" }}>
                  <Clock className="w-7 h-7" style={{ color: "rgba(0,85,255,0.5)" }} strokeWidth={2.2} />
                </div>
                <div className="text-[14px] font-medium" style={{ color: T4, letterSpacing: "-0.1px" }}>No results yet</div>
                <div className="text-[12px] font-normal text-center max-w-[260px] leading-[1.55]" style={{ color: T4 }}>
                  Completed test results will be shown here after grading.
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-[10px] relative z-10">
                {recentResults.slice(0, 5).map((r: any, i: number) => {
                  const pct = pctOf(r);
                  const grad = pct == null ? null : scoreGradient(pct);
                  const subject = r.subject || r.testName || "";
                  const openRow = () => navigate("/performance", { state: { subject } });
                  // Honest fraction — only render when a real max-marks field
                  // exists; no silent "/100" default.
                  const rawNum = (typeof r.score === "number" ? r.score : Number(r.score));
                  const markNum = (typeof r.mark === "number" ? r.mark : Number(r.mark));
                  const maxScore = (typeof r.maxScore === "number" ? r.maxScore : Number(r.maxScore));
                  const maxMarks = (typeof r.maxMarks === "number" ? r.maxMarks : Number(r.maxMarks));
                  const ratioStr =
                    Number.isFinite(rawNum) && Number.isFinite(maxScore) && maxScore > 0
                      ? `${rawNum}/${maxScore}`
                      : Number.isFinite(markNum) && Number.isFinite(maxMarks) && maxMarks > 0
                      ? `${markNum}/${maxMarks}`
                      : null;
                  return (
                    <div key={r.id || i}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open performance for ${subject || "result"}`}
                      onClick={(e) => { e.stopPropagation(); openRow(); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); openRow(); } }}
                      className="flex items-center gap-[13px] px-4 py-[13px] rounded-[18px] transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
                      style={{ background: BG, border: "0.5px solid rgba(0,85,255,0.12)" }}>
                      <div className="w-12 h-12 rounded-[14px] flex items-center justify-center text-[14px] font-bold shrink-0"
                        style={
                          grad
                            ? { background: grad.bg, boxShadow: grad.shadow, color: "white" }
                            : { background: "rgba(0,85,255,0.08)", border: "0.5px solid rgba(0,85,255,0.16)", color: T3 }
                        }>
                        {pct == null ? "—" : `${Math.round(pct)}%`}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-bold truncate mb-[3px]" style={{ color: T1, letterSpacing: "-0.2px" }}>
                          {r.testName || r.subject || "Test"}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {ratioStr && (
                            <>
                              <span className="text-[11px] font-medium" style={{ color: T3 }}>{ratioStr}</span>
                              <span className="text-[11px] font-medium" style={{ color: T4 }}>·</span>
                            </>
                          )}
                          <span className="text-[11px] font-medium" style={{ color: T3 }}>
                            {formatDate(r.timestamp || r.updatedAt || r.date)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Term Performance + Monthly Activity row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* This Term Performance (lg:col-span-2) */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Open performance page for term breakdown"
            onClick={() => navigate("/performance")}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/performance"); } }}
            className="lg:col-span-2 bg-white rounded-[24px] p-6 relative overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
            style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
            <div className="absolute -top-10 -right-8 w-[140px] h-[140px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(0,85,255,0.05) 0%, transparent 70%)" }} />
            <div className="flex items-center justify-between mb-2 relative z-10">
              <div className="text-[18px] font-bold" style={{ color: T1, letterSpacing: "-0.3px" }}>This Term Performance</div>
              <div className="text-[12px] font-bold" style={{ color: B1 }}>{stats.totalTaken} taken</div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 relative z-10">
              {[
                { val: stats.aGrade, label: "A Grade", color: GREEN,  decorIcon: Trophy,        cardBg: "linear-gradient(135deg, rgba(0,200,83,0.13) 0%, rgba(0,200,83,0.04) 100%)",   cardBdr: "rgba(0,200,83,0.20)" },
                { val: stats.bGrade, label: "B Grade", color: B1,     decorIcon: Medal,         cardBg: "linear-gradient(135deg, rgba(0,85,255,0.10) 0%, rgba(0,85,255,0.03) 100%)",   cardBdr: "rgba(0,85,255,0.20)" },
                { val: stats.cGrade, label: "C Grade", color: ORANGE, decorIcon: Target,        cardBg: "linear-gradient(135deg, rgba(255,136,0,0.13) 0%, rgba(255,136,0,0.04) 100%)", cardBdr: "rgba(255,136,0,0.22)" },
                { val: stats.belowC, label: "Below C", color: RED,    decorIcon: TrendingDown,  cardBg: "linear-gradient(135deg, rgba(255,51,85,0.10) 0%, rgba(255,51,85,0.03) 100%)", cardBdr: "rgba(255,51,85,0.20)" },
              ].map(({ val, label, color, decorIcon: DecorIcon, cardBg, cardBdr }) => (
                <div key={label} className="rounded-[20px] px-5 py-6 relative overflow-hidden transition-transform hover:-translate-y-0.5"
                  style={{ background: cardBg, border: `0.5px solid ${cardBdr}` }}>
                  <div className="absolute pointer-events-none" style={{ bottom: 12, right: 12 }}>
                    <DecorIcon style={{ width: 72, height: 72, color, opacity: 0.20, strokeWidth: 1.6 }} />
                  </div>
                  <div className="text-[42px] font-bold leading-none relative" style={{ color, letterSpacing: "-1.4px" }}>{val}</div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.08em] mt-2 relative" style={{ color }}>{label}</div>
                </div>
              ))}
            </div>
            {/* Awaiting-grading hint — see mobile branch for rationale. */}
            {stats.ungraded > 0 && (
              <div className="mt-4 px-3 py-2 rounded-[12px] text-[12px] font-medium flex items-center gap-2"
                style={{ background: "rgba(140,146,164,0.10)", color: T3, border: "0.5px solid rgba(140,146,164,0.18)" }}>
                <Clock className="w-3.5 h-3.5" />
                {stats.ungraded} result{stats.ungraded === 1 ? "" : "s"} awaiting grading
              </div>
            )}
          </div>

          {/* Monthly Activity */}
          {stats.totalTaken > 0 ? (
            <div
              role="button"
              tabIndex={0}
              aria-label="Open performance page for monthly activity"
              onClick={() => navigate("/performance")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/performance"); } }}
              className="bg-white rounded-[22px] px-5 py-5 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
              style={{ boxShadow: SH, border: "0.5px solid rgba(0,85,255,0.10)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="text-[15px] font-bold" style={{ color: T1, letterSpacing: "-0.2px" }}>Monthly Activity</div>
                <div className="text-[11px] font-bold" style={{ color: B1 }}>{academicYear}</div>
              </div>
              <div className="flex items-end gap-[8px] h-[100px] mb-2">
                {monthlyActivity.map((m, i) => {
                  const h = 8 + (m.count / maxMonthly) * 86;
                  const opacity = m.isCurrent ? 1 : m.count === 0 ? 0.22 : 0.55;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <div
                        className="w-full rounded-t-[6px] min-h-[5px]"
                        style={{
                          height: h,
                          background: `linear-gradient(180deg, ${B1}, ${B4})`,
                          opacity,
                          boxShadow: m.isCurrent ? "0 0 0 3px rgba(0,85,255,0.18)" : "none",
                        }}
                      />
                      <span className="text-[10px] font-bold uppercase tracking-[0.04em]" style={{ color: m.isCurrent ? B1 : T4 }}>
                        {m.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between pt-3 mt-2" style={{ borderTop: "0.5px solid rgba(0,85,255,0.08)" }}>
                <span className="text-[11px] font-medium" style={{ color: T4 }}>Tests this month</span>
                <span className="text-[13px] font-bold" style={{ color: B1 }}>{monthlyActivity[monthlyActivity.length - 1].count}</span>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[22px] px-5 py-12 flex flex-col items-center gap-3 text-center"
              style={{ boxShadow: SH, border: "0.5px solid rgba(0,85,255,0.10)" }}>
              <div className="w-[60px] h-[60px] rounded-[18px] flex items-center justify-center"
                style={{ background: "rgba(0,85,255,0.08)", border: "0.5px solid rgba(0,85,255,0.16)" }}>
                <GraduationCap className="w-8 h-8" style={{ color: "rgba(0,85,255,0.5)" }} strokeWidth={2.2} />
              </div>
              <div className="text-[14px] font-bold" style={{ color: T1 }}>No activity yet</div>
              <div className="text-[11px]" style={{ color: T4 }}>Monthly test activity will appear here</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestsPage;
