import React, { useState, useEffect } from "react";
import { 
  CheckCircle, XCircle, Clock, Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  FileText, Printer, Plus, Loader2, Info, Sparkles, MapPin, BrainCircuit, 
  GraduationCap, Activity, TrendingUp, Filter, ArrowUpRight
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { ParentAIController } from "../ai/controller/ai-controller";

type DayStatus = "present" | "absent" | "late" | "weekend" | "holiday" | "empty";

const AttendancePage = () => {
  const { studentData } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    present: 0,
    absent: 0,
    late: 0,
    percentage: 0
  });
  const [aiCorrelation, setAiCorrelation] = useState<any>(null);
  const [analyzingAi, setAnalyzingAi] = useState(false);

  // ─── DATA SYNCHRONIZATION ───
  useEffect(() => {
    if (!studentData?.id) return;

    setLoading(true);
    const q = query(
      collection(db, "attendance"),
      where("studentId", "==", studentData.id),
      orderBy("date", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAttendanceLogs(logs);

      // Institutional Health calculation
      const pCount = logs.filter((l: any) => l.status === 'present').length;
      const aCount = logs.filter((l: any) => l.status === 'absent').length;
      const lCount = logs.filter((l: any) => l.status === 'late').length;
      const total = pCount + aCount + lCount;
      const pct = total === 0 ? 100 : Math.round(((pCount + lCount) / total) * 100);

      setStats({
        present: pCount,
        absent: aCount,
        late: lCount,
        percentage: pct
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [studentData?.id]);

  // ─── AI CORRELATION ENGINE ───
  useEffect(() => {
    if (loading || !studentData?.id || attendanceLogs.length === 0) return;
    
    const fetchAiAnalytic = async () => {
      setAnalyzingAi(true);
      const res = await ParentAIController.getAttendanceInsights({
        student_name: studentData.name,
        attendance_rate: `${stats.percentage}%`,
        late_days: stats.late,
        absent_days: stats.absent
      });
      if (res.status === "success") setAiCorrelation(res.data);
      setAnalyzingAi(false);
    };
    fetchAiAnalytic();
  }, [loading, studentData?.id, stats.percentage]);

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const handlePrevMonth = () => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1));
  const handleNextMonth = () => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1));

  const getDayStatus = (day: number): DayStatus => {
    const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
    const dateStr = d.toLocaleDateString('en-CA');
    const log = attendanceLogs.find(l => l.date === dateStr);
    
    if (log) return log.status as DayStatus;
    if (d.getDay() === 0) return "weekend";
    return "empty";
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000 pb-24 text-left font-sans">
      
      {/* ─── HEADER ─── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-10 mb-20 px-4">
        <div className="text-left w-full md:w-auto">
           <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-[1.5rem] bg-[#1e3a8a] flex items-center justify-center text-white shadow-xl shadow-blue-200">
                 <CalendarIcon size={26} />
              </div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">Presence Registry Vault</p>
                 <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border-2 border-white shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest leading-none">Institutional Sync Live</p>
                 </div>
              </div>
           </div>
           <h1 className="text-6xl font-black text-slate-900 tracking-tighter leading-none mb-4">Attendance Audit</h1>
           <p className="text-xl font-bold text-slate-400 italic">Historical presence logs and predictive impact analysis.</p>
        </div>
        
        <div className="flex items-center gap-6 w-full md:w-auto">
           <button className="h-20 px-10 bg-white border border-slate-100 rounded-[2.5rem] flex items-center gap-4 text-[11px] font-black text-slate-700 uppercase tracking-widest shadow-sm hover:shadow-2xl transition-all">
              <Printer size={20} className="text-[#1e3a8a]"/> Export Audit
           </button>
           <button className="h-20 px-10 bg-[#1e3a8a] text-white rounded-[2.5rem] flex items-center gap-4 text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-blue-900/40 hover:scale-105 active:scale-95 transition-all">
              <Plus size={20} /> Request Leave
           </button>
        </div>
      </div>

      {/* ─── KPI SUMMARY ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-20 px-2">
         <AttendanceKPI label="Registry Health" value={`${stats.percentage}%`} icon={Activity} color="emerald" tag="Optimal" />
         <AttendanceKPI label="Days Authenticated" value={stats.present} icon={CheckCircle} color="indigo" tag="Registry" />
         <AttendanceKPI label="Late Intervals" value={stats.late} icon={Clock} color="amber" tag="Warnings" />
         <AttendanceKPI label="Active Absences" value={stats.absent} icon={XCircle} color="rose" tag="Critical" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 px-2">
         
         {/* LEFT: CALENDAR MATRIX */}
         <div className="lg:col-span-8">
            <div className="bg-white border border-slate-100 rounded-[4.5rem] p-12 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all">
               <div className="flex items-center justify-between mb-16 pb-8 border-b border-slate-50">
                  <div className="flex items-center gap-10">
                     <div className="flex items-center gap-4">
                        <button onClick={handlePrevMonth} className="w-14 h-14 flex items-center justify-center bg-slate-50 rounded-[1.5rem] hover:bg-slate-900 hover:text-white transition-all shadow-inner"><ChevronLeft /></button>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter min-w-[200px] text-center">{selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                        <button onClick={handleNextMonth} className="w-14 h-14 flex items-center justify-center bg-slate-50 rounded-[1.5rem] hover:bg-slate-900 hover:text-white transition-all shadow-inner"><ChevronRight /></button>
                     </div>
                  </div>
                  <div className="hidden xl:flex items-center gap-8">
                     <Legend color="bg-emerald-500" label="Present" />
                     <Legend color="bg-rose-500" label="Absent" />
                     <Legend color="bg-amber-500" label="Late" />
                  </div>
               </div>

               {loading ? (
                  <div className="py-40 flex flex-col items-center justify-center">
                     <Loader2 className="w-16 h-16 text-indigo-200 animate-spin mb-8" />
                     <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Accessing Institutional Roster...</p>
                  </div>
               ) : (
                  <div className="grid grid-cols-7 gap-6">
                     {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(d => (
                       <div key={d} className="text-center text-[11px] font-black text-slate-300 tracking-[0.3em] mb-6">{d}</div>
                     ))}
                     
                     {Array.from({ length: firstDayOfMonth(selectedDate) }).map((_, i) => (
                       <div key={`e-${i}`} className="h-28 rounded-[2.5rem] border border-transparent" />
                     ))}

                     {Array.from({ length: daysInMonth(selectedDate) }).map((_, i) => {
                        const day = i + 1;
                        const status = getDayStatus(day);
                        return (
                          <div key={day} className={`h-28 rounded-[3rem] border flex flex-col items-center justify-center relative group transition-all cursor-pointer ${
                             status === 'present' ? 'bg-emerald-50 border-emerald-100' :
                             status === 'absent' ? 'bg-rose-50 border-rose-100' :
                             status === 'late' ? 'bg-amber-50 border-amber-100' :
                             status === 'weekend' ? 'bg-slate-50/50 border-slate-50 opacity-40' : 'bg-white border-slate-50 hover:bg-slate-50/50'
                          }`}>
                             <span className={`text-xl font-black ${status === 'empty' ? 'text-slate-300' : 'text-slate-800'}`}>{day}</span>
                             <div className={`w-2.5 h-2.5 rounded-full absolute bottom-5 ${
                                status === 'present' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' :
                                status === 'absent' ? 'bg-rose-500 shadow-lg shadow-rose-500/50' :
                                status === 'late' ? 'bg-amber-500 shadow-lg shadow-amber-500/50' : 'hidden'
                             }`} />
                          </div>
                        );
                     })}
                  </div>
               )}
            </div>
         </div>

         {/* RIGHT: TRACE LOG & AI INFERENCE */}
         <div className="lg:col-span-4 flex flex-col gap-12">
            <div className="bg-slate-900 rounded-[4.5rem] p-12 text-white shadow-2xl flex flex-col min-h-[500px] relative overflow-hidden group">
               <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:scale-150 transition-all duration-1000" />
               <div className="flex items-center justify-between mb-12 relative z-10">
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">Registry Trace</h3>
                  <div className="px-5 py-2 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-300">Archive Log</div>
               </div>

               <div className="space-y-6 flex-1 relative z-10 overflow-y-auto no-scrollbar max-h-[550px]">
                  {attendanceLogs.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-20 px-10">
                        <Clock className="w-16 h-16 mb-8 animate-pulse" />
                        <p className="text-[11px] font-black uppercase tracking-[0.3em] leading-relaxed">No presence records matched in current audit cycle.</p>
                     </div>
                  ) : (
                     attendanceLogs.slice(0, 8).map((a, idx) => (
                        <div key={idx} className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem] group/log hover:bg-white/10 transition-all">
                           <div className="flex items-center gap-6">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-[12px] font-black shadow-xl ${
                                 a.status === "absent" ? "bg-rose-500" : a.status === "late" ? "bg-amber-500" : "bg-emerald-500"
                              }`}>
                                 {a.status?.[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <p className="text-sm font-black text-white truncate uppercase tracking-tighter mb-1">
                                    {new Date(a.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                 </p>
                                 <div className="flex items-center gap-2">
                                    <MapPin size={10} className="text-indigo-400" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{a.className || "Subdivision A"}</span>
                                 </div>
                              </div>
                              <ArrowUpRight className="text-white/20 group-hover/log:text-white transition-all" size={20} />
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[4.5rem] p-12 shadow-sm text-left relative overflow-hidden group hover:shadow-2xl transition-all">
               <div className="absolute top-0 right-0 p-12 opacity-5 scale-150">
                  <BrainCircuit className="w-32 h-32 text-indigo-600" />
               </div>
               
               <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-10">
                     <Sparkles className="w-8 h-8 text-amber-500 animate-pulse" />
                     <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Inference Engine</h3>
                  </div>

                  {analyzingAi ? (
                     <div className="space-y-6">
                        <div className="h-12 bg-slate-50 rounded-2xl animate-pulse" />
                        <div className="h-24 bg-slate-50 rounded-2xl animate-pulse" />
                     </div>
                  ) : (
                     <div className="space-y-8">
                        <p className="text-xl font-bold text-slate-600 leading-relaxed italic border-l-8 border-[#1e3a8a] pl-8">
                           "{aiCorrelation?.correlation_narrative || "The student's presence rhythm is aligned with scholastic requirements. Consistent engagement is fueling the current mastery trend."}"
                        </p>
                        <div className="flex items-center gap-4 pt-6">
                           <div className="w-12 h-12 rounded-[1.5rem] bg-indigo-50 flex items-center justify-center text-[#1e3a8a]">
                              <TrendingUp size={24} />
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Growth Mitigation</p>
                              <p className="text-sm font-black text-slate-800 uppercase tracking-tighter">{aiCorrelation?.growth_strategy || "Maintain Baseline Rhythm"}</p>
                           </div>
                        </div>
                     </div>
                  )}
               </div>
            </div>
         </div>

      </div>
    </div>
  );
};

const AttendanceKPI = ({ label, value, icon: Icon, color, tag }: any) => (
  <div className="bg-white border border-slate-100 p-10 rounded-[3.5rem] shadow-sm hover:translate-y-[-8px] hover:shadow-2xl transition-all group relative overflow-hidden text-left font-sans">
    <div className={`absolute -top-10 -right-10 w-32 h-32 bg-${color}-50 rounded-full blur-2xl group-hover:blur-3xl transition-all`} />
    <div className="flex items-center justify-between mb-10 relative z-10">
      <div className={`w-16 h-16 rounded-[1.8rem] bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#1e3a8a] group-hover:text-white transition-all shadow-inner`}>
        <Icon size={30} />
      </div>
      <div className="px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.25em] border border-slate-50 bg-slate-50 text-slate-400 shadow-sm italic">
        {tag}
      </div>
    </div>
    <div className="relative z-10">
      <h2 className="text-6xl font-black tracking-tighter mb-2 text-slate-900 leading-none">{value}</h2>
      <p className="text-sm font-black text-slate-400 uppercase tracking-[0.4em]">{label}</p>
    </div>
  </div>
);

const Legend = ({ color, label }: any) => (
   <div className="flex items-center gap-3">
      <div className={`w-4 h-4 rounded-full ${color} shadow-lg`} />
      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest tabular-nums">{label}</span>
   </div>
);

export default AttendancePage;
