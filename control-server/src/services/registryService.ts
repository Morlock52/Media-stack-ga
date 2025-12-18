import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from '../utils/env.js';

const DOCS_SITE_ROOT = path.join(PROJECT_ROOT, 'docs-site');
const REGISTRY_PATH = path.join(DOCS_SITE_ROOT, 'src/data/apps-registry.json');
const BACKUP_DIR = path.join(DOCS_SITE_ROOT, 'src/data/backups');
const DOCS_DIR = path.join(DOCS_SITE_ROOT, 'src/components/docs');

export interface AppRegistryItem {
    id: string;
    name: string;
    description: string;
    repoUrl?: string;
    guideComponent?: string;
    category?: string;
    icon?: string;
}

export const loadRegistry = (): AppRegistryItem[] => {
    if (!fs.existsSync(REGISTRY_PATH)) return [];
    try {
        return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    } catch {
        return [];
    }
};

export const saveRegistry = (data: AppRegistryItem[]) => {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 4));
};

export const backup = () => {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `registry-${timestamp}.json`);
    fs.copyFileSync(REGISTRY_PATH, backupPath);
    return backupPath;
};

export const addApp = (app: AppRegistryItem) => {
    const registry = loadRegistry();
    if (registry.find(a => a.id === app.id)) {
        throw new Error(`App with ID ${app.id} already exists`);
    }
    backup();
    registry.push(app);
    saveRegistry(registry);
    return app;
};

export const removeApp = (id: string) => {
    const registry = loadRegistry();
    const index = registry.findIndex(a => a.id === id);
    if (index === -1) {
        throw new Error(`App with ID ${id} not found`);
    }
    const app = registry[index];
    backup();
    registry.splice(index, 1);
    saveRegistry(registry);

    // Delete documentation file if it exists
    let guideComponent = app.guideComponent;
    if (!guideComponent) {
        guideComponent = app.name.replace(/[^a-zA-Z0-9]/g, '') + 'Guide';
    }
    const guidePath = path.join(DOCS_DIR, `${guideComponent}.tsx`);
    if (fs.existsSync(guidePath)) {
        fs.unlinkSync(guidePath);
    }
    return app;
};

export const updateApp = (id: string, updates: Partial<AppRegistryItem>) => {
    const registry = loadRegistry();
    const index = registry.findIndex(a => a.id === id);
    if (index === -1) {
        throw new Error(`App with ID ${id} not found`);
    }
    backup();
    registry[index] = { ...registry[index], ...updates };
    saveRegistry(registry);
    return registry[index];
};
