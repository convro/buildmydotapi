import Anthropic from '@anthropic-ai/sdk';

let _client = null;

export const MODELS = {
  OPUS:  process.env.AI_MODEL_OPUS  || 'claude-opus-4-5',
  HAIKU: process.env.AI_MODEL_HAIKU || 'claude-haiku-4-5-20251001',
};

export function getClient() {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY not found.\n' +
        'Set it in your .env file or run:\n' +
        '  export ANTHROPIC_API_KEY=sk-ant-...'
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

/**
 * Send a single-turn message to the Anthropic API and return the text.
 * @param {string} model
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {number} [maxTokens=4096]
 */
export async function sendMessage(model, systemPrompt, userMessage, maxTokens = 4096) {
  const client = getClient();

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: userMessage }],
  });

  return response.content[0].text;
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
