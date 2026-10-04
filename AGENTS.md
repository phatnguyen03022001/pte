# PTE Repository Instructions

These instructions apply to the entire repository.

## Authority

- PTE owns product behavior, architecture, domain rules, stack decisions, repository-native commands, and delivery conventions.
- Agent Foundation owns Architect/Executor governance and task/report/review lifecycle. Each task binds one exact Foundation revision.
- A canonical `.agent/tasks/<TASK-ID>/task.yaml` owns bounded task WHAT / BOUNDARY / PROOF.
- Exact-pinned ECC content is reusable engineering HOW only. An upstream `MUST` does not override PTE product truth, Foundation governance, or the active task.
- Do not activate ECC orchestrators, hooks, role systems, installers, global configuration, session/memory systems, or alternate governance.

## Git topology

This repository is **MAIN_ONLY**.

- The only working/stable branch is `main`.
- Never create feature, staging, release, backup, recovery, or temporary branches.
- Never force-push or rewrite canonical history.
- Publish only ordinary non-force fast-forwards to `main`.
- Do not use branch creation as a testing, recovery, or isolation mechanism.
- GitHub `main` is canonical. Local checkouts are subordinate mirrors and must be reconciled safely before mutation.

This policy may change only through an explicit current operator decision.

## Working-tree hygiene

Consequential execution starts only from a clean, correctly bound checkout.

Before mutation, require:

- exact repository identity and `origin` binding;
- current branch exactly `main`;
- local/canonical base identity required by the active task;
- clean tracked worktree and index;
- no unrelated untracked files;
- no in-progress merge/rebase/cherry-pick/revert or equivalent Git operation.

If pre-existing dirt, unrelated untracked state, identity drift, or Git-operation state exists, stop. Do not reset, clean, stash, rebase, adopt, overwrite, or delete it to make the task proceed.

During execution, only task-authorized paths/effects may become dirty. Before qualifying a candidate and again at terminal publication closure, require a clean worktree/index with no unrelated residue.

Real environment values belong in ignored local files such as `.env.local`; they must not be staged or committed.

## Architecture

- Prefer the smallest sufficient modular monolith.
- Prefer feature/domain ownership over global technical-layer buckets.
- Feature-based is an architectural preference, not a predetermined folder tree.
- Do not create global `scoring`, `attempts`, `exercises`, or `admin` owners by default. Keep behavior with the narrowest real domain owner; extract shared capabilities only after real reuse appears.
- Prefer delete → merge → simplify → adapt/reuse → small new abstraction.
- No Redis, queues, microservices, event buses, generic repository layers, or speculative scale machinery without a current requirement and Architect authority.

See `docs/PRODUCT.md`, `docs/STUDY.md`, and `docs/ARCHITECTURE.md` for durable target truth.

## Environment contract

- `.env.example` is committed and contains placeholders/documentation only.
- Real local values go in ignored `.env.local`.
- Current browser-visible Supabase contract is limited to `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Never place secret/service-role/private credentials in `NEXT_PUBLIC_*` variables.
- Do not invent new environment variables or secret requirements outside task/product authority.

## Implementation boundary

Executor owns local HOW inside a positive task boundary: function decomposition, small file decomposition, local helpers, internal naming when not pinned, and test-fixture mechanics.

Executor must stop rather than inventing or changing:

- product behavior or feature scope;
- data ownership or retention;
- trust/security boundaries;
- external service usage or paid API usage;
- dependency topology outside explicit task authority;
- public contracts;
- architecture/topology;
- repository Git policy.

## Engineering rules

Use `docs/ENGINEERING_RULES.md` as the target-owned effective rule owner. External examples and rules remain advisory unless explicitly adopted there or by a scoped task.

## Language

- Communicate with the operator in Vietnamese.
- Persist engineering artifacts, docs, code comments, commit messages, task/report/review artifacts, and release text in English unless product localization requires otherwise.

## Verification

Use repository-native commands after they exist. Do not guess missing commands or treat a passing generic test as proof of product behavior. Map every task acceptance criterion to observable evidence.
