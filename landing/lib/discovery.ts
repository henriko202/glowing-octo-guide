import { i18n } from '@/i18n/config'
import { SIGN_IN_URL } from '@/lib/links'
import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from '@/lib/site'

// Machine-readable discovery documents for agents:
// - `/.well-known/api-catalog` — RFC 9727 API catalog (linkset+json) pointing at the OpenAPI
//   description, the human docs, and the machine description of this site.
// - `/openapi.json` — OpenAPI 3.1 description of the public, unauthenticated resources.
// - `/auth.md` — Auth.md-style registration/provisioning document (self-contained: this site has
//   no OAuth authorization server of its own, so no OAuth metadata is advertised).
// Everything is generated from `lib/site.ts`, `lib/links.ts` and `i18n/config.ts` so the documents
// cannot drift from the origin, the sign-in entry point, or the locale set.

export const API_CATALOG_PATH = '/.well-known/api-catalog'
export const SERVICE_DESC_PATH = '/openapi.json'
export const SERVICE_DOC_PATH = `/${i18n.defaultLocale}`
export const DESCRIBED_BY_PATH = '/llms.txt'
export const OPENAPI_MEDIA_TYPE = 'application/vnd.oai.openapi+json;version=3.1'

// `Link` header value for the homepage (RFC 8288 + RFC 9727 §3). Kept next to the catalog
// builder; `next.config.js` holds the same value for the HTTP layer because it cannot import
// this module (plain JS config, TS runtime).
export const AGENT_LINK_HEADER = [
  `<${API_CATALOG_PATH}>; rel="api-catalog"`,
  `<${SERVICE_DESC_PATH}>; rel="service-desc"; type="${OPENAPI_MEDIA_TYPE}"`,
  `<${SERVICE_DOC_PATH}>; rel="service-doc"`,
  `<${DESCRIBED_BY_PATH}>; rel="describedby"; type="text/plain"`
].join(', ')

export function apiCatalogDocument() {
  return {
    linkset: [
      {
        anchor: `${SITE_URL}/`,
        'service-desc': [{ href: `${SITE_URL}${SERVICE_DESC_PATH}`, type: OPENAPI_MEDIA_TYPE }],
        'service-doc': [{ href: `${SITE_URL}${SERVICE_DOC_PATH}`, type: 'text/html' }],
        describedby: [{ href: `${SITE_URL}${DESCRIBED_BY_PATH}`, type: 'text/plain' }]
      }
    ]
  }
}

export function openApiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: `${SITE_NAME}: public discovery API`,
      version: '1.0.0',
      summary: 'Machine-readable discovery documents for agents and crawlers.',
      description:
        `${SITE_NAME} (LISSI) is a LinkedIn growth tool. Members see relevant LinkedIn posts in one focused feed, ` +
        'get AI-drafted comment suggestions, and review their activity. The member completes every reaction, ' +
        'comment, and post on LinkedIn; nothing is automated. This document describes the public, unauthenticated ' +
        'resources this origin serves to agents. Member features live in the web app behind LinkedIn sign-in and ' +
        'are not part of this API.',
      contact: { name: SITE_NAME, url: SITE_URL, email: CONTACT_EMAIL }
    },
    servers: [{ url: SITE_URL }],
    security: [],
    paths: {
      [API_CATALOG_PATH]: {
        get: {
          operationId: 'getApiCatalog',
          summary: 'API catalog (RFC 9727)',
          description: `Linkset pointing at the service description, documentation, and agent files for ${SITE_URL}.`,
          responses: {
            '200': {
              description: 'API catalog',
              content: { 'application/linkset+json': { schema: { type: 'object' } } }
            }
          }
        }
      },
      [SERVICE_DESC_PATH]: {
        get: {
          operationId: 'getOpenApiDocument',
          summary: 'OpenAPI description of the public discovery resources',
          responses: {
            '200': {
              description: 'OpenAPI 3.1 document',
              content: { [OPENAPI_MEDIA_TYPE]: { schema: { type: 'object' } } }
            }
          }
        }
      },
      '/llms.txt': {
        get: {
          operationId: 'getLlmsTxt',
          summary: 'LLM-facing summary of the product, pricing, and key pages',
          responses: {
            '200': { description: 'Plain-text summary', content: { 'text/plain': { schema: { type: 'string' } } } }
          }
        }
      },
      '/llms-full.txt': {
        get: {
          operationId: 'getLlmsFullTxt',
          summary: 'Full site content (why, how it works, features, pricing, SSI, FAQ) in one file',
          responses: {
            '200': { description: 'Plain-text document', content: { 'text/plain': { schema: { type: 'string' } } } }
          }
        }
      },
      '/pricing.md': {
        get: {
          operationId: 'getPricing',
          summary: 'Structured plan and price data',
          responses: {
            '200': { description: 'Markdown plan data', content: { 'text/markdown': { schema: { type: 'string' } } } }
          }
        }
      },
      '/auth.md': {
        get: {
          operationId: 'getAuthMd',
          summary: 'Agent registration and provisioning document',
          responses: {
            '200': { description: 'Markdown document', content: { 'text/markdown': { schema: { type: 'string' } } } }
          }
        }
      },
      '/robots.txt': {
        get: {
          operationId: 'getRobots',
          summary: 'Crawling policy and Content Signals',
          responses: {
            '200': { description: 'robots.txt', content: { 'text/plain': { schema: { type: 'string' } } } }
          }
        }
      },
      '/sitemap.xml': {
        get: {
          operationId: 'getSitemap',
          summary: 'Sitemap',
          responses: {
            '200': { description: 'XML sitemap', content: { 'application/xml': { schema: { type: 'string' } } } }
          }
        }
      },
      '/{lang}': {
        get: {
          operationId: 'getHome',
          summary: `Product page (${i18n.locales.join(', ')})`,
          parameters: [
            {
              name: 'lang',
              in: 'path',
              required: true,
              description: 'Site locale.',
              schema: { type: 'string', enum: [...i18n.locales] }
            }
          ],
          responses: {
            '200': { description: 'Product page', content: { 'text/html': { schema: { type: 'string' } } } }
          }
        }
      }
    }
  }
}

export function authMarkdown() {
  return `# auth.md

${SITE_NAME} (LISSI) is a web application for people. Members sign in with LinkedIn, join a shared feed of
LinkedIn posts, and complete every reaction and comment themselves on LinkedIn. This document explains how
access is provisioned. It is self-contained because ${SITE_NAME} runs no OAuth authorization server of its
own and publishes no OAuth metadata.

## Audience

- **Human members.** Professionals who sign in with LinkedIn to use the feed, the AI comment drafts, and the
  weekly activity recap.
- **Assistants acting for a member.** Supported only inside the member's own signed-in browser session.
  There is no server-to-server or delegated agent access.

## Registration and provisioning

- **No agent registration endpoint exists.** Accounts are created on first LinkedIn sign-in; there is no
  self-serve registration, no anonymous access, and no API keys or client credentials are issued.
- **Provisioning entry point:** [${SIGN_IN_URL}](${SIGN_IN_URL}), the browser route the landing's trial
  buttons use. The flow is LinkedIn OpenID Connect (authorization code, exchanged server-side with the
  client secret) with an app-level PKCE-style binding. The initiating browser holds a verifier, and only
  that browser can redeem the result.
- Agents must not call that endpoint to create accounts on a person's behalf. A person starts the flow in
  their own browser and consents on LinkedIn.

## Supported methods

| Method                              | Status        | Notes                                                                      |
| ----------------------------------- | ------------- | -------------------------------------------------------------------------- |
| LinkedIn OpenID Connect (OIDC)      | Supported     | Human-in-the-loop; browser redirect; PKCE-style browser binding.           |
| API keys / client credentials       | Not supported | No machine credentials are issued.                                         |
| ID-JAG identity assertion           | Not supported | No identity-assertion grant, and no \`/agent/auth\` endpoint.                |
| Verified email / anonymous identity | Not supported | Every session is bound to a LinkedIn-authenticated member.                 |

## Credentials

- The app exchanges a single-use login code, valid for two minutes and bound to the initiating browser, for
  the member's session token. The token lives in that browser's \`sessionStorage\` and stays valid through 15
  days of active use. It is never issued to third parties or to an agent.
- ${SITE_NAME} holds no LinkedIn write permission. It never posts, comments, or reacts for a member.
- Agents must not store, replay, or share member credentials. If an agent needs product facts (features,
  plans, prices), read the public files instead: [llms.txt](${SITE_URL}/llms.txt) and
  [pricing.md](${SITE_URL}/pricing.md).

## Contact

${CONTACT_EMAIL}
`
}
