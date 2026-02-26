import chalk   from 'chalk';
import boxen   from 'boxen';
import figures from 'figures';
import inquirer from 'inquirer';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import { join } from 'path';

import { findProject }            from '../projects/registry.mjs';
import { readConfigVbs, updateConfigVbs, hasConfigVbs } from '../projects/config.mjs';
import { generateModification }   from '../ai/modifier.mjs';
import { showTitleScreen, showPhaseHeader, log } from '../ui/display.mjs';
import { createSpinner, spinnerSuccess, spinnerFail } from '../ui/spinner.mjs';
import { exec } from '../system/executor.mjs';
import { fileURLToPath }   from 'url';
import { dirname }         from 'path';
import { readFileSync }    from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const pkg        = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'));

export async function runModify(name, modPrompt, options = {}) {
  showTitleScreen(pkg.version);

  // ── Find project ────────────────────────────────────────────────────────────
  let entry = await findProject(name);

  if (!entry) {
    // Maybe they passed a directory directly
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

  if (!existsSync(entry.dir)) {
    console.log(
      boxen(
        chalk.red(`Project directory missing:\n  ${entry.dir}\n\n`) +
        chalk.gray('The project may have been moved or deleted.'),
        { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'red' }
      )
    );
    process.exit(1);
  }

  // ── Read config.vbs ─────────────────────────────────────────────────────────
  let configVbs;
  try {
    configVbs = await readConfigVbs(entry.dir);
  } catch {
    console.log(chalk.red(`  ${figures.cross} config.vbs not found or invalid in: ${entry.dir}`));
    console.log(chalk.gray('  Run vbs open ' + name + ' to diagnose.'));
    process.exit(1);
  }

  log('success', `Found project: ${chalk.cyan(name)}  ${chalk.gray(entry.dir)}`);
  log('info', `Type: ${chalk.magenta(configVbs.type || 'api')}  Stack: ${chalk.gray((configVbs.stack || []).join(', '))}`);

  // ── Get modification prompt ──────────────────────────────────────────────────
  let modificationRequest = modPrompt?.trim();

  if (!modificationRequest) {
    const { mod } = await inquirer.prompt([{
      type:    'input',
      name:    'mod',
      message: 'What would you like to change or add?',
      validate: v => v.trim().length > 3 || 'Please describe the modification',
    }]);
    modificationRequest = mod.trim();
  }

  log('step', `Modification: "${chalk.cyan(modificationRequest)}"`);

  // ── Phase: AI Generation ─────────────────────────────────────────────────────
  showPhaseHeader('M', 'GENERATING MODIFICATIONS');

  const modSpinner = createSpinner('AI analyzing project and generating changes...', 'AI thinking');
  modSpinner.start();

  let result;
  try {
    result = await generateModification(configVbs, modificationRequest);
    spinnerSuccess(modSpinner, `${result.files.length} file(s) to update`);
  } catch (err) {
    spinnerFail(modSpinner, `AI generation failed: ${err.message}`);
    throw err;
  }

  // Show what will change
  console.log('\n' + chalk.bold.cyan('  Changes:'));
  for (const f of result.files) {
    const lineCount = f.content.split('\n').length;
    console.log(`  ${chalk.cyan(figures.pointer)} ${chalk.white(f.path)} ${chalk.gray(`(${lineCount} lines)`)}`);
  }

  if (result.summary) {
    console.log('\n' + chalk.bold('  Summary: ') + chalk.gray(result.summary));
  }

  // ── Confirm ─────────────────────────────────────────────────────────────────
  const { proceed } = await inquirer.prompt([{
    type:    'confirm',
    name:    'proceed',
    message: `Apply ${result.files.length} file change(s)?`,
    default: true,
  }]);

  if (!proceed) {
    log('warning', 'Modification cancelled.');
    return;
  }

  // ── Write files ──────────────────────────────────────────────────────────────
  showPhaseHeader('W', 'WRITING CHANGES');

  for (let i = 0; i < result.files.length; i++) {
    const file     = result.files[i];
    const fullPath = join(entry.dir, file.path);
    const dir      = fullPath.split('/').slice(0, -1).join('/');

    const writeSpinner = createSpinner(`Writing ${chalk.cyan(file.path)}...`);
    writeSpinner.start();

    try {
      await fs.mkdir(dir, { recursive: true });

      // Show old vs new line count if file already exists
      let oldLines = 0;
      try {
        const old = await fs.readFile(fullPath, 'utf8');
        oldLines = old.split('\n').length;
      } catch {}

      await fs.writeFile(fullPath, file.content, 'utf8');
      const newLines = file.content.split('\n').length;

      const delta = newLines - oldLines;
      const deltaStr = oldLines === 0
        ? chalk.green(`+${newLines} lines (new file)`)
        : delta >= 0
          ? chalk.green(`+${delta} lines`)
          : chalk.red(`${delta} lines`);

      spinnerSuccess(writeSpinner, `${chalk.white(file.path)}  ${deltaStr}`);
    } catch (err) {
      spinnerFail(writeSpinner, `Failed to write ${file.path}: ${err.message}`);
    }
  }

  // ── npm install if package.json changed ─────────────────────────────────────
  const pkgChanged = result.files.some(f => f.path.endsWith('package.json'));
  if (pkgChanged) {
    const installDir = result.files.find(f => f.path === 'package.json')
      ? entry.dir
      : entry.dir;

    const npmSpinner = createSpinner('Running npm install for new dependencies...');
    npmSpinner.start();
    const res = await exec('npm', ['install', '--prefer-offline'], { cwd: installDir });
    if (res.success) {
      spinnerSuccess(npmSpinner, 'Dependencies updated ✓');
    } else {
      const res2 = await exec('npm', ['install'], { cwd: installDir });
      if (res2.success) {
        spinnerSuccess(npmSpinner, 'Dependencies updated ✓');
      } else {
        spinnerFail(npmSpinner, 'npm install had errors — check manually');
      }
    }
  }

  // ── Rebuild frontend if needed ───────────────────────────────────────────────
  if (result.rebuildRequired && configVbs.frontend) {
    const frontDir = join(entry.dir, 'frontend');
    if (existsSync(frontDir)) {
      const buildSpinner = createSpinner('Rebuilding frontend...');
      buildSpinner.start();
      const res = await exec('npm', ['run', 'build'], { cwd: frontDir });
      if (res.success) {
        spinnerSuccess(buildSpinner, 'Frontend rebuilt ✓');
      } else {
        spinnerFail(buildSpinner, 'Frontend build had errors — check manually');
      }
    }
  }

  // ── Restart pm2 ──────────────────────────────────────────────────────────────
  if (result.restartRequired !== false) {
    showPhaseHeader('R', 'RESTARTING');

    const pm2Names = [];
    if (configVbs.backend?.pm2Name)  pm2Names.push(configVbs.backend.pm2Name);
    if (configVbs.frontend?.pm2Name) pm2Names.push(configVbs.frontend.pm2Name);
    if (pm2Names.length === 0)       pm2Names.push(name);

    for (const pm2Name of pm2Names) {
      const restartSpinner = createSpinner(`Restarting pm2 process: ${chalk.cyan(pm2Name)}...`);
      restartSpinner.start();
      const res = await exec('pm2', ['restart', pm2Name]);
      if (res.success) {
        spinnerSuccess(restartSpinner, `${pm2Name} restarted ✓`);
      } else {
        spinnerFail(restartSpinner, `Could not restart ${pm2Name} — it may not be running`);
      }
    }
  }

  // ── Update config.vbs ────────────────────────────────────────────────────────
  try {
    const history = configVbs.modificationHistory || [];
    history.unshift({
      date:    new Date().toISOString(),
      request: modificationRequest,
      files:   result.files.map(f => f.path),
      summary: result.summary,
    });

    await updateConfigVbs(entry.dir, {
      modificationHistory: history.slice(0, 10),
    });
  } catch {}

  // ── Done ─────────────────────────────────────────────────────────────────────
  const noteLines = result.notes ? [
    '',
    chalk.bold('  Notes:'),
    chalk.gray('  ' + result.notes.split('\n').join('\n  ')),
  ] : [];

  console.log(
    boxen(
      [
        chalk.green.bold(`  ${figures.tick} Modification applied!`),
        '',
        `  ${chalk.bold('Project:')}   ${chalk.cyan(name)}`,
        `  ${chalk.bold('Changed:')}   ${chalk.white(result.files.length + ' file(s)')}`,
        `  ${chalk.bold('Summary:')}   ${chalk.gray(result.summary || '—')}`,
        ...noteLines,
        '',
        chalk.gray(`  vbs open ${name}  ← view full project info`),
      ].join('\n'),
      {
        padding: { top: 1, bottom: 1, left: 2, right: 4 },
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green',
      }
    )
  );
}
