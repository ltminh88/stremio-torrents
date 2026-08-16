import { fetchJson } from "../utils.js";

// EZTV - chuyên series, tìm theo IMDB ID, có sẵn season/episode
export async function fetchMovie() {
  return []; // EZTV chỉ có series
}

export async function fetchSeries(meta, season, episode) {
  const imdb = meta.imdbId.replace(/^tt/, "");
  // EZTV trả torrent mới nhất trước; tập cũ nằm ở các trang sau -> lấy song song 3 trang
  const pages = await Promise.all(
    [1, 2, 3].map((page) =>
      fetchJson(
        `https://eztvx.to/api/get-torrents?imdb_id=${imdb}&limit=100&page=${page}`
      ).catch(() => null)
    )
  );
  const torrents = pages.flatMap((p) => p?.torrents || []);
  return torrents
    .filter(
      (t) => Number(t.season) === season && Number(t.episode) === episode
    )
    .map((t) => ({
      source: "EZTV",
      title: t.filename || t.title,
      infoHash: t.hash,
      seeders: Number(t.seeds) || 0,
      leechers: Number(t.peers) || 0,
      size: Number(t.size_bytes) || 0,
    }));
}
