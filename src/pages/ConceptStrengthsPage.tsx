import React, { useState, useEffect } from "react";
import { 
  CheckCircle, AlertCircle, XCircle, Lightbulb, Sparkles, 
  Calendar, BookOpen, PenTool, HelpCircle, Camera, Loader2,
  ChevronRight, Brain, Zap, PlayCircle, PlusCircle, Info, Rocket, 
  Target, TrendingUp, Users, Activity, Star, ArrowUpRight, GraduationCap
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ParentAIController } from "../ai/controller/ai-controller";
import { useAuth } from "@/lib/AuthContext";

const ConceptStrengthsPage = () => {
  const { studentData } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [intelligence, setIntelligence] = useState<any>(null);
  
  const subjectTabs = ["Mathematics", "Science", "English"];
  const mathData = {
    strong: [
      { topic: "Algebraic Expressions", score: 92 },
      { topic: "Linear Equations", score: 88 }
    ],
    needsWork: [
      { topic: "Trigonometry", score: 68 },
      { topic: "Probability", score: 74 }
    ]
  };

  const chartData = [
    { month: "SEP", algebra: 70, trig: 60 },
    { month: "OCT", algebra: 78, trig: 64 },
    { month: "NOV", algebra: 85, trig: 65 },
    { month: "DEC", algebra: 92, trig: 68 }
  ];

  useEffect(() => {
    const fetchIntelligence = async () => {
      setIsAnalyzing(true);
      try {
        const payload = {
          student_name: studentData?.name || "Scholar",
          subject: subjectTabs[activeTab],
          strengths: mathData.strong,
          weaknesses: mathData.needsWork,
          upcoming_test: "Unit Test Milestone approaching"
        };
        const result = await ParentAIController.getConceptIntelligence(payload);
        if (result.status === "success") setIntelligence(result.data);
      } catch (e) {
        console.error(e);
      } finally {
        setIsAnalyzing(false);
      }
    };
    fetchIntelligence();
  }, [activeTab, studentData?.id]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000 pb-24 text-left font-sans">
      
      {/* ─── HEADER & NAV ─── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-10 mb-20 px-4">
        <div className="text-left w-full md:w-auto">
           <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-[1.5rem] bg-[#1e3a8a] flex items-center justify-center text-white shadow-xl shadow-blue-200">
                 <Brain size={26} />
              </div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">Concept Mastery Hub</p>
                 <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border-2 border-white shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest leading-none">Neural Insights Live</p>
                 </div>
              </div>
           </div>
           <h1 className="text-6xl font-black text-slate-900 tracking-tighter leading-none mb-4">Mastery Matrix</h1>
           <p className="text-xl font-bold text-slate-400 italic">Identifying knowledge gaps and accelerating learning potential via AI.</p>
        </div>
        
        <div className="flex bg-[#f1f5f9] p-2 rounded-[2.5rem] border border-slate-200 w-fit">
          {subjectTabs.map((tab, i) => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(i)}
              className={`px-10 py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all ${
                i === activeTab 
                ? "bg-white text-[#1e3a8a] shadow-xl border border-slate-200 scale-105 z-10" 
                : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 px-2">
         
         {/* LEFT: MASTER STUDY PLAN & ANALYTICS */}
         <div className="lg:col-span-8 flex flex-col gap-12">
            
            {/* AI STUDY PLAN CARD */}
            <div className="bg-white border border-slate-100 rounded-[4.5rem] p-12 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all">
               <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12">
                  <Calendar className="w-48 h-48 text-[#1e3a8a]" />
               </div>
               
               <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-10">
                     <div className="w-14 h-14 rounded-[2rem] bg-indigo-50 flex items-center justify-center text-[#1e3a8a] shadow-inner">
                        <Zap size={28} />
                     </div>
                     <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Mastery Acceleration Plan</h3>
                  </div>

                  {isAnalyzing ? (
                     <div className="space-y-6">
                        <div className="h-12 bg-slate-50 rounded-2xl animate-pulse" />
                        <div className="h-32 bg-slate-50 rounded-2xl animate-pulse" />
                     </div>
                  ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {intelligence?.study_plan?.schedule?.slice(0, 4).map((item: any, idx: number) => (
                           <div key={idx} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 group/plan hover:bg-white hover:shadow-xl transition-all">
                              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-2 italic">{item.day}</p>
                              <h4 className="text-xl font-black text-slate-900 tracking-tighter mb-4 italic uppercase">{item.task}</h4>
                              <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-widest flex items-center gap-2">
                                 <Info size={12} className="text-[#1e3a8a]" /> {item.reason}
                              </p>
                           </div>
                        ))}
                     </div>
                  )}
                  
                  <button className="h-20 w-fit px-12 mt-12 bg-slate-900 text-white rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-slate-900/40 hover:scale-[1.05] transition-all flex items-center gap-4">
                     Download High-Priority Roster <ArrowUpRight size={18} />
                  </button>
               </div>
            </div>

            {/* ANALYTICS CHART */}
            <div className="bg-white border border-slate-100 rounded-[4rem] p-12 shadow-sm">
               <div className="flex items-center justify-between mb-12">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Subdivision Analytics</h3>
                  <div className="flex gap-8">
                     <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Algebra</span></div>
                     <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-rose-500" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trig</span></div>
                  </div>
               </div>
               <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={chartData}>
                        <defs>
                           <linearGradient id="colorA" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                           <linearGradient id="colorT" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={10} fontWeight="black" stroke="#94a3b8" dy={10} />
                        <YAxis axisLine={false} tickLine={false} fontSize={10} fontWeight="black" stroke="#94a3b8" />
                        <Tooltip contentStyle={{ borderRadius: '2rem', border: 'none', fontWeight: 'black' }} />
                        <Area type="monotone" dataKey="algebra" stroke="#10b981" fillOpacity={1} fill="url(#colorA)" strokeWidth={4} />
                        <Area type="monotone" dataKey="trig" stroke="#f43f5e" fillOpacity={1} fill="url(#colorT)" strokeWidth={4} />
                     </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>
         </div>

         {/* RIGHT SIDE: EXPLAINER & DOUBT SOLVER */}
         <div className="lg:col-span-4 flex flex-col gap-12 text-left">
            <div className="bg-gradient-to-br from-indigo-700 to-[#1e3a8a] rounded-[4.5rem] p-12 text-white shadow-2xl relative overflow-hidden group">
               <PlayCircle className="absolute -bottom-12 -right-12 w-48 h-48 text-white/5 group-hover:scale-110 transition-transform duration-1000" />
               <div className="flex items-center gap-4 mb-10 relative z-10">
                  <BookOpen className="w-6 h-6 text-indigo-300" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200">Concept Explainer</h3>
               </div>
               <h3 className="text-3xl font-black leading-[1.1] tracking-tighter mb-8 italic relative z-10">Frictionless analogies for complex topics.</h3>
               <div className="relative z-10">
                  <input type="text" placeholder="e.g. Try 'Photosynthesis'..." className="w-full h-16 bg-white/10 border border-white/20 rounded-[1.8rem] px-8 py-2 text-sm placeholder:text-white/30 focus:outline-none focus:bg-white/20 focus:ring-4 ring-white/10 transition-all font-bold" />
                  <button className="absolute right-3 top-3 h-10 px-6 bg-white text-[#1e3a8a] rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Inquire</button>
               </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[4.5rem] p-12 shadow-sm relative overflow-hidden group">
               <div className="flex items-center gap-4 mb-10">
                  <div className="w-12 h-12 rounded-[1.5rem] bg-rose-50 flex items-center justify-center text-rose-500 shadow-inner">
                     <AlertCircle size={24} />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Critical Focus</h3>
               </div>
               
               <div className="space-y-6">
                  {mathData.needsWork.map((t) => (
                    <div key={t.topic} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-50 group/item hover:bg-white hover:shadow-xl transition-all">
                       <div className="flex justify-between items-center mb-4">
                          <h4 className="text-base font-black text-slate-900 tracking-tight italic uppercase">{t.topic}</h4>
                          <span className="text-sm font-black text-rose-500 italic">{t.score}%</span>
                       </div>
                       <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-rose-500" style={{width: `${t.score}%`}} />
                       </div>
                       <button className="mt-6 flex items-center gap-2 text-[9px] font-black uppercase text-indigo-600 tracking-widest opacity-0 group-hover/item:opacity-100 transition-opacity">
                          <PlusCircle size={14} /> Commit Practice Drill
                       </button>
                    </div>
                  ))}
               </div>
               
               <div className="mt-10 p-8 bg-amber-50 rounded-[2.5rem] border border-amber-100 italic relative overflow-hidden group/tip">
                  <div className="absolute top-0 right-0 p-4 opacity-5"><Lightbulb size={40}/></div>
                  <p className="relative z-10 text-[11px] font-bold text-amber-900/70 leading-relaxed uppercase tracking-widest">
                     Strategic Insight: {intelligence?.concept_explainer?.explanation || "Logical foundational shifts are required in Trigonometry to secure upcoming curriculum milestones."}
                  </p>
               </div>
            </div>

            <div className="bg-slate-900 rounded-[4.5rem] p-12 text-white shadow-2xl relative overflow-hidden group">
               <Rocket className="absolute -bottom-6 -right-6 w-32 h-32 text-white/5" />
               <div className="flex items-center gap-4 mb-10 relative z-10">
                  <Camera className="w-6 h-6 text-[#1e3a8a] animate-pulse" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Tactical Doubts</h3>
               </div>
               <div className="h-40 bg-white/5 border-2 border-dashed border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center group-hover:bg-white/10 transition-all relative z-10">
                  <PlusCircle size={32} className="text-white/20 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Snap & Resolve Doubt</p>
               </div>
            </div>
         </div>

      </div>
    </div>
  );
};

export default ConceptStrengthsPage;
