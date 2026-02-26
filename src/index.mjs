import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import { promises as fs } from 'fs';
import chalk from 'chalk';
import figures from 'figures';

// ── UI ────────────────────────────────────────────────────────────────────────
import {
  showTitleScreen, showPhaseHeader, log,
  showAnalysis, showAnswersSummary, showTestResults,
  showSuccessBox, showErrorBox,
} from './ui/display.mjs';
import { createSpinner, spinnerSuccess, spinnerFail, spinnerWarn } from './ui/spinner.mjs';
import { askAllQuestions, askProjectDirectory } from './ui/prompt-ui.mjs';

// ── AI ────────────────────────────────────────────────────────────────────────
import { analyzeRequest }                     from './ai/analyzer.mjs';
import { generateQuestions }                  from './ai/questioner.mjs';
import { generateCode }                       from './ai/codegen.mjs';
import { analyzeTestResults, diagnoseFailure } from './ai/tester.mjs';

// ── System ────────────────────────────────────────────────────────────────────
import { exec, shell }                                    from './system/executor.mjs';
import { setupFirewall }                                  from './system/firewall.mjs';
import { checkNode, checkNpm, checkPm2,
         checkPostgres, setupDatabase }                   from './system/node-check.mjs';
import { writeProjectFiles }                              from './system/writer.mjs';
import { testAllEndpoints }                               from './system/tester.mjs';

// ── Summary ───────────────────────────────────────────────────────────────────
import { generateSummary, writeSummaryFiles } from './summary/generator.mjs';

// ─────────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const pkg        = JSON.parse(await fs.readFile(join(__dirname, '..', 'package.json'), 'utf8'));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generatePassword(len = 20) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/**
 * Parse a startCommand string into pm2 arguments.
 * Returns an array of args to append after "pm2 start".
 */
function buildPm2StartArgs(startCommand, pm2Name, projectDir) {
  const parts = startCommand.trim().split(/\s+/);

  if (parts[0] === 'npm') {
    // npm start  →  pm2 start npm --name X --cwd D -- start
    return ['npm', '--name', pm2Name, '--cwd', projectDir, '--', ...parts.slice(1)];
  }

  if (parts[0] === 'node') {
    // node src/index.js  →  pm2 start src/index.js --name X --cwd D
    const script = parts.slice(1).join(' ') || 'src/index.js';
    return [script, '--name', pm2Name, '--cwd', projectDir];
  }

  // Anything else — treat the first token as the script
  return [parts[0], '--name', pm2Name, '--cwd', projectDir];
}

/**
 * Check if a named pm2 process is online.
 */
async function isPm2Online(name) {
  const result = await exec('pm2', ['jlist']);
  if (!result.success || !result.stdout) return false;

  try {
    const list = JSON.parse(result.stdout);
    const proc = list.find(p => p.name === name);
    return proc?.pm2_env?.status === 'online';
  } catch {
    // Fallback: grep the text output
    const textResult = await exec('pm2', ['list', '--no-color']);
    return textResult.stdout.includes(name) && textResult.stdout.includes('online');
  }
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function run(userPrompt, options = {}) {
  try {

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 0: STARTUP
    // ══════════════════════════════════════════════════════════════════════════
    showTitleScreen(pkg.version);

    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      showErrorBox(
        'Missing ANTHROPIC_API_KEY',
        [
          'ANTHROPIC_API_KEY not set!',
          '',
          'Add it to your .env file:',
          '  ANTHROPIC_API_KEY=sk-ant-api03-...',
          '',
          'Or export it in your shell:',
          '  export ANTHROPIC_API_KEY=sk-ant-api03-...',
          '',
          'Get your key at: https://console.anthropic.com/',
        ].join('\n')
      );
      process.exit(1);
    }

    // Root check
    const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    if (isRoot) {
      log('success', 'Running as root ✓');
    } else {
      log('warning', 'Not running as root — firewall and system package installation may be limited');
    }

    // Require prompt
    if (!userPrompt || !userPrompt.trim()) {
      console.log(chalk.yellow('\n  Usage: createmy "description of your API"\n'));
      console.log(chalk.gray('  Examples:'));
      console.log(chalk.gray('    createmy "REST API for a blog with users, posts and comments"'));
      console.log(chalk.gray('    createmy "E-commerce API with JWT auth and PostgreSQL"'));
      console.log(chalk.gray('    createmy "Simple todo list API with SQLite"\n'));
      process.exit(0);
    }

    log('step', `Prompt: "${chalk.cyan(userPrompt.trim())}"`);

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 1: ANALYSIS
    // ══════════════════════════════════════════════════════════════════════════
    showPhaseHeader(1, 'ANALYSIS');

    const analysisSpinner = createSpinner('Analyzing your request...', 'AI thinking');
    analysisSpinner.start();

    let analysis;
    try {
      analysis = await analyzeRequest(userPrompt);
      spinnerSuccess(analysisSpinner, 'Analysis complete');
    } catch (err) {
      spinnerFail(analysisSpinner, `Analysis failed: ${err.message}`);
      throw err;
    }

    showAnalysis(analysis);

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 2: CONFIGURATION
    // ══════════════════════════════════════════════════════════════════════════
    showPhaseHeader(2, 'CONFIGURATION');

    const questionSpinner = createSpinner('Generating configuration questions...', 'AI thinking');
    questionSpinner.start();

    let questions;
    try {
      questions = await generateQuestions(analysis, userPrompt);
      spinnerSuccess(questionSpinner, `Generated ${questions.length} questions`);
    } catch (err) {
      spinnerFail(questionSpinner, `Failed to generate questions: ${err.message}`);
      throw err;
    }

    console.log(chalk.gray('\n  Answer the configuration questions below:\n'));

    const userAnswers = await askAllQuestions(questions);

    // Resolve key config values
    const port        = String(userAnswers.port || '3000');
    const projectName = userAnswers.project_name || analysis.suggestedProjectName;

    // Ask for project directory
    const projectDir      = await askProjectDirectory(projectName);
    userAnswers.projectDir  = projectDir;
    userAnswers.projectName = projectName;
    userAnswers.port        = port;

    showAnswersSummary(questions, userAnswers);

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 3: SYSTEM CHECK & SETUP
    // ══════════════════════════════════════════════════════════════════════════
    showPhaseHeader(3, 'SYSTEM CHECK & SETUP');

    await checkNode();
    await checkNpm();
    await checkPm2();

    if (isRoot) {
      await setupFirewall(port);
    } else {
      log('warning', `Skipping firewall — not root. Manually run: ufw allow ${port}/tcp`);
    }

    // PostgreSQL: detect need
    const needsPostgres =
      analysis.requiredSystemPackages.some(p => p.toLowerCase().includes('postgres')) ||
      analysis.detectedStack.some(s => s.toLowerCase().includes('postgres'));

    if (needsPostgres) {
      if (isRoot) {
        await checkPostgres();

        // Auto-fill DB credentials if not provided
        const safeDbBase = projectName.replace(/-/g, '_');
        const dbName     = userAnswers.database_name || userAnswers.db_name || `${safeDbBase}_db`;
        const dbUser     = userAnswers.database_user || userAnswers.db_user || `${safeDbBase}_user`;
        const dbPassword = userAnswers.database_password || userAnswers.db_password || generatePassword();

        userAnswers.database_name     = dbName;
        userAnswers.database_user     = dbUser;
        userAnswers.database_password = dbPassword;

        await setupDatabase(dbName, dbUser, dbPassword);
      } else {
        log('warning', 'PostgreSQL setup requires root — skipping DB creation. Create it manually.');
      }
    }

    // Create project directory
    const dirSpinner = createSpinner(`Creating project directory: ${chalk.cyan(projectDir)}...`);
    dirSpinner.start();
    try {
      await fs.mkdir(projectDir, { recursive: true });
      spinnerSuccess(dirSpinner, `Directory ready: ${chalk.cyan(projectDir)}`);
    } catch (err) {
      spinnerFail(dirSpinner, `Could not create directory: ${err.message}`);
      throw err;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 4: CODE GENERATION
    // ══════════════════════════════════════════════════════════════════════════
    showPhaseHeader(4, 'CODE GENERATION');

    const codeSpinner = createSpinner('Generating your API...', 'AI thinking');
    codeSpinner.start();

    let codeResult;
    try {
      codeResult = await generateCode(analysis, userAnswers, userPrompt);
      spinnerSuccess(codeSpinner, `Generated ${codeResult.files.length} files`);
    } catch (err) {
      spinnerFail(codeSpinner, `Code generation failed: ${err.message}`);
      throw err;
    }

    // Write files
    log('step', 'Writing project files...');
    console.log('');
    await writeProjectFiles(projectDir, codeResult.files);
    log('success', `All ${codeResult.files.length} files written ✓`);

    // npm install
    console.log('');
    const npmSpinner = createSpinner('Running npm install...');
    npmSpinner.start();

    const npmResult = await exec('npm', ['install', '--prefer-offline'], { cwd: projectDir });
    if (npmResult.success) {
      spinnerSuccess(npmSpinner, 'Dependencies installed ✓');
    } else {
      // Try again without --prefer-offline
      const npmResult2 = await exec('npm', ['install'], { cwd: projectDir });
      if (npmResult2.success) {
        spinnerSuccess(npmSpinner, 'Dependencies installed ✓');
      } else {
        spinnerWarn(npmSpinner, `npm install reported errors — continuing (${npmResult2.stderr.slice(0, 80)})`);
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 5: LAUNCH
    // ══════════════════════════════════════════════════════════════════════════
    showPhaseHeader(5, 'LAUNCHING API');

    const pm2Name      = codeResult.pm2Name || projectName;
    const startCommand = codeResult.startCommand || 'node src/index.js';

    // Cleanup any stale pm2 process
    await exec('pm2', ['delete', pm2Name]);

    const launchSpinner = createSpinner(`Starting API with pm2 (${pm2Name})...`);
    launchSpinner.start();

    const pm2Args  = buildPm2StartArgs(startCommand, pm2Name, projectDir);
    const pm2Start = await exec('pm2', ['start', ...pm2Args]);

    if (!pm2Start.success) {
      spinnerFail(launchSpinner, `pm2 start failed: ${pm2Start.stderr.slice(0, 100)}`);
      log('warning', 'Trying alternative start method...');

      // Fallback: write ecosystem config and use pm2 start ecosystem.config.js
      const { generatePm2Config } = await import('../templates/pm2.config.template.mjs');
      const configContent = generatePm2Config(pm2Name, startCommand, projectDir);
      const configPath    = join(projectDir, 'ecosystem.config.js');
      await fs.writeFile(configPath, configContent, 'utf8');

      const pm2Eco = await exec('pm2', ['start', configPath]);
      if (!pm2Eco.success) {
        spinnerFail(launchSpinner, 'Could not start API — check logs manually');
      }
    }

    // Wait for startup
    await new Promise(r => setTimeout(r, 2500));

    const online = await isPm2Online(pm2Name);

    if (online) {
      spinnerSuccess(launchSpinner, chalk.green(`API is ONLINE ✓  pm2 name: ${pm2Name}`));
    } else {
      spinnerWarn(launchSpinner, 'API may not have started correctly — fetching logs...');

      const logsResult = await exec('pm2', ['logs', pm2Name, '--lines', '30', '--nostream']);
      const logs       = (logsResult.stdout + '\n' + logsResult.stderr).trim();

      if (logs) {
        console.log(chalk.gray('\n  ── Recent Logs ───────────────────────────\n'));
        console.log(chalk.gray('  ' + logs.split('\n').slice(-20).join('\n  ')));
        console.log('');

        const diagSpinner = createSpinner('AI diagnosing startup issue...', 'AI thinking');
        diagSpinner.start();
        const diagnosis = await diagnoseFailure(logs, projectName);
        spinnerSuccess(diagSpinner, 'Diagnosis complete');

        console.log('\n' + chalk.bold.yellow('  AI Diagnosis:'));
        console.log(chalk.gray('  ' + diagnosis.split('\n').join('\n  ')) + '\n');
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 6: TESTING ENDPOINTS
    // ══════════════════════════════════════════════════════════════════════════
    showPhaseHeader(6, 'TESTING ENDPOINTS');

    const baseUrl   = `http://localhost:${port}`;
    const endpoints = codeResult.allEndpoints || [];

    log('step', `Testing ${endpoints.length} endpoint(s) at ${chalk.cyan(baseUrl)}...`);
    console.log('');

    // Extra wait to ensure the server is fully up
    await new Promise(r => setTimeout(r, 1500));

    let testResults = [];
    if (endpoints.length > 0) {
      testResults = await testAllEndpoints(baseUrl, endpoints);
      showTestResults(testResults);
    } else {
      log('warning', 'No endpoints defined — skipping tests');
    }

    // AI test analysis
    let aiNotes = '';
    if (testResults.length > 0) {
      const noteSpinner = createSpinner('Analyzing test results...', 'AI thinking');
      noteSpinner.start();
      aiNotes = await analyzeTestResults(testResults, projectName);
      spinnerSuccess(noteSpinner, 'Analysis complete');

      console.log('\n' + chalk.bold.cyan('  AI Notes:'));
      console.log(chalk.gray('  ' + aiNotes.split('\n').join('\n  ')) + '\n');
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 7: SUMMARY
    // ══════════════════════════════════════════════════════════════════════════
    showPhaseHeader(7, 'GENERATING SUMMARY');

    const summarySpinner = createSpinner('Generating summary.txt...');
    summarySpinner.start();

    try {
      const summary = await generateSummary({
        projectName,
        projectDir,
        stack:       analysis.detectedStack,
        port,
        endpoints,
        testResults,
        aiNotes,
        answers:     userAnswers,
        version:     pkg.version,
      });

      await writeSummaryFiles(summary, projectDir);
      spinnerSuccess(summarySpinner, `summary.txt saved → ${chalk.cyan(projectDir + '/summary.txt')} + current dir`);
    } catch (err) {
      spinnerFail(summarySpinner, `Could not write summary: ${err.message}`);
    }

    // Final success banner
    showSuccessBox(projectName, port, projectDir);

  } catch (err) {
    console.error('\n' + chalk.red.bold(`  ${figures.cross} Fatal error: ${err.message}\n`));
    if (options.debug) {
      console.error(chalk.gray(err.stack));
    } else {
      console.error(chalk.gray('  Run with --debug for full stack trace\n'));
    }
    process.exit(1);
  }
}
