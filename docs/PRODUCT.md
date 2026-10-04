# PTE Product Truth

## Objective

PTE is a free-first web application for practicing PTE Academic. The MVP optimizes for useful practice quality, fast shipment, zero mandatory paid-API cost, and simple operation.

## V1 product invariants

### Structured truth

Supabase is the canonical structured-data authority for the application.

User-owned structured data must be protected by the applicable authorization model and Row Level Security when exposed through Supabase data APIs.

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

### Media

Cloudinary may be used later for reusable product/content media when a feature actually needs it. It is not canonical structured truth and is not a default store for learner recordings.

### Teacher/admin workflow

ChatGPT may operate as a teacher/admin through authorized Supabase tooling and data access.

V1 does not require a custom admin dashboard. Privileged administration must not be implemented by exposing a Supabase service-role/secret key to the browser.

### Cost

The MVP must have no mandatory paid external API in its core practice path. A future paid service requires explicit product and cost authority.

## Scope discipline

Question-type rollout, scoring formulas, progress views, mock-test behavior, and other feature-specific semantics are authorized task by task. Repository bootstrap or infrastructure tasks do not imply those product behaviors.

## Explicit V1 non-goals unless separately authorized

- custom admin dashboard;
- persistent learner audio;
- paid AI scoring;
- Redis/cache infrastructure;
- background queue/workflow infrastructure;
- microservices;
- speculative multi-region or high-scale topology;
- global scoring/attempt/exercise abstractions without demonstrated cross-feature ownership.

## Change rule

Executor may not reinterpret these invariants as implementation detail. A change to retention, external AI/media usage, data ownership, cost model, trust boundary, or product behavior requires Architect normalization and explicit target-owned authority before dependent implementation.
