import { FastifyInstance } from 'fastify';
import { prisma } from './db.js';

// Helper per construir l’URL de l’API del bot
function botApi(path: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN no definit');
  return `https://api.telegram.org/bot${token}${path}`;
}

// Configura el webhook cap al teu backend (PUBLIC_BASE_URL ha d’apuntar al domini públic del backend)
export async function ensureTelegramWebhook() {
  const publicBase = process.env.PUBLIC_BASE_URL;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !publicBase) return;

  const url = `${publicBase}/api/telegram/webhook`;
  try {
    const res = await fetch(botApi('/setWebhook'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('Failed to set Telegram webhook', res.status, txt);
    } else {
      console.log('Telegram webhook set:', url);
    }
  } catch (e) {
    console.error('Failed to set Telegram webhook', e);
  }
}

// Registre de rutes del webhook
export function telegramRouter(app: FastifyInstance) {
  app.post('/api/telegram/webhook', async (req, reply) => {
    const body = (req.body as any) || {};
    const message = body.message || body.edited_message;
    if (!message) return { ok: true };

    const chatId = String(message.chat?.id ?? '');
    const text: string = String(message.text || '').trim();

    if (!chatId) return { ok: true };

    // /start <token> per vincular el xat a l’usuari
    if (text.startsWith('/start')) {
      const token = text.split(' ')[1];
      if (!token) {
        await sendTelegram(
          chatId,
          'Benvingut/da! Per vincular el teu compte, ves a Configuració > Telegram i envia el codi que hi veus: /start <codi>.'
        );
        return { ok: true };
      }
      const settings = await prisma.notificationSettings.findFirst({ where: { connectToken: token } });
      if (!settings) {
        await sendTelegram(chatId, 'Codi invàlid. Torna a generar el token a la configuració.');
        return { ok: true };
      }
      await prisma.notificationSettings.update({
        where: { userId: settings.userId },
        data: { telegramChatId: chatId },
      });
      await sendTelegram(chatId, `✅ Connectat! Rebràs avisos d'errors aquí.`);
      return { ok: true };
    }

    if (text === '/help') {
      await sendTelegram(chatId, 'Comandes: /start <token> per vincular, /stop per deixar de rebre avisos.');
      return { ok: true };
    }

    if (text === '/stop') {
      const s = await prisma.notificationSettings.findFirst({ where: { telegramChatId: chatId } });
      if (s) {
        await prisma.notificationSettings.update({
          where: { userId: s.userId },
          data: { telegramChatId: null },
        });
      }
      await sendTelegram(chatId, '🔕 Desvinculat. Ja no rebràs avisos.');
      return { ok: true };
    }

    return { ok: true };
  });
}

// Enviament simple a un chatId conegut
export async function sendTelegram(chatId: string, text: string) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  await fetch(botApi('/sendMessage'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

// Enviament a l’usuari de la teva app (busca el chatId a NotificationSettings)
export async function notifyTelegram(userId: string, text: string) {
  try {
    const settings = await prisma.notificationSettings.findUnique({ where: { userId } });
    const chatId = settings?.telegramChatId;
    if (!chatId || !process.env.TELEGRAM_BOT_TOKEN) return;

    await fetch(botApi('/sendMessage'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    console.error('notifyTelegram error:', e);
  }
}
