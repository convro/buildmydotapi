<p align="center">
  <img src="https://img.shields.io/badge/VBS-v2.0.0-00e5ff?style=for-the-badge&labelColor=0d1117" alt="Version" />
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white&labelColor=0d1117" alt="Node.js" />
  <img src="https://img.shields.io/badge/License-MIT-a855f7?style=for-the-badge&labelColor=0d1117" alt="License" />
  <img src="https://img.shields.io/badge/AI-DeepSeek%20R1-ec4899?style=for-the-badge&labelColor=0d1117" alt="AI Model" />
  <img src="https://img.shields.io/badge/Platform-Ubuntu%20VPS-E95420?style=for-the-badge&logo=ubuntu&logoColor=white&labelColor=0d1117" alt="Platform" />
</p>

<h1 align="center">
  <br/>
  <code>██╗   ██╗██████╗ ███████╗</code><br/>
  <code>██║   ██║██╔══██╗██╔════╝</code><br/>
  <code>██║   ██║██████╔╝███████╗</code><br/>
  <code>╚██╗ ██╔╝██╔══██╗╚════██║</code><br/>
  <code> ╚████╔╝ ██████╔╝███████║</code><br/>
  <code>  ╚═══╝  ╚═════╝ ╚══════╝</code><br/>
  <br/>
  <strong>Virtual Based Scenography</strong>
  <br/>
  <sub>AI-powered deployment CLI for Ubuntu VPS</sub>
</h1>

<p align="center">
  <em>Describe what you want. VBS builds it, deploys it, and tests it — in one command.</em>
</p>

<p align="center">
  <a href="#-quick-start"><img src="https://img.shields.io/badge/Quick%20Start-00e5ff?style=flat-square&logo=rocket&logoColor=white" alt="Quick Start" /></a>
  <a href="#-build-commands"><img src="https://img.shields.io/badge/Build%20Commands-a855f7?style=flat-square&logo=terminal&logoColor=white" alt="Commands" /></a>
  <a href="#-project-management"><img src="https://img.shields.io/badge/Project%20Management-ec4899?style=flat-square&logo=files&logoColor=white" alt="Management" /></a>
  <a href="#%EF%B8%8F-shortcut-commands"><img src="https://img.shields.io/badge/Shortcuts-22c55e?style=flat-square&logo=zap&logoColor=white" alt="Shortcuts" /></a>
  <a href="#-ai-models"><img src="https://img.shields.io/badge/AI%20Models-f59e0b?style=flat-square&logo=openai&logoColor=white" alt="AI Models" /></a>
</p>

---

## What VBS Does

```
        ┌─────────────────────────────────────────────────────────────────┐
        │                                                                 │
        │   "Blog platform with admin panel, React, PostgreSQL"           │
        │                           │                                     │
        │                           ▼                                     │
        │              ┌────────────────────────┐                         │
        │              │   🧠 AI Analysis        │                         │
        │              │   Stack detection       │                         │
        │              │   Architecture planning │                         │
        │              └────────────────────────┘                         │
        │                           │                                     │
        │              ┌────────────────────────┐                         │
        │              │   ⚙️  Configuration      │                         │
        │              │   Smart questions       │                         │
        │              │   Sensible defaults     │                         │
        │              └────────────────────────┘                         │
        │                           │                                     │
        │              ┌────────────────────────┐                         │
        │              │   💻 Code Generation    │                         │
        │              │   Production-quality    │                         │
        │              │   Security included     │                         │
        │              └────────────────────────┘                         │
        │                           │                                     │
        │              ┌────────────────────────┐                         │
        │              │   🚀 Deploy & Test      │                         │
        │              │   pm2 + nginx           │                         │
        │              │   HTTP endpoint tests   │                         │
        │              └────────────────────────┘                         │
        │                           │                                     │
        │                           ▼                                     │
        │                  ✅ Live & Running                               │
        │                                                                 │
        └─────────────────────────────────────────────────────────────────┘
```

<table>
<tr>
<td width="50%">

**Intelligent Analysis**
- Detects optimal stack from your description
- Identifies data entities & relationships
- Suggests security measures automatically
- Recommends features you didn't think of

</td>
<td width="50%">

**Production-Quality Code**
- Proper separation of concerns
- Security headers (helmet), rate limiting
- Input validation (express-validator)
- Custom error handling & async wrappers

</td>
</tr>
<tr>
<td width="50%">

**Automated Deployment**
- Installs dependencies, builds frontend
- Configures pm2 process management
- Sets up nginx reverse proxy
- Opens firewall ports (UFW)

</td>
<td width="50%">

**Smart Testing & Diagnostics**
- Tests every endpoint automatically
- AI analyzes results & security posture
- Diagnoses startup failures with fix steps
- Generates detailed summary reports

</td>
</tr>
</table>

---

## Project Types

<table>
<tr>
<td align="center" width="33%">
<br/>
<img src="https://img.shields.io/badge/⚡_API-00e5ff?style=for-the-badge&labelColor=0d1117" alt="API" />
<br/><br/>
<strong>REST API</strong><br/>
<sub>Express.js + DB + Auth</sub><br/>
<sub>Direct pm2 process</sub>
<br/><br/>
</td>
<td align="center" width="33%">
<br/>
<img src="https://img.shields.io/badge/🎨_Frontend-a855f7?style=for-the-badge&labelColor=0d1117" alt="Frontend" />
<br/><br/>
<strong>Frontend App</strong><br/>
<sub>React (Vite) / Next.js</sub><br/>
<sub>nginx static or SSR</sub>
<br/><br/>
</td>
<td align="center" width="33%">
<br/>
<img src="https://img.shields.io/badge/🚀_Full--Stack-22c55e?style=for-the-badge&labelColor=0d1117" alt="Full-Stack" />
<br/><br/>
<strong>Full-Stack</strong><br/>
<sub>Express + React/Next.js</sub><br/>
<sub>nginx: /api→back, /→front</sub>
<br/><br/>
</td>
</tr>
</table>

---

## Requirements

| | Requirement | Details |
|---|---|---|
| 🖥️ | **OS** | Ubuntu 20.04+ (root recommended for nginx/firewall) |
| 💚 | **Node.js** | v18+ (v20 recommended) |
| 📦 | **npm** | v8+ |
| 🔑 | **API Key** | `DEEPSEEK_API_KEY` from [platform.deepseek.com](https://platform.deepseek.com/) |

---

## 🚀 Quick Start

```bash
# 1. Clone & install
git clone <repo-url>
cd VBS
npm install

# 2. Configure
cp .env.example .env
nano .env                    # add your DEEPSEEK_API_KEY

# 3. Link globally
npm link                     # or: npm install -g .

# 4. Build something!
vbs prompt='REST API for a blog with users, posts and comments'
```

---

## 📦 Build Commands

### ⚡ REST API

```bash
vbs prompt='REST API for a blog with users, posts and comments'

vbs -h -s prompt='E-commerce API with JWT auth and PostgreSQL'

vbs -h prompt='Simple todo list API with SQLite'

# Full syntax:
vbs=2.0.0 -h -s & --type=api & prompt='Multi-tenant SaaS API with roles and billing'
```

### 🎨 Frontend

```bash
vbs --type=frontend prompt='Dashboard app with React and Tailwind CSS'

vbs -h --type=frontend prompt='Marketing site with Next.js and dark mode'

vbs -h -s --type=frontend prompt='Admin panel with charts, auth and user management'
```

### 🚀 Full-Stack

```bash
vbs --type=fullstack prompt='Blog platform with admin panel'

vbs -h -s --type=fullstack prompt='E-commerce shop with React frontend and Express API'

vbs -h -s --type=fullstack prompt='SaaS dashboard with PostgreSQL, JWT auth, React and Tailwind'

# Full syntax:
vbs=2.0.0 -h -s & --type=fullstack & prompt='your description'
```

---

## 🏗️ Build Flow

```
  ╔══════════════════════════════════════════════════════════════════╗
  ║                                                                  ║
  ║   Phase 0  ➜  STARTUP              .env, API key, root check    ║
  ║   Phase 1  ➜  ANALYSIS             AI → stack, entities, plan   ║
  ║   Phase 2  ➜  CONFIGURATION        Smart questions → answers    ║
  ║   Phase 3  ➜  SYSTEM SETUP         Node/npm/pm2/nginx/DB/UFW   ║
  ║   Phase 4  ➜  CODE GENERATION      AI → production-grade code   ║
  ║   Phase 5  ➜  INSTALL & BUILD      npm install + frontend build ║
  ║   Phase 6  ➜  LAUNCH               pm2 start + nginx config    ║
  ║   Phase 7  ➜  TESTING              HTTP tests + AI analysis     ║
  ║   Phase 8  ➜  SAVE                 config.vbs + registry + txt  ║
  ║                                                                  ║
  ╚══════════════════════════════════════════════════════════════════╝
```

---

## 🚩 Flags

| Flag | Short | Description |
|---|---|---|
| `--host` | `-h` | Show server IP in output and links |
| `--summary` | `-s` | Generate extended summary after deployment |
| `--debug` | `-d` | Show full stack traces on errors |
| `--type <type>` | `-t` | Project type: `api` \| `frontend` \| `fullstack` (default: `api`) |
| `--version` | `-v` | Show version |
| `--help` | `-H` | Show help |

---

## 📋 Project Management

Every project is saved automatically. Come back any time.

```bash
# List all your VBS projects
vbs list

# Show detailed info about a project
vbs open my-blog

# Modify a project with AI — no rebuild from scratch
vbs modify my-blog prompt='add dark mode toggle to the frontend'
vbs modify shop-api prompt='add product categories and a search endpoint'
vbs modify blog-app prompt='add email notifications on new comments'
```

---

## ⚡️ Shortcut Commands

VBS provides quick shortcut commands so you don't have to remember long pm2/system commands.

| Command | Description |
|---|---|
| `vbs list` | List all saved VBS projects |
| `vbs open <name>` | Show detailed project info (endpoints, URLs, config) |
| `vbs modify <name> prompt='...'` | Modify a project with AI |
| `vbs logs <name>` | Tail pm2 logs for a project (backend + frontend) |
| `vbs restart <name>` | Restart all pm2 processes for a project |
| `vbs stop <name>` | Stop all pm2 processes |
| `vbs status` | Show pm2 status for all VBS projects |
| `vbs delete <name>` | Stop pm2 processes and remove project from registry |
| `vbs backup <name>` | Create a timestamped tarball backup of the project |
| `vbs env <name>` | Show environment variables (.env) for a project |
| `vbs ports` | Show all ports currently used by VBS projects |

### Quick Examples

```bash
# See what's running
vbs status

# Check logs for your blog API
vbs logs my-blog

# Restart after manual code changes
vbs restart my-blog

# Quick backup before risky changes
vbs backup my-blog
# → Created: ~/.vbs/backups/my-blog-2026-03-03T12-00-00.tar.gz

# Check what ports are in use
vbs ports

# View .env for a project
vbs env my-blog

# Stop everything for a project
vbs stop my-blog

# Remove a project entirely
vbs delete my-blog
```

---

## 📁 config.vbs

Every project gets a `config.vbs` file in its directory. This stores the full project context — stack, endpoints, ports, nginx config, answers, file list, and modification history.

```json
{
  "vbs": "2.0.0",
  "name": "my-blog",
  "type": "fullstack",
  "createdAt": "2026-02-26T...",
  "prompt": "Blog platform with admin panel, React frontend, PostgreSQL",
  "stack": ["Express", "React", "Tailwind CSS", "PostgreSQL", "helmet", "JWT"],
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

## 🌐 Nginx Integration

For `frontend` and `fullstack` builds, VBS automatically configures nginx:

| Mode | nginx Behavior |
|---|---|
| `api` | Not used (direct pm2 port) |
| `frontend` (React SPA) | Serves `dist/` on port 80 with SPA routing |
| `frontend` (Next.js) | Proxies to pm2 Next.js process |
| `fullstack` | `/api/*` → backend, `/*` → frontend |

**Auto-configured:** Sites-available/enabled, 1-year static asset caching, gzip, SPA fallback routing.

---

## 🏗️ Generated Project Architecture

<table>
<tr>
<td>

**⚡ API Project**
```
my-api/
├── src/
│   ├── index.js          # Server entry
│   ├── app.js            # Express app
│   ├── config.js         # Env config
│   ├── routes/           # Route definitions
│   ├── controllers/      # Request handlers
│   ├── services/         # Business logic
│   ├── models/           # Data access
│   ├── middleware/        # Auth, validation
│   └── utils/            # Helpers
├── package.json
├── .env
└── config.vbs
```

</td>
<td>

**🚀 Full-Stack Project**
```
my-app/
├── backend/
│   ├── src/
│   │   ├── index.js
│   │   ├── app.js
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   └── middleware/
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── context/
│   ├── package.json
│   └── dist/
└── config.vbs
```

</td>
</tr>
</table>

---

## 🤖 AI Models

| Task | Model | Purpose |
|---|---|---|
| Analysis | `deepseek-reasoner` (R1) | Deep architectural analysis |
| Question Generation | `deepseek-reasoner` (R1) | Smart configuration questions |
| Code Generation | `deepseek-reasoner` (R1) | Production-quality code (16k tokens) |
| Project Modification | `deepseek-reasoner` (R1) | Surgical code changes |
| Test Analysis | `deepseek-chat` (V3) | Health audit & security review |
| Failure Diagnosis | `deepseek-chat` (V3) | Root cause + fix commands |

Override in `.env`:
```env
AI_MODEL_OPUS=deepseek-reasoner
AI_MODEL_HAIKU=deepseek-chat
```

---

## 🔒 Code Quality Standards

VBS generates code following these quality standards:

<table>
<tr>
<td width="50%">

**Architecture**
- Separation of concerns (routes → controllers → services → models)
- Custom AppError class with global error middleware
- Async handler wrappers for clean error propagation
- Centralized config module

</td>
<td width="50%">

**Security**
- `helmet()` — HTTP security headers
- `express-rate-limit` — brute force protection
- `express-validator` — input validation
- `bcryptjs` (12 rounds) — password hashing
- Parameterized SQL queries — injection prevention

</td>
</tr>
<tr>
<td width="50%">

**API Design**
- RESTful resource-based URLs
- Proper HTTP status codes
- Pagination on all list endpoints
- Consistent JSON response format
- Request ID middleware for tracing

</td>
<td width="50%">

**Frontend**
- Component-based architecture
- Custom hooks for state & data
- Loading, error & empty states
- Responsive design (mobile-first)
- Accessible (WCAG 2.1 AA)

</td>
</tr>
</table>

---

## 🔧 Environment Variables

```env
# Required
DEEPSEEK_API_KEY=sk-...

# Optional
SERVER_IPV4=1.2.3.4              # Your server's public IP (used in URLs)
AI_MODEL_OPUS=deepseek-reasoner  # Override reasoning model
AI_MODEL_HAIKU=deepseek-chat     # Override fast model
```

---

## 📋 pm2 Commands

```bash
pm2 list                     # All running processes
pm2 logs my-api              # Tail logs
pm2 restart my-api           # Restart
pm2 stop my-api              # Stop
pm2 delete my-api            # Remove
pm2 startup                  # Enable auto-start on reboot
pm2 save                     # Save process list
```

Or use VBS shortcuts: `vbs logs my-api`, `vbs restart my-api`, `vbs stop my-api`.

---

## 📂 Repository Structure

```
VBS/
├── bin/
│   └── vbs.mjs                     # CLI entry (shebang)
├── src/
│   ├── index.mjs                   # Main orchestrator (8-phase flow)
│   ├── ai/
│   │   ├── client.mjs              # DeepSeek API wrapper
│   │   ├── analyzer.mjs            # Prompt → deep analysis
│   │   ├── questioner.mjs          # Analysis → smart questions
│   │   ├── codegen.mjs             # Production-quality code generation
│   │   ├── modifier.mjs            # Surgical project modification
│   │   └── tester.mjs              # AI test analysis & diagnosis
│   ├── commands/
│   │   ├── list.mjs                # vbs list
│   │   ├── open.mjs                # vbs open <name>
│   │   ├── modify.mjs              # vbs modify <name>
│   │   ├── logs.mjs                # vbs logs <name>
│   │   ├── restart.mjs             # vbs restart <name>
│   │   ├── stop.mjs                # vbs stop <name>
│   │   ├── status.mjs              # vbs status
│   │   ├── delete-project.mjs      # vbs delete <name>
│   │   ├── backup.mjs              # vbs backup <name>
│   │   ├── env.mjs                 # vbs env <name>
│   │   └── ports.mjs               # vbs ports
│   ├── projects/
│   │   ├── registry.mjs            # ~/.vbs/projects.json management
│   │   └── config.mjs              # config.vbs read/write
│   ├── system/
│   │   ├── executor.mjs            # execa wrapper
│   │   ├── firewall.mjs            # ufw port management
│   │   ├── nginx.mjs               # nginx configuration
│   │   ├── node-check.mjs          # Node/npm/pm2/PostgreSQL checks
│   │   ├── writer.mjs              # File writer with progress
│   │   └── tester.mjs              # HTTP endpoint tester
│   ├── ui/
│   │   ├── colors.mjs              # chalk theme
│   │   ├── display.mjs             # Boxen, tables, headers, log
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

## 📝 Code Comments

All AI-generated code comments are written in **Korean (한국어)**. This is intentional — it gives the codebase a distinctive character and keeps it consistent across all generated projects.

---

<p align="center">
  <img src="https://img.shields.io/badge/Made_with-Node.js-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Powered_by-DeepSeek_R1-ec4899?style=flat-square" alt="DeepSeek" />
  <img src="https://img.shields.io/badge/License-MIT-a855f7?style=flat-square" alt="MIT" />
</p>

<p align="center">
  <strong>VBS — Virtual Based Scenography</strong><br/>
  <sub>Build it. Deploy it. Ship it.</sub>
</p>
