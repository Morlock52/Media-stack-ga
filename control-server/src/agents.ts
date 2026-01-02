import { Agent, AiChatRequest } from './types/index.js';

/**
 * Multi-Agent AI System for Media Stack
 * Specialized agents that work together to guide users
 */

// Agent Definitions with personalities and expertise
export const AGENTS: Record<string, Agent & { expertise: string[], systemPrompt: string }> = {
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
export function detectAgent(message: string) {
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
export function getProactiveNudges(context: any) {
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
export function buildAgentMessages(agent: any, userMessage: string, history: any[] = [], context: any = {}) {
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

// Fallback responses when no API key - optimized for voice (shorter, conversational)
export const FALLBACK_RESPONSES: Record<string, { patterns: { match: string[], response: string }[], default: string }> = {
    setup: {
        patterns: [
            { match: ['start', 'begin', 'first', 'hello', 'hi', 'hey'], response: "Welcome! I'll help you set up your media stack. First, let's make sure Docker is installed. Type docker version in your terminal to check. Then we can configure your settings using this wizard." },
            { match: ['env', 'environment'], response: "Your configuration lives in the dot-env file. The key settings are your timezone, user IDs for file permissions, and your domain name. The wizard will help you set all of these." },
            { match: ['docker', 'compose'], response: "To start your stack, navigate to your media stack folder and run docker compose up dash-d. Check if containers are running with docker ps. To stop everything, use docker compose down." },
            { match: ['puid', 'pgid', 'user id', 'permission'], response: "User and group IDs ensure containers can access your files. On Linux or Mac, run the id command to find yours. On Windows, using 1000 for both usually works fine." },
            { match: ['update', 'upgrade'], response: "Updating is easy! Run docker compose pull to get new images, then docker compose up dash-d to restart with the updates." },
            { match: ['plex'], response: "I can help you set up Plex! It's a popular media server that streams your content anywhere. Select it in the wizard and I'll walk you through the configuration." },
            { match: ['jellyfin'], response: "Jellyfin is a great free alternative to Plex. No account required, fully open source. Select it in the wizard to add it to your stack." },
            { match: ['sonarr', 'tv', 'shows'], response: "Sonarr automates TV show downloads. It monitors for new episodes and grabs them automatically. Pair it with Prowlarr for indexers and a download client like qBittorrent." },
            { match: ['radarr', 'movie', 'movies'], response: "Radarr is like Sonarr but for movies. Add movies to your watchlist and it handles the rest. Works great with Prowlarr and qBittorrent." },
            { match: ['vpn', 'gluetun', 'privacy'], response: "For privacy, I recommend Gluetun VPN. It routes your download traffic through a VPN. You'll need credentials from a VPN provider like Mullvad or ProtonVPN." },
        ],
        default: "I'm here to help you set up your media stack! Tell me what services you want like Plex, Sonarr, or Jellyfin, and I'll configure them for you. You can also describe your goal and I'll suggest the right setup."
    },
    troubleshoot: {
        patterns: [
            { match: ['log', 'error', 'logs'], response: "To check logs, run docker logs followed by the container name. For example, docker logs sonarr. Add dash-f to follow the logs in real time. Look for error messages, especially permission denied or connection refused." },
            { match: ['restart', 'crash', 'loop', 'restarting'], response: "If a container keeps restarting, check its logs first with docker logs. Look at the very first error message. Common causes are missing environment variables, bad config files, or permission issues. Try docker compose down then docker compose up dash-d." },
            { match: ['permission', 'denied', 'puid', 'pgid', 'access'], response: "Permission denied errors usually mean your user IDs are wrong. Run the id command to get your user and group IDs. Update PUID and PGID in your dot-env file to match. Then restart the container." },
            { match: ['port', 'conflict', 'address already in use'], response: "Port conflict means something else is using that port. Run docker ps to see what's running. You can change the port mapping in your compose file, or stop the conflicting service." },
            { match: ['network', 'connection', 'refused', 'timeout'], response: "Connection issues between containers often mean they're not on the same Docker network. Check that all services use the same network in your compose file. Also verify the container names are correct in your configuration." },
        ],
        default: "I can help troubleshoot issues! Tell me which service is having problems and what error you're seeing. Common fixes involve checking logs, verifying permissions, and ensuring containers are on the same network."
    },
    apps: {
        patterns: [
            { match: ['sonarr', 'tv show'], response: "Sonarr runs on port 8989 and automates TV show management. First add your media folder, then connect to Prowlarr for indexers, add your download client, and start adding shows. It'll grab new episodes automatically." },
            { match: ['radarr', 'movie'], response: "Radarr runs on port 7878 and manages your movie collection. Add your movies folder, connect Prowlarr for indexers, set up your download client, then add movies to your wanted list. It'll find and download them for you." },
            { match: ['plex'], response: "Plex runs on port 32400. Open localhost:32400/web in your browser, sign in with your Plex account, then add your media libraries. You can stream anywhere once remote access is enabled." },
            { match: ['jellyfin'], response: "Jellyfin runs on port 8096. It's completely free with no account required. Access it at localhost:8096, create an admin user, then add your media libraries. Great privacy-focused alternative to Plex." },
            { match: ['prowlarr', 'indexer'], response: "Prowlarr runs on port 9696 and manages indexers for all your arr apps. Add your indexers here, then connect Sonarr and Radarr in settings. Indexers will sync automatically to all connected apps." },
            { match: ['overseerr', 'request'], response: "Overseerr runs on port 5055 and lets users request movies and shows. Connect it to Plex, then Sonarr and Radarr. Users can browse and request content which gets added to your arr apps automatically." },
            { match: ['qbittorrent', 'torrent', 'download'], response: "qBittorrent runs on port 8080. Default login is admin with password adminadmin. Change this immediately! Set your download path and connect it to Sonarr and Radarr as your download client." },
            { match: ['bazarr', 'subtitle'], response: "Bazarr handles subtitles automatically. Connect it to Sonarr and Radarr, add subtitle providers like OpenSubtitles, and it will download subtitles for your media automatically." },
        ],
        default: "I know all about the apps in your media stack! Ask me about Plex, Jellyfin, Sonarr, Radarr, Prowlarr, Overseerr, qBittorrent, or any other service. I'll explain how to set it up and configure it."
    },
    deploy: {
        patterns: [
            { match: ['server', 'vps', 'cloud', 'host'], response: "For a media stack, I recommend at least 2GB RAM and 2 CPU cores. 4GB RAM is better if you plan to transcode. Hetzner offers great value, DigitalOcean is beginner-friendly, and Linode is also solid. Storage depends on your media collection." },
            { match: ['ssh', 'connect', 'remote'], response: "Connect to your server with SSH. Type ssh followed by your username, an at sign, and your server IP. First time connecting, update the system, install Docker, then upload your configuration files." },
            { match: ['cloudflare', 'tunnel', 'domain', 'access'], response: "Cloudflare Tunnels let you access services securely without opening ports. Create a tunnel in the Cloudflare dashboard, copy the token to your dot-env file, then set up hostnames like plex.yourdomain.com pointing to localhost:32400." },
            { match: ['secure', 'security', 'firewall', 'safe'], response: "For security, never expose Docker socket to the internet. Use strong passwords everywhere, enable two-factor authentication where possible, and keep your system updated. Cloudflare Tunnels with Authelia provide secure authenticated access." },
        ],
        default: "I can help deploy your stack to a real server! Ask about server requirements, SSH access, Cloudflare Tunnels for secure remote access, or security best practices. I'll guide you through the whole process."
    },
    general: {
        patterns: [
            { match: ['hello', 'hi', 'hey', 'help'], response: "Hi there! I'm your media stack assistant. I can help you set up services like Plex, Sonarr, and Radarr, troubleshoot issues, or deploy to a server. What would you like to work on?" },
            { match: ['what', 'can you', 'able'], response: "I can help with setting up your media stack, configuring services, troubleshooting problems, and deploying to servers. Tell me what you want to accomplish and I'll guide you through it." },
            { match: ['recommend', 'suggest', 'should'], response: "For a typical setup, I recommend Plex or Jellyfin for streaming, Sonarr for TV shows, Radarr for movies, Prowlarr for indexers, and qBittorrent with Gluetun VPN for downloads. Overseerr is great if you want users to request content." },
            { match: ['thank', 'thanks'], response: "You're welcome! Let me know if you need help with anything else. I'm here to make your media stack setup as smooth as possible." },
        ],
        default: "Hi! I'm your media stack assistant. I can help with setup, troubleshooting, app configuration, or deployment. Tell me what you'd like to work on, or describe your goal and I'll suggest the right approach."
    }
};

// Get fallback response for an agent
export function getFallbackResponse(agentId: string, message: string) {
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
