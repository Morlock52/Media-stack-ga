import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from '../utils/env.js';

// Paths relative to repository root
const DOCS_SITE_ROOT = path.join(PROJECT_ROOT, 'docs-site');
const REGISTRY_PATH = path.join(DOCS_SITE_ROOT, 'src/data/apps-registry.json');
const BACKUP_DIR = path.join(DOCS_SITE_ROOT, 'src/data/backups');
const DOCS_DIR = path.join(DOCS_SITE_ROOT, 'src/components/docs');

const loadRegistry = () => {
    if (!fs.existsSync(REGISTRY_PATH)) return [];
    try {
        return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    } catch {
        return [];
    }
};

const saveRegistry = (data: any[]) => {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 4));
};

const backup = () => {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `registry-${timestamp}.json`);
    fs.copyFileSync(REGISTRY_PATH, backupPath);
    return backupPath;
};

export async function registryRoutes(fastify: FastifyInstance) {
    // List Apps
    fastify.get('/api/registry/apps', async (request, reply) => {
        try {
            const apps = loadRegistry();
            return apps;
        } catch (error) {
            fastify.log.error(error);
            reply.status(500).send({ error: 'Failed to load registry' });
        }
    });


    // Delete App
    fastify.delete<{ Params: { id: string } }>('/api/registry/apps/:id', async (request, reply) => {
        const { id } = request.params;
        const registry = loadRegistry();
        const index = registry.findIndex((a: any) => a.id === id);

        if (index === -1) {
            return reply.status(404).send({ error: 'App not found' });
        }

        const app = registry[index];

        try {
            backup();
            registry.splice(index, 1);
            saveRegistry(registry);

            // Delete documentation file
            let guideComponent = app.guideComponent;
            if (!guideComponent) {
                guideComponent = app.name.replace(/[^a-zA-Z0-9]/g, '') + 'Guide';
            }
            const guidePath = path.join(DOCS_DIR, `${guideComponent}.tsx`);
            if (fs.existsSync(guidePath)) {
                fs.unlinkSync(guidePath);
            }

            return { success: true, message: 'App removed' };
        } catch (error: any) {
            fastify.log.error(error);
            reply.status(500).send({ error: error.message });
        }
    });
}
