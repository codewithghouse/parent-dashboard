import { useState, useEffect } from "react";
import { User, Bell, Shield, Globe, Mail, Phone, Camera, Loader2, Check } from "lucide-react";
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
      <div className="space-y-6 max-w-4xl animate-in fade-in duration-500">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>

        {/* Profile Settings */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Profile Settings</h2>
          </div>

          <div className="flex items-center gap-6 mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-2xl shadow-lg">
                {profileForm.name ? profileForm.name[0] : (user?.displayName?.[0] || 'P')}
              </div>
              <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-edu-blue border-2 border-card flex items-center justify-center text-white shadow-md hover:scale-110 transition-transform">
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">{profileForm.name || "Set your name"}</h3>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Authorized Parent</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Full Name</label>
              <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-4 py-2.5 border border-border focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <User className="w-4 h-4 text-muted-foreground" />
                <input 
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  placeholder="Enter your name"
                  className="bg-transparent border-none outline-none text-sm w-full text-foreground font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Email Address</label>
              <div className="flex items-center gap-2 bg-muted/10 rounded-lg px-4 py-2.5 border border-border opacity-70">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <input 
                  type="email"
                  value={profileForm.email}
                  disabled
                  className="bg-transparent border-none outline-none text-sm w-full text-foreground font-medium cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Phone Number</label>
              <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-4 py-2.5 border border-border focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <input 
                  type="text"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="+91 00000 00000"
                  className="bg-transparent border-none outline-none text-sm w-full text-foreground font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Language</label>
              <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-4 py-2.5 border border-border focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <select 
                  value={profileForm.language}
                  onChange={(e) => setProfileForm({ ...profileForm, language: e.target.value })}
                  className="bg-transparent border-none outline-none text-sm w-full text-foreground font-medium appearance-none"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Urdu">Urdu</option>
                  <option value="Spanish">Spanish</option>
                </select>
              </div>
            </div>
          </div>

          <button 
            onClick={handleUpdateProfile}
            disabled={isUpdating}
            className="mt-8 px-8 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2"
          >
            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isUpdating ? "Updating..." : "Save Changes"}
          </button>
        </div>

        {/* Notification Preferences */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-6">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Notification Preferences</h2>
          </div>

          <div className="space-y-4">
            {[
              { key: "assignments" as const, label: "Assignment Reminders", desc: "Get notified about upcoming and overdue assignments" },
              { key: "attendance" as const, label: "Attendance Alerts", desc: "Receive alerts for absences and late arrivals" },
              { key: "grades" as const, label: "Grade Updates", desc: "Get notified when new grades are posted" },
              { key: "messages" as const, label: "Teacher Messages", desc: "Receive notifications for new messages from teachers" },
              { key: "meetings" as const, label: "Meeting Reminders", desc: "Get reminders for parent-teacher meetings" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <button
                  onClick={() => toggleNotification(item.key)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    notifications[item.key] ? "bg-edu-green" : "bg-muted"
                  }`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform ${
                    notifications[item.key] ? "translate-x-5" : "translate-x-0.5"
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Security */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Security</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div>
                <p className="text-sm font-semibold text-foreground">Change Password</p>
                <p className="text-xs text-muted-foreground">Last changed 30 days ago</p>
              </div>
              <button className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted">
                Change
              </button>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div>
                <p className="text-sm font-semibold text-foreground">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground">Add extra security to your account</p>
              </div>
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                Enable
              </button>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Active Sessions</p>
                <p className="text-xs text-muted-foreground">1 device currently logged in</p>
              </div>
              <button className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted">
                Manage
              </button>
            </div>
          </div>
        </div>

        {/* Connected Child */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-4">Connected Child</h2>
          <div className="flex items-center justify-between p-4 bg-muted/10 rounded-xl border border-border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-sm">
                {studentData?.name?.[0] || 'S'}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{studentData?.name || "No child connected"}</p>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-tight">Grade {studentData?.grade || "N/A"} • Roll {studentData?.rollNo || "N/A"}</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-edu-green/10 text-edu-green border border-edu-green/20 rounded-full text-[10px] font-bold uppercase tracking-widest">Active</span>
          </div>
        </div>
      </div>
  );
};

export default SettingsPage;
