import { fetchJson, epTag, parseEpisode, titleMatches } from "../utils.js";

// SolidTorrents - search engine tổng hợp nhiều indexer, có verified torrents
async function search(query) {
  const url = `https://solidtorrents.to/api/v1/search?q=${encodeURIComponent(
    query
  )}&limit=40&sort=seeders`;
  const data = await fetchJson(url);
  const results = data?.results || [];
  return results.map((t) => ({
    source: "SolidTorrents",
    title: t.title,
    infoHash: t.infohash,
    seeders: Number(t.seeders) || 0,
    leechers: Number(t.leechers) || 0,
    size: Number(t.size) || 0,
    verified: !!t.verified,
  }));
}

export async function fetchMovie(meta) {
  const results = await search(`${meta.name} ${meta.year || ""}`.trim());
  return results.filter((t) => titleMatches(t.title, meta.name, meta.year));
}

export async function fetchSeries(meta, season, episode) {
  const results = await search(`${meta.name} ${epTag(season, episode)}`);
  // Chỉ nhận torrent lẻ từng tập (bỏ season pack vì không xác định được fileIdx)
  return results.filter((t) => {
    const ep = parseEpisode(t.title);
    return ep && ep.season === season && ep.episode === episode;
  });
}
