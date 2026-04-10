import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

type DayStatus = "present" | "absent" | "late" | "weekend" | "forgotten" | "empty";

const AttendancePage = () => {
  const { studentData } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, percentage: 0 });
  const [monthStats, setMonthStats] = useState({ present: 0, absent: 0, late: 0 });

  useEffect(() => {
    if (!studentData?.id) return;
    setLoading(true);
    const studentEmail = (studentData.email || "").toLowerCase();

    let snap1: any = null, snap2: any = null;
    const processLogs = () => {
      const combined = [...(snap1?.docs || []), ...(snap2?.docs || [])];
      const uniqueLogs = Array.from(new Map(combined.map((d: any) => [d.id, { id: d.id, ...d.data() as any }])).values())
        .sort((a: any, b: any) => b.date.localeCompare(a.date));
      setAttendanceLogs(uniqueLogs);

      const pCount = uniqueLogs.filter((l: any) => l.status === "present").length;
      const aCount = uniqueLogs.filter((l: any) => l.status === "absent").length;
      const lCount = uniqueLogs.filter((l: any) => l.status === "late").length;
      const total = pCount + aCount + lCount;
      setStats({ present: pCount, absent: aCount, late: lCount, percentage: total === 0 ? 100 : Math.round(((pCount + lCount) / total) * 100) });

      // This month stats
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const thisMonth = uniqueLogs.filter((l: any) => l.date?.startsWith(ym));
      setMonthStats({
        present: thisMonth.filter((l: any) => l.status === "present").length,
        absent: thisMonth.filter((l: any) => l.status === "absent").length,
        late: thisMonth.filter((l: any) => l.status === "late").length,
      });
      setLoading(false);
    };

    const u1 = onSnapshot(query(collection(db, "attendance"), where("studentId", "==", studentData.id)), s => { snap1 = s; processLogs(); });
    const u2 = studentEmail ? onSnapshot(query(collection(db, "attendance"), where("studentEmail", "==", studentEmail)), s => { snap2 = s; processLogs(); }) : () => {};
    return () => { u1(); u2(); };
  }, [studentData?.id, studentData?.email]);

  const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  const handlePrevMonth = () => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1));
  const handleNextMonth = () => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1));

  const getDayStatus = (day: number): DayStatus => {
    const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
    // Weekend check first — always weekend regardless of records
    if (d.getDay() === 0 || d.getDay() === 6) return "weekend";

    const dateStr = d.toLocaleDateString("en-CA");
    const logs = attendanceLogs.filter(l => l.date === dateStr);

    if (logs.length === 0) {
      // No records for this day — check if it's a past weekday (teacher forgot)
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      if (d.getTime() < todayMidnight.getTime()) return "forgotten";
      return "empty"; // today or future
    }

    if (logs.some(l => l.status === "absent")) return "absent";
    if (logs.some(l => l.status === "late")) return "late";
    if (logs.some(l => l.status === "present")) return "present";
    return "empty";
  };

  const monthName = selectedDate.toLocaleString("default", { month: "long", year: "numeric" });
  const recentAbsences = attendanceLogs.filter(a => a.status !== "present").slice(0, 5);

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader
        title="Attendance Tracking"
        badge={`${stats.percentage}% Avg`}
        subtitle="Monitor daily presence and monthly patterns"
      />

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5">
        {/* Overall */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 md:p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold text-slate-800">{stats.percentage}%</p>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Overall</p>
            </div>
          </div>
          <div className={`h-1 w-full rounded-full overflow-hidden bg-slate-100`}>
            <div className={`h-full ${stats.percentage >= 85 ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${stats.percentage}%` }} />
          </div>
        </div>

        {/* Present */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 md:p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold text-slate-800">{monthStats.present}</p>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Present</p>
            </div>
          </div>
        </div>

        {/* Absent */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 md:p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl ${monthStats.absent > 0 ? "bg-rose-50" : "bg-slate-50"} flex items-center justify-center`}>
              <XCircle className={`w-4 h-4 md:w-5 md:h-5 ${monthStats.absent > 0 ? "text-rose-500" : "text-slate-300"}`} />
            </div>
            <div>
              <p className={`text-xl md:text-2xl font-bold ${monthStats.absent > 0 ? "text-rose-500" : "text-slate-800"}`}>{monthStats.absent}</p>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Absent</p>
            </div>
          </div>
        </div>

        {/* Late */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 md:p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl ${monthStats.late > 0 ? "bg-amber-50" : "bg-slate-50"} flex items-center justify-center`}>
              <Clock className={`w-4 h-4 md:w-5 md:h-5 ${monthStats.late > 0 ? "text-amber-500" : "text-slate-300"}`} />
            </div>
            <div>
              <p className={`text-xl md:text-2xl font-bold ${monthStats.late > 0 ? "text-amber-600" : "text-slate-800"}`}>{monthStats.late}</p>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Late</p>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar + Right Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Calendar */}
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          {/* Calendar Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <button onClick={handlePrevMonth} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all shadow-sm">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="px-4 py-1.5 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-800 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" />
                <span className="min-w-[124px] text-center">{monthName}</span>
              </div>
              <button onClick={handleNextMonth} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all shadow-sm">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Present</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /><span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Absent</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Late</span></div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-300 gap-3">
              <Loader2 className="w-10 h-10 animate-spin opacity-50" />
              <p className="text-sm font-medium">Syncing logs...</p>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1 md:gap-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                <div key={d} className="text-center text-xs text-slate-400 font-medium py-1">{d}</div>
              ))}
              {Array.from({ length: firstDayOfMonth(selectedDate) }).map((_, i) => (
                <div key={`e-${i}`} />
              ))}
              {Array.from({ length: daysInMonth(selectedDate) }).map((_, i) => {
                const day = i + 1;
                const status = getDayStatus(day);
                const cellStyle = (() => {
                  switch (status) {
                    case "present": return "bg-emerald-500 text-white shadow-md shadow-emerald-500/20";
                    case "absent": return "bg-rose-500 text-white shadow-md shadow-rose-500/20";
                    case "late": return "bg-amber-400 text-white shadow-md shadow-amber-400/20";
                    case "weekend": return "bg-slate-50 text-slate-300 border-dashed border border-slate-200";
                    case "forgotten": return "bg-slate-100 text-slate-400 opacity-60";
                    case "empty": return "bg-white text-slate-700 hover:bg-slate-50 border border-slate-100";
                    default: return "bg-white text-slate-700";
                  }
                })();
                return (
                  <div key={day} className={`aspect-square rounded-lg md:rounded-xl flex items-center justify-center text-xs md:text-sm font-bold transition-all ${cellStyle}`}>
                    {day}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Recent Absences + Policy */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Recent Absences */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex-1">
            <h3 className="text-base font-bold text-slate-800 mb-4">Recent Absences</h3>
            <div className="space-y-3">
              {recentAbsences.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-300 gap-2">
                  <CheckCircle className="w-10 h-10 text-emerald-200" />
                  <p className="text-xs">Perfect attendance!</p>
                </div>
              ) : recentAbsences.map((a, i) => {
                const isAbsent = a.status === "absent";
                const dateStr = (() => {
                  const d = new Date(a.date);
                  // Fix timezone shift: parse as local date
                  const parts = a.date?.split("-");
                  if (parts?.length === 3) {
                    const local = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    return local.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
                  }
                  return d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
                })();
                return (
                  <div key={i} className={`flex items-center gap-3 p-3.5 rounded-xl border ${isAbsent ? "bg-rose-50 border-rose-100" : "bg-amber-50 border-amber-100"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isAbsent ? "bg-rose-100 text-rose-500" : "bg-amber-100 text-amber-500"}`}>
                      {isAbsent ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{dateStr}</p>
                      <p className="text-xs text-slate-400 truncate">{a.note || (isAbsent ? "Reason: Not specified" : `Arrived late`)}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg flex-shrink-0 ${isAbsent ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"}`}>
                      {isAbsent ? "Absent" : "Late"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Attendance Policy */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 shadow-sm">
            <h4 className="text-sm font-bold text-slate-700 mb-2">Attendance Policy</h4>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Minimum 85% attendance required for exam eligibility.
            </p>
            <div className={`flex items-center gap-2 text-sm font-semibold ${stats.percentage >= 85 ? "text-emerald-600" : "text-rose-600"}`}>
              <CheckCircle className="w-4 h-4" />
              <span>{studentData?.name?.split(" ")[0] || "Student"} is {stats.percentage >= 85 ? "above the threshold" : "below the requirement"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;
