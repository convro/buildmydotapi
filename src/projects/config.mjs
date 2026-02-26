import { promises as fs } from 'fs';
import { join }          from 'path';

const CONFIG_FILE = 'config.vbs';

/**
 * Write config.vbs to the project directory.
 * Stores all core context so VBS can return to the project later.
 */
export async function writeConfigVbs(projectDir, config) {
  const content = JSON.stringify(config, null, 2);
  await fs.writeFile(join(projectDir, CONFIG_FILE), content, 'utf8');
}

/**
 * Read and parse config.vbs from a project directory.
 * @throws if file not found or invalid JSON
 */
export async function readConfigVbs(projectDir) {
  const content = await fs.readFile(join(projectDir, CONFIG_FILE), 'utf8');
  return JSON.parse(content);
}

/**
 * Check whether config.vbs exists in a directory.
 */
export async function hasConfigVbs(projectDir) {
  try {
    await fs.access(join(projectDir, CONFIG_FILE));
    return true;
  } catch {
    return false;
  }
}

/**
 * Update specific fields in an existing config.vbs (partial update).
 */
export async function updateConfigVbs(projectDir, patch) {
  const existing = await readConfigVbs(projectDir);
  const updated  = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await writeConfigVbs(projectDir, updated);
  return updated;
}
