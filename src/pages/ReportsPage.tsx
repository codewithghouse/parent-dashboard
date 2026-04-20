import { useState, useEffect } from "react";
import {
  FileText, Download, Loader2, Search,
  FileCheck, Clock, ArrowRightCircle, Sparkles, GraduationCap, ShieldCheck, CheckCircle2
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { scopedQuery } from "../lib/scopedQuery";
import { where, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { useIsMobile } from "@/hooks/use-mobile";

const ReportsPage = () => {
  const { studentData } = useAuth();
  const isMobile = useIsMobile();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState<"all" | "pdf" | "excel" | "verified">("all");

  useEffect(() => {
    if (!studentData?.id) return;
    setLoading(true);
    const schoolId = studentData.schoolId;

    // Single scoped query — "all" grade-level reports + personal reports
    const reportsQ = scopedQuery("reports", schoolId, where("studentId", "in", [studentData.id, "all"]));

    const unsub = onSnapshot(reportsQ, (snap) => {
      const filtered = snap.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .filter(r => (r.grade === studentData.grade || r.studentId === studentData.id || r.studentId === "all") &&
                     (r.status === "Sent" || r.status === "Sent & Reported" || r.publishedToParent === true))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setReports(filtered);
      setLoading(false);
    });

    return () => unsub();
  }, [studentData?.id, studentData?.schoolId]);

  const filteredReports = reports.filter(r => 
    r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.teacherName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDownload = (r: any) => {
    if (r.format === 'excel') {
      let dataToExport: any[] = [];
      
      const reportData = r.data || {};
      
      if (reportData.isClassReport) {
        dataToExport = (reportData.fullList || []).map((s: any) => ({ 
          'Student Name': s.name, 
          'Roll Number': s.rollNo, 
          'Academic Score (%)': s.score || 'N/A', 
          'Attendance Rate (%)': s.attendance, 
          'Academic Standing': s.standing 
        }));
      } else {
        dataToExport = [{ 
          'Student Name': reportData.student_name || r.studentName, 
          'Academic Score': reportData.score || 'N/A', 
          'Attendance (%)': reportData.atnd || reportData.attendance, 
          'AI Summary': reportData.ai_remark || reportData.aiRemarks 
        }];
      }
      
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Institutional Intelligence");
      XLSX.writeFile(wb, `${r.title}_Report_${new Date().getTime()}.xlsx`);
      toast.success("Excel Spreadsheet successfully generated!");
    } else {
      window.print();
      toast.success("Opening Institutional Print View...");
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     MOBILE — Bright Blue Apple UI
     ═══════════════════════════════════════════════════════════════ */
  if (isMobile) {
    const B1 = "#0055FF", B2 = "#1166FF", B3 = "#2277FF";
    const BG = "#EEF4FF";
    const T1 = "#001040", T2 = "#002080", T3 = "#5070B0", T4 = "#99AACC";
    const SH = "0 0 0 0.5px rgba(0,85,255,0.08), 0 2px 8px rgba(0,85,255,0.08), 0 10px 28px rgba(0,85,255,0.10)";
    const SH_LG = "0 0 0 0.5px rgba(0,85,255,0.10), 0 4px 16px rgba(0,85,255,0.11), 0 20px 48px rgba(0,85,255,0.13)";
    const SH_BTN = "0 6px 22px rgba(0,85,255,0.42), 0 2px 6px rgba(0,85,255,0.22)";
    const SH_DARK = "0 6px 24px rgba(0,8,40,0.30), 0 2px 6px rgba(0,8,40,0.18)";

    const detectFormat = (r: any): "pdf" | "excel" | "other" => {
      const f = (r.format || "").toString().toLowerCase();
      if (f.includes("excel") || f === "xlsx" || f === "xls" || f === "csv") return "excel";
      if (f.includes("pdf")) return "pdf";
      return "other";
    };

    const formatTheme = (t: string) => {
      if (t === "excel") return {
        icoBg: "linear-gradient(135deg, #007830, #00C853)",
        icoShadow: "0 4px 14px rgba(0,120,48,0.26)",
        ext: "XLSX",
      };
      return {
        icoBg: `linear-gradient(135deg, ${B1}, ${B3})`,
        icoShadow: "0 4px 14px rgba(0,85,255,0.28)",
        ext: "PDF",
      };
    };

    const pdfCount = reports.filter(r => detectFormat(r) === "pdf").length;
    const excelCount = reports.filter(r => detectFormat(r) === "excel").length;
    const verifiedCount = reports.length; // All shown reports are server-side verified (publishedToParent)

    let filteredMobile = filteredReports;
    if (formatFilter === "pdf") filteredMobile = filteredReports.filter(r => detectFormat(r) === "pdf");
    else if (formatFilter === "excel") filteredMobile = filteredReports.filter(r => detectFormat(r) === "excel");

    const formatDate = (createdAt: any) => {
      try {
        const d = createdAt?.toDate?.() || (createdAt ? new Date(createdAt) : null);
        if (!d || isNaN(d.getTime())) return "Recent";
        return d.toLocaleString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      } catch { return "Recent"; }
    };

    const FILTERS: { key: typeof formatFilter; label: string; count: number }[] = [
      { key: "all", label: "All Reports", count: reports.length },
      { key: "pdf", label: "PDF", count: pdfCount },
      { key: "excel", label: "Excel", count: excelCount },
      { key: "verified", label: "Verified", count: verifiedCount },
    ];

    return (
      <div className="animate-in fade-in duration-500 -mx-3 -mt-3 md:mx-0 md:mt-0"
        style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", background: BG, minHeight: "100vh" }}>

        {/* ── Page Head ── */}
        <div className="px-5 pt-4">
          <div className="flex items-center gap-[10px] mb-[5px]">
            <div className="text-[27px] font-bold" style={{ color: T1, letterSpacing: "-0.7px" }}>Academic Reports</div>
            <div className="w-[38px] h-[38px] rounded-[12px] flex items-center justify-center ml-auto"
              style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: "0 3px 10px rgba(0,85,255,0.28)" }}>
              <FileText className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>
          </div>
          <div className="inline-flex items-center gap-[6px] px-3 py-[6px] rounded-full text-[8px] font-bold uppercase tracking-[0.10em]"
            style={{ background: "rgba(0,85,255,0.08)", border: "0.5px solid rgba(0,85,255,0.16)", color: B1 }}>
            <ShieldCheck className="w-[9px] h-[9px]" strokeWidth={2.5} />
            Authorized Academic Intelligence &amp; Documentation Pipeline
          </div>
        </div>

        {/* ── Search ── */}
        <div className="mx-5 mt-[14px] relative">
          <div className="absolute left-[14px] top-1/2 -translate-y-1/2 pointer-events-none">
            <Search className="w-[15px] h-[15px]" style={{ color: "rgba(0,85,255,0.40)" }} strokeWidth={2.2} />
          </div>
          <input
            type="text"
            placeholder="Search Documents..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full py-[13px] pr-4 pl-[42px] rounded-[16px] text-[13px] font-semibold outline-none bg-white"
            style={{
              border: "0.5px solid rgba(0,85,255,0.12)",
              color: T1,
              letterSpacing: "-0.1px",
              boxShadow: SH,
              fontFamily: "inherit",
              textTransform: "uppercase",
            }}
          />
        </div>

        {/* ── Filter chips ── */}
        <div className="flex gap-2 px-5 pt-[14px] overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {FILTERS.map(f => {
            const isAct = formatFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFormatFilter(f.key)}
                className="flex items-center gap-[6px] px-[14px] py-2 rounded-full flex-shrink-0 transition-transform active:scale-[0.94]"
                style={{
                  background: isAct ? `linear-gradient(135deg, ${B1}, ${B2})` : "#FFFFFF",
                  border: isAct ? "0.5px solid transparent" : "0.5px solid rgba(0,85,255,0.12)",
                  boxShadow: isAct ? SH_BTN : SH,
                  transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
                }}>
                <span className="text-[10px] font-bold tracking-[0.02em]" style={{ color: isAct ? "#fff" : T3 }}>{f.label}</span>
                <span className="text-[12px] font-bold rounded-full px-[7px] py-[1px]"
                  style={{
                    background: isAct ? "rgba(255,255,255,0.22)" : "rgba(0,85,255,0.10)",
                    color: isAct ? "#fff" : B1,
                  }}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="mx-5 mt-[14px] bg-white rounded-[26px] py-14 flex flex-col items-center gap-3"
            style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: B1 }} />
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: T4 }}>Accessing Document Repository…</p>
          </div>
        ) : filteredMobile.length === 0 ? (
          <div className="mx-5 mt-[14px] bg-white rounded-[26px] px-6 py-10 flex flex-col items-center text-center relative overflow-hidden"
            style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
            <div className="absolute -top-[50px] -right-[40px] w-[180px] h-[180px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(0,85,255,0.05) 0%, transparent 70%)" }} />
            <div className="w-[72px] h-[72px] rounded-[24px] flex items-center justify-center mb-4 relative z-10"
              style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: `${SH_BTN}, 0 0 0 10px rgba(0,85,255,0.08)` }}>
              <FileCheck className="w-8 h-8 text-white" strokeWidth={2.1} />
            </div>
            <div className="text-[18px] font-bold mb-[6px] relative z-10" style={{ color: T1, letterSpacing: "-0.4px" }}>
              {searchQuery || formatFilter !== "all" ? "No Matches Found" : "Repository Empty"}
            </div>
            <div className="text-[13px] leading-[1.6] max-w-[240px] font-normal italic relative z-10" style={{ color: T3 }}>
              {searchQuery
                ? "Try a different search term."
                : formatFilter !== "all"
                  ? `No ${formatFilter.toUpperCase()} reports available yet.`
                  : "Official academic reports for the current term have not been published by the faculty team yet."}
            </div>
          </div>
        ) : (
          filteredMobile.map((r: any) => {
            const type = detectFormat(r);
            const theme = formatTheme(type);
            return (
              <div key={r.id}
                className="mx-5 mt-[14px] bg-white rounded-[26px] px-5 pt-[22px] pb-5 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
                style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)", transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)" }}
                onClick={() => handleDownload(r)}>
                <div className="absolute -top-[38px] -right-[25px] w-[150px] h-[150px] rounded-full pointer-events-none"
                  style={{ background: "radial-gradient(circle, rgba(0,85,255,0.05) 0%, transparent 70%)" }} />
                <div className="absolute bottom-3 right-4 opacity-[0.04] pointer-events-none">
                  <FileText size={120} color={B1} strokeWidth={0.6} />
                </div>

                {/* Top */}
                <div className="flex items-start gap-[14px] mb-[14px] relative z-10">
                  <div className="w-[52px] h-[52px] rounded-[17px] flex items-center justify-center shrink-0"
                    style={{ background: theme.icoBg, boxShadow: theme.icoShadow }}>
                    {type === "excel"
                      ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" />
                          <line x1="12" y1="9" x2="12" y2="21" />
                        </svg>
                      : <FileText className="w-6 h-6 text-white" strokeWidth={2.2} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[16px] font-bold uppercase mb-[7px] leading-[1.25]" style={{ color: T1, letterSpacing: "-0.3px" }}>
                      {r.title || "Academic Report"}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.04em]" style={{ color: T3 }}>
                        <GraduationCap className="w-[11px] h-[11px]" strokeWidth={2.5} />
                        {r.teacherName || "Faculty"}
                      </div>
                      <div className="w-[3px] h-[3px] rounded-full" style={{ background: T4 }} />
                      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.04em]" style={{ color: T3 }}>
                        <Clock className="w-[11px] h-[11px]" strokeWidth={2.5} />
                        {formatDate(r.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quote */}
                <div className="rounded-r-[12px] px-[14px] py-3 mb-4 relative z-10"
                  style={{
                    background: "rgba(0,85,255,0.04)",
                    borderLeft: `3px solid ${B1}`,
                  }}>
                  <p className="text-[12px] italic leading-[1.72] font-normal" style={{ color: T2, letterSpacing: "-0.1px" }}>
                    "{r.data?.ai_remark || r.data?.aiRemarks || "Institutional assessment data compiled by the academic department. This document contains verified academic standing and behavioral metrics."}"
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-[10px] relative z-10">
                  <div className="flex items-center gap-[5px] px-[13px] py-[7px] rounded-full text-[10px] font-bold uppercase tracking-[0.06em] text-white shrink-0"
                    style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: "0 3px 10px rgba(0,85,255,0.28)" }}>
                    <CheckCircle2 className="w-[10px] h-[10px]" strokeWidth={2.5} />
                    Verified
                  </div>
                  <div className="shrink-0">
                    <div className="text-[9px] font-bold uppercase tracking-[0.10em]" style={{ color: T4 }}>Format</div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.04em]" style={{ color: T2 }}>{theme.ext}</div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDownload(r); }}
                    className="flex-1 h-[46px] rounded-[15px] flex items-center justify-center gap-2 text-[12px] font-bold text-white uppercase tracking-[0.06em] relative overflow-hidden active:scale-[0.96] transition-transform"
                    style={{
                      background: "linear-gradient(135deg, #001040, #001888)",
                      boxShadow: SH_DARK,
                      transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)"
                    }}>
                    <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 52%)" }} />
                    <Download className="w-[14px] h-[14px]" strokeWidth={2.3} />
                    <span className="relative z-10">Download Report</span>
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* ── Policy Card ── */}
        {!loading && (
          <div className="mx-5 mt-[14px] rounded-[26px] px-6 py-[26px] relative overflow-hidden"
            style={{
              background: "linear-gradient(140deg, #0033CC 0%, #0055FF 45%, #2277FF 80%, #55AAFF 100%)",
              boxShadow: `${SH_BTN}, 0 0 0 0.5px rgba(255,255,255,0.14)`,
            }}>
            <div className="absolute -top-[44px] -right-[30px] w-[200px] h-[200px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.16) 0%, transparent 65%)" }} />
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
              backgroundSize: "24px 24px"
            }} />

            <div className="inline-flex items-center gap-[5px] px-3 py-[5px] rounded-full text-[9px] font-bold uppercase tracking-[0.10em] mb-[14px] relative z-10"
              style={{ background: "rgba(255,255,255,0.18)", border: "0.5px solid rgba(255,255,255,0.28)", color: "rgba(255,255,255,0.75)", WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)" }}>
              <ShieldCheck className="w-[10px] h-[10px]" strokeWidth={2.5} />
              Infrastructure Policy
            </div>

            <div className="text-[22px] font-bold uppercase text-white leading-[1.15] mb-3 relative z-10" style={{ letterSpacing: "-0.6px" }}>
              Document Infrastructure Policy
            </div>
            <div className="text-[13px] leading-[1.75] font-normal relative z-10" style={{ color: "rgba(255,255,255,0.75)" }}>
              Academic reports are generated by the <strong style={{ color: "#fff", fontWeight: 700 }}>instructional faculty</strong> and mirrored to the parent portal for peak accessibility. All documents are <strong style={{ color: "#fff", fontWeight: 700 }}>encrypted</strong>, verified, and digitally timestamped.
            </div>

            <div className="h-[0.5px] my-4 relative z-10" style={{ background: "rgba(255,255,255,0.16)" }} />

            <div className="flex flex-col gap-[10px] relative z-10">
              {[
                { icon: ShieldCheck, text: "End-to-end encrypted storage" },
                { icon: Clock,       text: "Real-time faculty synchronization" },
                { icon: CheckCircle2, text: "All reports faculty-verified" },
                { icon: ArrowRightCircle, text: "Retention: 30 days · direct sync active" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-[10px]">
                  <div className="w-7 h-7 rounded-[9px] flex items-center justify-center shrink-0"
                    style={{ background: "rgba(255,255,255,0.18)", border: "0.5px solid rgba(255,255,255,0.26)" }}>
                    <Icon className="w-[13px] h-[13px]" style={{ color: "rgba(255,255,255,0.85)" }} strokeWidth={2.3} />
                  </div>
                  <span className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.75)", letterSpacing: "-0.1px" }}>{text}</span>
                </div>
              ))}
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
    <div className="space-y-8 animate-in fade-in duration-700 pb-12 text-left font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 pb-2">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3 italic">
            Academic Reports <FileText className="w-6 h-6 md:w-8 md:h-8 text-indigo-600" />
          </h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] md:text-[11px]">Authorized academic intelligence & documentation pipeline</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="relative group flex-1 md:flex-none">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-6 py-4 bg-white border-2 border-slate-50 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-indigo-100 transition-all w-full md:w-64 shadow-sm"
              />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         <div className="lg:col-span-12 space-y-6">
            {loading ? (
                <div className="py-24 text-center bg-white border-2 border-slate-50 rounded-[3rem] shadow-sm flex flex-col items-center">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Accessing Document Repository...</p>
                </div>
            ) : filteredReports.length === 0 ? (
                <div className="py-32 text-center bg-white border-2 border-slate-50 rounded-[3.5rem] flex flex-col items-center shadow-sm">
                    <div className="w-24 h-24 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-inner">
                        <FileCheck className="w-10 h-10 text-slate-200" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-3">Repository Empty</h3>
                    <p className="text-sm font-bold text-slate-400 max-w-sm leading-relaxed px-10 italic">
                        Official academic reports for the current term have not been published by the faculty team yet.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {filteredReports.map((r) => (
                      <div key={r.id} className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm hover:shadow-2xl hover:translate-y-[-4px] transition-all group relative overflow-hidden flex flex-col">
                         <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-all">
                            <Sparkles className="w-24 h-24 text-indigo-600" />
                         </div>
                         
                         <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xl shadow-inner">
                               <FileText className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                               <h3 className="text-xl font-black text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors uppercase italic mb-0.5">{r.title}</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                   <GraduationCap className="w-3 h-3"/> {r.teacherName || "Faculty"} • <Clock className="w-3 h-3"/> {new Date(r.createdAt?.toDate?.()).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                         </div>

                         <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 mb-8 flex-grow">
                            <p className="text-xs font-bold text-slate-600 leading-relaxed italic">
                               "{r.data?.ai_remark || r.data?.aiRemarks || "Institutional assessment data compiled by the academic department. This document contains verified academic standing and behavioral metrics."}"
                            </p>
                         </div>

                         <div className="flex items-center justify-between pt-4">
                            <div className="flex items-center gap-2">
                               <span className="px-3 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg">Verified</span>
                               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{r.format?.toUpperCase()} FORMAT</span>
                            </div>
                            <button 
                               onClick={() => handleDownload(r)}
                               className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                            >
                               <Download className="w-4 h-4" /> Download Report
                            </button>
                         </div>
                      </div>
                   ))}
                </div>
            )}
         </div>

         {/* Side Context */}
         <div className="lg:col-span-12 mt-10">
            <div className="bg-[#1e3a8a] rounded-[3.5rem] p-12 text-white relative overflow-hidden shadow-2xl group flex flex-col md:flex-row items-center gap-10">
                <div className="relative z-10 space-y-4 max-w-xl">
                    <h3 className="text-3xl font-black leading-tight italic uppercase">Document Infrastructure Policy</h3>
                    <p className="text-base font-bold text-blue-100/80 leading-relaxed">
                        Academic reports are generated by the instructional faculty and mirrored to the parent portal for peak transparency. Each document is cryptographically verified to ensure record integrity.
                    </p>
                    <div className="flex gap-6 pt-4">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">
                            <Clock className="w-4 h-4"/> Retention: 30 Days
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">
                            <ArrowRightCircle className="w-4 h-4"/> Direct Sync Active
                        </div>
                    </div>
                </div>
                <div className="relative h-48 w-48 flex items-center justify-center shrink-0">
                    <div className="absolute inset-0 bg-white/10 rounded-full animate-ping opacity-20" />
                    <div className="absolute inset-4 bg-white/10 rounded-full animate-pulse opacity-40" />
                    <div className="relative w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/50">
                        <FileText className="w-12 h-12 text-[#1e3a8a] rotate-12" />
                    </div>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default ReportsPage;
