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
import { useSchoolSettings, resolveAcademicYear } from "@/hooks/useSchoolSettings";

const SettingsPage = () => {
  const { studentData } = useAuth();
  const isMobile = useIsMobile();
  const settings = useSchoolSettings();
  const academicYear = resolveAcademicYear(settings);
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
              { lbl: "Year",    val: academicYear },
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
     DESKTOP — Bright Blue Apple UI + 3D hover cards
     ═══════════════════════════════════════════════════════════════ */
  const B1 = "#0055FF", B2 = "#1166FF", B3 = "#2277FF";
  const BG_D = "#EEF4FF";
  const T1 = "#001040", T2 = "#002080", T3 = "#5070B0", T4 = "#99AACC";
  const GREEN = "#00C853", GREEN_D_COL = "#007830";
  const RED = "#FF3355";
  const GOLD = "#FFAA00";
  const BLUE_BDR = "rgba(0,85,255,0.12)";
  const SH_D = "0 0 0 0.5px rgba(0,85,255,0.08), 0 2px 8px rgba(0,85,255,0.09), 0 10px 28px rgba(0,85,255,0.11)";
  const SH_LG_D = "0 0 0 0.5px rgba(0,85,255,0.10), 0 4px 16px rgba(0,85,255,0.12), 0 18px 44px rgba(0,85,255,0.14)";
  const SH_BTN_D = "0 6px 22px rgba(0,85,255,0.42), 0 2px 6px rgba(0,85,255,0.22)";

  const firstInitialD = profileForm.name?.[0]?.toUpperCase() || "G";
  const shortIdD = (studentData?.id || "").substring(0, 8).toUpperCase();
  const studentInitialD = studentData?.name?.[0]?.toUpperCase() || "S";

  // 3D tilt handlers
  const handle3DEnter = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    el.style.transition = "transform 0.06s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.2s ease";
  };
  const handle3DMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotX = (((y / rect.height) - 0.5) * -7).toFixed(2);
    const rotY = (((x / rect.width) - 0.5) * 7).toFixed(2);
    el.style.transform = `perspective(1100px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-3px) scale(1.006)`;
    const glow = el.querySelector<HTMLDivElement>('[data-glow]');
    if (glow) {
      glow.style.opacity = "1";
      glow.style.background = `radial-gradient(420px circle at ${x}px ${y}px, rgba(0,85,255,0.13), transparent 45%)`;
    }
  };
  const handle3DLeave = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    el.style.transition = "transform 0.5s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.3s ease";
    el.style.transform = "perspective(1100px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)";
    const glow = el.querySelector<HTMLDivElement>('[data-glow]');
    if (glow) glow.style.opacity = "0";
  };

  // iOS-style toggle
  const ToggleD = ({ on, onClick }: { on: boolean; onClick: (e: React.MouseEvent) => void }) => (
    <div onClick={onClick}
      className="cursor-pointer flex-shrink-0 relative"
      style={{
        width: 50, height: 29, borderRadius: 15,
        background: on ? `linear-gradient(135deg, ${GREEN}, #22EE66)` : "rgba(0,0,0,0.10)",
        boxShadow: on ? "0 2px 8px rgba(0,200,83,0.28)" : "none",
        transition: "background 0.2s",
      }}>
      <div style={{
        position: "absolute", top: 2, left: on ? 23 : 2,
        width: 25, height: 25, borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 5px rgba(0,0,0,0.18)",
        transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
      }} />
    </div>
  );

  const togglesD: { key: keyof typeof notifications; title: string; sub: string; icon: any; grad: string; shadow: string; glow: string }[] = [
    { key: "assignments", title: "Scholastic Deadlines", sub: "AI reminders for upcoming assignments", icon: Zap, grad: `linear-gradient(135deg, ${B1}, ${B2})`, shadow: "0 3px 10px rgba(0,85,255,0.28)", glow: "rgba(0,85,255,0.08)" },
    { key: "attendance", title: "Real-Time Presence", sub: "Immediate alerts for attendance logs", icon: Users, grad: `linear-gradient(135deg, ${GREEN}, #22EE66)`, shadow: "0 3px 10px rgba(0,200,83,0.28)", glow: "rgba(0,200,83,0.08)" },
    { key: "grades", title: "Scholastic Results", sub: "Notification upon new grade entry", icon: BarChart3, grad: "linear-gradient(135deg, #6B21E8, #A87FF8)", shadow: "0 3px 10px rgba(107,33,232,0.28)", glow: "rgba(107,33,232,0.08)" },
    { key: "messages", title: "Faculty Direct", sub: "Secure messages from teaching staff", icon: MessageSquare, grad: "linear-gradient(135deg, #FF8800, #FFCC22)", shadow: "0 3px 10px rgba(255,136,0,0.28)", glow: "rgba(255,136,0,0.08)" },
  ];

  const activeCount = Object.values(notifications).filter(Boolean).length;

  return (
    <div className="animate-in fade-in duration-500 -m-4 sm:-m-6 md:-m-8 min-h-[calc(100vh-64px)]"
      style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", background: BG_D }}>
      <div className="w-full px-6 pt-8 pb-12">

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-1 flex items-center gap-[7px]" style={{ color: T4 }}>
              <span className="w-[6px] h-[6px] rounded-full animate-pulse" style={{ background: GREEN, boxShadow: "0 0 0 3px rgba(0,200,83,0.2)" }} />
              Parent Dashboard · Settings
            </div>
            <h1 className="text-[32px] font-bold leading-none" style={{ color: T1, letterSpacing: "-0.8px" }}>Portal Preferences</h1>
            <div className="text-[13px] font-normal mt-[6px]" style={{ color: T3 }}>Manage your parental profile and predictive intelligence alerts</div>
          </div>
          <div className="flex items-center gap-[10px]">
            <div className="px-[14px] py-[8px] rounded-full text-[12px] font-bold flex items-center gap-[6px]"
              style={{ background: "rgba(0,200,83,0.08)", color: GREEN_D_COL, border: "0.5px solid rgba(0,200,83,0.22)" }}>
              <ShieldCheck className="w-[12px] h-[12px]" strokeWidth={2.5} />
              Verified Guardian
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white"
              style={{ background: `linear-gradient(140deg, ${B1}, ${B2})`, boxShadow: "0 3px 12px rgba(0,85,255,0.36), 0 0 0 2px rgba(255,255,255,0.8)" }}>
              {(studentData?.name?.[0] || "S").toUpperCase()}
            </div>
          </div>
        </div>

        {/* ── Quick Stats Row (3D hover) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5" style={{ perspective: "1200px" }}>
          {[
            { label: "Identity", val: "Verified", color: GREEN, icon: ShieldCheck, grad: `linear-gradient(135deg, ${GREEN}, #22EE66)`, sh: "0 3px 10px rgba(0,200,83,0.28)", glow: "rgba(0,200,83,0.09)" },
            { label: "Alerts On", val: `${activeCount}/4`, color: B1, icon: Bell, grad: `linear-gradient(135deg, ${B1}, ${B2})`, sh: "0 3px 10px rgba(0,85,255,0.28)", glow: "rgba(0,85,255,0.09)" },
            { label: "Language", val: profileForm.language.slice(0, 3).toUpperCase(), color: "#6B21E8", icon: Globe, grad: "linear-gradient(135deg, #6B21E8, #A87FF8)", sh: "0 3px 10px rgba(107,33,232,0.28)", glow: "rgba(107,33,232,0.09)" },
            { label: "Sync ID", val: shortIdD.slice(0, 5) || "—", color: "#FF8800", icon: Sparkles, grad: "linear-gradient(135deg, #FF8800, #FFCC22)", sh: "0 3px 10px rgba(255,136,0,0.28)", glow: "rgba(255,136,0,0.09)" },
          ].map(({ label, val, color, icon: Icon, grad, sh, glow }) => (
            <div key={label}
              onMouseEnter={handle3DEnter}
              onMouseMove={handle3DMove}
              onMouseLeave={handle3DLeave}
              className="bg-white rounded-[22px] px-6 py-5 relative overflow-hidden"
              style={{ boxShadow: SH_D, border: "0.5px solid rgba(0,85,255,0.10)", transformStyle: "preserve-3d", willChange: "transform" }}>
              <div data-glow className="absolute inset-0 pointer-events-none transition-opacity duration-300" style={{ opacity: 0 }} />
              <div className="absolute -top-[20px] -right-[20px] w-[100px] h-[100px] rounded-full pointer-events-none"
                style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 70%)` }} />
              <div className="flex items-center justify-between mb-3 relative">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: T4 }}>{label}</span>
                <div className="w-10 h-10 rounded-[12px] flex items-center justify-center"
                  style={{ background: grad, boxShadow: sh, transform: "translateZ(18px)" }}>
                  <Icon className="w-[18px] h-[18px] text-white" strokeWidth={2.3} />
                </div>
              </div>
              <div className="text-[26px] font-bold leading-none relative" style={{ color, letterSpacing: "-0.7px", transform: "translateZ(10px)" }}>{val}</div>
            </div>
          ))}
        </div>

        {/* ── Main Grid: Profile (col-2) + Student Card (col-1) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5" style={{ perspective: "1200px" }}>

          {/* Profile Form — spans 2 cols */}
          <div
            onMouseEnter={handle3DEnter}
            onMouseMove={handle3DMove}
            onMouseLeave={handle3DLeave}
            className="xl:col-span-2 bg-white rounded-[22px] p-8 relative overflow-hidden"
            style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(0,85,255,0.10)", transformStyle: "preserve-3d", willChange: "transform" }}>
            <div data-glow className="absolute inset-0 pointer-events-none transition-opacity duration-300" style={{ opacity: 0 }} />
            <div className="absolute -top-[50px] -right-[40px] w-[260px] h-[260px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(0,85,255,0.05) 0%, transparent 70%)" }} />

            {/* Header */}
            <div className="flex items-center gap-3 mb-6 relative z-10" style={{ transform: "translateZ(14px)" }}>
              <div className="w-12 h-12 rounded-[14px] flex items-center justify-center"
                style={{ background: "rgba(255,51,85,0.10)", border: "0.5px solid rgba(255,51,85,0.22)" }}>
                <Heart className="w-6 h-6" style={{ color: RED }} strokeWidth={2.2} />
              </div>
              <div>
                <div className="text-[17px] font-bold" style={{ color: T1, letterSpacing: "-0.3px" }}>Account Identity</div>
                <div className="text-[11px] font-normal" style={{ color: T3 }}>Verified parental profile &amp; contact</div>
              </div>
            </div>

            {/* Avatar row */}
            <div className="flex items-center gap-6 mb-8 relative z-10" style={{ transform: "translateZ(20px)" }}>
              <div className="relative">
                <div className="w-24 h-24 rounded-[28px] flex items-center justify-center text-[36px] font-bold text-white"
                  style={{ background: `linear-gradient(140deg, ${B1}, ${B2})`, boxShadow: `${SH_BTN_D}, 0 0 0 5px rgba(255,255,255,0.85)` }}>
                  {firstInitialD}
                </div>
                <button className="absolute -bottom-1 -right-1 w-9 h-9 rounded-[12px] flex items-center justify-center transition-transform hover:scale-110"
                  style={{ background: "#fff", border: `2px solid ${BLUE_BDR}`, boxShadow: SH_D }}>
                  <Camera className="w-[15px] h-[15px]" style={{ color: B1 }} strokeWidth={2.3} />
                </button>
              </div>
              <div>
                <div className="text-[26px] font-bold" style={{ color: T1, letterSpacing: "-0.6px" }}>{profileForm.name || "Guardian"}</div>
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <div className="px-[13px] py-[5px] rounded-full text-[10px] font-bold text-white tracking-[0.06em] uppercase"
                    style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: "0 2px 8px rgba(0,85,255,0.28)" }}>
                    Parent Guardian
                  </div>
                  {shortIdD && (
                    <div className="px-[13px] py-[5px] rounded-full text-[10px] font-bold tracking-[0.06em] uppercase"
                      style={{ background: "rgba(0,85,255,0.08)", border: `0.5px solid ${BLUE_BDR}`, color: B1 }}>
                      ID: {shortIdD}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Fields grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
              {/* Authorized Name */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.10em] mb-2 pl-1" style={{ color: T4 }}>Authorized Name</div>
                <div className="flex items-center gap-3 px-4 py-[11px] rounded-[14px] focus-within:ring-2 focus-within:ring-offset-2"
                  style={{ background: BG_D, border: `0.5px solid ${BLUE_BDR}` }}>
                  <User className="w-4 h-4" style={{ color: "rgba(0,85,255,0.55)" }} strokeWidth={2.3} />
                  <input type="text" value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="flex-1 bg-transparent outline-none text-[14px] font-semibold"
                    style={{ color: T1, letterSpacing: "-0.1px" }} />
                </div>
              </div>
              {/* Primary Email */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.10em] mb-2 pl-1" style={{ color: T4 }}>Primary Email</div>
                <div className="flex items-center gap-3 px-4 py-[11px] rounded-[14px] opacity-75"
                  style={{ background: BG_D, border: `0.5px solid ${BLUE_BDR}` }}>
                  <Mail className="w-4 h-4" style={{ color: "rgba(0,85,255,0.55)" }} strokeWidth={2.3} />
                  <span className="flex-1 text-[13px] font-semibold truncate" style={{ color: T1 }}>{profileForm.email || "—"}</span>
                  <Lock className="w-3 h-3" style={{ color: T4 }} strokeWidth={2.3} />
                </div>
              </div>
              {/* Contact Line */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.10em] mb-2 pl-1" style={{ color: T4 }}>Contact Line</div>
                <div className="flex items-center gap-3 px-4 py-[11px] rounded-[14px]"
                  style={{ background: BG_D, border: `0.5px solid ${BLUE_BDR}` }}>
                  <Phone className="w-4 h-4" style={{ color: "rgba(0,85,255,0.55)" }} strokeWidth={2.3} />
                  <input type="tel" value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="+00 000 000 00"
                    className="flex-1 bg-transparent outline-none text-[14px] font-semibold placeholder:font-normal"
                    style={{ color: T1, letterSpacing: "-0.1px" }} />
                </div>
              </div>
              {/* Interface Locality */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.10em] mb-2 pl-1" style={{ color: T4 }}>Interface Locality</div>
                <div className="flex items-center gap-3 px-4 py-[11px] rounded-[14px]"
                  style={{ background: BG_D, border: `0.5px solid ${BLUE_BDR}` }}>
                  <Globe className="w-4 h-4" style={{ color: "rgba(0,85,255,0.55)" }} strokeWidth={2.3} />
                  <select value={profileForm.language}
                    onChange={(e) => setProfileForm({ ...profileForm, language: e.target.value })}
                    className="flex-1 bg-transparent outline-none text-[14px] font-semibold appearance-none cursor-pointer"
                    style={{ color: T1, letterSpacing: "-0.1px" }}>
                    <option value="English">ENG · Institutional English</option>
                    <option value="Hindi">HIN · Northern Dialect</option>
                    <option value="Urdu">URD · Standard Urdu</option>
                  </select>
                  <ChevronRight className="w-4 h-4 rotate-90" style={{ color: "rgba(0,85,255,0.45)" }} strokeWidth={2.5} />
                </div>
              </div>
            </div>

            {/* Commit button */}
            <button onClick={handleUpdateProfile} disabled={isUpdating}
              className="mt-7 w-full md:w-auto md:min-w-[260px] h-14 px-8 rounded-[16px] flex items-center justify-center gap-2 text-[13px] font-bold text-white uppercase tracking-[0.06em] disabled:opacity-50 relative overflow-hidden transition-transform hover:scale-[1.02]"
              style={{
                background: `linear-gradient(135deg, ${B1}, ${B2})`,
                boxShadow: SH_BTN_D,
                letterSpacing: "0.04em",
                transform: "translateZ(16px)",
              }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 52%)" }} />
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin relative z-10" /> : <Zap className="w-4 h-4 relative z-10" style={{ color: GOLD }} strokeWidth={2.5} />}
              <span className="relative z-10">{isUpdating ? "Synchronizing Vault…" : "Commit Changes"}</span>
            </button>
          </div>

          {/* Student Card — dark blue */}
          <div
            onMouseEnter={handle3DEnter}
            onMouseMove={handle3DMove}
            onMouseLeave={handle3DLeave}
            className="rounded-[22px] p-7 relative overflow-hidden text-white"
            style={{
              background: "linear-gradient(140deg, #001040 0%, #001888 40%, #0033CC 80%, #0055FF 100%)",
              boxShadow: "0 10px 36px rgba(0,8,64,0.35), 0 0 0 0.5px rgba(255,255,255,0.14)",
              transformStyle: "preserve-3d",
              willChange: "transform",
            }}>
            <div data-glow className="absolute inset-0 pointer-events-none transition-opacity duration-300" style={{ opacity: 0 }} />
            <div className="absolute -top-10 -right-7 w-[200px] h-[200px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 65%)" }} />
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }} />
            <div className="relative z-10" style={{ transform: "translateZ(14px)" }}>
              <div className="inline-flex items-center gap-[5px] px-3 py-[5px] rounded-full text-[10px] font-bold uppercase tracking-[0.12em] mb-6"
                style={{ background: "rgba(255,255,255,0.16)", border: "0.5px solid rgba(255,255,255,0.26)", color: "rgba(255,255,255,0.80)", backdropFilter: "blur(8px)" }}>
                <Sparkles className="w-[11px] h-[11px]" strokeWidth={2.5} />
                Institutional Link
              </div>
              <div className="flex flex-col items-center gap-3 mb-6" style={{ transform: "translateZ(22px)" }}>
                <div className="w-20 h-20 rounded-[24px] flex items-center justify-center text-[32px] font-bold"
                  style={{ background: "rgba(255,255,255,0.92)", color: B1, boxShadow: "0 4px 24px rgba(0,0,0,0.22), 0 0 0 4px rgba(255,255,255,0.20)" }}>
                  {studentInitialD}
                </div>
                <div className="text-center">
                  <div className="text-[20px] font-bold text-white" style={{ letterSpacing: "-0.4px" }}>{studentData?.name || "Student"}</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] mt-1" style={{ color: "rgba(255,255,255,0.50)" }}>Grade Subdivision Matrix</div>
                </div>
              </div>
              <div className="rounded-[16px] overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                {[
                  { lbl: "Roll No", val: studentData?.rollNo || "—" },
                  { lbl: "Sync ID", val: (studentData?.id || "").substring(0, 8) || "—" },
                  { lbl: "Class", val: studentData?.className ? `${studentData.className}${(studentData as any)?.section ? ` · ${(studentData as any).section}` : ""}` : studentData?.grade ? `Grade ${studentData.grade}` : "—" },
                  { lbl: "Year", val: academicYear },
                ].map((row, i, arr) => (
                  <div key={row.lbl} className="flex items-center justify-between px-4 py-[13px]"
                    style={{ borderBottom: i < arr.length - 1 ? "0.5px solid rgba(255,255,255,0.08)" : "none" }}>
                    <span className="text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "rgba(255,255,255,0.45)" }}>{row.lbl}</span>
                    <span className="text-[13px] font-bold text-white truncate max-w-[60%] text-right" style={{ letterSpacing: "-0.1px" }}>{row.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Notifications Matrix (4-col 3D hover toggles) ── */}
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-[14px] flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${B1}, ${B2})`, boxShadow: SH_BTN_D }}>
              <Bell className="w-5 h-5 text-white" strokeWidth={2.3} />
            </div>
            <div>
              <div className="text-[17px] font-bold" style={{ color: T1, letterSpacing: "-0.3px" }}>Intelligence Alerts Matrix</div>
              <div className="text-[11px] font-normal" style={{ color: T3 }}>Toggle per-category alerts · syncs to vault instantly</div>
            </div>
            <div className="ml-auto px-[12px] py-[6px] rounded-full text-[11px] font-bold"
              style={{ background: "rgba(0,200,83,0.08)", color: GREEN_D_COL, border: "0.5px solid rgba(0,200,83,0.22)" }}>
              {activeCount} / 4 active
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" style={{ perspective: "1200px" }}>
            {togglesD.map(t => {
              const Icon = t.icon;
              const on = !!notifications[t.key];
              return (
                <div key={t.key}
                  onMouseEnter={handle3DEnter}
                  onMouseMove={handle3DMove}
                  onMouseLeave={handle3DLeave}
                  onClick={() => toggleNotification(t.key)}
                  className="bg-white rounded-[22px] p-6 relative overflow-hidden cursor-pointer"
                  style={{
                    boxShadow: on ? `${SH_LG_D}, 0 0 0 2px ${B1}` : SH_D,
                    border: "0.5px solid rgba(0,85,255,0.10)",
                    transformStyle: "preserve-3d",
                    willChange: "transform",
                  }}>
                  <div data-glow className="absolute inset-0 pointer-events-none transition-opacity duration-300" style={{ opacity: 0 }} />
                  <div className="absolute -top-[20px] -right-[20px] w-[120px] h-[120px] rounded-full pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${t.glow} 0%, transparent 70%)` }} />

                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div className="w-12 h-12 rounded-[14px] flex items-center justify-center"
                      style={{ background: t.grad, boxShadow: t.shadow, transform: "translateZ(22px)" }}>
                      <Icon className="w-[22px] h-[22px] text-white" strokeWidth={2.2} />
                    </div>
                    <ToggleD on={on} onClick={(e) => { e.stopPropagation(); toggleNotification(t.key); }} />
                  </div>

                  <div className="relative z-10" style={{ transform: "translateZ(12px)" }}>
                    <div className="text-[14px] font-bold mb-1" style={{ color: T1, letterSpacing: "-0.2px" }}>{t.title}</div>
                    <div className="text-[11px] leading-[1.55]" style={{ color: T3 }}>{t.sub}</div>
                  </div>

                  <div className="flex items-center gap-[5px] mt-4 pt-3 relative z-10" style={{ borderTop: `0.5px solid ${BLUE_BDR}`, transform: "translateZ(6px)" }}>
                    {on ? (
                      <>
                        <CheckCircle2 className="w-[12px] h-[12px]" style={{ color: GREEN }} strokeWidth={2.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: GREEN_D_COL }}>Delivering live</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: T4 }}>Paused</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Security Ops (3-col functional cards) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ perspective: "1200px" }}>
          {[
            { name: "Biometric Key", sub: "Authorized device · Face/Touch ID ready", icon: Smartphone, grad: `linear-gradient(135deg, ${B1}, ${B3})`, sh: "0 3px 12px rgba(0,85,255,0.26)", glow: "rgba(0,85,255,0.08)", status: "Ready", statusBg: "rgba(0,85,255,0.08)", statusColor: B1, statusBdr: BLUE_BDR },
            { name: "Two-Factor Auth", sub: "SMS verification layer active on this account", icon: Lock, grad: `linear-gradient(135deg, ${GREEN}, #22EE66)`, sh: "0 3px 12px rgba(0,200,83,0.26)", glow: "rgba(0,200,83,0.08)", status: "ON", statusBg: "rgba(0,200,83,0.10)", statusColor: GREEN_D_COL, statusBdr: "rgba(0,200,83,0.22)" },
            { name: "Data Privacy", sub: "GDPR-compliant storage · institutional admin controlled", icon: ShieldAlert, grad: "linear-gradient(135deg, #6B21E8, #A87FF8)", sh: "0 3px 12px rgba(107,33,232,0.26)", glow: "rgba(107,33,232,0.08)", status: "Compliant", statusBg: "rgba(107,33,232,0.08)", statusColor: "#6B21E8", statusBdr: "rgba(107,33,232,0.22)" },
          ].map(({ name, sub, icon: Icon, grad, sh, glow, status, statusBg, statusColor, statusBdr }) => (
            <div key={name}
              onMouseEnter={handle3DEnter}
              onMouseMove={handle3DMove}
              onMouseLeave={handle3DLeave}
              className="bg-white rounded-[22px] p-6 relative overflow-hidden cursor-pointer"
              style={{ boxShadow: SH_LG_D, border: "0.5px solid rgba(0,85,255,0.10)", transformStyle: "preserve-3d", willChange: "transform" }}>
              <div data-glow className="absolute inset-0 pointer-events-none transition-opacity duration-300" style={{ opacity: 0 }} />
              <div className="absolute -top-[20px] -right-[20px] w-[140px] h-[140px] rounded-full pointer-events-none"
                style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 70%)` }} />

              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="w-12 h-12 rounded-[14px] flex items-center justify-center"
                  style={{ background: grad, boxShadow: sh, transform: "translateZ(22px)" }}>
                  <Icon className="w-[22px] h-[22px] text-white" strokeWidth={2.2} />
                </div>
                <div className="px-[10px] py-[5px] rounded-full text-[11px] font-bold"
                  style={{ background: statusBg, color: statusColor, border: `0.5px solid ${statusBdr}`, transform: "translateZ(14px)" }}>
                  {status}
                </div>
              </div>

              <div className="text-[15px] font-bold mb-1 relative z-10" style={{ color: T1, letterSpacing: "-0.2px", transform: "translateZ(10px)" }}>{name}</div>
              <div className="text-[11px] leading-[1.6] relative z-10" style={{ color: T3 }}>{sub}</div>

              <div className="flex items-center gap-[5px] mt-5 pt-3 relative z-10" style={{ borderTop: `0.5px solid ${BLUE_BDR}` }}>
                <span className="text-[11px] font-bold" style={{ color: B1, letterSpacing: "-0.1px" }}>Manage</span>
                <ChevronRight className="w-[13px] h-[13px]" style={{ color: B1 }} strokeWidth={2.5} />
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;
