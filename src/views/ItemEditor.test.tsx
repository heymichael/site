import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ItemEditor } from './ItemEditor'

const getIdTokenMock = vi.fn(async () => 'test-token')
const confirmMock = vi.fn(async () => true)

vi.mock('../auth/AuthUserContext', () => ({
  useAuthUser: () => ({
    getIdToken: getIdTokenMock,
  }),
}))

vi.mock('../components/RichTextEditor', () => ({
  RichTextEditor: () => <div data-testid="rich-text-editor" />,
}))

vi.mock('../components/ConfirmDialog', () => ({
  useConfirm: () => confirmMock,
}))

function mockResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response
}

describe('ItemEditor deactivation flow', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    getIdTokenMock.mockClear()
    confirmMock.mockClear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.clearAllMocks()
  })

  it('shows Deactivate between Publish and New Version, confirms delisting, and refreshes to Draft', async () => {
    const onBack = vi.fn()
    let currentStatus: 'live' | 'draft' = 'live'

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url === '/cms/api/content-items/42?depth=1' && method === 'GET') {
        return mockResponse({
          id: 42,
          workflow_status: currentStatus,
          workflow_comment: '',
          contentType: { id: 7 },
          data: { title: 'Live item' },
        })
      }

      if (url === '/cms/api/content-types/7' && method === 'GET') {
        return mockResponse({ schema: [] })
      }

      if (url === '/agent/api/cms/items/42' && method === 'PATCH') {
        expect(init?.body).toBe(JSON.stringify({ workflow_status: 'draft' }))
        currentStatus = 'draft'
        return mockResponse({ status: 'ok' })
      }

      return mockResponse({}, 404)
    })

    globalThis.fetch = fetchMock as typeof fetch

    render(
      <ItemEditor
        itemId="42"
        contentTypeSlug="job-listings"
        contentTypeName="Job Listings"
        onBack={onBack}
      />,
    )

    await screen.findByText('Live')

    const publishButton = screen.getByRole('button', { name: 'Publish' })
    const deactivateButton = screen.getByRole('button', { name: 'Deactivate' })
    const newVersionButton = screen.getByRole('button', { name: 'New version' })

    expect(
      publishButton.compareDocumentPosition(deactivateButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0)
    expect(
      deactivateButton.compareDocumentPosition(newVersionButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0)

    await userEvent.click(deactivateButton)

    expect(confirmMock).toHaveBeenCalledWith({
      title: 'Deactivate live item?',
      description: 'This will delist the item from the public site immediately and return it to Draft.',
      confirmLabel: 'Deactivate',
      cancelLabel: 'Keep live',
      variant: 'destructive',
    })

    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument()
    })

    expect(onBack).not.toHaveBeenCalled()
    expect(getIdTokenMock).toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith('/agent/api/cms/items/42', expect.objectContaining({
      method: 'PATCH',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      }),
    }))
  })
})
