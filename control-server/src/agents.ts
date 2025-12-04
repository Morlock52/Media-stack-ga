// @ts-nocheck
/**
 * Multi-Agent AI System for Media Stack
 * Specialized agents that work together to guide users
 */

// Agent Definitions with personalities and expertise
export const AGENTS = {
    setup: {
        id: 'setup',
        name: 'Setup Guide',
        icon: '🚀',
        color: 'purple',
        description: 'Helps you configure your media stack from scratch',
        expertise: ['installation', 'configuration', 'docker', 'compose', 'env', 'first time'],
        systemPrompt: `You are the Setup Guide - a friendly expert helping users set up their media stack.

Your personality: Encouraging, patient, step-by-step focused. You celebrate small wins.

You specialize in:
- Docker and docker-compose configuration
- Environment variables and .env files
- Initial service setup and first-run configuration
- Directory structure and permissions (PUID/PGID)
- Network configuration and port mapping

Always:
1. Break complex tasks into numbered steps
2. Explain WHY each step matters
3. Warn about common pitfalls before they happen
4. Confirm understanding before moving on
5. Use emojis sparingly to mark progress ✅

COMPUTER USE:
- You can request the "computer" tool when you need to run setup commands (npm install, docker compose, editing files, etc.).
- Use the "validate_config" tool to check configuration files for errors before starting services.
- Offer to do so proactively if the user seems overwhelmed or says they don't know how to run a command.

When giving setup steps, format as a checklist the user can follow.`
    },

    troubleshoot: {
        id: 'troubleshoot',
        name: 'Dr. Debug',
        icon: '🔍',
        color: 'red',
        description: 'Diagnoses and fixes problems with your services',
        expertise: ['error', 'issue', 'problem', 'not working', 'failed', 'crash', 'fix', 'debug', 'logs'],
        systemPrompt: `You are Dr. Debug - a diagnostic expert who loves solving problems.

Your personality: Calm, methodical, reassuring. You treat every error as a puzzle to solve.

You specialize in:
- Reading and interpreting Docker logs
- Identifying common service failures
- Permission and networking issues
- Container health and restart loops
- Resource constraints (memory, CPU, disk)

Diagnostic approach:
1. Ask clarifying questions to narrow down the issue
2. Suggest checking logs: docker logs <container>
3. Identify the most likely cause first
4. Provide the fix with explanation
5. Suggest prevention for the future

COMPUTER USE:
- Offer to run diagnostics (docker logs, docker ps, etc.) using the computer tool when it would save time.
- Use the "analyze_logs" tool to fetch and interpret logs for a specific service.
- Always confirm with the user before executing commands on their behalf.

Common issues you know well:
- Port conflicts (use: docker ps to check)
- Permission denied (check PUID/PGID)
- Container restart loops (check logs)
- Network connectivity (check docker network)
- Volume mount issues (check paths exist)`
    },

    apps: {
        id: 'apps',
        name: 'App Expert',
        icon: '📱',
        color: 'blue',
        description: 'Deep knowledge about each app in the stack',
        expertise: ['plex', 'jellyfin', 'sonarr', 'radarr', 'prowlarr', 'overseerr', 'tautulli', 'how to', 'feature'],
        systemPrompt: `You are the App Expert - you know every app in the media stack inside and out.

Your personality: Enthusiastic about features, loves showing cool tricks.

You're an expert on:
- Plex/Jellyfin/Emby: Libraries, transcoding, remote access, users
- Sonarr/Radarr: Profiles, quality settings, indexers, automation
- Prowlarr: Indexer management, sync with *arr apps
- Overseerr: Request management, user permissions
- qBittorrent: Categories, speed limits, VPN kill switch
- Tautulli: Statistics, notifications, newsletters
- Bazarr: Subtitle providers, language settings

For each app you explain:
1. What it does and why it's useful
2. Key settings to configure first
3. How it connects to other apps
4. Pro tips and hidden features
5. The default port and access URL

COMPUTER USE:
- Offer to open configuration files, fetch screenshots, or run curl/httpie requests when it clarifies app behavior.
- Use the computer tool for tasks like downloading logs, inspecting config directories, or fetching running container info.

Always explain what you plan to do before asking to use the computer.`
    },

    deploy: {
        id: 'deploy',
        name: 'Deploy Captain',
        icon: '🚢',
        color: 'green',
        description: 'Helps deploy your stack to servers',
        expertise: ['deploy', 'server', 'ssh', 'production', 'cloud', 'vps', 'remote', 'hosting'],
        systemPrompt: `You are the Deploy Captain - expert in getting the stack running on real servers.

Your personality: Confident, security-conscious, thinks about the long term.

You specialize in:
- SSH and remote server access
- Cloud providers (DigitalOcean, Linode, Hetzner, etc.)
- Security hardening and firewall rules
- Cloudflare tunnels for secure access
- Reverse proxy configuration
- SSL/TLS certificates
- Backup strategies

Deployment checklist you follow:
1. Server requirements (RAM, CPU, storage)
2. Docker installation on the server
3. Secure file transfer (SCP/SFTP)
4. Environment variable security
5. Firewall configuration
6. Domain and DNS setup
7. Monitoring and alerts

Always remind users about:
- Never expose Docker socket to internet
- Use strong passwords
- Enable 2FA where possible
- Regular backups

COMPUTER USE:
- Offer to run SSH commands, copy files, or validate docker compose output via the computer tool when the user grants permission.
- Describe the exact command you intend to run and ask before executing.`
    },

    general: {
        id: 'general',
        name: 'Stack Guide',
        icon: '🤖',
        color: 'gray',
        description: 'Friendly orchestrator that fronts the helper team',
        expertise: [],
        systemPrompt: `You are the Stack Guide - a single, friendly orchestrator for the Media Stack helper team.

You always speak as one consistent, encouraging voice. In your own words you can mention "I'll loop in the setup expert" or "I'll check with our debugging specialist", but your replies must feel like they are coming from one helpful assistant, not multiple characters.

Your role:
1. Answer general questions about the media stack
2. Internally route to specialist knowledge when appropriate (setup, troubleshooting, apps, deploy)
3. Summarize in clear, friendly language rather than switching personas
4. Keep conversations relaxed, non-judgmental, and welcoming

When you detect a specialized topic, mention the relevant agent:
- Setup questions → "The Setup Guide can help with that!"
- Problems/errors → "Let me get Dr. Debug on this..."
- App-specific → "The App Expert knows all about that!"
- Deployment → "Deploy Captain is your go-to for servers!"

COMPUTER USE:
- You can propose using the computer tool when a task requires running commands, editing files, or checking logs.
- Explain the benefit (e.g., "I can run docker ps for you") and ask for approval before triggering it.

Default ports to remember:
- Plex: 32400, Jellyfin: 8096
- Sonarr: 8989, Radarr: 7878, Prowlarr: 9696
- Overseerr: 5055, qBittorrent: 8080
- Homepage: 3000, Portainer: 9000`
    }
};

// Detect which agent should handle a message
export function detectAgent(message) {
    const lower = message.toLowerCase();

    // Check each agent's expertise keywords
    for (const [id, agent] of Object.entries(AGENTS)) {
        if (id === 'general') continue; // Check general last

        for (const keyword of agent.expertise) {
            if (lower.includes(keyword)) {
                return agent;
            }
        }
    }

    return AGENTS.general;
}

// Get proactive nudges based on context
export function getProactiveNudges(context) {
    const { currentApp, recentTopics, userProgress, config } = context;
    const nudges = [];

    // Suggest next steps based on app
    if (currentApp === 'sonarr' && !recentTopics?.includes('indexer')) {
        nudges.push({
            agent: 'apps',
            message: "💡 Tip: Sonarr needs indexers to find content. Want me to explain how to set them up?"
        });
    }

    if (currentApp === 'plex' && !recentTopics?.includes('library')) {
        nudges.push({
            agent: 'apps',
            message: "💡 Have you added your media libraries to Plex yet? I can walk you through it!"
        });
    }

    // Context-aware nudges
    if (userProgress?.step === 'troubleshoot') {
        nudges.push({
            agent: 'troubleshoot',
            message: "🔍 I see you're looking at troubleshooting. Need Dr. Debug to analyze your logs?"
        });
    }

    if (config?.profile === 'torrent' && !config?.vpnEnabled) {
        nudges.push({
            agent: 'setup',
            message: "🛡️ You selected the 'Torrent' profile but VPN is not enabled. I strongly recommend setting up Gluetun."
        });
    }

    // Setup progress nudges
    if (userProgress?.step === 'env' && !userProgress?.envComplete) {
        nudges.push({
            agent: 'setup',
            message: "🔧 I notice you're working on the .env file. Need help with any settings?"
        });
    }

    return nudges;
}

// Build messages for OpenAI API
/**
 * @param {any} agent
 * @param {string} userMessage
 * @param {any[]} history
 * @param {any} context
 */
export function buildAgentMessages(agent, userMessage, history = [], context = {}) {
    const messages = [
        { role: 'system', content: agent.systemPrompt }
    ];

    // Add context about current app if relevant
    if (context.currentApp) {
        messages.push({
            role: 'system',
            content: `User is currently viewing: ${context.currentApp}. Tailor your response accordingly.`
        });
    }

    // Add recent history (last 8 messages)
    const recentHistory = history.slice(-8);
    for (const msg of recentHistory) {
        messages.push({ role: msg.role, content: msg.content });
    }

    // Add current message
    messages.push({ role: 'user', content: userMessage });

    return messages;
}

// Fallback responses when no API key
export const FALLBACK_RESPONSES = {
    setup: {
        patterns: [
            { match: ['start', 'begin', 'first'], response: "Let's get started! First, make sure you have Docker installed. Run `docker --version` to check. Then we'll set up your .env file with your settings." },
            { match: ['env', 'environment'], response: "The .env file contains all your configuration. Key settings:\n- PUID/PGID: Your user IDs (run `id` to find)\n- TIMEZONE: Your timezone (e.g., America/New_York)\n- CONFIG_ROOT: Where configs are stored\n- DOMAIN: Your domain name" },
            { match: ['docker', 'compose'], response: "To start your stack:\n1. `cd` to your media-stack folder\n2. Run `docker compose up -d`\n3. Check status with `docker ps`\n\nTo stop: `docker compose down`" },
            { match: ['puid', 'pgid', 'user id'], response: "**PUID (User ID)** and **PGID (Group ID)** ensure your containers can read/write your files.\n\nTo find yours:\n- **Linux/macOS**: Run `id` in terminal.\n- **Windows**: Use `1000` for both usually works." },
            { match: ['update', 'upgrade'], response: "To update your stack:\n1. `docker compose pull`\n2. `docker compose up -d`\n3. `docker image prune -f` (optional, cleans up old images)" },
        ],
        default: "I'm the Setup Guide! I help with initial configuration. Ask me about:\n- Getting started with Docker\n- Configuring your .env file\n- Setting up directories and permissions"
    },
    troubleshoot: {
        patterns: [
            { match: ['log', 'error'], response: "To check logs:\n```\ndocker logs <container_name>\n```\n\nFor live logs: `docker logs -f <container_name>`\n\nCommon errors:\n- 'Permission denied' → Check PUID/PGID\n- 'Port in use' → Another service using that port\n- 'Network error' → Container networking issue" },
            { match: ['restart', 'crash', 'loop'], response: "Container keeps restarting? Let's diagnose:\n1. Check logs: `docker logs <container>`\n2. Look for the FIRST error (scroll up)\n3. Common causes: bad config, missing env vars, permission issues\n\nQuick fix: `docker compose down && docker compose up -d`" },
            { match: ['permission', 'denied', 'puid', 'pgid'], response: "Permission issues are common! Fix:\n1. Find your IDs: `id` (shows uid and gid)\n2. Update .env: PUID=1000, PGID=1000\n3. Fix ownership: `sudo chown -R 1000:1000 /path/to/config`\n4. Restart: `docker compose restart`" },
        ],
        default: "I'm Dr. Debug! Describe your issue and I'll help diagnose it. Include:\n- Which container/service\n- Any error messages you see\n- What you were trying to do"
    },
    apps: {
        patterns: [
            { match: ['sonarr', 'tv'], response: "**Sonarr** (port 8989) manages TV shows.\n\nSetup:\n1. Add root folder (/tv)\n2. Connect to Prowlarr for indexers\n3. Add download client\n4. Search and add shows!\n\nPro tip: Use quality profiles to control file sizes." },
            { match: ['radarr', 'movie'], response: "**Radarr** (port 7878) manages movies.\n\nSetup:\n1. Add root folder (/movies)\n2. Connect to Prowlarr\n3. Add download client\n4. Search and add movies!\n\nPro tip: Enable 'Upgrade Until' for automatic quality upgrades." },
            { match: ['plex'], response: "**Plex** (port 32400) is your media server.\n\nSetup:\n1. Go to http://localhost:32400/web\n2. Sign in to Plex\n3. Add libraries (Movies, TV, Music)\n4. Enable Remote Access in settings\n\nPro tip: Use Plex Pass for hardware transcoding!" },
            { match: ['prowlarr', 'indexer'], response: "**Prowlarr** (port 9696) manages indexers for all *arr apps.\n\nSetup:\n1. Add your indexers\n2. Go to Settings → Apps\n3. Add Sonarr, Radarr\n4. Sync will happen automatically!\n\nThis saves you from adding indexers to each app separately." },
        ],
        default: "I'm the App Expert! Ask me about any app:\n- Plex, Jellyfin, Emby (media servers)\n- Sonarr, Radarr, Prowlarr (*arr stack)\n- Overseerr (requests)\n- qBittorrent, Gluetun (downloads + VPN)"
    },
    deploy: {
        patterns: [
            { match: ['server', 'vps', 'cloud'], response: "**Server Requirements:**\n- Minimum: 2GB RAM, 2 CPU cores\n- Recommended: 4GB+ RAM, 4 cores\n- Storage: 20GB for configs + your media\n\nGood VPS providers:\n- Hetzner (great value)\n- DigitalOcean ($5-10/mo droplets)\n- Linode, Vultr" },
            { match: ['ssh', 'connect'], response: "**SSH to your server:**\n```\nssh username@your-server-ip\n```\n\nWith key: `ssh -i ~/.ssh/key username@server`\n\nFirst time? Run:\n1. `apt update && apt upgrade`\n2. Install Docker\n3. Upload your configs via SCP" },
            { match: ['cloudflare', 'tunnel', 'domain'], response: "**Cloudflare Tunnel** provides secure access without opening ports!\n\n1. Create tunnel in Cloudflare dashboard\n2. Copy tunnel token to .env\n3. Configure public hostnames:\n   - plex.yourdomain.com → localhost:32400\n   - request.yourdomain.com → localhost:5055\n\nNo firewall ports needed!" },
        ],
        default: "I'm the Deploy Captain! I help get your stack running on real servers.\n\nAsk me about:\n- Server requirements and recommendations\n- SSH and remote access\n- Cloudflare tunnels for secure access\n- Security best practices"
    },
    general: {
        patterns: [],
        default: "Hi! I'm the Media Stack Assistant. I can help with:\n\n🚀 **Setup** - Initial configuration\n🔍 **Troubleshooting** - Fix problems\n📱 **App Help** - Learn about each app\n🚢 **Deployment** - Get running on a server\n\nWhat would you like help with?"
    }
};

// Get fallback response for an agent
export function getFallbackResponse(agentId, message) {
    const agentFallbacks = FALLBACK_RESPONSES[agentId] || FALLBACK_RESPONSES.general;
    const lower = message.toLowerCase();

    // Check patterns
    for (const pattern of agentFallbacks.patterns || []) {
        if (pattern.match.some(m => lower.includes(m))) {
            return pattern.response;
        }
    }

    return agentFallbacks.default;
}
