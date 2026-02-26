import ora   from 'ora';
import chalk from 'chalk';

// ── Spinner frame sets ────────────────────────────────────────────────────────

const FRAMES = {
  hex:    { interval: 80,  frames: ['⣾','⣽','⣻','⢿','⡿','⣟','⣯','⣷'] },
  dots:   { interval: 80,  frames: ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'] },
  arc:    { interval: 100, frames: ['◜','◠','◝','◞','◡','◟'] },
  bounce: { interval: 120, frames: ['⠁','⠂','⠄','⡀','⢀','⠠','⠐','⠈'] },
  pulse:  { interval: 100, frames: ['◉','◎','◉','◌'] },
};

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create a styled spinner.
 * @param {string} text   - Main label
 * @param {string} [sub]  - Dim sub-label in brackets
 * @param {string} [style]- Frame style: 'hex' | 'dots' | 'arc' | 'bounce' | 'pulse'
 */
export function createSpinner(text, sub = '', style = 'hex') {
  const frames = FRAMES[style] || FRAMES.hex;
  const label  = chalk.white(text) + (sub ? chalk.gray(`  [${sub}]`) : '');
  return ora({
    text:    label,
    spinner: frames,
    color:   'cyan',
  });
}

/** AI operations — dots style, magenta color */
export function createAiSpinner(text) {
  return ora({
    text:    chalk.white(text) + chalk.gray('  [AI thinking]'),
    spinner: FRAMES.dots,
    color:   'magenta',
  });
}

/** File write operations — compact pulse */
export function createFileSpinner(text) {
  return ora({
    text:    chalk.gray(text),
    spinner: FRAMES.pulse,
    color:   'cyan',
  });
}

// ── State helpers ─────────────────────────────────────────────────────────────

export function spinnerSuccess(spinner, text) {
  spinner.succeed(chalk.green(text));
}

export function spinnerFail(spinner, text) {
  spinner.fail(chalk.red(text));
}

export function spinnerInfo(spinner, text) {
  spinner.info(chalk.cyan(text));
}

export function spinnerWarn(spinner, text) {
  spinner.warn(chalk.yellow(text));
}
