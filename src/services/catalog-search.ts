/**
 * Pure search core for the catalog.
 *
 * Turns a query into ranked matches without any I/O, so the ranking can be
 * reasoned about and verified in isolation. The search tool wires this to the
 * live catalog from `catalog.ts`.
 *
 * Strategy: tokenize the query into meaningful terms, fuzzy-match each term
 * across name / keywords / title / category / description, then union the
 * per-term hits ranked by coverage (how many terms matched) and strength.
 */

import Fuse from "fuse.js";
import { tokenizeWords, type CatalogItem } from "./catalog.js";

/** Query words that add no search signal (never real component names). */
const QUERY_STOPWORDS = new Set([
  "a", "an", "the", "for", "of", "to", "and", "or", "with", "that", "this",
  "is", "are", "be", "can", "as", "it", "its", "your", "you", "we", "i", "my",
  "component", "components", "ui", "need", "want", "looking", "look", "like",
  "make", "build", "create", "using", "use", "how", "do", "me", "some", "any",
]);

export interface ScoredItem {
  item: CatalogItem;
  score: number;
  /** How well the best-matching terms matched (0-100). */
  similarity: number;
  /** Share of query terms that matched anywhere (0-1). */
  coverage: number;
}

/** Meaningful, de-duplicated search terms for a query. */
export function queryTerms(query: string): string[] {
  const raw = tokenizeWords(query);
  const filtered = raw.filter((term) => !QUERY_STOPWORDS.has(term));
  const chosen = filtered.length > 0 ? filtered : raw;
  return [...new Set(chosen)];
}

/**
 * Weighted multi-key index. Heavier keys (name) dominate the score; the
 * description/keywords/category keys are what make intent queries land.
 */
export function buildFuse(items: CatalogItem[]): Fuse<CatalogItem> {
  return new Fuse(items, {
    keys: [
      { name: "name", weight: 2.4 },
      { name: "keywords", weight: 1.3 },
      { name: "title", weight: 1.4 },
      { name: "category", weight: 1.0 },
      { name: "description", weight: 1.4 },
    ],
    // 0.2 keeps real typos ("buton" → "button") while rejecting bitap
    // false positives on short words ("dark" → "dar-" in "calendar").
    threshold: 0.2,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2,
    distance: 200,
  });
}

/** Runs one query: per-term fuzzy search, union, coverage-ranked. */
export function searchOnce(
  fuse: Fuse<CatalogItem>,
  query: string,
  limit: number,
): ScoredItem[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];

  const aggregate = new Map<
    string,
    { item: CatalogItem; score: number; matched: number; simSum: number }
  >();

  for (const term of terms) {
    for (const result of fuse.search(term, { limit: 80 })) {
      const key = `${result.item.type}:${result.item.name}`;
      const similarity = 1 - (result.score ?? 0);
      const entry =
        aggregate.get(key) ??
        { item: result.item, score: 0, matched: 0, simSum: 0 };
      entry.score += similarity * 100;
      entry.matched += 1;
      entry.simSum += similarity;
      aggregate.set(key, entry);
    }
  }

  const scored: ScoredItem[] = [];
  for (const entry of aggregate.values()) {
    const coverage = entry.matched / terms.length;
    let score = entry.score;
    if (entry.matched > 1) score += entry.matched * 18;
    if (terms.length > 1 && entry.matched === terms.length) score += 55;
    if (terms.length > 1 && entry.item.name.includes(terms.join("-"))) {
      score += 60;
    }

    const similarity = Math.round((entry.simSum / entry.matched) * 100);
    const relevance =
      terms.length === 1
        ? similarity
        : Math.round(similarity * 0.5 + coverage * 100 * 0.5);

    scored.push({
      item: entry.item,
      score: score + relevance,
      similarity,
      coverage,
    });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.coverage - a.coverage ||
      a.item.name.length - b.item.name.length ||
      a.item.name.localeCompare(b.item.name),
  );
  return scored.slice(0, limit);
}
