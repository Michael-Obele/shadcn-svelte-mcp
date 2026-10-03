/**
 * Pure search core for the catalog.
 *
 * Turns a query into ranked matches without any I/O, so the ranking can be
 * reasoned about and verified in isolation. The search tool wires this to the
 * live catalog from `catalog.ts`.
 *
 * Ranking is BM25 over an inverted index built by `@orama/orama`, with
 * per-field boosting so a hit on a component's `name` outweighs one buried in
 * its `description`, and typo tolerance so `buton` still reaches `button`.
 *
 * Chosen over a bare BM25 scoring function because BM25 consumes term
 * frequencies from an inverted index - a scoring-only package would mean
 * building that index here by hand and giving up fuzzy matching. Orama is the
 * pure-JS equivalent of the SQLite FTS5 setup that was considered first: it
 * indexes, scores and does typo tolerance in one place, with zero dependencies
 * and no native build, so it survives `bun build --target=node` for the npm
 * distribution.
 *
 * Term weighting is left to BM25's IDF over the catalog itself. That means the
 * one thing this cannot do is judge *general* English: across a few hundred
 * one-line descriptions, "the" is rare and scores as distinctive. See
 * FUNCTION_WORDS for why a short list is still needed on the query side.
 *
 * What this deliberately does NOT do is bridge vocabulary gaps with a
 * hand-written synonym table. A query of "notification" cannot reach a
 * component documented only as "toast" from text alone, and any table encoding
 * that bridge is a guess that silently rots when the site's wording changes.
 * Better to report no match and surface the real catalog vocabulary, so the
 * calling model - which does have the semantics - picks the right component.
 */

import { create, insertMultiple, search, type AnyOrama } from "@orama/orama";
import { tokenizeWords, type CatalogItem } from "./catalog.js";

/** Searchable fields, weakest last. Boost values express what a hit is worth. */
const PROPERTIES = [
  "name",
  "title",
  "description",
  "keywords",
  "category",
] as const;

/**
 * How much a match on each field is worth.
 *
 * `category` is weak on purpose: "Overlays & Dialogs" made every dialog
 * neighbour match the word "dialog" as hard as Dialog itself, and keywords are
 * themselves derived from the category, so it was counting twice.
 */
const PROPERTY_BOOST: Record<(typeof PROPERTIES)[number], number> = {
  name: 4,
  title: 2.5,
  description: 2,
  keywords: 1.5,
  category: 0.5,
};

/**
 * English function words, used only to keep filler out of the query.
 *
 * This is the one vocabulary list that stays, and IDF could not replace it.
 * Weighting by rarity within the catalog rewards precisely the words this list
 * removes: across a few hundred short descriptions, "the" matches only Alert
 * Dialog ("...interrupts the user with important content") and "to" matches
 * only Skeleton ("...to show a placeholder"), so rarity scoring gives each a
 * higher weight than the real signal in the same query. A corpus of real
 * English usage would fix that; a few hundred component descriptions cannot.
 *
 * Unlike a domain synonym table this does not rot: it describes the language,
 * not shadcn-svelte's vocabulary, and only needs revisiting if the tool starts
 * serving queries in another language.
 */
const FUNCTION_WORDS = new Set([
  "a",
  "an",
  "the",
  "for",
  "of",
  "to",
  "and",
  "or",
  "in",
  "on",
  "at",
  "by",
  "with",
  "that",
  "this",
  "these",
  "those",
  "is",
  "are",
  "was",
  "be",
  "as",
  "it",
  "its",
  "i",
  "we",
  "you",
  "they",
  "he",
  "she",
  "my",
  "your",
  "our",
  "do",
  "does",
  "did",
  "can",
  "could",
  "will",
  "would",
  "should",
  "am",
]);

export interface ScoredItem {
  item: CatalogItem;
  score: number;
  /** How strongly the best match scored (0-100). */
  similarity: number;
  /** Share of evidence-bearing query terms present in the document (0-1). */
  coverage: number;
}

/** A catalog prepared for ranking. */
export interface CatalogIndex {
  db: AnyOrama;
}

/** De-duplicated query terms, with function words dropped. */
export function queryTerms(query: string): string[] {
  const tokens = tokenizeWords(query);
  const meaningful = tokens.filter((term) => !FUNCTION_WORDS.has(term));
  return [...new Set(meaningful.length > 0 ? meaningful : tokens)];
}

/** Builds the inverted index the ranker searches. */
export function buildIndex(items: CatalogItem[]): CatalogIndex {
  const db = create({
    schema: {
      name: "string",
      title: "string",
      category: "string",
      description: "string",
      keywords: "string[]",
      type: "string",
      url: "string",
    },
  });

  insertMultiple(
    db,
    items.map((item) => ({
      name: item.name,
      title: item.title,
      category: item.category,
      description: item.description,
      keywords: item.keywords ?? [],
      type: item.type,
      url: item.url,
    })),
  );

  return { db };
}

/** BM25 tuning. `k1` caps term-frequency gains, `b` normalizes for length. */
const BM25 = { k1: 1.2, b: 0.75 } as const;

/**
 * Bits UI primitives sort after every other kind of result.
 *
 * An agent should install the styled shadcn-svelte wrapper and only descend to
 * the headless primitive when it needs internals the wrapper does not expose.
 * Both live in the catalog, and a primitive whose name matches exactly
 * ("dialog" -> "dialog") scores as well as the component it backs, so it would
 * otherwise compete for the top slot - and because `limit` is applied before
 * results are grouped for display, it could crowd the component the agent
 * should actually install out of the list entirely.
 *
 * This is a sort key rather than a score penalty so it cannot be traded off
 * against relevance: a primitive never interleaves ahead of a component. Only
 * `bits-ui` is ranked down; components, blocks, charts and docs still compete
 * on score, so a query like "radar chart" still leads with charts.
 */
const PRIMITIVE_RANK = 1;

function typeRank(type: CatalogItem["type"]): number {
  return type === "bits-ui" ? PRIMITIVE_RANK : 0;
}

type Hit = {
  name: string;
  title: string;
  category: string;
  description: string;
  keywords: string[];
  type: CatalogItem["type"];
  url: string;
};

/** Runs one query and returns the ranked matches. */
export function searchOnce(
  index: CatalogIndex,
  query: string,
  limit: number,
): ScoredItem[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];

  // Orama's full-text search ANDs the words in `term`, so "data grid with
  // sorting" would need one document containing all four. Searching each term
  // on its own and merging gives OR semantics, which is what a keyword search
  // needs, while keeping BM25 scoring and typo tolerance per term.
  const merged = new Map<
    string,
    { document: Hit; score: number; terms: Set<string> }
  >();

  for (const term of terms) {
    // `search` is typed as possibly-async for vector modes; full-text search
    // resolves synchronously.
    const results = search(index.db, {
      term,
      properties: [...PROPERTIES],
      boost: PROPERTY_BOOST,
      relevance: { ...BM25 },
      // Levenshtein distance, so `buton` still reaches `button`.
      tolerance: 1,
      threshold: 0,
      // Over-fetch so merging across terms does not starve the tail.
      limit: Math.max(limit, 40),
    }) as unknown as { hits: { score: number; document: Hit }[] };

    for (const { score, document } of results.hits) {
      const key = `${document.type}:${document.name}`;
      const entry = merged.get(key) ?? {
        document,
        score: 0,
        terms: new Set<string>(),
      };
      // Sum across terms: agreement between independent terms raises rank.
      entry.score += score;
      entry.terms.add(term);
      merged.set(key, entry);
    }
  }

  const ranked = [...merged.values()].sort(
    (a, b) =>
      typeRank(a.document.type) - typeRank(b.document.type) ||
      b.score - a.score ||
      b.terms.size - a.terms.size ||
      a.document.name.length - b.document.name.length ||
      a.document.name.localeCompare(b.document.name),
  );

  // Ranking primitives last is only half the job: `limit` is applied before
  // results are grouped for display, so a strict last-place primitive gets cut
  // off entirely whenever enough non-primitives match - including for an
  // explicit "headless primitive" query. Trade the final slot for the best
  // primitive so one is always represented, while components keep the lead.
  const capped = ranked.slice(0, limit);
  if (
    capped.length === limit &&
    !capped.some((entry) => entry.document.type === "bits-ui")
  ) {
    const primitive = ranked.find((entry) => entry.document.type === "bits-ui");
    if (primitive) capped[capped.length - 1] = primitive;
  }

  // BM25 scores are unbounded and relative to the corpus, so they cannot be
  // reported as an absolute percentage - clamping them saturates every result
  // at 100%. Scaling against the strongest hit in this result set keeps the
  // number monotonic and comparable within the list, which is what a caller
  // actually needs when choosing what to fetch next. Capped, because a
  // primitive is ranked last yet can still outscore the first result.
  const best = ranked[0]?.score ?? 0;

  return capped.map(({ score, document, terms: matchedTerms }) => {
    const item: CatalogItem = {
      name: document.name,
      title: document.title,
      type: document.type,
      category: document.category,
      description: document.description,
      url: document.url,
      keywords: document.keywords,
    };

    return {
      item,
      score,
      similarity:
        best === 0 ? 0 : Math.min(100, Math.round((score / best) * 100)),
      coverage: terms.length === 0 ? 0 : matchedTerms.size / terms.length,
    };
  });
}
