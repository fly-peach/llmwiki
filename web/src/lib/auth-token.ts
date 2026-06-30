'use client'

import { useUserStore } from '@/stores'

/**
 * Local-only mode: there is no auth service to refresh against. The local API
 * does not check auth, so we just keep the access token set to 'local'.
 */
export async function refreshAccessToken(): Promise<string | null> {
  useUserStore.getState().setAccessToken('local')
  return 'local'
}
