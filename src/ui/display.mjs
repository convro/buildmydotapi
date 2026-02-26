import chalk from 'chalk';
import boxen from 'boxen';
import gradient from 'gradient-string';
import Table from 'cli-table3';
import figures from 'figures';

// ─── Title Screen ────────────────────────────────────────────────────────────

export function showTitleScreen(version = '1.0.0') {
  console.clear();

  const ascii = [
    ' ██████╗██████╗ ███████╗ █████╗ ████████╗███████╗',
    '██╔════╝██╔══██╗██╔════╝██╔══██╗╚══██╔══╝██╔════╝',
    '██║     ██████╔╝█████╗  ███████║   ██║   █████╗  ',
    '██║     ██╔══██╗██╔══╝  ██╔══██║   ██║   ██╔══╝  ',
    '╚██████╗██║  ██║███████╗██║  ██║   ██║   ███████╗',
    ' ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝',
  ].join('\n');

  const cyanMagenta = gradient(['cyan', 'magenta']);

  const inner =
    cyanMagenta(ascii) +
    '\n\n' +
    chalk.bold.white(`            CreateMy.api  v${version}`) +
    '\n' +
    chalk.gray('      AI-powered API deployment for your VPS') +
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

// ─── Phase / Section Headers ─────────────────────────────────────────────────

export function showPhaseHeader(phase, name) {
  const line = '━'.repeat(44);
  console.log('\n' + chalk.cyan(line));
  console.log(chalk.bold.white(`  PHASE ${phase} — ${name}`));
  console.log(chalk.cyan(line) + '\n');
}

export function showSectionHeader(title) {
  const line = '─'.repeat(44);
  console.log('\n' + chalk.gray(line));
  console.log(chalk.bold.cyan(`  ${title}`));
  console.log(chalk.gray(line) + '\n');
}

// ─── Timestamped Log ─────────────────────────────────────────────────────────

export function log(level, message) {
  const time = new Date().toTimeString().slice(0, 8);
  const ts = chalk.gray(`[${time}]`);

  const icons = {
    info:    chalk.cyan('◆'),
    success: chalk.green(figures.tick),
    error:   chalk.red(figures.cross),
    warning: chalk.yellow(figures.warning),
    step:    chalk.cyan('◆'),
  };

  const icon = icons[level] ?? chalk.gray('•');
  console.log(`  ${icon} ${ts} ${message}`);
}

// ─── Analysis Box ─────────────────────────────────────────────────────────────

export function showAnalysis(analysis) {
  const complexityColor =
    analysis.complexity === 'simple'  ? chalk.green  :
    analysis.complexity === 'medium'  ? chalk.yellow :
    chalk.red;

  const lines = [
    `${chalk.bold('Project Type:')}  ${chalk.cyan(analysis.projectType)}`,
    `${chalk.bold('Stack:')}         ${chalk.cyan(analysis.detectedStack.join(', '))}`,
    `${chalk.bold('Complexity:')}    ${complexityColor(analysis.complexity)}`,
    `${chalk.bold('Est. Files:')}    ${chalk.white(`~${analysis.estimatedFiles}`)}`,
    `${chalk.bold('Name:')}          ${chalk.magenta(analysis.suggestedProjectName)}`,
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
    colWidths: [32, 38],
  });

  for (const q of questions) {
    const val = answers[q.id];
    if (val !== undefined) {
      const displayVal = String(val).length > 35
        ? String(val).slice(0, 32) + '...'
        : String(val);
      table.push([chalk.gray(q.message.slice(0, 30)), chalk.white(displayVal)]);
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
    colWidths: [10, 26, 9, 9, 18],
  });

  for (const r of results) {
    const statusColor = r.status >= 200 && r.status < 400 ? chalk.green : chalk.red;
    const icon = r.passed ? chalk.green(figures.tick) : chalk.red(figures.cross);
    const note = r.note || (r.passed ? 'OK' : 'Failed');

    table.push([
      chalk.cyan(r.method),
      chalk.white(r.path),
      statusColor(r.status ? String(r.status) : 'ERR'),
      chalk.gray(`${r.time}ms`),
      `${icon} ${r.passed ? chalk.green(note) : chalk.red(note)}`,
    ]);
  }

  console.log('\n' + table.toString());
}

// ─── File Write Progress ──────────────────────────────────────────────────────

export function showFileProgress(index, total, filePath) {
  const pct    = Math.round((index / total) * 100);
  const filled = Math.round(pct / 5);
  const bar    = chalk.cyan('█'.repeat(filled)) + chalk.gray('░'.repeat(20 - filled));
  const label  = chalk.gray(`[${index}/${total}]`);
  process.stdout.write(`\r  ${label} ${bar} ${chalk.white(filePath.padEnd(40))}`);
}

// ─── Success Box ──────────────────────────────────────────────────────────────

export function showSuccessBox(projectName, port, projectDir) {
  const lines = [
    chalk.green.bold(`  ${figures.tick} API Successfully Deployed!`),
    '',
    `  ${chalk.bold('Name:')}    ${chalk.cyan(projectName)}`,
    `  ${chalk.bold('Port:')}    ${chalk.cyan(port)}`,
    `  ${chalk.bold('Dir:')}     ${chalk.gray(projectDir)}`,
    `  ${chalk.bold('Process:')} ${chalk.cyan('pm2')} › ${chalk.magenta(projectName)}`,
    '',
    `  ${chalk.gray('Logs:')}    ${chalk.cyan(`pm2 logs ${projectName}`)}`,
    `  ${chalk.gray('Summary:')} ${chalk.cyan('summary.txt')} ${chalk.gray('(current dir)')}`,
  ].join('\n');

  console.log(
    boxen(lines, {
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
