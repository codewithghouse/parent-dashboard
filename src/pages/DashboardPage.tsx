import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { 
  CheckCircle, AlertCircle, Calendar, Star, ArrowUp, Clock, CheckSquare, 
  Sparkles, BrainCircuit, Rocket, Zap, MessageSquare, Loader2, Info
} from "lucide-react";
import { ParentAIController } from "../ai/controller/ai-controller";

const DashboardPage = () => {
  const { studentData, user } = useAuth();
  const navigate = useNavigate();
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  useEffect(() => {
    const fetchAIInsights = async () => {
      if (!studentData) return;
      
      setIsAnalyzing(true);
      try {
        // Collect real metrics for the AI to analyze
        const context = {
          child_name: studentData.name || "Aditya",
          attendance: studentData.attendance || "94%",
          academic_health: "85%", // Static for now, would be calculated from real scores
          recent_grade: "A-",
          pending_assignments: 2,
          upcoming_tests: 3,
          grade: studentData.grade || studentData.class || "8"
        };

        const result = await ParentAIController.getDashboardInsights(context);
        
        if (result.status === "success") {
          setAiInsights(result.data);
          setErrorNotice(null);
        } else {
          setErrorNotice(result.message);
        }
      } catch (err) {
        console.error("Failed to fetch parent AI insights:", err);
        setErrorNotice("AI Intelligence wing is synchronizing. Please check back in a moment.");
      } finally {
        setIsAnalyzing(false);
      }
    };

    fetchAIInsights();
  }, [studentData]);

  return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-700">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Good Morning, {user?.displayName?.split(' ')[0] || "Parent"}! 👋
            </h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px] mt-1">
              Active Monitoring for {studentData?.name || "Aditya"} • Grade {studentData?.grade || studentData?.class || "8"}
            </p>
          </div>
          <div className="flex items-center gap-3">
             <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">AI Core Active</span>
             </div>
          </div>
        </div>

        {/* AI PREDICTIVE BRAIN - Main Feature container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
           
           {/* Left: AI Summary & Weekly Digest */}
           <div className="lg:col-span-8 flex flex-col gap-6">
              
              {/* FEATURE 1: AI Child Summary Narrative */}
              <div className="bg-gradient-to-r from-indigo-600 to-blue-700 rounded-[2rem] p-8 text-white shadow-xl shadow-indigo-200 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-1000"></div>
                 <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                       <Rocket className="w-5 h-5 text-indigo-200" />
                       <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100">Live Status Intelligence</span>
                    </div>
                    {isAnalyzing ? (
                       <div className="flex items-center gap-3">
                          <Loader2 className="w-6 h-6 animate-spin text-white" />
                          <h2 className="text-xl font-bold opacity-80 italic">Synthesizing latest scholarly records...</h2>
                       </div>
                    ) : aiInsights ? (
                       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                           <h2 className="text-2xl font-black leading-tight drop-shadow-sm flex-1">
                              "{aiInsights.child_summary_narrative}"
                           </h2>
                           <button
                             onClick={() => navigate('/performance')}
                             className="shrink-0 px-8 py-4 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/30 transition-all flex items-center gap-2"
                           >
                              Deep Analysis <ArrowUp className="w-4 h-4 rotate-45" />
                           </button>
                        </div>
                    ) : (
                       <h2 className="text-lg font-bold opacity-80">{errorNotice || "Waiting for latest academic heartbeat..."}</h2>
                    )}
                 </div>
              </div>

              {/* FEATURE 2: Weekly AI Report (Digest) */}
              <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 shadow-sm flex flex-col md:flex-row gap-8 hover:shadow-md transition-shadow">
                 <div className="md:w-1/2">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                           <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                              <CheckCircle className="w-6 h-6" />
                           </div>
                           <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Weekly Success Pulse</h3>
                        </div>
                        <button onClick={() => navigate('/attendance')} className="p-2 text-slate-300 hover:text-emerald-500 transition-colors">
                           <ArrowUp className="w-4 h-4 rotate-45" />
                        </button>
                     </div>
                    <div className="space-y-4">
                       {isAnalyzing ? (
                          [1,2].map(i => <div key={i} className="h-10 bg-slate-50 rounded-xl animate-pulse" />)
                       ) : aiInsights?.weekly_digest?.highlights?.map((h: string, i: number) => (
                          <div key={i} className="flex gap-4 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 shadow-sm">
                             <Zap className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                             <p className="text-sm font-bold text-emerald-900 leading-snug">{h}</p>
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className="md:w-1/2 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                           <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                              <MessageSquare className="w-6 h-6" />
                           </div>
                           <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">AI Weekly Summary</h3>
                        </div>
                        <button onClick={() => navigate('/teacher-notes')} className="p-2 text-slate-300 hover:text-indigo-500 transition-colors">
                           <ArrowUp className="w-4 h-4 rotate-45" />
                        </button>
                     </div>
                    <div className="bg-slate-50/80 border border-slate-100 p-6 rounded-[2rem] flex-1 min-h-[140px]">
                       {isAnalyzing ? (
                          <div className="space-y-2">
                             <div className="h-4 bg-slate-100 rounded w-full animate-pulse" />
                             <div className="h-4 bg-slate-100 rounded w-5/6 animate-pulse" />
                             <div className="h-4 bg-slate-100 rounded w-4/6 animate-pulse" />
                          </div>
                       ) : (
                          <p className="text-sm font-medium text-slate-600 leading-relaxed italic border-l-4 border-indigo-400 pl-5">
                             {aiInsights?.weekly_digest?.summary || "Great week! No special interventions required. Review Math once before the upcoming quiz."}
                          </p>
                       )}
                    </div>
                 </div>
              </div>

           </div>

           {/* Right: Parenting Tips */}
           <div className="lg:col-span-4 flex flex-col">
              {/* FEATURE 3: AI Parenting Tips */}
              <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 shadow-sm h-full flex flex-col hover:border-indigo-100 transition-colors">
                 <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-sm">
                       <BrainCircuit className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Cognitive Tips for Parents</h3>
                 </div>
                 
                 <div className="space-y-5 flex-1">
                    {isAnalyzing ? (
                       [1,2,3].map(i => <div key={i} className="h-24 bg-slate-50 rounded-[2rem] animate-pulse" />)
                    ) : aiInsights?.parenting_tips?.map((tip: any, i: number) => (
                       <div key={i} className="bg-white p-6 rounded-[2rem] border-2 border-slate-50 shadow-sm group hover:border-amber-100 transition-all">
                          <div className="flex items-center gap-2 mb-3">
                             <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                             <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Smart Strategy</h4>
                          </div>
                          <p className="text-sm font-bold text-slate-800 leading-tight mb-2">{tip.tip}</p>
                          <p className="text-[11px] font-bold text-slate-400 leading-tight">{tip.reason}</p>
                       </div>
                    ))}
                    {!isAnalyzing && !aiInsights?.parenting_tips && (
                       <div className="text-center py-10">
                          <Info className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                          <p className="text-xs font-bold text-slate-400">Tips will populate as behavioral data syncs.</p>
                       </div>
                    )}
                 </div>

                 <button className="mt-8 w-full py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                    View Holistic Strategy
                 </button>
              </div>
           </div>

        </div>

        {/* Existing Stats Row (Maintained but polished) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-4">
          <StatCard icon={<CheckCircle className="w-5 h-5 text-emerald-500" />} iconBg="bg-emerald-50 border-emerald-100" label="Attendance" value="94%" sub="Stable Trajectory" subColor="text-emerald-600" />
          <StatCard icon={<AlertCircle className="w-5 h-5 text-amber-500" />} iconBg="bg-amber-50 border-amber-100" label="Pending Work" value="2" sub="Tasks Due Soon" subColor="text-amber-600" />
          <StatCard icon={<Calendar className="w-5 h-5 text-blue-500" />} iconBg="bg-blue-50 border-blue-100" label="Upcoming Tests" value="3" sub="Next 7 Days" subColor="text-blue-600" />
          <StatCard icon={<Star className="w-5 h-5 text-indigo-500" />} iconBg="bg-indigo-50 border-indigo-100" label="Academic Health" value="85%" sub="Mathematics Flow" subColor="text-indigo-600" />
        </div>

        {/* Improved Bottom Info Row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Student Info Card */}
          <div className="lg:col-span-3 bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center gap-6 mb-8 border-b border-slate-50 pb-8">
              <div className="w-20 h-20 rounded-[2rem] bg-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-lg ring-8 ring-indigo-50">
                {studentData?.name?.[0] || "S"}
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800 leading-none mb-2">{studentData?.name || "Aditya Verma"}</h3>
                <div className="flex flex-wrap gap-2">
                   <span className="px-3 py-1 bg-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-200">Grade {studentData?.grade || "8"}</span>
                   <span className="px-3 py-1 bg-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-200">ID: SR-{studentData?.rollNo || "001"}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8">
               <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Parent / Guardian</p>
                  <p className="text-sm font-black text-slate-700">{user?.displayName || "Authorized User"}</p>
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Reporting Year</p>
                  <p className="text-sm font-black text-slate-700">2025-26 Session</p>
               </div>
            </div>
          </div>

          {/* Recent Notifications / Alerts */}
          <div className="lg:col-span-2 bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Intelligence Alerts</h3>
               <span className="text-[9px] font-black bg-rose-50 text-rose-500 px-2 py-1 rounded-lg">New Events</span>
            </div>
            <div className="space-y-4 flex-1">
              <div className="flex items-start gap-4 p-5 rounded-[1.5rem] bg-amber-50 border border-amber-100">
                <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-amber-900 leading-tight">Science assignment due tomorrow</p>
                  <p className="text-[10px] font-bold text-amber-600/60 mt-1 uppercase">Triggered 2h ago</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-5 rounded-[1.5rem] bg-emerald-50 border border-emerald-100">
                <CheckSquare className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-emerald-900 leading-tight">Mathematics scores improved by 8%</p>
                  <p className="text-[10px] font-bold text-emerald-600/60 mt-1 uppercase">Synthesized yesterday</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
  );
};

const StatCard = ({ icon, iconBg, label, value, sub, subColor }: {
  icon: React.ReactNode; iconBg: string; label: string; value: string; sub: string; subColor: string;
}) => (
  <div className={`bg-white border-2 border-slate-100 rounded-[2rem] p-6 shadow-sm hover:border-slate-200 transition-all group`}>
    <div className="flex items-center gap-4 mb-4">
      <div className={`w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm border`}>
        {icon}
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">{label}</p>
        <p className="text-2xl font-black text-slate-800 tracking-tight leading-none">{value}</p>
      </div>
    </div>
    <div className={`px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 w-fit`}>
       <p className={`text-[10px] font-black uppercase tracking-widest ${subColor}`}>{sub}</p>
    </div>
  </div>
);

export default DashboardPage;
