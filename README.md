# VBS — Virtual Based Scenography

> AI-powered deployment CLI for Ubuntu VPS
> Build REST APIs, React/Next.js frontends, and full-stack apps — from a single prompt.

```
vbs -h -s --type=fullstack prompt='Blog platform with admin panel, React frontend, PostgreSQL'
```

---

## What it does

Describe what you want to build. VBS handles everything else:

- **Analyzes** your prompt and picks the right stack
- **Asks smart questions** (port, database, TypeScript, styling, auth…)
- **Generates complete code** — Express API, React/Next.js app, or both
- **Installs dependencies**, builds the frontend, sets up nginx, launches via pm2
- **Tests all endpoints** and gives you AI feedback
- **Saves project context** (`config.vbs`) so you can return and modify later

---

## Project Types

| Type | Description | Stack |
|---|---|---|
| `api` | REST API backend | Express.js + optional DB |
| `frontend` | Frontend app only | React (Vite) or Next.js |
| `fullstack` | Backend + Frontend + nginx | Express + React/Next.js + nginx |

---

## Requirements

| Requirement | Details |
|---|---|
| OS | Ubuntu 20.04+ (root recommended for nginx/firewall) |
| Node.js | v18+ (v20 recommended) |
| npm | v8+ |
| DeepSeek API key | `DEEPSEEK_API_KEY` from [platform.deepseek.com](https://platform.deepseek.com/) |

---

## Installation

```bash
git clone <repo-url>
cd buildmydotapi

npm install

cp .env.example .env
nano .env   # add your DEEPSEEK_API_KEY

npm link    # or: npm install -g .
```

---

## Build Commands

### REST API

```bash
vbs prompt='REST API for a blog with users, posts and comments'

vbs -h -s prompt='E-commerce API with JWT auth and PostgreSQL'

vbs -h prompt='Simple todo list API with SQLite'

# Full syntax:
vbs=2.0.0 -h -s & --type=api & prompt='Multi-tenant SaaS API with roles and billing'
```

### Frontend

```bash
vbs --type=frontend prompt='Dashboard app with React and Tailwind CSS'

vbs -h --type=frontend prompt='Marketing site with Next.js and dark mode'

vbs -h -s --type=frontend prompt='Admin panel with charts, auth and user management'
```

### Full-Stack

```bash
vbs --type=fullstack prompt='Blog platform with admin panel'

vbs -h -s --type=fullstack prompt='E-commerce shop with React frontend and Express API'

vbs -h -s --type=fullstack prompt='SaaS dashboard with PostgreSQL, JWT auth, React and Tailwind'

# Full syntax:
vbs=2.0.0 -h -s & --type=fullstack & prompt='your description'
```

---

## Flags

| Flag | Description |
|---|---|
| `-h, --host` | Show server IP in output and links |
| `-s, --summary` | Generate extended summary after deployment |
| `-d, --debug` | Show full stack traces on errors |
| `-t, --type <type>` | Project type: `api` \| `frontend` \| `fullstack` (default: `api`) |
| `-v, --version` | Show version |
| `-H, --help` | Show help |

---

## Project Management

Every project is saved automatically. Come back any time.

```bash
# List all your VBS projects
vbs list

# Show detailed info about a project (endpoints, URLs, pm2, config)
vbs open my-blog

# Modify a project with AI — no rebuild from scratch
vbs modify my-blog prompt='add dark mode toggle to the frontend'
vbs modify shop-api prompt='add product categories and a search endpoint'
vbs modify blog-app prompt='add email notifications on new comments'
```

---

## Build Flow

```
Phase 0 → Startup         Load .env, check API key, validate type
Phase 1 → Analysis        AI analyzes prompt → tech stack, complexity, framework
Phase 2 → Configuration   AI generates questions → you answer them
Phase 3 → System Setup    Check Node/npm/pm2/nginx, firewall, PostgreSQL
Phase 4 → Code Generation AI writes all files (backend/ + frontend/)
Phase 5 → Install & Build npm install, npm run build (frontend)
Phase 6 → Launch          pm2 starts backend; nginx serves frontend
Phase 7 → Testing         HTTP tests all API endpoints → results table + AI notes
Phase 8 → Save            config.vbs + registry + summary.txt written
```

---

## config.vbs

Every project gets a `config.vbs` file in its directory. This stores the full project context — stack, endpoints, ports, nginx config, answers, file list, and modification history.

```json
{
  "vbs": "2.0.0",
  "name": "my-blog",
  "type": "fullstack",
  "createdAt": "2026-02-26T...",
  "prompt": "Blog platform with admin panel, React frontend, PostgreSQL",
  "stack": ["Express", "React", "Tailwind CSS", "PostgreSQL"],
  "backend": {
    "port": 3001,
    "pm2Name": "my-blog-api",
    "startCommand": "node src/index.js"
  },
  "frontend": {
    "port": 3000,
    "framework": "react",
    "pm2Name": "my-blog-front"
  },
  "server": {
    "ip": "1.2.3.4",
    "nginxConfig": "/etc/nginx/sites-available/my-blog"
  },
  "endpoints": [ ... ],
  "files": [ ... ],
  "modificationHistory": [ ... ]
}
```

When you run `vbs modify`, the AI reads this file and immediately understands the full context — no re-explaining needed.

---

## Nginx Integration

For `frontend` and `fullstack` builds, VBS automatically:

1. Installs nginx (if not present, root required)
2. Creates `/etc/nginx/sites-available/<name>`
3. Links to `sites-enabled` and reloads nginx

| Mode | nginx behavior |
|---|---|
| `api` | Not used (direct pm2 port) |
| `frontend` (React SPA) | Serves `dist/` on port 80 |
| `frontend` (Next.js) | Proxies to pm2 Next.js process |
| `fullstack` | `/api/*` → backend, `/*` → frontend |

---

## Project Structure

```
buildmydotapi/
├── bin/
│   └── vbs.mjs                     # CLI entry (shebang)
├── src/
│   ├── index.mjs                   # Main orchestrator
│   ├── ai/
│   │   ├── client.mjs              # DeepSeek API wrapper
│   │   ├── analyzer.mjs            # Prompt → analysis JSON
│   │   ├── questioner.mjs          # Analysis → config questions
│   │   ├── codegen.mjs             # Code generation (API/frontend/fullstack)
│   │   ├── modifier.mjs            # Modify existing projects
│   │   └── tester.mjs              # AI analysis of test results
│   ├── commands/
│   │   ├── list.mjs                # vbs list
│   │   ├── open.mjs                # vbs open <name>
│   │   └── modify.mjs              # vbs modify <name>
│   ├── projects/
│   │   ├── registry.mjs            # ~/.vbs/projects.json management
│   │   └── config.mjs              # config.vbs read/write
│   ├── system/
│   │   ├── executor.mjs            # execa wrapper
│   │   ├── firewall.mjs            # ufw port management
│   │   ├── nginx.mjs               # nginx (API proxy / static / fullstack)
│   │   ├── node-check.mjs          # Node/npm/pm2/PostgreSQL checks
│   │   ├── writer.mjs              # Write files with progress + line count
│   │   └── tester.mjs              # HTTP endpoint tester
│   ├── ui/
│   │   ├── colors.mjs              # chalk theme
│   │   ├── display.mjs             # Boxen, tables, headers, log, success box
│   │   ├── prompt-ui.mjs           # inquirer question helpers
│   │   └── spinner.mjs             # hex/dot/arc/pulse spinners
│   └── summary/
│       └── generator.mjs           # summary.txt + config.vbs generation
├── templates/
│   └── pm2.config.template.mjs
├── .env.example
├── package.json
└── README.md
```

---

## AI Models

| Task | Model |
|---|---|
| Analysis | `deepseek-reasoner` (R1) |
| Question generation | `deepseek-reasoner` (R1) |
| Code generation | `deepseek-reasoner` (R1) — up to 16k tokens |
| Project modification | `deepseek-reasoner` (R1) |
| Test analysis | `deepseek-chat` (V3) |
| Failure diagnosis | `deepseek-chat` (V3) |

Override in `.env`:
```env
AI_MODEL_OPUS=deepseek-reasoner
AI_MODEL_HAIKU=deepseek-chat
```

---

## Environment Variables

```env
# Required
DEEPSEEK_API_KEY=sk-...

# Optional
SERVER_IPV4=1.2.3.4          # Your server's public IP (used in URLs and links)
AI_MODEL_OPUS=deepseek-reasoner
AI_MODEL_HAIKU=deepseek-chat
```

---

## pm2 Commands

```bash
pm2 list                     # All running processes
pm2 logs my-api              # Tail logs
pm2 restart my-api           # Restart
pm2 stop my-api              # Stop
pm2 delete my-api            # Remove
pm2 startup                  # Enable auto-start on reboot
pm2 save                     # Save process list
```

---

## Code Comments

All AI-generated code comments are written in Korean (한국어). This is intentional — it gives the codebase a distinctive character and keeps it consistent across all generated projects.

---

## License

MIT
