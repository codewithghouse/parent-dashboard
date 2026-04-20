import {
  ArrowLeft, BookOpen, PlayCircle, Star, User,
  Calculator, FlaskConical, Globe, Monitor, Palette, Languages, FileText
} from "lucide-react";
import { openSafeExternalUrl } from "@/lib/safeExternalUrl";

interface Topic { name: string; score: number; }
interface TestScore { name: string; date: string; score: string; status: "success" | "warning" | "error"; }
interface Resource { icon: string; title: string; subtitle: string; action: string; color: string; url: string; }

interface Props {
  subject: string; teacher: string; grade: string; average: number;
  topics: Topic[]; testScores: TestScore[]; feedback: string; resources: Resource[]; onBack: () => void;
}

const getSubjectIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("math")) return Calculator;
  if (n.includes("science")) return FlaskConical;
  if (n.includes("english")) return Languages;
  if (n.includes("social")) return Globe;
  if (n.includes("computer")) return Monitor;
  if (n.includes("art")) return Palette;
  return BookOpen;
};

export const SubjectPerformanceDetail = ({ subject, teacher, grade, average, topics, testScores, feedback, resources, onBack }: Props) => {
  const Icon = getSubjectIcon(subject);
  const gradeColor = average >= 75 ? "text-emerald-600" : average >= 60 ? "text-amber-600" : "text-rose-600";

  return (
    <div className="animate-in fade-in duration-500 pb-20 space-y-5">

      {/* Back / Header */}
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 transition-all text-sm font-medium">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          Result of click: "Performance Details - {subject}"
        </p>
      </div>

      {/* Subject Header Card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500 flex-shrink-0">
            <Icon className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{subject}</h1>
            <p className="text-sm text-slate-400 mt-0.5">Teacher: {teacher}</p>
          </div>
        </div>
        <div className="flex items-center gap-8 sm:border-l border-slate-100 sm:pl-8">
          <div className="text-center">
            <p className={`text-3xl font-bold ${gradeColor}`}>{grade}</p>
            <p className="text-xs text-slate-400 mt-1">Current Grade</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-slate-800">{average}%</p>
            <p className="text-xs text-slate-400 mt-1">Average</p>
          </div>
        </div>
      </div>

      {/* Topic Performance + Recent Test Scores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Topic Performance */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-5">Topic Performance</h3>
          <div className="space-y-4">
            {topics.map(topic => {
              const barColor = topic.score >= 75 ? "bg-emerald-500" : topic.score >= 60 ? "bg-amber-400" : "bg-rose-500";
              const scoreColor = topic.score >= 75 ? "text-emerald-600" : topic.score >= 60 ? "text-amber-600" : "text-rose-600";
              return (
                <div key={topic.name}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm text-slate-600">{topic.name}</span>
                    <span className={`text-sm font-bold ${scoreColor}`}>{topic.score}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${topic.score}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Test Scores */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-5">Recent Test Scores</h3>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {testScores.length > 0 ? testScores.map((test, i) => {
              const badgeStyle = test.status === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : test.status === "warning" ? "bg-amber-50 text-amber-700 border border-amber-100" : "bg-rose-50 text-rose-700 border border-rose-100";
              return (
                <div key={i} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{test.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{test.date}</p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${badgeStyle}`}>{test.score}</span>
                </div>
              );
            }) : (
              <p className="text-sm text-slate-400 py-6 text-center">No test scores yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Teacher Feedback + Suggested Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Teacher Feedback */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-4">Teacher Feedback</h3>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 relative">
            <span className="text-5xl text-emerald-200 font-bold absolute -top-2 left-3 select-none leading-none">"</span>
            <p className="text-sm text-slate-700 leading-relaxed relative z-10 pt-3">{feedback}</p>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-9 h-9 rounded-xl bg-[#1e3a8a] flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{teacher}</p>
              <p className="text-xs text-slate-400">Class Teacher</p>
            </div>
          </div>
        </div>

        {/* Suggested Resources */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-4">Suggested Resources</h3>
          <div className="space-y-3">
            {resources.map((res, i) => {
              const ResIcon = res.icon === "FileText" ? FileText : res.icon === "PlayCircle" ? PlayCircle : Star;
              const [iconColor, iconBg] = res.color.split(" ");
              return (
                <div
                  key={i}
                  onClick={() => res.url && res.url !== "#" && openSafeExternalUrl(res.url)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-all group"
                >
                  <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
                    <ResIcon className={`w-4 h-4 ${iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{res.title}</p>
                    <p className="text-xs text-slate-400 truncate">{res.subtitle}</p>
                  </div>
                  <span className="text-xs font-semibold text-[#1e3a8a] group-hover:underline flex-shrink-0">{res.action}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
