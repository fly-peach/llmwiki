'use client'

import * as React from 'react'
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { OpenReplayTracker } from "@/components/OpenReplay"
import { I18nProvider } from "@/lib/i18n"

export function RootClient({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      storageKey="theme"
    >
      <I18nProvider defaultLocale="zh">
        {children}
        <Toaster richColors />
        <OpenReplayTracker />
      </I18nProvider>
    </ThemeProvider>
  )
}
