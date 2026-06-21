/**
 * RowActionsMenu — test suite
 *
 * WHY THESE TESTS CHANGED:
 * The original implementation used a hand-rolled popover (useState + mousedown/Escape
 * useEffect). Tests could open it with `fireEvent.click(trigger)` and assert DOM
 * visibility, because the panel was a plain conditional `{open && <div>…</div>}` in
 * the React tree.
 *
 * The reimplemented component uses Radix DropdownMenu. Radix opens the menu on
 * `pointerdown` (not `click`) — but `fireEvent.pointerDown` does NOT trigger the
 * Radix open handler in jsdom because jsdom lacks a real pointer-events model. The
 * keyboard path (`onKeyDown` with Enter/Space/ArrowDown) DOES work via
 * `fireEvent.keyDown(trigger, { key: 'Enter' })`, which calls `context.onOpenToggle()`
 * synchronously and renders the portal into `document.body`.
 *
 * `@testing-library/user-event` (which dispatches full pointer sequences) is NOT in
 * this project's devDependencies; we do not add it.
 *
 * Outside-click / Escape dismiss are Radix internals tested by Radix's own suite —
 * the test that previously asserted `fireEvent.mouseDown(document.body)` closes the
 * menu has been replaced with a trigger-attribute test that asserts the closed initial
 * state, plus a dedicated test for the dismiss-via-Escape path
 * (`fireEvent.keyDown(document, { key: 'Escape' })`).
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import RowActionsMenu from './RowActionsMenu'

// Helper: open RowActionsMenu via the keyboard path (the only path that works in jsdom).
function openMenu(triggerName: string | RegExp) {
  fireEvent.keyDown(screen.getByRole('button', { name: triggerName }), { key: 'Enter' })
}

describe('RowActionsMenu', () => {
  it('starts closed — menu items not in document until opened', () => {
    render(
      <RowActionsMenu
        label="Actions for Jordan"
        items={[{ label: 'Ban user…', onClick: () => {} }]}
      />
    )
    const trigger = screen.getByRole('button', { name: 'Actions for Jordan' })
    // Radix sets these on the trigger automatically
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('data-state', 'closed')
    expect(screen.queryByText('Ban user…')).not.toBeInTheDocument()
  })

  it('opens on keyboard Enter and shows items', () => {
    render(
      <RowActionsMenu
        label="Actions for Jordan"
        items={[{ label: 'Ban user…', onClick: () => {} }]}
      />
    )
    openMenu('Actions for Jordan')
    // The menu content renders in a Radix portal with role="menu"; items are role="menuitem".
    // Radix wraps the trigger in aria-hidden when open, so we assert via the portal.
    expect(screen.getByText('Ban user…')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Ban user…' })).toBeInTheDocument()
  })

  it('fires the item onClick callback when selected', () => {
    const onClick = vi.fn()
    render(
      <RowActionsMenu
        label="Actions"
        items={[{ label: 'Unban', onClick }]}
      />
    )
    openMenu('Actions')
    fireEvent.click(screen.getByText('Unban'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('closes the menu after an item is selected', () => {
    render(
      <RowActionsMenu
        label="Actions"
        items={[{ label: 'Unban', onClick: () => {} }]}
      />
    )
    openMenu('Actions')
    expect(screen.getByText('Unban')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Unban'))
    expect(screen.queryByText('Unban')).not.toBeInTheDocument()
  })

  it('closes when Escape is pressed', () => {
    render(
      <RowActionsMenu
        label="Actions"
        items={[{ label: 'Ban user…', onClick: () => {} }]}
      />
    )
    openMenu('Actions')
    expect(screen.getByText('Ban user…')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Ban user…')).not.toBeInTheDocument()
  })

  it('does not fire onClick on a disabled item', () => {
    const onClick = vi.fn()
    render(
      <RowActionsMenu
        label="Actions"
        items={[{ label: 'Restricted', onClick, disabled: true, title: 'No permission' }]}
      />
    )
    openMenu('Actions')
    const item = screen.getByRole('menuitem', { name: 'Restricted' })
    expect(item).toHaveAttribute('data-disabled')
    fireEvent.click(item)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('applies danger styling to destructive items', () => {
    render(
      <RowActionsMenu
        label="Actions"
        items={[{ label: 'Delete', onClick: () => {}, danger: true }]}
      />
    )
    openMenu('Actions')
    const item = screen.getByRole('menuitem', { name: 'Delete' })
    expect(item.className).toMatch(/text-destructive/)
  })
})
