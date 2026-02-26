#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ─── .env loading ─────────────────────────────────────────────────────────────
import dotenv from 'dotenv';
const cwdEnv  = join(process.cwd(), '.env');
const rootEnv = join(__dirname, '..', '.env');
if (existsSync(cwdEnv)) {
  dotenv.config({ path: cwdEnv });
} else if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config();
}

import { program } from 'commander';

const pkgPath = join(__dirname, '..', 'package.json');
const pkg     = JSON.parse(readFileSync(pkgPath, 'utf8'));

// ─── Arg pre-processing ───────────────────────────────────────────────────────
// Supports syntax:  vbs -h -s --type=fullstack prompt='my description'
// Also drops stray '&' separators used in docs.

function preprocessArgs(argv) {
  const processed = [];
  for (const arg of argv) {
    if (arg === '&') continue;
    if (arg.startsWith('prompt=')) {
      processed.push(arg.slice('prompt='.length));
      continue;
    }
    processed.push(arg);
  }
  return processed;
}

const processedArgv = [
  process.argv[0],
  process.argv[1],
  ...preprocessArgs(process.argv.slice(2)),
];

// ─── CLI ──────────────────────────────────────────────────────────────────────

program
  .name('vbs')
  .description(`VBS v${pkg.version} — Virtual Based Scenography\nAI-powered full-stack deployment for your VPS`)
  .helpOption('-H, --help', 'Show help')
  .version(pkg.version, '-v, --version', 'Show version');

// ── Default command: BUILD ─────────────────────────────────────────────────────
program
  .argument('[prompt]', "Describe what to build  (or use prompt='description')")
  .option('-h, --host',                    'Show server host/IP in output and links')
  .option('-s, --summary',                 'Generate extended summary after deployment')
  .option('-d, --debug',                   'Enable debug output')
  .option('-t, --type <type>',             'Project type: api | frontend | fullstack', 'api')
  .addHelpText('after', `
Project types:
  api        REST API (Express.js + optional DB)         [default]
  frontend   Frontend only (React/Vite or Next.js)
  fullstack  Full-stack: backend API + frontend + nginx

Build examples:
  vbs prompt='REST API for a blog with posts and comments'
  vbs -h -s prompt='E-commerce API with JWT auth and PostgreSQL'
  vbs -h -s --type=frontend prompt='Dashboard app with React and Tailwind'
  vbs -h -s --type=fullstack prompt='Blog platform with admin panel'

  Full syntax:
  vbs=${pkg.version} -h -s & --type=fullstack & prompt='your description'

Project management:
  vbs list                              List all saved projects
  vbs open  <name>                      Show project details
  vbs modify <name> prompt='changes'    Modify project with AI
`)
  .action(async (prompt, options) => {
    // Validate type
    const validTypes = ['api', 'frontend', 'fullstack'];
    if (!validTypes.includes(options.type)) {
      console.error(`\n  Error: unknown type "${options.type}". Use: api | frontend | fullstack\n`);
      process.exit(1);
    }

    const { run } = await import('../src/index.mjs');
    await run(prompt, options);
  });

// ── Subcommand: LIST ───────────────────────────────────────────────────────────
program
  .command('list')
  .description('List all saved VBS projects')
  .action(async () => {
    const { runList } = await import('../src/commands/list.mjs');
    await runList();
  });

// ── Subcommand: OPEN ───────────────────────────────────────────────────────────
program
  .command('open <name>')
  .description('Show detailed info about a saved project')
  .action(async (name) => {
    const { runOpen } = await import('../src/commands/open.mjs');
    await runOpen(name);
  });

// ── Subcommand: MODIFY ─────────────────────────────────────────────────────────
program
  .command('modify <name> [prompt]')
  .description('Modify an existing project with AI')
  .addHelpText('after', `
Examples:
  vbs modify my-blog prompt='add dark mode toggle'
  vbs modify shop-api prompt='add product categories and search endpoint'
  vbs modify blog-app prompt='add user dashboard with stats'
`)
  .action(async (name, prompt, opts, cmd) => {
    const { runModify } = await import('../src/commands/modify.mjs');
    await runModify(name, prompt, cmd.parent?.opts() || {});
  });

program.parse(processedArgv);
