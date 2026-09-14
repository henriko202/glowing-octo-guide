import { describe, expect, it } from 'vitest'
import { pickUnsubscribeLocale, unsubscribePageHtml } from './unsubscribePage'

describe('pickUnsubscribeLocale', () => {
  it('picks pt for a Portuguese header tag and its variants', () => {
    expect(pickUnsubscribeLocale('pt-BR')).toBe('pt')
    expect(pickUnsubscribeLocale('pt')).toBe('pt')
  })

  it('picks es for a Spanish header tag and its variants', () => {
    expect(pickUnsubscribeLocale('es-419')).toBe('es')
    expect(pickUnsubscribeLocale('es')).toBe('es')
  })

  it('falls back to en for another language and for a missing header', () => {
    expect(pickUnsubscribeLocale('fr-FR,fr;q=0.9,en;q=0.8')).toBe('en')
    expect(pickUnsubscribeLocale(null)).toBe('en')
  })
})

describe('unsubscribePageHtml', () => {
  it('submits the token back through the form action', () => {
    const html = unsubscribePageHtml('en', { token: 'abc.def', appUrl: 'https://app.example' })
    expect(html).toContain('<form method="POST" action="/unsubscribe/digest?token=abc.def">')
    expect(html.match(/abc\.def/g)).toHaveLength(1)
  })

  it('renders no scripts', () => {
    for (const locale of ['en', 'pt', 'es'] as const) {
      expect(unsubscribePageHtml(locale, { token: 't.s', appUrl: 'https://app.example' }).toLowerCase()).not.toContain(
        '<script'
      )
    }
  })

  it('renders each locale title', () => {
    const appUrl = 'https://app.example'
    expect(unsubscribePageHtml('en', { token: 't.s', appUrl })).toContain('Unsubscribe from the activity digest')
    expect(unsubscribePageHtml('pt', { token: 't.s', appUrl })).toContain('Cancelar o resumo de atividade')
    expect(unsubscribePageHtml('es', { token: 't.s', appUrl })).toContain('Cancelar el resumen de actividad')
  })
})
