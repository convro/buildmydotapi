import { sendMessage, extractJSON, MODELS } from './client.mjs';

// ── Shared rules ──────────────────────────────────────────────────────────────

const SHARED_RULES = `
CRITICAL COMMENT RULE — MUST FOLLOW WITHOUT EXCEPTION:
- ALL comments in ALL generated code files MUST be written in Korean (한국어)
- Applies to every comment: inline, block, JSDoc, section headers — everything
- Examples: // 사용자 인증 미들웨어  |  /* 데이터베이스 연결 풀 */  |  // 포트 번호 설정
- NEVER write comments in English or any other language — Korean only`;

// ── API system prompt ─────────────────────────────────────────────────────────

const API_SYSTEM = `You are VBS (Virtual Based Scenography) code generator. Generate complete, production-ready Node.js REST API code.

Return ONLY valid JSON (no markdown) in exactly this structure:
{
  "files": [
    { "path": "relative/path/from/project/root", "content": "complete file content" }
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
- Generate COMPLETE, WORKING code — no placeholders, no TODO
- Always include package.json with exact dependency versions
- Always include .env with all required environment variables filled in
- Always include GET /health → { "status": "ok", "uptime": process.uptime() }
- Use Express.js unless user specified otherwise
- PostgreSQL: use "pg" with connection pooling
- MongoDB: use "mongoose"
- JWT auth: use "jsonwebtoken" + "bcryptjs"
- Include CORS middleware ("cors")
- Include proper error handling middleware (last in chain)
- include express.json() body parser
- Write complete route files — not stubs
- allEndpoints must list EVERY endpoint the API exposes
- exampleBody: realistic payload for POST/PUT/PATCH, null otherwise
- requiresAuth: true if endpoint requires Bearer token
- pm2Name: lowercase with hyphens
- startCommand: valid node/npm command
${SHARED_RULES}`;

// ── Frontend system prompt ────────────────────────────────────────────────────

const FRONTEND_SYSTEM = `You are VBS (Virtual Based Scenography) code generator. Generate complete, production-ready frontend applications.

IMPORTANT: You generate either React (Vite) or Next.js apps based on user configuration.

Return ONLY valid JSON (no markdown) in exactly this structure:
{
  "files": [
    { "path": "relative/path/from/project/root", "content": "complete file content" }
  ],
  "frontendFramework": "react" | "nextjs",
  "startCommand": "npm start",
  "buildCommand": "npm run build",
  "pm2Name": "project-name-front",
  "allEndpoints": []
}

React (Vite) SPA rules:
- Use Vite as build tool (vite + @vitejs/plugin-react in devDependencies)
- package.json scripts: { "dev": "vite", "build": "vite build", "start": "vite preview" }
- Entry: src/main.jsx (or .tsx if TypeScript)
- Root component: src/App.jsx
- index.html at project root
- If Tailwind: include tailwind.config.js + postcss.config.js + import in index.css
- If TypeScript: use .tsx/.ts extensions, include tsconfig.json
- vite.config.js/ts must be included

Next.js rules:
- Use Next.js App Router (version 14+)
- package.json scripts: { "dev": "next dev", "build": "next build", "start": "next start" }
- next.config.js must be included
- Use src/app directory structure
- If Tailwind: include tailwind.config.ts + postcss.config.js
- If TypeScript: tsconfig.json
- Include proper layout.tsx with metadata

General frontend rules:
- Generate COMPLETE, WORKING code — no placeholders
- Include all required config files (eslint, prettier, etc.)
- Generate real pages/components — not empty shells
- Include realistic sample data or API integration where described
- pm2Name: lowercase with hyphens (e.g. "my-app-front")
- startCommand: "npm start" (Next.js) or N/A for static React (nginx serves it)
- allEndpoints: [] (frontend has no server endpoints)
${SHARED_RULES}`;

// ── Fullstack system prompt ───────────────────────────────────────────────────

const FULLSTACK_SYSTEM = `You are VBS (Virtual Based Scenography) code generator. Generate a complete full-stack application.

Structure: backend/ (Express API) + frontend/ (React/Next.js)

Return ONLY valid JSON (no markdown) in exactly this structure:
{
  "files": [
    { "path": "backend/src/index.js", "content": "..." },
    { "path": "frontend/src/App.jsx", "content": "..." }
  ],
  "frontendFramework": "react" | "nextjs",
  "backendStartCommand": "node src/index.js",
  "frontendStartCommand": "npm start",
  "backendPm2Name": "project-api",
  "frontendPm2Name": "project-front",
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

Backend (backend/) rules:
- Express.js REST API, all files under backend/
- backend/package.json with exact dependency versions
- backend/.env with all required vars filled in
- GET /health endpoint always included
- All routes complete, not stubs
- If PostgreSQL: use "pg" with connection pooling
- If JWT: "jsonwebtoken" + "bcryptjs"
- CORS configured to allow requests from frontend (origin: * or configured)

Frontend (frontend/) rules:
- React (Vite SPA) or Next.js App Router (v14+)
- frontend/package.json separate from backend
- Connect to backend at /api/* (nginx will proxy this)
- Use environment variables for API base URL: VITE_API_URL or NEXT_PUBLIC_API_URL
- If Tailwind: include all config files
- If TypeScript: tsconfig.json
- Generate real pages — not empty shells
- The frontend calls /api/* routes which nginx proxies to the backend

Nginx integration:
- Backend listens on backendPort (e.g. 3001)
- Frontend dev server on frontendPort (e.g. 3000)
- Nginx will route: /api/* → backend, /* → frontend
- Frontend API calls should use relative /api/* paths (nginx handles proxy)

General:
- Generate COMPLETE, WORKING code — no placeholders, no TODO
- allEndpoints lists only BACKEND API endpoints
- backendPm2Name / frontendPm2Name: lowercase with hyphens
${SHARED_RULES}`;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate complete project code based on analysis and user answers.
 *
 * @param {object} analysis       - Analysis from analyzeRequest()
 * @param {object} answers        - User answers
 * @param {string} originalPrompt - Original user prompt
 * @param {string} [serverIp]     - Server IPv4 for context
 * @param {string} [projectType]  - 'api' | 'frontend' | 'fullstack'
 */
export async function generateCode(analysis, answers, originalPrompt, serverIp = null, projectType = 'api') {
  const systemPromptMap = {
    api:       API_SYSTEM,
    frontend:  FRONTEND_SYSTEM,
    fullstack: FULLSTACK_SYSTEM,
  };
  const systemPrompt = systemPromptMap[projectType] || API_SYSTEM;

  const serverContext = serverIp
    ? `\nServer IPv4: ${serverIp} — use this IP for absolute URLs or example links`
    : '';

  // Resolve framework from answers
  const frontendFramework =
    answers.frontend_framework?.toLowerCase().includes('next') ? 'nextjs' :
    analysis.frontendFramework || 'react';

  const frontendLabel =
    frontendFramework === 'nextjs' ? 'Next.js (App Router v14)' : 'React (Vite SPA)';

  const typeContext =
    projectType === 'api'
      ? `Generate a complete REST API.`
      : projectType === 'frontend'
      ? `Generate a complete frontend app using ${frontendLabel}.`
      : `Generate a full-stack app:\n- Backend: Express.js REST API in backend/\n- Frontend: ${frontendLabel} in frontend/\n- Backend port: ${answers.backendPort || 3001}, Frontend port: ${answers.frontendPort || 3000}`;

  const userMessage = `${typeContext}

Original request: ${originalPrompt}

Detected stack: ${analysis.detectedStack.join(', ')}
Complexity: ${analysis.complexity}
Frontend framework: ${frontendFramework}
TypeScript: ${answers.typescript === true || answers.typescript === 'true' ? 'yes' : 'no'}
Styling: ${answers.styling || 'Tailwind CSS'}

User configuration:
${JSON.stringify(answers, null, 2)}

Project name: ${answers.projectName || analysis.suggestedProjectName}${serverContext}

Generate all necessary files for a complete, working, immediately deployable project.
Remember: ALL code comments MUST be in Korean (한국어).`;

  const text = await sendMessage(MODELS.OPUS, systemPrompt, userMessage, 16384);
  return extractJSON(text);
}
