import { promises as fs } from 'fs';
import { join } from 'path';
import { shell } from '../system/executor.mjs';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getServerIP() {
  const res = await shell(
    "curl -s --connect-timeout 3 ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}'"
  );
  return (res.stdout.trim() || 'YOUR_SERVER_IP').split('\n')[0].trim();
}

function padMethod(method) {
  return method.padEnd(6);
}

function buildEndpointsSection(endpoints, serverIp, port) {
  if (!endpoints || endpoints.length === 0) return '';

  const baseUrl = `http://${serverIp}:${port}`;
  const pub     = endpoints.filter(e => !e.requiresAuth);
  const prot    = endpoints.filter(e =>  e.requiresAuth);

  let out = `ENDPOINTS\n  Base URL: ${baseUrl}\n\n`;

  if (pub.length > 0) {
    out += '  [PUBLIC]\n';
    for (const ep of pub) {
      out += `  ${padMethod(ep.method)} ${baseUrl}${ep.path}\n`;
      out += `         → ${ep.description}\n`;
      if (ep.exampleBody) {
        out += `         Body: ${JSON.stringify(ep.exampleBody)}\n`;
      }
      out += '\n';
    }
  }

  if (prot.length > 0) {
    out += '  [PROTECTED — Bearer Token Required]\n';
    for (const ep of prot) {
      out += `  ${padMethod(ep.method)} ${baseUrl}${ep.path}\n`;
      out += `         Headers: Authorization: Bearer {token}\n`;
      out += `         → ${ep.description}\n`;
      if (ep.exampleBody) {
        out += `         Body: ${JSON.stringify(ep.exampleBody)}\n`;
      }
      out += '\n';
    }
  }

  return out;
}

function buildCurlExamples(endpoints, serverIp, port) {
  if (!endpoints || endpoints.length === 0) return 'CURL EXAMPLES\n  (no endpoints)\n';

  const base = `http://${serverIp}:${port}`;
  let out = 'CURL EXAMPLES\n';

  for (const ep of endpoints) {
    out += `\n  # ${ep.description}:\n`;
    if (ep.method === 'GET' && !ep.requiresAuth) {
      out += `  curl ${base}${ep.path}\n`;
    } else if (ep.method === 'GET' && ep.requiresAuth) {
      out += `  curl ${base}${ep.path} \\\n    -H "Authorization: Bearer $TOKEN"\n`;
    } else if (['POST', 'PUT', 'PATCH'].includes(ep.method)) {
      out += `  curl -X ${ep.method} ${base}${ep.path} \\\n`;
      out += `    -H "Content-Type: application/json" \\\n`;
      if (ep.requiresAuth) out += `    -H "Authorization: Bearer $TOKEN" \\\n`;
      if (ep.exampleBody)  out += `    -d '${JSON.stringify(ep.exampleBody)}'\n`;
    } else if (ep.method === 'DELETE') {
      out += `  curl -X DELETE ${base}${ep.path}`;
      if (ep.requiresAuth) out += ` \\\n    -H "Authorization: Bearer $TOKEN"`;
      out += '\n';
    }
  }

  return out;
}

function buildTestResults(testResults) {
  if (!testResults || testResults.length === 0) {
    return 'TEST RESULTS\n  No test results recorded.\n';
  }

  const passed  = testResults.filter(r => r.passed).length;
  const total   = testResults.length;
  const icon    = passed === total ? '✔' : '⚠';

  let out = `TEST RESULTS\n`;
  out += `  Total:  ${total} endpoints tested\n`;
  out += `  Passed: ${passed}/${total} ${icon}\n\n`;

  for (const r of testResults) {
    const mark = r.passed ? '✔' : '✖';
    out += `  ${mark}  ${r.method.padEnd(6)} ${r.path.padEnd(32)} → ${String(r.status || 'ERR').padEnd(4)} (${r.time}ms)\n`;
  }

  return out;
}

// ─── Main Generator ───────────────────────────────────────────────────────────

/**
 * Generate the full summary.txt content.
 */
export async function generateSummary({
  projectName,
  projectDir,
  stack,
  port,
  endpoints,
  testResults,
  aiNotes,
  answers,
  serverIp: providedIp = null,
  version = '1.9.0',
}) {
  // Use explicitly set SERVER_IPV4 env var, then caller-provided IP, then auto-detect
  const serverIp = process.env.SERVER_IPV4?.trim() || providedIp || await getServerIP();
  const now      = new Date();
  const dateStr  = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const line     = '═'.repeat(51);

  const endpointsSection = buildEndpointsSection(endpoints, serverIp, port);
  const curlSection      = buildCurlExamples(endpoints, serverIp, port);
  const testSection      = buildTestResults(testResults);

  // Collect env var names (heuristic)
  const envVarNames = ['PORT', 'NODE_ENV', 'JWT_SECRET'];
  if (answers.database_name || answers.db_name) {
    envVarNames.push('DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD');
  }

  const summary = `${line}
  VBS — Virtual Based Scenography | Deployment Summary
  Generated: ${dateStr}
${line}

PROJECT
  Name:       ${projectName}
  Directory:  ${projectDir}
  Stack:      ${stack.join(', ')}

SERVER
  Port:       ${port}
  Process:    pm2 (name: ${projectName})
  Status:     ✔ ONLINE

  Start:      pm2 start ${projectName}
  Stop:       pm2 stop ${projectName}
  Restart:    pm2 restart ${projectName}
  Logs:       pm2 logs ${projectName}

${endpointsSection}${curlSection}

${testSection}
AI NOTES
  ${(aiNotes || 'No notes available.').split('\n').join('\n  ')}

ENVIRONMENT
  ${projectDir}/.env  ← DO NOT commit this file!

  Variables set:
  - ${envVarNames.join('\n  - ')}

${line}
  Created with VBS — Virtual Based Scenography v${version}
${line}
`;

  return summary;
}

/**
 * Write summary.txt to the project directory AND the current working directory.
 */
export async function writeSummaryFiles(summary, projectDir) {
  await fs.writeFile(join(projectDir, 'summary.txt'), summary, 'utf8');
  await fs.writeFile(join(process.cwd(), 'summary.txt'), summary, 'utf8');
}
