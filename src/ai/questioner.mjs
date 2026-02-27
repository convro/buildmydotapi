import { sendMessage, extractJSON, MODELS } from './client.mjs';

// ── Base instructions ──────────────────────────────────────────────────────────

const BASE_INSTRUCTIONS = `You are VBS (Virtual Based Scenography). Generate technical configuration questions for a project.

Return ONLY valid JSON (no markdown):
{
  "questions": [
    {
      "id": "snake_case_identifier",
      "type": "input" | "list" | "confirm",
      "message": "Human-readable question?",
      "default": "default_value_or_boolean",
      "choices": ["Option A", "Option B"],
      "validate": "port_number"
    }
  ]
}

CRITICAL RULES:
- Ask questions that are ACTUALLY NEEDED for this specific project
- Tailor EVERY question to the detected stack — do NOT generate generic template questions
- If something is obvious from context, use a smart default instead of asking
- "choices" only for type "list"
- "default" for "confirm" must be true or false (boolean)
- "validate" optional; use "port_number" only for port fields
- Every question MUST have a sensible default so user can press Enter to accept`;

// ── Type-specific question generation instructions ─────────────────────────────

const API_QUESTIONS = `Generate 6-10 targeted questions. ALWAYS include:
- project_name (input, default: suggested name)
- port (input, default: "3000", validate: "port_number")

Include ONLY what this specific project actually uses:
- database_name, database_user, database_password — ONLY if a database is in the stack
- jwt_auto_generate (confirm, default: true) — ONLY if auth/JWT is in the stack
- cors_origins (input, default: "*") — ONLY for APIs that will be called from a browser
- rate_limiting (confirm, default: false) — ONLY if the API is public-facing
- node_env (list: "production" | "development", default: "production")
- Additional questions SPECIFIC to this project's features (e.g. file storage path, email SMTP, third-party API keys the user needs to provide)

Do NOT ask about technologies not detected in the stack.
Do NOT ask about TypeScript, React, Tailwind — those are frontend concerns.`;

const STATIC_QUESTIONS = `This is a PLAIN STATIC HTML/CSS/JS project. Generate 4-6 focused questions:

ALWAYS include:
- project_name (input, default: suggested name)
- site_title (input, default: humanized project name, used as <title> and main heading)

Include based on the specific request:
- description (input, default: "") — meta description / intro text for the site
- color_scheme (list, choices relevant to the site: e.g. "Dark & Modern", "Light & Clean", "Brand Colors") — if the site's look matters
- include_contact_form (confirm, default: false) — ONLY if contact info or form makes sense for this site type
- include_analytics (confirm, default: false) — ONLY if it's a real deployed site (not a dev exercise)

Do NOT ask about ports, npm, pm2, TypeScript, React, Node.js, databases, JWT, CORS.
Do NOT ask about deployment — VBS handles that automatically.`;

const FRONTEND_QUESTIONS = `Generate 6-10 focused questions. ALWAYS include:
- project_name (input, default: suggested name)
- frontend_framework (list: choices match what analysis detected — if analysis.frontendFramework is "react" offer "React (Vite SPA)" first, if "nextjs" offer "Next.js (SSR/SSG)" first)
- port (input, default: "3000", validate: "port_number")

Include based on what this project actually needs:
- app_title (input) — if the app has a title/brand visible to users
- typescript (confirm, default: true) — ONLY for React/Next.js (skip for static)
- styling (list: "Tailwind CSS" | "CSS Modules" | "Plain CSS") — ONLY for React/Next.js
- api_base_url (input, default: "/api") — ONLY if the app fetches from a backend
- auth_required (confirm, default: false) — ONLY if auth is part of the described feature set
- dark_mode (confirm, default: false) — ONLY if UI/design is a focus of the request

Ask questions specific to the described features (e.g. if it's a map app, ask about map provider).
Skip questions that have obvious answers from context.`;

const FULLSTACK_QUESTIONS = `Generate 8-14 focused questions. ALWAYS include:
- project_name (input, default: suggested name)
- frontend_framework (list: "React (Vite SPA)" | "Next.js (SSR/SSG)")
- backend_port (input, default: "3001", validate: "port_number")
- frontend_port (input, default: "3000", validate: "port_number")

Include based on what the project actually uses:
- typescript (confirm, default: true) — for frontend
- styling (list: "Tailwind CSS" | "CSS Modules" | "Plain CSS")
- database (list) — ONLY if DB is needed; offer realistic choices for this project
- database_name, database_user — ONLY if database is selected
- auth_type (list: "JWT" | "None") — ONLY if auth is part of the feature set
- app_title (input) — if the app has a brand/title
- node_env (list: "production" | "development", default: "production")

Ask about features SPECIFIC to this app (payment gateway if e-commerce, CMS fields if blog, etc.).
Do NOT ask generic questions unrelated to the detected stack.`;

const TYPE_QUESTION_ADDONS = {
  api:       API_QUESTIONS,
  static:    STATIC_QUESTIONS,
  frontend:  FRONTEND_QUESTIONS,
  fullstack: FULLSTACK_QUESTIONS,
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate configuration questions based on the analysis.
 * Uses the fast HAIKU model — question generation is a structured output task.
 *
 * @param {object} analysis         - Result from analyzeRequest()
 * @param {string} originalPrompt   - User's original prompt
 * @param {string} [projectType]    - 'api' | 'frontend' | 'fullstack'
 */
export async function generateQuestions(analysis, originalPrompt, projectType = 'api') {
  // Detect static projects so we generate appropriate questions
  const effectiveType = (analysis.isStatic && projectType === 'frontend') ? 'static' : projectType;
  const typeInstructions = TYPE_QUESTION_ADDONS[effectiveType] || TYPE_QUESTION_ADDONS.api;

  const systemPrompt = BASE_INSTRUCTIONS + '\n\n' + typeInstructions;

  const frameworkHint =
    analysis.frontendFramework === 'nextjs' ? '"Next.js (SSR/SSG)"' :
    analysis.frontendFramework === 'react'  ? '"React (Vite SPA)"' :
    'N/A — static HTML project';

  const userMessage = `Original request: "${originalPrompt}"

Project type: ${projectType}
Effective type for questions: ${effectiveType}

Analysis:
${JSON.stringify(analysis, null, 2)}

Generate precise configuration questions for this ${effectiveType} project.
Make questions reflect the SPECIFIC technologies detected.
Frontend framework default (if applicable): ${frameworkHint}

IMPORTANT: This is a "${analysis.summary}" — generate questions tailored to THIS specific project, not generic defaults.`;

  // Question generation is a structured JSON task — HAIKU is fast and sufficient
  const text   = await sendMessage(MODELS.HAIKU, systemPrompt, userMessage, 4096);
  const parsed = extractJSON(text);
  return parsed.questions;
}
