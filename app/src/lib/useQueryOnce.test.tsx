import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useConvex } from 'convex/react'
import type { FunctionReference } from 'convex/server'
import { useQueryOnce } from './useQueryOnce'

const QUERY: FunctionReference<'query', 'public', { n: number }, number> = {
  _type: 'query',
  _visibility: 'public',
  _args: { n: 0 },
  _returnType: 0,
  _componentPath: undefined
}

const queryMock = vi.fn()
vi.mock('convex/react', () => ({ useConvex: vi.fn() }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}

function Probe({ args }: { args: { n: number } | 'skip' }) {
  const { data, error } = useQueryOnce(QUERY, args)
  return (
    <div data-testid="value">{error ? `error:${error.message}` : data === undefined ? 'loading' : String(data)}</div>
  )
}

beforeEach(() => {
  queryMock.mockReset()
  vi.mocked(useConvex).mockReturnValue({ query: queryMock } as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useQueryOnce', () => {
  it('returns undefined until the query resolves, then the value', async () => {
    const d = deferred<number>()
    queryMock.mockReturnValueOnce(d.promise)

    render(<Probe args={{ n: 1 }} />)
    expect(screen.getByTestId('value')).toHaveTextContent('loading')
    expect(queryMock).toHaveBeenCalledWith(QUERY, { n: 1 })

    await act(async () => {
      d.resolve(42)
    })
    expect(screen.getByTestId('value')).toHaveTextContent('42')
  })

  it('refetches on an args change and reads loading until the new value arrives', async () => {
    const second = deferred<number>()
    queryMock.mockResolvedValueOnce(1).mockReturnValueOnce(second.promise)

    const { rerender } = render(<Probe args={{ n: 1 }} />)
    await screen.findByText('1')

    rerender(<Probe args={{ n: 2 }} />)
    expect(screen.getByTestId('value')).toHaveTextContent('loading')
    expect(queryMock).toHaveBeenCalledTimes(2)
    expect(queryMock).toHaveBeenLastCalledWith(QUERY, { n: 2 })

    await act(async () => {
      second.resolve(2)
    })
    expect(screen.getByTestId('value')).toHaveTextContent('2')
  })

  it("fetches nothing for 'skip' and reads loading", () => {
    render(<Probe args="skip" />)
    expect(queryMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('value')).toHaveTextContent('loading')
  })

  it('surfaces a failed fetch as an error instead of reading as loading', async () => {
    queryMock.mockRejectedValueOnce(new Error('boom'))

    render(<Probe args={{ n: 1 }} />)
    expect(screen.getByTestId('value')).toHaveTextContent('loading')

    expect(await screen.findByText('error:boom')).toBeInTheDocument()
    expect(screen.getByTestId('value')).not.toHaveTextContent('loading')
  })

  it('does not leak a failed fetch into the next args key', async () => {
    queryMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(9)

    const { rerender } = render(<Probe args={{ n: 1 }} />)
    await screen.findByText('error:boom')

    rerender(<Probe args={{ n: 2 }} />)
    expect(screen.getByTestId('value')).toHaveTextContent('loading')
    expect(await screen.findByText('9')).toBeInTheDocument()
  })

  it('does not refetch when args are re-created with equal contents', async () => {
    queryMock.mockResolvedValue(7)

    const { rerender } = render(<Probe args={{ n: 1 }} />)
    await screen.findByText('7')
    rerender(<Probe args={{ n: 1 }} />)
    expect(queryMock).toHaveBeenCalledTimes(1)
  })

  it('does not set state after unmount (no act warning)', async () => {
    const d = deferred<number>()
    queryMock.mockReturnValueOnce(d.promise)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { unmount } = render(<Probe args={{ n: 1 }} />)
    unmount()
    d.resolve(1)
    await d.promise
    await act(async () => {})
    expect(consoleError).not.toHaveBeenCalled()
  })
})
