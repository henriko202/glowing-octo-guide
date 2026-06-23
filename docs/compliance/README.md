> **DRAFT — requires legal review.**
>
> Last updated: 2026-06-19

# Privacy & Compliance Documentation — Link Into The SSI

This folder contains the privacy-compliance documentation for **Link Into The SSI**. All files are
**DRAFTs** and require review and sign-off by qualified legal counsel before they can be relied upon
as binding or regulator-ready documents. The technical machinery that backs these obligations (consent
recording, data-subject rights endpoints, retention crons, audit logs) is described in
`docs/PLATFORM.md` §13B.

---

## Index

| File                                       | Summary                                                                                                                                                                                                                                                                                      |
|--------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [DATA-INVENTORY.md](DATA-INVENTORY.md)     | Record of Processing Activities (ROPA) — catalogues every personal-data category, purpose, legal basis, retention period, and data-flow under GDPR Art. 30.                                                                                                                                  |
| [SUBPROCESSORS.md](SUBPROCESSORS.md)       | Sub-processor list — names every third-party organisation that processes personal data on behalf of the controller (Convex, Stripe, LinkedIn, Resend). Also lists **OpenRouter** (US AI gateway) + its dynamically-routed, zero-data-retention inference providers as active sub-processors. |
| [RETENTION-POLICY.md](RETENTION-POLICY.md) | Data retention policy — states the retention window for each data category, the legal/business justification, and the automated enforcement mechanism in the codebase.                                                                                                                       |
| [GAP-ASSESSMENT.md](GAP-ASSESSMENT.md)     | Compliance gap assessment — maps the post-Phase-3 implementation against GDPR, UK GDPR, LGPD, and CCPA/CPRA requirements; identifies residual gaps and required human actions.                                                                                                               |
| [BREACH-RUNBOOK.md](BREACH-RUNBOOK.md)     | Personal data breach incident-response runbook — step-by-step detection, triage, containment, authority notification (72-hour GDPR deadline), and post-incident review procedure.                                                                                                            |
| [DPA-TEMPLATE.md](DPA-TEMPLATE.md)         | Data Processing Agreement template (GDPR Art. 28 / LGPD Art. 37) — must be signed with each sub-processor before they process personal data on the controller's behalf.                                                                                                                      |

---

## Human / Legal To-Do List

The items below **block genuine compliance**. Code alone cannot resolve them; each requires a
human decision, a lawyer, or a signed agreement.

### 1. Fill all `[BRACKETED]` business inputs

Every compliance doc contains placeholder values that must be completed with real information before
the document has any legal effect:

- `NEANDERTECH SERVICOS DE TECNOLOGIA LTDA` — the registered company or trading name that acts as data controller.
- `AV SETE DE SETEMBRO, 2775, REBOUÇAS - 80230-010 - Curitiba, Paraná - Brazil` — the controller's registered address (
  used in privacy notices and DPAs).
- `Brazil` — the jurisdiction whose law governs the DPA and ToS (e.g. "England and Wales").
- `contact@linkintothessi.com` — the email address data subjects use to exercise their rights (currently
  `contact@linkintothessi.com` in the UI — confirm this is monitored and correct).
- `Henriko Alberton` — contact details of the Data Protection Officer (if appointed) or the EU/UK representative (if
  required — see item 5 below).

These placeholders also appear in the `/privacy` and `/terms` landing pages.

### 2. Legal review of all DRAFT documents

Have a qualified privacy lawyer review:

- All six files in this folder (`DATA-INVENTORY.md`, `SUBPROCESSORS.md`, `RETENTION-POLICY.md`, `GAP-ASSESSMENT.md`,
  `BREACH-RUNBOOK.md`, `DPA-TEMPLATE.md`).
- The `/privacy` (GDPR/LGPD/US privacy notice) and `/terms` (Terms of Service) pages in `landing/`.
- The `/cookies` cookie policy page.

Remove the `> DRAFT` banner from each document only after a lawyer has signed off.

### 3. Sign a DPA with each active sub-processor

Use `DPA-TEMPLATE.md` as the starting point, but note:

- Convex, Stripe, Resend, and LinkedIn each have their own standard DPA. Accept / execute the
  vendor's DPA via their dashboard or legal portal (do **not** send them the template).
- Keep a signed copy on file for each vendor.

### 4. Confirm the lawful-basis posture

The ROPA lists a provisional basis for each processing activity. Before going live, a lawyer should
confirm:

- Whether **legitimate interest** (used for login audit logs, security monitoring) is defensible via a
  Legitimate Interests Assessment (LIA).
- Whether **contract performance** correctly covers the LinkedIn token storage and engagement actions.
- Whether any processing activity should instead rely on **consent** (and therefore require an opt-in
  UI gate before that processing starts).

### 5. Assess DPO and EU/UK representative requirements

- A **Data Protection Officer (DPO)** is mandatory under GDPR Art. 37 if the core activities involve
  large-scale systematic monitoring of individuals or large-scale processing of special-category data.
  Obtain legal advice on whether this threshold is met.
- An **EU representative** (GDPR Art. 27) is required if the controller is not established in the EU
  but offers services to EU residents. An **UK representative** (UK GDPR Art. 27) has an equivalent
  requirement for the UK.
- If either representative is required, appoint them and add their contact details to `Henriko Alberton` in all
  relevant documents.

### 6. Assess ANPD (Brazil) obligations

The `/privacy` page includes LGPD disclosures. Confirm with a Brazilian privacy lawyer whether:

- The volume of Brazilian users triggers active ANPD registration or reporting obligations.
- The lawful bases selected under LGPD (Art. 7) are appropriate and whether consent is required for
  any processing activity.
- A Data Protection Officer (Encarregado) must be appointed under LGPD Art. 41.

### 7. Keep the ROPA and sub-processor list in sync with the code

Whenever a new processing activity, data category, or third-party integration is added to the codebase:

1. Update `DATA-INVENTORY.md` with the new activity/category.
2. Update `SUBPROCESSORS.md` if a new vendor is introduced.
3. Update `RETENTION-POLICY.md` if a new data type has a different retention window.
4. Update `GAP-ASSESSMENT.md` if the change affects the compliance posture.

The mapping in `docs/PLATFORM.md` §21 ("Maintaining This Document") includes a reminder to keep
compliance docs in sync.

### 8. AI features — OpenRouter, zero data retention (dynamic provider routing)

The AI reaction/comment feature is **live in production**: prompts go to **OpenRouter** (US), which routes each request
to a downstream provider it selects, constrained in code to **zero data retention** + **no training** (cheapest
qualifying provider; e.g. DeepInfra — provider + region **not pinned**). Remaining human/legal: execute OpenRouter's
DPA,
confirm the ZDR / no-training terms flow down to its providers, and assess the transfer position given the non-pinned
region (add region constraints if needed). See `SUBPROCESSORS.md`, ROPA Activity 13, and GAP-ASSESSMENT item 10.

## Cross-references

- **Technical implementation:** `docs/PLATFORM.md` §13B (Privacy & Compliance machinery), §14 (app
  privacy UI), §15 (landing legal pages), §17 (security posture).
- **Implementation phases documented in the "Last updated" footer of** `docs/PLATFORM.md`.
