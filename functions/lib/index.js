"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAITutorGuidance = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const openai_1 = require("openai");
const axios_1 = require("axios");
const pdf = require('pdf-parse');
admin.initializeApp();
const openai = new openai_1.default({
    apiKey: "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"
});
exports.getAITutorGuidance = functions.https.onCall(async (data, context) => {
    try {
        const { pdfUrl, title, description, question } = data;
        console.log("AI Tutoring Request:", title);
        let pdfText = "";
        if (pdfUrl) {
            console.log("Downloading PDF:", pdfUrl);
            const response = await axios_1.default.get(pdfUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data);
            const pdfData = await pdf(buffer);
            pdfText = pdfData.text.replace(/\r?\n|\r/g, " ");
        }
        const systemPrompt = `
You are a friendly and motivating AI Tutor for EduIntellect.
Help students understand their assignments without giving direct answers.
        `;
        const userPrompt = `
Assignment: ${title}
Context: ${description}
Text content: ${pdfText.substring(0, 15000)}

Student Query: ${question || "Analyze this."}

Return JSON with: tutor_analysis, action_plan, assignment_hints, discussion_points.
        `;
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" }
        });
        return { status: "success", data: JSON.parse(completion.choices[0].message.content) };
    }
    catch (error) {
        console.error("AI Function Error:", error);
        return { status: "error", message: error.message };
    }
});
//# sourceMappingURL=index.js.map