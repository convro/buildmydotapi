import chalk    from 'chalk';
import boxen    from 'boxen';
import figures  from 'figures';
import inquirer from 'inquirer';
import { existsSync } from 'fs';

import { findProject, removeProject } from '../projects/registry.mjs';
import { readConfigVbs, hasConfigVbs } from '../projects/config.mjs';
import { exec } from '../system/executor.mjs';

export async function runDelete(name) {
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

  let cfg = null;
  if (existsSync(entry.dir) && await hasConfigVbs(entry.dir)) {
    try { cfg = await readConfigVbs(entry.dir); } catch {}
  }

  console.log(chalk.bold.yellow(`\n  ${figures.warning} Delete project: ${chalk.white(name)}`));
  console.log(chalk.gray(`  Directory: ${entry.dir}\n`));

  const { confirm } = await inquirer.prompt([{
    type:    'confirm',
    name:    'confirm',
    message: `Stop pm2 processes and remove "${name}" from VBS registry?`,
    default: false,
  }]);

  if (!confirm) {
    console.log(chalk.gray('  Cancelled.\n'));
    return;
  }

  // Stop pm2 processes
  const pm2Names = [];
  if (cfg?.backend?.pm2Name)  pm2Names.push(cfg.backend.pm2Name);
  if (cfg?.frontend?.pm2Name) pm2Names.push(cfg.frontend.pm2Name);
  if (pm2Names.length === 0)  pm2Names.push(name);

  for (const pm2Name of pm2Names) {
    await exec('pm2', ['delete', pm2Name]);
    console.log(`  ${chalk.yellow('•')} pm2 process ${chalk.white(pm2Name)} deleted`);
  }

  // Remove from registry
  await removeProject(entry.name);
  console.log(`  ${chalk.green(figures.tick)} Removed from VBS registry`);

  console.log(
    chalk.gray(`\n  Note: Project files in ${entry.dir} were NOT deleted.`) +
    chalk.gray('\n  Remove manually if needed: rm -rf ' + entry.dir + '\n')
  );
}
