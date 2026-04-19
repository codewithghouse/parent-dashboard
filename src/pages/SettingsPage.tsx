import { useState, useEffect } from "react";
import {
  User, Bell, Globe, Mail, Phone, Camera, Loader2, Settings,
  ShieldCheck, Lock, Smartphone, Heart, Zap, ShieldAlert, Sparkles, ChevronRight, CheckCircle2, Users, BarChart3, MessageSquare
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

const SettingsPage = () => {
  const { studentData, user } = useAuth();
  const isMobile = useIsMobile();
  const [isUpdating, setIsUpdating] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    language: "English"
  });

  const [notifications, setNotifications] = useState({
    assignments: true,
    attendance: true,
    grades: true,
    messages: true,
  });

  // ─── DATA SYNCHRONIZATION ───
  useEffect(() => {
    if (!studentData?.id) return;

    // Listen to real-time changes in the student/parent profile
    const unsub = onSnapshot(doc(db, "students", studentData.id), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            setProfileForm({
                name: data.name || "",
                email: data.email || "",
                phone: data.phone || "",
                language: data.language || "English"
            });
            if (data.notifications) setNotifications(data.notifications);
        }
    });

    return () => unsub();
  }, [studentData?.id]);

  const toggleNotification = async (key: keyof typeof notifications) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    
    // Auto-save to vault
    try {
        const docRef = doc(db, "students", studentData.id);
        await updateDoc(docRef, { notifications: updated });
    } catch (e) {
        console.error("Auto-sync failed", e);
    }
  };

  const handleUpdateProfile = async () => {
    if (!profileForm.name.trim()) return toast.error("Institutional Name Required");

    setIsUpdating(true);
    try {
      const docRef = doc(db, "students", studentData.id);
      await updateDoc(docRef, {
        name: profileForm.name,
        phone: profileForm.phone,
        language: profileForm.language
      });
      toast.success("Profile Authenticated & Synchronized");
    } catch (error: any) {
      toast.error("Synchronization Interrupted");
    } finally {
      setIsUpdating(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     MOBILE — Bright Blue Apple UI
     ═══════════════════════════════════════════════════════════════ */
  if (isMobile) {
    const B1 = "#0055FF", B2 = "#1166FF", B3 = "#2277FF", B4 = "#4499FF";
    const BG = "#EEF4FF";
    const T1 = "#001040", T2 = "#002080", T3 = "#5070B0", T4 = "#99AACC";
    const SEP = "rgba(0,85,255,0.07)";
    const GREEN = "#00C853", GREEN_D = "#007830", GREEN_S = "rgba(0,200,83,0.10)", GREEN_B = "rgba(0,200,83,0.22)";
    const RED = "#FF3355";
    const GOLD = "#FFAA00";
    const SH = "0 0 0 0.5px rgba(0,85,255,0.08), 0 2px 8px rgba(0,85,255,0.08), 0 10px 26px rgba(0,85,255,0.10)";
    const SH_LG = "0 0 0 0.5px rgba(0,85,255,0.10), 0 4px 16px rgba(0,85,255,0.11), 0 18px 44px rgba(0,85,255,0.13)";
    const SH_BTN = "0 6px 22px rgba(0,85,255,0.42), 0 2px 6px rgba(0,85,255,0.22)";

    const firstInitial = profileForm.name?.[0]?.toUpperCase() || "G";
    const shortId = (studentData?.id || "").substring(0, 8).toUpperCase();
    const studentInitial = studentData?.name?.[0]?.toUpperCase() || "S";

    // iOS-style toggle
    const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
      <div
        onClick={onClick}
        className="cursor-pointer flex-shrink-0 relative"
        style={{
          width: 44, height: 26, borderRadius: 13,
          background: on ? `linear-gradient(135deg, ${GREEN}, #22EE66)` : "rgba(0,0,0,0.10)",
          boxShadow: on ? "0 2px 8px rgba(0,200,83,0.24)" : "none",
          transition: "background 0.2s",
        }}
      >
        <div
          style={{
            position: "absolute", top: 2, left: on ? 20 : 2,
            width: 22, height: 22, borderRadius: "50%", background: "#fff",
            boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
            transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        />
      </div>
    );

    const toggles: { key: keyof typeof notifications; title: string; sub: string; icon: any; grad: string; shadow: string }[] = [
      { key: "assignments", title: "Scholastic Deadlines", sub: "AI Reminders for upcoming assignments", icon: Zap,         grad: `linear-gradient(135deg, ${B1}, ${B2})`,       shadow: "0 3px 10px rgba(0,85,255,0.28)" },
      { key: "attendance",  title: "Real-Time Presence",   sub: "Immediate alerts for attendance logs",  icon: Users,       grad: `linear-gradient(135deg, #0033CC, ${B3})`,     shadow: "0 3px 10px rgba(0,51,204,0.28)" },
      { key: "grades",      title: "Scholastic Results",   sub: "Notification upon new grade entry",     icon: BarChart3,   grad: `linear-gradient(135deg, #1155EE, ${B4})`,     shadow: "0 3px 10px rgba(17,85,238,0.28)" },
      { key: "messages",    title: "Faculty Direct",       sub: "Secure messages from teaching staff",   icon: MessageSquare, grad: `linear-gradient(135deg, #002DBB, ${B1})`,   shadow: "0 3px 10px rgba(0,45,187,0.28)" },
    ];

    return (
      <div className="animate-in fade-in duration-500 -mx-3 -mt-3 md:mx-0 md:mt-0"
        style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", background: BG, minHeight: "100vh" }}>

        {/* ── System Badge ── */}
        <div className="mx-5 mt-3 flex items-center gap-[10px] px-4 py-3 rounded-[18px] relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: SH_BTN }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 52%)" }} />
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }} />
          <div className="w-[38px] h-[38px] rounded-[12px] flex items-center justify-center shrink-0 relative z-10"
            style={{ background: "rgba(255,255,255,0.20)", border: "0.5px solid rgba(255,255,255,0.28)", WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)" }}>
            <Settings className="w-5 h-5" style={{ color: "rgba(255,255,255,0.95)" }} strokeWidth={2.1} />
          </div>
          <div className="relative z-10">
            <div className="text-[8px] font-bold uppercase tracking-[0.12em] mb-[3px]" style={{ color: "rgba(255,255,255,0.55)" }}>Institutional Portal Registry</div>
            <div className="flex items-center gap-[5px] text-[11px] font-bold text-white">
              <span className="w-[6px] h-[6px] rounded-full animate-pulse" style={{ background: "#00EE88", boxShadow: "0 0 0 2px rgba(0,238,136,0.20)" }} />
              Settings Sync Active
            </div>
          </div>
        </div>

        {/* ── Page Head ── */}
        <div className="px-5 pt-4">
          <div className="text-[28px] font-bold mb-1" style={{ color: T1, letterSpacing: "-0.7px" }}>Portal Preferences</div>
          <div className="text-[12px] font-normal leading-[1.6]" style={{ color: T3 }}>
            Manage your parental profile and predictive intelligence alerts.
          </div>
        </div>

        {/* ── Identity Status Card ── */}
        <div className="mx-5 mt-4 bg-white rounded-[20px] px-[18px] py-4 flex items-center gap-[14px] relative overflow-hidden"
          style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
          <div className="absolute -top-5 -right-4 w-[90px] h-[90px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(0,200,83,0.07) 0%, transparent 70%)" }} />
          <div className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0"
            style={{ background: GREEN_S, border: `0.5px solid ${GREEN_B}` }}>
            <ShieldCheck className="w-[22px] h-[22px]" style={{ color: GREEN }} strokeWidth={2.2} />
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.10em] mb-1" style={{ color: T4 }}>Identity Status</div>
            <div className="text-[16px] font-bold" style={{ color: GREEN, letterSpacing: "-0.2px" }}>Verified Guardian</div>
          </div>
        </div>

        {/* ── Account Identity Matrix ── */}
        <div className="mx-5 mt-3 bg-white rounded-[24px] p-5 relative overflow-hidden"
          style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
          <div className="absolute -top-[34px] -right-[24px] w-[130px] h-[130px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(0,85,255,0.05) 0%, transparent 70%)" }} />

          <div className="flex items-center gap-2 mb-5 relative z-10">
            <div className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center"
              style={{ background: "rgba(255,51,85,0.10)", border: "0.5px solid rgba(255,51,85,0.20)" }}>
              <Heart className="w-[14px] h-[14px]" style={{ color: RED }} strokeWidth={2.5} />
            </div>
            <div className="text-[11px] font-bold uppercase tracking-[0.09em]" style={{ color: T2 }}>Account Identity Matrix</div>
          </div>

          {/* Avatar */}
          <div className="flex flex-col items-center gap-3 mb-[18px] relative z-10">
            <div className="relative">
              <div className="w-20 h-20 rounded-[26px] flex items-center justify-center text-[30px] font-bold text-white"
                style={{
                  background: `linear-gradient(140deg, ${B1}, ${B2})`,
                  boxShadow: `${SH_BTN}, 0 0 0 4px rgba(255,255,255,0.85)`,
                }}>
                {firstInitial}
              </div>
              <button className="absolute -bottom-1 -right-1 w-[26px] h-[26px] rounded-[9px] flex items-center justify-center"
                style={{ background: "#fff", border: "2px solid rgba(0,85,255,0.16)", boxShadow: SH }}>
                <Camera className="w-[13px] h-[13px]" style={{ color: "rgba(0,85,255,0.7)" }} strokeWidth={2.3} />
              </button>
            </div>
            <div className="text-[20px] font-bold" style={{ color: T1, letterSpacing: "-0.4px" }}>{profileForm.name || "Guardian"}</div>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <div className="px-[13px] py-[5px] rounded-full text-[10px] font-bold text-white tracking-[0.06em] uppercase"
                style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: "0 2px 8px rgba(0,85,255,0.26)" }}>
                Parent Guardian
              </div>
              {shortId && (
                <div className="px-[13px] py-[5px] rounded-full text-[10px] font-bold tracking-[0.06em] uppercase"
                  style={{ background: "rgba(0,85,255,0.08)", border: "0.5px solid rgba(0,85,255,0.16)", color: B1 }}>
                  ID: {shortId}
                </div>
              )}
            </div>
          </div>

          {/* Field: Authorized Name */}
          <div className="mb-[14px] relative z-10">
            <div className="text-[9px] font-bold uppercase tracking-[0.10em] mb-[7px] pl-[2px]" style={{ color: T4 }}>Authorized Name</div>
            <div className="flex items-center gap-[10px] px-[15px] py-3 rounded-[15px]"
              style={{ background: BG, border: "0.5px solid rgba(0,85,255,0.12)" }}>
              <User className="w-[15px] h-[15px]" style={{ color: "rgba(0,85,255,0.5)" }} strokeWidth={2.2} />
              <input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="flex-1 bg-transparent outline-none text-[14px] font-semibold"
                style={{ color: T1, letterSpacing: "-0.1px", fontFamily: "inherit" }}
              />
            </div>
          </div>

          {/* Field: Primary Email (readonly) */}
          <div className="mb-[14px] relative z-10">
            <div className="text-[9px] font-bold uppercase tracking-[0.10em] mb-[7px] pl-[2px]" style={{ color: T4 }}>Primary Email</div>
            <div className="flex items-center gap-[10px] px-[15px] py-3 rounded-[15px] opacity-80"
              style={{ background: BG, border: "0.5px solid rgba(0,85,255,0.12)" }}>
              <Mail className="w-[15px] h-[15px]" style={{ color: "rgba(0,85,255,0.5)" }} strokeWidth={2.2} />
              <span className="flex-1 text-[12px] font-semibold truncate" style={{ color: T1 }}>{profileForm.email || "—"}</span>
            </div>
          </div>

          {/* Field: Contact Line */}
          <div className="mb-[14px] relative z-10">
            <div className="text-[9px] font-bold uppercase tracking-[0.10em] mb-[7px] pl-[2px]" style={{ color: T4 }}>Contact Line</div>
            <div className="flex items-center gap-[10px] px-[15px] py-3 rounded-[15px]"
              style={{ background: BG, border: "0.5px solid rgba(0,85,255,0.12)" }}>
              <Phone className="w-[15px] h-[15px]" style={{ color: "rgba(0,85,255,0.5)" }} strokeWidth={2.2} />
              <input
                type="tel"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                placeholder="+00 000 000 00"
                className="flex-1 bg-transparent outline-none text-[14px] font-semibold placeholder:font-normal"
                style={{ color: T1, letterSpacing: "-0.1px", fontFamily: "inherit" }}
              />
            </div>
          </div>

          {/* Field: Interface Locality */}
          <div className="mb-4 relative z-10">
            <div className="text-[9px] font-bold uppercase tracking-[0.10em] mb-[7px] pl-[2px]" style={{ color: T4 }}>Interface Locality</div>
            <div className="flex items-center gap-[10px] px-[15px] py-3 rounded-[15px]"
              style={{ background: BG, border: "0.5px solid rgba(0,85,255,0.12)" }}>
              <Globe className="w-[15px] h-[15px]" style={{ color: "rgba(0,85,255,0.5)" }} strokeWidth={2.2} />
              <select
                value={profileForm.language}
                onChange={(e) => setProfileForm({ ...profileForm, language: e.target.value })}
                className="flex-1 bg-transparent outline-none text-[14px] font-semibold appearance-none cursor-pointer"
                style={{ color: T1, letterSpacing: "-0.1px", fontFamily: "inherit" }}
              >
                <option value="English">ENG: Institutional English</option>
                <option value="Hindi">HIN: Northern Dialect</option>
                <option value="Urdu">URD: Standard Urdu</option>
              </select>
              <ChevronRight className="w-[14px] h-[14px] rotate-90" style={{ color: "rgba(0,85,255,0.4)" }} strokeWidth={2.5} />
            </div>
          </div>

          {/* Commit Button */}
          <button
            onClick={handleUpdateProfile}
            disabled={isUpdating}
            className="w-full h-[52px] mt-5 rounded-[17px] flex items-center justify-center gap-2 text-[14px] font-bold text-white uppercase tracking-[0.08em] disabled:opacity-50 relative overflow-hidden active:scale-[0.97] transition-transform z-10"
            style={{
              background: "linear-gradient(135deg, #001040, #002080)",
              boxShadow: "0 6px 22px rgba(0,8,64,0.32), 0 2px 6px rgba(0,8,64,0.18)",
              transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)"
            }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 52%)" }} />
            {isUpdating
              ? <Loader2 className="w-4 h-4 animate-spin relative z-10" />
              : <Zap className="w-4 h-4 relative z-10" style={{ color: "rgba(255,170,0,0.9)" }} strokeWidth={2.5} />}
            <span className="relative z-10">{isUpdating ? "Synchronizing Vault…" : "Commit Changes"}</span>
          </button>
        </div>

        {/* ── Section: Intelligence Alerts ── */}
        <div className="flex items-center gap-[10px] px-5 pt-5">
          <div className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: "0 2px 8px rgba(0,85,255,0.26)" }}>
            <Bell className="w-[18px] h-[18px] text-white" strokeWidth={2.2} />
          </div>
          <div className="text-[11px] font-bold uppercase tracking-[0.10em]" style={{ color: T2 }}>Intelligence Alerts Matrix</div>
        </div>

        {/* Toggles */}
        {toggles.map(t => {
          const Icon = t.icon;
          const on = !!notifications[t.key];
          return (
            <div key={t.key}
              className="mx-5 mt-[10px] bg-white rounded-[22px] px-[18px] py-[18px] relative overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
              style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)", transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)" }}
              onClick={() => toggleNotification(t.key)}>
              <div className="absolute -top-6 -right-[18px] w-[90px] h-[90px] rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(0,85,255,0.04) 0%, transparent 70%)" }} />
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-[13px] flex items-center justify-center shrink-0"
                    style={{ background: t.grad, boxShadow: t.shadow }}>
                    <Icon className="w-5 h-5 text-white" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold uppercase tracking-[0.04em] mb-[3px]" style={{ color: T1 }}>{t.title}</div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.04em] truncate" style={{ color: T4 }}>{t.sub}</div>
                  </div>
                </div>
                <div className="pt-[2px]">
                  <Toggle on={on} onClick={() => toggleNotification(t.key)} />
                </div>
              </div>
            </div>
          );
        })}

        {/* ── Institutional Link Card ── */}
        <div className="mx-5 mt-4 rounded-[26px] px-[22px] py-6 relative overflow-hidden"
          style={{
            background: "linear-gradient(140deg, #001040 0%, #001888 40%, #0033CC 80%, #0055FF 100%)",
            boxShadow: "0 10px 36px rgba(0,8,64,0.35), 0 0 0 0.5px rgba(255,255,255,0.14)",
          }}>
          <div className="absolute -top-10 -right-7 w-[180px] h-[180px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 65%)" }} />
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }} />

          <div className="inline-flex items-center gap-[6px] px-3 py-[5px] rounded-full text-[9px] font-bold uppercase tracking-[0.10em] mb-5 relative z-10"
            style={{ background: "rgba(255,255,255,0.16)", border: "0.5px solid rgba(255,255,255,0.26)", color: "rgba(255,255,255,0.70)", WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)" }}>
            <Sparkles className="w-[11px] h-[11px]" strokeWidth={2.5} />
            Institutional Link
          </div>

          <div className="flex flex-col items-center gap-3 mb-[22px] relative z-10">
            <div className="w-[74px] h-[74px] rounded-[24px] flex items-center justify-center text-[28px] font-bold"
              style={{ background: "rgba(255,255,255,0.92)", color: B1, boxShadow: "0 4px 20px rgba(0,0,0,0.22), 0 0 0 3px rgba(255,255,255,0.20)" }}>
              {studentInitial}
            </div>
            <div className="text-center">
              <div className="text-[20px] font-bold text-white" style={{ letterSpacing: "-0.4px" }}>{studentData?.name || "Student"}</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>Grade Subdivision Matrix</div>
            </div>
          </div>

          <div className="rounded-[16px] overflow-hidden relative z-10" style={{ background: "rgba(255,255,255,0.08)" }}>
            {[
              { lbl: "Roll No", val: studentData?.rollNo || "—" },
              { lbl: "Sync ID", val: (studentData?.id || "").substring(0, 8) || "—" },
              { lbl: "Class",   val: studentData?.className ? `${studentData.className}${(studentData as any)?.section ? ` · ${(studentData as any).section}` : ""}` : studentData?.grade ? `Grade ${studentData.grade}` : "—" },
              { lbl: "Year",    val: "2025 – 26" },
            ].map((row, i, arr) => (
              <div key={row.lbl} className="flex items-center justify-between px-4 py-[13px]"
                style={{ borderBottom: i < arr.length - 1 ? "0.5px solid rgba(255,255,255,0.08)" : "none" }}>
                <span className="text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "rgba(255,255,255,0.40)" }}>{row.lbl}</span>
                <span className="text-[13px] font-bold text-white truncate max-w-[60%] text-right" style={{ letterSpacing: "-0.1px" }}>{row.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Security Ops Card ── */}
        <div className="mx-5 mt-3 bg-white rounded-[22px] px-5 py-[18px]"
          style={{ boxShadow: SH_LG, border: "0.5px solid rgba(0,85,255,0.10)" }}>
          <div className="flex items-center gap-[10px] mb-[14px]">
            <div className="w-9 h-9 rounded-[12px] flex items-center justify-center"
              style={{ background: "rgba(0,85,255,0.10)", border: "0.5px solid rgba(0,85,255,0.18)" }}>
              <Lock className="w-[18px] h-[18px]" style={{ color: B1 }} strokeWidth={2.2} />
            </div>
            <div className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: T2 }}>Security Ops</div>
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] leading-[1.7] mb-[14px]" style={{ color: T3 }}>
            Encryption and access controls are managed by the institutional administrator.
          </div>

          {[
            { name: "Biometric Key",   sub: "Authorized Device",       right: null as any },
            { name: "Two-Factor Auth", sub: "SMS verification enabled", right: "ON" },
            { name: "Data Privacy",    sub: "GDPR compliant storage",   right: null as any },
          ].map((row, i, arr) => (
            <div key={row.name} className="flex items-center justify-between py-[13px] cursor-pointer active:opacity-70"
              style={{ borderTop: `0.5px solid ${SEP}`, paddingBottom: i === arr.length - 1 ? 0 : 13 }}>
              <div className="flex flex-col gap-[3px]">
                <div className="text-[13px] font-bold" style={{ color: T1, letterSpacing: "-0.1px" }}>{row.name}</div>
                <div className="text-[11px] font-medium" style={{ color: T4 }}>{row.sub}</div>
              </div>
              <div className="flex items-center gap-2">
                {row.right === "ON" && (
                  <div className="px-[9px] py-[3px] rounded-full text-[9px] font-bold tracking-[0.06em]"
                    style={{ background: GREEN_S, border: `0.5px solid ${GREEN_B}`, color: GREEN_D }}>
                    ON
                  </div>
                )}
                <div className="w-7 h-7 rounded-[9px] flex items-center justify-center"
                  style={{ background: "rgba(0,85,255,0.08)", border: "0.5px solid rgba(0,85,255,0.14)" }}>
                  <ChevronRight className="w-[13px] h-[13px]" style={{ color: "rgba(0,85,255,0.55)" }} strokeWidth={2.5} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Final Commit Button */}
        <button
          onClick={handleUpdateProfile}
          disabled={isUpdating}
          className="mx-5 mt-4 mb-2 w-[calc(100%-40px)] h-[52px] rounded-[17px] flex items-center justify-center gap-2 text-[14px] font-bold text-white uppercase tracking-[0.08em] disabled:opacity-50 relative overflow-hidden active:scale-[0.97] transition-transform"
          style={{
            background: "linear-gradient(135deg, #001040, #002080)",
            boxShadow: "0 6px 22px rgba(0,8,64,0.32), 0 2px 6px rgba(0,8,64,0.18)",
            transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)"
          }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 52%)" }} />
          {isUpdating
            ? <Loader2 className="w-4 h-4 animate-spin relative z-10" />
            : <Zap className="w-4 h-4 relative z-10" style={{ color: GOLD }} strokeWidth={2.5} />}
          <span className="relative z-10">{isUpdating ? "Synchronizing Vault…" : "Commit Changes"}</span>
        </button>

        <div className="h-6" />
        {/* Keep icons reserved for scoped visibility */}
        <span className="hidden">
          <Smartphone /><ShieldAlert /><CheckCircle2 />
        </span>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     DESKTOP — Existing UI (unchanged)
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000 pb-24 text-left font-sans">

      {/* ─── HEADER ─── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10 mb-8 md:mb-20 px-0 md:px-4">
        <div className="text-left w-full md:w-auto">
           <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-[1.5rem] bg-[#1e3a8a] flex items-center justify-center text-white shadow-xl shadow-blue-200">
                 <Settings size={26} />
              </div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">Institutional Portal Registry</p>
                 <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border-2 border-white shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest leading-none">Settings Sync Active</p>
                 </div>
              </div>
           </div>
           <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-slate-900 tracking-tighter leading-none mb-4">Portal Preferences</h1>
           <p className="text-sm md:text-xl font-bold text-slate-400 italic">Manage your parental profile and predictive intelligence alerts.</p>
        </div>
        
        <div className="flex bg-white border border-slate-100 p-4 rounded-[2.5rem] shadow-sm items-center gap-6 group hover:shadow-2xl transition-all">
           <div className="w-16 h-16 rounded-[1.8rem] bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner group-hover:rotate-12 transition-transform">
              <ShieldCheck size={30} />
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Identity Status</p>
              <p className="text-xl font-black text-[#1e3a8a] uppercase tracking-tighter">Verified Guardian</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-12 px-0 md:px-2">
         
         {/* LEFT: CORE PROFILE */}
         <div className="lg:col-span-8 flex flex-col gap-12">
            <div className="bg-white border border-slate-100 rounded-[2rem] md:rounded-[4.5rem] p-6 md:p-12 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all">
               <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 group-hover:-rotate-12 transition-transform duration-1000">
                  <User className="w-48 h-48 text-[#1e3a8a]" />
               </div>

               <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-6 md:mb-12">
                     <div className="w-14 h-14 rounded-[2rem] bg-indigo-50 flex items-center justify-center text-[#1e3a8a] shadow-inner">
                        <Heart size={28} />
                     </div>
                     <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Account Identity Matrix</h3>
                  </div>

                  <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 mb-8 md:mb-16">
                     <div className="relative">
                        <div className="w-32 h-32 rounded-[3.5rem] bg-gradient-to-br from-[#1e3a8a] to-blue-900 border-8 border-white shadow-2xl flex items-center justify-center text-white font-black text-4xl italic overflow-hidden group/avatar">
                           <div className="absolute inset-0 bg-black/20 translate-y-full group-hover/avatar:translate-y-0 transition-transform duration-500" />
                           <span className="relative z-10">{profileForm.name?.[0] || 'G'}</span>
                        </div>
                        <button className="absolute -bottom-2 -right-2 w-12 h-12 rounded-[1.5rem] bg-white border-4 border-white shadow-xl flex items-center justify-center text-indigo-600 hover:scale-110 transition-all active:scale-95">
                           <Camera size={20} />
                        </button>
                     </div>
                     <div className="text-center md:text-left">
                        <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter mb-2">{profileForm.name}</h2>
                        <div className="flex flex-wrap justify-center md:justify-start gap-3">
                           <span className="px-4 py-1.5 bg-indigo-50 text-indigo-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-indigo-100 italic">Parent Guardian</span>
                           <span className="px-4 py-1.5 bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-full italic">ID: {studentData?.id?.substring(0,8).toUpperCase()}</span>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-10">
                     <SettingsInput label="Authorized Name" value={profileForm.name} onChange={(v) => setProfileForm({...profileForm, name: v})} icon={User} />
                     <SettingsInput label="Primary Email" value={profileForm.email} disabled icon={Mail} />
                     <SettingsInput label="Contact Line" value={profileForm.phone} onChange={(v) => setProfileForm({...profileForm, phone: v})} placeholder="+00 000 000 00" icon={Phone} />
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] pl-2 leading-none">Interface Locality</label>
                        <div className="flex items-center gap-4 bg-slate-50/50 rounded-[2rem] px-8 py-5 border border-slate-100 focus-within:ring-4 focus-within:ring-indigo-100/50 transition-all">
                           <Globe className="w-5 h-5 text-slate-400" />
                           <select 
                              value={profileForm.language}
                              onChange={(e) => setProfileForm({...profileForm, language: e.target.value})}
                              className="bg-transparent border-none outline-none text-base font-black text-slate-800 w-full appearance-none cursor-pointer"
                           >
                              <option value="English">ENG: Institutional English</option>
                              <option value="Hindi">HIN: Northern Dialect</option>
                              <option value="Urdu">URD: Standard Urdu</option>
                           </select>
                        </div>
                     </div>
                  </div>

                  <div className="mt-8 md:mt-16 pt-6 md:pt-12 border-t border-slate-50 flex justify-end">
                     <button
                        onClick={handleUpdateProfile}
                        disabled={isUpdating}
                        className="h-14 md:h-20 px-8 md:px-12 bg-[#1e3a8a] text-white rounded-[1.5rem] md:rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.3em] flex items-center gap-3 md:gap-4 shadow-xl md:shadow-2xl shadow-blue-900/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
                     >
                        {isUpdating ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} className="text-amber-400" />}
                        {isUpdating ? "Synchronizing Vault..." : "Commit Changes"}
                     </button>
                  </div>
               </div>
            </div>

            {/* NOTIFICATIONS MATRIX */}
            <div className="bg-white border border-slate-100 rounded-[2rem] md:rounded-[4.5rem] p-6 md:p-12 shadow-sm text-left">
               <div className="flex items-center gap-4 mb-6 md:mb-12">
                  <div className="w-14 h-14 rounded-[2rem] bg-amber-50 flex items-center justify-center text-amber-500 shadow-inner">
                     <Bell size={28} />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Intelligence Alerts Matrix</h3>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
                  <NotificationToggle label="Scholastic Deadlines" desc="AI reminders for upcoming assignments" active={notifications.assignments} onToggle={() => toggleNotification('assignments')} />
                  <NotificationToggle label="Real-time Presence" desc="Immediate alerts for attendance logs" active={notifications.attendance} onToggle={() => toggleNotification('attendance')} />
                  <NotificationToggle label="Scholastic Results" desc="Notification upon new grade entry" active={notifications.grades} onToggle={() => toggleNotification('grades')} />
                  <NotificationToggle label="Faculty Direct" desc="Secure messages from teaching staff" active={notifications.messages} onToggle={() => toggleNotification('messages')} />
               </div>
            </div>
         </div>

         {/* RIGHT SIDE: SECURITY & STUDENT CARD */}
         <div className="lg:col-span-4 flex flex-col gap-6 md:gap-12">
            <div className="bg-slate-900 rounded-[2rem] md:rounded-[4.5rem] p-6 md:p-12 text-white shadow-2xl relative overflow-hidden group">
               <ShieldAlert className="absolute -right-8 -bottom-8 w-48 h-48 text-white/5 group-hover:scale-110 transition-transform duration-700" />
               <div className="flex items-center gap-4 mb-12 relative z-10">
                  <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Institutional Link</h3>
               </div>
               
               <div className="flex flex-col items-center text-center relative z-10">
                  <div className="w-24 h-24 rounded-[2.5rem] bg-white text-[#1e3a8a] flex items-center justify-center font-black text-3xl shadow-2xl mb-6">
                     {studentData?.name?.[0] || 'S'}
                  </div>
                  <h4 className="text-2xl font-black tracking-tighter mb-2">{studentData?.name}</h4>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 italic">Grade {studentData?.grade} Subdivision Matrix</p>
                  
                  <div className="w-full mt-10 pt-10 border-t border-white/5 space-y-4">
                     <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <span>Roll No</span>
                        <span className="text-white">{studentData?.rollNo || '001'}</span>
                     </div>
                     <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <span>Sync ID</span>
                        <span className="text-white">{studentData?.id?.substring(0,8)}</span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[2rem] md:rounded-[4.5rem] p-6 md:p-10 shadow-sm relative overflow-hidden group text-left">
               <div className="flex items-center gap-4 mb-10">
                  <Lock className="w-6 h-6 text-[#1e3a8a]" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Security Ops</h3>
               </div>
               
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed mb-10">
                  Encryption and access controls are managed by the institutional administrator.
               </p>

               <div className="space-y-6">
                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex items-center justify-between group/cell hover:bg-white hover:shadow-xl transition-all">
                     <div>
                        <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Biometric Key</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authorized Device</p>
                     </div>
                     <ChevronRight className="w-5 h-5 text-slate-200 group-hover/cell:translate-x-2 transition-transform" />
                  </div>
                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex items-center justify-between opacity-40">
                     <div>
                        <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Quantum Shield</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Monitoring</p>
                     </div>
                     <Smartphone className="w-5 h-5 text-slate-200" />
                  </div>
               </div>
            </div>
         </div>

      </div>
    </div>
  );
};

const SettingsInput = ({ label, value, onChange, disabled, icon: Icon, placeholder }: any) => (
  <div className="space-y-4 text-left">
    <label className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] pl-2 leading-none">{label}</label>
    <div className={`flex items-center gap-5 bg-slate-50/50 rounded-[2rem] px-8 py-5 border border-slate-100 transition-all ${disabled ? 'opacity-50' : 'focus-within:ring-4 focus-within:ring-indigo-100/50'}`}>
      <Icon className="w-5 h-5 text-slate-400" />
      <input 
        type="text" 
        value={value} 
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="bg-transparent border-none outline-none text-base font-black text-slate-800 w-full placeholder:text-slate-200"
      />
    </div>
  </div>
);

const NotificationToggle = ({ label, desc, active, onToggle }: any) => (
  <button onClick={onToggle} className={`p-5 md:p-8 rounded-[1.5rem] md:rounded-[3rem] border transition-all text-left flex flex-col justify-between min-h-[140px] md:h-48 gap-4 group ${active ? 'bg-indigo-50 border-indigo-100 shadow-indigo-100/50' : 'bg-slate-50 border-slate-100'}`}>
    <div className="flex justify-between items-start w-full">
       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-300'}`}>
          <Zap size={22} className={active ? 'animate-pulse' : ''} />
       </div>
       <div className={`w-12 h-6 rounded-full transition-all relative ${active ? 'bg-emerald-500' : 'bg-slate-200'}`}>
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${active ? 'translate-x-7' : 'translate-x-1'}`} />
       </div>
    </div>
    <div className="mt-4">
       <p className={`text-base font-black uppercase tracking-tight leading-none mb-1 ${active ? 'text-[#1e3a8a]' : 'text-slate-400'}`}>{label}</p>
       <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{desc}</p>
    </div>
  </button>
);

export default SettingsPage;
