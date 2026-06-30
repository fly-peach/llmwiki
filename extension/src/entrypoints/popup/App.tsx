import React, { useEffect, useState } from "react";
import SaveForm from "./components/SaveForm";
import Settings from "./components/Settings";
import {
  checkLocalHealth,
  getApiUrl,
  isBuiltInDisabledHost,
  isDomainDisabled,
  setDomainDisabled,
} from "@/lib/settings";

type View = "main" | "settings";

export default function App() {
  const [view, setView] = useState<View>("main");
  const [apiUrl, setApiUrl] = useState("");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [currentHost, setCurrentHost] = useState<string | null>(null);
  const [hostDisabled, setHostDisabled] = useState(false);
  const [showReloadHint, setShowReloadHint] = useState(false);

  useEffect(() => {
    init();
    detectCurrentHost();
  }, []);

  async function init() {
    const url = await getApiUrl();
    setApiUrl(url);
    const connected = await checkLocalHealth(url);
    setConnectionError(
      connected
        ? null
        : `Could not connect to ${url}/health. Check your API URL in settings.`,
    );
  }

  async function detectCurrentHost() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return;
      const host = new URL(tab.url).hostname.replace(/^www\./, "");
      if (!host) return;
      setCurrentHost(host);
      setHostDisabled(await isDomainDisabled(host));
    } catch {
      // Restricted page or no permissions; the toggle button stays hidden.
    }
  }

  async function handleToggleHost() {
    if (!currentHost) return;
    const next = !hostDisabled;
    await setDomainDisabled(currentHost, next);
    setHostDisabled(next);
    setShowReloadHint(true);
    window.setTimeout(() => setShowReloadHint(false), 3000);
  }

  if (view === "settings") {
    return (
      <div className="w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-sans text-zinc-950 shadow-[0_8px_30px_rgba(15,23,42,0.14),0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-white/80">
        <Settings onBack={() => setView("main")} />
      </div>
    );
  }

  const showHostToggle = !!currentHost && !isBuiltInDisabledHost(currentHost);

  return (
    <div className="w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-sans text-zinc-950 shadow-[0_8px_30px_rgba(15,23,42,0.14),0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-white/80">
      {/* Header — source chip (left) + actions (right) */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-500">
          {currentHost && (
            <span className="min-w-0 truncate font-medium text-zinc-700">{currentHost}</span>
          )}
          <span className="rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
            local
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {showHostToggle && (
            <button
              onClick={handleToggleHost}
              title={`${hostDisabled ? "Enable" : "Disable"} on ${currentHost}`}
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              {hostDisabled ? (
                /* eye-off */
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              ) : (
                /* eye */
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          )}
          <button
            onClick={() => setView("settings")}
            className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            Settings
          </button>
        </div>
      </div>

      {showReloadHint && (
        <div className="mb-3 rounded-md border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-[11px] text-zinc-600">
          Reload the page to apply.
        </div>
      )}

      {connectionError && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {connectionError}
        </div>
      )}

      {apiUrl && <SaveForm apiUrl={apiUrl} />}
    </div>
  );
}
