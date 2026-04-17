import { useAuthUser as useSharedAuthUser } from '@haderach/shared-ui'
import type { BaseAuthUser } from '@haderach/shared-ui'

export interface AuthUser extends BaseAuthUser {
  isCmsAdmin: boolean
}

export function useAuthUser(): AuthUser {
  const user = useSharedAuthUser<AuthUser>()
  return { ...user, isCmsAdmin: user.isCmsAdmin ?? true }
}
