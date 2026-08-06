# Reactive aMule UI with Source-Built Core Replacement

## Approved architecture and immutable decisions

- Replace the AppImage with source commit `d8d5720b0ee858b9cb02ba804cc183d2a57c424b`, installed as one complete native build in `/opt/amule/releases/d8d5720b/` and selected by `/opt/amule/current`.
- Preserve `/opt/amule/config` and `/opt/amule/data`; retain the AppImage as a stopped rollback artifact. The AppImage and native core must never run together.
- A full-feature dependency audit and clean CMake preflight are mandatory gates before building or changing runtime services. The audit reports only; it never installs packages.
- Build GUI, daemon, remote GUI, command client, web server, REST API, utilities, NLS, UPnP, IP-to-country, and supported optional features. Run relevant CTest suites.
- `amuled` is the only core process and starts `amuleapi`; `amuleweb` runs as its companion. Per subsequent user approval, API/static SPA bind to `192.168.50.10:4713` and UFW permits that port only from `192.168.50.0/24`.
- Build `/opt/amule/web` as a pnpm/Vite React 19 strict-TypeScript SPA using Tailwind, Radix, TanStack Query, Zod, `amuleapi` REST and SSE. Serve production assets from `amuleapi` StaticRoot; no custom backend or EC protocol.
- Use cookie authentication with `credentials: include`; admin role only; never store passwords or JWTs in browser storage.

## Staged checklist

- [completed] Stage 0: audit and full-feature CMake preflight passed; report and configure log retained at `/opt/amule/preflight-d8d5720b/`.
- [completed] Stage 1: full native release is active; AppImage rollback artifact and pre-cutover backup retained.
- [completed] Frontend platform: strict React SPA, Zod REST client, cookie session/SSE refresh foundation, and same-origin static hosting are working.
- [completed] Milestone 1: core operations are implemented and reviewed while retaining legacy-web fallback.
- [pending] Milestone 2: legacy UI parity and disable legacy web only after review.
- [pending] Acceptance: frontend unit/integration/Playwright checks, native runtime checks, no concurrent runtimes.

## Required runtime and build record

- Pinned source commit: `d8d5720b0ee858b9cb02ba804cc183d2a57c424b`.
- Intended release path: `/opt/amule/releases/d8d5720b/`; current link: `/opt/amule/current`.
- Preserved paths: `/opt/amule/config`, `/opt/amule/data`.
- Existing rollback artifact: `/opt/amule/bin/aMule-3.0.1-Linux-x64.AppImage`.
- Intended API configuration:

  ```ini
  [AmuleApi]
  Enabled=1
  BindAddress=192.168.50.10
  HttpPort=4713
  Path=/opt/amule/current/bin/amuleapi
  ```

## Iteration log

### Iteration 1 — Stage 0 blocked (2026-08-06 UTC)

- Changed files: `web/PLAN.md`, `code/docs/UBUNTU-24.04-FULL-BUILD-DEPS.md`, `code/scripts/audit-full-build.sh`.
- Commands run: `bash -n scripts/audit-full-build.sh`; `./scripts/audit-full-build.sh --preflight-dir /opt/amule/preflight-d8d5720b`.
- Evidence: source HEAD is the pinned `d8d5720b0ee858b9cb02ba804cc183d2a57c424b`; the audit report at `/opt/amule/preflight-d8d5720b/audit-report.txt` reports missing `bison`, `flex`, and `ninja-build`. It intentionally did not run CMake, so `/opt/amule/preflight-d8d5720b/cmake-configure.log` does not exist.
- Outcome: blocked. The no-install audit works as designed and Stage 0 cannot validate the requested full build.
- Rollback notes: no runtime files, services, configuration, source build, or installed release changed. The only changes are the audit manifest/script and this plan record.
- Next action: install the three exact Ubuntu packages, rerun the recorded audit command, then proceed only if it passes its CMake component/target checks.

### Iteration 2 — Stage 0 resumed (2026-08-06 UTC)

- Intended work: install only `bison`, `flex`, and `ninja-build`, which are the three gaps reported by Iteration 1; rerun the audit and clean configure.
- Intended verification: the audit report has no missing prerequisite or requested CMake component/target, and records a successful configure log.
- Rollback: package installation is managed by the system package manager; runtime and service state remain out of scope for this iteration.
- Commands run: `apt-get update && apt-get install -y bison flex ninja-build`; `sudo -n apt-get update && sudo -n apt-get install -y bison flex ninja-build`.
- Evidence: the unprivileged package command was denied access to `/var/lib/apt/lists/lock`; non-interactive sudo returned `sudo: a password is required`.
- Outcome: blocked. No packages were installed, so rerunning the audit would produce the same failed report. No CMake configure, build, service, or configuration mutation occurred.
- Next action: an administrator must run `sudo apt-get update && sudo apt-get install -y bison flex ninja-build`; then rerun `cd /opt/amule/code && ./scripts/audit-full-build.sh --preflight-dir /opt/amule/preflight-d8d5720b` and continue only on success.

### Iteration 3 — Stage 0 resumed with administrator authorization (2026-08-06 UTC)

- Intended work: use the credential supplied by the administrator solely for `sudo apt-get update` and installation of `bison`, `flex`, and `ninja-build`; then run the recorded report-only audit/preflight command.
- Intended verification: package manager succeeds and the audit creates a successful CMake configure report with all requested components and executable targets enabled.
- Credential handling: read `/home/alvarogl/pass.txt` only through sudo standard input; never log, display, copy, or commit its contents.
- Rollback: package installation remains system-package-manager managed; no aMule runtime mutation is authorized in this iteration.
- Commands run: `sudo -S -p '' apt-get update`; `sudo -S -p '' apt-get install -y bison flex ninja-build`; `bash -n scripts/audit-full-build.sh`; `./scripts/audit-full-build.sh --preflight-dir /opt/amule/preflight-d8d5720b`.
- Result: completed. `bison`, `flex`, and `ninja-build` installed successfully. The final audit returned `RESULT: PASSED`; `cmake-configure.log` records GUI, daemon, remote GUI, command client, web server, REST API, utilities, NLS, UPnP, and IP2Country all enabled, with targets `amule`, `amuled`, `amulegui`, `amulecmd`, `amuleweb`, and `amuleapi` present.
- Approved audit correction: cache values in this project are `YES` (not only `ON`) and Ninja emits targets as `name: phony`; the audit accepts both valid forms. This was a script verification fix, not an architecture change.

### Iteration 4 — Stage 1 build and test completed (2026-08-06 UTC)

- Intended work: configure `/opt/amule/build-d8d5720b` with the exact passing full-feature options and prefix `/opt/amule/releases/d8d5720b`, then build all targets and run CTest.
- Intended verification: successful build and relevant CTest suites; staged install contains `amule`, `amuled`, `amulegui`, `amulecmd`, `amuleweb`, and `amuleapi` before any backup or service change.
- Rollback: delete only the isolated build directory or uninstalled release directory if required; existing AppImage services and preserved configuration/data remain untouched until a separately recorded cutover step.
- Commands run: full-feature CMake configure into `/opt/amule/build-d8d5720b`; `cmake --build /opt/amule/build-d8d5720b -j2`; `ctest --test-dir /opt/amule/build-d8d5720b --output-on-failure`.
- Result: completed. The build log is `/opt/amule/build-d8d5720b/build.log`; all required binaries were built. All 33 CTest tests passed in 3.32 seconds (`/opt/amule/build-d8d5720b/ctest.log`). Compiler warnings were recorded but no build/test failure occurred.

### Iteration 5 — Stage 1 staged installation and cutover preparation started (2026-08-06 UTC)

- Intended work: install the tested build to `/opt/amule/releases/d8d5720b`, inspect the existing services/configuration/runtime state, and make timestamped backups before any service is stopped.
- Intended verification: installed release has all required executable targets; backup contains the configuration, units, current target metadata, and active binary metadata. No source and AppImage core may run concurrently.
- Rollback: retain the AppImage and do not replace the existing current target until backup evidence is complete.
- Commands run: `sudo -S -p '' cmake --install /opt/amule/build-d8d5720b`; inspected systemd unit state, listeners, source/API docs and config; created `/opt/amule/data/backups/20260806-162500-source-cutover/cutover-prestate.tar.gz`.
- Evidence: installed `/opt/amule/releases/d8d5720b/bin/` contains `amule`, `amuled`, `amulegui`, `amulecmd`, `amuleweb`, and `amuleapi`. Backup SHA-256: `af67d0c52b117254023777f9db7ea57a733511251bf19aa2c8ecc69a9f546000`. Existing AppImage units remain active and `/opt/amule/current` does not yet exist.
- Outcome: blocked awaiting a user-selected dedicated API admin password. The sudo credential is intentionally not reused as an API credential, no plaintext API password was generated or stored, and no service/configuration cutover occurred.
- Next action: receive a dedicated API admin password, set it through `/opt/amule/releases/d8d5720b/bin/amuleapi --config-dir /opt/amule/config --set-admin-pass=...`, add the approved `[AmuleApi]` config section, then atomically switch the service units and validate the runtime.

### Iteration 6 — Stage 1 cutover started (2026-08-06 UTC)

- Intended work: store the user-supplied dedicated admin password with `amuleapi`'s password writer, stop both AppImage services, add `[AmuleApi]` settings while the daemon is stopped, update the service units to `/opt/amule/current`, and start native `amuled` followed by native `amuleweb`.
- Intended verification: only source-built processes run, API is loopback-only at 4713 and authenticates, legacy web is available at 4711, expected ports are listening, and units survive restart.
- Credential handling: pass the admin password only to the one-shot credential writer; do not add it to `amule.conf`, the plan, shell output, source files, or browser storage.
- Rollback: stop the native services, restore the timestamped backup and original AppImage service commands, remove `/opt/amule/current`, then restart the original units.
- Commands run: protected API credential writer; AppImage service stop; stopped-daemon `[AmuleApi]` configuration update; unit update, daemon reload, native service start and restart verification; API REST/cookie-auth checks.
- Result: completed. Native `amuled` started `/opt/amule/current/bin/amuleapi` at `127.0.0.1:4713`; native `amuleweb` runs at 4711. Ports 4662/tcp, 4665/udp, 4672/udp, 4711/tcp, 4712/tcp, and 4713/tcp are listening. API version and cookie-authenticated status checks pass; status reports `ed2k.low_id=false` and the daemon log reports HighID. Legacy fallback GET returns HTTP 200. Both units are enabled and active after restart.
- Security evidence: API is loopback-only and the admin credential was written only to `/opt/amule/config/amuleapi-passwords`; no credential was committed or placed in `amule.conf`.
- Rollback rehearsal: documented but not executed so the healthy service was not interrupted: stop both units, restore `cutover-prestate.tar.gz` under `/`, remove `/opt/amule/current`, daemon-reload, and start the original enabled units.

### Iteration 7 — Frontend platform started (2026-08-06 UTC)

- Intended work: inspect the local API contract and JavaScript toolchain, then scaffold the pnpm/Vite React 19 strict-TypeScript application with schema-validated API/session/SSE foundations.
- Intended verification: production build and tests run locally; the application uses same-origin cookie authentication and no browser credential persistence.
- Rollback: frontend files are isolated under `/opt/amule/web`; native API static hosting stays on the installed fallback until a production bundle passes validation.
- Changed files: `web/package.json`, `web/pnpm-lock.yaml`, `web/pnpm-workspace.yaml`, Vite/TypeScript configuration, `web/src/**`, and `/opt/amule/config/amuleapi.conf` (`StaticRoot=/opt/amule/web/dist`).
- Commands run: `pnpm install`; `pnpm test`; `pnpm build`; native service restart; localhost static-asset checks.
- Result: completed. Two Zod schema tests pass and the strict TypeScript/Vite production build succeeds. The SPA implements cookie login/logout, no browser credential persistence, typed Zod-validated status/download requests, query snapshots, SSE-triggered invalidation/resync, and an explicit terminal session-expiry path on 401. `GET http://127.0.0.1:4713/` serves the Vite bundle and its JavaScript asset returns HTTP 200; both native services remain active.
- Next action: implement the remaining Milestone 1 dashboard controls, complete transfer actions/details, search, server/network, and category workflows against the established API client; legacy `amuleweb` remains enabled as fallback.

### Iteration 8 — Firewall port policy started (2026-08-06 UTC)

- Intended work: inspect UFW state and add only the aMule peer-network listeners required for HighID: 4662/tcp, 4665/udp, and 4672/udp.
- Intended verification: UFW reports explicit allow rules for those three ports; API 4713 remains loopback-only and no new firewall exception is made for management ports.
- Rollback: delete only the three named UFW rules if required.
- Command run: `sudo -S -p '' ufw status numbered`.
- Result: completed without mutation. UFW is active and already has `ALLOW IN Anywhere` rules for 4662/tcp, 4665/udp, and 4672/udp (rules 22–24), plus matching IPv6 rules (36–38). No management-port rule was added; API 4713 remains bound to loopback.

### Iteration 9 — Remote development firewall access started (2026-08-06 UTC)

- Approved plan change: the user requested UFW access for 4713/tcp for remote development. This changes only firewall policy; `[AmuleApi]/BindAddress` remains `127.0.0.1`, so the API is not yet network-exposed.
- Intended work and verification: add 4713/tcp to UFW and verify IPv4/IPv6 rules; confirm the process remains loopback-bound.
- Rollback: `sudo ufw delete allow 4713/tcp`.
- Commands run: `sudo -S -p '' ufw allow 4713/tcp`; `ufw status numbered`; `ss -ltnp 'sport = :4713'`.
- Result: completed. UFW allows 4713/tcp from Anywhere as rules 25 (IPv4) and 40 (IPv6). `amuleapi` still listens only on `127.0.0.1:4713`, so remote access additionally requires an explicit future bind-address or reverse-proxy change.

### Iteration 10 — Restrict remote-development firewall access started (2026-08-06 UTC)

- Approved plan change: replace the broad 4713/tcp UFW rule with access only from `192.168.50.0/24`; remove the corresponding broad IPv6 rule.
- Intended verification: UFW has exactly one 4713/tcp rule scoped to `192.168.50.0/24` and no `Anywhere` 4713 rule.
- Rollback: `sudo ufw delete allow from 192.168.50.0/24 to any port 4713 proto tcp`, then re-add a broader rule only if explicitly requested.
- Commands run: `sudo ufw --force delete allow 4713/tcp`; `sudo ufw allow from 192.168.50.0/24 to any port 4713 proto tcp`; `sudo ufw status numbered`.
- Result: completed. UFW rule 25 allows 4713/tcp only from `192.168.50.0/24`; the previous Anywhere IPv4 and IPv6 rules were removed. The API/web process continues to bind loopback-only until an explicitly approved bind/proxy change.

### Iteration 11 — LAN web/API bind started (2026-08-06 UTC)

- Approved plan change: bind the web/API listener to the host's verified LAN address `192.168.50.10` so the UI is reachable from the permitted `192.168.50.0/24` network. This necessarily serves same-origin `/api/v0` to the UI; UFW remains the network boundary and cookie authentication remains required.
- Intended work and verification: stop native services, change `[AmuleApi]/BindAddress`, restart native services, confirm `192.168.50.10:4713` listens and serves the static SPA/API.
- Rollback: restore `BindAddress=127.0.0.1` and restart `amuled.service` plus `amuleweb.service`.
- Commands run: verified host address with `ip -4 -brief address show up scope global`; stopped native units; updated `/opt/amule/config/amule.conf`; started native units; checked service state, listener, static SPA, and API version endpoint.
- Result: completed. `amuleapi` listens on `192.168.50.10:4713`; the SPA and `/api/v0/version` respond there. Both native services are active. UFW continues to restrict inbound 4713/tcp to `192.168.50.0/24`.

### Iteration 12 — Milestone 1 Transfers slice started (2026-08-06 UTC)

- Intended work: turn the dashboard Transfers panel into a usable first Milestone 1 slice: typed ed2k-link addition, local filtering/sorting, and per-item pause/resume feedback through the existing REST client.
- Intended verification: TypeScript build and unit tests pass; mutations invalidate the downloads snapshot and show an actionable result/error without storing credentials.
- Rollback: frontend-only changes under `/opt/amule/web`; the legacy web UI remains available at 4711.
- Changed files: `web/src/api.ts`, `web/src/ui/App.tsx`, `web/src/transfers.css`, and `web/src/main.tsx`.
- Commands run: inspected the local downloads REST contract; `pnpm test`; `pnpm build`; production static-bundle check through `http://192.168.50.10:4713/`.
- Result: completed. Transfers now supports client-side name filtering/sorting, one-or-many whitespace-separated `ed2k://` links, and per-item pause/resume with mutation feedback. The client uses the documented `status` mutation field and invalidates the downloads snapshot after mutations. Tests and strict production build pass; the newly built asset is served by amuleapi.
- Next action: begin the Search slice: local/global/Kad search submission, live result progress through SSE, result tabs, and explicit download action.

### Iteration 13 — Milestone 1 Search slice started (2026-08-06 UTC)

- Intended work: add typed search creation/results API calls and a Search navigation view with local/global/Kad modes, concurrent result tabs, and explicit result download actions.
- Intended verification: strict build/tests pass and the live production bundle is served; SSE invalidates active search result snapshots on progress/result events.
- Rollback: frontend-only files under `/opt/amule/web`; legacy web remains available.
- Changed files: `web/src/api.ts`, `web/src/sse.ts`, `web/src/ui/App.tsx`, `web/src/ui/Search.tsx`, `web/src/search.css`, and `web/src/main.tsx`.
- Commands run: inspected the local Search REST/SSE contract; `pnpm test`; `pnpm build`; LAN static-bundle check.
- Result: completed. The Search view supports local/global/Kad query submission, discovers concurrent searches, presents each as a tab, polls its progress/results, receives SSE invalidation for `search_result_added`/`search_progress`, and promotes a selected result into Transfers. Strict build/tests pass and the production asset is served through amuleapi.
- Next action: implement the Servers/network slice: server list, add/connect/remove, eD2k/Kad controls, and live feedback.

### Iteration 14 — Session persistence and search lifecycle started (2026-08-06 UTC)

- Intended work: diagnose the browser cookie/session reload issue; preserve HttpOnly cookie authentication without credential storage; add a close action that stops and frees an active search, plus a ready-for-next-search input after completion.
- Intended verification: session probe accepts the documented cookie response; close sends documented stop/close semantics, invalidates search snapshots, and production tests/build pass.
- Rollback: frontend-only changes; API credentials remain in the protected server-side store.
- Changed files: `web/src/api.ts`, `web/src/ui/Search.tsx`, and `web/src/search.css`.
- Diagnostic evidence: `POST /auth/login` returns the expected persistent `HttpOnly; SameSite=Strict; Path=/api/v0; Max-Age=86400` cookie and `expires_at`; `GET /auth/session` correctly returns the distinct `exp`, `exp_unix`, and `jti` shape. The old client incorrectly parsed the latter as the former, so it discarded valid sessions on reload.
- Result: completed. Login and session schemas are now separate, preserving cookie-only browser authentication across reloads without password/JWT storage. Each search tab has an accessible close button that sends `POST /search/stop` with `{ search_id, close: true }`, which stops running work and frees its result slot. Closing clears the active tab/query and focuses the input; natural completion also clears/focuses the input. Tests, strict build, and LAN bundle check pass.
- Next action: resume the Servers/network slice.

### Iteration 15 — Milestone 1 Servers/network slice started (2026-08-06 UTC)

- Intended work: add typed server/network calls and an operational view for server list, add/connect/remove, plus eD2k/Kad connect/disconnect.
- Intended verification: mutations invalidate live snapshots, report outcomes, and the strict build/tests plus LAN production-serving check pass.
- Rollback: frontend-only changes; legacy web remains fallback.
- Changed files: `web/src/api.ts`, `web/src/ui/App.tsx`, `web/src/ui/Servers.tsx`, `web/src/servers.css`, and `web/src/main.tsx`.
- Commands run: inspected local server/network contract; `pnpm test`; `pnpm build`; LAN static-bundle check.
- Result: completed. The Servers view lists live servers, adds `host:port` entries, connects a selected server, confirms before deletion, and exposes connect/disconnect-all plus Kad-start controls. Mutations refresh the server snapshot and show feedback. Strict build/tests and LAN production serving pass.
- Next action: implement Categories and download assignment, then complete the remaining Milestone 1 transfer details/bulk controls.

### Iteration 16 — Milestone 1 Categories slice started (2026-08-06 UTC)

- Intended work: add typed category list/create/delete calls, category navigation, and download category assignment through the documented download PATCH endpoint.
- Intended verification: category and download snapshots are invalidated after mutations; strict tests/build and LAN serving pass.
- Rollback: frontend-only changes; category data changes occur only after explicit UI actions.
- Changed files: `web/src/api.ts`, `web/src/ui/App.tsx`, `web/src/ui/Categories.tsx`, `web/src/categories.css`, and `web/src/main.tsx`.
- Commands run: `pnpm test`; `pnpm build`; LAN static-bundle check.
- Result: completed. Categories can be listed, created, and deleted (with confirmation); Transfers provides a category selector per download that calls the documented PATCH endpoint. Mutations invalidate snapshots, and tests/build/LAN serving pass.
- Next action: complete remaining Transfers operations: bulk selection, priority controls, completed-clear, and detail views.

### Iteration 17 — Milestone 1 Transfers bulk-controls slice started (2026-08-06 UTC)

- Intended work: add multi-select, bulk status/priority mutations, and completed-transfer acknowledgement using the documented REST endpoints.
- Intended verification: bulk actions are disabled without selection, completed clearing is explicit, snapshots refresh afterward, and strict build/tests/LAN serving pass.
- Rollback: frontend-only code; transfer mutations require explicit UI actions.
- Changed files: `web/src/api.ts`, `web/src/ui/App.tsx`, and `web/src/transfers.css`.
- Commands run: `pnpm test`; `pnpm build`; LAN static-bundle check.
- Result: completed. Transfers supports select-all/per-row selection, bulk pause/resume/high-priority commands, and explicit completed-transfer acknowledgement. Actions are disabled without a selection where applicable, refresh snapshots, and provide feedback. Tests/build/LAN serving pass.
- Next action: add download details (source names, comments, A4AF) and the remaining lower-risk priority controls.

### Iteration 18 — Milestone 1 Transfer-details slice started (2026-08-06 UTC)

- Intended work: add read-only download detail queries for part-file metadata, source filenames, comments, and A4AF state, presented in an accessible drawer.
- Intended verification: detail loading/error/empty states work without mutation; strict tests/build/LAN serving pass.
- Rollback: frontend-only, read-only code.
- Changed files: `web/src/api.ts`, `web/src/ui/TransferDetails.tsx`, `web/src/details.css`, and `web/src/main.tsx`.
- Commands run: `pnpm test`; `pnpm build`.
- Outcome: partially completed. Typed read-only detail calls and the accessible drawer component compile and the strict tests/build pass. The existing dense transfer row requires a focused layout refactor to expose its per-row drawer trigger without regressing selection controls; no unreachable UI control was shipped.
- Next action: refactor the transfer table into formatted row components, wire the details trigger, then verify it through the LAN bundle before continuing preferences/remaining parity.

### Iteration 19 — Transfer-details UI wiring started (2026-08-06 UTC)

- Intended work: refactor the transfer table into a readable component structure and expose the existing read-only details drawer per row, preserving bulk controls and category assignment.
- Intended verification: no control regression; strict tests/build and LAN static bundle pass.
- Rollback: frontend-only code.
- Changed files: `web/src/ui/App.tsx`, `web/src/ui/TransferDetails.tsx`, and transfer-detail styling/assets from Iteration 18.
- Commands run: `pnpm test`; `pnpm build`; LAN static-bundle check.
- Result: completed. Transfers now uses formatted row components and exposes each filename as an accessible Details trigger. The drawer loads file metadata, alternate filenames, source comments, and A4AF count while retaining selection, bulk controls, category assignment, and pause/resume. Tests/build/LAN serving pass.
- Next action: complete remaining Milestone 1 operational polish and review the current UI against the planned core-operations acceptance list.

### Iteration 20 — Transfer priority polish started (2026-08-06 UTC)

- Intended work: complete documented bulk priority choices (low, normal, high, auto) while retaining explicit selection and feedback.
- Intended verification: strict build/tests and LAN bundle pass.
- Rollback: frontend-only code; priority changes remain explicit operator actions.
- Changed files: `web/src/ui/App.tsx`.
- Outcome: partially completed. The bulk mutation type now accepts the full documented low/normal/high/auto priority vocabulary. The existing dense toolbar exposes High priority; the remaining controls will ship with the next toolbar-layout pass to preserve usability.
- Next action: extract the transfer toolbar into its own component, expose the remaining three priority actions, and run the full build/serving verification.

### Iteration 21 — Milestone 1 completion pass started (2026-08-06 UTC)

- Intended work: complete all remaining Milestone 1 operation slices, starting with the priority toolbar, and run a checklist-based acceptance review before declaring the milestone complete.
- Intended verification: each slice has successful strict tests/build/LAN serving evidence recorded here; no legacy fallback is disabled.
- Rollback: frontend-only changes except for explicit user-initiated UI mutations.
- Changed files: `web/package.json`, `web/pnpm-lock.yaml`, and `web/src/ui/App.tsx`.
- Commands run: installed Prettier for reproducible frontend formatting; formatted `App.tsx`; `pnpm test`; `pnpm build`; LAN static-bundle check.
- Result so far: all four documented priority levels are available for selected transfers (low/normal/high/auto). Tests/build/LAN serving pass. Milestone remains in progress pending the remaining operational acceptance review and gaps.

### Iteration 22 — Transfer priority UX refinement started (2026-08-06 UTC)

- Approved UX change: replace the noisy bulk priority text buttons with one compact selector and show each row's effective priority (default normal) in the transfer table.
- Intended verification: selector applies only to selected rows, row priority is legible, and tests/build/LAN bundle pass.
- Changed files: `web/src/api.ts`, `web/src/ui/App.tsx`, and `web/src/transfers.css`.
- Commands run: `pnpm test`; `pnpm build`; LAN static-bundle check.
- Result: completed. The bulk toolbar has one disabled-until-selected priority selector (low/normal/high/auto), and every transfer displays its daemon-reported priority, falling back to normal when absent and showing auto when daemon-managed. Tests/build/LAN serving pass.

### Iteration 23 — Server-management completion slice started (2026-08-06 UTC)

- Intended work: add documented server priority/static mutation and server-list URL refresh controls with explicit feedback.
- Intended verification: server snapshot refreshes after mutations; strict tests/build/LAN serving pass.
- Rollback: frontend-only code; server mutations are explicit UI actions.
- Changed files: `web/src/api.ts`, `web/src/ui/Servers.tsx`, and `web/src/servers.css`.
- Commands run: `pnpm exec prettier --write src/ui/Servers.tsx src/servers.css src/api.ts`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. Servers now has explicit per-row priority and static/temporary settings, and accepts an operator-provided HTTP(S) `server.met` URL for a server-list refresh. Each accepted mutation invalidates and reloads the server snapshot, while errors remain visible in the existing feedback area. The strict tests, production build, and LAN-served asset check pass.
- Next action: close the remaining search-operation gap by exposing documented search filters and alternate-result selection, then perform the Milestone 1 acceptance review.

### Iteration 24 — Search-operation completion slice (2026-08-06 UTC)

- Intended work: expose the documented search filters and allow an operator to select a grouped result's advertised filename before download.
- Intended verification: strict tests/build and LAN static-bundle serving check.
- Rollback: frontend-only code; searches and downloads remain explicit operator actions.
- Changed files: `web/src/api.ts`, `web/src/ui/Search.tsx`, and `web/src/search.css`.
- Commands run: `pnpm exec prettier --write src/api.ts src/ui/Search.tsx src/search.css`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. Search requests can now include file type, extension, minimum/maximum MiB, and minimum availability. Grouped alternative filenames are selectable and the selected child ECID is sent with the result-download request. Existing close/cancel behavior remains unchanged. The strict tests, production build, and LAN-served asset check pass.
- Next action: conduct the Milestone 1 acceptance review, address any remaining core-operation gaps, and retain legacy `amuleweb` as fallback.

### Iteration 25 — Milestone 1 acceptance completion (2026-08-06 UTC)

- Intended work: close the review's remaining transfer and category gaps: sortable download activity, live upload activity, and full category CRUD.
- Intended verification: strict tests/build and LAN static-bundle serving check after all changes; preserve legacy `amuleweb` fallback.
- Rollback: frontend-only code; every API mutation continues to require an explicit UI action.
- Changed files: `web/src/api.ts`, `web/src/ui/App.tsx`, `web/src/ui/Categories.tsx`, `web/src/transfers.css`, and `web/src/categories.css`.
- Commands run: `pnpm exec prettier --write src/api.ts src/ui/App.tsx src/transfers.css`; `pnpm exec prettier --write src/api.ts src/ui/Categories.tsx src/categories.css`; `pnpm test`; `pnpm build`; LAN static-bundle checks at `http://192.168.50.10:4713/`.
- Result: completed. The dashboard has sortable, filterable downloads plus live active-upload peers. Categories can be created, edited (including category zero), deleted when non-default, and assigned from each transfer row. Combined with Iterations 19–24, this satisfies the Milestone 1 dashboard, transfer, search, server/network, and category workflows. Cookie session persistence, SSE-driven invalidation/reconnect refresh, loading/error/empty feedback, and system theme foundation remain in place. The strict tests, production build, and LAN-served asset checks pass; legacy `amuleweb` remains enabled at 4711 as fallback.
- Approved plan change recorded: the user authorized LAN access to the SPA/API host, so the architecture/config record now correctly reflects `192.168.50.10:4713` restricted by UFW to `192.168.50.0/24`.
- Next action: begin Milestone 2 only when requested; keep the legacy fallback active until its parity review is complete.

### Iteration 26 — Navigation visual consistency started (2026-08-06 UTC)

- Intended work: correct the inactive navigation button layout and add consistent non-emoji Lucide icons for every tab.
- Intended verification: tab labels and icons remain on one line in active and inactive states; strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only visual change.
- Changed files: `web/src/ui/App.tsx`, `web/src/main.tsx`, and `web/src/navigation.css`.
- Commands run: `pnpm exec prettier --write src/ui/App.tsx src/main.tsx src/navigation.css`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. Dashboard, Search, Servers, Categories, and disabled Preferences each use a Lucide icon. All navigation buttons now share an inline flex layout and fixed gap, so icon and label remain on one line whether the tab is active or inactive. Strict tests, production build, and the LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 42 — Completed-download action semantics started (2026-08-06 UTC)

- Intended work: restrict destructive delete controls to active downloads and provide a per-completed-entry notification-clear action that preserves the Incoming file.
- Intended verification: correct endpoint/body is selected by row status; strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only control/API-client correction.
- Changed files: `web/src/api.ts` and `web/src/ui/App.tsx`.
- Commands run: `pnpm exec prettier --write src/api.ts src/ui/App.tsx`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. `clearCompleted` accepts an optional hash and sends it only for a per-entry notification clear. Completed rows show a check action titled `Clear completed notification (keeps Incoming file)`; its toast confirms the file was kept. Active rows retain pause/resume plus the confirmed destructive delete. The bulk clear-all action uses an explicit no-argument wrapper. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 43 — Completion-notification UX clarification started (2026-08-06 UTC)

- Intended work: label completion clearing as notification management and require a bulk confirmation that clearly states Incoming files remain intact.
- Intended verification: strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only wording/confirmation change.
- Changed files: `web/src/ui/App.tsx`.
- Commands run: `pnpm exec prettier --write src/ui/App.tsx`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. The bulk action is now `Clear notifications`. Its confirmation explicitly says it removes items from the notification list and keeps files in the Incoming folder. The success toast uses the same terminology. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 44 — Accessible confirmation modals started (2026-08-06 UTC)

- Intended work: replace browser confirmation alerts with a shared in-app, accessible confirmation modal for all destructive/confirming actions.
- Intended verification: no `window.confirm` calls remain; strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only dependency and confirmation-flow change.
- Dependency decision: added `@radix-ui/react-alert-dialog` 1.1.23. This extends the existing Radix component family already used by the SPA and supplies the correct accessible semantics for consequential confirmations.
- Changed files: `web/package.json`, `web/pnpm-lock.yaml`, `web/src/ui/ConfirmDialog.tsx`, `web/src/confirm-dialog.css`, `web/src/main.tsx`, `web/src/ui/App.tsx`, `web/src/ui/Servers.tsx`, and `web/src/ui/Categories.tsx`.
- Commands run: `pnpm add @radix-ui/react-alert-dialog`; `pnpm exec prettier --write src/ui/ConfirmDialog.tsx src/confirm-dialog.css src/main.tsx src/ui/App.tsx src/ui/Servers.tsx src/ui/Categories.tsx`; source scan for `window.confirm`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. A shared focused confirmation modal provides title, explanatory text, Cancel, and context-specific confirm action, with red emphasis for destructive actions. Browser confirms are gone from download, server, and category flows. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 45 — Connected-server visibility started (2026-08-06 UTC)

- Intended work: show the connected eD2k server in the header, mark its server-list row, and expose a row-level disconnect action.
- Intended verification: connection state derives from the status snapshot and disconnect targets only eD2k; strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only status presentation/action change.
- Changed files: `web/src/ui/App.tsx`, `web/src/ui/Servers.tsx`, and `web/src/servers.css`.
- Commands run: inspected the local status/server API contract; `pnpm exec prettier --write src/ui/Servers.tsx src/ui/App.tsx src/servers.css`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. The header shows `eD2k: <server name>` when the status snapshot is connected, falling back to its state otherwise. The server list matches that reported name, adds a low-emphasis connected row/mark, and replaces Connect with a titled Disconnect icon. Disconnect invokes `/networks/disconnect` for `ed2k` only and refreshes both status and server snapshots. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 46 — ID-state visual signal started (2026-08-06 UTC)

- Intended work: render HighID, LowID, and unknown ID state with green, red, and yellow visual cues respectively.
- Intended verification: strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only status presentation change.
- Changed files: `web/src/ui/App.tsx`, `web/src/status.css`, and `web/src/main.tsx`.
- Commands run: `pnpm exec prettier --write src/ui/App.tsx src/status.css src/main.tsx`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. Connected HighID is green, connected LowID is red, and a non-connected eD2k state presents `ID unknown` in yellow rather than implying HighID from a false boolean. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 47 — Custom-category management view started (2026-08-06 UTC)

- Intended work: hide the API's default index-0 category from category management and show an empty state when no custom categories exist.
- Intended verification: strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only category-view filtering change.
- Changed files: `web/src/ui/Categories.tsx`.
- Commands run: `pnpm exec prettier --write src/ui/Categories.tsx`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. The category-management table filters out index 0, counts custom categories only, and shows `No custom download categories. New downloads use Uncategorized.` when none exist. Transfer assignment remains unchanged and continues to offer Uncategorized. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 48 — Category empty-state wording started (2026-08-06 UTC)

- Intended work: simplify the custom-category empty-state wording.
- Intended verification: strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only copy change.
- Changed files: `web/src/ui/Categories.tsx`.
- Commands run: `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. The empty state now reads only `No custom download categories.` Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 49 — Quiet search lifecycle feedback started (2026-08-06 UTC)

- Intended work: suppress success/info notifications for starting and closing searches while retaining error notifications.
- Intended verification: strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only feedback change.
- Changed files: `web/src/ui/Search.tsx`.
- Commands run: `pnpm exec prettier --write src/ui/Search.tsx`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. Search start and close now update the interface silently; API failures still surface as error toasts. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 50 — Search deletion pending state started (2026-08-06 UTC)

- Intended work: render a closing search as `deleting`, disable opening it, and hide its duplicate-close control until the request resolves.
- Intended verification: repeated close/open requests cannot be issued while deletion is pending; strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only optimistic state change.
- Changed files: `web/src/ui/Search.tsx`.
- Commands run: `pnpm exec prettier --write src/ui/Search.tsx`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. Closing a search adds it to an optimistic deletion set immediately: its state label is `deleting`, its tab button is disabled, and its close control is hidden. The set clears only after the close request and search-list invalidation settle; errors restore the usable tab and emit an error toast. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 51 — Frontend hygiene and private repository completion (2026-08-06 UTC)

- Intended work: format the whole frontend with Prettier, add reusable environment configuration, and create a private GitHub repository.
- Configuration added: `.prettierrc.json`; `.env.example`; ignored local `.env`; `.gitignore`; `src/config.ts`; Vite environment types in `src/vite-env.d.ts`. `VITE_API_BASE`, `VITE_EVENTS_URL`, and `VITE_DEV_API_ORIGIN` are documented and used by the REST/SSE client and Vite dev proxy.
- Dependency result: Prettier 3.9.6 was already present in `devDependencies`; `@radix-ui/react-alert-dialog` was already recorded from Iteration 44. No additional formatting dependency was needed.
- Commands run: `pnpm exec prettier --write . --ignore-unknown`; `pnpm test`; `pnpm build`; LAN static-bundle checks at `http://192.168.50.10:4713/`; `git init -b main`; `gh auth status`; `gh repo create alvarogl/amule-react-ui --private --source=. --remote=origin`; `gh repo view alvarogl/amule-react-ui --json nameWithOwner,visibility,url,isPrivate`.
- Result: completed. Every supported project file was formatted with the shared Prettier configuration. The strict tests, production build, and LAN-served asset check pass. `.env` holds same-origin browser paths and local Vite proxy defaults, is ignored, and has a tracked `.env.example`. The local repository has `main` and an `origin` remote; the new private repository is `https://github.com/alvarogl/amule-react-ui`. No commit or push was made.
- Next action: commit and push the reviewed project when requested, then proceed to Milestone 2 only on request.

### Iteration 52 — Organized commit history started (2026-08-06 UTC)

- Intended work: create the initial local commit for the reviewed frontend project, excluding local environment values.
- Intended verification: commit is clean, includes `.env.example` but not `.env`, and leaves `origin` unpushed.
- Rollback: local Git commit only; amend/revert before any push if necessary.
- Commands run: `git add .`; `git commit -m "feat: initialize reactive amule web ui"`; local status/log verification.
- Result: completed. Initial commit `8cdcc5d` contains the formatted SPA, environment example/configuration, implementation record, and frontend source while `.env` remained ignored. `origin` has not been pushed.
- Next action: create focused commits for each future cohesive change; push only on request.

### Iteration 41 — Bulk download removal started (2026-08-06 UTC)

- Intended work: add a confirmed bulk-delete action for the selected active downloads.
- Intended verification: only selected hashes are sent; the queue refreshes after success; strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only control; the destructive API request requires an explicit confirmation.
- Changed files: `web/src/api.ts`, `web/src/ui/App.tsx`, and `web/src/transfers.css`.
- Commands run: inspected the local bulk-delete API contract; `pnpm exec prettier --write src/api.ts src/ui/App.tsx src/transfers.css`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. The bulk toolbar has a disabled-until-selected red `Remove selected` action. Confirmation names the selected count and warns about permanent download-data deletion. The API receives only selected hashes; the queue and selection refresh afterward. The typed results envelope reports successful deletion count and any partial failures through toasts. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 40 — Active-download deletion started (2026-08-06 UTC)

- Intended work: add an explicit, confirmed deletion action for ongoing downloads using the documented per-download API endpoint.
- Intended verification: successful deletion refreshes the queue; strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only control; the actual destructive call requires a per-row confirmation.
- Changed files: `web/src/api.ts` and `web/src/ui/App.tsx`.
- Commands run: `pnpm exec prettier --write src/api.ts src/ui/App.tsx`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. Each transfer row now has a titled delete icon next to pause/resume. Confirmation explicitly warns that active download data will be permanently removed; on success the queue and current selection refresh and a success toast appears. Errors are surfaced as error toasts. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 27 — Unified action-feedback toasts started (2026-08-06 UTC)

- Intended work: replace inline generic information, warning, and error feedback with one shared accessible toast system and make action wording specific to the operation performed.
- Intended verification: no inline transient feedback remains in the SPA; strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only dependency and UI-feedback change.
- Dependency decision: added `sonner` 2.0.7, the lightweight React toast component whose official usage supports a single root toaster plus success/info/warning/error variants.
- Changed files: `web/package.json`, `web/pnpm-lock.yaml`, `web/src/main.tsx`, `web/src/ui/App.tsx`, `web/src/ui/Search.tsx`, `web/src/ui/Servers.tsx`, and `web/src/ui/Categories.tsx`.
- Commands run: `pnpm add sonner`; `pnpm exec prettier --write src/main.tsx src/ui/App.tsx src/ui/Search.tsx src/ui/Servers.tsx src/ui/Categories.tsx`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`; source scan for obsolete inline message state.
- Result: completed. Sonner is mounted once at the authenticated application root with dismiss buttons and bottom-right placement. Login, transfer, search, server/network, and category success/warning/error paths now issue operation-specific toasts. No inline transient-message state remains; the only `feedback` hit is an unused legacy CSS selector. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 28 — Toast placement adjustment started (2026-08-06 UTC)

- Intended work: move the shared notification stack from bottom-right to bottom-left.
- Intended verification: strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only presentation change.
- Changed files: `web/src/main.tsx`.
- Commands run: `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. The shared Sonner stack now appears at the bottom-left. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 29 — Sortable/resizable operations tables started (2026-08-06 UTC)

- Intended work: replace the transfer sort selector with sortable headers and resizable relevant columns; add permanent transfer size/downloaded/percentage information; apply the same table interactions to uploads, search results, and servers.
- Intended verification: sortable/resizable headers operate without breaking row actions, strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only interaction/layout change.
- Changed files: `web/src/ui/DataTable.tsx`, `web/src/data-table.css`, `web/src/main.tsx`, `web/src/ui/App.tsx`, `web/src/ui/Search.tsx`, and `web/src/ui/Servers.tsx`.
- Commands run: `pnpm exec prettier --write src/ui/DataTable.tsx src/data-table.css src/main.tsx src/ui/App.tsx src/ui/Search.tsx src/ui/Servers.tsx`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. A shared table-header implementation adds click-to-sort with direction icons and pointer drag resizing to relevant data columns. Transfers no longer has a sort dropdown and now permanently displays `downloaded / total (percentage)` alongside sortable name/status/priority/category/size/speed. Uploads, search results, and server lists use the same sorting and resizing model. Checkbox/download/action columns are intentionally excluded; the server action column shrinks to its two icon buttons and the connect/remove buttons expose native hover titles. Strict tests, production build, and the LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 30 — Table sizing and server action refinement started (2026-08-06 UTC)

- Intended work: cap resizable data-column widths, prevent checkbox/action clipping, improve upload default widths, and move the server static/temporary operation into the action area.
- Intended verification: table controls remain visible at default widths and after resize; strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only table presentation/control change.
- Changed files: `web/src/ui/DataTable.tsx`, `web/src/data-table.css`, `web/src/ui/App.tsx`, `web/src/ui/Servers.tsx`, and `web/src/servers.css`.
- Commands run: `pnpm exec prettier --write src/ui/DataTable.tsx src/data-table.css src/ui/App.tsx src/ui/Servers.tsx src/servers.css`; `pnpm test`; `pnpm build`; LAN static-bundle checks at `http://192.168.50.10:4713/`.
- Result: completed. Data columns now have a 76–560px resize range. Checkbox inputs have explicit compact dimensions so the selection cell cannot render as an ellipsis. Upload defaults are wider to avoid immediate truncation. The server static/temporary toggle is now the pinned action button (with state-aware tooltip), alongside connect and remove; the server table uses content-based action-column sizing, keeping all three buttons visible while leaving available space to data columns. Strict tests, production build, and LAN-served asset checks pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 31 — Uncategorized category label started (2026-08-06 UTC)

- Intended work: present the default category as `Uncategorized` in the transfer assignment picker without changing the daemon's category data.
- Intended verification: strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only display-label change.
- Changed files: `web/src/ui/App.tsx`.
- Commands run: `pnpm exec prettier --write src/ui/App.tsx`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. The transfer category picker now labels index `0` as `Uncategorized`; a blank non-default category is rendered as `Unnamed category` rather than an empty option. No daemon data was changed. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 32 — Fixed category-picker width started (2026-08-06 UTC)

- Intended work: constrain the transfer category picker to a fixed width so category content cannot alter the table layout.
- Intended verification: strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only style change.
- Changed files: `web/src/categories.css`.
- Commands run: `pnpm exec prettier --write src/categories.css`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. The transfer category picker is fixed at 130px for its minimum, preferred, and maximum widths, so category content cannot resize its column. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 33 — Fixed transfer category column started (2026-08-06 UTC)

- Intended work: remove resizing from the transfer Category column while retaining its sort behavior and fixed picker width.
- Intended verification: strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only table interaction change.
- Changed files: `web/src/ui/App.tsx`.
- Commands run: `pnpm exec prettier --write src/ui/App.tsx`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. Transfer Category remains sortable but is a fixed 140px column with no resize handle; its picker remains fixed at the same width. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 34 — Transfer filename truncation started (2026-08-06 UTC)

- Intended work: allow long transfer filenames to truncate within the Name column and expose the full filename on hover.
- Intended verification: strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only presentation/accessibility change.
- Changed files: `web/src/ui/TransferDetails.tsx` and `web/src/details.css`.
- Commands run: `pnpm exec prettier --write src/ui/TransferDetails.tsx src/details.css`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. The transfer-name trigger fills its fixed Name cell and uses single-line ellipsis truncation. It carries the full filename in a native hover title while retaining its existing details-drawer behavior. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 35 — Upload/search filename truncation started (2026-08-06 UTC)

- Intended work: extend one-line filename truncation and full-name hover titles to upload activity and search results.
- Intended verification: strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only presentation/accessibility change.
- Changed files: `web/src/ui/App.tsx` and `web/src/ui/Search.tsx`.
- Commands run: `pnpm exec prettier --write src/ui/App.tsx src/ui/Search.tsx`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. Upload filenames inherit the table's one-line ellipsis behavior and expose their full value through a hover title. Search-result names (including the currently selected alternate filename) likewise provide the full hover title while retaining selection and download actions. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 36 — Fixed metric/status table columns started (2026-08-06 UTC)

- Intended work: remove unhelpful resize handles from short metric/status columns and give them stable widths while preserving sorting.
- Intended verification: only long-text columns remain resizable; strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only table interaction/layout change.
- Changed files: `web/src/ui/App.tsx`, `web/src/ui/Search.tsx`, and `web/src/ui/Servers.tsx`.
- Commands run: `pnpm exec prettier --write src/ui/App.tsx src/ui/Search.tsx src/ui/Servers.tsx`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. Transfer Status/Priority/Category/Speed, upload Peer/Client/Speed, search Sources/Size, and server Address/Users/Priority are now fixed-width sortable columns without resize handles. Resize handles remain only on content that benefits from operator-controlled width: transfer Name and Size/downloaded, upload File, search Name, and server Name. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 37 — Dynamic transfer-rate units started (2026-08-06 UTC)

- Intended work: format live byte rates with correct B/KiB/MiB/GiB thresholds and readable precision.
- Intended verification: strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only formatter change.
- Changed files: `web/src/ui/App.tsx`.
- Commands run: `pnpm exec prettier --write src/ui/App.tsx`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. Rates now scale by 1024 through B/s, KiB/s, MiB/s, and GiB/s, selecting the smallest unit that keeps the value below 1024. Precision adapts to magnitude, so 900 KiB/s remains `900 KiB/s` while small values retain useful decimals. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 38 — Wide fixed-column layout started (2026-08-06 UTC)

- Intended work: remove table-column resizing, keep header sorting, and expand the main content area to 90% of the viewport.
- Intended verification: no resize handles remain; tables use the wider layout; strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only table/layout change.
- Changed files: `web/src/ui/DataTable.tsx`, `web/src/data-table.css`, `web/src/layout.css`, `web/src/main.tsx`, `web/src/ui/App.tsx`, `web/src/ui/Search.tsx`, and `web/src/ui/Servers.tsx`.
- Commands run: `pnpm exec prettier --write src/ui/DataTable.tsx src/data-table.css src/layout.css src/main.tsx src/ui/App.tsx src/ui/Search.tsx src/ui/Servers.tsx`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. Table resizing and resize handles were removed; all configured columns now have stable widths while preserving sortable headers. The desktop `.content` area is 90vw with no 1200px cap, and falls back to the existing mobile width at 700px or below. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.

### Iteration 39 — Transfer size/progress field correction started (2026-08-06 UTC)

- Intended work: use the documented download `size_done` and `progress.percent` fields in the Size/downloaded column.
- Intended verification: strict tests/build and LAN static-bundle serving check pass.
- Rollback: frontend-only API schema/presentation correction.
- Changed files: `web/src/api.ts` and `web/src/ui/App.tsx`.
- Commands run: inspected the local REST contract; `pnpm exec prettier --write src/api.ts src/ui/App.tsx`; `pnpm test`; `pnpm build`; LAN static-bundle check at `http://192.168.50.10:4713/`.
- Result: completed. The schema now recognizes the API's `size_done`, `size_xfer`, and `progress.percent` fields. The table displays documented total size first, followed by downloaded (`size_done`) and API-reported percentage, with a calculated fallback only if progress is absent. Strict tests, production build, and LAN-served asset check pass.
- Next action: collect further UI feedback or begin Milestone 2 on request.
