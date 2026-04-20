import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Loader2, Upload, Plus, Sparkles, Bell, FileText, Image as ImageIcon, MessageSquare, HardDrive, ChevronLeft, BarChart3 } from "lucide-react";
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

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

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
        await addDoc(collection(db, "practice_attempts"), {
          studentId, studentName,
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

        {/* ── AI Hero Card ── */}
        <div className="mx-[18px] mt-[14px] rounded-[26px] px-5 pt-[18px] pb-[22px] relative overflow-hidden"
          style={{ background: "linear-gradient(140deg, #0033CC 0%, #0055FF 40%, #2277FF 70%, #55AAFF 100%)", boxShadow: SH_BTN }}>
          <div className="absolute -top-11 -right-8 w-[200px] h-[200px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.16) 0%, transparent 65%)" }} />
          <div className="absolute -bottom-9 -left-5 w-[150px] h-[150px] rounded-full pointer-events-none"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }} />
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px)",
            backgroundSize: "22px 22px"
          }} />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-[5px] px-3 py-[5px] rounded-full mb-[14px] text-[9px] font-bold uppercase tracking-[0.10em]"
              style={{ background: "rgba(255,255,255,0.18)", border: "0.5px solid rgba(255,255,255,0.28)", color: "rgba(255,255,255,0.80)", backdropFilter: "blur(8px)" }}>
              <Sparkles className="w-[11px] h-[11px]" strokeWidth={2.5} />
              AI Powered · USP Feature
            </div>
            <h1 className="text-[32px] font-bold text-white leading-[1.08] mb-2" style={{ letterSpacing: "-0.8px" }}>
              AI Practice<br />Exams
            </h1>
            <p className="text-[12px] leading-[1.6] font-normal mb-[18px]" style={{ color: "rgba(255,255,255,0.65)" }}>
              Upload syllabus, take AI exams,<br />learn from mistakes.
            </p>

            {/* Stat chips */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: "🔥", val: `${streak}d`, label: "Streak" },
                { icon: <BarChart3 className="w-[18px] h-[18px]" style={{ color: "rgba(255,255,255,0.80)" }} strokeWidth={2.2} />, val: `${attempts.length}`, label: "Exams" },
                { icon: "⭐", val: bestScore > 0 ? `${bestScore}%` : "—", label: "Best" },
              ].map(({ icon, val, label }) => (
                <div key={label} className="rounded-[16px] py-[13px] px-[10px] flex flex-col items-center gap-[5px]"
                  style={{ background: "rgba(255,255,255,0.14)", border: "0.5px solid rgba(255,255,255,0.22)", backdropFilter: "blur(8px)" }}>
                  <div className="h-[22px] flex items-center justify-center text-[18px] leading-none mb-[2px]">
                    {typeof icon === "string" ? icon : icon}
                  </div>
                  <div className="text-[20px] font-bold text-white leading-none" style={{ letterSpacing: "-0.5px" }}>{val}</div>
                  <div className="text-[8px] font-bold uppercase tracking-[0.10em]" style={{ color: "rgba(255,255,255,0.50)" }}>{label}</div>
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
        <div className="mx-[18px] mt-3 rounded-[22px] px-[18px] py-[18px]"
          style={{ background: CARD, boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
          <div className="text-[15px] font-bold" style={{ color: T1, letterSpacing: "-0.3px" }}>Practice Calendar</div>
          <div className="text-[11px] font-normal mt-[3px] mb-[14px]" style={{ color: T3 }}>{practiceDates.size} days practiced this year</div>

          {/* Heatmap 18×7 grid */}
          <div className="grid gap-[3px] mb-[10px]" style={{ gridTemplateColumns: "repeat(18, 1fr)" }}>
            {recentDays.map((day, idx) => {
              const dateStr = toLocalDateStr(day.date);
              const isToday = dateStr === todayStr;
              const isFuture = day.date > new Date();
              let bg = BG2;
              if (day.level > 0) bg = B1;
              const cellStyle: React.CSSProperties = {
                aspectRatio: "1",
                borderRadius: 3,
                background: isFuture ? "transparent" : bg,
                opacity: isFuture ? 0.15 : 1,
              };
              if (isToday) {
                cellStyle.background = B1;
                cellStyle.boxShadow = "0 0 0 2px rgba(0,85,255,0.30), 0 0 0 4px rgba(0,85,255,0.10)";
              }
              return <div key={idx} style={cellStyle} title={day.date.toLocaleDateString()} />;
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-[6px] text-[10px] font-semibold" style={{ color: T4 }}>
            <span>Less</span>
            {[BG2, "rgba(0,85,255,0.15)", "rgba(0,85,255,0.30)", "rgba(0,85,255,0.55)", B1].map((c, i) => (
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

    // Prompt user for a manual topic (Type Topic flow)
    const handleTypeTopic = () => {
      const input = window.prompt("Enter a topic or paste your notes:");
      if (!input || input.trim().length < 3) return;
      const text = input.trim();
      setExtractedText(text);
      setExtractedTopics([text.slice(0, 60)]);
      setTopic(text.slice(0, 60));
      setFile(null);
      setPageCount(0);
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
      </div>
    );
  }

  // ── HOME VIEW (Desktop) ──────────────────────────────────────────────────
  if (view === "home") return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      {/* Hero */}
      <div style={{ background: "linear-gradient(145deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)", padding: "28px 20px 24px", borderRadius: "0 0 28px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div style={{ padding: "5px 12px", borderRadius: 20, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round"><path d="M5 1L6.5 4H9L7 6L7.8 9L5 7.5L2.2 9L3 6L1 4H3.5Z" /></svg>
            AI POWERED
          </div>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>USP Feature</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", lineHeight: 1.15, marginBottom: 6 }}>
          AI Practice<br />Exams
        </h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
          Upload syllabus, take AI exams, learn from mistakes.
        </p>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          {[
            { label: "Streak", val: `${streak}d`, icon: "🔥" },
            { label: "Exams", val: `${attempts.length}`, icon: "📝" },
            { label: "Best", val: bestScore > 0 ? `${bestScore}%` : "—", icon: "⭐" },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, padding: "10px 8px", borderRadius: 14, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", textAlign: "center" }}>
              <p style={{ fontSize: 16, marginBottom: 2 }}>{s.icon}</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>{s.val}</p>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 2, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 16px 100px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ── GitHub-style Heatmap Calendar ──────────────────────────── */}
        <div style={card}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.s2}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: 0 }}>Practice Calendar</p>
              <p style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>{practiceDates.size} days practiced this year</p>
            </div>
            {streak > 0 && (
              <div style={{ padding: "4px 10px", borderRadius: 20, background: "#fef3c7", fontSize: 11, fontWeight: 600, color: "#92400e" }}>
                🔥 {streak} day streak
              </div>
            )}
          </div>
          <div style={{ padding: "12px 16px", overflowX: "auto" }}>
            <div style={{ display: "flex", gap: 2, minWidth: 700 }}>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {week.map((day, di) => {
                    const today = new Date();
                    const isToday = day.date.toDateString() === today.toDateString();
                    const isFuture = day.date > today;
                    return (
                      <div
                        key={di}
                        title={day.date.toLocaleDateString()}
                        style={{
                          width: 12, height: 12, borderRadius: 3,
                          background: isFuture ? "transparent"
                            : day.level > 0 ? "#22c55e"
                            : "#e2e8f0",
                          border: isToday ? "2px solid #6741D9" : "none",
                          opacity: isFuture ? 0.2 : 1,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 10, color: C.ink3 }}>
              Less
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#e2e8f0" }} />
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#86efac" }} />
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#22c55e" }} />
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#15803d" }} />
              More
            </div>
          </div>
        </div>

        {/* ── New Practice Exam Button ──────────────────────────────── */}
        <button onClick={() => setView("upload")} style={btnPrimary}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" />
          </svg>
          New Practice Exam
        </button>

        {/* ── Previously Uploaded Documents ─────────────────────────── */}
        {documents.length > 0 && (
          <div style={card}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.s2}` }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, margin: 0 }}>Your Documents</p>
              <p style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>Tap to practice from a saved syllabus</p>
            </div>
            {documents.map((doc, i) => (
              <div key={doc.id} onClick={() => useDocument(doc)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                borderBottom: i < documents.length - 1 ? `1px solid ${C.s2}` : "none",
                cursor: "pointer",
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: C.plBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={C.pur} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="2" width="10" height="12" rx="1.5" /><line x1="5.5" y1="6" x2="10.5" y2="6" /><line x1="5.5" y1="8.5" x2="9" y2="8.5" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: C.ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.fileName}</p>
                  <p style={{ fontSize: 10, color: C.ink3, marginTop: 2 }}>{doc.pageCount || 0} pages · {doc.extractedTopics?.length || 0} topics</p>
                </div>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke={C.ink3} strokeWidth="1.5" strokeLinecap="round"><polyline points="5,3 9,6.5 5,10" /></svg>
              </div>
            ))}
          </div>
        )}

        {/* ── Recent Attempts ──────────────────────────────────────── */}
        {attempts.length > 0 && (
          <div style={card}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.s2}` }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, margin: 0 }}>Recent Attempts</p>
            </div>
            {attempts.slice(0, 5).map((a, i) => {
              const scoreColor = (a.percentage || 0) >= 80 ? C.grn : (a.percentage || 0) >= 50 ? C.amb : C.red;
              return (
                <div key={a.id} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                  borderBottom: i < Math.min(attempts.length, 5) - 1 ? `1px solid ${C.s2}` : "none",
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${scoreColor}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: scoreColor }}>
                    {a.grade || "-"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: C.ink, margin: 0 }}>{a.examTitle || a.topic || "Practice"}</p>
                    <p style={{ fontSize: 10, color: C.ink3, marginTop: 2 }}>
                      {a.score}/{a.total} · {a.difficulty} · {a.submittedAt?.toDate?.().toLocaleDateString() || ""}
                    </p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: scoreColor }}>{a.percentage || 0}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ── UPLOAD VIEW ───────────────────────────────────────────────────────────
  if (view === "upload") return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "20px 16px 100px" }}>
      <button onClick={() => setView("home")} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", marginBottom: 20, fontSize: 13, color: C.pur, fontWeight: 500 }}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke={C.pur} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="8,2 3,6.5 8,11" /></svg>
        Back
      </button>

      <h2 style={{ fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Upload Syllabus</h2>
      <p style={{ fontSize: 13, color: C.ink3, marginBottom: 20 }}>Upload a PDF of your chapter, notes, or syllabus.</p>

      {/* Dropzone */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${C.plBdr}`, borderRadius: 18, padding: "40px 20px",
          background: C.plBg, display: "flex", flexDirection: "column",
          alignItems: "center", gap: 10, cursor: "pointer", textAlign: "center",
        }}
      >
        {extracting ? (
          <Loader2 style={{ width: 32, height: 32, color: C.pur }} className="animate-spin" />
        ) : (
          <div style={{ width: 52, height: 52, borderRadius: 16, background: `${C.pur}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.pur} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="3" width="16" height="18" rx="2" /><line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="8" y1="15" x2="12" y2="15" />
            </svg>
          </div>
        )}
        <p style={{ fontSize: 14, fontWeight: 600, color: C.pur }}>{extracting ? "Reading PDF..." : "Drop PDF here"}</p>
        <p style={{ fontSize: 12, color: C.pur, opacity: 0.6 }}>or tap to browse · Max 20 MB</p>
        <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: "none" }}
          onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }} />
      </div>

      {/* Previously uploaded */}
      {documents.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: C.ink3, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Or use a saved document</p>
          {documents.map(doc => (
            <div key={doc.id} onClick={() => useDocument(doc)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
              background: C.white, border: `1px solid ${C.bdr}`, borderRadius: 14,
              cursor: "pointer", marginBottom: 8,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: C.plBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={C.pur} strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="2" width="10" height="12" rx="1.5" /><line x1="5.5" y1="6" x2="10.5" y2="6" /></svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.ink, margin: 0 }}>{doc.fileName}</p>
                <p style={{ fontSize: 10, color: C.ink3, marginTop: 2 }}>{doc.extractedTopics?.length || 0} topics extracted</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── CONFIGURE VIEW ────────────────────────────────────────────────────────
  if (view === "configure") return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "20px 16px 100px" }}>
      <button onClick={() => setView("upload")} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", marginBottom: 20, fontSize: 13, color: C.pur, fontWeight: 500 }}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke={C.pur} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="8,2 3,6.5 8,11" /></svg>
        Back
      </button>

      <h2 style={{ fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Configure Exam</h2>
      <p style={{ fontSize: 13, color: C.ink3, marginBottom: 20 }}>
        {file?.name || "Saved document"} · {pageCount} pages · {extractedTopics.length} topics found
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Topic */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Topic</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {extractedTopics.map(t => (
              <button key={t} onClick={() => setTopic(t)} style={{
                padding: "8px 14px", borderRadius: 20,
                background: topic === t ? C.pur : C.white,
                color: topic === t ? "#fff" : C.ink2,
                border: topic === t ? "none" : `1px solid ${C.bdr}`,
                fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Difficulty</p>
          <div style={{ display: "flex", gap: 8 }}>
            {DIFFICULTIES.map(d => (
              <button key={d} onClick={() => setDifficulty(d)} style={{
                flex: 1, padding: "10px 0", borderRadius: 12,
                background: difficulty === d ? (d === "Easy" ? C.grn : d === "Medium" ? C.amb : C.red) : C.white,
                color: difficulty === d ? "#fff" : C.ink2,
                border: difficulty === d ? "none" : `1px solid ${C.bdr}`,
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Question Type */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Question Type</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Q_TYPES.map(q => (
              <button key={q.id} onClick={() => setQuestionType(q.id)} style={{
                padding: "8px 14px", borderRadius: 20,
                background: questionType === q.id ? C.blue : C.white,
                color: questionType === q.id ? "#fff" : C.ink2,
                border: questionType === q.id ? "none" : `1px solid ${C.bdr}`,
                fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              }}>
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Question Count */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Number of Questions</p>
          <div style={{ display: "flex", gap: 8 }}>
            {Q_COUNTS.map(n => (
              <button key={n} onClick={() => setQuestionCount(n)} style={{
                flex: 1, padding: "10px 0", borderRadius: 12,
                background: questionCount === n ? C.ink : C.white,
                color: questionCount === n ? "#fff" : C.ink2,
                border: questionCount === n ? "none" : `1px solid ${C.bdr}`,
                fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Time Limit */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Time Limit</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TIME_LIMITS.map(t => (
              <button key={t.val} onClick={() => setTimeLimit(t.val)} style={{
                padding: "8px 14px", borderRadius: 20,
                background: timeLimit === t.val ? C.tea : C.white,
                color: timeLimit === t.val ? "#fff" : C.ink2,
                border: timeLimit === t.val ? "none" : `1px solid ${C.bdr}`,
                fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button onClick={handleGenerateExam} disabled={generating} style={{ ...btnPrimary, opacity: generating ? 0.7 : 1 }}>
          {generating ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"><path d="M8 2L9.8 6.5H14L10.7 9.2L11.8 14L8 11.5L4.2 14L5.3 9.2L2 6.5H6.2Z" /></svg>
          )}
          {generating ? "Generating..." : "Generate Exam"}
        </button>
      </div>
    </div>
  );

  // ── EXAM VIEW ─────────────────────────────────────────────────────────────
  if (view === "exam") {
    const q = questions[currentQ];
    const timerStr = timeLimit > 0 ? `${Math.floor(timerSec / 60)}:${String(timerSec % 60).padStart(2, "0")}` : "";
    const answered = answers.filter(a => a !== "").length;

    return (
      <div style={{ minHeight: "100vh", background: C.bg }}>
        {/* Exam header */}
        <div style={{ background: C.ink, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{examTitle}</p>
            <p style={{ fontSize: 13, color: "#fff", fontWeight: 600, marginTop: 2 }}>
              Q {currentQ + 1} of {questions.length}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {timerStr && (
              <div style={{ padding: "6px 12px", borderRadius: 20, background: timerSec < 60 ? "rgba(220,38,38,0.3)" : "rgba(255,255,255,0.1)", fontSize: 13, fontWeight: 600, color: timerSec < 60 ? "#fca5a5" : "#fff" }}>
                ⏱ {timerStr}
              </div>
            )}
            <div style={{ padding: "6px 12px", borderRadius: 20, background: "rgba(255,255,255,0.1)", fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
              {answered}/{questions.length}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: C.s2 }}>
          <div style={{ height: "100%", background: C.pur, width: `${((currentQ + 1) / questions.length) * 100}%`, transition: "width 0.3s", borderRadius: "0 2px 2px 0" }} />
        </div>

        <div style={{ padding: "20px 16px 120px" }}>
          {q && (
            <>
              {/* Question type badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <span style={{ padding: "4px 10px", borderRadius: 20, background: C.plBg, fontSize: 10, fontWeight: 600, color: C.pur, textTransform: "uppercase" }}>{q.type.replace("_", " ")}</span>
                <span style={{ fontSize: 11, color: C.ink3 }}>{difficulty}</span>
              </div>

              {/* Question text */}
              <p style={{ fontSize: 16, fontWeight: 600, color: C.ink, lineHeight: 1.5, marginBottom: 20 }}>
                {q.questionText}
              </p>

              {/* Answer area */}
              {(q.type === "mcq" || q.type === "true_false") && q.options.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {q.options.map((opt, oi) => {
                    const selected = answers[currentQ] === opt;
                    return (
                      <button key={oi} onClick={() => {
                        const newAns = [...answers]; newAns[currentQ] = opt; setAnswers(newAns);
                      }} style={{
                        padding: "14px 16px", borderRadius: 14, textAlign: "left",
                        background: selected ? C.pur : C.white,
                        color: selected ? "#fff" : C.ink,
                        border: selected ? "2px solid " + C.pur : `1.5px solid ${C.bdr}`,
                        fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                        display: "flex", alignItems: "center", gap: 10,
                        transition: "all 0.15s",
                      }}>
                        <span style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: selected ? "rgba(255,255,255,0.2)" : C.s1,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700, flexShrink: 0,
                          color: selected ? "#fff" : C.ink3,
                        }}>
                          {String.fromCharCode(65 + oi)}
                        </span>
                        {opt}
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
                  rows={q.type === "short_answer" ? 4 : 2}
                  style={{
                    width: "100%", padding: "14px 16px", borderRadius: 14,
                    border: `1.5px solid ${C.bdr}`, background: C.white,
                    fontSize: 14, color: C.ink, fontFamily: "inherit",
                    outline: "none", resize: "none",
                  }}
                />
              )}
            </>
          )}

          {/* Navigation */}
          <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
            {currentQ > 0 && (
              <button onClick={() => setCurrentQ(currentQ - 1)} style={{
                flex: 1, padding: 14, borderRadius: 14,
                background: C.white, border: `1.5px solid ${C.bdr}`,
                color: C.ink2, fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}>
                ← Previous
              </button>
            )}
            {currentQ < questions.length - 1 ? (
              <button onClick={() => setCurrentQ(currentQ + 1)} style={{
                flex: 1, padding: 14, borderRadius: 14,
                background: C.pur, border: "none", color: "#fff",
                fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>
                Next →
              </button>
            ) : (
              <button onClick={handleSubmitExam} style={{
                flex: 1, padding: 14, borderRadius: 14,
                background: C.grn, border: "none", color: "#fff",
                fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>
                ✓ Submit Exam
              </button>
            )}
          </div>

          {/* Question dots */}
          <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
            {questions.map((_, i) => (
              <div key={i} onClick={() => setCurrentQ(i)} style={{
                width: 24, height: 24, borderRadius: 6,
                background: i === currentQ ? C.pur : answers[i] ? C.grn : C.s2,
                color: i === currentQ || answers[i] ? "#fff" : C.ink3,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 600, cursor: "pointer",
              }}>
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS VIEW ──────────────────────────────────────────────────────────
  if (view === "results") {
    const scoreColor = result ? ((result.percentage || 0) >= 80 ? C.grn : (result.percentage || 0) >= 50 ? C.amb : C.red) : C.ink3;

    return (
      <div style={{ minHeight: "100vh", background: C.bg }}>
        {/* Score hero */}
        <div style={{
          background: evaluating ? C.ink : `linear-gradient(145deg, ${scoreColor}cc, ${scoreColor})`,
          padding: "32px 20px", textAlign: "center",
          borderRadius: "0 0 28px 28px",
        }}>
          {evaluating ? (
            <>
              <Loader2 style={{ width: 40, height: 40, color: "#fff", margin: "0 auto 12px" }} className="animate-spin" />
              <p style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>AI is evaluating your answers...</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 6 }}>This may take a few seconds</p>
            </>
          ) : result ? (
            <>
              <p style={{ fontSize: 52, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>{result.percentage || 0}%</p>
              <p style={{ fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
                {result.score}/{result.total} correct · Grade {result.grade}
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 8, lineHeight: 1.5 }}>
                {result.encouragement || "Keep practicing to improve!"}
              </p>
            </>
          ) : null}
        </div>

        {result && !evaluating && (
          <div style={{ padding: "16px 16px 100px", display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Weak topics */}
            {result.weakTopics?.length > 0 && (
              <div style={{ ...card, padding: "14px 16px" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.red, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>⚠ Weak Areas</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {result.weakTopics.map((t: string, i: number) => (
                    <span key={i} style={{ padding: "5px 12px", borderRadius: 20, background: C.rlBg, color: C.red, fontSize: 12, fontWeight: 500 }}>{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Per-question breakdown */}
            <p style={{ fontSize: 12, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Question Breakdown</p>
            {(result.evaluations || []).map((ev: any, i: number) => {
              const q = questions[i];
              if (!q) return null;
              return (
                <div key={i} style={{
                  ...card, padding: "14px 16px",
                  borderLeft: `4px solid ${ev.correct ? C.grn : C.red}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: ev.correct ? C.glBg : C.rlBg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {ev.correct ? (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={C.grn} strokeWidth="2" strokeLinecap="round"><polyline points="2,7 5.5,11 12,3" /></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={C.red} strokeWidth="2" strokeLinecap="round"><line x1="3" y1="3" x2="11" y2="11" /><line x1="11" y1="3" x2="3" y2="11" /></svg>
                      )}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: ev.correct ? C.grn : C.red }}>
                      Q{q.questionNo} — {ev.correct ? "Correct" : "Wrong"}
                    </span>
                  </div>

                  <p style={{ fontSize: 13, fontWeight: 500, color: C.ink, lineHeight: 1.5, marginBottom: 8 }}>{q.questionText}</p>

                  {!ev.correct && (
                    <>
                      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                        <div style={{ flex: 1, padding: "8px 10px", borderRadius: 10, background: C.rlBg }}>
                          <p style={{ fontSize: 9, fontWeight: 600, color: C.red, textTransform: "uppercase", marginBottom: 2 }}>Your answer</p>
                          <p style={{ fontSize: 12, color: C.red, margin: 0 }}>{ev.studentAnswer || "—"}</p>
                        </div>
                        <div style={{ flex: 1, padding: "8px 10px", borderRadius: 10, background: C.glBg }}>
                          <p style={{ fontSize: 9, fontWeight: 600, color: C.grn, textTransform: "uppercase", marginBottom: 2 }}>Correct answer</p>
                          <p style={{ fontSize: 12, color: C.grn, margin: 0 }}>{ev.correctAnswer || q.correctAnswer}</p>
                        </div>
                      </div>
                      {ev.explanation && (
                        <div style={{ padding: "10px 12px", borderRadius: 10, background: C.blBg, marginTop: 4 }}>
                          <p style={{ fontSize: 10, fontWeight: 600, color: C.blue, marginBottom: 4, textTransform: "uppercase" }}>💡 Why?</p>
                          <p style={{ fontSize: 12, color: "#1e40af", lineHeight: 1.5, margin: 0 }}>{ev.explanation}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={handleRetry} style={{
                flex: 1, padding: 14, borderRadius: 14,
                background: C.white, border: `1.5px solid ${C.bdr}`,
                color: C.ink2, fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}>
                🔄 Try Again
              </button>
              <button onClick={handleNewExam} style={{
                flex: 1, padding: 14, borderRadius: 14,
                background: C.pur, border: "none", color: "#fff",
                fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}>
                ✨ New Exam
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default AIPracticePage;