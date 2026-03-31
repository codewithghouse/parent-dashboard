import { getAssignmentIntelligencePrompt } from "../prompts/assignments-prompt";

export async function generateAssignmentInsights(data: any): Promise<any> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error("API Key missing");
  
  const prompt = getAssignmentIntelligencePrompt(data);
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json", 
      "Authorization": `Bearer ${apiKey}` 
    },
    body: JSON.stringify({ 
      model: "gpt-4o", // Upgraded to gpt-4o as requested for better scanning
      messages: [
        { role: "system", content: "You are an AI Assignment Companion for a student/parent dashboard. Return ONLY valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
     const error = await response.text(); // Get raw text to avoid JSON parse issues
     console.error("OpenAI Error Response:", error);
     throw new Error(`API Error: ${response.status} - ${error}`);
  }
  
  const result = await response.json();
  const content = result.choices[0].message.content;
  try {
    return JSON.parse(content);
  } catch (e) {
    console.error("JSON Parsing failed for AI content:", content);
    throw e;
  }
}

