import { OPENAPI_MEDIA_TYPE, openApiDocument } from '@/lib/discovery'

export const dynamic = 'force-static'

export function GET() {
  return new Response(JSON.stringify(openApiDocument()), {
    headers: { 'Content-Type': OPENAPI_MEDIA_TYPE }
  })
}
