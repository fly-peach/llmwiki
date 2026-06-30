import { getApiUrl } from "@/lib/settings";
import { isAllowedApiFetchUrl, isSupportedRemoteResourceUrl } from "@/lib/security";

type Message =
  | { type: "DOWNLOAD_PDF"; url: string }
  | { type: "FETCH_IMAGE_DATA_URL"; url: string; maxBytes?: number }
  | {
      type: "API_FETCH";
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    };

interface ApiFetchResponse {
  ok: boolean;
  status: number;
  data?: unknown;
  error?: string;
}

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener(
    (message: Message, sender, sendResponse) => {
      // Only our own contexts (popup, injected content scripts) may drive these
      // privileged handlers. Without externally_connectable no web page can
      // reach here, but reject foreign senders as defense in depth.
      if (sender.id !== chrome.runtime.id) return false;
      handleMessage(message)
        .then(sendResponse)
        .catch((err: unknown) => {
          sendResponse({ error: err instanceof Error ? err.message : "Background error" });
        });
      return true; // will respond asynchronously
    },
  );

  async function handleMessage(msg: Message) {
    switch (msg.type) {
      case "DOWNLOAD_PDF":
        return downloadPdf(msg.url);
      case "FETCH_IMAGE_DATA_URL":
        return fetchImageDataUrl(msg.url, msg.maxBytes);
      case "API_FETCH":
        return apiFetchProxy(msg);
      default:
        return { error: "Unknown message type" };
    }
  }

  // ── API fetch proxy ─────────────────────────────────────
  //
  // Content scripts in MV3 fetch from the page's origin, which means most
  // sites (Substack, console.cloud.google.com, NYT, etc.) block our calls
  // via CORS or strict CSP. The background service worker has the privileged
  // chrome-extension origin and the required host_permission for the API
  // origin, so it can make the request and forward the result. The target is
  // gated to the configured API origin by isAllowedApiFetchUrl.

  async function apiFetchProxy(
    msg: {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    },
  ): Promise<ApiFetchResponse> {
    try {
      if (!isAllowedApiFetchUrl(msg.url, await getApiUrl())) {
        return { ok: false, status: 403, error: "Blocked extension fetch target" };
      }
      const res = await fetch(msg.url, {
        method: msg.method ?? "GET",
        headers: msg.headers,
        body: msg.body,
      });
      let data: unknown = null;
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      return { ok: false, status: 0, error: message };
    }
  }

  // ── PDF Download ────────────────────────────────────────

  async function downloadPdf(
    url: string,
  ): Promise<{ blob: number[]; filename: string } | { error: string }> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { error: `Download failed: ${response.status}` };
      }

      const buffer = await response.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buffer));

      // Derive filename
      let filename = "document.pdf";
      const disposition = response.headers.get("content-disposition");
      if (disposition) {
        const match = disposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
        );
        if (match?.[1]) {
          filename = match[1].replace(/['"]/g, "");
        }
      } else {
        const lastSegment = new URL(url).pathname.split("/").pop();
        if (lastSegment?.endsWith(".pdf")) {
          filename = lastSegment;
        }
      }

      return { blob: bytes, filename };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "PDF download failed";
      return { error: message };
    }
  }

  async function fetchImageDataUrl(
    url: string,
    maxBytes = 2_500_000,
  ): Promise<{ dataUrl: string; size: number; mimeType: string } | { error: string }> {
    try {
      if (!isSupportedRemoteResourceUrl(url)) {
        return { error: "Unsupported image URL" };
      }
      // No credentials: capture the public bytes of cross-origin images, never
      // the viewer's authenticated version (which would archive private images
      // into the wiki). The API falls back to its own credential-less fetch.
      const response = await fetch(url, {
        credentials: "omit",
        cache: "force-cache",
      });
      if (!response.ok) {
        return { error: `Image fetch failed: ${response.status}` };
      }

      const mimeType = (response.headers.get("content-type") || "").split(";", 1)[0].toLowerCase();
      if (!["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"].includes(mimeType)) {
        return { error: `Unsupported image type: ${mimeType || "unknown"}` };
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > maxBytes) {
        return { error: `Image too large: ${buffer.byteLength}` };
      }

      const bytes = new Uint8Array(buffer);
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }

      return {
        dataUrl: `data:${mimeType};base64,${btoa(binary)}`,
        size: buffer.byteLength,
        mimeType,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Image fetch failed";
      return { error: message };
    }
  }
});
