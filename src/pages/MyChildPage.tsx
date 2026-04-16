import { useState, useEffect, useMemo, useRef } from "react";
import { Loader2, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, TrendingUp, MessageSquare, FileText, BookOpen, Calendar, BarChart3, Activity, AlertCircle, Edit, X, Save } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc } from "firebase/firestore";
import { useAuth } from "../lib/AuthContext";
import { toast } from "sonner";

// ── Tokens ───────────────────────────────────────────────────────────────────
const T = {
  bg: "#f8fafc", white: "#fff", ink: "#0f172a", ink2: "#475569", ink3: "#94a3b8",
  bdr: "#e2e8f0", s1: "#f1f5f9", s2: "#e2e8f0",
  blue: "#3B5BDB", blBg: "#EDF2FF",
  grn: "#16a34a", glBg: "#f0fdf4", red: "#dc2626", rlBg: "#fef2f2",
  amb: "#d97706", alBg: "#fffbeb",
};
const toDate = (v: any): Date | null => { if (!v) return null; if (v?.toDate) return v.toDate(); if (v?.seconds) return new Date(v.seconds * 1000); const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const timeAgo = (v: any) => { const d = toDate(v); if (!d) return ""; const s = (Date.now()-d.getTime())/1000; if (s<3600) return `${Math.floor(s/60)}m ago`; if (s<86400) return `${Math.floor(s/3600)}h ago`; return d.toLocaleDateString("en-IN",{day:"2-digit",month:"short"}).toUpperCase(); };

// ── 3D Card ──────────────────────────────────────────────────────────────────
const Card = ({children,title,action,style}:{children:React.ReactNode;title?:string;action?:React.ReactNode;style?:React.CSSProperties}) => {
  const [tilt,setTilt] = useState({x:0,y:0});
  const [hov,setHov] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e:React.MouseEvent) => { if (!ref.current) return; const r=ref.current.getBoundingClientRect(); setTilt({x:(((e.clientY-r.top)/r.height)-0.5)*-8,y:(((e.clientX-r.left)/r.width)-0.5)*8}); };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>{setTilt({x:0,y:0});setHov(false);}}
      style={{position:"relative",background:T.white,border:`1px solid ${hov?"rgba(59,91,219,0.25)":T.bdr}`,borderRadius:16,overflow:"hidden",
        transform:`perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) ${hov?"translateY(-4px) scale(1.01)":""}`,
        transition:"transform 0.2s ease,border-color 0.3s,box-shadow 0.3s",willChange:"transform",
        boxShadow:hov?"0 20px 40px rgba(59,91,219,0.1),0 8px 16px rgba(0,0,0,0.06)":"0 1px 3px rgba(0,0,0,0.04)",...style}}>
      {hov&&<div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:1,borderRadius:16,background:`radial-gradient(circle at ${(tilt.y/8+0.5)*100}% ${(-tilt.x/8+0.5)*100}%,rgba(59,91,219,0.06) 0%,transparent 60%)`}}/>}
      {title&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:`1px solid ${T.s2}`,position:"relative",zIndex:2}}><span style={{fontSize:14,fontWeight:600,color:T.ink}}>{title}</span>{action||null}</div>}
      <div style={{padding:"16px 20px",position:"relative",zIndex:2}}>{children}</div>
    </div>
  );
};
const DLink = () => <span style={{fontSize:11,color:T.blue,fontWeight:500,cursor:"pointer"}}>Details →</span>;

// ═══════════════════════════════════════════════════════════════════════════════
const MyChildPage = () => {
  const { studentData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [testScores, setTestScores] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [parentNotes, setParentNotes] = useState<any[]>([]);
  const [calMonth, setCalMonth] = useState(new Date());
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ dob: "", bloodGroup: "", parentPhone: "", emergencyContact: "" });

  const sid = studentData?.id || studentData?.studentId || "";
  const sName = studentData?.name || studentData?.studentName || "My Child";
  const email = (studentData?.email || "").toLowerCase();

  useEffect(() => {
    if (!sid) { setLoading(false); return; }
    setForm({ dob: studentData?.dob || "", bloodGroup: studentData?.bloodGroup || "", parentPhone: studentData?.parentPhone || "", emergencyContact: studentData?.emergencyContact || "" });

    const byId = (col: string) => query(collection(db, col), where("studentId", "==", sid));
    const unsubs: (() => void)[] = [];

    unsubs.push(onSnapshot(byId("attendance"), snap => {
      setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    unsubs.push(onSnapshot(byId("parent_notes"), snap => {
      setParentNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    const run = async () => {
      setLoading(true);
      try {
        const merge = async (col: string) => {
          const [s1, s2] = await Promise.all([getDocs(byId(col)), email ? getDocs(query(collection(db, col), where("studentEmail", "==", email))) : Promise.resolve(null as any)]);
          const l: any[] = []; if (s1) s1.docs.forEach(d => l.push({ id: d.id, ...d.data() })); if (s2) s2.docs.forEach(d => { if (!l.find(x => x.id === d.id)) l.push({ id: d.id, ...d.data() }); }); return l;
        };
        setTestScores([...(await merge("test_scores")), ...(await merge("results"))]);
        setSubmissions(await merge("submissions"));
        const classId = studentData?.classId || (await merge("enrollments"))[0]?.classId;
        if (classId) { const as2 = await getDocs(query(collection(db, "assignments"), where("classId", "==", classId))); setAssignments(as2.docs.map(d => ({ id: d.id, ...d.data() }))); }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    run();
    return () => unsubs.forEach(u => u());
  }, [sid]);

  const handleSave = async () => {
    if (!sid) return; setSaving(true);
    try { await updateDoc(doc(db, "students", sid), form); toast.success("Profile updated!"); setEditOpen(false); }
    catch { toast.error("Failed to update."); } finally { setSaving(false); }
  };

  // ── Metrics ────────────────────────────────────────────────────────────────
  const m = useMemo(() => {
    const tot = attendance.length, pres = attendance.filter(r => r.status === "present").length, late = attendance.filter(r => r.status === "late").length;
    const abs = tot - pres - late, attRate = tot > 0 ? ((pres + late) / tot) * 100 : 0;
    const vals = testScores.map(t => Number(t.percentage ?? t.score ?? 0)).filter(n => !isNaN(n) && n > 0);
    const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const subScores: Record<string, number> = {}, subCounts: Record<string, number> = {};
    testScores.forEach(t => { const sub = (t.subject || t.subjectName || "General").toUpperCase(); const p = Number(t.percentage ?? t.score ?? 0); if (isNaN(p) || p <= 0) return; subScores[sub] = (subScores[sub] || 0) + p; subCounts[sub] = (subCounts[sub] || 0) + 1; });
    Object.keys(subScores).forEach(k => { subScores[k] = Math.round(subScores[k] / subCounts[k]); });
    const now = new Date();
    const monthly = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1); const mA = attendance.filter(r => { const dt = toDate(r.date); return dt && dt.getMonth() === d.getMonth() && dt.getFullYear() === d.getFullYear(); }); const mS = testScores.filter(t => { const dt = toDate(t.timestamp || t.createdAt); return dt && dt.getMonth() === d.getMonth() && dt.getFullYear() === d.getFullYear(); }); const mP = mA.filter(r => r.status === "present" || r.status === "late").length; return { month: MONTHS[d.getMonth()], score: Math.round(mS.map(t => Number(t.percentage ?? t.score ?? 0)).filter(n => !isNaN(n) && n > 0).reduce((a, b, _, arr) => a + b / arr.length, 0)), attendance: Math.round(mA.length > 0 ? (mP / mA.length) * 100 : 0) }; });
    const completion = assignments.length > 0 ? (submissions.length / assignments.length) * 100 : 0;
    return { tot, pres, late, abs, attRate, avg, subScores, monthly, completion, subCount: submissions.length, asgCount: assignments.length };
  }, [attendance, testScores, submissions, assignments]);

  const subEntries = Object.entries(m.subScores);
  const radarData = subEntries.map(([s, sc]) => ({ subject: s.slice(0, 10), score: sc, fullMark: 100 }));
  const initials = sName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  const calY = calMonth.getFullYear(), calM = calMonth.getMonth();
  const firstD = new Date(calY, calM, 1).getDay(), dim = new Date(calY, calM + 1, 0).getDate();
  const calDays = Array.from({ length: 42 }, (_, i) => { const dn = i - firstD + 1; if (dn < 1 || dn > dim) return null; const d = new Date(calY, calM, dn); const ds = d.toISOString().split("T")[0]; const rec = attendance.find(a => { const ad = toDate(a.date); return ad && ad.toISOString().split("T")[0] === ds; }); return { dayNum: dn, date: d, status: rec?.status || null }; });
  const calP = attendance.filter(a => { const d = toDate(a.date); return d && d.getMonth() === calM && d.getFullYear() === calY && a.status === "present"; }).length;
  const calL = attendance.filter(a => { const d = toDate(a.date); return d && d.getMonth() === calM && d.getFullYear() === calY && a.status === "late"; }).length;
  const calA = attendance.filter(a => { const d = toDate(a.date); return d && d.getMonth() === calM && d.getFullYear() === calY && a.status === "absent"; }).length;
  const scoreHist = [...testScores].sort((a, b) => (toDate(b.timestamp || b.createdAt)?.getTime() || 0) - (toDate(a.timestamp || a.createdAt)?.getTime() || 0)).slice(0, 6);
  const barData = [...scoreHist].reverse().map(t => ({ name: (t.subject || "TEST").slice(0, 8), score: Number(t.percentage ?? t.score ?? 0) }));
  const today = new Date();

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 10 }}><Loader2 className="animate-spin" size={20} color={T.blue} /><span style={{ fontSize: 13, color: T.ink3 }}>Loading profile...</span></div>;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter',-apple-system,sans-serif" }}>
      {/* Top */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.ink }}>My Child's Profile</h1>
        <button onClick={() => setEditOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: T.blue, color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Edit size={13} /> Edit Profile</button>
      </div>

      {/* Hero 3-col */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px 1fr", gap: 20, marginBottom: 20 }}>
        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Academic Performance">
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div style={{ position: "relative", width: 64, height: 64 }}><svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke={T.s2} strokeWidth="6" /><circle cx="32" cy="32" r="26" fill="none" stroke={T.blue} strokeWidth="6" strokeLinecap="round" strokeDasharray={2*Math.PI*26} strokeDashoffset={2*Math.PI*26*(1-m.avg/100)} transform="rotate(-90 32 32)" style={{transition:"stroke-dashoffset 1s"}} /></svg><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:T.blue}}>{(m.avg/25).toFixed(1)}</div></div>
              <div><div style={{fontSize:28,fontWeight:800,color:T.ink}}>{Math.round(m.avg)}%</div><div style={{fontSize:11,color:T.ink3}}>Avg // {testScores.length} tests</div></div>
            </div>
            {subEntries.slice(0,5).map(([sub,sc])=><div key={sub} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{fontSize:11,color:T.ink3,width:100,flexShrink:0}}>{sub}</span><div style={{flex:1,height:6,background:T.s1,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${sc}%`,background:sc>=75?T.blue:sc>=50?T.amb:T.red,borderRadius:3}}/></div><span style={{fontSize:12,fontWeight:600,color:sc>=75?T.blue:sc>=50?T.amb:T.red,width:30,textAlign:"right"}}>{sc}</span></div>)}
          </Card>
          <Card title="Attendance">
            <div style={{display:"flex",alignItems:"center",gap:16}}>
              <div style={{position:"relative",width:72,height:72}}><svg width="72" height="72" viewBox="0 0 72 72"><circle cx="36" cy="36" r="28" fill="none" stroke={T.s2} strokeWidth="7"/><circle cx="36" cy="36" r="28" fill="none" stroke={m.attRate>=85?T.grn:T.amb} strokeWidth="7" strokeLinecap="round" strokeDasharray={2*Math.PI*28} strokeDashoffset={2*Math.PI*28*(1-m.attRate/100)} transform="rotate(-90 36 36)" style={{transition:"stroke-dashoffset 1s"}}/></svg><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:m.attRate>=85?T.grn:T.amb}}>{Math.round(m.attRate)}%</div></div>
              <div><div style={{fontSize:15,fontWeight:600,color:T.ink}}>Present</div><div style={{fontSize:12,color:T.ink3,marginTop:2}}>Late: {m.late} // Abs: {m.abs}</div></div>
            </div>
          </Card>
          <Card title="Subject Mastery" action={<DLink/>}>
            {radarData.length>=3&&<div style={{height:180,marginBottom:12}}><ResponsiveContainer width="100%" height="100%"><RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}><PolarGrid stroke={T.s2}/><PolarAngleAxis dataKey="subject" tick={{fill:T.ink3,fontSize:10}}/><Radar dataKey="score" stroke={T.blue} fill={T.blue} fillOpacity={0.15} strokeWidth={2}/></RadarChart></ResponsiveContainer></div>}
            {subEntries.map(([sub,sc])=><div key={sub} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><span style={{fontSize:11,color:T.ink3,width:90,flexShrink:0}}>{sub}</span><div style={{flex:1,height:6,background:T.s1,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${sc}%`,background:sc>=75?T.blue:sc>=50?T.grn:T.red,borderRadius:3}}/></div><span style={{fontSize:12,fontWeight:600,color:T.ink,width:28,textAlign:"right"}}>{sc}</span></div>)}
          </Card>
        </div>

        {/* CENTER */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",paddingTop:20}}>
          <div style={{width:140,height:140,borderRadius:"50%",border:`4px solid ${T.blue}`,background:T.blBg,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16,boxShadow:"0 8px 30px rgba(59,91,219,0.15)"}}><span style={{fontSize:42,fontWeight:800,color:T.blue}}>{initials}</span></div>
          <h2 style={{fontSize:20,fontWeight:700,color:T.ink,textAlign:"center",marginBottom:4}}>{sName}</h2>
          <p style={{fontSize:12,color:T.ink3,textAlign:"center",marginBottom:4}}>{studentData?.className||studentData?.class||studentData?.grade||"—"}</p>
          <p style={{fontSize:11,color:T.ink3,textAlign:"center",marginBottom:6}}>Roll: {studentData?.rollNo||"—"}</p>
          {/* Personal info */}
          <div style={{width:"100%",marginTop:8}}>
            {[{l:"DOB",v:studentData?.dob||form.dob||"—"},{l:"Blood",v:studentData?.bloodGroup||form.bloodGroup||"—"},{l:"Phone",v:studentData?.parentPhone||form.parentPhone||"—"},{l:"Email",v:email||"—"}].map(r=>
              <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.s2}`,fontSize:11}}>
                <span style={{color:T.ink3}}>{r.l}</span><span style={{color:T.ink,fontWeight:500}}>{r.v}</span>
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:6,marginTop:12}}>
            <span style={{padding:"4px 12px",borderRadius:20,background:T.glBg,color:T.grn,fontSize:10,fontWeight:600}}>ACTIVE</span>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card title="Quick Overview">
            {[{icon:FileText,l:"TOTAL TESTS",v:testScores.length},{icon:BookOpen,l:"SUBJECTS",v:subEntries.length},{icon:Activity,l:"AVG ATTENDANCE",v:`${Math.round(m.attRate)}%`},{icon:BarChart3,l:"ASSIGNMENT RATE",v:`${Math.round(m.completion)}%`},{icon:MessageSquare,l:"TEACHER NOTES",v:parentNotes.filter(n=>n.from==="teacher").length}].map(item=>
              <div key={item.l} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.s2}`}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}><item.icon size={14} color={T.ink3}/><span style={{fontSize:12,color:T.ink3}}>{item.l}</span></div>
                <span style={{fontSize:13,fontWeight:600,color:T.ink}}>{item.v}</span>
              </div>
            )}
          </Card>
          <Card title="Teacher Messages" action={<DLink/>}>
            {parentNotes.filter(n=>n.from==="teacher").slice(0,3).map(n=><div key={n.id} style={{padding:"8px 0",borderBottom:`1px solid ${T.s2}`}}>
              <div style={{fontSize:10,color:T.blue,fontWeight:600,marginBottom:2}}>{n.teacherName||"TEACHER"} // {timeAgo(n.createdAt)}</div>
              <p style={{fontSize:12,color:T.ink2,lineHeight:1.5,margin:0}}>{(n.content||n.message||"").slice(0,100)}</p>
            </div>)}
            {parentNotes.filter(n=>n.from==="teacher").length===0&&<p style={{fontSize:12,color:T.ink3,textAlign:"center"}}>No messages from teachers</p>}
          </Card>
          <Card title="Teacher Observations">
            {parentNotes.filter(n=>n.from==="teacher").length>0?<div style={{padding:"10px 14px",background:T.blBg,borderLeft:`3px solid ${T.blue}`,borderRadius:8}}><p style={{fontSize:12,color:T.ink2,lineHeight:1.6,margin:0,fontStyle:"italic"}}>"{(parentNotes.find(n=>n.from==="teacher")?.content||"").slice(0,150)}"</p></div>:<p style={{fontSize:12,color:T.ink3,textAlign:"center"}}>No observations yet</p>}
          </Card>
        </div>
      </div>

      {/* Performance Timeline */}
      <Card title="Performance Timeline" action={<DLink/>} style={{marginBottom:20}}>
        <div style={{height:200}}><ResponsiveContainer width="100%" height="100%"><AreaChart data={m.monthly}><defs><linearGradient id="pb1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.blue} stopOpacity={0.15}/><stop offset="95%" stopColor={T.blue} stopOpacity={0}/></linearGradient><linearGradient id="pb2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.grn} stopOpacity={0.15}/><stop offset="95%" stopColor={T.grn} stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={T.s2}/><XAxis dataKey="month" tick={{fill:T.ink3,fontSize:11}}/><YAxis tick={{fill:T.ink3,fontSize:11}} domain={[0,100]}/><Tooltip contentStyle={{background:T.white,border:`1px solid ${T.bdr}`,borderRadius:8,fontSize:12}}/><Area type="monotone" dataKey="score" stroke={T.blue} fill="url(#pb1)" strokeWidth={2.5}/><Area type="monotone" dataKey="attendance" stroke={T.grn} fill="url(#pb2)" strokeWidth={2} strokeDasharray="5 3"/></AreaChart></ResponsiveContainer></div>
      </Card>

      {/* Calendar + Score History */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
        <Card title="Attendance Calendar">
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,marginBottom:14}}>
            <button onClick={()=>setCalMonth(new Date(calY,calM-1))} style={{background:"none",border:"none",cursor:"pointer",color:T.ink3}}><ChevronLeft size={16}/></button>
            <span style={{fontSize:13,fontWeight:600,color:T.ink}}>{MONTHS[calM]} {calY}</span>
            <button onClick={()=>setCalMonth(new Date(calY,calM+1))} style={{background:"none",border:"none",cursor:"pointer",color:T.ink3}}><ChevronRight size={16}/></button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
            {[{v:calP,c:T.grn,l:"PRESENT"},{v:calL,c:T.amb,l:"LATE"},{v:calA,c:T.red,l:"ABSENT"}].map(x=><div key={x.l} style={{textAlign:"center",padding:"10px 0",background:x.c===T.grn?T.glBg:x.c===T.amb?T.alBg:T.rlBg,borderRadius:10}}><div style={{fontSize:20,fontWeight:700,color:x.c}}>{x.v}</div><div style={{fontSize:10,color:x.c}}>{x.l}</div></div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,textAlign:"center"}}>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} style={{fontSize:10,fontWeight:600,color:T.ink3,padding:"4px 0"}}>{d}</div>)}
            {calDays.map((d,i)=>{if(!d)return<div key={i}/>;const isT=d.date.toDateString()===today.toDateString();const bg=d.status==="present"?T.grn:d.status==="late"?T.amb:d.status==="absent"?T.red:"transparent";return<div key={i} style={{width:32,height:32,borderRadius:isT?"50%":8,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:isT?700:400,color:d.status?"#fff":T.ink,background:isT&&!d.status?T.blue:bg,...(isT&&!d.status?{color:"#fff"}:{})}}>{d.dayNum}</div>;})}
          </div>
        </Card>
        <Card title={`Score History · ${testScores.length} records`}>
          {barData.length>0&&<div style={{height:150,marginBottom:12}}><ResponsiveContainer width="100%" height="100%"><BarChart data={barData}><CartesianGrid strokeDasharray="3 3" stroke={T.s2}/><XAxis dataKey="name" tick={{fill:T.ink3,fontSize:9}}/><YAxis tick={{fill:T.ink3,fontSize:9}} domain={[0,100]}/><Tooltip contentStyle={{background:T.white,border:`1px solid ${T.bdr}`,borderRadius:8,fontSize:11}}/><Bar dataKey="score" fill={T.blue} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>}
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["SUBJECT","DATE","SCORE"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",fontSize:10,color:T.ink3,fontWeight:600,borderBottom:`1px solid ${T.s2}`}}>{h}</th>)}</tr></thead><tbody>{scoreHist.map(t=>{const d=toDate(t.timestamp||t.createdAt);return<tr key={t.id} style={{borderBottom:`1px solid ${T.s2}`}}><td style={{padding:"8px",color:T.ink}}>{(t.subject||"TEST").slice(0,20)}</td><td style={{padding:"8px",color:T.ink3}}>{d?d.toLocaleDateString("en-IN",{day:"2-digit",month:"short"}).toUpperCase():"—"}</td><td style={{padding:"8px",fontWeight:600,color:T.blue}}>{Number(t.percentage??t.score??0)}%</td></tr>;})}</tbody></table>
        </Card>
      </div>

      {/* ═══ EDIT PROFILE MODAL ═══ */}
      {editOpen && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(4px)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>setEditOpen(false)}>
          <div style={{background:T.white,borderRadius:20,width:"100%",maxWidth:400,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:`1px solid ${T.s2}`}}>
              <h3 style={{fontSize:16,fontWeight:600,color:T.ink,margin:0}}>Edit Profile</h3>
              <button onClick={()=>setEditOpen(false)} style={{width:28,height:28,border:"none",background:T.s1,borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={14} color={T.ink3}/></button>
            </div>
            <div style={{padding:20,display:"flex",flexDirection:"column",gap:14}}>
              {[{l:"Date of Birth",k:"dob",t:"date"},{l:"Blood Group",k:"bloodGroup",t:"text"},{l:"Parent Phone",k:"parentPhone",t:"tel"},{l:"Emergency Contact",k:"emergencyContact",t:"tel"}].map(f=>(
                <div key={f.k}><label style={{fontSize:11,fontWeight:600,color:T.ink3,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6,display:"block"}}>{f.l}</label>
                <input type={f.t} value={(form as any)[f.k]} onChange={e=>setForm({...form,[f.k]:e.target.value})} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${T.bdr}`,background:T.s1,fontSize:13,color:T.ink,outline:"none"}} /></div>
              ))}
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button onClick={()=>setEditOpen(false)} style={{flex:1,padding:"10px",borderRadius:10,border:`1px solid ${T.bdr}`,background:T.white,color:T.ink2,fontSize:13,fontWeight:500,cursor:"pointer"}}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{flex:1,padding:"10px",borderRadius:10,border:"none",background:T.blue,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",opacity:saving?0.7:1}}>
                  {saving?<Loader2 size={14} className="animate-spin"/>:"Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyChildPage;