/**
 * BM25 search implementation for tool discovery.
 *
 * BM25 (Best Matching 25) is a ranking function used by search engines.
 * It considers term frequency, document length, and inverse document frequency.
 */

/** A searchable document with name and optional description */
export interface SearchableDoc {
  name: string;
  description?: string;
}

/** Search result with relevance score */
export interface SearchResult<T extends SearchableDoc> {
  doc: T;
  score: number;
}

/**
 * Tokenize text into searchable terms.
 * Splits on word boundaries, lowercases, and handles snake_case/camelCase.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // Split camelCase: "createUser" -> "create User"
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Split snake_case: "create_user" -> "create user"
    .replace(/_/g, ' ')
    // Split on non-alphanumeric
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

/**
 * BM25 search implementation.
 *
 * @param docs - Documents to search
 * @param query - Search query string
 * @param k1 - Term frequency saturation (default: 1.5)
 * @param b - Document length normalization (default: 0.75)
 * @returns Sorted results with scores (highest first)
 */
export function bm25Search<T extends SearchableDoc>(
  docs: T[],
  query: string,
  k1 = 1.5,
  b = 0.75
): SearchResult<T>[] {
  if (!query.trim()) {
    // No query = return all with score 0
    return docs.map((doc) => ({ doc, score: 0 }));
  }

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    return docs.map((doc) => ({ doc, score: 0 }));
  }

  // Build corpus: combine name + description for each doc
  const corpus = docs.map((doc) => {
    const text = `${doc.name} ${doc.description ?? ''}`;
    return tokenize(text);
  });

  // Calculate average document length
  const totalLength = corpus.reduce((sum, terms) => sum + terms.length, 0);
  const avgdl = totalLength / corpus.length || 1;

  // Calculate IDF for each query term
  const N = docs.length;
  const idf = new Map<string, number>();

  for (const term of queryTerms) {
    // Count documents containing this term
    const docsWithTerm = corpus.filter((docTerms) => docTerms.includes(term)).length;
    // IDF formula: log((N - n + 0.5) / (n + 0.5) + 1)
    const idfValue = Math.log((N - docsWithTerm + 0.5) / (docsWithTerm + 0.5) + 1);
    idf.set(term, idfValue);
  }

  // Calculate BM25 score for each document
  const results: SearchResult<T>[] = docs.map((doc, i) => {
    const docTerms = corpus[i] ?? [];
    const docLength = docTerms.length;

    let score = 0;

    for (const term of queryTerms) {
      // Term frequency in this document
      const tf = docTerms.filter((t) => t === term).length;
      if (tf === 0) continue;

      const termIdf = idf.get(term) ?? 0;

      // BM25 formula
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (docLength / avgdl));
      score += termIdf * (numerator / denominator);
    }

    // Boost exact name matches
    const nameLower = doc.name.toLowerCase();
    const queryLower = query.toLowerCase();
    if (nameLower === queryLower) {
      score += 10; // Strong boost for exact match
    } else if (nameLower.includes(queryLower)) {
      score += 2; // Mild boost for substring match in name
    }

    return { doc, score };
  });

  // Filter to only docs with positive scores and sort by score descending
  return results
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
