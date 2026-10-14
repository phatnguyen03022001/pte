# Repository Guidance

- Keep application code, tests, and SQL migrations in their existing directories.
- Do not commit `data/`, local environment files, media, credentials, or generated runtime artifacts.
- The `data/` directory is supplied separately from this source repository. Preserve source dataset identities and ordering.
- Use the existing Next.js, React, TypeScript, Supabase, FSRS, and media boundaries; do not add product features without separate authorization.
- Run the relevant test scripts, `npm run lint`, and `npm run typecheck` before preparing a release.
- Use the `main` branch only. Do not create branches, rewrite history, or push changes that could trigger an unapproved deployment.
- Never access `.env.local` during repository audits. Do not deploy or mutate remote services without explicit authorization.
