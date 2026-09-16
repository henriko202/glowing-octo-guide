import { getDictionary } from '@/i18n/getDictionary'
import { llmsFullTxt } from '@/lib/aiFiles'

export const dynamic = 'force-static'

export async function GET() {
  const dict = await getDictionary('en')
  return new Response(llmsFullTxt(dict), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}
