import { useState, useEffect } from "react";
import {
  Calendar, CheckCircle, Clock, Loader2,
  FlaskConical, Calculator, Book, History, GraduationCap
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, limit } from "firebase/firestore";
import { PageHeader } from "@/components/ui/PageHeader";

const TestsPage = () => {
  const { studentData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [upcomingTests, setUpcomingTests] = useState<any[]>([]);
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [stats, setStats] = useState({ aGrade: 0, bGrade: 0, cGrade: 0, belowC: 0, totalTaken: 0 });

  useEffect(() => {
    if (!studentData?.id) return;
    setLoading(true);
    const studentEmail = studentData.email?.toLowerCase() || "";

    // Dual-lookup enrollments → classIds → tests
    let enrollSnap1: any = null, enrollSnap2: any = null;
    let unsubTests: any = () => {};

    const processEnrollments = () => {
      const enrollDocs = [...(enrollSnap1?.docs || []), ...(enrollSnap2?.docs || [])];
      const classIds = Array.from(new Set(enrollDocs.map(d => d.data().classId).filter(Boolean))) as string[];
      const searchIds = classIds.length > 0 ? classIds : [studentData.classId || "General"];

      unsubTests();
      unsubTests = onSnapshot(query(collection(db, "tests"), where("classId", "in", searchIds.slice(0, 10))), (snap) => {
        const now = new Date();
        const filtered = snap.docs
          .map(d => ({ id: d.id, ...(d.data() as any) }))
          .filter(t => { const d = t.date || t.testDate; return d && new Date(d) >= now; })
          .sort((a, b) => new Date(a.date || a.testDate).getTime() - new Date(b.date || b.testDate).getTime());
        setUpcomingTests(filtered);
      });
    };

    const unsubEnroll1 = onSnapshot(query(collection(db, "enrollments"), where("studentId", "==", studentData.id)), (snap) => {
      enrollSnap1 = snap; processEnrollments();
    });
    const unsubEnroll2 = studentEmail ? onSnapshot(query(collection(db, "enrollments"), where("studentEmail", "==", studentEmail)), (snap) => {
      enrollSnap2 = snap; processEnrollments();
    }) : () => {};

    // Dual-lookup test_scores
    let scoreSnap1: any = null, scoreSnap2: any = null;
    const processScores = () => {
      const scoreDocs = [...(scoreSnap1?.docs || []), ...(scoreSnap2?.docs || [])];
      const scoreMap = new Map();
      scoreDocs.forEach(d => { if (!scoreMap.has(d.id)) scoreMap.set(d.id, { id: d.id, ...d.data() }); });
      const scores = Array.from(scoreMap.values()).sort((a: any, b: any) => {
        const tA = a.timestamp?.toMillis?.() || new Date(a.timestamp || 0).getTime();
        const tB = b.timestamp?.toMillis?.() || new Date(b.timestamp || 0).getTime();
        return tB - tA;
      });
      setRecentResults(scores);
      let a = 0, b = 0, c = 0, d = 0;
      scores.forEach((s: any) => {
        const pct = s.percentage ?? (s.score / s.maxScore * 100);
        if (pct >= 85) a++; else if (pct >= 70) b++; else if (pct >= 50) c++; else d++;
      });
      setStats({ aGrade: a, bGrade: b, cGrade: c, belowC: d, totalTaken: scores.length });
      setLoading(false);
    };

    const unsubScore1 = onSnapshot(query(collection(db, "test_scores"), where("studentId", "==", studentData.id), limit(20)), (snap) => {
      scoreSnap1 = snap; processScores();
    });
    const unsubScore2 = studentEmail ? onSnapshot(query(collection(db, "test_scores"), where("studentEmail", "==", studentEmail), limit(20)), (snap) => {
      scoreSnap2 = snap; processScores();
    }) : () => {};

    return () => { unsubEnroll1(); unsubEnroll2(); unsubScore1(); unsubScore2(); unsubTests(); };
  }, [studentData?.id]);

  const getSubjectIcon = (title: string = "") => {
    const t = title.toLowerCase();
    if (t.includes("sci")) return { icon: <FlaskConical className="w-5 h-5" />, bg: "bg-green-100 text-green-600" };
    if (t.includes("math")) return { icon: <Calculator className="w-5 h-5" />, bg: "bg-blue-100 text-blue-600" };
    if (t.includes("history")) return { icon: <History className="w-5 h-5" />, bg: "bg-rose-100 text-rose-500" };
    if (t.includes("english") || t.includes("lang")) return { icon: <Book className="w-5 h-5" />, bg: "bg-orange-100 text-orange-500" };
    return { icon: <GraduationCap className="w-5 h-5" />, bg: "bg-slate-100 text-slate-500" };
  };

  const getDayDiff = (dateStr: string) => {
    if (!dateStr) return 0;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
  };

  const formatDate = (date: any) => {
    if (!date) return "--";
    const d = date?.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const nextTest = upcomingTests[0];

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader
        title="Tests & Examinations"
        subtitle="Track upcoming assessments and latest outcomes"
        badge={stats.totalTaken > 0 ? `${stats.totalTaken} Completed` : ""}
      />

      {/* Upcoming Banner - Optimized for mobile */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-5 md:p-8 mb-6 text-white relative overflow-hidden shadow-xl shadow-blue-900/10">
        <div className="absolute top-0 right-0 opacity-10 scale-150 transform translate-x-1/4 -translate-y-1/4">
          <GraduationCap size={150} />
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
          <div className="flex items-center text-center sm:text-left flex-col sm:flex-row gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Calendar className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-100 mb-1">Coming Up Next</p>
              <h2 className="text-2xl md:text-3xl font-black mb-1">{nextTest?.testName || "No upcoming tests"}</h2>
              <p className="text-sm text-blue-100 font-bold opacity-80">
                {nextTest?.date ? formatDate(nextTest.date) : "—"} • {nextTest?.time || "9:00 AM"}
              </p>
            </div>
          </div>
          
          {nextTest && (
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-8 py-4 text-center min-w-[120px]">
              <p className="text-4xl md:text-5xl font-black leading-none mb-1 text-white">{getDayDiff(nextTest.date)}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Days Left</p>
            </div>
          )}
        </div>
      </div>

      {/* Two-column: Upcoming + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">

        {/* Upcoming Tests */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-4">Upcoming Tests</h3>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
          ) : upcomingTests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-300 gap-2">
              <CheckCircle className="w-10 h-10 text-emerald-200" />
              <p className="text-xs">No upcoming tests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingTests.map((t, i) => {
                const { icon, bg } = getSubjectIcon(t.testName || t.subject);
                return (
                  <div key={i} className="flex items-center justify-between p-3.5 rounded-xl hover:bg-slate-50 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>{icon}</div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{t.testName}</p>
                        <p className="text-xs text-slate-400">{formatDate(t.date)}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
                      {getDayDiff(t.date)} days
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Results */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-4">Recent Results</h3>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
          ) : recentResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-300 gap-2">
              <Clock className="w-10 h-10 text-slate-200" />
              <p className="text-xs">No results yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentResults.slice(0, 5).map((r, i) => {
                const pct = r.percentage ?? (r.score / r.maxScore * 100);
                const isHigh = pct >= 80;
                const { icon, bg } = getSubjectIcon(r.testName || r.subject);
                return (
                  <div key={i} className="flex items-center justify-between p-3.5 rounded-xl hover:bg-slate-50 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>{icon}</div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{r.testName}</p>
                        <p className="text-xs text-slate-400">{formatDate(r.timestamp)}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${isHigh ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-600"}`}>
                      {r.score}/{r.maxScore}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* This Term Performance */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-slate-800">This Term Performance</h3>
          <p className="text-sm text-slate-400">{stats.totalTaken} tests taken</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { val: stats.aGrade, label: "A Grade", color: "text-emerald-600", bg: "bg-emerald-50" },
            { val: stats.bGrade, label: "B Grade", color: "text-blue-600", bg: "bg-blue-50" },
            { val: stats.cGrade, label: "C Grade", color: "text-orange-500", bg: "bg-orange-50" },
            { val: stats.belowC, label: "Below C", color: "text-rose-600", bg: "bg-rose-50" },
          ].map((g, i) => (
            <div key={i} className={`${g.bg} rounded-xl p-5 text-center`}>
              <p className={`text-4xl font-bold ${g.color} mb-1`}>{g.val}</p>
              <p className="text-xs text-slate-500">{g.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TestsPage;
