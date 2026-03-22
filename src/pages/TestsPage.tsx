import { Calendar, FileText, CheckCircle, Clock, Trophy, ArrowRight, Brain, Download, MoreVertical } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const upcoming = [
  { name: "Mathematics Unit Test", date: "Feb 5, 2026", days: "12 days", icon: "📐", color: "indigo", time: "09:00 AM" },
  { name: "Science Quiz", date: "Feb 8, 2026", days: "15 days", icon: "🔬", color: "emerald", time: "11:30 AM" },
  { name: "English Literature Test", date: "Feb 12, 2026", days: "19 days", icon: "📚", color: "amber", time: "10:15 AM" },
];

const recent = [
  { name: "Mathematics Unit Test 4", date: "Jan 15, 2026", score: "92/100", status: "Distinctive", color: "emerald" },
  { name: "Science Lab Practical", date: "Jan 10, 2026", score: "88/100", status: "Excellent", color: "emerald" },
  { name: "English Grammar Test", date: "Jan 5, 2026", score: "76/100", status: "Good", color: "amber" },
];

const grades = [
  { label: "A+ Grade", value: "02", color: "emerald" },
  { label: "A Grade", value: "05", color: "indigo" },
  { label: "B Grade", value: "04", color: "amber" },
  { label: "C Grade", value: "01", color: "slate" },
];

const TestsPage = () => {
    const { studentData } = useAuth();

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-12">
            
            {/* Header section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        Tests & Exams <FileText className="w-8 h-8 text-indigo-600" />
                    </h1>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">Academic evaluation timeline for {studentData?.name || "Student"}</p>
                </div>
                
                <div className="flex gap-3">
                   <button className="px-6 py-3 bg-white border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-slate-200 transition-all flex items-center gap-2">
                        <Download className="w-4 h-4" /> Exam Timetable
                   </button>
                </div>
            </div>

            {/* Featured Counter Banner */}
            <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-indigo-100 scale-[1.01]">
                <div className="absolute top-0 right-0 p-12 opacity-10">
                    <Calendar className="w-64 h-64 text-white" />
                </div>
                
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="px-4 py-1.5 bg-rose-500 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-rose-500/20 animate-pulse">Upcoming Mega Test</span>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Starts in 12 Days</span>
                        </div>
                        <h2 className="text-4xl font-black tracking-tight max-w-xl leading-tight">Mathematics Unit Test: Advanced Calculus & Algebra</h2>
                        <div className="flex items-center gap-8 pt-2">
                            <div className="flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-indigo-400" />
                                <span className="text-sm font-bold text-slate-300">February 5, 2026</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Clock className="w-5 h-5 text-indigo-400" />
                                <span className="text-sm font-bold text-slate-300">09:00 AM - 12:00 PM</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-8 bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-white/10">
                       <div className="text-center">
                          <p className="text-5xl font-black text-white tracking-tighter">12</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Days Left</p>
                       </div>
                       <div className="w-[1px] h-16 bg-white/10" />
                       <button className="px-8 py-4 bg-white text-slate-900 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl">
                          View Syllabus
                       </button>
                    </div>
                </div>
            </div>

            {/* Grid for Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Upcoming List */}
                <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-3">
                        <Clock className="w-5 h-5 text-indigo-500" /> Scheduled Tests
                    </h3>
                    <div className="space-y-4">
                        {upcoming.map((t, idx) => (
                            <div key={idx} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 hover:shadow-lg hover:bg-white transition-all group">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl bg-${t.color}-50 flex items-center justify-center text-xl`}>{t.icon}</div>
                                        <div>
                                            <p className="text-base font-black text-slate-800">{t.name}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{t.date} • {t.time}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[11px] font-black text-indigo-600 block">{t.days}</span>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Countdown</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Results */}
                <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-3">
                        <Trophy className="w-5 h-5 text-emerald-500" /> Recent Results
                    </h3>
                    <div className="space-y-4">
                        {recent.map((r, idx) => (
                            <div key={idx} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 group transition-all">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-emerald-500 border border-slate-100 shadow-sm"><CheckCircle className="w-6 h-6"/></div>
                                        <div>
                                            <p className="text-base font-black text-slate-800">{r.name}</p>
                                            <span className={`text-[10px] font-black uppercase tracking-widest text-${r.color}-600`}>{r.status}</span>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-1">
                                        <span className="text-xl font-black text-slate-800">{r.score}</span>
                                        <button className="p-1 hover:bg-slate-200 rounded-lg text-slate-400"><MoreVertical className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Performance Correlation Section */}
            <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm">
                <div className="flex items-center justify-between mb-10">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Term Assessment Distribution</h3>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Session (2025-26)</span>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {grades.map((g, idx) => (
                        <div key={idx} className={`p-8 bg-${g.color}-50 border-2 border-${g.color}-100 rounded-[2rem] text-center relative group hover:scale-[1.02] transition-all`}>
                            <p className={`text-4xl font-black text-${g.color}-600 tracking-tighter mb-2`}>{g.value}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{g.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Navigation to Concepts (Connection) */}
            <div className="bg-indigo-600 rounded-[2.5rem] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group">
                 <Brain className="absolute -left-8 -bottom-8 w-40 h-40 text-white/5 group-hover:scale-110 transition-transform duration-700" />
                 <div className="relative z-10 max-w-xl">
                    <h3 className="text-2xl font-black tracking-tight mb-2">Preparing for upcoming tests?</h3>
                    <p className="text-sm font-bold text-indigo-100 leading-relaxed">
                        Use our AI-powered Practice Problem Generator to identify weak concepts before the Mathematics Unit Test starts.
                    </p>
                 </div>
                 <button className="relative z-10 px-10 py-5 bg-white text-indigo-600 rounded-[1.5rem] text-xs font-black uppercase tracking-widest flex items-center gap-3 shadow-xl hover:-translate-y-1 transition-all">
                    Start AI Prep <ArrowRight className="w-5 h-5" />
                 </button>
            </div>
        </div>
    );
};

export default TestsPage;
