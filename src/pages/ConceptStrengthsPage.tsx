import { useState, useEffect } from "react";
import {
  CheckCircle2,
  CircleDashed,
  AlertCircle,
  Loader2,
  Lightbulb
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { useAuth } from "../lib/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { ParentAIController } from "../ai/controller/ai-controller";

const ConceptStrengthsPage = () => {
  const { studentData } = useAuth();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [allScores, setAllScores] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [activeSubject, setActiveSubject] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!studentData?.id) return;
    setLoading(true);

    const studentEmail = studentData.email?.toLowerCase() || "";

    let snap1Cache: any = null;
    let snap2Cache: any = null;
    let assignUnsub: (() => void) | null = null;

    const subscribeAssignments = (classIds: string[]) => {
      if (assignUnsub) { assignUnsub(); assignUnsub = null; }
      if (classIds.length === 0) { setLoading(false); return; }
      assignUnsub = onSnapshot(
        query(collection(db, "assignments"), where("classId", "in", classIds.slice(0, 10))),
        (snap) => {
          setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
          setLoading(false);
        }
      );
    };

    const mergeAndSetEnrollments = () => {
      const enrollMap = new Map();
      [...(snap1Cache?.docs || []), ...(snap2Cache?.docs || [])].forEach((d: any) => {
        if (!enrollMap.has(d.id)) enrollMap.set(d.id, { id: d.id, ...d.data() });
      });
      const data = Array.from(enrollMap.values()) as any[];
      const filtered = data.filter((en: any) => (en.subject || en.className || "").toLowerCase() !== "general");
      const sorted = filtered.sort((a: any, b: any) => (a.subject || "").localeCompare(b.subject || ""));
      setEnrollments(sorted);
      setActiveSubject(prev => prev || (sorted[0]?.subject || sorted[0]?.className || ""));
      const allDocs = [...(snap1Cache?.docs || []), ...(snap2Cache?.docs || [])];
      const classIds = [...new Set(allDocs.map((d: any) => d.data().classId).filter(Boolean))] as string[];
      subscribeAssignments(classIds);
    };

    const unsubById = onSnapshot(
      query(collection(db, "enrollments"), where("studentId", "==", studentData.id)),
      (snap) => { snap1Cache = snap; mergeAndSetEnrollments(); }
    );
    const unsubByEmail = studentEmail
      ? onSnapshot(
          query(collection(db, "enrollments"), where("studentEmail", "==", studentEmail)),
          (snap) => { snap2Cache = snap; mergeAndSetEnrollments(); }
        )
      : () => {};

    let scoreSnap1: any = null, scoreSnap2: any = null;
    let gbSnap1: any = null, gbSnap2: any = null;

    const processScores = () => {
      const combinedTests = [...(scoreSnap1?.docs || []), ...(scoreSnap2?.docs || [])].map(d => ({ id: d.id, ...d.data() as any }));
      const combinedGB = [...(gbSnap1?.docs || []), ...(gbSnap2?.docs || [])].map(d => {
        const data = d.data();
        return { id: d.id, ...data, testName: data.columnName || "Class Assessment", score: data.mark, maxScore: data.maxMarks || 100, type: "gradebook" };
      });
      const unique = Array.from(new Map([...combinedTests, ...combinedGB].map(d => [d.id, d])).values());
      setAllScores(unique);
    };

    const unsubScores1 = onSnapshot(query(collection(db, "test_scores"), where("studentId", "==", studentData.id)), (snap) => { scoreSnap1 = snap; processScores(); });
    const unsubScores2 = studentEmail ? onSnapshot(query(collection(db, "test_scores"), where("studentEmail", "==", studentEmail)), (snap) => { scoreSnap2 = snap; processScores(); }) : () => {};
    const unsubGB1 = onSnapshot(query(collection(db, "gradebook_scores"), where("studentId", "==", studentData.id)), (snap) => { gbSnap1 = snap; processScores(); });
    const unsubGB2 = studentEmail ? onSnapshot(query(collection(db, "gradebook_scores"), where("studentEmail", "==", studentEmail)), (snap) => { gbSnap2 = snap; processScores(); }) : () => {};

    let attSnap1: any = null, attSnap2: any = null;
    const processAtt = () => {
      const combined = [...(attSnap1?.docs || []), ...(attSnap2?.docs || [])];
      setAttendance(Array.from(new Map(combined.map(d => [d.id, { id: d.id, ...d.data() as any }])).values()));
    };
    const unsubAtt1 = onSnapshot(query(collection(db, "attendance"), where("studentId", "==", studentData.id)), (snap) => { attSnap1 = snap; processAtt(); });
    const unsubAtt2 = studentEmail ? onSnapshot(query(collection(db, "attendance"), where("studentEmail", "==", studentEmail)), (snap) => { attSnap2 = snap; processAtt(); }) : () => {};

    return () => {
      unsubById(); unsubByEmail();
      unsubScores1(); unsubScores2();
      unsubGB1(); unsubGB2();
      unsubAtt1(); unsubAtt2();
      if (assignUnsub) assignUnsub();
    };
  }, [studentData?.id]);

  useEffect(() => {
    const fetchAI = async () => {
      if (enrollments.length > 0 && !aiAnalysis && !analyzing) {
        setAnalyzing(true);
        try {
          const context = {
            scores: allScores, assignments, attendance,
            enrolled_subjects: Array.from(new Set(enrollments.map(e => e.subject || e.className || "General")))
          };
          const result = await ParentAIController.getRealConceptMastery(studentData?.name || "Student", context);
          if (result.status === "success") setAiAnalysis(result.data);
        } finally {
          setAnalyzing(false);
        }
      }
    };
    fetchAI();
  }, [enrollments, allScores, assignments, attendance]);

  // Categorize scores by active subject
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

  // Chart data
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
        if (subScores.length > 0) {
          const avg = subScores.reduce((acc, s) => acc + (s.percentage ?? (s.maxScore ? s.score / s.maxScore * 100 : 0)), 0) / subScores.length;
          entry[sub] = Math.round(avg);
        } else {
          entry[sub] = null;
        }
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

  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
        <p className="text-xs text-slate-400">Loading concept data...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 pb-20">

      {/* Header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Result of click: "Concept Strengths"</p>
      </div>

      {/* Subject Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {enrollments.map((en) => {
          const name = en.subject || en.className || "General";
          const isActive = activeSubject === name;
          return (
            <button
              key={en.id}
              onClick={() => setActiveSubject(name)}
              className={`px-5 py-2 rounded-full text-sm font-semibold border transition-all ${
                isActive
                  ? "bg-[#1e3a8a] text-white border-[#1e3a8a]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {name}
            </button>
          );
        })}
        {analyzing && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full border border-blue-100">
            <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
            <span className="text-xs font-medium text-blue-600">AI analyzing...</span>
          </div>
        )}
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">

        {/* Strong */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h3 className="text-base font-bold text-slate-800">Strong</h3>
          </div>
          <div className="space-y-3">
            {currentData.strong.length === 0 ? (
              <p className="text-xs text-slate-300 py-6 text-center">No data yet</p>
            ) : currentData.strong.map((c, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-700">{c.title}</p>
                  <span className="text-sm font-bold text-emerald-600">{c.pct}%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Developing */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CircleDashed className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-slate-800">Developing</h3>
          </div>
          <div className="space-y-3">
            {currentData.developing.length === 0 ? (
              <p className="text-xs text-slate-300 py-6 text-center">No data yet</p>
            ) : currentData.developing.map((c, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-700">{c.title}</p>
                  <span className="text-sm font-bold text-amber-500">{c.pct}%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Needs Work */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-rose-500" />
            <h3 className="text-base font-bold text-slate-800">Needs Work</h3>
          </div>
          <div className="space-y-3">
            {currentData.attention.length === 0 ? (
              <p className="text-xs text-slate-300 py-6 text-center">No data yet</p>
            ) : currentData.attention.map((c, i) => (
              <div key={i} className={`rounded-xl p-3.5 border ${i === 0 ? "bg-rose-50 border-rose-100" : "bg-slate-50 border-transparent"}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-700">{c.title}</p>
                  <span className="text-sm font-bold text-rose-500">{c.pct}%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
            {recommendedFocus && (
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
      </div>

      {/* Concept Mastery Progress Chart */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 mb-5">Concept Mastery Progress</h3>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-slate-300">
            <p className="text-xs">No score data to display</p>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} domain={[50, 100]} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #f1f5f9", fontSize: 12 }}
                  formatter={(value: any, name: string) => [`${value}%`, name]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
                />
                {subjectList.slice(0, 5).map((sub, i) => (
                  <Line
                    key={i}
                    type="monotone"
                    dataKey={sub}
                    stroke={lineColors[i % lineColors.length]}
                    strokeWidth={2}
                    dot={{ r: 4, fill: lineColors[i % lineColors.length], strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConceptStrengthsPage;
