import { ArrowUp, ArrowDown, Minus, ChevronRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useState } from "react";
import { SubjectPerformanceDetail } from "@/components/performance/SubjectPerformanceDetail";

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
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

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
      <div className="space-y-6">
        {/* Overall Performance */}
        <div className="bg-card rounded-xl border border-border p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Overall Performance</h2>
            <p className="text-sm text-muted-foreground">Based on all assessments this term</p>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <p className="text-5xl font-bold text-foreground">B+</p>
              <p className="text-sm text-muted-foreground">Current Grade</p>
            </div>
            <div className="h-12 w-px bg-border" />
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">78%</p>
              <p className="text-sm text-muted-foreground">Average Score</p>
            </div>
            <div className="h-12 w-px bg-border" />
            <div className="flex items-center gap-2">
              <ArrowUp className="w-5 h-5 text-edu-green" />
              <span className="text-2xl font-bold text-edu-green">+8%</span>
              <span className="text-sm text-muted-foreground">vs last term</span>
            </div>
          </div>
        </div>

        {/* Subject Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((s) => (
            <div 
              key={s.name} 
              className="bg-card rounded-2xl border border-border p-6 shadow-sm hover:shadow-md hover:border-edu-blue/20 transition-all cursor-pointer group relative overflow-hidden"
              onClick={() => handleSubjectClick(s.name)}
            >
              <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="w-5 h-5 text-edu-blue" />
              </div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-foreground group-hover:text-edu-blue transition-colors">{s.name}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wider ${
                  s.grade.startsWith("A") ? "bg-edu-green-light/30 text-edu-green" :
                  s.grade.startsWith("B") ? "bg-edu-blue-light/30 text-edu-blue" :
                  "bg-edu-orange-light/30 text-edu-orange"
                }`}>{s.grade}</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Overall Progress</span>
                  <span className="font-bold text-foreground">{s.progress}%</span>
                </div>
                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden shadow-inner">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${s.color}`} 
                    style={{ width: `${s.progress}%` }} 
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <div className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${
                    s.trendDir === "up" ? "bg-edu-green/10 text-edu-green" :
                    s.trendDir === "down" ? "bg-edu-red/10 text-edu-red" : "bg-muted text-muted-foreground"
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

        {/* Performance Trend */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">Performance Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis domain={[60, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="math" stroke="hsl(var(--edu-green))" name="Mathematics" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="science" stroke="hsl(var(--edu-blue))" name="Science" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="english" stroke="hsl(var(--edu-orange))" name="English" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
  );
};

export default PerformancePage;
