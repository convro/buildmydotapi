import chalk   from 'chalk';
import boxen   from 'boxen';
import figures from 'figures';
import { existsSync }   from 'fs';
import { promises as fs } from 'fs';
import { join }          from 'path';
import os                from 'os';

import { findProject }     from '../projects/registry.mjs';
import { hasConfigVbs }    from '../projects/config.mjs';
import { exec }            from '../system/executor.mjs';

export async function runBackup(name) {
  let entry = await findProject(name);

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

  if (!existsSync(entry.dir)) {
    console.log(chalk.red(`\n  ${figures.cross} Project directory missing: ${entry.dir}\n`));
    process.exit(1);
  }

  // Ensure backup directory
  const backupDir = join(os.homedir(), '.vbs', 'backups');
  await fs.mkdir(backupDir, { recursive: true });

  // Create timestamped filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename  = `${name}-${timestamp}.tar.gz`;
  const backupPath = join(backupDir, filename);

  console.log(chalk.cyan(`\n  ${figures.info} Backing up ${chalk.white(name)}...`));
  console.log(chalk.gray(`  Source: ${entry.dir}`));
  console.log(chalk.gray(`  Target: ${backupPath}\n`));

  // Exclude node_modules and dist to save space
  const res = await exec('tar', [
    '-czf', backupPath,
    '--exclude=node_modules',
    '--exclude=.next',
    '--exclude=dist',
    '-C', join(entry.dir, '..'),
    entry.dir.split('/').pop(),
  ]);

  if (res.success) {
    // Get file size
    let sizeStr = '';
    try {
      const stats = await fs.stat(backupPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
      sizeStr = chalk.gray(`  (${sizeMB} MB)`);
    } catch {}

    console.log(`  ${chalk.green(figures.tick)} Backup created: ${chalk.cyan(backupPath)}${sizeStr}\n`);
  } else {
    console.log(`  ${chalk.red(figures.cross)} Backup failed: ${chalk.gray(res.stderr.slice(0, 100))}\n`);
  }
}
