/**
 * iTunes lookup for the shared page: artwork and the iTunes Store page for each track ID.
 *
 * iTunes Search API terms (https://performance-partners.apple.com/search-api): album art may only be
 * shown next to an iTunes badge that links directly to the page where the track can be purchased,
 * and it is not saved. So the page loads artwork straight from Apple (no caching here) and links to
 * the iTunes Store (`app=itunes` opens the store instead of Apple Music).
 */
export interface StoreEntry {
  artworkUrl: string;
  storeUrl: string;
}

const CHUNK = 50;

/** Only https links on apple.com are accepted; returns the iTunes Store variant of the URL */
function storeLink(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || !(u.hostname === 'apple.com' || u.hostname.endsWith('.apple.com'))) return null;
    u.searchParams.set('app', 'itunes');
    return u.toString();
  } catch {
    return null;
  }
}

function artworkLink(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const u = new URL(raw.replace('100x100bb', '300x300bb'));
    return u.protocol === 'https:' && u.hostname.endsWith('.mzstatic.com') ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function lookupTracks(ids: number[], signal?: AbortSignal): Promise<Map<number, StoreEntry>> {
  const unique = [...new Set(ids)];
  const out = new Map<number, StoreEntry>();
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const url = `https://itunes.apple.com/lookup?${new URLSearchParams({ id: chunk.join(','), country: 'jp', lang: 'ja_jp' })}`;
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) continue;
      const data = (await res.json()) as { results?: { trackId?: unknown; artworkUrl100?: unknown; trackViewUrl?: unknown }[] };
      for (const r of data.results ?? []) {
        if (typeof r.trackId !== 'number' || !chunk.includes(r.trackId)) continue;
        const artworkUrl = artworkLink(r.artworkUrl100), storeUrl = storeLink(r.trackViewUrl);
        // Artwork is shown only together with its store link (never one without the other)
        if (artworkUrl && storeUrl) out.set(r.trackId, { artworkUrl, storeUrl });
      }
    } catch {
      if (signal?.aborted) break;
    }
  }
  return out;
}
