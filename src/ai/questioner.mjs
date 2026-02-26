import { sendMessage, extractJSON, MODELS } from './client.mjs';

const SYSTEM_PROMPT = `You are VBS (Virtual Based Scenography). Based on the analyzed API request, generate 5-12 precise technical configuration questions.

ALWAYS include questions about:
- Port number (id: "port", type: "input", default: "3000", validate: "port_number")

Include IF relevant:
- Database name, user, password (if a DB is in the stack)
- JWT secret handling (auto-generate vs custom) — use type "list"
- CORS allowed origins (default "*")
- Rate limiting enable/disable — use type "confirm"
- Environment: development vs production — use type "list"
- Additional features mentioned in the request

Return ONLY valid JSON (no markdown, no explanation):
{
  "questions": [
    {
      "id": "snake_case_identifier",
      "type": "input" | "list" | "confirm",
      "message": "Human-readable question?",
      "default": "default_value_or_boolean",
      "choices": ["Option A", "Option B"],
      "validate": "port_number"
    }
  ]
}

Notes:
- "choices" is only required for type "list"
- "default" for "confirm" must be true or false (boolean)
- "validate" is optional; only use "port_number" for port fields
- Keep messages short and clear`;

/**
 * Generate configuration questions based on the analysis.
 * @param {object} analysis       - Result from analyzeRequest()
 * @param {string} originalPrompt - The user's original prompt
 * @returns {Promise<Array>}      - Array of question objects
 */
export async function generateQuestions(analysis, originalPrompt) {
  const userMessage = `Original request: ${originalPrompt}

Analysis:
${JSON.stringify(analysis, null, 2)}

Generate precise technical configuration questions for this API.`;

  const text = await sendMessage(MODELS.OPUS, SYSTEM_PROMPT, userMessage, 2048);
  const parsed = extractJSON(text);
  return parsed.questions;
}
