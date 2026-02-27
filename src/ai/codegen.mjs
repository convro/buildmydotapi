import { sendMessage, extractJSON, MODELS } from './client.mjs';

// ── Shared comment rule ────────────────────────────────────────────────────────

const SHARED_RULES = `
CRITICAL COMMENT RULE — MUST FOLLOW WITHOUT EXCEPTION:
- ALL source-code COMMENTS (// ..., /* ... */, /** JSDoc */, # hash comments) MUST be written in Korean (한국어)
- This rule applies ONLY to code comments — it does NOT affect visible page content, HTML text, labels, headings, or any user-facing output
- Examples: // 사용자 인증 미들웨어  |  /* 데이터베이스 연결 풀 */  |  // 포트 번호 설정
- NEVER write code comments in English or any other language — Korean only
- PAGE LANGUAGE is a separate setting provided in the configuration — ALL user-visible text on the site/app must match that language`;

// ── Model selection ────────────────────────────────────────────────────────────

/** Use the reasoning model only for complex projects; fast model for simple/medium. */
function pickModel(complexity) {
  if (complexity === 'complex') return MODELS.OPUS;
  return MODELS.HAIKU;
}

// ── Static HTML system prompt ──────────────────────────────────────────────────

const STATIC_SYSTEM = `You are VBS (Virtual Based Scenography) code generator. Generate a complete static HTML/CSS/JS website.

Return ONLY valid JSON (no markdown) in exactly this structure:
{
  "files": [
    { "path": "relative/path/from/project/root", "content": "complete file content" }
  ],
  "startCommand": null,
  "pm2Name": null,
  "buildRequired": false,
  "allEndpoints": []
}

Rules:
- Generate a REAL, visually polished website — not a bare skeleton
- Use semantic HTML5 (header, main, section, footer, nav, article, etc.)
- Inline CSS in a <style> tag in index.html OR a separate style.css file
- Vanilla JavaScript only — no npm, no build tools, no framework
- Responsive design using CSS flexbox or grid
- index.html must be at the project root
- If the site has multiple pages, link between them with relative links
- Include realistic content matching the user's request (real sections, headings, placeholder text)
- Smooth scrolling, hover effects, clean typography — production quality
- Add a favicon.ico (simple SVG or data URI inline in HTML)
- No placeholders — fill every section with plausible content
- allEndpoints: [] (static sites have no server endpoints)
- startCommand: null (nginx serves the files directly)
- pm2Name: null (no Node.js process)
${SHARED_RULES}`;

// ── API system prompt ──────────────────────────────────────────────────────────

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

// ── Frontend system prompt ─────────────────────────────────────────────────────

const FRONTEND_SYSTEM = `You are VBS (Virtual Based Scenography) code generator. Generate complete, production-ready frontend applications.

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
- Include all required config files
- Generate real pages/components — not empty shells
- Include realistic sample data or API integration where described
- pm2Name: lowercase with hyphens (e.g. "my-app-front")
- startCommand: "npm start" for Next.js; irrelevant for static React (nginx serves dist/)
- allEndpoints: []
${SHARED_RULES}`;

// ── Fullstack split system prompts ────────────────────────────────────────────
// These two run in PARALLEL — backend and frontend generated simultaneously.

const BACKEND_SPLIT_SYSTEM = `You are VBS (Virtual Based Scenography) code generator. Generate the BACKEND part of a full-stack application.

ALL file paths MUST start with "backend/" prefix.

Return ONLY valid JSON (no markdown) in exactly this structure:
{
  "files": [
    { "path": "backend/src/index.js", "content": "..." }
  ],
  "startCommand": "node src/index.js",
  "pm2Name": "project-api",
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

Rules:
- Express.js REST API, all files under backend/
- backend/package.json with exact dependency versions
- backend/.env with all required vars filled in
- GET /health always included
- All routes complete — not stubs
- PostgreSQL: use "pg" with connection pooling
- JWT: "jsonwebtoken" + "bcryptjs"
- CORS configured to allow frontend origin (*)
- pm2Name: lowercase with hyphens
- startCommand: valid node/npm command
- Context: nginx will proxy /api/* requests to this backend
${SHARED_RULES}`;

const FRONTEND_SPLIT_SYSTEM = `You are VBS (Virtual Based Scenography) code generator. Generate the FRONTEND part of a full-stack application.

ALL file paths MUST start with "frontend/" prefix.

Return ONLY valid JSON (no markdown) in exactly this structure:
{
  "files": [
    { "path": "frontend/src/App.jsx", "content": "..." }
  ],
  "frontendFramework": "react" | "nextjs",
  "startCommand": "npm start",
  "buildCommand": "npm run build",
  "pm2Name": "project-front"
}

React (Vite) SPA rules:
- All files under frontend/
- frontend/package.json (separate from backend)
- Use relative /api/* paths for backend calls (nginx proxies them)
- package.json scripts: { "dev": "vite", "build": "vite build", "start": "vite preview" }
- index.html at frontend root
- If Tailwind: tailwind.config.js + postcss.config.js + import in index.css
- If TypeScript: .tsx/.ts extensions + tsconfig.json

Next.js rules:
- All files under frontend/
- frontend/package.json (separate from backend)
- Use relative /api/* paths or NEXT_PUBLIC_API_URL env var for backend calls
- package.json scripts: { "dev": "next dev", "build": "next build", "start": "next start" }
- App Router (v14+), src/app directory structure
- If Tailwind: tailwind.config.ts + postcss.config.js

General:
- Generate COMPLETE, WORKING code — no placeholders
- Real pages and components — not empty shells
- pm2Name: lowercase with hyphens
${SHARED_RULES}`;

// ── Fullstack monolithic system prompt (fallback for simple projects) ──────────

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
- CORS configured to allow requests from frontend (origin: *)

Frontend (frontend/) rules:
- React (Vite SPA) or Next.js App Router (v14+)
- frontend/package.json separate from backend
- Connect to backend at /api/* (nginx will proxy this)
- If Tailwind: include all config files
- If TypeScript: tsconfig.json
- Generate real pages — not empty shells
- The frontend calls /api/* routes which nginx proxies to the backend

Nginx integration:
- Backend listens on backendPort (e.g. 3001)
- Frontend dev server on frontendPort (e.g. 3000)
- Nginx will route: /api/* → backend, /* → frontend

General:
- Generate COMPLETE, WORKING code — no placeholders, no TODO
- allEndpoints lists only BACKEND API endpoints
- backendPm2Name / frontendPm2Name: lowercase with hyphens
${SHARED_RULES}`;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate complete project code based on analysis and user answers.
 *
 * For fullstack projects with complex complexity, runs backend and frontend
 * generation in PARALLEL using two separate focused prompts.
 *
 * @param {object}   analysis       - Analysis from analyzeRequest()
 * @param {object}   answers        - User answers
 * @param {string}   originalPrompt - Original user prompt
 * @param {string}   [serverIp]     - Server IPv4 for context
 * @param {string}   [projectType]  - 'api' | 'frontend' | 'fullstack'
 * @param {Function} [onProgress]   - Streaming callback: (phase, totalChars) => void
 *                                    phase: 'api' | 'backend' | 'frontend'
 */
export async function generateCode(
  analysis,
  answers,
  originalPrompt,
  serverIp     = null,
  projectType  = 'api',
  onProgress   = null,
) {
  const serverContext = serverIp
    ? `\nServer IPv4: ${serverIp} — use this IP for absolute URLs or example links`
    : '';

  const frontendFramework =
    answers.frontend_framework?.toLowerCase().includes('next') ? 'nextjs' :
    analysis.frontendFramework || 'react';

  const frontendLabel =
    frontendFramework === 'nextjs' ? 'Next.js (App Router v14)' : 'React (Vite SPA)';

  const model = pickModel(analysis.complexity);

  // ── Static HTML ────────────────────────────────────────────────────────────
  if (projectType === 'frontend' && analysis.isStatic) {
    const pageLanguage = answers.page_language || 'English';
    const userMessage = `Generate a complete static HTML/CSS/JS website.

Original request: ${originalPrompt}

Configuration:
- Site title: ${answers.site_title || answers.project_name || analysis.suggestedProjectName}
- Description: ${answers.description || ''}
- Color scheme: ${answers.color_scheme || 'Light & Clean'}
- Contact form: ${answers.include_contact_form ? 'yes' : 'no'}
- Page language: ${pageLanguage} — ALL visible text (headings, paragraphs, labels, buttons, nav, footer) MUST be written in ${pageLanguage}. Set <html lang="..."> to the correct ISO code.

Project name: ${answers.projectName || analysis.suggestedProjectName}${serverContext}

Generate all necessary HTML, CSS, and JS files for a polished, production-ready static site.`;

    const onToken = onProgress ? (n) => onProgress('static', n) : null;
    const text = await sendMessage(model, STATIC_SYSTEM, userMessage, 16384, onToken);
    return extractJSON(text);
  }

  // ── API ────────────────────────────────────────────────────────────────────
  if (projectType === 'api') {
    const userMessage = buildApiMessage(analysis, answers, originalPrompt, serverContext);
    const onToken = onProgress ? (n) => onProgress('api', n) : null;
    const text = await sendMessage(model, API_SYSTEM, userMessage, 20480, onToken);
    return extractJSON(text);
  }

  // ── Frontend (React/Next.js) ───────────────────────────────────────────────
  if (projectType === 'frontend') {
    const userMessage = buildFrontendMessage(analysis, answers, originalPrompt, serverContext, frontendLabel, frontendFramework);
    const onToken = onProgress ? (n) => onProgress('frontend', n) : null;
    const text = await sendMessage(model, FRONTEND_SYSTEM, userMessage, 20480, onToken);
    return extractJSON(text);
  }

  // ── Fullstack — parallel backend + frontend generation ─────────────────────
  if (projectType === 'fullstack') {
    return generateFullstackParallel(analysis, answers, originalPrompt, serverContext, frontendLabel, frontendFramework, model, onProgress);
  }

  // Fallback
  const text = await sendMessage(model, API_SYSTEM, buildApiMessage(analysis, answers, originalPrompt, serverContext), 20480);
  return extractJSON(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildApiMessage(analysis, answers, originalPrompt, serverContext) {
  return `Generate a complete REST API.

Original request: ${originalPrompt}

Detected stack: ${analysis.detectedStack.join(', ')}
Complexity: ${analysis.complexity}

User configuration:
${JSON.stringify(answers, null, 2)}

Project name: ${answers.projectName || analysis.suggestedProjectName}${serverContext}

Generate all necessary files for a complete, immediately deployable REST API.
Remember: ALL source-code comments MUST be in Korean (한국어). This does NOT affect API response text or error messages.`;
}

function buildFrontendMessage(analysis, answers, originalPrompt, serverContext, frontendLabel, frontendFramework) {
  const pageLanguage = answers.page_language || 'English';
  return `Generate a complete frontend app using ${frontendLabel}.

Original request: ${originalPrompt}

Detected stack: ${analysis.detectedStack.join(', ')}
Complexity: ${analysis.complexity}
Framework: ${frontendFramework}
TypeScript: ${answers.typescript === true || answers.typescript === 'true' ? 'yes' : 'no'}
Styling: ${answers.styling || 'Tailwind CSS'}
Page language: ${pageLanguage} — ALL visible text (headings, labels, buttons, nav, content) MUST be written in ${pageLanguage}. Set html lang attribute to the correct ISO code.

User configuration:
${JSON.stringify(answers, null, 2)}

Project name: ${answers.projectName || analysis.suggestedProjectName}${serverContext}

Generate all necessary files for a complete, immediately deployable frontend app.
Remember: ALL source-code comments MUST be in Korean (한국어). This does NOT affect visible UI text — that must be in ${pageLanguage}.`;
}

/**
 * Generate fullstack by running backend and frontend in parallel.
 * Two focused prompts → two simultaneous API calls → merged result.
 * For medium/simple projects this can cut total generation time in half.
 */
async function generateFullstackParallel(analysis, answers, originalPrompt, serverContext, frontendLabel, frontendFramework, model, onProgress) {
  const backendPort  = answers.backendPort  || answers.backend_port  || '3001';
  const frontendPort = answers.frontendPort || answers.frontend_port || '3000';
  const projectName  = answers.projectName  || analysis.suggestedProjectName;

  const pageLanguage = answers.page_language || 'English';

  const sharedContext = `
Project: ${projectName}
Original request: ${originalPrompt}
Detected stack: ${analysis.detectedStack.join(', ')}
Complexity: ${analysis.complexity}
TypeScript: ${answers.typescript === true || answers.typescript === 'true' ? 'yes' : 'no'}
Styling: ${answers.styling || 'Tailwind CSS'}
Page language: ${pageLanguage}
User configuration:
${JSON.stringify(answers, null, 2)}${serverContext}`;

  const backendMessage = `Generate the BACKEND part of a full-stack ${frontendLabel} + Express.js app.
${sharedContext}

Backend port: ${backendPort}
Frontend will be served at / (nginx) and make calls to /api/* (proxied to this backend).
ALL file paths must start with "backend/".
Remember: ALL source-code comments MUST be in Korean (한국어). This does NOT affect API response text.`;

  const frontendMessage = `Generate the FRONTEND part of a full-stack ${frontendLabel} + Express.js app.
${sharedContext}

Frontend framework: ${frontendLabel} (${frontendFramework})
Frontend port: ${frontendPort}
Backend API is available at /api/* via nginx proxy (do NOT hardcode backend port).
ALL file paths must start with "frontend/".
Page language: ${pageLanguage} — ALL visible text in the UI (headings, labels, buttons, nav, content) MUST be written in ${pageLanguage}. Set html lang to the correct ISO code.
Remember: ALL source-code comments MUST be in Korean (한국어). This does NOT affect visible UI text — that must be in ${pageLanguage}.`;

  // Run both in parallel — biggest time saving for fullstack projects
  const onBackToken  = onProgress ? (n) => onProgress('backend',  n) : null;
  const onFrontToken = onProgress ? (n) => onProgress('frontend', n) : null;

  const [backResult, frontResult] = await Promise.all([
    sendMessage(model, BACKEND_SPLIT_SYSTEM,  backendMessage,  20480, onBackToken).then(extractJSON),
    sendMessage(model, FRONTEND_SPLIT_SYSTEM, frontendMessage, 20480, onFrontToken).then(extractJSON),
  ]);

  // Merge into the shape that index.mjs expects
  return {
    files:                [...backResult.files,  ...frontResult.files],
    frontendFramework:    frontResult.frontendFramework,
    backendStartCommand:  backResult.startCommand,
    frontendStartCommand: frontResult.startCommand,
    backendPm2Name:       backResult.pm2Name,
    frontendPm2Name:      frontResult.pm2Name,
    allEndpoints:         backResult.allEndpoints || [],
  };
}
