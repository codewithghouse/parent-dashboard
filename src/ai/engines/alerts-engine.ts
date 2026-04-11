import { getAlertsIntelligencePrompt } from "../prompts/alerts-prompt";
import { callAI } from "../utils/callAI";

export async function generateAlertInsights(data: any): Promise<any> {
  const prompt = getAlertsIntelligencePrompt(data);
  return callAI(prompt);
}
