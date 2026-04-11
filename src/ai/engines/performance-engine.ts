import { getPerformancePrompt } from "../prompts/performance-prompt";
import { callAI } from "../utils/callAI";

export async function generateParentPerformanceInsights(data: any): Promise<any> {
  const prompt = getPerformancePrompt(data);
  return callAI(prompt);
}
