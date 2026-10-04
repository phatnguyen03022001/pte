# PTE V1 Stack & Credential SSOT

This document is the canonical owner for PTE V1 framework, third-party, browser-capability, deployment, and credential choices. It records inventory and authorization state only; an `AUTHORIZED_DEFERRED` entry is not permission to install, activate, provision, deploy, or call that integration without a feature/task that authorizes the consequence.

## Status and exposure vocabulary

- `INSTALLED` — present in the accepted repository manifest/lockfile.
- `AUTHORIZED_DEFERRED` — selected for V1, but not installed/activated until a feature task requires it.
- `NATIVE_NO_PACKAGE` — browser/platform capability; no repository package is required by this decision.
- `DEPLOYMENT_TARGET_UNACTIVATED` — selected target, but repository deployment/linking/auto-deploy is not authorized by this inventory.
- `NOT_REQUIRED` — no credential/package is needed for the selected V1 path.
- `EXCLUDED` — intentionally outside current V1 authority.
- `PUBLIC_BROWSER` — intentionally browser-visible value. Exposure does not grant data access beyond backend authorization/RLS.
- `SERVER_SECRET` — application server secret. Never use a `NEXT_PUBLIC_*` name or ship it to browsers.
- `OPERATOR_ONLY` — credential for operator/headless tooling only; learner runtime code must not read it.
- `IDENTIFIER` — non-secret identifier used by the named workflow.
- `NO_KEY` — selected capability requires no V1 credential.

## Installed baseline and selected capabilities

| Canonical item | Role | Exact version / frozen choice | Lifecycle | Credential contract | Official documentation / acquisition | Material constraints |
| --- | --- | --- | --- | --- | --- | --- |
| Node.js | Next.js runtime/toolchain | Repository requirement `>=20.9.0`; Vercel currently supports 20.x/22.x/24.x and defaults new projects to 24.x | Runtime requirement | NO_KEY | https://nextjs.org/docs/app/getting-started/installation ; https://vercel.com/docs/functions/runtimes/node-js ; https://vercel.com/changelog/node-js-24-lts-is-now-generally-available-for-builds-and-functions | Do not change the repository runtime contract in TASK-0002. |
| pnpm | Package manager | 11.22.0 | INSTALLED/PINNED | NO_KEY | https://pnpm.io/ | `packageManager` in `package.json` is canonical. |
| Next.js App Router | Web framework | 16.3.8 | INSTALLED | NO_KEY | https://nextjs.org/docs/app | Server-first unless a browser boundary is required. |
| React | UI runtime | 19.2.8 | INSTALLED | NO_KEY | https://react.dev/ | Current package lock is authoritative. |
| React DOM | React web renderer | 19.2.8 | INSTALLED | NO_KEY | https://react.dev/reference/react-dom | Current package lock is authoritative. |
| TypeScript | Language/tooling | 5.9.3 | INSTALLED | NO_KEY | https://www.typescriptlang.org/docs/ | `tsc --noEmit` is the repository typecheck. |
| ESLint | Lint engine | 9.39.5 | INSTALLED | NO_KEY | https://eslint.org/docs/latest/ | Resolved version is from `pnpm-lock.yaml`. |
| eslint-config-next | Next.js lint configuration | 16.3.8 | INSTALLED | NO_KEY | https://nextjs.org/docs/app/api-reference/config/eslint | Keep aligned with the locked Next.js version. |
| @types/node | Node.js TypeScript declarations | 20.19.43 | INSTALLED | NO_KEY | https://github.com/DefinitelyTyped/DefinitelyTyped | Development-only typing dependency. |
| @types/react | React TypeScript declarations | 19.3.0 | INSTALLED | NO_KEY | https://github.com/DefinitelyTyped/DefinitelyTyped | Development-only typing dependency. |
| @types/react-dom | React DOM TypeScript declarations | 19.3.0 | INSTALLED | NO_KEY | https://github.com/DefinitelyTyped/DefinitelyTyped | Development-only typing dependency. |
| @supabase/ssr | Supabase SSR session integration | 0.12.7 | INSTALLED | C1, C2; C3 only if separately authorized | https://supabase.com/docs/guides/auth/server-side/nextjs | Does not authorize privileged server access by itself. |
| @supabase/supabase-js | Supabase JavaScript client | 2.117.2 | INSTALLED | C1, C2; C3 only if separately authorized | https://supabase.com/docs/reference/javascript/introduction | Browser usage remains constrained by RLS/authorization. |
| Supabase | Auth/Postgres/RLS-backed structured-data authority | Hosted provider selected by product truth | ACTIVE PROVIDER CONTRACT | C1-C6 as applicable | https://supabase.com/docs/guides/getting-started/api-keys | Publishable values are browser-safe; secret keys bypass RLS and remain server-only. Normal connected Supabase MCP/plugin OAuth does not require a repository PAT. |
| shadcn/ui | V1 UI component system | Official shadcn/ui for Next.js; source-owned generated components | AUTHORIZED_DEFERRED | NO_KEY | https://ui.shadcn.com/docs/installation/next | Use the official CLI only when a UI implementation task needs components. Do not pre-install unused UI packages. |
| Tailwind CSS and shadcn support dependencies | Styling/support packages required by shadcn when implementation reaches UI | Version selected by the future shadcn implementation task | AUTHORIZED_DEFERRED | NO_KEY | https://ui.shadcn.com/docs/installation/next | Not installed by TASK-0002. Treat as implementation-time shadcn requirements, not baseline dependencies. |
| react-markdown | Study Markdown renderer | 10.1.0 | INSTALLED | NO_KEY | https://github.com/remarkjs/react-markdown | Raw HTML stays disabled/escaped by default. No `rehype-raw` authorization. |
| remark-gfm | GitHub-Flavored Markdown plugin | 4.0.1 | INSTALLED | NO_KEY | https://github.com/remarkjs/remark-gfm | Used with react-markdown for Study Markdown rendering. |
| rehype-raw | Raw HTML parsing for Markdown | Not authorized | EXCLUDED | NO_KEY | https://github.com/remarkjs/react-markdown | Do not add unless a later security-reviewed task explicitly changes the Markdown trust boundary. |
| @huggingface/transformers | Browser-local speech-to-text runtime | 4.3.0 with public `onnx-community/whisper-tiny.en` revision `2575352d61be1bf7225cf8f8b268a4678025fc58` | INSTALLED | NO_KEY | https://huggingface.co/docs/transformers.js/guides/webgpu ; https://huggingface.co/onnx-community/whisper-tiny.en | Web Worker inference only; WebGPU preferred with WASM fallback. Do not add `HF_TOKEN` for this public-model V1 path. |
| WebGPU | Preferred local inference accelerator | Browser WebGPU | NATIVE_NO_PACKAGE | NO_KEY | https://developer.mozilla.org/docs/Web/API/WebGPU_API | Browser availability is capability-dependent; fallback is required where unsupported. |
| WebAssembly | Local inference fallback | Browser WebAssembly as used by Transformers.js | NATIVE_NO_PACKAGE | NO_KEY | https://developer.mozilla.org/docs/WebAssembly | No separate provider or credential. |
| MediaDevices.getUserMedia | Learner microphone capture | Browser media capture | NATIVE_NO_PACKAGE | NO_KEY | https://developer.mozilla.org/docs/Web/API/MediaDevices/getUserMedia | Requires user permission and a secure context. Learner audio is ephemeral by product invariant. |
| MediaRecorder / browser audio APIs | Ephemeral speaking capture/processing support | Native browser APIs | NATIVE_NO_PACKAGE | NO_KEY | https://developer.mozilla.org/docs/Web/API/MediaRecorder | Does not authorize persistent learner audio or upload. |
| Cloudinary Node/server API | Reusable owned/licensed media storage only when a feature authorizes persistence | Server-side Cloudinary integration | AUTHORIZED_DEFERRED | C7 | https://cloudinary.com/documentation/developer_onboarding_faq_find_credentials ; https://console.cloudinary.com/settings/api-keys | Use one server `CLOUDINARY_URL`. No browser Cloudinary secret. Do not persist learner recordings by default. |
| YouTube IFrame Player/embed | Reference playback | Supported YouTube embed/IFrame path | AUTHORIZED_DEFERRED / NO_PACKAGE | NO_KEY | https://developers.google.com/youtube/iframe_api_reference | Reference/embed only by default. Do not copy audiovisual bytes. Current embed clients must preserve required client identity such as HTTP Referer behavior. |
| YouTube Data API v3 | Bounded public metadata/search ingestion | Google YouTube Data API v3 | AUTHORIZED_DEFERRED | C8 | https://developers.google.com/youtube/v3/getting-started ; https://console.cloud.google.com/apis/credentials | Quota-bearing server credential. OAuth client credentials are not required for the current public-data-only V1 path. Re-check current storage/refresh/display policy before implementation. |
| Vercel | Initial deployment target | Vercel; Git auto-deploy unactivated | DEPLOYMENT_TARGET_UNACTIVATED | C9-C11 only for optional headless/operator automation | https://vercel.com/account/settings/tokens ; https://vercel.com/docs/cli/global-options ; https://vercel.com/docs/cli/project-linking | Connected-plugin/manual authenticated deployment needs no repository runtime key. `VERCEL_TOKEN`, org ID and project ID are operator workflow inputs, never learner runtime dependencies. |
| ChatGPT connected operational tooling | Teacher/admin/author workflow against authorized provider surfaces | Connected OAuth/plugin/tooling path | OPERATOR CAPABILITY | NO_KEY in application runtime | PTE product truth; provider connection is external to learner runtime | Does not justify `OPENAI_API_KEY` or an in-app admin credential. |
| OpenAI runtime API | Runtime LLM dependency for core Study/Practice | None | EXCLUDED | NOT_REQUIRED; do not add `OPENAI_API_KEY` | N/A — excluded by PTE product truth | Core runtime remains zero-paid-API. |
| Hugging Face private/gated model auth | Private/gated model access | None for current public Whisper model | NOT_REQUIRED | Do not add `HF_TOKEN` | https://huggingface.co/docs/hub/security-tokens | Add only if a later task selects a gated/private model. |
| Google OAuth client credentials | Private-user YouTube data or mutation auth | None | NOT_REQUIRED | Do not add OAuth client ID/secret env vars | https://developers.google.com/youtube/v3/guides/authentication | Public metadata/search uses the Data API key path; private user data/mutations are outside current V1. |
| Redis/cache infrastructure | Distributed cache | None | EXCLUDED | NOT_REQUIRED | N/A — excluded by PTE product truth | Add only after a measured/current requirement and new authority. |
| Vector database / embedding provider | Semantic retrieval/recommendation infrastructure | None | EXCLUDED | NOT_REQUIRED | N/A — excluded by PTE product truth | Deterministic Study recommendations remain the V1 rule. |
| Analytics provider | Product analytics SaaS | None selected | EXCLUDED | NOT_REQUIRED | N/A — no V1 provider selected | Do not invent analytics credentials. |
| Autonomous crawler/background ingestion | Background discovery/ingestion system | None | EXCLUDED | NOT_REQUIRED | N/A — excluded by PTE product truth | ChatGPT/operator-driven bounded ingestion is not a crawler daemon. |

## Credential contract

Each environment variable below has exactly one owner/classification in this table. Values in `.env.example` stay blank. Real values never enter Git.

| ID | Canonical env name | Owner / purpose | Lifecycle | Exposure class | Actual-value destination | Official acquisition / documentation |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL used by browser/server clients | REQUIRED_NOW | PUBLIC_BROWSER / IDENTIFIER | Ignored `.env.local` for local runtime; deployment environment configuration only after deployment is authorized | https://supabase.com/dashboard/project/<PROJECT_REF>/settings/api-keys ; https://supabase.com/docs/guides/getting-started/api-keys |
| C2 | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key for browser/server clients | REQUIRED_NOW | PUBLIC_BROWSER | Ignored `.env.local`; deployment environment configuration only after deployment is authorized | https://supabase.com/dashboard/project/<PROJECT_REF>/settings/api-keys ; https://supabase.com/docs/guides/getting-started/api-keys |
| C3 | `SUPABASE_SECRET_KEY` | Privileged Supabase server access for a separately authorized server workflow | AUTHORIZED_DEFERRED | SERVER_SECRET | Server-only ignored local env / deployment secret store after feature authorization | https://supabase.com/dashboard/project/<PROJECT_REF>/settings/api-keys ; https://supabase.com/docs/guides/getting-started/api-keys |
| C4 | `SUPABASE_PROJECT_REF` | Supabase project identifier for operator/headless tooling | OPTIONAL_OPERATOR | IDENTIFIER | Operator shell/automation context; never required by learner runtime | https://supabase.com/docs/reference/cli/supabase-link ; https://supabase.com/dashboard/project/<PROJECT_REF>/settings/api-keys |
| C5 | `SUPABASE_ACCESS_TOKEN` | Scoped Supabase PAT for CLI/Management API/headless MCP only when OAuth/connected tooling is not the selected path | OPTIONAL_OPERATOR | OPERATOR_ONLY | Operator shell or secure automation secret store only | https://supabase.com/dashboard/account/tokens |
| C6 | `SUPABASE_DB_PASSWORD` | Direct database authentication for CLI/database workflows that actually require it | OPTIONAL_OPERATOR | OPERATOR_ONLY | Operator shell or secure automation secret store only | https://supabase.com/docs/guides/database/connecting-to-postgres ; https://supabase.com/docs/reference/cli/supabase-link |
| C7 | `CLOUDINARY_URL` | Cloudinary server credential containing cloud name, API key and API secret | AUTHORIZED_DEFERRED | SERVER_SECRET | Server-only ignored local env / deployment secret store after media-persistence authorization | https://console.cloudinary.com/settings/api-keys ; https://cloudinary.com/documentation/developer_onboarding_faq_find_credentials |
| C8 | `YOUTUBE_API_KEY` | YouTube Data API v3 public metadata/search quota credential | AUTHORIZED_DEFERRED | SERVER_SECRET / QUOTA_CREDENTIAL | Server-only ignored local env / deployment secret store after Data API feature authorization | https://console.cloud.google.com/apis/credentials ; https://developers.google.com/youtube/v3/getting-started |
| C9 | `VERCEL_TOKEN` | Optional Vercel headless/CI/operator authentication | OPTIONAL_OPERATOR | OPERATOR_ONLY | Operator shell or secure automation secret store only | https://vercel.com/account/settings/tokens ; https://vercel.com/docs/cli/global-options |
| C10 | `VERCEL_ORG_ID` | Optional Vercel headless organization/team scope | OPTIONAL_OPERATOR | IDENTIFIER | Operator shell/automation context only | https://vercel.com/docs/cli/global-options ; https://vercel.com/docs/cli/project-linking |
| C11 | `VERCEL_PROJECT_ID` | Optional Vercel headless project scope | OPTIONAL_OPERATOR | IDENTIFIER | Operator shell/automation context only | https://vercel.com/docs/cli/global-options ; https://vercel.com/docs/cli/project-linking |

## Intentional absences

The following variables are intentionally absent from `.env.example` and must not be invented without later authority:

- `OPENAI_API_KEY` — runtime OpenAI/LLM dependency is excluded from core V1.
- `HF_TOKEN` — the selected public `onnx-community/whisper-tiny.en` browser-local path is NO_KEY.
- Google OAuth client ID/secret variables — private-user YouTube data/mutations are outside current V1.
- Redis credentials — Redis/cache infrastructure is excluded.
- Vector/embedding provider keys — vector/embedding infrastructure is excluded.
- Analytics keys — no V1 analytics provider is selected.

## Environment ownership rules

1. `PUBLIC_BROWSER` values may be exposed intentionally but remain constrained by backend authorization/RLS.
2. `SERVER_SECRET` values never use `NEXT_PUBLIC_*` names and never enter browser bundles.
3. `OPERATOR_ONLY` values are inventory for headless/operator workflows and must not be consumed by application runtime code.
4. A documented deferred credential does not activate its provider or authorize installation, API calls, resource creation, deployment, data copying, or retention changes.
5. Connected provider tooling may use OAuth or plugin-managed credentials outside the repository; do not duplicate those credentials in Git merely because an env name exists in this inventory.
