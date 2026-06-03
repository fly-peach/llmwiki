const GRANTED_ORIGINS_KEY = "llmwiki_granted_origins";

export function originToMatchPattern(origin: string): string {
  return `${origin}/*`;
}

export async function getGrantedOrigins(): Promise<string[]> {
  const result = await chrome.storage.local.get(GRANTED_ORIGINS_KEY);
  const value = result[GRANTED_ORIGINS_KEY];
  return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
}

export async function addGrantedOrigin(origin: string): Promise<void> {
  const list = await getGrantedOrigins();
  if (!list.includes(origin)) {
    await chrome.storage.local.set({ [GRANTED_ORIGINS_KEY]: [...list, origin] });
  }
}

export async function removeGrantedOrigin(origin: string): Promise<void> {
  const list = await getGrantedOrigins();
  if (list.includes(origin)) {
    await chrome.storage.local.set({
      [GRANTED_ORIGINS_KEY]: list.filter((o) => o !== origin),
    });
  }
}

export async function isOriginGranted(origin: string): Promise<boolean> {
  const list = await getGrantedOrigins();
  return list.includes(origin);
}
