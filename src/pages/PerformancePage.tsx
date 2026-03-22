import { useEffect, useState } from "react";
import { 
  ArrowUp, ArrowDown, Minus, ChevronRight, Sparkles, BrainCircuit, 
  Target, TrendingUp, Users, Info, Loader2, Zap, Rocket
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { SubjectPerformanceDetail } from "@/components/performance/SubjectPerformanceDetail";
import { ParentAIController } from "../ai/controller/ai-controller";
import { useAuth } from "@/lib/AuthContext";

const subjects = [
  { name: "Mathematics", grade: "A-", progress: 85, trend: "Improving", trendDir: "up", color: "bg-edu-green" },
  { name: "Science", grade: "B+", progress: 78, trend: "Improving", trendDir: "up", color: "bg-edu-green" },
  { name: "English", grade: "B", progress: 72, trend: "Stable", trendDir: "stable", color: "bg-edu-orange" },
  { name: "Social Studies", grade: "C+", progress: 68, trend: "Needs Attention", trendDir: "down", color: "bg-edu-red" },
  { name: "Computer Science", grade: "A", progress: 92, trend: "Excellent", trendDir: "up", color: "bg-edu-green" },
  { name: "Art & Craft", grade: "A+", progress: 95, trend: "Outstanding", trendDir: "up", color: "bg-edu-green" },
];

const trendData = [
  { month: "Jun", math: 70, science: 68, english: 65 },
  { month: "Jul", math: 72, science: 70, english: 68 },
  { month: "Aug", math: 74, science: 72, english: 70 },
  { month: "Sep", math: 76, science: 74, english: 71 },
  { month: "Oct", math: 80, science: 76, english: 72 },
  { month: "Nov", math: 82, science: 77, english: 72 },
  { month: "Dec", math: 84, science: 78, english: 73 },
  { month: "Jan", math: 85, science: 78, english: 72 },
];

const subjectDetailsData: Record<string, any> = {
  "Mathematics": {
    teacher: "Mrs. Priya Patel",
    topics: [
      { name: "Algebra", score: 92 },
      { name: "Geometry", score: 88 },
      { name: "Trigonometry", score: 76 },
      { name: "Statistics", score: 84 },
    ],
    testScores: [
      { name: "Unit Test 4 - Algebra", date: "15 Jan 2026", score: "92/100", status: "success" },
      { name: "Quiz - Geometry", date: "10 Jan 2026", score: "18/20", status: "success" },
      { name: "Unit Test 3 - Trigonometry", date: "3 Jan 2026", score: "76/100", status: "warning" },
      { name: "Mid Term Exam", date: "15 Dec 2025", score: "82/100", status: "success" },
    ],
    feedback: "Aditya has shown excellent improvement in Algebra. He should focus more on Trigonometric identities to further improve his overall score."
  },
  "Science": {
    teacher: "Dr. Sanjay Gupta",
    topics: [
      { name: "Physics", score: 75 },
      { name: "Chemistry", score: 82 },
      { name: "Biology", score: 78 },
    ],
    testScores: [
      { name: "Physics Lab Exam", date: "12 Jan 2026", score: "15/20", status: "warning" },
      { name: "Chemistry Mid-Term", date: "20 Dec 2025", score: "82/100", status: "success" },
    ],
    feedback: "Consistent performance in Science. Physics numericals need more practice."
  },
  "English": {
    teacher: "Ms. Sarah Wilson",
    topics: [
      { name: "Grammar", score: 70 },
      { name: "Literature", score: 75 },
      { name: "Writing", score: 72 },
    ],
    testScores: [
      { name: "Quarterly Essay", date: "10 Jan 2026", score: "72/100", status: "warning" },
    ],
    feedback: "Good grasp of literature. Needs to work on creative writing structure."
  }
};

const PerformancePage = () => {
  const { studentData } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [perfInsights, setPerfInsights] = useState<any>(null);

  useEffect(() => {
    const fetchPerfInsights = async () => {
       setIsAnalyzing(true);
       try {
          const payload = {
             student_name: studentData?.name || "Aditya",
             subjects: subjects.map(s => ({ name: s.name, grade: s.grade, score: s.progress })),
             recent_trend: "+8% improvement",
             comparative_data: "Class average is 72%"
          };
          const result = await ParentAIController.getPerformanceInsights(payload);
          if (result.status === "success") {
             setPerfInsights(result.data);
          }
       } catch (e) {
          console.error(e);
       } finally {
          setIsAnalyzing(false);
       }
    };
    fetchPerfInsights();
  }, [studentData]);

  const handleSubjectClick = (name: string) => {
    setSelectedSubject(name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (selectedSubject) {
    const details = subjectDetailsData[selectedSubject] || {
      teacher: "Subject Teacher",
      topics: [
        { name: "Current Unit", score: 80 },
        { name: "Past Assessment", score: 75 },
      ],
      testScores: [
        { name: "Latest Test", date: "10 Jan 2026", score: "80/100", status: "success" },
      ],
      feedback: "Student is performing well overall. Keep up the good work!"
    };

    const subjectInfo = subjects.find(s => s.name === selectedSubject);

    return (
      <>
        <SubjectPerformanceDetail
          subject={selectedSubject}
          teacher={details.teacher}
          grade={subjectInfo?.grade || "N/A"}
          average={subjectInfo?.progress || 0}
          topics={details.topics}
          testScores={details.testScores}
          feedback={details.feedback}
          onBack={() => setSelectedSubject(null)}
        />
      </>
    );
  }

  return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-12">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Performance Analytics</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px] mt-1">Deep insight into academic trajectory & milestones</p>
          </div>
          <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-2 w-fit">
             <BrainCircuit className="w-4 h-4 text-indigo-500" />
             <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">AI Audit Active</span>
          </div>
        </div>

        {/* FEATURE 4 & 6: AI Narrative Analysis & Peer Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           
           <div className="lg:col-span-8 space-y-8">
               {/* Narrative Insight */}
               <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                     <Sparkles className="w-16 h-16 text-[#1e3a8a]"/>
                  </div>
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 mb-6">
                     <TrendingUp className="w-6 h-6 text-emerald-500"/> AI Academic Narrative
                  </h2>
                  <div className="bg-slate-50 border-l-4 border-[#1e3a8a] p-8 rounded-2xl relative z-10">
                     {isAnalyzing ? (
                        <div className="space-y-3">
                           <div className="h-4 bg-slate-200 rounded w-full animate-pulse" />
                           <div className="h-4 bg-slate-200 rounded w-5/6 animate-pulse" />
                           <div className="h-4 bg-slate-200 rounded w-4/6 animate-pulse" />
                        </div>
                     ) : (
                        <p className="text-lg font-bold text-slate-700 leading-relaxed italic">
                           "{perfInsights?.narrative_analysis || "Aditya's mathematical logic has surged by 12%. Significant breakthroughs in Algebra observed, though geometry requires a slightly more visual approach."}"
                        </p>
                     )}
                  </div>
               </div>

               {/* Overall Metric Card */}
               <div className="bg-card rounded-[2.5rem] border-2 border-slate-100 p-8 flex flex-col md:flex-row items-center justify-between gap-8 h-fit">
                  <div className="flex items-center gap-8">
                     <div className="text-center group">
                        <p className="text-6xl font-black text-[#1e3a8a] tracking-tighter group-hover:scale-110 transition-transform">B+</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Current Grade</p>
                     </div>
                     <div className="h-16 w-px bg-slate-100" />
                     <div className="text-center">
                        <p className="text-4xl font-black text-slate-800 tracking-tight">78%</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Average Score</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-4 bg-emerald-50 px-8 py-6 rounded-3xl border border-emerald-100 shadow-sm">
                     <ArrowUp className="w-8 h-8 text-emerald-500" />
                     <div>
                        <span className="text-3xl font-black text-emerald-600">+8%</span>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60 leading-none">Term Over Term</p>
                     </div>
                  </div>
               </div>
           </div>

           {/* FEATURE 5: Goal Setting AI (Sticky Sidebar) */}
           <div className="lg:col-span-4 h-full">
               <div className="bg-gradient-to-br from-[#1e3a8a] to-blue-800 rounded-[2.5rem] p-8 text-white shadow-xl shadow-blue-200 sticky top-6">
                  <div className="flex items-center gap-3 mb-8">
                     <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/20">
                        <Target className="w-6 h-6"/>
                     </div>
                     <h3 className="text-sm font-black uppercase tracking-widest">Growth Target AI</h3>
                  </div>

                  {isAnalyzing ? (
                     <div className="space-y-6">
                        <div className="h-32 bg-white/5 rounded-3xl animate-pulse" />
                        <div className="h-24 bg-white/5 rounded-3xl animate-pulse" />
                     </div>
                  ) : (
                     <>
                        <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] mb-8">
                           <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Status: Progressing</span>
                           <h4 className="text-2xl font-black mt-1">{perfInsights?.goal_setting?.current_standing || "68% in Science"}</h4>
                           <div className="w-full bg-white/10 h-2.5 rounded-full mt-4 overflow-hidden border border-white/5">
                              <div className="h-full bg-emerald-400 rounded-full" style={{width: '68%'}}/>
                           </div>
                           <p className="text-[11px] font-bold text-indigo-100 mt-3 flex items-center gap-2">
                              Next milestone: <strong>{perfInsights?.goal_setting?.target || "80%"}</strong> 🎯
                           </p>
                        </div>

                        <div className="space-y-6">
                           <div className="flex items-start gap-4">
                              <div className="w-8 h-8 rounded-xl bg-orange-400/20 flex items-center justify-center shrink-0 border border-orange-400/30">
                                 <Zap className="w-4 h-4 text-orange-400 shadow-xl"/>
                              </div>
                              <div>
                                 <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">AI Action Plan</p>
                                 <p className="text-sm font-bold leading-relaxed">
                                    {perfInsights?.goal_setting?.action_plan || "Daily 30min science drills will bridge the 12% gap within 45 days."}
                                 </p>
                              </div>
                           </div>

                           <div className="flex items-start gap-4">
                              <div className="w-8 h-8 rounded-xl bg-emerald-400/20 flex items-center justify-center shrink-0 border border-emerald-400/30">
                                 <Users className="w-4 h-4 text-emerald-400"/>
                              </div>
                              <div>
                                 <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Peer Comparison</p>
                                 <p className="text-sm font-bold leading-relaxed">
                                    {perfInsights?.peer_comparison || "Currently within the Class Top 20% bracket."}
                                 </p>
                              </div>
                           </div>
                        </div>
                     </>
                  )}

                  <button className="w-full py-4 bg-white text-[#1e3a8a] rounded-2xl text-[10px] font-black uppercase tracking-widest mt-10 hover:bg-blue-50 transition-colors shadow-lg">
                     Customize Study Goals
                  </button>
               </div>
           </div>
        </div>

        {/* Subject Cards Section */}
        <div>
           <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="w-8 h-0.5 bg-slate-200"/> Curriculum Performance Directory
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {subjects.map((s) => (
               <div 
                 key={s.name} 
                 className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all cursor-pointer group relative overflow-hidden flex flex-col"
                 onClick={() => handleSubjectClick(s.name)}
               >
                 <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                   <ChevronRight className="w-6 h-6 text-indigo-600" />
                 </div>
                 <div className="flex items-center justify-between mb-6">
                   <h3 className="text-xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{s.name}</h3>
                   <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase border ${
                     s.grade.startsWith("A") ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                     s.grade.startsWith("B") ? "bg-blue-50 text-blue-600 border-blue-100" :
                     "bg-rose-50 text-rose-600 border-rose-100"
                   }`}>{s.grade}</span>
                 </div>
                 
                 <div className="space-y-4 mt-auto">
                   <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-400">
                     <span>Mastery Level</span>
                     <span className="text-slate-800">{s.progress}%</span>
                   </div>
                   <div className="w-full h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100 shadow-inner">
                     <div 
                       className={`h-full rounded-full transition-all duration-1000 ${s.color} shadow-sm`} 
                       style={{ width: `${s.progress}%` }} 
                     />
                   </div>
                   <div className="flex items-center gap-2 pt-2">
                     <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg ${
                       s.trendDir === "up" ? "bg-emerald-50 text-emerald-600" :
                       s.trendDir === "down" ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-400"
                     }`}>
                       {s.trendDir === "up" && <ArrowUp className="w-3 h-3" />}
                       {s.trendDir === "down" && <ArrowDown className="w-3 h-3" />}
                       {s.trendDir === "stable" && <Minus className="w-3 h-3" />}
                       <span>{s.trend}</span>
                     </div>
                   </div>
                 </div>
               </div>
             ))}
           </div>
        </div>

        {/* Performance Trend Chart */}
        <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Chronological Mastery Audit</h3>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"/><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Math</span></div>
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"/><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Science</span></div>
              </div>
           </div>
           <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--slate-100))" />
                  <XAxis dataKey="month" stroke="hsl(var(--slate-400))" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                  <YAxis domain={[60, 100]} stroke="hsl(var(--slate-400))" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}
                  />
                  <Line type="monotone" dataKey="math" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981' }} activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="science" stroke="#3b82f6" strokeWidth={4} dot={{ r: 6, fill: '#3b82f6' }} activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="english" stroke="#f97316" strokeWidth={4} dot={{ r: 6, fill: '#f97316' }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
           </div>
        </div>

      </div>
  );
};

export default PerformancePage;
