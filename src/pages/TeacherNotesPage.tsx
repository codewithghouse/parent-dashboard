import { useState, useEffect, useRef, useMemo } from "react";
import {
  MessageSquare, Search, CheckCircle2, MoreVertical, Send, User, Paperclip, Smile, ChevronLeft, Clock, Phone, Video, Check, CheckCheck, GraduationCap, Mic, Loader2, Sparkles, Bot, Plus, X
} from "lucide-react";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, writeBatch } from "firebase/firestore";
import { useAuth } from "../lib/AuthContext";
import { toast } from "sonner";
import { ParentAIController } from "../ai/controller/ai-controller";
import { useLocation } from "react-router-dom";

const TeacherNotesPage = () => {
  const { studentData } = useAuth();
  const location = useLocation();
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [allNotes, setAllNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [availableTeachers, setAvailableTeachers] = useState<any[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!studentData?.id) return;
    setLoading(true);
    const sEmail = studentData.email?.toLowerCase() || "";
    const sId = studentData.id;

    // 1. Multi-Stream Universal Discourse Fetch
    const processNotes = (snapArray: any[]) => {
        const combined = snapArray.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
        const seenIds = new Set();
        const data = combined.filter(d => { 
           if(!seenIds.has(d.id)) { seenIds.add(d.id); return true; } 
           return false; 
        }).map(d => ({ 
           ...d, 
           createdAt: d.createdAt || d.timestamp || serverTimestamp() 
        }));
        data.sort((a:any, b:any) => (a.createdAt?.toMillis?.() || a.createdAt?.toSeconds?.() * 1000 || 0) - (b.createdAt?.toMillis?.() || b.createdAt?.toSeconds?.() * 1000 || 0));
        setAllNotes(data);
        setLoading(false);
    };

    let s1:any=[], s2:any=[], s3:any=[];
    const unsub1 = onSnapshot(query(collection(db, "parent_notes"), where("studentId", "==", sId)), (snap) => { s1=snap; processNotes([s1,s2,s3]); });
    const unsub2 = onSnapshot(query(collection(db, "parent_notes"), where("studentEmail", "==", sEmail)), (snap) => { s2=snap; processNotes([s1,s2,s3]); });
    const unsub3 = onSnapshot(query(collection(db, "performance_feedback"), where("studentId", "==", sId)), (snap) => { s3=snap; processNotes([s1,s2,s3]); });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [studentData?.id]);

  // Fetch teachers for "New Conversation"
  useEffect(() => {
    if (!studentData?.id && !studentData?.classId) return;
    const fetchTeachers = async () => {
      try {
        const classId = studentData.classId;
        if (!classId) return;
        const snap = await getDocs(query(collection(db, "teaching_assignments"), where("classId", "==", classId)));
        if (snap.empty) return;
        const teacherIds = snap.docs.map(d => d.data().teacherId).filter(Boolean);
        if (teacherIds.length === 0) return;
        const tSnap = await getDocs(query(collection(db, "teachers"), where("__name__", "in", teacherIds.slice(0, 10))));
        setAvailableTeachers(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch { /* silently fail */ }
    };
    fetchTeachers();
  }, [studentData?.id, studentData?.classId]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [allNotes, selectedTeacher]);

  const teacherConversations = useMemo(() => {
    const map = new Map();
    [...allNotes].reverse().forEach(n => {
      const tId = n.teacherId;
      if (tId && !map.has(tId)) {
        map.set(tId, {
          teacherId: tId,
          teacherName: n.teacherName || "Faculty Member",
          subject: n.subject || "Academic Registry",
          lastMessage: n
        });
      }
    });
    return Array.from(map.values()).filter(t => 
      t.teacherName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.subject?.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => (b.lastMessage.createdAt?.toMillis?.() || 0) - (a.lastMessage.createdAt?.toMillis?.() || 0));
  }, [allNotes, searchQuery]);

  useEffect(() => {
    if (location.state?.teacherId && teacherConversations.length > 0) {
      const match = teacherConversations.find(t => t.teacherId === location.state.teacherId);
      if (match) setSelectedTeacher(match);
    }
  }, [location.state, teacherConversations]);

  const chatMessages = useMemo(() => 
    selectedTeacher ? allNotes.filter(n => n.teacherId === selectedTeacher.teacherId) : []
  , [allNotes, selectedTeacher]);

  const handleSendMessage = async () => {
    if (!selectedTeacher || !messageContent.trim()) return;
    const content = messageContent.trim();
    setMessageContent("");
    try {
      await addDoc(collection(db, "parent_notes"), {
        teacherId: selectedTeacher.teacherId,
        teacherName: selectedTeacher.teacherName,
        studentId: studentData.id,
        studentEmail: studentData.email?.toLowerCase() || "",
        studentName: studentData.name,
        parentName: `Parent of ${studentData.name}`,
        subject: selectedTeacher.subject,
        content,
        status: "Sent",
        from: "parent",
        createdAt: serverTimestamp()
      });
    } catch (e) { toast.error("Sync failure."); setMessageContent(content); }
  };

  const generateAI = async () => {
    if (!selectedTeacher) return;
    setIsGenerating(true);
    try {
      const result = await ParentAIController.getParentReplyDraft({ scholar_name: studentData.name, context: messageContent || "General Scholastic Discussion" });
      if (result.status === "success" && result.data?.draft) setMessageContent(result.data.draft);
    } catch (e) { toast.error("AI Busy."); } finally { setIsGenerating(false); }
  };

  const stats = useMemo(() => {
    const total = allNotes.length;
    let pending = 0, resolved = 0;
    const threads = new Map();
    allNotes.forEach(n => threads.set(n.teacherId, n.from));
    threads.forEach(from => from === 'teacher' ? pending++ : resolved++);
    return { total, pending, resolved };
  }, [allNotes]);

  return (
    <div className="h-full flex flex-col font-sans text-left -mt-6">
      <div className="bg-[#00a884] rounded-[3.5rem] p-16 mb-10 shadow-2xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-16 opacity-10 scale-150 rotate-12 transition-all group-hover:rotate-45 duration-1000"><GraduationCap size={240} className="text-white"/></div>
         <div className="relative z-10">
            <h1 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-none mb-4">Faculty Liaison</h1>
            <p className="text-xl font-bold text-teal-50 max-w-xl">Verified, real-time academic discourse between <span className="text-white underline">Guardians</span> and <span className="text-white underline">Educators</span>.</p>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 px-4">
         {[
            { label: "Submissions Hub", key: "total", icon: MessageSquare, color: "bg-teal-50 text-teal-600" },
            { label: "Action Required", key: "pending", icon: Clock, color: "bg-amber-50 text-amber-600" },
            { label: "Archive Trace", key: "resolved", icon: CheckCircle2, color: "bg-emerald-50 text-emerald-600" },
         ].map(s => (
            <div key={s.key} className="bg-white p-10 rounded-[3rem] border border-slate-100 flex items-center justify-between shadow-sm hover:shadow-2xl transition-all">
               <div><p className="text-[11px] font-black text-slate-300 uppercase tracking-widest mb-2">{s.label}</p><h4 className="text-5xl font-black text-slate-900">{stats[s.key as keyof typeof stats]}</h4></div>
               <div className={`w-20 h-20 rounded-[2.5rem] flex items-center justify-center ${s.color}`}><s.icon className="w-10 h-10" /></div>
            </div>
         ))}
      </div>

      <div className="flex-1 flex bg-white border border-slate-200 rounded-[4rem] shadow-2xl overflow-hidden mb-8 relative min-h-[600px]">
        <div className={`w-full md:w-[460px] border-r border-slate-100 flex flex-col bg-slate-50/20 ${selectedTeacher ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-10">
             <div className="relative group">
                <input type="text" placeholder="Filter educators..." value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} className="w-full pl-16 pr-8 h-16 bg-white border border-slate-100 rounded-[2rem] text-sm font-black focus:ring-4 focus:ring-emerald-500/10 transition-all uppercase tracking-widest placeholder:text-slate-200" />
                <Search className="w-6 h-6 text-slate-300 absolute left-6 top-1/2 -translate-y-1/2" />
             </div>
             <button onClick={() => setShowNewChat(true)} className="mt-4 w-full flex items-center justify-center gap-3 h-14 bg-[#00a884] text-white rounded-[2rem] text-sm font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20">
               <Plus className="w-5 h-5" /> New Message
             </button>
          </div>

          {/* New Conversation Modal */}
          {showNewChat && (
            <div className="absolute inset-0 bg-white z-50 flex flex-col rounded-l-[4rem] overflow-hidden">
              <div className="p-10 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Select Teacher</h3>
                <button onClick={() => setShowNewChat(false)} className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-all"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {availableTeachers.length === 0 ? (
                  <div className="text-center py-16 text-slate-300 font-black uppercase text-xs tracking-widest">No class teachers found</div>
                ) : (
                  availableTeachers.map(t => (
                    <button key={t.id} onClick={() => {
                      setSelectedTeacher({ teacherId: t.id, teacherName: t.name, subject: t.subject || "General" });
                      setShowNewChat(false);
                    }} className="w-full flex items-center gap-6 p-6 rounded-[2rem] hover:bg-slate-50 transition-all border border-slate-50 mb-3">
                      <div className="w-16 h-16 rounded-[2rem] bg-slate-100 flex items-center justify-center text-xl font-black text-slate-400">{t.name?.substring(0,2).toUpperCase()}</div>
                      <div className="text-left">
                        <p className="font-black text-slate-800 uppercase tracking-tight">{t.name}</p>
                        <p className="text-xs text-emerald-600 font-black uppercase tracking-widest">{t.subject || "Teacher"}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-10">
             {loading ? <div className="p-20 text-center animate-pulse"><Loader2 size={40} className="animate-spin mx-auto text-slate-100" /></div> :
                teacherConversations.map(t => {
                   const active = selectedTeacher?.teacherId === t.teacherId;
                   return (
                     <button key={t.teacherId} onClick={()=>setSelectedTeacher(t)} className={`w-full p-10 flex items-center gap-8 border-b border-slate-50 transition-all rounded-[3rem] mb-4 ${active ? 'bg-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] z-20 translate-x-2 border-emerald-100 ring-2 ring-emerald-50' : 'hover:bg-white/50'}`}>
                        <div className={`w-20 h-20 rounded-[2.2rem] flex items-center justify-center text-xl font-black shadow-inner transition-all ${active ? 'bg-[#00a884] text-white rotate-2' : 'bg-slate-100 text-slate-300'}`}>{t.teacherName?.substring(0,2).toUpperCase()}</div>
                        <div className="flex-1 text-left truncate">
                           <div className="flex justify-between items-center mb-1"><h4 className="text-xl font-black text-slate-900 truncate uppercase tracking-tighter italic leading-none">{t.teacherName}</h4><span className="text-[10px] font-black text-slate-300 uppercase">{new Date(t.lastMessage.createdAt?.toDate?.() || Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div>
                           <p className="text-[11px] text-emerald-600 font-black uppercase tracking-widest mb-2 italic">{t.subject}</p>
                           <p className={`text-[13px] truncate ${active ? 'text-emerald-800 font-black' : 'text-slate-400 font-bold'}`}>{t.lastMessage.from === 'parent' ? '✓ ' : ''}{t.lastMessage.content}</p>
                        </div>
                     </button>
                   );
                })}
          </div>
        </div>

        <div className={`flex-1 flex flex-col ${!selectedTeacher ? 'hidden md:flex' : 'flex'} relative bg-[#fdfdfd]`}>
          {selectedTeacher ? (
            <>
              <div className="px-12 py-8 bg-[#f0f2f5] border-b border-slate-200 flex justify-between items-center z-20 shadow-sm">
                 <div className="flex items-center gap-8">
                    <button onClick={()=>setSelectedTeacher(null)} className="md:hidden p-3 hover:bg-slate-200 rounded-full"><ChevronLeft size={32}/></button>
                    <div className="w-16 h-16 rounded-[2rem] bg-emerald-100 flex items-center justify-center p-0.5 border-4 border-white shadow-xl overflow-hidden text-[#00a884]"><User size={32}/></div>
                    <div>
                       <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-none mb-1">{selectedTeacher.teacherName}</h3>
                       <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] flex items-center gap-2 animate-pulse"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Secure Protocol Active</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-4">
                    <button className="h-16 w-16 bg-white flex items-center justify-center text-slate-400 hover:text-[#00a884] rounded-2xl shadow-sm transition-all"><Video size={28}/></button>
                    <button className="h-16 w-16 bg-white flex items-center justify-center text-slate-400 hover:text-[#00a884] rounded-2xl shadow-sm transition-all"><Phone size={24}/></button>
                    <div className="w-px h-10 bg-slate-300 mx-3" />
                    <button className="h-16 w-16 bg-white flex items-center justify-center text-slate-300 hover:text-slate-900 rounded-2xl transition-all"><MoreVertical size={28}/></button>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-12 space-y-8 custom-scrollbar flex flex-col z-10 bg-white/40">
                 {chatMessages.map((n, i) => {
                    const isM = n.from === "parent";
                    return (
                      <div key={n.id} className={`flex flex-col ${isM ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-6 duration-500`}>
                         <div className={`relative px-10 py-6 rounded-[2.5rem] text-[16px] shadow-sm font-bold max-w-[85%] ${isM ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'}`}>
                            <p className="whitespace-pre-wrap leading-relaxed">{n.content}</p>
                            <div className="mt-4 flex items-center justify-end gap-2 opacity-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                               {new Date(n.createdAt?.toDate?.() || Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                               {isM && <CheckCheck className="w-5 h-5 text-blue-500 ml-1" />}
                            </div>
                         </div>
                      </div>
                    );
                 })}
                 <div ref={chatEndRef} />
              </div>

              <div className="p-10 bg-[#f0f2f5] border-t border-slate-100 z-20">
                 <div className="flex items-center gap-6 bg-white p-4 rounded-[3.5rem] border border-slate-100 shadow-2xl">
                    <button className="h-16 w-16 bg-slate-50 text-slate-300 hover:text-[#00a884] rounded-full flex items-center justify-center transition-all shrink-0 shadow-inner"><Smile size={32}/></button>
                    <div className="flex-1 bg-slate-50/50 rounded-[2.5rem] flex items-center pr-6 overflow-hidden border border-slate-50 shadow-inner">
                       <textarea rows={1} value={messageContent} onChange={(e)=>setMessageContent(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSendMessage();}}} placeholder="Compose scholarly response..." className="flex-1 bg-transparent border-none focus:ring-0 px-8 py-5 text-sm font-black resize-none no-scrollbar min-h-[60px]" />
                       <button onClick={generateAI} disabled={isGenerating} className="h-12 w-12 flex items-center justify-center text-teal-600 hover:bg-teal-50 rounded-2xl transition-all shrink-0">{isGenerating ? <Loader2 className="animate-spin" size={24}/> : <Sparkles size={28}/>}</button>
                    </div>
                    <button onClick={handleSendMessage} disabled={!messageContent.trim()} className={`h-20 w-20 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-2xl shrink-0 ${messageContent.trim() ? 'bg-[#00a884] text-white shadow-[#00a884]/40' : 'bg-slate-200 text-slate-400'}`}><Send size={32}/></button>
                 </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-24 text-center relative z-10 glass-mesh">
               <div className="w-56 h-56 bg-white rounded-full shadow-[0_60px_120px_-20px_rgba(0,168,132,0.2)] flex items-center justify-center mb-16 border-8 border-slate-50 group hover:rotate-12 transition-all duration-700">
                  <GraduationCap className="w-20 h-20 text-slate-100 group-hover:text-[#00a884] transition-colors" />
               </div>
               <h2 className="text-6xl font-black text-slate-900 mb-6 uppercase tracking-tighter italic">Educator Liaison</h2>
               <p className="text-[13px] font-black text-slate-300 max-w-sm uppercase tracking-[0.4em] leading-relaxed">Select a faculty member to initiate a verified scholastic discourse node.</p>
               <div className="absolute bottom-20 text-[11px] font-black text-[#00a884] uppercase tracking-[0.6em] flex items-center gap-4 animate-pulse"><Bot size={24} /> Neural Communication Ledger Active</div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,168,132,0.1); border-radius: 12px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .glass-mesh { background-image: radial-gradient(#cbd5e1 1.2px, transparent 1.2px); background-size: 40px 40px; }
      `}</style>
    </div>
  );
};
export default TeacherNotesPage;
