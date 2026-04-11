import { useState, useEffect } from "react";
import {
  AlertCircle, Clock, Trophy, Calendar, User,
  Loader2, BellRing, CheckCircle, BookOpen, ShieldAlert, Sparkles
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot,
  doc, updateDoc
} from "firebase/firestore";
import { toast } from "sonner";

const filterTabs = ["All", "Academic", "Attendance", "General"];

interface ParsedAlert {
  id: string;
  title: string;
  description: string;
  category: "Academic" | "Attendance" | "General";
  priority: "High Priority" | "Medium Priority" | "Good News" | "General";
  createdAt: any;
  teacherName?: string;
  date?: string;
  arrivalTime?: string;
  source: string; // which collection it came from
  sourceId?: string; // for dismissing in Firestore
  dismissed?: boolean;
}

const AlertsPage = () => {
  const { studentData } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("dismissed_alerts") || "[]")); }
    catch { return new Set(); }
  });

  // Raw data from Firebase
  const [risks, setRisks] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [smartAlerts, setSmartAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!studentData?.id) return;
    setLoading(true);
    const sid = studentData.id;
    const email = studentData.email?.toLowerCase() || "";

    const unsubs: (() => void)[] = [];
    let loaded = 0;
    const total = 7; // number of collections

    const done = () => {
      loaded++;
      if (loaded >= total) setLoading(false);
    };

    // Helper: merge two snapshots by id
    const merge = (s1: any, s2: any) => {
      const m = new Map();
      [...(s1?.docs || []), ...(s2?.docs || [])].forEach((d: any) => {
        if (!m.has(d.id)) m.set(d.id, { id: d.id, ...d.data() });
      });
      return Array.from(m.values());
    };

    // Dual snapshot helper
    const dualSnap = (
      collName: string,
      setter: (docs: any[]) => void,
    ) => {
      let s1: any = null, s2: any = null;
      const process = () => setter(merge(s1, s2));

      const q1 = query(collection(db, collName), where("studentId", "==", sid));
      const q2 = email
        ? query(collection(db, collName), where("studentEmail", "==", email))
        : null;

      const u1 = onSnapshot(q1, s => { s1 = s; process(); done(); });
      unsubs.push(u1);
      if (q2) {
        const u2 = onSnapshot(q2, s => { s2 = s; process(); });
        unsubs.push(u2);
      } else {
        done();
      }
    };

    // 1. risks — teacher-created student risk flags
    dualSnap("risks", setRisks);

    // 2. attendance
    dualSnap("attendance", setAttendance);

    // 3. test_scores + gradebook_scores merged
    let scoreSnap1: any = null, scoreSnap2: any = null;
    let gbSnap1: any = null, gbSnap2: any = null;
    const processScores = () => {
      const ts = merge(scoreSnap1, scoreSnap2);
      const gb = merge(gbSnap1, gbSnap2).map(d => ({
        ...d, testName: d.columnName || "Class Assessment",
        score: d.mark, maxScore: d.maxMarks || 100
      }));
      const all = new Map();
      [...ts, ...gb].forEach(d => { if (!all.has(d.id)) all.set(d.id, d); });
      setScores(Array.from(all.values()));
    };
    const us1 = onSnapshot(query(collection(db, "test_scores"), where("studentId", "==", sid)), s => { scoreSnap1 = s; processScores(); done(); });
    const us2 = email ? onSnapshot(query(collection(db, "test_scores"), where("studentEmail", "==", email)), s => { scoreSnap2 = s; processScores(); }) : null;
    const ug1 = onSnapshot(query(collection(db, "gradebook_scores"), where("studentId", "==", sid)), s => { gbSnap1 = s; processScores(); });
    const ug2 = email ? onSnapshot(query(collection(db, "gradebook_scores"), where("studentEmail", "==", email)), s => { gbSnap2 = s; processScores(); }) : null;
    unsubs.push(us1, ug1);
    if (us2) unsubs.push(us2);
    if (ug2) unsubs.push(ug2);

    // 4. parent_notes (teacher notes to parent)
    dualSnap("parent_notes", setNotes);

    // 5. student_smart_alerts (AI-generated)
    dualSnap("student_smart_alerts", setSmartAlerts);

    // 6. submissions (to detect overdue assignments)
    dualSnap("submissions", setSubmissions);

    // 7. enrollments → classIds → assignments
    let enrollSnap1: any = null, enrollSnap2: any = null;
    let unsubAssign: (() => void) | null = null;
    const processEnrollments = () => {
      const enrolls = merge(enrollSnap1, enrollSnap2);
      const classIds = [...new Set(enrolls.map((e: any) => e.classId).filter(Boolean))] as string[];
      if (unsubAssign) { unsubAssign(); unsubAssign = null; }
      if (classIds.length === 0) { done(); return; }
      unsubAssign = onSnapshot(
        query(collection(db, "assignments"), where("classId", "in", classIds.slice(0, 10))),
        s => { setAssignments(s.docs.map(d => ({ id: d.id, ...d.data() }))); done(); }
      );
    };
    const ue1 = onSnapshot(query(collection(db, "enrollments"), where("studentId", "==", sid)), s => { enrollSnap1 = s; processEnrollments(); });
    const ue2 = email ? onSnapshot(query(collection(db, "enrollments"), where("studentEmail", "==", email)), s => { enrollSnap2 = s; processEnrollments(); }) : null;
    unsubs.push(ue1);
    if (ue2) unsubs.push(ue2);

    return () => {
      unsubs.forEach(u => u());
      if (unsubAssign) unsubAssign();
    };
  }, [studentData?.id]);

  // Build parsed alerts from all sources
  const buildAlerts = (): ParsedAlert[] => {
    const result: ParsedAlert[] = [];
    const name = studentData?.name || "Student";
    const now = Date.now();

    // ── SOURCE 1: risks collection (teacher-created flags) ──
    risks
      .filter(r => !r.resolved)
      .forEach(r => {
        const catMap: Record<string, ParsedAlert["category"]> = {
          Attendance: "Attendance", Grades: "Academic",
          Submissions: "Academic", Behavior: "General"
        };
        const priMap: Record<string, ParsedAlert["priority"]> = {
          Critical: "High Priority", "High Priority": "High Priority",
          "Medium Priority": "Medium Priority"
        };
        result.push({
          id: `risk_${r.id}`,
          title: r.issue || "Risk Flag",
          description: Array.isArray(r.details) ? r.details.join(" · ") : (r.issue || ""),
          category: catMap[r.type] || "General",
          priority: priMap[r.severity] || "Medium Priority",
          createdAt: r.createdAt || null,
          teacherName: r.teacherName || "",
          source: "risks",
          sourceId: r.id
        });
      });

    // ── SOURCE 2: attendance (absent = High, late = Medium) ──
    // Pre-compute attendance context for storytelling
    const absentRecords = attendance.filter(a => a.status === "absent");
    const totalAbsences = absentRecords.length;
    const absentDayNums = absentRecords.map(a => {
      const parts = (a.date || "").split("-");
      return parts.length === 3 ? new Date(+parts[0], +parts[1] - 1, +parts[2]).getDay() : -1;
    }).filter(d => d >= 0);
    const dayTally = absentDayNums.reduce((acc, d) => { acc[d] = (acc[d] || 0) + 1; return acc; }, {} as Record<number, number>);
    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const topAbsentDays = Object.entries(dayTally).sort((a, b) => +b[1] - +a[1]).slice(0, 2).map(([d]) => DAYS[+d]);
    const dayPattern = topAbsentDays.length > 0 ? ` (mostly ${topAbsentDays.join(" and ")})` : "";
    const lowScoreSubjects = scores.filter(s => {
      const pct = s.percentage ?? (s.maxScore > 0 ? s.score / s.maxScore * 100 : 0);
      return pct < 60;
    });
    const academicImpact = lowScoreSubjects.length > 0
      ? ` This is directly affecting grades — ${lowScoreSubjects.length} subject${lowScoreSubjects.length > 1 ? "s are" : " is"} currently below the passing threshold.`
      : " Regular attendance is essential to stay on top of the curriculum.";
    const totalLates = attendance.filter(a => a.status === "late").length;

    attendance.forEach(a => {
      if (a.status === "absent") {
        const absenceStory = totalAbsences === 1
          ? `${name} was absent on ${fmtDateStr(a.date)}. This is their first recorded absence this term — please ensure it doesn't become a pattern.`
          : `${name} has been absent ${totalAbsences} time${totalAbsences > 1 ? "s" : ""} this term${dayPattern}.${academicImpact}`;
        result.push({
          id: `att_absent_${a.id}`,
          title: totalAbsences > 2 ? `Repeated Absences — ${totalAbsences} This Term` : "Absence Recorded",
          description: absenceStory,
          category: "Attendance",
          priority: "High Priority",
          createdAt: a.createdAt || null,
          teacherName: a.teacherName || "",
          date: a.date,
          source: "attendance"
        });
      } else if (a.status === "late") {
        const lateStory = `${name} arrived late on ${fmtDateStr(a.date)}${a.arrivalTime || a.time ? ` at ${a.arrivalTime || a.time}` : ""}. This is their ${totalLates === 1 ? "first" : `${totalLates}th`} late arrival this term — arriving on time ensures ${name.split(" ")[0]} doesn't miss the start of lessons.`;
        result.push({
          id: `att_late_${a.id}`,
          title: "Late Arrival Recorded",
          description: lateStory,
          category: "Attendance",
          priority: "Medium Priority",
          createdAt: a.createdAt || null,
          teacherName: a.teacherName || "",
          date: a.date,
          arrivalTime: a.arrivalTime || a.time || "",
          source: "attendance"
        });
      }
    });

    // ── SOURCE 3: test_scores / gradebook_scores ──
    const submittedIds = new Set(submissions.map(s => s.assignmentId));
    scores.forEach(s => {
      const pct = s.percentage ?? (s.maxScore > 0 ? (s.score / s.maxScore * 100) : 0);
      const sub = s.subject || "a subject";
      const testName = s.testName || "a test";

      if (pct >= 85) {
        // Find how many tests in this subject scored high
        const subjectHighScores = scores.filter(s2 => s2.subject === sub && (s2.percentage ?? (s2.maxScore > 0 ? s2.score/s2.maxScore*100 : 0)) >= 85).length;
        const story = subjectHighScores > 1
          ? `${name} scored ${Math.round(pct)}% in "${testName}" — their ${subjectHighScores === 2 ? "second" : `${subjectHighScores}th`} strong result in ${sub} this term. This consistent excellence is worth celebrating and encouraging at home!`
          : `${name} scored an impressive ${Math.round(pct)}% in "${testName}" (${sub}). Hard work is clearly paying off — keep encouraging this momentum!`;
        result.push({
          id: `score_good_${s.id}`,
          title: `Excellent in ${sub}! 🎉`,
          description: story,
          category: "Academic",
          priority: "Good News",
          createdAt: s.timestamp || s.createdAt || null,
          teacherName: s.teacherName || "",
          source: "test_scores"
        });
      } else if (pct < 60 && pct > 0) {
        // Calculate subject average and trend
        const subScores = scores.filter(s2 => s2.subject === sub).map(s2 => s2.percentage ?? (s2.maxScore > 0 ? s2.score/s2.maxScore*100 : 0));
        const subAvg = subScores.length > 0 ? Math.round(subScores.reduce((a, b) => a + b, 0) / subScores.length) : Math.round(pct);
        const isTrending = subScores.length > 1 && subScores[subScores.length - 1] < subScores[0];
        const trendNote = isTrending ? ` Performance in ${sub} has been declining — early intervention is key.` : ` Focused revision before the next assessment can make a significant difference.`;
        const story = `${name} scored ${Math.round(pct)}% in "${testName}" (${sub}). The current subject average is ${subAvg}%.${trendNote}`;
        result.push({
          id: `score_low_${s.id}`,
          title: `Below Passing — ${sub}`,
          description: story,
          category: "Academic",
          priority: "High Priority",
          createdAt: s.timestamp || s.createdAt || null,
          teacherName: s.teacherName || "",
          source: "test_scores"
        });
      }
    });

    // ── SOURCE 4: assignments (overdue + due soon) ──
    assignments.forEach(a => {
      if (!a.dueDate) return;
      const due = a.dueDate?.toMillis?.() || new Date(a.dueDate).getTime();
      if (!due) return;
      const alreadySubmitted = submittedIds.has(a.id);
      if (alreadySubmitted) return;

      const diffMs = due - now;
      const diffDays = Math.ceil(diffMs / (1000 * 3600 * 24));

      if (diffMs < 0) {
        const daysOverdue = Math.abs(Math.ceil(diffMs / (1000 * 3600 * 24)));
        const urgency = daysOverdue > 7 ? "This significantly impacts the term grade and requires immediate attention." : daysOverdue > 3 ? "Submitting it now — even late — is better than leaving it incomplete. Contact the teacher if an extension is needed." : "This was just missed — submitting it now with a brief apology note to the teacher may still earn partial credit.";
        result.push({
          id: `assign_overdue_${a.id}`,
          title: `Assignment Overdue — ${daysOverdue} Day${daysOverdue > 1 ? "s" : ""}`,
          description: `"${a.title}" was due on ${fmtTs(a.dueDate)} and remains unsubmitted. ${urgency}`,
          category: "Academic",
          priority: "High Priority",
          createdAt: a.dueDate,
          teacherName: a.teacherName || "",
          source: "assignments"
        });
      } else if (diffDays <= 3) {
        const urgency = diffDays === 1 ? "Due TOMORROW — action needed today." : `Due in ${diffDays} days — plan time tonight to complete it.`;
        result.push({
          id: `assign_soon_${a.id}`,
          title: `Due ${diffDays === 1 ? "Tomorrow" : `in ${diffDays} Days`} — ${a.title}`,
          description: `"${a.title}" is due on ${fmtTs(a.dueDate)}. ${urgency} Submitting on time keeps ${name.split(" ")[0]}'s completion record strong.`,
          category: "Academic",
          priority: "Medium Priority",
          createdAt: a.createdAt || null,
          teacherName: a.teacherName || "",
          source: "assignments"
        });
      }
    });

    // ── SOURCE 5: parent_notes (teacher notes to parent) ──
    notes.forEach(n => {
      const isPositive = (n.category || "").toLowerCase().includes("positive") || (n.category || "").toLowerCase().includes("praise");
      result.push({
        id: `note_${n.id}`,
        title: isPositive ? "Positive Note from Teacher" : "Teacher Note",
        description: n.content || "A note from your teacher.",
        category: "General",
        priority: isPositive ? "Good News" : "Medium Priority",
        createdAt: n.createdAt || null,
        teacherName: n.teacherName || "",
        source: "parent_notes"
      });
    });

    // ── SOURCE 6: student_smart_alerts (AI-generated) ──
    smartAlerts
      .filter(a => !a.resolved)
      .forEach(a => {
        const cat = a.category === "Behavior" ? "General" : (a.category || "General");
        result.push({
          id: `smart_${a.id}`,
          title: a.title || "Alert",
          description: a.description || "",
          category: cat as ParsedAlert["category"],
          priority: a.priority || "Medium Priority",
          createdAt: a.createdAt || null,
          teacherName: a.teacherName || "",
          source: "student_smart_alerts",
          sourceId: a.id
        });
      });

    // Deduplicate by id, filter dismissed
    const seen = new Set<string>();
    return result
      .filter(a => !dismissed.has(a.id) && !seen.has(a.id) && seen.add(a.id))
      .sort((a, b) => {
        const order: Record<string, number> = { "High Priority": 0, "Medium Priority": 1, "Good News": 2, General: 3 };
        return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
      });
  };

  const allAlerts = buildAlerts();

  const dismissAlert = async (alert: ParsedAlert) => {
    // Mark dismissed in local state + localStorage
    const next = new Set(dismissed);
    next.add(alert.id);
    setDismissed(next);
    localStorage.setItem("dismissed_alerts", JSON.stringify([...next]));

    // If it came from a Firestore-writable source, persist it
    if (alert.source === "student_smart_alerts" && alert.sourceId) {
      try {
        await updateDoc(doc(db, "student_smart_alerts", alert.sourceId), { resolved: true });
      } catch { /* ignore */ }
    }
    if (alert.source === "risks" && alert.sourceId) {
      try {
        await updateDoc(doc(db, "risks", alert.sourceId), { resolved: true });
      } catch { /* ignore */ }
    }
    toast.success("Alert dismissed.");
  };

  const markAllRead = () => {
    const next = new Set(dismissed);
    allAlerts.forEach(a => next.add(a.id));
    setDismissed(next);
    localStorage.setItem("dismissed_alerts", JSON.stringify([...next]));
    toast.success("All alerts dismissed.");
  };

  const filteredAlerts = allAlerts.filter(a => {
    const tab = filterTabs[activeTab];
    return tab === "All" || a.category === tab;
  });

  // ── Feature 16: AI Action Recommendations ────────────────────────────────
  type Action = { label: string; primary: boolean; color?: string; onClick: () => void };
  const getActions = (alert: ParsedAlert): Action[] => {
    const go = (path: string) => () => navigate(path);
    const dismiss = () => dismissAlert(alert);

    if (alert.category === "Attendance" && alert.priority === "High Priority")
      return [
        { label: "📞 Schedule Teacher Call", primary: true, color: "bg-rose-600 hover:bg-rose-700 text-white", onClick: go("/teacher-notes") },
        { label: "View Attendance Report", primary: false, onClick: go("/attendance") },
      ];

    if (alert.category === "Attendance")
      return [
        { label: "💬 Message Teacher", primary: true, color: "bg-blue-600 hover:bg-blue-700 text-white", onClick: go("/teacher-notes") },
        { label: "Acknowledge", primary: false, onClick: dismiss },
      ];

    if (alert.source === "test_scores" && alert.priority === "High Priority")
      return [
        { label: "📚 Request Extra Support", primary: true, color: "bg-indigo-600 hover:bg-indigo-700 text-white", onClick: go("/teacher-notes") },
        { label: "View Performance", primary: false, onClick: go("/performance") },
      ];

    if (alert.source === "assignments" && alert.priority === "High Priority")
      return [
        { label: "📤 Submit Now", primary: true, color: "bg-slate-900 hover:bg-slate-800 text-white", onClick: go("/assignments") },
        { label: "💬 Message Teacher", primary: false, onClick: go("/teacher-notes") },
      ];

    if (alert.source === "assignments" && alert.priority === "Medium Priority")
      return [
        { label: "⏰ Go to Assignments", primary: true, color: "bg-amber-500 hover:bg-amber-600 text-white", onClick: go("/assignments") },
        { label: "Dismiss", primary: false, onClick: dismiss },
      ];

    if (alert.priority === "Good News")
      return [
        { label: "🎉 View Full Performance", primary: true, color: "bg-emerald-600 hover:bg-emerald-700 text-white", onClick: go("/performance") },
        { label: "Acknowledge", primary: false, onClick: dismiss },
      ];

    if (alert.source === "parent_notes")
      return [
        { label: "💬 Reply to Teacher", primary: true, color: "bg-blue-600 hover:bg-blue-700 text-white", onClick: go("/teacher-notes") },
        { label: "Acknowledge", primary: false, onClick: dismiss },
      ];

    if (alert.source === "risks")
      return [
        { label: "📞 Contact Teacher Now", primary: true, color: "bg-rose-600 hover:bg-rose-700 text-white", onClick: go("/teacher-notes") },
        { label: "Dismiss", primary: false, onClick: dismiss },
      ];

    return [
      { label: "View Details", primary: true, color: "bg-indigo-600 hover:bg-indigo-700 text-white", onClick: go("/performance") },
      { label: "Dismiss", primary: false, onClick: dismiss },
    ];
  };

  const getTabCount = (tab: string) =>
    tab === "All" ? allAlerts.length : allAlerts.filter(a => a.category === tab).length;

  // ── Styling helpers ──
  const getBorderColor = (p: ParsedAlert["priority"]) => ({
    "High Priority": "border-l-rose-500",
    "Medium Priority": "border-l-amber-400",
    "Good News": "border-l-emerald-500",
    General: "border-l-blue-400"
  }[p] || "border-l-slate-300");

  const getIconStyle = (alert: ParsedAlert) => {
    if (alert.priority === "Good News")
      return { bg: "bg-emerald-100", color: "text-emerald-600", icon: <Trophy className="w-5 h-5" /> };
    if (alert.category === "Attendance" && alert.priority === "High Priority")
      return { bg: "bg-rose-100", color: "text-rose-500", icon: <AlertCircle className="w-5 h-5" /> };
    if (alert.category === "Attendance")
      return { bg: "bg-amber-100", color: "text-amber-500", icon: <Clock className="w-5 h-5" /> };
    if (alert.category === "Academic" && alert.priority === "High Priority")
      return { bg: "bg-rose-100", color: "text-rose-500", icon: <BookOpen className="w-5 h-5" /> };
    if (alert.category === "Academic")
      return { bg: "bg-blue-100", color: "text-blue-500", icon: <BookOpen className="w-5 h-5" /> };
    if (alert.source === "risks")
      return { bg: "bg-rose-100", color: "text-rose-500", icon: <ShieldAlert className="w-5 h-5" /> };
    return { bg: "bg-slate-100", color: "text-slate-500", icon: <Calendar className="w-5 h-5" /> };
  };

  const getPriorityBadge = (p: ParsedAlert["priority"]) => ({
    "High Priority": "bg-rose-100 text-rose-600",
    "Medium Priority": "bg-amber-100 text-amber-600",
    "Good News": "bg-emerald-100 text-emerald-600",
    General: "bg-slate-100 text-slate-500"
  }[p] || "bg-slate-100 text-slate-500");

  const getCategoryBadge = (c: ParsedAlert["category"]) => ({
    Academic: "bg-blue-50 text-blue-600",
    Attendance: "bg-emerald-50 text-emerald-600",
    General: "bg-slate-100 text-slate-500"
  }[c] || "bg-slate-100 text-slate-500");

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <PageHeader
          title="Alerts & Notifications"
          subtitle="Stay updated with your child's activities"
          badge={allAlerts.length > 0 ? `${allAlerts.length} New` : ""}
        />
        <button
          onClick={markAllRead}
          className="flex items-center justify-center gap-2 px-6 py-3 border border-slate-200 bg-white rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
        >
          <CheckCircle className="w-4 h-4" />
          Mark All Read
        </button>
      </div>

      {/* Filter Tabs - Scrollable on mobile */}
      <div className="flex overflow-x-auto pb-4 mb-4 gap-2 scrollbar-none no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 min-w-max">
          {filterTabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${
                i === activeTab
                  ? "bg-[#1e3a8a] text-white border-[#1e3a8a] shadow-lg shadow-blue-900/10"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              {tab} ({getTabCount(tab)})
            </button>
          ))}
        </div>
      </div>

      {/* Alert List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
          <p className="text-xs text-slate-400">Loading alerts...</p>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-slate-100 rounded-2xl">
          <BellRing className="w-12 h-12 text-slate-200 mb-3" />
          <p className="text-base font-semibold text-slate-400">No alerts</p>
          <p className="text-sm text-slate-300 mt-1">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => {
            const iconStyle = getIconStyle(alert);
            return (
              <div
                key={alert.id}
                className={`bg-white border border-slate-100 border-l-4 ${getBorderColor(alert.priority)} rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md transition-all`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`w-9 h-9 md:w-10 md:h-10 rounded-full ${iconStyle.bg} ${iconStyle.color} flex items-center justify-center shrink-0 mt-0.5`}>
                    {iconStyle.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h3 className="text-sm md:text-base font-bold text-slate-800">{alert.title}</h3>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getPriorityBadge(alert.priority)}`}>
                        {alert.priority}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getCategoryBadge(alert.category)}`}>
                        {alert.category}
                      </span>
                    </div>

                    <p className="text-sm text-slate-500 leading-relaxed mb-3">{alert.description}</p>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      {alert.date ? (
                        <>
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {fmtDateStr(alert.date)}
                          </span>
                          {alert.arrivalTime && (
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              Arrived at {alert.arrivalTime}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {fmtTs(alert.createdAt)}
                        </span>
                      )}
                      {alert.teacherName && (
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          {alert.teacherName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Feature 16 — AI Action Recommendations */}
                <div className="mt-4 pt-3 border-t border-slate-50">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Recommended Actions</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {getActions(alert).map((action, ai) => (
                      <button
                        key={ai}
                        onClick={action.onClick}
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                          action.primary
                            ? `${action.color || "bg-[#1e3a8a] hover:bg-blue-900 text-white"} shadow-sm`
                            : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Utility functions ──
const fmtDateStr = (dateStr: string) => {
  if (!dateStr) return "Recent";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  return dateStr;
};

const fmtTs = (ts: any): string => {
  if (!ts) return "Recent";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return "Recent";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default AlertsPage;
