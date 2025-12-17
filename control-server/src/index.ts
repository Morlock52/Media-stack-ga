import { buildApp } from './app.js';
import { PROJECT_ROOT } from './utils/env.js';

const PORT = parseInt(process.env.PORT || '3001');
const HOST = process.env.CONTROL_SERVER_HOST || '127.0.0.1';

const start = async () => {
    try {
        const app = await buildApp();

        try {
            await app.listen({ port: PORT, host: HOST });
            app.log.info({ projectRoot: PROJECT_ROOT }, 'Control Server started');
        } catch (err) {
            app.log.error(err);
            process.exit(1);
        }
    } catch (err) {
        // buildApp() can throw before the Fastify logger is available
        // (e.g. plugin registration errors). Log it explicitly.
        console.error('Control Server failed during startup:', err);
        process.exit(1);
    }
};

start();
