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

  // Extract text from OpenAI Responses API format: result.output is an array of message objects
  let textContent: string | null = null;
  if (Array.isArray(result.output)) {
    for (const item of result.output) {
      if (item.type === "message" && Array.isArray(item.content)) {
        const textItem = item.content.find((c: any) => c.type === "output_text");
        if (textItem?.text) { textContent = textItem.text; break; }
      }
    }
  }
  // Fallback: some API versions return text directly
  if (!textContent && typeof result.text === "string") textContent = result.text;
  if (!textContent && typeof result.output === "string") textContent = result.output;

  if (!textContent) return null;

  const cleanText = textContent.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleanText);
  } catch (parseError) {
    console.error("Dashboard Engine failed to parse JSON:", cleanText);
    return null;
  }
}
