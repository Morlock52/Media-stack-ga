import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from '../utils/env.js';

// Define storage paths
const REGISTRY_DIR = path.join(PROJECT_ROOT, 'config');
const BACKUP_DIR = path.join(REGISTRY_DIR, 'backups');
const REGISTRY_FILE = path.join(REGISTRY_DIR, 'custom-apps.json');

interface CustomApp {
    id: string;
    name: string;
    repo: string;
    homepage: string;
    docs: string;
    compose: string;
    iconName?: string;
    screenshots?: string[];
    createdAt: string;
    updatedAt?: string;
}

const ensureRegistry = () => {
    if (!fs.existsSync(REGISTRY_DIR)) {
        fs.mkdirSync(REGISTRY_DIR, { recursive: true });
    }
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    if (!fs.existsSync(REGISTRY_FILE)) {
        fs.writeFileSync(REGISTRY_FILE, '[]');
    }
};

export async function registryRoutes(fastify: FastifyInstance) {
    ensureRegistry();

    // Get all apps
    fastify.get('/api/registry/apps', async (request, reply) => {
        try {
            const data = fs.readFileSync(REGISTRY_FILE, 'utf-8');
            return JSON.parse(data || '[]');
        } catch (error: any) {
            fastify.log.error(error);
            return [];
        }
    });

    // Save/Update an app + Backup
    fastify.post<{ Body: CustomApp }>('/api/registry/apps', async (request, reply) => {
        const app = request.body;

        if (!app.repo || (!app.homepage && !app.docs)) {
            return reply.status(400).send({ error: 'Invalid app data. Need repo and generated content.' });
        }

        // Generate ID if missing (from repo name)
        if (!app.id) {
            app.id = app.repo.split('/').pop()?.toLowerCase() || `app-${Date.now()}`;
        }
        if (!app.name) {
            app.name = app.repo.split('/').pop() || 'Unknown App';
        }

        try {
            const currentData = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8') || '[]');
            const existingIndex = currentData.findIndex((a: CustomApp) => a.id === app.id);

            const newEntry: CustomApp = {
                ...app,
                updatedAt: new Date().toISOString(),
                createdAt: app.createdAt || new Date().toISOString()
            };

            // Save Backup
            const backupPath = path.join(BACKUP_DIR, `${newEntry.id}-${Date.now()}.json`);
            fs.writeFileSync(backupPath, JSON.stringify(newEntry, null, 2));

            // Update Registry
            if (existingIndex >= 0) {
                currentData[existingIndex] = { ...currentData[existingIndex], ...newEntry };
            } else {
                currentData.push(newEntry);
            }

            fs.writeFileSync(REGISTRY_FILE, JSON.stringify(currentData, null, 2));
            return { success: true, app: newEntry, backup: backupPath };

        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to save to registry' });
        }
    });

    // Import an app (Load feature)
    fastify.post<{ Body: CustomApp }>('/api/registry/import', async (request, reply) => {
        const app = request.body;
        if (!app.id || !app.repo) {
            return reply.status(400).send({ error: 'Invalid backup file content.' });
        }

        try {
            const currentData = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8') || '[]');
            const existingIndex = currentData.findIndex((a: CustomApp) => a.id === app.id);

            const newEntry = { ...app, updatedAt: new Date().toISOString() };

            if (existingIndex >= 0) {
                currentData[existingIndex] = newEntry;
            } else {
                currentData.push(newEntry);
            }

            fs.writeFileSync(REGISTRY_FILE, JSON.stringify(currentData, null, 2));
            return { success: true, app: newEntry };
        } catch (error: any) {
            return reply.status(500).send({ error: 'Failed to import app.' });
        }
    });

    // Delete an app
    fastify.delete<{ Params: { id: string } }>('/api/registry/apps/:id', async (request, reply) => {
        const { id } = request.params;

        try {
            let currentData = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8') || '[]');
            const initialLength = currentData.length;

            currentData = currentData.filter((a: CustomApp) => a.id !== id);

            if (currentData.length === initialLength) {
                return reply.status(404).send({ error: 'App not found' });
            }

            fs.writeFileSync(REGISTRY_FILE, JSON.stringify(currentData, null, 2));
            return { success: true };

        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'Failed to delete from registry' });
        }
    });
}
