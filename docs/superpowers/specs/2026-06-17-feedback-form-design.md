# In-App Feedback Form — Design

**Date:** 2026-06-17
**Status:** Approved (pending spec review)
**Author:** Henriko + Claude

## 1. Summary

Add an in-app feedback feature so authenticated users can send free-text feedback
(max 4000 chars) tagged with a single category, and admins can read and **respond by
email** from a new Feedback tab in the admin panel. The reply is composed in-app, sent
through the existing Resend pipeline, and recorded against the feedback item.

Feedback is personal data, so it participates in the existing DSR export and
account-deletion flows.

## 2. Goals / Non-goals

**Goals**

- Floating "Send feedback" button, fixed bottom-right, on every authenticated page.
- Submission modal: single-select category + message (≤4000 chars) with a live counter.
- Admin Feedback tab: list, filter by status, respond by email, archive/reopen.
- Tracked responses: store the reply text, who replied, and when.
- Wire feedback into DSR export; on account deletion, **anonymize** feedback (retain the
  content, drop the submitter link) rather than hard-deleting it.

**Non-goals (YAGNI)**

- No multi-category tagging (single category, decided during brainstorming).
- No anonymous / landing-site feedback (authenticated users only).
- No threaded back-and-forth conversation — one admin reply per item (the user's reply
  goes to a human inbox via `Reply-To`, outside the app).
- No user-facing "my submitted feedback" history screen.

## 3. Decisions (resolved during brainstorming)

| Decision             | Choice                                                                        |
|----------------------|-------------------------------------------------------------------------------|
| Category selection   | **Single** (radio-style pills), stored as one string.                         |
| Response mechanism   | **In-app tracked reply** via existing `sendEmail`/Resend (Approach A).        |
| Human reply path     | New optional env var `FEEDBACK_REPLY_TO`, set as the email `Reply-To`.        |
| Submission throttle  | **10 submissions/hour** per user; admins exempt.                              |
| Status model         | `new` → `responded`, plus `archived` for items needing no reply.              |
| Admin panel language | English (consistent with the rest of `AdminPage`).                            |
| User widget language | i18n (en/pt/es), matching translated app surfaces.                            |
| Account deletion     | **Anonymize** — clear the submitter link (`userId`); retain feedback content. |

## 4. Data model

New `feedback` table in `convex/schema.ts`:

```ts
feedback: defineTable({
  userId: v.optional(v.id('users')), // submitter; set on submit, CLEARED on account deletion (anonymize)
  category: v.union(
    v.literal('feature_request'), v.literal('bug'), v.literal('comment'),
    v.literal('criticism'), v.literal('praise'), v.literal('question'),
    v.literal('suggestion'), v.literal('other')
  ),
  message: v.string(),              // 1–4000 chars, validated + trimmed server-side
  status: v.union(v.literal('new'), v.literal('responded'), v.literal('archived')),
  createdAt: v.number(),
  // Response tracking (set when an admin replies)
  responseText: v.optional(v.string()),
  respondedAt: v.optional(v.number()),
  respondedBy: v.optional(v.id('users')),
})
  .index('by_user', ['userId'])                 // export + locate rows to anonymize on deletion
  .index('by_status', ['status', 'createdAt'])  // admin triage, newest-first per status
```

Categories are stored as stable snake_case keys. Display labels come from i18n on the
user side and a constant map on the admin side.

## 5. Backend — `convex/feedback/` module

Mirrors the structure of `convex/privacy/`.

### `convex/feedback/feedback.ts`

- **`submitFeedback`** (mutation, user): `requireAuth` → validate category + message
  (non-empty after trim, ≤4000) → `checkRateLimit(ctx, userId, 'submitFeedback', 10)`
  (1-hour window; **skip for admins**, same pattern as `requestDataExport`) → insert row
  with `status: 'new'`, `createdAt: Date.now()`.
- **`listFeedback`** (query, admin): `requireAuth` + `assertAdmin` → bounded `take` on
  `by_status` / all → enrich each row with submitter `name` + `email` (so the admin sees
  who submitted and whether a reply is possible). Newest-first. Rows whose `userId` was
  cleared by anonymization (deleted account) surface as "(deleted user)" with no email,
  and Respond is disabled for them.
- **`respondToFeedback`** (mutation, admin): `assertAdmin` → validate reply text
  (non-empty, reasonable cap e.g. ≤4000) → patch `status: 'responded'`, `responseText`,
  `respondedAt`, `respondedBy` → `writeAuditLog({ actor: 'admin', actorId, action:
  'feedback.responded', targetUserId })` → `ctx.scheduler.runAfter(0,
  internal.feedback.feedback.sendFeedbackReply, { feedbackId })`.
- **`archiveFeedback` / `reopenFeedback`** (mutations, admin): flip `status` between
  `archived` and `new`/`responded` for items that need no reply (e.g. praise).
- **`sendFeedbackReply`** (internalAction): load submitter email + reply text via internal
  query → build template → `sendEmail({ to, subject, html, text, replyTo })`. Best-effort;
  failures logged, never block (matches the privacy email flows). No-ops if no email.

### `convex/feedback/emails.ts`

Pure template builder (no I/O), like `convex/privacy/emails.ts`:

```ts
feedbackReplyEmail({ replyText, originalMessage }): { subject, html, text }
```

Plain, operational copy — quotes the user's original message and includes the reply.

## 6. Email — `sendEmail` extension

Extend `convex/lib/email.ts`:

- Add optional `replyTo?: string` to `SendEmailArgs`.
- When present, forward it to Resend as `reply_to` in the request body.
- The feedback reply sets `replyTo` to `process.env.FEEDBACK_REPLY_TO` so the user's reply
  reaches a monitored human inbox while the outbound send + status tracking stay in-app.
- If `FEEDBACK_REPLY_TO` is unset, the email sends without the header (no breakage). This
  is the only new env var; like `RESEND_API_KEY`/`EMAIL_FROM`, absence degrades gracefully.

## 7. Frontend

All paths under `app/src/`.

- **`components/FeedbackButton.tsx`** — fixed bottom-right floating button, rendered once
  inside `RequireAuth` in `App.tsx` (so it shows on every authenticated page, not the
  landing site). Opens `FeedbackModal`.
- **`components/FeedbackModal.tsx`** — category as a row of single-select pills; textarea
  with a live `n/4000` counter; submit + cancel. Disables submit while empty or over the
  limit. On success: brief thank-you state, then close. Calls `api.feedback.submitFeedback`.
- **`components/Modal.tsx`** — add an optional `className` (or `size`) prop, defaulting to
  the current `max-w-sm`, so the feedback modal can be wider without duplicating the
  backdrop / Escape-key logic. Backward-compatible with all existing callers.
- **`pages/AdminPage.tsx`** — add a 4th tab: `settings | planLimits | users | feedback`.
- **`components/FeedbackTab.tsx`** — table of feedback: submitter name, category badge,
  status, date, message preview. Status filter pills (New / Responded / Archived / All).
  Row actions via `RowActionsMenu`: **Respond…**, **Archive** / **Reopen**. Mirrors
  `UsersTab.tsx`.
- **`components/RespondFeedbackModal.tsx`** — shows the original message read-only + a
  reply textarea. **Respond is disabled, with an inline note, when the submitter has no
  email on file.** Calls `api.feedback.respondToFeedback`.
- **i18n** — user-facing strings (button label, modal copy, the 8 category labels,
  validation/counter text, thank-you) added to `i18n/locales/{en,pt,es}.json` under a
  `feedback.*` key group. Admin tab strings stay inline English.

## 8. Privacy / compliance wiring (required)

- **Deletion** (`convex/privacy/deletion.ts`): feedback is **anonymized, not deleted**.
  Add a pseudonymization step to `cascadeDeleteUser` (mirroring the existing `auditLogs`
  step): query feedback `by_user` for the deleted user and `patch` each row clearing
  `userId` (→ `undefined`). The message, category, status, response, and timestamps are
  retained for product/aggregate use. Do **not** add feedback to the `OWNED` (hard-delete)
  array. `respondedBy` (an admin id) is left untouched; clearing it for the rare case
  where the deleted user was themselves an admin who replied is an explicit non-goal (it
  would require a new index for a low-value edge case — the admin trail is already
  pseudonymized in `auditLogs`).
- **Export** (`convex/privacy/export.ts`): add a `feedback` query in `gatherUserData`,
  add `feedback` to `ExportInput`, and include it in `buildExportBundle`.
- **Docs:**
    - `docs/PLATFORM.md`: new numbered section + Table-of-Contents entry + a Mermaid flow
      chart (submit → admin respond → email) per the "Maintaining This Document" mapping.
    - `docs/compliance/DATA-INVENTORY.md`: list feedback content as a personal-data category
      (purpose: product feedback / support; lawful basis: legitimate interest). Note that on
      account deletion it is anonymized (submitter link removed) rather than erased; flag the
      residual risk that the free-text message could, in rare cases, contain self-identifying
      content even after the link is cleared.
    - `docs/compliance/RETENTION-POLICY.md`: note feedback content is **retained in
      anonymized form** after account deletion (submitter link removed), like audit logs.

## 9. Testing

Follow the existing pure-helper + component test patterns:

- **Pure helpers:** message/category validation (empty, >4000, trim, invalid category);
  `feedbackReplyEmail` builder output; the category-key list.
- **Backend:** `submitFeedback` throttle + admin exemption; `respondToFeedback` sets
  status/fields and schedules the send; admin-guard rejection for non-admins;
  `cascadeDeleteUser` clears `userId` on the user's feedback rows while retaining the row
  and its content (anonymization), extending the existing `deletion.test.ts`.
- **Frontend:** `FeedbackModal` (counter, disabled states, submit) and `FeedbackTab` /
  `RespondFeedbackModal` (disabled-when-no-email), mirroring `UsersTab.test.tsx` and
  `ContactLimitsModal.test.tsx`.

## 10. New environment variable

| Var                 | Required? | Purpose                                                                                                     |
|---------------------|-----------|-------------------------------------------------------------------------------------------------------------|
| `FEEDBACK_REPLY_TO` | Optional  | `Reply-To` address on feedback reply emails so users can reply to a human. Unset ⇒ no header (still sends). |

## 11. Out of scope / future ideas

- User-facing "my feedback & responses" history view.
- Multi-category tagging.
- In-app notification when a feedback item is answered.
- Per-category routing to different inboxes.

## 12. Addendum (2026-06-17) — Reply history

**Change:** admins can reply to a feedback item **more than once**, and the admin Feedback
tab shows the **complete reply thread** (not just the latest reply). Resolves the single-
`responseText` overwrite behavior flagged in the final review.

**Decision (resolved):** the admin chooses **per reply** whether to email the submitter — a
"Send email to submitter" checkbox in the respond modal, default **on**, disabled when the
submitter has no email on file.

**Data model:** new `feedbackResponses` table — `{ feedbackId: v.id('feedback'),
responderId: v.id('users'), text: v.string(), createdAt: v.number() }`, index
`by_feedback: ['feedbackId','createdAt']`. This table is the single source of truth for
replies. The `feedback` row's `responseText`/`respondedAt`/`respondedBy` fields are
**retained as optional/deprecated** (no longer written) to avoid a schema-narrowing
migration; a one-time `backfillFeedbackResponses` internal mutation moves any existing
legacy reply into the new table and clears the legacy fields. (They can be dropped later
via the migration-helper once confirmed empty.)

**Backend:**

- `respondToFeedback(sessionToken, feedbackId, responseText, sendEmail)` **appends** a
  `feedbackResponses` row (no overwrite), sets `status:'responded'`, audits
  `feedback.responded`, and schedules the reply email **only when `sendEmail` is true**.
- `sendFeedbackReply` is keyed on the new `responseId` (emails that specific reply's text).
- `listFeedback` returns each item enriched with its ordered `responses`
  (`{ text, createdAt, responderName }[]`) instead of the single `responseText`.
- `reopenFeedback` decides `responded` vs `new` by whether the item has any responses.

**Frontend:** the Feedback tab renders the full reply thread under each item (each reply
with its timestamp/responder); `RespondFeedbackModal` shows the thread above the textarea
and adds the "Send email to submitter" checkbox. Admin UI stays inline English.

**Privacy:** the DSR export bundle includes the user's feedback responses
(`feedbackResponses` for their feedback items). On account deletion, responses reference
`feedbackId` (not the submitter), so they stay attached to the now-anonymized feedback —
consistent with "anonymize, retain content." `feedbackResponses` is not added to the
deletion `OWNED`/`ANONYMIZED` sets (it carries no submitter `userId`/`authorId`).
