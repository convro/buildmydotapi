import { sendMessage, extractJSON, MODELS } from './client.mjs';

// ── Base structure prompt ──────────────────────────────────────────────────────

const BASE_INSTRUCTIONS = `You are VBS (Virtual Based Scenography). Generate precise technical configuration questions for a project.

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

Rules:
- "choices" only for type "list"
- "default" for "confirm" must be true or false (boolean)
- "validate" optional; only use "port_number" for port fields
- Keep messages short and clear
- All questions must have a sensible default so user can press Enter to skip`;

// ── Type-specific question banks ───────────────────────────────────────────────

const API_QUESTIONS = `
Generate 7-12 technical questions. ALWAYS include:
- project_name (input, default: suggested name)
- port (input, default: "3000", validate: "port_number")

Include IF relevant to the request:
- database_name, database_user, database_password (if DB in stack)
- jwt_auto_generate: auto-generate JWT secret vs custom (confirm, default: true)
- cors_origins (input, default: "*")
- rate_limiting (confirm, default: false)
- node_env (list: "production" | "development", default: "production")
- additional features from the request (e.g. file_upload, email_service, etc.)`;

const FRONTEND_QUESTIONS = `
Generate 8-12 technical questions. ALWAYS include:
- project_name (input, default: suggested name)
- frontend_framework (list: "React (Vite SPA)" | "Next.js (SSR/SSG)", default first if analysis says react)
- typescript (confirm, default: true)
- styling (list: "Tailwind CSS" | "CSS Modules" | "Plain CSS", default: "Tailwind CSS")
- port (input, default: "3000", validate: "port_number")

Include IF relevant:
- app_title (input, for HTML <title> and branding)
- auth_required (confirm, default: false) — if auth needed
- api_base_url (input) — if connecting to an external API
- dark_mode (confirm, default: false)
- pwa (confirm, default: false) — Progressive Web App
- i18n (confirm, default: false) — internationalization
- Additional features from the request`;

const FULLSTACK_QUESTIONS = `
Generate 10-16 technical questions. ALWAYS include:
- project_name (input, default: suggested name)
- frontend_framework (list: "React (Vite SPA)" | "Next.js (SSR/SSG)")
- typescript (confirm, default: true)
- styling (list: "Tailwind CSS" | "CSS Modules" | "Plain CSS")
- backend_port (input, default: "3001", validate: "port_number") — Express API port
- frontend_port (input, default: "3000", validate: "port_number") — Frontend dev port

Include IF relevant:
- database (list: "PostgreSQL" | "SQLite" | "MongoDB" | "None") — if DB needed
- database_name, database_user (if DB selected)
- auth_type (list: "JWT" | "None") — if auth needed
- cors_origins (input, default: "*")
- rate_limiting (confirm, default: false)
- node_env (list: "production" | "development")
- app_title (input) — page title / branding
- dark_mode (confirm, default: false)
- Additional features from the request`;

const TYPE_QUESTION_ADDONS = {
  api:       API_QUESTIONS,
  frontend:  FRONTEND_QUESTIONS,
  fullstack: FULLSTACK_QUESTIONS,
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate configuration questions based on the analysis.
 * @param {object} analysis         - Result from analyzeRequest()
 * @param {string} originalPrompt   - User's original prompt
 * @param {string} [projectType]    - 'api' | 'frontend' | 'fullstack'
 */
export async function generateQuestions(analysis, originalPrompt, projectType = 'api') {
  const typeInstructions = TYPE_QUESTION_ADDONS[projectType] || TYPE_QUESTION_ADDONS.api;
  const systemPrompt     = BASE_INSTRUCTIONS + '\n\n' + typeInstructions;

  const userMessage = `Original request: ${originalPrompt}

Project type: ${projectType}

Analysis result:
${JSON.stringify(analysis, null, 2)}

Generate precise technical configuration questions for this ${projectType} project.
Make sure questions reflect the specific tech in the analysis (e.g. if PostgreSQL detected, ask DB questions).
For frontend_framework default, use: ${analysis.frontendFramework === 'nextjs' ? '"Next.js (SSR/SSG)"' : '"React (Vite SPA)"'}.`;

  const text   = await sendMessage(MODELS.OPUS, systemPrompt, userMessage, 2048);
  const parsed = extractJSON(text);
  return parsed.questions;
}
