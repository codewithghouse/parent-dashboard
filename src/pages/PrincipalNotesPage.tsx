import { useState, useEffect, useRef, useMemo } from "react";
import { Loader2, Send, CheckCheck, School, Mail, MessageSquare, Smile, Shield, ChevronLeft } from "lucide-react";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc } from "firebase/firestore";
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
    const notesQ = schoolId
      ? query(collection(db, "principal_to_parent_notes"), where("schoolId", "==", schoolId), where("studentId", "==", studentData.id))
      : query(collection(db, "principal_to_parent_notes"), where("studentId", "==", studentData.id));
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
      toast.error("Cannot send: missing school context. Please re-login.");
      return;
    }
    setMessageContent("");
    try {
      await addDoc(collection(db, "principal_to_parent_notes"), {
        principalId:   allMessages[0]?.principalId   || "",
        principalName: allMessages[0]?.principalName || "Principal",
        studentId:     studentData.id   || "",
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
      toast.error(err?.code === "permission-denied"
        ? "Send blocked by server rules — deploy updated firestore.rules."
        : `Failed to send: ${err?.message || "unknown error"}`);
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

  // ═══════════════════════════════════════════════════════════════
  // DESKTOP — unchanged
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="h-screen flex flex-col -mt-6" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap');
        .wa-chat::-webkit-scrollbar { width: 6px; }
        .wa-chat::-webkit-scrollbar-thumb { background: #c8b89a; border-radius: 4px; }
        .wa-input::-webkit-scrollbar { display: none; }
        .bubble-sent { border-radius: 8px 0 8px 8px; position: relative; }
        .bubble-sent::before { content:''; position:absolute; top:0; right:-8px; width:0; height:0; border:8px solid transparent; border-top-color:#00a884; border-right:0; }
        .bubble-recv { border-radius: 0 8px 8px 8px; position: relative; }
        .bubble-recv::before { content:''; position:absolute; top:0; left:-8px; width:0; height:0; border:8px solid transparent; border-top-color:#ffffff; border-left:0; }
        .wa-bg { background-color:#efeae2; }
      `}</style>

      {/* Stat strip */}
      <div className="flex gap-4 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        {[
          { label: "Total Messages",        val: stats.total,  icon: MessageSquare, color: "text-teal-500" },
          { label: "Unread from Principal", val: stats.unread, icon: Mail,          color: "text-amber-500" },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-3 bg-gray-50 rounded-xl px-5 py-3 flex-1 border border-gray-100">
            <s.icon className={`w-5 h-5 ${s.color} shrink-0`} />
            <div>
              <p className="text-xs font-semibold text-gray-400">{s.label}</p>
              <p className="text-xl font-black text-gray-800">{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2 bg-[#00a884] shrink-0">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <School className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm leading-none">{principalName}</p>
            <p className="text-teal-100 text-xs mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" /> School Administration
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto wa-chat wa-bg px-4 py-4 flex flex-col gap-1">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-gray-400" />
            </div>
          ) : allMessages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="bg-white/80 rounded-lg px-8 py-6 shadow-sm">
                <School className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-500">No messages from Principal yet</p>
                <p className="text-xs text-gray-400 mt-1">Messages from your school principal will appear here</p>
              </div>
            </div>
          ) : groupedMessages.map(group => (
            <div key={group.date}>
              <div className="flex justify-center my-3">
                <span className="bg-white/90 text-gray-500 text-[11px] font-medium px-3 py-1 rounded-full shadow-sm">{group.date}</span>
              </div>
              {group.messages.map(n => {
                const isParent = n.from === "parent";
                return (
                  <div key={n.id} className={`flex mb-1 ${isParent ? "justify-end" : "justify-start"}`}>
                    {/* Principal avatar for received */}
                    {!isParent && (
                      <div className="w-7 h-7 rounded-full bg-[#00a884] flex items-center justify-center text-white text-[10px] font-bold mr-1 mt-1 shrink-0">
                        {principalName.substring(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className={`max-w-[70%] px-3 py-2 shadow-sm ${isParent ? "bubble-sent text-white" : "bubble-recv bg-white"}`}
                      style={isParent ? { backgroundColor: "#00a884" } : {}}>
                      {!isParent && (
                        <p className="text-[11px] font-semibold text-[#00a884] mb-1">{principalName}</p>
                      )}
                      <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isParent ? "text-white" : "text-gray-800"}`}>{n.message}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className={`text-[11px] ${isParent ? "text-teal-100" : "text-gray-400"}`}>{fmtTime(n.timestamp)}</span>
                        {isParent && <CheckCheck className="w-4 h-4 text-white/70" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 px-3 py-2 bg-[#f0f2f5] shrink-0">
          <button className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-200 rounded-full transition-colors">
            <Smile className="w-6 h-6" />
          </button>
          <div className="flex-1 bg-white rounded-full px-4 py-2 flex items-center min-h-[42px]">
            <textarea
              rows={1}
              value={messageContent}
              onChange={e => setMessageContent(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Reply to principal..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-800 resize-none wa-input outline-none placeholder:text-gray-400 leading-relaxed"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!messageContent.trim()}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${messageContent.trim() ? "text-white" : "bg-gray-300 text-gray-400"}`}
            style={messageContent.trim() ? { backgroundColor: "#00a884" } : {}}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrincipalNotesPage;
