import { describe, it, expect, beforeAll } from 'vitest'
import i18n from './index'

describe('i18n', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en')
  })

  it('has english translations', () => {
    expect(i18n.t('feed.title')).toBe('Your Feed')
    expect(i18n.t('nav.signOut')).toBe('Sign out')
    expect(i18n.t('billing.seeAllPlans')).toBe('See all plans')
  })

  it('has portuguese translations', async () => {
    await i18n.changeLanguage('pt')
    expect(i18n.t('feed.title')).toBe('Seu feed')
    expect(i18n.t('billing.seeAllPlans')).toBe('Ver todos os planos')
    await i18n.changeLanguage('en')
  })

  it('has spanish translations', async () => {
    await i18n.changeLanguage('es')
    expect(i18n.t('feed.title')).toBe('Tu feed')
    expect(i18n.t('billing.seeAllPlans')).toBe('Ver todos los planes')
    await i18n.changeLanguage('en')
  })

  it('falls back to english for unknown language', async () => {
    await i18n.changeLanguage('fr')
    expect(i18n.t('feed.title')).toBe('Your Feed')
    await i18n.changeLanguage('en')
  })
})
