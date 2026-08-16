export const TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://tracker.dler.org:6969/announce",
  "udp://opentracker.i2p.rocks:6969/announce",
  "udp://explodie.org:6969/announce",
  "udp://tracker.openbittorrent.com:6969/announce",
  "udp://exodus.desync.com:6969/announce",
  "udp://tracker.moeking.me:6969/announce",
  "udp://open.demonii.com:1337/announce",
];

export async function fetchJson(url, timeoutMs = 10000, retries = 1) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "User-Agent": "Mozilla/5.0 (Stremio TorrentSearch addon)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastErr;
}

export function qualityFrom(title = "") {
  const t = title.toLowerCase();
  if (/2160p|4k|uhd/.test(t)) return "4K";
  if (/1080p/.test(t)) return "1080p";
  if (/720p/.test(t)) return "720p";
  if (/480p/.test(t)) return "480p";
  if (/\b(cam|hdcam|hdts|ts|telesync)\b/.test(t)) return "CAM";
  return "SD";
}

export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!n || Number.isNaN(n)) return "?";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} MB`;
  return `${Math.round(n / 1e3)} KB`;
}

// Bắt pattern tập phim: S03E01, s3e1...
export function parseEpisode(title = "") {
  const m = title.match(/s(\d{1,2})e(\d{1,3})/i);
  if (!m) return null;
  return { season: parseInt(m[1], 10), episode: parseInt(m[2], 10) };
}

export function epTag(season, episode) {
  const s = String(season).padStart(2, "0");
  const e = String(episode).padStart(2, "0");
  return `S${s}E${e}`;
}

// Kiểm tra title có khớp tên phim không (lọc rác từ search keyword)
export function titleMatches(title = "", name = "", year) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
  const nameTokens = norm(name).split(/\s+/).filter((w) => w.length > 2);
  const titleNorm = ` ${norm(title)} `;
  if (nameTokens.length === 0) return true;
  const hits = nameTokens.filter((w) => titleNorm.includes(` ${w}`)).length;
  const ratio = hits / nameTokens.length;
  if (year && String(title).includes(String(year)) && ratio >= 0.5) return true;
  return ratio >= 0.75;
}

export function parseSize(str) {
  if (str === undefined || str === null) return 0;
  if (typeof str === "number") return str;
  const m = String(str).match(/([\d.]+)\s*(gb|mb|kb|b)/i);
  if (!m) return 0;
  const v = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === "gb") return Math.round(v * 1e9);
  if (unit === "mb") return Math.round(v * 1e6);
  if (unit === "kb") return Math.round(v * 1e3);
  return Math.round(v);
}
