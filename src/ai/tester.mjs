import { sendMessage, MODELS } from './client.mjs';

/**
 * Ask the AI to analyze HTTP test results and provide feedback.
 * @param {Array}  testResults - Array of test result objects
 * @param {string} projectName
 */
export async function analyzeTestResults(testResults, projectName) {
  const systemPrompt = `You are CreateMy.api deployment analyzer. Analyze HTTP endpoint test results and give brief, practical feedback.

Keep your response under 200 words. Be direct and actionable.
Mention: overall status, any failing endpoints, security observations, and quick tips.`;

  const summary = testResults
    .map(r => `${r.method} ${r.path}: HTTP ${r.status || 'ERR'} (${r.time}ms) — ${r.passed ? 'PASS' : 'FAIL'} [${r.note}]`)
    .join('\n');

  const userMessage = `API "${projectName}" endpoint test results:\n\n${summary}`;

  return sendMessage(MODELS.HAIKU, systemPrompt, userMessage, 512);
}

/**
 * Ask the AI to diagnose a pm2 startup failure from logs.
 * @param {string} logs        - Raw pm2 log output
 * @param {string} projectName
 */
export async function diagnoseFailure(logs, projectName) {
  const systemPrompt = `You are CreateMy.api deployment debugger. Analyze Node.js/pm2 startup logs and identify the root cause.

Be concise (under 150 words). State:
1. Root cause (one sentence)
2. Most likely fix (one or two steps)`;

  const userMessage = `pm2/node startup logs for "${projectName}":\n\n${logs.slice(0, 3000)}`;

  return sendMessage(MODELS.HAIKU, systemPrompt, userMessage, 512);
}
