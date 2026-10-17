export interface RuntimeConfig {
  wsUrl?: string;
}

/**
 * Reads /config.json at runtime so the deployed client can be pointed at any
 * WebSocket server without rebuilding the bundle.
 */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL;
    const response = await fetch(`${base ?? "/"}config.json`, {
      cache: "no-store",
    });
    if (!response.ok) return {};
    const data = (await response.json()) as unknown;
    if (!data || typeof data !== "object") return {};
    const wsUrl = (data as { wsUrl?: unknown }).wsUrl;
    return typeof wsUrl === "string" ? { wsUrl } : {};
  } catch {
    return {};
  }
}

const LOCAL_HOST_RE =
  /^(localhost|127\.0\.0\.1|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

export function resolveWsUrl(configured?: string): string {
  const explicit = configured?.trim();
  if (explicit) return explicit;

  const envUrl = (import.meta as { env?: { VITE_WS_URL?: string } }).env
    ?.VITE_WS_URL;
  if (envUrl?.trim()) return envUrl.trim();

  const globalUrl = (globalThis as { __BRISCA_WS_URL__?: unknown })
    .__BRISCA_WS_URL__;
  if (typeof globalUrl === "string" && globalUrl.trim()) {
    return globalUrl.trim();
  }

  if (typeof window === "undefined") return "";

  const fromQuery = new URLSearchParams(window.location.search).get("ws");
  if (fromQuery) return fromQuery;

  const host = window.location.hostname;
  const proto = window.location.protocol === "https:" ? "wss" : "ws";

  // When the game is served by the same Worker (brisca-3d.<sub>.workers.dev)
  // the WebSocket lives on the same origin, so no configuration is needed.
  if (host.endsWith(".workers.dev") || host.endsWith(".pages.dev")) {
    return `${proto}://${host}/ws`;
  }

  // Vercel hosts a WebSocket relay (api/ws.ts) because some ISPs block the
  // Cloudflare workers.dev IP range. The relay talks to the Durable Object.
  if (host.endsWith(".vercel.app")) {
    return `${proto}://${host}/api/ws`;
  }

  if (!LOCAL_HOST_RE.test(host)) {
    // In production the URL must come from /config.json or VITE_WS_URL.
    return "";
  }

  return `${proto}://${host}:8080`;
}

export function readInviteCode(search: string): string | null {
  const code = new URLSearchParams(search).get("room");
  if (!code) return null;
  const normalized = code.toUpperCase().trim();
  return /^[A-Z2-9]{4}$/.test(normalized) ? normalized : null;
}

export function buildInviteUrl(code: string): string {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("room", code);
  return url.toString();
}

export function readStoredName(): string {
  try {
    return localStorage.getItem("brisca:name") ?? "";
  } catch {
    return "";
  }
}

export function storeName(name: string): void {
  try {
    localStorage.setItem("brisca:name", name);
  } catch {
    // private mode
  }
}

export function tokenKey(roomCode: string): string {
  return `brisca:token:${roomCode}`;
}

export function readStoredToken(roomCode: string): string {
  try {
    return sessionStorage.getItem(tokenKey(roomCode)) ?? "";
  } catch {
    return "";
  }
}

export function storeToken(roomCode: string, token: string): void {
  try {
    sessionStorage.setItem(tokenKey(roomCode), token);
  } catch {
    // private mode
  }
}
