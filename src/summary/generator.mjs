import { promises as fs } from 'fs';
import { join }           from 'path';
import { shell }          from '../system/executor.mjs';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getServerIP() {
  const res = await shell(
    "curl -s --connect-timeout 3 ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}'"
  );
  return (res.stdout.trim() || 'YOUR_SERVER_IP').split('\n')[0].trim();
}

function padMethod(m) { return m.padEnd(6); }

function buildEndpointsSection(endpoints, serverIp, port) {
  if (!endpoints?.length) return '';

  const base = `http://${serverIp}:${port}`;
  const pub  = endpoints.filter(e => !e.requiresAuth);
  const prot = endpoints.filter(e =>  e.requiresAuth);

  let out = `ENDPOINTS\n  Base URL: ${base}\n\n`;

  if (pub.length) {
    out += '  [PUBLIC]\n';
    for (const ep of pub) {
      out += `  ${padMethod(ep.method)} ${base}${ep.path}\n`;
      out += `         → ${ep.description}\n`;
      if (ep.exampleBody) out += `         Body: ${JSON.stringify(ep.exampleBody)}\n`;
      out += '\n';
    }
  }

  if (prot.length) {
    out += '  [PROTECTED — Bearer Token Required]\n';
    for (const ep of prot) {
      out += `  ${padMethod(ep.method)} ${base}${ep.path}\n`;
      out += `         Headers: Authorization: Bearer {token}\n`;
      out += `         → ${ep.description}\n`;
      if (ep.exampleBody) out += `         Body: ${JSON.stringify(ep.exampleBody)}\n`;
      out += '\n';
    }
  }

  return out;
}

function buildCurlExamples(endpoints, serverIp, port) {
  if (!endpoints?.length) return 'CURL EXAMPLES\n  (no endpoints)\n';

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
  if (!testResults?.length) return 'TEST RESULTS\n  No test results recorded.\n';

  const passed = testResults.filter(r => r.passed).length;
  const total  = testResults.length;
  const icon   = passed === total ? '✔' : '⚠';

  let out = `TEST RESULTS\n  Total:  ${total}\n  Passed: ${passed}/${total} ${icon}\n\n`;

  for (const r of testResults) {
    const mark = r.passed ? '✔' : '✖';
    out += `  ${mark}  ${r.method.padEnd(6)} ${r.path.padEnd(32)} → ${String(r.status || 'ERR').padEnd(4)} (${r.time}ms)\n`;
  }

  return out;
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateSummary({
  projectName,
  projectDir,
  projectType   = 'api',
  stack,
  port,
  backendPort,
  frontendPort,
  frontendFramework,
  endpoints,
  testResults,
  aiNotes,
  answers,
  serverIp:    providedIp = null,
  version      = '2.0.0',
  nginxConfig  = null,
}) {
  const serverIp = process.env.SERVER_IPV4?.trim() || providedIp || await getServerIP();
  const dateStr  = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const line     = '═'.repeat(55);

  const apiPort  = backendPort || port;

  const endpointsSection = projectType !== 'frontend'
    ? buildEndpointsSection(endpoints, serverIp, apiPort)
    : '';
  const curlSection      = projectType !== 'frontend'
    ? buildCurlExamples(endpoints, serverIp, apiPort)
    : '';
  const testSection      = buildTestResults(testResults);

  let serverSection = '';

  if (projectType === 'api') {
    serverSection = `SERVER
  Port:       ${port}
  Process:    pm2 (name: ${projectName})
  URL:        http://${serverIp}:${port}

  pm2 start:    pm2 start ${projectName}
  pm2 stop:     pm2 stop ${projectName}
  pm2 restart:  pm2 restart ${projectName}
  pm2 logs:     pm2 logs ${projectName}`;
  }

  if (projectType === 'frontend') {
    serverSection = `SERVER
  Type:       Frontend (${frontendFramework || 'react'})
  ${nginxConfig ? `nginx:      ${nginxConfig}\n  URL:        http://${serverIp}` : `Port:       ${port}`}

  Build:      npm run build
  ${frontendFramework === 'nextjs' ? `pm2 start:  pm2 start ${projectName}-front\n  pm2 logs:   pm2 logs ${projectName}-front` : 'nginx serves dist/ folder'}`;
  }

  if (projectType === 'fullstack') {
    serverSection = `SERVER
  Type:       Full-Stack (Express + ${frontendFramework || 'react'})
  Backend:    port ${backendPort}  ·  pm2: ${projectName}-api
  Frontend:   ${nginxConfig ? 'nginx (static/proxy)' : `port ${frontendPort}  ·  pm2: ${projectName}-front`}
  ${nginxConfig ? `nginx:      ${nginxConfig}\n  URL:        http://${serverIp}  (/api → :${backendPort}, / → frontend)` : `Backend URL:  http://${serverIp}:${backendPort}`}

  pm2 restart:  pm2 restart ${projectName}-api
  pm2 logs:     pm2 logs ${projectName}-api
  ${frontendFramework === 'nextjs' ? `pm2 restart frontend: pm2 restart ${projectName}-front` : ''}
  Rebuild frontend:     cd ${projectDir}/frontend && npm run build`;
  }

  // Env vars heuristic
  const envVarNames = ['PORT', 'NODE_ENV'];
  if (answers?.database_name || answers?.db_name) {
    envVarNames.push('DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD');
  }
  if (answers?.jwt_auto_generate !== undefined) envVarNames.push('JWT_SECRET');

  const summary = `${line}
  VBS — Virtual Based Scenography  |  Deployment Summary
  Generated: ${dateStr}
  Version:   v${version}
${line}

PROJECT
  Name:       ${projectName}
  Type:       ${projectType}
  Directory:  ${projectDir}
  Stack:      ${(stack || []).join(', ')}

${serverSection}

${endpointsSection}${curlSection}

${testSection}
AI NOTES
  ${(aiNotes || 'No notes available.').split('\n').join('\n  ')}

ENVIRONMENT
  ${projectDir}/.env  ← DO NOT commit this file!
  Variables: ${envVarNames.join(', ')}

CONFIG
  ${projectDir}/config.vbs  ← Project config (safe to commit)
  Load project: vbs open ${projectName}
  Modify:       vbs modify ${projectName} prompt='...'

${line}
  Created with VBS — Virtual Based Scenography v${version}
${line}
`;

  return summary;
}

export async function writeSummaryFiles(summary, projectDir) {
  await fs.writeFile(join(projectDir, 'summary.txt'), summary, 'utf8');
  await fs.writeFile(join(process.cwd(), 'summary.txt'), summary, 'utf8');
}
