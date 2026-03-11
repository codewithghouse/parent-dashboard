import { ArrowLeft, BookOpen, FileText, PlayCircle, Star, User, Calculator, FlaskConical, Globe, Monitor, Palette, Languages } from "lucide-react";

interface Topic {
  name: string;
  score: number;
}

interface TestScore {
  name: string;
  date: string;
  score: string;
  status: "success" | "warning" | "error";
}

interface SubjectDetailProps {
  subject: string;
  teacher: string;
  grade: string;
  average: number;
  topics: Topic[];
  testScores: TestScore[];
  feedback: string;
  onBack: () => void;
}

const getSubjectIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("math")) return <Calculator className="w-8 h-8 text-edu-blue" />;
  if (n.includes("science")) return <FlaskConical className="w-8 h-8 text-edu-green" />;
  if (n.includes("english")) return <Languages className="w-8 h-8 text-edu-orange" />;
  if (n.includes("social")) return <Globe className="w-8 h-8 text-edu-purple" />;
  if (n.includes("computer")) return <Monitor className="w-8 h-8 text-edu-navy" />;
  if (n.includes("art")) return <Palette className="w-8 h-8 text-edu-red" />;
  return <BookOpen className="w-8 h-8 text-edu-blue" />;
};

const getIconBg = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("math")) return "bg-edu-blue/10";
  if (n.includes("science")) return "bg-edu-green/10";
  if (n.includes("english")) return "bg-edu-orange/10";
  if (n.includes("social")) return "bg-edu-purple/10";
  if (n.includes("computer")) return "bg-edu-navy/10";
  if (n.includes("art")) return "bg-edu-red/10";
  return "bg-edu-blue/10";
};

export const SubjectPerformanceDetail = ({
  subject,
  teacher,
  grade,
  average,
  topics,
  testScores,
  feedback,
  onBack,
}: SubjectDetailProps) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Back Button */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Performance Overview</span>
        </button>
      </div>

      {/* Header Card */}
      <div className="bg-card rounded-2xl border border-border p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
        <div className="flex items-center gap-6">
          <div className={`w-20 h-20 rounded-2xl ${getIconBg(subject)} flex items-center justify-center shadow-inner`}>
             {getSubjectIcon(subject)}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">{subject}</h1>
            <div className="flex items-center gap-2 text-muted-foreground mt-1">
              <User className="w-4 h-4" />
              <span className="text-lg font-medium">Teacher: {teacher}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-8 md:gap-16 w-full md:w-auto justify-around border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-16">
          <div className="text-center">
            <p className="text-5xl font-black text-edu-green tracking-tighter">{grade}</p>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mt-1">Current Grade</p>
          </div>
          <div className="text-center">
            <p className="text-5xl font-black text-foreground tracking-tighter">{average}%</p>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mt-1">Average</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Topic Performance */}
        <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-foreground">Topic Performance</h3>
            <span className="text-xs font-bold text-muted-foreground px-2 py-1 bg-muted rounded uppercase tracking-widest">Weightage Based</span>
          </div>
          <div className="space-y-8">
            {topics.map((topic) => (
              <div key={topic.name} className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="font-semibold text-foreground text-lg">{topic.name}</span>
                  <span className={`font-bold text-lg ${topic.score >= 80 ? "text-edu-green" : topic.score >= 70 ? "text-edu-orange" : "text-edu-red"}`}>
                    {topic.score}%
                  </span>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      topic.score >= 80 ? "bg-edu-green" : 
                      topic.score >= 70 ? "bg-edu-orange" : "bg-edu-red"
                    }`}
                    style={{ width: `${topic.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Test Scores */}
        <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-foreground">Recent Test Scores</h3>
            <button className="text-edu-blue text-sm font-bold hover:underline">View All</button>
          </div>
          <div className="space-y-4">
            {testScores.map((test, index) => (
              <div key={index} className="flex items-center justify-between p-5 rounded-2xl border border-border/40 bg-muted/10 hover:bg-muted/20 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${
                    test.status === "success" ? "bg-edu-green/10 text-edu-green" :
                    test.status === "warning" ? "bg-edu-orange/10 text-edu-orange" :
                    "bg-edu-red/10 text-edu-red"
                  }`}>
                    {test.score.includes("/") ? test.score.split("/")[0] : test.score}
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground group-hover:text-edu-blue transition-colors">{test.name}</h4>
                    <p className="text-sm text-muted-foreground">{test.date}</p>
                  </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full font-bold text-sm ${
                  test.status === "success" ? "bg-edu-green/10 text-edu-green" :
                  test.status === "warning" ? "bg-edu-orange/10 text-edu-orange" :
                  "bg-edu-red/10 text-edu-red"
                }`}>
                  {test.score}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Teacher Feedback */}
        <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
          <h3 className="text-xl font-bold text-foreground mb-6">Teacher Feedback</h3>
          <div className="bg-edu-green/5 p-8 rounded-3xl border border-edu-green/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-edu-green/5 rounded-full -mr-16 -mt-16" />
            <span className="text-7xl text-edu-green/10 font-serif absolute -top-2 left-4 select-none">“</span>
            <p className="text-foreground/80 text-lg leading-relaxed italic relative z-10 pl-4 py-2">
              {feedback}
            </p>
            <div className="mt-6 flex items-center gap-3 pl-4">
              <div className="w-10 h-10 rounded-full bg-edu-green/20 flex items-center justify-center">
                <User className="w-5 h-5 text-edu-green" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{teacher}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Subject Teacher</p>
              </div>
            </div>
          </div>
        </div>

        {/* Suggested Resources */}
        <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
          <h3 className="text-xl font-bold text-foreground mb-6">Suggested Resources</h3>
          <div className="grid grid-cols-1 gap-4">
             <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/10 hover:bg-edu-blue/5 transition-all cursor-pointer border border-transparent hover:border-edu-blue/20 group">
                <div className="w-12 h-12 rounded-xl bg-edu-blue/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <PlayCircle className="w-6 h-6 text-edu-blue" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground group-hover:text-edu-blue transition-colors">Trigonometry Basics Video</p>
                  <p className="text-xs text-muted-foreground">Video Lecture • 15 mins</p>
                </div>
                <span className="text-xs font-bold text-edu-blue bg-edu-blue/10 px-3 py-1 rounded-full uppercase">Watch</span>
             </div>
             <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/10 hover:bg-edu-orange/5 transition-all cursor-pointer border border-transparent hover:border-edu-orange/20 group">
                <div className="w-12 h-12 rounded-xl bg-edu-orange/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6 text-edu-orange" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground group-hover:text-edu-orange transition-colors">Algebra Practice Set</p>
                  <p className="text-xs text-muted-foreground">PDF Document • 2.4 MB</p>
                </div>
                <span className="text-xs font-bold text-edu-orange bg-edu-orange/10 px-3 py-1 rounded-full uppercase">Download</span>
             </div>
             <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/10 hover:bg-edu-purple/5 transition-all cursor-pointer border border-transparent hover:border-edu-purple/20 group">
                <div className="w-12 h-12 rounded-xl bg-edu-purple/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Star className="w-6 h-6 text-edu-purple" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground group-hover:text-edu-purple transition-colors">Calculus Mastery Guide</p>
                  <p className="text-xs text-muted-foreground">Article • 8 mins read</p>
                </div>
                <span className="text-xs font-bold text-edu-purple bg-edu-purple/10 px-3 py-1 rounded-full uppercase">Read</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
