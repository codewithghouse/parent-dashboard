import React from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface WeeklyReportPDFProps {
  report: any;
  studentName: string;
  grade: string;
  attendance: { present: number; absent: number; late: number; total: number; pct: number };
  tests: { subject: string; score: number; max: number; grade: string }[];
  assignments: { total: number; submitted: number; pending: number };
  avgScore: number;
  weekEnd: string;
  onDownload: (ref: React.RefObject<HTMLDivElement>) => void;
}

/* ── Design tokens ─────────────────────────────────────── */
const K = {
  bg:      "#060e1c",
  panel:   "#0b1829",
  border:  "#102240",
  cyan:    "#00d4ff",
  green:   "#00ff88",
  amber:   "#ffaa00",
  orange:  "#ff6b35",
  red:     "#ff3d71",
  white:   "#e2f0ff",
  muted:   "#3d6e99",
  subtext: "#7aaecf",
};

const scoreC = (s: number) => s >= 80 ? K.green : s >= 60 ? K.amber : K.red;
const attC   = (p: number) => p >= 85 ? K.green : p >= 70 ? K.amber : K.red;

/* ── Tiny reusable building blocks ─────────────────────── */

/** Cyber panel with corner brackets */
const Box = ({
  children, style, accent = K.cyan,
}: { children: React.ReactNode; style?: React.CSSProperties; accent?: string }) => (
  <div style={{
    backgroundColor: K.panel, border: `1px solid ${K.border}`,
    borderRadius: 8, padding: "14px 16px", position: "relative",
    overflow: "hidden", ...style,
  }}>
    <span style={{ position:"absolute", top:0, left:0, width:14, height:14,
      borderTop:`2px solid ${accent}`, borderLeft:`2px solid ${accent}`,
      borderRadius:"8px 0 0 0" }} />
    <span style={{ position:"absolute", bottom:0, right:0, width:14, height:14,
      borderBottom:`2px solid ${accent}60`, borderRight:`2px solid ${accent}60`,
      borderRadius:"0 0 8px 0" }} />
    {children}
  </div>
);

/** Section micro-label */
const Tag = ({ label, color = K.cyan }: { label: string; color?: string }) => (
  <div style={{ fontSize:7, fontWeight:700, letterSpacing:"0.2em",
    color, textTransform:"uppercase", marginBottom:8,
    display:"flex", alignItems:"center", gap:5 }}>
    <span style={{ width:10, height:1, background:color, opacity:.7 }} />
    {label}
    <span style={{ width:10, height:1, background:color, opacity:.7 }} />
  </div>
);

/** Big glowing number */
const BigNum = ({ value, color, size = 30 }: { value: string; color: string; size?: number }) => (
  <div style={{ fontSize: size, fontWeight: 900, color,
    textShadow: `0 0 20px ${color}80`, lineHeight: 1 }}>
    {value}
  </div>
);

/** Thin progress bar */
const Bar2 = ({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) => (
  <div style={{ width:"100%", height, background:`${K.border}`, borderRadius:99, overflow:"hidden" }}>
    <div style={{ width:`${Math.min(pct, 100)}%`, height:"100%",
      background: color, borderRadius:99,
      boxShadow:`0 0 6px ${color}80` }} />
  </div>
);

/** Stat row: label + value */
const StatRow = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
    padding:"4px 0", borderBottom:`1px solid ${K.border}` }}>
    <span style={{ fontSize:9, color: K.subtext }}>{label}</span>
    <span style={{ fontSize:10, fontWeight:800, color }}>{value}</span>
  </div>
);

/* ── Main component ─────────────────────────────────────── */
const WeeklyReportPDF = React.forwardRef<HTMLDivElement, WeeklyReportPDFProps>(
  ({ report, studentName, grade, attendance, tests, assignments, avgScore, weekEnd }, ref) => {

    const verdict  = report?.overall_performance?.verdict || "Good";
    const trend    = report?.overall_performance?.trend   || "Stable";
    const vColor   = verdict === "Excellent" ? K.green : verdict === "Good" ? K.cyan
                   : verdict === "Needs Attention" ? K.amber : K.red;
    const tArrow   = trend === "Improving" ? "↑" : trend === "Declining" ? "↓" : "→";
    const tColor   = trend === "Improving" ? K.green : trend === "Declining" ? K.red : K.amber;
    const risk     = avgScore >= 75 ? "LOW" : avgScore >= 55 ? "MEDIUM" : "HIGH";
    const rColor   = risk === "LOW" ? K.green : risk === "MEDIUM" ? K.amber : K.red;

    /* Chart data */
    const attPie = [
      { name:"Present", value: attendance.present, color: K.green },
      { name:"Late",    value: attendance.late,    color: K.amber },
      { name:"Absent",  value: attendance.absent,  color: K.red   },
    ].filter(d => d.value > 0);

    const scorePie = [
      { name:"Score", value: avgScore,        fill: scoreC(avgScore) },
      { name:"Gap",   value: 100 - avgScore,  fill: "#0d1f35" },
    ];

    const assignPie = assignments.total > 0 ? [
      { name:"Done",    value: assignments.submitted, fill: K.green  },
      { name:"Pending", value: assignments.pending,   fill: K.orange },
    ].filter(d => d.value > 0) : [];

    const testBars = tests.length > 0
      ? tests.map(t => ({
          sub:   t.subject.slice(0, 6),
          score: Math.round((t.score / t.max) * 100),
        }))
      : [];

    const tips = report?.improvement_tips?.slice(0, 3) || [];

    return (
      <div ref={ref} style={{
        /* A4 Landscape: 1123 × 794 px */
        width: "1123px", height: "794px",
        backgroundColor: K.bg,
        fontFamily: "'Segoe UI', Arial, sans-serif",
        padding: "22px 26px 18px",
        boxSizing: "border-box",
        color: K.white,
        position: "relative",
        overflow: "hidden",
      }}>

        {/* Grid background */}
        <div style={{ position:"absolute", inset:0, zIndex:0,
          backgroundImage:`
            linear-gradient(rgba(0,212,255,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.035) 1px, transparent 1px)`,
          backgroundSize:"44px 44px" }} />

        {/* Top-right glow blob */}
        <div style={{ position:"absolute", top:-80, right:-80, width:320, height:320,
          borderRadius:"50%",
          background:"radial-gradient(circle, rgba(0,212,255,0.07) 0%, transparent 70%)",
          zIndex:0 }} />

        <div style={{ position:"relative", zIndex:1, height:"100%",
          display:"flex", flexDirection:"column", gap:10 }}>

          {/* ══ HEADER ══ */}
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", borderBottom:`1px solid ${K.border}`,
            paddingBottom:10 }}>

            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              {/* Avatar */}
              <div style={{ width:46, height:46, borderRadius:10,
                background:`linear-gradient(135deg,${K.cyan}25,${K.cyan}06)`,
                border:`2px solid ${K.cyan}50`,
                boxShadow:`0 0 16px ${K.cyan}30`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:16, fontWeight:900, color:K.cyan }}>
                {studentName.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2)}
              </div>
              <div>
                <div style={{ fontSize:7, color:K.cyan, letterSpacing:"0.2em",
                  fontWeight:700, textTransform:"uppercase", marginBottom:3 }}>
                  ◈ Edullent AI · Weekly Report
                </div>
                <div style={{ fontSize:20, fontWeight:900, lineHeight:1, color:K.white }}>
                  {studentName}
                </div>
                <div style={{ fontSize:9, color:K.muted, marginTop:2 }}>
                  Grade {grade} · Week ending {weekEnd}
                </div>
              </div>
            </div>

            {/* Verdict + Trend */}
            <div style={{ display:"flex", gap:12, alignItems:"center" }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:7, color:K.muted, letterSpacing:"0.1em", marginBottom:4 }}>TREND</div>
                <div style={{ fontSize:22, fontWeight:900, color:tColor,
                  textShadow:`0 0 16px ${tColor}` }}>{tArrow}</div>
                <div style={{ fontSize:8, color:tColor, fontWeight:700 }}>{trend.toUpperCase()}</div>
              </div>
              <div style={{ width:1, height:40, background:K.border }} />
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:7, color:K.muted, letterSpacing:"0.1em", marginBottom:4 }}>RISK</div>
                <div style={{ fontSize:14, fontWeight:900, color:rColor,
                  background:`${rColor}15`, border:`1px solid ${rColor}40`,
                  borderRadius:6, padding:"4px 12px",
                  boxShadow:`0 0 12px ${rColor}30` }}>{risk}</div>
              </div>
              <div style={{ width:1, height:40, background:K.border }} />
              <div style={{ padding:"8px 20px", borderRadius:8,
                background:`${vColor}12`, border:`1px solid ${vColor}45`,
                boxShadow:`0 0 20px ${vColor}25`, textAlign:"center" }}>
                <div style={{ fontSize:7, color:K.muted, letterSpacing:"0.1em", marginBottom:4 }}>VERDICT</div>
                <div style={{ fontSize:15, fontWeight:900, color:vColor }}>{verdict}</div>
              </div>
            </div>
          </div>

          {/* ══ MAIN ROW ══ */}
          <div style={{ display:"flex", gap:10, flex:1, overflow:"hidden" }}>

            {/* ── COL 1: Attendance ── */}
            <Box style={{ width:162 }} accent={attC(attendance.pct)}>
              <Tag label="Attendance" color={attC(attendance.pct)} />
              <BigNum value={`${attendance.pct}%`} color={attC(attendance.pct)} size={28} />
              <div style={{ fontSize:8, color:K.muted, marginBottom:8 }}>Present rate</div>

              <div style={{ display:"flex", justifyContent:"center" }}>
                <PieChart width={120} height={100}>
                  <Pie data={attPie} cx={56} cy={48} innerRadius={30} outerRadius={46}
                    dataKey="value" strokeWidth={0}>
                    {attPie.map((d,i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:5, marginTop:4 }}>
                {attPie.map(d => (
                  <div key={d.name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ width:6, height:6, borderRadius:2,
                        background:d.color, boxShadow:`0 0 4px ${d.color}`,
                        display:"inline-block" }} />
                      <span style={{ fontSize:8, color:K.subtext }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize:9, fontWeight:800, color:d.color }}>{d.value}d</span>
                  </div>
                ))}
              </div>
            </Box>

            {/* ── COL 2: Avg Score Gauge ── */}
            <Box style={{ width:162 }} accent={scoreC(avgScore)}>
              <Tag label="Avg Score" color={scoreC(avgScore)} />
              <BigNum value={avgScore > 0 ? `${avgScore}%` : "N/A"} color={scoreC(avgScore)} size={28} />
              <div style={{ fontSize:8, color:K.muted, marginBottom:4 }}>Overall performance</div>

              <div style={{ display:"flex", justifyContent:"center" }}>
                <PieChart width={120} height={100}>
                  <Pie data={scorePie} cx={56} cy={48} innerRadius={28} outerRadius={46}
                    startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
                    {scorePie.map((d,i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                </PieChart>
              </div>

              <div style={{ marginTop:6 }}>
                <Bar2 pct={avgScore} color={scoreC(avgScore)} height={5} />
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                  <span style={{ fontSize:7, color:K.muted }}>0</span>
                  <span style={{ fontSize:7, color:K.muted }}>50</span>
                  <span style={{ fontSize:7, color:K.muted }}>100</span>
                </div>
              </div>

              {/* Grade scale */}
              <div style={{ display:"flex", gap:3, marginTop:8, justifyContent:"center" }}>
                {[["A+","≥90",K.green],["A","≥80",K.green],["B","≥70",K.cyan],["C","<70",K.amber]].map(([g,r,c])=>(
                  <div key={g} style={{ flex:1, background:`${c}15`, border:`1px solid ${c}30`,
                    borderRadius:4, padding:"3px 0", textAlign:"center" }}>
                    <div style={{ fontSize:8, fontWeight:800, color:c as string }}>{g}</div>
                    <div style={{ fontSize:6, color:K.muted }}>{r}</div>
                  </div>
                ))}
              </div>
            </Box>

            {/* ── COL 3: Test Results ── */}
            <Box style={{ flex:1 }} accent={K.cyan}>
              <Tag label="Test Results" />

              {testBars.length > 0 ? (
                <>
                  <div style={{ display:"flex", gap:6, marginBottom:6 }}>
                    {testBars.slice(0,5).map((t,i) => (
                      <div key={i} style={{ flex:1, textAlign:"center" }}>
                        <BigNum value={`${t.score}`} color={scoreC(t.score)} size={20} />
                        <div style={{ fontSize:7, color:K.muted, marginTop:2 }}>%</div>
                      </div>
                    ))}
                  </div>
                  <BarChart width={320} height={140} data={testBars}
                    margin={{ top:2, right:0, left:-28, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={K.border} />
                    <XAxis dataKey="sub" tick={{ fontSize:9, fill:K.muted }}
                      axisLine={{ stroke:K.border }} tickLine={false} />
                    <YAxis domain={[0,100]} tick={{ fontSize:8, fill:K.muted }}
                      axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background:K.panel, border:`1px solid ${K.cyan}40`,
                        borderRadius:6, fontSize:10, color:K.white }}
                      formatter={(v:any) => [`${v}%`,"Score"]} />
                    <Bar dataKey="score" radius={[4,4,0,0]}>
                      {testBars.map((d,i) => <Cell key={i} fill={scoreC(d.score)} />)}
                    </Bar>
                  </BarChart>
                </>
              ) : (
                <div style={{ height:170, display:"flex", alignItems:"center",
                  justifyContent:"center", flexDirection:"column", gap:8 }}>
                  <div style={{ fontSize:28, opacity:.15 }}>◈</div>
                  <div style={{ fontSize:9, color:K.muted }}>No tests this week</div>
                </div>
              )}
            </Box>

            {/* ── COL 4: Assignments ── */}
            <Box style={{ width:148 }} accent={K.orange}>
              <Tag label="Assignments" color={K.orange} />

              <div style={{ display:"flex", gap:10, marginBottom:8, alignItems:"flex-end" }}>
                <div>
                  <BigNum value={`${assignments.submitted}`} color={K.green} size={26} />
                  <div style={{ fontSize:7, color:K.muted }}>submitted</div>
                </div>
                <div style={{ fontSize:16, color:K.border, paddingBottom:8 }}>/</div>
                <div>
                  <BigNum value={`${assignments.total}`} color={K.white} size={20} />
                  <div style={{ fontSize:7, color:K.muted }}>total</div>
                </div>
              </div>

              {assignPie.length > 0 && (
                <div style={{ display:"flex", justifyContent:"center" }}>
                  <PieChart width={110} height={90}>
                    <Pie data={assignPie} cx={52} cy={42} innerRadius={26} outerRadius={40}
                      dataKey="value" strokeWidth={0}>
                      {assignPie.map((d,i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                  </PieChart>
                </div>
              )}

              <div style={{ marginTop:6 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:8, color:K.muted }}>Completion</span>
                  <span style={{ fontSize:9, fontWeight:800, color:K.green }}>
                    {assignments.total > 0 ? Math.round((assignments.submitted/assignments.total)*100) : 0}%
                  </span>
                </div>
                <Bar2
                  pct={assignments.total > 0 ? (assignments.submitted/assignments.total)*100 : 0}
                  color={K.green} height={5} />
              </div>

              <div style={{ marginTop:10 }}>
                <StatRow label="Pending" value={`${assignments.pending}`} color={K.orange} />
                <StatRow label="Done"    value={`${assignments.submitted}`} color={K.green} />
              </div>
            </Box>

            {/* ── COL 5: AI Tips ── */}
            <Box style={{ width:195 }} accent={K.amber}>
              <Tag label="AI Directives" color={K.amber} />

              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {tips.length > 0 ? tips.map((t: { tip: string; reason: string }, i: number) => (
                  <div key={i} style={{
                    background:`${K.amber}08`, border:`1px solid ${K.amber}25`,
                    borderRadius:6, padding:"8px 10px",
                    borderLeft:`3px solid ${K.amber}`,
                  }}>
                    <div style={{ display:"flex", alignItems:"flex-start", gap:6 }}>
                      <span style={{ fontSize:7, fontWeight:900, color:K.amber,
                        background:`${K.amber}20`, borderRadius:3,
                        padding:"2px 5px", flexShrink:0, marginTop:1 }}>
                        {String(i+1).padStart(2,"0")}
                      </span>
                      <div>
                        <div style={{ fontSize:9, fontWeight:700, color:K.white, marginBottom:2, lineHeight:1.3 }}>
                          {t.tip}
                        </div>
                        <div style={{ fontSize:8, color:K.subtext, lineHeight:1.4 }}>
                          {t.reason}
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div style={{ fontSize:9, color:K.muted, fontStyle:"italic" }}>No tips generated.</div>
                )}
              </div>

              {/* AI Message compact */}
              {report?.message && (
                <div style={{ marginTop:10, background:`${K.cyan}08`,
                  border:`1px solid ${K.cyan}20`, borderRadius:6, padding:"8px 10px" }}>
                  <div style={{ fontSize:7, color:K.cyan, fontWeight:700,
                    letterSpacing:"0.1em", marginBottom:4 }}>✦ AI MESSAGE</div>
                  <div style={{ fontSize:8, color:K.subtext, lineHeight:1.5,
                    display:"-webkit-box", WebkitLineClamp:4,
                    WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                    {report.message}
                  </div>
                </div>
              )}
            </Box>

          </div>

          {/* ══ FOOTER ══ */}
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", borderTop:`1px solid ${K.border}`, paddingTop:8 }}>
            <div style={{ fontSize:8, color:K.muted }}>
              ◈ Generated by Edullent AI · {new Date().toLocaleDateString("en-IN",
                { day:"numeric", month:"long", year:"numeric" })}
            </div>
            <div style={{ display:"flex", gap:16 }}>
              {[
                { label:"ATTENDANCE", value:`${attendance.pct}%`, color: attC(attendance.pct) },
                { label:"AVG SCORE",  value: avgScore > 0 ? `${avgScore}%` : "N/A", color: scoreC(avgScore) },
                { label:"SUBMITTED",  value:`${assignments.submitted}/${assignments.total}`, color: K.green },
                { label:"TESTS",      value:`${tests.length}`, color: K.cyan },
              ].map(s => (
                <div key={s.label} style={{ textAlign:"center" }}>
                  <div style={{ fontSize:12, fontWeight:900, color:s.color,
                    textShadow:`0 0 10px ${s.color}60` }}>{s.value}</div>
                  <div style={{ fontSize:6, color:K.muted, letterSpacing:"0.1em" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:8, color:`${K.cyan}70`, fontWeight:700,
              letterSpacing:"0.12em" }}>
              CONFIDENTIAL · PARENT USE ONLY
            </div>
          </div>

        </div>
      </div>
    );
  }
);

WeeklyReportPDF.displayName = "WeeklyReportPDF";
export default WeeklyReportPDF;
