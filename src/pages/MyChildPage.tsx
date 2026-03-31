import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  User, Calendar, HeartPulse, Phone, Clock, GraduationCap, 
  Mail, MessageSquare, CheckCircle, FileText, Star, Edit, ChevronRight, Users, X, Save, Loader2
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, limit } from "firebase/firestore";
import { toast } from "sonner";

const MyChildPage = () => {
  const { studentData } = useAuth();
  const navigate = useNavigate();
  
  // Real-time states
  const [teachers, setTeachers] = useState<any[]>([]);
  const [enrollmentInfo, setEnrollmentInfo] = useState({
    className: "N/A",
    rollNo: "N/A"
  });
  const [overview, setOverview] = useState({
    attendance: "0%",
    assignments: "0/0",
    testsTaken: 0,
    avgGrade: "N/A"
  });
  const [behaviourStats, setBehaviourStats] = useState({
    positive: 0,
    improvement: 0,
    rating: 5.0
  });
  const [masteryProgress, setMasteryProgress] = useState(85);
  const [loading, setLoading] = useState(true);

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    dob: "",
    bloodGroup: "",
    parentPhone: "",
    emergencyContact: "",
    admissionDate: ""
  });

  useEffect(() => {
    if (!studentData?.id) return;
    setLoading(true);
    const studentEmail = studentData.email?.toLowerCase() || "";

    // Initial Form Data Sync
    setFormData({
        dob: studentData.dob || "",
        bloodGroup: studentData.bloodGroup || "",
        parentPhone: studentData.parentPhone || "",
        emergencyContact: studentData.emergencyContact || "",
        admissionDate: studentData.admissionDate || ""
    });
    
    // 1. Dual-Lookup for Teachers & Enrollment Info
    let enrollSnap1: any = null;
    let enrollSnap2: any = null;
    const processEnrollments = () => {
        const docs = [...(enrollSnap1?.docs || []), ...(enrollSnap2?.docs || [])];
        const uniqueDocs: any[] = [];
        const seenIds = new Set();
        docs.forEach(d => { if(!seenIds.has(d.id)) { seenIds.add(d.id); uniqueDocs.push(d); } });
        
        if (uniqueDocs.length > 0) {
            const first = uniqueDocs[0].data();
            setEnrollmentInfo({
                className: first.className || "N/A",
                rollNo: first.rollNo || "N/A"
            });
        }

        const data = uniqueDocs.map(d => ({
            id: d.id,
            name: d.data().teacherName || "Institutional Faculty",
            subject: d.data().subject || d.data().className || "Curriculum",
            teacherId: d.data().teacherId,
            classId: d.data().classId,
            initials: (d.data().teacherName || "F").split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)
        }));
        setTeachers(data);
        return data;
    };

    const unsubEnroll1 = onSnapshot(query(collection(db, "enrollments"), where("studentId", "==", studentData.id)), (snap) => {
        enrollSnap1 = snap; processEnrollments();
    });
    const unsubEnroll2 = studentEmail ? onSnapshot(query(collection(db, "enrollments"), where("studentEmail", "==", studentEmail)), (snap) => {
        enrollSnap2 = snap; processEnrollments();
    }) : () => {};

    // 2. Dual-Lookup for Attendance Overview
    let attSnap1: any = null;
    let attSnap2: any = null;
    const processAttendance = () => {
        const docs = [...(attSnap1?.docs || []), ...(attSnap2?.docs || [])];
        const seenIds = new Set();
        const records = docs.filter(d => { if(!seenIds.has(d.id)) { seenIds.add(d.id); return true; } return false; }).map(d => d.data());
        const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
        const total = records.length;
        setOverview(prev => ({ ...prev, attendance: total === 0 ? "100%" : `${Math.round((present/total)*100)}%` }));
    };

    const unsubAtt1 = onSnapshot(query(collection(db, "attendance"), where("studentId", "==", studentData.id)), (snap) => {
        attSnap1 = snap; processAttendance();
    });
    const unsubAtt2 = studentEmail ? onSnapshot(query(collection(db, "attendance"), where("studentEmail", "==", studentEmail)), (snap) => {
        attSnap2 = snap; processAttendance();
    }) : () => {};

    // 3. Assignment Completion Status
    const unsubAssign = onSnapshot(collection(db, "assignments"), async (aSnap) => {
        const teacherData = processEnrollments();
        const myClassIds = new Set(teacherData.map(t => t.classId).filter(Boolean));
        const myAssignments = aSnap.docs.filter(d => myClassIds.has(d.data().classId));
        const totalA = myAssignments.length;

        // Dual-Lookup for Submissions
        const sSnap1 = await getDocs(query(collection(db, "submissions"), where("studentId", "==", studentData.id)));
        const sSnap2 = studentEmail ? await getDocs(query(collection(db, "submissions"), where("studentEmail", "==", studentEmail))) : { docs: [] };
        const subIds = new Set();
        [...sSnap1.docs, ...sSnap2.docs].forEach(d => {
            const data = d.data();
            if (data.homeworkId) subIds.add(data.homeworkId);
            if (data.assignmentId) subIds.add(data.assignmentId);
        });
        const completedA = subIds.size;
        setOverview(prev => ({ ...prev, assignments: `${completedA}/${totalA}` }));
    });

    // 4. Scholastic Result Summary
    let resSnap1: any = null;
    let resSnap2: any = null;
    const processResults = () => {
        const docs = [...(resSnap1?.docs || []), ...(resSnap2?.docs || [])];
        const seenIds = new Set();
        const results = docs.filter(d => { if(!seenIds.has(d.id)) { seenIds.add(d.id); return true; } return false; }).map(d => d.data());
        const count = results.length;
        const totalScores = results.reduce((acc, curr) => acc + (parseFloat(curr.score) || curr.score || 0), 0);
        const totalMax = results.reduce((acc, curr) => acc + (parseFloat(curr.maxScore) || 100), 0);
        const avg = totalMax > 0 ? (totalScores / totalMax * 100) : 0;
        const getGradeLetter = (s: number) => s >= 90 ? "A+" : s >= 80 ? "A" : s >= 70 ? "B+" : s >= 60 ? "B" : "C";
        setOverview(prev => ({ ...prev, testsTaken: count, avgGrade: count > 0 ? getGradeLetter(avg) : "N/A" }));
        setMasteryProgress(count > 0 ? Math.round(avg) : 85);
    };

    const unsubRes1 = onSnapshot(query(collection(db, "results"), where("studentId", "==", studentData.id)), (snap) => {
        resSnap1 = snap; processResults();
    });
    const unsubRes2 = studentEmail ? onSnapshot(query(collection(db, "results"), where("studentEmail", "==", studentEmail)), (snap) => {
        resSnap2 = snap; processResults();
    }) : () => {};

    // 5. Behaviour Summary
    let noteSnap1: any = null;
    let noteSnap2: any = null;
    const processNotes = () => {
        const docs = [...(noteSnap1?.docs || []), ...(noteSnap2?.docs || [])];
        const seenIds = new Set();
        const notes = docs.filter(d => { if(!seenIds.has(d.id)) { seenIds.add(d.id); return true; } return false; }).map(d => d.data());
        
        const pos = notes.filter(n => {
            const content = (n.content || "").toLowerCase();
            const isImprov = content.includes("late") || content.includes("forgot") || content.includes("issue") || content.includes("improve");
            return !isImprov;
        }).length;
        const improv = notes.length - pos;
        const calcRating = notes.length === 0 ? 5.0 : Math.min(5.0, Math.max(1.0, 5.0 - (improv * 0.3) + (pos * 0.1)));
        
        setBehaviourStats({ positive: pos, improvement: improv, rating: calcRating });
    };

    const unsubNotes1 = onSnapshot(query(collection(db, "parent_notes"), where("studentId", "==", studentData.id)), (snap) => {
        noteSnap1 = snap; processNotes();
    });
    const unsubNotes2 = studentEmail ? onSnapshot(query(collection(db, "parent_notes"), where("studentEmail", "==", studentEmail)), (snap) => {
        noteSnap2 = snap; processNotes();
    }) : () => {};

    setLoading(false);
    return () => { 
        unsubEnroll1(); unsubEnroll2(); unsubAtt1(); unsubAtt2(); 
        unsubAssign(); unsubRes1(); unsubRes2(); 
        unsubNotes1(); unsubNotes2();
    };
  }, [studentData?.id]);

  const handleSaveProfile = async () => {
     if (!studentData?.id) return;
     setIsSaving(true);
     try {
        await updateDoc(doc(db, "students", studentData.id), formData);
        toast.success("Identity Trace Synchronized Successfully.");
        setIsEditModalOpen(false);
     } catch (e) {
        toast.error("Registry Connection Failure.");
        console.error(e);
     } finally {
        setIsSaving(false);
     }
  };

  const teacherColors = ["bg-[#1e3a8a]", "bg-emerald-600", "bg-orange-500", "bg-indigo-600"];

  return (
    <div className="animate-in fade-in duration-700 pb-20 text-left font-sans">
      
      <div className="flex justify-between items-center mb-10 px-4">
          <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em] opacity-80 italic">RESULT OF CLICK: "MY CHILD"</p>
          <button 
             onClick={() => setIsEditModalOpen(true)}
             className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95">
             <Edit size={14} /> Edit Profile
          </button>
      </div>

      {/* ── PROFILE CARD ── */}
      <div className="bg-white border border-slate-100 rounded-[3rem] p-10 mb-10 shadow-sm relative group overflow-hidden">
         <div className="absolute top-0 right-0 p-10 opacity-[0.03] scale-150 rotate-12 transition-transform duration-1000 group-hover:rotate-0">
            <User className="w-64 h-64 text-[#1e3a8a]" />
         </div>

         <div className="flex flex-col lg:flex-row items-center gap-10 relative z-10 border-b border-slate-50 pb-10 mb-10">
            <div className="w-36 h-36 rounded-[3rem] bg-[#1e3a8a] text-white flex items-center justify-center text-5xl font-black italic shadow-2xl group-hover:rotate-3 transition-transform">
               {studentData?.name?.[0] || 'A'}
            </div>
            
            <div className="flex-1 text-center lg:text-left">
               <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-4">
                  <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">{studentData?.name}</h1>
                  <div className="flex justify-center items-center gap-2">
                     <span className="px-5 py-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100">Active</span>
                     <span className="px-5 py-1.5 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-indigo-100">{teachers.length > 1 ? "Multi-Course" : "Regular"}</span>
                  </div>
               </div>
               <p className="text-xl font-bold text-slate-400 capitalize">
                  Primary Identity: <span className="text-[#1e3a8a]">{studentData?.grade || enrollmentInfo.className}</span> • ID {studentData?.rollNo || studentData?.id?.slice(-6) || "N/A"}
               </p>
            </div>
         </div>

         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 relative z-10">
            <InfoBlock label="Date of Birth" value={formData.dob || "N/A"} icon={Calendar} />
            <InfoBlock label="Blood Group" value={formData.bloodGroup || "N/A"} icon={HeartPulse} />
            <InfoBlock label="Emergency Contact" value={formData.parentPhone || "N/A"} icon={Phone} />
            <InfoBlock label="Admission Date" value={formData.admissionDate || "N/A"} icon={Clock} />
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-10">
          <div className="bg-white border border-slate-100 rounded-[3rem] p-10 shadow-sm overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-10 px-4">
               <h3 className="text-2xl font-black text-slate-800 tracking-tight">Active Registrations & Faculty</h3>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{teachers.length} Subject Streams</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
               {teachers.length === 0 ? (
                  <div className="col-span-full py-20 opacity-30 flex flex-col items-center">
                     <Users size={48} className="mb-4" />
                     <p className="text-[11px] font-black uppercase tracking-widest italic">Synchronizing Faculty List...</p>
                  </div>
               ) : (
                  teachers.map((t, idx) => (
                     <div key={idx} className="p-8 bg-slate-50/50 border border-slate-100 rounded-[2.5rem] flex flex-col gap-6 group hover:bg-white hover:shadow-xl transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-[0.05] group-hover:scale-110 transition-transform">
                           <GraduationCap size={40} className="text-[#1e3a8a]" />
                        </div>
                        <div className="flex items-center gap-6">
                           <div className={`w-16 h-16 rounded-2xl ${teacherColors[idx % teacherColors.length]} flex items-center justify-center text-white text-2xl font-black italic shadow-lg group-hover:rotate-6 transition-transform shrink-0`}>
                              {t.initials}
                           </div>
                           <div>
                              <h4 className="text-xl font-black text-slate-800 tracking-tight uppercase leading-tight mb-1">{t.subject}</h4>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.name}</p>
                           </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-100 pt-6 mt-2">
                           <div>
                              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Status</p>
                              <p className="text-sm font-black text-slate-700 italic">Fully Enrolled</p>
                           </div>
                           <button onClick={() => navigate('/teacher-notes')} className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-[#1e3a8a] hover:bg-[#1e3a8a] hover:text-white transition-all shadow-sm">
                              <MessageSquare size={18} />
                           </button>
                        </div>
                     </div>
                  ))
               )}
            </div>
         </div>
      </div>

      {/* ── BEHAVIOUR & CONCEPT MASTERY ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-10">
         <div className="bg-white border border-slate-100 rounded-[3rem] p-10 shadow-sm flex flex-col group hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-inner group-hover:rotate-6 transition-transform">
                     <Star size={24} />
                  </div>
                  <div>
                     <h3 className="text-2xl font-black text-slate-800 tracking-tight italic leading-none mb-1">Behaviour Trace</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Institutional Conduct Record</p>
                  </div>
               </div>
               <button onClick={() => navigate('/behaviour')} className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all transform hover:scale-110">
                  <ChevronRight size={18} />
               </button>
            </div>
            
            <div className="flex-1 flex flex-col justify-center gap-6">
               <div className="p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Active Star Rating</span>
                  <div className="flex items-center gap-1">
                     {[1,2,3,4,5].map(i => (
                        <Star key={i} size={16} className={`fill-amber-400 text-amber-400 ${i > Math.round(behaviourStats.rating) ? 'opacity-20' : ''}`} />
                     ))}
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100 text-center">
                     <p className="text-3xl font-black text-emerald-600 tracking-tighter leading-none mb-2 italic">{behaviourStats.positive.toString().padStart(2, '0')}</p>
                     <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-none">Positive Logs</p>
                  </div>
                  <div className="p-6 bg-rose-50 rounded-[2rem] border border-rose-100 text-center">
                     <p className="text-3xl font-black text-rose-600 tracking-tighter leading-none mb-2 italic">{behaviourStats.improvement.toString().padStart(2, '0')}</p>
                     <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest leading-none">Improvement Logs</p>
                  </div>
               </div>
            </div>
         </div>

         <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl flex flex-col group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 scale-150 rotate-12 transition-transform duration-700 group-hover:rotate-0">
               <GraduationCap className="w-40 h-40 text-white" />
            </div>
            <div className="relative z-10 flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 text-blue-400 flex items-center justify-center border border-white/10 shadow-inner group-hover:scale-110 transition-transform">
                     <HeartPulse size={24} />
                  </div>
                  <div>
                     <h3 className="text-2xl font-black text-white tracking-tight italic leading-none mb-1">Concept Mastery</h3>
                     <p className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">Temporal Intelligence</p>
                  </div>
               </div>
               <button onClick={() => navigate('/concept-strengths')} className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 hover:bg-white hover:text-slate-900 transition-all transform hover:scale-110">
                  <ChevronRight size={18} />
               </button>
            </div>
            <div className="relative z-10 space-y-6">
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none">Scholastic Pulse</span>
                  <span className="text-lg font-black text-blue-400 italic">Target: {masteryProgress}%</span>
               </div>
               <div className="w-full h-12 bg-white/5 rounded-2xl border border-white/5 p-1 relative overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-1000" style={{ width: `${masteryProgress}%` }} />
               </div>
               <p className="text-[11px] font-bold text-white/50 leading-relaxed italic max-w-[280px]">
                  Scholastic performance index based on {overview.testsTaken} assessment cycles in active curriculums.
               </p>
            </div>
         </div>
      </div>

      {/* ── EDIT MODAL ── */}
      {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10">
             <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsEditModalOpen(false)} />
             <div className="bg-white rounded-[3.5rem] w-full max-w-2xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-10 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                   <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-none italic uppercase">Update Identity</h2>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Institutional Sync Gateway</p>
                   </div>
                   <button onClick={() => setIsEditModalOpen(false)} className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-300 hover:text-slate-600 transition-all hover:rotate-90">
                      <X size={20} />
                   </button>
                </div>
                <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                   <EditInput label="Date of Birth" value={formData.dob} onChange={(v:any) => setFormData({...formData, dob:v})} placeholder="e.g., 15 March 2012" />
                   <EditInput label="Blood Group" value={formData.bloodGroup} onChange={(v:any) => setFormData({...formData, bloodGroup:v})} placeholder="e.g., O+" />
                   <EditInput label="Parent Contact" value={formData.parentPhone} onChange={(v:any) => setFormData({...formData, parentPhone:v})} placeholder="e.g., +91 98765..." />
                   <EditInput label="Admission Date" value={formData.admissionDate} onChange={(v:any) => setFormData({...formData, admissionDate:v})} placeholder="e.g., June 2020" />
                </div>
                <div className="p-10 bg-slate-50/50 flex flex-col sm:flex-row gap-4">
                   <button onClick={() => setIsEditModalOpen(false)} className="flex-1 h-16 bg-white border border-slate-200 text-slate-400 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">Discard Changes</button>
                   <button onClick={handleSaveProfile} disabled={isSaving} className="flex-[2] h-16 bg-[#1e3a8a] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-blue-900/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3">
                      {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                      Verify & Synchronize
                   </button>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};

const InfoBlock = ({ label, value, icon: Icon }: any) => (
   <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex-1 hover:bg-white hover:shadow-xl transition-all group/info">
      <div className="flex items-center gap-3 mb-2">
         <Icon size={14} className="text-slate-300 group-hover/info:text-[#1e3a8a] transition-colors" />
         <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">{label}</span>
      </div>
      <p className="text-base font-black text-slate-800 tracking-tight">{value}</p>
   </div>
);

const EditInput = ({ label, value, onChange, placeholder }: any) => (
   <div className="space-y-3">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <input 
         type="text" 
         value={value} 
         onChange={(e) => onChange(e.target.value)}
         placeholder={placeholder}
         className="w-full h-14 bg-white border border-slate-100 rounded-2xl px-6 text-sm font-bold text-slate-800 focus:ring-4 focus:ring-blue-50 focus:border-[#1e3a8a] transition-all outline-none italic placeholder:text-slate-200"
      />
   </div>
);

export default MyChildPage;
