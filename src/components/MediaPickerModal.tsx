import { useState, useEffect, useCallback } from 'react'
import { Search, Image as ImageIcon, AlertTriangle, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
} from '@haderach/shared-ui'
import { useMediaFetch } from '../lib/media-fetch'

interface Asset {
  id: string
  filename: string
  title: string | null
  alt_text: string | null
  approved_public: boolean
  width: number | null
  height: number | null
}

interface MediaPickerModalProps {
  open: boolean
  onClose: () => void
  onSelect: (assetId: string) => void
}

export function MediaPickerModal({ open, onClose, onSelect }: MediaPickerModalProps) {
  const mediaFetch = useMediaFetch()
  const [searchQuery, setSearchQuery] = useState('')
  const [includeUnapproved, setIncludeUnapproved] = useState(false)
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [hoveredAsset, setHoveredAsset] = useState<Asset | null>(null)
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({})
  const [confirmingUnapproved, setConfirmingUnapproved] = useState(false)

  // Fetch assets when modal opens or search changes
  useEffect(() => {
    if (!open) return
    let cancelled = false
    
    const doFetch = async () => {
      setLoading(true)
      setError(null)
      try {
        let response: Response
        if (searchQuery.trim()) {
          response = await mediaFetch('/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: searchQuery,
              mode: 'text',
              limit: 50,
            }),
          })
        } else {
          const params = new URLSearchParams({ limit: '50' })
          if (!includeUnapproved) {
            params.set('approved_public', 'true')
          }
          response = await mediaFetch(`/assets?${params.toString()}`)
        }
        if (cancelled) return
        if (!response.ok) throw new Error('Failed to load assets')
        const data = await response.json()
        const filtered = includeUnapproved
          ? data
          : data.filter((a: Asset) => a.approved_public)
        if (!cancelled) setAssets(filtered)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load assets')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    
    doFetch()
    return () => { cancelled = true }
  }, [open, searchQuery, includeUnapproved, mediaFetch])

  // Reset state when modal closes
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      onClose()
      setSearchQuery('')
      setSelectedAsset(null)
      setHoveredAsset(null)
      setConfirmingUnapproved(false)
      setAssetUrls({})
    }
  }, [onClose])

  // Fetch preview URL for hovered asset
  useEffect(() => {
    if (!hoveredAsset || assetUrls[hoveredAsset.id]) return
    
    let cancelled = false
    mediaFetch(`/assets/${hoveredAsset.id}/url`)
      .then(async (response) => {
        if (cancelled || !response.ok) return
        const data = await response.json()
        if (!cancelled) {
          setAssetUrls((prev) => ({ ...prev, [hoveredAsset.id]: data.url }))
        }
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [hoveredAsset, assetUrls, mediaFetch])
  
  // Derive preview URL from assetUrls
  const hoveredImageUrl = hoveredAsset ? assetUrls[hoveredAsset.id] : null

  const handleSelect = useCallback(() => {
    if (!selectedAsset) return

    if (!selectedAsset.approved_public && !confirmingUnapproved) {
      setConfirmingUnapproved(true)
      return
    }

    onSelect(selectedAsset.id)
    onClose()
  }, [selectedAsset, confirmingUnapproved, onSelect, onClose])

  const handleCancel = useCallback(() => {
    if (confirmingUnapproved) {
      setConfirmingUnapproved(false)
    } else {
      onClose()
    }
  }, [confirmingUnapproved, onClose])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {confirmingUnapproved ? 'Confirm Unapproved Asset' : 'Choose Image'}
          </DialogTitle>
        </DialogHeader>

        {confirmingUnapproved ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
            <AlertTriangle className="h-12 w-12 text-amber-500" />
            <p className="text-center text-sm max-w-md">
              This asset has not been approved for public use. Using it in published content may
              violate content policies.
            </p>
            <p className="text-center text-sm font-medium">
              Are you sure you want to use "{selectedAsset?.title || selectedAsset?.filename}"?
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search assets..."
                  className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeUnapproved}
                  onChange={(e) => setIncludeUnapproved(e.target.checked)}
                  className="rounded border-input"
                />
                Include unapproved
              </label>
            </div>

            <div className="flex-1 min-h-0 flex gap-4 mt-4">
              <div className="flex-1 overflow-auto border rounded-md">
                {loading ? (
                  <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                    Loading assets...
                  </div>
                ) : error ? (
                  <div className="flex h-48 items-center justify-center text-sm text-red-600">
                    {error}
                  </div>
                ) : assets.length === 0 ? (
                  <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                    {searchQuery ? 'No assets found' : 'No assets available'}
                  </div>
                ) : (
                  <div className="divide-y" onMouseLeave={() => setHoveredAsset(null)}>
                    {assets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setSelectedAsset(asset)}
                        onMouseEnter={() => setHoveredAsset(asset)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                          selectedAsset?.id === asset.id
                            ? 'bg-primary/10'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="h-10 w-10 flex-shrink-0 rounded bg-muted flex items-center justify-center overflow-hidden">
                          {assetUrls[asset.id] ? (
                            <img
                              src={assetUrls[asset.id]}
                              alt=""
                              className="h-full w-full object-cover"
                              onLoad={() => {}}
                            />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {asset.title || asset.filename}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {asset.filename}
                            {asset.width && asset.height && (
                              <span className="ml-2">{asset.width}×{asset.height}</span>
                            )}
                          </p>
                        </div>
                        {!asset.approved_public && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                            Unapproved
                          </span>
                        )}
                        {selectedAsset?.id === asset.id && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="w-64 flex-shrink-0 border rounded-md bg-muted/30 flex items-center justify-center overflow-hidden">
                {hoveredImageUrl ? (
                  <img
                    src={hoveredImageUrl}
                    alt={hoveredAsset?.alt_text || hoveredAsset?.filename || ''}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : hoveredAsset ? (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-xs">Loading preview...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground p-4 text-center">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-xs">Hover over an asset to preview</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleCancel}>
            {confirmingUnapproved ? 'Go Back' : 'Cancel'}
          </Button>
          <Button
            onClick={handleSelect}
            disabled={!selectedAsset}
          >
            {confirmingUnapproved ? 'Use Anyway' : 'Select'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
