import { fetchJson, epTag, parseEpisode, titleMatches } from "../utils.js";

// Torrents-CSV - search engine tổng hợp (DHT + nhiều indexer), thân thiện với datacenter IP
export async function search(query) {
  const url = `https://torrents-csv.com/service/search?q=${encodeURIComponent(
    query
  )}&size=30`;
  const data = await fetchJson(url);
  const results = data?.torrents || [];
  return results.map((t) => ({
    source: "TorrentsCSV",
    title: t.name,
    infoHash: t.infohash,
    seeders: Number(t.seeders) || 0,
    leechers: Number(t.leechers) || 0,
    size: Number(t.size_bytes) || 0,
  }));
}

export async function fetchMovie(meta) {
  const results = await search(`${meta.name} ${meta.year || ""}`.trim());
  return results.filter((t) => titleMatches(t.title, meta.name, meta.year));
}

export async function fetchSeries(meta, season, episode) {
  const results = await search(`${meta.name} ${epTag(season, episode)}`);
  return results.filter((t) => {
    const ep = parseEpisode(t.title);
    return ep && ep.season === season && ep.episode === episode;
  });
}
