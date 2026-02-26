# CreateMy.api

> AI-powered REST API deployment CLI for Ubuntu VPS

Give it a one-line description of the API you want — CreateMy.api handles everything else: system checks, code generation, database setup, pm2 deployment, endpoint testing, and a full `summary.txt`.

```
createmy "REST API for an e-commerce store with JWT auth and PostgreSQL"
```

---

## Features

- **AI-driven analysis** — understands your request and picks the right stack
- **Interactive configuration** — AI generates smart technical questions, you answer them
- **Full system setup** — checks/installs Node.js, npm, pm2, PostgreSQL
- **Complete code generation** — Express routes, middleware, auth, DB models, `.env`
- **Automated deployment** — launches your API via pm2
- **Endpoint testing** — HTTP tests every route and shows a results table
- **Beautiful TUI** — hex spinners, gradient headers, boxen panels, progress bars
- **summary.txt** — complete deployment reference with curl examples

---

## Requirements

| Requirement | Details |
|---|---|
| OS | Ubuntu 20.04+ (root recommended) |
| Node.js | v18+ (v20 recommended) |
| npm | v8+ |
| Anthropic key | `ANTHROPIC_API_KEY` from [console.anthropic.com](https://console.anthropic.com/) |

---

## Installation

```bash
# Clone
git clone https://github.com/createmy-api/createmy-api.git
cd createmy-api

# Install dependencies
npm install

# Set your API key
cp .env.example .env
nano .env   # add your ANTHROPIC_API_KEY

# Install globally
npm link
# or: npm install -g .
```

---

## Usage

```bash
# Basic
createmy "REST API for a blog with users and posts"

# With auth
createmy "E-commerce API with JWT authentication and PostgreSQL"

# Simple / no external DB
createmy "Todo list API with SQLite"

# Complex
createmy "Multi-tenant SaaS API with roles, billing webhooks, and MongoDB"

# Debug mode
createmy "My API" --debug
```

---

## Flow

```
Phase 0 → Startup          Load .env, check API key, parse prompt
Phase 1 → Analysis         AI analyzes your request → JSON plan
Phase 2 → Configuration    AI generates questions → you answer them
Phase 3 → System Setup     Check Node/npm/pm2, firewall, PostgreSQL
Phase 4 → Code Generation  AI writes complete API code → files saved
Phase 5 → Launch           pm2 starts the API
Phase 6 → Testing          HTTP tests all endpoints → results table
Phase 7 → Summary          summary.txt written to project + cwd
```

---

## Project Structure

```
createmy-api/
├── bin/
│   └── createmy.mjs           # CLI entry point (shebang)
├── src/
│   ├── index.mjs              # Main orchestrator
│   ├── ui/
│   │   ├── colors.mjs         # chalk theme
│   │   ├── spinner.mjs        # Hex spinner wrapper
│   │   ├── display.mjs        # Boxen, tables, phase headers, log
│   │   └── prompt-ui.mjs      # inquirer question helpers
│   ├── ai/
│   │   ├── client.mjs         # Anthropic SDK wrapper
│   │   ├── analyzer.mjs       # Prompt → analysis JSON
│   │   ├── questioner.mjs     # Analysis → config questions
│   │   ├── codegen.mjs        # Full API code generation
│   │   └── tester.mjs         # AI analysis of test results
│   ├── system/
│   │   ├── executor.mjs       # execa wrapper (exec / shell / stream)
│   │   ├── firewall.mjs       # ufw port management
│   │   ├── node-check.mjs     # Node / npm / pm2 / PostgreSQL checks
│   │   ├── writer.mjs         # Write generated files with progress
│   │   └── tester.mjs         # HTTP endpoint tester
│   └── summary/
│       └── generator.mjs      # Generate + write summary.txt
├── templates/
│   └── pm2.config.template.mjs
├── .env.example
└── package.json
```

---

## AI Models

| Task | Model |
|---|---|
| Request analysis | `claude-opus-4-5` |
| Question generation | `claude-opus-4-5` |
| Code generation | `claude-opus-4-5` |
| Test analysis | `claude-haiku-4-5-20251001` |
| Failure diagnosis | `claude-haiku-4-5-20251001` |

Override in `.env`:
```
AI_MODEL_OPUS=claude-opus-4-5
AI_MODEL_HAIKU=claude-haiku-4-5-20251001
```

---

## Environment Variables

```env
# Required
ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional model overrides
AI_MODEL_OPUS=claude-opus-4-5
AI_MODEL_HAIKU=claude-haiku-4-5-20251001
```

---

## pm2 Commands (post-deploy)

```bash
pm2 list                    # Show all running processes
pm2 logs my-api             # Tail logs
pm2 restart my-api          # Restart
pm2 stop my-api             # Stop
pm2 delete my-api           # Remove from pm2
pm2 startup                 # Auto-start on reboot
pm2 save                    # Save process list
```

---

## License

MIT