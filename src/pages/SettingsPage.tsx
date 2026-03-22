import { useState, useEffect } from "react";
import { User, Bell, Shield, Globe, Mail, Phone, Camera, Loader2, Check, Settings, ShieldCheck, Lock, Smartphone } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
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

  useEffect(() => {
    if (studentData) {
      setProfileForm({
        name: studentData.name || "",
        email: studentData.email || "",
        phone: studentData.phone || "",
        language: studentData.language || "English"
      });
    }
  }, [studentData]);

  const [notifications, setNotifications] = useState({
    assignments: true,
    attendance: true,
    grades: true,
    messages: true,
    meetings: false,
  });

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleUpdateProfile = async () => {
    if (!profileForm.name) {
      toast.error("Name cannot be empty");
      return;
    }

    setIsUpdating(true);
    try {
      const studentDocRef = doc(db, "students", studentData.id || user?.uid);
      await updateDoc(studentDocRef, {
        name: profileForm.name,
        phone: profileForm.phone,
        language: profileForm.language
      });
      toast.success("Profile updated successfully!");
    } catch (error: any) {
      console.error("Update Profile Error:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
      <div className="space-y-10 max-w-5xl animate-in fade-in duration-700 pb-12">
        
        <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                System Preferences <Settings className="w-8 h-8 text-indigo-600" />
            </h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">Manage your portal settings & security protocols</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            
            {/* Left: Main Settings */}
            <div className="lg:col-span-8 space-y-10">
                {/* Profile Settings */}
                <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-10 shadow-sm relative overflow-hidden group">
                  <div className="flex items-center gap-4 mb-10 pb-6 border-b border-slate-50">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                      <User className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Parental Record Settings</h2>
                  </div>

                  <div className="flex flex-col md:flex-row items-center gap-8 mb-10">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-[2rem] bg-indigo-600 flex items-center justify-center text-white font-black text-3xl shadow-2xl ring-8 ring-indigo-50 group-hover:scale-105 transition-transform duration-500">
                        {profileForm.name ? profileForm.name[0] : (user?.displayName?.[0] || 'P')}
                      </div>
                      <button className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-slate-900 border-4 border-white flex items-center justify-center text-white shadow-xl hover:bg-slate-800 transition-all">
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-center md:text-left">
                      <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-2">{profileForm.name || "Set Name"}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Authorized Parent Account
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <InputGroup 
                        label="Full Legal Name" 
                        value={profileForm.name} 
                        onChange={(v) => setProfileForm({ ...profileForm, name: v })} 
                        icon={<User className="w-4 h-4" />} 
                    />
                    <InputGroup 
                        label="Primary Email (Locked)" 
                        value={profileForm.email} 
                        disabled 
                        icon={<Mail className="w-4 h-4" />} 
                    />
                    <InputGroup 
                        label="Contact Number" 
                        value={profileForm.phone} 
                        onChange={(v) => setProfileForm({ ...profileForm, phone: v })} 
                        icon={<Phone className="w-4 h-4" />} 
                        placeholder="+91 00000 00000"
                    />
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Interface Language</label>
                        <div className="flex items-center gap-4 bg-slate-50 rounded-2xl px-5 py-4 border border-slate-100 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                            <Globe className="w-4 h-4 text-slate-400" />
                            <select 
                                value={profileForm.language}
                                onChange={(e) => setProfileForm({ ...profileForm, language: e.target.value })}
                                className="bg-transparent border-none outline-none text-sm font-black text-slate-800 w-full appearance-none"
                            >
                                <option value="English">English</option>
                                <option value="Hindi">Hindi</option>
                                <option value="Urdu">Urdu</option>
                            </select>
                        </div>
                    </div>
                  </div>

                  <div className="mt-10 pt-10 border-t border-slate-50 flex justify-end">
                    <button 
                        onClick={handleUpdateProfile}
                        disabled={isUpdating}
                        className="px-10 py-5 bg-indigo-600 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 active:scale-95 disabled:opacity-50 transition-all"
                    >
                        {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {isUpdating ? "Synchronizing..." : "Update Vault"}
                    </button>
                  </div>
                </div>

                {/* Notifications Section */}
                <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-10 shadow-sm">
                    <div className="flex items-center gap-4 mb-10 pb-6 border-b border-slate-50">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
                            <Bell className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Intelligence Notifications</h2>
                    </div>

                    <div className="space-y-6">
                        {[
                        { key: "assignments" as const, label: "Homework Reminders", desc: "AI-driven prompts for upcoming deadlines" },
                        { key: "attendance" as const, label: "Presence Alerts", desc: "Real-time alerts for absences or late arrivals" },
                        { key: "grades" as const, label: "Assessment Results", desc: "Immediate notification of new test scores" },
                        { key: "messages" as const, label: "Educator Comms", desc: "Direct messages and broadcast from school faculty" },
                        ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white transition-all group">
                            <div className="max-w-md">
                                <p className="text-sm font-black text-slate-800 leading-none mb-2">{item.label}</p>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{item.desc}</p>
                            </div>
                            <button
                                onClick={() => toggleNotification(item.key)}
                                className={`w-14 h-8 rounded-full transition-all relative ${
                                    notifications[item.key] ? "bg-emerald-500 shadow-lg shadow-emerald-100" : "bg-slate-200"
                                }`}
                                >
                                <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${
                                    notifications[item.key] ? "translate-x-7" : "translate-x-1"
                                }`} />
                            </button>
                        </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Side: Security & Connected Child */}
            <div className="lg:col-span-4 space-y-10">
                {/* Connected Child Mini Card */}
                <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                    <Shield className="absolute -right-8 -bottom-8 w-40 h-40 text-white/5 group-hover:scale-110 transition-transform duration-700" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8">Active Connection</h3>
                    <div className="flex items-center gap-5 relative z-10">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-500 flex items-center justify-center text-white font-black text-xl shadow-xl">
                            {studentData?.name?.[0] || 'S'}
                        </div>
                        <div>
                            <p className="text-lg font-black tracking-tight">{studentData?.name || "Student Name"}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Grade {studentData?.grade} • Roll {studentData?.rollNo}</p>
                        </div>
                    </div>
                    <div className="mt-8 pt-8 border-t border-white/10 relative z-10">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Identity Verified</span>
                        </div>
                    </div>
                </div>

                {/* Security Protocols */}
                <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-10 shadow-sm space-y-8">
                    <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Security Protocols</h3>
                    </div>
                    <SecurityAction icon={<Lock className="w-4 h-4"/>} label="Change Password" desc="Last updated 30d ago" action="Update" />
                    <SecurityAction icon={<Smartphone className="w-4 h-4"/>} label="App Key (2FA)" desc="Not currently active" action="Enable" />
                </div>
            </div>
        </div>
      </div>
  );
};

const InputGroup = ({ label, value, onChange, disabled, icon, placeholder }: any) => (
    <div className="space-y-4">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">{label}</label>
        <div className={`flex items-center gap-4 bg-slate-50 rounded-2xl px-5 py-4 border border-slate-100 transition-all ${disabled ? 'opacity-50' : 'focus-within:ring-2 focus-within:ring-indigo-100'}`}>
            <div className="text-slate-400">{icon}</div>
            <input 
                type="text" 
                value={value} 
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                placeholder={placeholder}
                className="bg-transparent border-none outline-none text-sm font-black text-slate-800 w-full placeholder:text-slate-300"
            />
        </div>
    </div>
);

const SecurityAction = ({ icon, label, desc, action }: any) => (
    <div className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl border border-slate-100">
        <div>
            <p className="text-xs font-black text-slate-800 leading-none mb-1">{label}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{desc}</p>
        </div>
        <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-900 hover:text-white transition-all">
            {action}
        </button>
    </div>
);

export default SettingsPage;
