import { useState, useEffect, useRef } from "react";
import { User, Clock, CheckCircle2, Loader2, Download, Upload, FileCheck, X, FileText, Layout, Book, FlaskConical, Calculator, Languages, Palette, ChevronRight, BarChart3, Target, Trophy, Send, Paperclip } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { db, storage } from "@/lib/firebase";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, Unsubscribe } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

const tabs = ["Pending", "Completed", "Overdue"];

const AssignmentsPage = () => {
  const { studentData } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [submittingFile, setSubmittingFile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  
  // Submission Panel States
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [studentNote, setStudentNote] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!studentData?.id) return;
    setLoading(true);
    let unsubAssignments: Unsubscribe | null = null;

    const setupAssignmentListener = (classIds: string[]) => {
        if (unsubAssignments) unsubAssignments();
        if (classIds.length === 0) {
            setAssignments([]);
            setLoading(false);
            return;
        }
        const assignmentsRef = collection(db, "assignments");
        const q = query(assignmentsRef, where("classId", "in", classIds));
        unsubAssignments = onSnapshot(q, (snap) => {
            setAssignments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
    };

    // DUAL LOOKUP: Search by studentId AND studentEmail (handles both creation patterns)
    const studentEmail = studentData.email?.toLowerCase() || "";
    const fetchEnrollments = async () => {
        const classIdSet = new Set<string>();
        
        // 1. By studentId (for enrollments created from principal dashboard)
        const byId = await getDocs(query(collection(db, "enrollments"), where("studentId", "==", studentData.id)));
        byId.docs.forEach(d => { if (d.data().classId) classIdSet.add(d.data().classId); });

        // 2. By studentEmail (for enrollments created from teacher dashboard)
        if (studentEmail) {
            const byEmail = await getDocs(query(collection(db, "enrollments"), where("studentEmail", "==", studentEmail)));
            byEmail.docs.forEach(d => { if (d.data().classId) classIdSet.add(d.data().classId); });
        }

        console.log("[ASSIGNMENTS] Found classIds from enrollments:", Array.from(classIdSet));
        setupAssignmentListener(Array.from(classIdSet));
    };

    fetchEnrollments();
    
    // Also set up a live listener on enrollments by email for real-time updates
    const unsubEnroll = studentEmail 
        ? onSnapshot(query(collection(db, "enrollments"), where("studentEmail", "==", studentEmail)), () => {
            fetchEnrollments(); // Re-fetch on enrollment changes
          })
        : () => {};
    const qSub = query(collection(db, "submissions"), where("studentId", "==", studentData.id));
    const unsubSub = onSnapshot(qSub, (snapshot) => {
        setSubmissions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubEnroll(); if (unsubAssignments) unsubAssignments(); unsubSub(); };
  }, [studentData?.id]);

  const handleOfficialSubmission = async () => {
    if (!uploadFile || !selectedTask) return toast.error("Please attach your homework artifact first!");
    
    setSubmittingFile(true);
    try {
        const sRef = ref(storage, `submissions/${studentData.id}_${selectedTask.id}_${uploadFile.name}`);
        const snap = await uploadBytes(sRef, uploadFile);
        const url = await getDownloadURL(snap.ref);

        await addDoc(collection(db, "submissions"), {
            homeworkId: selectedTask.id, // Renamed from assignmentId to differentiate from teaching_assignment
            assignmentId: selectedTask.assignmentId || "legacy", // Enforced Phase 1 spec: tracking the teaching_assignment
            studentId: studentData.id,
            studentName: studentData.name,
            fileUrl: url,
            fileName: uploadFile.name,
            studentNote: studentNote,
            timestamp: serverTimestamp(),
            status: "Submitted"
        });
        
        toast.success("Assignment officially submitted to institutional repository!");
        setIsSubmitOpen(false);
        setUploadFile(null);
        setStudentNote("");
    } catch (e) {
        toast.error("Cloud handover failed. Check connection.");
    } finally {
        setSubmittingFile(false);
    }
  };

  const getSub = (aId: string) => submissions.find(s => 
    s.homeworkId === aId ||    // Parent dashboard saves here
    s.assignmentId === aId     // Fallback for older records
  );

  const filteredAssignments = assignments.filter(a => {
    const sub = getSub(a.id);
    if (activeTab === 1) return !!sub;
    if (activeTab === 2) return false; 
    return !sub;
  });

  const getSubjectIcon = (title: string) => {
     const t = title.toLowerCase();
     if (t.includes('sci') || t.includes('chem')) return <FlaskConical className="w-8 h-8 text-amber-500" />;
     if (t.includes('math') || t.includes('calc')) return <Calculator className="w-8 h-8 text-blue-500" />;
     if (t.includes('eng') || t.includes('hist')) return <Book className="w-8 h-8 text-indigo-500" />;
     return <FileText className="w-8 h-8 text-slate-400" />;
  };

  return (
      <div className="space-y-10 animate-in fade-in duration-500 pb-20 text-left">
        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {[
             { label: 'Completion Rate', value: '93%', color: 'text-emerald-500', bg: 'bg-emerald-500', icon: Target },
             { label: 'On-Time Submission', value: '96%', color: 'text-blue-500', bg: 'bg-blue-500', icon: BarChart3 },
             { label: 'Average Score', value: '82%', color: 'text-indigo-500', bg: 'bg-indigo-500', icon: Trophy },
           ].map((stat, i) => (
             <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-6">
                <div className="flex items-center justify-between"><p className="text-sm font-black text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p><stat.icon className={`w-5 h-5 ${stat.color}`} /></div>
                <h4 className={`text-4xl font-black ${stat.color}`}>{stat.value}</h4>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`${stat.bg} h-full transition-all duration-1000`} style={{ width: stat.value }} /></div>
             </div>
           ))}
        </div>

        {/* TABS */}
        <div className="flex bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm w-fit">
          {tabs.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)} className={`px-8 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all ${i === activeTab ? "bg-slate-900 text-white shadow-xl" : "text-slate-400"}`}>
              {tab} ({i === 0 ? assignments.filter(a => !getSub(a.id)).length : i === 1 ? submissions.length : 0})
            </button>
          ))}
        </div>

        {/* LIST */}
        <div className="space-y-6">
          {loading ? (
             <div className="py-24 text-center bg-white border border-dashed border-slate-100 rounded-[3rem]"><Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" /></div>
          ) : filteredAssignments.length === 0 ? (
             <div className="py-24 bg-white border border-dashed border-slate-200 rounded-[3.5rem] text-center"><FileCheck className="w-12 h-12 text-slate-200 mx-auto mb-6" /><h3 className="text-xl font-black text-slate-800 uppercase">No Curriculums Found</h3></div>
          ) : (
            filteredAssignments.map((a) => {
              const mySub = getSub(a.id);
              return (
                <div key={a.id} className="bg-white rounded-[3rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl transition-all flex flex-col md:flex-row items-center gap-8 text-left">
                  <div className={`w-24 h-24 rounded-[2.2rem] flex items-center justify-center border-2 shrink-0 bg-slate-50 border-slate-100`}>
                     {getSubjectIcon(a.title)}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-4">
                       <h3 className="text-2xl font-black text-slate-800 tracking-tight">{a.title}</h3>
                       <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${mySub ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                          {mySub ? 'Handed In' : 'Outstanding'}
                       </span>
                    </div>
                    <p className="text-sm font-bold text-slate-400 line-clamp-2">{a.description}</p>
                    <div className="flex items-center gap-6 pt-2">
                       <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-300"/><span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{a.teacherName || "Institutional Faculty"}</span></div>
                       <div className="flex items-center gap-2 text-rose-400"><Clock className="w-4 h-4"/><span className="text-[11px] font-black uppercase tracking-widest leading-none">Due Mar 28, 2026</span></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 min-w-[180px]">
                     {mySub ? (
                        <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl border border-emerald-100 text-center flex flex-col items-center">
                           <CheckCircle2 className="w-5 h-5 mb-1" />
                           <p className="text-[10px] font-black uppercase tracking-widest">Marked Submited</p>
                        </div>
                     ) : (
                        <button 
                          onClick={() => { setSelectedTask(a); setIsSubmitOpen(true); }}
                          className="w-full px-8 py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 shadow-xl transition-all active:scale-95"
                        >
                          Submit Online
                        </button>
                     )}
                     {a.pdfUrl && <a href={a.pdfUrl} target="_blank" rel="noreferrer" className="px-6 py-3 border border-slate-100 rounded-2xl text-[9px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 transition-all text-center">View Blueprint</a>}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* SUBMISSION CENTER PANEL */}
        <Sheet open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
           <SheetContent side="right" className="w-full sm:max-w-xl p-0 border-l border-slate-100 bg-white">
              <div className="h-full flex flex-col">
                 <div className="bg-slate-900 p-10 text-white text-left">
                    <SheetHeader className="text-left">
                       <SheetTitle className="text-white text-3xl font-black tracking-tight leading-none mb-2">Subject Submission</SheetTitle>
                       <SheetDescription className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Portal Identification: {studentData?.id?.substring(0,10)}</SheetDescription>
                    </SheetHeader>
                 </div>

                 <div className="flex-1 p-10 space-y-10">
                    <div className="space-y-4 text-left">
                       <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Target Task</p>
                          <h4 className="text-xl font-black text-slate-800">{selectedTask?.title}</h4>
                       </div>
                    </div>

                    <div className="space-y-6 text-left">
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Artifact (PDF/JPG)</label>
                       <div 
                         onClick={() => fileInputRef.current?.click()}
                         className="w-full p-12 border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/50 hover:bg-slate-100 transition-all cursor-pointer flex flex-col items-center justify-center text-center group"
                       >
                          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.jpg,.png" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
                          {uploadFile ? (
                             <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-xl border border-slate-50 animate-in zoom-in-95">
                                <FileText className="w-10 h-10 text-indigo-600" />
                                <div className="text-left"><p className="text-xs font-black text-slate-800">{uploadFile.name}</p></div>
                                <button onClick={(e) => { e.stopPropagation(); setUploadFile(null); }} className="p-2 text-rose-400"><X className="w-4 h-4" /></button>
                             </div>
                          ) : (
                             <div className="flex flex-col items-center">
                                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-4 shadow-sm border border-slate-50"><Upload className="w-8 h-8 text-slate-300" /></div>
                                <p className="text-sm font-black text-slate-400 group-hover:text-slate-600 transition-colors">Select Submission File</p>
                             </div>
                          )}
                       </div>
                    </div>

                    <div className="space-y-4 text-left">
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Teacher Notes (Optional)</label>
                       <textarea 
                         rows={4}
                         value={studentNote}
                         onChange={(e) => setStudentNote(e.target.value)}
                         className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-medium text-slate-600 focus:bg-white focus:ring-4 focus:ring-slate-100 outline-none transition-all resize-none placeholder:text-slate-300"
                         placeholder="Add any specific details for your teacher here..."
                       />
                    </div>
                 </div>

                 <div className="p-10 border-t border-slate-100">
                    <button 
                      onClick={handleOfficialSubmission}
                      disabled={submittingFile || !uploadFile}
                      className="w-full py-6 bg-slate-900 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] hover:bg-slate-800 shadow-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-4"
                    >
                       {submittingFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" /> Confirm Academic Hand-in</>}
                    </button>
                 </div>
              </div>
           </SheetContent>
        </Sheet>
      </div>
  );
};

export default AssignmentsPage;
