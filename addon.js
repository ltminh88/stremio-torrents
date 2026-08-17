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

const { addonBuilder } = sdk;

const SOURCES = [yts, eztv, torrentscsv, tpb, solidtorrents];
const MAX_STREAMS = 40;
const CACHE_TTL = 30 * 60 * 1000; // 30 phút
const streamCache = new Map();

const manifest = {
  id: "community.torrentsearch",
  version: "1.0.0",
  name: "Torrent Search",
  description:
    "Tổng hợp torrent từ YTS, EZTV, ThePirateBay, SolidTorrents - tự động tìm nguồn cho mọi phim/series trên Stremio.",
  resources: ["stream"],
  types: ["movie", "series"],
  idPrefixes: ["tt"],
  catalogs: [],
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

builder.defineStreamHandler(async ({ type, id }) => {
  try {
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
