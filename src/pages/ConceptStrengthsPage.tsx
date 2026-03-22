import { useState, useEffect } from "react";
import { 
  CheckCircle, AlertCircle, XCircle, Lightbulb, Sparkles, 
  Calendar, BookOpen, PenTool, HelpCircle, Camera, Loader2,
  ChevronRight, Brain, Zap, PlayCircle, PlusCircle, Info, Rocket
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ParentAIController } from "../ai/controller/ai-controller";
import { useAuth } from "@/lib/AuthContext";

const subjectTabs = ["Mathematics", "Science", "English"];

const mathData = {
  strong: [
    { topic: "Algebraic Expressions", score: 92 },
    { topic: "Linear Equations", score: 88 },
    { topic: "Number Systems", score: 90 },
  ],
  developing: [
    { topic: "Statistics", score: 76 },
    { topic: "Probability", score: 74 },
  ],
  needsWork: [
    { topic: "Trigonometry", score: 68 },
  ],
};

const chartData = [
  { month: "Jun", algebra: 70, geometry: 65, trigonometry: 60 },
  { month: "Jul", algebra: 74, geometry: 68, trigonometry: 62 },
  { month: "Aug", algebra: 78, geometry: 72, trigonometry: 64 },
  { month: "Sep", algebra: 82, geometry: 76, trigonometry: 66 },
  { month: "Oct", algebra: 85, geometry: 80, trigonometry: 65 },
  { month: "Nov", algebra: 88, geometry: 82, trigonometry: 67 },
  { month: "Dec", algebra: 90, geometry: 85, trigonometry: 66 },
  { month: "Jan", algebra: 92, geometry: 88, trigonometry: 68 },
];

const ConceptStrengthsPage = () => {
  const { studentData } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [intelligence, setIntelligence] = useState<any>(null);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);

  useEffect(() => {
    const fetchIntelligence = async () => {
      setIsAnalyzing(true);
      try {
        const payload = {
          student_name: studentData?.name || "Aditya",
          subject: subjectTabs[activeTab],
          strengths: mathData.strong,
          weaknesses: mathData.needsWork,
          upcoming_test: "Unit Test on Friday (Algebra & Trig)"
        };
        const result = await ParentAIController.getConceptIntelligence(payload);
        if (result.status === "success") {
          setIntelligence(result.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsAnalyzing(false);
      }
    };
    fetchIntelligence();
  }, [activeTab, studentData]);

  const getBarColor = (score: number) => {
    if (score >= 85) return "bg-emerald-500";
    if (score >= 70) return "bg-amber-500";
    return "bg-rose-500";
  };

  return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-12">
        
        {/* Header & Tabs */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              Concept Mastery Hub <Brain className="w-8 h-8 text-indigo-600" />
            </h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">Identifying gaps & accelerating learning potential</p>
          </div>
          
          <div className="flex bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200 w-fit">
            {subjectTabs.map((tab, i) => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(i)}
                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  i === activeTab 
                  ? "bg-white text-indigo-600 shadow-sm border border-slate-200" 
                  : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* FEATURE 7: AI Study Plan Maker */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4">
             <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 shadow-sm h-full relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                   <Calendar className="w-24 h-24 text-indigo-600"/>
                </div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                   <Zap className="w-4 h-4 text-amber-500" /> {intelligence?.study_plan?.title || "Daily Revision Guard"} 
                </h3>

                {isAnalyzing ? (
                   <div className="space-y-4">
                      {[1, 2].map(i => <div key={i} className="h-20 bg-slate-50 rounded-2xl animate-pulse" />)}
                   </div>
                ) : (
                   <div className="space-y-4">
                      {intelligence?.study_plan?.schedule?.map((item: any, idx: number) => (
                         <div key={idx} className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-3xl group/item hover:bg-white hover:shadow-md transition-all">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">{item.day}</span>
                            <p className="text-sm font-black text-slate-800 mt-1 leading-tight">{item.task}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-2 italic flex items-center gap-1">
                               <Info className="w-3 h-3"/> {item.reason}
                            </p>
                         </div>
                      ))}
                   </div>
                )}
                <button className="w-full mt-6 py-4 bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-colors">
                   Download Detailed Plan
                </button>
             </div>
          </div>

          <div className="lg:col-span-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                {/* FEATURE 8: Concept Explainer */}
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2.5rem] p-8 text-white relative overflow-hidden group shadow-xl">
                   <PlayCircle className="absolute -bottom-8 -right-8 w-40 h-40 text-white/5 group-hover:scale-110 transition-transform"/>
                   <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center border border-white/20">
                         <BookOpen className="w-5 h-5"/>
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-widest">24/7 AI Concept Explainer</h3>
                   </div>
                   <h2 className="text-2xl font-black mb-4 pr-12">Struggling with a concept?</h2>
                   <p className="text-sm font-bold text-indigo-100/80 mb-8 max-w-[240px]">Get a child-friendly explanation with real-world analogies instantly.</p>
                   
                   <div className="relative">
                      <input 
                         type="text" 
                         placeholder="e.g. Try 'Photosynthesis'..." 
                         className="w-full h-14 bg-white/10 border border-white/20 rounded-2xl px-6 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:bg-white/20 focus:ring-2 ring-white/20 transition-all font-bold"
                      />
                      <button className="absolute right-2 top-2 h-10 px-4 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Ask AI</button>
                   </div>
                </div>

                {/* FEATURE 10: AI Doubt Solver */}
                <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 shadow-sm flex flex-col group hover:border-emerald-100 transition-all">
                   <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100 text-emerald-600 uppercase font-black text-lg">?</div>
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">AI Doubt Solver</h3>
                   </div>
                   <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl group-hover:bg-emerald-50/30 group-hover:border-emerald-200 transition-all">
                      <Camera className="w-10 h-10 text-slate-300 group-hover:text-emerald-500 mb-4 transition-colors" />
                      <p className="text-sm font-black text-slate-500 group-hover:text-emerald-600">Snap & Solve</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Upload photo of doubt</p>
                   </div>
                   <p className="text-[10px] font-bold text-slate-400 mt-6 italic text-center uppercase tracking-widest">AI guides you step-by-step, no spoilers.</p>
                </div>
             </div>
          </div>
        </div>

        {/* Strength Categories & Mastery Map */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
          <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 shadow-sm order-2 lg:order-1">
             <div className="flex items-center gap-3 mb-8">
               <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-rose-500" />
               </div>
               <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Needs Focus</h3>
             </div>
             <div className="space-y-4">
               {mathData.needsWork.map((t) => (
                 <div key={t.topic} className="p-6 bg-rose-50/50 border border-rose-100/50 rounded-3xl group cursor-pointer hover:bg-white hover:shadow-lg transition-all relative overflow-hidden">
                   <div className="flex justify-between items-center mb-3">
                     <span className="text-sm font-black text-slate-800 tracking-tight group-hover:text-rose-600">{t.topic}</span>
                     <span className="text-sm font-black text-rose-600 bg-white px-3 py-1 rounded-lg border border-rose-100">{t.score}%</span>
                   </div>
                   {/* FEATURE 9: Practice Problem Generator */}
                   <button className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-600 tracking-widest mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <PlusCircle className="w-3.5 h-3.5" /> Generate Practice Drill
                   </button>
                 </div>
               ))}
               <div className="mt-8 p-6 bg-amber-50 rounded-3xl border border-amber-100 relative overflow-hidden group/tip">
                 <Lightbulb className="absolute -top-4 -right-4 w-16 h-16 text-amber-500/10 group-hover/tip:scale-110 transition-transform" />
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">Strategic Insight</h4>
                 <p className="text-[11px] font-bold text-amber-800 leading-relaxed italic">
                    "{intelligence?.concept_explainer?.explanation || "Mastering the base identities in Trigonometry will unlock success in 4 of the next 5 upcoming units."}"
                 </p>
               </div>
             </div>
          </div>

          <div className="lg:col-span-2 order-1 lg:order-2">
             <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 shadow-sm h-full flex flex-col">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-8 h-0.5 bg-slate-200" /> Chronological Topic Analytics
                   </h3>
                   <div className="flex gap-4">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                         <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"/> Algebra
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                         <div className="w-2.5 h-2.5 rounded-full bg-rose-500"/> Trig
                      </span>
                   </div>
                </div>
                <div className="flex-1 min-h-[350px]">
                   <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={chartData}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--slate-100))" />
                       <XAxis dataKey="month" stroke="hsl(var(--slate-400))" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                       <YAxis domain={[50, 100]} stroke="hsl(var(--slate-400))" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                       <Tooltip 
                         contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}
                       />
                       <Line type="monotone" dataKey="algebra" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981' }} activeDot={{ r: 8 }} />
                       <Line type="monotone" dataKey="trigonometry" stroke="#f43f5e" strokeWidth={4} dot={{ r: 6, fill: '#f43f5e' }} activeDot={{ r: 8 }} />
                     </LineChart>
                   </ResponsiveContainer>
                </div>
             </div>
          </div>
        </div>

        {/* FEATURE 9 (Integrated): Dynamic Practice Section */}
        <div className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl">
           <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <PenTool className="w-64 h-64 rotate-12" />
           </div>
           <div className="max-w-2xl relative z-10">
              <div className="flex items-center gap-3 mb-6">
                 <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                    <Rocket className="w-6 h-6 text-indigo-400"/>
                 </div>
                 <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-400">Mastery Accelerator</h3>
              </div>
              <h2 className="text-4xl font-black mb-6 tracking-tight leading-none">Practice Makes Permanent.</h2>
              <p className="text-lg font-bold text-slate-400 mb-10 leading-relaxed">
                 AI identifies the concepts your child just understood and generates 5 naye dynamic unlimited questions for rigorous testing.
              </p>
              
              <div className="flex flex-wrap gap-4">
                 {intelligence?.practice_problems ? (
                    <button className="px-10 py-5 bg-indigo-600 rounded-3xl text-[12px] font-black uppercase tracking-[0.2em] hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/50">
                       Start Dynamic Drill
                    </button>
                 ) : (
                    <button className="px-10 py-5 bg-white/10 rounded-3xl text-[12px] font-black uppercase tracking-[0.2em] hover:bg-white/20 transition-all border border-white/10 flex items-center gap-3">
                       <Loader2 className="w-4 h-4 animate-spin"/> Auditing Mastery...
                    </button>
                 )}
                 <button className="px-10 py-5 bg-transparent border-2 border-slate-700 hover:border-slate-600 rounded-3xl text-[12px] font-black uppercase tracking-[0.2em] transition-all">
                    View Concept History
                 </button>
              </div>
           </div>
        </div>

      </div>
  );
};

export default ConceptStrengthsPage;
