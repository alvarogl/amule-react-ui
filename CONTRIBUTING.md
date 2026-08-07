# Contributing

Thanks for improving the aMule React UI. This project is a browser client for aMule's `amuleapi`; it does not add a backend or communicate with the EC protocol directly.

## Local workflow

1. Use Node.js and the pnpm version declared in `package.json`.
2. Copy `.env.example` to `.env` and set only non-secret local endpoints.
3. Install dependencies with `pnpm install`.
4. Start Vite with `pnpm dev`, or run `pnpm build` to produce the static bundle.

Before opening a pull request, run:

```bash
pnpm format:check
pnpm lint
pnpm test
pnpm test:deployment
pnpm test:e2e
pnpm build
pnpm test:release
```

Install Chromium first when it is not already available:

```bash
pnpm exec playwright install --with-deps chromium
```

## Change guidelines

- Keep browser requests on the typed REST/SSE client and validate API data at the boundary.
- Keep authentication cookie-based. Never store passwords, session cookies, or tokens in browser storage or commit them to the repository.
- Treat download removal, clearing, and network-affecting changes as consequential actions: explain the effect, require confirmation where appropriate, and show clear error feedback.
- Keep responsive UI changes keyboard-accessible and use the established icon and Radix primitive patterns.
- Add or update focused tests for schema, state, formatting, filtering, and mutation behavior that changes.

## Pull requests

Use a focused branch and open a pull request targeting `main`. Fill in the pull-request template, keep commits coherent, and include a screenshot or short recording for material interface changes. Required checks validate formatting, linting, unit/integration tests, deployment/release packaging, and browser workflows.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).

## aMule compatibility

Check the local `docs/api/REFERENCE.md` before extending an API workflow. If behavior belongs in the daemon, web server, or API server rather than the SPA, report or discuss it with the [upstream aMule project](https://github.com/amule-org/amule).
