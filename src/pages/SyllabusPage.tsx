import { useState, useEffect, useMemo } from "react";
import {
  Loader2, FileText, Search, Download, ExternalLink, User, Calendar, Library
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { PageHeader } from "@/components/ui/PageHeader";
import { useIsMobile } from "@/hooks/use-mobile";

const formatBytes = (bytes?: number) => {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
};

const formatRelative = (ts: any) => {
  if (!ts) return "";
  const d = ts?.toDate?.() || (typeof ts === "number" ? new Date(ts) : new Date(ts));
  if (isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk} week${wk === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const SyllabusPage = () => {
  const { studentData } = useAuth();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "pdf" | "doc" | "img" | "xls">("all");

  useEffect(() => {
    if (!studentData?.schoolId || !studentData?.classId) {
      setDocs([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const q = query(
      collection(db, "syllabi"),
      where("schoolId", "==", studentData.schoolId),
      where("classId", "==", studentData.classId)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (cancelled) return;
        const data = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((d) => d.isActive !== false)
          .sort((a, b) => {
            const am = a.uploadedAt?.toMillis?.() ?? 0;
            const bm = b.uploadedAt?.toMillis?.() ?? 0;
            return bm - am;
          });
        setDocs(data);
        setLoading(false);
      },
      (err) => {
        if (cancelled) return;
        console.error("Syllabus listener error:", err);
        setDocs([]);
        setLoading(false);
      }
    );

    return () => { cancelled = true; unsub(); };
  }, [studentData?.schoolId, studentData?.classId]);

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => {
      const title = (d.title || "").toLowerCase();
      const fileName = (d.fileName || "").toLowerCase();
      const uploader = (d.uploadedByName || "").toLowerCase();
      return title.includes(q) || fileName.includes(q) || uploader.includes(q);
    });
  }, [docs, searchQuery]);

  const handleView = (url: string) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  /* ═══════════════════════════════════════════════════════════════
     MOBILE — Bright Blue Apple UI
     ═══════════════════════════════════════════════════════════════ */
  if (isMobile) {
    const B1 = "#0055FF", B2 = "#1166FF";
    const BG = "#EEF4FF";
    const T1 = "#001040", T3 = "#5070B0", T4 = "#99AACC";
    const GREEN = "#00C853";
    const RED = "#FF3355";
    const ORANGE = "#FF8800";
    const SH = "0 0 0 0.5px rgba(0,85,255,0.08), 0 2px 8px rgba(0,85,255,0.08), 0 10px 28px rgba(0,85,255,0.10)";
    const SH_LG = "0 0 0 0.5px rgba(0,85,255,0.10), 0 4px 16px rgba(0,85,255,0.11), 0 18px 44px rgba(0,85,255,0.13)";
    const SH_BTN = "0 6px 20px rgba(0,85,255,0.40), 0 2px 5px rgba(0,85,255,0.22)";

    // ── File type detection (by fileType / fileName extension / mime) ──
    type DocType = "pdf" | "doc" | "img" | "xls" | "other";
    const detectType = (d: any): DocType => {
      const name: string = (d.fileName || d.name || "").toLowerCase();
      const mime: string = (d.fileType || d.mimeType || "").toLowerCase();
      if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf";
      if (mime.includes("image") || /\.(png|jpe?g|gif|webp|bmp|heic|svg)$/.test(name)) return "img";
      if (mime.includes("sheet") || mime.includes("excel") || /\.(xlsx?|csv|numbers)$/.test(name)) return "xls";
      if (mime.includes("word") || mime.includes("document") || /\.(docx?|rtf|txt|odt|pages)$/.test(name)) return "doc";
      return "other";
    };

    const themeMap: Record<DocType, {
      icoBg: string; icoShadow: string;
      tagBg: string; tagColor: string; tagBorder: string;
      tagLabel: string;
      viewLabel: string;
    }> = {
      pdf: {
        icoBg: "linear-gradient(135deg, #FF3355, #FF6688)",
        icoShadow: "0 4px 14px rgba(255,51,85,0.30)",
        tagBg: "rgba(255,51,85,0.08)", tagColor: RED, tagBorder: "rgba(255,51,85,0.18)",
        tagLabel: "PDF", viewLabel: "View PDF",
      },
      doc: {
        icoBg: `linear-gradient(135deg, ${B1}, #2277FF)`,
        icoShadow: "0 4px 14px rgba(0,85,255,0.28)",
        tagBg: "rgba(0,85,255,0.10)", tagColor: B1, tagBorder: "rgba(0,85,255,0.20)",
        tagLabel: "DOC", viewLabel: "Open Document",
      },
      img: {
        icoBg: `linear-gradient(135deg, ${GREEN}, #66EE88)`,
        icoShadow: "0 4px 14px rgba(0,200,83,0.26)",
        tagBg: "rgba(0,200,83,0.10)", tagColor: "#007830", tagBorder: "rgba(0,200,83,0.22)",
        tagLabel: "IMG", viewLabel: "View Image",
      },
      xls: {
        icoBg: `linear-gradient(135deg, ${ORANGE}, #FFCC44)`,
        icoShadow: "0 4px 14px rgba(255,136,0,0.26)",
        tagBg: "rgba(255,136,0,0.08)", tagColor: "#884400", tagBorder: "rgba(255,136,0,0.18)",
        tagLabel: "XLS", viewLabel: "Open Sheet",
      },
      other: {
        icoBg: `linear-gradient(135deg, ${B1}, #2277FF)`,
        icoShadow: "0 4px 14px rgba(0,85,255,0.28)",
        tagBg: "rgba(0,85,255,0.10)", tagColor: B1, tagBorder: "rgba(0,85,255,0.20)",
        tagLabel: "FILE", viewLabel: "Open File",
      },
    };

    const isRecent = (ts: any) => {
      if (!ts) return false;
      const d = ts?.toDate?.() || new Date(ts);
      if (isNaN(d.getTime())) return false;
      return Date.now() - d.getTime() < 1000 * 60 * 60 * 24 * 3; // < 3 days
    };

    // Apply search then type filter
    const docsWithType = docs.map(d => ({ ...d, __type: detectType(d) }));
    const searchFiltered = searchQuery.trim()
      ? docsWithType.filter(d => {
          const q = searchQuery.trim().toLowerCase();
          return (d.title || "").toLowerCase().includes(q) ||
                 (d.fileName || "").toLowerCase().includes(q) ||
                 (d.uploadedByName || "").toLowerCase().includes(q);
        })
      : docsWithType;
    const mobileFiltered = typeFilter === "all"
      ? searchFiltered
      : searchFiltered.filter(d => d.__type === typeFilter);

    // Summary
    const totalBytes = docs.reduce((sum, d) => sum + (d.fileSize || 0), 0);
    const pdfCount = docs.filter(d => detectType(d) === "pdf").length;

    const FILTERS: { key: typeof typeFilter; label: string }[] = [
      { key: "all", label: "All" },
      { key: "pdf", label: "PDF" },
      { key: "doc", label: "Docs" },
      { key: "img", label: "Images" },
      { key: "xls", label: "Sheets" },
    ];

    const docSubtitle = studentData?.className ? `Syllabus & notes for ${studentData.className}` : "Syllabus & notes shared by your teachers";

    // No class assigned — mobile empty state
    if (!studentData?.classId) {
      return (
        <div className="animate-in fade-in duration-500 -mx-3 -mt-3 md:mx-0 md:mt-0"
          style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", background: BG, minHeight: "100vh" }}>
          <div className="flex items-start justify-between px-[22px] pt-[18px]">
            <div>
              <div className="text-[26px] font-bold mb-[3px]" style={{ color: T1, letterSpacing: "-0.7px" }}>Class Documents</div>
              <div className="text-[12px] font-normal" style={{ color: T3 }}>Syllabus &amp; notes shared by your teachers</div>
            </div>
          </div>
          <div className="mx-5 mt-6 bg-white rounded-[24px] px-5 py-8 flex flex-col items-center gap-3 relative overflow-hidden"
            style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
            <div className="absolute -top-[50px] -right-[40px] w-[180px] h-[180px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(0,85,255,0.05) 0%, transparent 70%)" }} />
            <div className="w-[72px] h-[72px] rounded-[24px] flex items-center justify-center relative z-10"
              style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: `${SH_BTN}, 0 0 0 10px rgba(0,85,255,0.08)` }}>
              <Library className="w-8 h-8 text-white" strokeWidth={2.1} />
            </div>
            <div className="text-[18px] font-bold relative z-10 text-center" style={{ color: T1, letterSpacing: "-0.4px" }}>No Class Assigned</div>
            <div className="text-[13px] text-center max-w-[220px] leading-[1.6] font-normal relative z-10" style={{ color: T3 }}>
              Please contact your school administration to be assigned to a class.
            </div>
          </div>
          <div className="h-6" />
        </div>
      );
    }

    return (
      <div className="animate-in fade-in duration-500 -mx-3 -mt-3 md:mx-0 md:mt-0"
        style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", background: BG, minHeight: "100vh" }}>

        {/* ── Page Head ── */}
        <div className="flex items-start justify-between px-[22px] pt-[18px]">
          <div>
            <div className="text-[26px] font-bold mb-[3px]" style={{ color: T1, letterSpacing: "-0.7px" }}>Class Documents</div>
            <div className="text-[12px] font-normal" style={{ color: T3 }}>{docSubtitle}</div>
          </div>
          {docs.length > 0 && (
            <div className="px-3 py-[5px] rounded-full text-[10px] font-bold tracking-[0.04em] text-white whitespace-nowrap mt-1 shrink-0"
              style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: "0 3px 10px rgba(0,85,255,0.28)" }}>
              {docs.length} Doc{docs.length === 1 ? "" : "s"}
            </div>
          )}
        </div>

        {/* ── Search ── */}
        <div className="mx-5 mt-4 relative">
          <div className="absolute left-[15px] top-1/2 -translate-y-1/2 pointer-events-none">
            <Search className="w-4 h-4" style={{ color: "rgba(0,85,255,0.40)" }} strokeWidth={2.2} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by title, file name, or teacher..."
            className="w-full py-[13px] pr-4 pl-11 rounded-[17px] text-[14px] font-normal outline-none bg-white"
            style={{
              border: "0.5px solid rgba(0,85,255,0.12)",
              color: T1,
              letterSpacing: "-0.1px",
              boxShadow: SH,
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* ── Filter chips ── */}
        <div className="flex gap-2 px-5 pt-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {FILTERS.map(f => {
            const isAct = typeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className="px-[14px] py-[7px] rounded-full text-[11px] font-bold flex-shrink-0 transition-transform active:scale-[0.94]"
                style={{
                  background: isAct ? `linear-gradient(135deg, ${B1}, ${B2})` : "#FFFFFF",
                  color: isAct ? "#fff" : T3,
                  border: isAct ? "0.5px solid transparent" : "0.5px solid rgba(0,85,255,0.12)",
                  boxShadow: isAct ? "0 3px 12px rgba(0,85,255,0.30)" : SH,
                  transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
                }}>
                {f.label}
              </button>
            );
          })}
        </div>

        {/* ── Section label ── */}
        <div className="px-[22px] pt-[18px] text-[9px] font-bold uppercase tracking-[0.10em] flex items-center gap-2"
          style={{ color: T4 }}>
          <span>Recent Documents</span>
          <span className="flex-1 h-px" style={{ background: "rgba(0,85,255,0.12)" }} />
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="mx-5 mt-[14px] bg-white rounded-[24px] py-10 flex flex-col items-center gap-3"
            style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: B1 }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: T4 }}>Loading documents…</p>
          </div>
        ) : mobileFiltered.length === 0 ? (
          <div className="mx-5 mt-[14px] bg-white rounded-[24px] px-5 py-8 flex flex-col items-center gap-3 relative overflow-hidden"
            style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
            <div className="absolute -top-[50px] -right-[40px] w-[180px] h-[180px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(0,85,255,0.05) 0%, transparent 70%)" }} />
            <div className="absolute -bottom-[50px] -left-[30px] w-[160px] h-[160px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(0,85,255,0.04) 0%, transparent 70%)" }} />
            <div className="w-[72px] h-[72px] rounded-[24px] flex items-center justify-center relative z-10"
              style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: `${SH_BTN}, 0 0 0 10px rgba(0,85,255,0.08)` }}>
              <FileText className="w-8 h-8 text-white" strokeWidth={2.1} />
            </div>
            <div className="text-[18px] font-bold relative z-10 text-center" style={{ color: T1, letterSpacing: "-0.4px" }}>
              {searchQuery || typeFilter !== "all" ? "No Matches Found" : "No Documents Yet"}
            </div>
            <div className="text-[13px] text-center max-w-[220px] leading-[1.6] font-normal relative z-10" style={{ color: T3 }}>
              {searchQuery
                ? "Try a different search term."
                : typeFilter !== "all"
                ? `No ${FILTERS.find(f => f.key === typeFilter)?.label} files in this library yet.`
                : "Your teacher will upload syllabus notes, study materials and exam guides here."}
            </div>
          </div>
        ) : (
          mobileFiltered.map((doc: any) => {
            const theme = themeMap[doc.__type as DocType];
            const recent = isRecent(doc.uploadedAt);
            const subjectGuess =
              (doc.subject || doc.category || doc.tag || "").toString() ||
              (studentData?.className ? `Grade ${studentData.className}` : "");
            return (
              <div
                key={doc.id}
                onClick={() => handleView(doc.fileUrl)}
                className="mx-5 mt-[14px] bg-white rounded-[24px] p-5 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
                style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)", transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)" }}>
                <div className="absolute -top-10 -right-7 w-[140px] h-[140px] rounded-full pointer-events-none"
                  style={{ background: "radial-gradient(circle, rgba(0,85,255,0.05) 0%, transparent 70%)" }} />

                <div className="flex items-start gap-[14px] mb-4 relative z-10">
                  <div className="w-[50px] h-[50px] rounded-[16px] flex items-center justify-center shrink-0"
                    style={{ background: theme.icoBg, boxShadow: theme.icoShadow }}>
                    <FileText className="w-6 h-6 text-white" strokeWidth={2.1} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[16px] font-bold mb-[5px] leading-[1.3]" style={{ color: T1, letterSpacing: "-0.3px" }}>
                      {doc.title || "Untitled Document"}
                    </div>
                    {doc.fileName && (
                      <div className="text-[11px] font-medium truncate max-w-full mb-[3px]" style={{ color: T3, letterSpacing: "-0.1px" }}>
                        {doc.fileName}
                      </div>
                    )}
                    <div className="flex items-center gap-[10px] flex-wrap">
                      {doc.fileSize ? (
                        <div className="px-[9px] py-[3px] rounded-full text-[10px] font-bold tracking-[0.02em]"
                          style={{ background: "rgba(0,85,255,0.08)", border: "0.5px solid rgba(0,85,255,0.16)", color: B1 }}>
                          {formatBytes(doc.fileSize)}
                        </div>
                      ) : null}
                      {doc.uploadedAt && (
                        <div className="flex items-center gap-1 text-[11px] font-medium" style={{ color: T3 }}>
                          <Calendar className="w-[10px] h-[10px]" strokeWidth={2.5} />
                          {formatRelative(doc.uploadedAt)}
                        </div>
                      )}
                    </div>
                    {doc.uploadedByName && (
                      <div className="flex items-center gap-1 mt-[5px]">
                        <User className="w-[10px] h-[10px]" style={{ color: T3 }} strokeWidth={2.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: T3 }}>
                          By {doc.uploadedByName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-[6px] mb-3 relative z-10 flex-wrap">
                  <div className="px-[11px] py-1 rounded-full text-[10px] font-bold"
                    style={{ background: theme.tagBg, color: theme.tagColor, border: `0.5px solid ${theme.tagBorder}` }}>
                    {theme.tagLabel}
                  </div>
                  {subjectGuess && (
                    <div className="px-[11px] py-1 rounded-full text-[10px] font-bold"
                      style={{ background: "rgba(0,85,255,0.08)", color: B1, border: "0.5px solid rgba(0,85,255,0.16)" }}>
                      {subjectGuess}
                    </div>
                  )}
                  {recent && (
                    <div className="px-[11px] py-1 rounded-full text-[10px] font-bold"
                      style={{ background: "rgba(0,200,83,0.10)", color: "#007830", border: "0.5px solid rgba(0,200,83,0.22)" }}>
                      New
                    </div>
                  )}
                </div>

                <div className="flex gap-[10px] relative z-10">
                  <button
                    onClick={e => { e.stopPropagation(); handleView(doc.fileUrl); }}
                    disabled={!doc.fileUrl}
                    className="flex-1 h-11 rounded-[14px] flex items-center justify-center gap-2 text-[14px] font-bold text-white disabled:opacity-50 relative overflow-hidden active:scale-[0.97] transition-transform"
                    style={{
                      background: `linear-gradient(135deg, ${B1}, ${B2})`,
                      boxShadow: SH_BTN,
                      letterSpacing: "0.02em",
                      transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
                    }}>
                    <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 52%)" }} />
                    <ExternalLink className="w-[15px] h-[15px]" strokeWidth={2.2} />
                    <span className="relative z-10">{theme.viewLabel}</span>
                  </button>
                  <a
                    href={doc.fileUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={doc.fileName || true}
                    onClick={e => { e.stopPropagation(); if (!doc.fileUrl) e.preventDefault(); }}
                    aria-label="Download document"
                    className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                    style={{
                      background: BG,
                      border: "0.5px solid rgba(0,85,255,0.16)",
                      boxShadow: SH,
                      opacity: doc.fileUrl ? 1 : 0.5,
                      pointerEvents: doc.fileUrl ? "auto" : "none",
                      transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
                    }}>
                    <Download className="w-4 h-4" style={{ color: "rgba(0,85,255,0.7)" }} strokeWidth={2.2} />
                  </a>
                </div>
              </div>
            );
          })
        )}

        {/* ── Summary Dark ── */}
        {!loading && docs.length > 0 && (
          <div className="mx-5 mt-[14px] rounded-[22px] px-5 py-[18px] relative overflow-hidden"
            style={{
              background: "linear-gradient(140deg, #001888 0%, #0033CC 48%, #0055FF 100%)",
              boxShadow: "0 8px 28px rgba(0,51,204,0.32), 0 0 0 0.5px rgba(255,255,255,0.14)",
            }}>
            <div className="absolute -top-[35px] -right-[25px] w-[160px] h-[160px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 65%)" }} />
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)",
              backgroundSize: "24px 24px"
            }} />
            <div className="text-[9px] font-bold uppercase tracking-[0.12em] mb-[10px] relative z-10" style={{ color: "rgba(255,255,255,0.48)" }}>
              Document Library
            </div>
            <div className="grid grid-cols-3 rounded-[16px] overflow-hidden relative z-10" style={{ gap: "1px", background: "rgba(255,255,255,0.12)" }}>
              <div className="py-3 px-[14px] text-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="text-[22px] font-bold text-white leading-none mb-1" style={{ letterSpacing: "-0.6px" }}>{docs.length}</div>
                <div className="text-[9px] font-bold uppercase tracking-[0.09em]" style={{ color: "rgba(255,255,255,0.40)" }}>Total</div>
              </div>
              <div className="py-3 px-[14px] text-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="text-[22px] font-bold text-white leading-none mb-1" style={{ letterSpacing: "-0.6px" }}>{pdfCount}</div>
                <div className="text-[9px] font-bold uppercase tracking-[0.09em]" style={{ color: "rgba(255,255,255,0.40)" }}>{pdfCount === 1 ? "PDF" : "PDFs"}</div>
              </div>
              <div className="py-3 px-[14px] text-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="text-[22px] font-bold text-white leading-none mb-1" style={{ letterSpacing: "-0.6px" }}>
                  {totalBytes > 0 ? formatBytes(totalBytes) : "—"}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-[0.09em]" style={{ color: "rgba(255,255,255,0.40)" }}>Storage</div>
              </div>
            </div>
          </div>
        )}

        <div className="h-6" />
      </div>
    );
  }

  // ── No class assigned yet ────────────────────────────────────────────────
  if (!studentData?.classId) {
    return (
      <div className="animate-in fade-in duration-500">
        <PageHeader
          title="Class Documents"
          subtitle="Syllabus & notes shared by your teachers"
        />
        <div className="py-24 bg-white border border-dashed border-slate-200 rounded-[3rem] text-center">
          <Library className="w-12 h-12 text-slate-200 mx-auto mb-6" />
          <h3 className="text-xl font-black text-slate-800 uppercase mb-2">No Class Assigned</h3>
          <p className="text-sm text-slate-400 font-semibold">Please contact your school administration to be assigned to a class.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader
        title="Class Documents"
        subtitle={studentData?.className ? `Syllabus & notes for ${studentData.className}` : "Syllabus & notes shared by your teachers"}
        badge={docs.length > 0 ? `${docs.length} Document${docs.length === 1 ? "" : "s"}` : ""}
      />

      {/* Search */}
      <div className="mb-6">
        <div className="flex items-center gap-2 bg-white rounded-2xl px-4 py-3 border border-slate-100 shadow-sm">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, file name, or teacher..."
            className="flex-1 bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-300 font-medium"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-24 text-center bg-white border border-dashed border-slate-100 rounded-[3rem]">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading documents...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="py-24 bg-white border border-dashed border-slate-200 rounded-[3rem] text-center">
          <FileText className="w-12 h-12 text-slate-200 mx-auto mb-6" />
          <h3 className="text-xl font-black text-slate-800 uppercase mb-2">
            {searchQuery ? "No Matches Found" : "No Documents Shared Yet"}
          </h3>
          <p className="text-sm text-slate-400 font-semibold">
            {searchQuery
              ? "Try a different search term."
              : "Your teachers haven't shared any syllabus or notes for this class yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="clickable-card bg-white rounded-3xl border border-slate-100 p-5 md:p-6 shadow-sm hover:shadow-md transition-all flex items-start gap-4 md:gap-5"
            >
              {/* PDF icon */}
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center border-2 border-rose-100 bg-rose-50 shrink-0">
                <FileText className="w-8 h-8 md:w-10 md:h-10 text-rose-500" />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0 space-y-2">
                <h3 className="text-base md:text-lg font-black text-slate-800 tracking-tight leading-tight break-words">
                  {doc.title || "Untitled Document"}
                </h3>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
                  {doc.fileName && (
                    <span className="truncate max-w-[200px]">{doc.fileName}</span>
                  )}
                  {doc.fileSize ? (
                    <>
                      <span className="text-slate-300">·</span>
                      <span>{formatBytes(doc.fileSize)}</span>
                    </>
                  ) : null}
                  {doc.uploadedAt && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatRelative(doc.uploadedAt)}
                      </span>
                    </>
                  )}
                </div>

                {doc.uploadedByName && (
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <User className="w-3 h-3" />
                    By {doc.uploadedByName}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => handleView(doc.fileUrl)}
                    disabled={!doc.fileUrl}
                    className="flex-1 md:flex-none px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 shadow-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View PDF
                  </button>
                  <a
                    href={doc.fileUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={doc.fileName || true}
                    onClick={(e) => { if (!doc.fileUrl) e.preventDefault(); }}
                    aria-label="Download document"
                    className={`w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-all active:scale-95 ${!doc.fileUrl ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <Download className="w-4 h-4 text-slate-600" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SyllabusPage;