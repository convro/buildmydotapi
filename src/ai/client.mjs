import OpenAI from 'openai';

let _client = null;

export const MODELS = {
  OPUS:  process.env.AI_MODEL_OPUS  || 'deepseek-reasoner',
  HAIKU: process.env.AI_MODEL_HAIKU || 'deepseek-chat',
};

// Per-model hard timeout — abort if AI goes silent for this long
const TIMEOUT_MS = {
  'deepseek-reasoner': 2_100_000, // 35 min — R1 reasoning can take a long time
  'deepseek-chat':     180_000, //  3 min — fast model
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

/**
 * @param {string}    model
 * @param {string}    systemPrompt
 * @param {string}    userMessage
 * @param {number}    maxTokens
 * @param {Function}  [onToken]  Called with (totalOutputChars) on every streamed content token.
 *                               Enables streaming mode when provided.
 */
async function callOnce(model, systemPrompt, userMessage, maxTokens, onToken = null) {
  const client    = getClient();
  const timeoutMs = TIMEOUT_MS[model] ?? TIMEOUT_MS['deepseek-chat'];

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), timeoutMs);

  const params = {
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ],
    stream: !!onToken,
  };

  // deepseek-reasoner (R1) does not accept temperature; omit it
  if (model !== 'deepseek-reasoner' && model !== process.env.AI_MODEL_OPUS) {
    params.temperature = 0;
  }

  try {
    if (onToken) {
      // Streaming — keeps TCP alive, lets caller show live token progress
      // For R1: delta has reasoning_content (thinking) AND content (actual answer).
      // We only accumulate content — the JSON we care about.
      const stream = await client.chat.completions.create(params, { signal: controller.signal });

      let text = '';
      let finishReason = null;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const token = delta?.content || '';
        if (token) {
          text += token;
          onToken(text.length);
        }
        if (chunk.choices[0]?.finish_reason) {
          finishReason = chunk.choices[0].finish_reason;
        }
      }

      return { text, finishReason: finishReason || 'stop' };

    } else {
      const response = await client.chat.completions.create(params, { signal: controller.signal });
      const choice   = response.choices[0];
      return { text: choice.message.content, finishReason: choice.finish_reason };
    }

  } catch (err) {
    // AbortController fired (timeout) or network abort
    if (
      err.name === 'AbortError'     ||
      err.code === 'ERR_CANCELED'   ||
      err.message?.toLowerCase().includes('abort') ||
      err.message?.toLowerCase().includes('cancel')
    ) {
      const mins = Math.round(timeoutMs / 60_000);
      throw new Error(
        `AI request timed out after ${mins} min with no response.\n` +
        `Tip: Set AI_MODEL_OPUS=deepseek-chat in your .env for faster (non-reasoning) responses.`
      );
    }
    throw err;

  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a message to the AI.
 * Auto-retries with 2× tokens if finish_reason === 'length' (truncated).
 * Pass onToken callback to enable streaming with live progress.
 *
 * @param {string}   model
 * @param {string}   systemPrompt
 * @param {string}   userMessage
 * @param {number}   [maxTokens=8192]
 * @param {Function} [onToken]  Streaming progress callback: (totalChars: number) => void
 */
export async function sendMessage(model, systemPrompt, userMessage, maxTokens = 8192, onToken = null) {
  let tokens = maxTokens;
  const MAX_TOKENS_CAP = 65536;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { text, finishReason } = await callOnce(model, systemPrompt, userMessage, tokens, onToken);

    if (finishReason !== 'length') return text;

    // Response was cut off — double tokens and retry
    tokens = Math.min(tokens * 2, MAX_TOKENS_CAP);
    if (attempt < 2) continue;

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
  const stack = [];
  let inString = false;
  let escape   = false;
  let lastSafePos = 0;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }

    if (ch === '"') {
      inString = !inString;
      if (!inString) lastSafePos = i + 1;
      continue;
    }

    if (inString) continue;

    if (ch === '{' || ch === '[') {
      stack.push(ch === '{' ? '}' : ']');
    } else if (ch === '}' || ch === ']') {
      if (stack.length > 0) stack.pop();
    }

    if (!inString) lastSafePos = i + 1;
  }

  if (stack.length === 0 && !inString) return null;

  let repaired = str.slice(0, lastSafePos).trimEnd();
  repaired = repaired.replace(/,\s*$/, '');
  for (let i = stack.length - 1; i >= 0; i--) {
    repaired += stack[i];
  }

  return repaired;
}

/**
 * Escape unescaped control characters (0x00–0x1f) found inside JSON string
 * literals. AI models sometimes emit raw newlines / tabs inside strings
 * instead of the required \\n / \\t escape sequences, causing JSON.parse to
 * throw "Bad control character in string literal".
 */
function sanitizeControlChars(str) {
  const ESC = { '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f' };
  let result   = '';
  let inString = false;
  let escape   = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (escape) { escape = false; result += ch; continue; }
    if (ch === '\\' && inString) { escape = true; result += ch; continue; }

    if (ch === '"') { inString = !inString; result += ch; continue; }

    if (inString && ch.charCodeAt(0) < 0x20) {
      result += ESC[ch] ?? `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`;
      continue;
    }

    result += ch;
  }
  return result;
}

/**
 * Strip trailing commas before } or ] — invalid JSON produced by some models.
 * e.g.  { "a": 1, }  →  { "a": 1 }
 * Only operates outside of string literals to avoid corrupting content.
 */
function removeTrailingCommas(str) {
  // Two-pass regex is safe here: JSON structural chars are outside strings
  // after sanitizeControlChars has already run.
  return str.replace(/,(\s*[}\]])/g, '$1');
}

/**
 * Extract and parse JSON from an AI response.
 * Strips markdown fences, finds the first JSON structure,
 * sanitizes raw control characters, removes trailing commas,
 * and attempts repair on truncated responses.
 *
 * @param {string} text
 * @throws {Error} if JSON cannot be parsed even after repair
 */
export function extractJSON(text) {
  // Strip UTF-8 BOM if present
  let cleaned = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;

  // Strip markdown code fences (```json ... ```)
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  // Find where the JSON structure starts (skip any prose before it)
  const jsonStart = cleaned.search(/[{[]/);
  if (jsonStart > 0) cleaned = cleaned.slice(jsonStart);

  // Sanitize raw control characters inside string literals before parsing
  cleaned = sanitizeControlChars(cleaned);
  // Remove trailing commas before } or ] (common AI mistake)
  cleaned = removeTrailingCommas(cleaned);

  try {
    return JSON.parse(cleaned);
  } catch (firstErr) {
    const repaired = repairTruncatedJSON(cleaned);
    if (repaired) {
      try {
        return JSON.parse(repaired);
      } catch (repairErr) {
        throw new Error(
          `AI response JSON is invalid and could not be repaired.\n` +
          `Original error: ${firstErr.message}\n` +
          `Response length: ${text.length} chars\n` +
          `Tip: This usually means the model ran out of tokens. Retry — the model may produce a shorter valid response.`
        );
      }
    }

    throw new Error(
      `AI response is not valid JSON: ${firstErr.message}\n` +
      `First 300 chars of response: ${text.slice(0, 300)}`
    );
  }
}
