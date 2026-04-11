import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User, Calendar, HeartPulse, Phone, Clock,
  Mail, CheckSquare, FileText, Star, Edit, X, Save, Loader2, Users
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";

function getInitials(name: string): string {
  return (name || "")
    .split(" ")
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || "")
    .join("");
}

const TEACHER_COLORS = ["bg-[#1e3a8a]", "bg-emerald-600", "bg-orange-500", "bg-indigo-600", "bg-rose-500"];

const MyChildPage = () => {
  const { studentData } = useAuth();
  const navigate = useNavigate();

  const [teachers, setTeachers] = useState<any[]>([]);
  const [enrollmentInfo, setEnrollmentInfo] = useState({ className: "—", section: "—", rollNo: "—" });
  const [overview, setOverview] = useState({ attendance: "—", assignments: "—", testsTaken: 0, avgGrade: "—" });
  const [loading, setLoading] = useState(true);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ dob: "", bloodGroup: "", parentPhone: "", emergencyContact: "", admissionDate: "" });

  useEffect(() => {
    if (!studentData?.id) return;
    setLoading(true);
    const email = studentData.email?.toLowerCase() || "";

    setFormData({
      dob: studentData.dob || "",
      bloodGroup: studentData.bloodGroup || "",
      parentPhone: studentData.parentPhone || "",
      emergencyContact: studentData.emergencyContact || "",
      admissionDate: studentData.admissionDate || "",
    });

    const schoolId = studentData.schoolId;

    // Enrollments → teachers + class info (single scoped query)
    let enSnap: any = null;
    const processEnrollments = async () => {
      const docs = enSnap?.docs || [];
      const seen = new Set();
      const unique = docs.filter((d: any) => seen.has(d.id) ? false : (seen.add(d.id), true));
      if (unique.length > 0) {
        const first = (unique[0] as any).data();
        setEnrollmentInfo({
          className: first.className || studentData?.grade || "—",
          section: first.section || "",
          rollNo: first.rollNo || studentData?.rollNo || "—",
        });
      }
      setTeachers(unique.map((d: any) => ({
        id: d.id,
        name: d.data().teacherName || "Teacher",
        subject: d.data().subject || d.data().className || "General",
        initials: getInitials(d.data().teacherName || "T"),
      })));

      // Assignments completion — now inside processEnrollments to avoid full collection scan
      const classIds = [...new Set(unique.map((d: any) => d.data().classId).filter(Boolean))] as string[];
      if (classIds.length > 0) {
        const chunks: string[][] = [];
        for (let i = 0; i < classIds.length; i += 10) chunks.push(classIds.slice(i, i + 10));
        const aSnaps = await Promise.all(
          chunks.map(chunk => getDocs(query(collection(db, "assignments"), where("classId", "in", chunk))))
        );
        const totalAssignments = aSnaps.reduce((sum, s) => sum + s.docs.length, 0);
        const subSnap = await getDocs(
          schoolId
            ? query(collection(db, "submissions"), where("schoolId", "==", schoolId), where("studentId", "==", studentData.id))
            : query(collection(db, "submissions"), where("studentId", "==", studentData.id))
        );
        const subIds = new Set(subSnap.docs.flatMap(d => [d.data().homeworkId, d.data().assignmentId].filter(Boolean)));
        setOverview(prev => ({ ...prev, assignments: `${subIds.size}/${totalAssignments}` }));
      }

      setLoading(false);
    };

    const enrollQ = schoolId
      ? query(collection(db, "enrollments"), where("schoolId", "==", schoolId), where("studentId", "==", studentData.id))
      : query(collection(db, "enrollments"), where("studentId", "==", studentData.id));
    const u1 = onSnapshot(enrollQ, s => { enSnap = s; processEnrollments(); });

    // Attendance — single scoped query
    const attQ = schoolId
      ? query(collection(db, "attendance"), where("schoolId", "==", schoolId), where("studentId", "==", studentData.id))
      : query(collection(db, "attendance"), where("studentId", "==", studentData.id));
    const u2 = onSnapshot(attQ, snap => {
      const records = snap.docs.map(d => d.data());
      const present = records.filter(r => r.status === "present" || r.status === "late").length;
      const pct = records.length === 0 ? 100 : Math.round((present / records.length) * 100);
      setOverview(prev => ({ ...prev, attendance: `${pct}%` }));
    });

    // Results — single scoped query
    const resultsQ = schoolId
      ? query(collection(db, "results"), where("schoolId", "==", schoolId), where("studentId", "==", studentData.id))
      : query(collection(db, "results"), where("studentId", "==", studentData.id));
    const u3 = onSnapshot(resultsQ, snap => {
      const results = snap.docs.map(d => d.data());
      const avg = results.length > 0
        ? results.reduce((s, r) => s + (parseFloat(r.score) || 0), 0) / results.length : 0;
      const grade = (s: number) => s >= 90 ? "A+" : s >= 80 ? "A" : s >= 70 ? "B+" : s >= 60 ? "B" : "C";
      setOverview(prev => ({ ...prev, testsTaken: results.length, avgGrade: results.length > 0 ? grade(avg) : "—" }));
    });

    return () => [u1, u2, u3].forEach(u => u());
  }, [studentData?.id, studentData?.schoolId]);

  const handleSave = async () => {
    if (!studentData?.id) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "students", studentData.id), formData);
      toast.success("Profile updated successfully.");
      setIsEditModalOpen(false);
    } catch {
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const studentInitials = getInitials(studentData?.name || "AS");

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <PageHeader
          title="Student Profile"
          badge="Active"
        />
        <button
          onClick={() => setIsEditModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[#1e3a8a] text-white rounded-xl text-sm font-bold hover:bg-blue-900 transition-all shadow-md active:scale-95"
        >
          <Edit className="w-4 h-4" /> Edit Profile
        </button>
      </div>

      {/* Profile Card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 md:p-6 mb-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5 pb-6 border-b border-slate-100 mb-6">
          <div className="w-24 h-24 rounded-2xl bg-[#1e3a8a] text-white flex items-center justify-center text-3xl font-black flex-shrink-0 shadow-lg shadow-blue-900/10">
            {studentInitials}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">{studentData?.name || "Student"}</h1>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full border border-emerald-100 uppercase tracking-widest">Active</span>
              <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-full border border-blue-100 uppercase tracking-widest">2025-26</span>
              <span className="px-3 py-1 bg-slate-50 text-slate-500 text-[10px] font-black rounded-full border border-slate-200 uppercase tracking-widest">Grade {enrollmentInfo.className}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {[
            { icon: Calendar, label: "Date of Birth", value: formData.dob || "Not set" },
            { icon: HeartPulse, label: "Blood Group", value: formData.bloodGroup || "Not set" },
            { icon: Phone, label: "Emergency Contact", value: formData.parentPhone || "Not set" },
            { icon: Clock, label: "Admission Date", value: formData.admissionDate || "Not set" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-1">{label}</p>
              <p className="text-sm font-semibold text-slate-800">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Teachers + Term Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Teachers */}
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-4">Teachers</h3>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-300">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : teachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-300 gap-2">
              <Users className="w-10 h-10" />
              <p className="text-xs">No teachers assigned yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {teachers.map((t, idx) => (
                <div key={t.id} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${TEACHER_COLORS[idx % TEACHER_COLORS.length]}`}>
                    {t.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{t.name}</p>
                    <p className="text-xs text-slate-400 truncate">{idx === 0 ? "Class Teacher • " : ""}{t.subject}</p>
                  </div>
                  <button
                    onClick={() => navigate("/teacher-notes")}
                    className="w-8 h-8 flex items-center justify-center text-[#1e3a8a] hover:bg-blue-50 rounded-lg transition-all flex-shrink-0"
                    title="Send message"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* This Term Overview */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-4">This Term Overview</h3>
          <div className="space-y-3">
            {[
              { icon: "✅", bg: "bg-emerald-50", label: "Attendance", value: overview.attendance, color: "text-emerald-600" },
              { icon: "📋", bg: "bg-blue-50", label: "Assignments", value: overview.assignments, color: "text-[#1e3a8a]" },
              { icon: "📄", bg: "bg-amber-50", label: "Tests Taken", value: overview.testsTaken.toString(), color: "text-amber-600" },
              { icon: "⭐", bg: "bg-emerald-50", label: "Average Grade", value: overview.avgGrade, color: "text-emerald-600" },
            ].map(({ icon, bg, label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center text-base`}>
                    {icon}
                  </div>
                  <span className="text-sm text-slate-600">{label}</span>
                </div>
                <span className={`text-sm font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl relative">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit Profile</h2>
                <p className="text-xs text-slate-400 mt-0.5">Update your child's information</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: "Date of Birth", key: "dob", placeholder: "e.g. 15 March 2012" },
                { label: "Blood Group", key: "bloodGroup", placeholder: "e.g. O+" },
                { label: "Parent Contact", key: "parentPhone", placeholder: "e.g. +91 98765 43210" },
                { label: "Admission Date", key: "admissionDate", placeholder: "e.g. June 2020" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
                  <input
                    type="text"
                    value={(formData as any)[key]}
                    onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 p-6 border-t border-slate-100">
              <button onClick={() => setIsEditModalOpen(false)} className="flex-1 h-11 bg-slate-100 text-slate-500 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-all">
                Cancel
              </button>
              <button onClick={handleSave} disabled={isSaving} className="flex-[2] h-11 bg-[#1e3a8a] text-white rounded-xl text-sm font-semibold hover:bg-blue-900 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyChildPage;
