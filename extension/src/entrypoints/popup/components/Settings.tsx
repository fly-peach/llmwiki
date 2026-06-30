import React, { useEffect, useRef, useState } from "react";
import {
  checkLocalHealth,
  getLocalUrl,
  normalizeApiUrl,
  setLocalUrl,
} from "@/lib/settings";

interface Props {
  onBack: () => void;
}

export default function Settings({ onBack }: Props) {
  const [localUrl, setLocalUrlState] = useState("http://localhost:8000");
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);
  const validatingRef = useRef(false);

  useEffect(() => {
    getLocalUrl().then(setLocalUrlState);
    return () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, []);

  async function handleUrlSave() {
    await connectLocal(localUrl);
  }

  async function handleBack() {
    const connected = await connectLocal(localUrl);
    if (connected) onBack();
  }

  async function connectLocal(url: string): Promise<boolean> {
    if (validatingRef.current) return false;
    validatingRef.current = true;
    const normalized = normalizeApiUrl(url);
    setChecking(true);
    setMessage(null);
    setSaved(false);
    const connected = await checkLocalHealth(normalized);
    validatingRef.current = false;
    setChecking(false);
    if (!connected) {
      setMessage(`Could not connect to ${normalized}/health. Check that your local LLM Wiki is running.`);
      return false;
    }
    await setLocalUrl(normalized);
    setLocalUrlState(normalized);
    flash(`Connected to ${normalized}`);
    return true;
  }

  function flash(nextMessage: string) {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    setMessage(nextMessage);
    setSaved(true);
    flashTimer.current = window.setTimeout(() => {
      setSaved(false);
      setMessage(null);
      flashTimer.current = null;
    }, 1800);
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleBack}
        disabled={checking}
        className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
      >
        &larr; Back
      </button>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-700">
          API URL
        </label>
        <div className="flex gap-2">
          <input
            value={localUrl}
            onChange={(e) => {
              setLocalUrlState(e.target.value);
              setSaved(false);
              setMessage("Click away to test /health.");
            }}
            onBlur={() => {
              if (!checking) handleUrlSave();
            }}
            onKeyDown={(e) => { if (e.key === "Enter") handleUrlSave(); }}
            disabled={checking}
            className="h-9 min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-3
                       font-mono text-xs text-zinc-950 shadow-sm outline-none
                       transition-colors focus:border-zinc-400 focus:ring-2
                       focus:ring-zinc-950/10"
            placeholder="http://localhost:8000"
          />
          <button
            onClick={handleUrlSave}
            disabled={checking}
            className="h-9 rounded-md bg-zinc-950 px-3 text-xs font-medium text-zinc-50
                       transition-colors hover:bg-zinc-800 disabled:cursor-default disabled:opacity-60"
          >
            {checking ? "Checking" : "Test"}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] leading-4 text-zinc-500">
          Saves to your local LLM Wiki instance, no sign in needed.
        </p>
      </div>

      {message && (
        <p className={`text-xs ${saved ? "text-emerald-700" : "text-red-700"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
