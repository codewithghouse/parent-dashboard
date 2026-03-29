import React, { useState, useEffect } from "react";
import { 
  GraduationCap, BookOpen, User, ChevronDown, 
  Loader2, Users, Presentation, Layout, 
  MousePointer2, ShieldCheck, ArrowRight, Sparkles, Target 
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

const ConceptStrengthsPage = () => {
  const { studentData } = useAuth();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [allScores, setAllScores] = useState<any[]>([]); // New state for performance
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!studentData?.id) return;
    
    // 1. Sync Enrollments
    const qEnroll = query(collection(db, "enrollments"), where("studentId", "==", studentData.id));
    const unsubEnroll = onSnapshot(qEnroll, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEnrollments(data.sort((a: any, b: any) => (a.subject || "").localeCompare(b.subject || "")));
    });

    // 2. Sync Test Scores for performance tracking
    const qScores = query(collection(db, "test_scores"), where("studentId", "==", studentData.id));
    const unsubScores = onSnapshot(qScores, (snap) => {
      setAllScores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => { unsubEnroll(); unsubScores(); };
  }, [studentData?.id]);

  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#1e3a8a] animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Synchronizing Scholastic Nodes...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-5 duration-1000 pb-20 font-sans text-left">
      
      {/* ── HEADER SECTION ── */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Layout className="text-white w-4 h-4" />
          </div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600/60">Curriculum Discovery</h2>
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic">Student Concept Mastery</h1>
      </div>

      {/* ── STUDENT IDENTITY CARD (CLICKABLE) ── */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`relative group cursor-pointer transition-all duration-500 overflow-hidden rounded-[3rem] border-2 p-10 bg-white ${
          isExpanded ? "border-indigo-600 shadow-2xl scale-[1.01]" : "border-slate-100 shadow-sm hover:border-slate-300"
        }`}
      >
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
          <GraduationCap size={200} className="text-slate-900 rotate-12" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
          <div className="flex items-center gap-6">
            <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center text-white text-2xl font-black shadow-xl transition-colors duration-500 ${isExpanded ? 'bg-indigo-600' : 'bg-slate-900'}`}>
              {studentData?.name?.[0] || <User size={32} />}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={14} className="text-amber-500" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Academic Status Portal</p>
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight lowercase first-letter:uppercase">{studentData?.name}</h2>
              <div className="mt-2 flex items-center gap-3">
                 <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 text-[11px] font-black uppercase tracking-widest rounded-full border border-indigo-100">
                    {studentData?.className || "Main Campus"}
                 </span>
                 <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">• {enrollments.length} Active Subjects</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isExpanded ? "Close Overview" : "Open Detailed Audit"}</p>
              <p className="text-xs font-black text-indigo-600 uppercase tracking-tighter">{isExpanded ? "Minimize Stream" : "View Performance"}</p>
            </div>
            <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${isExpanded ? 'bg-indigo-600 border-indigo-600 text-white rotate-180' : 'border-slate-200 text-slate-400'}`}>
              <ChevronDown size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* ── SUBJECT TILES (REVEALED ON CLICK) ── */}
      <div className={`mt-10 transition-all duration-700 ease-in-out ${isExpanded ? 'max-h-[3000px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-4 overflow-hidden'}`}>
        <div className="flex items-center gap-4 mb-8">
           <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
           <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase italic shrink-0">Subject-Wise Mastery Breakdown</h3>
           <div className="h-px w-full bg-slate-100" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {enrollments.length > 0 ? (
             enrollments.map((en, i) => {
                // Calculate performance for THIS subject
                const subScores = allScores.filter(s => (s.subject || "").toLowerCase() === (en.subject || "").toLowerCase());
                const subMastery = subScores.length > 0 
                  ? Math.round(subScores.reduce((acc, curr) => acc + (curr.percentage || (curr.score/curr.maxScore*100)), 0) / subScores.length)
                  : 0;

                return (
                  <div 
                    key={en.id} 
                    className="group bg-white rounded-[3rem] border border-slate-100 p-8 shadow-sm hover:shadow-2xl hover:border-indigo-100 hover:-translate-y-1 transition-all duration-500 relative overflow-hidden"
                  >
                     {/* Background Graphic */}
                     <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform">
                        <Target size={60} className="text-slate-900" />
                     </div>

                     <div className="flex items-center justify-between mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-500 shadow-sm border border-indigo-100/50">
                           <BookOpen size={24} />
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Current Mastery</p>
                           <p className={`text-2xl font-black italic tracking-tighter ${subMastery >= 80 ? 'text-emerald-500' : 'text-slate-900'}`}>{subMastery}%</p>
                        </div>
                     </div>

                     <h4 className="text-2xl font-black text-slate-900 tracking-tighter italic mb-8 uppercase leading-none">{en.subject}</h4>
                     
                     {/* PERFORMANCE BAR */}
                     <div className="mb-8">
                        <div className="flex justify-between items-end mb-2">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Academic Pulse</p>
                           <p className="text-[10px] font-black text-slate-500 uppercase">{subMastery >= 80 ? 'Mastery High' : subMastery >= 60 ? 'Developing' : 'Critical Focus'}</p>
                        </div>
                        <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                           <div 
                             className={`h-full transition-all duration-1000 ${subMastery >= 80 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : subMastery >= 60 ? 'bg-amber-400' : 'bg-rose-500'}`} 
                             style={{ width: `${subMastery || 5}%` }} 
                           />
                        </div>
                     </div>

                     <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shadow-inner">
                              <ShieldCheck size={18} />
                           </div>
                           <div>
                              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Subject Mentor</p>
                              <p className="text-[12px] font-black text-slate-800 uppercase italic leading-none">{en.teacherName || "Faculty Expert"}</p>
                           </div>
                        </div>
                        <button className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all border border-slate-100 hover:border-indigo-600 active:scale-95">
                           <ArrowRight size={18} />
                        </button>
                     </div>
                  </div>
                );
             })
           ) : (
             <div className="col-span-full py-20 text-center flex flex-col items-center justify-center bg-slate-50 rounded-[3rem] border border-dashed border-slate-200">
                <Users className="w-12 h-12 text-slate-200 mb-4" />
                <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-300 italic">No subject streams detected in this registry node.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default ConceptStrengthsPage;
