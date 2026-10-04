# PTE

Free-first PTE Academic study and practice web application.

## Canonical project truth

- `AGENTS.md` — repository operating rules and authority boundaries.
- `docs/PRODUCT.md` — product intent, MVP invariants, and explicit non-goals.
- `docs/STUDY.md` — Study / Coach product behavior, data, recommendation, and ingestion boundaries.
- `docs/ARCHITECTURE.md` — target-owned architecture and ownership boundaries.
- `docs/STACK.md` — canonical V1 framework, provider, browser-capability, deployment, and credential inventory.
- `docs/ENGINEERING_RULES.md` — target-owned engineering rules and exact external HOW provenance.
- `.agent/tasks/` — Foundation protocol-v3 task authority, reports, and reviews.

## Repository topology

This repository is **MAIN_ONLY**.

- Canonical branch: `main`.
- Do not create feature, staging, release, backup, recovery, or temporary branches.
- Use ordinary non-force fast-forward publication only.
- GitHub `main` is canonical; local working copies are subordinate mirrors.
- Begin consequential work from a clean local checkout. Pre-existing unrelated dirty or untracked state is a blocker, not something to stash/adopt/clean silently.

## Local environment

Use `.env.example` as the complete committed blank inventory. `docs/STACK.md` owns each variable's lifecycle, exposure class, acquisition locator, and runtime/operator boundary.

The only application values required now are the public Supabase browser contract:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Deferred server/provider and operator/headless variables should remain blank until their owning feature/workflow is separately authorized. Never commit real secrets or place a server/operator secret in a `NEXT_PUBLIC_*` variable.

Implementation work is authorized by exact task authority. Product and architecture truth remain owned by this repository; Foundation governs roles/task lifecycle; ECC may provide exact-pinned reusable HOW but never overrides PTE product truth or Foundation governance.
