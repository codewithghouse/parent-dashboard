/**
 * ResultsPage.tsx (parent-dashboard / K-12) — principal-uploaded result PDFs.
 *
 * Lists rows from `principal_results` where this parent's child appears in
 * `studentResults[]`. Each card renders ONLY the child's per-student PDF
 * (privacy: parent never sees other kids' PDFs). The optional class-wide
 * summary PDF is rendered separately, marked "Class summary".
 *
 * Backend shape locked in [[project-results-module]] memory.
 */
import { useEffect, useMemo, useState } from "react";
import {
  FileText, Download, Calendar as CalendarIcon, Loader2, GraduationCap,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, orderBy, type DocumentData } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { format } from "date-fns";

interface StudentResult {
  studentId: string;
  studentName: string;
  rollNumber?: string;
  pdfUrl: string;
  pdfName: string;
  pdfSize: number;
}

interface ResultDoc extends DocumentData {
  id: string;
  schoolId: string;
  classId: string;
  className: string;
  section?: string;
  examName: string;
  examType: string;
  academicYear: string;
  term: string;
  examDate?: string;
  classPdfUrl?: string;
  classPdfName?: string;
  classPdfSize?: number;
  studentResults: StudentResult[];
  notes?: string;
  publishedAt?: any;
  status: "draft" | "published";
  visibleToParents: boolean;
}

export default function ResultsPage() {
  const { studentData } = useAuth();
  const schoolId  = studentData?.schoolId;
  const studentId = studentData?.id;
  const classId   = studentData?.classId;

  const [results, setResults] = useState<ResultDoc[]>([]);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    if (!schoolId || !studentId) { setLoaded(true); return; }
    /* Scope to same-school + published; ordered latest-first so parent sees
       the most recent exam at the top without scrolling. classId pre-filter
       is INTENTIONALLY skipped — a student who moves class mid-year still
       needs to see past results from their old class. Per-doc child-match
       filter is applied client-side below. */
    const q = query(
      collection(db, "principal_results"),
      where("schoolId", "==", schoolId),
      orderBy("publishedAt", "desc"),
    );
    const unsub = onSnapshot(q, snap => {
      /* Show doc if EITHER:
         (a) parent's child is explicitly in studentResults[] (per-student PDF case)
         (b) doc's classId matches parent's child's current class (class-PDF-only
             case — without this branch, parent saw "No results published yet"
             whenever the principal published a class-summary-only result with no
             per-student PDFs, which is the common quick-publish flow). */
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as ResultDoc))
        .filter(r =>
          r.status === "published"
          && r.visibleToParents
          && (
            r.classId === classId
            || (Array.isArray(r.studentResults) && r.studentResults.some(sr => sr.studentId === studentId))
          )
        );
      setResults(docs);
      setLoaded(true);
    }, err => {
      console.warn("[parent results] subscription error:", err);
      setLoaded(true);
    });
    return () => unsub();
  }, [schoolId, studentId, classId]);

  // Lookup helper: find this child's per-student PDF row in the doc.
  const childRowOf = (r: ResultDoc): StudentResult | undefined =>
    r.studentResults.find(sr => sr.studentId === studentId);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1000px] mx-auto space-y-5">
      {/* Header */}
      <header className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-[#1e3a8a] text-white flex items-center justify-center shadow-lg shadow-blue-900/20">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#1e294b] tracking-tight">My Results</h1>
          <p className="text-xs text-slate-500 font-medium">
            Exam result PDFs published by the principal for {studentData?.name || studentData?.firstName || "your child"}.
          </p>
        </div>
      </header>

      {!loaded ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#1e3a8a]" /></div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500 mb-1">No results published yet</p>
          <p className="text-xs text-slate-400">When the principal uploads exam results, your child's report card will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map(r => {
            const child = childRowOf(r);
            return (
              <article key={r.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-lg font-bold text-[#1e294b] mb-1">{r.examName}</h2>
                    <p className="text-xs text-slate-500 font-medium">
                      {r.className}{r.section ? ` · ${r.section}` : ""} · {r.academicYear}
                      {r.examDate && ` · Exam ${format(new Date(r.examDate), "MMM d, yyyy")}`}
                    </p>
                  </div>
                  {r.publishedAt?.toDate && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                      <CalendarIcon className="w-3 h-3" /> {format(r.publishedAt.toDate(), "MMM d, yyyy")}
                    </span>
                  )}
                </div>

                {r.notes && (
                  <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 mb-3">📌 {r.notes}</p>
                )}

                {/* Primary CTA — child's own report card */}
                {child ? (
                  <a
                    href={child.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 hover:from-blue-100 hover:to-indigo-100 transition-colors group mb-2"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#1e3a8a] text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-900/15">
                      <Download className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#1e3a8a]">Download my report card</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {child.pdfName} · {(child.pdfSize / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </a>
                ) : (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-2">
                    ⚠ Your child's individual PDF wasn't included in this batch. Contact the principal.
                  </p>
                )}

                {/* Optional class summary PDF */}
                {r.classPdfUrl && (
                  <a
                    href={r.classPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-[11px] font-bold text-slate-600 transition-colors"
                  >
                    <GraduationCap className="w-3 h-3" /> Class summary PDF
                    <Download className="w-3 h-3" />
                  </a>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
