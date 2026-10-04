# PTE Engineering Rules

## Authority and provenance

These are PTE-owned effective engineering rules. External HOW is advisory until explicitly accepted or adapted here or in an exact scoped task.

Current ECC source used for normalization:

- repository: `affaan-m/ECC`
- commit: `bf70150eb2df8070024e5bdf08e4aa08959e2735`
- role: reusable HOW only; no governance, task, mutation, dependency, installation, or product authority

Selected normalization sources:

- `skills/intent-driven-development/SKILL.md`
- `agents/code-architect.md`
- `agents/planner.md`
- `rules/common/coding-style.md`
- `rules/common/security.md`
- `rules/common/testing.md`
- `rules/typescript/coding-style.md`
- `rules/typescript/patterns.md`
- `rules/typescript/security.md`
- `rules/typescript/testing.md`
- `rules/react/coding-style.md`
- `rules/react/hooks.md`
- `rules/react/security.md`
- `rules/react/testing.md`

Unselected ECC siblings do not apply implicitly.

## Adopted meaning

### General

- KISS and YAGNI are governing implementation preferences.
- Prefer feature/domain cohesion over global type-based folders.
- Add abstractions only after a real repeated need or material boundary appears.
- Validate untrusted/user/external input at the relevant system boundary.
- Handle errors explicitly; do not silently swallow failures.
- Keep secrets out of source and browser bundles.
- Naming should reveal intent without explanatory comments.
- Preserve source/provenance when product content or media is externally derived.
- Discovery/reference ingestion and materializing third-party bytes are separate consequences and require separate authority/rights checks.

### TypeScript

- Exported/public contracts should have explicit useful types.
- Avoid `any` in application code; use `unknown` plus narrowing for untrusted values.
- Prefer literal unions to enums unless interoperability materially requires an enum.
- Do not add a validation dependency merely because ECC examples use one.

### React / Next.js

- Server Components are the default when browser capabilities or interactive client state are unnecessary.
- Add `"use client"` only at a real client boundary.
- Hooks follow React hook-order/dependency rules.
- Derived state should normally be computed rather than duplicated.
- Browser-only microphone/STT logic must stay behind a client boundary.
- UI tests should prove user-observable behavior rather than component internals.
- Deep Next.js behavior must follow the current official Next.js documentation for the repository's locked version; ECC React material is not a substitute for framework-version truth.
- Markdown or rich-text rendering must not create an XSS path. Prefer a renderer that escapes raw HTML by default; if raw HTML is ever allowed, sanitization and tests are required.
- YouTube playback, when authorized, must use currently supported official embed/player mechanisms rather than copied audiovisual bytes.

### Credential and runtime exposure

`docs/STACK.md` owns the canonical env/provider classification.

- `PUBLIC_BROWSER` values may be exposed intentionally, but browser visibility does not replace backend authorization/RLS.
- `SERVER_SECRET` values must never enter `NEXT_PUBLIC_*`, browser bundles, client logs, or client-delivered configuration.
- `OPERATOR_ONLY` credentials are for connected/headless/automation workflows and must not be consumed by learner application runtime code.
- Documenting an authorized-deferred credential does not activate a provider, install a dependency, authorize deployment, or grant data-retention/media-copy authority.

### Supabase

Supabase-specific implementation must be checked against current official Supabase documentation at the task where it matters.

Target-owned invariants already require:

- no service-role/secret key in public clients;
- RLS/security proof for exposed user-owned data;
- authorization based on actual ownership/permission, not merely an authenticated role;
- migration-backed schema evolution once schema work begins;
- privileged ChatGPT authoring/administration remains outside the learner browser credential boundary.

### Study / content ingestion

Study content is target-owned product content. External-source handling follows `docs/STUDY.md`.

For any ingestion task:

1. identify the source and intended use;
2. record provenance sufficient to reconstruct the source;
3. distinguish a reference/metadata record from persisted third-party media bytes;
4. verify reuse/storage rights before materializing media bytes;
5. store only the minimum structured metadata needed;
6. preserve nullable `asset_url` semantics — absence means reference-only, not ingestion failure;
7. re-check mutable platform policies at implementation time when a provider such as YouTube is involved.

YouTube is reference/embed-only by default. Do not download, import, cache, or store YouTube audiovisual copies without the required permission/rights. If using YouTube API Data, apply the then-current YouTube storage/refresh/display obligations rather than assuming indefinite cacheability.

Do not build a crawler daemon, scheduled ingestion pipeline, or generalized scraping framework merely because ChatGPT/operator-driven bounded ingestion exists.

## Adapted or rejected upstream guidance

The following upstream guidance is **not** a universal PTE requirement:

- 80% global coverage is not a release gate. Coverage is risk- and feature-proportional.
- TDD is useful HOW, not mandatory ceremony for every change.
- ECC's generic Repository Pattern example does not authorize a repository/data-access abstraction.
- Zod is not an automatic dependency; use an existing target-native validator or separately authorize a dependency when needed.
- "Rate limit every endpoint" is not adopted as a blanket rule; apply rate limiting where abuse/cost/security consequences justify it.
- Source-file/function length numbers are review heuristics, not mechanical acceptance criteria.
- Immutability is preferred where it improves correctness and reasoning; do not contort framework-native APIs solely to satisfy a generic slogan.

## Task-time loading

Load only rules relevant to the current scope.

Examples:

- auth/RLS/data mutation → Supabase security/database evidence;
- browser microphone/STT → browser/runtime plus relevant React/client rules;
- Study Markdown UI → React/accessibility/security/testing plus Study content contract;
- external media/content ingestion → provenance/rights/provider-policy evidence;
- database migration → Supabase/Postgres/security;
- ordinary small pure TypeScript change → only general/TypeScript rules needed.

Do not preload every security/database/reviewer/testing capability into every task.
