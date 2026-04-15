// ── AI Practice Engine v3 — Uses callAI (parentAIProxy) for real AI ──────────
import { callAI } from "../utils/callAI";

// ── Generate exam via real AI ─────────────────────────────────────────────────
export const generateAIExam = async (data: {
  text: string;
  topic: string;
  difficulty: string;
  questionType: string;
  questionCount: number;
}): Promise<{ title: string; questions: any[] }> => {

  const typeInstructions: Record<string, string> = {
    mcq: `All questions must be MCQ with 4 options (A,B,C,D). "options" array must have 4 strings. "correctAnswer" must exactly match one option.`,
    fill_blank: `All questions must be fill-in-the-blank. "questionText" has a ________ blank. "options" must be empty array []. "correctAnswer" is the missing word/phrase.`,
    true_false: `All questions must be True/False. "options" must be ["True","False"]. "correctAnswer" is "True" or "False".`,
    short_answer: `All questions must be short answer (2-3 sentence response). "options" must be empty array []. "correctAnswer" is the model answer.`,
    mix: `Use a MIX of mcq, fill_blank, true_false, and short_answer types. Distribute evenly.`,
  };

  const prompt = `You are an expert exam generator for school students.

STUDY MATERIAL TEXT:
"""
${data.text.slice(0, 6000)}
"""

TASK: Generate exactly ${data.questionCount} practice questions.

SETTINGS:
- Topic: ${data.topic}
- Difficulty: ${data.difficulty}
- ${typeInstructions[data.questionType] || typeInstructions.mcq}

CRITICAL RULES:
- Every question MUST be based on facts from the study material above
- Options for MCQ must include plausible distractors related to the topic
- Explanations must reference the study material
- For ${data.difficulty}: ${{Easy:"straightforward recall questions",Medium:"application and understanding questions",Hard:"analysis and critical thinking questions"}[data.difficulty] || "medium difficulty"}

Return ONLY this JSON (no markdown, no extra text):
{
  "title": "Short exam title",
  "questions": [
    {
      "questionNo": 1,
      "type": "mcq",
      "questionText": "Clear question text here?",
      "options": ["Option A","Option B","Option C","Option D"],
      "correctAnswer": "Option B",
      "explanation": "Explanation referencing the study material"
    }
  ]
}`;

  const result = await callAI(prompt, {
    jsonMode: true,
    systemPrompt: "You are a precise exam question generator. Return ONLY valid JSON. No markdown fences.",
  });

  if (result?.questions?.length > 0) {
    // Sanitize: ensure all questions have required fields
    result.questions.forEach((q: any, i: number) => {
      q.questionNo = i + 1;
      if (!q.type) q.type = "mcq";
      if (!q.options) q.options = [];
      if (!q.correctAnswer) q.correctAnswer = q.options?.[0] || "N/A";
      if (!q.explanation) q.explanation = "See study material for details.";
    });
    return result;
  }

  throw new Error("AI returned empty questions");
};

// ── Evaluate exam via real AI ─────────────────────────────────────────────────
export const evaluateAIExam = async (data: {
  questions: any[];
  answers: string[];
  studentName: string;
}): Promise<any> => {

  const qaPairs = data.questions.map((q, i) =>
    `Q${q.questionNo} [${q.type}]: ${q.questionText}\nCorrect: ${q.correctAnswer}\nStudent answered: ${data.answers[i] || "(blank)"}`
  ).join("\n\n");

  const prompt = `You are a kind but accurate exam evaluator for a school student named ${data.studentName}.

QUESTIONS AND ANSWERS:
${qaPairs}

TASK: Evaluate each answer. For short_answer type, be lenient — accept if the meaning is similar.

Return ONLY this JSON:
{
  "score": <correct count>,
  "total": ${data.questions.length},
  "percentage": <rounded percentage>,
  "grade": "A/B/C/D based on percentage (A>=80, B>=60, C>=40, D<40)",
  "evaluations": [
    {
      "questionNo": 1,
      "correct": true,
      "studentAnswer": "what they wrote",
      "correctAnswer": "right answer",
      "explanation": "If wrong: explain WHY in simple language so student learns. If correct: brief praise."
    }
  ],
  "weakTopics": ["topic names where student was wrong"],
  "encouragement": "Motivating message for the student based on their score"
}`;

  const result = await callAI(prompt, {
    jsonMode: true,
    systemPrompt: "You are a helpful exam evaluator. Return ONLY valid JSON.",
  });

  if (result?.evaluations) return result;
  throw new Error("AI evaluation failed");
};

// ── Local fallback evaluator (instant, no AI needed) ──────────────────────────
export const evaluateLocalExam = (data: {
  questions: any[];
  answers: string[];
  studentName: string;
}) => {
  let score = 0;
  const evaluations: any[] = [];
  const wrongTopics = new Set<string>();

  data.questions.forEach((q, i) => {
    const studentAns = (data.answers[i] || "").trim();
    const correctAns = (q.correctAnswer || "").trim();
    const sLower = studentAns.toLowerCase();
    const cLower = correctAns.toLowerCase();

    let isCorrect = false;
    if (q.type === "mcq" || q.type === "true_false") {
      isCorrect = sLower === cLower;
    } else if (q.type === "fill_blank") {
      isCorrect = sLower === cLower || cLower.includes(sLower) || sLower.includes(cLower);
    } else if (q.type === "short_answer") {
      const cWords = cLower.split(/\s+/).filter(w => w.length > 3);
      const sWords = sLower.split(/\s+/).filter(w => w.length > 3);
      const matches = cWords.filter(w => sWords.some(sw => sw.includes(w) || w.includes(sw)));
      isCorrect = matches.length >= Math.max(2, Math.floor(cWords.length * 0.3));
    }

    if (isCorrect) score++;
    else {
      const tw = q.questionText.match(/[A-Z][a-z]{3,}/g);
      if (tw?.[0]) wrongTopics.add(tw[0]);
    }

    evaluations.push({
      questionNo: q.questionNo, correct: isCorrect,
      studentAnswer: studentAns || "(no answer)",
      correctAnswer: correctAns,
      explanation: isCorrect ? "Correct! Well done." : q.explanation || `The correct answer is "${correctAns}".`,
    });
  });

  const total = data.questions.length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const grade = percentage >= 80 ? "A" : percentage >= 60 ? "B" : percentage >= 40 ? "C" : "D";
  const msgs: Record<string, string> = {
    A: `Outstanding, ${data.studentName}! You've mastered this!`,
    B: `Great work, ${data.studentName}! Review wrong answers to perfect your knowledge.`,
    C: `Good effort, ${data.studentName}! Focus on weak areas and try again.`,
    D: `Keep going, ${data.studentName}! Review the material and retake — you'll improve!`,
  };
  return { score, total, percentage, grade, evaluations, weakTopics: Array.from(wrongTopics).slice(0, 5), encouragement: msgs[grade] };
};