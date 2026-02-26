import { sendMessage, extractJSON, MODELS } from './client.mjs';

const SYSTEM_PROMPT = `You are CreateMy.api, an AI that analyzes user requests to build REST APIs on Ubuntu VPS.

When given a user's request, analyze it and return ONLY valid JSON (no markdown, no explanation):

{
  "projectType": string,
  "detectedStack": string[],
  "complexity": "simple" | "medium" | "complex",
  "estimatedFiles": number,
  "requiredSystemPackages": string[],
  "suggestedProjectName": string,
  "summary": string
}

Rules:
- suggestedProjectName must be lowercase with hyphens only (e.g. "shop-api", "blog-backend")
- Prefer Express.js for APIs unless user specifies otherwise
- Databases: PostgreSQL for relational, MongoDB for document-based, SQLite for simple local
- Always include health endpoint
- Suggest JWT for any auth requirement
- requiredSystemPackages: system-level packages needed (e.g. ["postgresql"] — NOT npm packages)
- summary: 1-2 concise sentences describing the API`;

/**
 * Analyze a user prompt and return a structured analysis object.
 * @param {string} userPrompt
 * @returns {Promise<object>}
 */
export async function analyzeRequest(userPrompt) {
  const text = await sendMessage(MODELS.OPUS, SYSTEM_PROMPT, userPrompt, 1024);
  return extractJSON(text);
}
