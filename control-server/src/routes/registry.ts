import { FastifyInstance } from 'fastify';
import { loadRegistry, addApp, removeApp, updateApp, AppRegistryItem } from '../services/registryService.js';
import { scrapeGitHubRepo } from '../utils/github.js';
import { generateAppFromGitHub, registerAndExportApp } from '../services/appGeneratorService.js';

export async function registryRoutes(fastify: FastifyInstance) {
    // List Apps
    fastify.get('/api/registry/apps', async (request, reply) => {
        try {
            return loadRegistry();
        } catch (error) {
            fastify.log.error(error);
            reply.status(500).send({ error: 'Failed to load registry' });
        }
    });

    // Scrape and Add via GitHub
    fastify.post<{ Body: { url: string } }>('/api/registry/scrape', async (request, reply) => {
        try {
            const { url } = request.body;
            if (!url) return reply.status(400).send({ error: 'URL is required' });

            fastify.log.info({ url }, 'Scraping GitHub repo');
            const metadata = await scrapeGitHubRepo(url);

            fastify.log.info('Generating app documentation with AI');
            const { app, docContent } = await generateAppFromGitHub(metadata);

            fastify.log.info({ appId: app.id }, 'Registering app and creating guide');
            await registerAndExportApp(app, docContent);
            addApp(app);

            return { success: true, app };
        } catch (error: any) {
            fastify.log.error(error);
            reply.status(500).send({ error: error.message });
        }
    });

    // Add App
    fastify.post<{ Body: AppRegistryItem }>('/api/registry/apps', async (request, reply) => {
        try {
            const app = addApp(request.body);
            return { success: true, app };
        } catch (error: any) {
            fastify.log.error(error);
            reply.status(400).send({ error: error.message });
        }
    });

    // Update App
    fastify.put<{ Params: { id: string }; Body: Partial<AppRegistryItem> }>('/api/registry/apps/:id', async (request, reply) => {
        try {
            const { id } = request.params;
            const app = updateApp(id, request.body);
            return { success: true, app };
        } catch (error: any) {
            fastify.log.error(error);
            reply.status(400).send({ error: error.message });
        }
    });

    // Delete App
    fastify.delete<{ Params: { id: string } }>('/api/registry/apps/:id', async (request, reply) => {
        try {
            const { id } = request.params;
            removeApp(id);
            return { success: true, message: 'App removed' };
        } catch (error: any) {
            fastify.log.error(error);
            reply.status(404).send({ error: error.message });
        }
    });
}
