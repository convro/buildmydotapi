import { exec } from './executor.mjs';
import { createSpinner, spinnerSuccess, spinnerFail, spinnerWarn } from '../ui/spinner.mjs';

/**
 * Open a TCP port in ufw. Silently skips if ufw is unavailable.
 * @param {string|number} port
 * @returns {Promise<boolean>}
 */
export async function setupFirewall(port) {
  const spinner = createSpinner(`Opening port ${port}/tcp in firewall (ufw)...`);
  spinner.start();

  // Check ufw availability
  const ufwCheck = await exec('which', ['ufw']);
  if (!ufwCheck.success) {
    spinnerWarn(spinner, `ufw not found — skipping firewall setup (open port ${port} manually)`);
    return false;
  }

  const result = await exec('ufw', ['allow', `${port}/tcp`]);
  if (result.success) {
    spinnerSuccess(spinner, `Port ${port}/tcp opened ✓`);
    return true;
  }

  spinnerFail(spinner, `Failed to open port ${port}: ${result.stderr.slice(0, 80)}`);
  return false;
}
