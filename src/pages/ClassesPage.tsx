import React, { useState, useEffect } from "react";
import { 
  GraduationCap, Users, MessageSquare, BookOpen, 
  MapPin, Clock, School, ShieldCheck, ChevronRight, Loader2, Info, Target 
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { db } from "../lib/firebase";
import { 
  collection, query, where, onSnapshot, doc as fbDoc, getDoc as fbGetDoc 
} from "firebase/firestore";

const ClassesPage = () => {
  const { studentData } = useAuth();
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentData?.id) return;
    setLoading(true);

    const qEnroll = query(collection(db, "enrollments"), where("studentId", "==", studentData.id));
    const unsub = onSnapshot(qEnroll, async (snap) => {
        const rawEnrollments = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
        
        // Resolve Teacher Names with aliased fbDoc/fbGetDoc
        const enriched = await Promise.all(rawEnrollments.map(async (en) => {
            let verifiedName = en.teacherName || "Institutional Faculty";
            if (en.teacherId) {
                try {
                    const tRef = fbDoc(db, "teachers", en.teacherId);
                    const tSnap = await fbGetDoc(tRef);
                    if (tSnap.exists()) {
                        verifiedName = tSnap.data().name;
                    }
                } catch (e) {
                    console.error("Faculty Resolution Failure", e);
                }
            }
            return {
                ...en,
                teacherName: verifiedName,
                initials: verifiedName.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)
            };
        }));

        setEnrollments(enriched);
        setLoading(false);
    });

    return () => unsub();
  }, [studentData?.id]);

  const cardColors = ["bg-[#1e3a8a]", "bg-emerald-600", "bg-indigo-600", "bg-orange-600", "bg-rose-600", "bg-purple-600"];

  return (
    <div className="animate-in fade-in duration-700 pb-24 text-left font-sans">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col mb-12 px-4 italic">
          <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em] opacity-80 mb-2">Institutional Service</p>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">Academic Classes</h1>
          <p className="text-lg font-bold text-slate-400 mt-4 lowercase">registered subject streams and faculty for {studentData?.name}</p>
      </div>

      {loading ? (
          <div className="py-40 text-center">
             <Loader2 className="w-12 h-12 text-slate-200 animate-spin mx-auto mb-4" />
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 italic">Syncing Curriculum Matrix...</p>
          </div>
      ) : enrollments.length === 0 ? (
          <div className="py-40 text-center border-2 border-dashed border-slate-100 rounded-[4rem]">
             <Target className="mx-auto w-16 h-16 text-slate-200 mb-6" />
             <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">No Active Enrollments</h3>
             <p className="text-sm font-bold text-slate-300 mt-2 italic">Student has not been assigned to any subject clusters yet.</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
             {enrollments.map((en, idx) => (
                <div key={en.id} className="bg-white border border-slate-100 rounded-[3rem] p-10 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden flex flex-col h-full">
                   {/* Background Decoration */}
                   <div className="absolute top-0 right-0 p-10 opacity-[0.03] scale-150 rotate-12 transition-transform duration-1000 group-hover:rotate-0">
                      <GraduationCap className="w-40 h-40 text-[#1e3a8a]" />
                   </div>

                   {/* Header Section */}
                   <div className="flex items-center gap-6 mb-10 relative z-10">
                      <div className={`w-20 h-20 rounded-[2rem] ${cardColors[idx % cardColors.length]} flex items-center justify-center text-white text-3xl font-black italic shadow-xl group-hover:rotate-6 transition-transform`}>
                         {en.initials}
                      </div>
                      <div>
                         <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-2">{en.subject || "General"}</h2>
                         <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Active Enrollment</p>
                         </div>
                      </div>
                   </div>

                   {/* Details Section */}
                   <div className="space-y-6 flex-1 relative z-10 border-t border-slate-50 pt-10">
                      <DetailRow icon={Users} label="Faculty Head" value={en.teacherName || "Institutional Faculty"} />
                      <DetailRow icon={MapPin} label="Classroom / Group" value={en.className || "Standard Hall"} />
                      <DetailRow icon={Clock} label="Session Schedule" value={en.schedule || "08:30 AM - 09:30 AM"} />
                      <DetailRow icon={School} label="Academic Year" value={en.academicYear || "2025-26"} />
                   </div>

                    {/* Footer Actions */}
                    <div className="mt-12 flex gap-4 relative z-10">
                       <button className="flex-1 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all active:scale-95 group/btn">
                          <Info size={20} className="group-hover/btn:scale-110 transition-transform" />
                       </button>
                       <button 
                          onClick={() => navigate('/teacher-notes', { state: { teacherId: en.teacherId } })}
                          className="flex-[3] h-16 bg-[#1e3a8a] text-white rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all"
                       >
                          <MessageSquare size={18} /> Contact Teacher
                       </button>
                    </div>
                 </div>
              ))}
           </div>
      )}

      {/* ── FOOTER STATS ── */}
      <div className="mt-16 bg-slate-900 rounded-[3rem] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-10">
         <div className="flex items-center gap-8">
            <div className="w-16 h-16 rounded-[2rem] bg-white/10 flex items-center justify-center border border-white/10">
               <ShieldCheck size={32} className="text-emerald-400" />
            </div>
            <div className="text-left">
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-300 leading-none mb-2">Identity Shield</p>
               <h3 className="text-xl font-black italic tracking-tighter">Academic Registry Verified</h3>
            </div>
         </div>
         <div className="flex gap-12 font-black italic text-right">
            <div>
               <p className="text-4xl leading-none mb-1 tracking-tighter">{enrollments.length}</p>
               <p className="text-[9px] uppercase tracking-widest text-slate-400">Total Stream Enrollments</p>
            </div>
            <div>
               <p className="text-4xl leading-none mb-1 tracking-tighter">100%</p>
               <p className="text-[9px] uppercase tracking-widest text-slate-400">Faculty Connectivity</p>
            </div>
         </div>
      </div>

    </div>
  );
};

const DetailRow = ({ icon: Icon, label, value }: any) => (
  <div className="flex items-start gap-4 group/row">
    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover/row:text-[#1e3a8a] group-hover/row:bg-blue-50 transition-all shadow-inner shrink-0">
       <Icon size={18} />
    </div>
    <div className="text-left">
       <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1 italic leading-none">{label}</p>
       <p className="text-base font-black text-slate-800 leading-tight truncate max-w-[200px]">{value}</p>
    </div>
  </div>
);

export default ClassesPage;
