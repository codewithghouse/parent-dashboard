import { useState, useEffect } from "react";
import { 
  TrendingUp, TrendingDown, Minus, Info, Calendar, 
  Sparkles, BrainCircuit, ShieldAlert, Loader2, CheckCircle2,
  AlertTriangle, MessageSquare
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

const BehaviourPage = () => {
  const { studentData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [risks, setRisks] = useState<any[]>([]);
  const [stats, setStats] = useState({
    positive: 0,
    neutral: 1, // Default to 1 to simulate baseline
    negative: 0,
    sentiment: "Neutral"
  });

  useEffect(() => {
    if (!studentData?.id) return;

    setLoading(true);
    const q = query(
      collection(db, "risks"),
      where("studentId", "==", studentData.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRisks(data);

      const neg = data.filter((r: any) => !r.resolved && (r.severity === 'Critical' || r.severity === 'High Priority')).length;
      const pos = data.filter((r: any) => r.resolved).length;
      
      setStats({
        positive: pos,
        neutral: data.length === 0 ? 1 : 0,
        negative: neg,
        sentiment: neg > 1 ? "Attention Required" : neg === 1 ? "Monitor Closely" : pos > 0 ? "Improving" : "Stable"
      });
      setLoading(false);
    }, (error) => {
      console.error("Behaviour Sync Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [studentData]);

  const trendData = [
    { month: "Jan", positive: 65, negative: 10 },
    { month: "Feb", positive: 70, negative: 8 },
    { month: "Mar", positive: 68, negative: 12 },
    { month: "Apr", positive: 72, negative: 5 },
  ];

  return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-12">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Behaviour Analytics</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px] mt-1">Institutional records of conduct & classroom engagement</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="px-5 py-2.5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Sentiment: {stats.sentiment}</span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           {/* Conduct Insights */}
           <div className="lg:col-span-8 space-y-8">
              <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-10 shadow-sm relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-all transform group-hover:rotate-12">
                    <BrainCircuit className="w-32 h-32 text-indigo-600" />
                 </div>
                 
                 <div className="relative z-10">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-8 flex items-center gap-2">
                       <Sparkles className="w-4 h-4" /> AI Behavioral Synthesis
                    </h3>
                    {loading ? (
                        <div className="py-10">
                            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        </div>
                    ) : risks.length === 0 ? (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 leading-tight flex items-center gap-3">
                                No Recorded Conduct Issues <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            </h2>
                            <div className="p-6 bg-slate-50 border-l-4 border-emerald-500 rounded-2xl">
                                <p className="text-sm font-bold text-slate-600 leading-relaxed italic">
                                    "The feature will work automatically after real-time conduct updates are logged by the faculty. Currently, {studentData?.name || "the student"} maintains a baseline profile."
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 leading-tight">
                                Conduct Audit: {risks.length} entries detected.
                            </h2>
                            <p className="text-sm font-bold text-slate-500 max-w-xl leading-relaxed">
                                Latest observation: <span className="text-indigo-600 font-extrabold">{risks[0].issue}</span>
                            </p>
                        </div>
                    )}
                    
                    <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
                       <ConductMetric label="Positive Markers" value={stats.positive} icon={<TrendingUp className="w-4 h-4 text-emerald-500" />} />
                       <ConductMetric label="Baselines" value={stats.neutral} icon={<Minus className="w-4 h-4 text-slate-400" />} />
                       <ConductMetric label="Escalations" value={stats.negative} icon={<TrendingDown className="w-4 h-4 text-rose-500" />} />
                    </div>
                 </div>
              </div>

              {/* Behaviour Trend Chart */}
              <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm">
                 <div className="flex items-center justify-between mb-8">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Conduct Trajectory</h3>
                    <div className="flex gap-4">
                       <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-500" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conduct</span></div>
                    </div>
                 </div>
                 <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={trendData}>
                          <defs>
                             <linearGradient id="colorPos" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                             </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--slate-100))" />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={10} fontWeight="black" stroke="hsl(var(--slate-400))" dy={10} />
                          <YAxis axisLine={false} tickLine={false} fontSize={10} fontWeight="black" stroke="hsl(var(--slate-400))" />
                          <Tooltip 
                             contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                          />
                          <Area type="monotone" dataKey="positive" stroke="#4f46e5" fillOpacity={1} fill="url(#colorPos)" strokeWidth={4} />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           {/* Alerts & Notifications */}
           <div className="lg:col-span-4 space-y-8">
              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
                 <ShieldAlert className="absolute -right-8 -bottom-8 w-40 h-40 text-white/5 group-hover:scale-110 transition-transform duration-700" />
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8">Conduct Watch</h3>
                 
                 <div className="space-y-6">
                    {risks.length === 0 ? (
                        <div className="p-6 bg-white/5 border border-white/10 rounded-3xl">
                             <div className="flex items-start gap-4 mb-4">
                                <Info className="w-5 h-5 text-indigo-400 shrink-0" />
                                <p className="text-xs font-bold text-indigo-100">AI behavioral watch will activate upon real data entry.</p>
                             </div>
                        </div>
                    ) : (
                        risks.slice(0, 3).map((risk: any, i: number) => (
                           <div key={i} className={`p-6 rounded-3xl border ${risk.severity === 'Critical' ? 'bg-rose-500/10 border-rose-500/30' : 'bg-white/5 border-white/10'}`}>
                              <div className="flex items-start gap-4 mb-4">
                                 <AlertTriangle className={`w-5 h-5 ${risk.severity === 'Critical' ? 'text-rose-400' : 'text-indigo-400'} shrink-0`} />
                                 <div>
                                    <p className="text-sm font-black text-white leading-tight mb-2">{risk.issue}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date().toLocaleDateString()}</p>
                                 </div>
                              </div>
                              <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                                 Acknowledge Log
                              </button>
                           </div>
                        ))
                    )}
                 </div>
              </div>

              <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm">
                 <div className="flex items-center gap-3 mb-8">
                    <MessageSquare className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Counselling Pulse</h3>
                 </div>
                 <p className="text-xs font-bold text-slate-400 mb-10 leading-relaxed uppercase tracking-widest">
                    AI-Driven guidance based on classroom dynamics and socio-emotional indicators.
                 </p>
                 <button onClick={() => window.location.href = '/messages'} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 hover:-translate-y-1 transition-all shadow-xl shadow-indigo-100">
                    Connect with Counselor
                 </button>
              </div>
           </div>
        </div>
      </div>
  );
};

const ConductMetric = ({ label, value, icon }: any) => (
  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group">
     <div className="flex items-center justify-between mb-3">
        <div className="text-slate-800">{icon}</div>
        <p className="text-2xl font-black text-slate-800 tracking-tighter transition-transform group-hover:scale-110">{value}</p>
     </div>
     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
  </div>
);

export default BehaviourPage;
