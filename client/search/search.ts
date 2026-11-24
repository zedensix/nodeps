export interface PageSummary {
  title: string;
  url: string;
  description: string;
  section: string;
  tags: string[];
}

export interface SearchIndex {
  pages: PageSummary[];
  sections: SearchEntry[];
}

export interface SearchEntry {
  title: string;
  heading: string;
  url: string;
  text: string;
  tags: string[];
}

/**
 * Splits a query into lowercase words, dropping empty ones.
 */
function termsOf(query: string) {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Ranks index entries against every word of the query: an entry missing any word is
 * dropped. Matches weigh most in the heading, then tags, the page title and the
 * text, with a bonus when the heading starts with the word.
 */
export function searchEntries(entries: SearchEntry[], query: string, limit = 12): SearchEntry[] {
  const terms = termsOf(query);
  if (terms.length === 0) {
    return [];
  }
  const scored: { entry: SearchEntry; score: number }[] = [];
  for (const entry of entries) {
    const title = entry.title.toLowerCase();
    const heading = entry.heading.toLowerCase();
    const text = entry.text.toLowerCase();
    const tags = entry.tags;
    let score = 0;
    for (const term of terms) {
      const inHeading = heading.includes(term);
      const inTitle = title.includes(term);
      const inText = text.includes(term);
      const inTags = tags.some((tag) => tag.includes(term));
      if (!inHeading && !inTitle && !inText && !inTags) {
        score = 0;
        break;
      }
      score +=
        (inHeading ? 10 : 0) +
        (heading.startsWith(term) ? 4 : 0) +
        (inTitle ? 5 : 0) +
        (inText ? 1 : 0) +
        (inTags ? 8 : 0);
    }
    if (score > 0) {
      scored.push({ entry, score });
    }
  }
  return scored
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ entry }) => entry);
}

/**
 * Cuts an excerpt of the text around the earliest match of any query word,
 * with an ellipsis on each truncated side. Without a match it returns the
 * start of the text.
 */
export function snippet(text: string, query: string, radius = 80) {
  const lower = text.toLowerCase();
  const positions = termsOf(query)
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0);
  if (positions.length === 0) {
    return text.slice(0, radius * 2) + (text.length > radius * 2 ? "…" : "");
  }
  const position = Math.min(...positions);
  const start = Math.max(0, position - radius);
  const end = Math.min(text.length, position + radius);
  return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}

/**
 * Splits a query into #tags (without the hash, a lone # ignored) and the
 * remaining free text, both lowercased.
 */
export function parseQuery(query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return {
    tags: words.filter((word) => word.startsWith("#") && word.length > 1).map((word) => word.slice(1)),
    text: words.filter((word) => !word.startsWith("#")).join(" "),
  };
}

/**
 * Keeps the pages that carry every one of the given tags.
 */
export function pagesWithTags(pages: PageSummary[], tags: string[]) {
  return pages.filter((page) => tags.every((tag) => page.tags.includes(tag)));
}

/**
 * Ranks the other pages by tags shared with the current page, with a small
 * bonus for the same section. Pages sharing nothing are left out, and an
 * unknown current URL gives no results.
 */
export function relatedPages(pages: PageSummary[], currentUrl: string, limit = 8) {
  const current = pages.find((page) => page.url === currentUrl);
  if (!current) {
    return [];
  }
  return pages
    .filter((page) => page !== current)
    .map((page) => ({
      page,
      score:
        page.tags.filter((tag) => current.tags.includes(tag)).length * 10 + (page.section === current.section ? 1 : 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ page }) => page);
}

/**
 * Counts how many pages carry each tag, most used first and ties in
 * alphabetical order.
 */
export function tagCounts(pages: PageSummary[]) {
  const counts = new Map<string, number>();
  for (const page of pages) {
    for (const tag of page.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}
