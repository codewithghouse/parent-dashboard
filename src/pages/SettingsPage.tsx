import React, { useState, useEffect } from "react";
import { 
  User, Bell, Shield, Globe, Mail, Phone, Camera, Loader2, Check, Settings, 
  ShieldCheck, Lock, Smartphone, Heart, Zap, ShieldAlert, Sparkles, ChevronRight
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { toast } from "sonner";

const SettingsPage = () => {
  const { studentData, user } = useAuth();
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
