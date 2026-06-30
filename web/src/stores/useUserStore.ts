import { create } from 'zustand'

type User = {
  id: string
  email: string
}

type UserState = {
  user: User | null
  accessToken: string | null
  onboarded: boolean | null
  setUser: (user: User | null) => void
  setAccessToken: (token: string | null) => void
  setOnboarded: (onboarded: boolean) => void
  signOut: () => void
}

export const useUserStore = create<UserState>()((set) => ({
  // Local-only mode: a single, always-authenticated local user.
  user: { id: 'local', email: 'local@localhost' },
  accessToken: 'local',
  onboarded: null,
  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setOnboarded: (onboarded) => set({ onboarded }),
  // No-op: there is no auth session to sign out of in local mode.
  signOut: () => {},
}))
