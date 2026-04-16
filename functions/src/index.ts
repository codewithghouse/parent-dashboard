import * as functions from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import OpenAI from "openai";
import axios from "axios";
const pdf = require('pdf-parse');

admin.initializeApp();

// ── Secret Manager — key stored securely, never in source code ───────────────
// To set: firebase secrets:set OPENAI_API_KEY
// Then deploy: firebase deploy --only functions
const openaiApiKey = defineSecret("OPENAI_API_KEY");

// ── Original tutor function (kept for backward compatibility) ─────────────────
export const getParentAITutor = functions
  .runWith({ secrets: [openaiApiKey], timeoutSeconds: 60, memory: "512MB" })
  .https.onCall(async (data, context) => {
    try {
        const { pdfUrl, title, description, question, type, topic, target_class, students_count } = data;
        const openai = new OpenAI({ apiKey: openaiApiKey.value() });

        console.log("AI Request Type:", type || "tutor");

        let pdfText = "";
        if (pdfUrl) {
            try {
                const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(response.data);
                const pdfData = await pdf(buffer);
                pdfText = pdfData.text.replace(/\r?\n|\r/g, " ");
            } catch (err) {
                console.warn("PDF scan failed, continuing with context only.");
            }
        }

        let systemPrompt = "You are a friendly AI Tutor for Edullent.";
        let userPrompt = `Context: ${description}\nText: ${pdfText}\nQuery: ${question}`;

        if (type === "calibration") {
            systemPrompt = "You are an expert Curriculum Designer for Edullent.";
            userPrompt = `Generate a calibrated assignment for Class: ${target_class} (${students_count} students) on Topic: ${topic || title}. Return JSON with: generated_assignment { title, description }.`;
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" }
        });

        return { status: "success", data: JSON.parse(completion.choices[0].message.content!) };

    } catch (error: any) {
        console.error("AI Function Error:", error);
        return { status: "error", message: error.message };
    }
});

// ── Universal AI proxy — replaces all client-side OpenAI calls ────────────────
// Accepts: { prompt, systemPrompt?, jsonMode?, imageBase64?, model? }
// Returns: { content: string } — caller parses JSON if needed
export const parentAIProxy = functions
  .runWith({ secrets: [openaiApiKey], timeoutSeconds: 60, memory: "512MB" })
  .https.onCall(async (data, context) => {
    // Auth gate — only logged-in parents can call
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Login required.");
    }

    const openai = new OpenAI({ apiKey: openaiApiKey.value() });

    const {
      prompt,
      systemPrompt = "You are Edullent AI, a friendly educational assistant for school students and their parents. Always respond in simple, encouraging language.",
      jsonMode = true,
      imageBase64,
      model,
    } = data;

    if (!prompt) {
      throw new functions.https.HttpsError("invalid-argument", "prompt is required.");
    }

    try {
      const messages: any[] = [{ role: "system", content: systemPrompt }];

      if (imageBase64) {
        messages.push({
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            { type: "text", text: prompt },
          ],
        });
      } else {
        messages.push({ role: "user", content: prompt });
      }

      const resolvedModel = imageBase64 ? "gpt-4o" : (model || "gpt-4o-mini");

      const completion = await openai.chat.completions.create({
        model: resolvedModel,
        messages,
        max_tokens: 1500,
        ...(jsonMode && !imageBase64 ? { response_format: { type: "json_object" } } : {}),
      });

      const content = completion.choices[0]?.message?.content ?? "";
      return { content };

    } catch (error: any) {
      console.error("parentAIProxy error:", error);
      throw new functions.https.HttpsError("internal", error.message || "AI call failed");
    }
  });
