import nodemailer from 'nodemailer';
import { Expo } from 'expo-server-sdk';
import { prisma } from './db.js';
const expo = new Expo();
export const notifRouter = async (app) => {
    app.addHook('preHandler', app.authenticate);
    app.get('/api/notif/settings', async (req, reply) => {
        // @ts-ignore
        const userId = req.user.id;
        let settings = await prisma.notificationSettings.findUnique({ where: { userId } });
        if (!settings) {
            settings = await prisma.notificationSettings.create({ data: { userId, emailRecipients: [] } });
        }
        return settings;
    });
    app.put('/api/notif/settings', async (req, reply) => {
        // @ts-ignore
        const userId = req.user.id;
        const { emailRecipients, dailyDigest, monthlyDigest } = req.body || {};
        const settings = await prisma.notificationSettings.upsert({
            where: { userId },
            update: { emailRecipients, dailyDigest, monthlyDigest },
            create: {
                userId,
                emailRecipients: emailRecipients || [],
                dailyDigest: !!dailyDigest,
                monthlyDigest: !!monthlyDigest
            }
        });
        return settings;
    });
    app.post('/api/notif/connect-token', async (req, reply) => {
        // @ts-ignore
        const userId = req.user.id;
        const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        const settings = await prisma.notificationSettings.upsert({
            where: { userId },
            update: { connectToken: token },
            create: { userId, emailRecipients: [], connectToken: token }
        });
        return { token: settings.connectToken };
    });
    app.post('/api/push/register', async (req, reply) => {
        // @ts-ignore
        const userId = req.user.id;
        const { expoToken } = req.body || {};
        if (!expoToken)
            return reply.code(400).send({ error: 'Missing expoToken' });
        try {
            await prisma.pushDevice.create({ data: { userId, expoToken } });
        }
        catch {
            // ignore duplicates
        }
        return { ok: true };
    });
};
// ---------- Enviadors ----------
export async function sendEmail(to, subject, html) {
    if (!to || to.length === 0)
        return;
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 465),
        secure: (process.env.SMTP_SECURE || 'true') === 'true', // SendGrid: false + 587 | Gmail: true + 465
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
    // ✉️ FROM controlat per variables d’entorn (ha de coincidir amb una identitat verificada a SendGrid)
    const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || 'botmailmonitorip@gmail.com';
    const fromName = process.env.FROM_NAME || 'Bot Monitor IP';
    await transporter.sendMail({
        from: `${fromName} <${fromEmail}>`,
        to: to.join(','),
        subject,
        html,
    });
}
export async function sendPush(userId, title, body) {
    const devices = await prisma.pushDevice.findMany({ where: { userId } });
    const messages = devices
        .filter(d => Expo.isExpoPushToken(d.expoToken))
        .map(d => ({
        to: d.expoToken,
        sound: 'default',
        title,
        body,
    }));
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
        try {
            await expo.sendPushNotificationsAsync(chunk);
        }
        catch (e) {
            console.error('Expo push error:', e);
        }
    }
}
