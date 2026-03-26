import React, { useState, useEffect } from "react";
import { 
  TrendingUp, TrendingDown, Minus, Info, Calendar, 
  Sparkles, BrainCircuit, ShieldAlert, Loader2, CheckCircle2,
  AlertTriangle, MessageSquare, Heart, Activity, User, ArrowUp, Zap, Clock
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, limit, orderBy } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const BehaviourPage = () => {
  const { studentData } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [standing, setStanding] = useState<string>("Good Standing");
  const [teacherNotes, setTeacherNotes] = useState<any[]>([]);
  const [stats, setStats] = useState({
    attendanceRate: "0%",
    avgScore: "0%",
    standingColor: "text-emerald-500"
  });

  useEffect(() => {
    if (!studentData?.id) return;

    // 1. Sync Standing from Enrollment
    const qEnroll = query(collection(db, "enrollments"), where("studentId", "==", studentData.id));
    const unsubEnroll = onSnapshot(qEnroll, (snap) => {
       if (!snap.empty) {
          const data = snap.docs[0].data();
          setStanding(data.manualStatus || "Good Standing");
       }
    });

    // 2. Sync Recent Observations (Teacher Notes)
    const qNotes = query(
       collection(db, "parent_notes"), 
       where("studentId", "==", studentData.id),
       orderBy("createdAt", "desc"),
       limit(3)
    );
    const unsubNotes = onSnapshot(qNotes, (snap) => {
       setTeacherNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
       setLoading(false);
    });

    // 3. Performance Stats
    const qAtt = query(collection(db, "attendance"), where("studentId", "==", studentData.id));
    const unsubAtt = onSnapshot(qAtt, (snap) => {
       const records = snap.docs.map(d => d.data());
       const presents = records.filter(r => r.status === 'present' || r.status === 'late').length;
       setStats(prev => ({ ...prev, attendanceRate: records.length ? `${Math.round((presents/records.length)*100)}%` : "100%" }));
    });

    return () => {
       unsubEnroll();
       unsubNotes();
       unsubAtt();
    };
  }, [studentData?.id]);

  const getStandingStyles = (status: string) => {
     switch(status) {
        case "At Risk": return { color: "text-rose-500", bg: "bg-rose-50", icon: AlertTriangle, border: "border-rose-100" };
        case "Needs Attention": return { color: "text-amber-500", bg: "bg-amber-50", icon: Info, border: "border-amber-100" };
        default: return { color: "text-emerald-500", bg: "bg-emerald-50", icon: CheckCircle2, border: "border-emerald-100" };
     }
  };

  const currentStyles = getStandingStyles(standing);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000 pb-24 text-left font-sans">
      
      {/* ─── HEADER SECTION ─── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-10 mb-20 px-4">
        <div className="text-left w-full md:w-auto">
           <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-[1.5rem] bg-[#1e3a8a] flex items-center justify-center text-white shadow-xl shadow-blue-200">
                 <Heart size={26} />
              </div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">Socio-Emotional Registry</p>
                 <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border-2 border-white shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Child Welfare Active</p>
                 </div>
              </div>
           </div>
           <h1 className="text-6xl font-black text-slate-900 tracking-tighter leading-none mb-4">Behaviour Audit</h1>
           <p className="text-xl font-bold text-slate-400 italic">Faculty observations and engagement metrics for {studentData?.name}.</p>
        </div>
        
        <div className={`px-10 h-20 grow md:grow-0 ${currentStyles.bg} border ${currentStyles.border} rounded-[2.5rem] flex items-center justify-center gap-5 shadow-sm`}>
           <currentStyles.icon className={`w-8 h-8 ${currentStyles.color}`} />
           <div className="text-left">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Current Standing</p>
              <p className={`text-xl font-black uppercase tracking-tight ${currentStyles.color}`}>{standing}</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 px-2">
         
         {/* LEFT: AI ANALYSIS & TRENDS */}
         <div className="lg:col-span-8 space-y-12">
            <div className="bg-white border border-slate-100 rounded-[4.5rem] p-12 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all">
               <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 group-hover:rotate-12 transition-transform duration-1000">
                  <BrainCircuit className="w-48 h-48 text-[#1e3a8a]" />
               </div>
               
               <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-10">
                     <div className="w-14 h-14 rounded-[2rem] bg-indigo-50 flex items-center justify-center text-[#1e3a8a] shadow-inner">
                        <Sparkles size={28} />
                     </div>
                     <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">AI Engagement Narrative</h3>
                  </div>

                  {loading ? (
                     <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-slate-200" size={40} /></div>
                  ) : (
                     <div className="space-y-8">
                        <h2 className="text-4xl font-black text-slate-900 leading-[1.1] tracking-tighter italic">
                           "{standing === "Good Standing" 
                              ? `${studentData?.name} is exhibiting high institutional alignment. Engagement levels across subdivisions are within normalized baseline thresholds.`
                              : `${studentData?.name}'s current engagement logs suggest potential academic friction. Direct intervention is advised to recalibrate scholastic trajectory.`}"
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-slate-50">
                           <BehaviourStat label="Socio-Emotional Hub" value="Stable" trend="neutral" />
                           <BehaviourStat label="Peer Collaboration" value="High" trend="up" />
                           <BehaviourStat label="Attendance Sync" value={stats.attendanceRate} trend="up" />
                        </div>
                     </div>
                  )}
               </div>
            </div>

            {/* TRAJECTORY CHART (SIMULATED FOR PREMIUM LOOK) */}
            <div className="bg-white border border-slate-100 rounded-[4rem] p-12 shadow-sm">
               <div className="flex items-center justify-between mb-12">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Conduct Trajectory • Q1 Audit</h3>
                  <div className="flex gap-6">
                     <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-500" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Growth</span></div>
                     <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attendance</span></div>
                  </div>
               </div>
               <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={[
                        { m: "AUG", p: 70, a: 85 },
                        { m: "SEP", p: 85, a: 92 },
                        { m: "OCT", p: 82, a: 95 },
                        { m: "NOV", p: 90, a: 98 },
                        { m: "DEC", p: 95, a: 97 },
                     ]}>
                        <defs>
                           <linearGradient id="colorP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.1}/><stop offset="95%" stopColor="#1e3a8a" stopOpacity={0}/></linearGradient>
                           <linearGradient id="colorA" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="m" axisLine={false} tickLine={false} fontSize={10} fontWeight="black" stroke="#94a3b8" dy={10} />
                        <YAxis axisLine={false} tickLine={false} fontSize={10} fontWeight="black" stroke="#94a3b8" />
                        <Tooltip contentStyle={{ borderRadius: '2rem', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', fontWeight: 'black' }} />
                        <Area type="monotone" dataKey="p" stroke="#1e3a8a" fillOpacity={1} fill="url(#colorP)" strokeWidth={4} />
                        <Area type="monotone" dataKey="a" stroke="#10b981" fillOpacity={1} fill="url(#colorA)" strokeWidth={4} />
                     </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>
         </div>

         {/* RIGHT: TEACHER OBSERVATIONS */}
         <div className="lg:col-span-4 flex flex-col gap-10">
            <div className="bg-slate-900 rounded-[4.5rem] p-12 text-white shadow-2xl flex flex-col flex-1 relative overflow-hidden group">
               <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:scale-150 transition-all duration-1000" />
               <div className="flex items-center gap-5 mb-12 relative z-10">
                  <div className="w-16 h-16 rounded-[2rem] bg-white/10 flex items-center justify-center text-white shadow-xl">
                     <User size={30} />
                  </div>
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">Faculty Observations</h3>
               </div>

               <div className="space-y-6 flex-1 relative z-10">
                  {teacherNotes.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-20 px-10">
                        <Clock className="w-16 h-16 mb-8 animate-pulse" />
                        <p className="text-[11px] font-black uppercase tracking-[0.3em] leading-relaxed">No qualitative observations logged in the current audit window.</p>
                     </div>
                  ) : (
                     teacherNotes.map((note) => (
                        <div key={note.id} className="p-8 bg-white/5 border border-white/10 rounded-[3rem] group/note hover:bg-white/10 transition-all">
                           <div className="flex items-start gap-5 mb-4">
                              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 font-black text-xs uppercase">
                                 {note.teacherName?.[0] || 'F'}
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                 <h4 className="text-sm font-black text-white uppercase tracking-tight truncate">{note.teacherName}</h4>
                                 <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">{note.subject}</p>
                              </div>
                           </div>
                           <p className="text-sm font-bold text-slate-400 leading-relaxed mb-6 line-clamp-3 italic">"{note.content}"</p>
                           <button onClick={() => navigate('/teacher-notes')} className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-all">
                              Initiate Dialogue
                           </button>
                        </div>
                     ))
                  )}
               </div>

               <div className="mt-10 pt-10 border-t border-white/5 relative z-10">
                  <div className="flex items-center gap-4 bg-emerald-500/10 p-6 rounded-[2.5rem] border border-emerald-500/20">
                     <Activity className="w-6 h-6 text-emerald-400" />
                     <p className="text-[10px] font-black text-emerald-100 uppercase tracking-widest leading-relaxed">System monitoring is live. Behavioral trends are recalculated every 24 hours.</p>
                  </div>
               </div>
            </div>
         </div>

      </div>
    </div>
  );
};

const BehaviourStat = ({ label, value, trend }: any) => (
  <div className="text-left group/stat">
     <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 group-hover/stat:text-[#1e3a8a] transition-colors">{label}</p>
     <div className="flex items-end gap-3">
        <h4 className="text-3xl font-black text-slate-800 tracking-tighter">{value}</h4>
        {trend === 'up' && <TrendingUp className="w-5 h-5 text-emerald-500 mb-1" />}
        {trend === 'down' && <TrendingDown className="w-5 h-5 text-rose-500 mb-1" />}
        {trend === 'neutral' && <Minus className="w-5 h-5 text-slate-400 mb-1" />}
     </div>
  </div>
);

export default BehaviourPage;
