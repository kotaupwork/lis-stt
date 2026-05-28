# HTMX + TypeScript Template

Server-rendered starter with Express, EJS views, and htmx-friendly route patterns.

---

## Quick Start

```bash
# 1. Install dependencies
make install

# 2. Copy .env.example to .env and fill in values
cp .env.example .env

# 3. Run in development mode
make dev

# 4. Validate types/lint
make build
make lint
```

Open http://localhost:3000 in your browser.

---

## Project Layout

```
src/
  index.ts               App setup and routes
  config.ts              Environment config
  logger.ts              Shared logger
  public/
    styles.css           Base styling
  views/
    index.ejs            Full page response
    partials/
      time.ejs           HTMX fragment response
docs/                    Developer documentation
tests/                   Test suite placeholder
logs/                    Runtime logs
```

See [plan.md](plan.md) for backlog ideas and [docs/STATUS.md](docs/STATUS.md) for implementation status.

---

## HTMX Pattern In This Template

- Full page route: `GET /`
- Fragment route: `GET /partials/time`
- Client action: `hx-get="/partials/time" hx-target="#time-box"`

Use this pattern to build interactive server-rendered features with minimal client JavaScript.
