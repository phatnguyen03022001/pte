# PTE Architecture

## Architecture style

PTE V1 is a **modular monolith**.

Target V1 application stack is a Next.js App Router + React + TypeScript modular monolith, with Supabase for Auth/Postgres/RLS-backed structured data, Vercel as the initial deployment target, and browser-local capabilities for microphone capture and speech-to-text where speaking features require them.

`docs/STACK.md` is the canonical complete matrix for exact installed versions, authorized-deferred packages/providers, browser-native capabilities, deployment status, credential names/classes, and official acquisition/documentation locators. This document owns architecture; it intentionally does not duplicate that matrix.

Do not add a separate backend service merely to mirror logic already safely expressible through Next.js/Supabase boundaries.

## Ownership model

Prefer vertical domain ownership. The following names describe semantic ownership candidates, not a mandatory directory tree:

- `study` — strategies, templates, skill guides, common mistakes, playbooks, curated plans, and learner-facing Study presentation/query behavior;
- `practice` — practice-session orchestration and exercise/response lifecycle;
- `speaking` — speaking-specific capture, local STT, metrics, and speaking-owned scoring;
- `listening` — listening-specific interaction and scoring;
- `reading` — reading-specific interaction and scoring;
- `writing` — writing-specific interaction and scoring;
- `mock` — future full-test orchestration, timing, and section transitions;
- `progress` — future learner history/read models/analytics.

A concrete feature may be nested under `practice` or own a top-level feature boundary according to actual cohesion in the implementation. Architect reviews material ownership; Executor chooses local physical decomposition when the task does not pin it.

Do not create top-level global owners named `scoring`, `attempts`, `exercises`, `content-management`, or `admin` merely because those nouns exist. Keep them with the narrowest feature/domain owner until genuine cross-feature semantics justify extraction.

ChatGPT authoring is an operational workflow over authorized Supabase surfaces. It is not a code feature named `admin` or `content-management`.

## Study ↔ Practice integration

Study and Practice are separate product owners connected through shared domain identifiers rather than direct feature coupling.

The semantic contract is:

```text
Practice result
→ weakness/subskill evidence
→ Study recommendation lookup
→ Study content
→ optional focused drill
→ Practice again
```

Practice owns attempts/results and derived weakness evidence.

Study owns learning content and content-to-subskill relevance.

A Study item may map to multiple subskills, and a subskill may map to multiple Study items. Preserve that many-to-many meaning when the schema is implemented.

V1 Study recommendations should be deterministic from stored evidence/mappings. Do not add an LLM, vector search, embeddings service, recommendation microservice, or other runtime AI machinery to connect the domains.

The detailed product contract is in `docs/STUDY.md`.

## Shared code

Shared code exists only for demonstrated reuse or a genuine cross-cutting boundary.

Expected examples may include:

- reusable UI primitives;
- Supabase client/server integration;
- narrowly shared validation/types;
- shared skill/subskill identifiers when both Study and Practice require them;
- generic browser capability adapters only after more than one feature needs them.

`shared` or `lib` must not become a dumping ground.

Do not make Study depend on Practice internals or Practice depend on Study UI code. Shared taxonomy/contracts belong in the narrowest neutral owner proven necessary by actual implementation.

## Server/client boundary

Default to server-side Next.js execution for data access and rendering where browser APIs are not required.

Use client components only for real client concerns such as:

- microphone/media APIs;
- browser-local STT;
- interactive state/event handlers;
- other browser-only capabilities.

Study content read/render paths should normally remain server-oriented unless a concrete interaction requires a client component.

Never place privileged database credentials in client code. Public Supabase browser credentials remain limited by backend authorization/RLS.

## Data boundaries

### Supabase

Supabase owns canonical structured application data. Schema evolution must be migration-backed once database schema work begins. Exposed user-data tables require task-specific RLS/security proof.

Conceptual Study structures are defined in `docs/STUDY.md`; they are not authorized migrations until a dedicated database/feature task.

### Study content

Study owns curated learning content. Initial conceptual ownership includes:

- Study content rows;
- Study-to-subskill mappings;
- content source/provenance metadata where relevant.

Learner Study state such as viewed/completed/bookmarked is a separate user-owned concern and must not be invented as part of content bootstrap.

### Learner audio

Learner audio follows the invariant in `PRODUCT.md`: ephemeral capture → local processing → structured text/metrics persistence → discard audio.

### External/reusable media

Supabase owns canonical structured media references, rights/provenance fields, and optional asset locators.

Cloudinary is optional content-media infrastructure for assets the project is authorized to persist. It does not own canonical structured state.

YouTube is reference/embed-only by default. Do not materialize YouTube audiovisual bytes into project storage without the required rights/approval. Any implementation using YouTube API data must revalidate current storage/refresh/display obligations.

Arbitrary web assets default to reference-only until reuse/storage rights are established.

There is no V1 autonomous crawler daemon or background ingestion system. ChatGPT/operator-driven bounded ingestion may populate structured references/content through authorized Supabase tooling.

### ChatGPT administration and authoring

ChatGPT teacher/admin/Study-author access is an external operational capability against authorized Supabase surfaces. It does not justify an in-app privileged admin credential or a V1 admin/CMS UI.

Core learner runtime behavior must not depend on ChatGPT/OpenAI availability.

## Scale policy

Forecasts define capacity observations and reversal triggers, not current topology.

Add caches, queues, services, recommendation infrastructure, or other distributed machinery only when a concrete current requirement or measured evidence proves the simpler architecture insufficient.

## Physical topology

Feature-based organization is preferred, but no fixed folder tree is canonical before implementation evidence exists. A plausible future shape may contain `study`, `practice`, and skill-specific owners, but this document does not pre-create those directories.

Task authority may pin a component boundary when material; otherwise Executor should choose the smallest structure consistent with these ownership rules and current repository patterns.
