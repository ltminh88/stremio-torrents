import sdk from "stremio-addon-sdk";
import { getCinemeta } from "./lib/cinemeta.js";
import {
  TRACKERS,
  qualityFrom,
  formatBytes,
} from "./lib/utils.js";
import * as yts from "./lib/sources/yts.js";
import * as eztv from "./lib/sources/eztv.js";
import * as tpb from "./lib/sources/tpb.js";
import * as solidtorrents from "./lib/sources/solidtorrents.js";
import * as torrentscsv from "./lib/sources/torrentscsv.js";
import * as knaben from "./lib/sources/knaben.js";
import * as catalog from "./lib/catalog.js";

const { addonBuilder } = sdk;

// Knaben + torrentscsv thân thiện datacenter IP (sống trên Render);
// tpb/solidtorrents chỉ sống khi chạy local (auto-skip nếu bị 403).
const SOURCES = [yts, eztv, torrentscsv, knaben, tpb, solidtorrents];
const MAX_STREAMS = 40;
const CACHE_TTL = 30 * 60 * 1000; // 30 phút
const streamCache = new Map();

const manifest = {
  id: "community.torrentsearch",
  version: "1.1.0",
  name: "Torrent Search",
  description:
    "Tổng hợp torrent từ YTS, EZTV, TorrentsCSV, Knaben, ThePirateBay, SolidTorrents. Tự tìm nguồn cho phim/series (IMDB) + có ô Search torrent trực tiếp: gõ từ khoá ra danh sách, bấm phát ngay.",
  resources: ["stream", "catalog", "meta"],
  types: ["movie", "series"],
  idPrefixes: ["tt", catalog.ID_PREFIX],
  catalogs: [
    {
      type: "movie",
      id: "torrentsearch-search",
      name: "Torrent Search",
      extra: [{ name: "search", isRequired: true }],
    },
  ],
};

const builder = new addonBuilder(manifest);

function toStream(t) {
  const quality = qualityFrom(t.title);
  return {
    name: `TorrentSearch • ${t.source}`,
    title: `${t.title}\n👤 ${t.seeders > 0 ? t.seeders : "?"} seeds   💾 ${formatBytes(
      t.size
    )}   ⚡ ${quality}${t.verified ? "   ✔ verified" : ""}`,
    infoHash: t.infoHash,
    sources: [
      `dht:${t.infoHash}`,
      ...TRACKERS.map((tr) => `tracker:${tr}`),
    ],
    behaviorHints: { bingeGroup: `ts-${quality}-${t.source}` },
  };
}

// Catalog: search torrent -> danh sách thẻ trơn (bấm vào phát trực tiếp).
builder.defineCatalogHandler(async ({ id, extra }) => {
  if (id !== "torrentsearch-search") return { metas: [] };
  const query = (extra?.search || "").trim();
  if (!query) return { metas: [] };
  try {
    const torrents = await catalog.searchCatalog(query);
    return { metas: torrents.map(catalog.toMetaPreview) };
  } catch (err) {
    console.error("Catalog error:", err.message);
    return { metas: [] };
  }
});

// Meta: trang chi tiết cho 1 item catalog (id "tsq:...").
builder.defineMetaHandler(async ({ id }) => {
  const d = catalog.decodeId(id);
  if (!d) return { meta: null };
  return { meta: catalog.toMetaDetail(d) };
});

builder.defineStreamHandler(async ({ type, id }) => {
  try {
    // Item từ catalog torrent-search -> phát thẳng bằng magnet trong id.
    const fromCatalog = catalog.decodeId(id);
    if (fromCatalog) return { streams: [catalog.toStream(fromCatalog)] };

    // movie: "tt1234567" | series: "tt1234567:season:episode"
    const [imdbId, seasonStr, episodeStr] = id.split(":");
    const season = parseInt(seasonStr, 10);
    const episode = parseInt(episodeStr, 10);

    const cacheKey = id;
    const hit = streamCache.get(cacheKey);
    if (hit && hit.expires > Date.now()) return { streams: hit.value };

    const meta = await getCinemeta(type === "series" ? "series" : "movie", imdbId);

    const tasks = SOURCES.map((src) => {
      const p =
        type === "series"
          ? src.fetchSeries(meta, season, episode)
          : src.fetchMovie(meta);
      return p.catch((err) => {
        console.error(`Source lỗi:`, err.message);
        return [];
      });
    });

    const settled = await Promise.all(tasks);

    // Gộp + khử trùng theo infoHash + bỏ torrent 0 seed
    const seen = new Set();
    const torrents = [];
    for (const list of settled) {
      for (const t of list) {
        const key = t.infoHash.toLowerCase();
        if (seen.has(key)) continue;
        // EZTV không trả số seeds chính xác (toàn 0) -> vẫn giữ, xếp cuối
        if (t.seeders <= 0 && t.source !== "EZTV") continue;
        seen.add(key);
        torrents.push(t);
      }
    }

    torrents.sort((a, b) => b.seeders - a.seeders);
    const streams = torrents.slice(0, MAX_STREAMS).map(toStream);

    streamCache.set(cacheKey, {
      value: streams,
      expires: Date.now() + CACHE_TTL,
    });
    return { streams };
  } catch (err) {
    console.error("Stream error:", err.message);
    return { streams: [] };
  }
});

export default builder.getInterface();
