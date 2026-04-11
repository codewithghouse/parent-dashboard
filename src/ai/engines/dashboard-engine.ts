import { getParentDashboardPrompt } from "../prompts/dashboard-prompt";
import { callAI } from "../utils/callAI";

export async function generateParentDashboardInsights(data: any): Promise<any> {
  const prompt = getParentDashboardPrompt(data);
  return callAI(prompt);
}
