import { TRACKERS, qualityFrom, formatBytes } from "./utils.js";
import * as knaben from "./sources/knaben.js";
import * as torrentscsv from "./sources/torrentscsv.js";

// Nguồn thân thiện datacenter (chạy được cả trên Render lẫn local).
const CATALOG_SOURCES = [knaben, torrentscsv];
const MAX_ITEMS = 50;
export const ID_PREFIX = "tsq:";

// ---- Mã hoá / giải mã id item catalog ----
// id = "tsq:{infoHash}:{base64url(JSON payload)}" -> mang theo title/seeds/size
// để trang chi tiết + stream hiển thị được mà không cần query lại.
function b64urlEncode(obj) {
  return Buffer.from(JSON.stringify(obj), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

export function encodeId(t) {
  const payload = { t: t.title, s: t.seeders || 0, z: t.size || 0, src: t.source };
  return `${ID_PREFIX}${t.infoHash}:${b64urlEncode(payload)}`;
}

// Trả { infoHash, title, seeders, size, source } hoặc null nếu id không hợp lệ.
export function decodeId(id) {
  if (!id || !id.startsWith(ID_PREFIX)) return null;
  try {
    const rest = id.slice(ID_PREFIX.length);
    const sep = rest.indexOf(":");
    if (sep < 0) return null;
    const infoHash = rest.slice(0, sep);
    const p = b64urlDecode(rest.slice(sep + 1));
    return { infoHash, title: p.t, seeders: p.s, size: p.z, source: p.src };
  } catch {
    return null;
  }
}

// ---- Search catalog: gom 2 nguồn, khử trùng theo infoHash, sort theo seeds ----
export async function searchCatalog(query) {
  const tasks = CATALOG_SOURCES.map((src) =>
    src.search(query).catch((err) => {
      console.error("Catalog source lỗi:", err.message);
      return [];
    })
  );
  const settled = await Promise.all(tasks);

  const seen = new Set();
  const out = [];
  for (const list of settled) {
    for (const t of list) {
      if (!t.infoHash) continue;
      const key = t.infoHash.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
  }
  out.sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
  return out.slice(0, MAX_ITEMS);
}

// ---- Dựng đối tượng cho Stremio ----
function descOf(t) {
  return `👤 ${t.seeders > 0 ? t.seeders : "?"} seeds   💾 ${formatBytes(
    t.size
  )}   ⚡ ${qualityFrom(t.title)}   • ${t.source || "torrent"}`;
}

// Poster tự sinh (ảnh chữ) - Stremio cần poster mới render thẻ bấm được.
// Hiện quality + seeds; tên release do Stremio hiện bên dưới thẻ.
function posterFor(t) {
  const q = qualityFrom(t.title);
  const seeds = t.seeders > 0 ? `${t.seeders} seeds` : "? seeds";
  const text = encodeURIComponent(`${q}\n${seeds}`);
  return `https://placehold.co/400x600/2b2b40/e6e6e6/png?text=${text}&font=roboto`;
}

// Thẻ trơn trong catalog (không poster) - Stremio hiện ô xám + tên release.
export function toMetaPreview(t) {
  return {
    id: encodeId(t),
    type: "movie",
    name: t.title,
    poster: posterFor(t),
    posterShape: "poster",
    description: descOf(t),
  };
}

// Meta chi tiết khi bấm vào 1 item (id đã giải mã).
export function toMetaDetail(d) {
  return {
    id: encodeId({ ...d }),
    type: "movie",
    name: d.title,
    poster: posterFor(d),
    description: descOf(d),
  };
}

// Stream magnet phát trực tiếp.
export function toStream(d) {
  return {
    name: `TorrentSearch • ${d.source || "torrent"}`,
    title: `${d.title}\n${descOf(d)}`,
    infoHash: d.infoHash,
    sources: [`dht:${d.infoHash}`, ...TRACKERS.map((tr) => `tracker:${tr}`)],
  };
}
