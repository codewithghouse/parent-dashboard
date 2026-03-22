import { Star, Trophy, Leaf, MessageCircle, Clock, FileText, Info, Sparkles, TrendingUp, Handshake, Brain } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/lib/AuthContext";

const positiveHighlights = [
  { text: "Helped a classmate understand a difficult math concept", date: "Jan 10, 2026", by: "Mrs. Priya Patel", icon: <Brain className="w-4 h-4 text-indigo-500" /> },
  { text: "Volunteered for class cleanup duty", date: "Jan 5, 2026", by: "Class Monitor", icon: <Leaf className="w-4 h-4 text-emerald-500" /> },
  { text: "Asked thoughtful questions during Science discussion", date: "Dec 28, 2025", by: "Mr. Rajesh Kumar", icon: <MessageCircle className="w-4 h-4 text-blue-500" /> },
];

const improvements = [
  { text: "Arrived late to class twice this month", detail: "Jan 20 & 27, 2026", icon: <Clock className="w-4 h-4 text-amber-500" /> },
  { text: "Forgot to bring homework notebook once", detail: "Jan 8, 2026", icon: <FileText className="w-4 h-4 text-rose-500" /> },
];

const trendData = [
  { month: "Aug", rating: 3.8 },
  { month: "Sep", rating: 3.9 },
  { month: "Oct", rating: 4.0 },
  { month: "Nov", rating: 4.1 },
  { month: "Dec", rating: 4.0 },
  { month: "Jan", rating: 4.2 },
];

const BehaviourPage = () => {
    const { studentData } = useAuth();

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-12">
            
            {/* Header section */}
            <div className="space-y-1">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                    Behaviour & Character <Handshake className="w-8 h-8 text-indigo-600" />
                </h1>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">Holistic development tracking for {studentData?.name || "Student"}</p>
            </div>

            {/* Overall Rating Card */}
            <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Trophy className="w-32 h-32 text-indigo-600" />
                </div>
                
                <div className="relative z-10 w-full md:w-auto text-center md:text-left">
                    <h2 className="text-xl font-black text-slate-800 tracking-tight mb-2">Character Excellence Score</h2>
                    <p className="text-sm font-bold text-slate-400 max-w-md">Comprehensive analysis based on teacher feedback, peer interaction, and discipline records.</p>
                </div>

                <div className="flex flex-col items-center gap-4 relative z-10">
                    <div className="flex items-baseline gap-2">
                        <span className="text-6xl font-black text-slate-900 tracking-tighter">4.2</span>
                        <span className="text-xl font-black text-slate-300">/ 5.0</span>
                    </div>
                    <div className="flex gap-1.5 item-center justify-center p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                        {[1, 2, 3, 4].map((i) => <Star key={i} className="w-6 h-6 fill-indigo-500 text-indigo-500" />)}
                        <Star className="w-6 h-6 text-indigo-200" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 bg-white px-4 py-2 rounded-full border border-indigo-100 shadow-sm">Consistent Performer</p>
                </div>
            </div>

            {/* Highlights Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Positive Highlights */}
                <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                                <Trophy className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest">Merit Achievements</h3>
                        </div>
                        <Sparkles className="w-5 h-5 text-amber-400" />
                    </div>
                    
                    <div className="space-y-4">
                        {positiveHighlights.map((h, idx) => (
                            <div key={idx} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-emerald-50/50 hover:border-emerald-100 transition-all group">
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center group-hover:scale-110 transition-transform">
                                        {h.icon}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 leading-tight mb-2">{h.text}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{h.date}</span>
                                            <div className="w-1 h-1 rounded-full bg-slate-200" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">By {h.by}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Improvements Section */}
                <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                                <Info className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest text-rose-800">Growth Focus Areas</h3>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        {improvements.map((h, idx) => (
                            <div key={idx} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-rose-50/50 hover:border-rose-100 transition-all group">
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center group-hover:scale-110 transition-transform">
                                        {h.icon}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 leading-tight mb-2">{h.text}</p>
                                        <span className="text-[9px] font-black uppercase tracking-widest text-rose-400">{h.detail}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-6 p-6 bg-slate-900 rounded-[1.5rem] text-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <MessageCircle className="w-16 h-16" />
                        </div>
                        <p className="text-xs font-bold leading-relaxed relative z-10 italic">
                            "Aditya is showing great maturity in group dynamics, though focusing on punctuality in morning assemblies will further enhance his leadership score."
                        </p>
                    </div>
                </div>
            </div>

            {/* Chart Trend */}
            <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <TrendingUp className="w-6 h-6 text-indigo-600" />
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest">Character Trend (Aug - Jan)</h3>
                    </div>
                </div>
                
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                            <defs>
                                <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                                dataKey="month" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} 
                                dy={10}
                            />
                            <YAxis 
                                domain={[3, 5]} 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} 
                            />
                            <Tooltip 
                                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                itemStyle={{ fontWeight: 800, color: '#4f46e5' }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="rating" 
                                stroke="#4f46e5" 
                                strokeWidth={4} 
                                fillOpacity={1} 
                                fill="url(#colorRating)" 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default BehaviourPage;
