import chalk   from 'chalk';
import boxen   from 'boxen';
import figures from 'figures';
import { existsSync } from 'fs';

import { findProject }     from '../projects/registry.mjs';
import { readConfigVbs, hasConfigVbs } from '../projects/config.mjs';
import { showTitleScreen, log }        from '../ui/display.mjs';
import { fileURLToPath }   from 'url';
import { dirname, join }   from 'path';
import { readFileSync }    from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const pkg        = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'));

export async function runOpen(name) {
  showTitleScreen(pkg.version);

  // Try registry first
  let entry = await findProject(name);

  // If not in registry but given a path, try reading config.vbs directly
  if (!entry) {
    // Maybe the user passed a dir
    if (existsSync(name) && await hasConfigVbs(name)) {
      const cfg = await readConfigVbs(name);
      entry = { name: cfg.name, dir: name, type: cfg.type };
    }
  }

  if (!entry) {
    console.log(
      boxen(
        chalk.red(`Project "${name}" not found in registry.\n\n`) +
        chalk.gray('Run ') + chalk.cyan('vbs list') + chalk.gray(' to see all projects.'),
        { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'red' }
      )
    );
    process.exit(1);
  }

  const dirOk = existsSync(entry.dir);

  // Try reading config.vbs for full detail
  let cfg = null;
  if (dirOk && await hasConfigVbs(entry.dir)) {
    try { cfg = await readConfigVbs(entry.dir); } catch {}
  }

  const typeColor =
    entry.type === 'fullstack' ? chalk.green  :
    entry.type === 'frontend'  ? chalk.magenta :
    chalk.cyan;

  // Build the info panel
  const lines = [
    chalk.bold.white(`  Project: ${typeColor(entry.name)}`),
    '',
    `  ${chalk.bold('Type:')}      ${typeColor(cfg?.type || entry.type || 'api')}`,
    `  ${chalk.bold('Directory:')} ${dirOk ? chalk.gray(entry.dir) : chalk.red(entry.dir + '  ✖ missing')}`,
    `  ${chalk.bold('Created:')}   ${chalk.gray(cfg?.createdAt ? new Date(cfg.createdAt).toLocaleString() : '—')}`,
    `  ${chalk.bold('Updated:')}   ${chalk.gray(cfg?.updatedAt ? new Date(cfg.updatedAt).toLocaleString() : '—')}`,
    '',
  ];

  if (cfg?.prompt) {
    lines.push(`  ${chalk.bold('Prompt:')}    ${chalk.gray(cfg.prompt.slice(0, 90) + (cfg.prompt.length > 90 ? '…' : ''))}`);
    lines.push('');
  }

  // Stack
  const stack = cfg?.stack || entry.stack || [];
  if (stack.length > 0) {
    lines.push(`  ${chalk.bold('Stack:')}     ${chalk.cyan(Array.isArray(stack) ? stack.join(', ') : stack)}`);
  }

  // Backend info
  if (cfg?.backend) {
    lines.push(`  ${chalk.bold('Backend:')}   port ${chalk.cyan(cfg.backend.port)}  •  pm2: ${chalk.magenta(cfg.backend.pm2Name || '—')}`);
  } else if (entry.port) {
    lines.push(`  ${chalk.bold('Port:')}      ${chalk.cyan(entry.port)}`);
  }

  // Frontend info
  if (cfg?.frontend) {
    lines.push(`  ${chalk.bold('Frontend:')}  ${chalk.magenta(cfg.frontend.framework || '—')}  •  pm2: ${chalk.magenta(cfg.frontend.pm2Name || '—')}`);
  }

  // Server IP
  if (cfg?.server?.ip) {
    const ip = cfg.server.ip;
    const backPort  = cfg?.backend?.port  || entry.port;
    const frontPort = cfg?.frontend?.port || '';
    if (cfg?.type === 'fullstack') {
      lines.push(`  ${chalk.bold('URLs:')}      API: ${chalk.cyan(`http://${ip}:${backPort}`)}  Front: ${chalk.cyan(`http://${ip}${frontPort ? ':' + frontPort : ''}`)}`);
    } else if (cfg?.type === 'frontend') {
      lines.push(`  ${chalk.bold('URL:')}       ${chalk.cyan(`http://${ip}${frontPort ? ':' + frontPort : ':80'}`)}`);
    } else {
      lines.push(`  ${chalk.bold('URL:')}       ${chalk.cyan(`http://${ip}:${backPort}`)}`);
    }
  }

  lines.push('');

  // pm2 quick commands
  const pm2Names = [];
  if (cfg?.backend?.pm2Name)  pm2Names.push(cfg.backend.pm2Name);
  if (cfg?.frontend?.pm2Name) pm2Names.push(cfg.frontend.pm2Name);
  if (pm2Names.length === 0 && entry.name) pm2Names.push(entry.name);

  lines.push(chalk.bold('  Quick commands:'));
  for (const n of pm2Names) {
    lines.push(chalk.gray(`  pm2 logs ${n.padEnd(20)} `) + chalk.gray('← tail logs'));
    lines.push(chalk.gray(`  pm2 restart ${n.padEnd(17)} `) + chalk.gray('← restart'));
  }

  lines.push('');
  lines.push(chalk.gray(`  ${entry.dir}/config.vbs`) + chalk.gray('  ← full project config'));

  // Endpoints count
  if (cfg?.endpoints?.length > 0) {
    lines.push('');
    lines.push(chalk.bold('  Endpoints:') + chalk.gray(`  (${cfg.endpoints.length} total)`));
    const shown = cfg.endpoints.slice(0, 6);
    for (const ep of shown) {
      const auth = ep.requiresAuth ? chalk.yellow(' 🔒') : '';
      lines.push(
        `  ${chalk.cyan(ep.method.padEnd(7))} ${chalk.white(ep.path)}${auth}  ${chalk.gray(ep.description || '')}`
      );
    }
    if (cfg.endpoints.length > 6) {
      lines.push(chalk.gray(`  … and ${cfg.endpoints.length - 6} more`));
    }
  }

  console.log(
    boxen(lines.join('\n'), {
      title: chalk.bold.cyan(` ${figures.info} Project Info `),
      titleAlignment: 'center',
      padding: { top: 0, bottom: 0, left: 0, right: 2 },
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
    })
  );

  console.log(
    chalk.gray('  Modify this project: ') +
    chalk.cyan(`vbs modify ${name} prompt='what to change'`) + '\n'
  );
}
