'use client'

import * as React from 'react'
import { ArrowLeft, Plus, Folder, Check, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { apiFetch, isApiError } from '@/lib/api'
import { useUserStore, useKBStore } from '@/stores'
import { useI18n } from '@/lib/i18n'

interface Usage {
  total_pages: number
  total_storage_bytes: number
  document_count: number
  max_pages: number
  max_storage_bytes: number
}

interface WorkspaceFolder {
  path: string
  name: string
  exists: boolean
  initialized: boolean
  active: boolean
}

interface WorkspacesResponse {
  active: string | null
  folders: WorkspaceFolder[]
}

interface McpLaunchConfig {
  active: string | null
  command: string
  argsPrefix: string[]
  cliPath: string
  pythonPath: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`
}

export default function SettingsPage() {
  const router = useRouter()
  const { t } = useI18n()
  const token = useUserStore((s) => s.accessToken)
  const [usage, setUsage] = React.useState<Usage | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [workspacePath, setWorkspacePath] = React.useState('')

  const refreshWorkspace = React.useCallback(() => {
    if (!token) return
    return apiFetch<WorkspacesResponse>('/v1/workspaces', token)
      .then((data) => { if (data?.active) setWorkspacePath(data.active) })
      .catch(() => {})
  }, [token])

  React.useEffect(() => {
    if (!token) return
    apiFetch<Usage>('/v1/usage', token)
      .then((u) => setUsage(u))
      .catch(() => {})
      .finally(() => setLoading(false))
    refreshWorkspace()
  }, [token, refreshWorkspace])

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.push('/wikis')}
          className="p-1 rounded-md hover:bg-accent transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-xl font-semibold tracking-tight">{t('settings.title')}</h1>
        <div className="ml-auto">
          <button onClick={() => router.push('/wikis')} className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">← 返回主页</button>
        </div>
      </div>

      {/* Wiki Folders */}
      <WikiFoldersSection
        t={t}
        token={token}
        onActiveChange={(path) => {
          setWorkspacePath(path)
          // Active DB changed — reload the KB list and return to the wikis page.
          useKBStore.getState().fetchKBs().catch(() => {})
          router.push('/wikis')
        }}
      />

      {/* Usage */}
      {usage && (
        <section>
          <h2 className="text-base font-medium">{t('settings.usage')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('settings.documentsUploaded', { count: usage.document_count, s: usage.document_count !== 1 ? 's' : '' })}
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">{t('settings.storage')}</span>
                <span className="font-mono text-xs">
                  {formatBytes(usage.total_storage_bytes)} / {formatBytes(usage.max_storage_bytes)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    usage.total_storage_bytes / usage.max_storage_bytes > 0.9
                      ? 'bg-destructive'
                      : usage.total_storage_bytes / usage.max_storage_bytes > 0.7
                        ? 'bg-yellow-500'
                        : 'bg-primary'
                  )}
                  style={{ width: `${Math.min(100, (usage.total_storage_bytes / usage.max_storage_bytes) * 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">{t('settings.ocrPages')}</span>
                <span className="font-mono text-xs">
                  {usage.total_pages.toLocaleString()} / {usage.max_pages.toLocaleString()}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    usage.total_pages / usage.max_pages > 0.9
                      ? 'bg-destructive'
                      : usage.total_pages / usage.max_pages > 0.7
                        ? 'bg-yellow-500'
                        : 'bg-primary'
                  )}
                  style={{ width: `${Math.min(100, (usage.total_pages / usage.max_pages) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {usage && <div className="h-px bg-border my-8" />}

      {/* MCP Config + Permissions + Multi-Folder — single unified expander */}
      <section>
        <McpExpander t={t} workspacePath={workspacePath} />
      </section>
    </div>
  )
}

// ── Wiki folders section ─────────────────────────────────────────

function WikiFoldersSection({
  t,
  token,
  onActiveChange,
}: {
  t: (k: string, v?: Record<string, string | number>) => string
  token: string | null
  onActiveChange: (path: string) => void
}) {
  const [folders, setFolders] = React.useState<WorkspaceFolder[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busyPath, setBusyPath] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [addOpen, setAddOpen] = React.useState(false)
  const [newPath, setNewPath] = React.useState('')

  const load = React.useCallback(async () => {
    if (!token) { setLoading(false); return }
    try {
      const data = await apiFetch<WorkspacesResponse>('/v1/workspaces', token)
      setFolders(data.folders)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [token])

  React.useEffect(() => { load() }, [load])

  const handleSwitch = async (folder: WorkspaceFolder) => {
    if (!token || folder.active || busyPath) return
    setBusyPath(folder.path)
    setError(null)
    try {
      const data = await apiFetch<WorkspacesResponse>('/v1/workspaces/switch', token, {
        method: 'POST',
        body: JSON.stringify({ path: folder.path }),
      })
      setFolders(data.folders)
      onActiveChange(folder.path)
    } catch (err) {
      setError(isApiError(err) ? err.message : (err as Error).message)
    } finally {
      setBusyPath(null)
    }
  }

  const handleRemove = async (folder: WorkspaceFolder) => {
    if (!token || busyPath) return
    if (!confirm(t('ws.confirmRemove', { name: folder.name }))) return
    setBusyPath(folder.path)
    setError(null)
    try {
      const data = await apiFetch<WorkspacesResponse>(`/v1/workspaces?path=${encodeURIComponent(folder.path)}`, token, {
        method: 'DELETE',
      })
      setFolders(data.folders)
      if (data.active && data.active !== folder.path) onActiveChange(data.active)
    } catch (err) {
      setError(isApiError(err) ? err.message : (err as Error).message)
    } finally {
      setBusyPath(null)
    }
  }

  const handleAdd = async () => {
    if (!token || !newPath.trim() || busyPath) return
    setBusyPath('__add__')
    setError(null)
    try {
      const data = await apiFetch<WorkspacesResponse>('/v1/workspaces', token, {
        method: 'POST',
        body: JSON.stringify({ path: newPath.trim() }),
      })
      setFolders(data.folders)
      setAddOpen(false)
      setNewPath('')
      if (data.active) onActiveChange(data.active)
    } catch (err) {
      setError(isApiError(err) ? err.message : (err as Error).message)
    } finally {
      setBusyPath(null)
    }
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-medium">{t('ws.title')}</h2>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        >
          <Plus className="size-3.5" />
          {t('ws.add')}
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{t('ws.description')}</p>

      {error && (
        <p className="text-xs text-destructive mb-3">{error}</p>
      )}

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {loading ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin inline mr-2" />
            {t('ws.loading')}
          </div>
        ) : folders.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">{t('ws.empty')}</div>
        ) : (
          folders.map((folder) => (
            <div key={folder.path} className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0 flex-1 flex items-center gap-2.5">
                <Folder className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{folder.name}</p>
                    {folder.active && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Check className="size-2.5" />
                        {t('ws.current')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{folder.path}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!folder.active && (
                  <button
                    onClick={() => handleSwitch(folder)}
                    disabled={!!busyPath || !folder.initialized}
                    className="text-xs px-2.5 py-1 rounded-md bg-foreground text-background hover:opacity-90 disabled:opacity-40 cursor-pointer transition-opacity"
                  >
                    {busyPath === folder.path ? <Loader2 className="size-3 animate-spin" /> : t('ws.switch')}
                  </button>
                )}
                <button
                  onClick={() => handleRemove(folder)}
                  disabled={!!busyPath}
                  className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-40 cursor-pointer transition-colors"
                >
                  {t('ws.remove')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add dialog */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold mb-1">{t('ws.addTitle')}</h3>
            <p className="text-xs text-muted-foreground mb-4">{t('ws.addDesc')}</p>
            <input
              type="text"
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder="D:\\my-wiki"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => { setAddOpen(false); setNewPath('') }}
                className="px-3 py-1.5 text-sm rounded-md hover:bg-accent cursor-pointer transition-colors"
              >
                {t('ws.cancel')}
              </button>
              <button
                onClick={handleAdd}
                disabled={!newPath.trim() || !!busyPath}
                className="px-3 py-1.5 text-sm rounded-md bg-foreground text-background hover:opacity-90 disabled:opacity-40 cursor-pointer transition-opacity"
              >
                {busyPath === '__add__' ? <Loader2 className="size-3.5 animate-spin" /> : t('ws.add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ── MCP Expander (unified: permissions + config + multi-folder) ─────────

type PermissionMode = 'full' | 'read-only' | 'no-delete' | 'wiki-only' | 'custom'

// Tool groups for custom permission selection
const TOOL_GROUPS: { category: string; tools: { key: string; name: string }[] }[] = [
  {
    category: 'mcp.categoryReadonly',
    tools: [
      { key: 'guide', name: 'mcp.toolGuide' },
      { key: 'search', name: 'mcp.toolSearch' },
      { key: 'read', name: 'mcp.toolRead' },
    ],
  },
  {
    category: 'mcp.categoryWrite',
    tools: [
      { key: 'create', name: 'mcp.toolCreate' },
      { key: 'edit', name: 'mcp.toolEdit' },
      { key: 'lint', name: 'mcp.toolLint' },
    ],
  },
  {
    category: 'mcp.categoryDelete',
    tools: [
      { key: 'delete', name: 'mcp.toolDelete' },
    ],
  },
  {
    category: 'mcp.categoryManage',
    tools: [
      { key: 'create_knowledge_base', name: 'mcp.toolManage' },
    ],
  },
]

// Default tool sets per preset (must match backend PRESETS in mcp/tools/__init__.py)
const PRESET_TOOLS: Record<Exclude<PermissionMode, 'custom'>, Set<string>> = {
  'full': new Set(['guide', 'list_knowledge_bases', 'search', 'read', 'create', 'edit', 'append', 'delete', 'lint', 'create_knowledge_base']),
  'read-only': new Set(['guide', 'list_knowledge_bases', 'search', 'read']),
  'no-delete': new Set(['guide', 'list_knowledge_bases', 'search', 'read', 'create', 'edit', 'append', 'lint', 'create_knowledge_base']),
  'wiki-only': new Set(['guide', 'list_knowledge_bases', 'search', 'read', 'create', 'edit', 'append', 'lint', 'create_knowledge_base']),
}

function McpExpander({ t, workspacePath }: { t: (k: string, v?: Record<string, string | number>) => string; workspacePath: string }) {
  const token = useUserStore((s) => s.accessToken)
  const [open, setOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [mode, setMode] = React.useState<PermissionMode>('full')
  const [customTools, setCustomTools] = React.useState<Set<string>>(new Set(PRESET_TOOLS['full']))
  const [mcpLaunch, setMcpLaunch] = React.useState<McpLaunchConfig | null>(null)

  React.useEffect(() => {
    if (!token) return
    apiFetch<McpLaunchConfig>('/v1/workspaces/mcp-config', token)
      .then((data) => setMcpLaunch(data))
      .catch(() => {})
  }, [token])

  const path = workspacePath || mcpLaunch?.active || 'C:\\llmwiki-ws'
  const wsName = path.split(/[\\/]/).pop() || 'wiki'

  // Build the permission args based on selected mode
  const permissionArgs = React.useMemo(() => {
    if (mode === 'custom') {
      // Always include guide + list_knowledge_bases as baseline
      const tools = new Set(customTools)
      tools.add('guide')
      tools.add('list_knowledge_bases')
      const toolList = Array.from(tools).join(',')
      return ['--allow', toolList]
    }
    if (mode === 'full') return [] // no extra args for full access
    return ['--preset', mode]
  }, [mode, customTools])

  const configJson = React.useMemo(() => {
    const command = mcpLaunch?.command || 'llmwiki'
    const args = mcpLaunch?.argsPrefix
      ? [...mcpLaunch.argsPrefix, path, ...permissionArgs]
      : ['mcp', path, ...permissionArgs]
    return JSON.stringify({
      mcpServers: {
        [`llmwiki-${wsName}`]: {
          command,
          args,
        },
      },
    }, null, 2)
  }, [path, wsName, permissionArgs, mcpLaunch])

  const handleCopy = React.useCallback(async () => {
    await navigator.clipboard.writeText(configJson)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [configJson])

  // When a preset is selected, sync the custom tool set too
  const selectMode = (m: PermissionMode) => {
    setMode(m)
    if (m !== 'custom' && PRESET_TOOLS[m]) {
      setCustomTools(new Set(PRESET_TOOLS[m]))
    }
  }

  const toggleTool = (tool: string) => {
    setCustomTools((prev) => {
      const next = new Set(prev)
      if (next.has(tool)) next.delete(tool)
      else next.add(tool)
      return next
    })
  }

  // Dynamic hint based on selected mode
  const configHint = (() => {
    switch (mode) {
      case 'read-only': return t('mcp.configHintReadOnly')
      case 'no-delete': return t('mcp.configHintNoDelete')
      case 'wiki-only': return t('mcp.configHintWikiOnly')
      case 'custom': return t('mcp.configHintCustom')
      default: return t('mcp.configHintFull')
    }
  })()

  const presetOptions: { value: Exclude<PermissionMode, 'custom'>; icon: string; titleKey: string; descKey: string; longKey: string }[] = [
    { value: 'full', icon: '👑', titleKey: 'mcp.fullAccessTitle', descKey: 'mcp.fullAccessDesc', longKey: 'mcp.fullAccessDescLong' },
    { value: 'read-only', icon: '🛡️', titleKey: 'mcp.readOnlyTitle', descKey: 'mcp.readOnlyDesc', longKey: 'mcp.readOnlyDescLong' },
    { value: 'no-delete', icon: '✏️', titleKey: 'mcp.noDeleteTitle', descKey: 'mcp.noDeleteDesc', longKey: 'mcp.noDeleteDescLong' },
    { value: 'wiki-only', icon: '📚', titleKey: 'mcp.wikiOnlyTitle', descKey: 'mcp.wikiOnlyDesc', longKey: 'mcp.wikiOnlyDescLong' },
  ]

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-accent/30 transition-colors rounded-xl"
      >
        <div className="text-left">
          <h2 className="text-base font-medium">{t('settings.connectClaude')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {open ? t('mcp.description') : t('settings.clickToExpand')}
          </p>
        </div>
        <span className="text-muted-foreground text-sm transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-6 border-t border-border">

          {/* ── Section 1: Permission Configuration ── */}
          <div className="mt-4">
            <h3 className="text-sm font-medium mb-1">{t('mcp.permissionsTitle')}</h3>
            <p className="text-xs text-muted-foreground mb-3">{t('mcp.permissionsDesc')}</p>

            {/* Preset cards */}
            <div className="space-y-2">
              {presetOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${mode === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/30'}`}
                >
                  <input
                    type="radio"
                    name="mcp-permission"
                    checked={mode === opt.value}
                    onChange={() => selectMode(opt.value)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span>{opt.icon}</span>
                      <span className="text-sm font-medium">{t(opt.titleKey)}</span>
                      {opt.value === 'full' && <span className="text-[10px] text-primary">{t('mcp.presetRecommended')}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{t(opt.descKey)}</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">{t(opt.longKey)}</p>
                  </div>
                </label>
              ))}

              {/* Custom option */}
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${mode === 'custom' ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/30'}`}
              >
                <input
                  type="radio"
                  name="mcp-permission"
                  checked={mode === 'custom'}
                  onChange={() => selectMode('custom')}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span>🔧</span>
                    <span className="text-sm font-medium">{t('mcp.customTitle')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('mcp.customDesc')}</p>
                </div>
              </label>
            </div>

            {/* Custom tool selection */}
            {mode === 'custom' && (
              <div className="mt-3 p-3 rounded-lg border border-border bg-muted/30 space-y-3">
                {TOOL_GROUPS.map((group) => (
                  <div key={group.category}>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{t(group.category)}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {group.tools.map((tool) => (
                        <label key={tool.key} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={customTools.has(tool.key)}
                            onChange={() => toggleTool(tool.key)}
                          />
                          <span>{t(tool.name)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Hint */}
            <div className="mt-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-300">
              <span className="font-medium">{t('mcp.permissionsHint')}：</span>{t('mcp.permissionsHintText')}
            </div>
          </div>

          {/* ── Section 2: Config Preview ── */}
          <div>
            <h3 className="text-sm font-medium mb-1">{t('mcp.configPreviewTitle')}</h3>
            <p className="text-xs text-muted-foreground mb-2">{configHint}</p>
            <div className="rounded-lg bg-muted border border-border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card/50">
                <span className="text-xs text-muted-foreground font-mono">claude_desktop_config.json</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background px-3 py-1 text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
                >
                  {copied ? `✓ ${t('mcp.copied')}` : t('mcp.copyConfig')}
                </button>
              </div>
              <pre className="p-3 text-xs font-mono overflow-x-auto text-foreground whitespace-pre">
                {configJson}
              </pre>
            </div>
          </div>

          {/* ── Section 3: Setup Guide ── */}
          <div>
            <h3 className="text-sm font-medium mb-2">{t('mcp.setupGuideTitle')}</h3>
            <div className="space-y-2">
              <div className="p-3 rounded-lg border border-border bg-card/50">
                <p className="text-sm font-medium mb-0.5">{t('mcp.setupStep1Title')}</p>
                <p className="text-xs text-muted-foreground mb-2">{t('mcp.setupStep1Desc')}</p>
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  <div>{t('mcp.claudeDesktop')}: <code className="bg-muted px-1.5 py-0.5 rounded">{t('mcp.configPathDesktop')}</code></div>
                  <div>{t('mcp.claudeCode')}: <code className="bg-muted px-1.5 py-0.5 rounded">{t('mcp.configPathCode')}</code></div>
                </div>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card/50">
                <p className="text-sm font-medium mb-0.5">{t('mcp.setupStep2Title')}</p>
                <p className="text-xs text-muted-foreground">{t('mcp.setupStep2Desc')}</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card/50">
                <p className="text-sm font-medium mb-0.5">{t('mcp.setupStep3Title')}</p>
                <p className="text-xs text-muted-foreground">{t('mcp.setupStep3Desc')}</p>
              </div>
            </div>
          </div>

          {/* ── Section 4: Permission Comparison Table ── */}
          <div>
            <h3 className="text-sm font-medium mb-2">{t('mcp.comparisonTitle')}</h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('mcp.comparisonFeature')}</th>
                    <th className="px-2 py-2 font-medium text-center">{t('mcp.comparisonReadOnly')}</th>
                    <th className="px-2 py-2 font-medium text-center">{t('mcp.comparisonNoDelete')}</th>
                    <th className="px-2 py-2 font-medium text-center">{t('mcp.comparisonWikiOnly')}</th>
                    <th className="px-2 py-2 font-medium text-center">{t('mcp.comparisonFull')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <ComparisonRow label={t('mcp.comparisonRead')} values={[true, true, true, true]} />
                  <ComparisonRow label={t('mcp.comparisonSearch')} values={[true, true, true, true]} />
                  <ComparisonRow label={t('mcp.comparisonCreate')} values={[false, true, true, true]} />
                  <ComparisonRow label={t('mcp.comparisonEdit')} values={[false, true, true, true]} />
                  <ComparisonRow label={t('mcp.comparisonDelete')} values={[false, false, false, true]} />
                  <ComparisonRow label={t('mcp.comparisonManage')} values={[false, true, true, true]} />
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Section 5: Multi-Folder Guide ── */}
          <div>
            <h3 className="text-sm font-medium mb-2">{t('mcp.multiFolderTitle')}</h3>
            <div className="p-3 rounded-lg border border-border bg-card/50 space-y-1.5">
              <p className="text-xs text-muted-foreground mb-1">{t('mcp.multiFolderDesc')}</p>
              <p className="text-xs text-muted-foreground">{t('mcp.multiFolderStep1')}</p>
              <p className="text-xs text-muted-foreground">{t('mcp.multiFolderStep2')}</p>
              <p className="text-xs text-muted-foreground">{t('mcp.multiFolderStep3')}</p>
              <p className="text-xs text-muted-foreground">{t('mcp.multiFolderStep4')}</p>
            </div>
            <div className="mt-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-0.5">{t('multiFolder.tipTitle')}</p>
              <p>{t('multiFolder.tipDesc')}</p>
            </div>
          </div>

          {/* ── Section 6: FAQ ── */}
          <div>
            <h3 className="text-sm font-medium mb-2">{t('mcp.faqTitle')}</h3>
            <div className="space-y-2">
              <div className="p-3 rounded-lg border border-border bg-card/50">
                <p className="text-xs font-medium mb-1">{t('mcp.faq1Title')}</p>
                <p className="text-xs text-muted-foreground whitespace-pre-line">{t('mcp.faq1AnswerZh')}</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card/50">
                <p className="text-xs font-medium mb-1">{t('mcp.faq2Title')}</p>
                <p className="text-xs text-muted-foreground">{t('mcp.faq2Answer')}</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card/50">
                <p className="text-xs font-medium mb-1">{t('mcp.faq3Title')}</p>
                <p className="text-xs text-muted-foreground">{t('mcp.faq3AnswerZh')}</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card/50">
                <p className="text-xs font-medium mb-1">{t('mcp.faq4Title')}</p>
                <p className="text-xs text-muted-foreground">{t('mcp.faq4AnswerZh')}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Comparison row helper
function ComparisonRow({ label, values }: { label: string; values: boolean[] }) {
  return (
    <tr>
      <td className="px-3 py-2 text-muted-foreground">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-2 py-2 text-center">
          {v ? <span className="text-emerald-500">✓</span> : <span className="text-muted-foreground/40">✗</span>}
        </td>
      ))}
    </tr>
  )
}
