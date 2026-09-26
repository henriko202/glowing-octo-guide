# B29 — ⚖️ Legal sign-off on compliance DRAFTs + remove banners

> **Status:** TODO · **Priority:** P1 · **Effort:** M · **Category:** Legal (⚖️ human/legal — **not** engineering)
> **Depends on:** — · **Blocks:** Go-live compliance posture (the compliance folder cannot be relied on as regulator-ready until signed off)

## Summary

Every document in `docs/compliance/` is an explicit **DRAFT** carrying a `> **DRAFT — requires legal review.**`
banner and is **not binding or regulator-ready** until a qualified privacy lawyer reviews and signs off. This is a
**human/legal** task: counsel must review the six compliance docs (plus the public landing legal pages), and the **only**
engineering action is deleting the DRAFT banners **after** written sign-off. Removing a banner before sign-off would
misrepresent an unreviewed draft as an approved legal document.

## Evidence

- `docs/compliance/README.md:49-58` — Human/Legal To-Do item **2 "Legal review of all DRAFT documents"**; line 58:
  "Remove the `> DRAFT` banner from each document only after a lawyer has signed off."
- Six compliance docs, each with the banner as **line 1** (`> **DRAFT — requires legal review.**`):
  - `docs/compliance/DATA-INVENTORY.md:1` — ROPA (GDPR Art. 30)
  - `docs/compliance/SUBPROCESSORS.md:1` — sub-processor list (Convex, Stripe, Resend, LinkedIn, OpenRouter)
  - `docs/compliance/RETENTION-POLICY.md:1` — retention windows
  - `docs/compliance/GAP-ASSESSMENT.md:1` — GDPR/UK-GDPR/LGPD/CCPA gap map
  - `docs/compliance/BREACH-RUNBOOK.md:1` — breach incident-response runbook
  - `docs/compliance/DPA-TEMPLATE.md:1` — Art. 28 / LGPD Art. 37 DPA template
- `docs/compliance/README.md:1` also carries the banner (the folder index) — remove it in the same pass.
- Landing legal pages are React (TSX), not markdown. Wrappers `landing/app/[lang]/{privacy,terms,cookies}/page.tsx`
  render per-locale content from `landing/app/[lang]/{privacy,terms,cookies}/content/{en,pt,es}.tsx`
  (verified: 9 content files exist — 3 pages × en/pt/es).
- **Grounding correction (do not copy the seed verbatim):** the landing legal pages currently render **no literal
  `> DRAFT` banner**. A repo-wide grep for `draft` in `landing/` returns only `terms/content/en.tsx:130-134` (an inline
  "will be drafted and inserted by qualified legal counsel prior to the Service launching publicly … no binding
  limitation of liability applies" note in §7) and `privacy/content/en.tsx:122` (the AI *draft comment* feature copy —
  unrelated). `README.md:55-56` still asks counsel to review `/privacy`, `/terms`, `/cookies`, and
  `GAP-ASSESSMENT.md:46` references **stale paths** `landing/app/privacy/page.tsx` / `landing/app/cookies/page.tsx` that
  no longer exist (now under `[lang]/`). So there is **nothing to un-banner** on the landing side — reconcile the
  stale claim instead (see [[B32]]).

## Root cause

The compliance docs were authored as DRAFTs pending qualified legal review; banner removal is deliberately **gated on
sign-off**. This is a legal-judgment gate (counsel + the controller `NEANDERTECH SERVICOS DE TECNOLOGIA LTDA`), not a
code defect. Engineering cannot self-clear it.

## What we need to do

1. **(Human/legal — counsel + Henriko)** Have a qualified privacy lawyer review the six compliance docs
   (`DATA-INVENTORY.md`, `SUBPROCESSORS.md`, `RETENTION-POLICY.md`, `GAP-ASSESSMENT.md`, `BREACH-RUNBOOK.md`,
   `DPA-TEMPLATE.md`) **and** the three landing legal page sets (`privacy`, `terms`, `cookies` — all of `en/pt/es`).
   Note the `[BRACKETED]` business inputs from `README.md:33-47` (controller name, address, jurisdiction, rights email,
   DPO/rep contact) already appear **filled** in the live copy (e.g. `privacy/content/en.tsx:14-36`); counsel should
   still confirm each value is correct.
2. **(Human/legal)** Obtain **written sign-off** (email or memo) naming each document + version reviewed. Keep it on
   file. The lawful-basis / DPO / ANPD judgements that sign-off depends on are tracked separately in [[B31]]; DPA
   execution in [[B30]].
3. **(ENGINEERING — the ONLY code action, and ONLY after step 2)** Delete the line-1
   `> **DRAFT — requires legal review.**` banner (and the surrounding `> Last updated:` block on `README.md:1-3`) from
   each of the six docs **and** `docs/compliance/README.md`. Also update the prose that self-describes the files as
   drafts (`README.md:8`, `README.md:49-58`, `GAP-ASSESSMENT.md:44-46`).
4. **(ENGINEERING, if counsel requires it)** Reconcile the landing legal pages to the counsel decision — either add an
   interim "not yet legally final" notice (if launch precedes sign-off) or leave them as final copy. Fix the stale
   `README.md`/`GAP-ASSESSMENT.md` landing-path claims as part of [[B32]].

## Acceptance criteria

- [ ] Written legal sign-off obtained and filed for all six compliance docs + the three landing legal page sets.
- [ ] DRAFT banners removed from the six docs **and** `docs/compliance/README.md` — **only after** sign-off.
- [ ] Draft-status prose in `README.md` / `GAP-ASSESSMENT.md` updated to reflect "reviewed & approved".
- [ ] Landing legal pages reconciled to the counsel decision (interim notice added, or confirmed final).
- [ ] `pnpm verify` is green if any TSX landing page was touched (docs-only edits do not affect it).
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Do not remove any banner before written sign-off** — that would present an unreviewed draft as an approved legal
  document (the exact risk the banner exists to prevent).
- The landing legal pages currently read as **final** copy while the backing compliance docs are still DRAFT — this
  mismatch may itself misrepresent the posture to users. Flag to counsel whether an interim notice is needed pre-launch.
- Sign-off is only meaningful once the inputs it depends on are settled — [[B30]] (DPAs) and [[B31]] (lawful basis, DPO,
  ANPD) should land first or in parallel.
- Open question: does counsel want a single dated sign-off memo, or a per-document approval? Record the version each
  approval covers so future edits re-trigger review (governance item — [[B31]], `README.md:99-109`).

## Docs to update

- `docs/PLATFORM.md` §13B / §15 — update the privacy-compliance + landing-legal-page status once docs are approved and
  banners removed (drop any "DRAFT" characterisation).
- `docs/compliance/README.md` — remove the DRAFT banner and the "all files are DRAFTs" framing after sign-off.

## References

- Related: [[B30]] [[B31]] · doc-drift cleanup for the stale landing-path claims: [[B32]]
- Prior art / plan: `docs/compliance/README.md` (Human/Legal To-Do items 1 & 2)
