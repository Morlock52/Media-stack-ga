# 🚀 Start Here — Pick Your Setup Path

Choose **one** path based on your comfort level and goals. All paths produce the same result: a working media stack.

---

## Quick Decision Tree

```text
Do you want a guided UI experience?
├── YES → Option A: Docker Wizard (recommended)
└── NO
    ├── Comfortable with shell scripts? → Option B: Interactive Shell Setup
    └── Want full manual control? → Option C: Power User (manual)
```

---

## Option A: Docker Wizard (Recommended)

**Best for:** First-time users, visual learners, anyone who wants a Matrix HUD experience.

The wizard runs in Docker containers and provides a step-by-step Matrix HUD interface to configure your stack.

```bash
# 1. Clone the repo
git clone https://github.com/Morlock52/Media-stack-ga.git
cd Media-stack-ga

# 2. Start the wizard containers
docker compose -f docker-compose.wizard.yml up --build -d

# 3. Open the wizard UI
open http://localhost:3002   # macOS
# or visit http://localhost:3002 in your browser
```

**Ports:**

- `http://localhost:3002` — Wizard UI
- `http://localhost:3001` — Wizard API (internal)

**What you get:**

- Visual service selection
- Storage planner
- Generated `.env` and `docker-compose.yml`
- One-click download of all configs
- Optional remote deploy via SSH (requires the Wizard API to be reachable from the UI; Docker Wizard mode proxies `/api` automatically, but static-hosted UIs must set `VITE_CONTROL_SERVER_URL` at build time)

**Optional: Remote deploy (SSH)**

1. Complete the wizard and go to **Review & Generate**.
2. Click **Deploy to Server** and run **Test Connection**.
3. Fill in host/port/user, choose password or key auth, and confirm deploy path.
4. (Optional) Leave **Auto‑remove conflicting containers** enabled to auto-fix container name conflicts (remove the old container and retry once).
5. (Optional) Leave **Auto-disable VPN/torrent profiles if `/dev/net/tun` is missing** enabled so the rest of the stack can still deploy on hosts without TUN support.
6. Click **Deploy** and follow the step list.

**Notes:**
- The remote host needs Docker + Docker Compose.
- Password auth requires `sshpass` on the control server.
- If you click **Deploy** twice, the control server rejects the duplicate request with **HTTP 409** (“deployment already in progress”).
- After SSH connects, the deploy collects a best-effort **remote container snapshot** (name + on/off) and shows it in the UI.
- Remote deploy does not configure DNS or Cloudflare; see “After Setup” below.

<p align="center">
  <img src="images/app/09-remote-deploy-desktop.png" alt="Remote deploy modal" width="1100" />
</p>

**Stop the wizard when done:**

```bash
docker compose -f docker-compose.wizard.yml down
```

---

## Option B: Interactive Shell Setup

**Best for:** Terminal users who prefer a guided script over a web UI.

```bash
# 1. Clone the repo
git clone https://github.com/Morlock52/Media-stack-ga.git
cd Media-stack-ga

# 2. Make scripts executable and run
chmod +x setup.sh
./setup.sh
```

**What you get:**

- Interactive prompts in your terminal
- Generates `.env` with your settings
- Runs `docker compose up -d` for you

**Windows users:** Use `setup.ps1` instead.

---

## Option C: Power User (Manual)

**Best for:** Experienced Docker users who want full control.

```bash
# 1. Clone the repo
git clone https://github.com/Morlock52/Media-stack-ga.git
cd Media-stack-ga

# 2. Copy and edit the environment file
cp .env.example .env
nano .env  # or your preferred editor

# 3. Start the stack
docker compose up -d
```

**Key `.env` variables to set:**

- `PUID` / `PGID` — Your user/group IDs (run `id` to find them)
- `TIMEZONE` — e.g., `America/New_York`
- `DATA_ROOT` — Absolute path for media data
- `CONFIG_ROOT` — Absolute path for app configs
- `DOMAIN` — Your domain (if using Cloudflare tunnel)

---

## Comparison Table

| Feature | Docker Wizard | Shell Setup | Manual |
|---------|---------------|-------------|--------|
| Visual UI | ✅ | ❌ | ❌ |
| Guided prompts | ✅ | ✅ | ❌ |
| Service picker | ✅ | ✅ | ❌ |
| Storage planner | ✅ | ❌ | ❌ |
| Remote deploy | ✅ | ❌ | ❌ |
| Full control | ⚠️ | ⚠️ | ✅ |
| No dependencies | ❌ | ⚠️ | ✅ |

---

## After Setup

Once your stack is running, you can:

1. **Access your services**:
   - **Local/LAN:** `http://<server-ip>` (Homepage dashboard)
   - **Domain/Tunnel:** `https://<service>.${DOMAIN}`
   - Add local `/etc/hosts` entries if you want subdomains without DNS
2. **Run health checks:** `./scripts/doctor.sh`
3. **Update containers:** `./scripts/update.sh`
4. **View logs:** `docker compose logs -f <service_name>`

---

## Troubleshooting

**Wizard UI won't load?**

- Check if ports 3001/3002 are free: `lsof -i :3001 -i :3002`
- View logs: `docker compose -f docker-compose.wizard.yml logs`

**Services won't start?**

- Ensure `.env` uses **absolute paths** for `DATA_ROOT` and `CONFIG_ROOT`
- Check permissions: `id` should match `PUID`/`PGID` in `.env`

**Need more help?**

- [Issues](https://github.com/Morlock52/Media-stack-ga/issues)
- [Discussions](https://github.com/Morlock52/Media-stack-ga/discussions)
