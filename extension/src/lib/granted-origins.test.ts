import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addGrantedOrigin,
  getGrantedOrigins,
  isOriginGranted,
  originToMatchPattern,
  removeGrantedOrigin,
} from "./granted-origins";

function installFakeChromeStorage(): Record<string, unknown> {
  const store: Record<string, unknown> = {};
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        async get(key: string) {
          return key in store ? { [key]: store[key] } : {};
        },
        async set(obj: Record<string, unknown>) {
          Object.assign(store, obj);
        },
      },
    },
  };
  return store;
}

describe("granted-origins", () => {
  beforeEach(() => {
    installFakeChromeStorage();
  });

  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it("originToMatchPattern appends /*", () => {
    expect(originToMatchPattern("https://example.com")).toBe("https://example.com/*");
  });

  it("starts empty", async () => {
    expect(await getGrantedOrigins()).toEqual([]);
    expect(await isOriginGranted("https://example.com")).toBe(false);
  });

  it("adds and dedups origins", async () => {
    await addGrantedOrigin("https://example.com");
    await addGrantedOrigin("https://example.com");
    await addGrantedOrigin("https://other.com");
    expect(await getGrantedOrigins()).toEqual([
      "https://example.com",
      "https://other.com",
    ]);
    expect(await isOriginGranted("https://example.com")).toBe(true);
  });

  it("removes origins", async () => {
    await addGrantedOrigin("https://example.com");
    await addGrantedOrigin("https://other.com");
    await removeGrantedOrigin("https://example.com");
    expect(await getGrantedOrigins()).toEqual(["https://other.com"]);
    expect(await isOriginGranted("https://example.com")).toBe(false);
  });

  it("filters out non-string stored values", async () => {
    const store = installFakeChromeStorage();
    store["llmwiki_granted_origins"] = ["https://ok.com", 42, null];
    expect(await getGrantedOrigins()).toEqual(["https://ok.com"]);
  });
});
