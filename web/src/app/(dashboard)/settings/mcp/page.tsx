'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, Check } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { apiFetch } from '@/lib/api'
import { useUserStore } from '@/stores'

export default function McpConfigPage() {
  const { t } = useI18n()
  const router = useRouter()
  const token = useUserStore((s) => s.accessToken)
  const [copied, setCopied] = React.useState(false)
  const [workspaceHint, setWorkspaceHint] = React.useState('C:\\llmwiki-ws')

  // Fetch the active workspace folder from the server.
  React.useEffect(() => {
    if (!token) return
    apiFetch<{ active: string | null }>('/v1/workspaces', token)
      .then((data) => { if (data?.active) setWorkspaceHint(data.active) })
      .catch(() => {})
  }, [token])

  const configJson = React.useMemo(() => {
    const wsName = workspaceHint.split(/[\\/]/).pop() || 'wiki'
    return JSON.stringify(
      {
        mcpServers: {
          [`llmwiki-${wsName}`]: {
            command: 'llmwiki',
            args: ['mcp', workspaceHint],
          },
        },
      },
      null,
      2,
    )
  }, [workspaceHint])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(configJson)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.push('/settings')}
          className="p-1 rounded-md hover:bg-accent transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-xl font-semibold tracking-tight">{t('mcp.title')}</h1>
      </div>

      <p className="text-sm text-muted-foreground mb-6">{t('mcp.description')}</p>

      {/* Step 1: copy config */}
      <section className="mb-6">
        <h2 className="text-base font-medium mb-2">{t('mcp.step1Title')}</h2>
        <p className="text-sm text-muted-foreground mb-3">{t('mcp.step1Desc')}</p>

        {/* Config JSON display */}
        <div className="relative mt-3">
          <div className="rounded-lg bg-muted border border-border overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card/50">
              <span className="text-xs text-muted-foreground font-mono">claude_desktop_config.json</span>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded hover:bg-accent cursor-pointer transition-colors"
              >
                {copied ? (
                  <><Check className="size-3 text-emerald-500" /><span className="text-emerald-500">{t('mcp.copied')}</span></>
                ) : (
                  <><Copy className="size-3" /><span>{t('mcp.copyConfig')}</span></>
                )}
              </button>
            </div>
            <pre className="p-4 text-sm font-mono overflow-x-auto text-foreground">
              {configJson}
            </pre>
          </div>
        </div>

        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="font-medium text-foreground shrink-0">{t('mcp.claudeDesktop')}:</span>
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs break-all">{t('mcp.configPathDesktop')}</code>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium text-foreground shrink-0">{t('mcp.claudeCode')}:</span>
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs break-all">{t('mcp.configPathCode')}</code>
          </div>
        </div>
      </section>

      {/* Step 2: restart */}
      <section className="mb-6">
        <h2 className="text-base font-medium mb-2">{t('mcp.step2Title')}</h2>
        <p className="text-sm text-muted-foreground">{t('mcp.step2Info')}</p>
      </section>

      {/* Tip */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 text-sm text-blue-700 dark:text-blue-300">
        {t('mcp.onePerWorkspace')}
      </div>

      {/* Back button */}
      <button
        onClick={() => router.push('/settings')}
        className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        {t('mcp.backToSettings')}
      </button>
    </div>
  )
}
