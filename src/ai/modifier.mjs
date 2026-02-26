import { sendMessage, extractJSON, MODELS } from './client.mjs';

const SYSTEM_PROMPT = `You are VBS (Virtual Based Scenography) project modifier.
You receive a full project context (config.vbs) and a modification request.
You return ONLY the files that need to be created or changed — not the entire project.

Return ONLY valid JSON (no markdown):
{
  "summary": "One sentence describing what was changed",
  "files": [
    { "path": "relative/path/from/project/root", "content": "complete file content" }
  ],
  "restartRequired": true,
  "rebuildRequired": false,
  "notes": "Any important notes for the user"
}

Rules:
- Only return files that actually changed — do NOT return unchanged files
- Files MUST contain complete, working content (not diffs or partials)
- If adding a new dependency, update package.json
- Keep all existing Korean comments — add new ones in Korean too
- restartRequired: true if the backend needs to restart (pm2 restart)
- rebuildRequired: true if the frontend needs to rebuild (npm run build)
- Be precise — if only one route changes, only return that route file (+ package.json if needed)`;

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

Generate ONLY the files that need to change. Return complete file contents.
All comments must be in Korean (한국어).`;

  const text = await sendMessage(MODELS.OPUS, SYSTEM_PROMPT, userMessage, 8192);
  return extractJSON(text);
}
