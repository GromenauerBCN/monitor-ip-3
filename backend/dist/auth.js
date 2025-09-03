import fastifyJwt from '@fastify/jwt';
import argon2 from 'argon2';
import { prisma } from './db.js';
export function registerAuth(app) {
    // Registre del plugin JWT (assegura que JWT_SECRET està al .env)
    app.register(fastifyJwt, { secret: process.env.JWT_SECRET });
    // Decorador d’autenticació
    app.decorate('authenticate', async (request, reply) => {
        try {
            await request.jwtVerify();
        }
        catch {
            reply.code(401).send({ error: 'Unauthorized' });
        }
    });
    // ───────────────────────────────────────────────────────────
    // REGISTRE
    // ───────────────────────────────────────────────────────────
    app.post('/api/auth/register', async (req, reply) => {
        const { email, password } = req.body || {};
        if (!email || !password)
            return reply.code(400).send({ error: 'Missing email/password' });
        const emailNorm = String(email).trim().toLowerCase();
        if (password.length < 6)
            return reply.code(400).send({ error: 'Password too short' });
        const exists = await prisma.user.findUnique({ where: { email: emailNorm } });
        if (exists)
            return reply.code(400).send({ error: 'Email already registered' });
        const passwordHash = await argon2.hash(password);
        const user = await prisma.user.create({
            data: { email: emailNorm, passwordHash },
            select: { id: true, email: true }
        });
        // Opcional: retornar token en registrar (si el teu frontend ho espera, deixa-ho; si no, comenta-ho)
        const token = app.jwt.sign({ id: user.id, email: user.email }, { expiresIn: '30d' });
        return { ok: true, token, user };
    });
    // ───────────────────────────────────────────────────────────
    // LOGIN
    // ───────────────────────────────────────────────────────────
    app.post('/api/auth/login', async (req, reply) => {
        const { email, password } = req.body || {};
        if (!email || !password)
            return reply.code(400).send({ error: 'Missing email/password' });
        const emailNorm = String(email).trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email: emailNorm } });
        if (!user || !user.passwordHash)
            return reply.code(401).send({ error: 'Invalid credentials' });
        const valid = await argon2.verify(user.passwordHash, String(password));
        if (!valid)
            return reply.code(401).send({ error: 'Invalid credentials' });
        const token = app.jwt.sign({ id: user.id, email: user.email }, { expiresIn: '30d' });
        return { ok: true, token, user: { id: user.id, email: user.email } };
    });
}
