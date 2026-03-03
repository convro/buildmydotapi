import chalk   from 'chalk';
import boxen   from 'boxen';
import figures from 'figures';
import { existsSync } from 'fs';

import { findProject }     from '../projects/registry.mjs';
import { readConfigVbs, hasConfigVbs } from '../projects/config.mjs';
import { exec }            from '../system/executor.mjs';

export async function runRestart(name) {
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

  const pm2Names = [];
  if (cfg?.backend?.pm2Name)  pm2Names.push(cfg.backend.pm2Name);
  if (cfg?.frontend?.pm2Name) pm2Names.push(cfg.frontend.pm2Name);
  if (pm2Names.length === 0)  pm2Names.push(name);

  for (const pm2Name of pm2Names) {
    const res = await exec('pm2', ['restart', pm2Name]);
    if (res.success) {
      console.log(`  ${chalk.green(figures.tick)} ${chalk.white(pm2Name)} restarted ${chalk.green('✓')}`);
    } else {
      console.log(`  ${chalk.red(figures.cross)} ${chalk.white(pm2Name)} — could not restart ${chalk.gray('(may not be running)')}`);
    }
  }

  console.log('');
}
