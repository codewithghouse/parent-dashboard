import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { CheckCircle, AlertCircle, Calendar, Star, ArrowUp, Clock, Loader2, Bell, ShieldCheck, BrainCircuit, Sparkles } from "lucide-react";
import { ParentAIController } from "../ai/controller/ai-controller";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDocs, Timestamp } from "firebase/firestore";

function timeAgo(date: Date): string {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 172800) return "Yesterday";
  return date.toLocaleDateString();
}

function getInitials(name: string): string {
  return (name || "")
    .split(" ")
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || "")
    .join("");
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 36, circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width="96" height="96" className="-rotate-90">
      <circle cx="48" cy="48" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
      <circle cx="48" cy="48" r={r} fill="none" stroke="#10b981" strokeWidth="10"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }} />
    </svg>
  );
}

const DashboardPage = () => {
  const { studentData, user } = useAuth();
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [liveStats, setLiveStats] = useState({
    attendance: 100,
    pending: 0,
    tests: 0,
    avgScore: 0,
    recentGrade: "N/A",
    recentSubject: "General",
    trendPct: 5,
  });
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [teacherInfo, setTeacherInfo] = useState({ name: "—" });
  const [studentMeta, setStudentMeta] = useState({ className: "—", rollNo: "—" });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!studentData?.id) return;
    const email = (studentData.email || "").toLowerCase();

    let attSnap1: any = null, attSnap2: any = null;
    const processAtt = () => {
      const combined = [...(attSnap1?.docs || []), ...(attSnap2?.docs || [])];
      const unique = Array.from(new Map(combined.map(d => [d.id, d.data()])).values());
      const present = unique.filter((r: any) => r.status === "present" || r.status === "late").length;
      const pct = unique.length === 0 ? 100 : Math.round((present / unique.length) * 100);
      setLiveStats(prev => ({ ...prev, attendance: pct }));
    };
    const u1 = onSnapshot(query(collection(db, "attendance"), where("studentId", "==", studentData.id)), s => { attSnap1 = s; processAtt(); });
    const u2 = email ? onSnapshot(query(collection(db, "attendance"), where("studentEmail", "==", email)), s => { attSnap2 = s; processAtt(); }) : () => {};

    let enSnap1: any = null, enSnap2: any = null;
    const processEnroll = async () => {
      const docs = [...(enSnap1?.docs || []), ...(enSnap2?.docs || [])];
      if (!docs.length) return;
      const first = docs[0].data();
      setTeacherInfo({ name: first.teacherName || "Class Teacher" });
      setStudentMeta({ className: first.className || studentData?.grade || "—", rollNo: first.rollNo || studentData?.rollNo || "—" });
      const classIds = [...new Set(docs.map(d => d.data().classId).filter(Boolean))] as string[];
      if (!classIds.length) { setDataLoading(false); return; }

      const [aSnap, tSnap, s1, s2] = await Promise.all([
        getDocs(query(collection(db, "assignments"), where("classId", "in", classIds))),
        getDocs(query(collection(db, "tests"), where("classId", "in", classIds))),
        getDocs(query(collection(db, "submissions"), where("studentId", "==", studentData.id))),
        email ? getDocs(query(collection(db, "submissions"), where("studentEmail", "==", email))) : Promise.resolve({ docs: [] as any[] }),
      ]);
      const subIds = new Set([...s1.docs, ...(s2 as any).docs].flatMap(d => [d.data().homeworkId, d.data().assignmentId].filter(Boolean)));
      const pending = aSnap.docs.filter(d => !subIds.has(d.id)).length;
      const today = new Date().toISOString().split("T")[0];
      const nw = new Date(); nw.setDate(nw.getDate() + 7);
      const tests = tSnap.docs.filter(d => { const dt = d.data().date; return dt >= today && dt <= nw.toISOString().split("T")[0]; }).length;
      setLiveStats(prev => ({ ...prev, pending, tests }));
      setDataLoading(false);
    };
    const u3 = onSnapshot(query(collection(db, "enrollments"), where("studentId", "==", studentData.id)), s => { enSnap1 = s; processEnroll(); });
    const u4 = email ? onSnapshot(query(collection(db, "enrollments"), where("studentEmail", "==", email)), s => { enSnap2 = s; processEnroll(); }) : () => {};

    let rSnap1: any = null, rSnap2: any = null, gSnap1: any = null, gSnap2: any = null;
    const processResults = () => {
      const testRes = [...(rSnap1?.docs || []), ...(rSnap2?.docs || [])].map(d => ({ id: d.id, ...d.data() as any }));
      const gbRes = [...(gSnap1?.docs || []), ...(gSnap2?.docs || [])].map(d => {
        const data = d.data();
        return { id: d.id, ...data, score: (data.mark / (data.maxMarks || 100)) * 100, subject: data.subject || data.className || "General", timestamp: data.updatedAt ? Timestamp.fromMillis(data.updatedAt) : Timestamp.now() };
      });
      const all = Array.from(new Map([...testRes, ...gbRes].map(d => [d.id, d])).values())
        .sort((a, b) => (b.timestamp?.toDate()?.getTime() || 0) - (a.timestamp?.toDate()?.getTime() || 0));
      if (!all.length) return;
      const avg = all.reduce((s, r) => s + (parseFloat(r.score) || 0), 0) / all.length;
      const latest = all[0];
      const grade = (s: number) => s >= 90 ? "A+" : s >= 80 ? "A" : s >= 70 ? "A-" : s >= 60 ? "B" : "C";
      setLiveStats(prev => ({ ...prev, avgScore: Math.round(avg), recentGrade: grade(parseFloat(latest.score) || 0), recentSubject: latest.className || latest.subject || "General" }));
    };
    const u5 = onSnapshot(query(collection(db, "results"), where("studentId", "==", studentData.id)), s => { rSnap1 = s; processResults(); });
    const u6 = email ? onSnapshot(query(collection(db, "results"), where("studentEmail", "==", email)), s => { rSnap2 = s; processResults(); }) : () => {};
    const u7 = onSnapshot(query(collection(db, "gradebook_scores"), where("studentId", "==", studentData.id)), s => { gSnap1 = s; processResults(); });
    const u8 = email ? onSnapshot(query(collection(db, "gradebook_scores"), where("studentEmail", "==", email)), s => { gSnap2 = s; processResults(); }) : () => {};

    let rkSnap1: any = null, rkSnap2: any = null;
    const processRisks = () => {
      const combined = [...(rkSnap1?.docs || []), ...(rkSnap2?.docs || [])];
      const unique = Array.from(new Map(combined.map(d => [d.id, { id: d.id, ...d.data() as any }])).values())
        .sort((a, b) => (b.timestamp?.toDate()?.getTime() || 0) - (a.timestamp?.toDate()?.getTime() || 0));
      setRecentAlerts(unique.slice(0, 3).map(d => ({ id: d.id, title: d.issue, time: d.timestamp?.toDate() || new Date(), urgent: d.severity === "Critical" })));
    };
    const u9 = onSnapshot(query(collection(db, "risks"), where("studentId", "==", studentData.id)), s => { rkSnap1 = s; processRisks(); });
    const u10 = email ? onSnapshot(query(collection(db, "risks"), where("studentEmail", "==", email)), s => { rkSnap2 = s; processRisks(); }) : () => {};

    return () => [u1, u2, u3, u4, u5, u6, u7, u8, u9, u10].forEach(u => u());
  }, [studentData?.id]);

  useEffect(() => {
    if (!studentData?.id || dataLoading) return;
    ParentAIController.getDashboardInsights({
      child_name: studentData.name,
      attendance: `${liveStats.attendance}%`,
      avg_score: `${liveStats.avgScore}%`,
      pending: liveStats.pending,
      grade: studentData.grade || "8"
    }).then(r => { if (r.status === "success") setAiInsights(r.data); }).catch(() => {});
  }, [studentData?.id, dataLoading]);

  if (studentData?.status === "Invited") return (
    <div className="h-[80vh] flex flex-col items-center justify-center p-10 text-center gap-4">
      <Loader2 className="w-12 h-12 text-[#1e3a8a] animate-spin opacity-40" />
      <h2 className="text-xl font-bold text-slate-700">Setting up your account...</h2>
      <p className="text-sm text-slate-400">Your access is being provisioned. Please wait.</p>
    </div>
  );

  const greeting = currentTime.getHours() < 12 ? "Good Morning" : currentTime.getHours() < 17 ? "Good Afternoon" : "Good Evening";
  const parentFirstName = user?.displayName?.split(" ")[0] || "Parent";
  const childFirstName = studentData?.name?.split(" ")[0] || "your child";
  const userInitials = getInitials(user?.displayName || "RS");
  const studentInitials = getInitials(studentData?.name || "AS");

  return (
    <div className="animate-in fade-in duration-500 pb-20">

      {/* Top Bar */}
      <div className="flex justify-between items-center mb-8">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Result of click: "Dashboard"</p>
        <div className="flex items-center gap-3">
          <button className="relative w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center transition-all">
            <Bell className="w-4 h-4 text-slate-500" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1e3a8a] text-white flex items-center justify-center text-xs font-bold">{userInitials}</div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-slate-800 leading-none">{user?.displayName || "Parent"}</p>
              <p className="text-xs text-slate-400 mt-0.5">Parent</p>
            </div>
          </div>
        </div>
      </div>

      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">{greeting}, {parentFirstName}! 👋</h1>
        <p className="text-slate-500 mt-1">Here's how {childFirstName} is doing today</p>
      </div>

      {/* Academic Health */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 mb-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Academic Health</h3>
          <p className="text-sm text-slate-400 mt-0.5">Overall performance indicator</p>
          <div className="flex items-center gap-2 text-emerald-500 font-semibold text-sm mt-4">
            <ArrowUp className="w-4 h-4" />
            <span>Improved by {liveStats.trendPct}% from last month</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-4xl font-bold text-emerald-500">{liveStats.avgScore > 0 ? `${liveStats.avgScore}%` : "—"}</p>
            <p className="text-xs text-slate-400 mt-1">{liveStats.avgScore >= 75 ? "Good Standing" : liveStats.avgScore > 0 ? "Needs Attention" : "No data yet"}</p>
          </div>
          <ProgressRing pct={liveStats.avgScore} />
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { icon: CheckCircle, colorCls: "bg-emerald-50 text-emerald-600", tagCls: "text-emerald-600", label: "Attendance", value: `${liveStats.attendance}%`, tag: liveStats.attendance >= 85 ? "On track" : "Below target" },
          { icon: AlertCircle, colorCls: "bg-amber-50 text-amber-600", tagCls: "text-amber-500", label: "Pending Work", value: liveStats.pending.toString(), tag: "Due this week" },
          { icon: Calendar, colorCls: "bg-indigo-50 text-indigo-600", tagCls: "text-slate-400", label: "Upcoming Tests", value: liveStats.tests.toString(), tag: "Next 7 days" },
          { icon: Star, colorCls: "bg-emerald-50 text-emerald-600", tagCls: "text-emerald-600", label: "Recent Grade", value: liveStats.recentGrade, tag: liveStats.recentSubject },
        ].map(({ icon: Icon, colorCls, tagCls, label, value, tag }) => (
          <div key={label} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${colorCls}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-400 mb-1">{label}</p>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <p className={`text-xs font-medium mt-1 ${tagCls}`}>{tag}</p>
          </div>
        ))}
      </div>

      {/* Student Profile + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-2xl bg-[#1e3a8a] text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
              {studentInitials}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">{studentData?.name || "Student"}</h3>
              <p className="text-sm text-slate-400 mt-0.5">
                {studentMeta.className !== "—" ? `Grade ${studentMeta.className}` : studentData?.grade ? `Grade ${studentData.grade}` : ""}
                {studentMeta.rollNo !== "—" ? ` • Roll ${studentMeta.rollNo}` : ""}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-5">
            <div>
              <p className="text-xs text-slate-400 mb-1">Class Teacher</p>
              <p className="text-sm font-semibold text-slate-700">{teacherInfo.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Academic Year</p>
              <p className="text-sm font-semibold text-slate-700">2025-26</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-4">Recent Alerts</h3>
          <div className="space-y-3">
            {recentAlerts.length > 0 ? recentAlerts.map(alert => (
              <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-xl ${alert.urgent ? "bg-amber-50" : "bg-emerald-50"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${alert.urgent ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`}>
                  {alert.urgent ? <Clock className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 leading-snug">{alert.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{timeAgo(alert.time)}</p>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-8 text-slate-300 gap-2">
                <ShieldCheck className="w-10 h-10" />
                <p className="text-xs">No alerts right now</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="bg-slate-900 rounded-2xl p-7 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <BrainCircuit className="w-48 h-48" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-300">AI Insight</span>
          </div>
          <p className="text-base font-medium text-slate-100 leading-relaxed max-w-2xl">
            "{aiInsights?.child_summary_narrative || `${childFirstName} is meeting academic expectations. A detailed summary will appear once more activity data is available.`}"
          </p>
        </div>
      </div>

    </div>
  );
};

export default DashboardPage;
