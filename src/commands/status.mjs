import chalk   from 'chalk';
import Table   from 'cli-table3';
import figures from 'figures';

import { listProjects }    from '../projects/registry.mjs';
import { exec }            from '../system/executor.mjs';

export async function runStatus() {
  const projects = await listProjects();

  if (projects.length === 0) {
    console.log(chalk.gray('\n  No VBS projects found. Build one with:'));
    console.log(chalk.cyan('  vbs prompt=\'My first API\'\n'));
    return;
  }

  // Get pm2 process list
  let pm2List = [];
  const pm2Res = await exec('pm2', ['jlist']);
  if (pm2Res.success && pm2Res.stdout) {
    try { pm2List = JSON.parse(pm2Res.stdout); } catch {}
  }

  const table = new Table({
    head: [
      chalk.bold.cyan('Project'),
      chalk.bold.cyan('Type'),
      chalk.bold.cyan('Process'),
      chalk.bold.cyan('Status'),
      chalk.bold.cyan('CPU'),
      chalk.bold.cyan('Memory'),
      chalk.bold.cyan('Uptime'),
    ],
    style: { head: [], border: ['gray'] },
    colWidths: [18, 12, 22, 12, 8, 12, 16],
  });

  for (const p of projects) {
    const pm2Names = [];

    // Try to figure out pm2 names from common patterns
    pm2Names.push(p.name);
    pm2Names.push(`${p.name}-api`);
    pm2Names.push(`${p.name}-front`);

    const matched = pm2List.filter(proc => pm2Names.includes(proc.name));

    if (matched.length === 0) {
      table.push([
        chalk.white(p.name),
        chalk.gray(p.type || 'api'),
        chalk.gray('—'),
        chalk.gray('not running'),
        chalk.gray('—'),
        chalk.gray('—'),
        chalk.gray('—'),
      ]);
    } else {
      for (const proc of matched) {
        const status = proc.pm2_env?.status || 'unknown';
        const statusColor = status === 'online' ? chalk.green : status === 'stopped' ? chalk.yellow : chalk.red;
        const cpu = proc.monit?.cpu != null ? `${proc.monit.cpu}%` : '—';
        const mem = proc.monit?.memory != null ? `${Math.round(proc.monit.memory / 1024 / 1024)}MB` : '—';

        let uptime = '—';
        if (proc.pm2_env?.pm_uptime && status === 'online') {
          const ms = Date.now() - proc.pm2_env.pm_uptime;
          const hours = Math.floor(ms / 3600000);
          const mins  = Math.floor((ms % 3600000) / 60000);
          uptime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        }

        table.push([
          chalk.white(p.name),
          chalk.gray(p.type || 'api'),
          chalk.cyan(proc.name),
          statusColor(status),
          chalk.white(cpu),
          chalk.white(mem),
          chalk.gray(uptime),
        ]);
      }
    }
  }

  console.log('\n' + chalk.bold.white('  VBS Project Status:\n'));
  console.log(table.toString());

  const onlineCount = pm2List.filter(p => p.pm2_env?.status === 'online').length;
  console.log(
    `\n  ${chalk.green(figures.tick)} ${chalk.white(`${onlineCount} process(es) online`)}` +
    chalk.gray(`  •  ${projects.length} project(s) registered\n`)
  );
}
