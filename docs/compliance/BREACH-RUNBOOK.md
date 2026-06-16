> **DRAFT — requires legal review.**
> Last updated: 2026-06-16

# Personal Data Breach Incident-Response Runbook

This runbook governs [LEGAL_ENTITY_NAME]'s response to actual or suspected personal data breaches affecting data processed by the LinkIntoTheSSI platform. It is intended for internal operational and compliance use. All breach events must be handled in accordance with GDPR Article 33–34 and LGPD Article 48–49.

---

## Table of Contents

1. [Detection](#1-detection)
2. [Triage & Risk Assessment](#2-triage--risk-assessment)
3. [Containment & Remediation](#3-containment--remediation)
4. [Authority Notification](#4-authority-notification)
5. [Data-Subject Notification](#5-data-subject-notification)
6. [Record-Keeping](#6-record-keeping)
7. [Roles & Contacts](#7-roles--contacts)

---

## 1. Detection

A breach may be identified through any of the following channels:

### 1.1 Monitoring & Automated Alerts

- **Convex dashboard anomalies** — unusual query/mutation volumes, unexpected data-access patterns, or elevated error rates surfaced in the Convex dashboard or integrated observability tooling.
- **Application error logs** — server-side exceptions, authentication failures in bulk, or repeated 4xx/5xx patterns that may indicate exploitation.
- **Security scanning tools** — alerts from dependency audit pipelines (e.g., `npm audit`, GitHub Dependabot) flagging critical CVEs in production dependencies.
- **Stripe / Resend / Apify webhook failures** — anomalous webhook payloads or unexpected credential rejection may signal token compromise.

### 1.2 User or Customer Reports

- A user reports unexpected access to their account, unexpected LinkedIn actions, or receipt of emails they did not request.
- A business customer (controller) reports suspicious activity attributable to the platform.

### 1.3 Sub-Processor Notifications

Sub-processors listed in `docs/compliance/SUBPROCESSORS.md` (Convex, LinkedIn, Stripe, Resend, Apify, Vercel) may notify [LEGAL_ENTITY_NAME] of a security incident on their side. Any such notification must be escalated immediately to [INCIDENT_OWNER].

### 1.4 Initial Recording

Upon any detection signal, [INCIDENT_OWNER] must:

1. Record the date and time of first awareness.
2. Open a new entry in the internal breach log (see Section 6).
3. Proceed immediately to triage (Section 2).

---

## 2. Triage & Risk Assessment

### 2.1 Assess Risk to Data Subjects' Rights and Freedoms

Evaluate the incident against the following factors:

| Factor | Questions to answer |
|---|---|
| **Nature of breach** | Confidentiality (unauthorised access), integrity (data altered), or availability (data destroyed/unavailable)? |
| **Types of personal data** | Names, email addresses, LinkedIn tokens, profile data, Stripe customer IDs, usage logs? |
| **Volume** | How many data subjects and records are potentially affected? |
| **Sensitivity** | Does the data include special-category data, financial data, or credentials with access to third-party accounts (LinkedIn OAuth tokens)? |
| **Consequences** | Could affected individuals suffer identity theft, financial loss, reputational damage, discrimination, or loss of control over their LinkedIn presence? |
| **Mitigating factors** | Was the data encrypted at rest and in transit? Are tokens already rotated? Is Convex field-level encryption in use for the affected data? |

### 2.2 Severity Levels

| Severity | Criteria | Default Notification Threshold |
|---|---|---|
| **LOW** | Affects a small number of records, no sensitive data, no apparent harm to data subjects, fully contained. | Internal record only; no regulatory notification required unless risk rises on review. |
| **MEDIUM** | Affects a meaningful number of data subjects or includes data types that could enable harm (e.g., email addresses at scale, LinkedIn profile data); harm is possible but not probable. | Evaluate authority notification; notify supervisory authority if in doubt. |
| **HIGH** | Involves credentials (LinkedIn OAuth tokens, API keys), financial data, special-category data, or a large number of data subjects; harm to rights and freedoms is likely. | **Notify supervisory authority within 72 hours (Art. 33 GDPR / LGPD Art. 48). Notify affected data subjects without undue delay (Art. 34 GDPR).** |

If severity cannot be conclusively determined within 2 hours of awareness, treat the incident as HIGH until evidence to the contrary is established.

---

## 3. Containment & Remediation

Take the following actions in order of urgency. Document each action and its timestamp in the breach log.

### 3.1 Revoke Active Sessions

Force-logout all active user sessions to prevent ongoing unauthorized access:

- In the Convex backend, invoke the `users.forceLogoutAll` mutation (or equivalent session-deletion logic) to invalidate all session tokens in the `sessions` table for affected users.
- If targeting specific users, query affected user IDs and delete their session documents individually.

### 3.2 Null or Rotate LinkedIn OAuth Tokens

LinkedIn access tokens stored in Convex (e.g., on user documents) grant direct access to users' LinkedIn accounts. If these tokens may have been exposed:

1. Set the `linkedinAccessToken` (and `linkedinRefreshToken` if applicable) fields to `null` for affected user records in Convex.
2. Contact LinkedIn Developer Support to invalidate the application's OAuth grants if the client secret is compromised.
3. Inform affected users that they must re-authenticate via LinkedIn (see Section 5 for notification template).

### 3.3 Rotate Application Secrets

Rotate all secrets that may have been exposed, in this order of priority:

| Secret | Rotation Action |
|---|---|
| **LinkedIn Client Secret** | Regenerate in the LinkedIn Developer Portal; update `LINKEDIN_CLIENT_SECRET` environment variable in Convex and Vercel. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Roll keys in the Stripe Dashboard; update `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Convex and Vercel. |
| `RESEND_API_KEY` | Regenerate in the Resend dashboard; update in Convex and Vercel. |
| **Convex deploy key** | Rotate via the Convex dashboard (Project Settings → Deploy Keys); update in CI/CD pipelines and Vercel. |
| **Apify API token** | Rotate in the Apify console; update `APIFY_API_TOKEN` in Convex and Vercel. |

After rotating, redeploy the Convex backend and Vercel frontend to pick up the new values.

### 3.4 Patch & Redeploy

If the breach stems from a vulnerability in application code or a dependency:

1. Identify and apply the patch (code fix or dependency upgrade).
2. Run the full test suite.
3. Deploy to production via the standard pipeline.
4. Verify the vulnerability is closed before considering the incident contained.

### 3.5 Preserve Evidence

Before any destructive remediation step, export or snapshot relevant Convex logs, query history, and access records for forensic purposes. Do not overwrite or delete logs that may be needed for investigation or regulatory inquiry.

---

## 4. Authority Notification

### 4.1 GDPR — Article 33

**[LEGAL_ENTITY_NAME] must notify `[SUPERVISORY_AUTHORITY]` within 72 hours of becoming aware of a personal data breach**, unless the breach is unlikely to result in a risk to the rights and freedoms of natural persons.

- The 72-hour clock starts from the moment [LEGAL_ENTITY_NAME] — or any staff member or processor acting on its behalf — first becomes aware of the incident.
- If notification cannot be made within 72 hours, it must still be submitted as soon as possible, with a reasoned explanation for the delay.

**The notification must include (Art. 33(3)):**

1. **Nature of the breach** — type (confidentiality, integrity, availability), how it occurred, and the systems involved.
2. **Categories and approximate number of data subjects** affected.
3. **Categories and approximate number of personal data records** affected (e.g., email addresses, LinkedIn tokens, Stripe customer IDs).
4. **Name and contact details** of the Data Protection Officer or other privacy contact: [PRIVACY_CONTACT_EMAIL].
5. **Likely consequences** of the breach for data subjects.
6. **Measures taken or proposed** to address the breach and mitigate its effects.

Where all required information is not yet available, it may be provided in phases (Art. 33(4)) — submit an initial notification within 72 hours and supplement it as the investigation progresses.

### 4.2 LGPD — Article 48

Under Brazil's Lei Geral de Proteção de Dados, [LEGAL_ENTITY_NAME] must notify the **ANPD (Autoridade Nacional de Proteção de Dados)** and affected data subjects of a breach that may result in risk or relevant harm to data subjects. The LGPD notification should mirror the content required under Art. 33 GDPR. Submit via the ANPD's official notification portal.

### 4.3 Notification Checklist

- [ ] Breach log entry created with date/time of awareness.
- [ ] Severity assessed (Section 2.2).
- [ ] 72-hour clock tracked from time of awareness.
- [ ] Draft notification prepared using Art. 33(3) content requirements above.
- [ ] Notification submitted to `[SUPERVISORY_AUTHORITY]` (and ANPD if LGPD applies).
- [ ] Confirmation / reference number from authority recorded in breach log.
- [ ] Supplementary notifications filed if initial notification was incomplete.

---

## 5. Data-Subject Notification

### 5.1 When Notification Is Required

Under **GDPR Article 34**, [LEGAL_ENTITY_NAME] must notify affected data subjects **without undue delay** when a breach is likely to result in a **high risk** to their rights and freedoms (e.g., exposure of LinkedIn OAuth tokens, financial data, or credentials enabling identity theft or account takeover).

Under **LGPD Article 48**, affected data subjects must be notified when the breach may cause relevant harm to them.

Notification is not required if:
- The personal data was rendered unintelligible (e.g., encrypted with keys not compromised).
- [LEGAL_ENTITY_NAME] has taken subsequent measures that ensure high risk is no longer likely to materialise.
- Notification would involve disproportionate effort (in which case a public communication or equivalent measure may be substituted — confirm with legal counsel).

### 5.2 Notification Method

Use the `email` field stored on each affected user's Convex document to send notification via **Resend** (once any compromised Resend API key has been rotated). If the Resend credential itself is the subject of the breach, use an alternative transactional email provider for the notification send.

### 5.3 Breach-Notice Email Template

---

**Subject:** Important security notice regarding your [LEGAL_ENTITY_NAME] account

**From:** [PRIVACY_CONTACT_EMAIL]

**To:** [AFFECTED_USER_EMAIL]

---

Dear [USER_FIRST_NAME],

We are writing to inform you of a security incident that may have affected your [LEGAL_ENTITY_NAME] account.

**What happened**

On or around [DATE_INCIDENT_OCCURRED], we became aware that [BRIEF_DESCRIPTION_OF_BREACH — e.g., "unauthorised access to our user database may have exposed certain account information"]. We discovered this on [DATE_DISCOVERED].

**What information was involved**

The following types of information relating to your account may have been affected:

- [LIST_DATA_TYPES — e.g., your name, email address, LinkedIn profile data, and/or LinkedIn access credentials stored in our system]

**What we have done**

We have taken the following steps to address the incident and protect your account:

- [ACTION_1 — e.g., Invalidated all existing LinkedIn access tokens. You will need to re-connect your LinkedIn account when you next log in.]
- [ACTION_2 — e.g., Forced logout of all active sessions. Please log in again using your usual credentials.]
- [ACTION_3 — e.g., Rotated all application security credentials and redeployed our platform.]

**What you should do**

We recommend you take the following steps:

1. **Change your password** — if you use the same password elsewhere, change it on those services too.
2. **Review your LinkedIn account** for any unexpected activity or third-party app authorisations you do not recognise.
3. **Be alert to phishing** — we will never ask for your password or full card number by email.

If you have any questions or concerns, please contact us at [PRIVACY_CONTACT_EMAIL].

We sincerely apologise for any concern or inconvenience this incident may cause.

Yours sincerely,

[INCIDENT_OWNER]
[LEGAL_ENTITY_NAME]
[PRIVACY_CONTACT_EMAIL]

---

*(This message was sent to [AFFECTED_USER_EMAIL] because you hold an account with [LEGAL_ENTITY_NAME].)*

---

---

## 6. Record-Keeping

[LEGAL_ENTITY_NAME] must maintain a written record of **all** personal data breaches under GDPR Article 33(5), regardless of whether the breach required notification to a supervisory authority or data subjects.

### 6.1 Internal Breach Log

Maintain a breach log document (stored securely and accessible only to authorised staff). Each entry must include:

| Field | Description |
|---|---|
| **Incident ID** | Unique reference (e.g., `BREACH-YYYY-NNN`). |
| **Date/time of awareness** | When [LEGAL_ENTITY_NAME] first became aware. |
| **Date/time of occurrence** | When the breach occurred or is estimated to have occurred. |
| **Description** | Nature of the breach (confidentiality, integrity, availability), how it was discovered, and affected systems. |
| **Data types affected** | Categories of personal data involved (e.g., email, LinkedIn tokens, Stripe IDs). |
| **Approximate number of data subjects** | Best available estimate. |
| **Approximate number of records** | Best available estimate. |
| **Severity level** | LOW / MEDIUM / HIGH (per Section 2.2). |
| **Containment actions taken** | Summary of actions and timestamps (Section 3). |
| **Authority notification** | Date submitted, authority notified, reference number received, whether phased notifications were filed. |
| **Data-subject notification** | Whether required; date sent; method used. |
| **Outcome & lessons learned** | Root cause, whether fully remediated, process improvements identified. |
| **Record owner** | Name of [INCIDENT_OWNER] who managed this incident. |

### 6.2 Retention

Breach log entries must be retained for a minimum of **5 years** from the date of the incident, in line with general compliance record-keeping obligations.

---

## 7. Roles & Contacts

| Role | Contact |
|---|---|
| **Incident Owner** (primary responder, accountable for runbook execution and regulatory notifications) | [INCIDENT_OWNER] |
| **Privacy Contact** (DPO or equivalent; named in regulatory notifications) | [PRIVACY_CONTACT_EMAIL] |
| **Supervisory Authority** (GDPR) | [SUPERVISORY_AUTHORITY] |
| **ANPD** (LGPD — Brazil) | https://www.gov.br/anpd |
| **Convex support** | https://www.convex.dev/support |
| **LinkedIn Developer Support** | https://developer.linkedin.com/support |
| **Stripe support** | https://support.stripe.com |
| **Resend support** | https://resend.com/support |
| **Apify support** | https://apify.com/contact |
| **Vercel support** | https://vercel.com/support |

---

*This runbook must be reviewed and updated at least annually, and after every significant breach event. Updates require sign-off from [INCIDENT_OWNER] and, where available, legal counsel.*
