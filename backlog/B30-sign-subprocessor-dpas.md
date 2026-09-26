# B30 — ⚖️ Sign sub-processor DPAs (incl. OpenRouter)

> **Status:** TODO · **Priority:** P1 · **Effort:** M · **Category:** Legal (⚖️ human/legal — engineering only if region-pinning is required)
> **Depends on:** — · **Blocks:** Go-live under GDPR Art. 28 / LGPD Art. 37 (processing personal data via a sub-processor without a DPA is a breach)

## Summary

Under GDPR Art. 28 (and LGPD Art. 37) the controller must have a signed Data Processing Agreement with **every**
sub-processor before it processes personal data on the controller's behalf. The active production sub-processors are
**Convex, Stripe, Resend, LinkedIn, and OpenRouter**. Four have standard vendor DPAs to accept; **OpenRouter** needs
extra diligence because it **dynamically routes each request to a downstream inference provider whose identity and region
are not pinned**, so the zero-data-retention / no-training terms and the international-transfer position must be
confirmed to flow down. This is a **human/legal** task; the only possible engineering follow-up is pinning provider/region
in code if counsel requires it.

## Evidence

- `docs/compliance/README.md:60-66` — Human/Legal item **3 "Sign a DPA with each active sub-processor"**: Convex,
  Stripe, Resend, LinkedIn each have their own standard DPA — accept/execute via the vendor portal (do **not** send the
  template); keep a signed copy per vendor.
- `docs/compliance/README.md:111-118` — Human/Legal item **8**: the AI feature is **live in prod** via **OpenRouter**
  (US) with zero data retention + no training constrained **in code**; remaining human/legal = execute OpenRouter's DPA,
  confirm ZDR/no-training flows down to its providers, and assess the transfer position given the non-pinned region.
- `docs/compliance/README.md:20` (index) and `SUBPROCESSORS.md` — the sub-processor set is **Convex, Stripe, LinkedIn,
  Resend, OpenRouter** (+ OpenRouter's dynamically-routed ZDR inference providers). **Apify is NOT listed** and must
  **not** be added — it is DEV/LOCAL-ONLY LinkedIn-post scraping, not a production sub-processor.
- `docs/PLATFORM.md §11A:1301-1310` — the seam `convex/ai/openrouter.ts` constrains routing (not env-overridable) to
  providers honouring `zdr: true` + `data_collection: "deny"`, then OpenRouter picks the cheapest qualifying provider
  (`:floor`); **the downstream provider (e.g. DeepInfra) and its region are selected per request, not pinned**, so region
  is not guaranteed and the controller relies on OpenRouter's DPA flowing down. §11A:1308-1310 restates the human/legal
  actions (execute DPA, confirm flow-down, assess transfer, add region constraints if needed).
- `convex/ai/openrouter.ts` — the code-level ZDR/no-training enforcement the signed DPA must match (the contract has to
  back what the code already asserts).

## Root cause

DPAs are contracts a vendor signs, not code — engineering cannot self-serve them. OpenRouter's design (dynamic,
per-request provider routing across non-region-pinned providers) leaves the transfer/region posture legally open until
its DPA and downstream flow-down are confirmed in writing.

## What we need to do

1. **(Human/legal)** Execute/accept each vendor's **standard DPA** via their legal portal/dashboard and file a signed
   copy: **Convex, Stripe, Resend, LinkedIn**. Do not send them `DPA-TEMPLATE.md`.
2. **(Human/legal)** Execute **OpenRouter's** DPA. Obtain written confirmation that **zero-data-retention + no-training**
   terms **flow down** to the downstream inference providers OpenRouter routes to (which are not pinned).
3. **(Human/legal)** Assess the **international-transfer position** for OpenRouter's non-pinned downstream region
   (SCCs / adequacy / UK IDTA / LGPD international-transfer basis as applicable). Decide whether region constraints are
   required.
4. **(ENGINEERING follow-up, only if step 3 requires it)** Add provider/region constraints to the routing preferences in
   `convex/ai/openrouter.ts` (e.g. an allow-list or `order`/region pin alongside the existing `zdr`/`data_collection`
   constraints). Note this narrows or removes the `:floor` cheapest-provider selection and can affect cost/availability —
   update `docs/PLATFORM.md §11A` accordingly.
5. **(ENGINEERING/docs)** Once each DPA is signed, update `docs/compliance/SUBPROCESSORS.md` with signed status + date +
   DPA version; update ROPA **Activity 13** (`DATA-INVENTORY.md`) and **GAP-ASSESSMENT item 10** if the posture changes.

## Acceptance criteria

- [ ] Signed DPA on file for **Convex, Stripe, Resend, LinkedIn, OpenRouter** (five vendors).
- [ ] OpenRouter ZDR + no-training **flow-down** confirmed in writing to its downstream providers.
- [ ] International-transfer position for OpenRouter's non-pinned region assessed and documented; region constraints
      added to `convex/ai/openrouter.ts` **iff** counsel requires them.
- [ ] `docs/compliance/SUBPROCESSORS.md` updated with signed status/date per vendor (still no Apify).
- [ ] `pnpm verify` is green **iff** `convex/ai/openrouter.ts` was changed (docs-only edits do not affect it).
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Apify must never be added to the sub-processor / DPA list** — dev/local-only, not a prod sub-processor (project
  policy).
- OpenRouter's non-region-pinned downstream providers create EU/UK/Brazil transfer exposure. If counsel mandates region
  pinning, the `:floor` cheapest-provider routing narrows — expect higher cost and/or reduced availability; the change is
  a small edit to the routing options in `convex/ai/openrouter.ts` but changes runtime behaviour.
- The signed DPA must not contradict the code's ZDR/no-training assertion — if a vendor's standard DPA permits training
  or retention, the code constraint alone is not sufficient; escalate.
- Open question: does LinkedIn's data-processing role here count as a sub-processor (of the user's own data) or an
  independent controller? Confirm with counsel so `SUBPROCESSORS.md` classifies it correctly.

## Docs to update

- `docs/PLATFORM.md` §11A — update the transfer posture / region-constraint state if step 4 changes routing; §17
  (security) if the sub-processor security posture changes.
- `docs/compliance/SUBPROCESSORS.md`, `DATA-INVENTORY.md` (Activity 13), `GAP-ASSESSMENT.md` (item 10) — signed status
  and any posture change.

## References

- Related: [[B29]] [[B31]]
- Prior art / plan: `docs/compliance/README.md` (items 3 & 8), `docs/PLATFORM.md §11A`
