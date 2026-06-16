> **DRAFT — requires legal review.**
> Last updated: 2026-06-16

> **TEMPLATE NOTICE:** This document is a template only. It does not constitute legal advice and must be reviewed, adapted, and executed by qualified legal counsel before use as a binding agreement. All bracketed placeholders (`[LIKE_THIS]`) must be completed before signature.

# Data Processing Agreement (DPA) Template

_Pursuant to Article 28 of Regulation (EU) 2016/679 (GDPR) and, where applicable, Article 37 of Brazil's Lei Geral de Proteção de Dados (LGPD)_

---

## Table of Contents

1. [Parties](#1-parties)
2. [Definitions](#2-definitions)
3. [Subject-Matter, Nature, Purpose, and Duration of Processing](#3-subject-matter-nature-purpose-and-duration-of-processing)
4. [Types of Personal Data and Categories of Data Subjects](#4-types-of-personal-data-and-categories-of-data-subjects)
5. [Controller Instructions](#5-controller-instructions)
6. [Confidentiality](#6-confidentiality)
7. [Security Measures (Article 32 GDPR)](#7-security-measures-article-32-gdpr)
8. [Sub-Processor Terms](#8-sub-processor-terms)
9. [Assistance with Data-Subject Requests](#9-assistance-with-data-subject-requests)
10. [Assistance with Breach Notification](#10-assistance-with-breach-notification)
11. [Deletion or Return of Data on Termination](#11-deletion-or-return-of-data-on-termination)
12. [Audit and Inspection Rights](#12-audit-and-inspection-rights)
13. [International Transfers](#13-international-transfers)
14. [Liability](#14-liability)
15. [Governing Law and Jurisdiction](#15-governing-law-and-jurisdiction)
16. [Entire Agreement and Amendments](#16-entire-agreement-and-amendments)
17. [Signatures](#17-signatures)

---

## 1. Parties

This Data Processing Agreement ("**Agreement**") is entered into as of [EFFECTIVE_DATE] between:

**Controller:**
[CONTROLLER] (legal entity name)
Registered address: [CONTROLLER_ADDRESS]
Company registration number: [CONTROLLER_REG_NO]
Contact for data protection matters: [CONTROLLER_DPO_EMAIL]
(hereinafter "**Controller**")

and

**Processor:**
[PROCESSOR] (legal entity name)
Registered address: [PROCESSOR_ADDRESS]
Company registration number: [PROCESSOR_REG_NO]
Contact for data protection matters: [PRIVACY_CONTACT_EMAIL]
(hereinafter "**Processor**")

The Controller and Processor are referred to individually as a "**Party**" and collectively as the "**Parties**".

This Agreement is incorporated into and forms part of the [MASTER_SERVICE_AGREEMENT / TERMS_OF_SERVICE] between the Parties dated [MSA_DATE] (the "**Principal Agreement**").

---

## 2. Definitions

In this Agreement, the following terms have the meanings set out below. All other capitalised terms used but not defined here have the meanings given to them in the Principal Agreement or in the GDPR.

| Term                                    | Meaning                                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **GDPR**                                | Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 on the protection of natural persons with regard to the processing of personal data.               |
| **LGPD**                                | Lei Geral de Proteção de Dados (Brazilian Federal Law No. 13,709/2018), as amended.                                                                                                        |
| **Applicable Data Protection Law**      | The GDPR, LGPD, and any other data protection or privacy laws applicable to the processing described in this Agreement.                                                                    |
| **Personal Data**                       | Any information relating to an identified or identifiable natural person, as defined under Applicable Data Protection Law.                                                                 |
| **Processing**                          | Any operation or set of operations performed on Personal Data, as defined under Applicable Data Protection Law.                                                                            |
| **Data Subject**                        | An identified or identifiable natural person whose Personal Data is processed under this Agreement.                                                                                        |
| **Sub-Processor**                       | Any processor engaged by the Processor to carry out specific processing activities on behalf of the Controller.                                                                            |
| **Security Incident**                   | Any confirmed or reasonably suspected breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or access to, Personal Data.     |
| **Standard Contractual Clauses (SCCs)** | The standard contractual clauses for the transfer of personal data to third countries adopted by the European Commission under GDPR Article 46(2)(c) or (d), as updated from time to time. |

---

## 3. Subject-Matter, Nature, Purpose, and Duration of Processing

### 3.1 Subject-Matter

The Processor provides the Controller with access to the LinkIntoTheSSI platform, which enables [BRIEF_DESCRIPTION_OF_SERVICE — e.g., LinkedIn profile enrichment, lead management, and outreach automation]. In connection with providing this service, the Processor processes Personal Data on behalf of the Controller.

### 3.2 Nature of Processing

The Processing activities covered by this Agreement include:

- Collection, storage, and retrieval of Personal Data in the Convex database.
- Transmission of Personal Data to and from LinkedIn's API using OAuth 2.0 tokens held on behalf of Data Subjects.
- Enrichment of Personal Data via third-party data providers (Apify) as instructed by the Controller.
- Processing of payment-related identifiers via Stripe for billing purposes.
- Sending transactional emails to Data Subjects via Resend on the Controller's instruction.

### 3.3 Purpose of Processing

The Processor processes Personal Data solely for the purpose of providing the services described in the Principal Agreement and as further specified in the Controller's written instructions (Section 5). The Processor will not process Personal Data for any other purpose without the Controller's prior written consent, unless required to do so by Applicable Data Protection Law.

### 3.4 Duration

This Agreement commences on the Effective Date and remains in force for the duration of the Principal Agreement, unless terminated earlier in accordance with this Agreement. Obligations concerning deletion or return of data upon termination are set out in Section 11.

---

## 4. Types of Personal Data and Categories of Data Subjects

### 4.1 Types of Personal Data

The following categories of Personal Data are processed under this Agreement:

- **Identity data:** first name, last name, LinkedIn profile name, profile photo URL.
- **Contact data:** email address, LinkedIn public profile URL.
- **Professional data:** job title, employer, LinkedIn headline, summary, work history (as available via the LinkedIn API).
- **Authentication credentials:** LinkedIn OAuth access tokens and refresh tokens; platform session tokens.
- **Usage data:** login timestamps, feature-usage logs, IP addresses.
- **Billing identifiers:** Stripe customer ID and subscription status (no payment card numbers are stored by the Processor).
- **Enrichment data:** additional LinkedIn profile data retrieved via Apify as directed by the Controller.

### 4.2 Categories of Data Subjects

The Personal Data described above relates to the following categories of Data Subjects:

- **End users** of the Controller's account on the platform (individuals who authenticate via LinkedIn OAuth and use the service).
- **LinkedIn contacts and prospects** whose profile data is retrieved and stored at the direction of the Controller.

### 4.3 Special-Category Data

The Processor does not intentionally collect special-category personal data (as defined in GDPR Article 9) or data relating to criminal convictions. The Controller must not instruct the Processor to process such data without entering into a separate written agreement addressing the additional requirements of GDPR Article 9(2).

---

## 5. Controller Instructions

### 5.1 General Instruction

The Processor must process Personal Data only on documented instructions from the Controller, including with regard to transfers of Personal Data to a third country or an international organisation, unless required to do so by Applicable Data Protection Law. In such a case, the Processor must inform the Controller of that legal requirement before processing, unless that law prohibits such information on grounds of public interest.

### 5.2 Scope of Instructions

The Controller's initial and continuing instruction is for the Processor to process Personal Data as necessary to provide the services described in the Principal Agreement. Additional or amended instructions must be provided in writing and are subject to agreement between the Parties.

### 5.3 Unlawful Instructions

The Processor must immediately inform the Controller if it believes any instruction infringes Applicable Data Protection Law. In such circumstances, the Processor may suspend performance of the relevant instruction pending resolution.

---

## 6. Confidentiality

### 6.1 Obligation of Confidence

The Processor must ensure that all persons authorised to process the Controller's Personal Data are subject to a binding obligation of confidentiality (whether contractual or statutory) with respect to the Personal Data.

### 6.2 Access Restriction

The Processor must limit access to Personal Data to those personnel who need access in order to perform the services, and must ensure that any such personnel are made aware of their obligations under this Agreement.

### 6.3 Survival

The confidentiality obligations in this Section survive termination of this Agreement.

---

## 7. Security Measures (Article 32 GDPR)

### 7.1 Obligation

Taking into account the state of the art, the costs of implementation, and the nature, scope, context, and purposes of processing as well as the risks of varying likelihood and severity for the rights and freedoms of natural persons, the Processor must implement and maintain appropriate technical and organisational measures to ensure a level of security appropriate to the risk, including as appropriate:

- (a) the pseudonymisation and encryption of Personal Data;
- (b) the ability to ensure the ongoing confidentiality, integrity, availability, and resilience of processing systems and services;
- (c) the ability to restore the availability and access to Personal Data in a timely manner in the event of a physical or technical incident;
- (d) a process for regularly testing, assessing, and evaluating the effectiveness of technical and organisational measures for ensuring the security of the processing.

### 7.2 Current Measures

The Processor's current technical and organisational security measures include, without limitation:

| Measure                 | Implementation                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Encryption in transit   | TLS 1.2+ enforced across all platform endpoints and API calls.                                                       |
| Encryption at rest      | Convex database encryption at rest; field-level encryption for sensitive tokens where implemented.                   |
| Access control          | Role-based access control in Convex; principle of least privilege applied to all service accounts and API keys.      |
| Credential management   | All API secrets (LinkedIn, Stripe, Resend, Apify, Convex deploy key) stored as environment variables; not hardcoded. |
| SSRF and URL validation | Server-side URL validation guards against server-side request forgery.                                               |
| Session management      | Session tokens stored in Convex `sessions` table; force-logout capability available via `users.forceLogoutAll`.      |
| Dependency security     | Regular `npm audit` and Dependabot alerts; critical CVEs addressed before production deployment.                     |
| Incident response       | Personal data breach runbook maintained and tested at least annually.                                                |

The Processor may update these measures from time to time, provided that any such updates do not materially reduce the overall level of security.

### 7.3 Security Incident Notification

The Processor must notify the Controller of a Security Incident affecting the Controller's Personal Data **without undue delay, and in any event within 48 hours** of becoming aware, to enable the Controller to meet its own notification obligations under GDPR Article 33. Notification must be made to [CONTROLLER_DPO_EMAIL] and must include, to the extent then known, the nature of the incident, the data and Data Subjects affected, and the measures taken or proposed.

---

## 8. Sub-Processor Terms

### 8.1 General Authorisation

The Controller grants the Processor general written authorisation to engage the sub-processors listed in **Schedule A** to this Agreement (the "**Approved Sub-Processors**"). Before the commencement of processing, the Processor must ensure that each Approved Sub-Processor is bound by written data processing terms that impose materially the same obligations as those set out in this Agreement.

### 8.2 New or Replacement Sub-Processors

The Processor must notify the Controller **at least 30 days in advance** of any intended addition or replacement of an Approved Sub-Processor. The notification must describe the sub-processor, its location, and the processing it will carry out. The Controller may object to the change on reasonable data protection grounds within 14 days of receipt of notice. If the Parties cannot resolve a reasonable objection, either Party may terminate the relevant part of the Principal Agreement on written notice.

### 8.3 Flow-Down of Obligations

The Processor must impose data protection obligations on each Sub-Processor that provide at minimum the same level of protection for Personal Data as those imposed on the Processor under this Agreement. The Processor remains fully liable to the Controller for the performance of any Sub-Processor's obligations.

### 8.4 Current Approved Sub-Processors

See Schedule A. The authoritative list is also maintained in `docs/compliance/SUBPROCESSORS.md`.

---

## 9. Assistance with Data-Subject Requests

### 9.1 Cooperation

Taking into account the nature of the processing, the Processor must assist the Controller by appropriate technical and organisational measures, insofar as this is possible, for the fulfilment of the Controller's obligation to respond to requests by Data Subjects exercising their rights under Applicable Data Protection Law (including rights of access, rectification, erasure, restriction, portability, and objection).

### 9.2 Forwarding Requests

If a Data Subject contacts the Processor directly with a request relating to their Personal Data, the Processor must promptly forward that request to the Controller and must not respond to it directly except to acknowledge receipt, unless authorised in writing by the Controller.

### 9.3 Data Export and Deletion

The Processor will provide the Controller with the ability to export and/or delete a Data Subject's Personal Data from the platform (including all Convex documents referencing that Data Subject) within a reasonable timeframe and in a commonly used, machine-readable format upon written request.

---

## 10. Assistance with Breach Notification

### 10.1 Processor Assistance

The Processor must assist the Controller in ensuring compliance with the obligations under GDPR Articles 32–34 and LGPD Articles 46–48, including:

- (a) providing timely, accurate information about any Security Incident as set out in Section 7.3;
- (b) cooperating with the Controller's investigation of any Security Incident;
- (c) implementing and documenting remediation actions;
- (d) providing all information necessary for the Controller to notify the competent supervisory authority and affected Data Subjects as required.

### 10.2 No Admission

Nothing in this Section requires the Processor to make any admission of liability or waive any legal privilege. Breach notification assistance is a compliance obligation, not an acknowledgement of fault.

---

## 11. Deletion or Return of Data on Termination

### 11.1 Obligation

Upon expiry or termination of the Principal Agreement (and therefore of this Agreement), the Processor must, at the Controller's election (communicated in writing within 30 days of termination):

- (a) **Return** all Personal Data to the Controller in a commonly used, machine-readable format; or
- (b) **Delete** all Personal Data from its systems (including all Convex databases and backups, to the extent technically feasible).

### 11.2 Confirmation

The Processor must provide written confirmation to the Controller that deletion or return has been completed within 60 days of the election.

### 11.3 Legal Retention

The Processor may retain Personal Data for longer only to the extent and for so long as required by Applicable Data Protection Law, and must inform the Controller of any such retention obligation. Such retained data remains subject to the obligations of this Agreement.

### 11.4 Sub-Processor Data

The Processor must ensure that, upon termination, Sub-Processors are instructed to delete or return Personal Data in accordance with this Section.

---

## 12. Audit and Inspection Rights

### 12.1 Right to Audit

The Controller has the right to conduct or commission an audit of the Processor's data processing activities and compliance with this Agreement, on reasonable prior written notice (not less than 30 days except in the case of a suspected Security Incident), no more than once per calendar year (unless a Security Incident or a regulatory audit warrants otherwise).

### 12.2 Audit Reports

In the first instance, the Processor may satisfy an audit request by providing the Controller with relevant certifications, third-party audit reports (e.g., SOC 2 Type II, ISO 27001), or responses to a standard security questionnaire. On-site audits or access to Processor systems will be agreed between the Parties and will be subject to appropriate confidentiality protections.

### 12.3 Cost

Audit costs will be borne by the Controller unless the audit reveals material non-compliance, in which case the Processor will bear its own reasonable costs.

---

## 13. International Transfers

### 13.1 EEA-Origin Data

Where Personal Data originates in the European Economic Area (EEA) and is transferred to a country outside the EEA that has not been subject to an adequacy decision under GDPR Article 45, the Parties agree to enter into the applicable European Commission Standard Contractual Clauses (SCCs) as a mechanism for lawful transfer. The appropriate SCC module (Controller-to-Processor or Processor-to-Processor) will be appended as **Schedule B**.

### 13.2 Sub-Processor Transfers

Where an Approved Sub-Processor processes EEA-origin Personal Data in a country without an adequacy decision, the Processor must ensure that an appropriate transfer mechanism (such as SCCs or, where available, an adequacy decision) is in place before the transfer commences.

### 13.3 UK GDPR

Where Personal Data originates in the United Kingdom, the Parties will comply with the UK International Data Transfer Agreement (IDTA) or equivalent addendum, as required.

### 13.4 LGPD Transfers

Where Personal Data originates in Brazil and is transferred outside Brazil, the transfer must comply with LGPD Chapter V requirements. [SPECIFY APPLICABLE TRANSFER MECHANISM — e.g., ANPD-approved standard clauses, adequacy decision, or Data Subject consent].

---

## 14. Liability

### 14.1 Application of Principal Agreement

The Parties' respective liabilities under this Agreement (including in respect of indemnification) are subject to the limitations and exclusions set out in the Principal Agreement, to the maximum extent permitted by Applicable Data Protection Law.

### 14.2 Statutory Liability

Nothing in this Agreement limits either Party's liability where such limitation is not permitted by Applicable Data Protection Law, including liability to Data Subjects under GDPR Article 82 or LGPD Article 42.

### 14.3 Indemnity

Each Party must indemnify and hold harmless the other against any regulatory fines, penalties, judgments, or third-party claims arising from that Party's breach of its obligations under Applicable Data Protection Law or this Agreement, subject to the liability limits in the Principal Agreement.

---

## 15. Governing Law and Jurisdiction

This Agreement is governed by the laws of [GOVERNING_LAW_JURISDICTION]. Any dispute arising from or in connection with this Agreement that cannot be resolved amicably will be subject to the exclusive jurisdiction of the courts of [GOVERNING_LAW_JURISDICTION], unless the Parties have agreed to an alternative dispute-resolution mechanism in the Principal Agreement.

---

## 16. Entire Agreement and Amendments

### 16.1 Integration

This Agreement, together with its Schedules and the Principal Agreement, constitutes the entire agreement between the Parties with respect to the processing of Personal Data described herein, and supersedes all prior agreements, understandings, and representations relating to the same subject matter.

### 16.2 Order of Precedence

In the event of any conflict between this Agreement and the Principal Agreement with respect to the processing of Personal Data, this Agreement prevails.

### 16.3 Amendments

No amendment to this Agreement is valid unless made in writing and signed by authorised representatives of both Parties. Amendments required to comply with Applicable Data Protection Law take effect automatically on the date the relevant law or regulatory guidance comes into force.

### 16.4 Severability

If any provision of this Agreement is found invalid or unenforceable, the remaining provisions remain in full force and effect.

---

## 17. Signatures

_Each Party's authorised representative confirms that they have the authority to enter into this Agreement on behalf of their respective organisation._

**[CONTROLLER]**

Signed: ************\_\_\_************

Name: ************\_\_\_************

Title: ************\_\_\_************

Date: ************\_\_\_************

---

**[PROCESSOR] ([LEGAL_ENTITY_NAME])**

Signed: ************\_\_\_************

Name: ************\_\_\_************

Title: ************\_\_\_************

Date: ************\_\_\_************

---

## Schedule A — Approved Sub-Processors

_As of the Effective Date, the Controller authorises the following Sub-Processors:_

| Sub-Processor             | Registered Location | Processing Activity                                                    | Website              |
| ------------------------- | ------------------- | ---------------------------------------------------------------------- | -------------------- |
| Convex, Inc.              | United States       | Backend database, serverless functions, real-time data synchronisation | https://convex.dev   |
| LinkedIn Corporation      | United States       | Profile data retrieval and enrichment via LinkedIn API (OAuth)         | https://linkedin.com |
| Stripe, Inc.              | United States       | Payment processing and subscription billing                            | https://stripe.com   |
| Resend, Inc.              | United States       | Transactional email delivery                                           | https://resend.com   |
| Apify Technologies s.r.o. | Czech Republic      | LinkedIn profile data enrichment via web scraping                      | https://apify.com    |
| Vercel, Inc.              | United States       | Frontend hosting and serverless edge functions                         | https://vercel.com   |

The authoritative and up-to-date sub-processor list is maintained at `docs/compliance/SUBPROCESSORS.md`.

---

## Schedule B — Standard Contractual Clauses

_[TO BE COMPLETED: Attach the applicable European Commission Standard Contractual Clauses (Module 2: Controller-to-Processor, or Module 3: Processor-to-Processor) issued under Commission Implementing Decision (EU) 2021/914 of 4 June 2021. Complete all optional clauses and Annexes I, II, and III as required by the relevant module. Ensure the Appendix information reflects the processing described in this Agreement.]_

---

_This template must be reviewed by qualified legal counsel before use. [LEGAL_ENTITY_NAME] accepts no liability for any reliance on this template in its unreviewed or incomplete form._
