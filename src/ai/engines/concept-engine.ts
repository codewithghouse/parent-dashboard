import { getConceptIntelligencePrompt, getMasteryAnalysisPrompt } from "../prompts/concept-prompt";

async function callOpenAI(prompt: string): Promise<any> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) throw new Error("OpenAI API Key not configured.");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini", // Use standard model
            messages: [
                { role: "system", content: "You are EduIntellect AI, a cognitive analysis engine." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        })
    });

    if (!response.ok) throw new Error(`OpenAI API Error: ${response.status}`);
    const result = await response.json();
    return JSON.parse(result.choices[0].message.content);
}

export async function generateParentConceptInsights(data: any): Promise<any> {
    try {
        const prompt = getConceptIntelligencePrompt(data);
        return await callOpenAI(prompt);
    } catch (e) {
        console.error("Concept Insights Engine Error:", e);
        return null;
    }
}

export async function analyzeConceptMastery(studentName: string, data: { scores: any[], assignments: any[] }): Promise<any> {
    try {
        const prompt = getMasteryAnalysisPrompt(studentName, data);
        return await callOpenAI(prompt);
    } catch (e) {
        console.error("Mastery Analysis Engine Error:", e);
        return null;
    }
}
