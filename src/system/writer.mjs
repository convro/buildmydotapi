import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { showFileProgress } from '../ui/display.mjs';

/**
 * Write all generated files to the project directory.
 * Shows a progress bar for each file.
 * @param {string} projectDir  - Absolute path to project root
 * @param {Array}  files       - Array of { path, content } objects
 */
export async function writeProjectFiles(projectDir, files) {
  // Ensure the project root exists
  await fs.mkdir(projectDir, { recursive: true });

  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file     = files[i];
    const fullPath = join(projectDir, file.path);
    const dir      = dirname(fullPath);

    showFileProgress(i + 1, total, file.path);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, file.content, 'utf8');
  }

  // Newline after progress bar
  process.stdout.write('\n');
}
