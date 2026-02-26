import { execa } from 'execa';

/**
 * Run a command and return result. Never throws — always returns exitCode.
 * @param {string}   command
 * @param {string[]} [args=[]]
 * @param {object}   [options={}]  - execa options
 */
export async function exec(command, args = [], options = {}) {
  const result = await execa(command, args, {
    reject: false,
    ...options,
  });

  return {
    stdout:   result.stdout  ?? '',
    stderr:   result.stderr  ?? '',
    exitCode: result.exitCode,
    success:  result.exitCode === 0,
  };
}

/**
 * Run a command while streaming its stdout/stderr to the console.
 */
export async function execWithOutput(command, args = [], options = {}) {
  const sub = execa(command, args, {
    stdout: 'pipe',
    stderr: 'pipe',
    reject: false,
    ...options,
  });

  sub.stdout?.on('data', (chunk) => {
    const lines = chunk.toString().trim().split('\n');
    for (const line of lines) {
      if (line) process.stdout.write(`    ${line}\n`);
    }
  });

  sub.stderr?.on('data', (chunk) => {
    const lines = chunk.toString().trim().split('\n');
    for (const line of lines) {
      if (line) process.stdout.write(`    ${line}\n`);
    }
  });

  const result = await sub;
  return {
    stdout:   result.stdout  ?? '',
    stderr:   result.stderr  ?? '',
    exitCode: result.exitCode,
    success:  result.exitCode === 0,
  };
}

/**
 * Run a shell command via bash -c.
 */
export async function shell(command, options = {}) {
  const result = await execa('bash', ['-c', command], {
    reject: false,
    ...options,
  });

  return {
    stdout:   result.stdout  ?? '',
    stderr:   result.stderr  ?? '',
    exitCode: result.exitCode,
    success:  result.exitCode === 0,
  };
}
