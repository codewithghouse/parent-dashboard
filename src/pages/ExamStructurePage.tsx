/**
 * ExamStructurePage.tsx — Read-only viewer of the school's exam types.
 *
 * Source: `exam_structure` collection (written by principal-dashboard's
 * ExamStructure page). Cross-dashboard linkage so parents can see the
 * format of each exam category (max marks, passing threshold, weight,
 * grading scale) without asking the school.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Loader2, Award, FileWarning } from "lucide-react";

interface GradeRule { grade: string; min: number; max: number; }
interface ExamType {
  id: string;
  name: string;
  maxMarks: number;
  passingMarks: number;
  weightPct: number;
  applicableClasses: string;
  gradingScale: GradeRule[];
  schoolId?: string;
  branchId?: string | null;
}

const T = {
  FONT: "'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif",
  BG: "#EEF4FF",
  CARD: "#FFFFFF",
  T1: "#001040", T2: "#002080", T3: "#5070B0", T4: "#99AACC",
  P: "#0055FF",
  GREEN: "#00C853",
  ORANGE: "#FF8800",
  SH: "0 0 0 0.5px rgba(0,85,255,0.10), 0 4px 16px rgba(0,85,255,0.12), 0 18px 44px rgba(0,85,255,0.15)",
  BDR: "0.5px solid rgba(0,85,255,0.10)",
};

export default function ExamStructurePage() {
  const { studentData } = useAuth();
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!studentData?.schoolId) {
      setLoading(false);
      return;
    }
    const schoolId = studentData.schoolId as string;
    const branchId = (studentData as any).branchId as string | undefined;
    const inBranch = (raw: any): boolean =>
      !branchId || !raw?.branchId || raw.branchId === branchId;

    const unsub = onSnapshot(
      query(collection(db, "exam_structure"), where("schoolId", "==", schoolId)),
      (snap) => {
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter(inBranch) as ExamType[];
        docs.sort((a, b) => (b.weightPct || 0) - (a.weightPct || 0) || a.name.localeCompare(b.name));
        setExamTypes(docs);
        setLoading(false);
        setErrMsg(null);
      },
      (err) => {
        console.warn("[ExamStructurePage] listener failed:", err);
        setErrMsg(err?.message || "Failed to load exam structure.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, [studentData?.schoolId, (studentData as any)?.branchId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" style={{ background: T.BG }}>
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: T.P }} />
      </div>
    );
  }

  return (
    <div style={{ background: T.BG, minHeight: "100vh", padding: "24px 16px 40px", fontFamily: T.FONT }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.6px", color: T.T4, margin: "0 0 4px", textTransform: "uppercase" }}>
          School Configuration
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.8px", color: T.T1, margin: 0, lineHeight: 1.1 }}>
          Exam Structure
        </h1>
        <p style={{ fontSize: 12, color: T.T3, fontWeight: 500, marginTop: 6, margin: "6px 0 0", lineHeight: 1.5 }}>
          Exam types your child's school uses — max marks, passing threshold, weight in final grade, and grading scale.
        </p>
      </div>

      {errMsg && (
        <div style={{
          background: "rgba(255,51,85,.08)", border: "0.5px solid rgba(255,51,85,.22)",
          borderRadius: 14, padding: "11px 14px", marginBottom: 14,
          color: "#C71F2D", fontSize: 12, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <FileWarning size={14} />
          <span>{errMsg}</span>
        </div>
      )}

      {!errMsg && examTypes.length === 0 && (
        <div style={{
          background: T.CARD, borderRadius: 18, padding: "44px 22px", textAlign: "center",
          boxShadow: T.SH, border: T.BDR,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%", background: "rgba(0,85,255,.08)",
            display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12,
          }}>
            <Award size={22} color={T.P} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 800, color: T.T1, margin: "0 0 6px" }}>
            No exam structure published yet
          </p>
          <p style={{ fontSize: 12, color: T.T3, fontWeight: 500, margin: 0, lineHeight: 1.55, maxWidth: 380, marginInline: "auto" }}>
            Once your child's school defines their exam types, they'll appear here so you know exactly what each test means in marks and grades.
          </p>
        </div>
      )}

      {!errMsg && examTypes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {examTypes.map((ex) => <ExamTypeCard key={ex.id} ex={ex} />)}
        </div>
      )}
    </div>
  );
}

const ExamTypeCard = ({ ex }: { ex: ExamType }) => {
  const passPct = ex.maxMarks > 0 ? Math.round((ex.passingMarks / ex.maxMarks) * 100) : 0;
  const grading = Array.isArray(ex.gradingScale) ? ex.gradingScale : [];
  return (
    <div style={{
      background: T.CARD, borderRadius: 18, padding: "16px 18px",
      boxShadow: T.SH, border: T.BDR,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.T1, letterSpacing: "-0.3px", marginBottom: 3 }}>
            {ex.name}
          </div>
          <div style={{ fontSize: 11, color: T.T4, fontWeight: 600 }}>
            Applies to: {ex.applicableClasses || "All classes"}
          </div>
        </div>
        <div style={{
          padding: "5px 11px", borderRadius: 999,
          background: "rgba(0,85,255,.10)", border: "0.5px solid rgba(0,85,255,.22)",
          fontSize: 10, fontWeight: 800, color: T.P, letterSpacing: "0.5px", textTransform: "uppercase",
          flexShrink: 0,
        }}>
          {ex.weightPct}% weight
        </div>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: grading.length > 0 ? 14 : 0,
      }}>
        <Stat label="Max Marks" value={String(ex.maxMarks ?? 0)} color={T.T1} />
        <Stat label="Passing" value={`${ex.passingMarks ?? 0} (${passPct}%)`} color={T.ORANGE} />
        <Stat label="Weight" value={`${ex.weightPct ?? 0}%`} color={T.GREEN} />
      </div>

      {grading.length > 0 && (
        <div>
          <div style={{
            fontSize: 9, fontWeight: 800, letterSpacing: "1.5px", color: T.T4,
            textTransform: "uppercase", margin: "10px 0 6px",
          }}>
            Grading scale
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(74px, 1fr))", gap: 6,
          }}>
            {grading.map((g, i) => (
              <div key={i} style={{
                background: "rgba(0,85,255,.05)", border: "0.5px solid rgba(0,85,255,.10)",
                borderRadius: 10, padding: "8px 10px", textAlign: "center",
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.P, lineHeight: 1, marginBottom: 4 }}>
                  {g.grade}
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, color: T.T4, letterSpacing: "0.4px" }}>
                  {g.min}–{g.max}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div style={{
    background: "rgba(0,85,255,.04)", borderRadius: 12, padding: "10px 8px",
    textAlign: "center", border: "0.5px solid rgba(0,85,255,.08)",
  }}>
    <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: "1.2px", color: T.T4, margin: "0 0 4px", textTransform: "uppercase" }}>
      {label}
    </div>
    <div style={{ fontSize: 16, fontWeight: 800, color, letterSpacing: "-0.3px" }}>
      {value}
    </div>
  </div>
);
