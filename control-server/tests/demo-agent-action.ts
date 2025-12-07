
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const registryPath = path.join(PROJECT_ROOT, 'config', 'custom-apps.json');

// Mock specific logic from ai.ts for demonstration
async function mockAgentAction(action: string, appData: any = {}) {
    console.log(`\n🤖 Agent Action: ${action.toUpperCase()} ${appData.name || ''}...`);

    try {
        if (!fs.existsSync(registryPath)) {
            fs.mkdirSync(path.dirname(registryPath), { recursive: true });
            fs.writeFileSync(registryPath, '[]');
        }
        let registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8') || '[]');
        let result = '';

        if (action === 'list') {
            console.log("📂 Current Registry:", JSON.stringify(registry, null, 2));
            return;
        }

        if (action === 'add') {
            const safeId = (appData.id || appData.name || 'unknown').toLowerCase().replace(/[^a-z0-9-]/g, '-');
            const newApp = {
                id: safeId,
                name: appData.name || safeId,
                repo: appData.repo || '',
                description: appData.description || 'Added via Agent Demo',
                createdAt: new Date().toISOString(),
                ...appData
            };
            registry.push(newApp);
            result = `✅ Added app: ${newApp.name} (ID: ${safeId})`;
        }

        if (action === 'remove') {
            const initialLen = registry.length;
            registry = registry.filter((a: any) => a.id !== appData.id);
            if (registry.length === initialLen) {
                result = `⚠️ App not found: ${appData.id}`;
            } else {
                result = `🗑️ Removed app: ${appData.id}`;
            }
        }

        fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
        console.log(result);

    } catch (err: any) {
        console.error(`❌ Error: ${err.message}`);
    }
}

// Scenario
async function runDemo() {
    console.log("--- 🚀 Starting Agent Tool Demo ---");

    // 1. Clean slate
    if (fs.existsSync(registryPath)) fs.writeFileSync(registryPath, '[]');

    // 2. Agent adds an app
    await mockAgentAction('add', {
        name: 'Paperless-ngx',
        repo: 'https://github.com/paperless-ngx/paperless-ngx',
        description: 'Document management system'
    });

    // 3. Agent adds another
    await mockAgentAction('add', {
        name: 'Uptime Kuma',
        repo: 'https://github.com/louislam/uptime-kuma'
    });

    // 4. Agent lists apps
    await mockAgentAction('list');

    // 5. Agent removes one
    await mockAgentAction('remove', { id: 'uptime-kuma' });

    console.log("\n--- ✨ Demo Complete ---");
}

runDemo();
