import { apiCatalogDocument } from '@/lib/discovery'

export const dynamic = 'force-static'

export function GET() {
  return new Response(JSON.stringify(apiCatalogDocument()), {
    headers: { 'Content-Type': 'application/linkset+json' }
  })
}
