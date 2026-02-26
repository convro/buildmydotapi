import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import { promises as fs } from 'fs';
import chalk   from 'chalk';
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

  const res = await exec('npm', ['install', '--prefer-offline'], { cwd: dir });
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

    const diagSpinner = createSpinner('AI diagnosing startup issue...', 'AI thinking');
    diagSpinner.start();
    const diagnosis = await diagnoseFailure(logs, pm2Name);
    spinnerSuccess(diagSpinner, 'Diagnosis ready');
    console.log('\n' + chalk.bold.yellow('  AI Diagnosis:'));
    console.log(chalk.gray('  ' + diagnosis.split('\n').join('\n  ')) + '\n');
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
      projectType === 'frontend'  ? chalk.magenta('frontend (React/Next.js)') :
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

    const analysisSpinner = createSpinner('AI analyzing your request...', 'AI thinking');
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

    const questionSpinner = createSpinner('Generating configuration questions...', 'AI thinking');
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
      // frontend
      userAnswers.port = String(userAnswers.port || userAnswers.frontend_port || '3000');
    }

    showAnswersSummary(questions, userAnswers);

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 3: SYSTEM CHECK & SETUP
    // ══════════════════════════════════════════════════════════════════════════
    showPhaseHeader(3, 'SYSTEM CHECK & SETUP');

    await checkNode();
    await checkNpm();

    // pm2 needed for api/fullstack; also for Next.js frontend
    const needsPm2 = projectType !== 'frontend' || analysis.frontendFramework === 'nextjs';
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

    const codeSpinner = createSpinner(
      projectType === 'fullstack' ? 'Generating full-stack project (backend + frontend)...' :
      projectType === 'frontend'  ? 'Generating frontend app...' :
      'Generating REST API...',
      'AI thinking'
    );
    codeSpinner.start();

    let codeResult;
    try {
      codeResult = await generateCode(analysis, userAnswers, userPrompt, serverIp, projectType);
      spinnerSuccess(codeSpinner, `Generated ${codeResult.files.length} files`);
    } catch (err) {
      spinnerFail(codeSpinner, `Code generation failed: ${err.message}`);
      throw err;
    }

    // Write files
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

    if (projectType === 'frontend') {
      await runNpmInstall(projectDir, 'frontend');

      // Build step
      const buildSpinner = createSpinner('Building frontend for production...', 'npm run build');
      buildSpinner.start();
      const buildResult = await exec('npm', ['run', 'build'], { cwd: projectDir });
      if (buildResult.success) {
        spinnerSuccess(buildSpinner, 'Frontend built successfully ✓');
      } else {
        spinnerFail(buildSpinner, `Build had errors:\n${buildResult.stderr.slice(0, 200)}`);
        log('warning', 'Continuing despite build errors — check manually');
      }
    }

    if (projectType === 'fullstack') {
      const backendDir  = join(projectDir, 'backend');
      const frontendDir = join(projectDir, 'frontend');

      await runNpmInstall(backendDir, 'backend');
      await runNpmInstall(frontendDir, 'frontend');

      // Build frontend
      const buildSpinner = createSpinner('Building frontend for production...', 'npm run build');
      buildSpinner.start();
      const buildResult = await exec('npm', ['run', 'build'], { cwd: frontendDir });
      if (buildResult.success) {
        spinnerSuccess(buildSpinner, 'Frontend built ✓');
      } else {
        spinnerWarn(buildSpinner, 'Frontend build had errors — check manually');
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
      const framework   = codeResult.frontendFramework || userAnswers.frontend_framework || 'react';
      const isNextJs    = framework === 'nextjs' || framework === 'next';

      if (isNextJs) {
        // Next.js: pm2 runs next start
        const pm2Front = codeResult.pm2Name || `${projectName}-front`;
        frontendOnline = await launchWithPm2(
          codeResult.startCommand || 'npm start',
          pm2Front,
          projectDir
        );
        // nginx proxies to Next.js
        if (isRoot) {
          nginxConfigPath = await configureApiProxy({
            name:        projectName,
            backendPort: parseInt(userAnswers.port || '3000'),
          });
        }
      } else {
        // React SPA: nginx serves static files from dist/
        const buildDir = join(projectDir, 'dist');
        if (isRoot) {
          nginxConfigPath = await configureStaticFrontend({
            name:     projectName,
            buildDir,
          });
        } else {
          log('warning', 'Not root — skipping nginx setup. Serve dist/ manually.');
        }
        frontendOnline = true;
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

      backendOnline  = await launchWithPm2(backCmd, backendPm2, backendDir);

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
        // React SPA — built static files
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
        const noteSpinner = createSpinner('AI analyzing test results...', 'AI thinking');
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

    // Determine backend/frontend config objects for config.vbs
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
        port:       parseInt(userAnswers.port),
        framework:  codeResult.frontendFramework || userAnswers.frontend_framework || 'react',
        pm2Name:    codeResult.pm2Name || `${projectName}-front`,
        buildCommand: 'npm run build',
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

    // config.vbs
    const configVbs = {
      vbs:       pkg.version,
      name:      projectName,
      type:      projectType,
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
      answers:   {
        ...userAnswers,
        // strip passwords from stored answers for security
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

    // Register in global registry
    await registerProject({
      name:      projectName,
      dir:       projectDir,
      type:      projectType,
      stack:     analysis.detectedStack || [],
      port:      backendConfig?.port || frontendConfig?.port,
      createdAt,
    });
    log('success', `Registered in ~/.vbs/projects.json ✓`);

    // Summary
    const summarySpinner = createSpinner('Generating summary.txt...');
    summarySpinner.start();
    try {
      const summary = await generateSummary({
        projectName,
        projectDir,
        projectType,
        stack:        analysis.detectedStack,
        port:         backendConfig?.port || frontendConfig?.port,
        backendPort:  backendConfig?.port,
        frontendPort: frontendConfig?.port,
        frontendFramework: frontendConfig?.framework,
        endpoints:    codeResult.allEndpoints || [],
        testResults,
        aiNotes,
        answers:      userAnswers,
        serverIp,
        version:      pkg.version,
        nginxConfig:  nginxConfigPath,
      });
      await writeSummaryFiles(summary, projectDir);
      spinnerSuccess(summarySpinner, `summary.txt → ${chalk.cyan(projectDir + '/summary.txt')}`);
    } catch (err) {
      spinnerFail(summarySpinner, `Summary write failed: ${err.message}`);
    }

    // ── Final success banner ──────────────────────────────────────────────────
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
