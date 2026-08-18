# Container deployment

The container runs `amuled` in the foreground. The daemon launches its
`amuleapi` child, which serves this bundled SPA, REST API, and SSE stream on
one origin. It is a fresh deployment path; it does not convert an existing
host installation or rewrite an existing aMule configuration volume.

## First run

Create a password file readable by Docker but not committed to the repository:

```bash
mkdir -p secrets
umask 077
printf '%s' 'choose-a-long-unique-password' > secrets/amule-admin-password
cp docker.env.example docker.env
```

Set the real host UID/GID and, if necessary, host ports in `docker.env`. Then
start the single service:

```bash
docker compose --env-file docker.env up -d --build
docker compose --env-file docker.env ps
```

The password file is mounted as a Docker secret on first boot only. The
entrypoint passes it to aMule's one-shot credential command, which stores a
salted, stretched admin record in `/config/amuleapi-passwords`. It is never
written to `amule.conf`, `amuleapi.conf`, the image, or container environment.
Guest access is disabled. Do not remove the secret source until initial startup
has succeeded; retaining it is harmless because existing configuration is left
untouched on subsequent starts.

The named volumes are intentionally separate:

- `amule-config` holds configuration, credentials, state, and metadata.
- `amule-incoming` holds completed downloads.
- `amule-temp` holds incomplete downloads.

Use named-volume backups or replace these with explicitly managed bind mounts
before relying on the daemon for important data.

## Network exposure

By default Compose publishes the UI/API on TCP 4713 and aMule's P2P ports on
TCP 4662 and UDP 4672, all interfaces. EC (4712) and legacy `amuleweb` (4711)
are not published. `amuleapi` listens inside the container so Docker can expose
the UI, but CORS remains disabled and the SPA uses same-origin API/SSE paths.

Direct LAN access is admin-capable. Restrict TCP 4713 to trusted operator
addresses with the host or network firewall; a strong password alone is not a
network boundary. For HighID, allow and port-forward both the configured TCP
and UDP P2P ports from the Internet to the Docker host. Configure the same
ports in `docker.env` if host policy requires different values.

For remote or Internet access, place a TLS reverse proxy in front of the
complete origin. Proxy `/`, `/api/v0/*`, and `/api/v0/events` together, retain
HTTP/1.1 and streaming for SSE, and do not enable CORS merely for this UI.
Reverse-proxy automation is deliberately outside this deployment.

## Image versions, upgrade, rollback, and password rotation

Published images are tagged with both the UI and bundled aMule version, for
example `0.2.0-amule-3.0.1`. Use that exact tag for a deployment:

```bash
AMULE_IMAGE=alvarogl91/amule-console
AMULE_IMAGE_VERSION=0.2.0-amule-3.0.1
docker compose --env-file docker.env pull
docker compose --env-file docker.env up -d
```

`latest` is a convenience alias and must not be used for an installation that
needs reproducible upgrades or rollbacks. The current image is built from
aMule release `3.0.1`; see [`docker/amule-version.env`](../docker/amule-version.env)
for its immutable source commit.

Build or select an explicit image tag, then retain the three volumes while
recreating the service. Roll back by starting the prior image tag with the same
volumes. Do not use `docker compose down -v` unless intentionally discarding
all aMule state.

To rotate the admin password, sign in and use the console's password controls
or invoke the documented aMule API credential flow. Changing the password ends
existing sessions. Updating the Docker secret file alone does not rotate an
already initialized instance, by design. Back up the configuration volume
before manual recovery work.

Existing host installations require a deliberate migration: stop the old
daemon, back up its state, and review its paths and settings before choosing a
new container volume layout. This milestone does not rewrite arbitrary host
configuration or migrate it automatically.
