import { ThumbsUp, Info, User, BookOpen, Calendar, Pin, MessageSquare, CheckCircle, Search, Filter, Volume2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const notes = [
  {
    title: "Excellent Progress in Mathematics!",
    type: "Academic",
    typeColor: "bg-emerald-100 text-emerald-600",
    icon: <ThumbsUp className="w-5 h-5" />,
    iconBg: "bg-emerald-50",
    teacher: "Mrs. Priya Patel",
    subject: "Mathematics",
    date: "Jan 15, 2026",
    isPinned: true,
    body: "Aditya has shown remarkable improvement in Algebra this month. His test score improved from 78% to 92%, and he's been actively participating in class discussions. Keep encouraging him at home!",
  },
  {
    title: "Parent-Teacher Meeting Reminder",
    type: "General",
    typeColor: "bg-indigo-100 text-indigo-600",
    icon: <Info className="w-5 h-5" />,
    iconBg: "bg-indigo-50",
    teacher: "Mrs. Priya Patel",
    subject: "Class Teacher",
    date: "Jan 12, 2026",
    isPinned: false,
    body: "This is a reminder that the quarterly parent-teacher meeting is scheduled for January 25, 2026, at 10:00 AM. Please confirm your attendance through the portal.",
  },
  {
    title: "Friendly Reminder About Punctuality",
    type: "Behavioral",
    typeColor: "bg-amber-100 text-amber-600",
    icon: <Volume2 className="w-5 h-5" />,
    iconBg: "bg-amber-50",
    teacher: "Mr. Rajesh Kumar",
    subject: "Science",
    date: "Jan 8, 2026",
    isPinned: false,
    body: "Aditya has been arriving a few minutes late to Science class recently. While it's not a major concern, arriving on time helps him settle in better. A gentle reminder at home would be helpful.",
  },
];

const TeacherNotesPage = () => {
    const { studentData } = useAuth();

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-12">
            
            {/* Header section with Search/Filter */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        Teacher Insights <BookOpen className="w-8 h-8 text-indigo-600" />
                    </h1>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">Direct communication & notes from {studentData?.name || "Student"}'s educators</p>
                </div>
                
                <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-[1.5rem] border border-slate-100">
                    <div className="flex items-center gap-2 px-4 bg-white rounded-xl border border-slate-100 shadow-sm flex-1 lg:w-64">
                        <Search className="w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="Search notes..." className="bg-transparent border-none py-2.5 text-xs font-bold outline-none text-slate-800" />
                    </div>
                    <button className="p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm text-slate-400 hover:text-indigo-600 transition-colors">
                        <Filter className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Notes List */}
            <div className="space-y-6">
                {notes.map((note, idx) => (
                    <div key={idx} className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
                        
                        {note.isPinned && (
                            <div className="absolute top-6 right-6 p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                <Pin className="w-4 h-4 fill-indigo-600" />
                            </div>
                        )}

                        <div className="flex flex-col lg:flex-row items-start gap-8">
                            <div className={`w-16 h-16 rounded-3xl ${note.iconBg} flex items-center justify-center text-slate-800 shrink-0 shadow-inner border border-slate-100`}>
                                {note.icon}
                            </div>

                            <div className="flex-1 space-y-4">
                                <div>
                                    <div className="flex flex-wrap items-center gap-3 mb-2">
                                        <h3 className="text-xl font-black text-slate-800 tracking-tight">{note.title}</h3>
                                        <span className={`px-4 py-1 rounded-[0.75rem] text-[9px] font-black uppercase tracking-widest ${note.typeColor}`}>
                                            {note.type}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <span className="flex items-center gap-2"><User className="w-3.5 h-3.5" /> {note.teacher}</span>
                                        <span className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" /> {note.subject}</span>
                                        <span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> {note.date}</span>
                                    </div>
                                </div>
                                
                                <p className="text-base font-bold text-slate-500 leading-relaxed max-w-4xl pt-2">
                                    {note.body}
                                </p>

                                <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-slate-50">
                                    <button className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                                        <MessageSquare className="w-4 h-4" /> Reply to Teacher
                                    </button>
                                    <button className="px-6 py-2.5 bg-white border-2 border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-slate-200 transition-all flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4" /> Acknowledge Receipt
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Achievement Badge (Connection) */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-700 rounded-[2.5rem] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl shadow-emerald-100 overflow-hidden relative">
                <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
                <div className="relative z-10 flex items-center gap-6">
                    <div className="w-16 h-16 rounded-full bg-white/20 border border-white/30 flex items-center justify-center backdrop-blur-sm">
                        <ThumbsUp className="w-8 h-8 fill-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black tracking-tight">Parental Encouragement Needed</h3>
                        <p className="text-sm font-bold text-emerald-100 uppercase tracking-widest mt-1">Reward Aditya for the Math Improvement note!</p>
                    </div>
                </div>
                <button className="relative z-10 px-8 py-4 bg-white text-emerald-700 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg hover:scale-105 transition-all">
                    Send Appreciation ❤️
                </button>
            </div>
        </div>
    );
};

export default TeacherNotesPage;
