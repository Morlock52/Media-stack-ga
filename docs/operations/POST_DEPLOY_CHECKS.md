# Post‑Deploy Checks (Reliability)

After any update (`docker compose pull` / `up -d` / Watchtower run), run a quick sanity pass to confirm the **three most fragile layers** are healthy:

1. **VPN isolation (Gluetun)** — downloads cannot leak if VPN drops
2. **SSO/Auth (Authelia)** — auth endpoints behave as expected
3. **Remote access (Cloudflare Tunnel + DNS)** — hostnames resolve and requests reach your stack

## Run the one‑shot checker

From the repo root:

```bash
bash ./scripts/post_deploy_check.sh
```

This script is safe to run repeatedly. It **does not** change containers or configs.

## Customize checks (environment variables)

The script will auto‑detect `DOMAIN` from your `.env`, but you can override anything:

```bash
# Which containers to target (defaults match docker-compose.yml)
export GLUETUN_CONTAINER=gluetun
export AUTHELIA_CONTAINER=authelia
export CLOUDFLARED_CONTAINER=cloudflared
export QBITTORRENT_CONTAINER=qbittorrent

# Public Authelia URL (defaults to https://auth.$DOMAIN when DOMAIN is set)
export AUTHELIA_BASE="https://auth.example.com"

# A hostname that should be reachable (defaults to homepage.$DOMAIN when DOMAIN is set)
export TEST_HOST="homepage.example.com"

# Optional: if you expose a dedicated health endpoint
export HEALTH_PATH="/healthz"

bash ./scripts/post_deploy_check.sh
```

## What “pass” looks like

- **Gluetun**: container is running, public IP is fetchable from inside the VPN namespace, DNS resolves inside the VPN namespace.
- **qBittorrent kill‑switch wiring**: `qbittorrent` is network‑namespaced behind Gluetun (`NetworkMode=container:gluetun`).
- **Authelia**:
  - `GET /api/verify` returns `401` when unauthenticated
  - `GET /api/state` returns `200`
- **Tunnel/DNS**:
  - `dig +short CNAME $TEST_HOST` typically returns `*.cfargotunnel.com`
  - `curl https://$TEST_HOST/...` returns any non‑5xx code (200/3xx is ideal; 302 is common when Authelia redirects to login)

## GitHub Actions (self‑hosted runner recommended)

If you want this to run automatically, use a **self‑hosted runner on the machine that runs your stack** (or on a machine with Docker socket access and network reachability to your hostnames).

- See `.github/workflows/post-deploy-check.yml`

