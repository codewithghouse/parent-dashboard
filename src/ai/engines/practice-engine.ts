// ── AI Practice Engine v3 — Uses callAI (parentAIProxy) for real AI ──────────
import { callAI } from "../utils/callAI";

// JSON example shown to the model. The example MUST match the selected
// question type — otherwise the model follows the example over the rule text
// and returns the wrong shape (the bug that bit us when "True/False" was
// generating 4-option MCQs). Same lesson as
// bug_pattern_meta_contradicts_system_prompt.
const jsonExampleFor = (type: string): string => {
  switch (type) {
    case "true_false":
      return `{
  "title": "Short exam title",
  "questions": [
    {
      "questionNo": 1,
      "type": "true_false",
      "questionText": "Photosynthesis converts sunlight into chemical energy.",
      "options": ["True","False"],
      "correctAnswer": "True",
      "explanation": "Explanation referencing the study material"
    }
  ]
}`;
    case "fill_blank":
      return `{
  "title": "Short exam title",
  "questions": [
    {
      "questionNo": 1,
      "type": "fill_blank",
      "questionText": "The process by which plants make food is called ________.",
      "options": [],
      "correctAnswer": "photosynthesis",
      "explanation": "Explanation referencing the study material"
    }
  ]
}`;
    case "short_answer":
      return `{
  "title": "Short exam title",
  "questions": [
    {
      "questionNo": 1,
      "type": "short_answer",
      "questionText": "Explain the role of chlorophyll in photosynthesis.",
      "options": [],
      "correctAnswer": "Chlorophyll absorbs sunlight and powers the conversion of CO2 and water into glucose and oxygen.",
      "explanation": "Explanation referencing the study material"
    }
  ]
}`;
    case "mix":
      return `{
  "title": "Short exam title",
  "questions": [
    { "questionNo": 1, "type": "mcq", "questionText": "...?", "options": ["A","B","C","D"], "correctAnswer": "A", "explanation": "..." },
    { "questionNo": 2, "type": "true_false", "questionText": "...", "options": ["True","False"], "correctAnswer": "True", "explanation": "..." },
    { "questionNo": 3, "type": "fill_blank", "questionText": "The ________ is the powerhouse of the cell.", "options": [], "correctAnswer": "mitochondria", "explanation": "..." },
    { "questionNo": 4, "type": "short_answer", "questionText": "...", "options": [], "correctAnswer": "...", "explanation": "..." }
  ]
}`;
    case "mcq":
    default:
      return `{
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
  }
};

// ── Generate exam via real AI ─────────────────────────────────────────────────
export const generateAIExam = async (data: {
  text: string;
  topic: string;
  difficulty: string;
  questionType: string;
  questionCount: number;
}): Promise<{ title: string; questions: any[] }> => {

  const typeInstructions: Record<string, string> = {
    mcq: `All questions must be MCQ with 4 options (A,B,C,D). "options" array must have 4 strings. "correctAnswer" must exactly match one option. "type" must be "mcq".`,
    fill_blank: `All questions must be fill-in-the-blank. "questionText" has a ________ blank. "options" must be empty array []. "correctAnswer" is the missing word/phrase. "type" must be "fill_blank".`,
    true_false: `All questions must be True/False. "options" must be EXACTLY ["True","False"] — two items only, never four. "correctAnswer" is either "True" or "False". "type" must be "true_false". Do NOT generate MCQ-style options.`,
    short_answer: `All questions must be short answer (2-3 sentence response). "options" must be empty array []. "correctAnswer" is the model answer. "type" must be "short_answer".`,
    mix: `Use a MIX of mcq, fill_blank, true_false, and short_answer types. Distribute evenly. Match "options" shape to each question's type (4 for mcq, 2 for true_false, [] for fill_blank and short_answer).`,
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

Return ONLY this JSON (no markdown, no extra text). The exact shape MUST match this example:
${jsonExampleFor(data.questionType)}`;

  // Token budget scales with question count: ~180 output tokens per MCQ
  // (4 options + explanation) + ~500 tokens overhead. Capped at the
  // server's 6000-token ceiling. Without this hint the server defaults to
  // 4096 which is fine up to ~20 questions but tight beyond that.
  const estimatedMaxTokens = Math.min(6000, Math.max(2048, data.questionCount * 200 + 500));

  const result = await callAI(prompt, {
    jsonMode: true,
    systemPrompt: "You are a precise exam question generator. Return ONLY valid JSON. No markdown fences. Keep explanations to 1-2 sentences each so the response fits the token budget.",
    maxTokens: estimatedMaxTokens,
  });

  if (result?.questions?.length > 0) {
    // Sanitize: ensure all questions have required fields
    result.questions.forEach((q: any, i: number) => {
      q.questionNo = i + 1;
      // Normalize q.type — AI sometimes returns "fill-in-the-blank" (kebab)
      // or "fill in the blank" (spaced) instead of the canonical "fill_blank".
      // Map all variants to the snake_case form the UI + evaluator expect.
      if (q.type) {
        const t = String(q.type).toLowerCase().trim();
        if (t === "fill-in-the-blank" || t === "fill in the blank" || t === "fillblank" || t === "fill_in_the_blank") {
          q.type = "fill_blank";
        } else if (t === "true-false" || t === "true/false" || t === "true false" || t === "truefalse") {
          q.type = "true_false";
        } else if (t === "short-answer" || t === "short answer" || t === "shortanswer") {
          q.type = "short_answer";
        } else if (t === "multiple-choice" || t === "multiple choice" || t === "multiplechoice") {
          q.type = "mcq";
        }
      }
      if (!q.type) q.type = "mcq";
      if (!q.options) q.options = [];
      if (!q.correctAnswer) q.correctAnswer = q.options?.[0] || "N/A";
      if (!q.explanation) q.explanation = "See study material for details.";

      // Safety net — when the user explicitly picked a non-mix type, force
      // every question to that shape. Catches the case where the AI ignores
      // the spec and returns MCQ-shaped options for a true_false request
      // (or vice versa). "mix" is intentionally heterogeneous so skip it.
      if (data.questionType !== "mix") {
        q.type = data.questionType;

        if (data.questionType === "true_false") {
          const opts = (Array.isArray(q.options) ? q.options : []).map((o: any) => String(o).trim());
          const has = (s: string) =>
            opts.some((o: string) => o.toLowerCase() === s);
          // Already correct shape (any order/case) → normalize to ["True","False"]
          if (opts.length === 2 && has("true") && has("false")) {
            q.options = ["True", "False"];
          } else {
            q.options = ["True", "False"];
          }
          // Coerce correctAnswer to "True" or "False"
          const ca = String(q.correctAnswer || "").trim().toLowerCase();
          q.correctAnswer =
            ca.startsWith("t") || ca === "yes" || ca === "y" || ca === "1"
              ? "True"
              : ca.startsWith("f") || ca === "no" || ca === "n" || ca === "0"
              ? "False"
              : "True";
        } else if (data.questionType === "fill_blank" || data.questionType === "short_answer") {
          q.options = [];
        } else if (data.questionType === "mcq") {
          // Ensure at least 4 string options. If AI returned 2 (True/False
          // confusion in the other direction), leave it — better to render
          // 2 buttons than fabricate distractors.
          if (!Array.isArray(q.options)) q.options = [];
        }
      }
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

  // Evaluation output is roughly ~150 tokens per question (eval block +
  // explanation). Scale with the question count, same ceiling.
  const estimatedMaxTokens = Math.min(6000, Math.max(2048, data.questions.length * 180 + 600));

  const result = await callAI(prompt, {
    jsonMode: true,
    systemPrompt: "You are a helpful exam evaluator. Return ONLY valid JSON. Keep each explanation to 1-2 sentences so the response fits the token budget.",
    maxTokens: estimatedMaxTokens,
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