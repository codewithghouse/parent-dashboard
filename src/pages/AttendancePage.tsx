import { useState } from "react";
import { CheckCircle, XCircle, Clock, Calendar, ChevronLeft, ChevronRight, FileText, Share2, Printer, Plus } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

type DayStatus = "present" | "absent" | "late" | "weekend" | "holiday" | "empty";

const calendarDays: { day: number | null; status: DayStatus }[][] = [
  [
    { day: 29, status: "empty" }, { day: 30, status: "empty" }, { day: 31, status: "empty" },
    { day: 1, status: "present" }, { day: 2, status: "present" }, { day: 3, status: "present" }, { day: 4, status: "weekend" },
  ],
  [
    { day: 5, status: "weekend" }, { day: 6, status: "present" }, { day: 7, status: "present" },
    { day: 8, status: "present" }, { day: 9, status: "present" }, { day: 10, status: "present" }, { day: 11, status: "weekend" },
  ],
  [
    { day: 12, status: "weekend" }, { day: 13, status: "present" }, { day: 14, status: "present" },
    { day: 15, status: "present" }, { day: 16, status: "absent" }, { day: 17, status: "present" }, { day: 18, status: "weekend" },
  ],
  [
    { day: 19, status: "weekend" }, { day: 20, status: "late" }, { day: 21, status: "present" },
    { day: 22, status: "present" }, { day: 23, status: "present" }, { day: 24, status: "present" }, { day: 25, status: "weekend" },
  ],
  [
    { day: 26, status: "weekend" }, { day: 27, status: "late" }, { day: 28, status: "present" },
    { day: 29, status: "present" }, { day: 30, status: "present" }, { day: 31, status: "present" }, { day: null, status: "empty" },
  ],
];

const absences = [
  { date: "January 16, 2026", type: "Absent" as const, reason: "Medical Fever", status: "Approved" },
  { date: "January 20, 2026", type: "Late" as const, reason: "Traffic Delay", status: "Recorded" },
  { date: "January 27, 2026", type: "Late" as const, reason: "Personal Reason", status: "Recorded" },
];

const AttendancePage = () => {
  const { studentData } = useAuth();
  const [currentMonth, setCurrentMonth] = useState("January 2026");

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
              value="94%" 
              icon={<CheckCircle className="w-5 h-5" />} 
              color="emerald" 
              trend="Above Threshold (85%)"
           />
           <AttendanceStat 
              label="Days Present" 
              value="22" 
              icon={<FileText className="w-5 h-5" />} 
              color="indigo" 
              trend="This Month"
           />
           <AttendanceStat 
              label="Late Arrivals" 
              value="02" 
              icon={<Clock className="w-5 h-5" />} 
              color="amber" 
              trend="Action Recommended"
           />
           <AttendanceStat 
              label="Total Absences" 
              value="01" 
              icon={<XCircle className="w-5 h-5" />} 
              color="rose" 
              trend="Documented Leave"
           />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           {/* Detailed Calendar View */}
           <div className="lg:col-span-8">
              <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm h-full">
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
                       <LegendItem color="bg-slate-100" label="Weekend" />
                    </div>
                 </div>

                 <div className="grid grid-cols-7 gap-3 mb-4">
                    {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(d => (
                       <div key={d} className="text-center text-[10px] font-black text-slate-300 tracking-[0.2em]">{d}</div>
                    ))}
                 </div>

                 {calendarDays.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 gap-3 mb-3">
                       {week.map((d, di) => (
                          <div key={di} className={`h-16 rounded-[1.25rem] border flex flex-col items-center justify-center relative group transition-all ${
                             !d.day ? "bg-transparent border-transparent" :
                             d.status === "present" ? "bg-emerald-50/50 border-emerald-100 text-emerald-600 hover:bg-emerald-50" :
                             d.status === "absent" ? "bg-rose-50/50 border-rose-100 text-rose-600 hover:bg-rose-50" :
                             d.status === "late" ? "bg-amber-50/50 border-amber-100 text-amber-600 hover:bg-amber-50" :
                             "bg-slate-50 border-slate-100 text-slate-400"
                          }`}>
                             <span className="text-sm font-black">{d.day || ""}</span>
                             {d.status !== "empty" && d.status !== "weekend" && (
                                <div className={`w-1.5 h-1.5 rounded-full mt-1 ${
                                   d.status === "present" ? "bg-emerald-500" :
                                   d.status === "absent" ? "bg-rose-500" :
                                   "bg-amber-500"
                                }`} />
                             )}
                          </div>
                       ))}
                    </div>
                 ))}
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
                    {absences.map((a, idx) => (
                       <div key={idx} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group">
                          <div className="flex items-center justify-between mb-3">
                             <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                a.type === "Absent" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                             }`}>
                                {a.type}
                             </span>
                             <span className="text-[10px] font-bold text-slate-400">{a.date}</span>
                          </div>
                          <p className="text-sm font-bold text-slate-800 leading-tight mb-2 group-hover:text-indigo-600">{a.reason}</p>
                          <div className="flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                             <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{a.status}</span>
                          </div>
                       </div>
                    ))}
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
