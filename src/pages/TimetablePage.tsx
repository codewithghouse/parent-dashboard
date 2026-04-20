import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "../lib/AuthContext";
import { CalendarDays, Clock, BookOpen, Loader2, User } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SUBJECT_COLORS = [
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-purple-50 text-purple-700 border-purple-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-indigo-50 text-indigo-700 border-indigo-200",
  "bg-teal-50 text-teal-700 border-teal-200",
  "bg-orange-50 text-orange-700 border-orange-200",
];

const TimetablePage = () => {
  const { studentData } = useAuth();
  const isMobile = useIsMobile();
  const [timetable, setTimetable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = new Date().getDay();
    // 0=Sun, 1=Mon...6=Sat — map to our DAYS array (0=Mon)
    return today === 0 ? 0 : Math.min(today - 1, 5);
  });

  const subjectColorMap = new Map<string, string>();
  let colorIdx = 0;
  const getSubjectColor = (subject: string) => {
    if (!subjectColorMap.has(subject)) {
      subjectColorMap.set(subject, SUBJECT_COLORS[colorIdx % SUBJECT_COLORS.length]);
      colorIdx++;
    }
    return subjectColorMap.get(subject)!;
  };

  useEffect(() => {
    if (!studentData?.classId && !studentData?.id) return;
    setLoading(true);

    const fetchTimetable = async () => {
      try {
        const classId = studentData.classId;
        const schoolId = studentData.schoolId;
        if (!classId || !schoolId) {
          setLoading(false);
          return;
        }

        // Try timetable collection first
        const tSnap = await getDocs(query(
          collection(db, "timetable"),
          where("schoolId", "==", schoolId),
          where("classId", "==", classId),
        ));
        if (!tSnap.empty) {
          const data = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setTimetable(data);
          setLoading(false);
          return;
        }

        // Fallback: build from teaching_assignments (teachers + subjects per class)
        const taSnap = await getDocs(query(
          collection(db, "teaching_assignments"),
          where("schoolId", "==", schoolId),
          where("classId", "==", classId),
        ));
        if (!taSnap.empty) {
          const teachers = taSnap.docs.map(d => d.data());
          // Build a simple view showing each teacher's subject
          const slots = teachers.map((t: any, i: number) => ({
            subject: t.subject || t.subjectId || "Subject",
            teacherName: t.teacherName || "Teacher",
            day: DAYS[i % 5],
            time: `${8 + i}:00 - ${9 + i}:00`,
            period: i + 1
          }));
          setTimetable(slots);
        }
      } catch (err) {
        // Surface the error in the console so a support engineer can see why
        // the timetable is empty; the UI still falls through to the "No
        // timetable yet" empty state either way.
        console.error("[Timetable] fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTimetable();
  }, [studentData?.classId, studentData?.id]);

  const today = DAYS[selectedDay];
  const todaySlots = timetable.filter((t: any) =>
    (t.day || "").toLowerCase() === today.toLowerCase()
  ).sort((a: any, b: any) => (a.period || 0) - (b.period || 0));

  /* ═══════════════════════════════════════════════════════════════
     MOBILE — Bright Blue Apple UI
     ═══════════════════════════════════════════════════════════════ */
  if (isMobile) {
    const B1 = "#0055FF";
    const B2 = "#1166FF";
    const BG = "#EEF4FF";
    const BG2 = "#E0ECFF";
    const T1 = "#001040";
    const T2 = "#002080";
    const T3 = "#5070B0";
    const T4 = "#99AACC";
    const SEP = "rgba(0,85,255,0.07)";
    const SH = "0 0 0 0.5px rgba(0,85,255,0.08), 0 2px 8px rgba(0,85,255,0.10), 0 10px 28px rgba(0,85,255,0.12)";
    const SH_BTN = "0 6px 22px rgba(0,85,255,0.42), 0 2px 6px rgba(0,85,255,0.24)";

    // ── This week's dates (Mon → Sat) ──
    const now = new Date();
    const jsDow = now.getDay(); // 0=Sun..6=Sat
    const daysSinceMonday = jsDow === 0 ? 6 : jsDow - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysSinceMonday);
    monday.setHours(0, 0, 0, 0);
    const weekDates = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });

    // ── Period counts per day (Mon-Fri for week strip) ──
    const perDayCount = DAYS.map(day =>
      timetable.filter((t: any) => (t.day || "").toLowerCase() === day.toLowerCase()).length
    );

    // Total scheduled periods this week (for progress)
    const totalPeriodsThisWeek = perDayCount.slice(0, 6).reduce((a, b) => a + b, 0);
    const periodsByToday = perDayCount.slice(0, selectedDay + 1).reduce((a, b) => a + b, 0);
    const progressPct = totalPeriodsThisWeek > 0
      ? Math.round((periodsByToday / totalPeriodsThisWeek) * 100)
      : 0;

    // ── Per-subject accent (rotates three blue shades) ──
    const subjectAccents = [
      { bar: "linear-gradient(180deg, #0055FF, #4499FF)",  icoBg: "linear-gradient(135deg, #0044EE, #2277FF)", icoShadow: "0 3px 10px rgba(0,68,238,0.28)" },
      { bar: "linear-gradient(180deg, #0033CC, #2277FF)",  icoBg: "linear-gradient(135deg, #002DBB, #0055FF)", icoShadow: "0 3px 10px rgba(0,45,187,0.28)" },
      { bar: "linear-gradient(180deg, #2255DD, #66BBFF)",  icoBg: "linear-gradient(135deg, #1155EE, #44AAFF)", icoShadow: "0 3px 10px rgba(17,85,238,0.28)" },
    ];
    // Stable mapping subject → accent
    const subjectAccentMap = new Map<string, number>();
    let accentIdx = 0;
    const getSubjectAccent = (subject: string) => {
      if (!subjectAccentMap.has(subject)) {
        subjectAccentMap.set(subject, accentIdx % subjectAccents.length);
        accentIdx++;
      }
      return subjectAccents[subjectAccentMap.get(subject)!];
    };

    const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    return (
      <div className="animate-in fade-in duration-500 -mx-3 -mt-3 md:mx-0 md:mt-0"
        style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", background: BG, minHeight: "100vh" }}>

        {/* ── Hero Banner ── */}
        <div className="mx-5 mt-4 rounded-[26px] px-[22px] pt-[22px] pb-6 relative overflow-hidden"
          style={{
            background: "linear-gradient(140deg, #0033CC 0%, #0055FF 40%, #2277FF 75%, #55AAFF 100%)",
            boxShadow: SH_BTN,
            minHeight: 140,
          }}>
          <div className="absolute -top-[30px] -right-5 w-[140px] h-[140px] rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.14)" }} />
          <div className="absolute -bottom-[30px] right-[30px] w-[110px] h-[110px] rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }} />
          <div className="absolute -bottom-[10px] right-[90px] w-[70px] h-[70px] rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)" }} />
          <div className="absolute bottom-[10px] right-[160px] w-11 h-11 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px)",
            backgroundSize: "24px 24px"
          }} />

          <div className="text-[9px] font-bold uppercase tracking-[0.14em] mb-2 relative z-10" style={{ color: "rgba(255,255,255,0.55)" }}>Weekly Schedule</div>
          <div className="text-[36px] font-bold text-white mb-[10px] relative z-10 leading-[1.05]" style={{ letterSpacing: "-0.9px" }}>Timetable</div>
          <div className="text-[13px] font-medium flex items-center gap-[5px] relative z-10" style={{ color: "rgba(255,255,255,0.72)" }}>
            <User className="w-[13px] h-[13px]" style={{ color: "rgba(255,255,255,0.75)" }} strokeWidth={2.2} />
            <span className="truncate">{studentData?.name || "Student"}</span>
            {(studentData?.className || (studentData as any)?.class) && (
              <>
                <span className="w-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.55)" }} />
                <span>{studentData?.className || (studentData as any)?.class}</span>
              </>
            )}
          </div>
        </div>

        {/* ── Day Selector ── */}
        <div className="px-5 pt-[18px] flex flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {DAY_SHORT.map((lbl, i) => {
              const isAct = selectedDay === i;
              const d = weekDates[i];
              return (
                <button
                  key={lbl}
                  onClick={() => setSelectedDay(i)}
                  className="flex flex-col items-center gap-[3px] min-w-[52px] px-2 py-[10px] rounded-[18px] transition-transform active:scale-[0.92] shrink-0"
                  style={{
                    background: isAct ? `linear-gradient(135deg, ${B1}, ${B2})` : "#FFFFFF",
                    border: isAct ? "0.5px solid rgba(0,85,255,0.10)" : "0.5px solid rgba(0,85,255,0.10)",
                    boxShadow: isAct ? "0 4px 16px rgba(0,85,255,0.36), 0 1px 4px rgba(0,85,255,0.22)" : SH,
                    transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
                  }}
                >
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: isAct ? "#FFFFFF" : T3 }}>{lbl}</span>
                  <span className="text-[17px] font-bold" style={{ color: isAct ? "#FFFFFF" : T2, letterSpacing: "-0.3px" }}>{d.getDate()}</span>
                  <span className="w-[5px] h-[5px] rounded-full mt-[1px]" style={{ background: isAct ? "rgba(255,255,255,0.55)" : "transparent" }} />
                </button>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="h-[3px] rounded-[2px] overflow-hidden" style={{ background: BG2 }}>
            <div className="h-full rounded-[2px] transition-all duration-500"
              style={{ width: `${Math.max(progressPct, 4)}%`, background: `linear-gradient(90deg, ${B1}, #4499FF)` }} />
          </div>
        </div>

        {/* ── Day Head ── */}
        <div className="flex items-center justify-between mx-5 mt-5">
          <div className="text-[18px] font-bold" style={{ color: T1, letterSpacing: "-0.4px" }}>
            {DAYS[selectedDay]}
            <span className="text-[12px] font-medium ml-2" style={{ color: T4, letterSpacing: 0 }}>
              · {MONTH[weekDates[selectedDay].getMonth()]} {weekDates[selectedDay].getDate()}
            </span>
          </div>
          <div className="text-[11px] font-bold px-[11px] py-1 rounded-full tracking-[0.04em]"
            style={{ color: B1, background: "rgba(0,85,255,0.10)", border: "0.5px solid rgba(0,85,255,0.18)" }}>
            {todaySlots.length} {todaySlots.length === 1 ? "Period" : "Periods"}
          </div>
        </div>

        {/* ── Period List ── */}
        <div className="px-5 mt-3 flex flex-col gap-[10px]">
          {loading ? (
            <div className="flex flex-col items-center gap-[10px] py-10">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: BG2 }}>
                <Loader2 className="w-7 h-7 animate-spin" style={{ color: B1 }} />
              </div>
              <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: T4 }}>Loading schedule…</p>
            </div>
          ) : timetable.length === 0 ? (
            <div className="flex flex-col items-center gap-[10px] py-12 text-center">
              <div className="w-[60px] h-[60px] rounded-[20px] flex items-center justify-center"
                style={{ background: "rgba(0,85,255,0.08)", border: "0.5px solid rgba(0,85,255,0.14)", boxShadow: "0 0 0 8px rgba(0,85,255,0.04)" }}>
                <CalendarDays className="w-7 h-7" style={{ color: T4 }} />
              </div>
              <div className="text-[16px] font-bold" style={{ color: T2, letterSpacing: "-0.2px" }}>No timetable yet</div>
              <div className="text-[13px] max-w-[220px] leading-[1.55]" style={{ color: T4 }}>Your school hasn't set up the timetable.</div>
            </div>
          ) : todaySlots.length === 0 ? (
            <div className="flex flex-col items-center gap-[10px] py-12 text-center">
              <div className="w-[60px] h-[60px] rounded-[20px] flex items-center justify-center"
                style={{ background: "rgba(0,85,255,0.08)", border: "0.5px solid rgba(0,85,255,0.14)", boxShadow: "0 0 0 8px rgba(0,85,255,0.04)" }}>
                <CalendarDays className="w-7 h-7" style={{ color: T4 }} />
              </div>
              <div className="text-[16px] font-bold" style={{ color: T2, letterSpacing: "-0.2px" }}>No classes today</div>
              <div className="text-[13px] max-w-[220px] leading-[1.55]" style={{ color: T4 }}>Enjoy the day off!</div>
            </div>
          ) : (
            <>
              {todaySlots.map((slot: any, i: number) => {
                const accent = getSubjectAccent(slot.subject || "Subject");
                const periodNum = String(slot.period || i + 1).padStart(2, "0");
                const subject = slot.subject || "Subject";
                const tag = subject.substring(0, 3).toUpperCase();
                return (
                  <div key={slot.id || i}
                    className="rounded-[20px] px-4 py-4 flex items-center gap-[14px] relative overflow-hidden bg-white active:scale-[0.97] transition-transform"
                    style={{ boxShadow: SH, border: "0.5px solid rgba(0,85,255,0.10)", transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)" }}>
                    <div className="absolute left-0 top-0 bottom-0 w-[3.5px] rounded-l-[2px]" style={{ background: accent.bar }} />
                    <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 text-[12px] font-bold"
                      style={{ background: "rgba(0,85,255,0.10)", border: "0.5px solid rgba(0,85,255,0.18)", color: B1, letterSpacing: "-0.2px" }}>
                      {periodNum}
                    </div>
                    <div className="w-10 h-10 rounded-[13px] flex items-center justify-center shrink-0"
                      style={{ background: accent.icoBg, boxShadow: accent.icoShadow }}>
                      <BookOpen className="w-5 h-5 text-white" strokeWidth={2.2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-bold mb-1 truncate" style={{ color: T1, letterSpacing: "-0.2px" }}>{subject}</div>
                      <div className="flex items-center gap-[10px] flex-wrap">
                        {slot.teacherName && (
                          <div className="flex items-center gap-1 text-[11px] font-medium" style={{ color: T3 }}>
                            <User className="w-[11px] h-[11px] opacity-70" strokeWidth={2.2} />
                            <span className="truncate max-w-[120px]">{slot.teacherName}</span>
                          </div>
                        )}
                        {slot.time && (
                          <div className="flex items-center gap-1 text-[11px] font-medium" style={{ color: T3 }}>
                            <Clock className="w-[11px] h-[11px] opacity-70" strokeWidth={2.2} />
                            {slot.time}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="px-[11px] py-[5px] rounded-full text-[10px] font-bold shrink-0 tracking-[0.02em]"
                      style={{ background: "rgba(0,85,255,0.10)", color: B1, border: "0.5px solid rgba(0,85,255,0.20)" }}>
                      {tag}
                    </div>
                  </div>
                );
              })}

              {/* End divider */}
              <div className="flex items-center justify-center gap-2 py-[10px]">
                <div className="flex-1 h-px" style={{ background: "rgba(0,85,255,0.10)" }} />
                <div className="text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "rgba(0,85,255,0.30)" }}>No more periods</div>
                <div className="flex-1 h-px" style={{ background: "rgba(0,85,255,0.10)" }} />
              </div>
            </>
          )}
        </div>

        {/* ── This Week Overview ── */}
        {!loading && timetable.length > 0 && (
          <div className="mx-5 mt-4 bg-white rounded-[20px] px-[18px] py-4"
            style={{ boxShadow: SH, border: "0.5px solid rgba(0,85,255,0.10)" }}>
            <div className="text-[12px] font-bold uppercase tracking-[0.08em] mb-[14px]" style={{ color: T4 }}>This Week</div>
            <div className="grid grid-cols-5 gap-2">
              {DAY_SHORT.slice(0, 5).map((lbl, i) => {
                const isAct = selectedDay === i;
                const count = perDayCount[i];
                return (
                  <button
                    key={lbl}
                    onClick={() => setSelectedDay(i)}
                    className="flex flex-col items-center gap-[5px]"
                  >
                    <div
                      className="w-9 h-9 rounded-[12px] flex items-center justify-center"
                      style={
                        isAct
                          ? { background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: "0 3px 10px rgba(0,85,255,0.30)" }
                          : { background: BG, border: "0.5px solid rgba(0,85,255,0.12)" }
                      }>
                      <span className="text-[11px] font-bold" style={{ color: isAct ? "#FFFFFF" : T3 }}>{count}</span>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-[0.06em]" style={{ color: isAct ? B1 : T4 }}>{lbl}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="h-6" />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     DESKTOP — Existing UI (unchanged)
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-[2rem] md:rounded-[3rem] p-6 sm:p-8 md:p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10 scale-150"><CalendarDays size={200} /></div>
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-purple-200 mb-3">Weekly Schedule</p>
          <h1 className="text-4xl font-black tracking-tighter mb-2">Timetable</h1>
          <p className="text-purple-200 text-sm font-bold">{studentData?.name} · {studentData?.className || "Class"}</p>
        </div>
      </div>

      {/* Day Selector */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {DAYS.map((day, i) => {
          const isToday = new Date().getDay() - 1 === i;
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(i)}
              className={`flex flex-col items-center px-5 py-4 rounded-[1.5rem] font-black transition-all shrink-0 border ${
                selectedDay === i
                  ? "bg-[#1e294b] text-white border-[#1e294b] shadow-xl shadow-slate-900/20"
                  : isToday
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
              }`}
            >
              <span className="text-[10px] uppercase tracking-widest mb-1">{DAY_SHORT[i]}</span>
              {isToday && <span className="text-[8px] uppercase tracking-widest font-black text-purple-500">Today</span>}
            </button>
          );
        })}
      </div>

      {/* Schedule for selected day */}
      <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 md:px-10 py-4 md:py-7 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tighter">{DAYS[selectedDay]}</h2>
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{todaySlots.length} Periods</span>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-4" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading schedule...</p>
          </div>
        ) : timetable.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center px-10">
            <div className="w-20 h-20 rounded-[2rem] bg-slate-50 flex items-center justify-center mb-6">
              <CalendarDays className="w-10 h-10 text-slate-200" />
            </div>
            <p className="text-lg font-black text-slate-300 uppercase tracking-widest">No timetable yet</p>
            <p className="text-xs font-bold text-slate-300 mt-2">Your school has not set up the timetable.</p>
          </div>
        ) : todaySlots.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center px-10">
            <div className="w-20 h-20 rounded-[2rem] bg-emerald-50 flex items-center justify-center mb-6">
              <CalendarDays className="w-10 h-10 text-emerald-300" />
            </div>
            <p className="text-lg font-black text-slate-400 uppercase tracking-widest">No classes today</p>
            <p className="text-xs font-bold text-slate-300 mt-2">Enjoy your day off!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {todaySlots.map((slot: any, i: number) => {
              const colorClass = getSubjectColor(slot.subject);
              return (
                <div key={slot.id || i} className="px-4 sm:px-6 md:px-10 py-4 md:py-6 flex items-center gap-3 md:gap-6 hover:bg-slate-50/50 transition-all">
                  <div className="text-center w-10 md:w-16 shrink-0">
                    <p className="text-xl md:text-2xl font-black text-slate-200">{String(slot.period || i + 1).padStart(2, '0')}</p>
                    <p className="text-[8px] md:text-[9px] font-black text-slate-300 uppercase tracking-widest hidden sm:block">Period</p>
                  </div>
                  <div className={`w-10 h-10 md:w-14 md:h-14 rounded-[1rem] md:rounded-[1.5rem] flex items-center justify-center border shrink-0 ${colorClass}`}>
                    <BookOpen className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-base md:text-xl uppercase tracking-tight leading-none mb-1 md:mb-2 truncate">{slot.subject}</p>
                    <div className="flex flex-wrap items-center gap-2 md:gap-4">
                      {slot.teacherName && (
                        <span className="flex items-center gap-1 text-xs font-bold text-slate-400">
                          <User className="w-3 h-3 md:w-3.5 md:h-3.5" /> <span className="truncate max-w-[100px] md:max-w-none">{slot.teacherName}</span>
                        </span>
                      )}
                      {slot.time && (
                        <span className="flex items-center gap-1 text-xs font-bold text-slate-400">
                          <Clock className="w-3 h-3 md:w-3.5 md:h-3.5" /> {slot.time}
                        </span>
                      )}
                      {slot.room && (
                        <span className="text-xs font-bold text-slate-400 hidden sm:block">Room {slot.room}</span>
                      )}
                    </div>
                  </div>
                  <div className={`px-2 py-1 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest border ${colorClass} shrink-0`}>
                    {slot.subject?.substring(0, 3)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimetablePage;
