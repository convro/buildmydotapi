#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Load dotenv from cwd or tool root
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

// ─── Custom arg pre-processing ────────────────────────────────────────────────
// Supports syntax:  vbs -h -s prompt='my api description'
// The shell strips quotes so we receive:  ['-h', '-s', 'prompt=my api description']
// We also strip stray '&' separators in case user quotes the full command.

function preprocessArgs(argv) {
  const processed = [];
  for (const arg of argv) {
    // Drop bare '&' separator (visual separator in docs, not needed by Commander)
    if (arg === '&') continue;

    // Convert  prompt='text'  or  prompt=text  →  extract as positional arg
    if (arg.startsWith('prompt=')) {
      const value = arg.slice('prompt='.length);
      processed.push(value);
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

// ─── CLI Definition ───────────────────────────────────────────────────────────

program
  .name('vbs')
  .description(`VBS=${pkg.version} — Virtual Based Scenography\nAI-powered REST API deployment for your VPS`)
  // Move default -h/--help to -H so we can use -h for --host
  .helpOption('-H, --help', 'Show help information')
  .version(pkg.version, '-v, --version', 'Show version number')
  .argument('[prompt]', "Describe the API to create  (or use  prompt='description')")
  .option('-h, --host',    'Display server host/IP info in output and links')
  .option('-s, --summary', 'Generate an extended summary after deployment')
  .option('-d, --debug',   'Enable debug output for troubleshooting')
  .addHelpText('after', `
Examples:
  vbs prompt='REST API for a blog with users and posts'
  vbs -h -s prompt='E-commerce API with JWT auth and PostgreSQL'
  vbs -h 'Simple todo list API with SQLite'

Command format:
  vbs=${pkg.version} -h -s & prompt='your description here'
  (wrap the & in quotes or omit it when typing directly in the shell)
`)
  .action(async (prompt, options) => {
    const { run } = await import('../src/index.mjs');
    await run(prompt, options);
  });

program.parse(processedArgv);
