import { fetchJson, epTag, parseEpisode, titleMatches } from "../utils.js";

// ThePirateBay qua apibay.org - nguồn tổng hợp lớn nhất
async function search(query) {
  const url = `https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=0`;
  const data = await fetchJson(url);
  if (!Array.isArray(data)) return [];
  return data
    .filter((t) => t.info_hash && t.info_hash !== "0".repeat(40))
    .map((t) => ({
      source: "TPB",
      title: t.name,
      infoHash: t.info_hash,
      seeders: Number(t.seeders) || 0,
      leechers: Number(t.leechers) || 0,
      size: Number(t.size) || 0,
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
