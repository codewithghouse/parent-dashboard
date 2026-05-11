import {
  ArrowLeft, BookOpen, PlayCircle, Star, User, FileText,
  Calculator, FlaskConical, Globe, Monitor, Palette, Languages,
  ChevronRight, Quote,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { openSafeExternalUrl } from "@/lib/safeExternalUrl";
import { useIsMobile } from "@/hooks/use-mobile";

/* ════════════════════════════════════════════════════════════════════════
   SubjectPerformanceDetail
   ─────────────────────────────────────────────────────────────────────────
   Inner detail view rendered when a parent clicks any subject card on
   /performance. Previously used a generic slate palette + dev-leftover
   copy ("Result of click: ..."); rewritten 2026-05-11 to match the
   Blue Apple theme that the rest of parent-dashboard uses, with honest
   empty states and a real back-button affordance.
   ════════════════════════════════════════════════════════════════════════ */

interface Topic { name: string; score: number; }
interface TestScore { name: string; date: string; score: string; status: "success" | "warning" | "error"; }
interface Resource { icon: string; title: string; subtitle: string; action: string; color: string; url: string; }

interface Props {
  subject: string;
  teacher: string;
  grade: string;
  average: number;
  topics: Topic[];
  testScores: TestScore[];
  feedback: string;
  resources: Resource[];
  onBack: () => void;
}

const getSubjectIcon = (
  name: string,
): ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }> => {
  const n = name.toLowerCase();
  if (n.includes("math")) return Calculator;
  if (n.includes("science")) return FlaskConical;
  if (n.includes("english")) return Languages;
  if (n.includes("social")) return Globe;
  if (n.includes("computer")) return Monitor;
  if (n.includes("art")) return Palette;
  return BookOpen;
};

/* ── Design tokens (mirrors /performance + /classes Blue Apple palette) ─ */

const T = {
  B1: "#0055FF", B2: "#1166FF", B3: "#2277FF", B4: "#4499FF",
  BG: "#EEF4FF", BG2: "#E0ECFF",
  T1: "#001040", T2: "#002080", T3: "#5070B0", T4: "#99AACC",
  SEP: "rgba(0,85,255,0.07)",
  GREEN: "#00C853", GREEN_S: "rgba(0,200,83,0.12)", GREEN_B: "rgba(0,200,83,0.25)", GREEN_DEEP: "#007830",
  RED: "#FF3355",
  ORANGE: "#FF8800",
  SH:    "0 0 0 0.5px rgba(0,85,255,0.08), 0 2px 8px rgba(0,85,255,0.09), 0 10px 28px rgba(0,85,255,0.11)",
  SH_LG: "0 0 0 0.5px rgba(0,85,255,0.10), 0 4px 16px rgba(0,85,255,0.12), 0 20px 48px rgba(0,85,255,0.14)",
};

/** Grade/percentage → Blue Apple tone (no emerald/amber/rose generic). */
const toneForScore = (pct: number): { color: string; bg: string; bdr: string } => {
  if (pct >= 75) return { color: T.GREEN_DEEP, bg: T.GREEN_S, bdr: T.GREEN_B };
  if (pct >= 60) return { color: "#AA5500", bg: "rgba(255,136,0,0.10)", bdr: "rgba(255,136,0,0.25)" };
  return { color: "#AA2233", bg: "rgba(255,51,85,0.08)", bdr: "rgba(255,51,85,0.22)" };
};

const fillForScore = (pct: number): string => {
  if (pct >= 75) return `linear-gradient(90deg, ${T.B1}, ${T.B4})`;
  if (pct >= 60) return `linear-gradient(90deg, ${T.ORANGE}, #FFAA33)`;
  return `linear-gradient(90deg, ${T.RED}, #FF6688)`;
};

/* ── Sub-components ────────────────────────────────────────────────────── */

const Card = ({ children, isMobile }: { children: ReactNode; isMobile: boolean }) => (
  <div
    className={isMobile ? "bg-white rounded-[22px] p-5" : "bg-white rounded-[24px] p-6"}
    style={{ boxShadow: T.SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}
  >
    {children}
  </div>
);

const SectionHeading = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mb-4">
    <div className="text-[16px] font-bold" style={{ color: T.T1, letterSpacing: "-0.3px" }}>
      {title}
    </div>
    {subtitle && (
      <div className="text-[11px] mt-0.5" style={{ color: T.T3 }}>
        {subtitle}
      </div>
    )}
  </div>
);

const EmptyHint = ({ children }: { children: ReactNode }) => (
  <div
    className="text-[12px] py-6 text-center rounded-[14px]"
    style={{ color: T.T4, background: T.BG, border: `0.5px dashed rgba(0,85,255,0.16)` }}
  >
    {children}
  </div>
);

/* ── Component ─────────────────────────────────────────────────────────── */

export const SubjectPerformanceDetail = ({
  subject, teacher, grade, average, topics, testScores, feedback, resources, onBack,
}: Props) => {
  const isMobile = useIsMobile();
  const Icon = getSubjectIcon(subject);
  const gradeTone = toneForScore(average);
  const hasTeacher = teacher && teacher !== "—" && teacher.trim().length > 0;
  const hasResources = resources.length > 0;
  const hasTopics = topics.length > 0;
  const hasTests = testScores.length > 0;

  return (
    <div
      className={isMobile ? "animate-in fade-in duration-500 -mx-3 -mt-3 pb-20" : "animate-in fade-in duration-500 -m-4 sm:-m-6 md:-m-8 min-h-[calc(100vh-64px)]"}
      style={{
        fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        background: T.BG,
      }}
    >
      <div className={isMobile ? "px-5 pt-[18px]" : "w-full px-6 pt-8 pb-12"}>

        {/* ── Back row ─────────────────────────────────────────────────── */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 mb-4 px-3 py-1.5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
          style={{
            background: "white",
            border: "0.5px solid rgba(0,85,255,0.10)",
            color: T.T3,
            boxShadow: T.SH,
          }}
        >
          <ArrowLeft className="w-[14px] h-[14px]" strokeWidth={2.4} />
          <span className="text-[12px] font-bold tracking-[-0.1px]" style={{ color: T.T2 }}>
            Performance
          </span>
        </button>

        {/* ── Subject Hero Card ────────────────────────────────────────── */}
        <div
          className={isMobile ? "bg-white rounded-[22px] p-5 mb-4 relative overflow-hidden" : "bg-white rounded-[24px] p-7 mb-5 relative overflow-hidden"}
          style={{ boxShadow: T.SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}
        >
          {/* soft Blue Apple bloom in top-right */}
          <div
            className={isMobile ? "absolute -top-[40px] -right-[30px] w-[180px] h-[180px] rounded-full pointer-events-none" : "absolute -top-[50px] -right-[30px] w-[220px] h-[220px] rounded-full pointer-events-none"}
            style={{ background: "radial-gradient(circle, rgba(0,85,255,0.08) 0%, transparent 70%)" }}
          />

          <div className={isMobile ? "flex flex-col gap-5 relative z-10" : "flex flex-row items-center justify-between gap-6 flex-wrap relative z-10"}>
            <div className="flex items-center gap-4">
              <div
                className={isMobile ? "w-14 h-14 rounded-[16px] flex items-center justify-center shrink-0" : "w-16 h-16 rounded-[18px] flex items-center justify-center shrink-0"}
                style={{
                  background: `linear-gradient(135deg, ${T.B1}, ${T.B3})`,
                  boxShadow: "0 4px 14px rgba(0,85,255,0.32)",
                }}
              >
                <Icon className={isMobile ? "w-7 h-7 text-white" : "w-8 h-8 text-white"} strokeWidth={2.1} />
              </div>
              <div>
                <h1
                  className={isMobile ? "text-[22px] font-bold leading-[1.1]" : "text-[26px] font-bold leading-[1.08]"}
                  style={{ color: T.T1, letterSpacing: "-0.5px" }}
                >
                  {subject}
                </h1>
                <p className={isMobile ? "text-[12px] mt-1" : "text-[13px] mt-1"} style={{ color: T.T3 }}>
                  {hasTeacher ? `Teacher · ${teacher}` : "Teacher not assigned"}
                </p>
              </div>
            </div>

            <div className={isMobile ? "grid grid-cols-2 gap-3 mt-1" : "grid grid-cols-2 gap-4"}>
              <div
                className={isMobile ? "flex flex-col items-center gap-1 py-[14px] rounded-[16px]" : "flex flex-col items-center gap-[6px] px-7 py-4 rounded-[18px] min-w-[140px]"}
                style={{ background: T.BG, border: "0.5px solid rgba(0,85,255,0.10)" }}
              >
                <div
                  className={isMobile ? "text-[22px] font-bold" : "text-[32px] font-bold"}
                  style={{ color: gradeTone.color, letterSpacing: isMobile ? "-0.5px" : "-0.8px" }}
                >
                  {grade}
                </div>
                <div
                  className={isMobile ? "text-[9px] font-bold uppercase tracking-[0.09em]" : "text-[10px] font-bold uppercase tracking-[0.10em]"}
                  style={{ color: T.T4 }}
                >
                  Current Grade
                </div>
              </div>
              <div
                className={isMobile ? "flex flex-col items-center gap-1 py-[14px] rounded-[16px]" : "flex flex-col items-center gap-[6px] px-7 py-4 rounded-[18px] min-w-[140px]"}
                style={{ background: T.BG, border: "0.5px solid rgba(0,85,255,0.10)" }}
              >
                <div
                  className={isMobile ? "text-[22px] font-bold" : "text-[32px] font-bold"}
                  style={{ color: T.T1, letterSpacing: isMobile ? "-0.5px" : "-0.8px" }}
                >
                  {average}%
                </div>
                <div
                  className={isMobile ? "text-[9px] font-bold uppercase tracking-[0.09em]" : "text-[10px] font-bold uppercase tracking-[0.10em]"}
                  style={{ color: T.T4 }}
                >
                  Average
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Topic Performance + Recent Test Scores ───────────────────── */}
        <div className={isMobile ? "flex flex-col gap-4" : "grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5"}>

          {/* Topic Performance */}
          <Card isMobile={isMobile}>
            <SectionHeading
              title="Topic Performance"
              subtitle="Per-topic averages from recorded scores"
            />
            {!hasTopics ? (
              <EmptyHint>
                Topic-level scoring isn't tracked for this subject yet. Once teachers tag scores by topic, breakdowns will appear here.
              </EmptyHint>
            ) : (
              <div className="space-y-3.5">
                {topics.map((topic) => {
                  const tone = toneForScore(topic.score);
                  return (
                    <div key={topic.name}>
                      <div className="flex justify-between items-center mb-[6px]">
                        <span className="text-[13px] font-medium" style={{ color: T.T2 }}>
                          {topic.name}
                        </span>
                        <span
                          className="text-[13px] font-bold"
                          style={{ color: tone.color, letterSpacing: "-0.1px" }}
                        >
                          {topic.score}%
                        </span>
                      </div>
                      <div
                        className="h-2 w-full rounded-[4px] overflow-hidden"
                        style={{ background: T.BG2 }}
                      >
                        <div
                          className="h-full rounded-[4px] transition-all duration-700"
                          style={{
                            width: `${Math.max(topic.score, 3)}%`,
                            background: fillForScore(topic.score),
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Recent Test Scores */}
          <Card isMobile={isMobile}>
            <SectionHeading
              title="Recent Test Scores"
              subtitle="Most recent first"
            />
            {!hasTests ? (
              <EmptyHint>
                No graded test scores yet for this subject.
              </EmptyHint>
            ) : (
              <div className={isMobile ? "space-y-2 max-h-[280px] overflow-y-auto -mr-2 pr-2" : "space-y-2.5 max-h-[300px] overflow-y-auto -mr-2 pr-2"}>
                {testScores.map((test, i) => {
                  const tone =
                    test.status === "success"
                      ? { color: T.GREEN_DEEP, bg: T.GREEN_S, bdr: T.GREEN_B }
                      : test.status === "warning"
                        ? { color: "#AA5500", bg: "rgba(255,136,0,0.10)", bdr: "rgba(255,136,0,0.25)" }
                        : { color: "#AA2233", bg: "rgba(255,51,85,0.08)", bdr: "rgba(255,51,85,0.22)" };
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between py-[10px] px-3 rounded-[14px]"
                      style={{
                        background: T.BG,
                        border: "0.5px solid rgba(0,85,255,0.10)",
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-[13px] font-bold truncate"
                          style={{ color: T.T1, letterSpacing: "-0.1px" }}
                        >
                          {test.name}
                        </p>
                        <p className="text-[11px] mt-[2px]" style={{ color: T.T4 }}>
                          {test.date}
                        </p>
                      </div>
                      <span
                        className="text-[11px] font-bold px-[10px] py-[5px] rounded-full ml-2 shrink-0 tabular-nums"
                        style={{
                          background: tone.bg,
                          color: tone.color,
                          border: `0.5px solid ${tone.bdr}`,
                        }}
                      >
                        {test.score}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ── Teacher Feedback (+ optional Suggested Resources) ────────── */}
        <div
          className={
            isMobile
              ? "flex flex-col gap-4 mt-4"
              : hasResources
                ? "grid grid-cols-1 lg:grid-cols-2 gap-5"
                : "max-w-[640px]"
          }
        >

          {/* Teacher Feedback */}
          <Card isMobile={isMobile}>
            <SectionHeading title="Teacher Feedback" />
            <div
              className="rounded-[16px] p-5 relative"
              style={{
                background: "linear-gradient(135deg, rgba(0,85,255,0.06) 0%, rgba(0,85,255,0.02) 100%)",
                border: "0.5px solid rgba(0,85,255,0.14)",
              }}
            >
              <Quote
                className="absolute top-3 left-3 w-5 h-5"
                style={{ color: "rgba(0,85,255,0.32)" }}
                strokeWidth={2.2}
              />
              <p
                className="text-[13px] leading-[1.7] pt-2 pl-5"
                style={{ color: T.T2, letterSpacing: "-0.05px" }}
              >
                {feedback}
              </p>
            </div>
            {hasTeacher && (
              <div className="flex items-center gap-3 mt-4">
                <div
                  className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${T.B1}, ${T.B2})`,
                    boxShadow: "0 3px 10px rgba(0,85,255,0.28)",
                  }}
                >
                  <User className="w-[18px] h-[18px] text-white" strokeWidth={2.2} />
                </div>
                <div>
                  <p
                    className="text-[13px] font-bold"
                    style={{ color: T.T1, letterSpacing: "-0.1px" }}
                  >
                    {teacher}
                  </p>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.08em] mt-[2px]"
                    style={{ color: T.T4 }}
                  >
                    Subject Teacher
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Suggested Resources — hidden entirely when empty (no fake card) */}
          {hasResources && (
            <Card isMobile={isMobile}>
              <SectionHeading title="Suggested Resources" />
              <div className="space-y-2.5">
                {resources.map((res, i) => {
                  const ResIcon =
                    res.icon === "FileText" ? FileText :
                    res.icon === "PlayCircle" ? PlayCircle : Star;
                  return (
                    <div
                      key={i}
                      role="button"
                      tabIndex={0}
                      onClick={() => res.url && res.url !== "#" && openSafeExternalUrl(res.url)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && res.url && res.url !== "#") {
                          e.preventDefault();
                          openSafeExternalUrl(res.url);
                        }
                      }}
                      className="flex items-center gap-3 p-3 rounded-[14px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40 group"
                      style={{
                        background: T.BG,
                        border: "0.5px solid rgba(0,85,255,0.10)",
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${T.B1}, ${T.B3})`,
                          boxShadow: "0 3px 10px rgba(0,85,255,0.28)",
                        }}
                      >
                        <ResIcon className="w-[18px] h-[18px] text-white" strokeWidth={2.2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[13px] font-bold truncate"
                          style={{ color: T.T1, letterSpacing: "-0.1px" }}
                        >
                          {res.title}
                        </p>
                        <p className="text-[11px] truncate mt-[2px]" style={{ color: T.T3 }}>
                          {res.subtitle}
                        </p>
                      </div>
                      <ChevronRight
                        className="w-[14px] h-[14px] shrink-0 group-hover:translate-x-0.5 transition-transform"
                        style={{ color: T.B1 }}
                        strokeWidth={2.4}
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
