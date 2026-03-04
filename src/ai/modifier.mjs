import { sendMessage, extractJSON, MODELS } from './client.mjs';

const SYSTEM_PROMPT = `You are VBS (Virtual Based Scenography) — an expert project modifier and code surgeon.
You receive a full project context (config.vbs) and a modification request.
You return ONLY the files that need to be created or changed — not the entire project.

Your modifications must be SURGICAL and HIGH-QUALITY:
- Understand the existing architecture before making changes
- Maintain consistency with existing code style, patterns, and conventions
- Consider side effects: will your change break other files?
- Think about: data model changes, migration needs, UI consistency, auth impacts

Return ONLY valid JSON (no markdown):
{
  "summary": "One sentence describing what was changed",
  "files": [
    { "path": "relative/path/from/project/root", "content": "complete file content" }
  ],
  "restartRequired": true,
  "rebuildRequired": false,
  "newDependencies": [],
  "notes": "Any important notes for the user"
}

Rules:
- Only return files that actually changed — do NOT return unchanged files
- Files MUST contain complete, working content (not diffs or partials)
- When modifying a file, include the ENTIRE file content with the change integrated
- If adding a new dependency, update package.json AND list it in newDependencies
- Keep all existing Korean comments — add new ones in Korean too
- Maintain existing error handling patterns (AppError, asyncHandler if present)
- Maintain existing validation patterns (express-validator if present)
- If adding a new API endpoint, follow existing route/controller/service patterns
- If adding a new page/component, follow existing component structure and styling
- restartRequired: true if the backend needs to restart (pm2 restart)
- rebuildRequired: true if the frontend needs to rebuild (npm run build)
- Be precise — if only one route changes, only return that route file (+ package.json if needed)
- If the modification affects the database schema, include migration/init SQL updates
- If the modification adds auth to a previously unprotected route, update the endpoint list
- SECURITY: validate any new user inputs, use parameterized queries for DB, escape output
- QUALITY: follow the same architecture patterns as the existing codebase

ANTI-PATTERNS — NEVER DO THESE:
- NEVER: db.query("SELECT * FROM x WHERE id = " + id) → USE parameterized $1
- NEVER: catch(err) { res.send(err) } → LEAKS stack traces
- NEVER: bcrypt.hashSync / bcrypt.compareSync → BLOCKS event loop, use async
- NEVER: jwt.sign without { expiresIn } → TOKEN NEVER EXPIRES
- NEVER: Hardcoded secrets → use process.env
- NEVER: Missing await on async calls → returns Promise not result
- NEVER: res.json() without return in if/else → DOUBLE RESPONSE crash
- NEVER: var → use const or let

CRITICAL COMMENT RULE:
- ALL comments in ALL generated code files MUST be written in Korean (한국어)
- NEVER write comments in English — Korean only`;

/**
 * Generate file modifications for an existing VBS project.
 *
 * @param {object} configVbs       - Full config.vbs object
 * @param {string} modification    - User's modification request
 * @returns {Promise<object>}      - { summary, files, restartRequired, rebuildRequired, notes }
 */
export async function generateModification(configVbs, modification) {
  const userMessage = `Modify this existing VBS project.

MODIFICATION REQUEST:
${modification}

CURRENT PROJECT CONTEXT (config.vbs):
${JSON.stringify(configVbs, null, 2)}

Think carefully about:
1. What files exist and their architecture patterns
2. What needs to change and what side effects those changes have
3. Whether new dependencies are needed
4. Whether database schema changes are needed
5. Whether the change affects auth, security, or data validation

Generate ONLY the files that need to change. Return complete file contents.
All comments must be in Korean (한국어).`;

  const text = await sendMessage(MODELS.OPUS, SYSTEM_PROMPT, userMessage, 8192);
  return extractJSON(text);
}
