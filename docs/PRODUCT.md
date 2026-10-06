# PTE Product Truth

## Objective

PTE is a free-first web application for learning and practicing PTE Academic. The MVP optimizes for useful study/practice quality, fast shipment, zero mandatory paid-API cost, and simple operation.

The product is not only a question bank. It combines learner-facing Study/Coach content with Practice so observed weaknesses can lead to targeted learning and drills.

## V1 product invariants

### Structured truth

Supabase is the canonical structured-data authority for the application.

User-owned structured data must be protected by the applicable authorization model and Row Level Security when exposed through Supabase data APIs.

### Study / Coach

`study` is a first-class product domain.

The governing content flow is:

```text
ChatGPT / authorized authoring workflow
→ Supabase study content
→ Next.js Study feature
→ learner
```

ChatGPT may create, revise, deactivate, and maintain Study content through authorized operational Supabase tooling. The application does not require the OpenAI API at runtime to render Study content or provide basic deterministic recommendations.

The learning loop is:

```text
Learn
→ Practice
→ Detect weakness/subskill evidence
→ Recommend targeted Study content
→ Focused drill
→ Practice again
```

Study content includes strategies, templates, skill guides, common mistakes, score-targeted playbooks, and short-term study plans. Exact behavior is governed by `docs/STUDY.md`.

Study content truth and learner Study-progress state are distinct concerns.

### Learner audio

Learner speaking audio is ephemeral by default.

The governing flow is:

```text
microphone
→ ephemeral browser audio
→ local speech-to-text
→ transcript + attributable timing/derived metrics
→ persist structured text/metrics
→ discard learner audio
```

V1 must not silently:

- upload learner recordings to Cloudinary or another media provider;
- persist a learner `recording_url`;
- retain audio merely because implementation is easier;
- replace local speech-to-text with a paid/cloud AI dependency;
- add remote pronunciation scoring without new product/architecture authority.

### Media and external source ingestion

Supabase owns structured metadata/provenance. Cloudinary or another approved media/object store may hold media bytes only when the project has rights to persist and reuse the asset.

Discovery/reference ingestion and copying media bytes are separate actions.

YouTube is reference-only by default. Do not download/import/cache/store YouTube audiovisual copies merely for convenience. When in-app playback is needed, use supported YouTube embed/player mechanisms and revalidate the current applicable YouTube policies at implementation time.

Arbitrary web media is also reference-only until rights are established.

See `docs/STUDY.md` for the detailed ingestion and provenance contract.

### Teacher/admin workflow

ChatGPT may operate as a teacher/admin/Study author through authorized Supabase tooling and data access.

V1 does not require a custom admin dashboard. Privileged administration must not be implemented by exposing a Supabase service-role/secret key to the browser.

### Cost

The MVP must have no mandatory paid external API in its core Study or Practice runtime paths. A future paid service requires explicit product and cost authority.

## V1 Practice coverage objective

The operator's V1 Practice target is complete learner-facing coverage of the current PTE Academic question-type taxonomy. At this decision boundary, that taxonomy contains 22 question types: 9 Speaking & Writing, 5 Reading, and 8 Listening.

Coverage is a product objective, not a task-lifecycle inference. A question type counts toward this objective only when current target evidence shows a learner-visible Practice surface with task-appropriate original/authorized content and bounded feedback behavior accepted through the canonical task/review process.

Rollout remains task-authorized one question type at a time unless one independently reviewable outcome genuinely requires a different boundary. After each accepted question-type task, the Architect must fresh-resolve current target evidence and current Pearson taxonomy/order before selecting the next missing type. Unless the operator explicitly overrides priority, select the earliest missing question type in current exam order.

If Pearson changes the taxonomy, ordering, or material mechanics, re-normalize this coverage objective and subsequent task authority before implementation rather than treating the historical 22-type count as immutable external truth.

This coverage objective does not by itself authorize runtime AI, paid APIs, persistent learner audio, copying unlicensed third-party media, generic scoring/attempt infrastructure, analytics, deployment, or any other behavior excluded elsewhere in this product truth.

## Scope discipline

Study content/schema/UI, question-type rollout, scoring formulas, progress views, mock-test behavior, and other feature-specific semantics are authorized task by task. Repository bootstrap or infrastructure tasks do not imply those product behaviors.

Large Practice tasks should account for the Study ↔ subskill ↔ Practice relationship before freezing shared data ownership, but should not build speculative Study machinery unrelated to their bounded scope.

## Explicit V1 non-goals unless separately authorized

- custom admin/CMS dashboard;
- runtime OpenAI/LLM dependency for core Study/Practice behavior;
- persistent learner audio;
- paid AI scoring;
- autonomous crawler/background ingestion;
- copying YouTube or arbitrary unlicensed web media;
- Redis/cache infrastructure;
- background queue/workflow infrastructure;
- microservices;
- vector database/embeddings pipeline;
- speculative multi-region or high-scale topology;
- global scoring/attempt/exercise abstractions without demonstrated cross-feature ownership.

## Change rule

Executor may not reinterpret these invariants as implementation detail. A change to Study/Practice semantics, retention, external AI/media usage, data ownership, cost model, trust boundary, rights/provenance policy, or product behavior requires Architect normalization and explicit target-owned authority before dependent implementation.
