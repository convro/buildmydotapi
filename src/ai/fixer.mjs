import { sendMessage, extractJSON, MODELS } from './client.mjs';

const FIXER_SYSTEM = `You are VBS (Virtual Based Scenography) build error fixer.

You receive build/compilation error logs and the source files that caused them.
Analyze the errors and return ONLY valid JSON (no markdown):

{
  "patches": [
    { "path": "relative/path/to/file", "content": "complete corrected file content" }
  ],
  "explanation": "brief description of what was wrong and what was fixed"
}

Rules:
- Return COMPLETE file contents — not diffs, not fragments
- Only include files that actually need changes
- Fix ONLY the reported errors — do not refactor, rename, or add features
- If error mentions a missing import, add it
- If error is a TypeScript type error, fix the type annotation
- If error is in package.json (wrong version, missing dep), fix package.json
- If error is in a config file (tsconfig, vite.config, next.config), fix the config
- ALL code comments must remain in Korean (한국어) — do not change them to English`;

/**
 * Ask AI to diagnose build errors and return file patches to fix them.
 *
 * @param {string}   errorLogs   - Combined stdout+stderr from failed build
 * @param {Array}    sourceFiles - Array of { path, content } objects
 * @param {string}   projectName
 * @param {Function} [onToken]   - Streaming progress callback
 * @returns {Array}              - Array of { path, content } patches
 */
export async function fixBuildErrors(errorLogs, sourceFiles, projectName, onToken = null) {
  const filesDump = sourceFiles
    .map(f => `=== ${f.path} ===\n${f.content}`)
    .join('\n\n');

  const userMessage = `Build failed for project "${projectName}".

=== BUILD ERROR LOG ===
${errorLogs.slice(0, 5000)}

=== SOURCE FILES (${sourceFiles.length} files) ===
${filesDump.slice(0, 14000)}

Fix the build errors. Return patches for all files that need changes.`;

  const text   = await sendMessage(MODELS.OPUS, FIXER_SYSTEM, userMessage, 16384, onToken);
  const result = extractJSON(text);
  return result.patches || [];
}
