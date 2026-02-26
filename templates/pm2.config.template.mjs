/**
 * Generate a pm2 ecosystem config file for the deployed API.
 * @param {string} projectName
 * @param {string} startCommand  - e.g. "node src/index.js"
 * @param {string} projectDir    - Absolute path to project root
 */
export function generatePm2Config(projectName, startCommand, projectDir) {
  const parts  = startCommand.trim().split(/\s+/);
  const script = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];

  return `module.exports = {
  apps: [
    {
      name:               '${projectName}',
      script:             '${script}',
      cwd:                '${projectDir}',
      instances:          1,
      autorestart:        true,
      watch:              false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '${projectDir}/logs/error.log',
      out_file:   '${projectDir}/logs/out.log',
      log_file:   '${projectDir}/logs/combined.log',
      time:       true,
    },
  ],
};
`;
}
