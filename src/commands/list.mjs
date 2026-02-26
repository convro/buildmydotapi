import chalk   from 'chalk';
import boxen   from 'boxen';
import Table   from 'cli-table3';
import figures from 'figures';
import { existsSync } from 'fs';

import { listProjects }    from '../projects/registry.mjs';
import { showTitleScreen } from '../ui/display.mjs';
import { fileURLToPath }   from 'url';
import { dirname, join }   from 'path';
import { readFileSync }    from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const pkg        = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'));

const TYPE_COLORS = {
  api:       chalk.cyan,
  frontend:  chalk.magenta,
  fullstack: chalk.green,
};

const TYPE_ICONS = {
  api:       '⚡',
  frontend:  '🎨',
  fullstack: '🚀',
};

export async function runList() {
  showTitleScreen(pkg.version);

  const projects = await listProjects();

  if (projects.length === 0) {
    console.log(
      boxen(
        chalk.gray('No projects saved yet.\n\nBuild your first:\n') +
        chalk.cyan('  vbs -h -s prompt=\'My first API\''),
        {
          padding: 1, margin: 1,
          borderStyle: 'round', borderColor: 'gray',
        }
      )
    );
    return;
  }

  const table = new Table({
    head: [
      chalk.bold.cyan('#'),
      chalk.bold.cyan('Name'),
      chalk.bold.cyan('Type'),
      chalk.bold.cyan('Stack'),
      chalk.bold.cyan('Port'),
      chalk.bold.cyan('Directory'),
      chalk.bold.cyan('Created'),
    ],
    style: { head: [], border: ['gray'] },
    colWidths: [4, 22, 12, 28, 7, 38, 14],
    wordWrap: true,
  });

  projects.forEach((p, i) => {
    const colorFn  = TYPE_COLORS[p.type] || chalk.white;
    const icon     = TYPE_ICONS[p.type]  || '•';
    const created  = p.createdAt
      ? new Date(p.createdAt).toISOString().slice(0, 10)
      : '—';
    const dirExists = existsSync(p.dir);
    const dirLabel  = dirExists
      ? chalk.gray(p.dir)
      : chalk.red(p.dir + ' ✖');

    const stack = Array.isArray(p.stack) ? p.stack.join(', ') : (p.stack || '—');

    table.push([
      chalk.gray(String(i + 1)),
      colorFn.bold(`${icon} ${p.name}`),
      colorFn(p.type || 'api'),
      chalk.gray(stack.length > 25 ? stack.slice(0, 23) + '…' : stack),
      chalk.white(String(p.port || '—')),
      dirLabel,
      chalk.gray(created),
    ]);
  });

  console.log('\n' + chalk.bold.white('  Saved VBS Projects:\n'));
  console.log(table.toString());

  console.log(
    '\n' + chalk.gray('  ') +
    chalk.cyan('vbs open <name>') +
    chalk.gray('   — show project details\n') +
    chalk.gray('  ') +
    chalk.cyan('vbs modify <name>') +
    chalk.gray(' — modify a project with AI\n')
  );
}
