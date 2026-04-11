import { getAlertsGeneratorPrompt } from "../prompts/alerts-generator-prompt";
import { callAI } from "../utils/callAI";

export async function generateNewStudentAlerts(studentContext: any): Promise<any[]> {
  const prompt = getAlertsGeneratorPrompt(studentContext);

  try {
    const parsed = await callAI(prompt);

    // Robust recovery: find alerts array wherever it lives in the response
    let finalAlerts: any[] = [];
    if (parsed.alerts && Array.isArray(parsed.alerts)) {
      finalAlerts = parsed.alerts;
    } else if (parsed.notifications && Array.isArray(parsed.notifications)) {
      finalAlerts = parsed.notifications;
    } else if (Array.isArray(parsed)) {
      finalAlerts = parsed;
    } else {
      const firstArr = Object.values(parsed).find(v => Array.isArray(v)) as any[];
      if (firstArr) finalAlerts = firstArr;
    }

    return finalAlerts.map(a => ({
      ...a,
      title:          a.title          || "Academic Update",
      description:    a.description    || "The AI is analyzing the latest trends.",
      recommendation: a.recommendation || "",
      category:       a.category       || "General",
      priority:       a.priority       || "Normal",
      icon:           a.icon           || "AlertCircle",
      color:          a.color          || "indigo",
    }));
  } catch {
    return [];
  }
}
