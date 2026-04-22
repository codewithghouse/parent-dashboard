import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
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

        // No timetable found. Earlier code tried to "recover" by fabricating
        // slots from teaching_assignments — assigning a random day (index % 5)
        // and a made-up "8:00 - 9:00" time. That showed parents a confident
        // but completely fake schedule. Now we honestly leave timetable empty
        // and let the UI render the "No timetable yet" empty state.
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
  }, [studentData?.classId, studentData?.id, studentData?.schoolId]);

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
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${subject} syllabus`}
                    onClick={() => navigate("/syllabus", { state: { subject } })}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/syllabus", { state: { subject } }); } }}
                    className="rounded-[20px] px-4 py-4 flex items-center gap-[14px] relative overflow-hidden bg-white cursor-pointer active:scale-[0.97] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
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
                    aria-label={`Show ${DAYS[i]} schedule`}
                    aria-pressed={isAct}
                    className="flex flex-col items-center gap-[5px] active:scale-[0.94] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40 rounded-[12px]"
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
     DESKTOP — Bright Blue Apple UI (matches mobile)
     ═══════════════════════════════════════════════════════════════ */
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

  // Week dates
  const now = new Date();
  const jsDow = now.getDay();
  const daysSinceMonday = jsDow === 0 ? 6 : jsDow - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysSinceMonday);
  monday.setHours(0, 0, 0, 0);
  const weekDates = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const perDayCount = DAYS.map(day =>
    timetable.filter((t: any) => (t.day || "").toLowerCase() === day.toLowerCase()).length
  );
  const totalPeriodsThisWeek = perDayCount.slice(0, 6).reduce((a, b) => a + b, 0);
  const periodsByToday = perDayCount.slice(0, selectedDay + 1).reduce((a, b) => a + b, 0);
  const progressPct = totalPeriodsThisWeek > 0
    ? Math.round((periodsByToday / totalPeriodsThisWeek) * 100)
    : 0;

  const subjectAccents = [
    { bar: "linear-gradient(180deg, #0055FF, #4499FF)",  icoBg: "linear-gradient(135deg, #0044EE, #2277FF)", icoShadow: "0 3px 10px rgba(0,68,238,0.28)" },
    { bar: "linear-gradient(180deg, #0033CC, #2277FF)",  icoBg: "linear-gradient(135deg, #002DBB, #0055FF)", icoShadow: "0 3px 10px rgba(0,45,187,0.28)" },
    { bar: "linear-gradient(180deg, #2255DD, #66BBFF)",  icoBg: "linear-gradient(135deg, #1155EE, #44AAFF)", icoShadow: "0 3px 10px rgba(17,85,238,0.28)" },
  ];
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
    <div className="animate-in fade-in duration-500 -m-4 sm:-m-6 md:-m-8 min-h-[calc(100vh-64px)]"
      style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", background: BG }}>
      <div className="w-full px-6 pt-8 pb-12">

        {/* ── Hero Banner ── */}
        <div className="rounded-[26px] px-8 pt-8 pb-8 relative overflow-hidden mb-5"
          style={{
            background: "linear-gradient(140deg, #0033CC 0%, #0055FF 40%, #2277FF 75%, #55AAFF 100%)",
            boxShadow: SH_BTN,
            minHeight: 180,
          }}>
          <div className="absolute -top-[40px] -right-[40px] w-[260px] h-[260px] rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.14)" }} />
          <div className="absolute -bottom-[50px] right-[60px] w-[180px] h-[180px] rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }} />
          <div className="absolute -bottom-[10px] right-[200px] w-[120px] h-[120px] rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)" }} />
          <div className="absolute bottom-[40px] right-[340px] w-[80px] h-[80px] rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px)",
            backgroundSize: "28px 28px"
          }} />
          <div className="flex items-end justify-between gap-6 flex-wrap relative z-10">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>Weekly Schedule</div>
              <div className="text-[48px] font-bold text-white mb-3 leading-[1.02]" style={{ letterSpacing: "-1.4px" }}>Timetable</div>
              <div className="text-[14px] font-medium flex items-center gap-[6px]" style={{ color: "rgba(255,255,255,0.78)" }}>
                <User className="w-[14px] h-[14px]" style={{ color: "rgba(255,255,255,0.75)" }} strokeWidth={2.2} />
                <span className="truncate">{studentData?.name || "Student"}</span>
                {(studentData?.className || (studentData as any)?.class) && (
                  <>
                    <span className="w-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.55)" }} />
                    <span>{studentData?.className || (studentData as any)?.class}</span>
                  </>
                )}
              </div>
            </div>
            {!loading && timetable.length > 0 && (
              <div className="flex items-center gap-5">
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "rgba(255,255,255,0.55)" }}>This Week</div>
                  <div className="text-[30px] font-bold text-white leading-none mt-1" style={{ letterSpacing: "-0.8px" }}>{totalPeriodsThisWeek}</div>
                  <div className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.60)" }}>periods</div>
                </div>
                <div className="w-px h-14" style={{ background: "rgba(255,255,255,0.22)" }} />
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "rgba(255,255,255,0.55)" }}>Progress</div>
                  <div className="text-[30px] font-bold text-white leading-none mt-1" style={{ letterSpacing: "-0.8px" }}>{progressPct}%</div>
                  <div className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.60)" }}>through week</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Day Selector ── */}
        <div className="flex flex-col gap-3 mb-5">
          <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
            {DAY_SHORT.map((lbl, i) => {
              const isAct = selectedDay === i;
              const d = weekDates[i];
              const isToday = new Date().toDateString() === d.toDateString();
              return (
                <button
                  key={lbl}
                  onClick={() => setSelectedDay(i)}
                  className="flex flex-col items-center gap-1 min-w-[90px] px-4 py-3 rounded-[18px] transition-transform hover:scale-[1.03] shrink-0"
                  style={{
                    background: isAct ? `linear-gradient(135deg, ${B1}, ${B2})` : "#FFFFFF",
                    border: "0.5px solid rgba(0,85,255,0.10)",
                    boxShadow: isAct ? "0 4px 16px rgba(0,85,255,0.36), 0 1px 4px rgba(0,85,255,0.22)" : SH,
                  }}>
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: isAct ? "#FFFFFF" : T3 }}>{lbl}</span>
                  <span className="text-[22px] font-bold leading-none" style={{ color: isAct ? "#FFFFFF" : T2, letterSpacing: "-0.4px" }}>{d.getDate()}</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.08em]" style={{ color: isAct ? "rgba(255,255,255,0.75)" : isToday ? B1 : T4 }}>
                    {isToday ? "Today" : `${perDayCount[i]} period${perDayCount[i] === 1 ? "" : "s"}`}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="h-[3px] rounded-[2px] overflow-hidden" style={{ background: BG2 }}>
            <div className="h-full rounded-[2px] transition-all duration-500"
              style={{ width: `${Math.max(progressPct, 4)}%`, background: `linear-gradient(90deg, ${B1}, #4499FF)` }} />
          </div>
        </div>

        {/* ── Main content row: Day schedule + Week overview sidebar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Today's periods (lg:col-span-2) */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[22px] font-bold" style={{ color: T1, letterSpacing: "-0.5px" }}>
                {DAYS[selectedDay]}
                <span className="text-[14px] font-medium ml-3" style={{ color: T4, letterSpacing: 0 }}>
                  · {MONTH[weekDates[selectedDay].getMonth()]} {weekDates[selectedDay].getDate()}
                </span>
              </div>
              <div className="text-[12px] font-bold px-3 py-[6px] rounded-full tracking-[0.04em]"
                style={{ color: B1, background: "rgba(0,85,255,0.10)", border: "0.5px solid rgba(0,85,255,0.18)" }}>
                {todaySlots.length} {todaySlots.length === 1 ? "Period" : "Periods"}
              </div>
            </div>

            <div className="flex flex-col gap-[10px]">
              {loading ? (
                <div className="flex flex-col items-center gap-[10px] py-16 bg-white rounded-[20px]"
                  style={{ boxShadow: SH, border: "0.5px solid rgba(0,85,255,0.10)" }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: BG2 }}>
                    <Loader2 className="w-7 h-7 animate-spin" style={{ color: B1 }} />
                  </div>
                  <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: T4 }}>Loading schedule…</p>
                </div>
              ) : timetable.length === 0 ? (
                <div className="flex flex-col items-center gap-[10px] py-20 text-center bg-white rounded-[20px]"
                  style={{ boxShadow: SH, border: "0.5px solid rgba(0,85,255,0.10)" }}>
                  <div className="w-[70px] h-[70px] rounded-[22px] flex items-center justify-center"
                    style={{ background: "rgba(0,85,255,0.08)", border: "0.5px solid rgba(0,85,255,0.14)", boxShadow: "0 0 0 10px rgba(0,85,255,0.04)" }}>
                    <CalendarDays className="w-9 h-9" style={{ color: T4 }} />
                  </div>
                  <div className="text-[18px] font-bold" style={{ color: T2, letterSpacing: "-0.3px" }}>No timetable yet</div>
                  <div className="text-[14px] max-w-[300px] leading-[1.55]" style={{ color: T4 }}>Your school hasn't set up the timetable.</div>
                </div>
              ) : todaySlots.length === 0 ? (
                <div className="flex flex-col items-center gap-[10px] py-20 text-center bg-white rounded-[20px]"
                  style={{ boxShadow: SH, border: "0.5px solid rgba(0,85,255,0.10)" }}>
                  <div className="w-[70px] h-[70px] rounded-[22px] flex items-center justify-center"
                    style={{ background: "rgba(0,85,255,0.08)", border: "0.5px solid rgba(0,85,255,0.14)", boxShadow: "0 0 0 10px rgba(0,85,255,0.04)" }}>
                    <CalendarDays className="w-9 h-9" style={{ color: T4 }} />
                  </div>
                  <div className="text-[18px] font-bold" style={{ color: T2, letterSpacing: "-0.3px" }}>No classes today</div>
                  <div className="text-[14px] max-w-[300px] leading-[1.55]" style={{ color: T4 }}>Enjoy the day off!</div>
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
                        role="button"
                        tabIndex={0}
                        aria-label={`Open ${subject} syllabus`}
                        onClick={() => navigate("/syllabus", { state: { subject } })}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/syllabus", { state: { subject } }); } }}
                        className="rounded-[20px] px-5 py-4 flex items-center gap-4 relative overflow-hidden bg-white cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FF]/40"
                        style={{ boxShadow: SH, border: "0.5px solid rgba(0,85,255,0.10)" }}>
                        <div className="absolute left-0 top-0 bottom-0 w-[3.5px]" style={{ background: accent.bar }} />
                        <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 text-[13px] font-bold"
                          style={{ background: "rgba(0,85,255,0.10)", border: "0.5px solid rgba(0,85,255,0.18)", color: B1, letterSpacing: "-0.2px" }}>
                          {periodNum}
                        </div>
                        <div className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0"
                          style={{ background: accent.icoBg, boxShadow: accent.icoShadow }}>
                          <BookOpen className="w-[22px] h-[22px] text-white" strokeWidth={2.2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[17px] font-bold mb-1 truncate" style={{ color: T1, letterSpacing: "-0.3px" }}>{subject}</div>
                          <div className="flex items-center gap-4 flex-wrap">
                            {slot.teacherName && (
                              <div className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: T3 }}>
                                <User className="w-[13px] h-[13px] opacity-70" strokeWidth={2.2} />
                                <span className="truncate max-w-[200px]">{slot.teacherName}</span>
                              </div>
                            )}
                            {slot.time && (
                              <div className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: T3 }}>
                                <Clock className="w-[13px] h-[13px] opacity-70" strokeWidth={2.2} />
                                {slot.time}
                              </div>
                            )}
                            {slot.room && (
                              <div className="text-[12px] font-medium" style={{ color: T3 }}>Room {slot.room}</div>
                            )}
                          </div>
                        </div>
                        <div className="px-3 py-[6px] rounded-full text-[11px] font-bold shrink-0 tracking-[0.02em]"
                          style={{ background: "rgba(0,85,255,0.10)", color: B1, border: "0.5px solid rgba(0,85,255,0.20)" }}>
                          {tag}
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex items-center justify-center gap-2 py-3">
                    <div className="flex-1 h-px" style={{ background: "rgba(0,85,255,0.10)" }} />
                    <div className="text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "rgba(0,85,255,0.30)" }}>No more periods</div>
                    <div className="flex-1 h-px" style={{ background: "rgba(0,85,255,0.10)" }} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* This Week sidebar */}
          {!loading && timetable.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="bg-white rounded-[22px] p-5"
                style={{ boxShadow: SH, border: "0.5px solid rgba(0,85,255,0.10)" }}>
                <div className="text-[13px] font-bold uppercase tracking-[0.08em] mb-4" style={{ color: T4 }}>This Week Overview</div>
                <div className="flex flex-col gap-[10px]">
                  {DAY_SHORT.slice(0, 6).map((lbl, i) => {
                    const isAct = selectedDay === i;
                    const count = perDayCount[i];
                    const d = weekDates[i];
                    const isToday = new Date().toDateString() === d.toDateString();
                    const maxCount = Math.max(...perDayCount, 1);
                    return (
                      <button key={lbl}
                        onClick={() => setSelectedDay(i)}
                        className="flex items-center gap-3 p-3 rounded-[14px] transition-transform hover:-translate-y-0.5 text-left"
                        style={{
                          background: isAct ? `linear-gradient(135deg, rgba(0,85,255,0.08), rgba(68,153,255,0.04))` : BG,
                          border: `0.5px solid ${isAct ? "rgba(0,85,255,0.24)" : "rgba(0,85,255,0.10)"}`,
                        }}>
                        <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0"
                          style={{
                            background: isAct ? `linear-gradient(135deg, ${B1}, ${B2})` : "#fff",
                            boxShadow: isAct ? "0 3px 10px rgba(0,85,255,0.30)" : SH,
                            border: isAct ? "0.5px solid transparent" : "0.5px solid rgba(0,85,255,0.12)",
                          }}>
                          <span className="text-[15px] font-bold" style={{ color: isAct ? "#FFFFFF" : B1, letterSpacing: "-0.3px" }}>{count}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-bold" style={{ color: T1 }}>{DAYS[i]}</span>
                            {isToday && (
                              <span className="text-[9px] font-bold px-[6px] py-[2px] rounded-full"
                                style={{ background: "rgba(0,85,255,0.10)", color: B1, border: "0.5px solid rgba(0,85,255,0.22)" }}>
                                TODAY
                              </span>
                            )}
                          </div>
                          <div className="h-[4px] rounded-[2px] mt-1.5 overflow-hidden" style={{ background: BG2 }}>
                            <div className="h-full rounded-[2px]"
                              style={{ width: `${(count / maxCount) * 100}%`, background: isAct ? `linear-gradient(90deg, ${B1}, #4499FF)` : "rgba(0,85,255,0.35)" }} />
                          </div>
                          <div className="text-[10px] mt-1 font-medium" style={{ color: T4 }}>
                            {count === 0 ? "No classes" : `${count} ${count === 1 ? "period" : "periods"}`}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimetablePage;
