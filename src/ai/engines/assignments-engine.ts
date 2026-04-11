import { getAssignmentIntelligencePrompt } from "../prompts/assignments-prompt";
import { callAI } from "../utils/callAI";

export async function generateAssignmentInsights(data: any): Promise<any> {
  const prompt = getAssignmentIntelligencePrompt(data);
  return callAI(prompt, {
    model: "gpt-4o",
    systemPrompt: "You are an AI Assignment Companion for a student/parent dashboard. Return ONLY valid JSON.",
  });
}
