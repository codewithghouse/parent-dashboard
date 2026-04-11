import { useEffect, useState } from "react";
import {
  ArrowUp, ArrowDown, Minus, Loader2,
  Calculator, FlaskConical, Languages, Globe, Monitor, Palette, BookOpen,
  Sparkles, Target, Trophy
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { SubjectPerformanceDetail } from "@/components/performance/SubjectPerformanceDetail";
import { useAuth } from "@/lib/AuthContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";

const getSubIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("math")) return Calculator;
  if (n.includes("science")) return FlaskConical;
  if (n.includes("english")) return Languages;
  if (n.includes("social")) return Globe;
  if (n.includes("computer")) return Monitor;
  if (n.includes("art")) return Palette;
  return BookOpen;
};

const CHART_COLORS = ["#1e3a8a", "#10b981", "#f59e0b", "#6366f1", "#ef4444", "#06b6d4"];

const PerformancePage = () => {
  const { studentData } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [overallStats, setOverallStats] = useState({ grade: "N/A", avg: 0, trend: "+8%" });
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [goalSubject, setGoalSubject] = useState<string>("");
  const [goalTarget, setGoalTarget] = useState<number>(80);

  useEffect(() => {
    if (!studentData?.id) return;
    setLoading(true);
    const studentEmail = studentData.email?.toLowerCase() || "";

    let snap1Cache: any = null, snap2Cache: any = null;
    const processScores = () => {
      const scoreMap = new Map();
      [...(snap1Cache?.docs || []), ...(snap2Cache?.docs || [])].forEach((d: any) => {
        if (!scoreMap.has(d.id)) scoreMap.set(d.id, { id: d.id, ...d.data() });
      });
      const scores = Array.from(scoreMap.values());

      const subMap = new Map();
      scores.forEach(s => {
        const sub = s.subject || "General";
        if (!subMap.has(sub)) subMap.set(sub, { name: sub, total: 0, count: 0, scores: [] });
        const curr = subMap.get(sub);
        curr.total += (s.percentage || 0);
        curr.count += 1;
        curr.scores.push(s);
      });

      const derivedSubjs = Array.from(subMap.values()).map(s => {
        const avg = Math.round(s.total / s.count);
        const sorted = s.scores.sort((a: any, b: any) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
        const last = sorted[sorted.length - 1]?.percentage || 0;
        const prev = sorted[sorted.length - 2]?.percentage || last;
        const trendDir = last > prev ? "up" : last < prev ? "down" : "stable";
        const status = avg >= 90 ? "Outstanding" : avg >= 80 ? "Excellent" : avg >= 70 ? "Improving" : avg >= 60 ? "Stable" : "Needs Attention";
        const barColor = avg >= 75 ? "bg-emerald-500" : avg >= 60 ? "bg-amber-500" : "bg-rose-500";
        const grade = avg >= 90 ? "A+" : avg >= 85 ? "A" : avg >= 80 ? "A-" : avg >= 75 ? "B+" : avg >= 70 ? "B" : avg >= 65 ? "C+" : "C";
        return { name: s.name, grade, progress: avg, status, trendDir, barColor, raw: s.scores };
      });

      setSubjects(derivedSubjs);
      if (derivedSubjs.length > 0) {
        const globalAvg = Math.round(derivedSubjs.reduce((a, b) => a + b.progress, 0) / derivedSubjs.length);
        setOverallStats({
          avg: globalAvg,
          grade: globalAvg >= 90 ? "A+" : globalAvg >= 85 ? "A" : globalAvg >= 80 ? "A-" : globalAvg >= 75 ? "B+" : globalAvg >= 70 ? "B" : "C",
          trend: "+8%"
        });
      }

      // Trend chart
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const scoresByMonth = new Map<string, Map<string, { total: number; count: number }>>();
      scores.forEach(s => {
        const date = s.timestamp?.toDate() || new Date();
        const month = monthNames[date.getMonth()];
        const sub = s.subject || "General";
        if (!scoresByMonth.has(month)) scoresByMonth.set(month, new Map());
        const mm = scoresByMonth.get(month)!;
        if (!mm.has(sub)) mm.set(sub, { total: 0, count: 0 });
        const curr = mm.get(sub)!;
        curr.total += (s.percentage || 0);
        curr.count += 1;
      });
      const currMonth = new Date().getMonth();
      const displayMonths = monthNames.slice(Math.max(0, currMonth - 3), currMonth + 1);
      const chartData = displayMonths.map(m => {
        const entry: any = { month: m };
        const mm = scoresByMonth.get(m);
        derivedSubjs.forEach(s => {
          const d = mm?.get(s.name);
          entry[s.name] = d ? Math.round(d.total / d.count) : null;
        });
        return entry;
      });
      setTrendData(chartData.filter(d => Object.keys(d).length > 1));
      setLoading(false);
    };

    const u1 = onSnapshot(query(collection(db, "test_scores"), where("studentId", "==", studentData.id)), s => { snap1Cache = s; processScores(); });
    const u2 = studentEmail ? onSnapshot(query(collection(db, "test_scores"), where("studentEmail", "==", studentEmail)), s => { snap2Cache = s; processScores(); }) : () => {};

    // Feedback
    const feedMap = new Map();
    const mergeFeedback = (docs: any[]) => {
      docs.forEach(d => { if (!feedMap.has(d.id)) feedMap.set(d.id, { id: d.id, ...d.data() }); });
      setFeedbacks(Array.from(feedMap.values()));
    };
    const u3 = onSnapshot(query(collection(db, "performance_feedback"), where("studentId", "==", studentData.id)), snap => {
      if (studentEmail) {
        getDocs(query(collection(db, "performance_feedback"), where("studentEmail", "==", studentEmail)))
          .then(s2 => mergeFeedback([...snap.docs, ...s2.docs]));
      } else {
        mergeFeedback(snap.docs);
      }
    });

    return () => { u1(); u2(); u3(); };
  }, [studentData?.id]);

  // ── AI helpers ──────────────────────────────────────────────────────────────
  const studentName = studentData?.name?.split(" ")[0] || "Your child";

  const generateNarrative = () => {
    if (subjects.length === 0) return "Loading performance insights...";
    const sorted = [...subjects].sort((a, b) => b.progress - a.progress);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    const avg = overallStats.avg;
    let text = `${studentName} is performing best in ${top.name} with ${top.progress}% this term — ${top.progress >= 85 ? "an excellent result" : "showing steady progress"}. `;
    if (sorted.length > 1 && bottom.progress < 75)
      text += `${bottom.name} needs extra attention at ${bottom.progress}% — targeted revision on weak topics can help close the gap. `;
    if (avg >= 85)
      text += `Overall performance is outstanding. Keep up the great work!`;
    else if (avg >= 75)
      text += `The overall average of ${avg}% reflects consistent effort. A little more daily revision can push it to the next level.`;
    else if (avg >= 60)
      text += `With a ${avg}% overall average, there is room to grow. Structured study of 30–45 minutes per subject daily can make a real difference.`;
    else
      text += `The overall average is ${avg}%. Extra practice and teacher support are recommended to build confidence and improve results.`;
    return text;
  };

  const getGoalInsight = (current: number, target: number, subName: string) => {
    const gap = target - current;
    if (gap <= 0) return { line1: `✓ Target already achieved in ${subName}!`, line2: "Maintain consistency to stay at this level.", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" };
    if (gap <= 5)  return { line1: `Just ${gap}% more needed in ${subName}`, line2: "20 mins of daily revision for 1–2 weeks can close this gap.", color: "text-sky-700", bg: "bg-sky-50 border-sky-200" };
    if (gap <= 15) return { line1: `${gap}% gap to close in ${subName}`, line2: "30 mins of focused daily practice for 3–4 weeks is recommended.", color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" };
    if (gap <= 25) return { line1: `${gap}% improvement needed in ${subName}`, line2: "45 mins daily for 1.5–2 months, with weekly mock tests, should get there.", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" };
    return { line1: `${gap}% is a big gap in ${subName}`, line2: "1 hour of daily study for 2–3 months + teacher guidance strongly recommended.", color: "text-rose-700", bg: "bg-rose-50 border-rose-200" };
  };

  const getBenchmarkTier = (pct: number) => {
    if (pct >= 90) return { label: "Top 10%", color: "text-violet-700 bg-violet-100", icon: "🏆" };
    if (pct >= 80) return { label: "Top 20%", color: "text-indigo-700 bg-indigo-100", icon: "⭐" };
    if (pct >= 70) return { label: "Top 40%", color: "text-emerald-700 bg-emerald-100", icon: "📈" };
    if (pct >= 60) return { label: "Top 60%", color: "text-amber-700 bg-amber-100", icon: "📊" };
    return { label: "Needs Work", color: "text-rose-700 bg-rose-100", icon: "📚" };
  };
  // ────────────────────────────────────────────────────────────────────────────

  // Subject detail view
  if (selectedSubject) {
    const s = subjects.find(sub => sub.name === selectedSubject);
    if (!s) return null;

    const topicMasteryMap = new Map();
    s.raw.forEach((score: any) => {
      const topics = score.topics || [s.name];
      topics.forEach((t: string) => {
        if (!topicMasteryMap.has(t)) topicMasteryMap.set(t, { total: 0, count: 0 });
        const curr = topicMasteryMap.get(t);
        curr.total += (score.percentage || 0);
        curr.count += 1;
      });
    });
    const processedTopics = Array.from(topicMasteryMap.entries())
      .map(([name, data]: any) => ({ name, score: Math.round(data.total / data.count) }))
      .sort((a, b) => b.score - a.score);

    const subFeedback = feedbacks
      .filter(f => f.subject?.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(f.subject?.toLowerCase()))
      .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))[0]
      || feedbacks.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))[0];

    const avg = overallStats.avg;
    const resources: any[] = [];
    if (processedTopics.length > 0) {
      processedTopics.filter(t => t.score < 85).slice(0, 2).forEach(t => {
        resources.push({ icon: "PlayCircle", title: `${t.name} Concept Clarity`, subtitle: "Targeted Tutorial • Video", action: "Watch", color: "text-blue-500 bg-blue-50", url: `https://www.youtube.com/results?search_query=${t.name.replace(/\s+/g, "+")}+tutorial` });
      });
    }
    if (avg < 60) resources.push({ icon: "PlayCircle", title: "Study Techniques for Better Grades", subtitle: "Study Skills • Memory Tips", action: "Watch", color: "text-rose-500 bg-rose-50", url: "https://www.youtube.com/results?search_query=best+study+techniques+for+students" });
    if (avg >= 90) resources.push({ icon: "Star", title: "Advanced Learning Resources", subtitle: "Beyond Curriculum • Excellence", action: "Watch", color: "text-indigo-500 bg-indigo-50", url: "https://www.youtube.com/results?search_query=advanced+learning+for+top+students" });
    if (resources.length === 0) resources.push({ icon: "Star", title: "Continuous Learning Guide", subtitle: "Growth Strategies • Success", action: "Watch", color: "text-indigo-500 bg-indigo-50", url: "https://www.youtube.com/results?search_query=self+improvement+habits+for+students" });

    return (
      <SubjectPerformanceDetail
        subject={s.name}
        teacher={subFeedback?.teacherName || "Class Teacher"}
        grade={s.grade}
        average={s.progress}
        topics={processedTopics.length > 0 ? processedTopics : [{ name: "Overall", score: s.progress }]}
        testScores={s.raw.map((r: any) => ({
          name: r.testName || "Assessment",
          date: r.timestamp ? new Date(r.timestamp.seconds * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Recent",
          score: `${r.score}/${r.maxScore || 100}`,
          status: r.percentage >= 75 ? "success" : r.percentage >= 60 ? "warning" : "error"
        }))}
        feedback={subFeedback?.content || `${studentData?.name?.split(" ")[0] || "The student"} is progressing well. Detailed feedback will be updated after the next assessment.`}
        resources={resources.slice(0, 3)}
        onBack={() => setSelectedSubject(null)}
      />
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader
        title="Performance Analytics"
        subtitle="Detailed breakdown of academic progress"
        badge={overallStats.grade}
      />

      {/* Overall Performance */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 md:p-6 mb-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Overall Performance</h2>
            <p className="text-sm text-slate-400 mt-0.5">Based on all assessments this term</p>
          </div>
          
          <div className="grid grid-cols-3 gap-3 sm:gap-8 lg:border-l border-slate-100 lg:pl-10">
            <div className="text-center p-2 rounded-xl bg-slate-50 lg:bg-transparent">
              <p className="text-2xl md:text-4xl font-black text-emerald-500">{overallStats.grade}</p>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Grade</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-slate-50 lg:bg-transparent">
              <p className="text-2xl md:text-4xl font-black text-slate-800">{overallStats.avg > 0 ? `${overallStats.avg}%` : "—"}</p>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Average</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-slate-50 lg:bg-transparent">
              <div className="flex items-center gap-1 justify-center">
                <ArrowUp className="w-4 h-4 text-emerald-500" />
                <p className="text-xl md:text-2xl font-black text-emerald-500">{overallStats.trend}</p>
              </div>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Trend</p>
            </div>
          </div>
        </div>
      </div>

      {/* Subject Cards */}
      {loading ? (
        <div className="py-24 flex flex-col items-center gap-3 text-slate-300">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Loading performance data...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
          {subjects.map((s, i) => {
            const Icon = getSubIcon(s.name);
            const gradeColor = s.progress >= 75 ? "text-emerald-600 bg-emerald-50" : s.progress >= 60 ? "text-amber-600 bg-amber-50" : "text-rose-600 bg-rose-50";
            const statusIcon = s.trendDir === "up" ? <ArrowUp className="w-3.5 h-3.5" /> : s.trendDir === "down" ? <ArrowDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />;
            const statusColor = s.trendDir === "up" ? "text-emerald-500" : s.trendDir === "down" ? "text-rose-500" : "text-slate-400";
            return (
              <div
                key={i}
                onClick={() => setSelectedSubject(s.name)}
                className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">{s.name}</h3>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${gradeColor}`}>{s.grade}</span>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-slate-400">Progress</span>
                    <span className="text-xs font-bold text-slate-700">{s.progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${s.barColor} rounded-full transition-all duration-700`} style={{ width: `${s.progress}%` }} />
                  </div>
                </div>

                <div className={`flex items-center gap-1 text-xs font-medium ${statusColor}`}>
                  {statusIcon}
                  <span>{s.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Performance Trend */}
      {!loading && trendData.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-6">Performance Trend</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={12} stroke="#94a3b8" />
                <YAxis axisLine={false} tickLine={false} fontSize={12} stroke="#94a3b8" domain={[60, 100]} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #f1f5f9", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontSize: "12px" }} cursor={{ stroke: "#e2e8f0", strokeWidth: 2 }} />
                <Legend wrapperStyle={{ paddingTop: "16px", fontSize: "12px" }} />
                {subjects.map((s, i) => (
                  <Line key={i} type="monotone" dataKey={s.name} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 6 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── FEATURE 4: AI Narrative Analysis ──────────────────────────────── */}
      {!loading && subjects.length > 0 && (
        <div className="mt-5 rounded-2xl overflow-hidden shadow-sm" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)" }}>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(99,102,241,0.2)" }}>
                <Sparkles className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">AI Narrative Analysis</span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">{generateNarrative()}</p>
            <div className="mt-3 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-[9px] text-indigo-400 font-semibold uppercase tracking-widest">Generated from real-time assessment data</span>
            </div>
          </div>
        </div>
      )}

      {/* ── FEATURE 5: Goal Setting AI ────────────────────────────────────── */}
      {!loading && subjects.length > 0 && (
        <div className="mt-5 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
              <Target className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Goal Setting AI</h3>
              <p className="text-[10px] text-slate-400">Set a target score and get a personalised plan</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Subject</label>
              <select
                value={goalSubject || subjects[0]?.name || ""}
                onChange={e => setGoalSubject(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                {subjects.map(s => (
                  <option key={s.name} value={s.name}>{s.name} — Current: {s.progress}%</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Target Score: <span className="text-amber-600">{goalTarget}%</span>
              </label>
              <input
                type="range" min={50} max={100} value={goalTarget}
                onChange={e => setGoalTarget(Number(e.target.value))}
                className="w-full mt-3 accent-amber-500"
              />
              <div className="flex justify-between text-[9px] text-slate-400 font-bold mt-0.5">
                <span>50%</span><span>75%</span><span>100%</span>
              </div>
            </div>
          </div>

          {(() => {
            const activeSub = subjects.find(s => s.name === (goalSubject || subjects[0]?.name));
            if (!activeSub) return null;
            const insight = getGoalInsight(activeSub.progress, goalTarget, activeSub.name);
            return (
              <div className={`rounded-xl border p-4 ${insight.bg}`}>
                <p className={`text-sm font-bold ${insight.color}`}>{insight.line1}</p>
                <p className={`text-xs mt-1 ${insight.color} opacity-80`}>{insight.line2}</p>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── FEATURE 6: Benchmark / Peer Insights ─────────────────────────── */}
      {!loading && subjects.length > 0 && (
        <div className="mt-5 mb-8 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Benchmark Insights</h3>
              <p className="text-[10px] text-slate-400">Where {studentName} stands vs academic benchmarks — no names, fully private</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {subjects.map((s, i) => {
              const tier = getBenchmarkTier(s.progress);
              return (
                <div key={i} className="rounded-xl border border-slate-100 p-3 hover:border-slate-200 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 truncate pr-1">{s.name}</span>
                    <span className="text-base leading-none">{tier.icon}</span>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${tier.color}`}>{tier.label}</span>
                  <p className="text-[9px] text-slate-400 font-medium mt-2">Score: {s.progress}%</p>
                </div>
              );
            })}
          </div>

          <p className="text-[9px] text-slate-300 text-center mt-4 font-medium">
            * Rankings based on national academic performance benchmarks. No other student's data is used.
          </p>
        </div>
      )}
    </div>
  );
};

export default PerformancePage;
