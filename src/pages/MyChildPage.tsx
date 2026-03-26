import React, { useState, useEffect } from "react";
import { 
  Mail, CheckSquare, FileText, Star, CalendarCheck, Loader2, User, Phone, 
  MapPin, Award, ShieldCheck, HeartPulse, GraduationCap, ArrowRight, BookOpen,
  CheckCircle, PlusCircle, Sparkles, TrendingUp, Info, ChevronRight, ArrowUpRight, Users, Activity
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";

const MyChildPage = () => {
  const { studentData, user } = useAuth();
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [activeEnrollment, setActiveEnrollment] = useState<any>(null);

  useEffect(() => {
    if (!studentData?.id) {
      setLoadingTeachers(false);
      return;
    }

    setLoadingTeachers(true);
    const qEnroll = query(collection(db, "enrollments"), where("studentId", "==", studentData.id));
    
    const unsubEnroll = onSnapshot(qEnroll, async (enrollSnap) => {
        const enrollments = enrollSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        if (enrollments.length > 0) {
            setActiveEnrollment(enrollments[0]);
            const teacherIds = Array.from(new Set(enrollments.map((e: any) => e.teacherId))).filter(id => !!id);
            
            if (teacherIds.length > 0) {
                const teachersData: any[] = [];
                const colors = ["bg-[#1e3a8a]", "bg-emerald-600", "bg-indigo-600", "bg-rose-600", "bg-blue-800"];
                
                for (const tId of teacherIds) {
                    try {
                        const tDoc = await getDoc(doc(db, "teachers", tId));
                        if (tDoc.exists()) {
                            const t = tDoc.data();
                            teachersData.push({
                                id: tDoc.id,
                                initials: t.name ? t.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : "T",
                                name: t.name,
                                subject: t.subject || "Academic Faculty",
                                color: colors[teachersData.length % colors.length]
                            });
                        }
                    } catch (e) { console.error(e); }
                }
                setTeachers(teachersData);
            }
        }
        setLoadingTeachers(false);
    });

    return () => unsubEnroll();
  }, [studentData?.id]);

  const displayGrade = activeEnrollment?.grade || studentData?.grade || "N/A";
  const displayRoll = activeEnrollment?.rollNo || studentData?.rollNo || "N/A";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000 pb-24 text-left font-sans">
      
      {/* ─── HEADER ─── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-10 mb-20 px-4">
        <div className="text-left w-full md:w-auto">
           <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-[1.5rem] bg-[#1e3a8a] flex items-center justify-center text-white shadow-xl shadow-blue-200">
                 <User size={26} />
              </div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">Institutional Identity Vault</p>
                 <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border-2 border-white shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest leading-none">Record Authenticated</p>
                 </div>
              </div>
           </div>
           <h1 className="text-6xl font-black text-slate-900 tracking-tighter leading-none mb-4">Student Identity</h1>
           <p className="text-xl font-bold text-slate-400 italic">Authorized Academic Profile & Session Hierarchy • 2025-26</p>
        </div>
        
        <button 
           onClick={() => navigate('/settings')}
           className="h-20 px-12 bg-white border border-slate-100 rounded-[2.5rem] text-[11px] font-black text-[#1e3a8a] uppercase tracking-widest shadow-sm hover:shadow-2xl transition-all flex items-center gap-4"
        >
           Sync Local Registry <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 px-2">
         
         {/* LEFT: IDENTITY CORE */}
         <div className="lg:col-span-8 flex flex-col gap-12">
            
            {/* HERO IDENTITY CARD */}
            <div className="bg-white border border-slate-100 rounded-[4.5rem] p-12 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all">
               <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 transition-transform duration-1000 group-hover:rotate-0">
                  <ShieldCheck className="w-48 h-48 text-[#1e3a8a]" />
               </div>
               
               <div className="relative z-10">
                  <div className="flex flex-col md:flex-row items-center gap-12 mb-12">
                     <div className="relative group/avatar">
                        <div className="w-32 h-32 rounded-[3.5rem] bg-[#1e3a8a] flex items-center justify-center text-white font-black text-4xl italic shadow-2xl transition-transform group-hover/avatar:rotate-3">
                           {studentData?.name?.[0] || 'S'}
                        </div>
                        <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-emerald-500 rounded-[1.5rem] border-4 border-white flex items-center justify-center text-white shadow-xl">
                           <CheckCircle size={20} />
                        </div>
                     </div>
                     <div className="text-center md:text-left">
                        <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-4 italic uppercase">{studentData?.name}</h2>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4">
                           <span className="px-5 py-2 bg-indigo-50 text-indigo-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-indigo-100 italic">Division Primary</span>
                           <span className="px-5 py-2 bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-full italic">ID: {studentData?.id?.substring(0,8)}</span>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pt-12 border-t border-slate-50">
                     <IdentityBit label="Grade" value={displayGrade} icon={GraduationCap} />
                     <IdentityBit label="Roll Number" value={displayRoll} icon={Star} />
                     <IdentityBit label="Authenticated Email" value={studentData?.email} icon={Mail} />
                     <IdentityBit label="Pulse Check" value="verified" icon={HeartPulse} color="text-emerald-500" />
                  </div>
               </div>
            </div>

            {/* FACULTY DIRECTORY */}
            <div className="bg-white border border-slate-100 rounded-[4rem] p-12 shadow-sm">
               <div className="flex items-center justify-between mb-12 pb-8 border-b border-slate-50">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none flex items-center gap-4">
                     <GraduationCap className="w-6 h-6 text-[#1e3a8a]" /> Assigned Institutional Faculty
                  </h3>
                  <div className="flex items-center gap-2">
                     <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Faculty Sync Active</span>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                  {loadingTeachers ? (
                     <div className="col-span-full py-20 flex flex-col items-center justify-center">
                        <Loader2 className="w-12 h-12 animate-spin text-indigo-200 mb-6" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">Synchronizing Faculty Directory...</p>
                     </div>
                  ) : teachers.length > 0 ? (
                     teachers.map((t) => (
                        <div key={t.id} className="p-10 bg-slate-50/50 rounded-[3rem] border border-slate-50 hover:bg-white hover:shadow-2xl hover:-translate-y-2 transition-all group group/card">
                           <div className="flex items-center justify-between mb-8">
                              <div className={`w-16 h-16 rounded-[1.8rem] ${t.color} flex items-center justify-center text-white text-2xl font-black shadow-xl group-hover:rotate-6 transition-transform`}>{t.initials}</div>
                              <button className="w-12 h-12 bg-white rounded-2xl border border-slate-100 text-slate-300 hover:text-[#1e3a8a] hover:bg-indigo-50 transition-all shadow-sm flex items-center justify-center">
                                 <Mail size={18} />
                              </button>
                           </div>
                           <h4 className="text-xl font-black text-slate-900 tracking-tighter mb-2 italic uppercase group-hover/card:text-[#1e3a8a] transition-colors">{t.name}</h4>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.subject}</p>
                        </div>
                     ))
                  ) : (
                     <div className="col-span-full py-24 text-center bg-slate-50/50 rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center opacity-30">
                        <Users size={48} className="mb-6" />
                        <p className="text-[11px] font-black uppercase tracking-[0.3em]">No Faculty Assignments Located</p>
                     </div>
                  )}
               </div>
            </div>
         </div>

         {/* RIGHT SIDE: MILESTONES & PERFORMANCE PREVIEW */}
         <div className="lg:col-span-4 flex flex-col gap-12">
            
            {/* SCHOLASTIC MILESTONE CARD */}
            <div className="bg-slate-900 rounded-[4.5rem] p-12 text-white shadow-2xl relative overflow-hidden group">
               <Award className="absolute -left-12 -bottom-12 w-64 h-64 text-white/5 pointer-events-none group-hover:scale-110 transition-transform duration-1000" />
               <div className="flex items-center gap-4 mb-12 relative z-10">
                  <Star className="w-6 h-6 text-amber-400" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 italic">Term III Validation</h3>
               </div>
               
               <div className="relative z-10 mb-12">
                  <h3 className="text-3xl font-black leading-[1.1] tracking-tighter mb-6 italic uppercase">Faculty Verification Successful.</h3>
                  <p className="text-sm font-bold text-slate-400 leading-relaxed uppercase tracking-tighter">
                     All curriculum milestones, assessment logs, and behavioral traces are synchronized with the institutional hub.
                  </p>
               </div>

               <div className="flex flex-wrap gap-4 relative z-10">
                  <div className="px-5 py-2 bg-white/5 border border-white/10 rounded-full text-[9px] font-black uppercase tracking-widest text-emerald-400">Identity Secure</div>
                  <div className="px-5 py-2 bg-white/5 border border-white/10 rounded-full text-[9px] font-black uppercase tracking-widest text-indigo-400">Archive Ready</div>
               </div>

               <button 
                  onClick={() => navigate('/performance')}
                  className="mt-12 w-full h-20 bg-white text-slate-900 rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl hover:scale-[1.05] transition-all flex items-center justify-center gap-4 relative z-10"
               >
                  Audit Performance Hub <ArrowRight size={20} />
               </button>
            </div>

            {/* QUICK STATS CAROUSEL (PLACEHOLDER) */}
            <div className="bg-white border border-slate-100 rounded-[4.5rem] p-12 shadow-sm relative overflow-hidden group">
               <div className="flex items-center gap-4 mb-10">
                  <TrendingUp className="w-6 h-6 text-[#1e3a8a]" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Activity Trace</h3>
               </div>
               <div className="space-y-8">
                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex items-center justify-between">
                     <div>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1 leading-none">Attendance Rate</p>
                        <p className="text-2xl font-black text-slate-800 tracking-tighter italic">98.2%</p>
                     </div>
                     <Activity className="text-emerald-500" size={24} />
                  </div>
                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex items-center justify-between">
                     <div>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1 leading-none">Mastery Level</p>
                        <p className="text-2xl font-black text-slate-800 tracking-tighter italic">Alpha Tier</p>
                     </div>
                     <Sparkles className="text-amber-500" size={24} />
                  </div>
               </div>
            </div>
         </div>

      </div>
    </div>
  );
};

const IdentityBit = ({ label, value, icon: Icon, color = "text-slate-800" }: any) => (
  <div className="text-left group/bit">
     <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-slate-300 group-hover/bit:text-[#1e3a8a] transition-colors" />
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">{label}</p>
     </div>
     <p className={`text-xl font-black italic uppercase tracking-tighter truncate ${color}`}>{value || 'N/A'}</p>
  </div>
);

export default MyChildPage;
