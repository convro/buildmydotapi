import chalk   from 'chalk';
import boxen   from 'boxen';
import gradient from 'gradient-string';
import Table   from 'cli-table3';
import figures from 'figures';

// ─── Title Screen ─────────────────────────────────────────────────────────────

export function showTitleScreen(version = '2.0.0') {
  console.clear();

  const ascii = [
    '██╗   ██╗██████╗ ███████╗',
    '██║   ██║██╔══██╗██╔════╝',
    '██║   ██║██████╔╝███████╗',
    '╚██╗ ██╔╝██╔══██╗╚════██║',
    ' ╚████╔╝ ██████╔╝███████║',
    '  ╚═══╝  ╚═════╝ ╚══════╝',
  ].join('\n');

  const cyanMagenta = gradient(['#00e5ff', '#a855f7', '#ec4899']);

  const inner =
    cyanMagenta(ascii) +
    '\n\n' +
    chalk.bold.white(`       Virtual Based Scenography  v${version}`) +
    '\n' +
    chalk.gray('      AI-powered deployment  ·  API · Frontend · Full-Stack') +
    '\n';

  console.log(
    boxen(inner, {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'cyan',
    })
  );
}

// ─── Phase Headers ────────────────────────────────────────────────────────────

export function showPhaseHeader(phase, name) {
  const line = '━'.repeat(50);
  console.log('\n' + chalk.cyan(line));
  console.log(chalk.bold.white(`  PHASE ${phase}  ─  ${name}`));
  console.log(chalk.cyan(line) + '\n');
}

export function showSectionHeader(title) {
  const line = '─'.repeat(50);
  console.log('\n' + chalk.gray(line));
  console.log(chalk.bold.cyan(`  ${title}`));
  console.log(chalk.gray(line) + '\n');
}

// ─── Timestamped Log ──────────────────────────────────────────────────────────

export function log(level, message) {
  const time = new Date().toTimeString().slice(0, 8);
  const ts   = chalk.gray(`[${time}]`);

  const icons = {
    info:    chalk.cyan('◆'),
    success: chalk.green(figures.tick),
    error:   chalk.red(figures.cross),
    warning: chalk.yellow(figures.warning),
    step:    chalk.cyan('◆'),
    file:    chalk.magenta('◈'),
  };

  const icon = icons[level] ?? chalk.gray('•');
  console.log(`  ${icon} ${ts} ${message}`);
}

// ─── Analysis Box ─────────────────────────────────────────────────────────────

const TYPE_LABELS = {
  api:       chalk.cyan('REST API'),
  frontend:  chalk.magenta('Frontend'),
  fullstack: chalk.green('Full-Stack'),
};

export function showAnalysis(analysis, projectType = 'api') {
  const complexityColor =
    analysis.complexity === 'simple' ? chalk.green  :
    analysis.complexity === 'medium' ? chalk.yellow :
    chalk.red;

  const typeLabel = TYPE_LABELS[projectType] || chalk.cyan(projectType);
  const fwLabel   = analysis.frontendFramework
    ? chalk.gray('  ·  ') + chalk.magenta(analysis.frontendFramework)
    : '';

  const lines = [
    `${chalk.bold('Build Type:')}   ${typeLabel}${fwLabel}`,
    `${chalk.bold('Stack:')}        ${chalk.cyan(analysis.detectedStack.join(', '))}`,
    `${chalk.bold('Complexity:')}   ${complexityColor(analysis.complexity)}`,
    `${chalk.bold('Files (~):')}    ${chalk.white(String(analysis.estimatedFiles))}`,
    `${chalk.bold('Name:')}         ${chalk.magenta(analysis.suggestedProjectName)}`,
    '',
    chalk.gray(analysis.summary),
  ].join('\n');

  console.log(
    boxen(lines, {
      title: chalk.bold.cyan(' Analysis Result '),
      titleAlignment: 'center',
      padding: 1,
      margin: { top: 0, bottom: 1, left: 2, right: 2 },
      borderStyle: 'round',
      borderColor: 'cyan',
    })
  );
}

// ─── Answers Summary Table ────────────────────────────────────────────────────

export function showAnswersSummary(questions, answers) {
  const table = new Table({
    head: [chalk.bold.cyan('Setting'), chalk.bold.cyan('Value')],
    style: { head: [], border: ['gray'] },
    colWidths: [32, 40],
  });

  for (const q of questions) {
    const val = answers[q.id];
    if (val !== undefined) {
      const raw         = String(val);
      const isSensitive = q.id.toLowerCase().includes('password') || q.id.toLowerCase().includes('secret');
      const display     = isSensitive
        ? chalk.gray('[set]')
        : raw.length > 37 ? chalk.white(raw.slice(0, 34) + '…') : chalk.white(raw);

      table.push([chalk.gray(q.message.slice(0, 30)), display]);
    }
  }

  console.log('\n' + chalk.bold.cyan('  Configuration Summary:'));
  console.log(table.toString() + '\n');
}

// ─── Test Results Table ───────────────────────────────────────────────────────

export function showTestResults(results) {
  const table = new Table({
    head: [
      chalk.bold.cyan('Method'),
      chalk.bold.cyan('Endpoint'),
      chalk.bold.cyan('Status'),
      chalk.bold.cyan('Time'),
      chalk.bold.cyan('Result'),
    ],
    style: { head: [], border: ['gray'] },
    colWidths: [10, 28, 9, 9, 18],
  });

  for (const r of results) {
    const statusColor = r.status >= 200 && r.status < 400 ? chalk.green : chalk.red;
    const icon        = r.passed ? chalk.green(figures.tick) : chalk.red(figures.cross);
    const note        = r.note || (r.passed ? 'OK' : 'Failed');

    table.push([
      chalk.cyan(r.method),
      chalk.white(r.path),
      statusColor(r.status ? String(r.status) : 'ERR'),
      chalk.gray(`${r.time}ms`),
      `${icon} ${r.passed ? chalk.green(note) : chalk.red(note)}`,
    ]);
  }

  const passed = results.filter(r => r.passed).length;
  const total  = results.length;
  const allOk  = passed === total;

  console.log('\n' + table.toString());
  console.log(
    '  ' +
    (allOk
      ? chalk.green.bold(`${figures.tick} All ${total} endpoints passed`)
      : chalk.yellow(`${figures.warning} ${passed}/${total} passed`)
    ) +
    '\n'
  );
}

// ─── File Write Progress ──────────────────────────────────────────────────────

export function showFileWritten(index, total, filePath, lineCount) {
  const pct    = Math.round((index / total) * 100);
  const filled = Math.round(pct / 5);
  const bar    = chalk.cyan('█'.repeat(filled)) + chalk.gray('░'.repeat(20 - filled));
  const label  = chalk.gray(`[${String(index).padStart(2)}/${total}]`);
  const lines  = lineCount ? chalk.gray(` ${lineCount}L`) : '';
  const file   = chalk.white(filePath.slice(-38).padEnd(38));
  process.stdout.write(`\r  ${label} ${bar} ${file}${lines}   `);
}

export function showFileWrittenFinal(count, totalLines) {
  process.stdout.write('\n');
  console.log(
    `  ${chalk.green(figures.tick)} ${chalk.white(count + ' files written')}` +
    (totalLines ? chalk.gray(`  (${totalLines} total lines)`) : '')
  );
}

// ─── Success Box ──────────────────────────────────────────────────────────────

export function showSuccessBox({
  projectName,
  port,
  projectDir,
  projectType = 'api',
  backendPort,
  frontendPort,
  serverIp,
  backendPm2,
  frontendPm2,
  nginxConfig,
}) {
  const ip = serverIp || 'YOUR_IP';

  const lines = [];

  const typeIcon =
    projectType === 'fullstack' ? '🚀' :
    projectType === 'frontend'  ? '🎨' : '⚡';

  lines.push(chalk.green.bold(`  ${figures.tick} ${typeIcon} Successfully Deployed!`));
  lines.push('');
  lines.push(`  ${chalk.bold('Name:')}     ${chalk.cyan(projectName)}`);
  lines.push(`  ${chalk.bold('Type:')}     ${
    projectType === 'fullstack' ? chalk.green('fullstack') :
    projectType === 'frontend'  ? chalk.magenta('frontend') :
    chalk.cyan('api')
  }`);
  lines.push(`  ${chalk.bold('Dir:')}      ${chalk.gray(projectDir)}`);
  lines.push('');

  if (projectType === 'api') {
    lines.push(`  ${chalk.bold('Port:')}     ${chalk.cyan(String(port))}`);
    lines.push(`  ${chalk.bold('pm2:')}      ${chalk.magenta(backendPm2 || projectName)}`);
    if (serverIp) lines.push(`  ${chalk.bold('URL:')}      ${chalk.cyan(`http://${ip}:${port}`)}`);
    lines.push('');
    lines.push(`  ${chalk.gray('Logs:')}     ${chalk.cyan(`pm2 logs ${backendPm2 || projectName}`)}`);
  }

  if (projectType === 'frontend') {
    if (nginxConfig) {
      lines.push(`  ${chalk.bold('nginx:')}    ${chalk.gray(nginxConfig)}`);
      if (serverIp) lines.push(`  ${chalk.bold('URL:')}      ${chalk.cyan(`http://${ip}`)}`);
    } else {
      lines.push(`  ${chalk.bold('Port:')}     ${chalk.cyan(String(port))}`);
    }
    lines.push('');
    lines.push(`  ${chalk.gray('Build:')}    ${chalk.cyan('npm run build')}`);
  }

  if (projectType === 'fullstack') {
    lines.push(`  ${chalk.bold('Backend:')}  port ${chalk.cyan(String(backendPort))}  ·  pm2: ${chalk.magenta(backendPm2 || projectName + '-api')}`);
    lines.push(`  ${chalk.bold('Frontend:')} ${
      nginxConfig
        ? 'nginx serving dist/'
        : `port ${chalk.cyan(String(frontendPort))}  ·  pm2: ${chalk.magenta(frontendPm2 || projectName + '-front')}`
    }`);
    if (nginxConfig) {
      if (serverIp) lines.push(`  ${chalk.bold('URL:')}      ${chalk.cyan(`http://${ip}`)}  ${chalk.gray('(/api → backend, / → frontend)')}`);
      lines.push(`  ${chalk.bold('nginx:')}    ${chalk.gray(nginxConfig)}`);
    }
    lines.push('');
    lines.push(`  ${chalk.gray('API logs:')} ${chalk.cyan(`pm2 logs ${backendPm2 || projectName + '-api'}`)}`);
    if (frontendPm2) {
      lines.push(`  ${chalk.gray('App logs:')} ${chalk.cyan(`pm2 logs ${frontendPm2}`)}`);
    }
  }

  lines.push('');
  lines.push(`  ${chalk.gray('Summary:')}  ${chalk.cyan('summary.txt')}  ${chalk.gray('(current dir)')}`);
  lines.push(`  ${chalk.gray('Config:')}   ${chalk.cyan(projectDir + '/config.vbs')}`);
  lines.push('');
  lines.push(`  ${chalk.gray('vbs list')}                    ${chalk.gray('← all projects')}`);
  lines.push(`  ${chalk.gray(`vbs open ${projectName.slice(0, 14)}`)}              ${chalk.gray('← project info')}`);
  lines.push(`  ${chalk.gray(`vbs modify ${projectName.slice(0, 13)}`)}           ${chalk.gray('← modify with AI')}`);
  lines.push('');
  lines.push(chalk.gray('  VBS — Virtual Based Scenography'));

  console.log(
    boxen(lines.join('\n'), {
      padding: { top: 1, bottom: 1, left: 2, right: 4 },
      margin: 1,
      borderStyle: 'round',
      borderColor: 'green',
    })
  );
}

// ─── Error Box ────────────────────────────────────────────────────────────────

export function showErrorBox(title, message) {
  console.log(
    boxen(chalk.red(message), {
      title: chalk.red.bold(` ${figures.cross} ${title} `),
      titleAlignment: 'center',
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'red',
    })
  );
}
