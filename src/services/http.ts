/**
 * Shared HTTP helpers — one timeout-aware fetch + User-Agent used by every
 * service and tool, instead of per-module fetch wrappers.
 */

export const USER_AGENT =
  "shadcn-svelte-mcp/1.0.0 (+https://github.com/Michael-Obele/shadcn-svelte-mcp)";

export const FETCH_TIMEOUT = 30_000; // 30 seconds

/** `fetch` with an AbortController timeout and the project User-Agent. */
export async function fetchWithTimeout(
  url: string,
  timeout: number = FETCH_TIMEOUT,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/** `fetchWithTimeout` + JSON parse. Throws on non-OK responses. */
export async function fetchJson<T>(
  url: string,
  timeout?: number,
): Promise<T> {
  const response = await fetchWithTimeout(url, timeout);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return (await response.json()) as T;
}
