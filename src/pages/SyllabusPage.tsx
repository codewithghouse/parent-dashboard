import { useState, useEffect, useMemo } from "react";
import {
  Loader2, FileText, Search, Download, ExternalLink, User, Calendar, Library
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { PageHeader } from "@/components/ui/PageHeader";

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
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

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