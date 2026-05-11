import { useState, useEffect, useMemo } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  School, ShieldCheck, Loader2, Target, MessageSquare,
  BookOpen, ChevronRight, Layers, Hash, AlertCircle,
  GraduationCap, BookText, Library, BookMarked,
} from "lucide-react";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { db } from "../lib/firebase";
import {
  doc as fbDoc, getDoc as fbGetDoc,
  onSnapshot, where,
} from "firebase/firestore";
import { subscribeEnrollments } from "../lib/enrollmentQuery";
import { scopedQuery } from "../lib/scopedQuery";
import { useSchoolSettings, resolveAcademicYear } from "@/hooks/useSchoolSettings";
import { useIsMobile } from "@/hooks/use-mobile";

/* ════════════════════════════════════════════════════════════════════════
   TYPES — strict shapes, no `[k: string]: any` index escape hatch.
   ════════════════════════════════════════════════════════════════════════ */

interface RawEnrollment {
  id: string;
  studentId?: string;
  studentEmail?: string;
  studentName?: string;
  classId?: string;
  className?: string;
  classGroup?: string;
  classSection?: string;
  class?: string;
  section?: string;
  teacherId?: string;
  teacherName?: string;
  teacherEmail?: string;
  rollNo?: string;
  schoolId?: string;
  branchId?: string;
  academicYear?: string;
  createdAt?: { toMillis?: () => number; seconds?: number } | number | string | null;
  // Fallback subject fields — production writers don't set these; only
  // future migrations that backfill subject onto enrollments would.
  subject?: string;
  subjectName?: string;
  Subject?: string;
  name?: string;
  title?: string;
  courseName?: string;
  course?: string;
}

interface EnrichedEnrollment extends RawEnrollment {
  teacherName: string;       // always set (resolved or "Teacher unassigned")
  initials: string;          // always set (computed or "—")
  resolvedSubject: string;   // from teaching_assignments join (or fallback)
}

interface RawTeachingAssignment {
  teacherId?: string;
  classId?: string;
  subjectName?: string;
  subject?: string;
  status?: string;
}

/* ════════════════════════════════════════════════════════════════════════
   THEMES — hash-based per-subject so the same subject always picks the
   same color across renders/sessions. Falls back to index rotation.
   ════════════════════════════════════════════════════════════════════════ */

interface CardTheme {
  hero: string;
  heroBdr: string;
  accent: string;
  accentSolid: string;
  iconBoxBg: string;
  iconBoxBdr: string;
  pillBg: string;
  pillBdr: string;
  chipBg: string;
  chipBdr: string;
  btnGrad: string;
  btnShadow: string;
  avatar: { bg: string; shadow: string };
  decorIcon: ComponentType<{ style?: React.CSSProperties }>;
}

const CARD_THEMES: CardTheme[] = [
  // Green
  {
    hero: "linear-gradient(135deg, rgba(0,200,83,0.18) 0%, rgba(0,200,83,0.05) 100%)",
    heroBdr: "rgba(0,200,83,0.18)",
    accent: "#00A040",
    accentSolid: "#00C853",
    iconBoxBg: "rgba(0,200,83,0.18)",
    iconBoxBdr: "rgba(0,200,83,0.32)",
    pillBg: "rgba(0,200,83,0.18)",
    pillBdr: "rgba(0,200,83,0.34)",
    chipBg: "rgba(0,200,83,0.16)",
    chipBdr: "rgba(0,200,83,0.30)",
    btnGrad: "linear-gradient(135deg, #00C853 0%, #00A040 100%)",
    btnShadow: "0 4px 18px rgba(0,200,83,0.34), 0 1px 4px rgba(0,200,83,0.20)",
    avatar: { bg: "linear-gradient(140deg,#00C853,#00A040)", shadow: "0 3px 12px rgba(0,200,83,0.32)" },
    decorIcon: GraduationCap,
  },
  // Orange
  {
    hero: "linear-gradient(135deg, rgba(255,136,0,0.18) 0%, rgba(255,136,0,0.05) 100%)",
    heroBdr: "rgba(255,136,0,0.20)",
    accent: "#CC6A00",
    accentSolid: "#FF8800",
    iconBoxBg: "rgba(255,136,0,0.18)",
    iconBoxBdr: "rgba(255,136,0,0.34)",
    pillBg: "rgba(255,136,0,0.18)",
    pillBdr: "rgba(255,136,0,0.34)",
    chipBg: "rgba(255,136,0,0.16)",
    chipBdr: "rgba(255,136,0,0.32)",
    btnGrad: "linear-gradient(135deg, #FF8800 0%, #E07000 100%)",
    btnShadow: "0 4px 18px rgba(255,136,0,0.34), 0 1px 4px rgba(255,136,0,0.20)",
    avatar: { bg: "linear-gradient(140deg,#FF8800,#E07000)", shadow: "0 3px 12px rgba(255,136,0,0.32)" },
    decorIcon: BookText,
  },
  // Blue
  {
    hero: "linear-gradient(135deg, rgba(0,85,255,0.14) 0%, rgba(0,85,255,0.04) 100%)",
    heroBdr: "rgba(0,85,255,0.20)",
    accent: "#0033AA",
    accentSolid: "#0055FF",
    iconBoxBg: "rgba(0,85,255,0.14)",
    iconBoxBdr: "rgba(0,85,255,0.28)",
    pillBg: "rgba(0,85,255,0.14)",
    pillBdr: "rgba(0,85,255,0.28)",
    chipBg: "rgba(0,85,255,0.12)",
    chipBdr: "rgba(0,85,255,0.26)",
    btnGrad: "linear-gradient(135deg, #0055FF 0%, #1166FF 100%)",
    btnShadow: "0 4px 18px rgba(0,85,255,0.34), 0 1px 4px rgba(0,85,255,0.20)",
    avatar: { bg: "linear-gradient(140deg,#0055FF,#1166FF)", shadow: "0 3px 12px rgba(0,85,255,0.32)" },
    decorIcon: Library,
  },
  // Rose
  {
    hero: "linear-gradient(135deg, rgba(255,51,85,0.16) 0%, rgba(255,51,85,0.05) 100%)",
    heroBdr: "rgba(255,51,85,0.20)",
    accent: "#CC2244",
    accentSolid: "#FF3355",
    iconBoxBg: "rgba(255,51,85,0.16)",
    iconBoxBdr: "rgba(255,51,85,0.32)",
    pillBg: "rgba(255,51,85,0.16)",
    pillBdr: "rgba(255,51,85,0.32)",
    chipBg: "rgba(255,51,85,0.14)",
    chipBdr: "rgba(255,51,85,0.30)",
    btnGrad: "linear-gradient(135deg, #FF3355 0%, #CC2244 100%)",
    btnShadow: "0 4px 18px rgba(255,51,85,0.34), 0 1px 4px rgba(255,51,85,0.20)",
    avatar: { bg: "linear-gradient(140deg,#FF3355,#CC2244)", shadow: "0 3px 12px rgba(255,51,85,0.32)" },
    decorIcon: BookMarked,
  },
];

const themeForSubject = (subject: string, idx: number): CardTheme => {
  if (subject && subject.trim()) {
    const h = subject.toLowerCase().split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return CARD_THEMES[h % CARD_THEMES.length];
  }
  return CARD_THEMES[idx % CARD_THEMES.length];
};

const BLUE_AVATARS = [
  { bg: "linear-gradient(140deg,#0044EE,#2277FF)", shadow: "0 3px 12px rgba(0,68,238,0.32)" },
  { bg: "linear-gradient(140deg,#002DBB,#0055FF)", shadow: "0 3px 12px rgba(0,45,187,0.32)" },
  { bg: "linear-gradient(140deg,#003399,#3388FF)", shadow: "0 3px 12px rgba(0,51,153,0.32)" },
  { bg: "linear-gradient(140deg,#0022AA,#2266EE)", shadow: "0 3px 12px rgba(0,34,170,0.32)" },
];

/* ════════════════════════════════════════════════════════════════════════
   Helper — convert Firestore-ish createdAt to ms epoch.
   Used in sort comparator + memo deps.
   ════════════════════════════════════════════════════════════════════════ */

const tsToMs = (v: RawEnrollment["createdAt"]): number => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return isNaN(t) ? 0 : t;
  }
  if (typeof v === "object") {
    if (typeof v.toMillis === "function") return v.toMillis();
    if (typeof v.seconds === "number") return v.seconds * 1000;
  }
  return 0;
};

const resolveSubjectFallback = (en: RawEnrollment): string =>
  en.subject || en.subjectName || en.Subject || en.name || en.title || en.courseName || en.course || "";

/* ════════════════════════════════════════════════════════════════════════
   Shared design tokens — pulled out so the page-level + extracted
   components reference the same palette without re-declaring per branch.
   ════════════════════════════════════════════════════════════════════════ */

const T_PALETTE = {
  B1: "#0055FF",
  B2: "#1166FF",
  BG: "#EEF4FF",
  BG2: "#E0ECFF",
  T1: "#001040",
  T3: "#5070B0",
  T4: "#99AACC",
  SEP: "rgba(0,85,255,0.07)",
  SH:    "0 0 0 0.5px rgba(0,85,255,0.08), 0 2px 8px rgba(0,85,255,0.10), 0 10px 28px rgba(0,85,255,0.12)",
  SH_LG: "0 0 0 0.5px rgba(0,85,255,0.10), 0 4px 16px rgba(0,85,255,0.12), 0 18px 44px rgba(0,85,255,0.15)",
  SH_BTN: "0 6px 22px rgba(0,85,255,0.42), 0 2px 6px rgba(0,85,255,0.24)",
};

/* ════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS — shared between mobile + desktop branches so the per-
   card markup lives in exactly one place. Avoids the ~250-line × 2
   duplication the file had before this round.
   ════════════════════════════════════════════════════════════════════════ */

const MetaTile = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => (
  <div
    className="flex items-center gap-[10px] px-[14px] py-[13px] rounded-[16px]"
    style={{ background: T_PALETTE.BG, border: "0.5px solid rgba(0,85,255,0.12)" }}
  >
    <div
      className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
      style={{ background: "rgba(0,85,255,0.10)", border: "0.5px solid rgba(0,85,255,0.18)" }}
    >
      {icon}
    </div>
    <div className="min-w-0">
      <div
        className="text-[9px] font-bold uppercase tracking-[0.08em] mb-[3px]"
        style={{ color: T_PALETTE.T4 }}
      >
        {label}
      </div>
      <div
        className="text-[13px] font-bold truncate"
        style={{ color: T_PALETTE.T1, letterSpacing: "-0.1px" }}
      >
        {value}
      </div>
    </div>
  </div>
);

const ErrorBanner = ({ message, onRetry, marginClass }: {
  message: string;
  onRetry: () => void;
  marginClass: string;
}) => (
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

const LoadingState = ({ isMobile }: { isMobile: boolean }) => (
  <div className={`flex flex-col items-center justify-center ${isMobile ? "py-24" : "py-40"} gap-4`}>
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center"
      style={{
        background: isMobile ? T_PALETTE.BG2 : "rgba(0,85,255,0.08)",
        border: `0.5px solid ${T_PALETTE.SEP}`,
      }}
    >
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: T_PALETTE.B1 }} />
    </div>
    <p
      className="text-xs font-semibold uppercase tracking-widest"
      style={{ color: T_PALETTE.T4 }}
    >
      Loading classes…
    </p>
  </div>
);

const EmptyState = ({ isMobile }: { isMobile: boolean }) => (
  <div
    className={
      isMobile
        ? "mx-5 mt-5 py-16 rounded-[26px] flex flex-col items-center text-center border-2 border-dashed"
        : "py-32 rounded-[26px] flex flex-col items-center text-center border-2 border-dashed"
    }
    style={{ borderColor: "rgba(0,85,255,0.22)" }}
  >
    <div
      className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
      style={{ background: isMobile ? T_PALETTE.BG2 : "rgba(0,85,255,0.08)" }}
    >
      <Target className="w-8 h-8" style={{ color: T_PALETTE.T4 }} />
    </div>
    <h3 className="text-base font-bold" style={{ color: T_PALETTE.T3 }}>
      No Classes Found
    </h3>
    <p className="text-sm mt-1" style={{ color: T_PALETTE.T4 }}>
      No subject enrollments yet.
    </p>
  </div>
);

interface ClassCardProps {
  en: EnrichedEnrollment;
  idx: number;
  isMobile: boolean;
  navigate: NavigateFunction;
  academicYear: string;
}

const ClassCard = ({ en, idx, isMobile, navigate, academicYear }: ClassCardProps) => {
  const subject = en.resolvedSubject;
  const theme = themeForSubject(subject, idx);
  const DecorIcon = theme.decorIcon;
  const avatar = theme.avatar;
  const className =
    en.className || en.classGroup || en.classSection || en.class || en.section || null;
  const rollNo = en.rollNo || "—";
  const year = en.academicYear || academicYear;

  const goNotes = () =>
    navigate("/teacher-notes", { state: { teacherId: en.teacherId } });

  const cardClass = isMobile
    ? "mx-5 mt-[14px] rounded-[26px] overflow-hidden bg-white cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/50"
    : "rounded-[26px] overflow-hidden bg-white flex flex-col cursor-pointer transition-all hover:-translate-y-1 hover:scale-[1.02] hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/50";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${subject || className || "class"} teacher notes`}
      onClick={goNotes}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goNotes();
        }
      }}
      className={cardClass}
      style={{ boxShadow: T_PALETTE.SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}
    >
      {/* Hero */}
      <div
        className={
          isMobile
            ? "relative overflow-hidden px-5 pt-5 pb-[22px]"
            : "relative overflow-hidden px-6 pt-6 pb-7"
        }
        style={{ background: theme.hero, borderBottom: `0.5px solid ${theme.heroBdr}` }}
      >
        {/* Decorative bottom-right icon */}
        <div
          className="absolute pointer-events-none"
          style={{ bottom: isMobile ? 12 : 14, right: isMobile ? 12 : 14 }}
        >
          <DecorIcon
            style={{
              width: isMobile ? 72 : 88,
              height: isMobile ? 72 : 88,
              color: theme.accentSolid,
              opacity: 0.20,
              strokeWidth: 1.6,
            }}
          />
        </div>

        {/* Header row — desktop puts icon-box + active pill side by side;
            mobile floats the pill top-right and stacks the icon-box below. */}
        {isMobile ? (
          <>
            <div
              className="absolute top-4 right-4 z-[2] flex items-center gap-[5px] px-[12px] py-[5px] rounded-full text-[10px] font-bold tracking-[0.06em]"
              style={{ background: theme.pillBg, border: `0.5px solid ${theme.pillBdr}`, color: theme.accent }}
            >
              <span
                className="w-[6px] h-[6px] rounded-full animate-pulse"
                style={{ background: theme.accentSolid, boxShadow: `0 0 0 2.5px ${theme.pillBg}` }}
              />
              Active
            </div>
            <div
              className="w-12 h-12 rounded-[16px] flex items-center justify-center mb-4 relative z-10"
              style={{ background: theme.iconBoxBg, border: `0.5px solid ${theme.iconBoxBdr}` }}
            >
              <BookOpen className="w-6 h-6" style={{ color: theme.accentSolid }} strokeWidth={2.1} />
            </div>
          </>
        ) : (
          <div className="flex items-start justify-between relative z-10 mb-4">
            <div
              className="w-12 h-12 rounded-[16px] flex items-center justify-center"
              style={{ background: theme.iconBoxBg, border: `0.5px solid ${theme.iconBoxBdr}` }}
            >
              <BookOpen className="w-6 h-6" style={{ color: theme.accentSolid }} strokeWidth={2.1} />
            </div>
            <div
              className="flex items-center gap-[5px] px-[13px] py-[5px] rounded-full text-[10px] font-bold tracking-[0.06em]"
              style={{ background: theme.pillBg, border: `0.5px solid ${theme.pillBdr}`, color: theme.accent }}
            >
              <span
                className="w-[6px] h-[6px] rounded-full animate-pulse"
                style={{ background: theme.accentSolid, boxShadow: `0 0 0 2.5px ${theme.pillBg}` }}
              />
              Active
            </div>
          </div>
        )}

        <div
          className="text-[9px] font-bold uppercase tracking-[0.12em] mb-[6px] relative z-10"
          style={{ color: T_PALETTE.T4 }}
        >
          {subject ? "Subject" : "Class"}
        </div>
        <h2
          className="font-bold mb-[14px] relative z-10 leading-[1.08]"
          style={{
            color: T_PALETTE.T1,
            letterSpacing: isMobile ? "-0.7px" : "-0.6px",
            fontSize: isMobile ? 28 : 26,
          }}
        >
          {subject || className || "Class"}
        </h2>

        {className && className !== subject ? (
          <div
            className="inline-flex items-center gap-[6px] px-[14px] py-[7px] rounded-full relative z-10 text-[12px] font-bold"
            style={{ background: theme.chipBg, border: `0.5px solid ${theme.chipBdr}`, color: theme.accent }}
          >
            <Layers className="w-3 h-3" style={{ color: theme.accentSolid }} strokeWidth={2.2} />
            {className}
          </div>
        ) : !subject && !className ? (
          <div
            className="inline-flex items-center gap-[6px] px-[14px] py-[7px] rounded-full relative z-10 text-[11px] font-medium"
            style={{ background: "rgba(0,0,0,0.04)", color: T_PALETTE.T3 }}
          >
            <Layers className="w-3 h-3" style={{ color: T_PALETTE.T4 }} />
            Class not assigned
          </div>
        ) : null}
      </div>

      {/* Body */}
      <div className={isMobile ? "p-5" : "p-5 flex flex-col flex-1"}>
        {/* Teacher row */}
        <div
          className="flex items-center gap-[13px] px-4 py-[14px] rounded-[18px] mb-[14px]"
          style={{ background: T_PALETTE.BG, border: "0.5px solid rgba(0,85,255,0.12)" }}
        >
          <div
            className="w-11 h-11 rounded-[14px] flex items-center justify-center text-[15px] font-bold text-white shrink-0"
            style={{ background: avatar.bg, boxShadow: avatar.shadow }}
          >
            {en.initials}
          </div>
          <div>
            <div
              className="text-[9px] font-bold uppercase tracking-[0.09em] mb-[3px]"
              style={{ color: T_PALETTE.T4 }}
            >
              Teacher
            </div>
            <div
              className="text-[15px] font-bold"
              style={{ color: T_PALETTE.T1, letterSpacing: "-0.2px" }}
            >
              {en.teacherName}
            </div>
          </div>
        </div>

        {/* Meta tiles — Roll No + Year (real data, no fabricated Schedule) */}
        <div className="grid grid-cols-2 gap-[10px] mb-4">
          <MetaTile
            icon={<Hash className="w-[14px] h-[14px]" style={{ color: T_PALETTE.B1 }} strokeWidth={2.2} />}
            label="Roll No"
            value={rollNo}
          />
          <MetaTile
            icon={<School className="w-[14px] h-[14px]" style={{ color: T_PALETTE.B1 }} strokeWidth={2.2} />}
            label="Year"
            value={year}
          />
        </div>

        {/* Message button */}
        <div className={isMobile ? "" : "mt-auto"}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goNotes();
            }}
            className={
              isMobile
                ? "w-full rounded-[16px] px-[18px] py-[14px] flex items-center justify-between relative overflow-hidden active:scale-[0.97] transition-transform"
                : "w-full rounded-[16px] px-5 py-[14px] flex items-center justify-between relative overflow-hidden transition-transform hover:scale-[1.01]"
            }
            style={{ background: theme.btnGrad, boxShadow: theme.btnShadow }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 52%)",
              }}
            />
            <div className="flex items-center gap-[10px] relative z-10">
              <MessageSquare className="w-[17px] h-[17px] text-white" strokeWidth={2.2} />
              <span
                className="text-[14px] font-bold text-white"
                style={{ letterSpacing: "-0.1px" }}
              >
                Message Teacher
              </span>
            </div>
            <div
              className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center relative z-10"
              style={{
                background: "rgba(255,255,255,0.18)",
                border: "0.5px solid rgba(255,255,255,0.26)",
              }}
            >
              <ChevronRight
                className="w-[13px] h-[13px]"
                style={{ color: "rgba(255,255,255,0.85)" }}
                strokeWidth={2.5}
              />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

interface EnrolmentSummaryProps {
  count: number;
  teacherCount: number;
  isMobile: boolean;
  navigate: NavigateFunction;
  className?: string;
}

const EnrolmentSummaryCard = ({ count, teacherCount, isMobile, navigate, className = "" }: EnrolmentSummaryProps) => (
  <div
    role="button"
    tabIndex={0}
    aria-label="Open my child profile"
    onClick={() => navigate("/my-child")}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        navigate("/my-child");
      }
    }}
    className={
      isMobile
        ? `${className} mx-5 mt-[14px] rounded-[24px] p-[22px] relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50`
        : `${className} rounded-[24px] p-7 relative overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:scale-[1.02] hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50`
    }
    style={{
      background: "linear-gradient(140deg, #001888 0%, #0033CC 48%, #0055FF 100%)",
      boxShadow: "0 10px 36px rgba(0,51,204,0.38), 0 0 0 0.5px rgba(255,255,255,0.16)",
      border: "0.5px solid rgba(255,255,255,0.16)",
    }}
  >
    <div
      className={
        isMobile
          ? "absolute -top-[42px] -right-[30px] w-[200px] h-[200px] rounded-full pointer-events-none"
          : "absolute -top-[42px] -right-[30px] w-[240px] h-[240px] rounded-full pointer-events-none"
      }
      style={{ background: "radial-gradient(circle, rgba(255,255,255,0.16) 0%, transparent 65%)" }}
    />
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    />

    <div className={`flex items-center gap-[13px] ${isMobile ? "mb-5" : "mb-6"} relative z-10`}>
      <div
        className={
          isMobile
            ? "w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0"
            : "w-14 h-14 rounded-[18px] flex items-center justify-center shrink-0"
        }
        style={{ background: "rgba(255,255,255,0.18)", border: "0.5px solid rgba(255,255,255,0.28)" }}
      >
        <ShieldCheck className={isMobile ? "w-6 h-6 text-white" : "w-7 h-7 text-white"} strokeWidth={2.2} />
      </div>
      <div>
        <div
          className={isMobile ? "text-[9px] font-bold uppercase tracking-[0.12em] mb-1" : "text-[10px] font-bold uppercase tracking-[0.12em] mb-1"}
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          Enrolment Summary
        </div>
        <div
          className={isMobile ? "text-[17px] font-bold text-white" : "text-[20px] font-bold text-white"}
          style={{ letterSpacing: isMobile ? "-0.3px" : "-0.4px" }}
        >
          {count} {count === 1 ? "subject" : "subjects"} active
        </div>
      </div>
    </div>

    <div
      className="grid grid-cols-2 rounded-[18px] overflow-hidden relative z-10"
      style={{ gap: "1px", background: "rgba(255,255,255,0.14)" }}
    >
      <div
        className={isMobile ? "py-[18px] flex flex-col items-center gap-[5px]" : "py-5 flex flex-col items-center gap-[5px]"}
        style={{ background: "rgba(255,255,255,0.09)" }}
      >
        <div
          className="font-bold text-white leading-none"
          style={{ fontSize: isMobile ? 34 : 42, letterSpacing: isMobile ? "-1.5px" : "-2px" }}
        >
          {count}
        </div>
        <div
          className={isMobile ? "text-[9px] font-bold uppercase tracking-[0.10em]" : "text-[10px] font-bold uppercase tracking-[0.10em]"}
          style={{ color: "rgba(255,255,255,0.42)" }}
        >
          Subjects
        </div>
      </div>
      <div
        className={isMobile ? "py-[18px] flex flex-col items-center gap-[5px]" : "py-5 flex flex-col items-center gap-[5px]"}
        style={{ background: "rgba(255,255,255,0.09)" }}
      >
        <div
          className="font-bold text-white leading-none"
          style={{ fontSize: isMobile ? 34 : 42, letterSpacing: isMobile ? "-1.5px" : "-2px" }}
        >
          {teacherCount}
        </div>
        <div
          className={isMobile ? "text-[9px] font-bold uppercase tracking-[0.10em]" : "text-[10px] font-bold uppercase tracking-[0.10em]"}
          style={{ color: "rgba(255,255,255,0.42)" }}
        >
          Teachers
        </div>
      </div>
    </div>
  </div>
);

interface SubjectsListSectionProps {
  enrollments: EnrichedEnrollment[];
  isMobile: boolean;
  navigate: NavigateFunction;
  className?: string;
}

const SubjectsListSection = ({ enrollments, isMobile, navigate, className = "" }: SubjectsListSectionProps) => (
  <div
    className={
      isMobile
        ? `${className} mx-5 mt-[14px] bg-white rounded-[22px] overflow-hidden`
        : `${className} bg-white rounded-[22px] overflow-hidden`
    }
    style={{ boxShadow: T_PALETTE.SH, border: "0.5px solid rgba(0,85,255,0.12)" }}
  >
    <div
      className={
        isMobile
          ? "flex items-center justify-between px-[18px] pt-4 pb-3"
          : "flex items-center justify-between px-6 py-4"
      }
      style={{ borderBottom: `0.5px solid ${T_PALETTE.SEP}` }}
    >
      <div
        className={isMobile ? "text-[16px] font-bold" : "text-[17px] font-bold"}
        style={{ color: T_PALETTE.T1, letterSpacing: "-0.3px" }}
      >
        Enrolled Subjects
      </div>
      <div
        className={isMobile ? "px-[11px] py-[4px] rounded-full text-[11px] font-bold" : "px-3 py-[4px] rounded-full text-[11px] font-bold"}
        style={{
          background: "rgba(0,85,255,0.10)",
          border: "0.5px solid rgba(0,85,255,0.18)",
          color: T_PALETTE.B1,
        }}
      >
        {enrollments.length} Active
      </div>
    </div>
    {enrollments.map((en, idx, arr) => (
      <SubjectListItem
        key={en.id}
        en={en}
        idx={idx}
        isMobile={isMobile}
        isLast={idx === arr.length - 1}
        navigate={navigate}
      />
    ))}
  </div>
);

interface SubjectListItemProps {
  en: EnrichedEnrollment;
  idx: number;
  isMobile: boolean;
  isLast: boolean;
  navigate: NavigateFunction;
}

const SubjectListItem = ({ en, idx, isMobile, isLast, navigate }: SubjectListItemProps) => {
  const subject = en.resolvedSubject;
  const avatar = BLUE_AVATARS[idx % BLUE_AVATARS.length];
  const goNotes = () => navigate("/teacher-notes", { state: { teacherId: en.teacherId } });
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${subject || en.className || "class"} teacher notes`}
      className={
        isMobile
          ? "flex items-center gap-[13px] px-[18px] py-[14px] cursor-pointer active:bg-[#EEF4FF] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0055FF]/40"
          : "flex items-center gap-[13px] px-6 py-4 cursor-pointer transition-colors hover:bg-[#F5F9FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0055FF]/40"
      }
      style={{ borderBottom: isLast ? "none" : `0.5px solid ${T_PALETTE.SEP}` }}
      onClick={goNotes}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goNotes();
        }
      }}
    >
      <div
        className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0"
        style={{ background: avatar.bg, boxShadow: avatar.shadow }}
      >
        <BookOpen className="w-5 h-5 text-white" strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-[14px] font-bold truncate"
          style={{ color: T_PALETTE.T1, letterSpacing: "-0.2px" }}
        >
          {subject || en.className || "Class"}
        </div>
        <div className="text-[11px] mt-0.5 truncate" style={{ color: T_PALETTE.T3 }}>
          {en.teacherName}
          {en.className && subject ? ` · ${en.className}` : ""}
        </div>
      </div>
      <div
        className={
          isMobile
            ? "px-[11px] py-1 rounded-full text-[10px] font-bold shrink-0"
            : "px-3 py-[5px] rounded-full text-[10px] font-bold shrink-0"
        }
        style={{
          background: "rgba(0,85,255,0.10)",
          color: "#0033AA",
          border: "0.5px solid rgba(0,85,255,0.22)",
        }}
      >
        Active
      </div>
      {!isMobile && (
        <ChevronRight
          className="w-[14px] h-[14px] shrink-0"
          style={{ color: T_PALETTE.T4 }}
          strokeWidth={2.3}
        />
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════════════════════════════════ */

const ClassesPage = () => {
  const { studentData } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const settings = useSchoolSettings();
  const academicYear = resolveAcademicYear(settings);

  const [enrollments, setEnrollments] = useState<EnrichedEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!studentData?.id || !studentData?.schoolId) {
      setLoading(false);
      return;
    }
    setListenerError(null);

    // ── Local listener-scoped state ───────────────────────────────────────
    let rawEnrollments: RawEnrollment[] = [];
    let taByKey = new Map<string, string>();
    const teacherNameCache = new Map<string, string>();
    let unsubTA: (() => void) | null = null;
    let lastClassKey = "";    // dedup TA resubscribe across enrollment ticks
    let callSeq = 0;          // race-guard sentinel for async recompute()
    let cancelled = false;

    /** recompute() — runs whenever either listener fires. Async due to
     *  teacher-name backfill. Multiple in-flight calls can race; the
     *  callSeq sentinel ensures only the latest writes to React state. */
    const recompute = async () => {
      const mySeq = ++callSeq;

      // Teacher-name backfill — usually a no-op because writer stamps
      // teacherName at create time. Only legacy enrollments need a lookup.
      const need = rawEnrollments
        .filter(e => e.teacherId && !e.teacherName && !teacherNameCache.has(e.teacherId))
        .map(e => e.teacherId as string);
      const uniqMissing = Array.from(new Set(need));
      if (uniqMissing.length > 0) {
        await Promise.all(uniqMissing.map(async (tid) => {
          try {
            const snap = await fbGetDoc(fbDoc(db, "teachers", tid));
            teacherNameCache.set(
              tid,
              snap.exists() ? (((snap.data() as { name?: string })?.name) || "") : "",
            );
          } catch (err) {
            teacherNameCache.set(tid, "");
            console.error("[Classes] teacher backfill failed:", err);
          }
        }));
      }
      // Bail if effect was cancelled OR a fresher recompute is in-flight.
      if (cancelled || mySeq !== callSeq) return;

      const enriched: EnrichedEnrollment[] = rawEnrollments.map((en) => {
        const cachedName = en.teacherId ? teacherNameCache.get(en.teacherId) : undefined;
        const teacherName =
          (en.teacherName && en.teacherName.trim()) || cachedName || "";
        const taKey = en.teacherId && en.classId ? `${en.teacherId}__${en.classId}` : "";
        const resolvedSubject =
          (taKey && taByKey.get(taKey)) || resolveSubjectFallback(en) || "";
        const initials = teacherName
          ? teacherName.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2)
          : "—";
        return {
          ...en,
          teacherName: teacherName || "Teacher unassigned",
          initials,
          resolvedSubject,
        };
      });

      // Deterministic order: subject ASC → className ASC → createdAt DESC.
      enriched.sort((a, b) => {
        const sa = a.resolvedSubject.toLowerCase();
        const sb = b.resolvedSubject.toLowerCase();
        if (sa && sb && sa !== sb) return sa.localeCompare(sb);
        if (sa && !sb) return -1;
        if (!sa && sb) return 1;
        const ca = String(a.className || "").toLowerCase();
        const cb = String(b.className || "").toLowerCase();
        if (ca !== cb) return ca.localeCompare(cb);
        return tsToMs(b.createdAt) - tsToMs(a.createdAt);
      });

      setEnrollments(enriched);
      setLoading(false);
    };

    /** Subscribe TA listener — only when classIds actually change. Without
     *  this guard, every enrollments tick (e.g. principal touching an
     *  unrelated field) tears down + resubscribes the TA listener and
     *  burns a Firestore initial-snapshot fetch every time. */
    const setupTeachingAssignments = (classIds: string[]) => {
      const key = classIds.slice().sort().join("|");
      if (key === lastClassKey) return;
      lastClassKey = key;

      if (unsubTA) { unsubTA(); unsubTA = null; }
      if (classIds.length === 0) {
        taByKey = new Map();
        recompute();
        return;
      }
      const limited = classIds.slice(0, 30); // Firestore `in` 30-value cap
      unsubTA = onSnapshot(
        scopedQuery("teaching_assignments", studentData.schoolId, where("classId", "in", limited)),
        (snap) => {
          if (cancelled) return;
          const next = new Map<string, string>();
          snap.docs.forEach(d => {
            const ta = d.data() as RawTeachingAssignment;
            if (!ta?.teacherId || !ta?.classId) return;
            const k = `${ta.teacherId}__${ta.classId}`;
            const isActive = String(ta.status || "active").toLowerCase() === "active";
            if (!next.has(k) || isActive) {
              next.set(k, String(ta.subjectName || ta.subject || "").trim());
            }
          });
          taByKey = next;
          recompute();
        },
        (err) => {
          if (cancelled) return;
          console.error("[Classes] teaching_assignments listener error:", err);
          // Honest degradation: surface the failure so the parent knows
          // the subject column may show class names + can Retry.
          setListenerError("Subject info couldn't load. Cards may show class names instead.");
          recompute();
        },
      );
    };

    // ── Enrollments listener (dual-key: id + email merge per memory) ──────
    const unsubEnroll = subscribeEnrollments(
      studentData,
      (docs) => {
        if (cancelled) return;
        rawEnrollments = docs.map(d => ({
          id: d.id,
          ...(d.data() as Omit<RawEnrollment, "id">),
        }));
        const classIds = Array.from(
          new Set(rawEnrollments.map(e => e.classId).filter((id): id is string => !!id)),
        );
        setupTeachingAssignments(classIds);
        recompute();
      },
      (err) => {
        if (cancelled) return;
        console.error("[Classes] enrollments listener error:", err);
        setListenerError(err.message || "Failed to load classes. Retry?");
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
      unsubEnroll();
      if (unsubTA) unsubTA();
    };
  }, [studentData, refreshKey]);

  const childFirstName = useMemo(() => {
    const n = studentData?.name?.trim() || studentData?.studentName?.trim() || "";
    return n.split(" ")[0] || "your child";
  }, [studentData?.name, studentData?.studentName]);

  const uniqueTeacherCount = useMemo(
    () => new Set(enrollments.map(e => e.teacherId).filter(Boolean)).size,
    [enrollments],
  );

  /* ── MOBILE branch — vertical stack ─────────────────────────────────── */
  if (isMobile) {
    return (
      <div
        className="animate-in fade-in duration-500 -mx-3 -mt-3"
        style={{
          fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
          background: T_PALETTE.BG,
          minHeight: "100vh",
        }}
      >
        {/* Page head */}
        <div className="px-[22px] pt-[18px] pb-0">
          <div
            className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1"
            style={{ color: T_PALETTE.T4 }}
          >
            Parent Dashboard
          </div>
          <h1
            className="text-[28px] font-bold leading-[1.12]"
            style={{ color: T_PALETTE.T1, letterSpacing: "-0.7px" }}
          >
            My Classes
          </h1>
          <p className="text-[13px] mt-1 font-normal" style={{ color: T_PALETTE.T3 }}>
            Enrolled subjects for {childFirstName}
          </p>
        </div>

        {listenerError && (
          <ErrorBanner
            message={listenerError}
            onRetry={() => setRefreshKey(k => k + 1)}
            marginClass="mx-5 mt-3"
          />
        )}

        {/* Top Message CTA */}
        <button
          onClick={() => navigate("/teacher-notes")}
          className="w-[calc(100%-40px)] mx-5 mt-[18px] rounded-[20px] px-5 py-[17px] flex items-center justify-between relative overflow-hidden active:scale-[0.97] transition-transform"
          style={{
            background: `linear-gradient(135deg, ${T_PALETTE.B1} 0%, ${T_PALETTE.B2} 100%)`,
            boxShadow: T_PALETTE.SH_BTN,
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, transparent 52%)",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="flex items-center gap-3 relative z-10">
            <div
              className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0"
              style={{
                background: "rgba(255,255,255,0.20)",
                border: "0.5px solid rgba(255,255,255,0.30)",
              }}
            >
              <MessageSquare
                className="w-[22px] h-[22px]"
                style={{ color: "rgba(255,255,255,0.95)" }}
                strokeWidth={2.2}
              />
            </div>
            <div className="text-left">
              <div
                className="text-[16px] font-bold text-white"
                style={{ letterSpacing: "-0.2px" }}
              >
                Message Teacher
              </div>
              <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                Send a direct message to faculty
              </div>
            </div>
          </div>
          <div
            className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0 relative z-10"
            style={{
              background: "rgba(255,255,255,0.18)",
              border: "0.5px solid rgba(255,255,255,0.26)",
            }}
          >
            <ChevronRight
              className="w-[14px] h-[14px]"
              style={{ color: "rgba(255,255,255,0.90)" }}
              strokeWidth={2.5}
            />
          </div>
        </button>

        {loading ? (
          <LoadingState isMobile />
        ) : enrollments.length === 0 ? (
          <EmptyState isMobile />
        ) : (
          <>
            {enrollments.map((en, idx) => (
              <ClassCard
                key={en.id}
                en={en}
                idx={idx}
                isMobile
                navigate={navigate}
                academicYear={academicYear}
              />
            ))}

            <EnrolmentSummaryCard
              count={enrollments.length}
              teacherCount={uniqueTeacherCount}
              isMobile
              navigate={navigate}
            />

            <div
              className="px-[22px] pt-5 text-[9px] font-bold uppercase tracking-[0.10em] flex items-center gap-2"
              style={{ color: T_PALETTE.T4 }}
            >
              <span>All Subjects</span>
              <span className="flex-1 h-px" style={{ background: "rgba(0,85,255,0.14)" }} />
            </div>

            <SubjectsListSection
              enrollments={enrollments}
              isMobile
              navigate={navigate}
            />
          </>
        )}

        <div className="h-6" />
      </div>
    );
  }

  /* ── DESKTOP branch — grid + 2:3 bottom row ───────────────────────────── */
  return (
    <div
      className="animate-in fade-in duration-500 -m-4 sm:-m-6 md:-m-8 min-h-[calc(100vh-64px)]"
      style={{
        fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        background: T_PALETTE.BG,
      }}
    >
      <div className="w-full px-6 pt-8 pb-12">
        {/* Toolbar */}
        <div className="flex items-start justify-between gap-6 flex-wrap mb-8">
          <div>
            <div
              className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2"
              style={{ color: T_PALETTE.T4 }}
            >
              Parent Dashboard
            </div>
            <h1
              className="text-[38px] font-bold leading-[1.05]"
              style={{ color: T_PALETTE.T1, letterSpacing: "-1.1px" }}
            >
              My Classes
            </h1>
            <p className="text-[14px] mt-2 font-normal" style={{ color: T_PALETTE.T3 }}>
              Enrolled subjects for{" "}
              <span style={{ color: T_PALETTE.T1, fontWeight: 700 }}>
                {studentData?.name || childFirstName}
              </span>
            </p>
          </div>
          <button
            onClick={() => navigate("/teacher-notes")}
            className="h-12 px-5 rounded-[14px] flex items-center gap-3 text-white relative overflow-hidden transition-transform hover:scale-[1.02]"
            style={{
              background: `linear-gradient(135deg, ${T_PALETTE.B1} 0%, ${T_PALETTE.B2} 100%)`,
              boxShadow: T_PALETTE.SH_BTN,
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 52%)",
              }}
            />
            <MessageSquare className="w-[18px] h-[18px] relative z-10" strokeWidth={2.2} />
            <span className="text-[14px] font-bold relative z-10">Message Teacher</span>
            <div
              className="w-8 h-8 rounded-[10px] flex items-center justify-center relative z-10"
              style={{
                background: "rgba(255,255,255,0.18)",
                border: "0.5px solid rgba(255,255,255,0.26)",
              }}
            >
              <ChevronRight className="w-[13px] h-[13px]" strokeWidth={2.5} />
            </div>
          </button>
        </div>

        {listenerError && (
          <ErrorBanner
            message={listenerError}
            onRetry={() => setRefreshKey(k => k + 1)}
            marginClass="mb-5"
          />
        )}

        {loading ? (
          <LoadingState isMobile={false} />
        ) : enrollments.length === 0 ? (
          <EmptyState isMobile={false} />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {enrollments.map((en, idx) => (
                <ClassCard
                  key={en.id}
                  en={en}
                  idx={idx}
                  isMobile={false}
                  navigate={navigate}
                  academicYear={academicYear}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mt-5">
              <EnrolmentSummaryCard
                count={enrollments.length}
                teacherCount={uniqueTeacherCount}
                isMobile={false}
                navigate={navigate}
                className="lg:col-span-2"
              />
              <SubjectsListSection
                enrollments={enrollments}
                isMobile={false}
                navigate={navigate}
                className="lg:col-span-3"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClassesPage;
