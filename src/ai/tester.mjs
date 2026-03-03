import { sendMessage, MODELS } from './client.mjs';

/**
 * Ask the AI to analyze HTTP test results and provide feedback.
 * @param {Array}  testResults - Array of test result objects
 * @param {string} projectName
 * @param {string} [serverIp]  - Server IPv4 for real link generation
 * @param {string} [port]      - API port
 */
export async function analyzeTestResults(testResults, projectName, serverIp = null, port = '3000') {
  const baseUrl = serverIp ? `http://${serverIp}:${port}` : `http://localhost:${port}`;

  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.length - passed;
  const avgTime = Math.round(testResults.reduce((s, r) => s + (r.time || 0), 0) / testResults.length);

  const systemPrompt = `You are VBS (Virtual Based Scenography) — an expert deployment analyzer and API quality auditor.
Analyze HTTP endpoint test results and give thorough, practical feedback.

Your analysis should cover (under 300 words, be direct and actionable):

1. HEALTH STATUS: Overall API health assessment (healthy / degraded / critical)
2. FAILING ENDPOINTS: List any failing endpoints with likely root cause
3. PERFORMANCE: Comment on response times (< 100ms = excellent, 100-500ms = good, > 500ms = needs attention)
4. SECURITY AUDIT: Check for security concerns:
   - Are auth-protected endpoints returning 401 without token? (good — auth works)
   - Are there endpoints that SHOULD require auth but don't?
   - Any 500 errors that might leak stack traces?
5. API DESIGN: Any observations about endpoint design (missing pagination, inconsistent status codes, etc.)
6. QUICK FIXES: Top 1-3 actionable fixes if anything is wrong

Use these status code references:
- 200-299: Success (expected)
- 400: Bad Request (expected for validation — means validation works)
- 401: Unauthorized (expected without token — means auth guard works)
- 403: Forbidden (permission system works)
- 404: Not Found (either missing route or resource doesn't exist yet)
- 422: Validation Error (expected for invalid data)
- 500+: Server Error (investigate — likely a bug)

${serverIp ? `Base URL for links: ${baseUrl}` : ''}`;

  const summary = testResults
    .map(r => `${r.method} ${r.path}: HTTP ${r.status || 'ERR'} (${r.time}ms) — ${r.passed ? 'PASS' : 'FAIL'} [${r.note}]`)
    .join('\n');

  const userMessage = `API "${projectName}" endpoint test results:

Base URL: ${baseUrl}
Summary: ${passed}/${testResults.length} passed, ${failed} failed, avg response time: ${avgTime}ms

${summary}`;

  return sendMessage(MODELS.HAIKU, systemPrompt, userMessage, 768);
}

/**
 * Ask the AI to diagnose a pm2 startup failure from logs.
 * @param {string} logs        - Raw pm2 log output
 * @param {string} projectName
 */
export async function diagnoseFailure(logs, projectName) {
  const systemPrompt = `You are VBS (Virtual Based Scenography) — an expert Node.js deployment debugger.
Analyze pm2/Node.js startup logs and provide a precise diagnosis.

Structure your response (under 200 words):

1. ROOT CAUSE: One clear sentence explaining what went wrong
2. ERROR TYPE: Categorize the error:
   - MODULE_NOT_FOUND → missing dependency (npm install)
   - EADDRINUSE → port already in use (kill process or change port)
   - ECONNREFUSED → database/service not running
   - SYNTAX_ERROR → code error in a specific file
   - ENV_MISSING → environment variable not set
   - PERMISSION_DENIED → file/port permission issue
   - OTHER → describe the category
3. FIX STEPS: Numbered list of exact commands to run to fix the issue
4. PREVENTION: One sentence on how to avoid this in the future

Be specific — reference actual file names, line numbers, and error messages from the logs.`;

  const userMessage = `pm2/node startup logs for "${projectName}":\n\n${logs.slice(0, 4000)}`;

  return sendMessage(MODELS.HAIKU, systemPrompt, userMessage, 768);
}
