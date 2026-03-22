import { useState, useEffect } from "react";
import { AlertCircle, Clock, Trophy, Calendar, CheckCircle, User, Sparkles, Brain, ArrowRight, Loader2, Info, BellRing } from "lucide-react";
import { ParentAIController } from "../ai/controller/ai-controller";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";

const filterTabs = ["All", "Academic", "Attendance", "Behavior"];

const AlertsPage = () => {
  const { studentData } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [aiStories, setAiStories] = useState<Record<string, any>>({});
  const [isAllRead, setIsAllRead] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!studentData?.id) return;

    setLoading(true);
    // Fetch from 'risks' or 'parent_alerts'
    const q = query(
      collection(db, "risks"),
      where("studentId", "==", studentData.id),
      orderBy("resolved", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        title: (doc.data() as any).issue || "System Alert",
        description: (doc.data() as any).details?.join('. ') || "No further details provided.",
        category: (doc.data() as any).type || "General",
        priority: (doc.data() as any).severity || "Normal",
        color: (doc.data() as any).severity === 'Critical' ? 'rose' : (doc.data() as any).severity === 'High Priority' ? 'amber' : 'indigo'
      }));
      setAlerts(data);
      setLoading(false);
    }, (error) => {
      console.error("Alerts Sync Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [studentData]);

  const fetchAIStory = async (alert: any) => {
    if (aiStories[alert.id]) return;
    setAnalyzingId(alert.id);
    try {
      const result = await ParentAIController.getAlertIntelligence({
        title: alert.title,
        description: alert.description,
        category: alert.category
      });
      if (result.status === "success") {
        setAiStories(prev => ({ ...prev, [alert.id]: result.data }));
      }
    } finally {
      setAnalyzingId(null);
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (filterTabs[activeTab] === "All") return true;
    return a.category === filterTabs[activeTab];
  });

  return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
             <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                Smart Notifications <Sparkles className="w-8 h-8 text-amber-500" />
             </h1>
             <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">AI-enhanced alerts with actionable storytelling</p>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
               {filterTabs.map((tab, i) => (
                 <button key={tab} onClick={() => setActiveTab(i)}
                   className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                     i === activeTab ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-400"
                   }`}>{tab}</button>
               ))}
             </div>
             <button 
               onClick={() => setIsAllRead(true)}
               className={`p-4 rounded-2xl border-2 transition-all ${isAllRead ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "border-slate-100 text-slate-400 hover:border-slate-200"}`}
             >
                <CheckCircle className="w-5 h-5" />
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
           
           {/* Alerts List */}
           <div className="lg:col-span-8 space-y-6">
              {loading ? (
                  <div className="py-24 text-center bg-white border-2 border-slate-50 rounded-[2.5rem]">
                      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                      <p className="text-sm font-black text-indigo-600 uppercase tracking-widest">Scanning scholar alerts...</p>
                  </div>
              ) : filteredAlerts.length === 0 ? (
                  <div className="py-24 text-center bg-white border-2 border-slate-50 rounded-[2.5rem] flex flex-col items-center">
                      <div className="w-20 h-20 bg-slate-50 border-2 border-slate-100 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm">
                          <BellRing className="w-9 h-9 text-slate-200" />
                      </div>
                      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Clear Notification Hub</h3>
                      <p className="text-sm font-bold text-slate-400 max-w-sm leading-relaxed px-10">
                          The feature will work automatically after the institution flags a performance or attendance alert for {studentData?.name || "the student"}.
                      </p>
                  </div>
              ) : (
                filteredAlerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group ${isAllRead || alert.resolved ? 'opacity-60' : ''}`}
                  >
                    <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                      <div className="flex items-start gap-6">
                         <div className={`w-14 h-14 rounded-2xl bg-${alert.color}-50 flex items-center justify-center border border-${alert.color}-100 shrink-0`}>
                            {alert.category === 'Attendance' ? <Clock className={`w-5 h-5 text-${alert.color}-500`} /> : <AlertCircle className={`w-5 h-5 text-${alert.color}-500`} />}
                         </div>
                         <div>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                               <h3 className="text-lg font-black text-slate-800 tracking-tight">{alert.title}</h3>
                               <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 border border-slate-100`}>{alert.category}</span>
                               <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-${alert.color}-50 text-${alert.color}-600 border border-${alert.color}-100`}>{alert.priority}</span>
                            </div>
                            <p className="text-sm font-bold text-slate-500 leading-relaxed mb-4">{alert.description}</p>
                            <div className="flex items-center gap-4">
                               <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                  <Clock className="w-3.5 h-3.5" /> {new Date().toLocaleDateString()}
                               </span>
                            </div>
                         </div>
                      </div>
                      
                      <button 
                        onClick={() => fetchAIStory(alert)}
                        className={`shrink-0 flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                           aiStories[alert.id] 
                           ? "bg-slate-900 text-white shadow-lg" 
                           : "bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100"
                        }`}
                      >
                         {analyzingId === alert.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                         {aiStories[alert.id] ? "Story Analyzed" : "Explain with AI"}
                      </button>
                    </div>

                    {/* FEATURE 15: AI Alert Storytelling */}
                    {aiStories[alert.id] && (
                       <div className="mt-8 pt-8 border-t-2 border-slate-50 animate-in slide-in-from-top-4 duration-500">
                          <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden">
                             <Sparkles className="absolute top-0 right-0 p-8 w-40 h-40 text-white/5" />
                             <div className="flex items-center gap-3 mb-4">
                                <Brain className="w-5 h-5 text-indigo-400" />
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-300">AI Context Analysis</h4>
                             </div>
                             <p className="text-base font-bold text-slate-200 leading-relaxed italic">
                                "{aiStories[alert.id].alert_story}"
                             </p>

                             {/* FEATURE 16: Action Recommendations */}
                             <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-white/5 border border-white/10 rounded-3xl">
                                <div className="flex items-start gap-4">
                                   <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                                      <Sparkles className="w-5 h-5" />
                                   </div>
                                   <div>
                                      <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Recommended Action</p>
                                      <p className="text-sm font-bold text-white mt-1">{aiStories[alert.id].action_recommendation?.text || "Proactive engagement recommended."}</p>
                                   </div>
                                </div>
                                <button className="w-full md:w-auto px-8 py-3 bg-white text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-100 transition-all">
                                   {aiStories[alert.id].action_recommendation?.button_label || "View Details"} <ArrowRight className="w-4 h-4" />
                                </button>
                             </div>
                          </div>
                       </div>
                    )}
                  </div>
                ))
              )}
           </div>

           {/* Priority Summary */}
           <div className="lg:col-span-4 space-y-6">
              <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-100 overflow-hidden relative">
                 <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
                 <h3 className="text-sm font-black uppercase tracking-[0.3em] text-indigo-200 mb-8">Weekly Priority Scan</h3>
                 <div className="space-y-6 relative z-10">
                    <div className="flex items-center justify-between">
                       <span className="text-sm font-bold opacity-80">Urgent Alerts</span>
                       <span className="text-2xl font-black">{alerts.filter(a => a.priority === 'Critical').length.toString().padStart(2, '0')}</span>
                    </div>
                    <div className="w-full h-1 bg-white/20 rounded-full">
                       <div className="w-3/4 h-full bg-white rounded-full" />
                    </div>
                    <p className="text-xs font-bold leading-relaxed opacity-80">
                       AI predicts that addressing "Attendance" tomorrow will improve {studentData?.name}'s grade stability by <span className="text-indigo-200">8%</span>.
                    </p>
                 </div>
              </div>

              <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm">
                 <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6">Action Checklist</h3>
                 <div className="space-y-4">
                    {alerts.length === 0 ? (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">All tasks completed.</p>
                    ) : (
                        alerts.slice(0, 5).map((a, idx) => (
                           <label key={idx} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200">
                              <input type="checkbox" checked={a.resolved} readOnly className="w-5 h-5 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                              <span className="text-sm font-bold text-slate-700">{a.title}</span>
                           </label>
                        ))
                    )}
                 </div>
              </div>
           </div>

        </div>
      </div>
  );
};

export default AlertsPage;
