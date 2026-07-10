import { prisma } from '../prisma';

async function getLineAccessToken(channelId: string, channelSecret: string): Promise<string | null> {
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', channelId);
    params.append('client_secret', channelSecret);

    const res = await fetch('https://api.line.me/v2/oauth/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (res.ok) {
      const data = await res.json();
      return data.access_token;
    }
    return null;
  } catch {
    return null;
  }
}

async function sendLinePushMessage(accessToken: string, to: string, text: string) {
  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to,
        messages: [{ type: 'text', text }]
      }),
    });
  } catch (err) {
    console.error('Failed to send LINE push message:', err);
  }
}

export class NotificationService {
  /**
   * Sends a push notification to LINE Notify and/or Telegram Bot based on configuration.
   */
  static async sendNotification(message: string): Promise<void> {
    try {
      // 1. Fetch credentials from database settings
      const settings = await prisma.systemSetting.findMany({
        where: {
          key: {
            in: [
              'LINE_NOTIFY_TOKEN',
              'TELEGRAM_BOT_TOKEN',
              'TELEGRAM_CHAT_ID',
              'LINE_CHANNEL_ID',
              'LINE_CHANNEL_SECRET'
            ]
          }
        }
      });

      const settingsMap = new Map(settings.map(s => [s.key, s.value]));

      const lineToken = settingsMap.get('LINE_NOTIFY_TOKEN') || process.env.LINE_NOTIFY_TOKEN;
      const telegramToken = settingsMap.get('TELEGRAM_BOT_TOKEN') || process.env.TELEGRAM_BOT_TOKEN;
      const telegramChatId = settingsMap.get('TELEGRAM_CHAT_ID') || process.env.TELEGRAM_CHAT_ID;
      const lineChannelId = settingsMap.get('LINE_CHANNEL_ID');
      const lineChannelSecret = settingsMap.get('LINE_CHANNEL_SECRET');

      // 2. Send LINE Notify
      if (lineToken && lineToken.trim()) {
        try {
          const body = new URLSearchParams();
          body.append('message', message);

          const res = await fetch('https://notify-api.line.me/api/notify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Bearer ${lineToken.trim()}`,
            },
            body: body,
          });

          if (!res.ok) {
            const errText = await res.text();
            console.error(`LINE Notify returned status ${res.status}: ${errText}`);
          }
        } catch (err) {
          console.error('Error sending LINE Notify message:', err);
        }
      }

      // 3. Send Telegram message
      if (telegramToken && telegramToken.trim() && telegramChatId && telegramChatId.trim()) {
        try {
          const res = await fetch(`https://api.telegram.org/bot${telegramToken.trim()}/sendMessage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: telegramChatId.trim(),
              text: message,
              parse_mode: 'Markdown',
            }),
          });

          if (!res.ok) {
            const errText = await res.text();
            console.error(`Telegram Bot returned status ${res.status}: ${errText}`);
          }
        } catch (err) {
          console.error('Error sending Telegram message:', err);
        }
      }

      // 4. Send individual push messages to all active users with linked LINE accounts
      if (lineChannelId && lineChannelSecret) {
        const activeLineUsers = await prisma.user.findMany({
          where: {
            lineId: { not: null },
            subscriptionStatus: 'active',
            OR: [
              { subscriptionEndsAt: null },
              { subscriptionEndsAt: { gte: new Date() } },
            ],
          },
          select: { lineId: true }
        });

        if (activeLineUsers.length > 0) {
          const lineAccessToken = await getLineAccessToken(lineChannelId, lineChannelSecret);
          if (lineAccessToken) {
            for (const user of activeLineUsers) {
              if (user.lineId) {
                // Remove Markdown markers for LINE messaging since LINE API doesn't support Markdown
                const cleanText = message.replace(/\*/g, '');
                await sendLinePushMessage(lineAccessToken, user.lineId, cleanText);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('NotificationService failed to evaluate settings or send messages:', err);
    }
  }
}
