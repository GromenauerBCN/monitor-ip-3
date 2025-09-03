const DEBUG_RETRIES = process.env.DEBUG_RETRIES === '1';
import cron from 'node-cron';
import { prisma } from './db.js';
import { runCheckAndPersist } from './targets.js';
import { sendEmail, sendPush } from './notifications.js';
import { notifyTelegram } from './telegram.js';
const TZ = process.env.TZ || 'Europe/Madrid';
const RETRY_ATTEMPTS = Number(process.env.RETRY_ATTEMPTS || 3);
const RETRY_INTERVAL_MS = Number(process.env.RETRY_INTERVAL_SEC || 60) * 1000;
const ALERT_COOLDOWN_MIN = Number(process.env.ALERT_COOLDOWN_MIN || 60);
const sleep = (ms) => new Promise(res => setTimeout(res, ms));
function minutesSince(d) {
    if (!d)
        return Infinity;
    return (Date.now() - new Date(d).getTime()) / 60000;
}
/**
 * Executa una comprovació i mira el resultat més recent a checkResult.
 * Retorna { ok, error } de l’últim resultat (persisteix via runCheckAndPersist).
 */
async function runOnceAndGetOk(targetId) {
    await runCheckAndPersist(targetId);
    const latest = await prisma.checkResult.findFirst({
        where: { targetId },
        orderBy: { checkedAt: 'desc' },
        select: { ok: true, error: true },
    });
    return { ok: !!latest?.ok, error: latest?.error ?? undefined };
}
// ───────────────────────────────────────────────────────────────────────────────
// Cada minut, mira targets vençuts i aplica retries abans d'alertar
// ───────────────────────────────────────────────────────────────────────────────
cron.schedule('* * * * *', async () => {
    const now = new Date();
    // 1) Candidates “recent checked >= 1 min” (evitem repetir en el mateix minut)
    const dueCandidates = await prisma.monitorTarget.findMany({
        where: {
            enabled: true,
            OR: [
                { lastCheckedAt: null },
                { lastCheckedAt: { lte: new Date(now.getTime() - 60000) } },
            ],
        },
        orderBy: { createdAt: 'asc' },
    });
    // 2) Filtre fi per interval per target
    const due = [];
    for (const t of dueCandidates) {
        const last = t.lastCheckedAt ? new Date(t.lastCheckedAt).getTime() : 0;
        const nextAt = last + t.intervalMinutes * 60000;
        if (last === 0 || Date.now() >= nextAt) {
            due.push(t);
        }
        else if (DEBUG_RETRIES) {
            const minsLeft = Math.max(0, Math.ceil((nextAt - Date.now()) / 60000));
            console.log(`[scheduler] SKIP "${t.label}" — següent check en ~${minsLeft} min (interval=${t.intervalMinutes}m)`);
        }
    }
    console.log('[scheduler] due count =', due.length, '=>', due.map(d => d.label).join(', ') || '—');
    for (const t of due) {
        const prevStatus = t.lastStatus || 'UNKNOWN';
        try {
            console.log(`[scheduler] Running check for "${t.label}" (${t.id})`);
            let finalOk = false;
            let lastError;
            for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
                if (DEBUG_RETRIES) {
                    console.log(`[scheduler][${new Date().toLocaleTimeString()}] ${t.label} intent ${attempt}/${RETRY_ATTEMPTS}`);
                }
                const { ok, error } = await runOnceAndGetOk(t.id);
                lastError = error;
                if (ok) {
                    finalOk = true;
                    if (attempt > 1 || DEBUG_RETRIES) {
                        console.log(`[scheduler] "${t.label}" OK al intent ${attempt}/${RETRY_ATTEMPTS}`);
                    }
                    break;
                }
                // si no és l'últim intent, espera l’interval abans de reintentar
                if (attempt < RETRY_ATTEMPTS) {
                    console.log(`[scheduler] "${t.label}" KO (intent ${attempt}/${RETRY_ATTEMPTS}). Reintento en ${RETRY_INTERVAL_MS / 1000}s…`);
                    await sleep(RETRY_INTERVAL_MS);
                }
            }
            // refresquem el target (pot haver estat actualitzat dins runCheckAndPersist)
            const fresh = await prisma.monitorTarget.findUnique({ where: { id: t.id } });
            // Si KO definitiu → decidir alerta (respectant cooldown/transició)
            if (!finalOk && fresh) {
                const cooldownOk = minutesSince(fresh.lastAlertAt) >= ALERT_COOLDOWN_MIN;
                const shouldAlert = (prevStatus !== 'DOWN') || cooldownOk;
                if (DEBUG_RETRIES) {
                    const notif = await prisma.notificationSettings.findUnique({ where: { userId: fresh.userId } });
                    console.log(`[scheduler] Decide alert for "${fresh.label}": finalOk=${finalOk}, prevStatus=${prevStatus}, ` +
                        `cooldownOk=${cooldownOk}, shouldAlert=${shouldAlert}, recipients=${notif?.emailRecipients?.length || 0}`);
                }
                if (shouldAlert) {
                    const notif = await prisma.notificationSettings.findUnique({ where: { userId: fresh.userId } });
                    const subject = `⚠️ Servei caigut: ${fresh.label}`;
                    const html = `
              <h3>Servei no disponible</h3>
              <p>Objectiu: <b>${fresh.label}</b></p>
              <p>Hora: ${new Date().toLocaleString('ca-ES')}</p>
              <p>S'han fet ${RETRY_ATTEMPTS} intents separats ${RETRY_INTERVAL_MS / 1000}s i tots han fallat.</p>
              ${lastError ? `<pre style="white-space:pre-wrap">${lastError}</pre>` : ''}
            `;
                    if (DEBUG_RETRIES) {
                        console.log('[scheduler] About to send email for', fresh.label, 'to', notif?.emailRecipients);
                    }
                    // email
                    if (notif?.emailRecipients?.length) {
                        try {
                            await sendEmail(notif.emailRecipients, subject, html);
                        }
                        catch (e) {
                            console.error('[scheduler] sendEmail failed:', e?.message || e);
                        }
                    }
                    else if (DEBUG_RETRIES) {
                        console.log('[scheduler] No emailRecipients configured -> no email sent');
                    }
                    // push (si tens Expo registrat)
                    try {
                        await sendPush(fresh.userId, 'Servei caigut', `${fresh.label} no respon`);
                    }
                    catch { }
                    // telegram (si tens bot connectat)
                    try {
                        await notifyTelegram(fresh.userId, `⚠️ Servei caigut: ${fresh.label}`);
                    }
                    catch { }
                    // marca lastAlertAt/lastStatus per aplicar cooldown en futurs ticks
                    await prisma.monitorTarget.update({
                        where: { id: fresh.id },
                        data: { lastAlertAt: new Date(), lastStatus: 'DOWN' },
                    });
                    if (DEBUG_RETRIES)
                        console.log(`[scheduler] ALERT path finished for "${fresh.label}"`);
                }
                else if (DEBUG_RETRIES) {
                    console.log(`[scheduler] Alert suppressed for "${fresh.label}" (prevStatus=${prevStatus}, cooldownOk=${cooldownOk})`);
                }
            }
            // Si ha tornat OK i abans estava DOWN, notifica recuperació (opcional)
            if (finalOk && prevStatus === 'DOWN') {
                const notif = await prisma.notificationSettings.findUnique({ where: { userId: t.userId } });
                const subject = `✅ Servei recuperat: ${t.label}`;
                const html = `<p>El servei ha tornat a respondre a ${new Date().toLocaleString('ca-ES')}.</p>`;
                if (notif?.emailRecipients?.length) {
                    try {
                        await sendEmail(notif.emailRecipients, subject, html);
                    }
                    catch { }
                }
                try {
                    await sendPush(t.userId, 'Servei recuperat', `${t.label} torna a respondre`);
                }
                catch { }
                try {
                    await notifyTelegram(t.userId, `✅ Servei recuperat: ${t.label}`);
                }
                catch { }
                await prisma.monitorTarget.update({
                    where: { id: t.id },
                    data: { lastStatus: 'UP' },
                });
            }
        }
        catch (e) {
            console.error(`[scheduler] Error processant "${t.label}" (${t.id}):`, e);
        }
    }
}, { timezone: TZ });
// ───────────────────────────────────────────────────────────────────────────────
// DIGEST DIARI 08:00
// ───────────────────────────────────────────────────────────────────────────────
cron.schedule('0 8 * * *', async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const users = await prisma.user.findMany();
    for (const u of users) {
        const notif = await prisma.notificationSettings.findUnique({ where: { userId: u.id } });
        if (!notif?.dailyDigest || !notif.emailRecipients?.length)
            continue;
        const errors = await prisma.checkResult.findMany({
            where: { ok: false, checkedAt: { gte: since }, target: { userId: u.id } },
            include: { target: true },
            orderBy: { checkedAt: 'desc' },
        });
        if (!errors.length)
            continue;
        const rows = errors
            .map((e) => `<tr><td>${e.checkedAt.toISOString()}</td><td>${e.target.label}</td><td>${e.error || ''}</td></tr>`)
            .join('');
        const html = `<p>Errors últimes 24h</p><table border="1" cellpadding="6"><tr><th>Quan</th><th>Servei</th><th>Error</th></tr>${rows}</table>`;
        await sendEmail(notif.emailRecipients, `Resum diari d'errors`, html);
    }
}, { timezone: TZ });
// ───────────────────────────────────────────────────────────────────────────────
// DIGEST MENSUAL dia 1 a les 08:05
// ───────────────────────────────────────────────────────────────────────────────
cron.schedule('5 8 1 * *', async () => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth() - 1, 1);
    const prevMonthEnd = new Date(firstOfMonth.getTime() - 1);
    const users = await prisma.user.findMany();
    for (const u of users) {
        const notif = await prisma.notificationSettings.findUnique({ where: { userId: u.id } });
        if (!notif?.monthlyDigest || !notif.emailRecipients?.length)
            continue;
        const errors = await prisma.checkResult.findMany({
            where: { ok: false, checkedAt: { gte: prevMonthStart, lte: prevMonthEnd }, target: { userId: u.id } },
            include: { target: true },
            orderBy: { checkedAt: 'desc' },
        });
        if (!errors.length)
            continue;
        const rows = errors
            .map((e) => `<tr><td>${e.checkedAt.toISOString()}</td><td>${e.target.label}</td><td>${e.error || ''}</td></tr>`)
            .join('');
        const html = `<p>Errors del darrer mes</p><table border="1" cellpadding="6"><tr><th>Quan</th><th>Servei</th><th>Error</th></tr>${rows}</table>`;
        await sendEmail(notif.emailRecipients, `Resum mensual d'errors`, html);
    }
}, { timezone: TZ });
console.log('Scheduler started.', { TZ, RETRY_ATTEMPTS, RETRY_INTERVAL_MS, ALERT_COOLDOWN_MIN });
