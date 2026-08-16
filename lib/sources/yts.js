import { fetchJson, parseSize } from "../utils.js";

// YTS - chuyên phim lẻ, chất lượng tốt, hỗ trợ tìm theo IMDB ID
export async function fetchMovie(meta) {
  const url = `https://yts.lt/api/v2/list_movies.json?query_term=${meta.imdbId}&limit=1`;
  const data = await fetchJson(url);
  const movie = data?.data?.movies?.[0];
  if (!movie || !movie.torrents) return [];
  return movie.torrents.map((t) => ({
    source: "YTS",
    title: `${movie.title_long} [${t.quality} ${t.type}]`,
    infoHash: t.hash,
    seeders: Number(t.seeds) || 0,
    leechers: Number(t.peers) || 0,
    size: t.size_bytes ? Number(t.size_bytes) : parseSize(t.size),
  }));
}

export async function fetchSeries() {
  return []; // YTS chỉ có phim lẻ
}
