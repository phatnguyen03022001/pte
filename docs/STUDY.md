# Study / Coach Feature Specification

## Status

Target-owned product specification. This document defines durable product behavior and boundaries for the Study / Coach domain. Implementation remains task-authorized.

## Purpose

PTE is not only a question bank. The Study / Coach feature provides concise, practical learning material that helps a learner understand what to do, why mistakes happen, and what to practice next.

The product loop is:

```text
Learn
→ Practice
→ Detect weakness
→ Read targeted strategy or guide
→ Drill the weak subskill
→ Practice again
```

The core design keeps intelligence out of the runtime dependency path:

```text
ChatGPT / authorized authoring workflow
        ↓ create / edit / maintain
Supabase study content
        ↓
Next.js Study feature
        ↓
learner reads / uses / marks progress
```

ChatGPT is an author/coach and operational administrator. The Next.js application does not need to call the OpenAI API at runtime to serve Study content or basic recommendations.

## Product ownership

`study` is a first-class product domain.

Candidate information architecture:

```text
Study
├── Strategies
│   ├── task-type strategies such as WFD, RS, RA, DI, FIB, ...
│   └── score-targeted variants when genuinely different
├── Templates
│   ├── Describe Image
│   ├── Retell Lecture
│   ├── Summarize Written Text
│   └── Essay
├── Skill Guides
│   ├── Listening
│   ├── Speaking
│   ├── Reading
│   └── Writing
├── Common Mistakes
│   ├── plural endings
│   ├── articles
│   ├── final consonants
│   ├── spelling
│   └── grammar
├── Playbooks
│   └── 40+ priority / time-management / exam-day guidance
└── Plans
    ├── 1-day
    ├── 3-day
    └── 7-day
```

This is semantic ownership, not a mandatory folder tree.

## Study content behavior

Study content should be:

- concise enough to use during active exam preparation;
- explicit about the target task type, skill, score band, or weakness when applicable;
- written in Markdown or another target-approved portable text representation;
- renderable without a runtime AI call;
- versionable/editable through authorized operational tooling;
- source/provenance aware when derived from external references;
- inactive rather than destructively deleted when historical references may still point to it.

The application may render Markdown using the project UI system. A specific Markdown renderer is an implementation dependency and must be selected by the applicable implementation task rather than pre-authorized by this spec.

## Conceptual data model

The initial schema should remain small. Exact SQL, constraints, enums, indexes, RLS policies, and migration structure belong to the database implementation task.

### `study_content`

Conceptual fields:

```text
id
slug
type
skill
task_type
title
body_markdown
difficulty
target_score
source_type
source_ref
created_by
updated_by
created_at
updated_at
active
```

Expected `type` values may include:

- `strategy`
- `template`
- `skill_guide`
- `common_mistake`
- `playbook`
- `plan`

Do not turn these example values into a rigid database enum unless the implementation task proves that a database enum is the simplest compatible choice.

`skill`, `task_type`, `difficulty`, and `target_score` are filtering/context metadata and may be nullable where they do not apply.

`slug` is the stable human-readable content locator for user-facing curated content.

### Study ↔ subskill relationship

A Study item may address zero, one, or multiple subskills. A subskill may be addressed by multiple Study items.

Do not encode that relationship as one overloaded comma-separated field.

The expected normalized relationship is conceptually:

```text
study_content_subskills
- study_content_id
- subskill_id
```

The exact table name and physical representation remain implementation HOW as long as the many-to-many semantic relationship is preserved.

## Practice integration

Practice owns learner attempts/results. Study owns learning content.

The integration contract is semantic:

```text
Practice result
    ↓
derived weakness / subskill evidence
    ↓
Study recommendation query
    ↓
relevant Study content
    ↓
optional focused drill
    ↓
Practice again
```

Example:

```text
Repeated WFD plural-ending errors
→ weakness: plural endings
→ Study: "Plural endings in WFD"
→ focused micro-drill
→ WFD retry
```

V1 recommendations should be deterministic from stored practice evidence and Study/subskill mappings. Runtime AI is not required.

A later ranking model may consider recency, severity, target score, completion state, and content priority, but no ranking service, vector database, embedding pipeline, or LLM recommendation dependency is authorized by this document.

## Learner Study state

The Study feature may later need learner-specific state such as viewed/completed/bookmarked status.

Do not add learner-progress tables until the applicable feature task defines observable behavior and ownership. Content truth and learner progress are separate concerns.

## ChatGPT authoring and coaching

ChatGPT may use authorized Supabase tooling to:

- create Study content;
- revise strategy/template/guide text;
- deactivate obsolete content;
- improve content for a score target;
- inspect practice history and recommend what the learner should study;
- generate a short-term learning plan from current learner evidence.

This is an operational workflow, not an in-app admin feature.

A browser client must never receive a Supabase service-role/secret credential to enable this workflow.

### Personalized plans

A plan generated by ChatGPT from learner history may:

1. be returned only in chat, with no app persistence; or
2. be persisted later through a separately authorized learner-plan model.

Do not overload global curated `study_content` with per-user generated plans unless a later product task explicitly chooses that model.

## Content and media ingestion

### Governing separation

Discovery/reference ingestion and media-byte persistence are different actions.

```text
ChatGPT / bounded ingestion workflow
        ↓
discover candidate source
        ↓
validate provenance / rights / product relevance
        ↓
extract permitted reference + metadata
        ↓
Supabase = canonical structured truth
        ↓
Cloudinary/object storage only when asset persistence is authorized
```

There is no V1 autonomous crawler daemon or background ingestion pipeline.

### YouTube

YouTube content is **reference-only by default**.

A Study/media record may store permitted reference data such as:

- YouTube video ID;
- canonical source URL;
- start/end offsets for a recommended segment;
- title/source attribution when permitted;
- a product-authored note or analysis;
- transcript text only when the application has a lawful/authorized source and the applicable platform/content rights permit persistence.

Do not download, import, backup, cache, copy, or store YouTube audiovisual bytes into Supabase, Cloudinary, or another store merely for convenience.

When playback inside the app is needed, use YouTube's supported embed/player mechanisms and comply with current YouTube requirements.

If YouTube API Data is stored, the implementation must also satisfy the current YouTube API Services policies for storage, refreshing, display, authorization, and deletion. Do not assume metadata obtained once is permanently cacheable.

Current policy authority should be rechecked at implementation time:

- YouTube API Services Developer Policies: `https://developers.google.com/youtube/terms/developer-policies`
- YouTube API Services Terms of Service: `https://developers.google.com/youtube/terms/api-services-terms-of-service`
- YouTube IFrame Player documentation: `https://developers.google.com/youtube/iframe_api_reference`

### Persistable owned/licensed assets

Image/audio/video bytes may be materialized into Cloudinary or another approved object/media store only when the asset is:

- owned by the project/operator;
- generated under terms that permit the intended use;
- public domain; or
- covered by a license/permission that permits the intended reuse and storage.

Supabase remains the structured metadata/provenance authority; it should not be used as a generic binary media database.

### Unverified web media

For arbitrary web media, default to reference/provenance metadata only.

Do not copy media bytes until rights are established.

### Practice question provenance

Practice question content must carry truthful provenance semantics independently of whether the product is commercial or only for the operator's personal study.

Canonical source classes:

- `project_authored` — original practice written for this project. Learner UI must label it as project-authored and must not imply Pearson authorship or official-question status.
- `pearson_official_public` — exact Pearson material that is publicly accessible and whose intended reproduction/storage/use is permitted. Store the exact Pearson source reference and applicable attribution/licensing evidence.
- `pearson_authorized_copy` — exact Pearson material for which the operator holds explicit permission/license allowing the intended local or database copy. Store evidence sufficient to reconstruct that authority.

Restricted Pearson preparation products, paid question banks, subscription/account-gated practice, mock tests, AI Practice, or similar content remain reference/access-only unless their governing terms explicitly permit copying into this product. Personal use, purchase, or non-commercial intent alone does not authorize scraping, downloading, database persistence, or re-hosting.

When provenance is incomplete or permission is ambiguous, fail closed:

- keep only a reference/link where permitted;
- do not persist the full third-party question;
- do not label the material official;
- use original project-authored practice instead.

Every learner-visible Practice item must display a provenance label. At minimum, `project_authored` items must visibly say that they are not official Pearson questions.

### Text, transcripts, and question content

Externally sourced text, transcripts, questions, explanations, and other content require provenance and lawful reuse. A public URL alone does not grant copying rights.

Product-authored or ChatGPT-authored original Study content may be stored directly, subject to normal accuracy/review expectations.

## Conceptual media metadata

When a feature needs reusable referenced or persisted media, the conceptual structured record may include:

```text
id
media_type
source_type
source_url
external_id
start_ms
end_ms
transcript_or_reference_text
asset_url
license
attribution
source_ref
imported_by
created_at
updated_at
active
```

`asset_url` is nullable and exists only when media-byte persistence is actually authorized.

Do not create this schema during unrelated scaffold work.

## Zero-paid-API invariant

Core Study read/render/recommendation behavior must work without a paid external AI API.

ChatGPT authoring through operator-controlled tooling is outside the application runtime path.

A future runtime AI feature requires explicit product, architecture, privacy, cost, failure-mode, and verification authority.

## Security and trust boundaries

- Study reads may be public/authenticated according to the future product task.
- Content mutation is privileged operational behavior.
- Browser clients do not receive privileged Supabase secrets.
- RLS/policies must match the chosen content visibility and learner-state ownership model.
- External content is untrusted input until validated.
- Markdown rendering must not create an XSS path; renderer/sanitization behavior must be proven by the implementation task.

## Explicit non-goals

This specification does not authorize:

- a custom CMS/admin dashboard;
- runtime OpenAI/LLM calls;
- autonomous crawling/background ingestion;
- YouTube/media downloading;
- copying arbitrary web assets;
- a vector database or embeddings pipeline;
- a knowledge graph;
- a separate content microservice;
- personalized-plan persistence;
- learner Study-progress persistence;
- Study database migrations during TASK-0001;
- implementation of the Study UI during TASK-0001.

## Implementation sequencing

Study should be normalized before large Practice feature work because the shared subskill taxonomy and recommendation relationship affect later data ownership.

However, implementation should remain incremental:

1. establish application scaffold;
2. establish the minimal shared domain/data foundations required by the first real feature;
3. implement Study content/schema/UI in a dedicated task or small sequence;
4. connect Practice weakness evidence to Study recommendations when both sides exist.

Do not build both complete Study and complete Practice in one oversized task.
