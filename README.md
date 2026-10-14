# PTE Study

PTE Study is a Next.js application for authenticated practice with PTE question types and Vocabulary. It provides Flashcards, Listen & Write, and Listen & Repeat practice, dataset selection, answer reveal, and FSRS-based review controls.

## Local development

Requirements: Node.js 20.9 or later and npm. Install locked dependencies and start the development server:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` using values for an authorized Supabase project. The public home, sign-in, and sign-up screens render without Supabase configuration; protected study pages do not. Never put a Supabase secret key in a browser-visible variable.

## Runtime datasets

The application reads Question Banks, Collections, and Vocabulary from a local `data/` directory at runtime. These datasets are excluded from Git because their content and redistribution rights are restricted or unresolved. Provide an authorized dataset snapshot to the server through private runtime storage or a deployment artifact, outside the source repository and public client bundle. A build without `data/` can compile, but study datasets will be unavailable until authorized data is supplied. Do not copy data from `pte-prep` into this public repository.

## Study and persistence

Choose a Question Bank, Collection, Vocabulary tier, or Vocabulary list, then start a scheduled queue or manually review the selected items. References appear after Reveal. Manual review preserves existing scheduling history.

FSRS uses `ts-fsrs`. Persistent reviews require the migration at `supabase/migrations/20261014000000_create_study_review_states.sql` to be applied to the intended Supabase project. The application scopes review state to the authenticated user. Without an available database, practice can be temporary and reviews are reported as unsaved.

Media resolution requires exact source identity, verified remote evidence, and an authorized delivery URL. Current Cloudinary assets use authenticated delivery, and the application has no configured server-side signing mechanism. Audio and image delivery are therefore not confirmed as usable in the application. Do not expose unsigned URLs for authenticated assets or store signed bearer URLs in public metadata.

## Checks

Run the public-source tests, lint, typecheck, and production build:

```bash
npm run test:navigation
npm run test:datasets
npm run test:fsrs
npm run test:audio
npm run test:study
npm run test:integration
npm run test:media
npm run lint
npm run typecheck
npm run build -- --webpack
```

These checks use deterministic fixtures and do not require private datasets. Tests that inspect an authorized local `data/` snapshot are separate:

```bash
npm run test:private-data
```

That optional suite requires the separately supplied private datasets and media manifest. Do not add those files to Git to make the tests pass.

## Release and verification status

Live Supabase authentication, live FSRS persistence, browser playback of authenticated Cloudinary assets, and production deployment are not verified by this source checkout. A Supabase migration is not applied automatically. Any deployment requires separate explicit authorization; pushing source to GitHub must not be treated as permission to deploy.
