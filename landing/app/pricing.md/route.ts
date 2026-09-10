import { getDictionary } from '@/i18n/getDictionary'
import { pricingMarkdown } from '@/lib/aiFiles'

export const dynamic = 'force-static'

export async function GET() {
  const dict = await getDictionary('en')
  return new Response(pricingMarkdown(dict), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
  })
}
