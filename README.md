# aMule React UI

A reactive, browser-based operations console for [aMule](https://github.com/amule-org/amule). It is designed to be served by aMule's built-in `amuleapi`, using the REST API and SSE events on the same origin.

The application provides authenticated live status, download and upload activity, searches, server/network controls, categories, and confirmation dialogs for consequential actions. It stores no password or token in browser storage; authentication uses the API's HttpOnly cookie.

## Prerequisites

- A current [aMule source build](https://github.com/amule-org/amule#building-from-source) with `amuled` and `amuleapi` enabled.
- Node.js and pnpm.
- An `amuleapi` admin password configured on the target aMule instance.

## Local development

```bash
cd /opt/amule/web
pnpm install
cp .env.example .env
pnpm dev
```

The Vite development server proxies `/api` and `/flags` to `VITE_DEV_API_ORIGIN` (by default `http://127.0.0.1:4713`). Sign in with the `amuleapi` admin password; do not add it to `.env`.

## Configuration

Copy `.env.example` to `.env` to override local values. `.env` is intentionally ignored by Git.

| Variable              | Default                 | Purpose                                                                 |
| --------------------- | ----------------------- | ----------------------------------------------------------------------- |
| `VITE_API_BASE`       | `/api/v0`               | Browser REST API base path. Keep relative when aMule serves the bundle. |
| `VITE_EVENTS_URL`     | `/api/v0/events`        | Browser SSE endpoint.                                                   |
| `VITE_DEV_API_ORIGIN` | `http://127.0.0.1:4713` | Vite development proxy target.                                          |

For the deployed SPA, keep the browser paths relative and configure `amuleapi` to serve the generated `dist/` directory as its static root. This keeps the UI, cookie, REST API, and SSE stream on one origin.

## Build and deploy

```bash
pnpm build
```

Point `amuleapi`'s `StaticRoot` setting to this project's `dist/` directory, then restart the aMule service. The production bundle is static; Vite's proxy only applies to `pnpm dev`.

For LAN access, follow the aMule project's network/security guidance and restrict the API listener and firewall rules to the intended network. Put TLS in front of `amuleapi` before exposing it beyond a trusted local network.

## Quality checks

```bash
pnpm exec prettier --write . --ignore-unknown
pnpm format:check
pnpm test
pnpm build
```

`PLAN.md` is a local implementation log and is intentionally not tracked in Git.

## Continuous integration

GitHub Actions runs formatting validation, tests, and the production build on every pull request, pushes to `main`, and manual dispatches. It intentionally does not deploy anything; CD will be added separately. See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution and review workflow and [SECURITY.md](SECURITY.md) for responsible disclosure guidance.
