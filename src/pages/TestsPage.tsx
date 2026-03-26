import React, { useState, useEffect } from "react";
import { 
  Calendar, CheckCircle, Clock, ChevronRight, Filter, 
  Sparkles, BrainCircuit, Rocket, Zap, Info, Loader2,
  Award, BarChart3, TrendingUp, Star, ShieldCheck, ArrowUpRight, GraduationCap
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { ParentAIController } from "../ai/controller/ai-controller";

const TestsPage = () => {
  const { studentData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [aiNarrative, setAiNarrative] = useState<string>("");

  useEffect(() => {
    if (!studentData?.id) return;

    setLoading(true);
    const q = query(
      collection(db, "test_scores"),
      where("studentId", "==", studentData.id),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
      setTestResults(results);
      setLoading(false);
    }, (error) => {
      console.error("Grades Sync Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [studentData?.id]);

  useEffect(() => {
    if (loading || testResults.length === 0) return;
    const fetchAi = async () => {
       setAnalyzingAi(true);
       const res = await ParentAIController.getPerformanceInsights({
          student_name: studentData.name,
          subjects: testResults.slice(0, 3).map(t => ({ name: t.testName, score: t.score })),
          recent_trend: "Stable Achievement Index"
       });
       if (res.status === "success") setAiNarrative(res.data.narrative_analysis);
       setAnalyzingAi(false);
    };
    fetchAi();
  }, [loading, testResults.length]);

  const totalPoints = testResults.reduce((sum, t) => sum + (t.score || 0), 0);
  const maxPointsPossible = testResults.reduce((sum, t) => sum + (t.maxScore || 0), 0);
  const globalPct = maxPointsPossible > 0 ? Math.round((totalPoints / maxPointsPossible) * 100) : 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000 pb-24 text-left font-sans">
      
      {/* ─── HEADER ─── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-10 mb-20 px-4">
        <div className="text-left w-full md:w-auto">
           <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-[1.5rem] bg-[#1e3a8a] flex items-center justify-center text-white shadow-xl shadow-blue-200">
                 <Award size={26} />
              </div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">Scholastic Registry Matrix</p>
                 <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border-2 border-white" />
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest leading-none">Scores Synchronized</p>
                 </div>
              </div>
           </div>
           <h1 className="text-6xl font-black text-slate-900 tracking-tighter leading-none mb-4">Assessment Roster</h1>
           <p className="text-xl font-bold text-slate-400 italic">Historical audit of tests, quizzes and institutional grade records.</p>
        </div>
        
        <div className="flex bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm items-center gap-6 group hover:shadow-2xl transition-all">
           <div className="w-16 h-16 rounded-[1.8rem] bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#1e3a8a] shadow-inner group-hover:rotate-12 transition-transform">
              <TrendingUp size={30} />
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Mastery Index</p>
              <p className="text-4xl font-black text-[#1e3a8a] tracking-tighter italic">{globalPct}%</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 px-2">
         
         {/* LEFT: RESULTS FEED */}
         <div className="lg:col-span-8 flex flex-col gap-12">
            
            {/* AI HERO CARD */}
            <div className="bg-gradient-to-br from-[#1e3a8a] to-blue-900 rounded-[4.5rem] p-12 text-white shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 group-hover:rotate-12 transition-transform duration-1000">
                  <Star className="w-48 h-48" />
               </div>
               <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-10">
                     <span className="px-6 py-2 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-white/20 italic">
                        Achievement Sweep: Active
                     </span>
                  </div>
                  <h2 className="text-5xl font-black tracking-tighter leading-[1.1] mb-8 max-w-2xl italic">
                     {analyzingAi ? "Synthesizing scholastic growth metrics..." : (aiNarrative || `Academically, ${studentData?.name} is maintaining a robust engagement rhythm across all scholastic subdivisions.`)}
                  </h2>
                  <div className="flex flex-wrap gap-6 border-t border-white/10 pt-10">
                     <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem]">
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-2">Authenticated Points</p>
                        <p className="text-3xl font-black">{totalPoints} <span className="text-lg opacity-40">/ {maxPointsPossible}</span></p>
                     </div>
                     <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem]">
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-2">Registry Logs</p>
                        <p className="text-3xl font-black">{testResults.length} <span className="text-lg opacity-40">Milestones</span></p>
                     </div>
                  </div>
               </div>
            </div>

            {/* RESULTS LIST */}
            <div className="space-y-6">
               <div className="flex items-center justify-between px-6 mb-4">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.3em] flex items-center gap-4">
                     <BarChart3 className="w-6 h-6 text-[#1e3a8a]" /> Registry Log
                  </h3>
                  <button className="h-14 px-8 bg-white border border-slate-100 rounded-2xl text-[10px] font-black text-[#1e3a8a] uppercase tracking-widest shadow-sm hover:shadow-xl transition-all flex items-center gap-3">
                     Export Transcript <ArrowUpRight size={14} />
                  </button>
               </div>

               {loading ? (
                  <div className="py-40 flex flex-col items-center justify-center bg-white border border-slate-100 rounded-[4rem]">
                     <Loader2 className="w-16 h-16 text-indigo-200 animate-spin mb-8" />
                     <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Compiling Records...</p>
                  </div>
               ) : testResults.length === 0 ? (
                  <div className="py-40 flex flex-col items-center justify-center text-center bg-white border border-slate-100 rounded-[4rem] px-12">
                     <div className="w-24 h-24 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-inner">
                        <GraduationCap className="text-slate-100 w-12 h-12" />
                     </div>
                     <h4 className="text-2xl font-black text-slate-900 tracking-tighter mb-4">Clean Academic Slate</h4>
                     <p className="text-sm font-bold text-slate-400 max-w-sm uppercase tracking-widest leading-relaxed">The roster will populate automatically after subdivision milestones are reached.</p>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 gap-6">
                  {testResults.map((test) => (
                    <div key={test.id} className="bg-white rounded-[3.5rem] border border-slate-100 p-10 flex flex-col md:flex-row md:items-center justify-between gap-10 hover:shadow-2xl hover:translate-y-[-4px] transition-all group">
                       <div className="flex items-center gap-8">
                          <div className="w-20 h-20 rounded-[2.2rem] bg-slate-50 border border-slate-100 flex items-center justify-center text-[#1e3a8a] shadow-inner group-hover:bg-[#1e3a8a] group-hover:text-white transition-all">
                             <CheckCircle size={32} />
                          </div>
                          <div>
                             <h4 className="text-2xl font-black text-slate-900 tracking-tighter mb-2 italic uppercase">{test.testName}</h4>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2 italic">
                                {test.timestamp?.toDate().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) || "Recent Sync"} <div className="w-1 h-1 rounded-full bg-slate-300" /> Grade {test.grade || 'N/A'}
                             </p>
                          </div>
                       </div>
                       <div className="flex items-center gap-12 bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-50 group-hover:bg-white transition-all">
                          <div className="text-right">
                             <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1 leading-none">Scored</p>
                             <p className="text-3xl font-black text-slate-900 tracking-tighter">{test.isAbsent ? "ABSENT" : `${test.score}/${test.maxScore}`}</p>
                          </div>
                          {!test.isAbsent && (
                             <div className="h-16 w-px bg-slate-100" />
                          )}
                          {!test.isAbsent && (
                             <div className="text-center">
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1 leading-none">Index</p>
                                <p className="text-3xl font-black text-emerald-500 tracking-tighter">{test.percentage?.toFixed(0)}%</p>
                             </div>
                          )}
                       </div>
                    </div>
                  ))}
                  </div>
               )}
            </div>
         </div>

         {/* RIGHT SIDE: MASTERY RADAR & AI PROMPTS */}
         <div className="lg:col-span-4 flex flex-col gap-12 text-left">
            <div className="bg-white border border-slate-100 rounded-[4.5rem] p-12 shadow-sm relative overflow-hidden group flex flex-col min-h-[500px]">
               <div className="absolute -top-10 -right-10 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-50" />
               <div className="flex items-center gap-4 mb-12 relative z-10">
                  <div className="w-12 h-12 rounded-[1.5rem] bg-indigo-50 flex items-center justify-center text-[#1e3a8a] shadow-inner">
                     <BrainCircuit size={24} />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Topic Mastery Radar</h3>
               </div>

               <div className="space-y-10 flex-1 relative z-10">
                  {testResults.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-20 px-8">
                        <Info className="w-16 h-16 mb-8" />
                        <p className="text-[11px] font-black uppercase tracking-[0.3em] leading-relaxed">Neural processing remains dormant until subdivision roster data is available.</p>
                     </div>
                  ) : (
                     testResults.slice(0, 4).map((t, idx) => (
                        <div key={idx} className="space-y-4">
                           <div className="flex items-center justify-between">
                              <p className="text-[11px] font-black text-slate-800 uppercase tracking-tighter truncate mr-4 italic">{t.testName}</p>
                              <span className="text-lg font-black text-[#1e3a8a] tracking-tighter">{t.percentage?.toFixed(0)}%</span>
                           </div>
                           <div className="w-full h-3 bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-indigo-500 to-[#1e3a8a] transition-all duration-1000 shadow-[0_0_10px_rgba(30,58,138,0.2)]" style={{ width: `${t.percentage || 0}%` }} />
                           </div>
                        </div>
                     ))
                  )}
               </div>

               <button className="h-20 w-full mt-12 bg-[#1e3a8a] text-white rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-blue-900/40 hover:scale-[1.02] transition-all relative z-10 group/btn">
                  Generate Full Analytics <ArrowUpRight className="inline-block ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" size={16} />
               </button>
            </div>

            <div className="bg-slate-900 rounded-[4.5rem] p-12 text-white shadow-2xl relative overflow-hidden group">
               <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:scale-150 transition-all duration-1000" />
               <div className="flex items-center gap-4 mb-10 relative z-10">
                  <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Preparation Engine</h3>
               </div>
               <h3 className="text-3xl font-black leading-[1.1] tracking-tighter mb-8 italic relative z-10">Neural study loops can be generated for upcoming assessments.</h3>
               <button className="w-full h-16 bg-white/10 hover:bg-white text-white hover:text-slate-900 border border-white/20 rounded-[1.8rem] text-[11px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 relative z-10 group/zap">
                  <Zap size={20} className="text-amber-400 group-hover:text-amber-500 transition-colors" /> Start Revision Cycle
               </button>
            </div>
         </div>

      </div>
    </div>
  );
};

export default TestsPage;
