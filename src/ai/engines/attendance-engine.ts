import { callAI } from "../utils/callAI";

export async function generateAttendanceInsights(data: any): Promise<any> {
  const prompt = `
    Analyze this student's attendance correlation for their parent.

    CONTEXT:
    Student Name: ${data.student_name}
    Attendance Rate: ${data.attendance_rate}
    Late Logs: ${data.late_days}
    Absent Logs: ${data.absent_days}

    OBJECTIVE:
    Provide an AI narrative explaining how this specific attendance pattern correlates with academic success.
    Format as JSON:
    {
      "correlation_narrative": "...",
      "impact_analysis": ["point 1", "point 2", "point 3"],
      "growth_strategy": "..."
    }
  `;
  return callAI(prompt);
}
