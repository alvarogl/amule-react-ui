# aMule React UI

A reactive, browser-based operations console for [aMule](https://github.com/amule-org/amule). It is designed to be served by aMule's built-in `amuleapi`, using the REST API and SSE events on the same origin.

The application provides authenticated live status, download and upload activity, searches, server/network controls, categories, and confirmation dialogs for consequential actions. It stores no password or token in browser storage; authentication uses the API's HttpOnly cookie.

## Prerequisites

- A current [aMule source build](https://github.com/amule-org/amule#building-from-source) with `amuled` and `amuleapi` enabled.
- Node.js and pnpm.
- An `amuleapi` admin password configured on the target aMule instance.

## Runtime architecture

There is no custom backend or separate production Node server. The running stack is:

```text
browser → amuleapi (static files, REST, SSE) ← amuled (aMule core)
```

`amuled` starts the native `amuleapi` process. `amuleapi` serves this project's built `dist/` directory at `/`, while its own handlers serve `/api/v0/*` and `/api/v0/events`. This same-origin arrangement keeps the HttpOnly session cookie, REST requests, and live SSE updates together.

The legacy `amuleweb` service is independent of this SPA and can remain available as a fallback.

## Run the stack

Build the UI and point `amuleapi` at its absolute output directory:

```bash
pnpm install --frozen-lockfile
pnpm build
```

In `amuleapi.conf`, configure `StaticRoot` with the absolute path to `dist/`. Ensure the `[AmuleApi]` section in the aMule configuration enables the API and points `Path` at the native `amuleapi` executable. Then start the aMule services using the unit names installed on the host, for example:

```bash
sudo systemctl enable --now amuled.service amuleweb.service
sudo systemctl status amuled.service amuleweb.service
```

Do not stop `amuled` when you only want to run the UI differently: it owns the core and its `amuleapi` child. To use the development UI, leave that stack running and start Vite separately.

For a complete first install, upgrade, rollback, and secure-network guide, see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Generic non-secret configuration
templates are available at [docs/amule.conf.example](docs/amule.conf.example)
and [docs/amuleapi.conf.example](docs/amuleapi.conf.example).

## Local development

```bash
cd /opt/amule/web
pnpm install
cp .env.example .env
pnpm dev
```

Vite prints its local URL when it starts. It proxies `/api` and `/flags` to `VITE_DEV_API_ORIGIN` (by default `http://127.0.0.1:4713`); set that value to the reachable `amuleapi` listener for the development host. Sign in with the `amuleapi` admin password; do not add it to `.env`.

## Configuration

Copy `.env.example` to `.env` to override local values. `.env` is intentionally ignored by Git.

| Variable              | Default                 | Purpose                                                                 |
| --------------------- | ----------------------- | ----------------------------------------------------------------------- |
| `VITE_API_BASE`       | `/api/v0`               | Browser REST API base path. Keep relative when aMule serves the bundle. |
| `VITE_EVENTS_URL`     | `/api/v0/events`        | Browser SSE endpoint.                                                   |
| `VITE_DEV_API_ORIGIN` | `http://127.0.0.1:4713` | Vite development proxy target.                                          |

For the deployed SPA, keep browser paths relative and configure `amuleapi` to serve the generated `dist/` directory as its static root. This keeps the UI, cookie, REST API, and SSE stream on one origin.

## Build and deploy

```bash
pnpm build
```

The production bundle is static; Vite's proxy only applies to `pnpm dev`. Rebuild after UI changes. If the configured static-root path changes, restart `amuled` so it starts `amuleapi` with the new configuration.

For LAN access, restrict the API listener and firewall rules to the intended network. Put TLS in front of `amuleapi` before exposing it beyond a trusted local network; the deployment guide explains why the static UI and same-origin API must be secured together.

### Repeatable install and rollback

The deployment helper stages a built bundle, retains the previous static root,
and does not restart services. Preview its work first:

```bash
scripts/install-static-ui.sh --dry-run --static-root /absolute/path/to/static-root
```

To install, optionally pass the explicit aMule configuration files to patch
only their API startup/server settings. The helper never writes credentials or
replaces either complete configuration file:

```bash
scripts/install-static-ui.sh --static-root /absolute/path/to/static-root \
  --amule-conf /absolute/path/to/amule.conf \
  --amuleapi-conf /absolute/path/to/amuleapi.conf
```

It prints a rollback directory. Restore it with
`scripts/install-static-ui.sh --rollback /path/to/rollback-directory`.

### Create a release archive

After a production build, create an operator-ready archive and SHA-256
checksum with:

```bash
pnpm build
scripts/create-release-archive.sh
```

The output in `release/` contains the static bundle, deployment helper,
generic templates, documentation, and a release manifest. It deliberately
excludes `.env`, credentials, runtime configuration, and dependencies. Verify
the downloaded archive with `sha256sum --check release/*.sha256` before use.

## License

This project is licensed under the [MIT License](LICENSE).

## Quality checks

```bash
pnpm exec prettier --write . --ignore-unknown
pnpm format:check
pnpm lint
pnpm test
pnpm test:deployment
pnpm test:release
pnpm build
```

`PLAN.md` is a local implementation log and is intentionally not tracked in Git.

## Continuous integration

GitHub Actions runs formatting validation, ESLint, tests, and the production build on every pull request, pushes to `main`, and manual dispatches. It intentionally does not deploy anything; CD will be added separately. See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution and review workflow and [SECURITY.md](SECURITY.md) for responsible disclosure guidance.
