import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { registerAuth } from './auth.js';
import './scheduler.js';
import { monitorRouter } from './targets.js';
import { notifRouter } from './notifications.js';
import { telegramRouter, ensureTelegramWebhook } from './telegram.js';
const app = Fastify({ logger: true });
app.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || true, credentials: true });
app.register(multipart);
app.register(rateLimit, { max: 200, timeWindow: '1 minute' });
registerAuth(app);
// RUTA PÚBLICA
app.get('/api/health', async () => ({ ok: true }));
// Routers protegits — ara com a PLUGINS encapsulats
app.register(monitorRouter);
app.register(notifRouter);
// Webhook Telegram (públic)
telegramRouter(app);
// app.register(cors, { origin: true, credentials: true });
const port = Number(process.env.PORT || 8080);
app.listen({ port, host: '0.0.0.0' }).then(async () => {
    app.log.info(`Server listening on ${port}`);
    try {
        await ensureTelegramWebhook();
    }
    catch (e) {
        app.log.error(e);
    }
});
