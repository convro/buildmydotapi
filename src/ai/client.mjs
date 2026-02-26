import OpenAI from 'openai';

let _client = null;

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
    _client = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' });
  }
  return _client;
}

// ─── Internal single call ─────────────────────────────────────────────────────

async function callOnce(model, systemPrompt, userMessage, maxTokens) {
  const client = getClient();

  const params = {
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ],
  };

  // deepseek-reasoner (R1) does not accept temperature; omit it
  if (model !== 'deepseek-reasoner' && model !== process.env.AI_MODEL_OPUS) {
    params.temperature = 0;
  }

  const response = await client.chat.completions.create(params);
  const choice   = response.choices[0];

  return {
    text:         choice.message.content,
    finishReason: choice.finish_reason, // 'stop' | 'length' | 'content_filter'
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a message to the AI.
 * Auto-retries with 2× tokens if the model stops early due to token limit
 * (finish_reason === 'length').  Maximum 2 retries.
 *
 * @param {string} model
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {number} [maxTokens=8192]
 */
export async function sendMessage(model, systemPrompt, userMessage, maxTokens = 8192) {
  let tokens  = maxTokens;
  const MAX_TOKENS_CAP = 32768;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { text, finishReason } = await callOnce(model, systemPrompt, userMessage, tokens);

    if (finishReason !== 'length') {
      // Normal completion — return the text
      return text;
    }

    // Response was cut off — double tokens and retry
    tokens = Math.min(tokens * 2, MAX_TOKENS_CAP);

    if (attempt < 2) {
      // Will retry with more tokens
      continue;
    }

    // Final attempt still truncated — return what we have; extractJSON will try to repair
    return text;
  }
}

// ─── JSON extraction + repair ─────────────────────────────────────────────────

/**
 * Attempt to repair truncated JSON by closing all open brackets/braces.
 * Strips the last incomplete token (unterminated string, dangling comma, etc.)
 * then appends missing closing characters.
 *
 * Returns the repaired string, or null if it cannot be repaired.
 */
function repairTruncatedJSON(str) {
  // Walk through and track bracket depth + string state
  const stack = [];
  let inString = false;
  let escape   = false;
  let lastSafePos = 0; // last position that was outside a string and had balanced brackets

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }

    if (ch === '"') {
      inString = !inString;
      if (!inString) {
        // just closed a string — record safe position
        lastSafePos = i + 1;
      }
      continue;
    }

    if (inString) continue;

    if (ch === '{' || ch === '[') {
      stack.push(ch === '{' ? '}' : ']');
    } else if (ch === '}' || ch === ']') {
      if (stack.length > 0) stack.pop();
    } else if (ch === ',' || ch === ':') {
      // nothing
    } else if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
      // whitespace
    }

    // Track last safe (non-string, structurally sound) position
    if (!inString) lastSafePos = i + 1;
  }

  if (stack.length === 0 && !inString) {
    // No open brackets — JSON was not truncated, real parse error
    return null;
  }

  // Truncated — trim to the last safe position, then close
  let repaired = str.slice(0, lastSafePos).trimEnd();

  // Strip trailing comma before closing (invalid JSON)
  repaired = repaired.replace(/,\s*$/, '');

  // Append closers in reverse stack order
  for (let i = stack.length - 1; i >= 0; i--) {
    repaired += stack[i];
  }

  return repaired;
}

/**
 * Extract and parse JSON from an AI response.
 * - Strips markdown fences
 * - Finds the first JSON structure
 * - Attempts to repair truncated responses before giving up
 *
 * @param {string} text
 * @throws {Error} if JSON cannot be parsed even after repair
 */
export function extractJSON(text) {
  // Strip markdown code fences
  let cleaned = text
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  // Find first { or [
  const jsonStart = cleaned.search(/[{[]/);
  if (jsonStart > 0) cleaned = cleaned.slice(jsonStart);

  // First: try direct parse
  try {
    return JSON.parse(cleaned);
  } catch (firstErr) {
    // Second: try to repair truncated JSON
    const repaired = repairTruncatedJSON(cleaned);
    if (repaired) {
      try {
        return JSON.parse(repaired);
      } catch (repairErr) {
        // Repair attempt failed — throw the original error with context
        throw new Error(
          `AI response JSON is invalid and could not be repaired.\n` +
          `Original error: ${firstErr.message}\n` +
          `Response length: ${text.length} chars\n` +
          `Tip: This usually means the model ran out of tokens. ` +
          `Set AI_MODEL_OPUS=deepseek-chat in .env for faster/cheaper responses, ` +
          `or retry — the model may produce a shorter valid response.`
        );
      }
    }

    // Not truncated — genuine JSON syntax error
    throw new Error(
      `AI response is not valid JSON: ${firstErr.message}\n` +
      `First 300 chars of response: ${text.slice(0, 300)}`
    );
  }
}
