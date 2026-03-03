import chalk   from 'chalk';
import boxen   from 'boxen';
import figures from 'figures';
import { existsSync }   from 'fs';
import { promises as fs } from 'fs';
import { join }          from 'path';

import { findProject }     from '../projects/registry.mjs';
import { readConfigVbs, hasConfigVbs } from '../projects/config.mjs';

export async function runEnv(name) {
  let entry = await findProject(name);

  if (!entry) {
    if (existsSync(name) && await hasConfigVbs(name)) {
      const cfg = await readConfigVbs(name);
      entry = { name: cfg.name, dir: name, type: cfg.type };
    }
  }

  if (!entry) {
    console.log(
      boxen(
        chalk.red(`Project "${name}" not found.\n\n`) +
        chalk.gray('Run ') + chalk.cyan('vbs list') + chalk.gray(' to see saved projects.'),
        { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'red' }
      )
    );
    process.exit(1);
  }

  // Look for .env files in the project
  const envPaths = [
    join(entry.dir, '.env'),
    join(entry.dir, 'backend', '.env'),
    join(entry.dir, 'frontend', '.env'),
  ];

  let found = false;

  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      found = true;
      const relative = envPath.replace(entry.dir + '/', '');
      const content  = await fs.readFile(envPath, 'utf8');
      const lines    = content.trim().split('\n');

      console.log(chalk.bold.cyan(`\n  ${figures.info} ${relative}:`));
      console.log(chalk.gray(`  ${'─'.repeat(50)}`));

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          console.log(chalk.gray(`  ${line}`));
          continue;
        }

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex);
          const val = trimmed.slice(eqIndex + 1);

          // Mask sensitive values
          const isSensitive = /password|secret|key|token/i.test(key);
          const displayed = isSensitive && val.length > 4
            ? val.slice(0, 3) + '•'.repeat(Math.min(val.length - 3, 20))
            : val;

          console.log(`  ${chalk.cyan(key)}${chalk.gray('=')}${chalk.white(displayed)}`);
        } else {
          console.log(chalk.gray(`  ${line}`));
        }
      }
      console.log('');
    }
  }

  if (!found) {
    console.log(chalk.yellow(`\n  ${figures.warning} No .env files found in ${entry.dir}\n`));
  }
}
