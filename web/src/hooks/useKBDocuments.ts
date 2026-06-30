'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useUserStore } from '@/stores'
import type { DocumentListItem } from '@/lib/types'

const POLL_INTERVAL = 2000

// Fields whose change we want to *force* a re-render through identity churn.
// `updated_at` is intentionally excluded — it bumps on every UPDATE (incl.
// highlight-only writes) and would otherwise unmount the active viewer.
const IDENTITY_FIELDS: ReadonlyArray<keyof DocumentListItem> = [
  'id', 'filename', 'title', 'path', 'file_type', 'status', 'archived',
  'tags', 'date', 'metadata', 'version', 'document_number', 'error_message',
]

function shallowEqualForIdentity(a: DocumentListItem, b: DocumentListItem): boolean {
  for (const k of IDENTITY_FIELDS) {
    const av = a[k]
    const bv = b[k]
    if (av === bv) continue
    // Arrays and dicts: fall back to JSON compare. Cheap for our row sizes
    // and avoids pulling in a deep-equal dependency.
    if (typeof av === 'object' || typeof bv === 'object') {
      if (JSON.stringify(av) !== JSON.stringify(bv)) return false
      continue
    }
    return false
  }
  return true
}

function mergePreservingIdentity(
  prev: DocumentListItem[],
  next: DocumentListItem[],
): DocumentListItem[] {
  if (prev.length === 0) return next
  const prevById = new Map(prev.map((d) => [d.id, d]))
  let allSame = prev.length === next.length
  const merged = next.map((nextDoc, i) => {
    const prevDoc = prevById.get(nextDoc.id)
    const result = prevDoc && shallowEqualForIdentity(prevDoc, nextDoc) ? prevDoc : nextDoc
    if (result !== prev[i]) allSame = false
    return result
  })
  return allSame ? prev : merged
}

export function useKBDocuments(knowledgeBaseId: string) {
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const accessToken = useUserStore((s) => s.accessToken)

  const fetchDocs = React.useCallback(async () => {
    if (!knowledgeBaseId || !accessToken) return
    try {
      const data = await apiFetch<DocumentListItem[]>(
        `/v1/knowledge-bases/${knowledgeBaseId}/documents`,
        accessToken,
      )
      // Preserve object identity for rows whose user-visible content hasn't
      // actually changed. Highlight saves bump `updated_at` (via the row's
      // UPDATE trigger) without changing any field we render in this list,
      // so without this merge the WS-triggered refetch would churn references
      // downstream and cause the active doc viewer to remount.
      setDocuments((prev) => mergePreservingIdentity(prev, data))
    } catch (err) {
      console.error('Failed to load documents:', err)
    }
  }, [knowledgeBaseId, accessToken])

  // Initial load — always use the API
  React.useEffect(() => {
    if (!knowledgeBaseId) {
      setDocuments([])
      setLoading(false)
      return
    }
    setLoading(true)
    fetchDocs().finally(() => setLoading(false))
  }, [knowledgeBaseId, fetchDocs])

  // Real-time updates: poll the API (local mode)
  React.useEffect(() => {
    if (!knowledgeBaseId || !accessToken) return

    const interval = setInterval(fetchDocs, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [knowledgeBaseId, accessToken, fetchDocs])

  const refetchDocuments = React.useCallback(() => {
    fetchDocs()
  }, [fetchDocs])

  return { documents, setDocuments, loading, refetchDocuments }
}
