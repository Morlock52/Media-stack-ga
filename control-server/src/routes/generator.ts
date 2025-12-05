import { FastifyInstance } from 'fastify';
import { readEnvFile } from '../utils/env.js';


// Helper to get key (duplicate from ai.ts to avoid refactor churn)
const getOpenAIKey = () => {
    if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
    const envContent = readEnvFile();
    const match = envContent.match(/^OPENAI_API_KEY=(.+)$/m);
    return match ? match[1].trim() : null;
};

export async function generatorRoutes(fastify: FastifyInstance) {
    fastify.post<{ Body: { url: string, openaiKey?: string } }>('/api/generator/analyze', async (request, reply) => {
        const { url, openaiKey } = request.body;
        const apiKey = openaiKey || getOpenAIKey();

        if (!apiKey) {
            return reply.status(400).send({ error: 'OpenAI API key is required. Please set it in Settings.' });
        }

        // 1. Parse GitHub URL
        let owner, repo;
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname !== 'github.com') throw new Error('Not a GitHub URL');
            const urlParts = urlObj.pathname.split('/').filter(Boolean);
            if (urlParts.length < 2) throw new Error('Invalid GitHub URL structure');
            owner = urlParts[0];
            repo = urlParts[1];
        } catch (e: any) {
            return reply.status(400).send({ error: e.message || 'Invalid GitHub URL provided.' });
        }

        // 2. Fetch README (Naive approach: try main, then master)
        const branches = ['main', 'master'];
        let readmeContent = '';

        for (const branch of branches) {
            try {
                const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`);
                if (response.ok) {
                    readmeContent = await response.text();
                    break;
                }
            } catch (e) { continue; }
        }

        // Fallback or Enriched Data: Fetch partial repo info for description
        if (!readmeContent) {
            try {
                const apiRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
                if (apiRes.ok) {
                    const data: any = await apiRes.json();
                    readmeContent = `Project: ${data.name}\nDescription: ${data.description}. (README could not be fetched directly).`;
                } else {
                    return reply.status(404).send({ error: 'Could not fetch repository content. Please check if the repo is public.' });
                }
            } catch (e) {
                return reply.status(404).send({ error: 'Could not connect to GitHub API.' });
            }
        }

        // 3. Prompt AI
        const systemPrompt = `You are a DevOps & Integration specialist.
Analyze the repository "${owner}/${repo}" to integrate it into a user's self-hosted media stack.

Generate a JSON object with these keys: "homepage", "docs", "compose", "iconName".

1. "homepage": YAML configuration block for 'gethomepage.dev'.
   - Use correct widgets/API integration if the app is supported.
   - Category: "My Apps".

2. "docs": Detailed Markdown setup guide.
   - Headers: "About", "Prerequisites", "Installation", "Configuration", "Tips".
   - Include specific env vars explained.
   - If README contains screenshot URLs (ending in png, jpg, webp), include them in the "About" section as Markdown images.

3. "compose": 'docker-compose.yml' service snippet.
   - Use \`\${DATA_ROOT}/...\` for volumes.
   - Use specific ports if standard.

4. "iconName": The single best 'Lucide React' icon name (PascalCase) that represents this app (e.g., "Film", "Database", "Shield", "Activity", "Box"). Do NOT return a generic name unless necessary.

Output JSON ONLY with keys: { "homepage": "...", "docs": "...", "compose": "...", "iconName": "..." }`;

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Repo: ${owner}/${repo}\n\nREADME:\n${readmeContent.substring(0, 10000)}` }
                    ],
                    max_tokens: 3000,
                    temperature: 0.4,
                    response_format: { type: "json_object" }
                })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`OpenAI Error: ${err}`);
            }

            const data: any = await response.json();
            const content = data.choices[0].message.content;
            return JSON.parse(content);

        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'AI Generation failed', details: error.message });
        }
    });
}
