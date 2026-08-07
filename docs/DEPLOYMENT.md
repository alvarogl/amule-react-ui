# Deployment guide

This UI is a static bundle served by aMule's native `amuleapi`. It has no
production Node server and does not change aMule's REST API. The recommended
stack is:

```text
browser → amuleapi (static UI, REST, SSE) ← amuled
```

`amuleweb` can remain enabled as a fallback while adopting this UI.

## Prerequisites

- A source-built aMule installation with `amuled` and `amuleapi` enabled.
- Node.js and the pnpm version declared in `package.json`.
- An `amuleapi` admin password configured on the aMule host.

Build the checked-out release:

```bash
pnpm install --frozen-lockfile
pnpm build
```

Run `pnpm format:check && pnpm lint && pnpm test && pnpm test:e2e` before
deploying a locally modified checkout. The output is `dist/`.

## Configure aMule and amuleapi

Use [amule.conf.example](amule.conf.example) as the `amuled` startup section.
Stop `amuled` before editing `amule.conf`, because it rewrites that file when
it exits. Use [amuleapi.conf.example](amuleapi.conf.example) in the same
configuration directory and set `StaticRoot` to the absolute path of this
checkout's `dist/` directory.

Set an admin password through the aMule API tooling or its preferences UI; do
not place it in either template, an environment file, a shell history, or Git.
Start `amuled` using the service manager configured by the host. It launches
`amuleapi`; a separate API service is unnecessary.

Verify the unauthenticated version endpoint and static entry page from the
aMule host:

```bash
curl --fail http://127.0.0.1:4713/api/v0/version
curl --fail http://127.0.0.1:4713/
```

Then sign in to the browser UI. Browser authentication is an HttpOnly,
same-origin cookie; the SPA never stores a password or token in browser
storage.

## Upgrade and rollback

Build and validate the new bundle before replacing the configured static root.
Keep the previous `dist/` directory until browser smoke testing succeeds. To
roll back, point `StaticRoot` back to that retained directory and restart
`amuled`, or restore the previous bundle at the same path. Do not run two
aMule cores to test a UI update.

For repeatable installs, use the repository helper. It stages and validates
the bundle, moves the previous static root to a timestamped rollback directory,
and never restarts a service:

```bash
scripts/install-static-ui.sh --dry-run --static-root /srv/amule-react-ui
scripts/install-static-ui.sh --static-root /srv/amule-react-ui
```

Pass configuration paths only when the helper should patch their relevant
settings. It updates `[AmuleApi]` (`Enabled`, `BindAddress`, `HttpPort`) and
`[Server]` (`BindAddress`, `Port`, `StaticRoot`) while preserving every other
setting and never writing credentials:

```bash
scripts/install-static-ui.sh --static-root /srv/amule-react-ui \
  --amule-conf /path/to/amule.conf \
  --amuleapi-conf /path/to/amuleapi.conf \
  --bind-address 127.0.0.1 --http-port 4713
```

The helper prints the rollback directory. Restore it with:

```bash
scripts/install-static-ui.sh --rollback /path/to/rollback-directory
```

Run `pnpm test:deployment` to exercise this flow in an isolated temporary
directory. It is safe to run locally and in CI; it never contacts a daemon.

## Development configuration

For `pnpm dev`, copy `.env.example` to `.env` and set only
`VITE_DEV_API_ORIGIN` when the development server must proxy to a different
reachable aMule API listener. The three `VITE_*` values are build-time public
configuration, so they must never contain passwords, tokens, or private
credentials. Production paths should remain relative (`/api/v0` and
`/api/v0/events`) so the UI, REST API, and SSE stream share one origin.

## Network security

The safest deployment keeps `BindAddress=127.0.0.1` and uses a TLS reverse
proxy for remote access. Proxy the complete origin, including `/api/v0/events`;
for nginx, use HTTP/1.1 so SSE works. Restrict firewall access to the intended
network even for a LAN-only deployment.

Binding amuleapi directly to a LAN address serves both the UI and its
same-origin, admin-capable API to that network. Use a strong admin password
and narrow firewall rules. Do not enable CORS for this UI: same-origin hosting
does not need it. For Internet exposure, terminate TLS and follow the upstream
[amuleapi quick start](https://github.com/amule-org/amule/blob/master/docs/QUICKSTART-AMULEAPI.md).

## Troubleshooting

- **Blank or old UI:** confirm `StaticRoot` is absolute, contains `index.html`,
  and points to the newly built `dist/` directory.
- **Login fails:** verify an admin password exists and that the browser reaches
  the same amuleapi origin that serves the SPA.
- **Live data stops:** make sure a reverse proxy preserves SSE and does not
  downgrade the upstream connection from HTTP/1.1.
- **API does not start:** check that amuleapi is enabled in `amule.conf` and
  inspect the daemon/service logs; a non-loopback bind requires an admin
  password.
