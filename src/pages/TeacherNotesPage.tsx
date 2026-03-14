import { ParentLayout } from "@/components/layout/ParentLayout";
import { ThumbsUp, Info, Hand, User, BookOpen, Calendar } from "lucide-react";

const notes = [
  {
    title: "Excellent Progress in Mathematics!",
    type: "Academic",
    typeColor: "bg-[#dcfce7] text-[#16a34a]",
    icon: <ThumbsUp className="w-6 h-6 text-[#16a34a]" fill="currentColor" strokeWidth={0} />,
    iconBg: "bg-[#dcfce7]",
    teacher: "Mrs. Priya Patel",
    subject: "Mathematics",
    date: "Jan 15, 2026",
    body: "Aditya has shown remarkable improvement in Algebra this month. His test score improved from 78% to 92%, and he's been actively participating in class discussions. Keep encouraging him at home!",
    actions: [
      { label: "Reply", style: "bg-[#1e3a8a] text-white hover:bg-[#1e4fc0]" },
      { label: "Acknowledge", style: "bg-white border border-border text-foreground hover:bg-slate-50" },
    ],
  },
  {
    title: "Parent-Teacher Meeting Reminder",
    type: "General",
    typeColor: "bg-[#e2e8f0] text-[#1e3a8a]",
    icon: <Info className="w-6 h-6 text-[#1e3a8a]" fill="currentColor" strokeWidth={0} />,
    iconBg: "bg-[#e2e8f0]",
    teacher: "Mrs. Priya Patel",
    subject: "Class Teacher",
    date: "Jan 12, 2026",
    body: "This is a reminder that the quarterly parent-teacher meeting is scheduled for January 25, 2026, at 10:00 AM. Please confirm your attendance through the portal.",
    actions: [
      { label: "Confirm Attendance", style: "bg-[#16a34a] text-white hover:bg-green-700" },
      { label: "Request Different Time", style: "bg-white border border-border text-foreground hover:bg-slate-50" },
    ],
  },
  {
    title: "Friendly Reminder About Punctuality",
    type: "Behavioral",
    typeColor: "bg-[#fef3c7] text-[#d97706]",
    icon: <Hand className="w-6 h-6 text-[#f59e0b]" fill="currentColor" strokeWidth={0} />,
    iconBg: "bg-[#fef3c7]",
    teacher: "Mr. Rajesh Kumar",
    subject: "Science",
    date: "Jan 8, 2026",
    body: "Aditya has been arriving a few minutes late to Science class recently. While it's not a major concern, arriving on time helps him settle in better. A gentle reminder at home would be helpful.",
    actions: [
      { label: "Reply", style: "bg-[#1e3a8a] text-white hover:bg-[#1e4fc0]" },
      { label: "Acknowledge", style: "bg-white border border-border text-foreground hover:bg-slate-50" },
    ],
  },
];

const TeacherNotesPage = () => {
  return (
    <ParentLayout>
      <div className="space-y-6 pt-2 pb-10">
        <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-[#1e293b] uppercase tracking-wider">Teacher Notes</h1>
            <div className="h-10 w-32 bg-white border border-border rounded-xl shadow-sm" />
        </div>

        <div className="space-y-5">
          {notes.map((note) => (
            <div key={note.title} className="bg-white rounded-[20px] border border-border p-7 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-5">
                  <div className={`w-14 h-14 rounded-2xl ${note.iconBg} flex items-center justify-center shrink-0 shadow-sm`}>
                    {note.icon}
                  </div>
                  <div className="pt-0.5">
                    <h3 className="text-[19px] font-bold text-foreground mb-2 leading-tight">{note.title}</h3>
                    <div className="flex items-center gap-4 text-[13px] font-bold text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1.5"><User className="w-4 h-4 text-muted-foreground/80" fill="currentColor" strokeWidth={0} />{note.teacher}</span>
                      <span className="text-muted-foreground/40">•</span>
                      <span className="flex items-center gap-1.5"><BookOpen className="w-4 h-4 text-muted-foreground/80" fill="currentColor" strokeWidth={0} />{note.subject}</span>
                      <span className="text-muted-foreground/40">•</span>
                      <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-muted-foreground/80" fill="currentColor" strokeWidth={0} />{note.date}</span>
                    </div>
                  </div>
                </div>
                {/* Right Aligned Badge */}
                <span className={`px-4 py-1.5 rounded-full text-[12px] font-black tracking-wide shrink-0 shadow-sm ${note.typeColor}`}>
                  {note.type}
                </span>
              </div>
              
              <div className="ml-[76px]">
                <p className="text-[15px] font-medium text-foreground leading-relaxed mb-6 opacity-90 max-w-4xl">
                  {note.body}
                </p>
                <div className="flex gap-3">
                  {note.actions.map((a) => (
                    <button key={a.label} className={`px-5 py-2.5 rounded-xl text-[13px] font-bold shadow-sm transition-all ${a.style}`}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ParentLayout>
  );
};

export default TeacherNotesPage;
