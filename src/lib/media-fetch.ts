import { useCallback } from 'react'
import { getStoredActiveOrgSlug, useAuthUser } from '@haderach/shared-ui'

const BASE = '/media/api'

export async function mediaFetch(
  path: string,
  getIdToken: () => Promise<string>,
  init?: RequestInit,
): Promise<Response> {
  const token = await getIdToken()
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  
  const activeOrgSlug = getStoredActiveOrgSlug()
  if (activeOrgSlug) {
    headers.set('X-Active-Org', activeOrgSlug)
  }
  
  return fetch(`${BASE}${path}`, { ...init, headers })
}

export function useMediaFetch() {
  const { getIdToken } = useAuthUser()
  
  return useCallback(
    async (path: string, init?: RequestInit): Promise<Response> => {
      return mediaFetch(path, getIdToken, init)
    },
    [getIdToken],
  )
}
