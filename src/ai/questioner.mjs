import { sendMessage, extractJSON, MODELS } from './client.mjs';

// ── Base structure prompt ──────────────────────────────────────────────────────

const BASE_INSTRUCTIONS = `You are VBS (Virtual Based Scenography) — an expert project configurator. Generate precise, intelligent technical configuration questions for a project.

Your questions should be smart — anticipate what the developer needs and offer the best defaults.
Think about: what decisions affect architecture? what can be auto-detected? what MUST the user decide?

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
- Keep messages short, clear, and actionable
- All questions must have a sensible, production-ready default so user can press Enter to skip
- Order questions logically: name → framework → database → auth → features → ports → advanced
- Group related questions together
- Use smart defaults based on the analysis (e.g. if analysis detects PostgreSQL, default DB question to PostgreSQL)`;

// ── Type-specific question banks ───────────────────────────────────────────────

const API_QUESTIONS = `
Generate 8-14 technical questions. ALWAYS include:
- project_name (input, default: suggested name)
- port (input, default: "3000", validate: "port_number")
- node_env (list: "production" | "development", default: "production")

Include IF relevant to the request:
- database_name, database_user, database_password (if DB in stack)
- jwt_auto_generate: auto-generate JWT secret vs custom (confirm, default: true)
- cors_origins (input, default: "*")
- rate_limiting (confirm, default: true) — recommend ON for production
- enable_logging (list: "minimal" | "detailed" | "none", default: "detailed")
- pagination_default (input, default: "20") — default items per page for list endpoints
- enable_soft_delete (confirm, default: true) — soft delete instead of hard delete for data safety
- additional features from the request (e.g. file_upload, email_service, webhooks, etc.)`;

const FRONTEND_QUESTIONS = `
Generate 8-14 technical questions. ALWAYS include:
- project_name (input, default: suggested name)
- frontend_framework (list: "React (Vite SPA)" | "Next.js (SSR/SSG)", default first if analysis says react)
- typescript (confirm, default: true)
- styling (list: "Tailwind CSS" | "CSS Modules" | "Plain CSS", default: "Tailwind CSS")
- port (input, default: "3000", validate: "port_number")

Include IF relevant:
- app_title (input, for HTML <title> and branding)
- primary_color (list: "blue" | "indigo" | "emerald" | "violet" | "rose", default: "indigo") — brand color theme
- auth_required (confirm, default: false) — if auth needed
- api_base_url (input) — if connecting to an external API
- dark_mode (confirm, default: true) — dark mode support (recommend ON)
- responsive_design (confirm, default: true) — mobile responsive (recommend ON)
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
- auth_type (list: "JWT (access + refresh)" | "Session" | "None") — if auth needed
- primary_color (list: "blue" | "indigo" | "emerald" | "violet" | "rose", default: "indigo")
- cors_origins (input, default: "*")
- rate_limiting (confirm, default: true) — recommend ON
- node_env (list: "production" | "development")
- app_title (input) — page title / branding
- dark_mode (confirm, default: true) — dark mode support
- enable_logging (list: "minimal" | "detailed" | "none", default: "detailed")
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

  // Build context about detected entities and security needs for smarter questions
  const entityContext = analysis.dataEntities?.length
    ? `\nDetected data entities: ${analysis.dataEntities.join(', ')}`
    : '';
  const securityContext = analysis.securityNeeds?.length
    ? `\nSecurity needs: ${analysis.securityNeeds.join(', ')}`
    : '';
  const suggestedContext = analysis.suggestedFeatures?.length
    ? `\nSuggested features: ${analysis.suggestedFeatures.join(', ')}`
    : '';

  const userMessage = `Original request: ${originalPrompt}

Project type: ${projectType}

Analysis result:
${JSON.stringify(analysis, null, 2)}
${entityContext}${securityContext}${suggestedContext}

Generate precise technical configuration questions for this ${projectType} project.
Make sure questions reflect the specific tech in the analysis (e.g. if PostgreSQL detected, ask DB questions).
For frontend_framework default, use: ${analysis.frontendFramework === 'nextjs' ? '"Next.js (SSR/SSG)"' : '"React (Vite SPA)"'}.
Ask about suggested features if relevant — the user may want them.`;

  const text   = await sendMessage(MODELS.OPUS, systemPrompt, userMessage, 2048);
  const parsed = extractJSON(text);
  return parsed.questions;
}
