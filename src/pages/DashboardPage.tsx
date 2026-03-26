import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { 
  CheckCircle, AlertCircle, Calendar, Star, ArrowUp, Clock, CheckSquare, 
  Sparkles, BrainCircuit, Rocket, Zap, MessageSquare, Loader2, Info, Layout, TrendingUp,
  User, ShieldCheck, Activity, Bell, GraduationCap, ChevronRight, MoreVertical
} from "lucide-react";
import { ParentAIController } from "../ai/controller/ai-controller";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDocs, limit, orderBy, Timestamp } from "firebase/firestore";

const DashboardPage = () => {
  const { studentData, user } = useAuth();
  const navigate = useNavigate();
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [liveStats, setLiveStats] = useState({
    attendance: "...",
    pending: 0,
    tests: 0,
    avgScore: "0%"
  });
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // ─── DATA SYNCHRONIZATION ───
  useEffect(() => {
    if (!studentData?.id) return;

    // 1. Live Attendance
    const qAtt = query(collection(db, "attendance"), where("studentId", "==", studentData.id));
    const unsubAtt = onSnapshot(qAtt, (snap) => {
        const records = snap.docs.map(d => d.data());
        const pCount = records.filter(r => r.status === 'present' || r.status === 'late').length;
        const total = records.length;
        setLiveStats(prev => ({ ...prev, attendance: total === 0 ? "100%" : `${Math.round((pCount/total)*100)}%` }));
    });

    // 2. Pending Tasks (Assignments & Submissions comparison)
    const qAssign = query(collection(db, "assignments"), where("classId", "in", studentData.classes || []));
    const qSubs = query(collection(db, "submissions"), where("studentId", "==", studentData.id));
    
    const unsubTasks = onSnapshot(qAssign, async (aSnap) => {
        const assignments = aSnap.docs.map(d => d.id);
        const sSnap = await getDocs(qSubs);
        const submittedIds = new Set(sSnap.docs.map(d => d.data().assignmentId));
        const pending = assignments.filter(id => !submittedIds.has(id)).length;
        setLiveStats(prev => ({ ...prev, pending }));
    });

    // 3. Performance Aggregation
    const qRes = query(collection(db, "results"), where("studentId", "==", studentData.id));
    const unsubRes = onSnapshot(qRes, (snap) => {
        const results = snap.docs.map(d => d.data());
        if (results.length > 0) {
           const avg = results.reduce((acc, curr) => acc + (parseFloat(curr.score) || 0), 0) / results.length;
           setLiveStats(prev => ({ ...prev, avgScore: `${Math.round(avg)}%` }));
        }
        
        // Populate Recent Events Log
        const events = snap.docs.map(d => ({
           id: d.id,
           type: 'result',
           title: `Performance Logged: ${d.data().assignmentTitle || 'Assessment'}`,
           value: `${d.data().score}%`,
           time: d.data().timestamp?.toDate() || new Date(),
           color: 'text-emerald-500'
        }));
        setRecentEvents(prev => [...events, ...prev.filter(e => e.type !== 'result')].sort((a,b) => b.time - a.time).slice(0, 5));
    });

    return () => {
      unsubAtt();
      unsubTasks();
      unsubRes();
    };
  }, [studentData?.id, studentData?.classes]);

  // ─── AI INSIGHTS ENGINE ───
  useEffect(() => {
    if (!studentData?.id || liveStats.attendance === "...") return;

    const fetchAI = async () => {
      setIsAnalyzing(true);
      try {
        const context = {
          child_name: studentData.name,
          attendance: liveStats.attendance,
          avg_score: liveStats.avgScore,
          pending: liveStats.pending,
          grade: studentData.grade || "8"
        };
        const result = await ParentAIController.getDashboardInsights(context);
        if (result.status === "success") setAiInsights(result.data);
      } catch (e) {
        console.error("AI Sync Failure", e);
      } finally {
        setIsAnalyzing(false);
      }
    };
    fetchAI();
  }, [studentData?.id, liveStats.attendance, liveStats.pending]);

  if (studentData?.status === "Invited") return (
     <div className="h-[80vh] flex flex-col items-center justify-center p-10 text-center">
        <Rocket className="w-20 h-20 text-[#1e3a8a] animate-bounce mb-8" />
        <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter">Identity Matrix Detected</h1>
        <p className="text-lg font-bold text-slate-400 max-w-md mx-auto italic">Your institutional access is being provisioned. Please wait for the final synchronization cycle.</p>
        <div className="mt-10 flex gap-4 animate-pulse uppercase font-black text-[10px] text-slate-300 tracking-[0.3em]">
           <span>Encrypting</span> • <span>Syncing</span> • <span>Finalizing</span>
        </div>
     </div>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000 pb-24 text-left font-sans">
      
      {/* ─── HEADER ARCHITECTURE ─── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-10 mb-20 px-4">
        <div className="text-left w-full md:w-auto">
           <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-[1.5rem] bg-[#1e3a8a] flex items-center justify-center text-white shadow-xl shadow-blue-200">
                 <ShieldCheck size={26} />
              </div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">Parental Sentinel Mode</p>
                 <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border-2 border-white shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Secure Link: {studentData?.name}</p>
                 </div>
              </div>
           </div>
           <h1 className="text-6xl font-black text-slate-900 tracking-tighter leading-none mb-4">Guardian Pulse</h1>
           <p className="text-xl font-bold text-slate-400 italic">Institutional activity and predictive analytics are synchronized.</p>
        </div>
        
        <div className="flex items-center gap-6 w-full md:w-auto">
           <div className="flex-1 md:flex-none px-12 h-20 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm flex items-center justify-center gap-6 text-base font-black text-slate-700">
              <Calendar className="w-6 h-6 text-[#1e3a8a]"/>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              <span className="text-slate-200">|</span>
              {currentTime.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
           </div>
           <button className="w-20 h-20 bg-[#1e3a8a] rounded-[2.5rem] flex items-center justify-center text-white relative shadow-2xl shadow-blue-900/40 hover:scale-110 active:scale-95 transition-all">
              <Bell className="w-8 h-8"/>
              <div className="absolute top-5 right-5 w-4 h-4 bg-rose-500 rounded-full border-4 border-[#1e3a8a]" />
           </button>
        </div>
      </div>

      {/* ─── KEY PERFORMANCE INDICATORS ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-20 px-2">
         <MetricCard label="Child Attendance" value={liveStats.attendance} icon={Activity} color="emerald" tag="On Track" />
         <MetricCard label="Core Performance" value={liveStats.avgScore} icon={Star} color="indigo" tag="Scholastic" />
         <MetricCard label="Pending Tasks" value={liveStats.pending} icon={FileText} color="amber" tag="Urgent" />
         <MetricCard label="Risk Threshold" value="Clear" icon={ShieldCheck} color="emerald" tag="Safe" />
      </div>

      {/* ─── MAIN INTELLIGENCE GRID ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 px-2">
         
         {/* LEFT: AI PREDICTIVE CARD */}
         <div className="lg:col-span-8 flex flex-col gap-10">
            <div className="bg-gradient-to-br from-[#1e3a8a] to-blue-900 rounded-[4.5rem] p-12 text-white shadow-2xl relative overflow-hidden group min-h-[400px] flex flex-col justify-between">
               <div className="absolute -top-10 -right-10 w-96 h-96 bg-white/10 rounded-full blur-[100px] group-hover:scale-125 transition-transform duration-1000" />
               <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-400/10 rounded-full blur-[80px]" />
               
               <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-10 bg-white/10 w-fit px-6 py-3 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-md">
                     <BrainCircuit className="w-6 h-6 text-blue-200" />
                     <span className="text-[11px] font-black uppercase tracking-[0.3em] text-blue-100">Neural Predictive Narrative</span>
                  </div>
                  
                  {isAnalyzing ? (
                     <div className="py-6 space-y-6">
                        <div className="h-12 bg-white/10 rounded-[2rem] w-3/4 animate-pulse" />
                        <div className="h-12 bg-white/10 rounded-[2rem] w-1/2 animate-pulse" />
                     </div>
                  ) : (
                     <h2 className="text-4xl lg:text-5xl font-black leading-[1.15] drop-shadow-2xl italic tracking-tighter">
                        "{aiInsights?.child_summary_narrative || `${studentData?.name} is successfully fulfilling all institutional requirements. A detailed academic narrative will populate as soon as the next audit cycle is finalized.`}"
                     </h2>
                  )}
               </div>

               <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-8 pt-10">
                  <div className="flex -space-x-4">
                     {[1,2,3].map(i => <div key={i} className="w-14 h-14 rounded-2xl border-4 border-[#1e3a8a] bg-white/10 flex items-center justify-center backdrop-blur-lg"><User className="text-white opacity-20" /></div>)}
                     <div className="w-14 h-14 rounded-2xl border-4 border-[#1e3a8a] bg-emerald-500 flex items-center justify-center text-white font-black text-xs shadow-xl shadow-emerald-900/40">+12</div>
                  </div>
                  <button onClick={() => navigate('/performance')} className="w-full sm:w-auto px-12 h-20 bg-white text-[#1e3a8a] rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-2xl">
                     Scholastic Audit <ArrowUp className="inline-block w-5 h-5 ml-3 rotate-45" />
                  </button>
               </div>
            </div>

            {/* TWIN INSIGHTS: HIGHLIGHTS & SUMMARY */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="bg-white border border-slate-100 rounded-[4rem] p-12 shadow-sm flex flex-col hover:shadow-2xl transition-all group">
                  <div className="flex items-center justify-between mb-10">
                     <div className="w-16 h-16 rounded-[2rem] bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner group-hover:rotate-12 transition-transform">
                        <TrendingUp size={30} />
                     </div>
                     <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-5 py-2 rounded-full uppercase tracking-widest">Growth</span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-6 tracking-tight">Weekly Highlights</h3>
                  <div className="space-y-4">
                     {aiInsights?.weekly_digest?.highlights?.map((h: string, i: number) => (
                        <div key={i} className="flex gap-5 items-start p-6 bg-slate-50 rounded-[2.5rem] group/item hover:bg-emerald-50/50 transition-colors">
                           <Zap className="w-5 h-5 text-amber-400 mt-1 shrink-0" />
                           <p className="text-sm font-bold text-slate-700 leading-relaxed uppercase tracking-tighter">{h}</p>
                        </div>
                     )) || <p className="text-xs font-bold text-slate-400 uppercase tracking-widest py-10 text-center italic opacity-30">Waiting for weekly audit logs...</p>}
                  </div>
               </div>

               <div className="bg-white border border-slate-100 rounded-[4rem] p-12 shadow-sm flex flex-col hover:shadow-2xl transition-all group border-b-8 border-b-indigo-500">
                  <div className="flex items-center justify-between mb-10">
                     <div className="w-16 h-16 rounded-[2rem] bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner group-hover:scale-110 transition-transform">
                        <MessageSquare size={30} />
                     </div>
                     <button onClick={() => navigate('/teacher-notes')} className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 hover:text-indigo-500 transition-all">
                        <ArrowUp size={24} className="rotate-45" />
                     </button>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-6 tracking-tight">Faculty Observation</h3>
                  <div className="flex-1 bg-slate-50/50 p-8 rounded-[3rem] shadow-inner relative overflow-hidden">
                     <p className="text-lg font-bold text-slate-500 italic leading-relaxed relative z-10">
                        {aiInsights?.weekly_digest?.summary || "The teaching faculty is currently compiling qualitative observations for the current audit phase. Updates will populate automatically."}
                     </p>
                  </div>
               </div>
            </div>
         </div>

         {/* RIGHT: SCHOLASTIC IDENTITY & LOG */}
         <div className="lg:col-span-4 flex flex-col gap-10">
            {/* SCHOLASTIC PROFILE CARD */}
            <div className="bg-white border border-slate-100 rounded-[4rem] p-10 shadow-sm relative overflow-hidden group flex flex-col items-center text-center">
               <div className="absolute top-0 left-0 w-full h-32 bg-[#1e3a8a] group-hover:h-36 transition-all duration-700" />
               <div className="w-32 h-32 rounded-[3rem] bg-white border-8 border-white shadow-2xl mt-12 mb-8 flex items-center justify-center text-slate-200 font-black text-5xl relative z-10 overflow-hidden group/avatar">
                  <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover/avatar:translate-y-0 transition-transform duration-500" />
                  <span className="relative z-20 text-[#1e3a8a] group-hover/avatar:text-white transition-colors">{studentData?.name?.[0] || 'S'}</span>
               </div>
               <h3 className="text-3xl font-black text-slate-800 tracking-tighter mb-2 relative z-10 truncate w-full px-4">{studentData?.name}</h3>
               <div className="flex flex-wrap justify-center gap-2 mb-8 relative z-10">
                  <span className="px-4 py-1.5 bg-indigo-50 text-indigo-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-indigo-100 italic">Grade {studentData?.grade || '8'}</span>
                  <span className="px-4 py-1.5 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-full italic">ID: {studentData?.rollNo || '001'}</span>
               </div>
               
               <div className="w-full grid grid-cols-2 gap-4 pt-8 border-t border-slate-100 relative z-10">
                  <div className="text-left">
                     <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1 pl-2">Parent Guardian</p>
                     <p className="text-sm font-black text-slate-800 truncate px-2">{user?.displayName?.split(' ')[0] || 'Authorized'}</p>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1 pr-2">Subdivision</p>
                     <p className="text-sm font-black text-slate-800 px-2 uppercase tracking-tighter italic">Sec-A Matrix</p>
                  </div>
               </div>
            </div>

            {/* INSTITUTIONAL EVENT LOG */}
            <div className="bg-[#1e3a8a] rounded-[4.5rem] p-12 shadow-2xl flex flex-col flex-1 relative overflow-hidden group">
               <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:scale-150 transition-all duration-1000" />
               <div className="flex items-center justify-between mb-12 relative z-10">
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">Synapse Event Log</h3>
                  <div className="px-4 py-1.5 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full animate-pulse shadow-lg shadow-emerald-900/40">Live Matrix</div>
               </div>

               <div className="space-y-6 flex-1 relative z-10 overflow-y-auto no-scrollbar max-h-[460px]">
                  {recentEvents.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center p-10 text-center opacity-40">
                        <Clock className="w-16 h-16 text-blue-100 mb-6 animate-pulse" />
                        <p className="text-[11px] font-black text-blue-100 uppercase tracking-widest leading-relaxed">Intelligence alerts will populate automatically after subdivision sync.</p>
                     </div>
                  ) : (
                     recentEvents.map(event => (
                        <div key={event.id} className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem] group/event hover:bg-white/10 transition-all cursor-pointer">
                           <div className="flex items-center gap-6">
                              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-white shadow-xl group-hover/event:scale-110 transition-transform">
                                 {event.type === 'result' ? <Star size={24}/> : <CheckCircle size={24}/>}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <p className="text-sm font-black text-white leading-tight mb-2 uppercase tracking-tighter">{event.title}</p>
                                 <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-blue-300 uppercase tracking-widest opacity-60">
                                       {event.time.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                                    </span>
                                    <span className={`text-base font-black ${event.color} drop-shadow-md`}>{event.value}</span>
                                 </div>
                              </div>
                           </div>
                        </div>
                     ))
                  )}
               </div>
               
               <button onClick={() => navigate('/alerts')} className="mt-10 w-full h-16 bg-white/10 border border-white/10 text-white rounded-[1.8rem] text-[11px] font-black uppercase tracking-[0.3em] hover:bg-white hover:text-[#1e3a8a] transition-all relative z-10">
                  Institutional Alerts
               </button>
            </div>
         </div>

      </div>
    </div>
  );
};

const MetricCard = ({ label, value, icon: Icon, color, tag }: any) => (
  <div className="bg-white border border-slate-100 p-10 rounded-[3.5rem] shadow-sm hover:translate-y-[-8px] hover:shadow-2xl transition-all group relative overflow-hidden">
    <div className="absolute -top-10 -right-10 w-32 h-32 bg-slate-50 rounded-full blur-2xl group-hover:bg-slate-100 transition-all" />
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

const EmptyState = ({ icon: Icon, text }: any) => (
  <div className="p-20 border-2 border-dashed border-slate-100 rounded-[3.5rem] bg-white text-center shadow-inner">
    <Icon className="w-16 h-16 text-slate-100 mx-auto mb-6 opacity-40 animate-pulse" />
    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-relaxed italic">{text}</p>
  </div>
);

const FileText = (props:any) => <CheckSquare {...props} />;

export default DashboardPage;
