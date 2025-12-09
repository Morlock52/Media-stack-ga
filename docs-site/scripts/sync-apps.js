
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const REGISTRY_PATH = path.join(__dirname, '../src/data/apps-registry.json');
const CUSTOM_APPS_PATH = path.join(__dirname, '../../config/custom-apps.json');
const SERVICES_PATH = path.join(__dirname, '../src/data/services.ts');
const APPDATA_PATH = path.join(__dirname, '../src/components/docs/appData.ts');
const DOCS_INDEX_PATH = path.join(__dirname, '../src/components/docs/index.ts');
const DOCS_DIR = path.join(__dirname, '../src/components/docs');

// Read Registry
let registry = [];
try {
    registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
} catch (e) {
    console.error('Failed to read apps-registry.json', e);
    process.exit(1);
}

// Read Custom Apps
if (fs.existsSync(CUSTOM_APPS_PATH)) {
    try {
        const customApps = JSON.parse(fs.readFileSync(CUSTOM_APPS_PATH, 'utf-8'));
        // Normalize custom apps
        const normalizedCustomApps = customApps.map(app => ({
            ...app,
            category: app.category || 'Utility',
            icon: app.icon || 'Box', // Default icon
            description: app.description || 'Custom Application',
            difficulty: app.difficulty || 'Medium',
            setupTime: app.setupTime || '15 min',
            guideComponent: app.guideComponent // might be missing, handled later
        }));
        registry = [...registry, ...normalizedCustomApps];
        console.log(`Loaded ${normalizedCustomApps.length} custom apps`);
    } catch (e) {
        console.warn('Failed to read custom-apps.json', e);
    }
}

// Helper to get unique icons
const getUniqueIcons = (apps) => {
    const icons = new Set();
    apps.forEach(app => {
        if (app.icon) icons.add(app.icon);
    });
    return Array.from(icons).sort().join(', ');
};

// 1. Generate services.ts
const generateServices = () => {
    // Filter apps that have a 'profile' (meaning they are in the wizard)
    const wizardApps = registry.filter(app => app.profile);
    const icons = getUniqueIcons(wizardApps);
    // I need to map these to the 6 hardcoded categories in ServiceOption type or update the type.
    // I will UPDATE the type in services.ts to be more inclusive or map them to 'utility' if unknown.
    // Actually, I'll update the interface to accept string, or expand the union. "System", "Performance", etc.

    // Let's update the interface in the generated file to be looser: category: string.
    // But other components might depend on specific values.
    // SetupWizard uses it. 
    // I'll stick to string for now to be safe.

    const contentLooser = `import {
    ${icons}
} from 'lucide-react'

export interface ServiceOption {
    id: string
    name: string
    description: string
    icon: any
    logo?: string
    profile: string
    category: string
}

export const services: ServiceOption[] = [
${wizardApps.map(app => `    { 
        id: '${app.id}', 
        name: '${app.name}', 
        description: '${app.description.replace(/'/g, "\\'")}', 
        icon: ${app.icon}, 
        logo: '${app.logo || ''}', 
        profile: '${app.profile}', 
        category: '${app.category}' 
    },`).join('\n')}
]
`;

    fs.writeFileSync(SERVICES_PATH, contentLooser);
    console.log('Generated services.ts');
};

// Helper to determine guide component name (shared logic)
const getGuideComponentName = (app) => {
    if (app.guideComponent) return app.guideComponent;
    return app.name.replace(/[^a-zA-Z0-9]/g, '') + 'Guide';
};

// 2. Generate appData.ts
const generateAppData = () => {
    const icons = getUniqueIcons(registry);

    const content = `import type { LucideIcon } from 'lucide-react'
import {
    ${icons}
} from 'lucide-react'

export type AppId =
${registry.map(app => `    | '${app.id}'`).join('\n')}

export interface AppInfo {
    id: AppId
    name: string
    category: string
    description: string
    icon: LucideIcon
    logo?: string
    difficulty: 'Easy' | 'Medium' | 'Advanced'
    time: string
    guideComponent?: string
}

export const appCards: AppInfo[] = [
${registry.map(app => `    {
        id: '${app.id}',
        name: '${app.name}',
        category: '${app.category}',
        description: '${app.description.replace(/'/g, "\\'")}',
        icon: ${app.icon},
        logo: '${app.logo || ''}',
        difficulty: '${app.difficulty || 'Medium'}',
        time: '${app.setupTime || '15-30 min'}',
        guideComponent: '${getGuideComponentName(app)}'
    },`).join('\n')}
]
`;
    fs.writeFileSync(APPDATA_PATH, content);
    console.log('Generated appData.ts');
};

// 3. Generate index.ts for docs
const generateDocsIndex = () => {
    // Generate exports for each guide

    const exports = registry
        .map(app => {
            // Determine guide component name
            // If explicit in registry, use it.
            // Else if file exists with [Name]Guide.tsx, use it.
            // Else use [Name]Guide.

            let componentName = app.guideComponent;
            if (!componentName) {
                // Try to guess: Sonarr -> SonarrGuide
                // But wait, "Plex" -> "PlexGuide".
                // "*Arr Stack" -> "ArrStackGuide"?
                // "Gluetun VPN" -> "GluetunVPNGuide"?
                // Safer to rely on manual naming in registry or sanitization.
                componentName = app.name.replace(/[^a-zA-Z0-9]/g, '') + 'Guide';
            }

            // Check if file exists, if not generate stub
            const fileName = `${componentName}.tsx`;
            const filePath = path.join(DOCS_DIR, fileName);

            if (!fs.existsSync(filePath)) {
                // Generate Stub
                const stubContent = `
export function ${componentName}() {
    return (
        <div className="space-y-6">
            <div className="border-b border-white/10 pb-6">
                <h1 className="text-3xl font-bold mb-2">${app.name}</h1>
                <p className="text-xl text-gray-400">${app.description}</p>
            </div>
            
            <div className="p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <h3 className="text-lg font-semibold text-yellow-200 mb-2">Documentation Coming Soon</h3>
                <p className="text-gray-400">
                    We are currently writing the detailed setup guide for ${app.name}. 
                    Please check back later or contribute to the docs!
                </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-slate-900/50 rounded-xl border border-white/10">
                    <h3 className="font-semibold mb-4">Quick Links</h3>
                    <ul className="space-y-2 text-sm text-gray-400">
                        <li>• <a href="#" className="hover:text-primary transition-colors">Official Website</a></li>
                        <li>• <a href="#" className="hover:text-primary transition-colors">Documentation</a></li>
                        <li>• <a href="#" className="hover:text-primary transition-colors">GitHub Repository</a></li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
`;
                fs.writeFileSync(filePath, stubContent);
                console.log(`Generated stub for ${fileName}`);
            }

            return `export { ${componentName} } from './${componentName}'`;
        })
        .join('\n');

    const content = `export { AppsOverview } from './AppsOverview'
${exports}
`;
    fs.writeFileSync(DOCS_INDEX_PATH, content);
    console.log('Generated docs/index.ts');
};

generateServices();
generateAppData();
generateDocsIndex();
