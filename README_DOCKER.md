<div align="center">
<img src="docs/images/logo.png" alt="Media Stack Logo" width="100"/>

# Dockerized Media Stack Wizard
</div>

This document explains how to run the Media Stack Wizard (Control Server + Matrix HUD Web UI) using Docker.

## Prerequisites
- Docker
- Docker Compose

## Important: absolute paths in .env

Because the wizard runs inside a container but orchestrates containers on your host machine (using the Docker socket), relative paths in your `.env` file will typically fail to resolve correctly on the host.

**Before running the wizard in Docker:**
1. Open `.env` in the root directory.
2. Change `DATA_ROOT=./data` to an absolute path, e.g., `DATA_ROOT=/Users/yourname/media-stack/data`.
3. Ensure any other paths are also absolute.

## Running the Wizard

Run the following command in the root directory:

```bash
docker compose -f docker-compose.wizard.yml up --build -d
```

### Security-Hardened Mode (Recommended for Production)

For enhanced security, use the secure compose file which adds a Docker socket proxy that limits API access:

```bash
docker compose -f docker-compose.wizard.secure.yml up --build -d
```

This configuration:
- Uses `tecnativa/docker-socket-proxy` to restrict Docker API access
- Only allows container listing, inspection, start/stop/restart operations
- Blocks dangerous operations like exec, build, secrets, and swarm management
- Mounts the Docker socket as read-only to the proxy

## Accessing the Wizard

- **Web UI**: Open [http://localhost:3002](http://localhost:3002)
- **API**: [http://localhost:3001](http://localhost:3001) (ports are bound to `127.0.0.1` by default for safety).

### Remote deploy (SSH)

Remote deploy works from the wizard UI because the containerized UI proxies `/api` to the control server. If you enable `CONTROL_SERVER_TOKEN` on the API, set `VITE_CONTROL_SERVER_TOKEN` (or enter the token on the Settings page) so remote deploy and AI features can authenticate.

**Quick flow**

1. Open the wizard → complete your stack configuration.
2. In **Review & Generate**, click **Deploy to Server**.
3. Use **Test Connection** to verify SSH + Docker + Compose.
4. Fill in host/port/user credentials and click **Deploy**.

**What to expect**

- If you click **Deploy** twice, the control server rejects the duplicate request with **HTTP 409** (“deployment already in progress”).
- (Optional) **Auto‑remove conflicting containers** can auto-fix container name conflicts (remove the old container and retry once).
- (Optional) **Auto-disable VPN/torrent profiles if `/dev/net/tun` is missing** allows the rest of the stack to deploy on hosts without TUN support.
- After SSH connects, the deploy collects a best-effort **remote container snapshot** (name + on/off).

**Notes**
- Remote host must have Docker + Docker Compose installed.
- Password auth requires `sshpass` inside the control server environment.
- Remote deploy does not create DNS records or tunnel routes.

### Access after remote deploy

- **Domain/Tunnel:** `https://<service>.${DOMAIN}`
- **Local/LAN:** `http://<server-ip>` (Homepage dashboard via Traefik on port 80)
- Add `/etc/hosts` entries if you want subdomain access without DNS.

### Local-only vs Remote access (stack deployment)

- **Local LAN (no SSO/tunnel):** run the generated compose with `docker compose up -d`.
- **Remote/Zero-Trust:** run with `docker compose --profile auth --profile cloudflared up -d`.

VPN-protected downloads (Gluetun) still apply in both modes.

## Stopping the Wizard

```bash
docker compose -f docker-compose.wizard.yml down
# or for secure mode:
docker compose -f docker-compose.wizard.secure.yml down
```

## Troubleshooting

- **Port Conflicts**: Ensure ports 3002 and 3001 are free on your host.
- **Docker Socket permissions**: If you see "permission denied" errors regarding the Docker socket, you may need to adjust the user in `docker-compose.wizard.yml` or run with proper privileges.
- **Health Check Failures**: Both services have healthchecks. Use `docker compose ps` to verify containers are healthy before accessing the UI.
