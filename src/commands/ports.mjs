import chalk   from 'chalk';
import Table   from 'cli-table3';
import figures from 'figures';

import { listProjects }    from '../projects/registry.mjs';
import { readConfigVbs, hasConfigVbs } from '../projects/config.mjs';
import { existsSync } from 'fs';

export async function runPorts() {
  const projects = await listProjects();

  if (projects.length === 0) {
    console.log(chalk.gray('\n  No VBS projects found.\n'));
    return;
  }

  const table = new Table({
    head: [
      chalk.bold.cyan('Port'),
      chalk.bold.cyan('Project'),
      chalk.bold.cyan('Type'),
      chalk.bold.cyan('Service'),
      chalk.bold.cyan('URL'),
    ],
    style: { head: [], border: ['gray'] },
    colWidths: [8, 20, 12, 14, 34],
  });

  const portEntries = [];

  for (const p of projects) {
    let cfg = null;
    if (existsSync(p.dir) && await hasConfigVbs(p.dir)) {
      try { cfg = await readConfigVbs(p.dir); } catch {}
    }

    const ip = cfg?.server?.ip || 'localhost';

    if (cfg?.backend?.port) {
      portEntries.push({
        port:    cfg.backend.port,
        name:    p.name,
        type:    p.type || 'api',
        service: 'backend',
        url:     `http://${ip}:${cfg.backend.port}`,
      });
    }

    if (cfg?.frontend?.port && cfg?.frontend?.framework === 'nextjs') {
      portEntries.push({
        port:    cfg.frontend.port,
        name:    p.name,
        type:    p.type || 'frontend',
        service: 'frontend',
        url:     `http://${ip}:${cfg.frontend.port}`,
      });
    }

    // Fallback to registry port
    if (!cfg?.backend?.port && !cfg?.frontend?.port && p.port) {
      portEntries.push({
        port:    p.port,
        name:    p.name,
        type:    p.type || 'api',
        service: 'main',
        url:     `http://localhost:${p.port}`,
      });
    }
  }

  // Sort by port number
  portEntries.sort((a, b) => a.port - b.port);

  // Check for conflicts
  const portCounts = {};
  for (const e of portEntries) {
    portCounts[e.port] = (portCounts[e.port] || 0) + 1;
  }

  for (const e of portEntries) {
    const conflict = portCounts[e.port] > 1;
    const portStr  = conflict
      ? chalk.red.bold(String(e.port) + ' ⚠')
      : chalk.green(String(e.port));

    table.push([
      portStr,
      chalk.white(e.name),
      chalk.gray(e.type),
      chalk.cyan(e.service),
      chalk.gray(e.url),
    ]);
  }

  console.log('\n' + chalk.bold.white('  VBS Port Map:\n'));
  console.log(table.toString());

  // Show nginx port 80 if fullstack/frontend projects exist
  const hasNginx = projects.some(p => p.type === 'fullstack' || p.type === 'frontend');
  if (hasNginx) {
    console.log(chalk.gray('\n  Port 80 (nginx) serves frontend/fullstack projects'));
  }

  const conflicts = Object.entries(portCounts).filter(([_, c]) => c > 1);
  if (conflicts.length > 0) {
    console.log(chalk.red.bold(`\n  ${figures.warning} Port conflict detected: `) +
      chalk.white(conflicts.map(([p]) => p).join(', ')));
  }

  console.log('');
}
