import { exec, shell } from './executor.mjs';
import { createSpinner, spinnerSuccess, spinnerFail, spinnerWarn } from '../ui/spinner.mjs';
import { log } from '../ui/display.mjs';
import chalk from 'chalk';

// ─── Node.js ──────────────────────────────────────────────────────────────────

export async function checkNode() {
  const spinner = createSpinner('Checking Node.js version...');
  spinner.start();

  const result = await exec('node', ['--version']);
  if (!result.success) {
    spinnerFail(spinner, 'Node.js not found — please install Node.js 18+');
    return null;
  }

  const version = result.stdout.trim();
  const major   = parseInt(version.replace('v', '').split('.')[0], 10);

  if (major < 18) {
    spinnerWarn(spinner, `Node.js ${version} detected — recommend upgrading to v20+`);
  } else {
    spinnerSuccess(spinner, `Node.js ${version} ✓`);
  }

  return version;
}

// ─── npm ──────────────────────────────────────────────────────────────────────

export async function checkNpm() {
  const spinner = createSpinner('Checking npm...');
  spinner.start();

  const result = await exec('npm', ['--version']);
  if (!result.success) {
    spinnerFail(spinner, 'npm not found');
    return null;
  }

  const version = result.stdout.trim();
  spinnerSuccess(spinner, `npm v${version} ✓`);
  return version;
}

// ─── pm2 ──────────────────────────────────────────────────────────────────────

export async function checkPm2() {
  const spinner = createSpinner('Checking pm2...');
  spinner.start();

  const result = await exec('pm2', ['--version']);
  if (!result.success) {
    spinner.text = chalk.white('Installing pm2 globally...');

    const install = await exec('npm', ['install', '-g', 'pm2']);
    if (!install.success) {
      spinnerFail(spinner, `Failed to install pm2: ${install.stderr.slice(0, 80)}`);
      return false;
    }

    spinnerSuccess(spinner, 'pm2 installed globally ✓');
    return true;
  }

  const version = result.stdout.trim();
  spinnerSuccess(spinner, `pm2 v${version} ✓`);
  return true;
}

// ─── PostgreSQL ───────────────────────────────────────────────────────────────

export async function checkPostgres() {
  const spinner = createSpinner('Checking PostgreSQL...');
  spinner.start();

  const which = await exec('which', ['psql']);
  if (!which.success) {
    spinner.text = chalk.white('PostgreSQL not found — installing via apt...');

    const install = await shell(
      'DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib 2>&1'
    );

    if (!install.success) {
      spinnerFail(spinner, 'Failed to install PostgreSQL — install it manually');
      return false;
    }

    spinnerSuccess(spinner, 'PostgreSQL installed ✓');
  } else {
    spinnerSuccess(spinner, 'PostgreSQL found ✓');
  }

  // Ensure service is running
  const active = await exec('systemctl', ['is-active', 'postgresql']);
  if (active.stdout.trim() !== 'active') {
    log('warning', 'PostgreSQL service not active — attempting to start...');
    await exec('systemctl', ['start', 'postgresql']);

    const recheck = await exec('systemctl', ['is-active', 'postgresql']);
    if (recheck.stdout.trim() === 'active') {
      log('success', 'PostgreSQL service started ✓');
    } else {
      log('error', 'Could not start PostgreSQL — start it manually: systemctl start postgresql');
    }
  }

  return true;
}

// ─── PostgreSQL DB + User Setup ───────────────────────────────────────────────

export async function setupDatabase(dbName, dbUser, dbPassword) {
  const spinner = createSpinner(`Setting up PostgreSQL database "${dbName}"...`);
  spinner.start();

  try {
    // Create user (ignore error if already exists)
    await shell(
      `sudo -u postgres psql -c "CREATE USER \\"${dbUser}\\" WITH PASSWORD '${dbPassword}';" 2>/dev/null; true`
    );

    // Create database (ignore error if already exists)
    await shell(
      `sudo -u postgres psql -c "CREATE DATABASE \\"${dbName}\\" OWNER \\"${dbUser}\\";" 2>/dev/null; true`
    );

    // Grant privileges
    await shell(
      `sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE \\"${dbName}\\" TO \\"${dbUser}\\";" 2>/dev/null; true`
    );

    spinnerSuccess(spinner, `Database "${dbName}" ready ✓ (user: ${dbUser})`);
    return true;
  } catch (err) {
    spinnerFail(spinner, `DB setup error: ${err.message.slice(0, 80)}`);
    return false;
  }
}
