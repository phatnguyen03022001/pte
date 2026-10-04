# PTE Architecture

## Architecture style

PTE V1 is a **modular monolith**.

Current application stack:

- Next.js App Router;
- React;
- TypeScript;
- Supabase for Auth/Postgres/RLS-backed structured data;
- Vercel as the initial web deployment target;
- browser capabilities for microphone capture and local speech-to-text where speaking features require them.

Do not add a separate backend service merely to mirror logic already safely expressible through Next.js/Supabase boundaries.

## Ownership model

Prefer vertical domain ownership. The following names describe semantic ownership candidates, not a mandatory directory tree:

- `practice` — practice-session orchestration and exercise/response lifecycle;
- `speaking` — speaking-specific capture, local STT, metrics, and speaking-owned scoring;
- `listening` — listening-specific interaction and scoring;
- `reading` — reading-specific interaction and scoring;
- `writing` — writing-specific interaction and scoring;
- `mock` — future full-test orchestration, timing, and section transitions;
- `progress` — future learner history/read models/analytics.

A concrete feature may be nested under `practice` or own a top-level feature boundary according to actual cohesion in the implementation. Architect reviews material ownership; Executor chooses local physical decomposition when the task does not pin it.

Do not create top-level global owners named `scoring`, `attempts`, `exercises`, or `admin` merely because those nouns exist. Keep them with the narrowest feature/domain owner until genuine cross-feature semantics justify extraction.

## Shared code

Shared code exists only for demonstrated reuse or a genuine cross-cutting boundary.

Expected examples may include:

- reusable UI primitives;
- Supabase client/server integration;
- narrowly shared validation/types;
- generic browser capability adapters only after more than one feature needs them.

`shared` or `lib` must not become a dumping ground.

## Server/client boundary

Default to server-side Next.js execution for data access and rendering where browser APIs are not required.

Use client components only for real client concerns such as:

- microphone/media APIs;
- browser-local STT;
- interactive state/event handlers;
- other browser-only capabilities.

Never place privileged database credentials in client code. Public Supabase browser credentials remain limited by backend authorization/RLS.

## Data boundaries

### Supabase

Supabase owns canonical structured application data. Schema evolution must be migration-backed once database schema work begins. Exposed user-data tables require task-specific RLS/security proof.

### Learner audio

Learner audio follows the invariant in `PRODUCT.md`: ephemeral capture → local processing → structured text/metrics persistence → discard audio.

### Cloudinary

Cloudinary is optional content-media infrastructure, introduced only by a feature that needs reusable media. It does not own canonical structured state.

### ChatGPT administration

ChatGPT teacher/admin access is an external operational capability against authorized Supabase surfaces. It does not justify an in-app privileged admin credential or a V1 admin UI.

## Scale policy

Forecasts define capacity observations and reversal triggers, not current topology.

Add caches, queues, services, or other distributed machinery only when a concrete current requirement or measured evidence proves the simpler architecture insufficient.

## Physical topology

Feature-based organization is preferred, but no fixed folder tree is canonical before implementation evidence exists. Task authority may pin a component boundary when material; otherwise Executor should choose the smallest structure consistent with these ownership rules and current repository patterns.
