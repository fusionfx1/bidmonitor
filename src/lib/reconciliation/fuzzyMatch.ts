/** Levenshtein-based string similarity in [0, 1]. */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n === 0 ? 1 : 0;
  if (!n) return 0;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return 1 - dp[m][n] / Math.max(m, n);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

export type MatchType = 'exact' | 'fuzzy' | 'manual' | 'unmatched';

export interface FuzzyCandidate {
  name:       string;
  similarity: number;
  matchType:  MatchType;
}

/**
 * Find the best match for `query` within `candidates`.
 * Returns null if best similarity is below threshold.
 */
export function findBestMatch(
  query: string,
  candidates: string[],
  threshold = 0.70,
): FuzzyCandidate | null {
  const nq = normalize(query);

  let best: FuzzyCandidate | null = null;

  for (const c of candidates) {
    const nc = normalize(c);

    // Exact (normalised)
    if (nq === nc) return { name: c, similarity: 1, matchType: 'exact' };

    // Substring containment shortcut
    const containSim = (nc.includes(nq) || nq.includes(nc))
      ? 0.85 + 0.15 * (Math.min(nq.length, nc.length) / Math.max(nq.length, nc.length))
      : 0;

    const levSim = levenshtein(nq, nc);
    const sim    = Math.max(containSim, levSim);

    if (sim >= threshold && (!best || sim > best.similarity)) {
      best = { name: c, similarity: sim, matchType: 'fuzzy' };
    }
  }

  return best;
}

/** Check if a Voluum campaign URL contains `utm_campaign` matching the GAds name. */
export function utmMatch(voluumCampaignUrl: string, gadsCampaignName: string): boolean {
  try {
    const u = new URL(voluumCampaignUrl.includes('://') ? voluumCampaignUrl : `https://x.com?${voluumCampaignUrl}`);
    const utmCampaign = u.searchParams.get('utm_campaign');
    if (!utmCampaign) return false;
    return normalize(utmCampaign) === normalize(gadsCampaignName);
  } catch {
    return false;
  }
}
