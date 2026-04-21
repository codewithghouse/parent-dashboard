import { useState, useEffect, useRef, useMemo } from "react";
import { Loader2, Send, CheckCheck, School, Mail, MessageSquare, Smile, Shield, ChevronLeft } from "lucide-react";
import { db } from "../lib/firebase";
import { scopedQuery } from "../lib/scopedQuery";
import { collection, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { useAuth } from "../lib/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const PrincipalNotesPage = () => {
  const { studentData } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [allMessages, setAllMessages]       = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [messageContent, setMessageContent] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!studentData?.id) return;
    setLoading(true);
    const schoolId = studentData.schoolId;
    const notesQ = scopedQuery("principal_to_parent_notes", schoolId, where("studentId", "==", studentData.id));
    const unsub = onSnapshot(notesQ,
      async snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        data.sort((a, b) => (a.timestamp?.toMillis?.() || 0) - (b.timestamp?.toMillis?.() || 0));
        setAllMessages(data);
        setLoading(false);
        // mark unread principal messages as read
        for (const d of snap.docs) {
          const dd = d.data();
          if (dd.read === false && dd.from === "principal") {
            try { await updateDoc(doc(db, "principal_to_parent_notes", d.id), { read: true }); } catch { /* silent */ }
          }
        }
      }
    );
    return () => unsub();
  }, [studentData?.id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [allMessages]);

  const stats = useMemo(() => ({
    total:  allMessages.length,
    unread: allMessages.filter(m => m.read === false && m.from === "principal").length,
  }), [allMessages]);

  const handleSend = async () => {
    if (!messageContent.trim()) return;
    const content = messageContent.trim();
    if (!studentData?.schoolId) {
      toast.error("Your school context is missing. Please sign in again.");
      return;
    }
    if (!studentData.id) {
      toast.error("We couldn't identify your student record. Please sign in again.");
      return;
    }
    // Without a prior principal message in this thread we have no principalId
    // to address. The server rule accepts the write but the note becomes
    // unaddressable (principal's inbox query filters by principalId). Surface
    // this explicitly instead of creating orphaned records.
    const principalId = allMessages[0]?.principalId;
    if (!principalId) {
      toast.error("No principal is assigned to your school yet. Please check back later.");
      return;
    }
    setMessageContent("");
    try {
      await addDoc(collection(db, "principal_to_parent_notes"), {
        principalId,
        principalName: allMessages[0]?.principalName || "Principal",
        studentId:     studentData.id,
        studentName:   studentData.name || "",
        parentName:    `Parent of ${studentData.name || "Student"}`,
        className:     studentData.className || "",
        message: content,
        from: "parent",
        timestamp: serverTimestamp(),
        schoolId: studentData.schoolId,
        branchId: studentData.branchId || "",
        read: false,
      });
    } catch (err: any) {
      console.error("[PrincipalNotes] send failed:", err?.code, err?.message || err);
      // Keep the message content so the parent can retry. Never leak Firebase
      // internals (rule names, deploy hints) to the UI — that jargon helps
      // nobody and looks like a crash report to non-technical users.
      toast.error(err?.code === "permission-denied"
        ? "This message couldn't be sent. Please contact your school if this continues."
        : "Couldn't send the message. Please check your connection and try again.");
      setMessageContent(content);
    }
  };

  const fmtTime = (ts: any) =>
    new Date(ts?.toDate?.() || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const fmtDate = (ts: any) => {
    const d = ts?.toDate?.() || new Date();
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const y = new Date(today); y.setDate(today.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: any[] }[] = [];
    allMessages.forEach(msg => {
      const label = fmtDate(msg.timestamp);
      const last  = groups[groups.length - 1];
      if (last && last.date === label) last.messages.push(msg);
      else groups.push({ date: label, messages: [msg] });
    });
    return groups;
  }, [allMessages]);

  const principalName = allMessages[0]?.principalName || "Principal";
  const principalInitial = (principalName?.[0] || "P").toUpperCase();

  // ═══════════════════════════════════════════════════════════════
  // MOBILE — Blue Premium UI (Principal Chat — full bleed)
  // ═══════════════════════════════════════════════════════════════
  if (isMobile) {
    const B1 = "#0055FF", B2 = "#1166FF", B3 = "#2277FF";
    const BG = "#EEF4FF", CARD = "#FFFFFF";
    const T1 = "#001040", T2 = "#002080", T3 = "#5070B0", T4 = "#99AACC";
    const ORANGE = "#FF8800";
    const SH    = "0 0 0 0.5px rgba(0,85,255,0.08), 0 2px 8px rgba(0,85,255,0.08), 0 10px 24px rgba(0,85,255,0.10)";
    const SH_LG = "0 0 0 0.5px rgba(0,85,255,0.10), 0 4px 16px rgba(0,85,255,0.11), 0 18px 44px rgba(0,85,255,0.13)";
    const SH_BTN = "0 6px 22px rgba(0,85,255,0.42), 0 2px 6px rgba(0,85,255,0.22)";
    const FONT = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";

    return (
      <div className="flex-1 flex flex-col -mx-3 -mt-3 md:mx-0 md:mt-0 animate-in fade-in duration-500"
        style={{ background: BG, fontFamily: FONT }}>
        <style>{`.pn-scroll::-webkit-scrollbar{display:none}`}</style>

        {/* Stat row */}
        <div className="flex gap-[10px] px-5 pt-3 shrink-0">
          <div className="flex-1 rounded-[18px] p-[14px] flex flex-col gap-[5px] relative overflow-hidden"
            style={{ background: CARD, boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
            <div className="absolute -top-4 -right-3 w-[60px] h-[60px] rounded-full opacity-50 pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(0,85,255,0.10) 0%, transparent 70%)" }} />
            <div className="w-[26px] h-[26px] rounded-[8px] flex items-center justify-center mb-[3px]"
              style={{ background: "rgba(0,85,255,0.10)", border: "0.5px solid rgba(0,85,255,0.18)" }}>
              <MessageSquare className="w-[13px] h-[13px]" style={{ color: B1 }} strokeWidth={2.4} />
            </div>
            <div className="text-[9px] font-bold uppercase tracking-[0.07em] leading-[1.4]" style={{ color: T4 }}>Total Messages</div>
            <div className="text-[24px] font-bold leading-none" style={{ color: T1, letterSpacing: "-0.6px" }}>{stats.total}</div>
          </div>
          <div className="flex-1 rounded-[18px] p-[14px] flex flex-col gap-[5px] relative overflow-hidden"
            style={{ background: CARD, boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
            <div className="absolute -top-4 -right-3 w-[60px] h-[60px] rounded-full opacity-50 pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(255,136,0,0.10) 0%, transparent 70%)" }} />
            <div className="w-[26px] h-[26px] rounded-[8px] flex items-center justify-center mb-[3px]"
              style={{ background: "rgba(255,136,0,0.10)", border: "0.5px solid rgba(255,136,0,0.22)" }}>
              <Mail className="w-[13px] h-[13px]" style={{ color: ORANGE }} strokeWidth={2.4} />
            </div>
            <div className="text-[9px] font-bold uppercase tracking-[0.07em] leading-[1.4]" style={{ color: T4 }}>
              Unread from<br />Principal
            </div>
            <div className="text-[24px] font-bold leading-none" style={{ color: T1, letterSpacing: "-0.6px" }}>{stats.unread}</div>
          </div>
        </div>

        {/* Chat header — gradient banner */}
        <div className="mx-5 mt-3 rounded-[20px] px-[16px] py-[15px] flex items-center gap-3 relative overflow-hidden shrink-0"
          style={{ background: `linear-gradient(135deg, #0033CC 0%, ${B1} 50%, ${B3} 100%)`, boxShadow: SH_BTN }}>
          <div className="absolute -top-7 -right-4 w-[130px] h-[130px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 65%)" }} />
          <button onClick={() => navigate(-1)}
            className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center active:scale-90 relative z-10 shrink-0"
            style={{ background: "rgba(255,255,255,0.20)", border: "0.5px solid rgba(255,255,255,0.28)" }}
            aria-label="Back">
            <ChevronLeft className="w-[14px] h-[14px] text-white" strokeWidth={2.5} />
          </button>
          <div className="w-[44px] h-[44px] rounded-[14px] flex items-center justify-center text-white relative z-10 shrink-0"
            style={{ background: "rgba(255,255,255,0.22)", border: "2px solid rgba(255,255,255,0.30)" }}>
            <School className="w-[22px] h-[22px]" strokeWidth={2.1} />
          </div>
          <div className="flex-1 min-w-0 relative z-10">
            <div className="text-[16px] font-bold text-white truncate" style={{ letterSpacing: "-0.3px" }}>{principalName}</div>
            <div className="text-[11px] font-medium mt-[2px] flex items-center gap-[5px]" style={{ color: "rgba(255,255,255,0.65)" }}>
              <div className="w-[5px] h-[5px] rounded-full animate-pulse" style={{ background: "#00EE88", boxShadow: "0 0 0 1.5px rgba(0,238,136,0.22)" }} />
              School Administration
            </div>
          </div>
          <div className="flex items-center gap-[3px] px-[10px] py-[6px] rounded-[11px] relative z-10 shrink-0"
            style={{ background: "rgba(255,255,255,0.20)", border: "0.5px solid rgba(255,255,255,0.28)" }}>
            <Shield className="w-[11px] h-[11px] text-white" strokeWidth={2.5} />
            <span className="text-[10px] font-bold text-white tracking-[0.04em]">Official</span>
          </div>
        </div>

        {/* Chat scroll area */}
        <div className="pn-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 py-3 flex flex-col gap-4"
          style={{ scrollbarWidth: "none" }}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: B1 }} />
            </div>
          ) : groupedMessages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
              <div className="w-[60px] h-[60px] rounded-[20px] flex items-center justify-center"
                style={{ background: "rgba(0,85,255,0.08)", border: "0.5px solid rgba(0,85,255,0.14)", boxShadow: "0 0 0 8px rgba(0,85,255,0.04)" }}>
                <School className="w-[26px] h-[26px]" style={{ color: "rgba(0,85,255,0.45)" }} strokeWidth={2.1} />
              </div>
              <div className="text-[16px] font-bold text-center" style={{ color: T2, letterSpacing: "-0.3px" }}>No messages from Principal yet</div>
              <div className="text-[12px] text-center max-w-[230px] font-normal leading-[1.6]" style={{ color: T4 }}>
                Messages from your school principal will appear here
              </div>
            </div>
          ) : groupedMessages.map(group => (
            <div key={group.date} className="flex flex-col gap-3">
              <div className="flex justify-center">
                <span className="text-[11px] font-semibold px-[14px] py-[5px] rounded-full"
                  style={{ background: "rgba(0,85,255,0.08)", color: T3, border: "0.5px solid rgba(0,85,255,0.14)", letterSpacing: "-0.1px" }}>
                  {group.date}
                </span>
              </div>
              {group.messages.map(n => {
                const isParent = n.from === "parent";
                return isParent ? (
                  <div key={n.id} className="flex justify-end">
                    <div className="max-w-[82%]">
                      <div className="px-[16px] py-[13px] text-[13px] text-white font-normal leading-[1.65] relative overflow-hidden"
                        style={{
                          background: `linear-gradient(135deg, ${B1}, ${B2})`,
                          borderRadius: "20px 5px 20px 20px",
                          boxShadow: "0 3px 14px rgba(0,85,255,0.28)",
                          letterSpacing: "-0.1px",
                        }}>
                        <div className="whitespace-pre-wrap break-words">{n.message}</div>
                      </div>
                      <div className="text-[10px] font-semibold text-right mt-[5px] flex items-center justify-end gap-[5px]" style={{ color: T4 }}>
                        <span>{fmtTime(n.timestamp)}</span>
                        <CheckCheck className="w-[13px] h-[13px]" style={{ color: B1, opacity: 0.55 }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={n.id} className="flex items-start gap-[10px] max-w-[88%]">
                    <div className="w-9 h-9 rounded-[12px] flex items-center justify-center text-white text-[14px] font-bold shrink-0"
                      style={{ background: `linear-gradient(135deg, ${B1}, ${B3})`, boxShadow: "0 3px 10px rgba(0,85,255,0.24)" }}>
                      {principalInitial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold mb-[5px]" style={{ color: B1, letterSpacing: "-0.1px" }}>
                        {principalName} · School Admin
                      </div>
                      <div className="px-[18px] py-[16px] text-[13px] font-normal leading-[1.72] relative overflow-hidden"
                        style={{
                          background: CARD, color: T1,
                          borderRadius: "5px 20px 20px 20px",
                          boxShadow: SH_LG,
                          border: "0.5px solid rgba(0,85,255,0.10)",
                          letterSpacing: "-0.1px",
                        }}>
                        <div className="absolute -top-4 -right-3 w-[70px] h-[70px] rounded-full pointer-events-none"
                          style={{ background: "radial-gradient(circle, rgba(0,85,255,0.04) 0%, transparent 70%)" }} />
                        <div className="whitespace-pre-wrap break-words relative z-10">{n.message}</div>
                      </div>
                      <div className="text-[10px] font-semibold text-right mt-[5px] flex items-center justify-end gap-[5px]" style={{ color: T4 }}>
                        <span>{fmtTime(n.timestamp)}</span>
                        <CheckCheck className="w-[13px] h-[13px]" style={{ color: B1, opacity: 0.55 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Reply bar */}
        <div className="px-[18px] py-[10px] pb-[14px] flex items-center gap-[10px] shrink-0"
          style={{
            background: "rgba(238,244,255,0.94)",
            WebkitBackdropFilter: "saturate(220%) blur(28px)",
            backdropFilter: "saturate(220%) blur(28px)",
            borderTop: "0.5px solid rgba(0,85,255,0.10)",
          }}>
          <button className="w-9 h-9 rounded-[12px] flex items-center justify-center active:scale-90 shrink-0"
            style={{ background: CARD, border: "0.5px solid rgba(0,85,255,0.14)", boxShadow: SH }}
            aria-label="Emoji">
            <Smile className="w-[16px] h-[16px]" style={{ color: "rgba(0,85,255,0.6)" }} strokeWidth={2} />
          </button>
          <input
            type="text"
            value={messageContent}
            onChange={e => setMessageContent(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Reply to principal..."
            className="flex-1 min-w-0 px-[15px] py-[11px] rounded-[14px] text-[13px] outline-none"
            style={{ background: CARD, border: "0.5px solid rgba(0,85,255,0.14)", color: T1, boxShadow: SH, fontFamily: FONT }}
          />
          <button onClick={handleSend} disabled={!messageContent.trim()}
            className="w-[38px] h-[38px] rounded-[12px] flex items-center justify-center active:scale-90 shrink-0 disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: "0 3px 12px rgba(0,85,255,0.30)" }}
            aria-label="Send">
            <Send className="w-[15px] h-[15px] text-white" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     DESKTOP — Bright Blue Apple UI
     ═══════════════════════════════════════════════════════════════ */
  const B1 = "#0055FF", B2 = "#1166FF", B3 = "#2277FF";
  const BG_D = "#EEF4FF", BG2_D = "#E0ECFF";
  const T1 = "#001040", T3 = "#5070B0", T4 = "#99AACC";
  const ORANGE = "#FF8800", GREEN = "#00C853", RED = "#FF3355";
  const BLUE_BDR = "rgba(0,85,255,0.12)";
  const SH_D = "0 0 0 0.5px rgba(0,85,255,0.08), 0 2px 8px rgba(0,85,255,0.09), 0 10px 28px rgba(0,85,255,0.11)";
  const SH_LG_D = "0 0 0 0.5px rgba(0,85,255,0.10), 0 4px 16px rgba(0,85,255,0.12), 0 18px 44px rgba(0,85,255,0.14)";
  const SH_BTN_D = "0 6px 22px rgba(0,85,255,0.42), 0 2px 6px rgba(0,85,255,0.22)";
  const FONT_D = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";

  return (
    <div className="animate-in fade-in duration-500 -m-4 sm:-m-6 md:-m-8 min-h-[calc(100vh-64px)]"
      style={{ fontFamily: FONT_D, background: BG_D }}>
      <div className="w-full px-6 pt-8 pb-12">

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-1 flex items-center gap-[7px]" style={{ color: T4 }}>
              <span className="w-[6px] h-[6px] rounded-full animate-pulse" style={{ background: GREEN, boxShadow: "0 0 0 3px rgba(0,200,83,0.2)" }} />
              Parent Dashboard · Principal
            </div>
            <h1 className="text-[32px] font-bold leading-none" style={{ color: T1, letterSpacing: "-0.8px" }}>Principal Messages</h1>
            <div className="text-[13px] font-normal mt-[6px]" style={{ color: T3 }}>Official communication from school administration</div>
          </div>
          <div className="flex items-center gap-[10px]">
            <div className="px-[14px] py-[8px] rounded-full text-[12px] font-bold flex items-center gap-[6px]"
              style={{ background: "rgba(0,85,255,0.08)", color: B1, border: `0.5px solid ${BLUE_BDR}` }}>
              <Shield className="w-[12px] h-[12px]" strokeWidth={2.5} />
              Official
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white"
              style={{ background: `linear-gradient(140deg, ${B1}, ${B2})`, boxShadow: "0 3px 12px rgba(0,85,255,0.36), 0 0 0 2px rgba(255,255,255,0.8)" }}>
              {(studentData?.name?.[0] || "S").toUpperCase()}
            </div>
          </div>
        </div>

        {/* ── Stat strip ── */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          {[
            { label: "Total Messages", val: stats.total, color: B1, icon: MessageSquare, grad: `linear-gradient(135deg, ${B1}, ${B3})`, sh: "0 3px 10px rgba(0,85,255,0.28)", glow: "rgba(0,85,255,0.08)" },
            { label: "Unread from Principal", val: stats.unread, color: ORANGE, icon: Mail, grad: `linear-gradient(135deg, ${ORANGE}, #FFCC22)`, sh: "0 3px 10px rgba(255,136,0,0.28)", glow: "rgba(255,136,0,0.08)" },
          ].map(({ label, val, color, icon: Icon, grad, sh, glow }) => (
            <div key={label} className="bg-white rounded-[22px] px-6 py-5 relative overflow-hidden"
              style={{ boxShadow: SH_D, border: "0.5px solid rgba(0,85,255,0.10)" }}>
              <div className="absolute -top-[20px] -right-[20px] w-[120px] h-[120px] rounded-full pointer-events-none"
                style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 70%)` }} />
              <div className="flex items-center justify-between mb-3 relative">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: T4 }}>{label}</span>
                <div className="w-10 h-10 rounded-[12px] flex items-center justify-center"
                  style={{ background: grad, boxShadow: sh }}>
                  <Icon className="w-[18px] h-[18px] text-white" strokeWidth={2.3} />
                </div>
              </div>
              <div className="text-[34px] font-bold leading-none relative" style={{ color, letterSpacing: "-1px" }}>{val}</div>
            </div>
          ))}
        </div>

        {/* ── Main chat card ── */}
        <div className="bg-white rounded-[22px] overflow-hidden flex flex-col"
          style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(0,85,255,0.10)", height: "calc(100vh - 320px)", minHeight: 560 }}>

          {/* Chat header — gradient banner */}
          <div className="px-7 py-5 flex items-center gap-4 relative overflow-hidden shrink-0"
            style={{ background: `linear-gradient(135deg, #0033CC 0%, ${B1} 50%, ${B3} 100%)`, boxShadow: "0 4px 14px rgba(0,51,204,0.24)" }}>
            <div className="absolute -top-[40px] -right-[30px] w-[260px] h-[260px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.16) 0%, transparent 65%)" }} />
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px)",
              backgroundSize: "22px 22px"
            }} />
            <div className="w-14 h-14 rounded-[18px] flex items-center justify-center relative z-10 shrink-0"
              style={{ background: "rgba(255,255,255,0.22)", border: "2px solid rgba(255,255,255,0.30)" }}>
              <School className="w-7 h-7 text-white" strokeWidth={2.1} />
            </div>
            <div className="flex-1 min-w-0 relative z-10">
              <div className="text-[22px] font-bold text-white" style={{ letterSpacing: "-0.5px" }}>{principalName}</div>
              <div className="text-[12px] font-medium mt-[4px] flex items-center gap-2" style={{ color: "rgba(255,255,255,0.70)" }}>
                <div className="w-[6px] h-[6px] rounded-full animate-pulse" style={{ background: "#00EE88", boxShadow: "0 0 0 2px rgba(0,238,136,0.22)" }} />
                School Administration · Online
              </div>
            </div>
            <div className="flex items-center gap-[5px] px-3 py-[7px] rounded-[12px] relative z-10"
              style={{ background: "rgba(255,255,255,0.20)", border: "0.5px solid rgba(255,255,255,0.28)", backdropFilter: "blur(8px)" }}>
              <Shield className="w-[13px] h-[13px] text-white" strokeWidth={2.5} />
              <span className="text-[11px] font-bold text-white tracking-[0.04em]">Official</span>
            </div>
          </div>

          {/* Messages scroll */}
          <div className="flex-1 overflow-y-auto no-sb px-8 py-6 flex flex-col gap-4 relative"
            style={{
              background: BG_D,
              backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,85,255,0.04) 1px, transparent 0)",
              backgroundSize: "22px 22px",
            }}>
            <style>{`.no-sb::-webkit-scrollbar{display:none}`}</style>
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: B1 }} />
              </div>
            ) : allMessages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center">
                <div className="bg-white rounded-[22px] px-12 py-12 max-w-md relative overflow-hidden"
                  style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(0,85,255,0.10)" }}>
                  <div className="absolute -top-[60px] -right-[40px] w-[220px] h-[220px] rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(0,85,255,0.06) 0%, transparent 70%)" }} />
                  <div className="w-[80px] h-[80px] rounded-[24px] flex items-center justify-center mx-auto mb-5 relative z-10"
                    style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: SH_BTN_D }}>
                    <School className="w-10 h-10 text-white" strokeWidth={2.2} />
                  </div>
                  <div className="text-[20px] font-bold mb-2 relative z-10" style={{ color: T1, letterSpacing: "-0.4px" }}>No messages yet</div>
                  <div className="text-[13px] leading-[1.6] relative z-10" style={{ color: T3 }}>
                    Messages from your school principal will appear here. Official notices and announcements will be delivered directly to this inbox.
                  </div>
                </div>
              </div>
            ) : groupedMessages.map(group => (
              <div key={group.date} className="flex flex-col gap-3">
                <div className="flex justify-center">
                  <span className="text-[11px] font-bold px-4 py-[6px] rounded-full"
                    style={{ background: "#fff", color: T3, border: `0.5px solid ${BLUE_BDR}`, boxShadow: SH_D, letterSpacing: "-0.1px" }}>
                    {group.date}
                  </span>
                </div>
                {group.messages.map(n => {
                  const isParent = n.from === "parent";
                  return isParent ? (
                    <div key={n.id} className="flex justify-end">
                      <div className="max-w-[65%]">
                        <div className="px-5 py-[13px] text-[14px] text-white font-normal leading-[1.6] relative overflow-hidden"
                          style={{
                            background: `linear-gradient(135deg, ${B1}, ${B2})`,
                            borderRadius: "20px 6px 20px 20px",
                            boxShadow: "0 3px 14px rgba(0,85,255,0.28)",
                            letterSpacing: "-0.1px",
                          }}>
                          <div className="whitespace-pre-wrap break-words">{n.message}</div>
                        </div>
                        <div className="text-[11px] font-semibold text-right mt-[6px] flex items-center justify-end gap-[5px]" style={{ color: T4 }}>
                          <span>{fmtTime(n.timestamp)}</span>
                          <CheckCheck className="w-[14px] h-[14px]" style={{ color: B1, opacity: 0.6 }} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div key={n.id} className="flex items-start gap-3 max-w-[70%]">
                      <div className="w-11 h-11 rounded-[14px] flex items-center justify-center text-white text-[15px] font-bold shrink-0"
                        style={{ background: `linear-gradient(135deg, ${B1}, ${B3})`, boxShadow: "0 3px 10px rgba(0,85,255,0.28)" }}>
                        {principalInitial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-bold mb-[6px] flex items-center gap-2" style={{ color: B1, letterSpacing: "-0.1px" }}>
                          {principalName}
                          <span className="px-2 py-[2px] rounded-full text-[9px] font-bold uppercase tracking-[0.05em]"
                            style={{ background: "rgba(0,85,255,0.08)", color: B1, border: `0.5px solid ${BLUE_BDR}` }}>
                            Principal
                          </span>
                        </div>
                        <div className="px-6 py-4 text-[14px] font-normal leading-[1.7] relative overflow-hidden"
                          style={{
                            background: "#fff", color: T1,
                            borderRadius: "6px 20px 20px 20px",
                            boxShadow: SH_LG_D,
                            border: "0.5px solid rgba(0,85,255,0.10)",
                            letterSpacing: "-0.1px",
                          }}>
                          <div className="absolute -top-5 -right-4 w-[90px] h-[90px] rounded-full pointer-events-none"
                            style={{ background: "radial-gradient(circle, rgba(0,85,255,0.05) 0%, transparent 70%)" }} />
                          <div className="whitespace-pre-wrap break-words relative z-10">{n.message}</div>
                        </div>
                        <div className="text-[11px] font-semibold mt-[6px] flex items-center gap-[5px]" style={{ color: T4 }}>
                          <span>{fmtTime(n.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Reply bar */}
          <div className="px-6 py-4 flex items-center gap-3 shrink-0"
            style={{ background: "#fff", borderTop: `0.5px solid ${BLUE_BDR}` }}>
            <button className="w-11 h-11 rounded-[12px] flex items-center justify-center"
              style={{ background: BG_D, border: `0.5px solid ${BLUE_BDR}` }}>
              <Smile className="w-5 h-5" style={{ color: T3 }} strokeWidth={2} />
            </button>
            <div className="flex-1 rounded-[14px] flex items-center min-h-[44px] px-4"
              style={{ background: BG_D, border: `0.5px solid ${BLUE_BDR}` }}>
              <textarea rows={1} value={messageContent}
                onChange={e => setMessageContent(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Reply to principal…"
                className="flex-1 bg-transparent border-none focus:ring-0 text-[14px] resize-none outline-none leading-relaxed py-2"
                style={{ fontFamily: FONT_D, color: T1, letterSpacing: "-0.1px" }} />
            </div>
            <button onClick={handleSend} disabled={!messageContent.trim()}
              className="h-11 px-5 rounded-[12px] flex items-center gap-2 text-[13px] font-bold transition-transform hover:scale-[1.04] disabled:opacity-40"
              style={{
                background: messageContent.trim() ? `linear-gradient(135deg, ${B1}, ${B2})` : BG2_D,
                color: messageContent.trim() ? "#fff" : T4,
                boxShadow: messageContent.trim() ? SH_BTN_D : "none",
                letterSpacing: "-0.1px"
              }}>
              <Send className="w-[15px] h-[15px]" strokeWidth={2.3} /> Send
            </button>
          </div>
        </div>

        {/* Info card */}
        <div className="mt-5 bg-white rounded-[18px] p-5 flex items-start gap-3"
          style={{ boxShadow: SH_D, border: "0.5px solid rgba(0,85,255,0.10)" }}>
          <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
            style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: "0 3px 10px rgba(0,85,255,0.28)" }}>
            <Shield className="w-5 h-5 text-white" strokeWidth={2.3} />
          </div>
          <div>
            <div className="text-[13px] font-bold mb-[3px]" style={{ color: T1, letterSpacing: "-0.2px" }}>Official Communication Channel</div>
            <div className="text-[11px] leading-[1.55]" style={{ color: T3 }}>
              All messages here are from your school's administration. Please reply professionally — this conversation is archived for school records.
              {!allMessages[0]?.principalId && <> You can reply once the principal has sent the first message.</>}
            </div>
          </div>
          {stats.unread > 0 && (
            <div className="px-[10px] py-[5px] rounded-full text-[11px] font-bold shrink-0"
              style={{ background: "rgba(255,51,85,0.10)", color: RED, border: "0.5px solid rgba(255,51,85,0.22)" }}>
              {stats.unread} new
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrincipalNotesPage;
