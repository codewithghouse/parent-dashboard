import { useState, useEffect, useRef, useMemo } from "react";
import { 
  MessageSquare, Search, CheckCircle2, MoreVertical, Send, User, Paperclip, Smile, ChevronLeft, Clock, Phone, Video, Check, CheckCheck, GraduationCap, Mic
} from "lucide-react";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, writeBatch } from "firebase/firestore";
import { useAuth } from "../lib/AuthContext";
import { toast } from "sonner";
import { ParentAIController } from "../ai/controller/ai-controller";
import { useLocation } from "react-router-dom";

const ParentTeacherNotes = () => {
  const { studentData } = useAuth();
  const location = useLocation();
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [allNotes, setAllNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageContent, setMessageContent] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!studentData?.name) return;
    const q = query(collection(db, "parent_notes"), where("studentName", "==", studentData.name));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a:any, b:any) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
      setAllNotes(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [studentData?.name]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [allNotes, selectedTeacher]);

  const teacherConversations = useMemo(() => {
    const map = new Map();
    [...allNotes].reverse().forEach(n => {
      if (!map.has(n.teacherId)) {
        map.set(n.teacherId, {
          teacherId: n.teacherId,
          teacherName: n.teacherName,
          subject: n.subject || "Faculty Member",
          lastMessage: n
        });
      }
    });
    return Array.from(map.values()).filter(t => 
      t.teacherName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.subject?.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => (b.lastMessage.createdAt?.toMillis?.() || 0) - (a.lastMessage.createdAt?.toMillis?.() || 0));
  }, [allNotes, searchQuery]);

  // Deep Link Selection Effect
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



  const stats = useMemo(() => {
    const total = allNotes.length;
    const teacherThreads = new Map();
    allNotes.forEach(n => {
      teacherThreads.set(n.teacherId, n.from);
    });
    let pending = 0;
    let resolved = 0;
    teacherThreads.forEach((lastFrom) => {
      if (lastFrom === 'teacher') pending++;
      else resolved++;
    });
    return { total, pending, resolved };
  }, [allNotes]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col font-sans -mt-4">
      <div className="flex justify-between items-center mb-6 px-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none mb-1 italic">Teacher Notes</h1>
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Secure Communication Hub
          </div>
        </div>
        <div className="flex gap-4">
          {[
            { label: "Total Logs", key: "total", icon: MessageSquare, color: "bg-blue-50 text-blue-500" },
            { label: "Pending", key: "pending", icon: Clock, color: "bg-amber-50 text-amber-500" },
            { label: "Resolved", key: "resolved", icon: CheckCircle2, color: "bg-emerald-50 text-emerald-500" },
          ].map(s => (
            <div key={s.key} className="bg-white px-5 py-3 rounded-2xl flex items-center gap-3 border border-slate-100 shadow-sm transition-all hover:shadow-md">
                 <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.color}`}><s.icon className="w-4 h-4" /></div>
                 <div><p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">{s.label}</p><p className="text-sm font-black text-slate-900 leading-none">{stats[s.key as keyof typeof stats]}</p></div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl overflow-hidden mb-4">
        <div className={`w-full md:w-[380px] border-r border-slate-100 flex flex-col bg-slate-50/10 ${selectedTeacher ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-6">
             <div className="relative group">
                <input type="text" placeholder="Search educators..." value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 h-14 bg-white border border-slate-100 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-emerald-50 transition-all uppercase tracking-widest placeholder:text-slate-200" />
                <Search className="w-5 h-5 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2" />
             </div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar">
             {loading ? <div className="p-10 text-center animate-pulse font-black text-slate-300 uppercase text-xs">Syncing Registry...</div> :
                teacherConversations.map(t => {
                  const active = selectedTeacher?.teacherId === t.teacherId;
                  return (
                    <button key={t.teacherId} onClick={()=>setSelectedTeacher(t)} className={`w-full p-6 flex items-center gap-4 border-b border-slate-50 transition-all ${active ? 'bg-white shadow-xl z-20 translate-x-1' : 'hover:bg-white'}`}>
                       <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-sm font-black shadow-inner transition-all ${active ? 'bg-[#00a884] text-white rotate-3' : 'bg-slate-50 text-slate-200'}`}>{t.teacherName?.substring(0,2).toUpperCase()}</div>
                       <div className="flex-1 text-left truncate">
                          <div className="flex justify-between items-center mb-0.5">
                            <h4 className="text-sm font-black text-slate-900 truncate uppercase tracking-tight">{t.teacherName}</h4>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(t.lastMessage.createdAt?.toDate?.() || Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                          </div>
                          <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mb-1">{t.subject}</p>
                          <p className={`text-[11px] truncate ${active ? 'text-[#00a884] font-bold' : 'text-slate-400 font-semibold'}`}>{t.lastMessage.from === 'parent' ? '✓ ' : ''}{t.lastMessage.content}</p>
                       </div>
                    </button>
                  );
                })}
          </div>
        </div>

        <div className={`flex-1 flex flex-col ${!selectedTeacher ? 'hidden md:flex' : 'flex'} relative bg-[#efeae2]`}>
          {selectedTeacher ? (
            <>
              <div className="chat-doodle absolute inset-0 opacity-[0.05] pointer-events-none z-0" />
              <div className="px-8 py-3 bg-[#f0f2f5] border-b border-slate-200 flex justify-between items-center z-20 shadow-sm">
                 <div className="flex items-center gap-4">
                    <button onClick={()=>setSelectedTeacher(null)} className="md:hidden p-2 hover:bg-slate-200 rounded-full"><ChevronLeft/></button>
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center p-0.5 border border-white shadow-sm overflow-hidden"><User className="text-slate-400"/></div>
                    <div>
                       <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight leading-none mb-1">{selectedTeacher.teacherName}</h3>
                       <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2 animate-pulse"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {selectedTeacher.subject}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-1">
                    <button className="p-2.5 text-slate-500 hover:bg-slate-200 rounded-full transition-all"><Video size={20}/></button>
                    <button className="p-2.5 text-slate-500 hover:bg-slate-200 rounded-full transition-all"><Phone size={18}/></button>
                    <div className="w-px h-6 bg-slate-300 mx-1" />
                    <button className="p-2.5 text-slate-500 hover:bg-slate-200 rounded-full transition-all"><MoreVertical size={20}/></button>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-4 custom-scrollbar flex flex-col z-10">
                 {chatMessages.map((n, i) => {
                    const isM = n.from === "parent";
                    return (
                      <div key={n.id} className={`flex flex-col ${isM ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                         <div className={`relative px-4 py-2 rounded-2xl text-[14px] shadow-sm font-medium ${isM ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none'}`}>
                            {isM && <div className="absolute top-0 -right-2 w-0 h-0 border-[8px] border-transparent border-l-[#d9fdd3] border-t-[#d9fdd3]" />}
                            {!isM && <div className="absolute top-0 -left-2 w-0 h-0 border-[8px] border-transparent border-r-white border-t-white" />}
                            <p className="whitespace-pre-wrap leading-relaxed">{n.content}</p>
                            <div className="mt-1 flex items-center justify-end gap-1 opacity-40 text-[9px] font-black uppercase">
                               {new Date(n.createdAt?.toDate?.() || Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                               {isM && <CheckCheck className="w-3.5 h-3.5 text-blue-500 ml-1" />}
                            </div>
                         </div>
                      </div>
                    );
                 })}
                 <div ref={chatEndRef} />
              </div>

              <div className="p-4 bg-[#f0f2f5] border-t border-slate-200 z-20">
                 <div className="flex items-center gap-3">
                    <button className="p-2 text-slate-500 hover:bg-slate-300 rounded-full"><Smile size={24}/></button>
                    <button className="p-2 text-slate-500 hover:bg-slate-300 rounded-full"><Paperclip size={20}/></button>
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center pr-2">
                       <textarea rows={1} value={messageContent} onChange={(e)=>setMessageContent(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSendMessage();}}} placeholder="Type a response to educator..." className="flex-1 bg-transparent border-none focus:ring-0 p-3 text-sm font-medium resize-none no-scrollbar" />

                    </div>
                    <button onClick={handleSendMessage} disabled={!messageContent.trim()} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg ${messageContent.trim() ? 'bg-[#00a884] text-white shadow-[#00a884]/20' : 'bg-slate-300 text-slate-500'}`}><Send size={20}/></button>
                 </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center relative z-10">
               <div className="w-32 h-32 bg-white rounded-full shadow-2xl flex items-center justify-center mb-10 border-4 border-slate-50 group transition-all hover:scale-105 hover:rotate-3"><GraduationCap className="w-12 h-12 text-slate-100 group-hover:text-[#00a884] transition-colors" /></div>
               <h2 className="text-3xl font-black text-slate-800 mb-2 uppercase tracking-tight italic">Educator Communications</h2>
               <p className="text-xs font-bold text-slate-400 max-w-xs uppercase tracking-[0.2em] leading-relaxed">Select a faculty member to view historical academic records and initiate secure discourse.</p>
               <div className="mt-12 flex gap-8 opacity-20 grayscale"><Mic size={32}/><Clock size={32}/><CheckCheck size={32}/></div>
               <div className="absolute bottom-10 text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-full opacity-50"/> End-to-End Secure Channel</div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .chat-doodle { background-image: url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png'); background-repeat: repeat; filter: contrast(0.5); }
      `}</style>
    </div>
  );
};
export default ParentTeacherNotes;
