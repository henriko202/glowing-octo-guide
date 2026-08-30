<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns.
The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Git

**NEVER commit to git.** Do not run `git commit` or `git push` under any circumstances — not even after finishing a
task, fixing a bug, or when a skill/workflow suggests committing. Make and save file changes only; the user (Henriko)
makes **all** commits themselves. If a change is ready, say so and let the user commit it.

## Documentation

**`docs/PLATFORM.md` is the canonical platform documentation** (architecture, data model, business logic, env variables,
flow charts, security, deployment). **Always keep it in sync with the code.** Whenever you develop a new feature, change
existing behavior, add/remove an environment variable, alter the schema, or otherwise push code, update the relevant
section (s) of `docs/PLATFORM.md` **in the same change** — never leave it stale. The file's final section ("Maintaining
This Document") maps each code area to the section that must be updated; follow that mapping. If a change introduces a
new subsystem or multi-step flow, add a new numbered section, a Table-of-Contents entry, and a Mermaid flow chart. Treat
the docs as part of "done": a feature is not complete until `docs/PLATFORM.md` reflects it.
