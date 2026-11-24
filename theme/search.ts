export interface SearchEntry {
  title: string;
  heading: string;
  url: string;
  text: string;
}

function termsOf(query: string) {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

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
    let score = 0;
    for (const term of terms) {
      const inHeading = heading.includes(term);
      const inTitle = title.includes(term);
      const inText = text.includes(term);
      if (!inHeading && !inTitle && !inText) {
        score = 0;
        break;
      }
      score += (inHeading ? 10 : 0) + (heading.startsWith(term) ? 4 : 0) + (inTitle ? 5 : 0) + (inText ? 1 : 0);
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
