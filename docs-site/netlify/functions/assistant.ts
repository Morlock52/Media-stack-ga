import type { Handler, HandlerEvent } from '@netlify/functions'

// Allowed topics – the assistant will ONLY answer questions about these
const ALLOWED_TOPICS = [
    'plex',
    'jellyfin',
    'emby',
    'sonarr',
    'radarr',
    'prowlarr',
    'lidarr',
    'readarr',
    'arr',
    'overseerr',
    'jellyseerr',
    'tautulli',
    'mealie',
    'audiobookshelf',
    'photoprism',
    'docker',
    'docker-compose',
    'docker compose',
    'reverse proxy',
    'traefik',
    'nginx',
    'cloudflare',
    'tunnel',
    'media server',
    'media stack',
    'setup wizard',
    'port',
    'volume',
    'container',
    'library',
    'transcoding',
    'remote access',
    'indexer',
    'download client',
    'qbittorrent',
    'nzbget',
    'sabnzbd',
    'usenet',
    'torrent',
]

const ALLOWED_APPS = [
    'plex',
    'jellyfin',
    'emby',
    'sonarr',
    'radarr',
    'prowlarr',
    'arr',
    'overseerr',
    'tautulli',
    'mealie',
    'audiobookshelf',
    'photoprism',
]

// Check if message is within allowed scope
function isInScope(message: string): boolean {
    const lower = message.toLowerCase()
    return ALLOWED_TOPICS.some((topic) => lower.includes(topic))
}

// System prompt that enforces scope and behavior
const SYSTEM_PROMPT = `You are the Media Stack Maker Docs Assistant - an AGENTIC AI that helps users set up and use their media stack.

YOUR SCOPE (you may ONLY help with these topics):
- Media servers: Plex, Jellyfin, Emby
- Automation: Sonarr, Radarr, Prowlarr, Lidarr, Readarr (the *Arr stack)
- Requests: Overseerr, Jellyseerr
- Monitoring: Tautulli
- Utilities: Mealie (recipes), Audiobookshelf (audiobooks/podcasts), PhotoPrism (photos)
- Infrastructure: Docker, docker-compose, reverse proxy, Traefik, Nginx, Cloudflare tunnels
- General media stack setup, ports, volumes, libraries, transcoding, remote access

AGENTIC CAPABILITIES - You can take actions! Include ONE of these JSON objects at the END of your response when appropriate:

1. SWITCH to a different guide (when user asks about a different app):
   {"action":"switchApp","appId":"plex"}
   Valid appIds: plex, jellyfin, emby, arr, overseerr, mealie, tautulli, audiobookshelf, photoprism

2. PROVIDE a setup checklist (when user wants step-by-step guidance):
   {"action":"checklist","items":["Step 1: Do X","Step 2: Do Y","Step 3: Do Z"]}

3. SHOW port information (when user asks about ports):
   {"action":"showPort","app":"plex","port":"32400"}

RULES:
1. If the user asks about ANYTHING outside the above scope, politely decline and list what you CAN help with.

2. Keep answers concise and beginner-friendly. Use simple language, avoid jargon.

3. BE PROACTIVE: If a user seems confused, offer to switch to the relevant guide or provide a checklist.

4. When mentioning ports, always include the actual port number (e.g., "Plex uses port 32400").

5. When relevant, suggest which guide would help most and offer to switch to it.

6. Current date context: Information is current as of November 2025.

7. Standard ports to reference:
   - Plex: 32400
   - Jellyfin/Emby: 8096
   - Sonarr: 8989, Radarr: 7878, Prowlarr: 9696
   - Overseerr: 5055, Tautulli: 8181
   - Mealie: 9925, Audiobookshelf: 13378, PhotoPrism: 2342

8. Be helpful, friendly, and ACTION-ORIENTED. Don't just explain - offer to do things!`

const OUT_OF_SCOPE_RESPONSE = `That's outside what I can help with.

I only cover the **Media Stack Maker** setup:
- **Media servers**: Plex, Jellyfin, Emby
- **Automation**: Sonarr, Radarr, Prowlarr (*Arr stack)
- **Requests**: Overseerr
- **Monitoring**: Tautulli
- **Utilities**: Mealie, Audiobookshelf, PhotoPrism
- **Infrastructure**: Docker, reverse proxy, Cloudflare tunnels

Is there something in that area I can help with?`

interface RequestBody {
    message: string
    currentAppId?: string
    history?: { role: 'user' | 'assistant'; content: string }[]
}

 const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

export const handler: Handler = async (event: HandlerEvent) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' }),
        }
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'OpenAI API key not configured. Set OPENAI_API_KEY in Netlify environment variables.',
            }),
        }
    }

    try {
        const body: RequestBody = JSON.parse(event.body || '{}')
        const { message, currentAppId, history = [] } = body

        if (!message || typeof message !== 'string') {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Message is required' }),
            }
        }

        // Topic guardrail: check if message is in scope
        if (!isInScope(message)) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    answer: OUT_OF_SCOPE_RESPONSE,
                    inScope: false,
                }),
            }
        }

        // Build messages array for OpenAI
        const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
            { role: 'system', content: SYSTEM_PROMPT },
        ]

        // Add conversation history (last 10 messages to keep context reasonable)
        const recentHistory = history.slice(-10)
        for (const msg of recentHistory) {
            messages.push({ role: msg.role, content: msg.content })
        }

        // Add context about current app if provided
        let userMessage = message
        if (currentAppId && ALLOWED_APPS.includes(currentAppId)) {
            userMessage = `[User is currently viewing the ${currentAppId} guide]\n\n${message}`
        }
        messages.push({ role: 'user', content: userMessage })

        // Call OpenAI
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                messages,
                max_tokens: 1000,
                temperature: 0.7,
            }),
        })

        if (!response.ok) {
            const errorData = await response.text()
            console.error('OpenAI API error:', errorData)
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Failed to get response from AI' }),
            }
        }

        const data = await response.json()
        const assistantMessage = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.'

        // Check if there's an action JSON at the end of the response
        let answer = assistantMessage
        let action = null

        // Try to parse various action formats
        // Format 1: switchApp - {"action":"switchApp","appId":"plex"}
        const switchMatch = assistantMessage.match(/\{"action":\s*"switchApp",\s*"appId":\s*"(\w+)"\}/)
        if (switchMatch) {
            action = { type: 'switchApp', appId: switchMatch[1] }
            answer = assistantMessage.replace(switchMatch[0], '').trim()
        }
        
        // Format 2: checklist - {"action":"checklist","items":["Step 1","Step 2"]}
        const checklistMatch = assistantMessage.match(/\{"action":\s*"checklist",\s*"items":\s*\[(.*?)\]\}/)
        if (checklistMatch && !action) {
            try {
                const itemsStr = `[${checklistMatch[1]}]`
                const items = JSON.parse(itemsStr)
                action = { type: 'checklist', items }
                answer = assistantMessage.replace(checklistMatch[0], '').trim()
            } catch (parseError) {
                console.warn('assistant function: failed to parse checklist items', parseError)
            }
        }
        
        // Format 3: showPort - {"action":"showPort","app":"plex","port":"32400"}
        const portMatch = assistantMessage.match(/\{"action":\s*"showPort",\s*"app":\s*"(\w+)",\s*"port":\s*"(\d+)"\}/)
        if (portMatch && !action) {
            action = { type: 'showPort', app: portMatch[1], port: portMatch[2] }
            answer = assistantMessage.replace(portMatch[0], '').trim()
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                answer,
                action,
                inScope: true,
            }),
        }
    } catch (error) {
        console.error('Assistant function error:', error)
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' }),
        }
    }
}
