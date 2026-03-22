import { getParentDashboardPrompt } from "../prompts/dashboard-prompt";

export async function generateParentDashboardInsights(data: any): Promise<any> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API Key not configured in environment.");
  }

  const prompt = getParentDashboardPrompt(data);

  // Using the same pattern as the teacher dashboard for consistency
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini", 
      input: prompt,
      text: {
        format: {
          type: "json_object"
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API Error: ${response.status}`);
  }

  const result = await response.json();
  let outputData = result.output || result.text || result;

  if (typeof outputData === 'object') {
     return outputData;
  }

  if (typeof outputData === 'string') {
     let cleanText = outputData.replace(/```json/gi, "").replace(/```/g, "").trim();
     try {
       return JSON.parse(cleanText);
     } catch (parseError) {
       console.error("Dashboard Engine failed to parse JSON:", cleanText);
       return null;
     }
  }
  
  return null;
}
