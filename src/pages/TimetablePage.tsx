/**
 * TimetablePage.tsx (parent) — read-only view of the child's class timetable.
 *
 * Source: `timetable_entries` collection (written by principal-dashboard's
 * TimetableSetup). Auto-filtered by the student's `className`. Falls back
 * to "all classes" filter if the parent wants to browse other classes.
 */

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Calendar, Loader2, Filter } from "lucide-react";

interface TimetableEntry {
  id: string;
  schoolId?: string;
  branchId?: string | null;
  className: string;
  day: string;
  period: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacher: string;
}

const DAYS_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const T = {
  FONT: "'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif",
  BG: "#EEF4FF", CARD: "#FFFFFF",
  T1: "#001040", T2: "#002080", T3: "#5070B0", T4: "#99AACC",
  P: "#0055FF",
  SH: "0 0 0 0.5px rgba(0,85,255,0.10), 0 4px 16px rgba(0,85,255,0.12), 0 18px 44px rgba(0,85,255,0.15)",
  BDR: "0.5px solid rgba(0,85,255,0.10)",
};

export default function TimetablePage() {
  const { studentData } = useAuth();
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"my-class" | "all">("my-class");

  const childClass = String((studentData as any)?.className || "").trim();
  const childName = String((studentData as any)?.name || (studentData as any)?.studentName || "child").trim();

  useEffect(() => {
    if (!studentData?.schoolId) { setLoading(false); return; }
    const schoolId = studentData.schoolId as string;
    const branchId = (studentData as any)?.branchId as string | undefined;
    const inBranch = (raw: any) => !branchId || !raw?.branchId || raw.branchId === branchId;

    const unsub = onSnapshot(
      query(collection(db, "timetable_entries"), where("schoolId", "==", schoolId)),
      (snap) => {
        const rows = snap.docs
          .map(d => ({ id: d.id, ...(d.data() as any) }))
          .filter(inBranch) as TimetableEntry[];
        setEntries(rows);
        setLoading(false);
      },
      (err) => {
        console.warn("[TimetablePage] listener failed:", err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [studentData?.schoolId, (studentData as any)?.branchId]);

  // Lenient class match: case-insensitive, trim, normalize whitespace
  const matchesChildClass = (cls: string): boolean => {
    if (!childClass) return false;
    const a = childClass.toLowerCase().replace(/\s+/g, " ").trim();
    const b = String(cls || "").toLowerCase().replace(/\s+/g, " ").trim();
    return a === b;
  };

  const filteredEntries = useMemo(() => {
    if (filter === "all") return entries;
    return entries.filter(e => matchesChildClass(e.className));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, filter, childClass]);

  const byClass = useMemo(() => {
    const m = new Map<string, TimetableEntry[]>();
    filteredEntries.forEach(e => {
      if (!m.has(e.className)) m.set(e.className, []);
      m.get(e.className)!.push(e);
    });
    m.forEach(arr => arr.sort((a, b) => {
      const da = DAYS_ORDER.indexOf(a.day);
      const db_ = DAYS_ORDER.indexOf(b.day);
      if (da !== db_) return (da === -1 ? 99 : da) - (db_ === -1 ? 99 : db_);
      return a.period - b.period;
    }));
    return m;
  }, [filteredEntries]);

  const childClassHasEntries = entries.some(e => matchesChildClass(e.className));

  return (
    <div style={{ background: T.BG, minHeight: "100vh", padding: "24px 16px 40px", fontFamily: T.FONT }}>
      <div style={{ marginBottom: 18 }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.6px", color: T.T4, margin: "0 0 4px", textTransform: "uppercase" }}>
          School schedule
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.8px", color: T.T1, margin: 0, lineHeight: 1.1, display: "flex", alignItems: "center", gap: 10 }}>
          <Calendar size={26} color={T.P} />
          Timetable
        </h1>
        <p style={{ fontSize: 12, color: T.T3, fontWeight: 500, marginTop: 6, margin: "6px 0 0", lineHeight: 1.5 }}>
          {childClass
            ? <>Weekly periods for {childName}'s class — <strong style={{ color: T.T1 }}>{childClass}</strong>.</>
            : <>Weekly periods published by your child's school.</>}
        </p>
      </div>

      {/* Filter pills */}
      {entries.length > 0 && childClass && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
          <Filter size={14} color={T.T4} />
          {([
            { key: "my-class" as const, label: childClass },
            { key: "all" as const, label: "All classes" },
          ]).map(opt => {
            const active = filter === opt.key;
            return (
              <button key={opt.key} onClick={() => setFilter(opt.key)}
                style={{
                  padding: "6px 12px", borderRadius: 999,
                  background: active ? T.P : T.CARD,
                  color: active ? "#fff" : T.T2,
                  border: active ? "0.5px solid transparent" : T.BDR,
                  fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: T.FONT,
                  letterSpacing: "0.04em",
                }}>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
          <Loader2 size={26} className="animate-spin" style={{ color: T.P }} />
        </div>
      )}

      {!loading && entries.length === 0 && (
        <EmptyState title="No timetable published yet" body="Your child's school hasn't uploaded the term timetable yet. It'll appear here automatically once they do." />
      )}

      {!loading && entries.length > 0 && filter === "my-class" && !childClassHasEntries && (
        <EmptyState
          title={childClass ? `No periods found for "${childClass}"` : "No class linked to your account"}
          body={childClass
            ? `The school's timetable doesn't include this class yet. Try the "All classes" filter to see other classes' schedules.`
            : "Ask the school admin to set your child's class so the timetable filters correctly."}
        />
      )}

      {!loading && byClass.size > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from(byClass.keys()).sort().map(className => (
            <ClassGrid key={className} className={className} rows={byClass.get(className) || []} highlightChild={matchesChildClass(className)} />
          ))}
        </div>
      )}
    </div>
  );
}

const EmptyState = ({ title, body }: { title: string; body: string }) => (
  <div style={{ background: T.CARD, borderRadius: 18, padding: "44px 22px", textAlign: "center", boxShadow: T.SH, border: T.BDR }}>
    <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(0,85,255,.08)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
      <Calendar size={26} color={T.P} />
    </div>
    <p style={{ fontSize: 16, fontWeight: 800, color: T.T1, margin: "0 0 6px" }}>{title}</p>
    <p style={{ fontSize: 12, color: T.T3, fontWeight: 500, margin: 0, lineHeight: 1.55, maxWidth: 400, marginInline: "auto" }}>{body}</p>
  </div>
);

const ClassGrid = ({ className, rows, highlightChild }: {
  className: string; rows: TimetableEntry[]; highlightChild: boolean;
}) => {
  const days = Array.from(new Set(rows.map(r => r.day)))
    .sort((a, b) => DAYS_ORDER.indexOf(a) - DAYS_ORDER.indexOf(b));
  const periods = Array.from(new Set(rows.map(r => r.period))).sort((a, b) => a - b);
  const cell = (d: string, p: number) => rows.find(r => r.day === d && r.period === p);

  return (
    <div style={{
      background: T.CARD,
      borderRadius: 14,
      overflow: "hidden",
      boxShadow: T.SH,
      border: highlightChild ? `1px solid ${T.P}` : T.BDR,
    }}>
      <div style={{
        padding: "12px 14px",
        background: highlightChild ? "rgba(0,85,255,.10)" : "rgba(0,85,255,.04)",
        borderBottom: "0.5px solid rgba(0,85,255,.10)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.T1 }}>{className}</div>
          {highlightChild && (
            <span style={{ padding: "2px 8px", borderRadius: 999, background: T.P, color: "#fff", fontSize: 9, fontWeight: 800, letterSpacing: "0.4px", textTransform: "uppercase" }}>
              Your child's class
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.T3 }}>{rows.length} periods · {days.length} days</div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(0,85,255,.04)" }}>
              <th style={th()}>Period</th>
              {days.map(d => <th key={d} style={th()}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {periods.map(p => (
              <tr key={p} style={{ borderTop: "0.5px solid rgba(0,85,255,.06)" }}>
                <td style={td(true)}>
                  <div style={{ fontWeight: 800, color: T.P }}>P{p}</div>
                  {(() => {
                    const sample = rows.find(r => r.period === p);
                    return sample?.startTime ? (
                      <div style={{ fontSize: 9, color: T.T4, fontWeight: 600 }}>
                        {sample.startTime}{sample.endTime ? `–${sample.endTime}` : ""}
                      </div>
                    ) : null;
                  })()}
                </td>
                {days.map(d => {
                  const c = cell(d, p);
                  if (!c) return <td key={d} style={td()}><span style={{ color: T.T4, fontSize: 11 }}>—</span></td>;
                  return (
                    <td key={d} style={td()}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.T1, marginBottom: 2 }}>{c.subject}</div>
                      {c.teacher && <div style={{ fontSize: 10, color: T.T3, fontWeight: 600 }}>{c.teacher}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const th = (): React.CSSProperties => ({
  fontSize: 9, fontWeight: 800, letterSpacing: "1.2px", color: T.T4, textTransform: "uppercase",
  padding: "8px 10px", textAlign: "left", borderRight: "0.5px solid rgba(0,85,255,.06)",
});
const td = (firstCol = false): React.CSSProperties => ({
  fontSize: 12, color: T.T1, padding: "8px 10px",
  borderRight: "0.5px solid rgba(0,85,255,.06)",
  background: firstCol ? "rgba(0,85,255,.03)" : T.CARD,
  verticalAlign: "top", minWidth: 100,
});
