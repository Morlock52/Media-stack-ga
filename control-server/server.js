import express from 'express';
import cors from 'cors';
import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { NodeSSH } from 'node-ssh';
import dotenv from 'dotenv';
import pino from 'pino';
import { AGENTS, detectAgent, buildAgentMessages, getFallbackResponse, getProactiveNudges } from './agents.js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = 3001;
const PROJECT_ROOT = path.join(__dirname, '..'); // Assuming server is in /control-server/
const COMPOSE_FILE = path.join(PROJECT_ROOT, 'docker-compose.yml');
const ENV_FILE_PATH = path.join(PROJECT_ROOT, '.env');

const app = express();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        logger.info({
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            durationMs: Date.now() - start
        }, 'http request');
    });
    next();
});

// -------------------------------------------------------
// Helper Functions
// -------------------------------------------------------

// Execute a shell command and return promise
const runCommand = (command, args, cwd = PROJECT_ROOT) => {
    return new Promise((resolve, reject) => {
        logger.info({ command, args, cwd }, 'executing shell command');

        const process = spawn(command, args, { cwd });
        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve(stdout.trim());
            } else {
                logger.error({ command, args, code, stderr }, 'command failed');
                reject(new Error(stderr || stdout));
            }
        });
    });
};

// -------------------------------------------------------
// Environment helpers
// -------------------------------------------------------

const readEnvFile = () => {
    if (!fs.existsSync(ENV_FILE_PATH)) return '';
    return fs.readFileSync(ENV_FILE_PATH, 'utf-8');
};

const writeEnvFile = (content) => {
    fs.writeFileSync(ENV_FILE_PATH, content.replace(/\r\n/g, '\n'));
};

const setEnvValue = (key, value) => {
    const trimmed = value.trim();
    const lines = readEnvFile().split(/\n/).filter((line) => line.length > 0);
    let updated = false;
    const newLines = lines.map((line) => {
        if (line.startsWith(`${key}=`)) {
            updated = true;
            return `${key}=${trimmed}`;
        }
        return line;
    });
    if (!updated) newLines.push(`${key}=${trimmed}`);
    writeEnvFile(newLines.join('\n') + '\n');
};

const removeEnvKey = (key) => {
    if (!fs.existsSync(ENV_FILE_PATH)) return;
    const lines = readEnvFile()
        .split(/\n/)
        .filter((line) => line.length > 0 && !line.startsWith(`${key}=`));
    writeEnvFile(lines.join('\n') + (lines.length ? '\n' : ''));
};

// Basic guard to prevent remote-command injection via deployPath
const sanitizeRemotePath = (input) => {
    const fallbackPath = '~/media-stack';
    const candidate = typeof input === 'string' && input.trim().length ? input.trim() : fallbackPath;
    if (!/^[-@./A-Za-z0-9_~]+$/.test(candidate)) {
        throw new Error('Invalid deploy path. Use only letters, numbers, dashes, dots, slashes, underscores, and ~');
    }
    return candidate;
};

// -------------------------------------------------------
// Routes
// -------------------------------------------------------

// 1. Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'online', version: '1.0.0' });
});

// 2. Get Container Status
app.get('/api/containers', async (req, res) => {
    try {
        // Format: ID, Name, Status, State, Ports
        const output = await runCommand('docker', [
            'ps',
            '-a',
            '--format',
            '"{{.ID}}|{{.Names}}|{{.Status}}|{{.State}}|{{.Ports}}"'
        ]);

        const containers = output.split('\n').filter(line => line).map(line => {
            const [id, name, status, state, ports] = line.replace(/"/g, '').split('|');
            return { id, name, status, state, ports };
        });

        res.json(containers);
    } catch (error) {
        console.error('Error fetching containers:', error);
        res.status(500).json({ error: 'Failed to fetch container status' });
    }
});

// 3. Start/Stop/Restart a Service
app.post('/api/service/:action', async (req, res) => {
    const { action } = req.params; // start, stop, restart
    const { serviceName } = req.body;

    if (!['start', 'stop', 'restart', 'up'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
    }

    try {
        let cmdArgs = [];
        if (action === 'up') {
            // special case for "installing" / first run
            cmdArgs = ['compose', 'up', '-d', serviceName];
        } else if (action === 'start') {
            cmdArgs = ['compose', 'start', serviceName];
        } else if (action === 'stop') {
            cmdArgs = ['compose', 'stop', serviceName];
        } else if (action === 'restart') {
            cmdArgs = ['compose', 'restart', serviceName];
        }

        await runCommand('docker', cmdArgs);
        res.json({ success: true, message: `Service ${serviceName} ${action}ed successfully` });
    } catch (error) {
        console.error(`Error performing ${action} on ${serviceName}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// 4. Run Updates
app.post('/api/system/update', async (req, res) => {
    try {
        // Pull latest images
        await runCommand('docker', ['compose', 'pull']);
        // Recreate containers
        await runCommand('docker', ['compose', 'up', '-d', '--remove-orphans']);
        // Prune
        await runCommand('docker', ['image', 'prune', '-f']);

        res.json({ success: true, message: 'System updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Control Server started');
    logger.info({ projectRoot: PROJECT_ROOT }, 'Managing project root');
});

// -------------------------------------------------------
// Multi-Agent AI System
// -------------------------------------------------------

// Get list of available agents
app.get('/api/agents', (req, res) => {
    const agentList = Object.values(AGENTS).map(a => ({
        id: a.id,
        name: a.name,
        icon: a.icon,
        color: a.color,
        description: a.description
    }));
    res.json({ agents: agentList });
});

// Main agent chat endpoint
// Helper to get current OpenAI key (checks both env and .env file dynamically)
const getOpenAIKey = () => {
    // First check process.env (may have been updated at runtime)
    if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
    // Otherwise try to read from .env file directly
    const envContent = readEnvFile();
    const match = envContent.match(/^OPENAI_API_KEY=(.+)$/m);
    return match ? match[1].trim() : null;
};

// Settings: OpenAI key management
app.get('/api/settings/openai-key', (req, res) => {
    const key = getOpenAIKey();
    const hasKey = Boolean(key && key.length > 0);
    res.json({ hasKey });
});

app.post('/api/settings/openai-key', (req, res) => {
    // Accept both 'key' and 'openaiKey' field names
    const { key, openaiKey } = req.body || {};
    const apiKey = key || openaiKey;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
        return res.status(400).json({ error: 'OpenAI API key is required and must be at least 10 characters.' });
    }

    try {
        setEnvValue('OPENAI_API_KEY', apiKey.trim());
        process.env.OPENAI_API_KEY = apiKey.trim();
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to save OpenAI key:', error);
        res.status(500).json({ error: 'Failed to save OpenAI key' });
    }
});

app.delete('/api/settings/openai-key', (req, res) => {
    try {
        removeEnvKey('OPENAI_API_KEY');
        delete process.env.OPENAI_API_KEY;
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to remove OpenAI key:', error);
        res.status(500).json({ error: 'Failed to remove OpenAI key' });
    }
});

app.post('/api/agent/chat', async (req, res) => {
    const { message, agentId, history = [], context = {}, openaiKey } = req.body;
    const effectiveApiKey = openaiKey || getOpenAIKey();

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    // Auto-detect agent if not specified or invalid
    let agent = agentId ? AGENTS[agentId] : undefined;
    if (!agent) {
        agent = detectAgent(message);
    }

    // Check for proactive nudges
    const nudges = getProactiveNudges(context);

    // If OpenAI key provided, use AI
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
                console.error('[agent/chat] OpenAI API error', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errText?.slice(0, 500)
                });
                throw new Error(`OpenAI API error (${response.status})`);
            }

            const data = await response.json();
            const choice = data.choices?.[0];
            const messageData = choice?.message;

            let answer = messageData?.content;
            let toolUsed = null;

            // Handle tool calls
            if (messageData?.tool_calls?.length > 0) {
                const toolCall = messageData.tool_calls[0];
                if (toolCall.function.name === 'run_command') {
                    const args = JSON.parse(toolCall.function.arguments);
                    const command = args.command;

                    logger.info({ command }, 'AI executing tool command');
                    toolUsed = { command };

                    try {
                        // Execute command
                        // Security check: simple block list
                        if (command.includes('rm ') || command.includes('mv ') || command.includes('>')) {
                            throw new Error('Command blocked for security');
                        }

                        const output = await new Promise((resolve, reject) => {
                            exec(command, { cwd: PROJECT_ROOT }, (error, stdout, stderr) => {
                                if (error) {
                                    reject(new Error(stderr || stdout || error.message));
                                } else {
                                    resolve(stdout.trim());
                                }
                            });
                        });

                        // Append tool result to messages
                        messages.push(messageData);
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: output || "(No output)"
                        });

                        // Get final response
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

                    } catch (err) {
                        answer = `I tried to run \`${command}\` but it failed: ${err.message}`;
                    }
                } else if (toolCall.function.name === 'analyze_logs') {
                    const args = JSON.parse(toolCall.function.arguments);
                    const service = args.serviceName;
                    const lines = args.lines || 50;
                    const command = `docker logs --tail ${lines} ${service}`;

                    logger.info({ service, lines }, 'AI analyzing logs');
                    toolUsed = { command, type: 'logs' };

                    try {
                        const output = await new Promise((resolve, reject) => {
                            exec(command, { cwd: PROJECT_ROOT }, (error, stdout, stderr) => {
                                if (error) {
                                    // Docker logs often go to stderr, so we check both
                                    resolve(stderr || stdout || error.message);
                                } else {
                                    resolve(stdout || stderr);
                                }
                            });
                        });

                        messages.push(messageData);
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: output || "(No logs found)"
                        });

                        // Get final response
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

                    } catch (err) {
                        answer = `I tried to check logs for ${service} but failed: ${err.message}`;
                    }
                } else if (toolCall.function.name === 'validate_config') {
                    const args = JSON.parse(toolCall.function.arguments);
                    const filePath = path.join(PROJECT_ROOT, args.filePath);
                    const type = args.type;

                    logger.info({ filePath, type }, 'AI validating config');
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
                        } else if (type === 'yaml') {
                            // Basic YAML check (we might not have a parser loaded, so we'll just check for basic structure or use a simple heuristic if no library)
                            // Ideally we'd use js-yaml, but let's assume we can just read it for now or check for common errors
                            if (content.includes(':')) {
                                result = "✅ YAML Structure seems okay (basic check)";
                            } else {
                                result = "⚠️ YAML might be invalid (no key-value pairs found)";
                            }
                        } else if (type === 'env') {
                            if (content.includes('=')) {
                                result = "✅ .env format seems valid";
                            } else {
                                result = "⚠️ .env might be invalid (no KEY=VALUE pairs found)";
                            }
                        }

                        messages.push(messageData);
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: result
                        });

                        // Get final response
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

                    } catch (err) {
                        answer = `Validation failed for ${args.filePath}: ${err.message}`;
                    }
                }
            }

            return res.json({
                answer: answer || 'Sorry, I could not generate a response.',
                agent: { id: agent.id, name: agent.name, icon: agent.icon },
                nudges,
                aiPowered: true,
                toolUsed
            });
        } catch (error) {
            logger.error({ err: error, agent: agent?.id }, '[agent/chat] OpenAI error, falling back to canned response');
            // Fall through to fallback
        }
    }

    // Fallback response (no API key or API error)
    const answer = getFallbackResponse(agent.id, message);

    res.json({
        answer,
        agent: { id: agent.id, name: agent.name, icon: agent.icon },
        nudges,
        aiPowered: false
    });
});

// Voice companion endpoint (text-based for now)
app.post('/api/voice-agent', async (req, res) => {
    const { transcript, history = [] } = req.body || {};
    const effectiveApiKey = getOpenAIKey();

    if (!transcript || typeof transcript !== 'string') {
        return res.status(400).json({ error: 'Transcript text is required' });
    }

    if (!effectiveApiKey) {
        return res.status(400).json({ error: 'OpenAI key not configured. Add one in settings.' });
    }

    try {
        const prompt = `You are a voice onboarding companion for the Media Stack Maker wizard.
Gather requirements from beginners and respond in short, friendly sentences.
After each reply, emit a JSON object with the current structured plan.
Plan schema:
{
  "services": ["plex", "arr", "torrent", "vpn", "notify", "stats", "overseerr", "tautulli", "mealie", "audiobookshelf", "photoprism"],
  "hosting": "nas | vps | raspberry pi | desktop | cloud",
  "storagePaths": { "media": "/path", "downloads": "/path" },
  "domain": "example.com",
  "notes": "string"
}
Always include the JSON block as the last paragraph.
Current conversation history:
${history.map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`).join('\n')}

Latest user utterance: ${transcript}`;

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
            logger.error({
                status: response.status,
                statusText: response.statusText,
                body: errText?.slice(0, 500)
            }, '[voice-agent] OpenAI API error');
            throw new Error(`OpenAI voice agent error (${response.status})`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || 'Let me know more about your setup goals!';

        const planMatch = content.match(/\{[\s\S]*\}$/);
        let plan = null;
        if (planMatch) {
            try {
                plan = JSON.parse(planMatch[0]);
            } catch (err) {
                logger.warn({ err }, 'Failed to parse plan JSON from voice agent');
            }
        }

        const cleanedResponse = planMatch ? content.replace(planMatch[0], '').trim() : content;

        res.json({
            agentResponse: cleanedResponse,
            plan,
        });
    } catch (error) {
        logger.error({ err: error }, 'Voice agent error');
        res.status(500).json({ error: 'Voice agent failed', details: error.message });
    }
});

// Health snapshot - AI-generated summary of system status
app.get('/api/health-snapshot', async (req, res) => {
    try {
        const output = await runCommand('docker', [
            'ps', '-a', '--format', '"{{.Names}}|{{.Status}}|{{.State}}"'
        ]);

        const containers = output.split('\n').filter(l => l).map(line => {
            const [name, status, state] = line.replace(/"/g, '').split('|');
            return { name, status, state };
        });

        const stopped = containers.filter(c => c.state !== 'running');
        const unhealthy = containers.filter(c => c.status?.includes('unhealthy'));
        const restarting = containers.filter(c => c.state === 'restarting');

        const issues = [];
        stopped.forEach(c => issues.push({ type: 'stopped', service: c.name, message: `${c.name} is stopped` }));
        unhealthy.forEach(c => issues.push({ type: 'unhealthy', service: c.name, message: `${c.name} is unhealthy` }));
        restarting.forEach(c => issues.push({ type: 'restarting', service: c.name, message: `${c.name} is restart-looping` }));

        const suggestions = issues.slice(0, 3).map(issue => {
            if (issue.type === 'stopped') {
                return { action: 'start', service: issue.service, label: `Start ${issue.service}` };
            }
            if (issue.type === 'restarting') {
                return { action: 'logs', service: issue.service, label: `Check ${issue.service} logs` };
            }
            return { action: 'restart', service: issue.service, label: `Restart ${issue.service}` };
        });

        let summary = '';
        if (issues.length === 0) {
            summary = 'All services healthy ✅';
        } else if (issues.length === 1) {
            summary = `1 issue detected: ${issues[0].message}`;
        } else {
            summary = `${issues.length} issues detected`;
        }

        res.json({
            healthy: issues.length === 0,
            summary,
            issues,
            suggestions,
            containerCount: containers.length,
            runningCount: containers.filter(c => c.state === 'running').length
        });
    } catch (error) {
        logger.error({ err: error }, '[health-snapshot] Failed to gather docker status');
        res.status(500).json({
            healthy: false,
            summary: 'Unable to fetch container status',
            issues: [],
            suggestions: [],
            containerCount: 0,
            runningCount: 0,
            error: error?.message || 'unknown'
        });
    }
});

// Get contextual suggestions for current app/page
app.post('/api/agent/suggestions', (req, res) => {
    const { currentApp, userProgress } = req.body;

    const suggestions = [];

    // App-specific suggestions
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
        suggestions.push(...appSuggestions[currentApp].map(s => ({
            text: s,
            agent: 'apps'
        })));
    }

    // Progress-based suggestions
    if (!userProgress?.dockerInstalled) {
        suggestions.unshift({ text: 'How do I install Docker?', agent: 'setup' });
    }

    res.json({ suggestions: suggestions.slice(0, 5) });
});

// -------------------------------------------------------
// Remote Deploy via SSH
// -------------------------------------------------------
app.post('/api/remote-deploy', async (req, res) => {
    const { host, port = 22, username, authType, password, privateKey, deployPath = '~/media-stack' } = req.body;

    if (!host || !username) {
        return res.status(400).json({ error: 'Host and username are required' });
    }

    let safeDeployPath;
    try {
        safeDeployPath = sanitizeRemotePath(deployPath);
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }

    const ssh = new NodeSSH();
    const steps = [];

    try {
        // Step 1: Connect
        steps.push({ step: 'Connecting to server...', status: 'running' });

        const connectConfig = {
            host,
            port: parseInt(port),
            username,
        };

        if (authType === 'password') {
            connectConfig.password = password;
        } else {
            connectConfig.privateKey = privateKey;
        }

        await ssh.connect(connectConfig);
        steps[steps.length - 1].status = 'done';

        // Step 2: Create deploy directory
        steps.push({ step: 'Creating deploy directory...', status: 'running' });
        await ssh.execCommand(`mkdir -p ${safeDeployPath}`);
        steps[steps.length - 1].status = 'done';

        // Step 3: Upload docker-compose.yml
        steps.push({ step: 'Uploading docker-compose.yml...', status: 'running' });
        await ssh.putFile(COMPOSE_FILE, `${safeDeployPath}/docker-compose.yml`);
        steps[steps.length - 1].status = 'done';

        // Step 4: Upload .env if exists
        const envFile = path.join(PROJECT_ROOT, '.env');
        if (fs.existsSync(envFile)) {
            steps.push({ step: 'Uploading .env...', status: 'running' });
            await ssh.putFile(envFile, `${safeDeployPath}/.env`);
            steps[steps.length - 1].status = 'done';
        }

        // Step 5: Check Docker is installed
        steps.push({ step: 'Checking Docker installation...', status: 'running' });
        const dockerCheck = await ssh.execCommand('docker --version');
        if (dockerCheck.code !== 0) {
            throw new Error('Docker is not installed on the remote server');
        }
        steps[steps.length - 1].status = 'done';

        // Step 6: Start the stack
        steps.push({ step: 'Starting media stack...', status: 'running' });
        const startResult = await ssh.execCommand(`cd ${safeDeployPath} && docker compose up -d`);
        if (startResult.code !== 0 && startResult.stderr && !startResult.stderr.includes('Warning')) {
            throw new Error(startResult.stderr);
        }
        steps[steps.length - 1].status = 'done';

        ssh.dispose();

        res.json({
            success: true,
            message: 'Deployment successful!',
            steps,
            serverInfo: { host, deployPath: safeDeployPath }
        });

    } catch (error) {
        ssh.dispose();
        steps[steps.length - 1].status = 'error';
        logger.error({ err: error, host, username }, '[remote-deploy] failed');
        res.status(500).json({
            success: false,
            error: error.message,
            steps
        });
    }
});

// Test SSH connection (doesn't deploy, just validates credentials)
app.post('/api/remote-deploy/test', async (req, res) => {
    const { host, port = 22, username, authType, password, privateKey } = req.body;

    const ssh = new NodeSSH();

    try {
        const connectConfig = {
            host,
            port: parseInt(port),
            username,
        };

        if (authType === 'password') {
            connectConfig.password = password;
        } else {
            connectConfig.privateKey = privateKey;
        }

        await ssh.connect(connectConfig);

        // Quick checks
        const dockerCheck = await ssh.execCommand('docker --version');
        const composeCheck = await ssh.execCommand('docker compose version');

        ssh.dispose();

        res.json({
            success: true,
            docker: dockerCheck.code === 0,
            dockerCompose: composeCheck.code === 0,
            message: dockerCheck.code === 0 ? 'Ready to deploy!' : 'Docker not found on server'
        });

    } catch (error) {
        ssh.dispose();
        logger.error({ err: error, host, username }, '[remote-deploy/test] failed');
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
