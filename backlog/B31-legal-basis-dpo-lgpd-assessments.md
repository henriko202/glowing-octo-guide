# B31 — ⚖️ Lawful-basis, DPO/EU-rep, ANPD/LGPD assessments

> **Status:** TODO · **Priority:** P2 · **Effort:** L · **Category:** Legal (⚖️ human/legal — engineering only if a consent gate is mandated)
> **Depends on:** — · **Blocks:** Defensible lawful-basis posture + regulator readiness (GDPR/UK-GDPR/LGPD); enables sign-off in [[B29]]

## Summary

Four compliance judgements require a lawyer, not code: (4) confirming the **lawful basis** claimed for each processing
activity, (5) assessing whether a **DPO** and an **EU/UK representative** must be appointed, (6) assessing **ANPD/LGPD
(Brazil)** obligations, and (7) keeping the **ROPA + sub-processor list in sync** as integrations change. Each is a
legal-judgment call that turns on business facts and thresholds. The only engineering consequence is conditional: **if**
counsel concludes an activity needs a **consent** basis, engineering must wire a consent gate (the machinery already
exists — see [[B23]]).

## Evidence

- `docs/compliance/README.md:68-77` — item **4 "Confirm the lawful-basis posture"**: confirm whether **legitimate
  interest** (login audit logs, security monitoring) is defensible via an **LIA**; whether **contract performance**
  covers **LinkedIn token storage + engagement actions**; and whether any activity should instead rely on **consent**
  (which would require an opt-in UI gate before that processing starts).
- `docs/compliance/README.md:79-88` — item **5**: a **DPO** is mandatory under GDPR Art. 37 if core activities involve
  large-scale systematic monitoring / special-category data; an **EU representative** (Art. 27) is required if the
  controller is not EU-established but offers services to EU residents (**UK Art. 27** equivalent for the UK). Appoint
  and fill contact details if required — currently the placeholder is `Henriko Alberton`
  (`landing/app/[lang]/privacy/content/en.tsx:34` renders "Data Protection Officer / EU–UK Representative: Henriko
  Alberton").
- `docs/compliance/README.md:90-97` — item **6 (ANPD / Brazil)**: confirm whether Brazilian user volume triggers active
  ANPD registration/reporting; whether the **LGPD Art. 7** bases are appropriate (and whether consent is required); and
  whether an **Encarregado** must be appointed under **LGPD Art. 41**.
- `docs/compliance/README.md:99-109` — item **7 (ongoing governance)**: whenever a processing activity / data category /
  third-party integration changes, update `DATA-INVENTORY.md`, `SUBPROCESSORS.md`, `RETENTION-POLICY.md`,
  `GAP-ASSESSMENT.md`; the mapping in `docs/PLATFORM.md §21` ("Maintaining This Document") is the reminder.
- `docs/PLATFORM.md §13B` — the technical machinery a consent decision would land in (consent recording, data-subject
  rights endpoints, retention crons, audit logs) already exists; if counsel mandates consent, the gate wires into this
  subsystem. The consent-purpose validator gap is tracked in [[B23]].

## Root cause

These are legal-judgment calls (defensibility of a basis, statutory thresholds, mandatory appointments) that depend on
counsel and business facts (user volumes, jurisdictions, monitoring scale). Code cannot resolve them; it can only
implement a consent gate **after** a basis decision is made.

## What we need to do

1. **(Human/legal)** Perform a **Legitimate Interests Assessment (LIA)** for the legitimate-interest activities (login
   audit logs, security monitoring); file it.
2. **(Human/legal)** Confirm **contract performance** correctly covers LinkedIn token storage + engagement actions.
   Identify any activity that should rely on **consent** instead → if so, that unblocks the engineering consent-gate work
   in [[B23]] (validator + opt-in UI wired into `§13B`).
3. **(Human/legal)** Assess **DPO** (Art. 37), **EU representative** (Art. 27), and **UK representative** requirements.
   If any is required, appoint them and replace the `Henriko Alberton` placeholder with the formal contact in all
   compliance docs **and** the landing privacy page(s).
4. **(Human/legal)** Assess **ANPD/LGPD**: registration/reporting thresholds, Art. 7 bases, and whether an **Encarregado**
   (Art. 41) is required; appoint if so.
5. **(Human/legal + docs)** Document every decision in `docs/compliance/` (bases in `DATA-INVENTORY.md`, residual gaps in
   `GAP-ASSESSMENT.md`) and establish the **item-7 governance loop** so ROPA + sub-processor list stay in sync as
   integrations change (tie to the `§21` maintenance mapping).

## Acceptance criteria

- [ ] LIA completed and filed for the legitimate-interest activities.
- [ ] Contract-basis for LinkedIn token storage + engagement confirmed; the consent-vs-contract decision recorded (and
      [[B23]] wired **iff** a consent basis is required).
- [ ] DPO / EU-rep / UK-rep requirement assessed and documented; appointed + contact filled in all docs + landing privacy
      page **iff** required (placeholder `Henriko Alberton` replaced or confirmed).
- [ ] ANPD/LGPD assessment (thresholds, Art. 7 bases, Encarregado) documented; appointed **iff** required.
- [ ] `DATA-INVENTORY.md` / `GAP-ASSESSMENT.md` / `SUBPROCESSORS.md` reflect the decisions; governance loop (item 7)
      established against `§21`.
- [ ] `pnpm verify` is green **iff** a consent gate ([[B23]]) or the landing DPO contact was code-changed (pure-legal +
      docs edits do not affect it).
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- The DPO threshold hinges on "large-scale systematic monitoring": the product's core loop tracks engagement across
  LinkedIn feeds — flag to counsel whether that qualifies, since a "yes" makes a DPO mandatory.
- A **consent** conclusion is not doc-only: it forces a UI opt-in gate before the affected processing starts, plus the
  consent-purpose validator fix in [[B23]] — scope that engineering work as a dependent follow-up, not part of this item.
- If a formal EU/UK representative is appointed, the `Henriko Alberton` placeholder must be replaced **everywhere**
  (compliance docs + all locale privacy pages), not just one file.
- Governance (item 7) is ongoing, not one-shot — each new integration (e.g. a new sub-processor) re-triggers ROPA +
  `SUBPROCESSORS.md` updates. Consider adding this to the `§21` checklist so it is not forgotten.

## Docs to update

- `docs/PLATFORM.md` §13B — if a consent gate is added; §21 ("Maintaining This Document") — record the governance loop
  from item 7.
- `docs/compliance/DATA-INVENTORY.md`, `GAP-ASSESSMENT.md`, `SUBPROCESSORS.md`, `RETENTION-POLICY.md` — per the decisions.

## References

- Related: [[B29]] [[B30]] [[B23]]
- Prior art / plan: `docs/compliance/README.md` (items 4, 5, 6, 7), `docs/PLATFORM.md §13B`
