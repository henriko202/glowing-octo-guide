import { NAV_GROUPS, isActivePath } from './navItems'

describe('navItems', () => {
  it('exposes Main and Manage groups and never includes /admin', () => {
    const paths = NAV_GROUPS.flatMap(g => g.items.map(i => i.path))
    expect(paths).toEqual(['/feed', '/my-posts', '/billing', '/settings', '/privacy-data'])
    expect(paths).not.toContain('/admin')
  })
})

describe('isActivePath', () => {
  it('matches the exact path', () => {
    expect(isActivePath('/feed', '/feed')).toBe(true)
  })
  it('does not match a different path', () => {
    expect(isActivePath('/feed', '/billing')).toBe(false)
  })
})
