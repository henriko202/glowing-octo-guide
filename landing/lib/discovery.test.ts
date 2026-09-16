import { describe, expect, it } from 'vitest'
import {
  AGENT_LINK_HEADER,
  API_CATALOG_PATH,
  apiCatalogDocument,
  authMarkdown,
  DESCRIBED_BY_PATH,
  OPENAPI_MEDIA_TYPE,
  openApiDocument,
  SERVICE_DESC_PATH
} from './discovery'
import { CONTACT_EMAIL, SITE_URL } from './site'
import nextConfig from '../next.config.js'

describe('apiCatalogDocument', () => {
  it('anchors one API entry and links the service description, docs, and description file', () => {
    const catalog = apiCatalogDocument()
    expect(catalog.linkset).toHaveLength(1)
    const entry = catalog.linkset[0] as Record<string, unknown>
    expect(entry.anchor).toBe(`${SITE_URL}/`)
    expect(entry['service-desc']).toEqual([
      { href: `${SITE_URL}${SERVICE_DESC_PATH}`, type: expect.stringContaining('openapi') }
    ])
    expect(entry['service-doc']).toEqual([{ href: `${SITE_URL}/en`, type: 'text/html' }])
    expect(entry.describedby).toEqual([{ href: `${SITE_URL}${DESCRIBED_BY_PATH}`, type: 'text/plain' }])
  })
})

describe('openApiDocument', () => {
  it('is a valid OpenAPI 3.1 document for this origin with every served resource described', () => {
    const doc = openApiDocument()
    expect(doc.openapi).toBe('3.1.0')
    expect(doc.servers).toEqual([{ url: SITE_URL }])
    expect(doc.paths[SERVICE_DESC_PATH].get.responses['200'].content).toHaveProperty(OPENAPI_MEDIA_TYPE)
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
        API_CATALOG_PATH,
        SERVICE_DESC_PATH,
        DESCRIBED_BY_PATH,
        '/llms-full.txt',
        '/pricing.md',
        '/auth.md',
        '/robots.txt',
        '/sitemap.xml',
        '/{lang}'
      ])
    )
    for (const path of Object.values(doc.paths)) {
      expect(path.get.responses['200']).toBeDefined()
    }
  })
})

describe('AGENT_LINK_HEADER', () => {
  it('advertises the catalog and machine-readable resources with registered relations', () => {
    expect(AGENT_LINK_HEADER).toContain(`<${API_CATALOG_PATH}>`)
    for (const rel of ['api-catalog', 'service-desc', 'service-doc', 'describedby']) {
      expect(AGENT_LINK_HEADER).toContain(`rel="${rel}"`)
    }
  })

  it('matches the Link header the shipped next.config.js serves', async () => {
    const config = nextConfig as {
      headers: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]>
    }
    const rules = await config.headers()
    const link = rules.find(rule => rule.source === '/:path*')?.headers.find(header => header.key === 'Link')
    expect(link?.value).toBe(AGENT_LINK_HEADER)
  })
})

describe('authMarkdown', () => {
  it('is a self-contained Auth.md document with an H1 and the provisioning entry point', () => {
    const markdown = authMarkdown()
    expect(markdown.startsWith('# auth.md\n')).toBe(true)
    expect(markdown).toContain('## Registration and provisioning')
    expect(markdown).toContain('## Supported methods')
    expect(markdown).toContain('## Credentials')
    expect(markdown).toContain('/auth/start')
    expect(markdown).toContain(CONTACT_EMAIL)
  })

  it('advertises neither OAuth metadata nor an agent registration API it does not run', () => {
    const markdown = authMarkdown()
    expect(markdown).not.toContain('oauth-authorization-server')
    expect(markdown).not.toContain('oauth-protected-resource')
    expect(markdown).not.toContain('/.well-known/oauth')
  })
})
