import { useState, useEffect, useRef } from "react";
import { CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon, Users } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useIsMobile } from "@/hooks/use-mobile";

type DayStatus = "present" | "absent" | "late" | "weekend" | "forgotten" | "empty";

const AttendancePage = () => {
  const { studentData } = useAuth();
  const { attendanceThreshold } = useSchoolSettings();
  const isMobile = useIsMobile();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, percentage: 0 });
  const [monthStats, setMonthStats] = useState({ present: 0, absent: 0, late: 0 });

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    if (!studentData?.id) return;
    setLoading(true);
    const schoolId = studentData.schoolId;

    const processLogs = (snap: any) => {
      if (!mountedRef.current) return;
      const uniqueLogs = Array.from(new Map(snap.docs.map((d: any) => [d.id, { id: d.id, ...d.data() as any }])).values())
        .sort((a: any, b: any) => b.date.localeCompare(a.date));
      setAttendanceLogs(uniqueLogs);

      const pCount = uniqueLogs.filter((l: any) => l.status === "present").length;
      const aCount = uniqueLogs.filter((l: any) => l.status === "absent").length;
      const lCount = uniqueLogs.filter((l: any) => l.status === "late").length;
      const total = pCount + aCount + lCount;
      // Don't fake 100% when there are zero records — that misled parents into
      // thinking the student had perfect attendance even before any class day
      // had been marked. 0 conveys "no data" without implying a positive value.
      setStats({ present: pCount, absent: aCount, late: lCount, percentage: total === 0 ? 0 : Math.round(((pCount + lCount) / total) * 100) });

      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const thisMonth = uniqueLogs.filter((l: any) => l.date?.startsWith(ym));
      setMonthStats({
        present: thisMonth.filter((l: any) => l.status === "present").length,
        absent: thisMonth.filter((l: any) => l.status === "absent").length,
        late: thisMonth.filter((l: any) => l.status === "late").length,
      });
      setLoading(false);
    };

    // Limit to current academic year — avoids fetching 4+ years of history (500+ docs → ~200 docs)
    // Academic year: June of this year if after June, else June of last year
    const now = new Date();
    const yearStart = now.getMonth() >= 5
      ? `${now.getFullYear()}-06-01`
      : `${now.getFullYear() - 1}-06-01`;

    // Single query scoped to this school + current academic year — prevents cross-school reads
    const q = schoolId
      ? query(collection(db, "attendance"), where("schoolId", "==", schoolId), where("studentId", "==", studentData.id), where("date", ">=", yearStart))
      : query(collection(db, "attendance"), where("studentId", "==", studentData.id), where("date", ">=", yearStart));
    const u1 = onSnapshot(q, s => processLogs(s));
    return () => { u1(); };
  }, [studentData?.id, studentData?.schoolId]);

  const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  const handlePrevMonth = () => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1));
  const handleNextMonth = () => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1));

  const getDayStatus = (day: number): DayStatus => {
    const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
    // Weekend check first — always weekend regardless of records
    if (d.getDay() === 0 || d.getDay() === 6) return "weekend";

    const dateStr = d.toLocaleDateString("en-CA");
    const logs = attendanceLogs.filter(l => l.date === dateStr);

    if (logs.length === 0) {
      // No records for this day — check if it's a past weekday (teacher forgot)
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      if (d.getTime() < todayMidnight.getTime()) return "forgotten";
      return "empty"; // today or future
    }

    if (logs.some(l => l.status === "absent")) return "absent";
    if (logs.some(l => l.status === "late")) return "late";
    if (logs.some(l => l.status === "present")) return "present";
    return "empty";
  };

  const monthName = selectedDate.toLocaleString("default", { month: "long", year: "numeric" });
  const recentAbsences = attendanceLogs.filter(a => a.status !== "present").slice(0, 5);

  /* ═══════════════════════════════════════════════════════════════
     MOBILE — Bright Blue Apple UI
     ═══════════════════════════════════════════════════════════════ */
  if (isMobile) {
    const B1 = "#0055FF", B2 = "#1166FF", B4 = "#4499FF";
    const BG = "#EEF4FF", BG2 = "#E0ECFF";
    const T1 = "#001040", T2 = "#002080", T3 = "#5070B0", T4 = "#99AACC";
    const SEP = "rgba(0,85,255,0.07)";
    const GREEN = "#00C853", GREEN_D = "#007830", GREEN_S = "rgba(0,200,83,0.10)", GREEN_B = "rgba(0,200,83,0.22)";
    const RED = "#FF3355";
    const ORANGE = "#FF8800";
    const SH = "0 0 0 0.5px rgba(0,85,255,0.08), 0 2px 8px rgba(0,85,255,0.09), 0 10px 28px rgba(0,85,255,0.11)";
    const SH_LG = "0 0 0 0.5px rgba(0,85,255,0.10), 0 4px 16px rgba(0,85,255,0.12), 0 20px 48px rgba(0,85,255,0.13)";
    const SH_BTN = "0 6px 22px rgba(0,85,255,0.42), 0 2px 6px rgba(0,85,255,0.22)";

    // Ring: green if at/above threshold, red otherwise
    const aboveThreshold = stats.percentage >= attendanceThreshold;
    const ringColor = aboveThreshold ? GREEN : RED;
    const ringR = 36;
    const ringCirc = 2 * Math.PI * ringR;
    const ringOffset = ringCirc - (Math.min(stats.percentage, 100) / 100) * ringCirc;

    // Current week's daily attendance bars (Mon–Fri)
    const now = new Date();
    const jsDow = now.getDay();
    const daysFromMonday = jsDow === 0 ? 6 : jsDow - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysFromMonday);
    monday.setHours(0, 0, 0, 0);
    const weekBars = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toLocaleDateString("en-CA");
      const isFuture = d.getTime() > now.setHours(0, 0, 0, 0);
      const log = attendanceLogs.find(l => l.date === dateStr);
      const isToday = d.toDateString() === new Date().toDateString();
      const status = log?.status || (isFuture ? "future" : "none");
      return { label: ["Mon", "Tue", "Wed", "Thu", "Fri"][i], status, isToday, isFuture };
    });

    const studentFirstName = studentData?.name?.split(" ")[0] || "Student";

    return (
      <div className="animate-in fade-in duration-500 -mx-3 -mt-3 md:mx-0 md:mt-0"
        style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", background: BG, minHeight: "100vh" }}>

        {/* ── Page Head ── */}
        <div className="flex items-start justify-between px-[22px] pt-[18px]">
          <div>
            <div className="text-[24px] font-bold" style={{ color: T1, letterSpacing: "-0.6px" }}>Attendance Tracking</div>
            <div className="text-[12px] mt-[3px] font-normal" style={{ color: T3 }}>Monitor daily presence and monthly patterns</div>
          </div>
          <div className="px-3 py-[5px] rounded-full text-[11px] font-bold tracking-[0.02em] whitespace-nowrap mt-1 shrink-0"
            style={{ background: GREEN_S, color: GREEN_D, border: `0.5px solid ${GREEN_B}` }}>
            {stats.percentage}% AVG
          </div>
        </div>

        {/* ── Stat Grid 2×2 ── */}
        <div className="grid grid-cols-2 gap-[10px] mx-5 mt-4">
          {[
            {
              icon: CheckCircle, iconColor: GREEN,
              bg: "rgba(0,200,83,0.12)", border: "rgba(0,200,83,0.22)", glow: "rgba(0,200,83,0.12)",
              label: "Overall", value: `${stats.percentage}%`, valColor: GREEN,
              bar: `linear-gradient(90deg, ${GREEN}, #66EE99)`, barPct: Math.max(stats.percentage, 3)
            },
            {
              icon: Users, iconColor: B1,
              bg: "rgba(0,85,255,0.10)", border: "rgba(0,85,255,0.18)", glow: "rgba(0,85,255,0.10)",
              label: "Present", value: monthStats.present.toString(), valColor: B1,
              bar: `linear-gradient(90deg, ${B1}, ${B4})`, barPct: 100
            },
            {
              icon: XCircle, iconColor: RED,
              bg: "rgba(255,51,85,0.10)", border: "rgba(255,51,85,0.20)", glow: "rgba(255,51,85,0.10)",
              label: "Absent", value: monthStats.absent.toString(), valColor: RED,
              bar: "rgba(255,51,85,0.15)", barPct: monthStats.absent > 0 ? Math.min(monthStats.absent * 15, 100) : 8
            },
            {
              icon: Clock, iconColor: ORANGE,
              bg: "rgba(255,136,0,0.10)", border: "rgba(255,136,0,0.20)", glow: "rgba(255,136,0,0.10)",
              label: "Late", value: monthStats.late.toString(), valColor: ORANGE,
              bar: "rgba(255,136,0,0.15)", barPct: monthStats.late > 0 ? Math.min(monthStats.late * 15, 100) : 8
            },
          ].map(({ icon: Icon, iconColor, bg, border, glow, label, value, valColor, bar, barPct }) => (
            <div key={label} className="bg-white rounded-[22px] px-4 py-[18px] relative overflow-hidden active:scale-[0.96] transition-transform"
              style={{ boxShadow: SH, border: "0.5px solid rgba(0,85,255,0.10)", transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)" }}>
              <div className="absolute -top-[18px] -right-[18px] w-[70px] h-[70px] rounded-full pointer-events-none"
                style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`, opacity: 0.5 }} />
              <div className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center mb-3 relative"
                style={{ background: bg, border: `0.5px solid ${border}` }}>
                <Icon className="w-[17px] h-[17px]" style={{ color: iconColor }} strokeWidth={2.2} />
              </div>
              <div className="text-[26px] font-bold leading-none mb-[5px] relative" style={{ color: valColor, letterSpacing: "-0.6px" }}>{value}</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.09em] relative" style={{ color: T4 }}>{label}</div>
              <div className="h-[3.5px] rounded-[2px] mt-3 relative" style={{ background: bar === "rgba(255,51,85,0.15)" || bar === "rgba(255,136,0,0.15)" ? bar : "transparent" }}>
                {(bar.startsWith("linear-gradient")) && (
                  <div className="h-full rounded-[2px]" style={{ width: `${barPct}%`, background: bar }} />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── This Month Ring Summary ── */}
        <div className="mx-5 mt-3 bg-white rounded-[24px] p-5 flex items-center gap-5"
          style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
          <div className="flex-1">
            <div className="text-[16px] font-bold mb-1" style={{ color: T1, letterSpacing: "-0.3px" }}>This Month</div>
            <div className="text-[12px] mb-[14px] font-normal" style={{ color: T3 }}>{monthName} summary</div>
            <div className="flex items-center gap-[7px] mb-[6px]">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: GREEN }} />
              <span className="text-[12px] font-bold" style={{ color: T2 }}>Present</span>
              <span className="text-[12px] font-bold ml-auto" style={{ color: GREEN }}>{monthStats.present} {monthStats.present === 1 ? "day" : "days"}</span>
            </div>
            <div className="flex items-center gap-[7px] mb-[6px]">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: RED }} />
              <span className="text-[12px] font-bold" style={{ color: T2 }}>Absent</span>
              <span className="text-[12px] font-bold ml-auto" style={{ color: RED }}>{monthStats.absent} {monthStats.absent === 1 ? "day" : "days"}</span>
            </div>
            <div className="flex items-center gap-[7px]">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ORANGE }} />
              <span className="text-[12px] font-bold" style={{ color: T2 }}>Late</span>
              <span className="text-[12px] font-bold ml-auto" style={{ color: ORANGE }}>{monthStats.late} {monthStats.late === 1 ? "day" : "days"}</span>
            </div>
          </div>
          <div className="relative w-[90px] h-[90px] shrink-0">
            <svg width="90" height="90" viewBox="0 0 90 90" style={{ transform: "rotate(-90deg)" }}>
              <defs>
                <linearGradient id="attRingGreen" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={GREEN} />
                  <stop offset="100%" stopColor="#66EE88" />
                </linearGradient>
                <linearGradient id="attRingRed" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={RED} />
                  <stop offset="100%" stopColor="#FF8899" />
                </linearGradient>
              </defs>
              <circle cx="45" cy="45" r={ringR} fill="none" stroke="rgba(0,85,255,0.08)" strokeWidth="8" />
              <circle cx="45" cy="45" r={ringR} fill="none" stroke={aboveThreshold ? "url(#attRingGreen)" : "url(#attRingRed)"} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={ringCirc} strokeDashoffset={ringOffset}
                style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[20px] font-bold leading-none" style={{ color: ringColor, letterSpacing: "-0.5px" }}>{stats.percentage}%</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.08em] mt-1" style={{ color: T4 }}>Rate</div>
            </div>
          </div>
        </div>

        {/* ── Calendar ── */}
        <div className="mx-5 mt-3 bg-white rounded-[24px] p-5" style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
          <div className="flex items-center justify-between mb-4">
            <button onClick={handlePrevMonth} aria-label="Previous month"
              className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center active:scale-[0.88] transition-transform"
              style={{ background: BG, border: "0.5px solid rgba(0,85,255,0.12)", transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)" }}>
              <ChevronLeft className="w-[14px] h-[14px]" style={{ color: "rgba(0,85,255,0.7)" }} strokeWidth={2.5} />
            </button>
            <div className="flex items-center gap-[7px]">
              <div className="w-7 h-7 rounded-[9px] flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: "0 2px 8px rgba(0,85,255,0.28)" }}>
                <CalendarIcon className="w-[14px] h-[14px] text-white" strokeWidth={2.2} />
              </div>
              <span className="text-[16px] font-bold" style={{ color: T1, letterSpacing: "-0.3px" }}>{monthName}</span>
            </div>
            <button onClick={handleNextMonth} aria-label="Next month"
              className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center active:scale-[0.88] transition-transform"
              style={{ background: BG, border: "0.5px solid rgba(0,85,255,0.12)", transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)" }}>
              <ChevronRight className="w-[14px] h-[14px]" style={{ color: "rgba(0,85,255,0.7)" }} strokeWidth={2.5} />
            </button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-[14px] mb-[14px]">
            <div className="flex items-center gap-[5px] text-[10px] font-bold tracking-[0.04em]" style={{ color: T3 }}>
              <div className="w-2 h-2 rounded-full" style={{ background: GREEN }} />Present
            </div>
            <div className="flex items-center gap-[5px] text-[10px] font-bold tracking-[0.04em]" style={{ color: T3 }}>
              <div className="w-2 h-2 rounded-full" style={{ background: RED }} />Absent
            </div>
            <div className="flex items-center gap-[5px] text-[10px] font-bold tracking-[0.04em]" style={{ color: T3 }}>
              <div className="w-2 h-2 rounded-full" style={{ background: ORANGE }} />Late
            </div>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 mb-[6px]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} className="text-center py-1 text-[10px] font-bold uppercase tracking-[0.05em]" style={{ color: T4 }}>{d}</div>
            ))}
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: B1 }} />
              <p className="text-xs font-medium" style={{ color: T4 }}>Syncing logs…</p>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-[4px]">
              {Array.from({ length: firstDayOfMonth(selectedDate) }).map((_, i) => (
                <div key={`e-${i}`} className="aspect-square" />
              ))}
              {Array.from({ length: daysInMonth(selectedDate) }).map((_, i) => {
                const day = i + 1;
                const status = getDayStatus(day);
                const todayDate = new Date();
                const isToday =
                  selectedDate.getFullYear() === todayDate.getFullYear() &&
                  selectedDate.getMonth() === todayDate.getMonth() &&
                  day === todayDate.getDate();

                const cellStyle: React.CSSProperties = (() => {
                  if (isToday) {
                    return {
                      background: `linear-gradient(135deg, ${B1}, ${B2})`,
                      color: "#fff",
                      fontWeight: 700,
                      boxShadow: "0 4px 14px rgba(0,85,255,0.36), 0 1px 4px rgba(0,85,255,0.22)",
                    };
                  }
                  switch (status) {
                    case "present":
                      return { background: "rgba(0,200,83,0.10)", color: GREEN_D, border: "0.5px solid rgba(0,200,83,0.18)", fontWeight: 600 };
                    case "absent":
                      return { background: "rgba(255,51,85,0.10)", color: RED, border: "0.5px solid rgba(255,51,85,0.18)", fontWeight: 600 };
                    case "late":
                      return { background: "rgba(255,136,0,0.10)", color: ORANGE, border: "0.5px solid rgba(255,136,0,0.18)", fontWeight: 600 };
                    case "weekend":
                      return { color: T4, fontWeight: 500 };
                    case "forgotten":
                      return { color: T4, opacity: 0.7, fontWeight: 500 };
                    default:
                      return { color: T2, fontWeight: 500 };
                  }
                })();

                return (
                  <div key={day} className="aspect-square rounded-[12px] flex items-center justify-center text-[13px] relative" style={cellStyle}>
                    {day}
                    {!isToday && (status === "present" || status === "absent" || status === "late") && (
                      <span
                        className="absolute bottom-[3px] left-1/2 -translate-x-1/2 w-[5px] h-[5px] rounded-full"
                        style={{ background: status === "present" ? GREEN : status === "absent" ? RED : ORANGE }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Weekly Attendance Bars ── */}
        {!loading && (
          <div className="mx-5 mt-3 bg-white rounded-[22px] px-5 py-[18px]" style={{ boxShadow: SH, border: "0.5px solid rgba(0,85,255,0.10)" }}>
            <div className="text-[14px] font-bold mb-[14px]" style={{ color: T1, letterSpacing: "-0.2px" }}>Weekly Attendance</div>
            <div className="flex items-end justify-between gap-[6px] h-[52px] mb-2">
              {weekBars.map((b, i) => {
                const h =
                  b.status === "present" ? 44 :
                  b.status === "late" ? 32 :
                  b.status === "absent" ? 14 :
                  b.status === "future" ? 18 : 18;
                const bg =
                  b.status === "present" ? `linear-gradient(180deg, ${B1}, ${B4})` :
                  b.status === "late" ? `linear-gradient(180deg, ${ORANGE}, #FFB366)` :
                  b.status === "absent" ? `linear-gradient(180deg, ${RED}, #FF8899)` :
                  BG2;
                const isHighlight = b.isToday;
                return (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className="w-full rounded-t-[5px] min-h-[4px] transition-all duration-300"
                      style={{
                        height: h,
                        background: bg,
                        boxShadow: isHighlight ? "0 0 0 3px rgba(0,85,255,0.20)" : "none"
                      }}
                    />
                    <span className="text-[9px] font-bold uppercase tracking-[0.04em]"
                      style={{ color: isHighlight ? B1 : T4 }}>
                      {b.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Recent Absences ── */}
        <div className="mx-5 mt-3 bg-white rounded-[24px] p-5" style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
          <div className="text-[16px] font-bold mb-4" style={{ color: T1, letterSpacing: "-0.3px" }}>Recent Absences</div>

          {recentAbsences.length === 0 ? (
            // Only celebrate "perfect attendance" when there's ACTUAL attendance
            // data to back it up. Otherwise (new student, no class days marked
            // yet, etc.) say so honestly — the previous version cheered for
            // students whose attendance had never been recorded.
            attendanceLogs.length === 0 ? (
              <div className="flex flex-col items-center gap-[10px] pt-5 pb-2">
                <div className="w-[60px] h-[60px] rounded-[20px] flex items-center justify-center"
                  style={{ background: "rgba(48,48,110,0.06)", border: `0.5px solid rgba(48,48,110,0.12)` }}>
                  <CalendarIcon className="w-7 h-7" style={{ color: T4 }} strokeWidth={2.2} />
                </div>
                <div className="text-[14px] font-semibold" style={{ color: T3 }}>No attendance recorded yet</div>
                <div className="text-[12px] text-center max-w-[220px] leading-[1.55] font-normal" style={{ color: T4 }}>
                  Once your child's teacher starts marking attendance, the records will appear here.
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-[10px] pt-5 pb-2">
                <div className="w-[60px] h-[60px] rounded-[20px] flex items-center justify-center"
                  style={{ background: GREEN_S, border: `0.5px solid ${GREEN_B}`, boxShadow: "0 0 0 8px rgba(0,200,83,0.05)" }}>
                  <CheckCircle className="w-7 h-7" style={{ color: GREEN }} strokeWidth={2.2} />
                </div>
                <div className="text-[14px] font-semibold" style={{ color: T3 }}>Perfect attendance! 🎉</div>
                <div className="text-[12px] text-center max-w-[200px] leading-[1.55] font-normal" style={{ color: T4 }}>
                  No absences recorded this month. Keep it up!
                </div>
              </div>
            )
          ) : (
            recentAbsences.map((a: any, i: number, arr: any[]) => {
              const isAbsent = a.status === "absent";
              const parts = a.date?.split("-");
              const dateObj = parts?.length === 3
                ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
                : new Date(a.date);
              const dateStr = dateObj.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
              return (
                <div key={i} className="flex items-center gap-[13px] py-3"
                  style={{ borderBottom: i < arr.length - 1 ? `0.5px solid ${SEP}` : "none" }}>
                  <div className="w-10 h-10 rounded-[13px] flex items-center justify-center shrink-0"
                    style={{
                      background: isAbsent ? "rgba(255,51,85,0.10)" : "rgba(255,136,0,0.10)",
                      border: `0.5px solid ${isAbsent ? "rgba(255,51,85,0.22)" : "rgba(255,136,0,0.22)"}`
                    }}>
                    {isAbsent
                      ? <XCircle className="w-[18px] h-[18px]" style={{ color: RED }} strokeWidth={2.2} />
                      : <Clock className="w-[18px] h-[18px]" style={{ color: ORANGE }} strokeWidth={2.2} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-bold" style={{ color: T1, letterSpacing: "-0.2px" }}>{dateStr}</div>
                    <div className="text-[11px] mt-0.5 truncate font-normal" style={{ color: T3 }}>
                      {a.note || (isAbsent ? "Reason: Not specified" : "Arrived late")}
                    </div>
                  </div>
                  <div className="px-[11px] py-1 rounded-full text-[10px] font-bold shrink-0"
                    style={{
                      background: isAbsent ? "rgba(255,51,85,0.10)" : "rgba(255,136,0,0.10)",
                      color: isAbsent ? RED : ORANGE,
                      border: `0.5px solid ${isAbsent ? "rgba(255,51,85,0.22)" : "rgba(255,136,0,0.22)"}`
                    }}>
                    {isAbsent ? "Absent" : "Late"}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Policy Card (blue gradient) ── */}
        <div className="mx-5 mt-3 rounded-[22px] px-5 py-[18px] relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${B1} 0%, ${B2} 100%)`,
            boxShadow: SH_BTN,
            border: "0.5px solid rgba(255,255,255,0.16)"
          }}>
          <div className="absolute -top-[30px] -right-5 w-[150px] h-[150px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 65%)" }} />
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)",
            backgroundSize: "24px 24px"
          }} />
          <div className="text-[9px] font-bold uppercase tracking-[0.12em] mb-2 relative z-10" style={{ color: "rgba(255,255,255,0.52)" }}>
            Attendance Policy
          </div>
          <p className="text-[13px] leading-[1.6] font-normal mb-[14px] relative z-10" style={{ color: "rgba(255,255,255,0.82)" }}>
            Minimum {attendanceThreshold}% attendance required for exam eligibility. Students below the threshold will be notified.
          </p>
          <div className="flex items-center gap-2 pt-3 relative z-10" style={{ borderTop: "0.5px solid rgba(255,255,255,0.16)" }}>
            <div className="w-[22px] h-[22px] rounded-[7px] flex items-center justify-center shrink-0"
              style={{
                background: aboveThreshold ? GREEN_S : "rgba(255,51,85,0.15)",
                border: `0.5px solid ${aboveThreshold ? GREEN_B : "rgba(255,51,85,0.30)"}`
              }}>
              {aboveThreshold
                ? <CheckCircle className="w-3 h-3" style={{ color: GREEN }} strokeWidth={2.5} />
                : <XCircle className="w-3 h-3" style={{ color: "#fff" }} strokeWidth={2.5} />}
            </div>
            <span className="text-[13px] font-bold text-white" style={{ letterSpacing: "-0.1px" }}>
              {studentFirstName} is {aboveThreshold ? "above the threshold" : "below the requirement"}
            </span>
          </div>
        </div>

        {/* ── Exam Eligibility Threshold Bar ── */}
        <div className="mx-5 mt-3 bg-white rounded-[22px] px-5 py-[18px]" style={{ boxShadow: SH, border: "0.5px solid rgba(0,85,255,0.10)" }}>
          <div className="flex items-end justify-between mb-[10px]">
            <div>
              <div className="text-[13px] font-bold" style={{ color: T1, letterSpacing: "-0.2px", marginBottom: 2 }}>Exam Eligibility</div>
              <div className="text-[11px] font-normal" style={{ color: T3 }}>{attendanceThreshold}% threshold required</div>
            </div>
            <div className="text-[18px] font-bold" style={{ color: aboveThreshold ? GREEN : RED, letterSpacing: "-0.4px" }}>
              {stats.percentage}%
            </div>
          </div>
          <div className="h-2 rounded-[4px] overflow-hidden relative mb-[6px]" style={{ background: BG2 }}>
            <div className="h-full rounded-[4px]"
              style={{
                width: `${Math.min(stats.percentage, 100)}%`,
                background: aboveThreshold
                  ? `linear-gradient(90deg, ${GREEN}, #66EE88)`
                  : `linear-gradient(90deg, ${RED}, #FF8899)`
              }} />
            <div className="absolute -top-[2px] w-[2px] h-3 rounded-[1px]"
              style={{ left: `${Math.min(attendanceThreshold, 100)}%`, background: "rgba(0,85,255,0.4)" }} />
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] font-bold" style={{ color: aboveThreshold ? GREEN : RED }}>{stats.percentage}% current</span>
            <span className="text-[10px] font-bold" style={{ color: "rgba(0,85,255,0.5)" }}>{attendanceThreshold}% required</span>
          </div>
        </div>

        <div className="h-6" />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     DESKTOP — Existing UI (unchanged)
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader
        title="Attendance Tracking"
        badge={`${stats.percentage}% Avg`}
        subtitle="Monitor daily presence and monthly patterns"
      />

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5">
        {/* Overall */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 md:p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold text-slate-800">{stats.percentage}%</p>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Overall</p>
            </div>
          </div>
          <div className={`h-1 w-full rounded-full overflow-hidden bg-slate-100`}>
            <div className={`h-full ${stats.percentage >= attendanceThreshold ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${stats.percentage}%` }} />
          </div>
        </div>

        {/* Present */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 md:p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold text-slate-800">{monthStats.present}</p>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Present</p>
            </div>
          </div>
        </div>

        {/* Absent */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 md:p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl ${monthStats.absent > 0 ? "bg-rose-50" : "bg-slate-50"} flex items-center justify-center`}>
              <XCircle className={`w-4 h-4 md:w-5 md:h-5 ${monthStats.absent > 0 ? "text-rose-500" : "text-slate-300"}`} />
            </div>
            <div>
              <p className={`text-xl md:text-2xl font-bold ${monthStats.absent > 0 ? "text-rose-500" : "text-slate-800"}`}>{monthStats.absent}</p>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Absent</p>
            </div>
          </div>
        </div>

        {/* Late */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 md:p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl ${monthStats.late > 0 ? "bg-amber-50" : "bg-slate-50"} flex items-center justify-center`}>
              <Clock className={`w-4 h-4 md:w-5 md:h-5 ${monthStats.late > 0 ? "text-amber-500" : "text-slate-300"}`} />
            </div>
            <div>
              <p className={`text-xl md:text-2xl font-bold ${monthStats.late > 0 ? "text-amber-600" : "text-slate-800"}`}>{monthStats.late}</p>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Late</p>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar + Right Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Calendar */}
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          {/* Calendar Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <button onClick={handlePrevMonth} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all shadow-sm">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="px-4 py-1.5 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-800 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" />
                <span className="min-w-[124px] text-center">{monthName}</span>
              </div>
              <button onClick={handleNextMonth} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all shadow-sm">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Present</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /><span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Absent</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Late</span></div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-300 gap-3">
              <Loader2 className="w-10 h-10 animate-spin opacity-50" />
              <p className="text-sm font-medium">Syncing logs...</p>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1 md:gap-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                <div key={d} className="text-center text-xs text-slate-400 font-medium py-1">{d}</div>
              ))}
              {Array.from({ length: firstDayOfMonth(selectedDate) }).map((_, i) => (
                <div key={`e-${i}`} />
              ))}
              {Array.from({ length: daysInMonth(selectedDate) }).map((_, i) => {
                const day = i + 1;
                const status = getDayStatus(day);
                const cellStyle = (() => {
                  switch (status) {
                    case "present": return "bg-emerald-500 text-white shadow-md shadow-emerald-500/20";
                    case "absent": return "bg-rose-500 text-white shadow-md shadow-rose-500/20";
                    case "late": return "bg-amber-400 text-white shadow-md shadow-amber-400/20";
                    case "weekend": return "bg-slate-50 text-slate-300 border-dashed border border-slate-200";
                    case "forgotten": return "bg-slate-100 text-slate-400 opacity-60";
                    case "empty": return "bg-white text-slate-700 hover:bg-slate-50 border border-slate-100";
                    default: return "bg-white text-slate-700";
                  }
                })();
                return (
                  <div key={day} className={`aspect-square rounded-lg md:rounded-xl flex items-center justify-center text-xs md:text-sm font-bold transition-all ${cellStyle}`}>
                    {day}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Recent Absences + Policy */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Recent Absences */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex-1">
            <h3 className="text-base font-bold text-slate-800 mb-4">Recent Absences</h3>
            <div className="space-y-3">
              {recentAbsences.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-300 gap-2">
                  <CheckCircle className="w-10 h-10 text-emerald-200" />
                  <p className="text-xs">Perfect attendance!</p>
                </div>
              ) : recentAbsences.map((a, i) => {
                const isAbsent = a.status === "absent";
                const dateStr = (() => {
                  const d = new Date(a.date);
                  // Fix timezone shift: parse as local date
                  const parts = a.date?.split("-");
                  if (parts?.length === 3) {
                    const local = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    return local.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
                  }
                  return d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
                })();
                return (
                  <div key={i} className={`flex items-center gap-3 p-3.5 rounded-xl border ${isAbsent ? "bg-rose-50 border-rose-100" : "bg-amber-50 border-amber-100"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isAbsent ? "bg-rose-100 text-rose-500" : "bg-amber-100 text-amber-500"}`}>
                      {isAbsent ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{dateStr}</p>
                      <p className="text-xs text-slate-400 truncate">{a.note || (isAbsent ? "Reason: Not specified" : `Arrived late`)}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg flex-shrink-0 ${isAbsent ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"}`}>
                      {isAbsent ? "Absent" : "Late"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Attendance Policy */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 shadow-sm">
            <h4 className="text-sm font-bold text-slate-700 mb-2">Attendance Policy</h4>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Minimum {attendanceThreshold}% attendance required for exam eligibility.
            </p>
            <div className={`flex items-center gap-2 text-sm font-semibold ${stats.percentage >= attendanceThreshold ? "text-emerald-600" : "text-rose-600"}`}>
              <CheckCircle className="w-4 h-4" />
              <span>{studentData?.name?.split(" ")[0] || "Student"} is {stats.percentage >= attendanceThreshold ? "above the threshold" : "below the requirement"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;
