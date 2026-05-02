import { useState, useEffect, useCallback } from 'react'
import { Image as ImageIcon, X, ImagePlus } from 'lucide-react'
import { useMediaFetch } from '../lib/media-fetch'

interface Asset {
  id: string
  filename: string
  title: string | null
  alt_text: string | null
  approved_public: boolean
}

interface ImageFieldEditorProps {
  value: string | null
  onChange: (assetId: string | null) => void
  editable: boolean
  required: boolean
  hasError: boolean
  onOpenPicker: () => void
}

export function ImageFieldEditor({
  value,
  onChange,
  editable,
  required,
  hasError,
  onOpenPicker,
}: ImageFieldEditorProps) {
  const mediaFetch = useMediaFetch()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [asset, setAsset] = useState<Asset | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch asset details when value changes
  useEffect(() => {
    if (!value) return

    let cancelled = false
    
    /* eslint-disable react-hooks/set-state-in-effect -- data fetching pattern */
    setLoading(true)
    setError(null)
    setImageUrl(null)
    setAsset(null)
    /* eslint-enable react-hooks/set-state-in-effect */

    Promise.all([
      mediaFetch(`/assets/${value}`),
      mediaFetch(`/assets/${value}/url`),
    ])
      .then(async ([assetResp, urlResp]) => {
        if (cancelled) return

        if (!assetResp.ok) {
          setError('Asset not found')
          return
        }

        const assetData = await assetResp.json()
        setAsset(assetData)

        if (urlResp.ok) {
          const urlData = await urlResp.json()
          setImageUrl(urlData.url)
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load image')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [value, mediaFetch])

  // Clear state when value is removed (derive from props)
  const displayImageUrl = value ? imageUrl : null
  const displayAsset = value ? asset : null
  const displayError = value ? error : null

  const handleClear = useCallback(() => {
    onChange(null)
  }, [onChange])

  const errorBorder = hasError ? 'border-red-400 ring-1 ring-red-400' : ''

  if (loading) {
    return (
      <div className={`rounded-md border border-input bg-muted/30 p-4 ${errorBorder}`}>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading image...</span>
        </div>
      </div>
    )
  }

  if (displayError) {
    return (
      <div className={`rounded-md border border-red-200 bg-red-50 p-4 ${errorBorder}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-red-600">
            <ImageIcon className="h-4 w-4" />
            <span>{displayError}</span>
          </div>
          {editable && (
            <button
              type="button"
              onClick={onOpenPicker}
              className="text-xs text-primary hover:underline"
            >
              Choose different image
            </button>
          )}
        </div>
      </div>
    )
  }

  if (value && displayImageUrl) {
    return (
      <div className={`rounded-md border border-input bg-background ${errorBorder}`}>
        <div className="relative">
          <img
            src={displayImageUrl}
            alt={displayAsset?.alt_text || displayAsset?.filename || 'Selected image'}
            className="max-h-48 w-full rounded-t-md object-contain bg-muted/30"
          />
          {!displayAsset?.approved_public && (
            <div className="absolute top-2 right-2 rounded bg-amber-500 px-2 py-0.5 text-[10px] font-medium text-white">
              Not approved
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-input px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {displayAsset?.title || displayAsset?.filename || 'Unknown image'}
            </p>
            {displayAsset?.alt_text && (
              <p className="truncate text-xs text-muted-foreground">{displayAsset.alt_text}</p>
            )}
          </div>
          {editable && (
            <div className="flex items-center gap-2 ml-2">
              <button
                type="button"
                onClick={onOpenPicker}
                className="text-xs text-primary hover:underline"
              >
                Change
              </button>
              {!required && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Clear image"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-md border border-dashed border-input bg-muted/30 ${errorBorder}`}>
      {editable ? (
        <button
          type="button"
          onClick={onOpenPicker}
          className="flex w-full items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors rounded-md"
        >
          <ImagePlus className="h-5 w-5" />
          <span>Choose image</span>
        </button>
      ) : (
        <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
          <ImageIcon className="h-5 w-5" />
          <span>No image selected</span>
        </div>
      )}
    </div>
  )
}
