import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { CheckCircle, AlertCircle, Calendar, Star, Clock, Loader2, ShieldCheck, BrainCircuit, Sparkles, TrendingUp, BookOpen, Lightbulb, Download } from "lucide-react";
import { ParentAIController } from "../ai/controller/ai-controller";
import { generateWeeklyReport } from "../ai/engines/weekly-report-engine";
import WeeklyReportPDF from "../components/WeeklyReportPDF";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDocs, Timestamp } from "firebase/firestore";
import { useIsMobile } from "@/hooks/use-mobile";

function timeAgo(date: Date): string {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 172800) return "Yesterday";
  return date.toLocaleDateString();
}

function generateSmartParentingTips(stats: { attendance: number; avgScore: number; pending: number; tests: number }, childName: string) {
  const tips: { tip: string; reason: string }[] = [];
  const name = childName || "your child";

  if (stats.attendance < 75) {
    tips.push({
      tip: `Make school attendance a top priority for ${name}`,
      reason: `Attendance is at ${stats.attendance}% — below 75% risks missing critical lessons and falling behind peers.`
    });
  } else if (stats.attendance < 85) {
    tips.push({
      tip: `Work on improving ${name}'s attendance consistency`,
      reason: `At ${stats.attendance}%, a few more absences could affect term performance. Aim for 90%+.`
    });
  } else {
    tips.push({
      tip: `Keep up ${name}'s great attendance habit`,
      reason: `${stats.attendance}% attendance is excellent — consistent presence directly improves academic retention.`
    });
  }

  if (stats.avgScore > 0 && stats.avgScore < 60) {
    tips.push({
      tip: `Schedule dedicated revision time at home with ${name}`,
      reason: `Average score is ${stats.avgScore}% — focused daily revision of 30–45 mins can significantly improve results.`
    });
  } else if (stats.avgScore >= 60 && stats.avgScore < 80) {
    tips.push({
      tip: `Encourage ${name} to practice weak subjects with extra exercises`,
      reason: `Scoring ${stats.avgScore}% on average — targeted practice on lower-scoring subjects will push overall grades higher.`
    });
  } else if (stats.avgScore >= 80) {
    tips.push({
      tip: `Challenge ${name} with advanced problems to stay ahead`,
      reason: `Strong ${stats.avgScore}% average — keeping the mind challenged prevents complacency and builds exam confidence.`
    });
  }

  if (stats.pending > 3) {
    tips.push({
      tip: `Help ${name} create a daily homework schedule`,
      reason: `There are ${stats.pending} pending assignments — prioritizing them daily prevents last-minute pressure and missed deadlines.`
    });
  } else if (stats.pending > 0) {
    tips.push({
      tip: `Remind ${name} to complete ${stats.pending} pending assignment${stats.pending > 1 ? "s" : ""} this week`,
      reason: `Staying on top of assignments builds discipline and prevents grade penalties.`
    });
  }

  if (stats.tests > 0) {
    tips.push({
      tip: `Start test preparation now — ${stats.tests} test${stats.tests > 1 ? "s" : ""} coming up this week`,
      reason: `Reviewing notes 2–3 days before tests instead of last-minute cramming improves retention by up to 50%.`
    });
  }

  // Always include a health tip
  tips.push({
    tip: `Ensure ${name} gets 8–9 hours of sleep on school nights`,
    reason: `Sleep directly impacts memory consolidation — well-rested students perform better in class and retain lessons longer.`
  });

  return tips.slice(0, 3); // Max 3 tips
}

function getInitials(name: string): string {
  return (name || "")
    .split(" ")
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || "")
    .join("");
}

/** Donut ring — used for attendance & score */
function DonutRing({ pct, color, size = 80, stroke = 9, label }: { pct: number; color: string; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  const c = size / 2;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease", filter: `drop-shadow(0 0 6px ${color}90)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-black text-white leading-none">{pct}%</span>
        {label && <span className="text-[8px] text-slate-500 font-medium mt-0.5">{label}</span>}
      </div>
    </div>
  );
}

/** Thin horizontal bar */
function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}80` }} />
    </div>
  );
}

/** Score arc (half-circle gauge) */
function ScoreArc({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const stroke = 9;
  const r = (size - stroke * 2) / 2;
  const circ = Math.PI * r; // half circle
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  const cx = size / 2, cy = size / 2 + 8;
  return (
    <div className="relative flex items-end justify-center" style={{ width: size, height: size / 2 + 14 }}>
      <svg width={size} height={size / 2 + 10} style={{ overflow: "visible" }}>
        <path d={`M ${stroke} ${cy} A ${r} ${r} 0 0 1 ${size - stroke} ${cy}`}
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} strokeLinecap="round" />
        <path d={`M ${stroke} ${cy} A ${r} ${r} 0 0 1 ${size - stroke} ${cy}`}
          fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease", filter: `drop-shadow(0 0 6px ${color}90)` }} />
      </svg>
      <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
        <span className="text-sm font-black text-white leading-none">{pct > 0 ? `${pct}%` : "N/A"}</span>
      </div>
    </div>
  );
}

const DashboardPage = () => {
  const { studentData, user } = useAuth();
  const isMobile = useIsMobile();
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [liveStats, setLiveStats] = useState({
    attendance: 100,
    pending: 0,
    tests: 0,
    avgScore: 0,
    recentGrade: "N/A",
    recentSubject: "General",
    trendPct: 0,
  });
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [teacherInfo, setTeacherInfo] = useState({ name: "—" });
  const [studentMeta, setStudentMeta] = useState({ className: "—", rollNo: "—" });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dataLoading, setDataLoading] = useState(true);
  const [smartTips, setSmartTips] = useState<{ tip: string; reason: string }[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<any>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfData, setPdfData] = useState<any>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!studentData?.id) return;
    const schoolId = studentData.schoolId;

    // Helper: build a scoped query (schoolId filter when available prevents cross-school reads)
    const sq = (collName: string, field = "studentId", value = studentData.id) =>
      schoolId
        ? query(collection(db, collName), where("schoolId", "==", schoolId), where(field, "==", value))
        : query(collection(db, collName), where(field, "==", value));

    // 1. Attendance — single listener (was 2)
    const u1 = onSnapshot(sq("attendance"), snap => {
      const records = snap.docs.map(d => d.data());
      const present = records.filter((r: any) => r.status === "present" || r.status === "late").length;
      const pct = records.length === 0 ? 100 : Math.round((present / records.length) * 100);
      setLiveStats(prev => ({ ...prev, attendance: pct }));
    });

    // 2. Enrollments → assignments + tests (single listener, was 2 + unbounded classIds)
    let enSnap: any = null;
    const processEnroll = async () => {
      const docs = enSnap?.docs || [];
      if (!docs.length) { setDataLoading(false); return; }
      const first = docs[0].data();
      setTeacherInfo({ name: first.teacherName || "Class Teacher" });
      setStudentMeta({ className: first.className || studentData?.grade || "—", rollNo: first.rollNo || studentData?.rollNo || "—" });
      const classIds = [...new Set(docs.map((d: any) => d.data().classId).filter(Boolean))] as string[];
      if (!classIds.length) { setDataLoading(false); return; }

      // Chunk classIds to handle >10 (Firestore "in" operator limit)
      const chunks: string[][] = [];
      for (let i = 0; i < classIds.length; i += 10) chunks.push(classIds.slice(i, i + 10));

      const [aSnaps, tSnaps, subSnap] = await Promise.all([
        Promise.all(chunks.map(c => getDocs(query(collection(db, "assignments"), where("classId", "in", c))))),
        Promise.all(chunks.map(c => getDocs(query(collection(db, "tests"), where("classId", "in", c))))),
        getDocs(sq("submissions")),
      ]);
      const allAssignments = aSnaps.flatMap(s => s.docs);
      const allTests = tSnaps.flatMap(s => s.docs);
      const subIds = new Set(subSnap.docs.flatMap(d => [d.data().homeworkId, d.data().assignmentId].filter(Boolean)));
      const pending = allAssignments.filter(d => !subIds.has(d.id)).length;
      const today = new Date().toISOString().split("T")[0];
      const nw = new Date(); nw.setDate(nw.getDate() + 7);
      const tests = allTests.filter(d => { const dt = d.data().date; return dt >= today && dt <= nw.toISOString().split("T")[0]; }).length;
      setLiveStats(prev => ({ ...prev, pending, tests }));
      setDataLoading(false);
    };
    const u2 = onSnapshot(sq("enrollments"), s => { enSnap = s; processEnroll(); });

    // 3. Results + gradebook — single listener each (was 4)
    let rSnap: any = null, gSnap: any = null;
    const processResults = () => {
      const testRes = (rSnap?.docs || []).map((d: any) => ({ id: d.id, ...d.data() as any }));
      const gbRes = (gSnap?.docs || []).map((d: any) => {
        const data = d.data();
        return { id: d.id, ...data, score: (data.mark / (data.maxMarks || 100)) * 100, subject: data.subject || data.className || "General", timestamp: data.updatedAt ? Timestamp.fromMillis(data.updatedAt) : Timestamp.now() };
      });
      const all = Array.from(new Map([...testRes, ...gbRes].map(d => [d.id, d])).values())
        .sort((a, b) => (b.timestamp?.toDate()?.getTime() || 0) - (a.timestamp?.toDate()?.getTime() || 0));
      if (!all.length) return;
      const avg = all.reduce((s, r) => s + (parseFloat(r.score) || 0), 0) / all.length;
      const latest = all[0];
      const grade = (s: number) => s >= 90 ? "A+" : s >= 80 ? "A" : s >= 70 ? "A-" : s >= 60 ? "B" : "C";
      const scores = all.map(r => parseFloat(r.score) || 0);
      const recent3 = scores.slice(0, 3);
      const prev3 = scores.slice(3, 6);
      let trendPct = 0;
      if (recent3.length > 0 && prev3.length > 0) {
        const recentAvg = recent3.reduce((a, b) => a + b, 0) / recent3.length;
        const prevAvg = prev3.reduce((a, b) => a + b, 0) / prev3.length;
        trendPct = Math.round(recentAvg - prevAvg);
      }
      setLiveStats(prev => ({ ...prev, avgScore: Math.round(avg), recentGrade: grade(parseFloat(latest.score) || 0), recentSubject: latest.className || latest.subject || "General", trendPct }));
    };
    const u3 = onSnapshot(sq("results"), s => { rSnap = s; processResults(); });
    const u4 = onSnapshot(sq("gradebook_scores"), s => { gSnap = s; processResults(); });

    // 4. Risks — single listener (was 2)
    const u5 = onSnapshot(sq("risks"), snap => {
      const unique = snap.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .sort((a, b) => (b.timestamp?.toDate()?.getTime() || 0) - (a.timestamp?.toDate()?.getTime() || 0));
      setRecentAlerts(unique.slice(0, 3).map(d => ({ id: d.id, title: d.issue, time: d.timestamp?.toDate() || new Date(), urgent: d.severity === "Critical" })));
    });

    return () => [u1, u2, u3, u4, u5].forEach(u => u());
  }, [studentData?.id, studentData?.schoolId]);

  useEffect(() => {
    if (dataLoading) return;
    setSmartTips(generateSmartParentingTips(liveStats, studentData?.name?.split(" ")[0] || ""));
  }, [dataLoading, liveStats.attendance, liveStats.avgScore, liveStats.pending, liveStats.tests]);

  // Week config: Fri/Sat/Sun = generate window; Mon = prev week report + block
  const getWeekConfig = () => {
    const day = new Date().getDay(); // 0=Sun,1=Mon,...5=Fri,6=Sat
    const now = new Date();
    // This week's Sunday (end of this reporting week)
    const thisSunday = new Date(now);
    thisSunday.setDate(now.getDate() + (day === 0 ? 0 : 7 - day));
    const thisWeekKey = `weekly_report_${studentData?.id}_${thisSunday.toISOString().split("T")[0]}`;
    // Previous week's Sunday
    const prevSunday = new Date(thisSunday);
    prevSunday.setDate(prevSunday.getDate() - 7);
    const prevWeekKey = `weekly_report_${studentData?.id}_${prevSunday.toISOString().split("T")[0]}`;
    const canGenerate = day === 5 || day === 6 || day === 0;
    const daysLeft = ({ 1: 4, 2: 3, 3: 2, 4: 1 } as any)[day] ?? 0;
    return { canGenerate, thisWeekKey, prevWeekKey, isMonday: day === 1, daysLeft, day };
  };

  // Load cached weekly report on mount
  useEffect(() => {
    if (!studentData?.id) return;
    const { thisWeekKey, prevWeekKey, isMonday, canGenerate } = getWeekConfig();
    // Try current week first
    const cached = localStorage.getItem(thisWeekKey);
    if (cached) { try { setWeeklyReport(JSON.parse(cached)); return; } catch {} }
    // Monday with no current report → load prev week's report (read-only)
    if (isMonday || !canGenerate) {
      const prevCached = localStorage.getItem(prevWeekKey);
      if (prevCached) { try { setWeeklyReport(JSON.parse(prevCached)); } catch {} }
    }
  }, [studentData?.id]);

  const handleGenerateWeeklyReport = async () => {
    if (!studentData?.id || weeklyLoading) return;
    setWeeklyLoading(true);
    try {
      const now = new Date();
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - 6); weekStart.setHours(0, 0, 0, 0);
      const weekStartStr = weekStart.toISOString().split("T")[0];
      const weekEndStr = now.toISOString().split("T")[0];
      const { thisWeekKey: weekCacheKey } = getWeekConfig();

      const schoolId = studentData.schoolId;
      // Scoped query helper for report fetches
      const rq = (collName: string, extraFilters: any[] = []) => {
        const base = schoolId
          ? query(collection(db, collName), where("schoolId", "==", schoolId), where("studentId", "==", studentData.id), ...extraFilters)
          : query(collection(db, collName), where("studentId", "==", studentData.id), ...extraFilters);
        return getDocs(base);
      };

      // Fetch only this week's attendance — date range filter avoids fetching years of history
      const attSnap = await rq("attendance", [where("date", ">=", weekStartStr)]);
      const attDocs = attSnap.docs.map(d => d.data());
      const attPresent = attDocs.filter((d: any) => d.status === "present").length;
      const attLate = attDocs.filter((d: any) => d.status === "late").length;
      const attAbsent = attDocs.filter((d: any) => d.status === "absent").length;
      const attTotal = attDocs.length;
      const attPct = attTotal === 0 ? 100 : Math.round(((attPresent + attLate) / attTotal) * 100);

      // Fetch this week's results (scoped, no full history scan)
      const resSnap = await rq("results");
      const resDocs = resSnap.docs.map(d => d.data());
      const weekTests = resDocs
        .filter((d: any) => { const dt = d.date || d.createdAt?.toDate?.()?.toISOString?.()?.split?.("T")?.[0] || ""; return dt >= weekStartStr; })
        .map((d: any) => {
          const score = parseFloat(d.score) || 0;
          const max = parseFloat(d.maxScore || d.totalMarks || 100);
          const pct = (score / max) * 100;
          return { subject: d.subject || d.className || "General", score, max, grade: pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B+" : pct >= 60 ? "B" : "C" };
        });

      const reportData = {
        child_name: studentData.name,
        grade: studentData.grade || "8",
        week_start: weekStartStr,
        week_end: weekEndStr,
        attendance: { present: attPresent, absent: attAbsent, late: attLate, total: attTotal, pct: attPct },
        tests: weekTests,
        assignments: { total: liveStats.pending + 2, submitted: 2, pending: liveStats.pending },
        overall_avg: liveStats.avgScore,
        recent_alerts: recentAlerts.map(a => a.title).slice(0, 3),
      };

      const report = await generateWeeklyReport(reportData);
      if (report) {
        setWeeklyReport(report);
        setPdfData({ ...reportData, weekEnd: weekEndStr });
        try { localStorage.setItem(weekCacheKey, JSON.stringify(report)); } catch {}
      }
    } catch (e) {
      console.error("Weekly report generation failed:", e);
    } finally {
      setWeeklyLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!pdfRef.current || !weeklyReport) return;
    setPdfDownloading(true);

    const el = pdfRef.current;
    const wrapper = el.parentElement as HTMLElement | null;

    // Temporarily bring into viewport so html2canvas can render SVGs correctly
    const origStyle = wrapper?.style.cssText || "";
    if (wrapper) {
      wrapper.style.cssText =
        "position:fixed;top:0;left:0;z-index:99999;background:#fff;overflow:auto;";
    }

    try {
      // Give browser one frame to paint charts
      await new Promise(r => setTimeout(r, 300));

      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).jsPDF;

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#060e1c",
        logging: false,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });

      // Restore hidden state immediately after capture
      if (wrapper) wrapper.style.cssText = origStyle;

      const imgData = canvas.toDataURL("image/png");
      // Landscape A4
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();  // 297mm
      const pageH = pdf.internal.pageSize.getHeight(); // 210mm
      const imgH = (canvas.height * pageW) / canvas.width;

      let y = 0;
      while (y < imgH) {
        pdf.addImage(imgData, "PNG", 0, -y, pageW, imgH);
        if (y + pageH < imgH) pdf.addPage();
        y += pageH;
      }
      pdf.save(`${studentData?.name || "Student"}_WeeklyReport_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (e) {
      console.error("PDF generation failed:", e);
      if (wrapper) wrapper.style.cssText = origStyle;
    } finally {
      setPdfDownloading(false);
    }
  };

  useEffect(() => {
    if (!studentData?.id || dataLoading) return;
    ParentAIController.getDashboardInsights({
      child_name: studentData.name,
      attendance: `${liveStats.attendance}%`,
      avg_score: `${liveStats.avgScore}%`,
      pending_assignments: liveStats.pending,
      upcoming_tests: liveStats.tests,
      recent_grade: liveStats.recentGrade,
      recent_subject: liveStats.recentSubject,
      grade: studentData.grade || "8",
      recent_alerts: recentAlerts.map(a => a.title).slice(0, 3),
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
  const weekConfig = getWeekConfig();
  const isPrevWeekReport = !!weeklyReport && !weekConfig.canGenerate && !localStorage.getItem(weekConfig.thisWeekKey);

  /* ═══════════════════════════════════════════════════════════════
     MOBILE — Premium iOS-style UI
     ═══════════════════════════════════════════════════════════════ */
  if (isMobile) {
    const scoreColor = liveStats.avgScore >= 80 ? "#34C759" : liveStats.avgScore >= 60 ? "#FF9500" : "#FF3B30";
    const scorePct = Math.min(liveStats.avgScore, 100);
    const attColor = liveStats.attendance >= 85 ? "#FF9500" : liveStats.attendance >= 70 ? "#FF9500" : "#FF3B30";
    const avgScoreColor = liveStats.avgScore >= 80 ? "#34C759" : liveStats.avgScore >= 60 ? "#FF9500" : "#FF3B30";
    const ringR = 38, ringCirc = 2 * Math.PI * ringR;
    const ringOffset = ringCirc - (scorePct / 100) * ringCirc;

    return (
      <div className="animate-in fade-in duration-500 -mx-3 -mt-3 md:mx-0 md:mt-0" style={{ background: "#F2F2F7", minHeight: "100vh" }}>

        {/* ── Greeting ── */}
        <div className="px-5 pt-5 pb-1">
          <h1 className="text-[28px] font-bold tracking-tight leading-[1.15]" style={{ color: "#1C1C1E", letterSpacing: "-0.5px" }}>
            {greeting},<br />{parentFirstName}! 👋
          </h1>
          <p className="text-[15px] mt-1" style={{ color: "#8E8E93" }}>Here's how {childFirstName} is doing today</p>
        </div>

        {/* ── Academic Health Card ── */}
        <div className="mx-5 mt-5 bg-white rounded-[24px] p-5 relative overflow-hidden" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <div className="absolute -top-[30px] -right-[30px] w-[140px] h-[140px] rounded-full" style={{ background: "radial-gradient(circle, rgba(0,122,255,0.05) 0%, transparent 70%)" }} />
          <div className="relative z-10">
            <h3 className="text-[19px] font-bold tracking-tight" style={{ color: "#1C1C1E" }}>Academic Health</h3>
            <p className="text-[13px] mt-0.5" style={{ color: "#8E8E93" }}>Overall performance indicator</p>
            <div className="inline-flex items-center gap-[5px] mt-3 px-3 py-[5px] rounded-full text-[13px] font-semibold"
              style={{
                background: liveStats.trendPct >= 0 ? "#E8F9ED" : "#FFEBEA",
                color: liveStats.trendPct >= 0 ? "#1A7A36" : "#FF3B30"
              }}>
              <TrendingUp className={`w-[13px] h-[13px] ${liveStats.trendPct < 0 ? "rotate-180" : ""}`} />
              {liveStats.trendPct === 0 ? "Stable performance" : liveStats.trendPct > 0 ? `Improved by ${liveStats.trendPct}%` : `Declined by ${Math.abs(liveStats.trendPct)}%`}
            </div>
            <div className="flex items-center justify-between mt-5">
              <div>
                <div className="text-[40px] font-bold leading-none" style={{ color: scoreColor, letterSpacing: "-1px" }}>
                  {liveStats.avgScore > 0 ? `${liveStats.avgScore}%` : "—"}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] mt-1" style={{ color: "#AEAEB2" }}>
                  {liveStats.avgScore >= 75 ? "Good Standing" : liveStats.avgScore > 0 ? "Needs Attention" : "No data yet"}
                </div>
              </div>
              <div className="relative w-[88px] h-[88px]">
                <svg viewBox="0 0 88 88" width="88" height="88" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="44" cy="44" r={ringR} fill="none" stroke="#F2F2F7" strokeWidth="6" />
                  <circle cx="44" cy="44" r={ringR} fill="none" stroke={scoreColor} strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={ringCirc} strokeDashoffset={ringOffset}
                    style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[15px] font-bold" style={{ color: "#1C1C1E" }}>
                  {liveStats.avgScore > 0 ? `${liveStats.avgScore}%` : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats Grid 2×2 ── */}
        <div className="grid grid-cols-2 gap-3 mx-5 mt-3">
          {[
            { icon: CheckCircle, iconColor: "#34C759", bg: "#E8F9ED", label: "Attendance", value: `${liveStats.attendance}%`, status: liveStats.attendance >= 85 ? "On track ✓" : "Below target", statusColor: "#34C759" },
            { icon: AlertCircle, iconColor: "#FF9500", bg: "#FFF3E0", label: "Pending Work", value: liveStats.pending.toString(), status: "Due this week", statusColor: "#FF9500" },
            { icon: Calendar, iconColor: "#AF52DE", bg: "#F4EBFC", label: "Upcoming Tests", value: liveStats.tests.toString(), status: "Next 7 days", statusColor: "#8E8E93" },
            { icon: Star, iconColor: "#007AFF", bg: "#E8F2FF", label: "Recent Grade", value: liveStats.recentGrade, status: liveStats.recentSubject, statusColor: "#8E8E93" },
          ].map(({ icon: Icon, iconColor, bg, label, value, status, statusColor }) => (
            <div key={label} className="bg-white rounded-[20px] p-4" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
              <div className="w-9 h-9 rounded-[10px] flex items-center justify-center mb-3" style={{ background: bg }}>
                <Icon className="w-[18px] h-[18px]" style={{ color: iconColor }} />
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: "#AEAEB2" }}>{label}</div>
              <div className="text-[26px] font-bold mt-0.5 leading-[1.1]" style={{ color: "#1C1C1E", letterSpacing: "-0.5px" }}>{value}</div>
              <div className="text-[13px] font-medium mt-1" style={{ color: statusColor }}>{status}</div>
            </div>
          ))}
        </div>

        {/* ── AI Live Summary Dark Card ── */}
        <div className="mx-5 mt-4 rounded-[24px] overflow-hidden" style={{ background: "#1C1C1E", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-[18px] pt-4 pb-3" style={{ borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.9)" }}>EduIntellect AI · Live</span>
            </div>
            <div className="flex items-center gap-[5px] px-[10px] py-1 rounded-full" style={{ background: "rgba(52,199,89,0.15)", border: "1px solid rgba(52,199,89,0.3)" }}>
              <div className="w-[6px] h-[6px] rounded-full animate-pulse" style={{ background: "#34C759" }} />
              <span className="text-[11px] font-bold tracking-[0.04em]" style={{ color: "#34C759" }}>LIVE</span>
            </div>
          </div>

          {dataLoading ? (
            <div className="flex items-center gap-3 py-10 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Loading {childFirstName}'s data...</span>
            </div>
          ) : (
            <>
              {/* 2×2 Metrics Grid */}
              <div className="grid grid-cols-2" style={{ gap: "1px", background: "rgba(255,255,255,0.06)" }}>
                {/* Attendance */}
                <div className="p-4 flex flex-col gap-[10px]" style={{ background: "#2C2C2E" }}>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.4)" }}>Attendance</span>
                  <div className="flex items-center gap-[10px]">
                    <DonutRing pct={liveStats.attendance} color={attColor} size={60} stroke={5} />
                    <div className="flex flex-col gap-[2px]">
                      <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Target</span>
                      <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>85%</span>
                      <div className="w-[60px] h-[3px] rounded-full mt-1 overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                        <div className="h-full rounded-full" style={{ width: `${liveStats.attendance}%`, background: attColor }} />
                      </div>
                      <div className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full mt-[6px] w-fit text-[10px] font-bold"
                        style={{ background: liveStats.attendance >= 85 ? "rgba(52,199,89,0.15)" : "rgba(255,59,48,0.15)", color: liveStats.attendance >= 85 ? "#34C759" : "#FF3B30" }}>
                        {liveStats.attendance >= 85 ? "✓ On Track" : "Needs Work"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Avg Score */}
                <div className="p-4 flex flex-col gap-[10px]" style={{ background: "#2C2C2E" }}>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.4)" }}>Avg Score</span>
                  <div className="flex items-center gap-[10px]">
                    <DonutRing pct={liveStats.avgScore} color={avgScoreColor} size={60} stroke={5} />
                    <div>
                      <div className="inline-flex items-center px-2 py-[3px] rounded-full text-[10px] font-bold"
                        style={{ background: liveStats.avgScore >= 60 ? "rgba(52,199,89,0.15)" : "rgba(255,59,48,0.15)", color: liveStats.avgScore >= 60 ? "#34C759" : "#FF3B30" }}>
                        {liveStats.avgScore >= 80 ? "Excellent" : liveStats.avgScore >= 60 ? "Good" : liveStats.avgScore > 0 ? "Needs Work" : "No Data"}
                      </div>
                      <div className="flex gap-[5px] mt-2">
                        {["C", "B", "A", "A+"].map(g => {
                          const active = liveStats.avgScore >= (g === "A+" ? 90 : g === "A" ? 80 : g === "B" ? 70 : 0);
                          return (
                            <div key={g} className="w-6 h-6 rounded-[6px] flex items-center justify-center text-[11px] font-bold"
                              style={{ background: active ? "rgba(255,59,48,0.3)" : "rgba(255,255,255,0.07)", color: active ? "#FF6B6B" : "rgba(255,255,255,0.4)" }}>
                              {g}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assignments */}
                <div className="p-4 flex flex-col gap-[10px]" style={{ background: "#2C2C2E" }}>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.4)" }}>Assignments</span>
                  <div className="text-[36px] font-bold leading-none" style={{ color: "rgba(255,255,255,0.9)" }}>{liveStats.pending}</div>
                  <div className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>pending</div>
                  <div className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full mt-1 w-fit text-[10px] font-bold"
                    style={{ background: liveStats.pending === 0 ? "rgba(52,199,89,0.15)" : "rgba(255,149,0,0.15)", color: liveStats.pending === 0 ? "#34C759" : "#FF9500" }}>
                    {liveStats.pending === 0 ? "✓ All Done" : `${liveStats.pending} to complete`}
                  </div>
                </div>

                {/* Recent Test */}
                <div className="p-4 flex flex-col gap-[10px]" style={{ background: "#2C2C2E" }}>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.4)" }}>Recent Test</span>
                  <div className="text-[36px] font-bold leading-none" style={{ color: "rgba(255,255,255,0.9)" }}>
                    {liveStats.recentGrade !== "N/A" ? liveStats.recentGrade : "—"}
                  </div>
                  <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>{liveStats.recentSubject}</div>
                  <div className="flex gap-[5px] mt-1">
                    {["C", "B", "A", "A+"].map(g => {
                      const gradeSteps = ["C", "B", "A", "A+"];
                      const gradeIdx = gradeSteps.indexOf(liveStats.recentGrade);
                      const idx = gradeSteps.indexOf(g);
                      const active = idx <= gradeIdx && gradeIdx >= 0;
                      return (
                        <div key={g} className="w-6 h-6 rounded-[6px] flex items-center justify-center text-[11px] font-bold"
                          style={{ background: active ? "rgba(255,59,48,0.3)" : "rgba(255,255,255,0.07)", color: active ? "#FF6B6B" : "rgba(255,255,255,0.4)" }}>
                          {g}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* AI Insight Strip */}
              <div className="px-[18px] py-[14px] flex items-start gap-[10px]" style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
                <BrainCircuit className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "rgba(255,255,255,0.5)" }} />
                {aiInsights?.child_summary_narrative ? (
                  <p className="text-[13px] leading-[1.5]" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "-0.1px" }}>
                    <span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 500 }}>{studentData?.name}</span>{" "}
                    {aiInsights.child_summary_narrative.replace(studentData?.name || "", "").trim()}
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
                    <p className="text-[11px] italic" style={{ color: "rgba(255,255,255,0.4)" }}>AI summary generating...</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Profile Card ── */}
        <div className="mx-5 mt-4 bg-white rounded-[24px] p-5" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <div className="w-16 h-16 rounded-[20px] flex items-center justify-center text-[22px] font-bold text-white mb-[14px]"
            style={{ background: "linear-gradient(135deg, #1C3A8A, #3B5FD9)", boxShadow: "0 4px 16px rgba(28,58,138,0.3)" }}>
            {studentInitials}
          </div>
          <div className="text-[22px] font-bold tracking-tight" style={{ color: "#1C1C1E", letterSpacing: "-0.4px" }}>{studentData?.name || "Student"}</div>
          <div className="text-[14px] mt-0.5" style={{ color: "#8E8E93" }}>
            {studentMeta.className !== "—" ? `Grade ${studentMeta.className}` : studentData?.grade ? `Grade ${studentData.grade}` : ""}
            {teacherInfo.name !== "—" ? ` — ${teacherInfo.name}` : ""}
          </div>
          <div className="grid grid-cols-2 mt-4 rounded-[12px] overflow-hidden" style={{ gap: "1px", background: "rgba(60,60,67,0.12)" }}>
            <div className="px-[14px] py-3" style={{ background: "#F8F8FA" }}>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "#AEAEB2" }}>Class Teacher</div>
              <div className="text-[15px] font-semibold mt-0.5" style={{ color: "#1C1C1E" }}>{teacherInfo.name}</div>
            </div>
            <div className="px-[14px] py-3" style={{ background: "#F8F8FA" }}>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "#AEAEB2" }}>Academic Year</div>
              <div className="text-[15px] font-semibold mt-0.5" style={{ color: "#1C1C1E" }}>2025–26</div>
            </div>
          </div>
        </div>

        {/* ── Recent Alerts ── */}
        <div className="mx-5 mt-3 bg-white rounded-[20px] p-5" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
          <h3 className="text-[19px] font-bold mb-5" style={{ color: "#1C1C1E" }}>Recent Alerts</h3>
          {recentAlerts.length > 0 ? (
            <div className="space-y-3">
              {recentAlerts.map(alert => (
                <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-xl ${alert.urgent ? "bg-amber-50" : "bg-emerald-50"}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${alert.urgent ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`}>
                    {alert.urgent ? <Clock className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-snug" style={{ color: "#1C1C1E" }}>{alert.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#8E8E93" }}>{timeAgo(alert.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-[10px] py-5">
              <div className="w-14 h-14 rounded-[18px] flex items-center justify-center" style={{ background: "#F2F2F7" }}>
                <ShieldCheck className="w-[26px] h-[26px]" style={{ color: "#AEAEB2" }} />
              </div>
              <p className="text-[15px]" style={{ color: "#8E8E93" }}>No alerts right now</p>
            </div>
          )}
        </div>

        {/* ── Weekly AI Report Card ── */}
        <div className="mx-5 mt-4 bg-white rounded-[20px] p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[10px]">
              <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center" style={{ background: "#E8F2FF" }}>
                <BookOpen className="w-[18px] h-[18px]" style={{ color: "#007AFF" }} />
              </div>
              <div>
                <div className="text-[16px] font-bold" style={{ color: "#1C1C1E", letterSpacing: "-0.2px" }}>Weekly AI Report</div>
                <div className="text-[12px] mt-[1px]" style={{ color: "#8E8E93" }}>
                  {isPrevWeekReport ? "Last week's report" : weekConfig.canGenerate ? "Generate this week's report" : "New report available Friday"}
                </div>
              </div>
            </div>
            {weekConfig.canGenerate && !weeklyReport ? (
              <button onClick={handleGenerateWeeklyReport} disabled={weeklyLoading || dataLoading}
                className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-[12px] font-semibold text-white disabled:opacity-50"
                style={{ background: "#007AFF" }}>
                {weeklyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {weeklyLoading ? "..." : "Generate"}
              </button>
            ) : !weekConfig.canGenerate ? (
              <div className="flex items-center gap-1 px-[10px] py-[6px] rounded-[10px] text-[11px] font-semibold" style={{ background: "#F2F2F7", color: "#8E8E93" }}>
                <Clock className="w-[11px] h-[11px]" />
                Opens Fri{weekConfig.daysLeft > 0 ? ` · ${weekConfig.daysLeft}d` : ""}
              </div>
            ) : null}
          </div>

          {weeklyLoading && (
            <div className="flex flex-col items-center py-6 gap-3">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#007AFF" }} />
              <p className="text-xs" style={{ color: "#8E8E93" }}>Analysing {childFirstName}'s week...</p>
            </div>
          )}

          {!weeklyReport && !weeklyLoading && (
            <div className="flex items-start gap-2 mt-[14px] pt-[14px]" style={{ borderTop: "0.5px solid rgba(60,60,67,0.12)" }}>
              <Clock className="w-[14px] h-[14px] shrink-0 mt-0.5" style={{ color: "#AEAEB2" }} />
              <p className="text-[13px] leading-[1.5]" style={{ color: "#8E8E93" }}>
                {weekConfig.canGenerate
                  ? `Tap "Generate" to get ${childFirstName}'s weekly digest.`
                  : `You can generate ${childFirstName}'s weekly report every Friday, Saturday & Sunday.`}
              </p>
            </div>
          )}

          {/* Report exists — show previous week note */}
          {weeklyReport && !weeklyLoading && isPrevWeekReport && (
            <div className="flex items-start gap-2 mt-[14px] pt-[14px]" style={{ borderTop: "0.5px solid rgba(60,60,67,0.12)" }}>
              <Clock className="w-[14px] h-[14px] shrink-0 mt-0.5" style={{ color: "#AEAEB2" }} />
              <p className="text-[13px] leading-[1.5]" style={{ color: "#8E8E93" }}>
                This is last week's report. A new report can be generated this Friday.
              </p>
            </div>
          )}
        </div>

        {/* ── AI Message (when report exists) ── */}
        {weeklyReport && !weeklyLoading && (
          <div className="mx-5 mt-3 rounded-[20px] p-4" style={{ background: "linear-gradient(135deg, #EEF2FF, #E8F2FF)", border: "1px solid rgba(99,102,241,0.12)" }}>
            <div className="flex items-center gap-[6px] text-[11px] font-bold uppercase tracking-[0.08em] mb-[10px]" style={{ color: "#5B5BD6" }}>
              <Sparkles className="w-[13px] h-[13px]" />
              AI Message
            </div>
            <p className="text-[14px] leading-[1.65] font-normal" style={{ color: "#1C1C1E", letterSpacing: "-0.1px" }}>
              {weeklyReport.message}
            </p>
          </div>
        )}

        {/* ── Detail Sections (when report exists) ── */}
        {weeklyReport && !weeklyLoading && (
          <div className="mx-5 mt-3 bg-white rounded-[20px] overflow-hidden" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
            {[
              { tag: "Attendance", text: weeklyReport.attendance_summary },
              { tag: "Tests", text: weeklyReport.test_analysis },
              { tag: "Assignments", text: weeklyReport.assignment_status },
            ].map(({ tag, text }, i, arr) => (
              <div key={tag} className="px-[18px] py-[14px] flex flex-col gap-1"
                style={{ borderBottom: i < arr.length - 1 ? "0.5px solid rgba(60,60,67,0.12)" : "none" }}>
                <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "#AEAEB2" }}>{tag}</span>
                <p className="text-[14px] leading-[1.5]" style={{ color: "#1C1C1E" }}>{text}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Performance Alert (when report exists) ── */}
        {weeklyReport?.overall_performance && (
          <div className="mx-5 mt-3 rounded-[20px] p-4 flex items-start justify-between gap-3"
            style={{ background: "#FFF3E0", border: "1px solid rgba(255,149,0,0.15)" }}>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: "#C45C00" }}>Overall Performance</div>
              <div className="text-[17px] font-bold" style={{ color: "#1C1C1E", letterSpacing: "-0.3px" }}>{weeklyReport.overall_performance.verdict}</div>
              <p className="text-[13px] mt-1 leading-[1.5]" style={{ color: "rgba(0,0,0,0.55)" }}>{weeklyReport.overall_performance.score_context}</p>
            </div>
            <div className="px-[14px] py-2 bg-white rounded-[12px] flex items-center gap-[5px] text-[13px] font-bold shrink-0"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)", color: weeklyReport.overall_performance.trend === "Improving" ? "#34C759" : weeklyReport.overall_performance.trend === "Stable" ? "#34C759" : "#FF9500" }}>
              <TrendingUp className={`w-3 h-3 ${weeklyReport.overall_performance.trend === "Declining" ? "rotate-180" : ""}`} />
              {weeklyReport.overall_performance.trend}
            </div>
          </div>
        )}

        {/* ── AI Improvement Tips (when report exists) ── */}
        {weeklyReport?.improvement_tips?.length > 0 && (
          <>
            <div className="px-5 pt-5 pb-2 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: "#AEAEB2" }}>
              AI Improvement Tips
            </div>
            {weeklyReport.improvement_tips.map((t: { tip: string; reason: string }, i: number) => (
              <div key={i} className="mx-5 mb-[10px] bg-white rounded-[20px] p-4 flex items-start gap-3" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 text-[18px]"
                  style={{ background: "#FFCC00" }}>
                  {i === 0 ? "💡" : "🎯"}
                </div>
                <div>
                  <div className="text-[15px] font-semibold" style={{ color: "#1C1C1E", letterSpacing: "-0.2px" }}>{t.tip}</div>
                  <p className="text-[13px] mt-[3px] leading-[1.45]" style={{ color: "#8E8E93" }}>{t.reason}</p>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Download PDF Button (when report exists) ── */}
        {weeklyReport && !weeklyLoading && (
          <button onClick={handleDownloadPDF} disabled={pdfDownloading}
            className="mx-5 mt-2 w-[calc(100%-40px)] rounded-[16px] py-4 flex items-center justify-center gap-2 text-[16px] font-bold text-white disabled:opacity-50 active:scale-[0.97] transition-transform"
            style={{ background: "#1C1C1E", boxShadow: "0 4px 20px rgba(0,0,0,0.2)", letterSpacing: "-0.2px" }}>
            {pdfDownloading ? (
              <><Loader2 className="w-[18px] h-[18px] animate-spin" /> Generating PDF...</>
            ) : (
              <><Download className="w-[18px] h-[18px]" /> Download PDF Report</>
            )}
          </button>
        )}

        {/* ── AI Parenting Tips ── */}
        <div className="mx-5 mt-5 mb-2">
          {/* Header */}
          <div className="flex items-center gap-[10px] bg-white rounded-t-[20px] px-[18px] py-4" style={{ borderBottom: "0.5px solid rgba(60,60,67,0.12)", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
            <span className="text-[22px]">💡</span>
            <div>
              <div className="text-[17px] font-bold" style={{ color: "#1C1C1E", letterSpacing: "-0.3px" }}>AI Parenting Tips</div>
              <div className="text-[12px]" style={{ color: "#8E8E93" }}>Based on {childFirstName}'s current data</div>
            </div>
          </div>

          {/* Tips list */}
          {(() => {
            const tips = aiInsights?.parenting_tips?.length > 0 ? aiInsights.parenting_tips : smartTips;
            return tips.length > 0 ? tips.map((item: { tip: string; reason: string }, i: number) => (
              <div key={i} className={`bg-white px-[18px] py-[14px] flex items-start gap-3 ${i === tips.length - 1 ? "rounded-b-[20px]" : ""}`}
                style={{ borderBottom: i < tips.length - 1 ? "0.5px solid rgba(60,60,67,0.12)" : "none", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                <div className="w-[26px] h-[26px] rounded-lg flex items-center justify-center text-[13px] font-bold shrink-0 mt-[1px]"
                  style={{ background: "#FFF3E0", color: "#FF9500" }}>
                  {i + 1}
                </div>
                <div>
                  <div className="text-[14px] font-semibold" style={{ color: "#1C1C1E" }}>{item.tip}</div>
                  <p className="text-[13px] mt-[3px] leading-[1.45]" style={{ color: "#8E8E93" }}>{item.reason}</p>
                </div>
              </div>
            )) : (
              <div className="bg-white rounded-b-[20px] px-[18px] py-6 flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#8E8E93" }} />
                <p className="text-sm italic" style={{ color: "#8E8E93" }}>Loading {childFirstName}'s tips...</p>
              </div>
            );
          })()}
        </div>

        <div className="h-6" />

        {/* Hidden PDF render target */}
        {weeklyReport && pdfData && (
          <div style={{ position: "fixed", top: "-9999px", left: "-9999px", zIndex: -1 }}>
            <WeeklyReportPDF
              ref={pdfRef}
              report={weeklyReport}
              studentName={pdfData.child_name}
              grade={pdfData.grade}
              attendance={pdfData.attendance}
              tests={pdfData.tests}
              assignments={pdfData.assignments}
              avgScore={pdfData.overall_avg}
              weekEnd={pdfData.weekEnd}
              onDownload={() => {}}
            />
          </div>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     DESKTOP — Existing UI (unchanged)
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader
        title={`${greeting}, ${parentFirstName}! 👋`}
        subtitle={`Here's how ${childFirstName} is doing today`}
      />

      {/* Academic Health */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 md:p-6 mb-5 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/50 rounded-full -mr-16 -mt-16 blur-3xl" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Academic Health</h3>
            <p className="text-sm text-slate-400 mt-0.5">Overall performance indicator</p>
            <div className={`flex items-center gap-2 font-bold text-sm mt-4 w-fit px-3 py-1 rounded-full ${
              liveStats.trendPct >= 0
                ? "text-emerald-500 bg-emerald-50"
                : "text-red-500 bg-red-50"
            }`}>
              <TrendingUp className={`w-4 h-4 ${liveStats.trendPct < 0 ? "rotate-180" : ""}`} />
              <span>
                {liveStats.trendPct === 0
                  ? "Stable performance"
                  : liveStats.trendPct > 0
                  ? `Improved by ${liveStats.trendPct}%`
                  : `Declined by ${Math.abs(liveStats.trendPct)}%`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 bg-slate-50/50 rounded-2xl p-3 sm:bg-transparent sm:p-0">
            <div className="text-right">
              <p className="text-3xl md:text-4xl font-bold text-emerald-500">{liveStats.avgScore > 0 ? `${liveStats.avgScore}%` : "—"}</p>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                {liveStats.avgScore >= 75 ? "Good Standing" : liveStats.avgScore > 0 ? "Needs Attention" : "No data yet"}
              </p>
            </div>
            <div className="relative shrink-0 scale-90 md:scale-100">
              <DonutRing pct={liveStats.avgScore} color={liveStats.avgScore >= 80 ? "#10b981" : liveStats.avgScore >= 60 ? "#6366f1" : "#ef4444"} size={96} stroke={10} />
            </div>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5">
        {[
          { icon: CheckCircle, colorCls: "bg-emerald-50 text-emerald-600", tagCls: "text-emerald-600", label: "Attendance", value: `${liveStats.attendance}%`, tag: liveStats.attendance >= 85 ? "On track" : "Below target" },
          { icon: AlertCircle, colorCls: "bg-amber-50 text-amber-600", tagCls: "text-amber-500", label: "Pending Work", value: liveStats.pending.toString(), tag: "Due this week" },
          { icon: Calendar, colorCls: "bg-indigo-50 text-indigo-600", tagCls: "text-slate-400", label: "Upcoming Tests", value: liveStats.tests.toString(), tag: "Next 7 days" },
          { icon: Star, colorCls: "bg-emerald-50 text-emerald-600", tagCls: "text-emerald-600", label: "Recent Grade", value: liveStats.recentGrade, tag: liveStats.recentSubject },
        ].map(({ icon: Icon, colorCls, tagCls, label, value, tag }) => (
          <div key={label} className="bg-white border border-slate-100 rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md transition-all group">
            <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center mb-3 md:mb-4 group-hover:scale-110 transition-transform ${colorCls}`}>
              <Icon className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-xl md:text-2xl font-bold text-slate-800">{value}</p>
            <p className={`text-[10px] md:text-xs font-semibold mt-1 truncate ${tagCls}`}>{tag}</p>
          </div>
        ))}
      </div>

      {/* Student Profile + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-[#1e3a8a] text-white flex items-center justify-center text-lg md:text-xl font-bold flex-shrink-0">
              {studentInitials}
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-bold text-slate-800">{studentData?.name || "Student"}</h3>
              <p className="text-sm text-slate-400 mt-0.5">
                {studentMeta.className !== "—" ? `Grade ${studentMeta.className}` : studentData?.grade ? `Grade ${studentData.grade}` : ""}
                {studentMeta.rollNo !== "—" ? ` • Roll ${studentMeta.rollNo}` : ""}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-5">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Class Teacher</p>
              <p className="text-sm font-semibold text-slate-700 truncate">{teacherInfo.name}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Academic Year</p>
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

      {/* Feature 1: AI Child Summary — 2×2 Chart Dashboard */}
      <div className="rounded-2xl p-4 text-white relative overflow-hidden mb-4"
        style={{ background: "linear-gradient(135deg, #0c1424 0%, #0d1f35 100%)", border: "1px solid rgba(255,255,255,0.06)" }}>

        {/* Subtle grid bg */}
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)",
          backgroundSize: "28px 28px"
        }} />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">EduIntellect AI · Live Summary</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Live</span>
          </div>
        </div>

        {dataLoading ? (
          <div className="relative z-10 flex items-center gap-3 py-10 justify-center">
            <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
            <span className="text-xs text-slate-500">Loading {childFirstName}'s data...</span>
          </div>
        ) : (
          <div className="relative z-10 space-y-3">

            {/* ── 2×2 grid ── */}
            <div className="grid grid-cols-2 gap-3">

              {/* ① Attendance */}
              {(() => {
                const attColor = liveStats.attendance >= 85 ? "#f59e0b" : liveStats.attendance >= 70 ? "#f59e0b" : "#ef4444";
                return (
                  <div className="rounded-2xl p-4 flex flex-col"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", minHeight: 160 }}>
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-3">Attendance</span>
                    <div className="flex items-center gap-4 flex-1">
                      <DonutRing pct={liveStats.attendance} color={attColor} size={90} stroke={9} />
                      <div className="flex-1 space-y-2">
                        <div>
                          <div className="text-[9px] text-slate-500 mb-1">Target &nbsp; <span className="text-slate-400 font-bold">85%</span></div>
                          <MiniBar pct={85} color="rgba(255,255,255,0.15)" />
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-500 mb-1">Current</div>
                          <MiniBar pct={liveStats.attendance} color={attColor} />
                        </div>
                        <div className={`mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full w-fit ${
                          liveStats.attendance >= 85 ? "bg-emerald-500/15 text-emerald-400"
                          : liveStats.attendance >= 70 ? "bg-amber-500/15 text-amber-400"
                          : "bg-red-500/15 text-red-400"
                        }`}>
                          {liveStats.attendance >= 85 ? "On Track" : liveStats.attendance >= 70 ? "Improve" : "Critical"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ② Avg Score */}
              {(() => {
                const scoreColor = liveStats.avgScore >= 80 ? "#6366f1" : liveStats.avgScore >= 60 ? "#6366f1" : "#ef4444";
                const scoreLabel = liveStats.avgScore >= 80 ? "Excellent" : liveStats.avgScore >= 60 ? "Good" : liveStats.avgScore > 0 ? "Needs Work" : "No Data";
                return (
                  <div className="rounded-2xl p-4 flex flex-col"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", minHeight: 160 }}>
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-3">Avg Score</span>
                    <div className="flex items-center gap-4 flex-1">
                      <div className="relative">
                        <DonutRing pct={liveStats.avgScore} color={scoreColor} size={90} stroke={9} />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className={`text-[10px] font-black px-2 py-0.5 rounded-full w-fit ${
                          liveStats.avgScore >= 80 ? "bg-indigo-500/20 text-indigo-300"
                          : liveStats.avgScore >= 60 ? "bg-indigo-500/20 text-indigo-300"
                          : liveStats.avgScore > 0 ? "bg-red-500/15 text-red-400" : "bg-slate-500/20 text-slate-400"
                        }`}>{scoreLabel}</div>
                        <div>
                          <div className="text-[9px] text-slate-500 mb-1">Performance</div>
                          <MiniBar pct={liveStats.avgScore} color={liveStats.avgScore >= 60 ? scoreColor : "#ef4444"} />
                        </div>
                        <div className="flex gap-1">
                          {["C","B","A","A+"].map(g => {
                            const active = liveStats.avgScore >= (g === "A+" ? 90 : g === "A" ? 80 : g === "B" ? 70 : 0);
                            return <div key={g} className={`flex-1 rounded-sm text-center text-[7px] font-black py-0.5 ${active ? "bg-indigo-500/40 text-indigo-300" : "bg-white/5 text-slate-600"}`}>{g}</div>;
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ③ Assignments */}
              <div className="rounded-2xl p-4 flex flex-col"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", minHeight: 140 }}>
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-2">Assignments</span>
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex items-end gap-2">
                    <span className={`text-4xl font-black leading-none ${liveStats.pending > 3 ? "text-red-400" : liveStats.pending > 0 ? "text-amber-400" : "text-emerald-400"}`}
                      style={{ textShadow: liveStats.pending === 0 ? "0 0 20px #10b98180" : "none" }}>
                      {liveStats.pending}
                    </span>
                    <span className="text-[11px] text-slate-500 mb-1 font-medium">pending</span>
                  </div>
                  <div className="space-y-2">
                    {liveStats.pending === 0 ? (
                      <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-3 py-1.5 w-fit">
                        <span className="text-[10px] font-bold text-emerald-400">All Done ✓</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/25 rounded-full px-3 py-1.5 w-fit">
                        <span className="text-[10px] font-bold text-amber-400">{liveStats.pending} to complete</span>
                      </div>
                    )}
                    {liveStats.tests > 0 && (
                      <div className="flex items-center gap-1.5 bg-indigo-500/10 rounded-full px-2.5 py-1 w-fit">
                        <BookOpen className="w-2.5 h-2.5 text-indigo-400" />
                        <span className="text-[9px] text-indigo-300 font-semibold">{liveStats.tests} upcoming test{liveStats.tests > 1 ? "s" : ""}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ④ Recent Test */}
              {(() => {
                const gradeColor = liveStats.recentGrade === "A+" ? "#10b981"
                  : liveStats.recentGrade?.startsWith("A") ? "#6366f1"
                  : liveStats.recentGrade === "B" ? "#f59e0b" : "#64748b";
                const gradeSteps = ["C","B","A-","A","A+"];
                const gradeIdx = gradeSteps.indexOf(liveStats.recentGrade);
                return (
                  <div className="rounded-2xl p-4 flex flex-col"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", minHeight: 140 }}>
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-2">Recent Test</span>
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="flex items-end gap-3">
                        <span className="text-5xl font-black leading-none"
                          style={{ color: gradeColor, textShadow: `0 0 24px ${gradeColor}80` }}>
                          {liveStats.recentGrade !== "N/A" ? liveStats.recentGrade : "—"}
                        </span>
                        <span className="text-[10px] text-slate-500 mb-1.5 truncate max-w-[80px]">{liveStats.recentSubject}</span>
                      </div>
                      <div className="flex gap-1 mt-2">
                        {gradeSteps.map((g, i) => (
                          <div key={g} className="flex-1 space-y-1">
                            <div className={`h-1 rounded-full transition-all ${i <= gradeIdx ? "" : "bg-white/8"}`}
                              style={{ backgroundColor: i <= gradeIdx ? gradeColor : undefined, opacity: i <= gradeIdx ? (0.4 + i * 0.15) : 1 }} />
                            <div className={`text-center text-[7px] font-bold ${i === gradeIdx ? "text-white" : "text-slate-600"}`}>{g}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ── AI Narrative strip ── */}
            <div className="rounded-xl px-4 py-2.5 flex items-center gap-3"
              style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.15)" }}>
              <BrainCircuit className="w-4 h-4 text-indigo-400 shrink-0" />
              {aiInsights?.child_summary_narrative ? (
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                  {aiInsights.child_summary_narrative}
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 text-slate-600 animate-spin shrink-0" />
                  <p className="text-[11px] text-slate-500 italic">AI summary generating...</p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Feature 2: Weekly AI Report */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm mb-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Weekly AI Report</h3>
              <p className="text-[10px] text-slate-400 font-medium">
                {isPrevWeekReport ? "Last week's report · New report available Friday" : "Attendance · Tests · Assignments · Performance"}
              </p>
            </div>
          </div>

          {/* Fri/Sat/Sun: show generate or regenerate */}
          {weekConfig.canGenerate && !weeklyReport && (
            <button
              onClick={handleGenerateWeeklyReport}
              disabled={weeklyLoading || dataLoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all"
            >
              {weeklyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {weeklyLoading ? "Generating..." : "Generate Report"}
            </button>
          )}
          {weekConfig.canGenerate && weeklyReport && (
            <button onClick={() => setWeeklyReport(null)} className="text-[10px] text-slate-400 hover:text-slate-600 font-medium underline">
              Regenerate
            </button>
          )}

          {/* Mon–Thu: locked badge */}
          {!weekConfig.canGenerate && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-400 text-[11px] font-semibold rounded-xl">
              <Clock className="w-3 h-3" />
              Opens Friday
              {weekConfig.daysLeft > 0 && ` · ${weekConfig.daysLeft}d`}
            </span>
          )}
        </div>

        {/* Loading state */}
        {weeklyLoading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            <p className="text-xs text-slate-400">Analysing {childFirstName}'s week — attendance, tests & assignments...</p>
          </div>
        )}

        {/* Empty state — no report yet, not loading */}
        {!weeklyReport && !weeklyLoading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600">
                {weekConfig.canGenerate ? `Get ${childFirstName}'s Weekly Digest` : `Report available from Friday`}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {weekConfig.canGenerate
                  ? `Click "Generate Report" to see this week's attendance, tests, assignments & AI tips.`
                  : `You can generate ${childFirstName}'s weekly report every Friday, Saturday & Sunday.`}
              </p>
            </div>
          </div>
        )}

        {/* Report content */}
        {weeklyReport && !weeklyLoading && (
          <div className="space-y-4">
            {isPrevWeekReport && (
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <p className="text-[11px] text-slate-500">This is last week's report. A new report can be generated this Friday.</p>
              </div>
            )}

            {/* AI Message bubble */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">AI Message</span>
              </div>
              <p className="text-sm text-indigo-900 leading-relaxed">{weeklyReport.message}</p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Attendance</p>
                <p className="text-xs text-slate-700 leading-snug">{weeklyReport.attendance_summary}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Tests</p>
                <p className="text-xs text-slate-700 leading-snug">{weeklyReport.test_analysis}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Assignments</p>
                <p className="text-xs text-slate-700 leading-snug">{weeklyReport.assignment_status}</p>
              </div>
            </div>

            {/* Overall Performance */}
            {weeklyReport.overall_performance && (
              <div className={`flex items-center justify-between p-4 rounded-xl border ${
                weeklyReport.overall_performance.verdict === "Excellent" ? "bg-emerald-50 border-emerald-100" :
                weeklyReport.overall_performance.verdict === "Good" ? "bg-blue-50 border-blue-100" :
                weeklyReport.overall_performance.verdict === "Needs Attention" ? "bg-amber-50 border-amber-100" :
                "bg-red-50 border-red-100"
              }`}>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Overall Performance</p>
                  <p className="text-sm font-bold text-slate-800">{weeklyReport.overall_performance.verdict}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{weeklyReport.overall_performance.score_context}</p>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                  weeklyReport.overall_performance.trend === "Improving" ? "bg-emerald-100 text-emerald-700" :
                  weeklyReport.overall_performance.trend === "Stable" ? "bg-blue-100 text-blue-700" :
                  "bg-amber-100 text-amber-700"
                }`}>
                  {weeklyReport.overall_performance.trend === "Improving" ? "↑" : weeklyReport.overall_performance.trend === "Declining" ? "↓" : "→"} {weeklyReport.overall_performance.trend}
                </div>
              </div>
            )}

            {/* AI Improvement Tips */}
            {weeklyReport.improvement_tips?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">AI Improvement Tips</p>
                <div className="space-y-2">
                  {weeklyReport.improvement_tips.map((t: { tip: string; reason: string }, i: number) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{t.tip}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{t.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Download PDF button */}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={handleDownloadPDF}
                disabled={pdfDownloading}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all"
              >
                {pdfDownloading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating PDF...</>
                  : <><Sparkles className="w-3.5 h-3.5 text-amber-400" /> Download PDF Report</>
                }
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feature 3: AI Parenting Tips */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
            <Lightbulb className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">AI Parenting Tips</h3>
            <p className="text-[10px] text-slate-400 font-medium">Based on {childFirstName}'s current data</p>
          </div>
        </div>

        {(() => {
          const tips = aiInsights?.parenting_tips?.length > 0 ? aiInsights.parenting_tips : smartTips;
          const isAI = aiInsights?.parenting_tips?.length > 0;
          return tips.length > 0 ? (
            <div className="space-y-3">
              {!isAI && (
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Based on {childFirstName}'s live data</p>
              )}
              {tips.map((item: { tip: string; reason: string }, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.tip}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 py-4">
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />
              <p className="text-sm text-slate-400 italic">Loading {childFirstName}'s data...</p>
            </div>
          );
        })()}
      </div>

      {/* Hidden PDF render target — off-screen, captured by html2canvas */}
      {weeklyReport && pdfData && (
        <div style={{ position: "fixed", top: "-9999px", left: "-9999px", zIndex: -1 }}>
          <WeeklyReportPDF
            ref={pdfRef}
            report={weeklyReport}
            studentName={pdfData.child_name}
            grade={pdfData.grade}
            attendance={pdfData.attendance}
            tests={pdfData.tests}
            assignments={pdfData.assignments}
            avgScore={pdfData.overall_avg}
            weekEnd={pdfData.weekEnd}
            onDownload={() => {}}
          />
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
