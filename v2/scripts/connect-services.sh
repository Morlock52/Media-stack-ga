#!/usr/bin/env bash
# =============================================================================
#  Wires the stack together after first start. Idempotent — safe to re-run;
#  anything not running yet is skipped, so run it again after enabling profiles.
#   • API keys from config.xml / sabnzbd.ini → .env
#   • SABnzbd: /data/usenet dirs, categories, host whitelist        (usenet)
#   • Sonarr/Radarr/Radarr-4K/Lidarr: root folders, qBittorrent + SABnzbd clients
#   • Prowlarr: app sync to every *arr + Byparr (FlareSolverr) proxy
#   • cross-seed: qBittorrent, hardlink dir, *arrs, Prowlarr torznab   (crossseed)
#  Usage:  sudo ./scripts/connect-services.sh
#  Env:    QBIT_USER / QBIT_PASS (default user admin; password prompted)
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
skip() { printf '  \033[33m•\033[0m %s\n' "$*"; }
warn() { printf '  \033[31m✗\033[0m %s\n' "$*"; }
running() { docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null | grep -q true; }

# api <container> <port> <ver> <key> <method> <path> [json]  → compact one-line JSON
api() {
  local c=$1 port=$2 ver=$3 key=$4 m=$5 p=$6 body=${7:-}
  docker exec "$c" curl -sf -X "$m" -H "X-Api-Key: $key" -H "Content-Type: application/json" \
    ${body:+--data "$body"} "http://localhost:$port/api/$ver/$p" \
    | tr -d '\n' | sed -E 's/[[:space:]]*([][{},:])[[:space:]]*/\1/g'
}
getkey() { grep -oP '(?<=<ApiKey>)[^<]+' "$CONFIG_ROOT/$1/config.xml" 2>/dev/null || true; }
setenv() { if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi; }
jstr()   { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }   # escape for a JSON string value
firstid() { python3 -c 'import sys,json;d=json.load(sys.stdin);print(d[0]["id"] if d else "")' 2>/dev/null || true; }
urlenc() { python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$1" 2>/dev/null || printf %s "$1"; }

# ---------------------------------------------------------------------------- keys
echo "▸ API keys"
declare -A KEY
for app in sonarr radarr radarr-4k lidarr prowlarr; do
  k=$(getkey "$app"); [[ -z "$k" ]] && { skip "$app: not running"; continue; }
  var="$(tr 'a-z-' 'A-Z_' <<<"$app")_API_KEY"
  KEY[$app]=$k; setenv "$var" "$k"; ok "$app → $var"
done
SAB_KEY=$(grep -oP '^api_key = \K\S+' "$CONFIG_ROOT/sabnzbd/sabnzbd.ini" 2>/dev/null || true)
[[ -n "$SAB_KEY" ]] && { setenv SABNZBD_API_KEY "$SAB_KEY"; ok "sabnzbd → SABNZBD_API_KEY"; } || skip "sabnzbd: not running"

HAVE_QBIT=false
if running qbittorrent || docker run --rm --network mediastack_proxy curlimages/curl:8.11.1 -sf -o /dev/null --max-time 5 http://gluetun:8080 2>/dev/null; then
  HAVE_QBIT=true
  QBIT_USER=${QBIT_USER:-admin}
  if [[ -z "${QBIT_PASS:-}" ]]; then read -rsp "  qBittorrent WebUI password for '$QBIT_USER': " QBIT_PASS; echo; fi
fi

# ------------------------------------------------------------------------ sabnzbd
if [[ -n "$SAB_KEY" ]] && running sabnzbd; then
  echo "▸ sabnzbd"
  sab() { docker exec sabnzbd curl -sf "http://localhost:8080/api?apikey=$SAB_KEY&output=json&$1" >/dev/null; }
  sab "mode=set_config&section=misc&keyword=download_dir&value=/data/usenet/incomplete" \
   && sab "mode=set_config&section=misc&keyword=complete_dir&value=/data/usenet/complete" \
   && ok "folders → /data/usenet/{incomplete,complete}" || warn "folder config failed"
  sab "mode=set_config&section=misc&keyword=host_whitelist&value=sabnzbd,sab.$DOMAIN" \
   && ok "host whitelist: sabnzbd, sab.$DOMAIN" || warn "host whitelist failed"
  for c in tv movies movies-4k music books; do sab "mode=set_config&section=categories&name=$c&dir=$c" || warn "category $c failed"; done
  ok "categories tv · movies · movies-4k · music · books"
fi

# ---------------------------------------------------------------------- *arr apps
# wire_arr <container> <port> <apiVersion> <rootfolder> <categoryField> <category>
#   Sonarr/Radarr use /api/v3; Lidarr uses /api/v1 and needs profile ids on its root folder.
wire_arr() {
  local app=$1 port=$2 v=$3 root=$4 catf=$5 cat=$6 k=${KEY[$1]:-}
  [[ -z "$k" ]] && return 0
  echo "▸ $app"
  if api "$app" "$port" "$v" "$k" GET rootfolder 2>/dev/null | grep -q "\"path\":\"$root\""; then skip "root folder $root exists"
  else
    local rf="{\"path\":\"$root\"}"
    if [[ $app == lidarr ]]; then
      local qp mp
      qp=$(docker exec "$app" curl -sf -H "X-Api-Key: $k" "http://localhost:$port/api/$v/qualityprofile" | firstid)
      mp=$(docker exec "$app" curl -sf -H "X-Api-Key: $k" "http://localhost:$port/api/$v/metadataprofile" | firstid)
      rf="{\"name\":\"Music\",\"path\":\"$root\",\"defaultQualityProfileId\":${qp:-1},\"defaultMetadataProfileId\":${mp:-1}}"
    fi
    api "$app" "$port" "$v" "$k" POST rootfolder "$rf" >/dev/null && ok "root folder $root" || warn "root folder $root failed"
  fi

  local clients; clients=$(api "$app" "$port" "$v" "$k" GET downloadclient 2>/dev/null || true)
  if grep -q '"implementation":"QBittorrent"' <<<"$clients"; then skip "qBittorrent client exists"
  elif ! $HAVE_QBIT; then skip "qBittorrent not running — enable the torrent profile and re-run"
  else
    api "$app" "$port" "$v" "$k" POST "downloadclient?forceSave=true" "{
      \"enable\":true,\"protocol\":\"torrent\",\"priority\":1,\"name\":\"qBittorrent\",
      \"implementation\":\"QBittorrent\",\"configContract\":\"QBittorrentSettings\",\"tags\":[],
      \"removeCompletedDownloads\":true,\"removeFailedDownloads\":true,
      \"fields\":[{\"name\":\"host\",\"value\":\"gluetun\"},{\"name\":\"port\",\"value\":8080},
        {\"name\":\"useSsl\",\"value\":false},{\"name\":\"username\",\"value\":\"$(jstr "$QBIT_USER")\"},
        {\"name\":\"password\",\"value\":\"$(jstr "$QBIT_PASS")\"},{\"name\":\"$catf\",\"value\":\"$cat\"}]}" >/dev/null \
      && ok "qBittorrent (gluetun:8080, category $cat)" || warn "qBittorrent failed — check QBIT_USER/QBIT_PASS"
  fi

  if grep -q '"implementation":"Sabnzbd"' <<<"$clients"; then skip "SABnzbd client exists"
  elif [[ -z "$SAB_KEY" ]] || ! running sabnzbd; then :
  else
    api "$app" "$port" "$v" "$k" POST "downloadclient?forceSave=true" "{
      \"enable\":true,\"protocol\":\"usenet\",\"priority\":1,\"name\":\"SABnzbd\",
      \"implementation\":\"Sabnzbd\",\"configContract\":\"SabnzbdSettings\",\"tags\":[],
      \"removeCompletedDownloads\":true,\"removeFailedDownloads\":true,
      \"fields\":[{\"name\":\"host\",\"value\":\"sabnzbd\"},{\"name\":\"port\",\"value\":8080},
        {\"name\":\"useSsl\",\"value\":false},{\"name\":\"apiKey\",\"value\":\"$SAB_KEY\"},
        {\"name\":\"$catf\",\"value\":\"$cat\"}]}" >/dev/null \
      && ok "SABnzbd (sabnzbd:8080, category $cat)" || warn "SABnzbd client failed"
  fi
}
running sonarr    && wire_arr sonarr    8989 v3 /data/media/tv        tvCategory    tv
running radarr    && wire_arr radarr    7878 v3 /data/media/movies    movieCategory movies
running radarr-4k && wire_arr radarr-4k 7878 v3 /data/media/movies-4k movieCategory movies-4k
running lidarr    && wire_arr lidarr    8686 v1 /data/media/music     musicCategory music

# ----------------------------------------------------------------------- prowlarr
if running prowlarr && [[ -n "${KEY[prowlarr]:-}" ]]; then
  echo "▸ prowlarr"
  pk=${KEY[prowlarr]}
  apps=$(api prowlarr 9696 v1 "$pk" GET applications)
  for row in "Sonarr:Sonarr:sonarr:8989" "Radarr:Radarr:radarr:7878" "Radarr 4K:Radarr:radarr-4k:7878" "Lidarr:Lidarr:lidarr:8686"; do
    IFS=: read -r name impl host port <<<"$row"; k=${KEY[$host]:-}
    [[ -z "$k" ]] && continue
    if grep -q "\"name\":\"$name\"" <<<"$apps"; then skip "$name app sync exists"; continue; fi
    api prowlarr 9696 v1 "$pk" POST "applications?forceSave=true" "{
      \"name\":\"$name\",\"implementation\":\"$impl\",\"configContract\":\"${impl}Settings\",
      \"syncLevel\":\"fullSync\",\"tags\":[],
      \"fields\":[{\"name\":\"prowlarrUrl\",\"value\":\"http://prowlarr:9696\"},
        {\"name\":\"baseUrl\",\"value\":\"http://$host:$port\"},{\"name\":\"apiKey\",\"value\":\"$k\"}]}" >/dev/null \
      && ok "$name app sync (full)" || warn "$name app sync failed"
  done

  if api prowlarr 9696 v1 "$pk" GET indexerProxy | grep -q '"implementation":"FlareSolverr"'; then skip "Byparr proxy exists"
  else
    tag=$(api prowlarr 9696 v1 "$pk" GET tag | grep -oP '"label":"flaresolverr","id":\K[0-9]+' || true)
    [[ -z "$tag" ]] && tag=$(api prowlarr 9696 v1 "$pk" POST tag '{"label":"flaresolverr"}' | grep -oP '"id":\K[0-9]+')
    api prowlarr 9696 v1 "$pk" POST "indexerProxy?forceSave=true" "{
      \"name\":\"Byparr\",\"implementation\":\"FlareSolverr\",\"configContract\":\"FlareSolverrSettings\",
      \"tags\":[$tag],\"fields\":[{\"name\":\"host\",\"value\":\"http://byparr:8191/\"},
        {\"name\":\"requestTimeout\",\"value\":60}]}" >/dev/null \
      && ok "Byparr proxy — tag Cloudflare-protected indexers with 'flaresolverr'" \
      || warn "Byparr proxy failed — is byparr healthy? (docker logs byparr)"
  fi
fi

# ---------------------------------------------------------------------- cross-seed
CS="$CONFIG_ROOT/cross-seed/config.js"
if [[ -f "$CS" ]]; then
  echo "▸ cross-seed"
  patch() {  # patch <key> <js-array-literal>  — only fills keys still at []
    if grep -qE "^\s*$1: \[\]," "$CS"; then sed -i -E "s|^(\s*)$1: \[\],|\1$1: $2,|" "$CS"; ok "$1"; else skip "$1 already set"; fi; }
  patch linkDirs '["/data/torrents/cross-seed"]'
  if $HAVE_QBIT; then patch torrentClients "[\"qbittorrent:http://$(urlenc "$QBIT_USER"):$(urlenc "$QBIT_PASS")@gluetun:8080\"]"
  else skip "torrentClients — qBittorrent not running"; fi
  arrs=(); [[ -n "${KEY[sonarr]:-}" ]] && arrs+=("\"http://sonarr:8989/?apikey=${KEY[sonarr]}\"")
  [[ ${#arrs[@]} -gt 0 ]] && patch sonarr "[${arrs[*]}]"
  arrs=(); [[ -n "${KEY[radarr]:-}" ]] && arrs+=("\"http://radarr:7878/?apikey=${KEY[radarr]}\"")
  [[ -n "${KEY[radarr-4k]:-}" ]] && arrs+=("\"http://radarr-4k:7878/?apikey=${KEY[radarr-4k]}\"")
  [[ ${#arrs[@]} -gt 0 ]] && patch radarr "[$(IFS=,; echo "${arrs[*]}")]"
  # One torznab URL per enabled torrent indexer in Prowlarr
  if [[ -n "${KEY[prowlarr]:-}" ]]; then
    ids=$(api prowlarr 9696 v1 "${KEY[prowlarr]}" GET indexer | python3 -c '
import sys,json; print(" ".join(str(i["id"]) for i in json.load(sys.stdin) if i.get("enable") and i.get("protocol")=="torrent"))' 2>/dev/null || true)
    if [[ -n "$ids" ]]; then
      tz=$(for i in $ids; do printf '"http://prowlarr:9696/%s/api?apikey=%s",' "$i" "${KEY[prowlarr]}"; done)
      patch torznab "[${tz%,}]"
    else skip "torznab — add torrent indexers in Prowlarr, then re-run"; fi
  fi
  docker restart cross-seed >/dev/null && ok "cross-seed restarted (docker logs cross-seed)"
fi

echo
echo "Done. Restart services that read keys from .env:"
echo "  docker compose up -d homepage unpackerr recyclarr"
