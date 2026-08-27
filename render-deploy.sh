#!/usr/bin/env bash
# Kích deploy Render qua API + theo dõi tới khi live. Không cần vào dashboard.
# Dùng: ./render-deploy.sh          (deploy commit mới nhất trên main)
#       ./render-deploy.sh clear    (deploy + xóa build cache)
set -euo pipefail

cd "$(dirname "$0")"
set -a; . ./.env; set +a   # nạp RENDER_API_KEY

SRV="srv-da0tahu417fc73fbprpg"          # service stremio-torrents
API="https://api.render.com/v1"
CACHE="do_not_clear"; [ "${1:-}" = "clear" ] && CACHE="clear"

echo "→ Trigger deploy (clearCache=$CACHE)..."
DEP=$(curl -s -X POST -H "Authorization: Bearer $RENDER_API_KEY" -H "Content-Type: application/json" \
  "$API/services/$SRV/deploys" -d "{\"clearCache\":\"$CACHE\"}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
echo "  deploy id: $DEP"

while true; do
  ST=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" "$API/services/$SRV/deploys/$DEP" \
    | python3 -c 'import sys,json;print(json.load(sys.stdin).get("status","?"))')
  echo "  status: $ST"
  case "$ST" in
    live) echo "✓ LIVE"; break;;
    build_failed|update_failed|canceled|deactivated|pre_deploy_failed) echo "✗ THẤT BẠI: $ST"; exit 1;;
  esac
  sleep 20
done

echo "→ Manifest:"
curl -s "https://stremio-torrents.onrender.com/manifest.json" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  version",d.get("version"),"| resources",d.get("resources"))'
