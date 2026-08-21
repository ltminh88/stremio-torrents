import { postJson, epTag, parseEpisode, titleMatches } from "../utils.js";

// Knaben - aggregator crawl sẵn TPB/RuTracker/YTS/nyaa..., re-serve JSON sạch
// -> khôi phục độ phủ TPB mà không bị chặn IP datacenter.
const API = "https://api.knaben.org/v1";
const ZERO_HASH = "0".repeat(40);

async function search(query) {
  const data = await postJson(API, {
    query,
    order_by: "seeders",
    order_direction: "desc",
    size: 40,
  });
  const hits = data?.hits || [];
  return hits
    .filter((t) => t.hash && t.hash !== ZERO_HASH)
    .map((t) => ({
      source: "Knaben",
      title: t.title,
      infoHash: t.hash,
      seeders: Number(t.seeders) || 0,
      leechers: Number(t.peers) || 0,
      size: Number(t.bytes) || 0,
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
