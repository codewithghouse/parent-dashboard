import { getConceptIntelligencePrompt, getMasteryAnalysisPrompt } from "../prompts/concept-prompt";
import { callAI } from "../utils/callAI";

// ── Mathematical fallback (no AI needed) ────────────────────────────────────
function getMathematicalFallback(data: any) {
    const scores = data.scores || [];
    const subjectsMap = new Map();

    scores.forEach((s: any) => {
        const sub = s.subject || "General";
        if (!subjectsMap.has(sub)) subjectsMap.set(sub, { total: 0, count: 0, topics: [] });
        const curr = subjectsMap.get(sub);
        curr.total += (s.percentage || 0);
        curr.count += 1;
        if (s.testName) curr.topics.push({ name: s.testName, score: s.percentage || 0 });
    });

    const analysis: any = { subjects: [] };

    subjectsMap.forEach((val, sub) => {
        const avg = val.count > 0 ? Math.round(val.total / val.count) : 0;
        const subjectAnalysis: any = {
            subject: sub,
            overall_mastery: avg,
            mastery_pillars: { strong: [], developing: [], attention_required: [] }
        };

        val.topics.forEach((t: any) => {
            if (t.score >= 80) subjectAnalysis.mastery_pillars.strong.push(t.name);
            else if (t.score >= 55) subjectAnalysis.mastery_pillars.developing.push(t.name);
            else subjectAnalysis.mastery_pillars.attention_required.push(t.name);
        });

        analysis.subjects.push(subjectAnalysis);
    });

    return { status: "success", source: "fallback", data: analysis };
}

export async function generateParentConceptInsights(data: any): Promise<any> {
    try {
        const prompt = getConceptIntelligencePrompt(data);
        return callAI(prompt, {
            systemPrompt: "You are Edullent AI, a cognitive analysis engine.",
        });
    } catch (e) {
        console.info("Concept AI: falling back to mathematical model.", e);
        return null;
    }
}

export async function analyzeConceptMastery(
    studentName: string,
    data: { scores: any[]; assignments: any[]; attendance?: any[]; enrolled_subjects?: string[] }
): Promise<any> {
    try {
        const prompt = getMasteryAnalysisPrompt(studentName, data);
        const aiResult = await callAI(prompt, {
            systemPrompt: "You are Edullent AI, a cognitive analysis engine.",
        });
        return { status: "success", source: "ai", data: aiResult };
    } catch (e) {
        console.info("Mastery AI: falling back to mathematical model.", e);
        return getMathematicalFallback(data);
    }
}
