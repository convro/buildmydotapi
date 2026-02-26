import { sendMessage, extractJSON, MODELS } from './client.mjs';

const BASE_SYSTEM = `You are VBS (Virtual Based Scenography), an AI that analyzes user requests to build projects on Ubuntu VPS.

Return ONLY valid JSON (no markdown, no explanation):

{
  "projectType": string,
  "detectedStack": string[],
  "complexity": "simple" | "medium" | "complex",
  "estimatedFiles": number,
  "requiredSystemPackages": string[],
  "suggestedProjectName": string,
  "frontendFramework": "react" | "nextjs" | null,
  "summary": string
}

Rules:
- suggestedProjectName: lowercase with hyphens only (e.g. "shop-api", "blog-app")
- requiredSystemPackages: SYSTEM packages only (e.g. ["postgresql"]) — NOT npm packages
- summary: 1-2 concise sentences describing the project
- frontendFramework: "react" (Vite SPA) | "nextjs" (SSR) | null if no frontend`;

const TYPE_ADDONS = {
  api: `
You are analyzing a REST API request.
- Prefer Express.js unless user specifies otherwise
- Databases: PostgreSQL for relational, MongoDB for document-based, SQLite for simple local
- Suggest JWT for any auth requirement
- Always include a health endpoint
- detectedStack must include all backend technologies`,

  frontend: `
You are analyzing a FRONTEND app request.
- Default to React (Vite) unless user says Next.js or needs SSR/SSG
- Next.js: use when user mentions SSR, SEO, blog, content site, or page routing
- React (Vite): use for dashboards, SPAs, admin panels, data-heavy apps
- Styling: Tailwind CSS unless user specifies otherwise
- TypeScript: yes unless user says plain JS
- detectedStack: list frontend libraries (React, Next.js, Tailwind, TypeScript, etc.)
- requiredSystemPackages: ["nginx"] always for frontend
- frontendFramework: "react" or "nextjs"`,

  fullstack: `
You are analyzing a FULL-STACK app request.
- Backend: Express.js REST API (Node.js)
- Frontend: React (Vite) or Next.js — default React unless SSR/content/SEO is needed
- Both backend and frontend will be deployed
- detectedStack: include both backend and frontend technologies
- requiredSystemPackages: ["nginx"] always, add postgresql if DB needed
- frontendFramework: "react" or "nextjs"
- Suggest JWT for auth
- The backend API will be at /api/*, frontend at /`,
};

/**
 * Analyze a user prompt and return a structured analysis object.
 * @param {string} userPrompt
 * @param {string} [projectType='api']  - 'api' | 'frontend' | 'fullstack'
 */
export async function analyzeRequest(userPrompt, projectType = 'api') {
  const addon        = TYPE_ADDONS[projectType] || TYPE_ADDONS.api;
  const systemPrompt = BASE_SYSTEM + '\n' + addon;

  // 2048 tokens — analysis JSON is small but give margin for R1 reasoning overhead
  const text = await sendMessage(MODELS.OPUS, systemPrompt, userPrompt, 2048);
  return extractJSON(text);
}
