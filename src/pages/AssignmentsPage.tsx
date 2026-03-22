import { useState, useEffect } from "react";
import { User, Clock, Lightbulb, CheckCircle2, AlertCircle, Loader2, Sparkles, Send, Brain } from "lucide-react";
import { ParentAIController } from "../ai/controller/ai-controller";

const tabs = ["Pending (2)", "Completed (28)", "Overdue (0)"];

const assignmentsData = [
  {
    title: "Science Project - Photosynthesis",
    description: "Create a presentation explaining the process of photosynthesis with diagrams",
    teacher: "Mr. Rajesh Kumar",
    due: "Due Tomorrow",
    dueColor: "text-rose-500",
    icon: "🔬",
    iconBg: "bg-amber-50",
  },
  {
    title: "English Essay - My Favorite Book",
    description: "Write a 500-word essay about your favorite book and why you like it",
    teacher: "Ms. Sunita Gupta",
    due: "Due in 3 days",
    dueColor: "text-amber-500",
    icon: "📝",
    iconBg: "bg-indigo-50",
  },
];

const AssignmentsPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [showAIHint, setShowAIHint] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  const fetchAIHints = async (assignment: any) => {
    setIsAnalyzing(true);
    setShowAIHint(assignment.title);
    try {
      const result = await ParentAIController.getAssignmentIntelligence({
        title: assignment.title,
        description: assignment.description,
        type: "hints"
      });
      if (result.status === "success") {
        setAiResponse(result.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitFeedback = (title: string) => {
    setFeedbackSuccess(title);
    setTimeout(() => setFeedbackSuccess(null), 5000);
  };

  return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Academic Assignments</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px] mt-1">Track submissions & get intelligent guidance</p>
          </div>
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            {tabs.map((tab, i) => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(i)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  i === activeTab ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-400"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Assignment Cards */}
        <div className="space-y-6">
          {assignmentsData.map((a) => (
            <div key={a.title} className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
              
              {feedbackSuccess === a.title && (
                 <div className="absolute inset-0 bg-emerald-600/95 z-20 flex flex-col items-center justify-center text-white animate-in zoom-in duration-300">
                    <CheckCircle2 className="w-16 h-16 mb-4" />
                    <h3 className="text-2xl font-black">{aiResponse?.submission_feedback?.remark || "Draft Submitted!"}</h3>
                    <p className="text-emerald-100 font-bold mt-2 text-center max-w-md px-8 capitalize">
                       AI Logic Check: {aiResponse?.submission_feedback?.improvement || "Structure looks solid. Ready for teacher review."}
                    </p>
                 </div>
              )}

              <div className="flex flex-col lg:flex-row items-start justify-between gap-8">
                <div className="flex items-start gap-6">
                  <div className={`w-16 h-16 rounded-3xl ${a.iconBg} flex items-center justify-center text-3xl shadow-inner border border-slate-100`}>{a.icon}</div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">{a.title}</h3>
                    <p className="text-sm font-bold text-slate-500 mt-2 leading-relaxed max-w-xl">{a.description}</p>
                    <div className="flex flex-wrap items-center gap-6 mt-4">
                      <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                         <User className="w-3.5 h-3.5" />{a.teacher}
                      </span>
                      <span className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${a.dueColor} bg-white shadow-sm`}>
                         <Clock className="w-3.5 h-3.5" />{a.due}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row lg:flex-col items-end gap-3 w-full lg:w-auto">
                  <button 
                    onClick={() => fetchAIHints(a)}
                    className="w-full sm:w-auto px-6 py-3 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100 flex items-center justify-center gap-2"
                  >
                    <Lightbulb className="w-4 h-4" /> Get AI Hint
                  </button>
                  <button 
                    onClick={() => handleSubmitFeedback(a.title)}
                    className="w-full sm:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 shadow-lg shadow-slate-200"
                  >
                    Submit Draft
                  </button>
                </div>
              </div>

              {/* FEATURE 11: AI Hints System */}
              {showAIHint === a.title && (
                 <div className="mt-8 pt-8 border-t-2 border-slate-50 animate-in slide-in-from-top-4 duration-300">
                    <div className="bg-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden lg:max-w-3xl">
                       <Sparkles className="absolute top-4 right-4 w-12 h-12 text-white/10" />
                       <div className="flex items-center gap-3 mb-6">
                          <Brain className="w-6 h-6 text-indigo-300" />
                          <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-200">Cognitive Clue Engine</h4>
                       </div>
                       
                       {isAnalyzing ? (
                          <div className="flex items-center gap-4 py-4">
                             <Loader2 className="w-6 h-6 animate-spin text-indigo-300" />
                             <p className="text-sm font-bold animate-pulse">Scanning context for subtle hints...</p>
                          </div>
                       ) : (
                          <div className="space-y-4">
                             {aiResponse?.assignment_hints?.map((h: any, i: number) => (
                                <div key={i} className="flex gap-4 p-4 bg-white/10 border border-white/10 rounded-2xl hover:bg-white/15 transition-all">
                                   <div className="w-8 h-8 rounded-lg bg-indigo-400/20 flex items-center justify-center font-black text-indigo-200 shrink-0">{i+1}</div>
                                   <div>
                                      <p className="text-sm font-black">{h.hint}</p>
                                      <p className="text-[11px] font-bold text-indigo-200/60 mt-2 uppercase tracking-widest">💡 Focus Area: {h.clue}</p>
                                   </div>
                                </div>
                             ))}
                          </div>
                       )}
                       <p className="text-[10px] font-bold text-indigo-300/60 mt-8 italic text-center border-t border-white/10 pt-4 uppercase tracking-[0.2em]">
                          AI only provides the logic, so you can achieve the mastery!
                       </p>
                    </div>
                 </div>
              )}
            </div>
          ))}
        </div>

        {/* FEATURE 12 (Integrated): Performance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: "Assignment Completion", value: "93%", progress: 93, color: "bg-emerald-500", icon: <CheckCircle2 className="w-4 h-4"/> },
            { label: "On-Time Ratio", value: "96%", progress: 96, color: "bg-indigo-500", icon: <Clock className="w-4 h-4"/> },
            { label: "AI Hint Efficiency", value: "82%", progress: 82, color: "bg-amber-500", icon: <Lightbulb className="w-4 h-4"/> },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-3xl border-2 border-slate-50 p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   <div className={`p-1.5 rounded-lg ${s.color} text-white`}>{s.icon}</div>
                   {s.label}
                </span>
                <span className="text-xl font-black text-slate-800 tracking-tighter">{s.value}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100 shadow-inner">
                <div className={`h-full rounded-full ${s.color} transition-all duration-1000 shadow-sm`} style={{ width: `${s.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
  );
};

export default AssignmentsPage;
