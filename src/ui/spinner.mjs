import ora   from 'ora';
import chalk from 'chalk';

// ── Elapsed timer ─────────────────────────────────────────────────────────────

/**
 * Start a timer that updates spinner.text every second with elapsed time.
 * Call the returned function to stop the timer.
 *
 * @param {object}   spinner    - ora spinner instance
 * @param {Function} getText    - (elapsedStr: string) => string  — returns the new spinner text
 * @returns {Function}          - stop() function
 *
 * @example
 * const stop = startElapsedTimer(spinner, (t) => chalk.white('Generating...') + chalk.gray(` [${t}]`));
 * // ... await long operation ...
 * stop();
 */
export function startElapsedTimer(spinner, getText) {
  const startTime = Date.now();
  const interval  = setInterval(() => {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const min     = Math.floor(elapsed / 60);
    const sec     = elapsed % 60;
    const t       = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
    spinner.text  = getText(t);
  }, 1000);
  return () => clearInterval(interval);
}

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
