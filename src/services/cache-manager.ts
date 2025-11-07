/**
 * Cache Manager Service
 * Manages in-memory and file-based caching for documentation
 */

import fs from "fs/promises";
import path from "path";

// Cache configuration
const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_TTL = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
const IN_MEMORY_CACHE_SIZE = 50; // Number of items to keep in memory

// Types
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  url: string;
}

interface CacheMetadata {
  size: number;
  lastCleanup: number;
  entries: Record<string, { timestamp: number; size: number }>;
}

// In-memory cache (LRU-like)
const memoryCache = new Map<string, CacheEntry<any>>();
const accessOrder: string[] = [];

/**
 * Initializes the cache directory
 */
export async function initializeCache(): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    console.log(`[Cache] Initialized cache directory: ${CACHE_DIR}`);
  } catch (error) {
    console.error("[Cache] Failed to initialize cache directory:", error);
  }
}

/**
 * Generates a cache key from a URL
 */
function getCacheKey(url: string): string {
  // Simple hash function for URL
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `cache_${Math.abs(hash)}.json`;
}

/**
 * Gets data from cache (checks memory first, then disk)
 */
export async function getFromCache<T>(url: string): Promise<T | null> {
  const key = getCacheKey(url);

  // Check memory cache first
  const memEntry = memoryCache.get(key);
  if (memEntry) {
    const age = Date.now() - memEntry.timestamp;
    if (age < CACHE_TTL) {
      // Update access order for LRU
      const index = accessOrder.indexOf(key);
      if (index > -1) accessOrder.splice(index, 1);
      accessOrder.push(key);

      console.log(
        `[Cache] Memory cache HIT for ${url} (age: ${Math.round(age / 1000)}s)`
      );
      return memEntry.data as T;
    } else {
      // Expired in memory
      memoryCache.delete(key);
      const index = accessOrder.indexOf(key);
      if (index > -1) accessOrder.splice(index, 1);
    }
  }

  // Check disk cache
  try {
    const filePath = path.join(CACHE_DIR, key);
    const fileContent = await fs.readFile(filePath, "utf-8");
    const entry: CacheEntry<T> = JSON.parse(fileContent);

    const age = Date.now() - entry.timestamp;
    if (age < CACHE_TTL) {
      // Store in memory for faster access next time
      addToMemoryCache(key, entry);
      console.log(
        `[Cache] Disk cache HIT for ${url} (age: ${Math.round(age / 1000)}s)`
      );
      return entry.data;
    } else {
      // Expired on disk, delete it
      await fs.unlink(filePath);
      console.log(`[Cache] Expired cache deleted for ${url}`);
    }
  } catch (error) {
    // Cache miss or error reading
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("[Cache] Error reading from disk cache:", error);
    }
  }

  console.log(`[Cache] MISS for ${url}`);
  return null;
}

/**
 * Saves data to cache (both memory and disk)
 */
export async function saveToCache<T>(url: string, data: T): Promise<void> {
  const key = getCacheKey(url);
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    url,
  };

  // Save to memory
  addToMemoryCache(key, entry);

  // Save to disk
  try {
    const filePath = path.join(CACHE_DIR, key);
    await fs.writeFile(filePath, JSON.stringify(entry, null, 2), "utf-8");
    console.log(`[Cache] Saved to cache: ${url}`);
  } catch (error) {
    console.error("[Cache] Error writing to disk cache:", error);
  }
}

/**
 * Adds entry to memory cache with LRU eviction
 */
function addToMemoryCache<T>(key: string, entry: CacheEntry<T>): void {
  // Remove from access order if exists
  const index = accessOrder.indexOf(key);
  if (index > -1) accessOrder.splice(index, 1);

  // Add to memory and access order
  memoryCache.set(key, entry);
  accessOrder.push(key);

  // Evict oldest if over size limit
  if (memoryCache.size > IN_MEMORY_CACHE_SIZE) {
    const oldestKey = accessOrder.shift();
    if (oldestKey) {
      memoryCache.delete(oldestKey);
      console.log(`[Cache] Evicted from memory: ${oldestKey}`);
    }
  }
}

/**
 * Clears all cache (memory and disk)
 */
export async function clearCache(): Promise<void> {
  // Clear memory
  memoryCache.clear();
  accessOrder.length = 0;

  // Clear disk
  try {
    const files = await fs.readdir(CACHE_DIR);
    await Promise.all(
      files
        .filter((f) => f.startsWith("cache_") && f.endsWith(".json"))
        .map((f) => fs.unlink(path.join(CACHE_DIR, f)))
    );
    console.log("[Cache] Cleared all cache");
  } catch (error) {
    console.error("[Cache] Error clearing disk cache:", error);
  }
}

/**
 * Cleans up expired cache entries
 */
export async function cleanupCache(): Promise<void> {
  try {
    const files = await fs.readdir(CACHE_DIR);
    let removed = 0;

    for (const file of files) {
      if (!file.startsWith("cache_") || !file.endsWith(".json")) continue;

      try {
        const filePath = path.join(CACHE_DIR, file);
        const content = await fs.readFile(filePath, "utf-8");
        const entry: CacheEntry<any> = JSON.parse(content);

        const age = Date.now() - entry.timestamp;
        if (age >= CACHE_TTL) {
          await fs.unlink(filePath);
          removed++;
        }
      } catch (error) {
        // Skip invalid cache files
      }
    }

    if (removed > 0) {
      console.log(`[Cache] Cleanup: removed ${removed} expired entries`);
    }
  } catch (error) {
    console.error("[Cache] Error during cleanup:", error);
  }
}

/**
 * Gets cache statistics
 */
export async function getCacheStats(): Promise<{
  memorySize: number;
  diskSize: number;
  totalSize: number;
}> {
  const memorySize = memoryCache.size;

  let diskSize = 0;
  try {
    const files = await fs.readdir(CACHE_DIR);
    diskSize = files.filter(
      (f) => f.startsWith("cache_") && f.endsWith(".json")
    ).length;
  } catch (error) {
    // Ignore errors
  }

  return {
    memorySize,
    diskSize,
    totalSize: diskSize, // Total unique entries on disk
  };
}

/**
 * Pre-fetches commonly used documentation
 */
export async function prewarmCache(urls: string[]): Promise<void> {
  console.log(`[Cache] Pre-warming cache with ${urls.length} URLs...`);
  // This will be implemented by the fetcher service
}

// Initialize cache on module load
initializeCache();

// Cleanup expired cache every hour
setInterval(cleanupCache, 60 * 60 * 1000);
