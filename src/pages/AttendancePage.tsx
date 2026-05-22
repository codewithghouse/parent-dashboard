import { useState, useEffect, useMemo } from "react";
import type { ComponentType, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import {
  CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, Loader2,
  Calendar as CalendarIcon, Users, TrendingUp, UserCheck, CalendarX,
  Hourglass, Sparkles, Flame, AlertTriangle, AlertCircle,
  Trophy, Activity, X as XIcon, BookOpen, User,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList,
} from "recharts";
import { useAuth } from "@/lib/AuthContext";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";
import { where } from "firebase/firestore";
import { subscribePerStudent } from "@/lib/perStudentQuery";
import { subscribeEnrollments } from "@/lib/enrollmentQuery";
import { dedupAndSortAttendance } from "@/lib/attendanceDedup";
import { subscribeSchoolHolidays, buildHolidayMap, type SchoolHoliday } from "@/lib/schoolHolidays";
import { useIsMobile } from "@/hooks/use-mobile";
import { computeAttendanceCorrelation } from "@/ai/system/attendance-correlation";

/* ════════════════════════════════════════════════════════════════════════
   TYPES — strict shapes so the page never reads a missing field as `any`.
   ════════════════════════════════════════════════════════════════════════ */

interface RawAttendance {
  id: string;
  studentId?: string;
  studentEmail?: string;
  // MarkAttendance.tsx writes `date` as IST `YYYY-MM-DD` (memory
  // `bug_pattern_ist_vs_utc_date_filter`). Compare with IST-aware key only.
  date?: string;
  status?: string;        // "present" / "late" / "absent"
  note?: string;
  classId?: string;
  markedBy?: string;
  teacherName?: string;
}

interface RawEnrollment {
  id: string;
  classId?: string;
  className?: string;
  classGroup?: string;
  classSection?: string;
  class?: string;
  section?: string;
  subject?: string;
  subjectName?: string;
  teacherName?: string;
}

interface MonthlyPoint {
  monthKey: string;       // "YYYY-MM"
  monthLabel: string;     // "Oct"
  percentage: number | null;
  total: number;
  present: number;
}

interface WeekdayBar {
  label: string;          // "Mon" / "Tue" / ...
  weekday: string;        // "Monday" / ...
  absences: number;
  isPeak: boolean;
}

interface SelectedDay {
  dateKey: string;        // IST YYYY-MM-DD
  status: string;
  note: string | null;
  className: string | null;
  markedBy: string | null;
}

type DayStatus = "present" | "absent" | "late" | "holiday" | "weekend" | "unmarked" | "empty";

interface AttendanceStats {
  present: number;
  absent: number;
  late: number;
  percentage: number | null;   // null until first data loads
}

interface MonthStats {
  present: number;
  absent: number;
  late: number;
}

interface WeekBar {
  label: string;
  status: "present" | "absent" | "late" | "future" | "none";
  isToday: boolean;
  isFuture: boolean;
}

/* ════════════════════════════════════════════════════════════════════════
   HELPERS — IST date handling, parsing, formatting.
   ════════════════════════════════════════════════════════════════════════ */

/**
 * IST-aware date key. Matches MarkAttendance writer's
 * `toLocaleDateString("en-CA")` from the teacher's IST device — but does
 * NOT rely on the PARENT's device being in IST.
 *
 * Memory `bug_pattern_ist_vs_utc_date_filter`: passing a Date through
 * `toLocaleDateString("en-CA")` WITHOUT `{ timeZone: "Asia/Kolkata" }`
 * returns the parent's LOCAL date — silently mismatches IST attendance
 * records for any non-IST device (NRI parents, travelers).
 */
const istKey = (d: Date): string =>
  d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Parse "YYYY-MM-DD" string into a local Date at midnight — safe for the
 *  calendar display layer (doesn't matter what TZ the resulting Date is
 *  in; we only use its display methods). */
const parseISODateLocal = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const parts = s.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map((p) => parseInt(p, 10));
  if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return null;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
};

const formatDateLong = (s: string | null | undefined): string => {
  const d = parseISODateLocal(s);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
};

const daysInMonth = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

const firstDayOfMonth = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), 1).getDay();

/** Compute the academic-year-start ISO date based on school settings.
 *  Falls back to the page's previous hardcoded June 1 logic when settings
 *  haven't been hydrated yet. */
const academicYearStart = (startMonth: number = 6): string => {
  const now = new Date();
  // Month is 0-indexed in JS, settings store 1-12. Compare correctly.
  const startMonthIdx = Math.max(0, Math.min(11, startMonth - 1));
  const startYear = now.getMonth() >= startMonthIdx ? now.getFullYear() : now.getFullYear() - 1;
  const mm = String(startMonthIdx + 1).padStart(2, "0");
  return `${startYear}-${mm}-01`;
};

/* ════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — single source for both mobile + desktop.
   ════════════════════════════════════════════════════════════════════════ */

const T = {
  B1: "#0055FF", B2: "#1166FF", B3: "#2277FF", B4: "#4499FF",
  BG: "#EEF4FF", BG2: "#E0ECFF",
  T1: "#001040", T2: "#002080", T3: "#5070B0", T4: "#99AACC",
  SEP: "rgba(0,85,255,0.07)",
  GREEN: "#00C853", GREEN_D: "#007830",
  GREEN_S: "rgba(0,200,83,0.10)", GREEN_B: "rgba(0,200,83,0.22)",
  RED: "#FF3355",
  ORANGE: "#FF8800",
  SH:     "0 0 0 0.5px rgba(0,85,255,0.08), 0 2px 8px rgba(0,85,255,0.09), 0 10px 28px rgba(0,85,255,0.11)",
  SH_LG:  "0 0 0 0.5px rgba(0,85,255,0.10), 0 4px 16px rgba(0,85,255,0.12), 0 20px 48px rgba(0,85,255,0.13)",
  SH_BTN: "0 6px 22px rgba(0,85,255,0.42), 0 2px 6px rgba(0,85,255,0.22)",
};

/* ════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS — shared between mobile + desktop branches.
   ════════════════════════════════════════════════════════════════════════ */

const ListenerErrorBanner = ({
  message, onRetry, marginClass,
}: { message: string; onRetry: () => void; marginClass: string }) => (
  <div
    className={`${marginClass} px-4 py-3 rounded-[14px] flex items-center gap-3`}
    style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}
  >
    <AlertCircle className="w-4 h-4 shrink-0" />
    <div className="flex-1 text-[12px] md:text-[13px]">{message}</div>
    <button onClick={onRetry} className="text-[11px] md:text-[12px] font-bold underline">
      Retry
    </button>
  </div>
);

/* ── Stat card (4-card grid, both branches) ─────────────────────────── */

interface StatCardCfg {
  icon: ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }>;
  decorIcon: ComponentType<{ style?: React.CSSProperties }>;
  iconColor: string;
  cardBg: string;
  cardBdr: string;
  iconBoxBg: string;
  iconBoxBdr: string;
  label: string;
  value: string;
  valColor: string;
  route: string;
}

const StatCard = ({ cfg, isMobile, navigate }: {
  cfg: StatCardCfg;
  isMobile: boolean;
  navigate: NavigateFunction;
}) => {
  const { icon: Icon, decorIcon: DecorIcon } = cfg;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${cfg.route === "/alerts" ? "alerts" : "reports"} page for ${cfg.label}`}
      onClick={() => navigate(cfg.route)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(cfg.route); } }}
      className={
        isMobile
          ? "rounded-[22px] px-4 py-[18px] relative overflow-hidden cursor-pointer active:scale-[0.96] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
          : "rounded-[22px] px-5 py-5 relative overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
      }
      style={{
        background: cfg.cardBg,
        boxShadow: T.SH,
        border: `0.5px solid ${cfg.cardBdr}`,
        transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
      }}
    >
      <div className="absolute pointer-events-none" style={{ bottom: isMobile ? 10 : 14, right: isMobile ? 10 : 14 }}>
        <DecorIcon
          style={{
            width: isMobile ? 60 : 80,
            height: isMobile ? 60 : 80,
            color: cfg.iconColor,
            opacity: 0.20,
            strokeWidth: 1.6,
          }}
        />
      </div>
      <div
        className={isMobile ? "w-[34px] h-[34px] rounded-[11px] flex items-center justify-center mb-3 relative" : "w-[38px] h-[38px] rounded-[12px] flex items-center justify-center mb-4 relative"}
        style={{ background: cfg.iconBoxBg, border: `0.5px solid ${cfg.iconBoxBdr}` }}
      >
        <Icon
          className={isMobile ? "w-[17px] h-[17px]" : "w-[18px] h-[18px]"}
          style={{ color: cfg.iconColor }}
          strokeWidth={2.2}
        />
      </div>
      <div
        className={isMobile ? "text-[26px] font-bold leading-none mb-[5px] relative" : "text-[34px] font-bold leading-none mb-[5px] relative"}
        style={{ color: cfg.valColor, letterSpacing: isMobile ? "-0.6px" : "-1px" }}
      >
        {cfg.value}
      </div>
      <div
        className={isMobile ? "text-[9px] font-bold uppercase tracking-[0.09em] relative" : "text-[10px] font-bold uppercase tracking-[0.10em] relative"}
        style={{ color: T.T4 }}
      >
        {cfg.label}
      </div>
    </div>
  );
};

/* ── Month ring summary (left list + right ring) ─────────────────────── */

interface MonthRingProps {
  monthName: string;
  monthStats: MonthStats;
  percentage: number | null;
  aboveThreshold: boolean;
  isMobile: boolean;
  navigate: NavigateFunction;
}

const MonthSummaryRing = ({ monthName, monthStats, percentage, aboveThreshold, isMobile, navigate }: MonthRingProps) => {
  const ringR = isMobile ? 36 : 52;
  const ringCirc = 2 * Math.PI * ringR;
  const pct = percentage ?? 0;
  const ringOffset = ringCirc - (Math.min(pct, 100) / 100) * ringCirc;
  const ringColor = aboveThreshold ? T.GREEN : T.RED;
  const gradId = isMobile ? "attRingM" : "attRingD";
  const dim = isMobile ? 90 : 120;
  const strokeWidth = isMobile ? 8 : 10;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Open reports page for monthly attendance"
      onClick={() => navigate("/reports")}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/reports"); } }}
      className={
        isMobile
          ? "mx-5 mt-3 bg-white rounded-[24px] p-5 flex items-center gap-5 cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
          : "bg-white rounded-[24px] p-5 flex items-center gap-5 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
      }
      style={{ boxShadow: T.SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}
    >
      <div className="flex-1">
        <div className={isMobile ? "text-[16px] font-bold mb-1" : "text-[17px] font-bold mb-1"} style={{ color: T.T1, letterSpacing: "-0.3px" }}>
          This Month
        </div>
        <div className={isMobile ? "text-[12px] mb-[14px] font-normal" : "text-[12px] mb-4 font-normal"} style={{ color: T.T3 }}>
          {monthName} summary
        </div>
        {[
          { label: "Present", color: T.GREEN, count: monthStats.present },
          { label: "Absent",  color: T.RED,   count: monthStats.absent  },
          { label: "Late",    color: T.ORANGE, count: monthStats.late   },
        ].map((r, i, arr) => (
          <div key={r.label} className={`flex items-center gap-[7px] ${i < arr.length - 1 ? "mb-[6px]" : ""}`}>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
            <span className="text-[12px] font-bold" style={{ color: T.T2 }}>{r.label}</span>
            <span className="text-[12px] font-bold ml-auto" style={{ color: r.color }}>
              {r.count} {r.count === 1 ? "day" : "days"}
            </span>
          </div>
        ))}
      </div>
      <div className="relative shrink-0" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} style={{ transform: "rotate(-90deg)" }}>
          <defs>
            <linearGradient id={`${gradId}-green`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={T.GREEN} />
              <stop offset="100%" stopColor="#66EE88" />
            </linearGradient>
            <linearGradient id={`${gradId}-red`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={T.RED} />
              <stop offset="100%" stopColor="#FF8899" />
            </linearGradient>
          </defs>
          <circle cx={dim / 2} cy={dim / 2} r={ringR} fill="none" stroke="rgba(0,85,255,0.08)" strokeWidth={strokeWidth} />
          <circle
            cx={dim / 2} cy={dim / 2} r={ringR} fill="none"
            stroke={aboveThreshold ? `url(#${gradId}-green)` : `url(#${gradId}-red)`}
            strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={ringCirc}
            strokeDashoffset={ringOffset}
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className={isMobile ? "text-[20px] font-bold leading-none" : "text-[26px] font-bold leading-none"}
            style={{ color: ringColor, letterSpacing: isMobile ? "-0.5px" : "-0.7px" }}
          >
            {percentage == null ? "—" : `${pct}%`}
          </div>
          <div className={isMobile ? "text-[9px] font-bold uppercase tracking-[0.08em] mt-1" : "text-[10px] font-bold uppercase tracking-[0.08em] mt-1"} style={{ color: T.T4 }}>
            Rate
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Calendar grid (shared, mobile + desktop variants) ───────────────── */

interface CalendarCardProps {
  selectedDate: Date;
  monthName: string;
  onPrev: () => void;
  onNext: () => void;
  attendanceMap: Map<string, string>; // istKey → status
  loading: boolean;
  isMobile: boolean;
  navigate: NavigateFunction;
  isInGrid?: boolean;   // skip outer mx-5 mt-3 when used inside a grid
  onCellClick?: (dateKey: string, status: string) => void;
}

const CalendarCard = ({
  selectedDate, monthName, onPrev, onNext, attendanceMap, loading, isMobile, navigate, isInGrid, onCellClick,
}: CalendarCardProps) => {
  // Memoise day → status to avoid recomputing on every cell render.
  const todayMidnightMs = useMemo(() => new Date().setHours(0, 0, 0, 0), []);
  const dayCount = daysInMonth(selectedDate);
  const firstDay = firstDayOfMonth(selectedDate);

  const getDayStatus = (day: number): DayStatus => {
    const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
    const key = istKey(d);
    const status = attendanceMap.get(key);
    // Holiday is the only status that wins over weekend — teacher may
    // declare a Saturday-class day a holiday and that mark should display.
    if (status === "holiday") return "holiday";
    if (d.getDay() === 0 || d.getDay() === 6) return "weekend";
    if (status === "absent") return "absent";
    if (status === "late") return "late";
    if (status === "present") return "present";
    return d.getTime() < todayMidnightMs ? "unmarked" : "empty";
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Open reports page for attendance detail"
      onClick={() => navigate("/reports")}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/reports"); } }}
      className={
        isMobile
          ? "mx-5 mt-3 bg-white rounded-[24px] p-5 cursor-pointer transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
          : `${isInGrid ? "" : ""}bg-white rounded-[24px] p-6 cursor-pointer transition-all hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40`
      }
      style={{ boxShadow: T.SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}
    >
      {/* Header: prev / month label / next */}
      <div className={isMobile ? "flex items-center justify-between mb-4" : "flex items-center justify-between gap-4 mb-5 flex-wrap"}>
        <div className={isMobile ? "" : "flex items-center gap-2"}>
          <button
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            aria-label="Previous month"
            className={
              isMobile
                ? "w-[34px] h-[34px] rounded-[11px] flex items-center justify-center active:scale-[0.88] transition-transform"
                : "w-10 h-10 rounded-[12px] flex items-center justify-center transition-transform hover:scale-[1.05]"
            }
            style={{
              background: T.BG,
              border: "0.5px solid rgba(0,85,255,0.12)",
              transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <ChevronLeft
              className={isMobile ? "w-[14px] h-[14px]" : "w-[16px] h-[16px]"}
              style={{ color: "rgba(0,85,255,0.7)" }}
              strokeWidth={2.5}
            />
          </button>
        </div>
        <div className={isMobile ? "flex items-center gap-[7px]" : "flex items-center gap-[8px] px-4 py-[9px] rounded-[12px]"}
          style={!isMobile ? { background: T.BG, border: "0.5px solid rgba(0,85,255,0.12)" } : undefined}
        >
          <div
            className={isMobile ? "w-7 h-7 rounded-[9px] flex items-center justify-center" : "w-7 h-7 rounded-[9px] flex items-center justify-center"}
            style={{
              background: `linear-gradient(135deg, ${T.B1}, ${T.B2})`,
              boxShadow: "0 2px 8px rgba(0,85,255,0.28)",
            }}
          >
            <CalendarIcon className="w-[14px] h-[14px] text-white" strokeWidth={2.2} />
          </div>
          <span
            className={isMobile ? "text-[16px] font-bold" : "text-[15px] font-bold min-w-[160px] text-center"}
            style={{ color: T.T1, letterSpacing: "-0.3px" }}
          >
            {monthName}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          aria-label="Next month"
          className={
            isMobile
              ? "w-[34px] h-[34px] rounded-[11px] flex items-center justify-center active:scale-[0.88] transition-transform"
              : "w-10 h-10 rounded-[12px] flex items-center justify-center transition-transform hover:scale-[1.05]"
          }
          style={{
            background: T.BG,
            border: "0.5px solid rgba(0,85,255,0.12)",
            transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          <ChevronRight
            className={isMobile ? "w-[14px] h-[14px]" : "w-[16px] h-[16px]"}
            style={{ color: "rgba(0,85,255,0.7)" }}
            strokeWidth={2.5}
          />
        </button>
        {!isMobile && (
          <div className="flex items-center gap-4 flex-wrap">
            {[
              { c: T.GREEN, l: "Present" },
              { c: T.RED, l: "Absent" },
              { c: T.ORANGE, l: "Late" },
              { c: "rgba(15,23,42,0.18)", l: "Not marked" },
            ].map((x) => (
              <div key={x.l} className="flex items-center gap-[5px] text-[11px] font-bold tracking-[0.04em]" style={{ color: T.T3 }}>
                <div className="w-2 h-2 rounded-full" style={{ background: x.c }} />
                {x.l}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile-only legend (desktop puts it in the toolbar above) */}
      {isMobile && (
        <div className="flex items-center gap-[14px] mb-[14px] flex-wrap">
          {[
            { c: T.GREEN, l: "Present" },
            { c: T.RED, l: "Absent" },
            { c: T.ORANGE, l: "Late" },
            { c: "rgba(15,23,42,0.18)", l: "Not marked" },
          ].map((x) => (
            <div key={x.l} className="flex items-center gap-[5px] text-[10px] font-bold tracking-[0.04em]" style={{ color: T.T3 }}>
              <div className="w-2 h-2 rounded-full" style={{ background: x.c }} />
              {x.l}
            </div>
          ))}
        </div>
      )}

      {/* Day names */}
      <div className={isMobile ? "grid grid-cols-7 mb-[6px]" : "grid grid-cols-7 mb-2"}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className={isMobile ? "text-center py-1 text-[10px] font-bold uppercase tracking-[0.05em]" : "text-center py-1 text-[11px] font-bold uppercase tracking-[0.06em]"}
            style={{ color: T.T4 }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      {loading ? (
        <div className={isMobile ? "flex flex-col items-center gap-3 py-10" : "flex flex-col items-center gap-3 py-16"}>
          <Loader2 className={isMobile ? "w-8 h-8 animate-spin" : "w-10 h-10 animate-spin"} style={{ color: T.B1 }} />
          <p className={isMobile ? "text-xs font-medium" : "text-[13px] font-medium"} style={{ color: T.T4 }}>
            Syncing logs…
          </p>
        </div>
      ) : (
        <div className={isMobile ? "grid grid-cols-7 gap-[4px]" : "grid grid-cols-7 gap-[6px]"}>
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e-${i}`} className="aspect-square" />
          ))}
          {Array.from({ length: dayCount }).map((_, i) => {
            const day = i + 1;
            const status = getDayStatus(day);
            const todayDate = new Date();
            const isToday =
              selectedDate.getFullYear() === todayDate.getFullYear() &&
              selectedDate.getMonth() === todayDate.getMonth() &&
              day === todayDate.getDate();
            const cellStyle: React.CSSProperties = (() => {
              // "Today" gradient hides status colour. We carve out holiday
              // because a holiday declaration is more important than the
              // today-indicator (parent already knows it's today from the
              // calendar header).
              if (isToday && status !== "holiday") {
                return {
                  background: `linear-gradient(135deg, ${T.B1}, ${T.B2})`,
                  color: "#fff", fontWeight: 700,
                  boxShadow: "0 4px 14px rgba(0,85,255,0.36), 0 1px 4px rgba(0,85,255,0.22)",
                };
              }
              switch (status) {
                case "present":  return { background: "rgba(0,200,83,0.10)", color: T.GREEN_D, border: "0.5px solid rgba(0,200,83,0.18)", fontWeight: 600 };
                case "absent":   return { background: "rgba(255,51,85,0.10)", color: T.RED, border: "0.5px solid rgba(255,51,85,0.18)", fontWeight: 600 };
                case "late":     return { background: "rgba(255,136,0,0.10)", color: T.ORANGE, border: "0.5px solid rgba(255,136,0,0.18)", fontWeight: 600 };
                case "holiday":  return { background: "rgba(123,63,244,0.10)", color: "#5B22C2", border: "0.5px solid rgba(123,63,244,0.22)", fontWeight: 600 };
                case "weekend":  return { color: T.T4, fontWeight: 500 };
                // NOT-MARKED: visible grey box so parent can clearly tell
                // "teacher didn't take attendance this day" apart from
                // "student was absent" (red). Distinct from weekends + future
                // (which stay transparent). Memory note: unfair to label a
                // student red when no roll-call ever happened.
                case "unmarked": return {
                  background: "rgba(15,23,42,0.055)",
                  border: "0.5px solid rgba(15,23,42,0.10)",
                  color: T.T4,
                  fontWeight: 500,
                };
                default:         return { color: T.T2, fontWeight: 500 };
              }
            })();
            const dateKey = istKey(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day));
            const clickable = !!onCellClick && (
              status === "present" || status === "absent" || status === "late" || status === "holiday" || status === "unmarked"
            );
            return (
              <div
                key={day}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                aria-label={clickable ? `Open detail for ${dateKey}` : undefined}
                onClick={clickable
                  ? (e) => { e.stopPropagation(); onCellClick?.(dateKey, status); }
                  : undefined}
                onKeyDown={clickable
                  ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onCellClick?.(dateKey, status); } }
                  : undefined}
                className={[
                  isMobile ? "aspect-square rounded-[12px] flex items-center justify-center text-[13px]" : "aspect-square rounded-[14px] flex items-center justify-center text-[15px]",
                  clickable ? "cursor-pointer hover:scale-[1.06] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40" : "",
                ].join(" ")}
                style={cellStyle}
              >
                {day}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── Day Detail Modal ────────────────────────────────────────────────── */

const DayDetailModal = ({
  day, onClose,
}: { day: SelectedDay; onClose: () => void }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const statusTone =
    day.status === "present" ? {
      color: T.GREEN_D, bg: T.GREEN_S, bdr: T.GREEN_B,
      label: "Present", message: "Teacher marked you as Present",
      Icon: CheckCircle,
    } :
    day.status === "late" ? {
      color: "#AA5500", bg: "rgba(255,136,0,0.10)", bdr: "rgba(255,136,0,0.25)",
      label: "Late", message: "Teacher marked you as Late",
      Icon: Clock,
    } :
    day.status === "holiday" ? {
      color: "#5B22C2", bg: "rgba(123,63,244,0.10)", bdr: "rgba(123,63,244,0.22)",
      label: "Holiday", message: "Declared as Holiday — excluded from attendance %",
      Icon: Trophy,
    } :
    day.status === "unmarked" ? {
      color: "#64748b", bg: "rgba(100,116,139,0.10)", bdr: "rgba(100,116,139,0.22)",
      label: "Not Marked", message: "Teacher has not marked attendance",
      Icon: AlertCircle,
    } :
    {
      color: "#AA2233", bg: "rgba(255,51,85,0.08)", bdr: "rgba(255,51,85,0.22)",
      label: "Absent", message: "Teacher marked you as Absent",
      Icon: XCircle,
    };
  const StatusIcon = statusTone.Icon;

  // Parse YYYY-MM-DD into a friendly long-form label.
  const dateLong = formatDateLong(day.dateKey);

  // Portal to document.body — escapes any parent with CSS `transform`/`filter`/
  // `perspective`, which would otherwise turn this `position: fixed` overlay
  // into a container-relative one (and float it to the bottom of a card).
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Attendance detail for ${dateLong}`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.4)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
        fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 22,
          width: 360,
          maxWidth: "100%",
          padding: 0,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `0.5px solid ${T.SEP}` }}
        >
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: T.T4 }}>
              Day Detail
            </div>
            <div className="text-[16px] font-bold mt-[2px]" style={{ color: T.T1, letterSpacing: "-0.3px" }}>
              {dateLong}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-[11px] flex items-center justify-center transition-transform hover:scale-[1.05]"
            style={{ background: T.BG, border: "0.5px solid rgba(0,85,255,0.10)" }}
          >
            <XIcon className="w-4 h-4" style={{ color: T.T3 }} strokeWidth={2.4} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-3">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-[14px]"
            style={{ background: statusTone.bg, border: `0.5px solid ${statusTone.bdr}` }}
          >
            <StatusIcon className="w-5 h-5" style={{ color: statusTone.color }} strokeWidth={2.2} />
            <span className="text-[15px] font-bold" style={{ color: statusTone.color, letterSpacing: "-0.2px" }}>
              {statusTone.message}
            </span>
          </div>

          {day.className && (
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-[14px]"
              style={{ background: T.BG, border: "0.5px solid rgba(0,85,255,0.10)" }}
            >
              <BookOpen className="w-[18px] h-[18px] shrink-0 mt-[2px]" style={{ color: T.B1 }} strokeWidth={2.2} />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: T.T4 }}>
                  Class
                </div>
                <div className="text-[13px] font-bold mt-[2px]" style={{ color: T.T1 }}>
                  {day.className}
                </div>
              </div>
            </div>
          )}

          {day.markedBy && (
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-[14px]"
              style={{ background: T.BG, border: "0.5px solid rgba(0,85,255,0.10)" }}
            >
              <User className="w-[18px] h-[18px] shrink-0 mt-[2px]" style={{ color: T.B1 }} strokeWidth={2.2} />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: T.T4 }}>
                  Marked By
                </div>
                <div className="text-[13px] font-bold mt-[2px]" style={{ color: T.T1 }}>
                  {day.markedBy}
                </div>
              </div>
            </div>
          )}

          {day.note && day.note.trim() && (
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-[14px]"
              style={{
                background: "linear-gradient(135deg, rgba(0,85,255,0.06) 0%, rgba(0,85,255,0.02) 100%)",
                border: "0.5px solid rgba(0,85,255,0.14)",
              }}
            >
              <Sparkles className="w-[18px] h-[18px] shrink-0 mt-[2px]" style={{ color: T.B1 }} strokeWidth={2.2} />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: T.T4 }}>
                  Teacher's Note
                </div>
                <p className="text-[13px] mt-[3px] leading-[1.55]" style={{ color: T.T2 }}>
                  {day.note}
                </p>
              </div>
            </div>
          )}

          {day.status !== "unmarked" && !day.className && !day.markedBy && !(day.note && day.note.trim()) && (
            <div
              className="text-[12px] text-center py-2"
              style={{ color: T.T4 }}
            >
              No additional details recorded for this day.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ── Weekly bars ─────────────────────────────────────────────────────── */

const WeeklyBarsCard = ({ bars, isMobile, navigate }: { bars: WeekBar[]; isMobile: boolean; navigate: NavigateFunction }) => (
  <div
    role="button"
    tabIndex={0}
    aria-label="Open reports page for weekly attendance"
    onClick={() => navigate("/reports")}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/reports"); } }}
    className={
      isMobile
        ? "mx-5 mt-3 bg-white rounded-[22px] px-5 py-[18px] cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
        : "bg-white rounded-[22px] px-5 py-5 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
    }
    style={{ boxShadow: T.SH, border: "0.5px solid rgba(0,85,255,0.10)" }}
  >
    {/* Header */}
    <div className={`flex items-center justify-between ${isMobile ? "mb-[16px]" : "mb-5"}`}>
      <div className="flex items-center gap-[10px]">
        <div
          className={isMobile ? "w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0" : "w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"}
          style={{
            background: `linear-gradient(135deg, ${T.B1}, ${T.B3})`,
            boxShadow: "0 3px 10px rgba(0,85,255,0.28)",
          }}
        >
          <svg width={isMobile ? 15 : 17} height={isMobile ? 15 : 17} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <div>
          <div className={isMobile ? "text-[14px] font-bold" : "text-[15px] font-bold"} style={{ color: T.T1, letterSpacing: "-0.2px" }}>
            Weekly Attendance
          </div>
          <div className={isMobile ? "text-[10px] mt-[1px]" : "text-[11px] mt-[1px]"} style={{ color: T.T3 }}>
            This week's daily overview
          </div>
        </div>
      </div>
      <div
        className={`text-[10px] font-bold px-[10px] py-[4px] rounded-full ${isMobile ? "" : ""}`}
        style={{ background: T.BG, color: T.B1, border: "0.5px solid rgba(0,85,255,0.18)" }}
      >
        View All →
      </div>
    </div>

    {/* Bars */}
    <div
      className={isMobile ? "flex items-end justify-between gap-[6px]" : "flex items-end justify-between gap-[8px]"}
      style={{ height: isMobile ? 72 : 90 }}
    >
      {bars.map((b, i) => {
        const maxH = isMobile ? 64 : 80;
        const heightMap: Record<string, number> = {
          present: maxH,
          late: Math.round(maxH * 0.68),
          absent: Math.round(maxH * 0.28),
          future: Math.round(maxH * 0.22),
          none: Math.round(maxH * 0.22),
        };
        const h = heightMap[b.status] ?? Math.round(maxH * 0.22);

        const bg =
          b.status === "present" ? `linear-gradient(180deg, ${T.B1} 0%, ${T.B3} 60%, ${T.B4} 100%)` :
          b.status === "late"    ? `linear-gradient(180deg, #CC6A00 0%, ${T.ORANGE} 60%, #FFB366 100%)` :
          b.status === "absent"  ? `linear-gradient(180deg, #AA2233 0%, ${T.RED} 60%, #FF8899 100%)` :
          `linear-gradient(180deg, ${T.BG2} 0%, ${T.BG} 100%)`;

        const isActive = b.status === "present" || b.status === "late" || b.status === "absent";

        return (
          <div key={i} className="flex flex-col items-center gap-[6px] flex-1 h-full justify-end">
            {/* Bar track */}
            <div
              className="relative w-full rounded-[6px] overflow-hidden"
              style={{
                height: isMobile ? 64 : 80,
                background: T.BG2,
                border: b.isToday ? `1px solid rgba(0,85,255,0.30)` : "0.5px solid rgba(0,85,255,0.08)",
              }}
            >
              {/* Filled portion — grows from bottom */}
              <div
                className="absolute bottom-0 left-0 right-0 rounded-[6px] transition-all duration-500"
                style={{
                  height: h,
                  background: bg,
                  boxShadow: b.isToday && isActive
                    ? "0 -2px 12px rgba(0,85,255,0.22)"
                    : isActive ? "0 -1px 6px rgba(0,85,255,0.10)" : "none",
                }}
              />
              {/* Today ring overlay */}
              {b.isToday && (
                <div
                  className="absolute inset-0 rounded-[6px] pointer-events-none"
                  style={{ boxShadow: "inset 0 0 0 1.5px rgba(0,85,255,0.35)" }}
                />
              )}
            </div>
            {/* Day label */}
            <span
              className={isMobile ? "text-[9px] font-bold uppercase tracking-[0.06em]" : "text-[10px] font-bold uppercase tracking-[0.06em]"}
              style={{
                color: b.isToday ? T.B1 : T.T4,
                fontWeight: b.isToday ? 800 : 700,
              }}
            >
              {b.label}
            </span>
          </div>
        );
      })}
    </div>

    {/* Legend */}
    <div
      className={`flex items-center gap-[14px] flex-wrap ${isMobile ? "mt-[14px] pt-[12px]" : "mt-4 pt-3"}`}
      style={{ borderTop: `0.5px solid ${T.SEP}` }}
    >
      {[
        { color: `linear-gradient(135deg, ${T.B1}, ${T.B4})`, label: "Present" },
        { color: `linear-gradient(135deg, ${T.ORANGE}, #FFB366)`, label: "Late" },
        { color: `linear-gradient(135deg, ${T.RED}, #FF8899)`, label: "Absent" },
        { color: `linear-gradient(135deg, ${T.BG2}, ${T.BG})`, label: "No data", border: true },
      ].map((item) => (
        <div key={item.label} className="flex items-center gap-[5px]">
          <div
            className="w-[10px] h-[10px] rounded-[3px]"
            style={{
              background: item.color,
              border: item.border ? `0.5px solid rgba(0,85,255,0.18)` : "none",
            }}
          />
          <span className={isMobile ? "text-[9px] font-semibold" : "text-[10px] font-semibold"} style={{ color: T.T4 }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  </div>
);

/* ── Recent absences card ────────────────────────────────────────────── */

interface RecentAbsencesProps {
  recent: RawAttendance[];
  hasAnyLogs: boolean;
  isMobile: boolean;
  navigate: NavigateFunction;
}

const RecentAbsencesCard = ({ recent, hasAnyLogs, isMobile, navigate }: RecentAbsencesProps) => (
  <div
    role="button"
    tabIndex={0}
    aria-label="Open alerts page"
    onClick={() => navigate("/alerts")}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/alerts"); } }}
    className={
      isMobile
        ? "mx-5 mt-3 bg-white rounded-[24px] p-5 cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
        : "bg-white rounded-[24px] p-6 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
    }
    style={{ boxShadow: T.SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}
  >
    <div className={isMobile ? "text-[16px] font-bold mb-4" : "text-[17px] font-bold mb-4"} style={{ color: T.T1, letterSpacing: "-0.3px" }}>
      Recent Absences
    </div>

    {recent.length === 0 ? (
      // Empty state — distinguish "no data yet" from "perfect attendance".
      hasAnyLogs ? (
        <div className={isMobile ? "flex flex-col items-center gap-[10px] pt-5 pb-2" : "flex flex-col items-center gap-3 py-8"}>
          <div
            className={isMobile ? "w-[60px] h-[60px] rounded-[20px] flex items-center justify-center" : "w-[70px] h-[70px] rounded-[22px] flex items-center justify-center"}
            style={{ background: T.GREEN_S, border: `0.5px solid ${T.GREEN_B}`, boxShadow: "0 0 0 8px rgba(0,200,83,0.05)" }}
          >
            <CheckCircle className={isMobile ? "w-7 h-7" : "w-8 h-8"} style={{ color: T.GREEN }} strokeWidth={2.2} />
          </div>
          <div className={isMobile ? "text-[14px] font-semibold" : "text-[15px] font-semibold"} style={{ color: T.T3 }}>
            Perfect attendance
          </div>
          <div className={isMobile ? "text-[12px] text-center max-w-[200px] leading-[1.55] font-normal" : "text-[12px] text-center max-w-[220px] leading-[1.55] font-normal"} style={{ color: T.T4 }}>
            No absences recorded this term. Keep it up.
          </div>
        </div>
      ) : (
        <div className={isMobile ? "flex flex-col items-center gap-[10px] pt-5 pb-2" : "flex flex-col items-center gap-3 py-8"}>
          <div
            className={isMobile ? "w-[60px] h-[60px] rounded-[20px] flex items-center justify-center" : "w-[70px] h-[70px] rounded-[22px] flex items-center justify-center"}
            style={{ background: "rgba(48,48,110,0.06)", border: "0.5px solid rgba(48,48,110,0.12)" }}
          >
            <CalendarIcon className={isMobile ? "w-7 h-7" : "w-8 h-8"} style={{ color: T.T4 }} strokeWidth={2.2} />
          </div>
          <div className={isMobile ? "text-[14px] font-semibold" : "text-[15px] font-semibold"} style={{ color: T.T3 }}>
            No attendance recorded yet
          </div>
          <div className={isMobile ? "text-[12px] text-center max-w-[220px] leading-[1.55] font-normal" : "text-[12px] text-center max-w-[260px] leading-[1.55] font-normal"} style={{ color: T.T4 }}>
            Once your child's teacher starts marking attendance, the records will appear here.
          </div>
        </div>
      )
    ) : (
      <div className="flex flex-col">
        {recent.map((a, i, arr) => {
          const isAbsent = a.status === "absent";
          const dateLong = formatDateLong(a.date);
          return (
            <div
              key={a.id}
              role="button"
              tabIndex={0}
              aria-label={`Open alerts page for ${dateLong} ${isAbsent ? "absence" : "late"}`}
              onClick={(e) => { e.stopPropagation(); navigate("/alerts"); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/alerts"); } }}
              className={
                isMobile
                  ? "flex items-center gap-[13px] py-3 cursor-pointer active:bg-[#EEF4FF] transition-colors rounded-[12px] -mx-2 px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
                  : "flex items-center gap-[13px] py-3 cursor-pointer transition-colors hover:bg-[#F5F9FF] rounded-[12px] -mx-2 px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
              }
              style={{ borderBottom: i < arr.length - 1 ? `0.5px solid ${T.SEP}` : "none" }}
            >
              <div
                className="w-10 h-10 rounded-[13px] flex items-center justify-center shrink-0"
                style={{
                  background: isAbsent ? "rgba(255,51,85,0.10)" : "rgba(255,136,0,0.10)",
                  border: `0.5px solid ${isAbsent ? "rgba(255,51,85,0.22)" : "rgba(255,136,0,0.22)"}`,
                }}
              >
                {isAbsent
                  ? <XCircle className="w-[18px] h-[18px]" style={{ color: T.RED }} strokeWidth={2.2} />
                  : <Clock className="w-[18px] h-[18px]" style={{ color: T.ORANGE }} strokeWidth={2.2} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold" style={{ color: T.T1, letterSpacing: "-0.2px" }}>
                  {dateLong}
                </div>
                <div className="text-[11px] mt-0.5 truncate font-normal" style={{ color: T.T3 }}>
                  {a.note || (isAbsent ? "Reason: Not specified" : "Arrived late")}
                </div>
              </div>
              <div
                className={isMobile ? "px-[11px] py-1 rounded-full text-[10px] font-bold shrink-0" : "px-3 py-[5px] rounded-full text-[11px] font-bold shrink-0"}
                style={{
                  background: isAbsent ? "rgba(255,51,85,0.10)" : "rgba(255,136,0,0.10)",
                  color: isAbsent ? T.RED : T.ORANGE,
                  border: `0.5px solid ${isAbsent ? "rgba(255,51,85,0.22)" : "rgba(255,136,0,0.22)"}`,
                }}
              >
                {isAbsent ? "Absent" : "Late"}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

/* ── Policy + Eligibility cards ───────────────────────────────────────── */

const PolicyCard = ({
  attendanceThreshold, aboveThreshold, studentFirstName, isMobile, navigate,
}: {
  attendanceThreshold: number;
  aboveThreshold: boolean;
  studentFirstName: string;
  isMobile: boolean;
  navigate: NavigateFunction;
}) => (
  <div
    role="button"
    tabIndex={0}
    aria-label="Open settings to view attendance policy"
    onClick={() => navigate("/settings")}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/settings"); } }}
    className={
      isMobile
        ? "mx-5 mt-3 rounded-[22px] px-5 py-[18px] relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        : "rounded-[24px] px-6 py-6 relative overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
    }
    style={{
      background: `linear-gradient(135deg, ${T.B1} 0%, ${T.B2} 100%)`,
      boxShadow: T.SH_BTN,
      border: "0.5px solid rgba(255,255,255,0.16)",
    }}
  >
    <div
      className={isMobile ? "absolute -top-[30px] -right-5 w-[150px] h-[150px] rounded-full pointer-events-none" : "absolute -top-[40px] -right-[10px] w-[200px] h-[200px] rounded-full pointer-events-none"}
      style={{ background: "radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 65%)" }}
    />
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    />
    <div className={isMobile ? "text-[9px] font-bold uppercase tracking-[0.12em] mb-2 relative z-10" : "text-[10px] font-bold uppercase tracking-[0.12em] mb-3 relative z-10"}
      style={{ color: "rgba(255,255,255,0.52)" }}>
      Attendance Policy
    </div>
    <p
      className={isMobile ? "text-[13px] leading-[1.6] font-normal mb-[14px] relative z-10" : "text-[15px] leading-[1.65] font-normal mb-5 relative z-10"}
      style={{ color: "rgba(255,255,255,0.86)" }}
    >
      Minimum {attendanceThreshold}% attendance required for exam eligibility. Students below the threshold will be notified.
    </p>
    <div className={isMobile ? "flex items-center gap-2 pt-3 relative z-10" : "flex items-center gap-2 pt-4 relative z-10"}
      style={{ borderTop: "0.5px solid rgba(255,255,255,0.16)" }}>
      <div
        className={isMobile ? "w-[22px] h-[22px] rounded-[7px] flex items-center justify-center shrink-0" : "w-[26px] h-[26px] rounded-[8px] flex items-center justify-center shrink-0"}
        style={{
          background: aboveThreshold ? T.GREEN_S : "rgba(255,51,85,0.15)",
          border: `0.5px solid ${aboveThreshold ? T.GREEN_B : "rgba(255,51,85,0.30)"}`,
        }}
      >
        {aboveThreshold
          ? <CheckCircle className={isMobile ? "w-3 h-3" : "w-[13px] h-[13px]"} style={{ color: T.GREEN }} strokeWidth={2.5} />
          : <XCircle className={isMobile ? "w-3 h-3" : "w-[13px] h-[13px]"} style={{ color: "#fff" }} strokeWidth={2.5} />}
      </div>
      <span className={isMobile ? "text-[13px] font-bold text-white" : "text-[14px] font-bold text-white"} style={{ letterSpacing: "-0.1px" }}>
        {studentFirstName} is {aboveThreshold ? "above the threshold" : "below the requirement"}
      </span>
    </div>
  </div>
);

const EligibilityCard = ({
  percentage, attendanceThreshold, aboveThreshold, isMobile, navigate,
}: {
  percentage: number | null;
  attendanceThreshold: number;
  aboveThreshold: boolean;
  isMobile: boolean;
  navigate: NavigateFunction;
}) => {
  const pctRender = percentage == null ? "—" : `${percentage}%`;
  const pctBar = percentage == null ? 0 : percentage;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Open settings to view attendance threshold"
      onClick={() => navigate("/settings")}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/settings"); } }}
      className={
        isMobile
          ? "mx-5 mt-3 bg-white rounded-[22px] px-5 py-[18px] cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
          : "bg-white rounded-[22px] px-6 py-6 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
      }
      style={{ boxShadow: T.SH, border: "0.5px solid rgba(0,85,255,0.10)" }}
    >
      <div className={isMobile ? "flex items-end justify-between mb-[10px]" : "flex items-end justify-between mb-3"}>
        <div>
          <div
            className={isMobile ? "text-[13px] font-bold" : "text-[15px] font-bold"}
            style={{ color: T.T1, letterSpacing: "-0.2px", marginBottom: isMobile ? 2 : 3 }}
          >
            Exam Eligibility
          </div>
          <div className={isMobile ? "text-[11px] font-normal" : "text-[12px] font-normal"} style={{ color: T.T3 }}>
            {attendanceThreshold}% threshold required
          </div>
        </div>
        <div
          className={isMobile ? "text-[18px] font-bold" : "text-[26px] font-bold"}
          style={{ color: aboveThreshold ? T.GREEN : T.RED, letterSpacing: isMobile ? "-0.4px" : "-0.7px" }}
        >
          {pctRender}
        </div>
      </div>
      <div
        className={isMobile ? "h-2 rounded-[4px] overflow-hidden relative mb-[6px]" : "h-[10px] rounded-[5px] overflow-hidden relative mb-2"}
        style={{ background: T.BG2 }}
      >
        <div
          className={isMobile ? "h-full rounded-[4px]" : "h-full rounded-[5px]"}
          style={{
            width: `${Math.min(pctBar, 100)}%`,
            background: aboveThreshold
              ? `linear-gradient(90deg, ${T.GREEN}, #66EE88)`
              : `linear-gradient(90deg, ${T.RED}, #FF8899)`,
          }}
        />
        <div
          className={isMobile ? "absolute -top-[2px] w-[2px] h-3 rounded-[1px]" : "absolute -top-[3px] w-[3px] h-[16px] rounded-[2px]"}
          style={{ left: `${Math.min(attendanceThreshold, 100)}%`, background: "rgba(0,85,255,0.55)" }}
        />
      </div>
      <div className="flex justify-between">
        <span
          className={isMobile ? "text-[10px] font-bold" : "text-[11px] font-bold"}
          style={{ color: aboveThreshold ? T.GREEN : T.RED }}
        >
          {pctRender} current
        </span>
        <span
          className={isMobile ? "text-[10px] font-bold" : "text-[11px] font-bold"}
          style={{ color: "rgba(0,85,255,0.6)" }}
        >
          {attendanceThreshold}% required
        </span>
      </div>
    </div>
  );
};

/* ── Correlation card (system-driven, no AI call) ─────────────────────── */

interface CorrelationCardProps {
  correlation: ReturnType<typeof computeAttendanceCorrelation>;
  studentFirstName: string;
  isMobile: boolean;
}

const CorrelationCard = ({ correlation, studentFirstName, isMobile }: CorrelationCardProps) => {
  const bandTone =
    correlation.band === "excellent" ? { c: T.GREEN, bg: T.GREEN_S, bdr: T.GREEN_B } :
    correlation.band === "good" ? { c: T.B1, bg: "rgba(0,85,255,0.07)", bdr: "rgba(0,85,255,0.18)" } :
    correlation.band === "needs_improvement" ? { c: T.ORANGE, bg: "rgba(255,136,0,0.08)", bdr: "rgba(255,136,0,0.22)" } :
    { c: T.RED, bg: "rgba(255,51,85,0.07)", bdr: "rgba(255,51,85,0.20)" };

  if (isMobile) {
    return (
      <div
        className="mx-5 mt-3 bg-white rounded-[22px] overflow-hidden"
        style={{ boxShadow: T.SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}
      >
        <div
          className="flex items-center gap-3 px-5 py-4 relative overflow-hidden"
          style={{ background: "linear-gradient(140deg, #001888 0%, #0033CC 48%, #0055FF 100%)" }}
        >
          <div
            className="absolute -top-7 -right-4 w-[120px] h-[120px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 65%)" }}
          />
          <div
            className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center relative z-10"
            style={{ background: "rgba(255,255,255,0.18)", border: "0.5px solid rgba(255,255,255,0.26)" }}
          >
            <Sparkles className="w-4 h-4 text-white" strokeWidth={2.2} />
          </div>
          <div className="relative z-10">
            <div className="text-[15px] font-bold text-white" style={{ letterSpacing: "-0.3px" }}>
              Attendance Correlation
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
              How presence is shaping {studentFirstName}'s learning
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          <div
            className="inline-flex items-center gap-[6px] px-[11px] py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.04em] mb-[10px]"
            style={{ background: bandTone.bg, color: bandTone.c, border: `0.5px solid ${bandTone.bdr}` }}
          >
            <span className="w-[6px] h-[6px] rounded-full" style={{ background: bandTone.c }} />
            {correlation.band_label}
          </div>
          <p className="text-[13px] leading-[1.6]" style={{ color: T.T2 }}>
            {correlation.correlation_narrative}
          </p>
        </div>

        {(correlation.streak.longest_streak > 0 || correlation.day_pattern.weekday) && (
          <div className="px-5 pb-4 flex flex-col gap-[10px]">
            {correlation.streak.longest_streak > 0 && (
              <div
                className="flex items-center gap-[10px] px-[14px] py-[10px] rounded-[14px]"
                style={{ background: T.BG, border: "0.5px solid rgba(0,85,255,0.10)" }}
              >
                <div
                  className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,136,0,0.12)", border: "0.5px solid rgba(255,136,0,0.24)" }}
                >
                  <Flame className="w-[15px] h-[15px]" style={{ color: T.ORANGE }} strokeWidth={2.2} />
                </div>
                <div className="flex-1">
                  <div className="text-[12px] font-bold" style={{ color: T.T1 }}>
                    Current streak: {correlation.streak.current_streak} {correlation.streak.current_streak === 1 ? "day" : "days"}
                    <span className="font-normal" style={{ color: T.T3 }}> · best: {correlation.streak.longest_streak}</span>
                  </div>
                </div>
              </div>
            )}
            {correlation.day_pattern.weekday && (
              <div
                className="flex items-center gap-[10px] px-[14px] py-[10px] rounded-[14px]"
                style={{ background: "rgba(255,51,85,0.05)", border: "0.5px solid rgba(255,51,85,0.16)" }}
              >
                <div
                  className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,51,85,0.10)", border: "0.5px solid rgba(255,51,85,0.22)" }}
                >
                  <AlertTriangle className="w-[14px] h-[14px]" style={{ color: T.RED }} strokeWidth={2.2} />
                </div>
                <div className="flex-1">
                  <div className="text-[12px] font-bold" style={{ color: T.T1 }}>
                    Pattern: most absences on {correlation.day_pattern.weekday}s
                    <span className="font-normal" style={{ color: T.T3 }}> ({correlation.day_pattern.absence_count})</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="px-5 pb-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.10em] mb-[8px]" style={{ color: T.T4 }}>
            Impact analysis
          </div>
          <div className="flex flex-col gap-2">
            {correlation.impact_analysis.map((pt, i) => (
              <div key={i} className="flex items-start gap-[10px]">
                <div
                  className="w-[18px] h-[18px] rounded-[6px] flex items-center justify-center text-[10px] font-bold shrink-0 mt-[1px]"
                  style={{ background: "rgba(0,85,255,0.08)", color: T.B1, border: "0.5px solid rgba(0,85,255,0.16)" }}
                >
                  {i + 1}
                </div>
                <p className="text-[12px] leading-[1.55]" style={{ color: T.T2 }}>{pt}</p>
              </div>
            ))}
          </div>
        </div>

        <div
          className="mx-5 mb-4 rounded-[16px] px-4 py-[14px]"
          style={{ background: bandTone.bg, border: `0.5px solid ${bandTone.bdr}` }}
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.10em] mb-[5px]" style={{ color: bandTone.c }}>
            Next step
          </div>
          <p className="text-[12px] leading-[1.55]" style={{ color: T.T2 }}>{correlation.growth_strategy}</p>
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div
      className="bg-white rounded-[24px] overflow-hidden mt-5"
      style={{ boxShadow: T.SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}
    >
      <div
        className="flex items-center gap-3 px-6 py-5 relative overflow-hidden"
        style={{ background: "linear-gradient(140deg, #001888 0%, #0033CC 48%, #0055FF 100%)" }}
      >
        <div
          className="absolute -top-7 -right-4 w-[160px] h-[160px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 65%)" }}
        />
        <div
          className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center relative z-10"
          style={{ background: "rgba(255,255,255,0.18)", border: "0.5px solid rgba(255,255,255,0.26)" }}
        >
          <Sparkles className="w-[18px] h-[18px] text-white" strokeWidth={2.2} />
        </div>
        <div className="relative z-10">
          <div className="text-[17px] font-bold text-white" style={{ letterSpacing: "-0.3px" }}>
            Attendance Correlation
          </div>
          <div className="text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
            How presence is shaping {studentFirstName}'s learning
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <div
            className="inline-flex items-center gap-[6px] px-3 py-[5px] rounded-full text-[11px] font-bold uppercase tracking-[0.04em] mb-3"
            style={{ background: bandTone.bg, color: bandTone.c, border: `0.5px solid ${bandTone.bdr}` }}
          >
            <span className="w-[7px] h-[7px] rounded-full" style={{ background: bandTone.c }} />
            {correlation.band_label}
          </div>
          <p className="text-[14px] leading-[1.65] mb-5" style={{ color: T.T2 }}>
            {correlation.correlation_narrative}
          </p>

          <div className="text-[10px] font-bold uppercase tracking-[0.10em] mb-3" style={{ color: T.T4 }}>
            Impact analysis
          </div>
          <div className="flex flex-col gap-[10px]">
            {correlation.impact_analysis.map((pt, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="w-[22px] h-[22px] rounded-[7px] flex items-center justify-center text-[11px] font-bold shrink-0 mt-[2px]"
                  style={{ background: "rgba(0,85,255,0.08)", color: T.B1, border: "0.5px solid rgba(0,85,255,0.16)" }}
                >
                  {i + 1}
                </div>
                <p className="text-[13px] leading-[1.55]" style={{ color: T.T2 }}>{pt}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {correlation.streak.longest_streak > 0 && (
            <div
              className="flex items-center gap-3 px-4 py-[14px] rounded-[16px]"
              style={{ background: T.BG, border: "0.5px solid rgba(0,85,255,0.10)" }}
            >
              <div
                className="w-[36px] h-[36px] rounded-[11px] flex items-center justify-center shrink-0"
                style={{ background: "rgba(255,136,0,0.12)", border: "0.5px solid rgba(255,136,0,0.24)" }}
              >
                <Flame className="w-[18px] h-[18px]" style={{ color: T.ORANGE }} strokeWidth={2.2} />
              </div>
              <div>
                <div className="text-[12px] font-bold" style={{ color: T.T1 }}>
                  Streak: {correlation.streak.current_streak} {correlation.streak.current_streak === 1 ? "day" : "days"}
                </div>
                <div className="text-[11px]" style={{ color: T.T3 }}>
                  Best so far: {correlation.streak.longest_streak} days
                </div>
              </div>
            </div>
          )}
          {correlation.day_pattern.weekday && (
            <div
              className="flex items-center gap-3 px-4 py-[14px] rounded-[16px]"
              style={{ background: "rgba(255,51,85,0.05)", border: "0.5px solid rgba(255,51,85,0.16)" }}
            >
              <div
                className="w-[36px] h-[36px] rounded-[11px] flex items-center justify-center shrink-0"
                style={{ background: "rgba(255,51,85,0.10)", border: "0.5px solid rgba(255,51,85,0.22)" }}
              >
                <AlertTriangle className="w-[16px] h-[16px]" style={{ color: T.RED }} strokeWidth={2.2} />
              </div>
              <div>
                <div className="text-[12px] font-bold" style={{ color: T.T1 }}>
                  Pattern: {correlation.day_pattern.weekday}s
                </div>
                <div className="text-[11px]" style={{ color: T.T3 }}>
                  {correlation.day_pattern.absence_count} absences fall on this day
                </div>
              </div>
            </div>
          )}
          <div
            className="rounded-[16px] px-4 py-[14px]"
            style={{ background: bandTone.bg, border: `0.5px solid ${bandTone.bdr}` }}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.10em] mb-[6px]" style={{ color: bandTone.c }}>
              Next step
            </div>
            <p className="text-[13px] leading-[1.55]" style={{ color: T.T2 }}>
              {correlation.growth_strategy}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   MONTHLY TREND CARD — 6-month line chart of attendance %.
   ════════════════════════════════════════════════════════════════════════ */

interface MonthlyTrendProps {
  points: MonthlyPoint[];
  best: MonthlyPoint | null;
  worst: MonthlyPoint | null;
  isMobile: boolean;
  navigate: NavigateFunction;
}

const MonthlyTrendCard = ({ points, best, worst, isMobile, navigate }: MonthlyTrendProps) => {
  // Drop months without data — a half-empty 6-bucket strip with a flat line
  // at the very end is worse than a fuller 2-3 month view of what's real.
  const meaningful = points.filter((p) => p.percentage != null);
  if (meaningful.length < 2) return null;

  // ≤ 2 months → bar comparison reads better than a flat 2-point line.
  // 3+ months → area chart shows the trend.
  const useBars = meaningful.length <= 2;

  // Zoom Y-axis into the data range so small movements stay visible.
  // For high-attendance students (≥90%) a 0-100 scale flattens everything.
  const pcts = meaningful.map((p) => p.percentage as number);
  const minPct = Math.min(...pcts);
  const yMin = minPct >= 90 ? 70 : minPct >= 75 ? 50 : minPct >= 50 ? 25 : 0;

  const subtitle =
    meaningful.length === points.length
      ? "Monthly attendance rate across recent months"
      : `Across ${meaningful.length} month${meaningful.length === 1 ? "" : "s"} of recorded attendance`;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Open reports page for full attendance trend"
      onClick={() => navigate("/reports")}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/reports"); } }}
      className={
        isMobile
          ? "mx-5 mt-3 bg-white rounded-[24px] p-5 cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
          : "bg-white rounded-[24px] p-6 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
      }
      style={{ boxShadow: T.SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}
    >
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div
            className={isMobile ? "text-[16px] font-bold" : "text-[17px] font-bold"}
            style={{ color: T.T1, letterSpacing: "-0.3px" }}
          >
            {useBars ? "Monthly Attendance" : "6-Month Trend"}
          </div>
          <div className={isMobile ? "text-[11px] mt-0.5" : "text-[12px] mt-0.5"} style={{ color: T.T3 }}>
            {subtitle}
          </div>
        </div>
        {best && worst && best.monthKey !== worst.monthKey && (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{ background: T.GREEN_S, color: T.GREEN_D, border: `0.5px solid ${T.GREEN_B}` }}
            >
              <Trophy className="w-[10px] h-[10px]" strokeWidth={2.4} />
              Best · {best.monthLabel} {best.percentage}%
            </div>
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{ background: "rgba(255,51,85,0.08)", color: T.RED, border: "0.5px solid rgba(255,51,85,0.20)" }}
            >
              <AlertTriangle className="w-[10px] h-[10px]" strokeWidth={2.4} />
              Lowest · {worst.monthLabel} {worst.percentage}%
            </div>
          </div>
        )}
      </div>
      <div className={isMobile ? "h-[180px] w-full" : "h-[240px] w-full"}>
        <ResponsiveContainer width="100%" height="100%">
          {useBars ? (
            <BarChart
              data={meaningful}
              margin={{ top: 24, right: 16, left: isMobile ? -18 : -10, bottom: 0 }}
              barCategoryGap="30%"
            >
              <defs>
                <linearGradient id="attTrendBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.B1} stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#66BBFF" stopOpacity={0.75} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(0,85,255,0.07)" />
              <XAxis
                dataKey="monthLabel"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: isMobile ? 11 : 13, fill: T.T2, fontWeight: 700 }}
                tickMargin={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: isMobile ? 10 : 12, fill: T.T4, fontWeight: 600 }}
                domain={[yMin, 100]}
                width={isMobile ? 30 : 36}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                cursor={{ fill: "rgba(0,85,255,0.04)" }}
                contentStyle={{
                  borderRadius: 12,
                  border: "0.5px solid rgba(0,85,255,0.15)",
                  boxShadow: "0 4px 20px rgba(0,85,255,0.12)",
                  fontSize: isMobile ? 11 : 12,
                  padding: "8px 12px",
                }}
                formatter={(val: unknown) =>
                  typeof val === "number" ? [`${val}%`, "Attendance"] : ["—", "Attendance"]
                }
              />
              <Bar
                dataKey="percentage"
                fill="url(#attTrendBar)"
                radius={[12, 12, 4, 4]}
                maxBarSize={isMobile ? 70 : 110}
              >
                <LabelList
                  dataKey="percentage"
                  position="top"
                  formatter={(v: unknown) => (typeof v === "number" ? `${v}%` : "")}
                  style={{
                    fontSize: isMobile ? 12 : 14,
                    fontWeight: 700,
                    fill: T.T1,
                    letterSpacing: "-0.2px",
                  }}
                />
              </Bar>
            </BarChart>
          ) : (
            <AreaChart
              data={meaningful}
              margin={{ top: 24, right: 16, left: isMobile ? -18 : -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="attTrendArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.B1} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={T.B1} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="attTrendLine" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={T.B1} />
                  <stop offset="100%" stopColor="#66BBFF" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(0,85,255,0.07)" />
              <XAxis
                dataKey="monthLabel"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: isMobile ? 11 : 13, fill: T.T2, fontWeight: 700 }}
                tickMargin={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: isMobile ? 10 : 12, fill: T.T4, fontWeight: 600 }}
                domain={[yMin, 100]}
                width={isMobile ? 30 : 36}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "0.5px solid rgba(0,85,255,0.15)",
                  boxShadow: "0 4px 20px rgba(0,85,255,0.12)",
                  fontSize: isMobile ? 11 : 12,
                  padding: "8px 12px",
                }}
                formatter={(val: unknown) =>
                  typeof val === "number" ? [`${val}%`, "Attendance"] : ["—", "Attendance"]
                }
              />
              <Area
                type="monotone"
                dataKey="percentage"
                stroke="url(#attTrendLine)"
                strokeWidth={isMobile ? 3 : 3.5}
                fill="url(#attTrendArea)"
                dot={{ r: isMobile ? 5 : 6, strokeWidth: 2.5, stroke: "#fff", fill: T.B1 }}
                activeDot={{ r: isMobile ? 7 : 8, strokeWidth: 2 }}
                connectNulls
              >
                <LabelList
                  dataKey="percentage"
                  position="top"
                  offset={12}
                  formatter={(v: unknown) => (typeof v === "number" ? `${v}%` : "")}
                  style={{
                    fontSize: isMobile ? 11 : 12,
                    fontWeight: 700,
                    fill: T.T1,
                    letterSpacing: "-0.2px",
                  }}
                />
              </Area>
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   WEEKDAY PATTERN CARD — 5-bar chart of absences per Mon-Fri.
   ════════════════════════════════════════════════════════════════════════ */

const WeekdayPatternCard = ({ bars, isMobile }: { bars: WeekdayBar[]; isMobile: boolean }) => {
  const total = bars.reduce((a, b) => a + b.absences, 0);
  if (total === 0) return null;
  const max = Math.max(...bars.map((b) => b.absences));
  return (
    <div
      className={isMobile ? "mx-5 mt-3 bg-white rounded-[22px] p-5" : "bg-white rounded-[22px] p-6"}
      style={{ boxShadow: T.SH, border: "0.5px solid rgba(0,85,255,0.10)" }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, #FF6688, #FF3355)",
            boxShadow: "0 3px 10px rgba(255,51,85,0.28)",
          }}
        >
          <AlertTriangle className="w-[18px] h-[18px] text-white" strokeWidth={2.2} />
        </div>
        <div>
          <div
            className={isMobile ? "text-[16px] font-bold" : "text-[17px] font-bold"}
            style={{ color: T.T1, letterSpacing: "-0.3px" }}
          >
            Day-of-Week Pattern
          </div>
          <div className={isMobile ? "text-[11px] mt-0.5" : "text-[12px] mt-0.5"} style={{ color: T.T3 }}>
            Where absences cluster across weekdays
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-2 h-[100px] mb-3">
        {bars.map((b) => {
          const heightPct = max === 0 ? 0 : (b.absences / max) * 100;
          const fillColor = b.isPeak
            ? `linear-gradient(180deg, ${T.RED}, #FF8899)`
            : b.absences > 0
              ? `linear-gradient(180deg, ${T.ORANGE}, #FFB366)`
              : T.BG2;
          return (
            <div key={b.label} className="flex flex-col items-center gap-2 flex-1">
              <div
                className="text-[11px] font-bold tabular-nums"
                style={{ color: b.isPeak ? T.RED : b.absences > 0 ? T.ORANGE : T.T4 }}
              >
                {b.absences}
              </div>
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full rounded-t-[5px] transition-all duration-300"
                  style={{
                    height: `${Math.max(heightPct, 5)}%`,
                    background: fillColor,
                    boxShadow: b.isPeak ? "0 0 0 3px rgba(255,51,85,0.18)" : "none",
                  }}
                />
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-[0.04em]"
                style={{ color: b.isPeak ? T.RED : T.T4 }}
              >
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
      {bars.find((b) => b.isPeak) && (
        <div
          className="text-[11px] italic"
          style={{ color: T.T3 }}
        >
          {bars.find((b) => b.isPeak)?.weekday}s show the most absences ({bars.find((b) => b.isPeak)?.absences}).
        </div>
      )}
    </div>
  );
};

/* PerClassAttendanceCard was here — removed 2026-05-11.
 * Reason: class teacher takes ONE daily attendance per student. A per-class
 * breakdown surfaces architectural noise (subject teacher's classId may
 * never be marked) as if it were genuine signal. See memory file
 * `feedback_attendance_one_per_day_loophole`. Keep the deletion. */

/* ════════════════════════════════════════════════════════════════════════
   PUNCTUALITY TILE — 5th stat showing late-rate (separate from attendance %).
   ════════════════════════════════════════════════════════════════════════ */

const PunctualityTile = ({
  pct, lateCount, totalMarked, isMobile, navigate,
}: {
  pct: number | null;
  lateCount: number;
  totalMarked: number;
  isMobile: boolean;
  navigate: NavigateFunction;
}) => {
  const tone =
    pct == null ? T.T4 :
    pct >= 90 ? T.GREEN :
    pct >= 75 ? T.ORANGE : T.RED;
  const label =
    pct == null ? "—" :
    pct >= 90 ? "On Time" :
    pct >= 75 ? "Occasional Late" : "Often Late";
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Open reports page for punctuality"
      onClick={() => navigate("/reports")}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/reports"); } }}
      className={
        isMobile
          ? "mx-5 mt-3 bg-white rounded-[22px] p-4 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
          : "bg-white rounded-[22px] p-5 flex items-center gap-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
      }
      style={{ boxShadow: T.SH, border: "0.5px solid rgba(0,85,255,0.10)" }}
    >
      <div
        className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0"
        style={{
          background: `linear-gradient(135deg, ${tone}, ${tone}99)`,
          boxShadow: `0 3px 12px ${tone}40`,
        }}
      >
        <Activity className="w-[22px] h-[22px] text-white" strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-[9px] font-bold uppercase tracking-[0.10em]"
          style={{ color: T.T4 }}
        >
          Punctuality
        </div>
        <div
          className={isMobile ? "text-[20px] font-bold leading-none mt-1" : "text-[24px] font-bold leading-none mt-1"}
          style={{ color: tone, letterSpacing: "-0.5px" }}
        >
          {pct == null ? "—" : `${pct}%`}
        </div>
        <div className="text-[11px] mt-1" style={{ color: T.T3 }}>
          {label}
          {totalMarked > 0 && (
            <span style={{ color: T.T4 }}>
              {" · "}{lateCount} late of {totalMarked} marked
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════════════════════════════════ */

const AttendancePage = () => {
  const { studentData } = useAuth();
  const navigate = useNavigate();
  const settings = useSchoolSettings();
  const { attendanceThreshold } = settings;
  const isMobile = useIsMobile();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceLogs, setAttendanceLogs] = useState<RawAttendance[]>([]);
  const [enrollments, setEnrollments] = useState<RawEnrollment[]>([]);
  const [schoolHolidays, setSchoolHolidays] = useState<SchoolHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  // School-wide holidays lookup. Excluded from both stats + monthStats below.
  const holidayMap = useMemo(() => buildHolidayMap(schoolHolidays), [schoolHolidays]);

  // Stats derived from attendanceLogs + holidayMap (was useState, now useMemo
  // so principal-declared school holidays correctly drop out of % once they
  // arrive over the school_holidays subscription).
  const stats = useMemo<AttendanceStats>(() => {
    const countable = attendanceLogs.filter(l => !(l.date && holidayMap.has(l.date)));
    const pCount = countable.filter((l) => l.status === "present").length;
    const aCount = countable.filter((l) => l.status === "absent").length;
    const lCount = countable.filter((l) => l.status === "late").length;
    const total = pCount + aCount + lCount;
    return {
      present: pCount, absent: aCount, late: lCount,
      percentage: total === 0 ? null : Math.round(((pCount + lCount) / total) * 100),
    };
  }, [attendanceLogs, holidayMap]);

  const monthStats = useMemo<MonthStats>(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thisMonth = attendanceLogs.filter(l => l.date?.startsWith(ym) && !holidayMap.has(l.date || ""));
    return {
      present: thisMonth.filter((l) => l.status === "present").length,
      absent:  thisMonth.filter((l) => l.status === "absent").length,
      late:    thisMonth.filter((l) => l.status === "late").length,
    };
  }, [attendanceLogs, holidayMap]);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null);

  useEffect(() => {
    if (!studentData?.id || !studentData?.schoolId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setListenerError(null);

    // Academic year start — pulls from school settings (per-school override),
    // falls back to June 1 if missing.
    const yearStart = academicYearStart(settings.academicYearStartMonth ?? 6);

    const u = subscribePerStudent({
      collection: "attendance",
      student: studentData,
      studentIdOnlyFilters: [where("date", ">=", yearStart)],
      onChange: (docs) => {
        if (cancelled) return;
        const raw: RawAttendance[] = docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<RawAttendance, "id">) }))
          .filter((l) => !l.date || l.date >= yearStart);
        // Dedup by (date) — multiple teachers may have marked the same
        // student for the same day (per-class doc-id allows it). Without
        // dedup, daily counts inflate and the percentage skews. See memory
        // `feedback_attendance_one_per_day_loophole` for the canonical fix.
        const uniqueLogs = dedupAndSortAttendance(raw);
        setAttendanceLogs(uniqueLogs);
        // stats + monthStats are now derived useMemos above — no setState here.
        setLoading(false);
      },
      onError: (err) => {
        if (cancelled) return;
        // FAILED_PRECONDITION usually = missing composite index. Console
        // message contains a "needs an index" link that creates it.
        console.error("[Attendance] listener error (often missing index):", err);
        setListenerError(err.message || "Couldn't load attendance. Retry?");
        setLoading(false);
      },
    });

    // Enrollments listener — for per-class breakdown name resolution.
    const unsubEnroll = subscribeEnrollments(
      studentData,
      (docs) => {
        if (cancelled) return;
        setEnrollments(
          docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RawEnrollment, "id">) })),
        );
      },
      (err) => {
        if (cancelled) return;
        console.error("[Attendance] enrollments listener error:", err);
        // Don't block the page on enrollments failure — per-class breakdown
        // simply won't render. Main attendance listener handles primary errors.
      },
    );

    // School-wide holidays (principal-declared) — excluded from % + rendered
    // as purple cells on the calendar.
    const unsubHolidays = subscribeSchoolHolidays(
      studentData?.schoolId || "",
      (rows) => { if (!cancelled) setSchoolHolidays(rows); },
      (err) => console.error("[Attendance] school_holidays:", err),
    );

    return () => {
      cancelled = true;
      u();
      unsubEnroll();
      unsubHolidays();
    };
  }, [studentData, refreshKey, settings.academicYearStartMonth]);

  // O(1) lookup map for calendar cells. Was previously a filter-per-day
  // (O(N × 31)) inside getDayStatus — now one Map<istKey, status>.
  const attendanceMap = useMemo(() => {
    const m = new Map<string, string>();
    attendanceLogs.forEach((l) => {
      if (l.date && l.status) m.set(l.date, l.status);
    });
    // School-wide holidays trump any per-student attendance status. Same
    // date renders as purple "holiday" everywhere it's surfaced.
    holidayMap.forEach((_v, key) => m.set(key, "holiday"));
    return m;
  }, [attendanceLogs, holidayMap]);

  // Single week-bar computation used by both branches.
  const weekBars = useMemo<WeekBar[]>(() => {
    const now = new Date();
    const jsDow = now.getDay();
    const daysFromMonday = jsDow === 0 ? 6 : jsDow - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysFromMonday);
    monday.setHours(0, 0, 0, 0);
    const todayMidnight = new Date().setHours(0, 0, 0, 0);
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = istKey(d);
      const isFuture = d.getTime() > todayMidnight;
      const isToday = d.toDateString() === new Date().toDateString();
      const status = attendanceMap.get(key);
      let barStatus: WeekBar["status"];
      if (status === "present" || status === "absent" || status === "late") barStatus = status;
      else if (isFuture) barStatus = "future";
      else barStatus = "none";
      return { label: ["Mon", "Tue", "Wed", "Thu", "Fri"][i], status: barStatus, isToday, isFuture };
    });
  }, [attendanceMap]);

  const correlation = useMemo(
    () =>
      computeAttendanceCorrelation({
        childName: studentData?.name?.split(" ")[0] || "",
        logs: attendanceLogs,
      }),
    [attendanceLogs, studentData?.name],
  );

  // ── A. Monthly trend (last 6 months) ────────────────────────────────
  const monthlyTrend = useMemo<MonthlyPoint[]>(() => {
    const MONTH_LABEL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const byMonth = new Map<string, { present: number; absent: number; late: number }>();
    attendanceLogs.forEach((l) => {
      if (!l.date) return;
      const key = l.date.slice(0, 7); // "YYYY-MM"
      if (!byMonth.has(key)) byMonth.set(key, { present: 0, absent: 0, late: 0 });
      const bucket = byMonth.get(key)!;
      if (l.status === "present") bucket.present += 1;
      else if (l.status === "absent") bucket.absent += 1;
      else if (l.status === "late") bucket.late += 1;
    });
    const points: MonthlyPoint[] = [];
    const now = new Date();
    for (let off = 5; off >= 0; off--) {
      const d = new Date(now.getFullYear(), now.getMonth() - off, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = byMonth.get(key);
      const total = bucket ? bucket.present + bucket.absent + bucket.late : 0;
      const percentage = total === 0 ? null : Math.round(((bucket!.present + bucket!.late) / total) * 100);
      points.push({
        monthKey: key,
        monthLabel: MONTH_LABEL[d.getMonth()],
        percentage,
        total,
        present: bucket?.present ?? 0,
      });
    }
    return points;
  }, [attendanceLogs]);

  // ── F. Best/worst month from the same trend data ────────────────────
  const { bestMonth, worstMonth } = useMemo(() => {
    const meaningful = monthlyTrend.filter((p) => p.percentage != null && p.total > 0);
    if (meaningful.length < 2) return { bestMonth: null, worstMonth: null };
    let best = meaningful[0];
    let worst = meaningful[0];
    meaningful.forEach((p) => {
      if ((p.percentage as number) > (best.percentage as number)) best = p;
      if ((p.percentage as number) < (worst.percentage as number)) worst = p;
    });
    return { bestMonth: best, worstMonth: worst };
  }, [monthlyTrend]);

  // ── B. Day-of-week absence pattern (Mon-Fri) ────────────────────────
  const weekdayPattern = useMemo<WeekdayBar[]>(() => {
    const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const counts = new Array(5).fill(0); // Mon..Fri
    attendanceLogs.forEach((l) => {
      if (l.status !== "absent" || !l.date) return;
      const d = parseISODateLocal(l.date);
      if (!d) return;
      const dow = d.getDay(); // 0=Sun, 1=Mon ... 5=Fri, 6=Sat
      if (dow >= 1 && dow <= 5) counts[dow - 1] += 1;
    });
    const max = Math.max(...counts);
    const total = counts.reduce((a, b) => a + b, 0);
    // Peak only flagged when there's a real pattern: max ≥ 3 absences AND ≥40%
    // of total absences fall on that day. Mirrors the correlation helper.
    return SHORT.map((label, i) => ({
      label,
      weekday: WEEKDAY_NAMES[i + 1],
      absences: counts[i],
      isPeak: max >= 3 && counts[i] === max && counts[i] / total >= 0.4,
    }));
  }, [attendanceLogs]);

  // (Per-class attendance breakdown removed — class teacher writes ONE
  // daily record. Splitting by classId is architectural noise. The
  // `enrollments` listener is kept because handleDayClick uses it to
  // resolve the class name on the Day Detail modal.)

  // ── E. Punctuality score (late/total marked) ────────────────────────
  const punctuality = useMemo(() => {
    const totalMarked = stats.present + stats.absent + stats.late;
    if (totalMarked === 0) {
      return { pct: null as number | null, lateCount: 0, totalMarked: 0 };
    }
    const presentOrLate = stats.present + stats.late;
    // Of the days we DID show up, what % were on time?
    const pct =
      presentOrLate === 0 ? null : Math.round((stats.present / presentOrLate) * 100);
    return { pct, lateCount: stats.late, totalMarked };
  }, [stats]);

  // ── D. Calendar cell click → DayDetail ──────────────────────────────
  const handleDayClick = (dateKey: string, status: string) => {
    // Past weekday with no record — surface "not marked" to the parent so they
    // know it's a teacher oversight, not a silent gap.
    if (status === "unmarked") {
      setSelectedDay({
        dateKey,
        status: "unmarked",
        note: null,
        className: null,
        markedBy: null,
      });
      return;
    }
    const log = attendanceLogs.find((l) => l.date === dateKey);
    if (!log) return;
    const className = log.classId
      ? (enrollments.find((e) => e.classId === log.classId)?.className || null)
      : null;
    setSelectedDay({
      dateKey,
      status: log.status || "unknown",
      note: log.note || null,
      className,
      markedBy: log.teacherName || log.markedBy || null,
    });
  };

  const handlePrevMonth = () =>
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1));
  const handleNextMonth = () =>
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1));

  const monthName = selectedDate.toLocaleString("default", { month: "long", year: "numeric" });
  const recentAbsences = attendanceLogs.filter((a) => a.status !== "present").slice(0, 5);
  const aboveThreshold = (stats.percentage ?? 0) >= attendanceThreshold;
  const studentFirstName = studentData?.name?.split(" ")[0] || "Student";

  const monthTotal = monthStats.present + monthStats.absent + monthStats.late;
  const presentPct = monthTotal === 0 ? 0 : Math.round((monthStats.present / monthTotal) * 100);
  const absentPct  = monthTotal === 0 ? 0 : Math.round((monthStats.absent  / monthTotal) * 100);
  const latePct    = monthTotal === 0 ? 0 : Math.round((monthStats.late    / monthTotal) * 100);
  void presentPct; void absentPct; void latePct; // currently unused — kept for future stat-bar restoration

  // Stat card configs — shared between mobile + desktop branches.
  const statCardCfgs: StatCardCfg[] = [
    {
      icon: CheckCircle, decorIcon: TrendingUp, iconColor: T.GREEN,
      cardBg: "linear-gradient(135deg, rgba(0,200,83,0.13) 0%, rgba(0,200,83,0.04) 100%)",
      cardBdr: "rgba(0,200,83,0.20)",
      iconBoxBg: "rgba(0,200,83,0.18)", iconBoxBdr: "rgba(0,200,83,0.30)",
      label: "Overall",
      value: stats.percentage == null ? "—" : `${stats.percentage}%`,
      valColor: T.GREEN, route: "/reports",
    },
    {
      icon: Users, decorIcon: UserCheck, iconColor: T.B1,
      cardBg: "linear-gradient(135deg, rgba(0,85,255,0.10) 0%, rgba(0,85,255,0.03) 100%)",
      cardBdr: "rgba(0,85,255,0.20)",
      iconBoxBg: "rgba(0,85,255,0.14)", iconBoxBdr: "rgba(0,85,255,0.28)",
      label: "Present", value: monthStats.present.toString(), valColor: T.B1, route: "/reports",
    },
    {
      icon: XCircle, decorIcon: CalendarX, iconColor: T.RED,
      cardBg: "linear-gradient(135deg, rgba(255,51,85,0.10) 0%, rgba(255,51,85,0.03) 100%)",
      cardBdr: "rgba(255,51,85,0.20)",
      iconBoxBg: "rgba(255,51,85,0.14)", iconBoxBdr: "rgba(255,51,85,0.30)",
      label: "Absent", value: monthStats.absent.toString(), valColor: T.RED, route: "/alerts",
    },
    {
      icon: Clock, decorIcon: Hourglass, iconColor: T.ORANGE,
      cardBg: "linear-gradient(135deg, rgba(255,136,0,0.13) 0%, rgba(255,136,0,0.04) 100%)",
      cardBdr: "rgba(255,136,0,0.22)",
      iconBoxBg: "rgba(255,136,0,0.18)", iconBoxBdr: "rgba(255,136,0,0.32)",
      label: "Late", value: monthStats.late.toString(), valColor: T.ORANGE, route: "/alerts",
    },
  ];

  /* ── MOBILE branch ───────────────────────────────────────────────── */
  if (isMobile) {
    return (
      <div
        className="animate-in fade-in duration-500 -mx-3 -mt-3 md:mx-0 md:mt-0"
        style={{
          fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
          background: T.BG,
          minHeight: "100vh",
        }}
      >
        {/* Page Head */}
        <div className="flex items-start justify-between px-[22px] pt-[18px]">
          <div>
            <div className="text-[24px] font-bold" style={{ color: T.T1, letterSpacing: "-0.6px" }}>
              Attendance Tracking
            </div>
            <div className="text-[12px] mt-[3px] font-normal" style={{ color: T.T3 }}>
              Monitor daily presence and monthly patterns
            </div>
          </div>
          <div
            className="px-3 py-[5px] rounded-full text-[11px] font-bold tracking-[0.02em] whitespace-nowrap mt-1 shrink-0"
            style={{ background: T.GREEN_S, color: T.GREEN_D, border: `0.5px solid ${T.GREEN_B}` }}
          >
            {stats.percentage == null ? "— AVG" : `${stats.percentage}% AVG`}
          </div>
        </div>

        {listenerError && (
          <ListenerErrorBanner
            message={listenerError}
            onRetry={() => setRefreshKey((k) => k + 1)}
            marginClass="mx-5 mt-3"
          />
        )}

        {/* Stat Grid 2×2 */}
        <div className="grid grid-cols-2 gap-[10px] mx-5 mt-4">
          {statCardCfgs.map((cfg) => (
            <StatCard key={cfg.label} cfg={cfg} isMobile navigate={navigate} />
          ))}
        </div>

        <MonthSummaryRing
          monthName={monthName}
          monthStats={monthStats}
          percentage={stats.percentage}
          aboveThreshold={aboveThreshold}
          isMobile
          navigate={navigate}
        />

        <CalendarCard
          selectedDate={selectedDate}
          monthName={monthName}
          onPrev={handlePrevMonth}
          onNext={handleNextMonth}
          attendanceMap={attendanceMap}
          loading={loading}
          isMobile
          navigate={navigate}
          onCellClick={handleDayClick}
        />

        {!loading && <WeeklyBarsCard bars={weekBars} isMobile navigate={navigate} />}

        {/* A. 6-Month Trend */}
        {!loading && (
          <MonthlyTrendCard
            points={monthlyTrend}
            best={bestMonth}
            worst={worstMonth}
            isMobile
            navigate={navigate}
          />
        )}

        {/* B. Day-of-Week Pattern */}
        {!loading && <WeekdayPatternCard bars={weekdayPattern} isMobile />}

        {/* (Per-class breakdown removed — class teacher takes ONE daily
            attendance per student. Multi-class subject splits are
            architectural noise, not legitimate signal. See memory
            `feedback_attendance_one_per_day_loophole`.) */}

        {/* E. Punctuality tile */}
        {!loading && (
          <PunctualityTile
            pct={punctuality.pct}
            lateCount={punctuality.lateCount}
            totalMarked={punctuality.totalMarked}
            isMobile
            navigate={navigate}
          />
        )}

        <RecentAbsencesCard
          recent={recentAbsences}
          hasAnyLogs={attendanceLogs.length > 0}
          isMobile
          navigate={navigate}
        />

        <PolicyCard
          attendanceThreshold={attendanceThreshold}
          aboveThreshold={aboveThreshold}
          studentFirstName={studentFirstName}
          isMobile
          navigate={navigate}
        />

        {!loading && <CorrelationCard correlation={correlation} studentFirstName={studentFirstName} isMobile />}

        <EligibilityCard
          percentage={stats.percentage}
          attendanceThreshold={attendanceThreshold}
          aboveThreshold={aboveThreshold}
          isMobile
          navigate={navigate}
        />

        <div className="h-6" />

        {/* D. Day-detail modal — appears over the page when a marked calendar cell is clicked */}
        {selectedDay && (
          <DayDetailModal day={selectedDay} onClose={() => setSelectedDay(null)} />
        )}
      </div>
    );
  }

  /* ── DESKTOP branch ──────────────────────────────────────────────── */
  return (
    <div
      className="animate-in fade-in duration-500 -m-4 sm:-m-6 md:-m-8 min-h-[calc(100vh-64px)]"
      style={{
        fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        background: T.BG,
      }}
    >
      <div className="w-full px-6 pt-8 pb-12">
        {/* Toolbar */}
        <div className="flex items-start justify-between gap-6 flex-wrap mb-6">
          <div>
            <div className="text-[32px] font-bold" style={{ color: T.T1, letterSpacing: "-0.9px" }}>
              Attendance Tracking
            </div>
            <div className="text-[14px] mt-2 font-normal" style={{ color: T.T3 }}>
              Monitor daily presence and monthly patterns
            </div>
          </div>
          <div
            className="px-4 py-[10px] rounded-full text-[13px] font-bold tracking-[0.02em] whitespace-nowrap"
            style={{ background: T.GREEN_S, color: T.GREEN_D, border: `0.5px solid ${T.GREEN_B}` }}
          >
            {stats.percentage == null ? "— Avg" : `${stats.percentage}% Avg`}
          </div>
        </div>

        {listenerError && (
          <ListenerErrorBanner
            message={listenerError}
            onRetry={() => setRefreshKey((k) => k + 1)}
            marginClass="mb-5"
          />
        )}

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {statCardCfgs.map((cfg) => (
            <StatCard key={cfg.label} cfg={cfg} isMobile={false} navigate={navigate} />
          ))}
        </div>

        {/* Main row: Calendar (3) + Sidebar (2) */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3">
            <CalendarCard
              selectedDate={selectedDate}
              monthName={monthName}
              onPrev={handlePrevMonth}
              onNext={handleNextMonth}
              attendanceMap={attendanceMap}
              loading={loading}
              isMobile={false}
              navigate={navigate}
              isInGrid
              onCellClick={handleDayClick}
            />
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            <MonthSummaryRing
              monthName={monthName}
              monthStats={monthStats}
              percentage={stats.percentage}
              aboveThreshold={aboveThreshold}
              isMobile={false}
              navigate={navigate}
            />
            {!loading && <WeeklyBarsCard bars={weekBars} isMobile={false} navigate={navigate} />}
            {/* E. Punctuality tile in the sidebar */}
            {!loading && (
              <PunctualityTile
                pct={punctuality.pct}
                lateCount={punctuality.lateCount}
                totalMarked={punctuality.totalMarked}
                isMobile={false}
                navigate={navigate}
              />
            )}
          </div>
        </div>

        {/* A. 6-Month Trend (full width) */}
        {!loading && (
          <div className="mt-5">
            <MonthlyTrendCard
              points={monthlyTrend}
              best={bestMonth}
              worst={worstMonth}
              isMobile={false}
              navigate={navigate}
            />
          </div>
        )}

        {/* B row: Day-of-week pattern. Per-class breakdown removed —
            class teacher takes ONE daily attendance per student; splitting
            by subject teacher's class is architectural noise (see memory
            `feedback_attendance_one_per_day_loophole`). */}
        {!loading && (
          <div className="mt-5">
            <WeekdayPatternCard bars={weekdayPattern} isMobile={false} />
          </div>
        )}

        {!loading && (
          <CorrelationCard correlation={correlation} studentFirstName={studentFirstName} isMobile={false} />
        )}

        {/* Bottom row: Recent + Policy + Eligibility */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
          <RecentAbsencesCard
            recent={recentAbsences}
            hasAnyLogs={attendanceLogs.length > 0}
            isMobile={false}
            navigate={navigate}
          />
          <PolicyCard
            attendanceThreshold={attendanceThreshold}
            aboveThreshold={aboveThreshold}
            studentFirstName={studentFirstName}
            isMobile={false}
            navigate={navigate}
          />
          <EligibilityCard
            percentage={stats.percentage}
            attendanceThreshold={attendanceThreshold}
            aboveThreshold={aboveThreshold}
            isMobile={false}
            navigate={navigate}
          />
        </div>
      </div>

      {/* D. Day-detail modal */}
      {selectedDay && (
        <DayDetailModal day={selectedDay} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  );
};

export default AttendancePage;
