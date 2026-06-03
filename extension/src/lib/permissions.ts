import {
  addGrantedOrigin,
  getGrantedOrigins,
  isOriginGranted,
  originToMatchPattern,
  removeGrantedOrigin,
} from "./granted-origins";

const CONTENT_SCRIPT_ID = "llmwiki-dynamic";
const CONTENT_SCRIPT_JS = "content-scripts/content.js";

// Must be called inside a user gesture.
export async function requestOriginPermission(origins: string[]): Promise<boolean> {
  try {
    return await chrome.permissions.request({ origins });
  } catch {
    return false;
  }
}

export async function hasOriginPermission(origin: string): Promise<boolean> {
  try {
    return await chrome.permissions.contains({
      origins: [originToMatchPattern(origin)],
    });
  } catch {
    return false;
  }
}

export async function registerForGrantedOrigins(): Promise<void> {
  const stored = await getGrantedOrigins();
  const live: string[] = [];
  for (const origin of stored) {
    if (await hasOriginPermission(origin)) live.push(origin);
  }
  const matches = live.map(originToMatchPattern);

  const existing = await chrome.scripting
    .getRegisteredContentScripts({ ids: [CONTENT_SCRIPT_ID] })
    .catch(() => [] as chrome.scripting.RegisteredContentScript[]);
  const isRegistered = existing.some((s) => s.id === CONTENT_SCRIPT_ID);

  // registerContentScripts rejects an empty `matches`.
  if (matches.length === 0) {
    if (isRegistered) {
      await chrome.scripting
        .unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] })
        .catch(() => {});
    }
    return;
  }

  const script: chrome.scripting.RegisteredContentScript = {
    id: CONTENT_SCRIPT_ID,
    js: [CONTENT_SCRIPT_JS],
    matches,
    runAt: "document_idle",
    allFrames: false,
    persistAcrossSessions: true,
  };

  if (isRegistered) {
    await chrome.scripting.updateContentScripts([script]).catch(async () => {
      await chrome.scripting
        .unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] })
        .catch(() => {});
      await chrome.scripting.registerContentScripts([script]).catch(() => {});
    });
  } else {
    await chrome.scripting.registerContentScripts([script]).catch(() => {});
  }
}

export async function enableSiteFromPopup(origin: string, tabId?: number): Promise<boolean> {
  const granted = await requestOriginPermission([originToMatchPattern(origin)]);
  if (!granted) return false;
  const wasAlreadyEnabled = await isOriginGranted(origin);
  await addGrantedOrigin(origin);
  await registerForGrantedOrigins();
  // A fresh enable needs a one-shot inject; an already-enabled origin is auto-injected by its registration.
  if (!wasAlreadyEnabled && typeof tabId === "number") {
    await chrome.scripting
      .executeScript({ target: { tabId }, files: [CONTENT_SCRIPT_JS] })
      .catch(() => {});
  }
  return true;
}

export async function disableSite(origin: string): Promise<void> {
  await removeGrantedOrigin(origin);
  await chrome.permissions
    .remove({ origins: [originToMatchPattern(origin)] })
    .catch(() => {});
  await registerForGrantedOrigins();
}
