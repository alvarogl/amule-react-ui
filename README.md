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

`amuled` starts the native `amuleapi` process. `amuleapi` serves this project's built `dist/` directory at `/`, while its own handlers serve `/api/v1/*` and `/api/v1/events`. This same-origin arrangement keeps the HttpOnly session cookie, REST requests, and live SSE updates together.

The legacy `amuleweb` service is independent of this SPA and is not required.
Enable it only when an operator intentionally wants a temporary fallback.

## Container deployment

This repository also contains a source-built, multi-platform container image
and a single-service Compose deployment. It runs `amuled` with its native
`amuleapi` child and serves the bundled SPA without a Node.js runtime. See
[docs/CONTAINER.md](docs/CONTAINER.md) for migration, backup, password
rotation, and reverse-proxy/TLS guidance.

### Recommended Docker Compose configuration

Use the supplied Compose file unchanged for a new installation. It keeps
configuration, completed downloads, and temporary downloads in three separate
named volumes; it exposes only the UI/API and aMule's TCP/UDP P2P ports. The
EC and legacy `amuleweb` ports stay private to the container.

Create a local Compose environment file and the first-boot admin-password
secret:

```bash
cp docker.env.example docker.env
mkdir -p secrets
chmod 700 secrets
umask 077
printf '%s' 'choose-a-long-unique-password' > secrets/amule-admin-password
```

Set the values below in `docker.env`. The template is deliberately safe to
copy: it is ignored by Git, contains no password, and uses local source-build
defaults.

```dotenv
# Ownership used for /config, /incoming, and /temp inside the container.
# Use: id -u ; id -g
PUID=1000
PGID=1000

# Host ports. Change only if these host ports are unavailable or restricted.
AMULE_UI_PORT=4713
AMULE_TCP_PORT=4662
AMULE_UDP_PORT=4672

# Build locally from this checkout. For a published deployment, pin both
# values to an immutable image and exact combined version tag.
AMULE_IMAGE=amule-console
AMULE_IMAGE_VERSION=local

# A file path used as a Docker secret source; never put the password here.
AMULE_ADMIN_PASSWORD_FILE=./secrets/amule-admin-password
```

For a published image, replace the two image settings with values such as:

```dotenv
AMULE_IMAGE=alvarogl91/amule-console
AMULE_IMAGE_VERSION=0.2.0-amule-3.0.1
```

Always use an exact image tag for upgrades and rollback; do not deploy
`latest`. Start a source build or an already-published image respectively:

```bash
# From this checkout: build the image, validate the resolved configuration,
# and start it.
docker compose --env-file docker.env config
docker compose --env-file docker.env up -d --build

# With an exact published image configured in docker.env:
docker compose --env-file docker.env pull
docker compose --env-file docker.env up -d
```

Check startup with `docker compose --env-file docker.env ps`, then open
`http://<docker-host>:<AMULE_UI_PORT>` and sign in with the password stored in
the secret file. The secret is consumed only to initialize the credential
record; changing that file later does not change the admin password.

The UI/API port grants administrative access. Limit TCP `4713` to trusted
operator networks using the host or network firewall. For HighID, allow and
port-forward both configured P2P ports (TCP `4662` and UDP `4672` by default).
Use a TLS reverse proxy for access beyond a trusted LAN, and proxy `/`,
`/api/v1/*`, and `/api/v1/events` together so login and live updates remain
same-origin.

## Run the stack

Build the UI and point `amuleapi` at its absolute output directory:

```bash
pnpm install --frozen-lockfile
pnpm build
```

In `amuleapi.conf`, configure `StaticRoot` with the absolute path to `dist/`. Ensure the `[AmuleApi]` section in the aMule configuration enables the API and points `Path` at the native `amuleapi` executable. Then start the aMule services using the unit names installed on the host, for example:

```bash
sudo systemctl enable --now amuled.service
sudo systemctl status amuled.service
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
| `VITE_API_BASE`       | `/api/v1`               | Browser REST API base path. Keep relative when aMule serves the bundle. |
| `VITE_EVENTS_URL`     | `/api/v1/events`        | Browser SSE endpoint.                                                   |
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

Release-archive users can follow the archive-only install path in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#use-a-release-archive); Node.js and
pnpm are needed only when building from a checkout.

### Publish a GitHub Release

The `Release` workflow is manual-only. Stable releases run only from `main`.
Select the semantic version component to increment; after the quality,
deployment, browser, and archive checks pass, it commits the new version,
creates tag `v<version>`, and attaches the archive plus checksum to a generated
GitHub Release. It does not deploy to any aMule host.

For an early release from another branch, select **Create a beta prerelease**.
The workflow appends `-beta` to the calculated next version, pushes the release
commit to that branch, and creates a GitHub prerelease. A beta does not alter
`main` or become `latest`.

### Docker Hub releases

UI versions use independent semantic versioning. The bundled aMule source is
recorded separately in [docker/amule-version.env](docker/amule-version.env).
Each published image has an immutable combined tag such as
`0.2.0-amule-3.0.1`; a development aMule commit is labelled honestly, for
example `0.2.0-amule-git-d8d5720b`. `latest` is a moving alias for the newest
stable image and is unsuitable for deployments.

To enable publishing, create the Docker Hub repository and configure these
GitHub Actions values:

- Repository variable `DOCKERHUB_IMAGE` — image name without a registry, for
  example `alvarogl91/amule-console`.
- Repository secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` — a Docker Hub
  username and access token with permission to push that repository.

Selecting **Publish the multi-platform image to Docker Hub** runs the separate
**Docker release** workflow after the GitHub Release. It publishes
`linux/amd64` and `linux/arm64`, with provenance and an SBOM. The workflow
derives the exact combined image tag automatically from the new UI version and
the pinned aMule version; operators never enter an image tag manually.

Before building, Docker release rejects an existing exact image tag. It also
rejects a beta image if the corresponding final image tag already exists. Only
stable images update `latest`; beta images use their exact `-beta` tag only.

## License

This project is licensed under the [MIT License](LICENSE).

## Quality checks

```bash
pnpm exec prettier --write . --ignore-unknown
pnpm format:check
pnpm lint
pnpm test
pnpm test:deployment
pnpm test:e2e
pnpm build
pnpm test:release
```

## Continuous integration

GitHub Actions runs formatting, ESLint, unit/integration tests, deployment and
release-package checks, and a separate browser-test workflow for pull requests
and pushes to `main`. The manual-only Release workflow publishes verified
artifacts but never deploys to an aMule host. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the contribution and review workflow
and [SECURITY.md](SECURITY.md) for responsible disclosure guidance.
