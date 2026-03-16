import { useState } from "react";
import { User, Bell, Shield, Globe, Mail, Phone, Camera } from "lucide-react";

const SettingsPage = () => {
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

  return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>

        {/* Profile Settings */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Profile Settings</h2>
          </div>

          <div className="flex items-center gap-6 mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-2xl">RS</div>
              <button className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-edu-blue flex items-center justify-center text-primary-foreground">
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Rahul Sharma</h3>
              <p className="text-sm text-muted-foreground">Parent</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Full Name", value: "Rahul Sharma", icon: <User className="w-4 h-4 text-muted-foreground" /> },
              { label: "Email Address", value: "rahul.sharma@email.com", icon: <Mail className="w-4 h-4 text-muted-foreground" /> },
              { label: "Phone Number", value: "+91 98765 43210", icon: <Phone className="w-4 h-4 text-muted-foreground" /> },
              { label: "Language", value: "English", icon: <Globe className="w-4 h-4 text-muted-foreground" /> },
            ].map((field) => (
              <div key={field.label}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{field.label}</label>
                <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-3 border border-border">
                  {field.icon}
                  <span className="text-sm text-foreground">{field.value}</span>
                </div>
              </div>
            ))}
          </div>

          <button className="mt-4 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
            Update Profile
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
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-bold text-foreground mb-4">Connected Child</h2>
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold">AS</div>
              <div>
                <p className="text-sm font-semibold text-foreground">Aditya Sharma</p>
                <p className="text-xs text-muted-foreground">Grade 8 • Section B • Roll 24</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-edu-green-light text-edu-green rounded-full text-xs font-medium">Active</span>
          </div>
        </div>
      </div>
  );
};

export default SettingsPage;
