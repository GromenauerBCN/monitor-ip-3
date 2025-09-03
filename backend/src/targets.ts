import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from './db.js';
import { checkHttp, checkTcp } from './checks.js';
import { parse } from 'csv-parse/sync';

export const monitorRouter: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  // Llista de targets de l’usuari
  app.get('/api/targets', async (req, reply) => {
    // @ts-ignore
    const userId = (req as any).user.id as string;
    const list = await prisma.monitorTarget.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return list;
  });

  // Crear target
  app.post('/api/targets', async (req, reply) => {
    // @ts-ignore
    const userId = (req as any).user.id as string;
    const { label, kind, address, port, intervalMinutes } = (req.body as any) || {};

    if (!label || !kind || !address) {
      return reply.code(400).send({ error: 'Missing fields' });
    }
    const k: 'http' | 'tcp' = String(kind).toLowerCase() === 'tcp' ? 'tcp' : 'http';
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
    const userId = (req as any).user.id as string;
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'CSV file required' });

    const buf = await data.toBuffer();
    const rows: any[] = parse(buf, { columns: true, skip_empty_lines: true, trim: true });
    const created = [];

    for (const r of rows) {
      if (!r.label || !r.kind || !r.address) continue;
      const k: 'http' | 'tcp' = String(r.kind).toLowerCase() === 'tcp' ? 'tcp' : 'http';
      created.push(
        await prisma.monitorTarget.create({
          data: {
            userId,
            label: String(r.label),
            kind: k,
            address: String(r.address).trim(),
            port: r.port ? Number(r.port) : null,
            intervalMinutes: r.intervalMinutes ? Number(r.intervalMinutes) : 20
          }
        })
      );
    }
    return { count: created.length };
  });

  // Eliminar target
  app.delete('/api/targets/:id', async (req, reply) => {
    // @ts-ignore
    const userId = (req as any).user.id as string;
    const id = (req.params as any).id as string;

    const t = await prisma.monitorTarget.findFirst({ where: { id, userId } });
    if (!t) return reply.code(404).send({ error: 'Not found' });

    await prisma.checkResult.deleteMany({ where: { targetId: id } });
    await prisma.monitorTarget.delete({ where: { id } });

    return { ok: true };
  });

  // Check manual (un únic intent; els retries els fa el scheduler)
  app.post('/api/targets/:id/check', async (req, reply) => {
    // @ts-ignore
    const userId = (req as any).user.id as string;
    const id = (req.params as any).id as string;

    const t = await prisma.monitorTarget.findFirst({ where: { id, userId } });
    if (!t) return reply.code(404).send({ error: 'Not found' });

    const res = await runCheckAndPersist(t.id);
    return res;
  });

  // Darrer resultat per a cada target
  app.get('/api/checks/latest', async (req, reply) => {
    // @ts-ignore
    const userId = (req as any).user.id as string;
    const targets = await prisma.monitorTarget.findMany({ where: { userId } });

    const latest: Array<{ targetId: string; ok: boolean | null; latencyMs?: number | null; error?: string | null; checkedAt?: Date | null }> = [];
    for (const t of targets) {
      const c = await prisma.checkResult.findFirst({
        where: { targetId: t.id },
        orderBy: { checkedAt: 'desc' }
      });
      latest.push({
        targetId: t.id,
        ok: c?.ok ?? null,
        latencyMs: c?.latencyMs ?? null,
        error: c?.error ?? null,
        checkedAt: c?.checkedAt ?? null
      });
    }
    return latest;
  });
};

// ─────────────────────────────────────────────────────────────
// Execució d’un check i persistència del resultat (sense retries)
// ─────────────────────────────────────────────────────────────
export async function runCheckAndPersist(targetId: string) {
  const t = await prisma.monitorTarget.findUnique({ where: { id: targetId } });
  if (!t || !t.enabled) return null;

  // Un sol check: el scheduler ja fa els retries/intervals
  let res: { ok: boolean; latencyMs?: number; error?: string };
  if (t.kind === 'http') {
    // Si l'adreça no porta protocol, per seguretat fem http://
    const url = /^https?:\/\//i.test(t.address) ? t.address : `http://${t.address}`;
    res = await checkHttp(url);
  } else {
    res = await checkTcp(t.address, t.port || 80);
  }

  const saved = await prisma.checkResult.create({
    data: {
      targetId: t.id,
      ok: !!res.ok,
      latencyMs: res.latencyMs ?? null,
      error: res.error ?? null
    }
  });

  const updated = await prisma.monitorTarget.update({
    where: { id: t.id },
    data: {
      lastCheckedAt: saved.checkedAt,
      lastStatus: res.ok ? 'UP' : 'DOWN',
      updatedAt: new Date()
    },
    select: { id: true, label: true, lastCheckedAt: true, lastStatus: true }
  });

  // Retorn coherent amb el frontend que refresca estat immediat
  return { ok: res.ok, target: updated, lastResult: saved };
}
