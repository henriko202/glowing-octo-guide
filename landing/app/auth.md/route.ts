import { authMarkdown } from '@/lib/discovery'

export const dynamic = 'force-static'

export function GET() {
  return new Response(authMarkdown(), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
  })
}
