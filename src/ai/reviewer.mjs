import { sendMessage, extractJSON, MODELS } from './client.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// Self-Review Gate
//
// After code generation, this module scans the generated files for common bugs,
// security issues, and quality problems. Uses the fast/cheap HAIKU model (V3)
// since it's pattern-matching, not reasoning. Returns either "clean" or a list
// of file patches to apply.
// ─────────────────────────────────────────────────────────────────────────────

const REVIEW_SYSTEM = `You are VBS Code Reviewer — a security-focused code auditor.

You receive generated code files and scan them for BUGS, SECURITY ISSUES, and QUALITY PROBLEMS.

Check for these specific issues:

CRITICAL BUGS:
- Missing await on async function calls
- Missing error handling (unhandled promise rejection)
- app.listen() duplicated or in wrong file (should be ONLY in index.js)
- Missing module exports (function defined but not exported)
- Import paths that don't match actual file paths
- Middleware registered after routes (won't work)
- Error handler middleware with only 3 args (needs 4: err, req, res, next)

SECURITY VULNERABILITIES:
- SQL injection: string concatenation in queries instead of parameterized ($1, $2)
- Missing helmet() in middleware chain
- No rate limiting on auth endpoints
- bcrypt using sync methods (hashSync/compareSync blocks event loop)
- bcrypt with salt rounds < 10
- JWT without expiresIn option
- Hardcoded secrets (JWT secret, DB password as literal string, not from env)
- console.log() of passwords, tokens, or secrets
- Error responses that leak stack traces or internal details to client
- Missing input validation on POST/PUT/PATCH endpoints
- CORS set to "*" without comment explaining it's intentional

DATA ISSUES:
- Missing database table/collection creation (schema init)
- Foreign keys without ON DELETE behavior
- Missing indexes on frequently queried columns (email, username)
- No connection pool configuration (using new Client() instead of Pool for pg)
- Missing database error handling (connection failures)

CODE QUALITY:
- var instead of const/let
- Mixed async patterns (.then() mixed with await in same function)
- Dead code or unreachable code
- Empty catch blocks that swallow errors silently
- Missing return after res.send/res.json in conditional branches (double response)

Return ONLY valid JSON:
{
  "status": "clean" | "issues_found",
  "issueCount": 0,
  "issues": [
    {
      "file": "src/routes/auth.routes.js",
      "line_hint": "near the login handler",
      "severity": "critical" | "security" | "warning",
      "issue": "Missing await on bcrypt.compare() — will always return a Promise (truthy), bypassing password check",
      "fix": "Add await: const isMatch = await bcrypt.compare(password, user.password_hash);"
    }
  ],
  "patchedFiles": [
    {
      "path": "src/routes/auth.routes.js",
      "content": "...complete corrected file content..."
    }
  ]
}

Rules:
- ONLY report REAL issues — not style preferences or nitpicks
- Focus on bugs that would cause runtime failures or security breaches
- If a file has issues, include the COMPLETE corrected file in patchedFiles
- If no issues found, return { "status": "clean", "issueCount": 0, "issues": [], "patchedFiles": [] }
- patchedFiles must contain the ENTIRE file content (not just the changed lines)
- Preserve ALL Korean comments exactly as they are
- Do NOT change file structure, variable names, or logic unless fixing a real bug
- Do NOT add features or refactor — ONLY fix bugs and security issues
- Maximum review: focus on the most critical 10 issues`;

/**
 * Review generated code for bugs and security issues.
 * Uses the fast HAIKU model — this is a pattern-matching task, not reasoning.
 *
 * @param {Array<{path: string, content: string}>} files - Generated files
 * @param {string} projectType - 'api' | 'frontend' | 'fullstack'
 * @returns {Promise<object>} - { status, issueCount, issues, patchedFiles }
 */
export async function reviewCode(files, projectType = 'api') {
  // Only review code files, not configs or static assets
  const codeExtensions = ['.js', '.mjs', '.ts', '.tsx', '.jsx'];
  const codeFiles = files.filter(f => codeExtensions.some(ext => f.path.endsWith(ext)));

  if (codeFiles.length === 0) {
    return { status: 'clean', issueCount: 0, issues: [], patchedFiles: [] };
  }

  // Build a compact file listing for the review prompt
  // Truncate very large files to fit in context
  const fileListings = codeFiles.map(f => {
    const content = f.content.length > 3000
      ? f.content.slice(0, 3000) + '\n// ... (truncated for review)'
      : f.content;
    return `═══ ${f.path} ═══\n${content}`;
  }).join('\n\n');

  const userMessage = `Review these ${projectType} project files for bugs and security issues:

${fileListings}

Scan for: SQL injection, missing await, auth bypasses, missing error handling, security misconfig.
Return ONLY real issues. If code is clean, say so.`;

  const text = await sendMessage(MODELS.HAIKU, REVIEW_SYSTEM, userMessage, 8192);

  try {
    return extractJSON(text);
  } catch {
    // If JSON parse fails, assume clean (reviewer couldn't find structured issues)
    return { status: 'clean', issueCount: 0, issues: [], patchedFiles: [] };
  }
}

/**
 * Apply patches from a review result to the original file list.
 *
 * @param {Array<{path: string, content: string}>} originalFiles - Original generated files
 * @param {Array<{path: string, content: string}>} patchedFiles  - Corrected files from reviewer
 * @returns {Array<{path: string, content: string}>} - Merged file list
 */
export function applyPatches(originalFiles, patchedFiles) {
  if (!patchedFiles || patchedFiles.length === 0) return originalFiles;

  const patchMap = new Map(patchedFiles.map(f => [f.path, f.content]));

  return originalFiles.map(f => {
    if (patchMap.has(f.path)) {
      return { path: f.path, content: patchMap.get(f.path) };
    }
    return f;
  });
}
