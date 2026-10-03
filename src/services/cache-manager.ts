/**
 * Cache Manager Service
 * Web-compatible cache for documentation fetches.
 *
 * Tiered storage:
 * 1. In-memory LRU (always available)
 * 2. Disk (Node/Bun via dynamic `fs` import, auto-degrading elsewhere)
 *
 * The disk tier loads `node:fs` dynamically, so this module stays loadable on
 * runtimes without it and simply falls back to memory.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const IN_MEMORY_CACHE_SIZE = 50; // Max entries in the memory tier

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  url: string;
}

/** Set true to trace cache hits/misses to stdout. */
const DEBUG = false;

function log(message: string): void {
  if (DEBUG) console.log(message);
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
  if (age >= DEFAULT_TTL_MS) {
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
    // Not a Node-like runtime — memory only
    log(`[Cache] Disk cache unavailable, using memory only`);
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
    if (Date.now() - entry.timestamp >= DEFAULT_TTL_MS) {
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

/** Gets data from cache: memory → disk. Returns `null` on miss. */
export async function getFromCache<T>(url: string): Promise<T | null> {
  const key = getCacheKey(url);

  const memEntry = getFromMemoryCache<T>(key);
  if (memEntry) {
    log(`[Cache] Memory HIT: ${url}`);
    return memEntry.data;
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
  await saveToDisk(key, entry);
  log(`[Cache] Saved: ${url}`);
}

/** Returns cache statistics. */
export async function getCacheStats(): Promise<{
  memorySize: number;
  diskSize: number;
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

  return {
    memorySize: memoryCache.size,
    diskSize,
    totalSize: diskSize,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
