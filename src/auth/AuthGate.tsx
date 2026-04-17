import type { ReactNode } from 'react'
import { AuthGate as SharedAuthGate } from '@haderach/shared-ui'
import type { UserDoc } from '@haderach/shared-ui'
import type { AuthUser } from './AuthUserContext'

interface AuthGateProps {
  children: ReactNode
}

type SiteAuthExtra = Pick<AuthUser, 'isCmsAdmin'>

const APP_PATH = '/site/'
const APP_ID = 'site'

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function mapUserDocToSiteExtra(userDoc: UserDoc): SiteAuthExtra {
  const roles = asStringArray(userDoc.roles)
  return {
    isCmsAdmin: roles.includes('admin'),
  }
}

export function AuthGate({ children }: AuthGateProps) {
  return (
    <SharedAuthGate<SiteAuthExtra>
      appPath={APP_PATH}
      appId={APP_ID}
      mapUserDocToExtra={mapUserDocToSiteExtra}
    >
      {children}
    </SharedAuthGate>
  )
}
