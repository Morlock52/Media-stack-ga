import { GitHubMetadata } from '../utils/github.js';
import { AppRegistryItem } from './registryService.js';
import { createDoc } from './docService.js';
import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from '../utils/env.js';

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

const getOpenAIKey = () => {
    return process.env.OPENAI_API_KEY || null;
};

export const generateAppFromGitHub = async (metadata: GitHubMetadata): Promise<{ app: AppRegistryItem; docContent: string }> => {
    const apiKey = getOpenAIKey();
    if (!apiKey) {
        throw new Error('OpenAI API key missing');
    }

    const prompt = `You are an expert technical writer and React developer.
You are generating a documentation component for a new app in a Media Stack.

App Metadata:
- Name: ${metadata.name}
- Description: ${metadata.description}
- Topics: ${metadata.topics?.join(', ')}
- Stats: ${metadata.stars} stars

README Content (truncated):
${metadata.readme?.slice(0, 5000)}

Please generate:
1. A JSON object with app registry details:
{
  "id": "slugified-id",
  "name": "Human Name",
  "description": "Short 1-sentence description",
  "category": "Media|Automation|Download|Monitoring|Security|Utility",
  "icon": "LucideIconName (must be one of: Film, Tv, Activity, Search, Download, Shield, Home, Container, FileVideo, Bell, Languages, ShieldCheck, Layers, Utensils, BookOpen, Camera, Cloud, Terminal, Bug, Database, RefreshCw)",
  "difficulty": "Easy|Medium|Advanced",
  "time": "Estimated setup time"
}

2. A full React component content (TSX) for the guide. It MUST use the following structure and imports:

import { AppGuideLayout } from '../AppGuideLayout'
import { Terminal, ExternalLink, Shield, Info } from 'lucide-react'

export function ${metadata.name.replace(/[^a-zA-Z0-9]/g, '')}Guide() {
    return (
        <AppGuideLayout
            appId="slugified-id"
            title="${metadata.name} Setup"
            description="${metadata.description}"
        >
            {/* ... Content sections following the PlexGuide style ... */}
            <section id="overview" className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <Info className="w-5 h-5 text-purple-400" />
                    Overview
                </h2>
                <p className="text-muted-foreground">...</p>
            </section>
            
            <section id="setup" className="space-y-4">
                 <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-purple-400" />
                    Docker Setup
                </h2>
                {/* Include a docker-compose snippet if possible based on the README */}
            </section>
        </AppGuideLayout>
    )
}

Return the response in this format:
---JSON---
{ "registry": { ... }, "doc": "... full TSX content ..." }
---END---`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            messages: [
                { role: 'system', content: 'You are a helpful assistant that generates Media Stack documentation.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7
        })
    });

    if (!response.ok) {
        throw new Error(`AI generation failed: ${response.statusText}`);
    }

    const data: any = await response.json();
    const content = data.choices[0].message.content;

    const jsonMatch = content.match(/---JSON---\n([\s\S]+?)\n---END---/);
    if (!jsonMatch) {
        throw new Error('AI response format invalid');
    }

    const parsed = JSON.parse(jsonMatch[1]);
    const app: AppRegistryItem = {
        ...parsed.registry,
        repoUrl: `https://github.com/${metadata.owner}/${metadata.repo}`,
        guideComponent: `${metadata.name.replace(/[^a-zA-Z0-9]/g, '')}Guide`
    };

    return { app, docContent: parsed.doc };
};

export const registerAndExportApp = async (app: AppRegistryItem, docContent: string) => {
    // 1. Save the doc component
    createDoc(app.guideComponent!, docContent);

    // 2. Update index.ts exports
    const indexPath = path.join(PROJECT_ROOT, 'docs-site/src/components/docs/index.ts');
    let indexContent = fs.readFileSync(indexPath, 'utf-8');
    const exportLine = `export { ${app.guideComponent} } from './${app.guideComponent}'\n`;
    if (!indexContent.includes(app.guideComponent!)) {
        indexContent += exportLine;
        fs.writeFileSync(indexPath, indexContent);
    }
};
