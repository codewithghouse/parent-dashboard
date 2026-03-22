import { useState, useEffect } from "react";
import { 
  MessageSquare, Pin, Search, Filter, Mic, ChevronDown, 
  Sparkles, BrainCircuit, MessageCircle, Reply, Info, Loader2,
  Calendar, User
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";

const TeacherNotesPage = () => {
  const { studentData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  useEffect(() => {
    if (!studentData?.id) return;

    setLoading(true);
    // Fetching from a generic 'communications' or 'teacher_notes' collection
    // We'll look for notes specifically for this student
    const q = query(
      collection(db, "communications"),
      where("student", "==", studentData.name), // In teacher dashboard it's student name
      orderBy("time", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotes(data);
      setLoading(false);
    }, (error) => {
      console.error("Teacher Notes Sync Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [studentData]);

  const filteredNotes = notes.filter(n => {
    const matchesSearch = n.subject?.toLowerCase().includes(search.toLowerCase()) || 
                          n.content?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter === "All" || n.type === activeFilter;
    return matchesSearch && matchesFilter;
  });

  return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-12">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              Teacher Records <Pin className="w-8 h-8 text-indigo-600" />
            </h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">Direct logs from the instructional team for {studentData?.name || "Student"}</p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input 
                  type="text" 
                  placeholder="Search logs..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-12 pr-6 py-3.5 bg-white border-2 border-slate-50 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-indigo-100 transition-all w-64 shadow-sm"
                />
             </div>
             <button className="p-3.5 bg-white border-2 border-slate-50 rounded-2xl hover:bg-slate-50 transition-all shadow-sm">
                <Filter className="w-4 h-4 text-slate-400" />
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           {/* Filters Sidebar */}
           <div className="lg:col-span-3 space-y-6">
              <div className="bg-white rounded-[2rem] border-2 border-slate-50 p-6 shadow-sm">
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Categorization</h3>
                 <div className="space-y-2">
                    {["All", "Academic", "Behavior", "Attendance"].map((f) => (
                       <button 
                         key={f}
                         onClick={() => setActiveFilter(f)}
                         className={`w-full flex items-center justify-between px-5 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                            activeFilter === f ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-slate-50 text-slate-500 hover:bg-white hover:border-indigo-100 border border-transparent"
                         }`}
                       >
                          {f} {f === "All" && `(${notes.length})`}
                       </button>
                    ))}
                 </div>
              </div>

              <div className="bg-indigo-600 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-100 group">
                 <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform">
                    <Mic className="w-20 h-20" />
                 </div>
                 <h4 className="text-[9px] font-black uppercase tracking-widest text-indigo-200 mb-4">Transcription Engine</h4>
                 <h3 className="text-base font-black leading-tight mb-8 italic">"Direct audio-to-text notes from the classroom."</h3>
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-100">AI Synced Log</span>
                 </div>
              </div>
           </div>

           {/* Notes List */}
           <div className="lg:col-span-9 space-y-6">
              {loading ? (
                  <div className="py-24 text-center bg-white border-2 border-slate-50 rounded-[2.5rem]">
                      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                      <p className="text-sm font-black text-indigo-600 uppercase tracking-widest">Fetching scholarly documentation...</p>
                  </div>
              ) : filteredNotes.length === 0 ? (
                  <div className="py-24 text-center bg-white border-2 border-slate-50 rounded-[2.5rem] flex flex-col items-center">
                      <div className="w-20 h-20 bg-slate-50 border-2 border-slate-100 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm">
                          <MessageSquare className="w-9 h-9 text-slate-200" />
                      </div>
                      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Academic Silence</h3>
                      <p className="text-sm font-bold text-slate-400 max-w-sm leading-relaxed px-10">
                          The feature will work automatically after the subject instructors send official PTM or progress notes for {studentData?.name || "the student"}.
                      </p>
                  </div>
              ) : (
                  filteredNotes.map((note) => (
                     <div key={note.id} className="bg-white rounded-[2.5rem] border-2 border-slate-100 p-10 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-10 opacity-0 group-hover:opacity-5 transition-all">
                           <Sparkles className="w-24 h-24 text-indigo-600" />
                        </div>
                        
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8 pb-6 border-b border-slate-50">
                           <div className="flex items-center gap-4">
                              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xl shadow-sm">
                                 {note.teacher?.substring(0, 2).toUpperCase() || "T"}
                              </div>
                              <div>
                                 <div className="flex items-center gap-3 mb-1">
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight">{note.subject || "Academic Record"}</h3>
                                    {note.pinned && <Pin className="w-4 h-4 text-indigo-500 rotate-45" />}
                                 </div>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                                    <User className="w-3 h-3"/> {note.teacher || "Instructing Faculty"} • <Calendar className="w-3 h-3"/> {note.time || "Recent"}
                                 </p>
                              </div>
                           </div>
                           <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border self-start ${
                              note.type === "Urgent" ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                           }`}>
                              {note.type || "Formal Log"}
                           </span>
                        </div>

                        <div className="space-y-6 relative z-10">
                           <div className="bg-slate-50/80 border border-slate-100 p-8 rounded-3xl relative">
                              <BrainCircuit className="absolute -top-3 -right-3 w-8 h-8 text-indigo-200" />
                              <p className="text-base font-bold text-slate-700 leading-relaxed italic">
                                 "{note.subject}: {note.content || "Institutional records currently syncing. Details will appear shortly."}"
                              </p>
                           </div>

                           <div className="flex items-center gap-3 pt-4">
                              <button className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                                 <Reply className="w-3 h-3" /> Connect with {note.teacher?.split(' ')[0] || "Faculty"}
                              </button>
                              <button className="px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-slate-200 transition-all flex items-center gap-2">
                                 <MessageCircle className="w-4 h-4" /> Direct Portal Chat
                              </button>
                           </div>
                        </div>
                     </div>
                  ))
              )}
           </div>
        </div>
      </div>
  );
};

export default TeacherNotesPage;
