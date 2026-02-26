import { promises as fs } from 'fs';
import { exec, shell }   from './executor.mjs';
import { log }           from '../ui/display.mjs';
import { createSpinner, spinnerSuccess, spinnerFail, spinnerWarn } from '../ui/spinner.mjs';

/**
 * Check if nginx is installed; install it if not (root required).
 */
export async function checkNginx(isRoot = false) {
  const spinner = createSpinner('Checking nginx...');
  spinner.start();

  const check = await exec('nginx', ['-v']);
  if (check.success || check.stderr.includes('nginx version')) {
    const version = (check.stderr || check.stdout).split('\n')[0].trim();
    spinnerSuccess(spinner, `nginx installed — ${version}`);
    return;
  }

  if (!isRoot) {
    spinnerWarn(spinner, 'nginx not found — skipping install (not root). Install manually: apt install nginx');
    return;
  }

  spinnerWarn(spinner, 'nginx not found — installing...');

  const install = await shell('apt-get install -y nginx 2>&1');
  if (!install.success) {
    spinnerFail(spinner, `Failed to install nginx: ${install.stderr.slice(0, 120)}`);
    return;
  }

  spinnerSuccess(spinner, 'nginx installed ✓');
}

/**
 * Configure nginx as a reverse proxy for a backend API.
 * Creates /etc/nginx/sites-available/<name> and enables it.
 *
 * @param {object} opts
 * @param {string} opts.name       - Project name (used for config filename)
 * @param {number} opts.backendPort - Local backend port
 * @param {string} [opts.domain]    - Domain/server_name (defaults to _)
 */
export async function configureApiProxy({ name, backendPort, domain = '_' }) {
  const spinner = createSpinner(`Configuring nginx proxy → localhost:${backendPort}...`);
  spinner.start();

  const configContent = `# VBS — ${name} API proxy
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass         http://127.0.0.1:${backendPort};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
`;

  try {
    const sitesAvail  = `/etc/nginx/sites-available/${name}`;
    const sitesEnable = `/etc/nginx/sites-enabled/${name}`;

    await fs.writeFile(sitesAvail, configContent, 'utf8');
    await shell(`ln -sf ${sitesAvail} ${sitesEnable}`);
    await shell('nginx -t && systemctl reload nginx');

    spinnerSuccess(spinner, `nginx configured — proxying port 80 → ${backendPort} ✓`);
    return sitesAvail;
  } catch (err) {
    spinnerFail(spinner, `nginx config failed: ${err.message}`);
    return null;
  }
}

/**
 * Configure nginx to serve a built frontend (static files).
 * Used for React/Vite SPA builds.
 *
 * @param {object} opts
 * @param {string} opts.name      - Project name
 * @param {string} opts.buildDir  - Absolute path to the built static dir
 * @param {string} [opts.domain]  - Domain/server_name
 */
export async function configureStaticFrontend({ name, buildDir, domain = '_' }) {
  const spinner = createSpinner(`Configuring nginx → serving static frontend...`);
  spinner.start();

  const configContent = `# VBS — ${name} frontend (static)
server {
    listen 80;
    server_name ${domain};

    root ${buildDir};
    index index.html;

    # React Router / Next.js fallback — all routes → index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
`;

  try {
    const sitesAvail  = `/etc/nginx/sites-available/${name}`;
    const sitesEnable = `/etc/nginx/sites-enabled/${name}`;

    await fs.writeFile(sitesAvail, configContent, 'utf8');
    await shell(`ln -sf ${sitesAvail} ${sitesEnable}`);
    await shell('nginx -t && systemctl reload nginx');

    spinnerSuccess(spinner, `nginx configured — serving ${buildDir} on port 80 ✓`);
    return sitesAvail;
  } catch (err) {
    spinnerFail(spinner, `nginx static config failed: ${err.message}`);
    return null;
  }
}

/**
 * Configure nginx for a fullstack deployment.
 * /api/* → backend port   |   /* → frontend (static or Next.js port)
 *
 * @param {object} opts
 * @param {string} opts.name          - Project name
 * @param {number} opts.backendPort   - Express API port
 * @param {string} opts.frontendMode  - 'static' (React SPA) | 'nextjs'
 * @param {string} [opts.buildDir]    - Absolute path to dist/ (static mode)
 * @param {number} [opts.frontendPort] - Next.js pm2 port (nextjs mode)
 * @param {string} [opts.domain]
 */
export async function configureFullstack({
  name, backendPort, frontendMode, buildDir = '', frontendPort = 3000, domain = '_',
}) {
  const spinner = createSpinner(`Configuring nginx fullstack proxy (API + Frontend)...`);
  spinner.start();

  const frontendBlock = frontendMode === 'static'
    ? `    root ${buildDir};
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
    location ~* \\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }`
    : `    location / {
        proxy_pass         http://127.0.0.1:${frontendPort};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
    }`;

  const configContent = `# VBS — ${name} fullstack (API + Frontend)
server {
    listen 80;
    server_name ${domain};

    # API routes → backend
    location /api/ {
        proxy_pass         http://127.0.0.1:${backendPort}/;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend
${frontendBlock}
}
`;

  try {
    const sitesAvail  = `/etc/nginx/sites-available/${name}`;
    const sitesEnable = `/etc/nginx/sites-enabled/${name}`;

    await fs.writeFile(sitesAvail, configContent, 'utf8');
    await shell(`ln -sf ${sitesAvail} ${sitesEnable}`);
    await shell('nginx -t && systemctl reload nginx');

    spinnerSuccess(spinner, `nginx fullstack config applied ✓  (/api → :${backendPort}, / → frontend)`);
    return sitesAvail;
  } catch (err) {
    spinnerFail(spinner, `nginx fullstack config failed: ${err.message}`);
    return null;
  }
}
