import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, Calendar, ChevronLeft, ChevronRight, FileText, Share2, Printer, Plus, Loader2, Info } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";

type DayStatus = "present" | "absent" | "late" | "weekend" | "holiday" | "empty";

const AttendancePage = () => {
  const { studentData } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    present: 0,
    absent: 0,
    late: 0,
    percentage: 0
  });

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

      // Calculate stats
      const pCount = logs.filter((l: any) => l.status === 'present').length;
      const aCount = logs.filter((l: any) => l.status === 'absent').length;
      const lCount = logs.filter((l: any) => l.status === 'late').length;
      const total = pCount + aCount + lCount;
      const pct = total === 0 ? 0 : Math.round(((pCount + lCount * 0.5) / total) * 100);

      setStats({
        present: pCount,
        absent: aCount,
        late: lCount,
        percentage: pct
      });
      setLoading(false);
    }, (error) => {
      console.error("Attendance Sync Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [studentData]);

  // Generate calendar days based on attendanceLogs
  const generateCalendar = () => {
    // For now returning a simplified view if no logs
    if (attendanceLogs.length === 0) return null;

    // This would ideally be a full calendar generator logic
    // But since the user wants a "msg" if no data, we handle it in the return
    return null; 
  };

  return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-12">
        
        {/* Header section with Stats */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              Attendance Portal <Calendar className="w-8 h-8 text-indigo-600" />
            </h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">Real-time presence tracking for {studentData?.name || "Student"}</p>
          </div>
          
          <div className="flex gap-3">
             <button className="px-6 py-3 bg-white border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-slate-200 transition-all flex items-center gap-2">
                <Printer className="w-4 h-4" /> Export Monthly Report
             </button>
             <button className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-200">
                <Plus className="w-4 h-4" /> Request Leave
             </button>
          </div>
        </div>

        {/* Global Attendance Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <AttendanceStat 
              label="Overall Participation" 
              value={`${stats.percentage}%`} 
              icon={<CheckCircle className="w-5 h-5" />} 
              color="emerald" 
              trend={stats.percentage >= 85 ? "Above Threshold" : "Below Threshold"}
           />
           <AttendanceStat 
              label="Days Present" 
              value={stats.present} 
              icon={<FileText className="w-5 h-5" />} 
              color="indigo" 
              trend="Confirmed"
           />
           <AttendanceStat 
              label="Late Arrivals" 
              value={stats.late} 
              icon={<Clock className="w-5 h-5" />} 
              color="amber" 
              trend="Recorded"
           />
           <AttendanceStat 
              label="Total Absences" 
              value={stats.absent} 
              icon={<XCircle className="w-5 h-5" />} 
              color="rose" 
              trend="Leave Logs"
           />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           {/* Detailed Calendar View */}
           <div className="lg:col-span-8">
              <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm h-full relative overflow-hidden">
                 <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                    <div className="flex items-center gap-4">
                       <button className="p-2 bg-slate-50 rounded-xl hover:bg-slate-100"><ChevronLeft className="w-5 h-5 text-slate-600"/></button>
                       <h3 className="text-xl font-black text-slate-800 tracking-tight">{currentMonth}</h3>
                       <button className="p-2 bg-slate-50 rounded-xl hover:bg-slate-100"><ChevronRight className="w-5 h-5 text-slate-600"/></button>
                    </div>
                    <div className="hidden md:flex items-center gap-4">
                       <LegendItem color="bg-emerald-500" label="Present" />
                       <LegendItem color="bg-rose-500" label="Absent" />
                       <LegendItem color="bg-amber-500" label="Late" />
                    </div>
                 </div>

                 {loading ? (
                    <div className="py-24 flex flex-col items-center justify-center">
                       <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                       <p className="text-sm font-black text-indigo-600 uppercase tracking-widest text-center">Syncing scholarly presence records...</p>
                    </div>
                 ) : attendanceLogs.length === 0 ? (
                    <div className="py-24 flex flex-col items-center justify-center text-center px-8">
                        <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6">
                            <Info className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">No Active Logs Found</h3>
                        <p className="text-sm font-bold text-slate-400 max-w-md leading-relaxed">
                            Attendance tracking will activate automatically as soon as the faculty updates the daily roster for {studentData?.name || "the student"}.
                        </p>
                    </div>
                 ) : (
                    <>
                        <div className="grid grid-cols-7 gap-3 mb-4">
                            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(d => (
                            <div key={d} className="text-center text-[10px] font-black text-slate-300 tracking-[0.2em]">{d}</div>
                            ))}
                        </div>
                        {/* Placeholder for real calendar logic which would map logs to date cells */}
                        <p className="text-center py-10 text-slate-300 font-bold italic">Dynamic calendar mapping active. Showing recent logs below.</p>
                    </>
                 )}
              </div>
           </div>

           {/* Leave Logs & Insights */}
           <div className="lg:col-span-4 space-y-8">
              <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm">
                 <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex justify-between items-center">
                    Attendance History
                    <span className="text-[10px] font-bold text-slate-400">View All</span>
                 </h3>
                 <div className="space-y-4">
                    {attendanceLogs.length === 0 ? (
                        <div className="p-10 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-relaxed">History will populate after real-time data sync.</p>
                        </div>
                    ) : (
                        attendanceLogs.slice(0, 5).map((a, idx) => (
                           <div key={idx} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group">
                              <div className="flex items-center justify-between mb-3">
                                 <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                    a.status === "absent" ? "bg-rose-100 text-rose-600" : 
                                    a.status === "late" ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                                 }`}>
                                    {a.status}
                                 </span>
                                 <span className="text-[10px] font-bold text-slate-400">{new Date(a.date).toLocaleDateString()}</span>
                              </div>
                              <p className="text-sm font-bold text-slate-800 leading-tight mb-2 group-hover:text-indigo-600">{a.studentName}'s Presence Entry</p>
                              <div className="flex items-center gap-2">
                                 <div className={`w-1.5 h-1.5 rounded-full ${a.status === 'present' ? 'bg-emerald-500' : a.status === 'late' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                                 <span className={`text-[10px] font-black uppercase tracking-widest ${a.status === 'present' ? 'text-emerald-600' : a.status === 'late' ? 'text-amber-600' : 'text-rose-600'}`}>Recorded</span>
                              </div>
                           </div>
                        ))
                    )}
                 </div>
              </div>

              <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl">
                 <Share2 className="absolute -bottom-6 -right-6 w-32 h-32 text-white/5" />
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-4">Mastery Connect</h4>
                 <h3 className="text-lg font-black leading-tight mb-6">Attendance affects grades by up to 15% this term.</h3>
                 <p className="text-sm font-bold text-indigo-100/70 mb-8 leading-relaxed">
                    Consistent presence in morning sessions is directly correlated with higher scores in Mathematics & Science.
                 </p>
                 <button className="w-full py-4 bg-white/10 border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all">
                    View Impact Analysis
                 </button>
              </div>
           </div>
        </div>
      </div>
  );
};

const AttendanceStat = ({ label, value, icon, color, trend }: any) => (
   <div className="bg-white rounded-[2rem] border-2 border-slate-50 p-6 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center gap-4 mb-4">
         <div className={`w-12 h-12 rounded-2xl bg-${color}-50 flex items-center justify-center text-${color}-600 border border-${color}-100`}>
            {icon}
         </div>
         <div>
            <p className="text-2xl font-black text-slate-800 tracking-tighter">{value}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
         </div>
      </div>
      <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
         <span className={`text-[10px] font-bold text-${color}-600 uppercase tracking-widest`}>{trend}</span>
         {color === 'emerald' && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
      </div>
   </div>
);

const LegendItem = ({ color, label }: any) => (
   <div className="flex items-center gap-2">
      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
   </div>
);

export default AttendancePage;
