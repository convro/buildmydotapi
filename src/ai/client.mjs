import OpenAI from 'openai';

let _client = null;

// DeepSeek models via OpenAI-compatible API
// OPUS  → deepseek-reasoner (R1) — best reasoning + code generation
// HAIKU → deepseek-chat    (V3) — fast, high-quality for quick tasks
export const MODELS = {
  OPUS:  process.env.AI_MODEL_OPUS  || 'deepseek-reasoner',
  HAIKU: process.env.AI_MODEL_HAIKU || 'deepseek-chat',
};

export function getClient() {
  if (!_client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error(
        'DEEPSEEK_API_KEY not found.\n' +
        'Set it in your .env file or run:\n' +
        '  export DEEPSEEK_API_KEY=sk-...\n' +
        'Get your key at: https://platform.deepseek.com/'
      );
    }
    _client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com',
    });
  }
  return _client;
}

/**
 * Send a single-turn message to the DeepSeek API and return the response text.
 *
 * Uses deepseek-reasoner (R1) for MODELS.OPUS — the most capable model.
 * R1 performs chain-of-thought reasoning internally; temperature is fixed.
 *
 * Uses deepseek-chat (V3) for MODELS.HAIKU — fast, still excellent quality.
 *
 * @param {string} model
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {number} [maxTokens=8192]
 */
export async function sendMessage(model, systemPrompt, userMessage, maxTokens = 8192) {
  const client = getClient();

  const params = {
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ],
  };

  // deepseek-chat supports temperature; use 0 for deterministic output
  // deepseek-reasoner (R1) does not accept temperature — omit it
  if (model === 'deepseek-chat' || model === process.env.AI_MODEL_HAIKU) {
    params.temperature = 0;
  }

  const response = await client.chat.completions.create(params);
  return response.choices[0].message.content;
}

/**
 * Extract JSON from an AI response, stripping any markdown fences.
 * @param {string} text
 */
export function extractJSON(text) {
  // Remove markdown code blocks
  let cleaned = text
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  // Find first { or [ to handle any preamble
  const jsonStart = cleaned.search(/[{[]/);
  if (jsonStart > 0) cleaned = cleaned.slice(jsonStart);

  return JSON.parse(cleaned);
}
