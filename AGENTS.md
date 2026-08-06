# Repository Guidelines

## Project Structure & Module Organization

This is a Vite, React, and TypeScript UI for aMule's `amuleapi` REST and SSE endpoints:

- `src/app/` contains application composition, React Query setup, and shell styles.
- `src/features/<feature>/` owns feature UI and styles (for example `search`, `servers`, and `transfers`).
- `src/shared/` contains cross-feature API code, query keys, realtime hooks, UI primitives, and utilities.

Place tests next to covered code as `*.test.ts`. Keep `.env` local; document non-secret settings in `.env.example`.

## Build, Test, and Development Commands

```bash
pnpm install       # install locked dependencies
pnpm dev           # start Vite and its local API proxy
pnpm format:check  # validate Prettier formatting
pnpm lint          # run ESLint on source and configuration
pnpm test          # run Vitest once
pnpm test:deployment # exercise the isolated deployment install/rollback flow
pnpm test:release    # validate deterministic release archive and checksum
pnpm build         # type-check and build dist/
```

Run format, lint, test, and build before every PR. `amuleapi` serves production `dist/`; Vite proxy settings are development-only.

## Coding Style & Naming Conventions

Use strict TypeScript, functional components, named exports, and Prettier defaults (two spaces, double quotes). Use `PascalCase.tsx` for components and `kebab-case.ts` for hooks/utilities. Import shared modules through `@/`. ESLint enforces core, TypeScript, React Hooks, and React Refresh rules. Keep Zod API parsing in `src/shared/api/`; do not access EC or add a backend.

## Testing Guidelines

Use Vitest for deterministic unit tests. Cover changed schemas, formatters, filters, mutations, and session/SSE edges. Name tests after the subject, for example `formatters.test.ts`; avoid live aMule dependencies.

## Commit & Pull Request Guidelines

Use focused Conventional Commit subjects: `feat:`, `fix:`, `refactor:`, `ci:`, `docs:`, or `chore:`. PRs explain impact, list validation, link issues, and include screenshots for material UI changes. Never commit credentials, cookies, runtime data, or `.env` files.

## Security & Configuration

Authentication is cookie-based; never persist passwords or tokens in browser storage. Keep production API paths relative and restrict LAN access with aMule/firewall settings.

## Agent Feedback & Continuous Improvement

Treat the newest explicit user instruction as the source of truth. After implementing and verifying recurring feedback, update this file in the same change when it creates a durable rule—for example, an agreed UI behavior, validation command, API boundary, or review practice.

Keep updates factual and concise. Never record temporary task notes, assumptions, credentials, personal data, or unverified preferences. If feedback conflicts with this guide, follow the user, explain the conflict, and revise the rule after confirmation.

Use this loop: understand feedback, make the smallest coherent change, verify it, record the lasting rule, and report the result. Ask before unresolved material product or security decisions.
