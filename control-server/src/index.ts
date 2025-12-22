import { buildApp } from './app.js';
import { PROJECT_ROOT } from './utils/env.js';
import { FastifyInstance } from 'fastify';

const PORT = parseInt(process.env.PORT || '3001');
const HOST = process.env.CONTROL_SERVER_HOST || '127.0.0.1';
const TOKEN = (process.env.CONTROL_SERVER_TOKEN || '').trim();
const ALLOW_INSECURE_NO_TOKEN =
    ['1', 'true', 'yes'].includes(String(process.env.CONTROL_SERVER_ALLOW_INSECURE_NO_TOKEN || '').toLowerCase());

// Security check: require token when binding to non-localhost addresses
const isExposedHost = HOST === '0.0.0.0' || HOST === '::' || (!HOST.startsWith('127.') && HOST !== 'localhost');

// Graceful shutdown handler
const setupGracefulShutdown = (app: FastifyInstance) => {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    
    signals.forEach((signal) => {
        process.on(signal, async () => {
            app.log.info(`Received ${signal}, shutting down gracefully...`);
            try {
                await app.close();
                app.log.info('Server closed successfully');
                process.exit(0);
            } catch (err) {
                app.log.error(err, 'Error during shutdown');
                process.exit(1);
            }
        });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
        app.log.fatal(err, 'Uncaught exception');
        process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
        app.log.error({ reason }, 'Unhandled rejection');
    });
};

const start = async () => {
    // Warn or block if exposed without auth token
    if (isExposedHost && !TOKEN) {
        const msg = `
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚠️  SECURITY WARNING: Control server binding to ${HOST}                     
│                                                                             │
│  The control server has access to the Docker socket and can execute         │
│  commands on your host. Exposing it without authentication is DANGEROUS.    │
│                                                                             │
│  To proceed, set CONTROL_SERVER_TOKEN in your environment:                  │
│    export CONTROL_SERVER_TOKEN="$(openssl rand -hex 32)"                    │
│                                                                             │
│  Or bind to localhost only (default, recommended for local use):            │
│    export CONTROL_SERVER_HOST=127.0.0.1                                     │
└─────────────────────────────────────────────────────────────────────────────┘
`;
        if (!ALLOW_INSECURE_NO_TOKEN) {
            console.error(msg);
            process.exit(1);
        }
        console.error(msg);
        console.error(
            'Continuing because CONTROL_SERVER_ALLOW_INSECURE_NO_TOKEN is set. Only use this when the API is not exposed beyond localhost.',
        );
    }

    try {
        const app = await buildApp();

        // Setup graceful shutdown handlers
        setupGracefulShutdown(app);

        try {
            await app.listen({ port: PORT, host: HOST });
            app.log.info({ projectRoot: PROJECT_ROOT }, 'Control Server started');
            
            if (isExposedHost && TOKEN) {
                app.log.warn('Control server is exposed beyond localhost. Ensure CONTROL_SERVER_TOKEN is kept secret.');
            }
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
