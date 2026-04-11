import { useState, useEffect, useRef } from "react";
import {
  CheckCircle2, CircleDashed, AlertCircle, Loader2, Lightbulb,
  Sparkles, CalendarDays, BookOpenText, FlaskConical,
  HelpCircle, ChevronRight, Camera, Send, Eye, RefreshCw,
  ClipboardList, Zap, Clock, Sun, Moon
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { useAuth } from "../lib/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { ParentAIController } from "../ai/controller/ai-controller";

// ── OpenAI helper ────────────────────────────────────────────────────────────
async function callOpenAI(prompt: string, jsonMode = true, imageBase64?: string): Promise<any> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error("API key not configured.");

  const messages: any[] = [
    { role: "system", content: "You are EduIntellect AI, a friendly educational assistant for school students and their parents. Always respond in simple, encouraging language." }
  ];

  if (imageBase64) {
    messages.push({
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        { type: "text", text: prompt }
      ]
    });
  } else {
    messages.push({ role: "user", content: prompt });
  }

  const body: any = {
    model: imageBase64 ? "gpt-4o" : "gpt-4o-mini",
    messages,
    max_tokens: 1200,
  };
  if (jsonMode && !imageBase64) body.response_format = { type: "json_object" };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  const content = data.choices[0].message.content;
  if (jsonMode && !imageBase64) return JSON.parse(content);
  return content;
}

// ── Feature tabs ─────────────────────────────────────────────────────────────
type FeatureTab = "strengths" | "study-plan" | "explainer" | "practice" | "doubt";

const FEATURE_TABS: { key: FeatureTab; label: string; icon: any; color: string }[] = [
  { key: "strengths",  label: "Strengths",   icon: CheckCircle2,  color: "from-emerald-500 to-teal-500"   },
  { key: "study-plan", label: "Study Plan",  icon: CalendarDays,  color: "from-indigo-500 to-violet-500"  },
  { key: "explainer",  label: "Explain",     icon: BookOpenText,  color: "from-sky-500 to-cyan-500"       },
  { key: "practice",   label: "Practice",    icon: FlaskConical,  color: "from-amber-500 to-orange-500"   },
  { key: "doubt",      label: "Doubt Solver",icon: HelpCircle,    color: "from-rose-500 to-pink-500"      },
];

// ── Slot helper ──────────────────────────────────────────────────────────────
const SLOTS = [
  { icon: Sun,  label: "Morning",   time: "7:00 – 8:00 AM",  color: "bg-amber-50 border-amber-200",    dot: "bg-amber-400"   },
  { icon: Clock, label: "Afternoon", time: "2:00 – 3:00 PM",  color: "bg-sky-50 border-sky-200",        dot: "bg-sky-400"     },
  { icon: Moon,  label: "Evening",   time: "7:00 – 8:00 PM",  color: "bg-violet-50 border-violet-200",  dot: "bg-violet-400"  },
];

// ── Rule-based fallbacks ─────────────────────────────────────────────────────
function makeStudyPlanFallback(weak: string[], subject: string): any {
  const topics = weak.length > 0 ? weak : [subject, "General Revision"];
  return {
    today: SLOTS.map((s, i) => ({
      slot: s.label, time: s.time,
      topic: topics[i % topics.length] || "Revision",
      activity: i === 0 ? "Read notes and highlight key points" : i === 1 ? "Solve 10 practice problems" : "Quick recall quiz",
      duration: "45 min", reason: "Consistent spaced repetition improves retention."
    })),
    tomorrow: SLOTS.map((s, i) => ({
      slot: s.label, time: s.time,
      topic: topics[(i + 1) % topics.length] || "Review",
      activity: i === 0 ? "Review yesterday's notes" : i === 1 ? "Attempt past-paper questions" : "Teach it back to yourself",
      duration: "40 min", reason: "Active recall is the most effective study method."
    }))
  };
}

function makeExplanationFallback(topic: string): any {
  return {
    simple_explanation: `${topic} is a fundamental concept in your curriculum. It forms the building block for more advanced topics ahead.`,
    real_world_example: `Think of it like everyday objects around you — once you notice the pattern, it appears everywhere!`,
    emoji: "💡",
    remember_points: [
      `${topic} has a clear definition — always start from there.`,
      "Practice applying it in different scenarios to build confidence.",
      "Connect it to something you already know for better retention."
    ]
  };
}

function makePracticeFallback(topic: string): any {
  return {
    questions: [
      { question: `What is the main idea behind ${topic}?`, options: ["A. It describes a process", "B. It is a type of material", "C. It is a historical event", "D. It is a mathematical formula"], correct: "A", explanation: "Understanding the core idea first helps with everything else." },
      { question: `Which of the following is an example related to ${topic}?`, options: ["A. Water cycle", "B. Cell division", "C. Both A and B", "D. Neither"], correct: "C", explanation: "Many natural phenomena share similar patterns." },
      { question: `${topic} is most closely related to which subject area?`, options: ["A. Science", "B. Mathematics", "C. Social Studies", "D. Depends on context"], correct: "D", explanation: "Concepts often span multiple subjects." },
      { question: `If you wanted to demonstrate ${topic}, you would:`, options: ["A. Draw a diagram", "B. Conduct an experiment", "C. Write a definition", "D. All of the above"], correct: "D", explanation: "Multiple approaches reinforce learning." },
      { question: `The best way to remember ${topic} is to:`, options: ["A. Read once", "B. Memorize the definition", "C. Practice with examples", "D. Skip it"], correct: "C", explanation: "Practice is always more effective than passive reading." },
    ]
  };
}

function makeDoubtFallback(doubt: string): any {
  return {
    hints: [
      `Read the question again carefully: "${doubt.substring(0, 60)}..." — what is it really asking?`,
      "Identify the key words or numbers in the problem. What do they represent?",
      "Think about which formula or concept applies here. Have you seen something similar before?",
      "Try working backwards from what the answer should look like.",
      "Almost there! Write out each step one at a time and check if it makes sense."
    ]
  };
}

// ── Main Component ────────────────────────────────────────────────────────────
const ConceptStrengthsPage = () => {
  const { studentData } = useAuth();

  // ── Firestore data ──
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [allScores, setAllScores] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [activeSubject, setActiveSubject] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  // ── Feature state ──
  const [activeFeature, setActiveFeature] = useState<FeatureTab>("strengths");

  // Study Plan
  const [studyPlan, setStudyPlan] = useState<any>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  // Concept Explainer
  const [explainTopic, setExplainTopic] = useState("");
  const [explanation, setExplanation] = useState<any>(null);
  const [generatingExplanation, setGeneratingExplanation] = useState(false);

  // Practice Problems
  const [practiceTopic, setPracticeTopic] = useState("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Set<number>>(new Set());

  // Doubt Solver
  const [doubtText, setDoubtText] = useState("");
  const [doubtImageB64, setDoubtImageB64] = useState<string | null>(null);
  const [doubtImagePreview, setDoubtImagePreview] = useState<string | null>(null);
  const [doubtHints, setDoubtHints] = useState<string[]>([]);
  const [hintIndex, setHintIndex] = useState(0);
  const [generatingDoubt, setGeneratingDoubt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Firestore listeners ──────────────────────────────────────────────────
  useEffect(() => {
    if (!studentData?.id) return;
    setLoading(true);
    const studentEmail = studentData.email?.toLowerCase() || "";

    let snap1Cache: any = null, snap2Cache: any = null;
    let assignUnsub: (() => void) | null = null;

    const subscribeAssignments = (classIds: string[]) => {
      if (assignUnsub) { assignUnsub(); assignUnsub = null; }
      if (classIds.length === 0) { setLoading(false); return; }
      assignUnsub = onSnapshot(
        query(collection(db, "assignments"), where("classId", "in", classIds.slice(0, 10))),
        (snap) => { setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() } as any))); setLoading(false); }
      );
    };

    const mergeEnrollments = () => {
      const enrollMap = new Map();
      [...(snap1Cache?.docs || []), ...(snap2Cache?.docs || [])].forEach((d: any) => {
        if (!enrollMap.has(d.id)) enrollMap.set(d.id, { id: d.id, ...d.data() });
      });
      const data = Array.from(enrollMap.values()) as any[];
      const filtered = data.filter((en: any) => (en.subject || en.className || "").toLowerCase() !== "general");
      const sorted = filtered.sort((a: any, b: any) => (a.subject || "").localeCompare(b.subject || ""));
      setEnrollments(sorted);
      setActiveSubject(prev => prev || (sorted[0]?.subject || sorted[0]?.className || ""));
      const classIds = [...new Set([...(snap1Cache?.docs || []), ...(snap2Cache?.docs || [])].map((d: any) => d.data().classId).filter(Boolean))] as string[];
      subscribeAssignments(classIds);
    };

    const u1 = onSnapshot(query(collection(db, "enrollments"), where("studentId", "==", studentData.id)), s => { snap1Cache = s; mergeEnrollments(); });
    const u2 = studentEmail ? onSnapshot(query(collection(db, "enrollments"), where("studentEmail", "==", studentEmail)), s => { snap2Cache = s; mergeEnrollments(); }) : () => {};

    let s1: any = null, s2: any = null, g1: any = null, g2: any = null;
    const processScores = () => {
      const combined = [...(s1?.docs || []), ...(s2?.docs || [])].map(d => ({ id: d.id, ...d.data() as any }));
      const gb = [...(g1?.docs || []), ...(g2?.docs || [])].map(d => {
        const data = d.data();
        return { id: d.id, ...data, testName: data.columnName || "Class Assessment", score: data.mark, maxScore: data.maxMarks || 100, type: "gradebook" };
      });
      setAllScores(Array.from(new Map([...combined, ...gb].map(d => [d.id, d])).values()));
    };

    const u3 = onSnapshot(query(collection(db, "test_scores"), where("studentId", "==", studentData.id)), snap => { s1 = snap; processScores(); });
    const u4 = studentEmail ? onSnapshot(query(collection(db, "test_scores"), where("studentEmail", "==", studentEmail)), snap => { s2 = snap; processScores(); }) : () => {};
    const u5 = onSnapshot(query(collection(db, "gradebook_scores"), where("studentId", "==", studentData.id)), snap => { g1 = snap; processScores(); });
    const u6 = studentEmail ? onSnapshot(query(collection(db, "gradebook_scores"), where("studentEmail", "==", studentEmail)), snap => { g2 = snap; processScores(); }) : () => {};

    let a1: any = null, a2: any = null;
    const processAtt = () => setAttendance(Array.from(new Map([...(a1?.docs || []), ...(a2?.docs || [])].map(d => [d.id, { id: d.id, ...d.data() as any }])).values()));
    const u7 = onSnapshot(query(collection(db, "attendance"), where("studentId", "==", studentData.id)), snap => { a1 = snap; processAtt(); });
    const u8 = studentEmail ? onSnapshot(query(collection(db, "attendance"), where("studentEmail", "==", studentEmail)), snap => { a2 = snap; processAtt(); }) : () => {};

    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); if (assignUnsub) assignUnsub(); };
  }, [studentData?.id]);

  useEffect(() => {
    const fetchAI = async () => {
      if (enrollments.length > 0 && !aiAnalysis && !analyzing) {
        setAnalyzing(true);
        try {
          const context = { scores: allScores, assignments, attendance, enrolled_subjects: Array.from(new Set(enrollments.map(e => e.subject || e.className || "General"))) };
          const result = await ParentAIController.getRealConceptMastery(studentData?.name || "Student", context);
          if (result.status === "success") setAiAnalysis(result.data);
        } finally { setAnalyzing(false); }
      }
    };
    fetchAI();
  }, [enrollments, allScores, assignments, attendance]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const studentName = studentData?.name?.split(" ")[0] || "Student";

  const getLocalMasteryData = () => {
    const subjectScores = allScores.filter(s => {
      if (!activeSubject) return true;
      const sub = (s.subject || s.className || "General").toLowerCase();
      const active = activeSubject.toLowerCase();
      return sub === active || sub.includes(active) || active.includes(sub) || sub === "general";
    });
    const strong: { title: string; pct: number }[] = [];
    const developing: { title: string; pct: number }[] = [];
    const attention: { title: string; pct: number }[] = [];
    subjectScores.forEach(s => {
      const pct = s.percentage ?? (s.maxScore ? (s.score / s.maxScore * 100) : 0);
      const item = { title: s.testName || s.title || "Assessment", pct: Math.round(pct) };
      if (pct >= 85) strong.push(item);
      else if (pct >= 70) developing.push(item);
      else attention.push(item);
    });
    return { strong, developing, attention };
  };

  const currentData = getLocalMasteryData();
  const weakTopics = currentData.attention.map(a => a.title);

  const getChartData = () => {
    if (allScores.length === 0) return [];
    const dates = allScores.map(s => {
      const d = s.timestamp?.toDate ? s.timestamp.toDate() : new Date(s.timestamp || s.createdAt || Date.now());
      return d.getTime();
    }).filter(t => !isNaN(t));
    if (dates.length === 0) dates.push(Date.now());
    const minD = new Date(Math.min(...dates));
    const maxD = new Date();
    let startD = new Date(minD.getFullYear(), minD.getMonth(), 1);
    const endD = new Date(maxD.getFullYear(), maxD.getMonth(), 1);
    const diff = (endD.getFullYear() - startD.getFullYear()) * 12 + (endD.getMonth() - startD.getMonth());
    if (diff > 11) startD = new Date(endD.getFullYear(), endD.getMonth() - 11, 1);
    else if (diff === 0) startD = new Date(endD.getFullYear(), endD.getMonth() - 3, 1);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const displayMonths: any[] = [];
    let curr = new Date(startD);
    while (curr <= endD) {
      displayMonths.push({ name: monthNames[curr.getMonth()], index: curr.getMonth(), year: curr.getFullYear() });
      curr.setMonth(curr.getMonth() + 1);
    }
    const subjectList = enrollments.map(e => e.subject || e.className || "General");
    return displayMonths.map(m => {
      const entry: any = { month: m.name };
      subjectList.forEach(sub => {
        const subScores = allScores.filter(s => {
          const sDate = s.timestamp?.toDate ? s.timestamp.toDate() : new Date(s.timestamp || s.createdAt || Date.now());
          const scoreSub = (s.subject || s.className || "General").toLowerCase();
          const activeSub = sub.toLowerCase();
          return sDate.getMonth() === m.index && sDate.getFullYear() === m.year &&
            (scoreSub.includes(activeSub) || activeSub.includes(scoreSub) || scoreSub === "general");
        });
        entry[sub] = subScores.length > 0 ? Math.round(subScores.reduce((a, s) => a + (s.percentage ?? (s.maxScore ? s.score / s.maxScore * 100 : 0)), 0) / subScores.length) : null;
      });
      return entry;
    });
  };

  const chartData = getChartData();
  const subjectList = enrollments.map(e => e.subject || e.className || "General");
  const lineColors = ["#16a34a", "#1e3a8a", "#ef4444", "#f59e0b", "#8b5cf6"];
  const recommendedFocus = currentData.attention[0]?.title
    ? `Spend extra time on ${currentData.attention[0].title.toLowerCase()} and practice problems.`
    : aiAnalysis?.recommended_focus || null;

  // ── AI Feature Handlers ───────────────────────────────────────────────────
  const handleGeneratePlan = async () => {
    setGeneratingPlan(true);
    try {
      const prompt = `Generate a 2-day study plan for a school student named ${studentName}.
Subject focus: ${activeSubject || "General"}
Weak topics: ${weakTopics.slice(0, 4).join(", ") || "General revision"}
Return JSON with keys "today" and "tomorrow", each an array of 3 objects with: slot ("Morning"/"Afternoon"/"Evening"), time, topic, activity, duration, reason.`;
      const result = await callOpenAI(prompt);
      setStudyPlan(result);
    } catch {
      setStudyPlan(makeStudyPlanFallback(weakTopics, activeSubject));
    } finally { setGeneratingPlan(false); }
  };

  const handleExplain = async (topicOverride?: string) => {
    const topic = topicOverride || explainTopic.trim();
    if (!topic) return;
    setExplainTopic(topic);
    setGeneratingExplanation(true);
    setExplanation(null);
    try {
      const prompt = `Explain "${topic}" to a school student (age 10-16) in very simple language.
Use a real-world example they can relate to.
Return JSON: { simple_explanation: "...", real_world_example: "...", emoji: "one emoji", remember_points: ["point1", "point2", "point3"] }`;
      const result = await callOpenAI(prompt);
      setExplanation(result);
    } catch {
      setExplanation(makeExplanationFallback(topic));
    } finally { setGeneratingExplanation(false); }
  };

  const handleGenerateQuestions = async () => {
    const topic = practiceTopic.trim() || activeSubject || "General";
    setGeneratingQuestions(true);
    setQuestions([]);
    setSelectedAnswers({});
    setRevealedAnswers(new Set());
    try {
      const prompt = `Generate exactly 5 multiple-choice questions about "${topic}" for a school student.
Make questions progressively harder (easy → medium → hard).
Return JSON: { questions: [{ question: "...", options: ["A. ...", "B. ...", "C. ...", "D. ..."], correct: "A", explanation: "..." }] }`;
      const result = await callOpenAI(prompt);
      setQuestions(result.questions || []);
    } catch {
      setQuestions(makePracticeFallback(topic).questions);
    } finally { setGeneratingQuestions(false); }
  };

  const handleDoubtSubmit = async () => {
    if (!doubtText.trim() && !doubtImageB64) return;
    setGeneratingDoubt(true);
    setDoubtHints([]);
    setHintIndex(0);
    try {
      if (doubtImageB64) {
        const prompt = `This student has a homework or exam question. Guide them step by step WITHOUT directly solving it. Use the Socratic method — ask leading questions and give progressive hints. Format as numbered hints (1. ... 2. ... 3. ... 4. ... 5. ...)`;
        const text = await callOpenAI(prompt, false, doubtImageB64);
        const hints = text.split(/\n+/).filter((l: string) => /^\d+\./.test(l.trim())).map((l: string) => l.replace(/^\d+\.\s*/, ""));
        setDoubtHints(hints.length > 0 ? hints : [text]);
      } else {
        const prompt = `A school student has this doubt: "${doubtText}"
Guide them step by step WITHOUT giving the final answer. Use progressive hints (Socratic method).
Return JSON: { hints: ["hint1 (gentle nudge)", "hint2", "hint3", "hint4", "hint5 (near solution)"] }`;
        const result = await callOpenAI(prompt);
        setDoubtHints(result.hints || []);
      }
    } catch {
      setDoubtHints(makeDoubtFallback(doubtText).hints);
    } finally { setGeneratingDoubt(false); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setDoubtImagePreview(result);
      setDoubtImageB64(result.split(",")[1]);
      setDoubtText("");
    };
    reader.readAsDataURL(file);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-semibold">Loading concept data...</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-in fade-in duration-500 pb-28">

      {/* ── Page Header ── */}
      <div className="mb-6">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em] mb-1">Parent Dashboard</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Concept Strengths</h1>
        <p className="text-sm text-slate-500 mt-1">AI-powered learning tools for <span className="font-bold text-slate-800">{studentName}</span></p>
      </div>

      {/* ── Feature Tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-6 scrollbar-hide">
        {FEATURE_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeFeature === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFeature(tab.key)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                isActive
                  ? `bg-gradient-to-r ${tab.color} text-white shadow-md`
                  : "bg-white border border-slate-100 text-slate-500 hover:border-slate-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
        {analyzing && (
          <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-indigo-50 rounded-2xl border border-indigo-100">
            <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
            <span className="text-xs font-bold text-indigo-600">AI syncing...</span>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: STRENGTHS (existing)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeFeature === "strengths" && (
        <>
          {/* Subject filter tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {enrollments.map((en) => {
              const name = en.subject || en.className || "General";
              const isActive = activeSubject === name;
              return (
                <button key={en.id} onClick={() => setActiveSubject(name)}
                  className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                    isActive ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}>
                  {name}
                </button>
              );
            })}
          </div>

          {/* 3-column mastery grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
            {[
              { label: "Strong", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50", bar: "bg-emerald-500", items: currentData.strong },
              { label: "Developing", icon: CircleDashed, color: "text-amber-500", bg: "bg-amber-50", bar: "bg-amber-400", items: currentData.developing },
              { label: "Needs Work", icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50", bar: "bg-rose-500", items: currentData.attention },
            ].map(({ label, icon: Icon, color, bg, bar, items }) => (
              <div key={label} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Icon className={`w-5 h-5 ${color}`} />
                  <h3 className="text-sm font-bold text-slate-800">{label}</h3>
                  <span className={`ml-auto text-xs font-black px-2 py-0.5 rounded-full ${bg} ${color}`}>{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.length === 0 ? (
                    <p className="text-xs text-slate-300 py-6 text-center">No data yet</p>
                  ) : items.map((c, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-slate-700 truncate pr-2">{c.title}</p>
                        <span className={`text-xs font-bold ${color}`}>{c.pct}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full ${bar} rounded-full`} style={{ width: `${c.pct}%` }} />
                      </div>
                    </div>
                  ))}
                  {label === "Needs Work" && recommendedFocus && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        <p className="text-xs font-bold text-slate-700">Recommended Focus</p>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{recommendedFocus}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Trend chart */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-5">Concept Mastery Progress</h3>
            {chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-300 text-xs">No score data yet</div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} domain={[50, 100]} />
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #f1f5f9", fontSize: 12 }} formatter={(v: any, n: string) => [`${v}%`, n]} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
                    {subjectList.slice(0, 5).map((sub, i) => (
                      <Line key={i} type="monotone" dataKey={sub} stroke={lineColors[i % lineColors.length]} strokeWidth={2}
                        dot={{ r: 4, fill: lineColors[i % lineColors.length], strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6, strokeWidth: 0 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: AI STUDY PLAN MAKER
      ══════════════════════════════════════════════════════════════════════ */}
      {activeFeature === "study-plan" && (
        <div className="space-y-5">

          {/* Generate card */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                <CalendarDays className="w-4 h-4 text-indigo-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">AI Study Plan Maker</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4 ml-10">Based on {studentName}'s weak topics — personalised schedule for today & tomorrow.</p>

            {weakTopics.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-full mb-1">Weak topics detected:</span>
                {weakTopics.slice(0, 5).map((t, i) => (
                  <span key={i} className="text-[11px] font-semibold px-2.5 py-1 bg-rose-50 text-rose-600 rounded-full border border-rose-100">{t}</span>
                ))}
              </div>
            )}

            <button
              onClick={handleGeneratePlan}
              disabled={generatingPlan}
              className="w-full h-11 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-all"
            >
              {generatingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generatingPlan ? "Generating Plan..." : "Generate Today's Plan"}
            </button>
          </div>

          {/* Plan result */}
          {studyPlan && (
            <>
              {[{ key: "today", label: "Today", color: "from-indigo-500 to-violet-500" }, { key: "tomorrow", label: "Tomorrow", color: "from-sky-500 to-cyan-500" }].map(({ key, label, color }) => (
                <div key={key} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  <div className={`bg-gradient-to-r ${color} px-5 py-3 flex items-center gap-2`}>
                    <CalendarDays className="w-4 h-4 text-white" />
                    <h3 className="text-sm font-bold text-white">{label}'s Schedule</h3>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {(studyPlan[key] || []).map((slot: any, i: number) => {
                      const S = SLOTS[i % SLOTS.length];
                      return (
                        <div key={i} className="p-4 flex gap-4 items-start">
                          <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${S.dot}`} style={{ marginTop: 6 }} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{slot.slot || S.label}</span>
                              <span className="text-[10px] font-semibold text-slate-300">{slot.time || S.time}</span>
                              <span className="ml-auto text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{slot.duration}</span>
                            </div>
                            <p className="text-sm font-bold text-slate-800 mt-1">{slot.topic}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{slot.activity}</p>
                            {slot.reason && <p className="text-[10px] text-slate-400 mt-1 italic">{slot.reason}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: CONCEPT EXPLAINER
      ══════════════════════════════════════════════════════════════════════ */}
      {activeFeature === "explainer" && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center">
                <BookOpenText className="w-4 h-4 text-sky-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">24/7 Concept Explainer</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4 ml-10">Type any concept — AI explains it in simple language with a real-world example.</p>

            <div className="flex gap-2 mb-4">
              <input
                value={explainTopic}
                onChange={e => setExplainTopic(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleExplain()}
                placeholder="e.g. Photosynthesis, Fractions, Newton's Laws..."
                className="flex-1 h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
              <button
                onClick={() => handleExplain()}
                disabled={generatingExplanation || !explainTopic.trim()}
                className="w-11 h-11 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 flex items-center justify-center text-white disabled:opacity-50 active:scale-95 transition-all"
              >
                {generatingExplanation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>

            {/* Quick picks from weak topics */}
            {weakTopics.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Quick picks — your weak topics:</p>
                <div className="flex flex-wrap gap-2">
                  {weakTopics.slice(0, 6).map((t, i) => (
                    <button key={i} onClick={() => handleExplain(t)}
                      className="text-[11px] font-bold px-3 py-1.5 bg-sky-50 text-sky-700 rounded-full border border-sky-100 hover:bg-sky-100 transition-all active:scale-95">
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Explanation result */}
          {generatingExplanation && (
            <div className="flex items-center gap-3 p-5 bg-sky-50 rounded-2xl border border-sky-100">
              <Loader2 className="w-5 h-5 text-sky-500 animate-spin flex-shrink-0" />
              <p className="text-sm text-sky-700 font-medium">Explaining "{explainTopic}"...</p>
            </div>
          )}

          {explanation && !generatingExplanation && (
            <div className="space-y-4">
              {/* Simple explanation */}
              <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)" }}>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{explanation.emoji || "💡"}</span>
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Simple Explanation</span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{explanation.simple_explanation}</p>
                </div>
              </div>

              {/* Real-world example */}
              <div className="bg-sky-50 border border-sky-100 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-bold text-sky-700 uppercase tracking-wider">Real-World Example</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{explanation.real_world_example}</p>
              </div>

              {/* Remember points */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardList className="w-4 h-4 text-violet-600" />
                  <span className="text-xs font-bold text-violet-700 uppercase tracking-wider">Remember These 3 Points</span>
                </div>
                <div className="space-y-2">
                  {(explanation.remember_points || []).map((point: string, i: number) => (
                    <div key={i} className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[9px] font-black text-violet-700">{i + 1}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 4: PRACTICE PROBLEM GENERATOR
      ══════════════════════════════════════════════════════════════════════ */}
      {activeFeature === "practice" && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-amber-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">Practice Problem Generator</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4 ml-10">AI generates 5 dynamic questions on any topic — with answers you can reveal one at a time.</p>

            <div className="flex gap-2 mb-4">
              <input
                value={practiceTopic}
                onChange={e => setPracticeTopic(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleGenerateQuestions()}
                placeholder={`Topic (e.g. ${activeSubject || "Fractions"})`}
                className="flex-1 h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button
                onClick={handleGenerateQuestions}
                disabled={generatingQuestions}
                className="h-11 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center gap-2 text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-all"
              >
                {generatingQuestions ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {generatingQuestions ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>

          {/* Questions */}
          {generatingQuestions && (
            <div className="flex items-center gap-3 p-5 bg-amber-50 rounded-2xl border border-amber-100">
              <Loader2 className="w-5 h-5 text-amber-500 animate-spin flex-shrink-0" />
              <p className="text-sm text-amber-700 font-medium">Generating 5 questions...</p>
            </div>
          )}

          {questions.length > 0 && !generatingQuestions && (
            <div className="space-y-4">
              {questions.map((q, qi) => {
                const selected = selectedAnswers[qi];
                const revealed = revealedAnswers.has(qi);
                const isCorrect = selected === q.correct;
                return (
                  <div key={qi} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start gap-3 mb-4">
                      <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-xs font-black flex items-center justify-center flex-shrink-0">{qi + 1}</span>
                      <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.question}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                      {(q.options || []).map((opt: string, oi: number) => {
                        const optKey = opt.charAt(0);
                        const isSelected = selected === optKey;
                        const isCorrectOpt = q.correct === optKey;
                        let optStyle = "border-slate-100 bg-slate-50 text-slate-700";
                        if (selected) {
                          if (isCorrectOpt) optStyle = "border-emerald-300 bg-emerald-50 text-emerald-700";
                          else if (isSelected) optStyle = "border-rose-300 bg-rose-50 text-rose-700";
                        }
                        return (
                          <button key={oi} onClick={() => !selected && setSelectedAnswers(prev => ({ ...prev, [qi]: optKey }))}
                            className={`text-left px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${optStyle} ${!selected ? "hover:border-slate-200 active:scale-95" : ""}`}>
                            {opt}
                          </button>
                        );
                      })}
                    </div>

                    {selected && (
                      <div className={`rounded-xl p-3 ${isCorrect ? "bg-emerald-50 border border-emerald-100" : "bg-rose-50 border border-rose-100"}`}>
                        <p className={`text-xs font-bold ${isCorrect ? "text-emerald-700" : "text-rose-700"}`}>
                          {isCorrect ? "✓ Correct!" : `✗ Incorrect — correct answer is ${q.correct}`}
                        </p>
                      </div>
                    )}

                    {!selected && (
                      <button onClick={() => {
                        setRevealedAnswers(prev => new Set([...prev, qi]));
                        setSelectedAnswers(prev => ({ ...prev, [qi]: q.correct }));
                      }} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-all mt-1">
                        <Eye className="w-3.5 h-3.5" />
                        Reveal answer
                      </button>
                    )}

                    {(selected || revealed) && q.explanation && (
                      <p className="text-xs text-slate-500 italic mt-2 leading-relaxed">{q.explanation}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 5: AI DOUBT SOLVER
      ══════════════════════════════════════════════════════════════════════ */}
      {activeFeature === "doubt" && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
                <HelpCircle className="w-4 h-4 text-rose-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">AI Doubt Solver</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4 ml-10">Type your doubt OR upload a photo. AI guides step by step — teaches, doesn't just answer.</p>

            {/* Image preview */}
            {doubtImagePreview && (
              <div className="mb-4 relative">
                <img src={doubtImagePreview} alt="Doubt" className="w-full max-h-48 object-contain rounded-xl border border-slate-100 bg-slate-50" />
                <button onClick={() => { setDoubtImagePreview(null); setDoubtImageB64(null); }}
                  className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 text-xs font-bold shadow-sm">✕</button>
              </div>
            )}

            {/* Text input */}
            {!doubtImagePreview && (
              <textarea
                value={doubtText}
                onChange={e => setDoubtText(e.target.value)}
                placeholder="Type your doubt here... e.g. 'I don't understand how to solve simultaneous equations'"
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none mb-3"
              />
            )}

            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 h-11 px-4 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold hover:border-slate-300 transition-all active:scale-95"
              >
                <Camera className="w-4 h-4" />
                Upload Photo
              </button>
              <button
                onClick={handleDoubtSubmit}
                disabled={generatingDoubt || (!doubtText.trim() && !doubtImageB64)}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all"
              >
                {generatingDoubt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generatingDoubt ? "Thinking..." : "Get Step-by-Step Help"}
              </button>
            </div>
          </div>

          {/* Hints result */}
          {generatingDoubt && (
            <div className="flex items-center gap-3 p-5 bg-rose-50 rounded-2xl border border-rose-100">
              <Loader2 className="w-5 h-5 text-rose-500 animate-spin flex-shrink-0" />
              <p className="text-sm text-rose-700 font-medium">Preparing your hints...</p>
            </div>
          )}

          {doubtHints.length > 0 && !generatingDoubt && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Sparkles className="w-4 h-4 text-rose-500" />
                <p className="text-xs font-bold text-slate-600">Hints revealed: {Math.min(hintIndex + 1, doubtHints.length)} / {doubtHints.length}</p>
              </div>

              {doubtHints.slice(0, hintIndex + 1).map((hint, i) => (
                <div key={i} className={`rounded-2xl p-4 border ${i === hintIndex ? "bg-rose-50 border-rose-100" : "bg-slate-50 border-slate-100"}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black ${i === hintIndex ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                      {i + 1}
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{hint}</p>
                  </div>
                </div>
              ))}

              {hintIndex < doubtHints.length - 1 ? (
                <button
                  onClick={() => setHintIndex(prev => prev + 1)}
                  className="w-full h-11 rounded-2xl border-2 border-dashed border-rose-200 text-rose-500 text-sm font-bold flex items-center justify-center gap-2 hover:border-rose-300 hover:bg-rose-50 transition-all active:scale-95"
                >
                  <ChevronRight className="w-4 h-4" />
                  Next Hint
                </button>
              ) : (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-center">
                  <p className="text-sm font-bold text-emerald-700">All hints revealed! Did that help?</p>
                  <button onClick={() => { setDoubtHints([]); setHintIndex(0); setDoubtText(""); setDoubtImagePreview(null); setDoubtImageB64(null); }}
                    className="mt-2 text-xs text-emerald-600 font-semibold underline">Ask another doubt</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default ConceptStrengthsPage;
