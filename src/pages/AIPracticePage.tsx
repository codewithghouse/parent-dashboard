import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Loader2, Upload, Plus, Sparkles, Bell, FileText, Image as ImageIcon, MessageSquare, HardDrive, ChevronLeft, ChevronRight, BarChart3, Clock, CheckCircle2, XCircle, Lightbulb, RefreshCw, Award, X } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { ParentAIController } from "../ai/controller/ai-controller";
import { db } from "../lib/firebase";
import {
  collection, where, onSnapshot, addDoc, serverTimestamp,
} from "firebase/firestore";
import { scopedQuery } from "../lib/scopedQuery";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist";
// Self-host the PDF.js worker via Vite's `?url` import. Previously we pulled
// it from `unpkg.com` at runtime — when the CDN was slow/blocked/version-
// mismatched, PDF.js fell back to a "fake worker" that creates a `blob:` URL,
// which our CSP blocks (no `worker-src` directive). Bundling the worker
// locally eliminates the CDN dependency AND the blob fallback path.
//
// Vite produces a fingerprinted, same-origin asset URL — works under
// the strictest CSP without any extra directive.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite handles the `?url` query at build time.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: "#F5F6FA", white: "#fff", ink: "#0B1F3A", ink2: "#475569", ink3: "#94a3b8",
  bdr: "#e2e8f0", s1: "#f1f5f9", s2: "#e2e8f0",
  blue: "#3B5BDB", blBg: "#EDF2FF",
  pur: "#6741D9", plBg: "#F3F0FF", plBdr: "#D0BFFF",
  grn: "#16a34a", glBg: "#f0fdf4",
  red: "#dc2626", rlBg: "#fef2f2",
  amb: "#d97706", alBg: "#fffbeb",
  tea: "#0891b2", tlBg: "#ecfeff",
};

// ── Types ─────────────────────────────────────────────────────────────────────
type View = "home" | "upload" | "configure" | "exam" | "results";

interface Question {
  questionNo: number;
  type: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const Q_TYPES = [
  { id: "mcq", label: "MCQ" },
  { id: "fill_blank", label: "Fill Blanks" },
  { id: "true_false", label: "True / False" },
  { id: "short_answer", label: "Short Answer" },
  { id: "mix", label: "Mix" },
];
const Q_COUNTS = [5, 10, 15, 20];
const TIME_LIMITS = [
  { val: 0, label: "No limit" },
  { val: 10, label: "10 min" },
  { val: 15, label: "15 min" },
  { val: 20, label: "20 min" },
  { val: 30, label: "30 min" },
];

// ── Heatmap helpers ───────────────────────────────────────────────────────────
// Use LOCAL date string (not UTC) to avoid timezone shift issues
const toLocalDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const getMonday = (d: Date) => {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
};

const getWeeks = (practiceDates: Set<string>) => {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 182); // ~26 weeks back (6 months for mobile)
  const monday = getMonday(start);
  const weeks: { date: Date; level: number }[][] = [];
  const current = new Date(monday);

  while (current <= today) {
    const week: { date: Date; level: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = toLocalDateStr(current);
      const count = practiceDates.has(dateStr) ? 1 : 0;
      week.push({ date: new Date(current), level: count });
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
};

const getStreak = (practiceDates: Set<string>) => {
  let streak = 0;
  const d = new Date();
  while (true) {
    const str = toLocalDateStr(d);
    if (practiceDates.has(str)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
};

// ── Stable shell wrapper (module scope) ──────────────────────────────────────
// IMPORTANT: keep this OUTSIDE the component. When defined inline inside
// AIPracticePage, every parent re-render (e.g. the 1-second timer tick during
// an exam) creates a new function reference for DesktopShell. React then
// treats `<DesktopShell>` as a different "component type" and unmounts +
// remounts the entire subtree on every tick — visible as full-screen flicker.
const DesktopShell = ({ children }: { children: any }) => (
  <div className="-m-4 sm:-m-6 md:-m-8 min-h-[calc(100vh-64px)]"
    style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", background: "#EEF4FF" }}>
    <div className="w-full px-6 pt-8 pb-12">{children}</div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const AIPracticePage = () => {
  const { studentData } = useAuth();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── State ───────────────────────────────────────────────────────────────
  const [view, setView] = useState<View>("home");

  // Upload
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [extractedTopics, setExtractedTopics] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [pageCount, setPageCount] = useState(0);

  // Configure
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [questionType, setQuestionType] = useState("mcq");
  const [questionCount, setQuestionCount] = useState(10);
  const [timeLimit, setTimeLimit] = useState(15);

  // Exam
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examTitle, setExamTitle] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [timerSec, setTimerSec] = useState(0);
  const timerRef = useRef<any>(null);

  // Results
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<any>(null);

  // History + calendar
  const [attempts, setAttempts] = useState<any[]>([]);
  const [practiceDates, setPracticeDates] = useState<Set<string>>(new Set());
  const [documents, setDocuments] = useState<any[]>([]);

  // Type-topic modal (replaces window.prompt with proper UI)
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [topicInput, setTopicInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");

  const studentId = studentData?.studentId || studentData?.id || "";
  const studentName = studentData?.name || studentData?.studentName || "Student";

  // ── Firebase listeners ──────────────────────────────────────────────────
  useEffect(() => {
    if (!studentId) return;
    const schoolId = studentData?.schoolId;

    // Attempts (for calendar + history)
    // No orderBy — avoids composite index requirement. Sort client-side.
    const qAttempts = scopedQuery("practice_attempts", schoolId, where("studentId", "==", studentId));
    const unsub1 = onSnapshot(qAttempts, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      // Sort client-side (newest first)
      data.sort((a, b) => (b.submittedAt?.toMillis?.() || 0) - (a.submittedAt?.toMillis?.() || 0));
      setAttempts(data);

      // Build practice dates set using LOCAL date strings
      const dates = new Set<string>();
      data.forEach(a => {
        const ts = a.submittedAt?.toDate?.();
        if (ts) dates.add(toLocalDateStr(ts));
      });
      setPracticeDates(dates);
    }, (err) => {
      console.error("[Practice] Attempts listener error:", err);
    });

    // Documents (uploaded syllabi)
    // No orderBy — avoids composite index requirement. Sort client-side.
    const qDocs = scopedQuery("practice_documents", schoolId, where("studentId", "==", studentId));
    const unsub2 = onSnapshot(qDocs, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      docs.sort((a, b) => (b.uploadedAt?.toMillis?.() || 0) - (a.uploadedAt?.toMillis?.() || 0));
      setDocuments(docs);
    }, (err) => {
      console.error("[Practice] Documents listener error:", err);
    });

    return () => { unsub1(); unsub2(); };
  }, [studentId, studentData?.schoolId]);

  // Timer
  useEffect(() => {
    if (view === "exam" && timeLimit > 0) {
      setTimerSec(timeLimit * 60);
      timerRef.current = setInterval(() => {
        setTimerSec(prev => {
          if (prev <= 1) { clearInterval(timerRef.current); handleSubmitExam(); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [view, timeLimit]);

  // ── PDF extraction ──────────────────────────────────────────────────────
  const extractPDF = async (f: File) => {
    const buf = await f.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(" ") + "\n\n";
    }
    return { text: text.trim(), pages: pdf.numPages };
  };

  const handleFileUpload = async (f: File) => {
    if (f.type !== "application/pdf") { toast.error("Only PDF files are supported."); return; }
    if (f.size > 20 * 1024 * 1024) { toast.error("File must be under 20 MB."); return; }
    // Without a resolved schoolId the addDoc below would be rejected by the
    // tenant-isolation rule AFTER a slow PDF extraction. Bail out early with
    // an honest, actionable message.
    if (!studentData?.schoolId) {
      toast.error("Your school context is missing. Please sign in again.");
      return;
    }
    setFile(f);
    setExtracting(true);
    try {
      const { text, pages } = await extractPDF(f);
      setExtractedText(text);
      setPageCount(pages);
      // Extract topics (simple: split by common headings/lines)
      const lines = text.split("\n").filter(l => l.trim().length > 3 && l.trim().length < 100);
      const topics = lines
        .filter(l => /^[A-Z]/.test(l.trim()) && !l.includes("  "))
        .slice(0, 15)
        .map(l => l.trim());
      setExtractedTopics(topics.length > 0 ? topics : ["General Topics"]);
      setTopic(topics[0] || "General Topics");

      // Save document to Firebase
      await addDoc(collection(db, "practice_documents"), {
        studentId, fileName: f.name, fileSize: f.size,
        schoolId: studentData.schoolId,
        extractedText: text.slice(0, 50000), // limit storage
        extractedTopics: topics,
        pageCount: pages,
        uploadedAt: serverTimestamp(),
      });

      setView("configure");
    } catch (e: any) {
      console.error("[AIPractice] PDF upload failed:", e?.code, e?.message || e);
      const msg = e?.code === "permission-denied"
        ? "Upload was blocked. Please sign in again and retry."
        : "Couldn't read that PDF. Please try a different file.";
      toast.error(msg);
    }
    setExtracting(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFileUpload(f);
  }, []);

  // Use previously uploaded document
  const useDocument = (doc: any) => {
    setExtractedText(doc.extractedText || "");
    setExtractedTopics(doc.extractedTopics || ["General Topics"]);
    setTopic(doc.extractedTopics?.[0] || "General Topics");
    setPageCount(doc.pageCount || 0);
    setFile(null); // no file object, but we have text
    setView("configure");
  };

  // ── Generate exam ───────────────────────────────────────────────────────
  const handleGenerateExam = async () => {
    if (!extractedText) { toast.error("No document text available."); return; }
    setGenerating(true);
    try {
      const res = await ParentAIController.generatePracticeExam({
        text: extractedText, topic, difficulty, questionType, questionCount,
      });
      if (res.status === "success" && res.data?.questions?.length > 0) {
        setQuestions(res.data.questions);
        setExamTitle(res.data.title || `${topic} Practice`);
        setAnswers(new Array(res.data.questions.length).fill(""));
        setCurrentQ(0);
        setView("exam");
      } else {
        toast.error("Could not generate questions. Try again.");
      }
    } catch { toast.error("AI error. Please retry."); }
    setGenerating(false);
  };

  // ── Submit exam ─────────────────────────────────────────────────────────
  const handleSubmitExam = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setView("results");
    setEvaluating(true);
    try {
      const res = await ParentAIController.evaluatePracticeExam({
        questions, answers, studentName,
      });
      const evalData = res.data || { score: 0, total: questions.length, percentage: 0, grade: "-", evaluations: [], weakTopics: [], encouragement: "" };

      // Save attempt to Firebase — only if we have a schoolId. Without it the
      // write is silently rejected by the tenant-isolation rule; the student
      // sees their score on screen but nothing is persisted.
      if (studentData?.schoolId) {
        // Dual-key per memory `dual_query_pattern_studentid_email`: stamp BOTH
        // studentId AND studentEmail so cross-dashboard readers (e.g. parent
        // PerformancePage AI Practice card) can match by either field.
        const studentEmail = (studentData?.email || studentData?.studentEmail || "")
          .trim().toLowerCase();
        await addDoc(collection(db, "practice_attempts"), {
          studentId, studentName,
          studentEmail,
          schoolId: studentData.schoolId,
          examTitle, topic, difficulty, questionType,
          questionCount: questions.length,
          questions, answers,
          score: evalData.score, total: evalData.total,
          percentage: evalData.percentage, grade: evalData.grade,
          evaluations: evalData.evaluations || [],
          weakTopics: evalData.weakTopics || [],
          timeTaken: timeLimit > 0 ? (timeLimit * 60 - timerSec) : 0,
          submittedAt: serverTimestamp(),
        });
      } else {
        console.warn("[AIPractice] attempt NOT saved — missing schoolId. Result shown locally only.");
        toast.error("Couldn't save your attempt. Please sign in again.");
      }

      setResult(evalData);
    } catch (err: any) {
      console.error("[AIPractice] submit exam failed:", err?.code, err?.message || err);
      // Previous copy lied — said "Your attempt was saved" after an exception
      // that could have been the save itself failing. Be honest.
      setResult({
        score: 0, total: questions.length, percentage: 0, grade: "-",
        evaluations: [], weakTopics: [],
        encouragement: "We couldn't evaluate your attempt just now. Please retry.",
      });
    }
    setEvaluating(false);
  };

  // ── Reset for new exam ──────────────────────────────────────────────────
  const handleNewExam = () => {
    setView("home"); setFile(null); setExtractedText(""); setQuestions([]);
    setAnswers([]); setResult(null); setCurrentQ(0); setTimerSec(0);
  };

  const handleRetry = () => {
    setAnswers(new Array(questions.length).fill(""));
    setCurrentQ(0); setResult(null); setView("exam");
  };

  // ── Computed ────────────────────────────────────────────────────────────
  const streak = useMemo(() => getStreak(practiceDates), [practiceDates]);
  const weeks = useMemo(() => getWeeks(practiceDates), [practiceDates]);
  const bestScore = useMemo(() => {
    if (attempts.length === 0) return 0;
    return Math.max(...attempts.map(a => a.percentage || 0));
  }, [attempts]);

  // ── Shared styles ───────────────────────────────────────────────────────
  const card: React.CSSProperties = { background: C.white, border: `1px solid ${C.bdr}`, borderRadius: 18, overflow: "hidden" };
  const btnPrimary: React.CSSProperties = {
    width: "100%", padding: 14, borderRadius: 14, background: C.pur,
    border: "none", color: "#fff", fontSize: 14, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  /* ═══════════════════════════════════════════════════════════════
     MOBILE — Blue Premium UI (HOME view)
     ═══════════════════════════════════════════════════════════════ */
  if (view === "home" && isMobile) {
    // Blue theme tokens matching EduIntellect mobile design
    const B1 = "#0055FF", B2 = "#1166FF";
    const BG = "#EEF4FF", BG2 = "#E0ECFF", CARD = "#FFFFFF";
    const T1 = "#001040", T3 = "#5070B0", T4 = "#99AACC";
    const ORANGE = "#FF8800", GOLD = "#FFCC22";
    const SEP = "rgba(0,85,255,0.07)";
    const SH = "0 0 0 0.5px rgba(0,85,255,0.08), 0 2px 8px rgba(0,85,255,0.08), 0 10px 24px rgba(0,85,255,0.10)";
    const SH_LG = "0 0 0 0.5px rgba(0,85,255,0.10), 0 4px 16px rgba(0,85,255,0.11), 0 18px 44px rgba(0,85,255,0.13)";
    const SH_BTN = "0 6px 22px rgba(0,85,255,0.42), 0 2px 6px rgba(0,85,255,0.22)";

    // Build flat heatmap cells from weeks (18 cols × 7 rows = 126 cells)
    const flatDays = weeks.flat();
    const recentDays = flatDays.slice(-126);
    const todayStr = toLocalDateStr(new Date());

    // Average score for history summary
    const avgScore = attempts.length > 0
      ? Math.round(attempts.reduce((s, a) => s + (a.percentage || 0), 0) / attempts.length)
      : 0;

    return (
      <div className="animate-in fade-in duration-500 -mx-3 -mt-3 md:mx-0 md:mt-0"
        style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", background: BG, minHeight: "100vh" }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-3">
          <div className="flex items-center gap-[7px]">
            <div className="w-[7px] h-[7px] rounded-full animate-pulse" style={{ background: "#00CC55", boxShadow: "0 0 0 2.5px rgba(0,204,85,0.2)" }} />
            <span className="text-[15px] font-bold" style={{ color: B1 }}>EduIntellect</span>
          </div>
          <div className="flex items-center gap-[9px]">
            <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center relative"
              style={{ background: "rgba(255,255,255,0.88)", border: "0.5px solid rgba(0,85,255,0.16)", boxShadow: SH }}>
              <Bell className="w-4 h-4" style={{ color: "rgba(0,85,255,0.60)" }} strokeWidth={1.8} />
              <span className="absolute top-0 right-0 w-2 h-2 rounded-full" style={{ background: "#FF3355", border: "1.5px solid white" }} />
            </div>
            <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[13px] font-bold text-white"
              style={{ background: `linear-gradient(140deg, ${B1}, ${B2})`, boxShadow: "0 3px 12px rgba(0,85,255,0.36), 0 0 0 2px rgba(255,255,255,0.8)" }}>
              {studentName?.[0]?.toUpperCase() || "S"}
            </div>
          </div>
        </div>

        {/* ── AI Hero Card (dashboard 4-stat-card vibe) ── */}
        <div className="mx-[18px] mt-[14px] rounded-[22px] px-5 pt-[18px] pb-[20px] relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(0,85,255,0.10) 0%, rgba(0,85,255,0.03) 100%)",
            boxShadow: SH,
            border: "0.5px solid rgba(0,85,255,0.20)",
          }}>
          <div className="absolute pointer-events-none" style={{ top: 12, right: 12 }}>
            <Sparkles style={{ width: 70, height: 70, color: B1, opacity: 0.16, strokeWidth: 1.6 }} />
          </div>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-[5px] px-3 py-[5px] rounded-full mb-[14px] text-[9px] font-bold uppercase tracking-[0.10em]"
              style={{ background: "rgba(0,85,255,0.10)", border: "0.5px solid rgba(0,85,255,0.22)", color: B1 }}>
              <Sparkles className="w-[11px] h-[11px]" strokeWidth={2.5} />
              AI Powered · USP Feature
            </div>
            <h1 className="text-[30px] font-bold leading-[1.08] mb-2" style={{ color: T1, letterSpacing: "-0.8px" }}>
              AI Practice<br />Exams
            </h1>
            <p className="text-[12px] leading-[1.6] font-normal mb-[18px]" style={{ color: T3 }}>
              Upload syllabus, take AI exams,<br />learn from mistakes.
            </p>

            {/* Stat chips */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: "🔥", val: `${streak}d`, label: "Streak", tint: "rgba(255,136,0,0.10)", bdr: "rgba(255,136,0,0.22)", color: ORANGE },
                { icon: <BarChart3 className="w-[18px] h-[18px]" style={{ color: B1 }} strokeWidth={2.2} />, val: `${attempts.length}`, label: "Exams", tint: "rgba(0,85,255,0.08)", bdr: "rgba(0,85,255,0.20)", color: B1 },
                { icon: "⭐", val: bestScore > 0 ? `${bestScore}%` : "—", label: "Best", tint: "rgba(255,204,34,0.12)", bdr: "rgba(255,204,34,0.28)", color: GOLD },
              ].map(({ icon, val, label, tint, bdr, color }) => (
                <div key={label} className="rounded-[16px] py-[13px] px-[10px] flex flex-col items-center gap-[5px]"
                  style={{ background: tint, border: `0.5px solid ${bdr}` }}>
                  <div className="h-[22px] flex items-center justify-center text-[18px] leading-none mb-[2px]">
                    {typeof icon === "string" ? icon : icon}
                  </div>
                  <div className="text-[20px] font-bold leading-none" style={{ color: T1, letterSpacing: "-0.5px" }}>{val}</div>
                  <div className="text-[8px] font-bold uppercase tracking-[0.10em]" style={{ color }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Streak Card ── */}
        <div className="mx-[18px] mt-3 flex items-center justify-between rounded-[20px] px-[18px] py-[15px] relative overflow-hidden"
          style={{ background: CARD, boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
          <div className="absolute -top-5 -right-4 w-[90px] h-[90px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,136,0,0.07) 0%, transparent 70%)" }} />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-11 h-11 rounded-[14px] flex items-center justify-center text-[20px] shrink-0"
              style={{ background: `linear-gradient(135deg, ${ORANGE}, ${GOLD})`, boxShadow: "0 3px 12px rgba(255,136,0,0.30)" }}>
              🔥
            </div>
            <div>
              <div className="text-[15px] font-bold" style={{ color: T1, letterSpacing: "-0.2px" }}>Practice Streak</div>
              <div className="text-[11px] font-normal" style={{ color: T3 }}>
                {streak > 0 ? "Keep the fire going!" : "Start today to build your streak!"}
              </div>
            </div>
          </div>
          <div className="text-[22px] font-bold relative z-10" style={{ color: ORANGE, letterSpacing: "-0.5px" }}>{streak}d</div>
        </div>

        {/* ── Practice Calendar ── */}
        {/* Practiced days now render in GREEN (GitHub-style contribution feel),
            and a daily-streak chip sits in the card header so the parent
            always sees the streak even when the heatmap is otherwise sparse. */}
        <div className="mx-[18px] mt-3 rounded-[22px] px-[18px] py-[18px]"
          style={{ background: CARD, boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
          <div className="flex items-start justify-between gap-3 mb-[14px]">
            <div>
              <div className="text-[15px] font-bold" style={{ color: T1, letterSpacing: "-0.3px" }}>Practice Calendar</div>
              <div className="text-[11px] font-normal mt-[3px]" style={{ color: T3 }}>{practiceDates.size} days practiced</div>
            </div>
            <div className="shrink-0 px-[10px] py-[5px] rounded-full text-[11px] font-bold flex items-center gap-[5px]"
              style={{
                background: streak > 0 ? "rgba(0,200,83,0.10)" : "rgba(140,146,164,0.10)",
                color: streak > 0 ? "#007830" : T3,
                border: streak > 0 ? "0.5px solid rgba(0,200,83,0.22)" : "0.5px solid rgba(140,146,164,0.22)",
              }}>
              🔥 {streak} day streak
            </div>
          </div>

          {/* Heatmap 18×7 grid */}
          <div className="grid gap-[3px] mb-[10px]" style={{ gridTemplateColumns: "repeat(18, 1fr)" }}>
            {recentDays.map((day, idx) => {
              const dateStr = toLocalDateStr(day.date);
              const isToday = dateStr === todayStr;
              const isFuture = day.date > new Date();
              const practiced = day.level > 0;
              const cellStyle: React.CSSProperties = {
                aspectRatio: "1",
                borderRadius: 3,
                background: isFuture ? "transparent" : practiced ? "#00C853" : BG2,
                opacity: isFuture ? 0.15 : 1,
              };
              if (isToday) {
                // Highlight today regardless of practice status; green ring if
                // practiced, blue ring otherwise so it always stands out.
                cellStyle.background = practiced ? "#00C853" : BG2;
                cellStyle.boxShadow = practiced
                  ? "0 0 0 2px rgba(0,200,83,0.35), 0 0 0 4px rgba(0,200,83,0.10)"
                  : "0 0 0 2px rgba(0,85,255,0.30), 0 0 0 4px rgba(0,85,255,0.10)";
              }
              return <div key={idx} style={cellStyle} title={day.date.toLocaleDateString()} />;
            })}
          </div>

          {/* Legend — green gradient matches the practiced-day color. */}
          <div className="flex items-center gap-[6px] text-[10px] font-semibold" style={{ color: T4 }}>
            <span>Less</span>
            {[BG2, "rgba(0,200,83,0.20)", "rgba(0,200,83,0.40)", "rgba(0,200,83,0.65)", "#00C853"].map((c, i) => (
              <div key={i} className="w-3 h-3 rounded-[3px]" style={{ background: c }} />
            ))}
            <span>More</span>
          </div>
        </div>

        {/* ── New Practice Exam CTA ── */}
        <button onClick={() => setView("upload")}
          className="mx-[18px] mt-[14px] w-[calc(100%-36px)] h-[52px] rounded-[18px] flex items-center justify-center gap-2 text-[15px] font-bold text-white active:scale-[0.97] transition-transform relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: SH_BTN, letterSpacing: "-0.1px" }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 52%)" }} />
          <Plus className="relative z-10 w-4 h-4" strokeWidth={2.5} />
          <span className="relative z-10">New Practice Exam</span>
        </button>

        {/* ── Empty state hint ── */}
        {attempts.length === 0 && documents.length === 0 && (
          <div className="px-5 pt-[14px] text-center text-[13px] leading-[1.6] font-normal" style={{ color: T3 }}>
            No exams yet. Tap <strong style={{ color: B1, fontWeight: 700 }}>New Practice Exam</strong> to begin!
          </div>
        )}

        {/* ── Your Documents ── */}
        {documents.length > 0 && (
          <>
            <div className="flex items-center gap-2 px-5 pt-[18px] text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: "rgba(0,85,255,0.40)" }}>
              Your Documents
              <div className="flex-1 h-[0.5px]" style={{ background: SEP }} />
            </div>
            <div className="mx-[18px] mt-[10px] flex flex-col gap-[9px]">
              {documents.slice(0, 3).map(doc => (
                <div key={doc.id} onClick={() => useDocument(doc)}
                  className="rounded-[18px] px-4 py-[14px] flex items-center gap-[13px] active:scale-[0.97] transition-transform cursor-pointer"
                  style={{ background: CARD, boxShadow: SH, border: "0.5px solid rgba(0,85,255,0.10)" }}>
                  <div className="w-[42px] h-[42px] rounded-[13px] flex items-center justify-center shrink-0"
                    style={{ background: "rgba(0,85,255,0.10)", border: "0.5px solid rgba(0,85,255,0.20)" }}>
                    <FileText className="w-5 h-5" style={{ color: B1 }} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-bold truncate" style={{ color: T1, letterSpacing: "-0.2px" }}>{doc.fileName}</div>
                    <div className="text-[11px] mt-[2px]" style={{ color: T3 }}>{doc.pageCount || 0} pages · {doc.extractedTopics?.length || 0} topics</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Recent Exams ── */}
        {attempts.length > 0 && (
          <>
            <div className="flex items-center gap-2 px-5 pt-[18px] text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: "rgba(0,85,255,0.40)" }}>
              Recent Exams
              <div className="flex-1 h-[0.5px]" style={{ background: SEP }} />
            </div>
            <div className="mx-[18px] mt-[10px] flex flex-col gap-[9px]">
              {attempts.slice(0, 5).map(a => {
                const pct = a.percentage || 0;
                const passed = pct >= 80;
                const review = pct >= 50 && pct < 80;
                const iconBg = passed ? "rgba(0,200,83,0.10)" : review ? "rgba(255,136,0,0.10)" : "rgba(255,51,85,0.10)";
                const iconBdr = passed ? "rgba(0,200,83,0.22)" : review ? "rgba(255,136,0,0.22)" : "rgba(255,51,85,0.22)";
                const iconColor = passed ? "#00C853" : review ? ORANGE : "#FF3355";
                const chipText = passed ? "Passed" : review ? "Review" : "Retry";
                return (
                  <div key={a.id} className="rounded-[18px] px-4 py-[14px] flex items-center gap-[13px] active:scale-[0.97] transition-transform"
                    style={{ background: CARD, boxShadow: SH, border: "0.5px solid rgba(0,85,255,0.10)" }}>
                    <div className="w-[42px] h-[42px] rounded-[13px] flex items-center justify-center shrink-0"
                      style={{ background: iconBg, border: `0.5px solid ${iconBdr}` }}>
                      <BarChart3 className="w-5 h-5" style={{ color: iconColor }} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold truncate" style={{ color: T1, letterSpacing: "-0.2px" }}>{a.examTitle || a.topic || "Practice"}</div>
                      <div className="text-[11px] mt-[2px]" style={{ color: T3 }}>
                        {a.submittedAt?.toDate?.().toLocaleDateString(undefined, { month: "short", day: "numeric" }) || "—"} · {a.total || a.questionCount || 0} questions
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-[3px]">
                      <div className="text-[17px] font-bold" style={{ color: iconColor, letterSpacing: "-0.4px" }}>{pct}%</div>
                      <div className="px-[9px] py-[3px] rounded-full text-[10px] font-bold"
                        style={{ background: iconBg, color: iconColor, border: `0.5px solid ${iconBdr}` }}>
                        {chipText}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Exam History Summary (deep blue card) ── */}
        {attempts.length > 0 && (
          <div className="mx-[18px] mt-[14px] rounded-[22px] px-5 py-[18px] relative overflow-hidden"
            style={{ background: "linear-gradient(140deg, #001888 0%, #0033CC 48%, #0055FF 100%)", boxShadow: "0 8px 28px rgba(0,51,204,0.32), 0 0 0 0.5px rgba(255,255,255,0.14)" }}>
            <div className="absolute -top-8 -right-5 w-[130px] h-[130px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 65%)" }} />
            <div className="text-[9px] font-bold uppercase tracking-[0.12em] mb-3 relative z-10" style={{ color: "rgba(255,255,255,0.48)" }}>
              Your Exam History
            </div>
            <div className="grid grid-cols-3 gap-[1px] rounded-[16px] overflow-hidden relative z-10" style={{ background: "rgba(255,255,255,0.12)" }}>
              {[
                { val: `${attempts.length}`, label: "Total" },
                { val: avgScore > 0 ? `${avgScore}%` : "—", label: "Avg Score" },
                { val: `${streak}d`, label: "Streak" },
              ].map(({ val, label }) => (
                <div key={label} className="py-[14px] px-3 text-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="text-[26px] font-bold text-white leading-none mb-1" style={{ letterSpacing: "-0.8px" }}>{val}</div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.09em]" style={{ color: "rgba(255,255,255,0.40)" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-6" />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     MOBILE — Blue Premium UI (UPLOAD view)
     ═══════════════════════════════════════════════════════════════ */
  if (view === "upload" && isMobile) {
    const B1 = "#0055FF", B2 = "#1166FF", B3 = "#2277FF";
    const BG = "#EEF4FF", BG2 = "#E0ECFF", CARD = "#FFFFFF";
    const T1 = "#001040", T3 = "#5070B0", T4 = "#99AACC";
    const SH = "0 0 0 0.5px rgba(0,85,255,0.08), 0 2px 8px rgba(0,85,255,0.08), 0 10px 24px rgba(0,85,255,0.10)";
    const SH_BTN = "0 6px 22px rgba(0,85,255,0.42), 0 2px 6px rgba(0,85,255,0.22)";

    const hasFile = !!file || !!extractedText;

    // Open the Type-Topic modal so the student can enter a topic + short
    // description (better than the old window.prompt one-liner). Submission
    // happens in handleTopicModalSubmit below.
    const handleTypeTopic = () => {
      setTopicInput("");
      setDescriptionInput("");
      setTopicModalOpen(true);
    };

    const handleTopicModalSubmit = () => {
      const t = topicInput.trim();
      const d = descriptionInput.trim();
      if (t.length < 2) {
        toast.error("Please enter a topic (at least 2 characters).");
        return;
      }
      // Build the study material text the AI engine will use. Topic acts as
      // the headline; description (if provided) is the body. If no description,
      // the topic alone still works — AI generates from general knowledge of
      // that subject.
      const text = d ? `${t}\n\n${d}` : t;
      setExtractedText(text);
      setExtractedTopics([t.slice(0, 60)]);
      setTopic(t.slice(0, 60));
      setFile(null);
      setPageCount(0);
      setTopicModalOpen(false);
      setView("configure");
    };

    return (
      <div className="animate-in fade-in duration-500 -mx-3 -mt-3 md:mx-0 md:mt-0"
        style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", background: BG, minHeight: "100vh" }}>

        {/* ── Back ── */}
        <div className="flex items-center gap-2 px-5 pt-[14px] cursor-pointer active:opacity-60 w-fit" onClick={() => setView("home")}>
          <div className="w-8 h-8 rounded-[11px] flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.88)", border: "0.5px solid rgba(0,85,255,0.14)", boxShadow: SH }}>
            <ChevronLeft className="w-[13px] h-[13px]" style={{ color: "rgba(0,85,255,0.7)" }} strokeWidth={2.5} />
          </div>
          <span className="text-[14px] font-bold" style={{ color: B1, letterSpacing: "-0.1px" }}>Back</span>
        </div>

        {/* ── Page head ── */}
        <div className="px-5 pt-4">
          <h2 className="text-[24px] font-bold" style={{ color: T1, letterSpacing: "-0.6px" }}>Upload Syllabus</h2>
          <p className="text-[12px] mt-[3px] font-normal" style={{ color: T3 }}>Upload a PDF of your chapter, notes, or syllabus.</p>
        </div>

        {/* ── Drop Zone ── */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => !extracting && fileInputRef.current?.click()}
          className="mx-[18px] mt-4 rounded-[22px] px-5 py-[30px] flex flex-col items-center gap-[10px] cursor-pointer transition-all"
          style={{
            border: `2px dashed ${hasFile ? "rgba(0,85,255,0.40)" : "rgba(0,85,255,0.25)"}`,
            background: hasFile ? "rgba(0,85,255,0.04)" : "rgba(255,255,255,0.70)",
            boxShadow: "0 0 0 6px rgba(0,85,255,0.04)",
          }}>
          {extracting ? (
            <Loader2 className="w-[60px] h-[60px] animate-spin" style={{ color: B1 }} />
          ) : (
            <div className="w-[60px] h-[60px] rounded-[20px] flex items-center justify-center mb-[6px]"
              style={{
                background: hasFile ? `linear-gradient(135deg, ${B1}, ${B3})` : `linear-gradient(135deg, ${BG}, ${BG2})`,
                border: hasFile ? "none" : "0.5px solid rgba(0,85,255,0.18)",
                boxShadow: hasFile ? SH_BTN : SH,
              }}>
              <Upload className="w-[26px] h-[26px]" style={{ color: hasFile ? "#fff" : "rgba(0,85,255,0.55)" }} strokeWidth={2.2} />
            </div>
          )}
          <div className="text-[16px] font-bold text-center px-2" style={{ color: T1, letterSpacing: "-0.3px" }}>
            {extracting ? "Reading PDF..." : file?.name || (hasFile ? "Syllabus ready" : "Drop PDF here")}
          </div>
          <div className="text-[12px] font-normal" style={{ color: T3 }}>or tap to browse your files</div>
          <div className="text-[11px] font-semibold" style={{ color: T4 }}>Max 20 MB · PDF, DOC, DOCX</div>
          <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: "none" }}
            onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }} />
        </div>

        {/* ── Method Grid ── */}
        <div className="grid grid-cols-2 gap-[10px] mx-[18px] mt-[14px]">
          {[
            { icon: FileText, gradient: "linear-gradient(135deg, #FF3355, #FF6688)", shadow: "0 3px 10px rgba(255,51,85,0.26)", label: "PDF File", sub: "Chapter or notes", action: () => !extracting && fileInputRef.current?.click() },
            { icon: ImageIcon, gradient: `linear-gradient(135deg, ${B1}, ${B3})`, shadow: "0 3px 10px rgba(0,85,255,0.26)", label: "Scan Photo", sub: "Camera or gallery", action: () => toast.info("Photo scan coming soon") },
            { icon: MessageSquare, gradient: "linear-gradient(135deg, #00C853, #66EE88)", shadow: "0 3px 10px rgba(0,200,83,0.24)", label: "Type Topic", sub: "Enter manually", action: handleTypeTopic },
            { icon: HardDrive, gradient: "linear-gradient(135deg, #FF8800, #FFCC22)", shadow: "0 3px 10px rgba(255,136,0,0.24)", label: "From Drive", sub: "Google Drive", action: () => toast.info("Google Drive coming soon") },
          ].map(({ icon: Icon, gradient, shadow, label, sub, action }) => (
            <div key={label} onClick={action}
              className="rounded-[20px] px-4 py-[18px] flex flex-col items-center gap-2 cursor-pointer active:scale-[0.96] transition-transform text-center"
              style={{ background: CARD, boxShadow: SH, border: "0.5px solid rgba(0,85,255,0.10)" }}>
              <div className="w-[46px] h-[46px] rounded-[15px] flex items-center justify-center mb-[2px]"
                style={{ background: gradient, boxShadow: shadow }}>
                <Icon className="w-[22px] h-[22px] text-white" strokeWidth={2.2} />
              </div>
              <div className="text-[13px] font-bold" style={{ color: T1, letterSpacing: "-0.2px" }}>{label}</div>
              <div className="text-[11px] font-normal" style={{ color: T3 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── Format Pills ── */}
        <div className="flex flex-wrap gap-[7px] px-[18px] pt-[14px]">
          {[
            { label: "PDF", color: "#FF3355", bg: "rgba(255,51,85,0.10)", bdr: "rgba(255,51,85,0.22)" },
            { label: "DOCX", color: B1, bg: "rgba(0,85,255,0.10)", bdr: "rgba(0,85,255,0.20)" },
            { label: "JPG / PNG", color: "#007830", bg: "rgba(0,200,83,0.10)", bdr: "rgba(0,200,83,0.22)" },
            { label: "TXT", color: "#002080", bg: "rgba(0,85,255,0.08)", bdr: "rgba(0,85,255,0.14)" },
          ].map(({ label, color, bg, bdr }) => (
            <div key={label} className="flex items-center gap-[5px] px-[13px] py-[6px] rounded-full text-[11px] font-bold"
              style={{ background: bg, color, border: `0.5px solid ${bdr}` }}>
              <FileText className="w-[11px] h-[11px]" strokeWidth={2.5} />
              {label}
            </div>
          ))}
        </div>

        {/* ── Upload & Generate CTA ── */}
        <button
          onClick={() => {
            if (hasFile && extractedText) setView("configure");
            else if (!extracting) fileInputRef.current?.click();
          }}
          disabled={extracting}
          className="mx-[18px] mt-[14px] w-[calc(100%-36px)] h-[52px] rounded-[18px] flex items-center justify-center gap-2 text-[15px] font-bold text-white active:scale-[0.97] disabled:opacity-60 transition-transform relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: SH_BTN, letterSpacing: "-0.1px" }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 52%)" }} />
          {extracting ? (
            <><Loader2 className="relative z-10 w-4 h-4 animate-spin" /><span className="relative z-10">Reading PDF...</span></>
          ) : (
            <><Upload className="relative z-10 w-4 h-4" strokeWidth={2.5} /><span className="relative z-10">Upload &amp; Generate Exam</span></>
          )}
        </button>

        {/* ── AI hint card ── */}
        <div className="mx-[18px] mt-[14px] rounded-[20px] px-[18px] py-4 flex items-center gap-3"
          style={{ background: CARD, boxShadow: SH, border: "0.5px solid rgba(0,85,255,0.10)" }}>
          <div className="w-10 h-10 rounded-[13px] flex items-center justify-center shrink-0"
            style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: "0 3px 10px rgba(0,85,255,0.28)" }}>
            <Sparkles className="w-[18px] h-[18px] text-white" strokeWidth={2.2} />
          </div>
          <div>
            <div className="text-[13px] font-bold" style={{ color: T1, letterSpacing: "-0.2px" }}>AI generates 15–30 MCQs</div>
            <div className="text-[11px] mt-[2px] font-normal leading-[1.5]" style={{ color: T3 }}>Tailored to your syllabus with instant grading and feedback</div>
          </div>
        </div>

        {/* ── Previously uploaded docs ── */}
        {documents.length > 0 && (
          <>
            <div className="px-5 pt-[18px] text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "rgba(0,85,255,0.45)" }}>
              Or use a saved document
            </div>
            <div className="mx-[18px] mt-[10px] flex flex-col gap-[9px]">
              {documents.map(doc => (
                <div key={doc.id} onClick={() => useDocument(doc)}
                  className="rounded-[18px] px-4 py-[14px] flex items-center gap-[13px] cursor-pointer active:scale-[0.97] transition-transform"
                  style={{ background: CARD, boxShadow: SH, border: "0.5px solid rgba(0,85,255,0.10)" }}>
                  <div className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0"
                    style={{ background: "rgba(0,85,255,0.10)", border: "0.5px solid rgba(0,85,255,0.20)" }}>
                    <FileText className="w-[18px] h-[18px]" style={{ color: B1 }} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: T1 }}>{doc.fileName}</div>
                    <div className="text-[11px] mt-[2px]" style={{ color: T3 }}>{doc.extractedTopics?.length || 0} topics extracted</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="h-6" />

        {/* Type-Topic modal — appears for both mobile + desktop upload views.
            Topic field is required; description is optional context the AI
            uses as study material. */}
        {topicModalOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: "rgba(0,16,64,0.45)", backdropFilter: "blur(8px)" }}
            onClick={() => setTopicModalOpen(false)}
          >
            <div
              className="w-full max-w-[460px] rounded-[24px] p-6 animate-in zoom-in-95 duration-200"
              style={{ background: "#fff", boxShadow: "0 24px 80px rgba(0,16,64,0.35)", fontFamily: "'DM Sans', sans-serif" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-[20px] font-bold" style={{ color: "#001040", letterSpacing: "-0.4px" }}>
                    Practice by Topic
                  </h2>
                  <p className="text-[12px] mt-1" style={{ color: "#5070B0" }}>
                    Enter a topic and optional notes. The AI will build questions from this.
                  </p>
                </div>
                <button
                  onClick={() => setTopicModalOpen(false)}
                  className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-colors hover:bg-slate-100"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" style={{ color: "#5070B0" }} strokeWidth={2.4} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.1em] mb-[6px] block" style={{ color: "#5070B0" }}>
                    Topic <span style={{ color: "#FF3355" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    placeholder="e.g. Photosynthesis, Quadratic Equations, World War II"
                    maxLength={120}
                    autoFocus
                    className="w-full px-4 py-3 rounded-[14px] text-[14px] font-medium outline-none transition-all"
                    style={{
                      background: "#EEF4FF",
                      border: "0.5px solid rgba(0,85,255,0.18)",
                      color: "#001040",
                    }}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.1em] mb-[6px] block" style={{ color: "#5070B0" }}>
                    Short description <span className="font-normal normal-case tracking-normal" style={{ color: "#99AACC" }}>(optional)</span>
                  </label>
                  <textarea
                    value={descriptionInput}
                    onChange={(e) => setDescriptionInput(e.target.value)}
                    placeholder="Add a few lines of notes, key concepts, or focus areas — the AI will use this as study material."
                    maxLength={2000}
                    rows={5}
                    className="w-full px-4 py-3 rounded-[14px] text-[13px] outline-none resize-none leading-[1.5] transition-all"
                    style={{
                      background: "#EEF4FF",
                      border: "0.5px solid rgba(0,85,255,0.18)",
                      color: "#001040",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  />
                  <p className="text-[10px] mt-1.5" style={{ color: "#99AACC" }}>
                    {descriptionInput.length}/2000 characters · Leave empty to let AI use general knowledge
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setTopicModalOpen(false)}
                  className="flex-1 h-11 rounded-[12px] text-[13px] font-bold transition-colors hover:bg-slate-50"
                  style={{
                    background: "#fff",
                    border: "0.5px solid rgba(0,85,255,0.20)",
                    color: "#5070B0",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleTopicModalSubmit}
                  disabled={topicInput.trim().length < 2}
                  className="flex-1 h-11 rounded-[12px] text-[13px] font-bold flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{
                    background: "linear-gradient(135deg, #0055FF, #2277FF)",
                    color: "#fff",
                    boxShadow: "0 6px 22px rgba(0,85,255,0.42), 0 2px 6px rgba(0,85,255,0.22)",
                  }}
                >
                  Continue <ChevronRight className="w-[14px] h-[14px]" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── DESKTOP — Bright Blue Apple UI ───────────────────────────────────────
  const B1 = "#0055FF", B2 = "#1166FF", B3 = "#2277FF", B4 = "#4499FF";
  const BG_D = "#EEF4FF", BG2_D = "#E0ECFF";
  const T1 = "#001040", T2 = "#002080", T3 = "#5070B0", T4 = "#99AACC";
  const GREEN_D = "#00C853", RED_D = "#FF3355", ORANGE_D = "#FF8800", GOLD_D = "#FFCC22", PINK_D = "#FF3BA8", VIOLET_D = "#6B21E8";
  const BLUE_BDR_D = "rgba(0,85,255,0.12)";
  const SH_D = "0 0 0 0.5px rgba(0,85,255,0.08), 0 2px 8px rgba(0,85,255,0.09), 0 10px 28px rgba(0,85,255,0.11)";
  const SH_LG_D = "0 0 0 0.5px rgba(0,85,255,0.10), 0 4px 16px rgba(0,85,255,0.12), 0 18px 44px rgba(0,85,255,0.14)";
  const SH_BTN_D = "0 6px 22px rgba(0,85,255,0.42), 0 2px 6px rgba(0,85,255,0.22)";

  const avgScoreD = attempts.length > 0
    ? Math.round(attempts.reduce((s, a) => s + (a.percentage || 0), 0) / attempts.length)
    : 0;

  // ── HOME VIEW (Desktop) ──────────────────────────────────────────────────
  if (view === "home") return (
    <DesktopShell>
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-1 flex items-center gap-[7px]" style={{ color: T4 }}>
            <span className="w-[6px] h-[6px] rounded-full" style={{ background: GREEN_D, boxShadow: "0 0 0 3px rgba(0,200,83,0.2)" }} />
            Parent Dashboard · AI Practice
          </div>
          <h1 className="text-[32px] font-bold leading-none" style={{ color: T1, letterSpacing: "-0.8px" }}>AI Practice Exams</h1>
          <div className="text-[13px] font-normal mt-[6px]" style={{ color: T3 }}>Upload syllabus, take AI exams, learn from mistakes.</div>
        </div>
        <div className="flex items-center gap-[10px]">
          <div className="px-[14px] py-[8px] rounded-full text-[12px] font-bold flex items-center gap-[6px]" style={{ background: "rgba(0,85,255,0.08)", color: B1, border: `0.5px solid ${BLUE_BDR_D}` }}>
            <Sparkles className="w-[12px] h-[12px]" strokeWidth={2.5} />
            USP Feature
          </div>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white"
            style={{ background: `linear-gradient(140deg, ${B1}, ${B2})`, boxShadow: "0 3px 12px rgba(0,85,255,0.36), 0 0 0 2px rgba(255,255,255,0.8)" }}>
            {studentName?.[0]?.toUpperCase() || "S"}
          </div>
        </div>
      </div>

      {/* ── Hero Row: Big hero (col-2) + Streak card (col-1) — dashboard 4-stat-card vibe ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        {/* Hero (col-2) */}
        <div className="lg:col-span-2 rounded-[24px] px-8 py-8 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(0,85,255,0.10) 0%, rgba(0,85,255,0.03) 100%)",
            boxShadow: SH_LG_D,
            border: "0.5px solid rgba(0,85,255,0.20)",
          }}>
          <div className="absolute pointer-events-none" style={{ top: 18, right: 22 }}>
            <Sparkles style={{ width: 110, height: 110, color: B1, opacity: 0.14, strokeWidth: 1.6 }} />
          </div>
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
              <div className="inline-flex items-center gap-[5px] px-3 py-[5px] rounded-full mb-4 text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{ background: "rgba(0,85,255,0.10)", border: "0.5px solid rgba(0,85,255,0.22)", color: B1 }}>
                <Sparkles className="w-[12px] h-[12px]" strokeWidth={2.5} />
                AI Powered
              </div>
              <h2 className="text-[44px] font-bold leading-[1.05] mb-3" style={{ color: T1, letterSpacing: "-1px" }}>
                Practice<br />Smart.
              </h2>
              <p className="text-[14px] leading-[1.6]" style={{ color: T3 }}>
                Upload your syllabus and let AI generate personalised exams. Grade yourself, learn from mistakes, build streaks.
              </p>
              <button onClick={() => setView("upload")}
                className="mt-5 h-12 px-6 rounded-[14px] text-[14px] font-bold flex items-center gap-2 transition-transform hover:scale-[1.02]"
                style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, color: "#fff", boxShadow: SH_BTN_D, letterSpacing: "-0.1px" }}>
                <Plus className="w-4 h-4" strokeWidth={2.5} /> New Practice Exam
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: "🔥", val: `${streak}d`, label: "Streak", tint: "rgba(255,136,0,0.10)", bdr: "rgba(255,136,0,0.22)", color: ORANGE_D },
                { icon: <BarChart3 className="w-[20px] h-[20px]" style={{ color: B1 }} strokeWidth={2.2} />, val: `${attempts.length}`, label: "Exams", tint: "rgba(0,85,255,0.08)", bdr: "rgba(0,85,255,0.20)", color: B1 },
                { icon: "⭐", val: bestScore > 0 ? `${bestScore}%` : "—", label: "Best", tint: "rgba(255,204,34,0.12)", bdr: "rgba(255,204,34,0.30)", color: GOLD_D },
              ].map(({ icon, val, label, tint, bdr, color }) => (
                <div key={label} className="rounded-[18px] py-5 px-3 flex flex-col items-center gap-1"
                  style={{ background: tint, border: `0.5px solid ${bdr}` }}>
                  <div className="h-[26px] flex items-center justify-center text-[22px] leading-none mb-1">
                    {typeof icon === "string" ? icon : icon}
                  </div>
                  <div className="text-[22px] font-bold leading-none" style={{ color: T1, letterSpacing: "-0.6px" }}>{val}</div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.10em]" style={{ color }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Streak / Progress (col-1) */}
        <div className="bg-white rounded-[22px] p-6 relative overflow-hidden"
          style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(0,85,255,0.10)" }}>
          <div className="absolute -top-[30px] -right-[20px] w-[140px] h-[140px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,136,0,0.08) 0%, transparent 70%)" }} />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-[15px] flex items-center justify-center text-[24px] shrink-0"
                style={{ background: `linear-gradient(135deg, ${ORANGE_D}, ${GOLD_D})`, boxShadow: "0 3px 12px rgba(255,136,0,0.30)" }}>
                🔥
              </div>
              <div>
                <div className="text-[16px] font-bold" style={{ color: T1, letterSpacing: "-0.2px" }}>Practice Streak</div>
                <div className="text-[11px] font-normal" style={{ color: T3 }}>
                  {streak > 0 ? "Keep the fire going!" : "Start today!"}
                </div>
              </div>
            </div>
            <div className="text-[44px] font-bold" style={{ color: ORANGE_D, letterSpacing: "-1px" }}>{streak}<span className="text-[24px]" style={{ color: T4 }}>d</span></div>

            <div className="mt-4 pt-4" style={{ borderTop: `0.5px solid ${BLUE_BDR_D}` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.10em]" style={{ color: T4 }}>Avg Score</span>
                <span className="text-[15px] font-bold" style={{ color: avgScoreD >= 80 ? GREEN_D : avgScoreD >= 50 ? ORANGE_D : avgScoreD > 0 ? RED_D : T4 }}>
                  {avgScoreD > 0 ? `${avgScoreD}%` : "—"}
                </span>
              </div>
              <div className="h-[7px] rounded-[4px] overflow-hidden" style={{ background: BG2_D }}>
                <div className="h-full rounded-[4px]" style={{ width: `${avgScoreD}%`, background: `linear-gradient(90deg, ${B1}, ${B4})`, transition: "width 1s cubic-bezier(0.4,0,0.2,1)" }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Row: Calendar (col-2) + Recent Attempts (col-1) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        {/* Calendar — green practiced cells + always-visible streak chip. */}
        <div className="lg:col-span-2 bg-white rounded-[22px] p-6"
          style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(0,85,255,0.10)" }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-[17px] font-bold" style={{ color: T1, letterSpacing: "-0.3px" }}>Practice Calendar</div>
              <div className="text-[11px] font-normal mt-[3px]" style={{ color: T3 }}>{practiceDates.size} days practiced</div>
            </div>
            <div className="shrink-0 px-[12px] py-[6px] rounded-full text-[12px] font-bold flex items-center gap-[6px]"
              style={{
                background: streak > 0 ? "rgba(0,200,83,0.10)" : "rgba(140,146,164,0.10)",
                color: streak > 0 ? "#007830" : T3,
                border: streak > 0 ? "0.5px solid rgba(0,200,83,0.22)" : "0.5px solid rgba(140,146,164,0.22)",
              }}>
              🔥 {streak} day streak
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="flex gap-[3px] min-w-[700px]">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {week.map((day, di) => {
                    const today = new Date();
                    const isToday = day.date.toDateString() === today.toDateString();
                    const isFuture = day.date > today;
                    const practiced = day.level > 0;
                    return (
                      <div key={di}
                        title={day.date.toLocaleDateString()}
                        style={{
                          width: 14, height: 14, borderRadius: 3,
                          background: isFuture ? "transparent" : practiced ? GREEN_D : BG2_D,
                          boxShadow: isToday
                            ? practiced
                              ? "0 0 0 2px rgba(0,200,83,0.35), 0 0 0 4px rgba(0,200,83,0.10)"
                              : "0 0 0 2px rgba(0,85,255,0.30), 0 0 0 4px rgba(0,85,255,0.10)"
                            : "none",
                          opacity: isFuture ? 0.15 : 1,
                        }} />
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-4 text-[11px] font-semibold" style={{ color: T4 }}>
              <span>Less</span>
              {[BG2_D, "rgba(0,200,83,0.20)", "rgba(0,200,83,0.40)", "rgba(0,200,83,0.65)", GREEN_D].map((c, i) => (
                <div key={i} className="w-[12px] h-[12px] rounded-[3px]" style={{ background: c }} />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>

        {/* Recent Attempts sidebar */}
        <div className="bg-white rounded-[22px] p-5"
          style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(0,85,255,0.10)" }}>
          <div className="text-[16px] font-bold mb-4" style={{ color: T1, letterSpacing: "-0.3px" }}>Recent Exams</div>
          {attempts.length === 0 ? (
            <div className="py-8 text-center text-[12px]" style={{ color: T4 }}>
              No exams yet. Start your first one.
            </div>
          ) : (
            <div className="space-y-[10px]">
              {attempts.slice(0, 5).map(a => {
                const pct = a.percentage || 0;
                const passed = pct >= 80;
                const review = pct >= 50 && pct < 80;
                const iconBg = passed ? "rgba(0,200,83,0.10)" : review ? "rgba(255,136,0,0.10)" : "rgba(255,51,85,0.10)";
                const iconBdr = passed ? "rgba(0,200,83,0.22)" : review ? "rgba(255,136,0,0.22)" : "rgba(255,51,85,0.22)";
                const iconColor = passed ? GREEN_D : review ? ORANGE_D : RED_D;
                return (
                  <div key={a.id} className="rounded-[14px] px-3 py-3 flex items-center gap-3"
                    style={{ background: BG_D, border: `0.5px solid ${BLUE_BDR_D}` }}>
                    <div className="w-10 h-10 rounded-[11px] flex items-center justify-center shrink-0"
                      style={{ background: iconBg, border: `0.5px solid ${iconBdr}` }}>
                      <BarChart3 className="w-[16px] h-[16px]" style={{ color: iconColor }} strokeWidth={2.3} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold truncate" style={{ color: T1, letterSpacing: "-0.1px" }}>{a.examTitle || a.topic || "Practice"}</div>
                      <div className="text-[10px] mt-[2px]" style={{ color: T3 }}>
                        {a.submittedAt?.toDate?.().toLocaleDateString(undefined, { month: "short", day: "numeric" }) || "—"} · {a.total || a.questionCount || 0}Q
                      </div>
                    </div>
                    <div className="text-[15px] font-bold shrink-0" style={{ color: iconColor, letterSpacing: "-0.3px" }}>{pct}%</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Documents + Summary Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Documents */}
        <div className="lg:col-span-2 bg-white rounded-[22px] p-6"
          style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(0,85,255,0.10)" }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-[17px] font-bold" style={{ color: T1, letterSpacing: "-0.3px" }}>Your Documents</div>
              <div className="text-[11px] font-normal mt-[3px]" style={{ color: T3 }}>Tap to practice from a saved syllabus</div>
            </div>
            <button onClick={() => setView("upload")}
              className="px-4 py-[8px] rounded-[12px] text-[12px] font-bold text-white flex items-center gap-[5px] transition-transform hover:scale-[1.02]"
              style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: SH_BTN_D }}>
              <Upload className="w-[12px] h-[12px]" strokeWidth={2.5} /> Upload New
            </button>
          </div>
          {documents.length === 0 ? (
            <div className="py-10 text-center">
              <div className="w-[64px] h-[64px] rounded-[20px] mx-auto mb-3 flex items-center justify-center"
                style={{ background: "rgba(0,85,255,0.06)", border: `0.5px solid ${BLUE_BDR_D}` }}>
                <FileText className="w-[28px] h-[28px]" style={{ color: B1 }} strokeWidth={1.8} />
              </div>
              <div className="text-[14px] font-bold mb-1" style={{ color: T1 }}>No documents yet</div>
              <div className="text-[12px]" style={{ color: T3 }}>Upload your first syllabus to generate AI practice exams.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {documents.slice(0, 6).map(doc => (
                <div key={doc.id} onClick={() => useDocument(doc)}
                  className="rounded-[14px] px-4 py-3 flex items-center gap-3 cursor-pointer transition-transform hover:-translate-y-[1px]"
                  style={{ background: BG_D, border: `0.5px solid ${BLUE_BDR_D}` }}>
                  <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0"
                    style={{ background: "rgba(0,85,255,0.10)", border: "0.5px solid rgba(0,85,255,0.20)" }}>
                    <FileText className="w-5 h-5" style={{ color: B1 }} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold truncate" style={{ color: T1, letterSpacing: "-0.2px" }}>{doc.fileName}</div>
                    <div className="text-[11px] mt-[2px]" style={{ color: T3 }}>{doc.pageCount || 0} pages · {doc.extractedTopics?.length || 0} topics</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary Dark Card */}
        <div className="rounded-[22px] px-6 py-6 relative overflow-hidden"
          style={{
            background: "linear-gradient(140deg, #001888 0%, #0033CC 48%, #0055FF 100%)",
            boxShadow: "0 8px 30px rgba(0,51,204,0.34), 0 0 0 0.5px rgba(255,255,255,0.14)",
          }}>
          <div className="absolute -top-10 -right-7 w-[200px] h-[200px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 65%)" }} />
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)",
            backgroundSize: "24px 24px"
          }} />
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2 relative z-10" style={{ color: "rgba(255,255,255,0.50)" }}>Exam History</div>
          <div className="text-[19px] font-bold mb-5 relative z-10 text-white" style={{ letterSpacing: "-0.3px" }}>Your Totals</div>
          <div className="grid grid-cols-3 rounded-[16px] overflow-hidden relative z-10" style={{ gap: "1px", background: "rgba(255,255,255,0.12)" }}>
            <div className="py-4 px-3 text-center" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="text-[24px] font-bold text-white leading-none mb-1" style={{ letterSpacing: "-0.6px" }}>{attempts.length}</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.09em]" style={{ color: "rgba(255,255,255,0.42)" }}>Total</div>
            </div>
            <div className="py-4 px-3 text-center" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="text-[24px] font-bold text-white leading-none mb-1" style={{ letterSpacing: "-0.6px" }}>{avgScoreD > 0 ? `${avgScoreD}%` : "—"}</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.09em]" style={{ color: "rgba(255,255,255,0.42)" }}>Avg</div>
            </div>
            <div className="py-4 px-3 text-center" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="text-[24px] font-bold text-white leading-none mb-1" style={{ letterSpacing: "-0.6px" }}>{bestScore > 0 ? `${bestScore}%` : "—"}</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.09em]" style={{ color: "rgba(255,255,255,0.42)" }}>Best</div>
            </div>
          </div>
        </div>
      </div>
    </DesktopShell>
  );

  // ── UPLOAD VIEW ───────────────────────────────────────────────────────────
  if (view === "upload") return (
    <DesktopShell>
      {/* Back */}
      <button onClick={() => setView("home")}
        className="flex items-center gap-2 mb-6 px-4 py-[8px] rounded-[12px] cursor-pointer"
        style={{ background: "#fff", border: `0.5px solid ${BLUE_BDR_D}`, boxShadow: SH_D, color: B1 }}>
        <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
        <span className="text-[13px] font-bold" style={{ letterSpacing: "-0.1px" }}>Back</span>
      </button>

      <div className="mb-6">
        <h1 className="text-[32px] font-bold leading-none" style={{ color: T1, letterSpacing: "-0.8px" }}>Upload Syllabus</h1>
        <div className="text-[13px] font-normal mt-[6px]" style={{ color: T3 }}>Upload a PDF of your chapter, notes, or syllabus. AI will generate a practice exam.</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
        {/* Drop Zone (col-3) */}
        <div className="lg:col-span-3">
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !extracting && fileInputRef.current?.click()}
            className="rounded-[22px] px-6 py-16 flex flex-col items-center gap-3 cursor-pointer transition-all"
            style={{
              border: `2px dashed ${(!!file || !!extractedText) ? "rgba(0,85,255,0.40)" : "rgba(0,85,255,0.25)"}`,
              background: (!!file || !!extractedText) ? "rgba(0,85,255,0.04)" : "rgba(255,255,255,0.70)",
              boxShadow: "0 0 0 6px rgba(0,85,255,0.04)",
            }}>
            {extracting ? (
              <Loader2 className="w-[80px] h-[80px] animate-spin" style={{ color: B1 }} />
            ) : (
              <div className="w-[80px] h-[80px] rounded-[24px] flex items-center justify-center mb-2"
                style={{
                  background: (!!file || !!extractedText) ? `linear-gradient(135deg, ${B1}, ${B3})` : `linear-gradient(135deg, ${BG_D}, ${BG2_D})`,
                  border: (!!file || !!extractedText) ? "none" : "0.5px solid rgba(0,85,255,0.18)",
                  boxShadow: (!!file || !!extractedText) ? SH_BTN_D : SH_D,
                }}>
                <Upload className="w-[34px] h-[34px]" style={{ color: (!!file || !!extractedText) ? "#fff" : "rgba(0,85,255,0.55)" }} strokeWidth={2.2} />
              </div>
            )}
            <div className="text-[20px] font-bold text-center px-3" style={{ color: T1, letterSpacing: "-0.4px" }}>
              {extracting ? "Reading PDF..." : file?.name || ((!!file || !!extractedText) ? "Syllabus Ready" : "Drop PDF Here")}
            </div>
            <div className="text-[13px] font-normal" style={{ color: T3 }}>or click to browse your files</div>
            <div className="text-[11px] font-semibold" style={{ color: T4 }}>Max 20 MB · PDF only</div>
            <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: "none" }}
              onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }} />
          </div>

          {/* CTA */}
          <button
            onClick={() => {
              if ((!!file || !!extractedText) && extractedText) setView("configure");
              else if (!extracting) fileInputRef.current?.click();
            }}
            disabled={extracting}
            className="mt-4 w-full h-14 rounded-[18px] flex items-center justify-center gap-2 text-[15px] font-bold text-white disabled:opacity-60 transition-transform hover:scale-[1.01] relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: SH_BTN_D, letterSpacing: "-0.1px" }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 52%)" }} />
            {extracting ? (
              <><Loader2 className="relative z-10 w-4 h-4 animate-spin" /><span className="relative z-10">Reading PDF…</span></>
            ) : (
              <><Upload className="relative z-10 w-4 h-4" strokeWidth={2.5} /><span className="relative z-10">Upload &amp; Generate Exam</span></>
            )}
          </button>
        </div>

        {/* Sidebar (col-2) */}
        <div className="lg:col-span-2 space-y-4">
          {/* AI hint card */}
          <div className="bg-white rounded-[22px] p-5 relative overflow-hidden"
            style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(0,85,255,0.10)" }}>
            <div className="absolute -top-[20px] -right-[20px] w-[120px] h-[120px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(0,85,255,0.06) 0%, transparent 70%)" }} />
            <div className="flex items-center gap-3 mb-3 relative z-10">
              <div className="w-11 h-11 rounded-[14px] flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: "0 3px 10px rgba(0,85,255,0.28)" }}>
                <Sparkles className="w-5 h-5 text-white" strokeWidth={2.3} />
              </div>
              <div className="text-[15px] font-bold" style={{ color: T1, letterSpacing: "-0.2px" }}>AI Generates 15-30 MCQs</div>
            </div>
            <div className="text-[12px] leading-[1.6] font-normal relative z-10" style={{ color: T3 }}>
              Tailored to your syllabus with instant grading, explanations, and targeted feedback on weak areas.
            </div>
          </div>

          {/* Supported formats */}
          <div className="bg-white rounded-[22px] p-5"
            style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(0,85,255,0.10)" }}>
            <div className="text-[10px] font-bold uppercase tracking-[0.10em] mb-3" style={{ color: T4 }}>Supported Formats</div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "PDF", color: RED_D, bg: "rgba(255,51,85,0.10)", bdr: "rgba(255,51,85,0.22)" },
                { label: "DOCX", color: B1, bg: "rgba(0,85,255,0.10)", bdr: "rgba(0,85,255,0.20)" },
                { label: "JPG / PNG", color: "#007830", bg: "rgba(0,200,83,0.10)", bdr: "rgba(0,200,83,0.22)" },
                { label: "TXT", color: T2, bg: "rgba(0,85,255,0.08)", bdr: "rgba(0,85,255,0.14)" },
              ].map(({ label, color, bg, bdr }) => (
                <div key={label} className="flex items-center gap-[5px] px-3 py-[6px] rounded-full text-[11px] font-bold"
                  style={{ background: bg, color, border: `0.5px solid ${bdr}` }}>
                  <FileText className="w-[11px] h-[11px]" strokeWidth={2.5} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Saved documents */}
          {documents.length > 0 && (
            <div className="bg-white rounded-[22px] p-5"
              style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(0,85,255,0.10)" }}>
              <div className="text-[15px] font-bold mb-3" style={{ color: T1, letterSpacing: "-0.3px" }}>Saved Documents</div>
              <div className="space-y-2">
                {documents.slice(0, 4).map(doc => (
                  <div key={doc.id} onClick={() => useDocument(doc)}
                    className="rounded-[13px] px-3 py-[10px] flex items-center gap-3 cursor-pointer transition-transform hover:-translate-y-[1px]"
                    style={{ background: BG_D, border: `0.5px solid ${BLUE_BDR_D}` }}>
                    <div className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0"
                      style={{ background: "rgba(0,85,255,0.10)", border: "0.5px solid rgba(0,85,255,0.20)" }}>
                      <FileText className="w-[16px] h-[16px]" style={{ color: B1 }} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold truncate" style={{ color: T1 }}>{doc.fileName}</div>
                      <div className="text-[10px] mt-[2px]" style={{ color: T3 }}>{doc.extractedTopics?.length || 0} topics</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Type-Topic modal (desktop) — same shape as the mobile one. */}
      {topicModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200"
          style={{ background: "rgba(0,16,64,0.45)", backdropFilter: "blur(8px)" }}
          onClick={() => setTopicModalOpen(false)}
        >
          <div
            className="w-full max-w-[480px] rounded-[24px] p-7 animate-in zoom-in-95 duration-200"
            style={{ background: "#fff", boxShadow: "0 24px 80px rgba(0,16,64,0.35)", fontFamily: "'DM Sans', sans-serif" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-[22px] font-bold" style={{ color: T1, letterSpacing: "-0.4px" }}>
                  Practice by Topic
                </h2>
                <p className="text-[13px] mt-1.5" style={{ color: T3 }}>
                  Enter a topic and optional notes. The AI will build questions from this.
                </p>
              </div>
              <button
                onClick={() => setTopicModalOpen(false)}
                className="w-9 h-9 rounded-[11px] flex items-center justify-center transition-colors hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-[16px] h-[16px]" style={{ color: T3 }} strokeWidth={2.4} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.1em] mb-[6px] block" style={{ color: T3 }}>
                  Topic <span style={{ color: RED_D }}>*</span>
                </label>
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  placeholder="e.g. Photosynthesis, Quadratic Equations, World War II"
                  maxLength={120}
                  autoFocus
                  className="w-full px-4 py-3 rounded-[14px] text-[14px] font-medium outline-none transition-all focus:ring-2"
                  style={{
                    background: BG_D,
                    border: `0.5px solid ${BLUE_BDR_D}`,
                    color: T1,
                  }}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.1em] mb-[6px] block" style={{ color: T3 }}>
                  Short description <span className="font-normal normal-case tracking-normal" style={{ color: T4 }}>(optional)</span>
                </label>
                <textarea
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  placeholder="Add a few lines of notes, key concepts, or focus areas — the AI will use this as study material."
                  maxLength={2000}
                  rows={6}
                  className="w-full px-4 py-3 rounded-[14px] text-[13px] outline-none resize-none leading-[1.5] transition-all"
                  style={{
                    background: BG_D,
                    border: `0.5px solid ${BLUE_BDR_D}`,
                    color: T1,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                />
                <p className="text-[10px] mt-1.5" style={{ color: T4 }}>
                  {descriptionInput.length}/2000 characters · Leave empty to let AI use general knowledge
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setTopicModalOpen(false)}
                className="flex-1 h-12 rounded-[13px] text-[13px] font-bold transition-colors hover:bg-slate-50"
                style={{
                  background: "#fff",
                  border: `0.5px solid ${BLUE_BDR_D}`,
                  color: T2,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleTopicModalSubmit}
                disabled={topicInput.trim().length < 2}
                className="flex-1 h-12 rounded-[13px] text-[13px] font-bold flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  background: `linear-gradient(135deg, ${B1}, ${B3})`,
                  color: "#fff",
                  boxShadow: SH_BTN_D,
                }}
              >
                Continue <ChevronRight className="w-[14px] h-[14px]" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      )}
    </DesktopShell>
  );

  // ── CONFIGURE VIEW ────────────────────────────────────────────────────────
  if (view === "configure") return (
    <DesktopShell>
      <button onClick={() => setView("upload")}
        className="flex items-center gap-2 mb-6 px-4 py-[8px] rounded-[12px] cursor-pointer"
        style={{ background: "#fff", border: `0.5px solid ${BLUE_BDR_D}`, boxShadow: SH_D, color: B1 }}>
        <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
        <span className="text-[13px] font-bold" style={{ letterSpacing: "-0.1px" }}>Back</span>
      </button>

      <div className="mb-6">
        <h1 className="text-[32px] font-bold leading-none" style={{ color: T1, letterSpacing: "-0.8px" }}>Configure Exam</h1>
        <div className="text-[13px] font-normal mt-[6px]" style={{ color: T3 }}>
          <strong style={{ color: B1 }}>{file?.name || "Saved document"}</strong> · {pageCount} pages · {extractedTopics.length} topics
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Config Card (col-2) */}
        <div className="lg:col-span-2 bg-white rounded-[22px] p-6 space-y-6"
          style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(0,85,255,0.10)" }}>

          {/* Topic */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.10em] mb-3" style={{ color: T4 }}>Topic</div>
            <div className="flex flex-wrap gap-2">
              {extractedTopics.map(t => {
                const isActive = topic === t;
                return (
                  <button key={t} onClick={() => setTopic(t)}
                    className="px-4 py-[8px] rounded-[12px] text-[12px] font-bold transition-transform hover:scale-[1.02]"
                    style={isActive ? {
                      background: `linear-gradient(135deg, ${B1}, ${B2})`, color: "#fff",
                      boxShadow: SH_BTN_D,
                    } : {
                      background: BG_D, color: T3,
                      border: `0.5px solid ${BLUE_BDR_D}`,
                    }}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.10em] mb-3" style={{ color: T4 }}>Difficulty</div>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map(d => {
                const isActive = difficulty === d;
                const colorMap: Record<string, string> = { Easy: GREEN_D, Medium: ORANGE_D, Hard: RED_D };
                const col = colorMap[d];
                return (
                  <button key={d} onClick={() => setDifficulty(d)}
                    className="h-12 rounded-[14px] text-[14px] font-bold transition-transform hover:scale-[1.02]"
                    style={isActive ? {
                      background: `linear-gradient(135deg, ${col}, ${col}dd)`, color: "#fff",
                      boxShadow: `0 3px 12px ${col}55`,
                    } : {
                      background: BG_D, color: T3,
                      border: `0.5px solid ${BLUE_BDR_D}`,
                    }}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Type */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.10em] mb-3" style={{ color: T4 }}>Question Type</div>
            <div className="flex flex-wrap gap-2">
              {Q_TYPES.map(q => {
                const isActive = questionType === q.id;
                return (
                  <button key={q.id} onClick={() => setQuestionType(q.id)}
                    className="px-5 py-[10px] rounded-[12px] text-[12px] font-bold transition-transform hover:scale-[1.02]"
                    style={isActive ? {
                      background: `linear-gradient(135deg, ${B1}, ${B2})`, color: "#fff",
                      boxShadow: SH_BTN_D,
                    } : {
                      background: BG_D, color: T3,
                      border: `0.5px solid ${BLUE_BDR_D}`,
                    }}>
                    {q.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Count */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.10em] mb-3" style={{ color: T4 }}>Number of Questions</div>
            <div className="grid grid-cols-4 gap-2">
              {Q_COUNTS.map(n => {
                const isActive = questionCount === n;
                return (
                  <button key={n} onClick={() => setQuestionCount(n)}
                    className="h-12 rounded-[14px] text-[15px] font-bold transition-transform hover:scale-[1.02]"
                    style={isActive ? {
                      background: "linear-gradient(135deg, #001040, #002080)", color: "#fff",
                      boxShadow: "0 4px 14px rgba(0,16,64,0.32)",
                    } : {
                      background: BG_D, color: T3,
                      border: `0.5px solid ${BLUE_BDR_D}`,
                    }}>
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Limit */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.10em] mb-3" style={{ color: T4 }}>Time Limit</div>
            <div className="flex flex-wrap gap-2">
              {TIME_LIMITS.map(t => {
                const isActive = timeLimit === t.val;
                return (
                  <button key={t.val} onClick={() => setTimeLimit(t.val)}
                    className="px-4 py-[10px] rounded-[12px] text-[12px] font-bold flex items-center gap-[5px] transition-transform hover:scale-[1.02]"
                    style={isActive ? {
                      background: "linear-gradient(135deg, #00C4B4, #22DDCC)", color: "#fff",
                      boxShadow: "0 3px 12px rgba(0,196,180,0.32)",
                    } : {
                      background: BG_D, color: T3,
                      border: `0.5px solid ${BLUE_BDR_D}`,
                    }}>
                    <Clock className="w-[11px] h-[11px]" strokeWidth={2.5} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Summary + Generate (col-1) */}
        <div className="space-y-4">
          {/* Summary dark card */}
          <div className="rounded-[22px] px-5 py-6 relative overflow-hidden"
            style={{
              background: "linear-gradient(140deg, #001888 0%, #0033CC 48%, #0055FF 100%)",
              boxShadow: "0 8px 30px rgba(0,51,204,0.34), 0 0 0 0.5px rgba(255,255,255,0.14)",
            }}>
            <div className="absolute -top-[30px] -right-[20px] w-[160px] h-[160px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 65%)" }} />
            <div className="relative z-10">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: "rgba(255,255,255,0.50)" }}>Exam Preview</div>
              <div className="space-y-3">
                {[
                  { label: "Topic", val: topic || "—" },
                  { label: "Difficulty", val: difficulty },
                  { label: "Type", val: Q_TYPES.find(q => q.id === questionType)?.label || questionType },
                  { label: "Questions", val: `${questionCount}` },
                  { label: "Time", val: TIME_LIMITS.find(t => t.val === timeLimit)?.label || "—" },
                ].map(({ label, val }) => (
                  <div key={label} className="flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(255,255,255,0.10)", paddingBottom: 10 }}>
                    <span className="text-[11px] font-bold uppercase tracking-[0.10em]" style={{ color: "rgba(255,255,255,0.50)" }}>{label}</span>
                    <span className="text-[13px] font-bold text-white truncate max-w-[160px]" style={{ letterSpacing: "-0.1px" }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Generate button */}
          <button onClick={handleGenerateExam} disabled={generating}
            className="w-full h-14 rounded-[18px] flex items-center justify-center gap-2 text-[15px] font-bold text-white disabled:opacity-60 transition-transform hover:scale-[1.02] relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: SH_BTN_D, letterSpacing: "-0.1px" }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 52%)" }} />
            {generating ? <Loader2 className="relative z-10 w-5 h-5 animate-spin" /> : <Sparkles className="relative z-10 w-5 h-5" strokeWidth={2.3} />}
            <span className="relative z-10">{generating ? "Generating…" : "Generate Exam"}</span>
          </button>

          <div className="bg-white rounded-[16px] p-4 text-[11px] leading-[1.55] font-normal flex items-start gap-2"
            style={{ boxShadow: SH_D, border: "0.5px solid rgba(0,85,255,0.10)", color: T3 }}>
            <Sparkles className="w-[12px] h-[12px] shrink-0 mt-[2px]" style={{ color: B1 }} strokeWidth={2.3} />
            AI tailors the question difficulty and mixes topics based on what you configured.
          </div>
        </div>
      </div>
    </DesktopShell>
  );

  // ── EXAM VIEW ─────────────────────────────────────────────────────────────
  if (view === "exam") {
    const q = questions[currentQ];
    const timerStr = timeLimit > 0 ? `${Math.floor(timerSec / 60)}:${String(timerSec % 60).padStart(2, "0")}` : "";
    const answered = answers.filter(a => a !== "").length;
    const timerLow = timerSec < 60;

    return (
      <DesktopShell>
        {/* ── Exam Header Hero ── */}
        <div className="rounded-[26px] px-8 py-6 mb-5 relative overflow-hidden"
          style={{
            background: timerLow && timerStr
              ? "linear-gradient(140deg, #661122 0%, #991133 50%, #CC1144 100%)"
              : "linear-gradient(140deg, #001888 0%, #0033CC 48%, #0055FF 100%)",
            boxShadow: "0 8px 30px rgba(0,51,204,0.34), 0 0 0 0.5px rgba(255,255,255,0.14)",
          }}>
          <div className="absolute -top-[40px] -right-[30px] w-[260px] h-[260px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 65%)" }} />
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>{examTitle}</div>
              <div className="text-[28px] font-bold text-white leading-none" style={{ letterSpacing: "-0.6px" }}>
                Question {currentQ + 1} <span style={{ color: "rgba(255,255,255,0.45)" }}>/ {questions.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {timerStr && (
                <div className="px-4 py-3 rounded-[14px] flex items-center gap-2"
                  style={{ background: "rgba(255,255,255,0.14)", border: "0.5px solid rgba(255,255,255,0.22)", backdropFilter: "blur(8px)" }}>
                  <Clock className="w-[16px] h-[16px] text-white" strokeWidth={2.5} />
                  <span className="text-[16px] font-bold text-white tabular-nums" style={{ letterSpacing: "-0.3px" }}>{timerStr}</span>
                </div>
              )}
              <div className="px-4 py-3 rounded-[14px] text-[13px] font-bold text-white"
                style={{ background: "rgba(255,255,255,0.14)", border: "0.5px solid rgba(255,255,255,0.22)", backdropFilter: "blur(8px)" }}>
                {answered} <span style={{ color: "rgba(255,255,255,0.55)" }}>/ {questions.length}</span> answered
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-5 h-[6px] rounded-full relative z-10" style={{ background: "rgba(255,255,255,0.16)" }}>
            <div className="h-full rounded-full" style={{ width: `${((currentQ + 1) / questions.length) * 100}%`, background: "#fff", boxShadow: "0 0 10px rgba(255,255,255,0.5)", transition: "width 0.3s" }} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Question Card (col-3) */}
          <div className="lg:col-span-3 bg-white rounded-[22px] p-8"
            style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(0,85,255,0.10)" }}>
            {q && (
              <>
                <div className="flex items-center gap-2 mb-5">
                  <div className="px-[10px] py-[5px] rounded-full text-[10px] font-bold uppercase tracking-[0.10em]"
                    style={{ background: "rgba(0,85,255,0.10)", color: B1, border: `0.5px solid ${BLUE_BDR_D}` }}>
                    {q.type.replace(/_/g, " ")}
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: T4 }}>{difficulty}</div>
                </div>

                <p className="text-[20px] font-semibold leading-[1.5] mb-6" style={{ color: T1, letterSpacing: "-0.3px" }}>
                  {q.questionText}
                </p>

                {(q.type === "mcq" || q.type === "true_false") && q.options.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {q.options.map((opt, oi) => {
                      const selected = answers[currentQ] === opt;
                      return (
                        <button key={oi} onClick={() => {
                          const newAns = [...answers]; newAns[currentQ] = opt; setAnswers(newAns);
                        }}
                          className="text-left px-5 py-4 rounded-[16px] flex items-center gap-3 transition-transform hover:-translate-y-[1px]"
                          style={selected ? {
                            background: `linear-gradient(135deg, ${B1}, ${B2})`,
                            color: "#fff",
                            border: "0.5px solid rgba(255,255,255,0.2)",
                            boxShadow: SH_BTN_D,
                          } : {
                            background: BG_D,
                            color: T2,
                            border: `0.5px solid ${BLUE_BDR_D}`,
                          }}>
                          <span className="w-9 h-9 rounded-[11px] flex items-center justify-center text-[14px] font-bold shrink-0"
                            style={{
                              background: selected ? "rgba(255,255,255,0.22)" : "#fff",
                              color: selected ? "#fff" : T3,
                              border: selected ? "none" : `0.5px solid ${BLUE_BDR_D}`,
                            }}>
                            {String.fromCharCode(65 + oi)}
                          </span>
                          <span className="text-[14px] font-medium">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {(q.type === "fill_blank" || q.type === "short_answer") && (
                  <textarea
                    value={answers[currentQ] || ""}
                    onChange={e => { const newAns = [...answers]; newAns[currentQ] = e.target.value; setAnswers(newAns); }}
                    placeholder={q.type === "fill_blank" ? "Type your answer..." : "Write your answer (2-3 sentences)..."}
                    rows={q.type === "short_answer" ? 5 : 3}
                    className="w-full px-5 py-4 rounded-[16px] text-[14px] outline-none resize-none leading-[1.6]"
                    style={{ background: BG_D, border: `0.5px solid ${BLUE_BDR_D}`, color: T1, fontFamily: "DM Sans, sans-serif" }}
                  />
                )}
              </>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-8">
              {currentQ > 0 && (
                <button onClick={() => setCurrentQ(currentQ - 1)}
                  className="flex-1 h-12 rounded-[14px] flex items-center justify-center gap-2 text-[13px] font-bold transition-transform hover:scale-[1.01]"
                  style={{ background: "#fff", color: T2, border: `0.5px solid ${BLUE_BDR_D}`, boxShadow: SH_D }}>
                  <ChevronLeft className="w-4 h-4" strokeWidth={2.5} /> Previous
                </button>
              )}
              {currentQ < questions.length - 1 ? (
                <button onClick={() => setCurrentQ(currentQ + 1)}
                  className="flex-1 h-12 rounded-[14px] flex items-center justify-center gap-2 text-[13px] font-bold text-white transition-transform hover:scale-[1.01]"
                  style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: SH_BTN_D, letterSpacing: "-0.1px" }}>
                  Next <ChevronLeft className="w-4 h-4 rotate-180" strokeWidth={2.5} />
                </button>
              ) : (
                <button onClick={handleSubmitExam}
                  className="flex-1 h-12 rounded-[14px] flex items-center justify-center gap-2 text-[13px] font-bold text-white transition-transform hover:scale-[1.01]"
                  style={{ background: `linear-gradient(135deg, ${GREEN_D}, #22EE66)`, boxShadow: "0 4px 14px rgba(0,200,83,0.36)", letterSpacing: "-0.1px" }}>
                  ✓ Submit Exam
                </button>
              )}
            </div>
          </div>

          {/* Question dots (col-1) */}
          <div className="bg-white rounded-[22px] p-6"
            style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(0,85,255,0.10)" }}>
            <div className="text-[15px] font-bold mb-4" style={{ color: T1, letterSpacing: "-0.3px" }}>All Questions</div>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((_, i) => {
                const isCurrent = i === currentQ;
                const isAnswered = !!answers[i];
                return (
                  <button key={i} onClick={() => setCurrentQ(i)}
                    className="aspect-square rounded-[10px] flex items-center justify-center text-[12px] font-bold transition-transform hover:scale-105"
                    style={isCurrent ? {
                      background: `linear-gradient(135deg, ${B1}, ${B2})`, color: "#fff",
                      boxShadow: SH_BTN_D,
                    } : isAnswered ? {
                      background: `linear-gradient(135deg, ${GREEN_D}, #22EE66)`, color: "#fff",
                      boxShadow: "0 2px 8px rgba(0,200,83,0.28)",
                    } : {
                      background: BG_D, color: T3,
                      border: `0.5px solid ${BLUE_BDR_D}`,
                    }}>
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 pt-4 space-y-2" style={{ borderTop: `0.5px solid ${BLUE_BDR_D}` }}>
              <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: T3 }}>
                <div className="w-3 h-3 rounded-[4px]" style={{ background: `linear-gradient(135deg, ${B1}, ${B2})` }} />
                Current
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: T3 }}>
                <div className="w-3 h-3 rounded-[4px]" style={{ background: `linear-gradient(135deg, ${GREEN_D}, #22EE66)` }} />
                Answered
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: T3 }}>
                <div className="w-3 h-3 rounded-[4px]" style={{ background: BG_D, border: `0.5px solid ${BLUE_BDR_D}` }} />
                Not yet
              </div>
            </div>
          </div>
        </div>
      </DesktopShell>
    );
  }

  // ── RESULTS VIEW ──────────────────────────────────────────────────────────
  if (view === "results") {
    const pct = result?.percentage || 0;
    const passed = pct >= 80;
    const review = pct >= 50 && pct < 80;
    const scoreColor = passed ? GREEN_D : review ? ORANGE_D : RED_D;
    const heroGrad = evaluating
      ? "linear-gradient(140deg, #001888 0%, #0033CC 48%, #0055FF 100%)"
      : passed
        ? "linear-gradient(140deg, #005A22 0%, #00A040 50%, #00C853 100%)"
        : review
          ? "linear-gradient(140deg, #663300 0%, #CC6600 50%, #FF8800 100%)"
          : "linear-gradient(140deg, #661122 0%, #AA1144 50%, #FF3355 100%)";

    return (
      <DesktopShell>
        {/* ── Score Hero ── */}
        <div className="rounded-[26px] px-10 py-10 mb-5 relative overflow-hidden"
          style={{ background: heroGrad, boxShadow: "0 8px 30px rgba(0,51,204,0.34), 0 0 0 0.5px rgba(255,255,255,0.14)" }}>
          <div className="absolute -top-[50px] -right-[40px] w-[340px] h-[340px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 65%)" }} />
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px)",
            backgroundSize: "24px 24px"
          }} />
          {evaluating ? (
            <div className="relative z-10 text-center py-6">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-white animate-spin" />
              <div className="text-[22px] font-bold text-white mb-2" style={{ letterSpacing: "-0.4px" }}>AI is evaluating your answers…</div>
              <div className="text-[13px]" style={{ color: "rgba(255,255,255,0.7)" }}>This may take a few seconds</div>
            </div>
          ) : result ? (
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {examTitle} · Your Result
                </div>
                <div className="text-[80px] font-bold text-white leading-none mb-2" style={{ letterSpacing: "-2px" }}>
                  {pct}<span className="text-[48px]" style={{ color: "rgba(255,255,255,0.55)" }}>%</span>
                </div>
                <div className="text-[18px] font-bold text-white mb-2" style={{ letterSpacing: "-0.3px" }}>
                  {result.score} / {result.total} correct · Grade {result.grade}
                </div>
                <p className="text-[14px] leading-[1.6]" style={{ color: "rgba(255,255,255,0.75)" }}>
                  {result.encouragement || "Keep practicing to improve!"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: CheckCircle2, val: result.score, label: "Correct", bg: "rgba(255,255,255,0.14)" },
                  { icon: XCircle, val: (result.total || 0) - (result.score || 0), label: "Wrong", bg: "rgba(255,255,255,0.14)" },
                  { icon: Clock, val: timeLimit > 0 ? `${Math.floor((timeLimit * 60 - timerSec) / 60)}m` : "—", label: "Time", bg: "rgba(255,255,255,0.14)" },
                  { icon: Award, val: result.grade || "—", label: "Grade", bg: "rgba(255,255,255,0.14)" },
                ].map(({ icon: Icon, val, label, bg }) => (
                  <div key={label} className="rounded-[16px] py-4 px-4 flex flex-col gap-2"
                    style={{ background: bg, border: "0.5px solid rgba(255,255,255,0.22)", backdropFilter: "blur(8px)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-[0.10em]" style={{ color: "rgba(255,255,255,0.55)" }}>{label}</span>
                      <Icon className="w-4 h-4" style={{ color: "rgba(255,255,255,0.7)" }} strokeWidth={2.3} />
                    </div>
                    <div className="text-[24px] font-bold text-white leading-none" style={{ letterSpacing: "-0.5px" }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {result && !evaluating && (
          <>
            {/* ── Action Row + Weak Topics ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
              {/* Weak topics */}
              {result.weakTopics?.length > 0 ? (
                <div className="lg:col-span-2 bg-white rounded-[22px] p-6"
                  style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(0,85,255,0.10)" }}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 rounded-[12px] flex items-center justify-center"
                      style={{ background: "rgba(255,51,85,0.10)", border: "0.5px solid rgba(255,51,85,0.22)" }}>
                      <Lightbulb className="w-5 h-5" style={{ color: RED_D }} strokeWidth={2.3} />
                    </div>
                    <div>
                      <div className="text-[17px] font-bold" style={{ color: T1, letterSpacing: "-0.3px" }}>Weak Areas to Focus On</div>
                      <div className="text-[11px] font-normal mt-[2px]" style={{ color: T3 }}>Topics AI identified for improvement</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.weakTopics.map((t: string, i: number) => (
                      <div key={i} className="px-4 py-[8px] rounded-full text-[12px] font-bold"
                        style={{ background: "rgba(255,51,85,0.08)", color: RED_D, border: "0.5px solid rgba(255,51,85,0.22)" }}>
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="lg:col-span-2 bg-white rounded-[22px] p-6"
                  style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(0,85,255,0.10)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5" style={{ color: GREEN_D }} strokeWidth={2.3} />
                    <div className="text-[17px] font-bold" style={{ color: T1, letterSpacing: "-0.3px" }}>Great Performance!</div>
                  </div>
                  <div className="text-[13px]" style={{ color: T3 }}>No weak areas flagged. Keep up the consistent practice.</div>
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-3">
                <button onClick={handleRetry}
                  className="w-full h-14 rounded-[16px] flex items-center justify-center gap-2 text-[14px] font-bold transition-transform hover:scale-[1.02]"
                  style={{ background: "#fff", color: T2, border: `0.5px solid ${BLUE_BDR_D}`, boxShadow: SH_D }}>
                  <RefreshCw className="w-[16px] h-[16px]" strokeWidth={2.3} />
                  Try Again
                </button>
                <button onClick={handleNewExam}
                  className="w-full h-14 rounded-[16px] flex items-center justify-center gap-2 text-[14px] font-bold text-white transition-transform hover:scale-[1.02]"
                  style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: SH_BTN_D, letterSpacing: "-0.1px" }}>
                  <Sparkles className="w-[16px] h-[16px]" strokeWidth={2.3} /> New Exam
                </button>
              </div>
            </div>

            {/* ── Per-question breakdown ── */}
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: T4 }}>Question Breakdown</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {(result.evaluations || []).map((ev: any, i: number) => {
                const q = questions[i];
                if (!q) return null;
                const correct = !!ev.correct;
                return (
                  <div key={i} className="bg-white rounded-[18px] p-5 relative overflow-hidden"
                    style={{ boxShadow: SH_D, border: "0.5px solid rgba(0,85,255,0.10)" }}>
                    <div className="absolute left-0 top-0 bottom-0 w-[4px] rounded-l-[2px]"
                      style={{ background: correct ? `linear-gradient(180deg, ${GREEN_D}, #66EE88)` : `linear-gradient(180deg, ${RED_D}, #FF88AA)` }} />

                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-[10px] flex items-center justify-center"
                        style={{ background: correct ? "rgba(0,200,83,0.10)" : "rgba(255,51,85,0.10)", border: `0.5px solid ${correct ? "rgba(0,200,83,0.22)" : "rgba(255,51,85,0.22)"}` }}>
                        {correct ? <CheckCircle2 className="w-[16px] h-[16px]" style={{ color: GREEN_D }} strokeWidth={2.5} /> : <XCircle className="w-[16px] h-[16px]" style={{ color: RED_D }} strokeWidth={2.5} />}
                      </div>
                      <span className="text-[12px] font-bold" style={{ color: correct ? "#007830" : RED_D }}>
                        Q{q.questionNo} — {correct ? "Correct" : "Wrong"}
                      </span>
                    </div>

                    <p className="text-[13px] font-semibold leading-[1.5] mb-3" style={{ color: T1 }}>{q.questionText}</p>

                    {!correct && (
                      <>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="px-3 py-[10px] rounded-[12px]"
                            style={{ background: "rgba(255,51,85,0.06)", border: "0.5px solid rgba(255,51,85,0.18)" }}>
                            <div className="text-[9px] font-bold uppercase tracking-[0.10em] mb-[4px]" style={{ color: RED_D }}>Your Answer</div>
                            <div className="text-[12px]" style={{ color: RED_D }}>{ev.studentAnswer || "—"}</div>
                          </div>
                          <div className="px-3 py-[10px] rounded-[12px]"
                            style={{ background: "rgba(0,200,83,0.06)", border: "0.5px solid rgba(0,200,83,0.18)" }}>
                            <div className="text-[9px] font-bold uppercase tracking-[0.10em] mb-[4px]" style={{ color: "#007830" }}>Correct</div>
                            <div className="text-[12px]" style={{ color: "#007830" }}>{ev.correctAnswer || q.correctAnswer}</div>
                          </div>
                        </div>
                        {ev.explanation && (
                          <div className="px-3 py-[10px] rounded-[12px]"
                            style={{ background: "rgba(0,85,255,0.06)", border: "0.5px solid rgba(0,85,255,0.18)" }}>
                            <div className="text-[9px] font-bold uppercase tracking-[0.10em] mb-[4px] flex items-center gap-[4px]" style={{ color: B1 }}>
                              <Lightbulb className="w-[10px] h-[10px]" strokeWidth={2.5} /> Why?
                            </div>
                            <p className="text-[12px] leading-[1.55]" style={{ color: T2 }}>{ev.explanation}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DesktopShell>
    );
  }

  return null;
};

export default AIPracticePage;