import { AGENTS, detectAgent, buildAgentMessages, getFallbackResponse, getProactiveNudges } from '../agents.js';
import { readEnvFile, setEnvValue, removeEnvKey, PROJECT_ROOT } from '../utils/env.js';
import { runCommand } from '../utils/docker.js';
import fs from 'fs';
import path from 'path';
const getOpenAIKey = () => {
    if (process.env.OPENAI_API_KEY)
        return process.env.OPENAI_API_KEY;
    const envContent = readEnvFile();
    const match = envContent.match(/^OPENAI_API_KEY=(.+)$/m);
    return match ? match[1].trim() : null;
};
export async function aiRoutes(fastify) {
    // Get list of available agents
    fastify.get('/api/agents', async (request, reply) => {
        const agentList = Object.values(AGENTS).map((a) => ({
            id: a.id,
            name: a.name,
            icon: a.icon,
            color: a.color,
            description: a.description
        }));
        return { agents: agentList };
    });
    // Settings: OpenAI key management
    fastify.get('/api/settings/openai-key', async (request, reply) => {
        const key = getOpenAIKey();
        const hasKey = Boolean(key && key.length > 0);
        return { hasKey };
    });
    fastify.post('/api/settings/openai-key', async (request, reply) => {
        const { key, openaiKey } = request.body || {};
        const apiKey = key || openaiKey;
        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
            return reply.status(400).send({ error: 'OpenAI API key is required and must be at least 10 characters.' });
        }
        try {
            setEnvValue('OPENAI_API_KEY', apiKey.trim());
            process.env.OPENAI_API_KEY = apiKey.trim();
            return { success: true };
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Failed to save OpenAI key');
            reply.status(500).send({ error: 'Failed to save OpenAI key' });
        }
    });
    fastify.delete('/api/settings/openai-key', async (request, reply) => {
        try {
            removeEnvKey('OPENAI_API_KEY');
            delete process.env.OPENAI_API_KEY;
            return { success: true };
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Failed to remove OpenAI key');
            reply.status(500).send({ error: 'Failed to remove OpenAI key' });
        }
    });
    // Main agent chat endpoint
    fastify.post('/api/agent/chat', async (request, reply) => {
        const { message, agentId, history = [], context = {}, openaiKey } = request.body;
        const effectiveApiKey = openaiKey || getOpenAIKey();
        if (!message) {
            return reply.status(400).send({ error: 'Message is required' });
        }
        let agent = agentId ? AGENTS[agentId] : undefined;
        if (!agent) {
            agent = detectAgent(message);
        }
        const nudges = getProactiveNudges(context);
        if (effectiveApiKey) {
            try {
                const messages = buildAgentMessages(agent, message, history, context);
                const tools = [
                    {
                        type: "function",
                        function: {
                            name: "run_command",
                            description: "Run a shell command on the user's machine. Use this to check logs, list files, or check docker status. Do NOT run dangerous commands like rm -rf.",
                            parameters: {
                                type: "object",
                                properties: {
                                    command: {
                                        type: "string",
                                        description: "The command to run (e.g. 'docker ps', 'ls -la', 'cat .env')"
                                    }
                                },
                                required: ["command"]
                            }
                        }
                    },
                    {
                        type: "function",
                        function: {
                            name: "analyze_logs",
                            description: "Fetch logs from a service for analysis",
                            parameters: {
                                type: "object",
                                properties: {
                                    serviceName: {
                                        type: "string",
                                        description: "The name of the service (e.g. 'sonarr', 'radarr', 'authelia')"
                                    },
                                    lines: {
                                        type: "integer",
                                        description: "Number of lines to fetch (default 50)"
                                    }
                                },
                                required: ["serviceName"]
                            }
                        }
                    },
                    {
                        type: "function",
                        function: {
                            name: "validate_config",
                            description: "Check a configuration file for syntax errors",
                            parameters: {
                                type: "object",
                                properties: {
                                    filePath: {
                                        type: "string",
                                        description: "Path to the config file (relative to project root)"
                                    },
                                    type: {
                                        type: "string",
                                        enum: ["yaml", "json", "env"],
                                        description: "Type of file to validate"
                                    }
                                },
                                required: ["filePath", "type"]
                            }
                        }
                    }
                ];
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${effectiveApiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o',
                        messages,
                        tools,
                        tool_choice: "auto",
                        max_tokens: 1000,
                        temperature: 0.7
                    })
                });
                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`OpenAI API error (${response.status}): ${errText}`);
                }
                const data = await response.json();
                const choice = data.choices?.[0];
                const messageData = choice?.message;
                let answer = messageData?.content;
                let toolUsed = null;
                if (messageData?.tool_calls?.length > 0) {
                    const toolCall = messageData.tool_calls[0];
                    if (toolCall.function.name === 'run_command') {
                        const args = JSON.parse(toolCall.function.arguments);
                        const command = args.command;
                        fastify.log.info({ command }, 'AI executing tool command');
                        toolUsed = { command };
                        try {
                            if (command.includes('rm ') || command.includes('mv ') || command.includes('>')) {
                                throw new Error('Command blocked for security');
                            }
                            const output = await runCommand(command.split(' ')[0], command.split(' ').slice(1));
                            messages.push(messageData);
                            messages.push({
                                role: "tool",
                                tool_call_id: toolCall.id,
                                content: output || "(No output)"
                            });
                            const secondResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${effectiveApiKey}`
                                },
                                body: JSON.stringify({
                                    model: 'gpt-4o',
                                    messages,
                                    max_tokens: 1000,
                                    temperature: 0.7
                                })
                            });
                            const secondData = await secondResponse.json();
                            answer = secondData.choices?.[0]?.message?.content;
                        }
                        catch (err) {
                            answer = `I tried to run \`${command}\` but it failed: ${err.message}`;
                        }
                    }
                    else if (toolCall.function.name === 'analyze_logs') {
                        const args = JSON.parse(toolCall.function.arguments);
                        const service = args.serviceName;
                        const lines = args.lines || 50;
                        const command = `docker logs --tail ${lines} ${service}`;
                        fastify.log.info({ service, lines }, 'AI analyzing logs');
                        toolUsed = { command, type: 'logs' };
                        try {
                            const output = await runCommand('docker', ['logs', '--tail', lines.toString(), service]);
                            messages.push(messageData);
                            messages.push({
                                role: "tool",
                                tool_call_id: toolCall.id,
                                content: output || "(No logs found)"
                            });
                            const secondResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${effectiveApiKey}`
                                },
                                body: JSON.stringify({
                                    model: 'gpt-4o',
                                    messages,
                                    max_tokens: 1000,
                                    temperature: 0.7
                                })
                            });
                            const secondData = await secondResponse.json();
                            answer = secondData.choices?.[0]?.message?.content;
                        }
                        catch (err) {
                            answer = `I tried to check logs for ${service} but failed: ${err.message}`;
                        }
                    }
                    else if (toolCall.function.name === 'validate_config') {
                        const args = JSON.parse(toolCall.function.arguments);
                        const filePath = path.join(PROJECT_ROOT, args.filePath);
                        const type = args.type;
                        fastify.log.info({ filePath, type }, 'AI validating config');
                        toolUsed = { command: `validate ${args.filePath}`, type: 'validation' };
                        try {
                            if (!fs.existsSync(filePath)) {
                                throw new Error(`File not found: ${args.filePath}`);
                            }
                            const content = fs.readFileSync(filePath, 'utf-8');
                            let result = "Valid";
                            if (type === 'json') {
                                JSON.parse(content);
                                result = "✅ JSON Syntax Valid";
                            }
                            else if (type === 'yaml') {
                                if (content.includes(':')) {
                                    result = "✅ YAML Structure seems okay (basic check)";
                                }
                                else {
                                    result = "⚠️ YAML might be invalid (no key-value pairs found)";
                                }
                            }
                            else if (type === 'env') {
                                if (content.includes('=')) {
                                    result = "✅ .env format seems valid";
                                }
                                else {
                                    result = "⚠️ .env might be invalid (no KEY=VALUE pairs found)";
                                }
                            }
                            messages.push(messageData);
                            messages.push({
                                role: "tool",
                                tool_call_id: toolCall.id,
                                content: result
                            });
                            const secondResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${effectiveApiKey}`
                                },
                                body: JSON.stringify({
                                    model: 'gpt-4o',
                                    messages,
                                    max_tokens: 1000,
                                    temperature: 0.7
                                })
                            });
                            const secondData = await secondResponse.json();
                            answer = secondData.choices?.[0]?.message?.content;
                        }
                        catch (err) {
                            answer = `Validation failed for ${args.filePath}: ${err.message}`;
                        }
                    }
                }
                return {
                    answer: answer || 'Sorry, I could not generate a response.',
                    agent: { id: agent.id, name: agent.name, icon: agent.icon },
                    nudges,
                    aiPowered: true,
                    toolUsed
                };
            }
            catch (error) {
                fastify.log.error({ err: error, agent: agent?.id }, '[agent/chat] OpenAI error, falling back to canned response');
            }
        }
        const answer = getFallbackResponse(agent.id, message);
        return {
            answer,
            agent: { id: agent.id, name: agent.name, icon: agent.icon },
            nudges,
            aiPowered: false
        };
    });
    // Voice companion endpoint
    fastify.post('/api/voice-agent', async (request, reply) => {
        const { transcript, history = [] } = request.body || {};
        const effectiveApiKey = getOpenAIKey();
        if (!transcript || typeof transcript !== 'string') {
            return reply.status(400).send({ error: 'Transcript text is required' });
        }
        if (!effectiveApiKey) {
            return reply.status(400).send({ error: 'OpenAI key not configured. Add one in settings.' });
        }
        try {
            const prompt = `You are a friendly, casual voice companion for the Media Stack Maker wizard.
Think of yourself as a tech-savvy friend helping a newbie set up their home server.

INSTRUCTIONS:
1. **Persona**: Speak naturally, use contractions ("can't", "let's"), and be enthusiastic.
2. **Brevity**: Keep spoken responses SHORT (under 2 sentences).
3. **No Reading**: NEVER read the JSON or technical lists aloud.
4. **Goal**: Gather: [Services (apps), Hosting (hardware), Domain].
5. **The Plan**: Once you have the 3 key requirements, say "I've got a plan ready!" and THEN append the JSON block.

OUTPUT COMPOSITION:
[Conversational Response to User]
[JSON Plan Object]

Plan JSON Schema:
{
  "services": ["plex", "arr", "torrent", ...],
  "hosting": "nas" | "vps" | "pi" | "desktop" | "cloud",
  "storagePaths": { "media": "/path", "downloads": "/path" },
  "domain": "example.com",
  "notes": "string"
}

Current context:
${history.map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`).join('\n')}

User: ${transcript}`;
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${effectiveApiKey}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'system', content: prompt },
                    ],
                    max_tokens: 800,
                    temperature: 0.4,
                }),
            });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`OpenAI voice agent error (${response.status})`);
            }
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || 'Let me know more about your setup goals!';
            // Robust regex to find the JSON block (last occurrence of {...})
            const planMatch = content.match(/(\{[\s\S]*\})/);
            let plan = null;
            if (planMatch) {
                try {
                    // If matched, it might still have markdown inside if the regex captured too much, but usually greedy match from first { to last } works for single block
                    // Safety: try parsing the match
                    plan = JSON.parse(planMatch[0]);
                }
                catch (err) {
                    fastify.log.warn({ err, match: planMatch[0] }, 'Failed to parse plan JSON from voice agent');
                }
            }
            // Remove the plan from the spoken response
            const cleanedResponse = planMatch ? content.replace(planMatch[0], '').replace(/```json/g, '').replace(/```/g, '').trim() : content;
            return {
                agentResponse: cleanedResponse,
                plan,
            };
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Voice agent error');
            reply.status(500).send({ error: 'Voice agent failed', details: error.message });
        }
    });
    // Get contextual suggestions
    fastify.post('/api/agent/suggestions', async (request, reply) => {
        const { currentApp, userProgress } = request.body;
        const suggestions = [];
        const appSuggestions = {
            plex: ['How do I add libraries?', 'Enable remote access', 'Set up users'],
            jellyfin: ['Create admin user', 'Add media libraries', 'Configure transcoding'],
            sonarr: ['Connect to Prowlarr', 'Add download client', 'Set quality profiles'],
            radarr: ['Connect to Prowlarr', 'Add download client', 'Configure lists'],
            prowlarr: ['Add indexers', 'Sync with Sonarr/Radarr', 'Test connections'],
            overseerr: ['Connect to Plex', 'Set up users', 'Configure notifications'],
            qbittorrent: ['Change default password', 'Set download path', 'Configure VPN'],
        };
        if (currentApp && appSuggestions[currentApp]) {
            suggestions.push(...appSuggestions[currentApp].map((s) => ({
                text: s,
                agent: 'apps'
            })));
        }
        if (!userProgress?.dockerInstalled) {
            suggestions.unshift({ text: 'How do I install Docker?', agent: 'setup' });
        }
        return { suggestions: suggestions.slice(0, 5) };
    });
    // Audio Transcription (Whisper API Fallback)
    fastify.post('/api/audio-transcription', async (request, reply) => {
        const data = await request.file();
        if (!data) {
            return reply.status(400).send({ error: 'No audio file uploaded' });
        }
        const effectiveApiKey = getOpenAIKey();
        if (!effectiveApiKey) {
            return reply.status(400).send({ error: 'OpenAI key not configured' });
        }
        const tempPath = path.join(PROJECT_ROOT, `temp_audio_${Date.now()}.webm`);
        try {
            await fs.promises.writeFile(tempPath, await data.toBuffer());
            const formData = new FormData();
            const fileBlob = new Blob([await fs.promises.readFile(tempPath)], { type: 'audio/webm' });
            formData.append('file', fileBlob, 'audio.webm');
            formData.append('model', 'whisper-1');
            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${effectiveApiKey}`
                },
                body: formData
            });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`OpenAI Whisper error (${response.status}): ${errText}`);
            }
            const result = await response.json();
            await fs.promises.unlink(tempPath).catch(() => { });
            return { text: result.text };
        }
        catch (error) {
            await fs.promises.unlink(tempPath).catch(() => { });
            fastify.log.error({ err: error }, 'Whisper transcription failed');
            return reply.status(500).send({ error: error.message });
        }
    });
}
