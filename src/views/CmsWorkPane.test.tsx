import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CmsWorkPane } from './CmsWorkPane'

vi.mock('./CollectionsList', () => ({
  CollectionsList: ({ onSelect }: { onSelect: (id: string, slug: string, name: string) => void }) => (
    <button type="button" onClick={() => onSelect('col-1', 'job-listings', 'Job Listings')}>
      Select collection
    </button>
  ),
}))

vi.mock('./CollectionHome', () => ({
  CollectionHome: ({ onSelectListings }: { onSelectListings: () => void }) => (
    <button type="button" onClick={onSelectListings}>
      Open listings
    </button>
  ),
}))

vi.mock('./ItemsList', () => ({
  ItemsList: ({ onSelect }: { onSelect: (itemId: string) => void }) => (
    <button type="button" onClick={() => onSelect('item-42')}>
      Select item
    </button>
  ),
}))

vi.mock('./ItemEditor', () => ({
  ItemEditor: ({ onOpenHistory }: { onOpenHistory: () => void }) => (
    <div>
      <div>Editor view</div>
      <button type="button" onClick={onOpenHistory}>
        Open history
      </button>
    </div>
  ),
}))

vi.mock('./VersionHistory', () => ({
  VersionHistory: ({ onRestore }: { onRestore: () => void }) => (
    <button type="button" onClick={onRestore}>
      Restore from history
    </button>
  ),
}))

vi.mock('./ApprovalDiff', () => ({ ApprovalDiff: () => null }))
vi.mock('./SchedulingPanel', () => ({ SchedulingPanel: () => null }))
vi.mock('./ContentTypeManager', () => ({ ContentTypeManager: () => null }))
vi.mock('./PermissionsMatrix', () => ({ PermissionsMatrix: () => null }))

describe('CmsWorkPane version history restore flow', () => {
  it('returns to editor for the same item after restore', async () => {
    const user = userEvent.setup()
    const onModeChange = vi.fn()

    render(<CmsWorkPane isCmsAdmin={false} onModeChange={onModeChange} />)

    await user.click(screen.getByRole('button', { name: 'Select collection' }))
    await user.click(screen.getByRole('button', { name: 'Open listings' }))
    await user.click(screen.getByRole('button', { name: 'Select item' }))
    await user.click(screen.getByRole('button', { name: 'Open history' }))
    await user.click(screen.getByRole('button', { name: 'Restore from history' }))

    expect(screen.getByText('Editor view')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Select item' })).not.toBeInTheDocument()
    expect(onModeChange).toHaveBeenLastCalledWith('editing', {
      itemId: 'item-42',
      contentTypeSlug: 'job-listings',
    })
  })
})
