#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load dotenv from cwd or tool root
import dotenv from 'dotenv';
const cwdEnv = join(process.cwd(), '.env');
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
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

program
  .name('createmy')
  .description('AI-powered REST API deployment CLI for Ubuntu VPS')
  .version(pkg.version, '-v, --version', 'Show version number')
  .argument('[prompt]', 'Description of the API you want to create')
  .option('-d, --debug', 'Enable debug output for troubleshooting')
  .action(async (prompt, options) => {
    const { run } = await import('../src/index.mjs');
    await run(prompt, options);
  });

program.parse();
