import { buildApp } from './app.js';
import { PROJECT_ROOT } from './utils/env.js';

const PORT = parseInt(process.env.PORT || '3001');

const start = async () => {
    const app = await buildApp();

    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        app.log.info({ projectRoot: PROJECT_ROOT }, 'Control Server started');
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
