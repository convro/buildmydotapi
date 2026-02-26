import ora from 'ora';
import chalk from 'chalk';

// Braille hex-feel frames for custom spinner
const hexFrames = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];

/**
 * Create a styled hex spinner
 * @param {string} text  - Main spinner text
 * @param {string} [sub] - Dim subtext shown in brackets
 */
export function createSpinner(text, sub = '') {
  const label = chalk.white(text) + (sub ? chalk.gray(`  [${sub}]`) : '');
  return ora({
    text: label,
    spinner: { interval: 80, frames: hexFrames },
    color: 'cyan',
  });
}

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
