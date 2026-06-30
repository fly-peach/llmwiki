export interface KnowledgeBase {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  source_count: number;
  wiki_page_count: number;
  created_at: string;
  updated_at: string;
}

export interface SaveResult {
  id: string;
  status: string;
  version?: number;
  highlights?: Highlight[];
}

export interface HighlightAnchor {
  xpath: string;
  endXPath?: string;
  startOffset: number;
  endOffset: number;
  textContent: string;
  prefix?: string | null;
  suffix?: string | null;
}

export interface TextAnchor {
  textStart: number;
  textEnd: number;
  textContent: string;
  prefix?: string | null;
  suffix?: string | null;
}

export interface Highlight {
  id: string;
  type: "text" | "pdf";
  anchor?: HighlightAnchor | null;
  textAnchor?: TextAnchor | null;
  comment: string | null;
  color: string;
  createdAt: string;
}

export interface DocumentByUrl {
  id: string;
  knowledge_base_id: string;
  title: string | null;
  path: string;
  filename: string;
  version: number;
  highlights: Highlight[];
}

export interface HighlightsResponse {
  id: string;
  version: number;
  highlights: Highlight[];
}

function jsonHeaders(): Record<string, string> {
  return { "Content-Type": "application/json" };
}

// ── smartFetch ──────────────────────────────────────────────
//
// MV3 content scripts make `fetch` calls from the page's origin. Most sites
// (Substack, Medium, console.cloud.google.com, anywhere with strict CSP) will
// block our API calls via CORS or CSP. The background service worker runs on
// the extension origin and holds the required host permission for the API
// origin — fetches there succeed. So when we're inside a content script we
// proxy through the background via chrome.runtime.sendMessage. In the popup
// (which loads on chrome-extension://...) direct fetch already works, so we
// use it.

function isContentScriptContext(): boolean {
  if (typeof window === "undefined") return false;
  // popup/background pages have chrome-extension:// origin
  return window.location.protocol !== "chrome-extension:";
}

interface SmartFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface SmartFetchResponse {
  ok: boolean;
  status: number;
  data: unknown;
  text: string;
}

async function smartFetch(url: string, init?: SmartFetchInit): Promise<SmartFetchResponse> {
  if (isContentScriptContext()) {
    const resp = await chrome.runtime.sendMessage({
      type: "API_FETCH",
      url,
      method: init?.method ?? "GET",
      headers: init?.headers,
      body: init?.body,
    });
    if (resp?.error && resp?.status === 0) {
      throw new Error(resp.error);
    }
    const text =
      typeof resp?.data === "string"
        ? resp.data
        : resp?.data
          ? JSON.stringify(resp.data)
          : "";
    return {
      ok: !!resp?.ok,
      status: resp?.status ?? 0,
      data: resp?.data ?? null,
      text,
    };
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { ok: res.ok, status: res.status, data, text };
}

export async function fetchKnowledgeBases(
  apiUrl: string,
): Promise<KnowledgeBase[]> {
  const res = await smartFetch(`${apiUrl}/v1/knowledge-bases`);
  if (!res.ok) throw new Error(`Failed to fetch knowledge bases: ${res.status}`);
  return res.data as KnowledgeBase[];
}

export async function createKnowledgeBase(
  apiUrl: string,
  name: string,
): Promise<KnowledgeBase> {
  const res = await fetch(`${apiUrl}/v1/knowledge-bases`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Failed to create knowledge base: ${res.status}`);
  return res.json();
}

export async function saveWebPage(
  apiUrl: string,
  knowledgeBaseId: string,
  payload: { url: string; title: string; html: string; path?: string; highlights?: Highlight[] },
): Promise<SaveResult> {
  const res = await smartFetch(
    `${apiUrl}/v1/knowledge-bases/${knowledgeBaseId}/documents/web`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    throw new Error(`Save failed (${res.status}): ${res.text}`);
  }
  return res.data as SaveResult;
}

export async function getDocumentByUrl(
  apiUrl: string,
  url: string,
): Promise<DocumentByUrl | null> {
  const res = await smartFetch(
    `${apiUrl}/v1/documents/by-url?url=${encodeURIComponent(url)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lookup failed: ${res.status}`);
  return res.data as DocumentByUrl;
}

export async function getHighlights(
  apiUrl: string,
  documentId: string,
): Promise<HighlightsResponse> {
  const res = await smartFetch(
    `${apiUrl}/v1/documents/${documentId}/highlights`,
  );
  if (!res.ok) throw new Error(`Fetch highlights failed: ${res.status}`);
  return res.data as HighlightsResponse;
}

export async function replaceHighlights(
  apiUrl: string,
  documentId: string,
  highlights: Highlight[],
  expectedVersion?: number,
): Promise<HighlightsResponse> {
  const res = await smartFetch(
    `${apiUrl}/v1/documents/${documentId}/highlights`,
    {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify({ highlights, expectedVersion }),
    },
  );
  if (res.status === 409) {
    throw Object.assign(new Error("Version conflict"), { conflict: true });
  }
  if (!res.ok) {
    throw new Error(`Save highlights failed (${res.status}): ${res.text}`);
  }
  return res.data as HighlightsResponse;
}

export async function moveDocument(
  apiUrl: string,
  documentId: string,
  knowledgeBaseId: string,
): Promise<void> {
  const res = await smartFetch(`${apiUrl}/v1/documents/${documentId}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify({ knowledge_base_id: knowledgeBaseId }),
  });
  if (!res.ok) {
    throw new Error(`Move failed (${res.status})`);
  }
}

export async function upsertHighlight(
  apiUrl: string,
  documentId: string,
  highlight: Highlight,
  expectedVersion?: number,
): Promise<HighlightsResponse> {
  const res = await smartFetch(
    `${apiUrl}/v1/documents/${documentId}/highlights`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ highlight, expectedVersion }),
    },
  );
  if (res.status === 409) {
    throw Object.assign(new Error("Version conflict"), { conflict: true });
  }
  if (!res.ok) {
    throw new Error(`Save highlight failed (${res.status}): ${res.text}`);
  }
  return res.data as HighlightsResponse;
}

export async function deleteHighlight(
  apiUrl: string,
  documentId: string,
  highlightId: string,
  expectedVersion?: number,
): Promise<HighlightsResponse> {
  const params = expectedVersion === undefined
    ? ""
    : `?expectedVersion=${encodeURIComponent(String(expectedVersion))}`;
  const res = await smartFetch(
    `${apiUrl}/v1/documents/${documentId}/highlights/${encodeURIComponent(highlightId)}${params}`,
    {
      method: "DELETE",
    },
  );
  if (res.status === 409) {
    throw Object.assign(new Error("Version conflict"), { conflict: true });
  }
  if (!res.ok) {
    throw new Error(`Delete highlight failed (${res.status}): ${res.text}`);
  }
  return res.data as HighlightsResponse;
}

export async function savePdf(
  apiUrl: string,
  pdfBytes: Uint8Array,
  filename: string,
  path = "/webclipper/",
): Promise<SaveResult> {
  // Copy bytes into a fresh ArrayBuffer so the resulting Blob/body matches
  // the BodyInit / BlobPart types regardless of the source buffer's TypedArray
  // backing (some lib.dom.d.ts versions reject SharedArrayBuffer-backed views).
  const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(pdfBuffer).set(pdfBytes);

  const form = new FormData();
  form.append("file", new Blob([pdfBuffer], { type: "application/pdf" }), filename);
  form.append("path", path);
  const res = await fetch(`${apiUrl}/v1/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = await res.json();
  return { id: data.id, status: "pending" };
}
