import { prisma } from './db.js';
import { checkWithRetries } from './checks.js';
import { parse } from 'csv-parse/sync';
export const monitorRouter = async (app) => {
    app.addHook('preHandler', app.authenticate);
    // Llista de targets de l’usuari
    app.get('/api/targets', async (req, reply) => {
        // @ts-ignore
        const userId = req.user.id;
        const list = await prisma.monitorTarget.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        return list;
    });
    // Crear target
    app.post('/api/targets', async (req, reply) => {
        // @ts-ignore
        const userId = req.user.id;
        const { label, kind, address, port, intervalMinutes } = req.body || {};
        if (!label || !kind || !address) {
            return reply.code(400).send({ error: 'Missing fields' });
        }
        const k = String(kind).toLowerCase() === 'tcp' ? 'tcp' : 'http';
        if (k === 'tcp' && !port) {
            return reply.code(400).send({ error: 'TCP requires port' });
        }
        const item = await prisma.monitorTarget.create({
            data: {
                userId,
                label: String(label),
                kind: k, // 'http' o 'tcp'
                address: String(address).trim(),
                port: port ? Number(port) : null,
                intervalMinutes: Number(intervalMinutes || 20)
            }
        });
        return item;
    });
    // Importació per CSV: columns: label,kind,address,port?,intervalMinutes?
    app.post('/api/targets/csv', async (req, reply) => {
        // @ts-ignore
        const userId = req.user.id;
        const data = await req.file();
        if (!data)
            return reply.code(400).send({ error: 'CSV file required' });
        const buf = await data.toBuffer();
        const rows = parse(buf, { columns: true, skip_empty_lines: true, trim: true });
        const created = [];
        for (const r of rows) {
            if (!r.label || !r.kind || !r.address)
                continue;
            const k = String(r.kind).toLowerCase() === 'tcp' ? 'tcp' : 'http';
            created.push(await prisma.monitorTarget.create({
                data: {
                    userId,
                    label: String(r.label),
                    kind: k,
                    address: String(r.address).trim(),
                    port: r.port ? Number(r.port) : null,
                    intervalMinutes: r.intervalMinutes ? Number(r.intervalMinutes) : 20
                }
            }));
        }
        return { count: created.length };
    });
    // Eliminar target
    app.delete('/api/targets/:id', async (req, reply) => {
        // @ts-ignore
        const userId = req.user.id;
        const id = req.params.id;
        const t = await prisma.monitorTarget.findFirst({ where: { id, userId } });
        if (!t)
            return reply.code(404).send({ error: 'Not found' });
        await prisma.checkResult.deleteMany({ where: { targetId: id } });
        await prisma.monitorTarget.delete({ where: { id } });
        return { ok: true };
    });
    // Check manual (no envia alertes; només comprova i persisteix)
    app.post('/api/targets/:id/check', async (req, reply) => {
        // @ts-ignore
        const userId = req.user.id;
        const id = req.params.id;
        const t = await prisma.monitorTarget.findFirst({ where: { id, userId } });
        if (!t)
            return reply.code(404).send({ error: 'Not found' });
        const res = await runCheckAndPersist(t.id);
        return res;
    });
    // Darrer resultat per a cada target
    app.get('/api/checks/latest', async (req, reply) => {
        // @ts-ignore
        const userId = req.user.id;
        const targets = await prisma.monitorTarget.findMany({ where: { userId } });
        const latest = [];
        for (const t of targets) {
            const c = await prisma.checkResult.findFirst({
                where: { targetId: t.id },
                orderBy: { checkedAt: 'desc' }
            });
            latest.push({
                targetId: t.id,
                ok: c?.ok ?? null,
                latencyMs: c?.latencyMs,
                error: c?.error,
                checkedAt: c?.checkedAt
            });
        }
        return latest;
    });
};
// ─────────────────────────────────────────────────────────────
// Execució d’un check i persistència del resultat
// ─────────────────────────────────────────────────────────────
export async function runCheckAndPersist(targetId) {
    const t = await prisma.monitorTarget.findUnique({ where: { id: targetId } });
    if (!t || !t.enabled)
        return null;
    const started = Date.now();
    let ok = false;
    let error;
    try {
        // IMPORTANT: checkWithRetries detecta HTTP/HTTPS si l’address ja porta protocol
        ok = await checkWithRetries(t.kind, t.address, t.port ?? undefined);
    }
    catch (e) {
        ok = false;
        error = e?.message || 'unknown check error';
    }
    const latencyMs = Date.now() - started;
    const saved = await prisma.checkResult.create({
        data: {
            targetId: t.id,
            ok,
            latencyMs: ok ? latencyMs : null,
            error: ok ? null : (error || `${t.kind} ${t.address}${t.port ? ':' + t.port : ''} failed`)
        }
    });
    const updated = await prisma.monitorTarget.update({
        where: { id: t.id },
        data: {
            lastCheckedAt: saved.checkedAt,
            lastStatus: ok ? 'UP' : 'DOWN',
            updatedAt: new Date()
        },
        select: { id: true, label: true, lastCheckedAt: true, lastStatus: true }
    });
    return { ok: true, target: updated, lastResult: saved };
}
