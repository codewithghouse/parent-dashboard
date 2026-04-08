import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

type DayStatus = "present" | "absent" | "late" | "weekend" | "empty";

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
    const dateStr = d.toLocaleDateString("en-CA");
    const logs = attendanceLogs.filter(l => l.date === dateStr);
    if (!logs.length) return d.getDay() === 0 || d.getDay() === 6 ? "weekend" : "empty";
    if (logs.some(l => l.status === "absent")) return "absent";
    if (logs.some(l => l.status === "late")) return "late";
    if (logs.some(l => l.status === "present")) return "present";
    return "empty";
  };

  const monthName = selectedDate.toLocaleString("default", { month: "long", year: "numeric" });
  const recentAbsences = attendanceLogs.filter(a => a.status !== "present").slice(0, 5);

  return (
    <div className="animate-in fade-in duration-500 pb-20">

      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Result of click: "Attendance"</p>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {/* Overall */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.percentage}%</p>
              <p className="text-xs text-slate-400">Overall</p>
            </div>
          </div>
          <p className={`text-xs font-semibold ${stats.percentage >= 85 ? "text-emerald-500" : "text-rose-500"}`}>
            {stats.percentage >= 85 ? "Good Standing" : "Below Threshold"}
          </p>
        </div>

        {/* Present */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{monthStats.present}</p>
              <p className="text-xs text-slate-400">Present</p>
            </div>
          </div>
          <p className="text-xs text-slate-400">This month</p>
        </div>

        {/* Absent */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{monthStats.absent}</p>
              <p className="text-xs text-slate-400">Absent</p>
            </div>
          </div>
          <p className="text-xs text-slate-400">This month</p>
        </div>

        {/* Late */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{monthStats.late}</p>
              <p className="text-xs text-slate-400">Late</p>
            </div>
          </div>
          <p className="text-xs text-slate-400">This month</p>
        </div>
      </div>

      {/* Calendar + Right Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Calendar */}
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <button onClick={handlePrevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-lg font-bold text-slate-800 min-w-[140px] text-center">{monthName}</h2>
              <button onClick={handleNextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /><span className="text-xs text-slate-500">Present</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500 inline-block" /><span className="text-xs text-slate-500">Absent</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /><span className="text-xs text-slate-500">Late</span></div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-300">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1.5">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                <div key={d} className="text-center text-xs text-slate-400 font-medium py-1">{d}</div>
              ))}
              {Array.from({ length: firstDayOfMonth(selectedDate) }).map((_, i) => (
                <div key={`e-${i}`} />
              ))}
              {Array.from({ length: daysInMonth(selectedDate) }).map((_, i) => {
                const day = i + 1;
                const status = getDayStatus(day);
                const cellStyle =
                  status === "present" ? "bg-emerald-500 text-white" :
                  status === "absent" ? "bg-rose-500 text-white" :
                  status === "late" ? "bg-amber-400 text-white" :
                  status === "weekend" ? "text-slate-300" :
                  "text-slate-600 hover:bg-slate-50";
                return (
                  <div key={day} className={`aspect-square rounded-xl flex items-center justify-center text-sm font-semibold transition-all ${cellStyle}`}>
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
