export async function generateWeeklyReport(data: {
  child_name: string;
  grade: string;
  week_start: string;
  week_end: string;
  attendance: { present: number; absent: number; late: number; total: number; pct: number };
  tests: { subject: string; score: number; max: number; grade: string }[];
  assignments: { total: number; submitted: number; pending: number };
  overall_avg: number;
  recent_alerts: string[];
}): Promise<any> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API Key not configured.");

  const prompt = `You are an expert school counselor AI generating a Weekly Progress Report for a parent.

Student: ${data.child_name} (Grade ${data.grade})
Report Period: ${data.week_start} to ${data.week_end}

WEEKLY ATTENDANCE:
- Present: ${data.attendance.present} days
- Absent: ${data.attendance.absent} days
- Late: ${data.attendance.late} days
- Total School Days: ${data.attendance.total}
- Attendance Rate: ${data.attendance.pct}%

TESTS THIS WEEK:
${data.tests.length > 0 ? data.tests.map(t => `- ${t.subject}: ${t.score}/${t.max} (${t.grade})`).join("\n") : "- No tests this week"}

ASSIGNMENTS:
- Total Assigned: ${data.assignments.total}
- Submitted: ${data.assignments.submitted}
- Pending: ${data.assignments.pending}

OVERALL AVERAGE SCORE: ${data.overall_avg > 0 ? data.overall_avg + "%" : "Not enough data yet"}

RECENT ALERTS: ${data.recent_alerts.length > 0 ? data.recent_alerts.join(", ") : "None"}

Generate a warm, parent-friendly Weekly Report JSON with this exact format:
{
  "message": "A 3–4 sentence friendly chat-style message to the parent summarizing the week — mention attendance, performance, and one specific highlight or concern.",
  "attendance_summary": "1-sentence verdict on this week's attendance with context.",
  "test_analysis": "1–2 sentence analysis of test performance this week. If no tests, say so warmly.",
  "assignment_status": "1 sentence on assignment completion rate.",
  "overall_performance": {
    "verdict": "Excellent / Good / Needs Attention / Critical",
    "score_context": "Brief context about the overall average score",
    "trend": "Improving / Stable / Declining"
  },
  "improvement_tips": [
    { "tip": "Short actionable tip", "reason": "Why this matters based on data" },
    { "tip": "Short actionable tip", "reason": "Why this matters based on data" }
  ]
}

Tone: Warm, supportive, like a school counselor talking to a caring parent.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: prompt,
      text: { format: { type: "json_object" } }
    })
  });

  if (!response.ok) throw new Error(`API Error: ${response.status}`);

  const result = await response.json();
  let textContent: string | null = null;

  if (Array.isArray(result.output)) {
    for (const item of result.output) {
      if (item.type === "message" && Array.isArray(item.content)) {
        const textItem = item.content.find((c: any) => c.type === "output_text");
        if (textItem?.text) { textContent = textItem.text; break; }
      }
    }
  }
  if (!textContent && typeof result.text === "string") textContent = result.text;
  if (!textContent) return null;

  const clean = textContent.replace(/```json/gi, "").replace(/```/g, "").trim();
  return JSON.parse(clean);
}
