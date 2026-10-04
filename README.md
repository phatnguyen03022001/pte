# PTE

Free-first PTE Academic study and practice web application.

## Canonical project truth

- `AGENTS.md` — repository operating rules and authority boundaries.
- `docs/PRODUCT.md` — product intent, MVP invariants, and explicit non-goals.
- `docs/STUDY.md` — Study / Coach product behavior, data, recommendation, and ingestion boundaries.
- `docs/ARCHITECTURE.md` — target-owned architecture and ownership boundaries.
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

Use `.env.example` as the committed contract and copy it to ignored `.env.local` for real local values.

Only public Supabase browser values belong in the current client-facing contract:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Never commit real secrets or place a Supabase secret/service-role key in a `NEXT_PUBLIC_*` variable.

Implementation work is authorized by exact task authority. Product and architecture truth remain owned by this repository; Foundation governs roles/task lifecycle; ECC may provide exact-pinned reusable HOW but never overrides PTE product truth or Foundation governance.
