import { useState, useEffect } from "react";
import { Mail, CheckSquare, FileText, Star, CalendarCheck, Loader2, User } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

const MyChildPage = () => {
  const { studentData, user } = useAuth();
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);

  useEffect(() => {
    if (!studentData?.schoolId || !studentData?.grade) {
      setLoadingTeachers(false);
      return;
    }

    // Fetch teachers who teach this student's grade/class in the same school
    const q = query(
      collection(db, "teachers"),
      where("schoolId", "==", studentData.schoolId),
      where("classes", "==", studentData.grade)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const colors = ["bg-primary", "bg-edu-green", "bg-edu-orange", "bg-edu-blue", "bg-edu-purple"];
      const data = snapshot.docs.map((doc, idx) => {
        const t = doc.data();
        // Determine if this is the primary teacher assigned to the student
        const isClassTeacher = studentData.teacherId === doc.id;
        
        return {
          id: doc.id,
          initials: t.name ? t.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : "T",
          name: t.name,
          subject: isClassTeacher ? `Class Teacher • ${t.subject}` : t.subject,
          color: colors[idx % colors.length],
          isClassTeacher
        };
      });

      // Sort to put Class Teacher first
      data.sort((a, b) => (b.isClassTeacher ? 1 : 0) - (a.isClassTeacher ? 1 : 0));
      
      setTeachers(data);
      setLoadingTeachers(false);
    }, (error) => {
      console.error("Error fetching teachers:", error);
      setLoadingTeachers(false);
    });

    return () => unsubscribe();
  }, [studentData?.schoolId, studentData?.grade, studentData?.teacherId]);

  const overview = [
    { icon: <CalendarCheck className="w-5 h-5 text-edu-green" />, bg: "bg-edu-green-light", label: "Attendance", value: "94%" },
    { icon: <FileText className="w-5 h-5 text-edu-blue" />, bg: "bg-edu-blue-light", label: "Assignments", value: "28/30" },
    { icon: <FileText className="w-5 h-5 text-edu-orange" />, bg: "bg-edu-orange-light", label: "Tests Taken", value: "12" },
    { icon: <Star className="w-5 h-5 text-edu-yellow" />, bg: "bg-edu-yellow-light", label: "Average Grade", value: "B+" },
  ];

  return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div />
          <button 
            onClick={() => navigate('/settings')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            ✏️ Edit Profile
          </button>
        </div>

        {/* Profile Card */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-2xl shadow-lg">
                {studentData?.name?.[0] || user?.displayName?.[0] || "S"}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{studentData?.name || user?.displayName || "Student Name"}</h2>
                <p className="text-muted-foreground font-medium uppercase tracking-tight text-sm">
                  {studentData?.grade || "N/A"} • Roll Number {studentData?.rollNo || "N/A"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-edu-green/10 text-edu-green border border-edu-green/20 rounded-full text-xs font-bold uppercase tracking-widest">Active</span>
              <span className="px-3 py-1 bg-edu-blue/10 text-edu-blue border border-edu-blue/20 rounded-full text-xs font-bold tracking-widest uppercase">2025-26</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Email Address", value: studentData?.email || user?.email },
              { label: "Blood Group", value: studentData?.bloodGroup || "O+" },
              { label: "Phone Number", value: studentData?.phone || "N/A" },
              { label: "Branch", value: studentData?.branch || "N/A" },
            ].map((item) => (
              <div key={item.label} className="bg-muted/30 rounded-xl p-4 border border-border/50">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{item.label}</p>
                <p className="text-sm font-bold text-foreground mt-1 truncate">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Teachers & Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">Teachers</h3>
            <div className="space-y-4">
              {loadingTeachers ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <p className="text-xs font-medium uppercase tracking-widest">Loading Faculty...</p>
                </div>
              ) : teachers.length > 0 ? (
                teachers.map((t) => (
                  <div key={t.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-primary-foreground text-sm font-bold`}>{t.initials}</div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.subject}</p>
                      </div>
                    </div>
                    <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
                  <User className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-xs font-bold uppercase tracking-widest">No teachers assigned</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">This Term Overview</h3>
            <div className="space-y-4">
              {overview.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center`}>{item.icon}</div>
                    <span className="text-sm text-foreground">{item.label}</span>
                  </div>
                  <span className="text-lg font-bold text-edu-green">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
  );
};

export default MyChildPage;
