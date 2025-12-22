#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env}"

CURL_TIMEOUT="${CURL_TIMEOUT:-10}"

fail() { printf "❌ %s\n" "$*" >&2; exit 1; }
ok() { printf "✅ %s\n" "$*"; }
warn() { printf "⚠️  %s\n" "$*"; }
info() { printf "ℹ️  %s\n" "$*"; }

dotenv_get() {
  local key="$1"
  [[ -f "${ENV_FILE}" ]] || return 0
  # Keep the last occurrence of KEY=..., ignore comments and empty lines.
  local line
  line="$(
    awk -F= -v k="$key" '
      $0 ~ "^[[:space:]]*#" { next }
      $0 ~ "^[[:space:]]*$" { next }
      $1 == k { sub("^[^=]*=",""); print; last=NR }
      END { }
    ' "${ENV_FILE}" | tail -n 1
  )"
  # Trim surrounding quotes/spaces.
  line="${line%\"}"; line="${line#\"}"
  line="${line%\'}"; line="${line#\'}"
  printf "%s" "${line}"
}

DOMAIN="${DOMAIN:-$(dotenv_get DOMAIN)}"

default_scheme_for_domain() {
  local domain="${1:-}"
  if [[ -z "${domain}" ]]; then
    printf "https"
    return 0
  fi
  if [[ "${domain}" == "local" || "${domain}" == "localhost" || "${domain}" == 127.* || "${domain}" == "::1" ]]; then
    printf "http"
    return 0
  fi
  if [[ "${domain}" == *.local ]]; then
    printf "http"
    return 0
  fi
  printf "https"
}

echo "== Media Stack Post‑Deploy Check =="
echo "Project: ${PROJECT_ROOT}"
[[ -n "${DOMAIN}" ]] && echo "Domain:  ${DOMAIN}"
echo

command -v docker >/dev/null 2>&1 || fail "docker not found in PATH"
docker info >/dev/null 2>&1 || fail "docker daemon not reachable"
command -v curl >/dev/null 2>&1 || fail "curl not found in PATH"

GLUETUN_CONTAINER="${GLUETUN_CONTAINER:-gluetun}"
QBITTORRENT_CONTAINER="${QBITTORRENT_CONTAINER:-qbittorrent}"
AUTHELIA_CONTAINER="${AUTHELIA_CONTAINER:-authelia}"
CLOUDFLARED_CONTAINER="${CLOUDFLARED_CONTAINER:-cloudflared}"

AUTHELIA_BASE="${AUTHELIA_BASE:-}"
AUTHELIA_HOST_HEADER="${AUTHELIA_HOST:-}"
AUTHELIA_PROTO_HEADER="${AUTHELIA_PROTO:-}"
if [[ -z "${AUTHELIA_BASE}" && -n "${DOMAIN}" ]]; then
  scheme="$(default_scheme_for_domain "${DOMAIN}")"
  AUTHELIA_BASE="${scheme}://auth.${DOMAIN}"
fi

TEST_HOST="${TEST_HOST:-}"
if [[ -z "${TEST_HOST}" && -n "${DOMAIN}" && "${DOMAIN}" != "local" ]]; then
  TEST_HOST="homepage.${DOMAIN}"
fi

HEALTH_PATH="${HEALTH_PATH:-/healthz}"

docker_container_running() {
  docker ps --format '{{.Names}}' | grep -qx "$1"
}

docker_exec_sh() {
  local container="$1"
  shift
  docker exec "${container}" sh -lc "$*"
}

get_public_ip_from_container() {
  local container="$1"
  local try_cmd=""

  if docker_exec_sh "${container}" "command -v curl >/dev/null 2>&1"; then
    try_cmd='curl -fsS --max-time '"${CURL_TIMEOUT}"
  elif docker_exec_sh "${container}" "command -v wget >/dev/null 2>&1"; then
    try_cmd='wget -qO- --timeout='"${CURL_TIMEOUT}"
  else
    return 1
  fi

  local ip=""
  for endpoint in "https://ifconfig.io" "https://api.ipify.org" "https://icanhazip.com"; do
    ip="$(docker_exec_sh "${container}" "${try_cmd} ${endpoint} 2>/dev/null | tr -d '[:space:]' || true")"
    if [[ "${ip}" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
      printf "%s" "${ip}"
      return 0
    fi
  done
  return 1
}

if docker_container_running "${GLUETUN_CONTAINER}"; then
  echo "== GLUETUN (VPN) =="
  ok "Container running (${GLUETUN_CONTAINER})"

  VPN_IP="$(get_public_ip_from_container "${GLUETUN_CONTAINER}" || true)"
  [[ -n "${VPN_IP}" ]] || fail "Unable to fetch public IP from inside ${GLUETUN_CONTAINER}"
  ok "Public IP inside VPN: ${VPN_IP}"

  if docker_exec_sh "${GLUETUN_CONTAINER}" "getent hosts example.com >/dev/null 2>&1 || nslookup example.com >/dev/null 2>&1 || ping -c 1 -W 2 example.com >/dev/null 2>&1"; then
    ok "DNS resolution works inside VPN namespace"
  else
    fail "DNS resolution failed inside ${GLUETUN_CONTAINER}"
  fi

  if docker_container_running "${QBITTORRENT_CONTAINER}"; then
    mode="$(docker inspect -f '{{.HostConfig.NetworkMode}}' "${QBITTORRENT_CONTAINER}" 2>/dev/null || true)"
    if [[ "${mode}" == "container:${GLUETUN_CONTAINER}"* || "${mode}" == "service:${GLUETUN_CONTAINER}"* ]]; then
      ok "qBittorrent is network‑namespaced behind Gluetun (${mode})"
    else
      warn "qBittorrent is running but not network‑namespaced behind Gluetun (NetworkMode=${mode:-unknown})"
    fi
  else
    info "qBittorrent not running; skipping kill‑switch wiring check"
  fi

  echo
else
  warn "Gluetun container (${GLUETUN_CONTAINER}) not running; skipping VPN checks"
  echo
fi

if docker_container_running "${AUTHELIA_CONTAINER}"; then
  echo "== AUTHELIA (SSO/Auth) =="
  ok "Container running (${AUTHELIA_CONTAINER})"

  if [[ -z "${AUTHELIA_BASE}" ]]; then
    warn "AUTHELIA_BASE not set and DOMAIN missing; skipping HTTP checks"
  else
    extra_headers=()
    [[ -n "${AUTHELIA_HOST_HEADER}" ]] && extra_headers+=(-H "X-Forwarded-Host: ${AUTHELIA_HOST_HEADER}")
    [[ -n "${AUTHELIA_PROTO_HEADER}" ]] && extra_headers+=(-H "X-Forwarded-Proto: ${AUTHELIA_PROTO_HEADER}")

    http_401="$(curl -sk "${extra_headers[@]}" -o /dev/null -w "%{http_code}" --max-time "${CURL_TIMEOUT}" "${AUTHELIA_BASE}/api/verify" || echo "000")"
    [[ "${http_401}" == "401" ]] || fail "Authelia /api/verify should return 401 (got ${http_401})"
    ok "/api/verify returns 401 (expected)"

    state_200="$(curl -sk "${extra_headers[@]}" -o /dev/null -w "%{http_code}" --max-time "${CURL_TIMEOUT}" "${AUTHELIA_BASE}/api/state" || echo "000")"
    [[ "${state_200}" == "200" ]] || fail "Authelia /api/state should return 200 (got ${state_200})"
    ok "/api/state returns 200"

    if [[ -n "${AUTHELIA_USER:-}" && -n "${AUTHELIA_PASS:-}" ]]; then
      login_code="$(
        curl -sk -o /dev/null -w "%{http_code}" --max-time "${CURL_TIMEOUT}" \
          -H 'Content-Type: application/json' \
          -d "{\"username\":\"${AUTHELIA_USER}\",\"password\":\"${AUTHELIA_PASS}\"}" \
          "${AUTHELIA_BASE}/api/firstfactor" || echo "000"
      )"
      [[ "${login_code}" == "200" ]] || fail "Authelia firstfactor login failed (got ${login_code})"
      ok "Authelia login success (test user)"
    else
      info "Set AUTHELIA_USER and AUTHELIA_PASS to test login (optional)"
    fi
  fi

  echo
else
  warn "Authelia container (${AUTHELIA_CONTAINER}) not running; skipping auth checks"
  echo
fi

if docker_container_running "${CLOUDFLARED_CONTAINER}"; then
  echo "== CLOUDFLARE TUNNEL =="
  ok "Container running (${CLOUDFLARED_CONTAINER})"
  echo
else
  warn "cloudflared container (${CLOUDFLARED_CONTAINER}) not running; tunnel checks may be skipped"
  echo
fi

if [[ -n "${TEST_HOST}" ]]; then
  echo "== DNS + HTTP (external reachability) =="
  echo "Host: ${TEST_HOST}"

  if command -v dig >/dev/null 2>&1; then
    cname="$(dig +short CNAME "${TEST_HOST}" 2>/dev/null | head -n 1 | tr -d '\r')"
    if [[ -n "${cname}" ]]; then
      if [[ "${cname}" == *"cfargotunnel.com"* ]]; then
        ok "DNS CNAME points to Cloudflare Tunnel (${cname})"
      else
        warn "DNS CNAME for ${TEST_HOST} is ${cname} (expected *.cfargotunnel.com)"
      fi
    else
      warn "No CNAME returned for ${TEST_HOST} (may be A/AAAA or proxied)"
    fi
  else
    info "Install 'dig' for richer DNS checks (Linux: dnsutils)"
  fi

  scheme="$(default_scheme_for_domain "${DOMAIN}")"
  http_code="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 15 "${scheme}://${TEST_HOST}${HEALTH_PATH}" || echo "000")"
  if [[ "${http_code}" == "000" || "${http_code}" -ge 500 ]]; then
    http_code="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 15 "${scheme}://${TEST_HOST}/" || echo "000")"
  fi

  if [[ "${http_code}" == "000" || "${http_code}" -ge 500 ]]; then
    fail "HTTP check failed for ${TEST_HOST} (got ${http_code})"
  fi

  ok "Host reachable (HTTP ${http_code})"
  if [[ "${http_code}" != "200" ]]; then
    info "Non‑200 is OK if the service redirects to login (Authelia) or /healthz is not configured."
  fi

  echo
else
  info "TEST_HOST not set (and DOMAIN not usable); skipping DNS/HTTP checks"
  echo
fi

echo "🎉 Post‑deploy checks complete."
