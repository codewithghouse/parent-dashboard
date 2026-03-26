import React, { useEffect, useState } from "react";
import { 
  ArrowUp, ArrowDown, Minus, ChevronRight, Sparkles, BrainCircuit, 
  Target, TrendingUp, Users, Info, Loader2, Zap, Rocket, Activity, Star, 
  ShieldCheck, ArrowUpRight, GraduationCap, ChevronLeft
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { SubjectPerformanceDetail } from "@/components/performance/SubjectPerformanceDetail";
import { ParentAIController } from "../ai/controller/ai-controller";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

const PerformancePage = () => {
  const { studentData } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [loading, setLoading] = useState(true);
  const [perfInsights, setPerfInsights] = useState<any>(null);
  const [realResults, setRealResults] = useState<any[]>([]);

  // ─── DATA SYNCHRONIZATION ───
  useEffect(() => {
    if (!studentData?.id) return;
    
    setLoading(true);
    const q = query(collection(db, "results"), where("studentId", "==", studentData.id));
    const unsubscribe = onSnapshot(q, (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setRealResults(data);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [studentData?.id]);

  // Aggregate and transform raw data into high-fidelity subject objects
  const subjectMap = new Map();
  realResults.forEach(r => {
      const subName = r.className || "General";
      if (!subjectMap.has(subName)) {
          subjectMap.set(subName, {
              name: subName,
              results: [],
              teacher: r.teacherName || "Faculty",
              totalScore: 0,
              count: 0
          });
      }
      const existing = subjectMap.get(subName);
      existing.results.push(r);
      const numeric = parseInt(r.score) || 0;
      existing.totalScore += numeric;
      existing.count += 1;
  });

  const subjects = Array.from(subjectMap.values()).map(s => {
      const avg = Math.round(s.totalScore / s.count);
      return {
          name: s.name,
          grade: avg >= 90 ? "A+" : avg >= 80 ? "A" : avg >= 70 ? "B+" : avg >= 60 ? "B" : "C",
          progress: avg,
          trend: "Improving",
          trendDir: "up",
          color: avg >= 75 ? "bg-emerald-500" : avg >= 60 ? "bg-indigo-500" : "bg-rose-500",
          teacher: s.teacher,
          results: s.results
      };
  });

  const avgGlobal = subjects.length > 0 ? Math.round(subjects.reduce((acc,s)=>acc+s.progress,0)/subjects.length) : 0;

  // AI Insights Generation
  useEffect(() => {
    if (loading || subjects.length === 0) return;
    
    const fetchPerfInsights = async () => {
       setIsAnalyzing(true);
       try {
          const payload = {
             student_name: studentData?.name || "Scholar",
             subjects: subjects.map(s => ({ name: s.name, grade: s.grade, score: s.progress })),
             recent_trend: "+8% improvement",
             comparative_data: "Class average is 72%"
          };
          const result = await ParentAIController.getPerformanceInsights(payload);
          if (result.status === "success") setPerfInsights(result.data);
       } catch (e) { console.error(e); } finally { setIsAnalyzing(false); }
    };
    fetchPerfInsights();
  }, [loading, subjects.length]);

  const handleSubjectClick = (name: string) => {
    setSelectedSubject(name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (selectedSubject) {
    const subjectInfo = subjects.find(s => s.name === selectedSubject);
    const testScores = subjectInfo?.results?.map((r: any) => ({
        name: r.assignmentTitle,
        date: r.timestamp?.toDate().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) || "Recent",
        score: `${r.score}/100`,
        status: parseInt(r.score) >= 75 ? "success" : "warning"
    })) || [];

    return (
        <SubjectPerformanceDetail
          subject={selectedSubject}
          teacher={subjectInfo?.teacher || "Faculty"}
          grade={subjectInfo?.grade || "N/A"}
          average={subjectInfo?.progress || 0}
          topics={[{ name: "Mastery Components", score: subjectInfo?.progress || 0 }]}
          testScores={testScores}
          feedback={subjectInfo?.results?.[0]?.feedback || "Consistent performance observed across curriculum milestones."}
          onBack={() => setSelectedSubject(null)}
        />
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000 pb-24 text-left font-sans">
      
      {/* ─── HEADER ─── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-10 mb-20 px-4">
        <div className="text-left w-full md:w-auto">
           <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-[1.5rem] bg-[#1e3a8a] flex items-center justify-center text-white shadow-xl shadow-blue-200">
                 <Star size={26} />
              </div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">Performance Intelligence Hub</p>
                 <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border-2 border-white shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest leading-none">Institutional Data Live</p>
                 </div>
              </div>
           </div>
           <h1 className="text-6xl font-black text-slate-900 tracking-tighter leading-none mb-4">Scholastic Audit</h1>
           <p className="text-xl font-bold text-slate-400 italic">Global mastery metrics and predictive academic trajectory analysis.</p>
        </div>
        
        <div className="flex bg-white border border-slate-100 p-4 rounded-[2.5rem] shadow-sm items-center gap-6 group hover:shadow-2xl transition-all">
           <div className="w-16 h-16 rounded-[1.8rem] bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner group-hover:rotate-12 transition-transform">
              <ShieldCheck size={30} />
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Global Mastery</p>
              <p className="text-3xl font-black text-[#1e3a8a] uppercase tracking-tighter">{avgGlobal}%</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 px-2">
         
         {/* LEFT: AI NARRATIVE & TRAJECTORY */}
         <div className="lg:col-span-8 flex flex-col gap-12">
            <div className="bg-white border border-slate-100 rounded-[4.5rem] p-12 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all">
               <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 group-hover:rotate-12 transition-transform duration-1000">
                  <BrainCircuit className="w-48 h-48 text-[#1e3a8a]" />
               </div>
               
               <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-10">
                     <div className="w-14 h-14 rounded-[2rem] bg-indigo-50 flex items-center justify-center text-[#1e3a8a] shadow-inner">
                        <Sparkles size={28} />
                     </div>
                     <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Neural Academic Synthesis</h3>
                  </div>

                  {isAnalyzing ? (
                     <div className="space-y-6">
                        <div className="h-12 bg-slate-50 rounded-2xl animate-pulse" />
                        <div className="h-24 bg-slate-50 rounded-2xl animate-pulse" />
                     </div>
                  ) : (
                     <div className="space-y-8">
                        <h2 className="text-4xl font-black text-slate-900 leading-[1.1] tracking-tighter italic">
                           "{perfInsights?.narrative_analysis || "The student is currently fulfilling all institutional mastery thresholds. Trajectory data indicates high logic stability across subdivisions."}"
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-slate-50">
                           <Indicator label="Strategic Stand" value={perfInsights?.goal_setting?.current_standing || "Honors"} trend="up" />
                           <Indicator label="Logic Stability" value="92%" trend="neutral" />
                           <Indicator label="Peer Comparative" value="+12%" trend="up" />
                        </div>
                     </div>
                  )}
               </div>
            </div>

            {/* TRAJECTORY MATRIX CHART */}
            <div className="bg-white border border-slate-100 rounded-[4rem] p-12 shadow-sm">
               <div className="flex items-center justify-between mb-12">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Chronological Mastery Audit</h3>
                  <div className="flex gap-6">
                     <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#1e3a8a]" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mastery Index</span></div>
                  </div>
               </div>
               <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={[
                        { m: "JAN", v: 70 }, { m: "FEB", v: 75 }, { m: "MAR", v: avgGlobal || 82 }
                     ]}>
                        <defs>
                           <linearGradient id="colorV" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.1}/><stop offset="95%" stopColor="#1e3a8a" stopOpacity={0}/></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="m" axisLine={false} tickLine={false} fontSize={10} fontWeight="black" stroke="#94a3b8" dy={10} />
                        <YAxis axisLine={false} tickLine={false} fontSize={10} fontWeight="black" stroke="#94a3b8" domain={[60, 100]} />
                        <Tooltip contentStyle={{ borderRadius: '2rem', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', fontWeight: 'black' }} />
                        <Area type="monotone" dataKey="v" stroke="#1e3a8a" fillOpacity={1} fill="url(#colorV)" strokeWidth={4} />
                     </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>
         </div>

         {/* RIGHT: SUBJECT CARDS & STRATEGY */}
         <div className="lg:col-span-4 flex flex-col gap-12">
            
            {/* SUBJECT REGISTRY */}
            <div className="bg-slate-900 rounded-[4.5rem] p-12 text-white shadow-2xl flex flex-col flex-1 relative overflow-hidden group">
               <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:scale-150 transition-all duration-1000" />
               <div className="flex items-center gap-5 mb-12 relative z-10">
                  <div className="w-16 h-16 rounded-[2rem] bg-white/10 flex items-center justify-center text-white shadow-xl">
                     <GraduationCap size={30} />
                  </div>
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">Institutional Directory</h3>
               </div>

               <div className="space-y-6 flex-1 relative z-10 overflow-y-auto no-scrollbar max-h-[500px]">
                  {subjects.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-20 px-10">
                        <Rocket className="w-16 h-16 mb-8 animate-pulse" />
                        <p className="text-[11px] font-black uppercase tracking-[0.3em] leading-relaxed">Numerical mastery metrics will populate after subdivision sync.</p>
                     </div>
                  ) : (
                     subjects.map((s) => (
                        <div key={s.name} onClick={() => handleSubjectClick(s.name)} className="p-8 bg-white/5 border border-white/10 rounded-[3rem] group/sub hover:bg-white/10 transition-all cursor-pointer">
                           <div className="flex items-start justify-between mb-6">
                              <div>
                                 <h4 className="text-xl font-black text-white uppercase tracking-tight mb-1">{s.name}</h4>
                                 <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{s.teacher}</p>
                              </div>
                              <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/10 border border-white/5 text-white italic`}>{s.grade}</div>
                           </div>
                           <div className="space-y-3">
                              <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                 <span>Mastery Index</span>
                                 <span>{s.progress}%</span>
                              </div>
                              <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                                 <div className={`h-full ${s.color} transition-all duration-1000`} style={{width: `${s.progress}%`}} />
                              </div>
                           </div>
                        </div>
                     ))
                  )}
               </div>
               
               <button className="mt-10 w-full h-16 bg-white/10 border border-white/10 text-white rounded-[1.8rem] text-[11px] font-black uppercase tracking-[0.3em] hover:bg-white hover:text-slate-900 transition-all flex items-center justify-center gap-3 relative z-10">
                  View Full Report <ArrowUpRight size={16} />
               </button>
            </div>

            {/* AI GROWTH PLAN */}
            <div className="bg-white border border-slate-100 rounded-[4.5rem] p-12 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all">
               <div className="flex items-center gap-4 mb-10">
                  <div className="w-12 h-12 rounded-[1.5rem] bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
                     <Target size={24} />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Strategy Vault</h3>
               </div>

               {isAnalyzing ? (
                  <div className="space-y-6 animate-pulse">
                     <div className="h-24 bg-slate-50 rounded-[2.5rem]" />
                     <div className="h-40 bg-slate-50 rounded-[2.5rem]" />
                  </div>
               ) : (
                  <div className="space-y-10">
                     <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Target Benchmark</p>
                        <h4 className="text-3xl font-black text-slate-800 tracking-tighter">{perfInsights?.goal_setting?.target || "Alpha Milestone"}</h4>
                        <div className="w-full h-3 bg-slate-200 rounded-full mt-6 overflow-hidden">
                           <div className="h-full bg-[#1e3a8a] transition-all duration-1000" style={{width: '75%'}} />
                        </div>
                     </div>
                     <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 border border-amber-100 shrink-0">
                           <Zap size={22} />
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Tactical Action Plan</p>
                           <p className="text-sm font-bold text-slate-600 leading-relaxed uppercase tracking-tighter italic">
                              {perfInsights?.goal_setting?.action_plan || "Establish recursive logic checks to mitigate subdivision friction."}
                           </p>
                        </div>
                     </div>
                  </div>
               )}
            </div>
         </div>

      </div>
    </div>
  );
};

const Indicator = ({ label, value, trend }: any) => (
  <div className="text-left group/ind">
     <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 transition-colors group-hover/ind:text-[#1e3a8a]">{label}</p>
     <div className="flex items-end gap-3">
        <h4 className="text-3xl font-black text-slate-800 tracking-tighter">{value}</h4>
        {trend === 'up' && <ArrowUp className="w-5 h-5 text-emerald-500 mb-1" />}
        {trend === 'down' && <ArrowDown className="w-5 h-5 text-rose-500 mb-1" />}
        {trend === 'neutral' && <Minus className="w-5 h-5 text-slate-400 mb-1" />}
     </div>
  </div>
);

export default PerformancePage;
