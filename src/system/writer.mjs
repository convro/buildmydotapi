import { promises as fs } from 'fs';
import { join, dirname }  from 'path';
import { showFileWritten, showFileWrittenFinal } from '../ui/display.mjs';

/**
 * Write all generated files to the project directory.
 * Shows a live progress bar and per-file name; prints a summary line at the end.
 *
 * @param {string} projectDir  - Absolute path to project root
 * @param {Array}  files       - Array of { path, content } objects
 */
export async function writeProjectFiles(projectDir, files) {
  await fs.mkdir(projectDir, { recursive: true });

  const total      = files.length;
  let   totalLines = 0;

  for (let i = 0; i < total; i++) {
    const file      = files[i];
    const fullPath  = join(projectDir, file.path);
    const dir       = dirname(fullPath);
    const lineCount = file.content.split('\n').length;
    totalLines     += lineCount;

    showFileWritten(i + 1, total, file.path, lineCount);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, file.content, 'utf8');
  }

  showFileWrittenFinal(total, totalLines);
}
