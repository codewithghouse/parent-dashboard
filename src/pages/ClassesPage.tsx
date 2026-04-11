import { useState, useEffect } from "react";
import {
  GraduationCap, Users, Clock, School,
  ShieldCheck, Loader2, Target, MessageSquare,
  BookOpen, ChevronRight, Layers
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { db } from "../lib/firebase";
import {
  collection, query, where, onSnapshot, doc as fbDoc, getDoc as fbGetDoc
} from "firebase/firestore";

// Index-based vibrant fallback colors (so every card is colorful even if subject unknown)
const INDEX_THEMES = [
  { bg: "from-violet-500 to-purple-700",  light: "bg-violet-50",  text: "text-violet-700",  iconBg: "bg-violet-600"  },
  { bg: "from-rose-500 to-pink-600",      light: "bg-rose-50",    text: "text-rose-700",    iconBg: "bg-rose-500"    },
  { bg: "from-amber-500 to-orange-600",   light: "bg-amber-50",   text: "text-amber-700",   iconBg: "bg-amber-500"   },
  { bg: "from-sky-500 to-cyan-600",       light: "bg-sky-50",     text: "text-sky-700",     iconBg: "bg-sky-600"     },
  { bg: "from-teal-500 to-emerald-600",   light: "bg-teal-50",    text: "text-teal-700",    iconBg: "bg-teal-600"    },
  { bg: "from-blue-500 to-indigo-600",    light: "bg-blue-50",    text: "text-blue-700",    iconBg: "bg-blue-600"    },
];

// Subject → color theme (matches by keyword, fallback is index-based)
const subjectTheme = (subject: string, idx: number) => {
  const s = subject?.toLowerCase() || "";
  if (s.includes("math"))     return { bg: "from-blue-500 to-indigo-600",   light: "bg-blue-50",    text: "text-blue-700",    iconBg: "bg-blue-600"    };
  if (s.includes("english"))  return { bg: "from-emerald-500 to-teal-600",  light: "bg-emerald-50", text: "text-emerald-700",  iconBg: "bg-emerald-600" };
  if (s.includes("hindi"))    return { bg: "from-orange-500 to-amber-600",  light: "bg-orange-50",  text: "text-orange-700",  iconBg: "bg-orange-500"  };
  if (s.includes("science"))  return { bg: "from-cyan-500 to-sky-600",      light: "bg-cyan-50",    text: "text-cyan-700",    iconBg: "bg-cyan-600"    };
  if (s.includes("social") || s.includes("sst") || s.includes("history") || s.includes("geo"))
                               return { bg: "from-purple-500 to-violet-700", light: "bg-purple-50",  text: "text-purple-700",  iconBg: "bg-purple-600"  };
  if (s.includes("computer") || s.includes("it"))
                               return { bg: "from-rose-500 to-pink-600",     light: "bg-rose-50",    text: "text-rose-700",    iconBg: "bg-rose-500"    };
  if (s.includes("physics"))  return { bg: "from-sky-500 to-blue-600",      light: "bg-sky-50",     text: "text-sky-700",     iconBg: "bg-sky-600"     };
  if (s.includes("chem"))     return { bg: "from-lime-500 to-green-600",    light: "bg-lime-50",    text: "text-lime-700",    iconBg: "bg-lime-600"    };
  if (s.includes("urdu") || s.includes("arabic"))
                               return { bg: "from-teal-500 to-emerald-600",  light: "bg-teal-50",    text: "text-teal-700",    iconBg: "bg-teal-600"    };
  // Vibrant index-based fallback — never dull!
  return INDEX_THEMES[idx % INDEX_THEMES.length];
};

// Resolve the actual subject name from any field Firestore might use
const resolveSubject = (en: any): string =>
  en.subject || en.subjectName || en.Subject || en.name || en.title || en.courseName || en.course || "";

const ClassesPage = () => {
  const { studentData } = useAuth();
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentData?.id) return;
    setLoading(true);
    const studentEmail = studentData.email?.toLowerCase() || "";

    let snap1: any = null;
    let snap2: any = null;

    const processEnrollments = async () => {
      const docs = [...(snap1?.docs || []), ...(snap2?.docs || [])];
      const seenIds = new Set();
      const raw = docs
        .filter(d => { if (!seenIds.has(d.id)) { seenIds.add(d.id); return true; } return false; })
        .map(d => ({ id: d.id, ...(d.data() as any) }));

      const enriched = await Promise.all(raw.map(async (en) => {
        let teacherName = en.teacherName || "Faculty";
        if (en.teacherId) {
          try {
            const snap = await fbGetDoc(fbDoc(db, "teachers", en.teacherId));
            if (snap.exists()) teacherName = snap.data().name;
          } catch { /* keep fallback */ }
        }
        const initials = teacherName.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2);
        return { ...en, teacherName, initials };
      }));

      setEnrollments(enriched);
      setLoading(false);
    };

    const unsub1 = onSnapshot(query(collection(db, "enrollments"), where("studentId", "==", studentData.id)), s => { snap1 = s; processEnrollments(); });
    const unsub2 = studentEmail
      ? onSnapshot(query(collection(db, "enrollments"), where("studentEmail", "==", studentEmail)), s => { snap2 = s; processEnrollments(); })
      : () => {};

    return () => { unsub1(); unsub2(); };
  }, [studentData?.id]);

  return (
    <div className="animate-in fade-in duration-500 pb-28 font-montserrat">

      {/* ── HEADER ── */}
      <div className="mb-8">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em] mb-1">Parent Dashboard</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">My Classes</h1>
        <p className="text-sm text-slate-500 mt-1 font-medium">
          All enrolled subjects for <span className="text-slate-800 font-bold">{studentData?.name}</span>
        </p>
      </div>

      {/* ── CONTENT ── */}
      {loading ? (
        <div className="py-40 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-slate-400 animate-spin" />
          </div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Loading classes...</p>
        </div>

      ) : enrollments.length === 0 ? (
        <div className="py-40 text-center border-2 border-dashed border-slate-100 rounded-3xl">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-base font-bold text-slate-400">No Classes Found</h3>
          <p className="text-sm text-slate-300 mt-1">No subject enrollments yet.</p>
        </div>

      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {enrollments.map((en, idx) => {
            const subject = resolveSubject(en);
            const theme = subjectTheme(subject, idx);
            const className = en.className || en.classGroup || en.classSection || en.class || en.section || null;

            return (
              <div key={en.id} className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 group flex flex-col">

                {/* Card Top — Gradient Banner */}
                <div className={`bg-gradient-to-br ${theme.bg} p-5 pb-8 relative overflow-hidden`}>
                  {/* Decorative circle */}
                  <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
                  <div className="absolute -right-2 top-8 w-16 h-16 rounded-full bg-white/10" />

                  {/* Subject icon + initials */}
                  <div className="flex items-start justify-between relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">Active</span>
                    </div>
                  </div>

                  {/* Subject Name */}
                  <div className="mt-4 relative z-10">
                    <h2 className="text-xl font-extrabold text-white tracking-tight leading-tight">{subject || "Class"}</h2>

                    {/* Class Name badge — the key thing user wanted */}
                    {className ? (
                      <div className="mt-2 inline-flex items-center gap-1.5 bg-white/25 backdrop-blur-sm rounded-full px-3 py-1">
                        <Layers className="w-3 h-3 text-white/80" />
                        <span className="text-[11px] font-bold text-white tracking-wide">{className}</span>
                      </div>
                    ) : (
                      <div className="mt-2 inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1">
                        <Layers className="w-3 h-3 text-white/60" />
                        <span className="text-[11px] font-medium text-white/60 tracking-wide">Class not assigned</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex flex-col flex-1 -mt-3 bg-white rounded-t-3xl relative z-10">

                  {/* Teacher */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-9 h-9 rounded-xl ${theme.iconBg} flex items-center justify-center text-white text-xs font-black flex-shrink-0`}>
                      {en.initials}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Teacher</p>
                      <p className="text-sm font-bold text-slate-800 leading-tight">{en.teacherName}</p>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <InfoChip icon={Clock} label="Schedule" value={en.schedule || "08:30 – 09:30 AM"} lightBg={theme.light} textColor={theme.text} />
                    <InfoChip icon={School} label="Year" value={en.academicYear || "2025-26"} lightBg={theme.light} textColor={theme.text} />
                  </div>

                  {/* Spacer + CTA */}
                  <div className="mt-auto">
                    <button
                      onClick={() => navigate("/teacher-notes", { state: { teacherId: en.teacherId } })}
                      className={`w-full h-11 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold transition-all active:scale-95 group-hover:gap-3 bg-gradient-to-r ${theme.bg} text-white shadow-sm`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      Message Teacher
                      <ChevronRight className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-all" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── FOOTER STATS ── */}
      {!loading && enrollments.length > 0 && (
        <div className="mt-8 rounded-3xl overflow-hidden">
          <div className="bg-slate-900 p-5 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 flex-shrink-0">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Enrollment Verified</p>
                <p className="text-base font-extrabold text-white mt-0.5">Academic Registry Active</p>
              </div>
            </div>
            <div className="flex gap-8 text-right">
              <div>
                <p className="text-3xl font-black text-white leading-none">{enrollments.length}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Subjects</p>
              </div>
              <div>
                <p className="text-3xl font-black text-white leading-none">
                  {enrollments.filter(e => e.teacherId).length}
                </p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Teachers</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InfoChip = ({ icon: Icon, label, value, lightBg, textColor }: any) => (
  <div className={`${lightBg} rounded-2xl p-3`}>
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className={`w-3 h-3 ${textColor}`} />
      <p className={`text-[9px] font-bold uppercase tracking-widest ${textColor} opacity-80`}>{label}</p>
    </div>
    <p className="text-xs font-bold text-slate-700 leading-tight">{value}</p>
  </div>
);

export default ClassesPage;
