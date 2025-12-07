
import Fastify from 'fastify';
import { aiRoutes } from '../src/routes/ai.js';

const app = Fastify({ logger: false });

async function run() {
    try {
        await app.register(aiRoutes);
        await app.ready();
        console.log("✅ AI Routes registered successfully.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Failed to register routes:", err);
        process.exit(1);
    }
}

run();
