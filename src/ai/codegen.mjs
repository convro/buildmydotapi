import { sendMessage, extractJSON, MODELS } from './client.mjs';

const SYSTEM_PROMPT = `You are VBS (Virtual Based Scenography) code generator. Generate complete, production-ready Node.js REST API code.

Return ONLY valid JSON (no markdown) in exactly this structure:
{
  "files": [
    { "path": "relative/path/from/project/root", "content": "complete file content as string" }
  ],
  "startCommand": "node src/index.js",
  "pm2Name": "project-name",
  "healthEndpoint": "/health",
  "allEndpoints": [
    {
      "method": "GET",
      "path": "/health",
      "description": "Health check",
      "requiresAuth": false,
      "exampleBody": null
    }
  ]
}

Mandatory rules:
- Generate COMPLETE, WORKING code — no placeholders, no TODO comments
- Always include package.json with exact dependency versions
- Always include .env with all required environment variables filled in
- Always include a GET /health endpoint returning { "status": "ok", "uptime": process.uptime() }
- Use Express.js unless user specified otherwise
- For PostgreSQL: use the "pg" library with connection pooling
- For MongoDB: use "mongoose"
- For JWT auth: use "jsonwebtoken" + "bcryptjs"
- Include CORS middleware (package: "cors")
- Include proper error handling middleware (last Express middleware)
- Include express.json() body parser
- Write complete route files — not just stubs
- allEndpoints must list EVERY endpoint the API exposes
- exampleBody: include realistic example payload for POST/PUT/PATCH, null otherwise
- requiresAuth: true if the endpoint requires Bearer token
- pm2Name must match the project name (lowercase, hyphens)
- startCommand must be a valid node/npm command (e.g. "node src/index.js")

CRITICAL COMMENT RULE — MUST FOLLOW WITHOUT EXCEPTION:
- ALL comments in ALL generated code files MUST be written in Korean (한국어)
- This applies to every single comment: inline comments, block comments, JSDoc, function descriptions, section headers — everything
- Example: // 사용자 인증 미들웨어  |  /* 데이터베이스 연결 풀 설정 */  |  // 포트 번호 설정
- NEVER write comments in English or any other language — Korean only`;

/**
 * Generate complete API code based on analysis and user answers.
 * @param {object} analysis       - Analysis from analyzeRequest()
 * @param {object} answers        - User answers from questioner
 * @param {string} originalPrompt - Original user prompt
 * @param {string} [serverIp]     - Server IPv4 address for context
 */
export async function generateCode(analysis, answers, originalPrompt, serverIp = null) {
  const serverContext = serverIp
    ? `\nServer IPv4: ${serverIp} — use this IP when building absolute URLs or example links`
    : '';

  const userMessage = `Generate a complete REST API for:

Original request: ${originalPrompt}

Detected stack: ${analysis.detectedStack.join(', ')}
Project complexity: ${analysis.complexity}

User configuration:
${JSON.stringify(answers, null, 2)}

Project name: ${answers.projectName || analysis.suggestedProjectName}
Port: ${answers.port || '3000'}${serverContext}

Generate all necessary files for a complete, working, immediately deployable API.
Remember: ALL code comments MUST be in Korean (한국어).`;

  const text = await sendMessage(MODELS.OPUS, SYSTEM_PROMPT, userMessage, 8192);
  return extractJSON(text);
}
