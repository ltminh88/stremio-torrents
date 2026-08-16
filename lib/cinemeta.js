import { fetchJson } from "./utils.js";

const TTL = 60 * 60 * 1000; // 1 giờ
const cache = new Map();

// Lấy tên + năm phim từ Cinemeta (metadata mặc định của Stremio)
export async function getCinemeta(type, imdbId) {
  const key = `${type}:${imdbId}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const url = `https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`;
  const data = await fetchJson(url);
  const m = data?.meta;
  if (!m) throw new Error(`Không tìm thấy metadata cho ${imdbId}`);
  const value = {
    imdbId,
    name: m.name,
    year: parseInt(m.year, 10) || undefined,
  };
  cache.set(key, { value, expires: Date.now() + TTL });
  return value;
}
