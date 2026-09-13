/**
 * Cache Manager Service
 * Web-compatible cache for documentation fetches.
 *
 * Tiered storage:
 * 1. In-memory LRU (always available)
 * 2. KV store (optional — Cloudflare Workers binding)
 * 3. Disk (optional — Node/Bun via dynamic `fs` import, auto-degrading)
 *
 * Runs on any JS runtime: Node, Bun, Deno, Cloudflare Workers.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const IN_MEMORY_CACHE_SIZE = 50; // Max entries in the memory tier

/**
 * Minimal structural type for a Cloudflare Workers KV namespace.
 * Keeps this module dependency-free (no @cloudflare/workers-types needed).
 */
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: {
    prefix?: string;
    cursor?: string;
  }): Promise<{ keys: Array<{ name: string }>; cursor: string }>;
}

interface CacheConfig {
  /** Entry lifetime in milliseconds (defaults to 3 days) */
  ttlMs?: number;
  /** Cloudflare KV namespace binding (Workers) */
  kv?: KVNamespace | null;
  /** Verbose logging (defaults to `false`) */
  debug?: boolean;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  url: string;
}

let config: Required<CacheConfig> = {
  ttlMs: DEFAULT_TTL_MS,
  kv: null,
  debug: false,
};

/**
 * Configure the cache at runtime. Call once at startup (e.g. from the
 * Worker entry point) before any fetch happens.
 */
export function configureCache(options: CacheConfig = {}): void {
  config = {
    ttlMs: options.ttlMs ?? DEFAULT_TTL_MS,
    kv: options.kv ?? null,
    debug: options.debug ?? false,
  };
  if (config.debug) {
    console.log(
      `[Cache] Configured: ttl=${config.ttlMs}ms, kv=${config.kv ? "yes" : "no"}`,
    );
  }
}

// ---------------------------------------------------------------------------
// In-memory tier (LRU)
// ---------------------------------------------------------------------------

const memoryCache = new Map<string, CacheEntry<unknown>>();
const accessOrder: string[] = [];

function addToMemoryCache(key: string, entry: CacheEntry<unknown>): void {
  const index = accessOrder.indexOf(key);
  if (index > -1) accessOrder.splice(index, 1);

  memoryCache.set(key, entry);
  accessOrder.push(key);

  if (memoryCache.size > IN_MEMORY_CACHE_SIZE) {
    const oldestKey = accessOrder.shift();
    if (oldestKey) {
      memoryCache.delete(oldestKey);
      log(`[Cache] Evicted from memory: ${oldestKey}`);
    }
  }
}

function getFromMemoryCache<T>(key: string): CacheEntry<T> | undefined {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;

  const age = Date.now() - entry.timestamp;
  if (age >= config.ttlMs) {
    memoryCache.delete(key);
    const index = accessOrder.indexOf(key);
    if (index > -1) accessOrder.splice(index, 1);
    return undefined;
  }

  const index = accessOrder.indexOf(key);
  if (index > -1) accessOrder.splice(index, 1);
  accessOrder.push(key);
  return entry;
}

// ---------------------------------------------------------------------------
// KV tier (Cloudflare Workers)
// ---------------------------------------------------------------------------

const KV_PREFIX = "cache:";

async function getFromKv<T>(key: string): Promise<CacheEntry<T> | null> {
  if (!config.kv) return null;
  try {
    const raw = await config.kv.get(`${KV_PREFIX}${key}`);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp >= config.ttlMs) {
      await config.kv.delete(`${KV_PREFIX}${key}`);
      return null;
    }
    return entry;
  } catch (error) {
    console.error("[Cache] Error reading from KV:", error);
    return null;
  }
}

async function saveToKv(
  key: string,
  entry: CacheEntry<unknown>,
): Promise<void> {
  if (!config.kv) return;
  try {
    await config.kv.put(
      `${KV_PREFIX}${key}`,
      JSON.stringify(entry),
      // KV's own expiration (seconds) as a safety net
      { expirationTtl: Math.ceil(config.ttlMs / 1000) },
    );
  } catch (error) {
    console.error("[Cache] Error writing to KV:", error);
  }
}

// ---------------------------------------------------------------------------
// Disk tier (Node/Bun only — auto-degrades elsewhere)
// ---------------------------------------------------------------------------

type FsLike = typeof import("node:fs/promises");
type PathLike = typeof import("node:path");

let disk: { fs: FsLike; path: PathLike; dir: string } | null = null;

async function ensureDiskCache(): Promise<boolean> {
  if (disk) return true;
  try {
    // Dynamic import keeps this module loadable on runtimes without node:fs
    const [fs, path] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);
    const dir = path.join(process.cwd(), ".cache");
    await fs.mkdir(dir, { recursive: true });
    disk = { fs, path, dir };
    log(`[Cache] Initialized disk cache: ${dir}`);
    return true;
  } catch (error) {
    // Not a Node-like runtime (e.g. Cloudflare Workers) — memory/KV only
    log(
      `[Cache] Disk cache unavailable, using memory${config.kv ? "+KV" : ""} only`,
    );
    disk = null;
    return false;
  }
}

function getCacheKey(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 32-bit
  }
  return `cache_${Math.abs(hash)}.json`;
}

async function getFromDisk<T>(key: string): Promise<CacheEntry<T> | null> {
  if (!disk) return null;
  try {
    const filePath = disk.path.join(disk.dir, key);
    const fileContent = await disk.fs.readFile(filePath, "utf-8");
    const entry: CacheEntry<T> = JSON.parse(fileContent);
    if (Date.now() - entry.timestamp >= config.ttlMs) {
      await disk.fs.unlink(filePath);
      return null;
    }
    return entry;
  } catch {
    return null; // miss or unreadable — treat as miss
  }
}

async function saveToDisk(
  key: string,
  entry: CacheEntry<unknown>,
): Promise<void> {
  if (!disk) return;
  try {
    const filePath = disk.path.join(disk.dir, key);
    await disk.fs.writeFile(filePath, JSON.stringify(entry, null, 2), "utf-8");
  } catch (error) {
    console.error("[Cache] Error writing to disk cache:", error);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Initializes the cache (disk tier) — safe to call on any runtime. */
export async function initializeCache(): Promise<void> {
  await ensureDiskCache();
}

/** Gets data from cache: memory → KV → disk. Returns `null` on miss. */
export async function getFromCache<T>(url: string): Promise<T | null> {
  const key = getCacheKey(url);

  const memEntry = getFromMemoryCache<T>(key);
  if (memEntry) {
    log(`[Cache] Memory HIT: ${url}`);
    return memEntry.data;
  }

  const kvEntry = await getFromKv<T>(key);
  if (kvEntry) {
    addToMemoryCache(key, kvEntry);
    log(`[Cache] KV HIT: ${url}`);
    return kvEntry.data;
  }

  const diskEntry = await getFromDisk<T>(key);
  if (diskEntry) {
    addToMemoryCache(key, diskEntry);
    log(`[Cache] Disk HIT: ${url}`);
    return diskEntry.data;
  }

  log(`[Cache] MISS: ${url}`);
  return null;
}

/** Saves data to all available tiers. */
export async function saveToCache<T>(url: string, data: T): Promise<void> {
  const key = getCacheKey(url);
  const entry: CacheEntry<T> = { data, timestamp: Date.now(), url };

  addToMemoryCache(key, entry);
  await Promise.all([saveToKv(key, entry), saveToDisk(key, entry)]);
  log(`[Cache] Saved: ${url}`);
}

/** Returns cache statistics. */
export async function getCacheStats(): Promise<{
  memorySize: number;
  diskSize: number;
  kvSize: number;
  totalSize: number;
}> {
  let diskSize = 0;
  if (disk) {
    try {
      const files = await disk.fs.readdir(disk.dir);
      diskSize = files.filter(
        (f) => f.startsWith("cache_") && f.endsWith(".json"),
      ).length;
    } catch {
      // ignore
    }
  }

  let kvSize = 0;
  if (config.kv) {
    try {
      const page = await config.kv.list({ prefix: KV_PREFIX });
      kvSize = page.keys.length;
    } catch {
      // ignore
    }
  }

  return {
    memorySize: memoryCache.size,
    diskSize,
    kvSize,
    totalSize: diskSize + kvSize,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(message: string): void {
  if (config.debug) console.log(message);
}
