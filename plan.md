# Project Plan — HTMX + TypeScript Template

> Live status: see docs/STATUS.md.

---

## Architecture

Server-rendered web app with small htmx interactions:

- Express handles HTTP routes.
- EJS renders both full pages and partial fragments.
- htmx attributes trigger fragment updates without SPA complexity.

### Module Structure

```
src/
  index.ts                app bootstrap + routes
  config.ts               environment config
  logger.ts               shared logger
  views/
    index.ejs             full page
    partials/time.ejs     htmx fragment
  public/styles.css       static asset
```

---

## Features

| ID | File | Description | Status |
|---|---|---|---|
| A | src/index.ts | Express server + health + page + fragment routes | ✅ Done |
| B | src/views/index.ejs | Home page with htmx trigger + target container | ✅ Done |
| C | src/views/partials/time.ejs | Fragment endpoint output | ✅ Done |

---

## Decisions

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-28 | Server-rendered first architecture | Keeps template simple and htmx-native |
| 2026-05-28 | EJS for default view engine | Widely known, minimal setup |
| 2026-05-28 | Keep strict TypeScript settings | Preserve template quality baseline |

---

## Backlog

- Add request validation helper for form endpoints.
- Add CSRF strategy examples for form posts.
- Add integration tests for fragment routes.
