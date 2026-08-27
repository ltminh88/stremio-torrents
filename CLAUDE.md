# CLAUDE.md — stremio-torrents

Stremio addon tự làm, gom torrent nhiều nguồn + có ô search torrent phát thẳng.
Node ESM + `stremio-addon-sdk`. Repo: `github.com/ltminh88/stremio-torrents` (branch `main`).
Live: `https://stremio-torrents.onrender.com/manifest.json`

## Tính năng

1. **Stream theo IMDB** (`tt...`): resolve Cinemeta → tên/năm → gom 6 nguồn → magnet (giống Torrentio). Chỉ chạy khi phim/series có trên Stremio (Cinemeta).
2. **Catalog search** (v1.1): ô Search trong Stremio → gõ từ khoá → danh sách → bấm phát thẳng. Không cần phim có sẵn trên Stremio. Catalog id `torrentsearch-search`, `extra: search (isRequired)` → chỉ hiện khi search, không phải hàng browse.
   - **GOTCHA poster:** Stremio Search/Discover **bắt buộc có `poster`** mới render thẻ bấm được; thẻ không poster → ô xám skeleton không click được. → `catalog.js` gắn poster tự sinh qua `placehold.co` (ảnh chữ quality+seeds, không cần API key). Tên release Stremio tự hiện dưới thẻ.

## Cấu trúc

```
addon.js              # manifest + 3 handler: catalog, meta, stream
server.js             # serveHTTP (PORT env, mặc định 7576)
lib/
  cinemeta.js         # IMDB id -> {name, year} cho luồng stream
  utils.js            # TRACKERS, fetchJson/postJson, qualityFrom, formatBytes, titleMatches, parseEpisode
  catalog.js          # searchCatalog(), encode/decode id, toMetaPreview/Detail/toStream
  sources/            # mỗi file 1 nguồn, export search()/fetchMovie()/fetchSeries()
    yts, eztv, tpb, solidtorrents, torrentscsv, knaben
render.yaml           # Render blueprint (plan free, autoDeploy: true)
render-deploy.sh      # deploy qua API, không cần dashboard
.env                  # RENDER_API_KEY (GITIGNORED — không bao giờ commit)
```

Giữ mỗi file code < 200 dòng.

## Nguồn torrent — GOTCHA quan trọng

- **Datacenter-safe (sống trên Render):** `knaben`, `torrentscsv`. → **Catalog chỉ dùng 2 nguồn này** (xem `CATALOG_SOURCES` trong `catalog.js`).
- **Chỉ chắc ăn khi chạy LOCAL:** `tpb` (apibay), `solidtorrents` — hay bị 403 trên IP datacenter (code auto-skip khi lỗi).
- **torrends.to = NGÕ CỤT:** không scrape được — là WordPress "trang bìa", chỉ nhúng site khác vào iframe; AJAX chỉ có getSites/getSearchToplist/GeoApiGet/saveCookie, KHÔNG có endpoint magnet.

## Catalog item id

`tsq:{infoHash}:{base64url(JSON {t:title, s:seeders, z:size, src:source})}`
→ mang sẵn magnet + info nên `meta`/`stream` dựng lại được, không cần query lại.
`ID_PREFIX = "tsq:"` phải nằm trong `manifest.idPrefixes` để Stremio gọi meta/stream cho item catalog.

## Deploy (KHÔNG cần dashboard)

```bash
./render-deploy.sh          # deploy commit mới nhất, poll tới khi live
./render-deploy.sh clear    # kèm xóa build cache
```

- Key trong `.env` (`RENDER_API_KEY`). Service id: `srv-da0tahu417fc73fbprpg`.
- API: `POST https://api.render.com/v1/services/{srv}/deploys`, poll `GET .../deploys/{id}` tới `status=live`.
- Lưu ý: `autoDeploy` đã bật nhưng **webhook GitHub→Render hay không kích** → đừng tin push tự deploy; cứ chạy `render-deploy.sh` cho chắc.

## Dev / test local

```bash
npm start                                   # http://127.0.0.1:7576/manifest.json
# Test nhanh 3 luồng:
curl ".../catalog/movie/torrentsearch-search/search=inception.json"
curl ".../meta/movie/{tsq-id}.json"
curl ".../stream/movie/{tsq-id}.json"       # phải ra 1 magnet
curl ".../stream/movie/tt0816692.json"      # regression luồng IMDB
```

## Stremio — caveat khi đổi manifest

Thêm/bớt **resource** (vd thêm `catalog`) thì Stremio đang cài **không tự nhận** (nó cache manifest lúc cài). Cần **thoát hẳn Stremio mở lại**; nếu vẫn không thấy → **gỡ addon rồi cài lại**. Đây là giới hạn Stremio, addon không ép được. (Cải tiến trong resource đã cài — vd sửa logic `stream` — thì cập nhật ngay, không cần cài lại.)

## Bảo mật

- `.env`, `.env.*`, `*.secret` đã trong `.gitignore`. TUYỆT ĐỐI không commit API key.
- Nếu key lỡ lộ → rotate trên Render dashboard (Account Settings → API Keys).
