import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import { promises as fs } from 'fs';
import chalk   from 'chalk';
import figures from 'figures';

// ── UI ────────────────────────────────────────────────────────────────────────
import {
  showTitleScreen, showPhaseHeader, log,
  showAnalysis, showAnswersSummary, showTestResults,
  showSuccessBox, showErrorBox,
} from './ui/display.mjs';
import {
  createSpinner, createAiSpinner, spinnerSuccess, spinnerFail, spinnerWarn,
  startElapsedTimer,
} from './ui/spinner.mjs';
import { askAllQuestions, askProjectDirectory, confirm } from './ui/prompt-ui.mjs';

// ── AI ────────────────────────────────────────────────────────────────────────
import { analyzeRequest }                     from './ai/analyzer.mjs';
import { generateQuestions }                  from './ai/questioner.mjs';
import { generateCode }                       from './ai/codegen.mjs';
import { analyzeTestResults, diagnoseFailure } from './ai/tester.mjs';
import { fixBuildErrors }                     from './ai/fixer.mjs';

// ── System ────────────────────────────────────────────────────────────────────
import { exec }                                  from './system/executor.mjs';
import { setupFirewall }                         from './system/firewall.mjs';
import { checkNode, checkNpm, checkPm2,
         checkPostgres, setupDatabase }          from './system/node-check.mjs';
import { writeProjectFiles }                     from './system/writer.mjs';
import { testAllEndpoints }                      from './system/tester.mjs';
import {
  checkNginx,
  configureApiProxy,
  configureStaticFrontend,
  configureFullstack,
}                                                from './system/nginx.mjs';

// ── Projects ──────────────────────────────────────────────────────────────────
import { registerProject }    from './projects/registry.mjs';
import { writeConfigVbs }     from './projects/config.mjs';

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

function buildPm2StartArgs(startCommand, pm2Name, projectDir) {
  const parts = startCommand.trim().split(/\s+/);

  if (parts[0] === 'npm') {
    return ['npm', '--name', pm2Name, '--cwd', projectDir, '--', ...parts.slice(1)];
  }
  if (parts[0] === 'node') {
    const script = parts.slice(1).join(' ') || 'src/index.js';
    return [script, '--name', pm2Name, '--cwd', projectDir];
  }
  return [parts[0], '--name', pm2Name, '--cwd', projectDir];
}

async function isPm2Online(name) {
  const result = await exec('pm2', ['jlist']);
  if (!result.success || !result.stdout) return false;
  try {
    const list = JSON.parse(result.stdout);
    const proc = list.find(p => p.name === name);
    return proc?.pm2_env?.status === 'online';
  } catch {
    const textResult = await exec('pm2', ['list', '--no-color']);
    return textResult.stdout.includes(name) && textResult.stdout.includes('online');
  }
}

async function runNpmInstall(dir, label = '') {
  const lbl = label ? `${label} ` : '';
  const npmSpinner = createSpinner(`Running npm install ${lbl}...`);
  npmSpinner.start();

  const res = await exec('npm', ['install', '--legacy-peer-deps'], { cwd: dir });
  if (res.success) {
    spinnerSuccess(npmSpinner, `${lbl}dependencies installed ✓`);
    return true;
  }
  const res2 = await exec('npm', ['install'], { cwd: dir });
  if (res2.success) {
    spinnerSuccess(npmSpinner, `${lbl}dependencies installed ✓`);
    return true;
  }
  spinnerWarn(npmSpinner, `npm install had errors ${lbl}— continuing (${res2.stderr.slice(0, 80)})`);
  return false;
}

async function launchWithPm2(startCommand, pm2Name, projectDir) {
  await exec('pm2', ['delete', pm2Name]);

  const launchSpinner = createSpinner(`Starting with pm2: ${chalk.cyan(pm2Name)}...`);
  launchSpinner.start();

  const pm2Args  = buildPm2StartArgs(startCommand, pm2Name, projectDir);
  const pm2Start = await exec('pm2', ['start', ...pm2Args]);

  if (!pm2Start.success) {
    spinnerWarn(launchSpinner, 'Direct start failed — trying ecosystem config...');
    const { generatePm2Config } = await import('../templates/pm2.config.template.mjs');
    const configContent = generatePm2Config(pm2Name, startCommand, projectDir);
    const configPath    = join(projectDir, 'ecosystem.config.js');
    await fs.writeFile(configPath, configContent, 'utf8');
    const pm2Eco = await exec('pm2', ['start', configPath]);
    if (!pm2Eco.success) {
      spinnerFail(launchSpinner, `Could not start ${pm2Name} — check logs manually`);
      return false;
    }
  }

  await new Promise(r => setTimeout(r, 2500));

  const online = await isPm2Online(pm2Name);
  if (online) {
    spinnerSuccess(launchSpinner, chalk.green(`${pm2Name} is ONLINE ✓`));
    return true;
  }

  spinnerWarn(launchSpinner, `${pm2Name} may not have started — fetching logs...`);

  const logsResult = await exec('pm2', ['logs', pm2Name, '--lines', '30', '--nostream']);
  const logs       = (logsResult.stdout + '\n' + logsResult.stderr).trim();

  if (logs) {
    console.log(chalk.gray('\n  ── Recent Logs ───────────────────────────\n'));
    console.log(chalk.gray('  ' + logs.split('\n').slice(-15).join('\n  ')));
    console.log('');

    const diagSpinner = createAiSpinner('AI diagnosing startup issue...');
    diagSpinner.start();
    const diagnosis = await diagnoseFailure(logs, pm2Name);
    spinnerSuccess(diagSpinner, 'Diagnosis ready');
    console.log('\n' + chalk.bold.yellow('  AI Diagnosis:'));
    console.log(chalk.gray('  ' + diagnosis.split('\n').join('\n  ')) + '\n');
  }

  return false;
}

// ─── Build verification with AI auto-fix ──────────────────────────────────────

const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.ts', '.tsx', '.jsx', '.json', '.css', '.html', '.vue']);
const SKIP_DIRS         = new Set(['node_modules', '.next', 'dist', 'build', '.git', 'coverage', '.cache', 'out']);

/**
 * Recursively gather source files from a directory for AI context.
 * Returns { path (relative to dir), content } objects, limited to maxTotalChars.
 */
async function gatherSourceFiles(dir, maxTotalChars = 16000) {
  const files = [];

  async function walk(currentDir, relBase) {
    let entries;
    try { entries = await fs.readdir(currentDir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;

      const fullPath = join(currentDir, entry.name);
      const relPath  = relBase ? `${relBase}/${entry.name}` : entry.name;
      const ext      = '.' + entry.name.split('.').pop();

      if (entry.isDirectory()) {
        await walk(fullPath, relPath);
      } else if (SOURCE_EXTENSIONS.has(ext)) {
        try {
          const content = await fs.readFile(fullPath, 'utf8');
          files.push({ path: relPath, content });
        } catch { /* skip unreadable */ }
      }
    }
  }

  await walk(dir, '');

  // Sort: src/ files first, package.json configs last
  files.sort((a, b) => {
    const score = (f) =>
      f.path.startsWith('src/')  ? 0 :
      f.path === 'package.json'  ? 3 :
      f.path.endsWith('.json')   ? 2 : 1;
    return score(a) - score(b);
  });

  const selected = [];
  let total = 0;
  for (const f of files) {
    if (total + f.content.length > maxTotalChars) break;
    selected.push(f);
    total += f.content.length;
  }
  return selected;
}

/**
 * Run npm run build and — on failure — ask AI to generate fix patches.
 * Loops up to maxAttempts. Returns true if build eventually succeeds.
 */
async function runBuildWithAutoFix(buildDir, projectName, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const attemptSuffix = attempt > 1 ? chalk.gray(` (attempt ${attempt}/${maxAttempts})`) : '';
    const buildSpinner  = createSpinner(`Building for production...${attemptSuffix}`, 'npm run build');
    buildSpinner.start();

    const buildResult = await exec('npm', ['run', 'build'], { cwd: buildDir });

    if (buildResult.success) {
      spinnerSuccess(buildSpinner, 'Build successful ✓');
      return true;
    }

    const errorOutput = [buildResult.stdout, buildResult.stderr].filter(Boolean).join('\n').trim();
    spinnerFail(buildSpinner, `Build failed (attempt ${attempt}/${maxAttempts})`);

    // Show last lines of error
    const preview = errorOutput.split('\n').filter(Boolean).slice(-12).join('\n');
    console.log(chalk.red('\n  ' + preview.split('\n').join('\n  ') + '\n'));

    if (attempt >= maxAttempts) {
      log('warning', `Build still failing after ${maxAttempts} AI fix attempts. Check manually.`);
      return false;
    }

    // Gather source files for AI context
    const sourceFiles = await gatherSourceFiles(buildDir);
    log('step', `Sending ${sourceFiles.length} source files to AI for diagnosis...`);

    const fixSpinner = createAiSpinner('AI diagnosing build errors...');
    fixSpinner.start();

    let fixedTokens = 0;
    const stopFixTimer = startElapsedTimer(fixSpinner, (t) =>
      chalk.white('AI fixing build errors...') +
      chalk.gray(`  [${fixedTokens.toLocaleString()} tokens — ${t}]`)
    );

    let patches;
    try {
      patches = await fixBuildErrors(
        errorOutput,
        sourceFiles,
        projectName,
        (n) => { fixedTokens = n; }
      );
      stopFixTimer();
      spinnerSuccess(fixSpinner, `AI generated ${patches.length} fix(es) — applying...`);
    } catch (err) {
      stopFixTimer();
      spinnerFail(fixSpinner, `AI fixer failed: ${err.message}`);
      return false;
    }

    if (!patches.length) {
      log('warning', 'AI returned no patches — cannot auto-fix. Check errors above manually.');
      return false;
    }

    // Apply patches
    for (const patch of patches) {
      // Normalize path — AI might prefix with "frontend/" or "backend/"
      const relPath  = patch.path.replace(/^frontend\//, '').replace(/^backend\//, '');
      const filePath = join(buildDir, relPath);
      try {
        await fs.mkdir(dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, patch.content, 'utf8');
        log('success', `Patched: ${relPath}`);
      } catch (err) {
        log('warning', `Could not write patch ${relPath}: ${err.message}`);
      }
    }

    console.log('');
    log('step', 'Retrying build after AI fixes...');
  }

  return false;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function run(userPrompt, options = {}) {
  const projectType = (options.type || 'api').toLowerCase();

  try {
    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 0: STARTUP
    // ══════════════════════════════════════════════════════════════════════════
    showTitleScreen(pkg.version);

    if (!process.env.DEEPSEEK_API_KEY) {
      showErrorBox(
        'Missing DEEPSEEK_API_KEY',
        [
          'DEEPSEEK_API_KEY is not set!',
          '',
          'Add it to your .env file:',
          '  DEEPSEEK_API_KEY=sk-...',
          '',
          'Or export it in your shell:',
          '  export DEEPSEEK_API_KEY=sk-...',
          '',
          'Get your key at: https://platform.deepseek.com/',
        ].join('\n')
      );
      process.exit(1);
    }

    const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    if (isRoot) {
      log('success', 'Running as root ✓');
    } else {
      log('warning', 'Not root — firewall/nginx/system package setup may be limited');
    }

    const typeLabel =
      projectType === 'fullstack' ? chalk.green('fullstack (API + Frontend + nginx)') :
      projectType === 'frontend'  ? chalk.magenta('frontend (React/Next.js/Static)') :
      chalk.cyan('api (REST API)');

    log('info', `Build type: ${typeLabel}`);

    if (!userPrompt || !userPrompt.trim()) {
      console.log('\n' + chalk.yellow('  Usage:'));
      console.log(chalk.gray('    vbs prompt=\'REST API for a blog\''));
      console.log(chalk.gray('    vbs -h -s --type=frontend prompt=\'Dashboard app with React\''));
      console.log(chalk.gray('    vbs -h -s --type=fullstack prompt=\'Blog with admin panel\'\n'));
      console.log(chalk.gray('  Management:'));
      console.log(chalk.gray('    vbs list'));
      console.log(chalk.gray('    vbs open <name>'));
      console.log(chalk.gray('    vbs modify <name> prompt=\'add feature\'\n'));
      process.exit(0);
    }

    log('step', `Prompt: "${chalk.cyan(userPrompt.trim())}"`);

    const serverIp = process.env.SERVER_IPV4?.trim() || null;
    if (serverIp) {
      log('success', `Server IP: ${chalk.cyan(serverIp)}`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 1: ANALYSIS
    // ══════════════════════════════════════════════════════════════════════════
    showPhaseHeader(1, 'ANALYSIS');

    const analysisSpinner = createAiSpinner('AI analyzing your request...');
    analysisSpinner.start();

    let analysis;
    try {
      analysis = await analyzeRequest(userPrompt, projectType);
      spinnerSuccess(analysisSpinner, 'Analysis complete');
    } catch (err) {
      spinnerFail(analysisSpinner, `Analysis failed: ${err.message}`);
      throw err;
    }

    showAnalysis(analysis, projectType);

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 2: CONFIGURATION
    // ══════════════════════════════════════════════════════════════════════════
    showPhaseHeader(2, 'CONFIGURATION');

    const questionSpinner = createAiSpinner('Generating configuration questions...');
    questionSpinner.start();

    let questions;
    try {
      questions = await generateQuestions(analysis, userPrompt, projectType);
      spinnerSuccess(questionSpinner, `${questions.length} questions generated`);
    } catch (err) {
      spinnerFail(questionSpinner, `Failed to generate questions: ${err.message}`);
      throw err;
    }

    console.log(chalk.gray('\n  Answer the configuration questions below:\n'));

    const userAnswers = await askAllQuestions(questions);

    const projectName = userAnswers.project_name || analysis.suggestedProjectName;
    const projectDir  = await askProjectDirectory(projectName);

    userAnswers.projectDir  = projectDir;
    userAnswers.projectName = projectName;

    // Type-specific port handling
    if (projectType === 'api') {
      userAnswers.port = String(userAnswers.port || userAnswers.backend_port || '3000');
    } else if (projectType === 'fullstack') {
      userAnswers.backendPort  = String(userAnswers.backend_port  || userAnswers.port || '3001');
      userAnswers.frontendPort = String(userAnswers.frontend_port || '3000');
      userAnswers.port = userAnswers.backendPort;
    } else {
      // frontend (static or SPA)
      userAnswers.port = String(userAnswers.port || userAnswers.frontend_port || '80');
    }

    showAnswersSummary(questions, userAnswers);

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 3: SYSTEM CHECK & SETUP
    // ══════════════════════════════════════════════════════════════════════════
    showPhaseHeader(3, 'SYSTEM CHECK & SETUP');

    await checkNode();
    await checkNpm();

    // Detect static HTML project (no npm needed for the project itself)
    const isStaticSite = !!(analysis.isStatic && projectType === 'frontend');

    // pm2 needed for api/fullstack, and for Next.js frontend (not for static or React SPA served by nginx)
    const needsPm2 =
      projectType === 'api' ||
      projectType === 'fullstack' ||
      (projectType === 'frontend' && !isStaticSite && analysis.frontendFramework === 'nextjs');
    if (needsPm2) await checkPm2();

    // nginx for frontend/fullstack
    const needsNginx = projectType === 'frontend' || projectType === 'fullstack';
    if (needsNginx) await checkNginx(isRoot);

    // Firewall
    if (isRoot) {
      const portsToOpen = [];
      if (projectType === 'api')       portsToOpen.push(userAnswers.port);
      if (projectType === 'fullstack') portsToOpen.push(userAnswers.backendPort, '80');
      if (projectType === 'frontend')  portsToOpen.push('80');
      for (const p of portsToOpen) await setupFirewall(p);
    } else {
      log('warning', 'Not root — skipping firewall. Run manually: ufw allow 80/tcp');
    }

    // PostgreSQL
    const needsPostgres =
      analysis.requiredSystemPackages?.some(p => p.toLowerCase().includes('postgres')) ||
      analysis.detectedStack?.some(s => s.toLowerCase().includes('postgres'));

    if (needsPostgres) {
      if (isRoot) {
        await checkPostgres();
        const safeBase   = projectName.replace(/-/g, '_');
        const dbName     = userAnswers.database_name || `${safeBase}_db`;
        const dbUser     = userAnswers.database_user || `${safeBase}_user`;
        const dbPassword = userAnswers.database_password || generatePassword();

        userAnswers.database_name     = dbName;
        userAnswers.database_user     = dbUser;
        userAnswers.database_password = dbPassword;

        await setupDatabase(dbName, dbUser, dbPassword);
      } else {
        log('warning', 'PostgreSQL setup requires root — skipping. Create DB manually.');
      }
    }

    // Create project directory
    const dirSpinner = createSpinner(`Creating project directory: ${chalk.cyan(projectDir)}...`);
    dirSpinner.start();
    await fs.mkdir(projectDir, { recursive: true });
    spinnerSuccess(dirSpinner, `Directory ready: ${chalk.cyan(projectDir)}`);

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 4: CODE GENERATION
    // ══════════════════════════════════════════════════════════════════════════
    showPhaseHeader(4, 'CODE GENERATION');

    const genLabel =
      projectType === 'fullstack'               ? 'Generating backend + frontend in parallel...' :
      isStaticSite                              ? 'Generating static HTML/CSS/JS site...' :
      projectType === 'frontend'                ? 'Generating frontend app...' :
      'Generating REST API...';

    const codeSpinner = createAiSpinner(genLabel);
    codeSpinner.start();

    // Track streaming token progress per phase
    const tokenCounts = {};
    const onProgress  = (phase, n) => { tokenCounts[phase] = n; };

    const stopCodeTimer = startElapsedTimer(codeSpinner, (t) => {
      const parts = Object.entries(tokenCounts)
        .map(([phase, n]) => `${phase}: ${n.toLocaleString()}`)
        .join(' | ');
      const detail = parts ? `${parts} tokens — ${t}` : t;
      return chalk.white(genLabel) + chalk.gray(`  [${detail}]`);
    });

    let codeResult;
    try {
      codeResult = await generateCode(analysis, userAnswers, userPrompt, serverIp, projectType, onProgress);
      stopCodeTimer();
      spinnerSuccess(codeSpinner, `Generated ${codeResult.files.length} files`);
    } catch (err) {
      stopCodeTimer();
      spinnerFail(codeSpinner, `Code generation failed: ${err.message}`);
      throw err;
    }

    // Write files to disk
    log('step', 'Writing project files...');
    console.log('');
    await writeProjectFiles(projectDir, codeResult.files);

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 5: INSTALL & BUILD
    // ══════════════════════════════════════════════════════════════════════════
    showPhaseHeader(5, 'INSTALL & BUILD');

    if (projectType === 'api') {
      await runNpmInstall(projectDir);
    }

    if (projectType === 'frontend' && !isStaticSite) {
      await runNpmInstall(projectDir, 'frontend');

      // Build with AI-powered auto-fix loop (up to 5 attempts)
      const buildOk = await runBuildWithAutoFix(projectDir, projectName);
      if (!buildOk) {
        log('warning', 'Build failed after all attempts — project is on disk; fix manually with npm run build');
      }
    }

    if (projectType === 'fullstack') {
      const backendDir  = join(projectDir, 'backend');
      const frontendDir = join(projectDir, 'frontend');

      await runNpmInstall(backendDir, 'backend');
      await runNpmInstall(frontendDir, 'frontend');

      // Build frontend with AI-powered auto-fix loop
      const buildOk = await runBuildWithAutoFix(frontendDir, `${projectName} frontend`);
      if (!buildOk) {
        log('warning', `Frontend build failed — check manually in ${frontendDir}`);
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 6: LAUNCH
    // ══════════════════════════════════════════════════════════════════════════
    showPhaseHeader(6, 'LAUNCHING');

    const pm2Name      = codeResult.pm2Name || projectName;
    const startCommand = codeResult.startCommand || 'node src/index.js';

    let backendOnline  = false;
    let frontendOnline = false;
    let nginxConfigPath = null;

    if (projectType === 'api') {
      backendOnline = await launchWithPm2(startCommand, pm2Name, projectDir);
    }

    if (projectType === 'frontend') {
      if (isStaticSite) {
        // Pure static HTML — nginx serves files directly, no Node.js process
        if (isRoot) {
          nginxConfigPath = await configureStaticFrontend({
            name:     projectName,
            buildDir: projectDir,
          });
        } else {
          log('warning', 'Not root — skipping nginx setup. Serve the HTML files manually.');
        }
        frontendOnline = true;
        log('success', 'Static site ready — served by nginx ✓');
      } else {
        const framework = codeResult.frontendFramework || userAnswers.frontend_framework || 'react';
        const isNextJs  = framework === 'nextjs' || framework === 'next';

        if (isNextJs) {
          const pm2Front = codeResult.pm2Name || `${projectName}-front`;
          frontendOnline = await launchWithPm2(
            codeResult.startCommand || 'npm start',
            pm2Front,
            projectDir
          );
          if (isRoot) {
            nginxConfigPath = await configureApiProxy({
              name:        projectName,
              backendPort: parseInt(userAnswers.port || '3000'),
            });
          }
        } else {
          // React SPA — nginx serves static dist/
          const buildDir = join(projectDir, 'dist');
          if (isRoot) {
            nginxConfigPath = await configureStaticFrontend({ name: projectName, buildDir });
          } else {
            log('warning', 'Not root — skipping nginx. Serve dist/ manually.');
          }
          frontendOnline = true;
        }
      }
    }

    if (projectType === 'fullstack') {
      const backendDir  = join(projectDir, 'backend');
      const frontendDir = join(projectDir, 'frontend');

      const backendPm2  = codeResult.backendPm2Name  || `${projectName}-api`;
      const frontendPm2 = codeResult.frontendPm2Name || `${projectName}-front`;
      const backPort    = parseInt(userAnswers.backendPort  || '3001');
      const frontPort   = parseInt(userAnswers.frontendPort || '3000');

      const backCmd  = codeResult.backendStartCommand  || 'node src/index.js';
      const frontCmd = codeResult.frontendStartCommand || 'npm start';

      backendOnline = await launchWithPm2(backCmd, backendPm2, backendDir);

      const framework = codeResult.frontendFramework || userAnswers.frontend_framework || 'react';
      const isNextJs  = framework === 'nextjs' || framework === 'next';

      if (isNextJs) {
        frontendOnline = await launchWithPm2(frontCmd, frontendPm2, frontendDir);
        if (isRoot) {
          nginxConfigPath = await configureFullstack({
            name:          projectName,
            backendPort:   backPort,
            frontendMode:  'nextjs',
            frontendPort:  frontPort,
          });
        }
      } else {
        // React SPA — built static files served by nginx
        const buildDir = join(frontendDir, 'dist');
        if (isRoot) {
          nginxConfigPath = await configureFullstack({
            name:         projectName,
            backendPort:  backPort,
            frontendMode: 'static',
            buildDir,
          });
        } else {
          log('warning', 'Not root — skipping nginx. Configure manually.');
        }
        frontendOnline = true;
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 7: TESTING ENDPOINTS
    // ══════════════════════════════════════════════════════════════════════════
    let testResults = [];
    let aiNotes     = '';

    if (projectType !== 'frontend') {
      showPhaseHeader(7, 'TESTING ENDPOINTS');

      const port      = userAnswers.backendPort || userAnswers.port || '3000';
      const baseUrl   = `http://localhost:${port}`;
      const endpoints = codeResult.allEndpoints || [];

      log('step', `Testing ${endpoints.length} endpoint(s) at ${chalk.cyan(baseUrl)}...`);
      console.log('');
      await new Promise(r => setTimeout(r, 1500));

      if (endpoints.length > 0) {
        testResults = await testAllEndpoints(baseUrl, endpoints);
        showTestResults(testResults);
      } else {
        log('warning', 'No endpoints defined — skipping tests');
      }

      if (testResults.length > 0) {
        const noteSpinner = createAiSpinner('AI analyzing test results...');
        noteSpinner.start();
        aiNotes = await analyzeTestResults(testResults, projectName, serverIp, port);
        spinnerSuccess(noteSpinner, 'Analysis complete');

        console.log('\n' + chalk.bold.cyan('  AI Notes:'));
        console.log(chalk.gray('  ' + aiNotes.split('\n').join('\n  ')) + '\n');
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 8: SAVE PROJECT + SUMMARY
    // ══════════════════════════════════════════════════════════════════════════
    showPhaseHeader(8, 'SAVING PROJECT & SUMMARY');

    const createdAt = new Date().toISOString();

    let backendConfig  = null;
    let frontendConfig = null;

    if (projectType === 'api') {
      backendConfig = {
        port:         parseInt(userAnswers.port),
        framework:    'express',
        startCommand,
        pm2Name,
      };
    }

    if (projectType === 'frontend') {
      frontendConfig = {
        port:         parseInt(userAnswers.port),
        framework:    isStaticSite ? 'static' : (codeResult.frontendFramework || userAnswers.frontend_framework || 'react'),
        pm2Name:      isStaticSite ? null : (codeResult.pm2Name || `${projectName}-front`),
        buildCommand: isStaticSite ? null : 'npm run build',
      };
    }

    if (projectType === 'fullstack') {
      backendConfig = {
        port:         parseInt(userAnswers.backendPort || '3001'),
        framework:    'express',
        startCommand: codeResult.backendStartCommand || 'node src/index.js',
        pm2Name:      codeResult.backendPm2Name || `${projectName}-api`,
      };
      frontendConfig = {
        port:         parseInt(userAnswers.frontendPort || '3000'),
        framework:    codeResult.frontendFramework || userAnswers.frontend_framework || 'react',
        pm2Name:      codeResult.frontendPm2Name || `${projectName}-front`,
        buildCommand: 'npm run build',
      };
    }

    const configVbs = {
      vbs:       pkg.version,
      name:      projectName,
      type:      projectType,
      isStatic:  isStaticSite || false,
      createdAt,
      updatedAt: createdAt,
      prompt:    userPrompt.trim(),
      stack:     analysis.detectedStack || [],
      backend:   backendConfig,
      frontend:  frontendConfig,
      server: {
        ip:          serverIp || null,
        nginxConfig: nginxConfigPath || null,
      },
      answers: {
        ...userAnswers,
        database_password: userAnswers.database_password ? '[set]' : undefined,
      },
      endpoints: codeResult.allEndpoints || [],
      files:     codeResult.files.map(f => f.path),
    };

    const configSpinner = createSpinner('Writing config.vbs...');
    configSpinner.start();
    try {
      await writeConfigVbs(projectDir, configVbs);
      spinnerSuccess(configSpinner, `config.vbs saved → ${chalk.cyan(projectDir + '/config.vbs')}`);
    } catch (err) {
      spinnerFail(configSpinner, `config.vbs write failed: ${err.message}`);
    }

    await registerProject({
      name:      projectName,
      dir:       projectDir,
      type:      projectType,
      stack:     analysis.detectedStack || [],
      port:      backendConfig?.port || frontendConfig?.port,
      createdAt,
    });
    log('success', `Registered in ~/.vbs/projects.json ✓`);

    const summarySpinner = createSpinner('Generating summary.txt...');
    summarySpinner.start();
    try {
      const summary = await generateSummary({
        projectName,
        projectDir,
        projectType,
        stack:             analysis.detectedStack,
        port:              backendConfig?.port || frontendConfig?.port,
        backendPort:       backendConfig?.port,
        frontendPort:      frontendConfig?.port,
        frontendFramework: frontendConfig?.framework,
        endpoints:         codeResult.allEndpoints || [],
        testResults,
        aiNotes,
        answers:           userAnswers,
        serverIp,
        version:           pkg.version,
        nginxConfig:       nginxConfigPath,
      });
      await writeSummaryFiles(summary, projectDir);
      spinnerSuccess(summarySpinner, `summary.txt → ${chalk.cyan(projectDir + '/summary.txt')}`);
    } catch (err) {
      spinnerFail(summarySpinner, `Summary write failed: ${err.message}`);
    }

    showSuccessBox({
      projectName,
      port:          backendConfig?.port || frontendConfig?.port,
      projectDir,
      projectType,
      backendPort:   backendConfig?.port,
      frontendPort:  frontendConfig?.port,
      serverIp,
      backendPm2:    backendConfig?.pm2Name,
      frontendPm2:   frontendConfig?.pm2Name,
      nginxConfig:   nginxConfigPath,
    });

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
