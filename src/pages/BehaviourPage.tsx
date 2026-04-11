import React, { useState, useEffect } from "react";
import { 
  Trophy, AlertTriangle, Star, StarHalf, Info, Clock, 
  BookOpen, HandHeart, Lightbulb, Loader2
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, limit } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function BehaviourPage() {
  const { studentData } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [teacherNotes, setTeacherNotes] = useState<any[]>([]);
  const [manualRating, setManualRating] = useState<number | null>(null);

  useEffect(() => {
    if (!studentData?.id) return;
    setLoading(true);
    const schoolId = studentData.schoolId;

    // 1. Enrollments — single scoped query for manual rating
    const enrollQ = schoolId
      ? query(collection(db, "enrollments"), where("schoolId", "==", schoolId), where("studentId", "==", studentData.id))
      : query(collection(db, "enrollments"), where("studentId", "==", studentData.id));
    const unsubEnroll = onSnapshot(enrollQ, (snap) => {
      const ratings = snap.docs.map(d => d.data().manualBehaviourRating).filter(r => r !== undefined);
      if (ratings.length > 0) setManualRating(Math.max(...ratings));
    });

    // 2. Behavioural notes — single scoped query
    const notesQ = schoolId
      ? query(collection(db, "parent_notes"), where("schoolId", "==", schoolId), where("studentId", "==", studentData.id), limit(40))
      : query(collection(db, "parent_notes"), where("studentId", "==", studentData.id), limit(40));
    const unsubNotes = onSnapshot(notesQ, (snap) => {
      const notes = snap.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setTeacherNotes(notes);
      setLoading(false);
    });

    return () => { unsubEnroll(); unsubNotes(); };
  }, [studentData?.id, studentData?.schoolId]);

  // Determine positive vs improvement notes heuristics
  const classifyNote = (note: any) => {
    if (note.category) return note.category; // Trust structured category if exists
    
    const c = (note.content || "").toLowerCase();
    if (c.includes("late") || c.includes("forgot") || c.includes("miss") || c.includes("issue") || c.includes("distract") || c.includes("warning") || c.includes("poor") || c.includes("failing") || c.includes("talkative")) {
       return "improvement";
    }
    return "positive";
  };

  const positiveNotes = teacherNotes.filter(n => classifyNote(n) === "positive");
  const improvementNotes = teacherNotes.filter(n => classifyNote(n) === "improvement");

  const getIconForPositive = (index: number) => {
    const icons = [Star, HandHeart, Lightbulb, Trophy];
    return icons[index % icons.length];
  };

  const getIconForImprovement = (index: number) => {
    const icons = [Clock, BookOpen, AlertTriangle];
    return icons[index % icons.length];
  };

  const formatNoteDate = (note: any) => {
     try {
       if (note.createdAt && typeof note.createdAt.toDate === 'function') {
         return note.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
       } else if (note.createdAt?.toDate) {
          return note.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
       }
     } catch (e) {}
     return 'Recent';
  };

  const calculatedRating = teacherNotes.length === 0 ? 5.0 : 
    Math.min(5.0, Math.max(1.0, 5.0 - (improvementNotes.length * 0.3) + (positiveNotes.length * 0.1)));

  const rating = manualRating !== null ? manualRating.toFixed(1) : calculatedRating.toFixed(1);

  // Generate dynamic chart data from joining date to now
  const getTrendData = () => {
    const months: any = {};
    const now = new Date();
    
    // 1. Determine Start Date (Join Date)
    let startDate = new Date(now.getFullYear(), now.getMonth() - 4, 1); // default 5 months
    
    const rawJoinDate = studentData?.enrolledAt || studentData?.createdAt;
    if (rawJoinDate) {
       const jDate = rawJoinDate.toDate ? rawJoinDate.toDate() : new Date(rawJoinDate);
       startDate = new Date(jDate.getFullYear(), jDate.getMonth(), 1);
    } else if (teacherNotes.length > 0) {
       // Fallback to first note date
       const firstNoteDate = teacherNotes.reduce((earliest, current) => {
          const d = current.createdAt?.toDate ? current.createdAt.toDate() : new Date();
          return d < earliest ? d : earliest;
       }, new Date());
       startDate = new Date(firstNoteDate.getFullYear(), firstNoteDate.getMonth(), 1);
    }

    // 2. Generate all months between start and now
    let tempDate = new Date(startDate);
    while (tempDate <= now) {
       const mName = tempDate.toLocaleString('default', { month: 'short' });
       const mYear = tempDate.getFullYear().toString().slice(-2);
       const key = `${mName} ${mYear}`;
       months[key] = { m: mName, key: key, pos: 0, improv: 0, count: 0, date: new Date(tempDate) };
       tempDate.setMonth(tempDate.getMonth() + 1);
    }

    // 3. Populate Data
    teacherNotes.forEach(n => {
      const date = n.createdAt?.toDate ? n.createdAt.toDate() : new Date();
      const mName = date.toLocaleString('default', { month: 'short' });
      const mYear = date.getFullYear().toString().slice(-2);
      const key = `${mName} ${mYear}`;
      if (months[key]) {
        if (classifyNote(n) === "positive") months[key].pos++;
        else months[key].improv++;
        months[key].count++;
      }
    });

    return Object.values(months).map((data: any) => {
       const isCurrentMonth = data.m === now.toLocaleString('default', { month: 'short' }) && 
                             data.date?.getFullYear() === now.getFullYear();
       
       const calculatedScore = data.count === 0 ? 5.0 : 
          Math.min(5.0, Math.max(1.0, 5.0 - (data.improv * 0.3) + (data.pos * 0.1)));

       return {
          m: data.m,
          key: data.key,
          score: isCurrentMonth && manualRating !== null ? manualRating : calculatedScore
       };
    });
  };

  const trendData = getTrendData();

  const renderStars = (rate: number) => {
    const stars = [];
    const fullStars = Math.floor(rate);
    const hasHalfStar = rate - fullStars >= 0.5;

    for (let i = 0; i < fullStars; i++) {
       stars.push(<Star key={`full-${i}`} className="w-8 h-8 text-amber-400 fill-amber-400" />);
    }
    if (hasHalfStar) {
       stars.push(<StarHalf key="half" className="w-8 h-8 text-amber-400 fill-amber-400" />);
    }
    const emptyStars = 5 - stars.length;
    for (let i = 0; i < emptyStars; i++) {
       stars.push(<Star key={`empty-${i}`} className="w-8 h-8 text-slate-200" />);
    }
    return stars;
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-5 duration-700 pb-24 text-left font-sans mx-auto px-4 lg:px-0 pt-8 max-w-6xl">
      
      {loading ? (
        <div className="flex h-64 items-center justify-center">
           <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* HEADER SECTION */}
          <div className="mb-6">
             <h1 className="text-xl font-bold text-slate-800 uppercase tracking-widest leading-none">BEHAVIOUR & DISCIPLINE</h1>
          </div>

          <div className="space-y-6">
            
            {/* OVERALL BEHAVIOR RATING */}
            <div className="bg-white border border-slate-100 rounded-[1rem] p-8 shadow-[0px_2px_15px_rgba(0,0,0,0.02)] flex flex-col md:flex-row justify-between items-center gap-6">
               <div>
                  <h2 className="text-[19px] font-black text-slate-800 tracking-tight">Overall Behavior Rating</h2>
                  <p className="text-[13px] font-medium text-slate-400 mt-1">Based on teacher observations this term</p>
               </div>
               
               <div className="flex items-center gap-6 md:border-l md:border-slate-100 md:pl-8 h-full">
                  <div className="text-right">
                     <p className="text-5xl font-black text-emerald-500 tracking-tighter leading-none">{rating}</p>
                     <p className="text-[10px] font-black uppercase text-slate-400 mt-1.5 tracking-widest text-center">OUT OF 5</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                     {renderStars(parseFloat(rating))}
                  </div>
               </div>
            </div>

            {/* 2 COLUMNS: POSITIVE HIGHLIGHTS & AREAS FOR IMPROVEMENT */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               
               {/* POSITIVE HIGHLIGHTS */}
               <div className="bg-white border border-slate-100 rounded-[1rem] p-8 shadow-[0px_2px_15px_rgba(0,0,0,0.02)] flex flex-col">
                  <div className="flex items-center gap-3 mb-6">
                     <Trophy className="w-6 h-6 text-emerald-500 fill-emerald-100" />
                     <h2 className="text-lg font-black text-slate-800 tracking-tight">Positive Highlights</h2>
                  </div>
                  
                  <div className="space-y-4 flex-1">
                     {positiveNotes.length === 0 ? (
                        <p className="text-[14px] font-medium text-[#94a3b8] italic">No positive highlights recorded yet.</p>
                     ) : (
                        positiveNotes.map((note, idx) => {
                           const Icon = getIconForPositive(idx);
                           return (
                             <div key={note.id || idx} className="bg-white border border-emerald-200 rounded-lg p-5 flex gap-5 transition-all hover:bg-emerald-50/50 shadow-sm">
                                <Icon className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5 fill-emerald-100" />
                                <div>
                                   <p className="text-[15px] font-semibold text-slate-700 leading-snug mb-2">{note.content}</p>
                                   <div className="flex items-center gap-2 text-[12px] font-medium text-slate-400">
                                      <span>{formatNoteDate(note)}</span>
                                      {note.teacherName && (
                                        <>
                                          <span className="w-1 h-1 rounded-full bg-slate-300" />
                                          <span>{typeof note.teacherName === 'string' ? note.teacherName : 'Teacher'}</span>
                                        </>
                                      )}
                                   </div>
                                </div>
                             </div>
                           )
                        })
                     )}
                  </div>
               </div>

               {/* AREAS FOR IMPROVEMENT */}
               <div className="bg-white border border-slate-100 rounded-[1rem] p-8 shadow-[0px_2px_15px_rgba(0,0,0,0.02)] flex flex-col">
                  <div className="flex items-center gap-3 mb-6">
                     <AlertTriangle className="w-6 h-6 text-amber-500" />
                     <h2 className="text-lg font-black text-slate-800 tracking-tight">Areas for Improvement</h2>
                  </div>
                  
                  <div className="space-y-4 flex-1">
                     {improvementNotes.length === 0 ? (
                        <p className="text-[14px] font-medium text-[#94a3b8] italic">No areas for improvement recorded! Great job.</p>
                     ) : (
                        improvementNotes.map((note, idx) => {
                           const Icon = getIconForImprovement(idx);
                           return (
                             <div key={note.id || idx} className="bg-amber-50/30 border border-amber-200 rounded-lg p-5 flex gap-5 transition-all hover:bg-amber-50/70 shadow-sm">
                                <Icon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                   <p className="text-[15px] font-semibold text-slate-700 leading-snug mb-2">{note.content}</p>
                                   <div className="flex items-center gap-2 text-[12px] font-medium text-slate-400">
                                      <span>{formatNoteDate(note)}</span>
                                      {note.teacherName && (
                                        <>
                                          <span className="w-1 h-1 rounded-full bg-slate-300" />
                                          <span>{typeof note.teacherName === 'string' ? note.teacherName : 'Teacher'}</span>
                                        </>
                                      )}
                                   </div>
                                </div>
                             </div>
                           )
                        })
                     )}
                  </div>
               </div>
            </div>

            {/* BEHAVIOR TREND CHART */}
            <div className="bg-white border border-slate-100 rounded-[1rem] p-8 shadow-[0px_2px_15px_rgba(0,0,0,0.02)]">
               <h2 className="text-[17px] font-black text-slate-800 tracking-tight mb-8">Behavior Trend</h2>
               <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                           <linearGradient id="colorScore" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                              <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.4}/>
                           </linearGradient>
                           <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                              <feGaussianBlur stdDeviation="3" result="blur" />
                              <feComposite in="SourceGraphic" in2="blur" operator="over" />
                           </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="m" axisLine={false} tickLine={false} tick={{ fontSize: 13, fontWeight: 800, fill: '#cbd5e1' }} dy={10} />
                        <YAxis domain={[1, 5]} axisLine={false} tickLine={false} tick={{ fontSize: 13, fontWeight: 800, fill: '#cbd5e1' }} dx={-10} />
                        <Tooltip 
                           contentStyle={{ borderRadius: '2rem', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', fontWeight: '900', textTransform: 'uppercase', fontStyle: 'italic', fontSize: '10px', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(10px)' }} 
                           labelStyle={{ color: '#6366f1', marginBottom: '4px' }}
                        />
                        <Area 
                           type="monotone" 
                           dataKey="score" 
                           stroke="url(#lineGradient)" 
                           fillOpacity={1} 
                           fill="url(#colorScore)" 
                           strokeWidth={5} 
                           dot={{ r: 6, fill: '#6366f1', strokeWidth: 3, stroke: '#fff' }}
                           activeDot={{ r: 8, strokeWidth: 0, fill: '#10b981' }}
                           filter="url(#glow)"
                        />
                        <defs>
                           <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#6366f1" />
                              <stop offset="50%" stopColor="#8b5cf6" />
                              <stop offset="100%" stopColor="#10b981" />
                           </linearGradient>
                        </defs>
                     </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
