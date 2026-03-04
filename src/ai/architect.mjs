import { sendMessage, extractJSON, MODELS } from './client.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// Pass 1: Architecture Planning
//
// Before generating any code, the AI designs the full architecture:
// file structure, data model, relationships, middleware chain, API contract.
// This plan is then fed to the code generator (Pass 2) so it can focus
// purely on writing high-quality code instead of also planning.
// ─────────────────────────────────────────────────────────────────────────────

const ARCHITECT_SYSTEM = `You are VBS Architect — a senior software architect who designs production systems.

Your job: receive a project description + user config and produce a detailed ARCHITECTURE PLAN.
You do NOT write code. You design the blueprint that a code generator will follow.

Think deeply about:
- Data model: entities, fields, types, relationships, constraints, indexes
- API contract: every endpoint with method, path, request/response shape, auth requirement
- File structure: every file that needs to exist, what it contains, how files depend on each other
- Middleware chain: exact order of middleware in Express
- Auth flow: registration → login → token refresh → protected routes (if auth needed)
- Database schema: tables/collections, columns/fields, types, constraints, foreign keys
- Frontend architecture: pages, components, routing, state management, API integration layer
- Error handling strategy: error classes, error codes, how errors propagate
- Security measures: which endpoints need rate limiting, which need validation, what headers

Return ONLY valid JSON (no markdown):
{
  "architecture": {
    "overview": "2-3 sentence summary of the system architecture",
    "dataModel": [
      {
        "entity": "User",
        "fields": [
          { "name": "id", "type": "SERIAL PRIMARY KEY", "constraints": "auto-increment" },
          { "name": "email", "type": "VARCHAR(255)", "constraints": "UNIQUE NOT NULL" },
          { "name": "password_hash", "type": "VARCHAR(255)", "constraints": "NOT NULL" },
          { "name": "created_at", "type": "TIMESTAMP", "constraints": "DEFAULT NOW()" }
        ],
        "indexes": ["email"],
        "relationships": ["has many Posts", "has many Comments"]
      }
    ],
    "endpoints": [
      {
        "method": "POST",
        "path": "/api/auth/register",
        "description": "Register new user",
        "requestBody": { "email": "string", "password": "string", "name": "string" },
        "responseBody": { "data": { "user": {}, "accessToken": "string", "refreshToken": "string" } },
        "statusCodes": [201, 400, 409],
        "auth": false,
        "rateLimit": true,
        "validation": ["email: isEmail", "password: minLength(8)", "name: notEmpty"]
      }
    ],
    "fileStructure": [
      { "path": "src/index.js", "purpose": "Server entry point — imports app.js, starts listening on PORT" },
      { "path": "src/app.js", "purpose": "Express app setup — middleware chain, route mounting, error handler" },
      { "path": "src/config.js", "purpose": "Centralized config — reads all env vars" },
      { "path": "src/routes/auth.routes.js", "purpose": "Auth routes — register, login, refresh, logout" },
      { "path": "src/controllers/auth.controller.js", "purpose": "Auth request handlers — parses req, calls service, sends res" },
      { "path": "src/services/auth.service.js", "purpose": "Auth business logic — register, login, token generation" },
      { "path": "src/models/user.model.js", "purpose": "User data access — CRUD queries using pg Pool" },
      { "path": "src/middleware/auth.middleware.js", "purpose": "JWT verification middleware" },
      { "path": "src/middleware/validate.middleware.js", "purpose": "express-validator validation runner" },
      { "path": "src/middleware/errorHandler.js", "purpose": "Global error handler + AppError class" },
      { "path": "src/db/pool.js", "purpose": "PostgreSQL connection pool" },
      { "path": "src/db/init.sql", "purpose": "Database schema initialization" }
    ],
    "middlewareChain": [
      "helmet()",
      "cors({ origin: process.env.CORS_ORIGIN })",
      "express.json({ limit: '10mb' })",
      "express.urlencoded({ extended: true })",
      "requestId middleware",
      "morgan('combined')",
      "routes",
      "404 handler",
      "global error handler"
    ],
    "authFlow": "Register → bcrypt hash → save user → generate JWT pair → Login → verify password → generate JWT pair → Refresh → verify refresh token → generate new access token → Protected routes → verify access token via middleware",
    "securityMeasures": [
      "helmet() on all routes",
      "rate-limit on /auth/* (10 req/min)",
      "bcryptjs salt rounds 12",
      "JWT HS256 with 1h access / 7d refresh",
      "express-validator on all POST/PUT/PATCH",
      "parameterized queries (pg $1, $2)",
      "no stack traces in production errors"
    ],
    "dependencies": {
      "production": ["express", "cors", "helmet", "dotenv", "pg", "jsonwebtoken", "bcryptjs", "express-rate-limit", "express-validator", "morgan"],
      "devDependencies": []
    },
    "envVars": [
      { "name": "PORT", "value": "3000", "required": true },
      { "name": "NODE_ENV", "value": "production", "required": true },
      { "name": "DATABASE_URL", "value": "postgresql://...", "required": true },
      { "name": "JWT_SECRET", "value": "<64-char-hex>", "required": true }
    ]
  }
}

Rules:
- Be EXHAUSTIVE — list every single file, every endpoint, every field
- Data model must include types, constraints, and relationships
- Endpoints must include request/response shapes, status codes, validation rules
- File structure must explain the PURPOSE of each file (what it does, what it imports/exports)
- Think about edge cases: what happens on duplicate email? what happens on expired token?
- For fullstack: plan both backend AND frontend, including the API integration layer
- For frontend: plan components, pages, routing, state management
- Do NOT write any code — only the architecture plan`;

const TYPE_CONTEXT = {
  api: `Design the architecture for a REST API project (Express.js on Node.js).
Focus on: data model, API endpoints, middleware, error handling, security.`,

  frontend: `Design the architecture for a frontend application.
Focus on: component tree, page routing, state management, API integration, UI patterns.
The file structure should use frontend conventions (src/components/, src/pages/, src/hooks/, etc.)`,

  fullstack: `Design the architecture for a full-stack application.
Backend in backend/ (Express.js), Frontend in frontend/ (React or Next.js).
Focus on: end-to-end data flow, API contract between front and back, auth flow, component architecture.
Frontend connects to backend via /api/* (nginx proxies).`,
};

/**
 * Generate an architecture plan for a project (Pass 1 of two-pass generation).
 *
 * @param {object} analysis       - Analysis from analyzeRequest()
 * @param {object} answers        - User answers from configuration
 * @param {string} originalPrompt - Original user prompt
 * @param {string} [projectType]  - 'api' | 'frontend' | 'fullstack'
 * @returns {Promise<object>}     - Architecture plan object
 */
export async function generateArchitecture(analysis, answers, originalPrompt, projectType = 'api') {
  const typeCtx = TYPE_CONTEXT[projectType] || TYPE_CONTEXT.api;

  // Build framework context
  const frontendFramework =
    answers.frontend_framework?.toLowerCase().includes('next') ? 'nextjs' :
    analysis.frontendFramework || 'react';

  const entityContext = analysis.dataEntities?.length
    ? `\nIdentified data entities: ${analysis.dataEntities.join(', ')}`
    : '';

  const securityContext = analysis.securityNeeds?.length
    ? `\nSecurity requirements: ${analysis.securityNeeds.join(', ')}`
    : '';

  const userMessage = `${typeCtx}

Original request: ${originalPrompt}

Detected stack: ${analysis.detectedStack.join(', ')}
Complexity: ${analysis.complexity}
Frontend framework: ${frontendFramework}
TypeScript: ${answers.typescript === true || answers.typescript === 'true' ? 'yes' : 'no'}
Styling: ${answers.styling || 'Tailwind CSS'}
${entityContext}${securityContext}

User configuration:
${JSON.stringify(answers, null, 2)}

Design a complete, detailed architecture plan for this project.
Think about EVERY file, EVERY endpoint, EVERY data relationship, EVERY security measure.
Be exhaustive — the code generator will rely on this plan to produce high-quality code.`;

  const text = await sendMessage(MODELS.OPUS, ARCHITECT_SYSTEM, userMessage, 4096);
  const result = extractJSON(text);
  return result.architecture || result;
}
