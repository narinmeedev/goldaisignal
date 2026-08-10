import { prisma } from '../prisma';

let cachedLineAccessToken: {
  channelId: string;
  token: string;
  expiresAt: number;
} | null = null;

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Unknown error';

async function getLineAccessToken(channelId: string, channelSecret: string): Promise<string | null> {
  if (
    cachedLineAccessToken?.channelId === channelId &&
    cachedLineAccessToken.expiresAt > Date.now()
  ) {
    return cachedLineAccessToken.token;
  }

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
      const expiresInMs = Math.max(60_000, Number(data.expires_in || 0) * 1000 - 5 * 60_000);
      cachedLineAccessToken = {
        channelId,
        token: data.access_token,
        expiresAt: Date.now() + expiresInMs,
      };
      return data.access_token;
    }
    const errText = await res.text();
    console.error(`LINE access token returned status ${res.status}: ${errText}`);
    return null;
  } catch (err) {
    console.error('Failed to obtain LINE access token:', err);
    return null;
  }
}

async function sendLinePushMessage(accessToken: string, to: string, text: string) {
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
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
    if (!res.ok) {
      const errText = await res.text();
      console.error(`LINE push returned status ${res.status}: ${errText}`);
      return { success: false, status: res.status, error: errText };
    }
    return { success: true, status: res.status };
  } catch (error) {
    console.error('Failed to send LINE push message:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

async function sendLineNotifyMessage(token: string, text: string) {
  try {
    const params = new URLSearchParams();
    params.append('message', text);

    const res = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${token.trim()}`,
      },
      body: params,
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`LINE Notify returned status ${res.status}: ${errText}`);
      return { success: false, status: res.status, error: errText };
    }
    return { success: true, status: res.status };
  } catch (error) {
    console.error('Failed to send LINE Notify message:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export interface NotificationResult {
  lineUsers?: { success: boolean; error?: string; count?: number; failedCount?: number };
  lineNotify?: { success: boolean; error?: string };
}

export class NotificationService {
  static async verifyConfiguration(): Promise<{ success: boolean; error?: string }> {
    try {
      const settings = await prisma.systemSetting.findMany({
        where: { key: { in: ['LINE_CHANNEL_ID', 'LINE_CHANNEL_SECRET', 'LINE_NOTIFY_TOKEN'] } },
      });
      const settingsMap = new Map(settings.map((setting) => [setting.key, setting.value]));
      const channelId = settingsMap.get('LINE_CHANNEL_ID') || process.env.LINE_CHANNEL_ID;
      const channelSecret = settingsMap.get('LINE_CHANNEL_SECRET') || process.env.LINE_CHANNEL_SECRET;
      const notifyToken = settingsMap.get('LINE_NOTIFY_TOKEN') || process.env.LINE_NOTIFY_TOKEN;

      if (notifyToken) {
        return { success: true };
      }

      if (!channelId || !channelSecret) {
        return { success: false, error: 'LINE Token / LINE Messaging API is not configured.' };
      }

      const token = await getLineAccessToken(channelId, channelSecret);
      return token
        ? { success: true }
        : { success: false, error: 'LINE credentials were rejected.' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to verify LINE configuration.',
      };
    }
  }

  /**
   * Sends a LINE push / LINE Notify message to admins or subscribers.
   */
  static async sendNotification(
    message: string,
    overrides?: { testLineUserId?: string }
  ): Promise<NotificationResult> {
    const result: NotificationResult = {};
    try {
      // 1. Fetch credentials from database settings
      const settings = await prisma.systemSetting.findMany({
        where: {
          key: {
            in: [
              'LINE_CHANNEL_ID',
              'LINE_CHANNEL_SECRET',
              'LINE_NOTIFY_TOKEN'
            ]
          }
        }
      });

      const settingsMap = new Map(settings.map(s => [s.key, s.value]));

      const lineChannelId = settingsMap.get('LINE_CHANNEL_ID') || process.env.LINE_CHANNEL_ID;
      const lineChannelSecret = settingsMap.get('LINE_CHANNEL_SECRET') || process.env.LINE_CHANNEL_SECRET;
      const lineNotifyToken = settingsMap.get('LINE_NOTIFY_TOKEN') || process.env.LINE_NOTIFY_TOKEN;

      const cleanText = message.replace(/\*/g, '');

      // 2. Send via LINE Notify if token is configured
      if (lineNotifyToken) {
        const notifyRes = await sendLineNotifyMessage(lineNotifyToken, cleanText);
        result.lineNotify = notifyRes;
        if (notifyRes.success) {
          console.info('[Notification] Delivered via LINE Notify API.');
        }
      }

      // 3. Send LINE Messaging API notifications.
      if (lineChannelId && lineChannelSecret) {
        try {
          const lineAccessToken = await getLineAccessToken(lineChannelId, lineChannelSecret);
          if (lineAccessToken) {
            if (overrides?.testLineUserId) {
              // Option A: Send push to specific test user ID
              const testResult = await sendLinePushMessage(
                lineAccessToken,
                overrides.testLineUserId.trim(),
                cleanText
              );
              if (!testResult.success) {
                result.lineUsers = {
                  success: false,
                  count: 0,
                  failedCount: 1,
                  error: `Test Push failed: ${testResult.error || `HTTP ${testResult.status}`}`,
                };
              } else {
                result.lineUsers = { success: true, count: 1, failedCount: 0 };
              }
            } else {
              // Default: send individual push messages to all connected LINE users (Admins & Subscribers)
              const activeLineUsers = await prisma.user.findMany({
                where: {
                  lineId: { not: null },
                  OR: [
                    { role: 'ADMIN' },
                    { subscriptionStatus: 'active' },
                    { subscriptionEndsAt: null },
                    { subscriptionEndsAt: { gte: new Date() } },
                  ],
                },
                select: { lineId: true }
              });

              if (activeLineUsers.length > 0) {
                let sentCount = 0;
                let failedCount = 0;
                for (const user of activeLineUsers) {
                  if (user.lineId) {
                    const pushResult = await sendLinePushMessage(lineAccessToken, user.lineId, cleanText);
                    if (pushResult.success) sentCount++;
                    else failedCount++;
                  }
                }

                if (failedCount > 0) {
                  result.lineUsers = {
                    success: false,
                    count: sentCount,
                    failedCount,
                    error: `${failedCount} of ${activeLineUsers.length} LINE pushes failed.`,
                  };
                  console.error(`[Notification] LINE push failed for ${failedCount} recipient(s).`);
                } else {
                  result.lineUsers = { success: true, count: sentCount, failedCount: 0 };
                  console.info(`[Notification] LINE push delivered to ${sentCount} recipient(s).`);
                }
              } else {
                result.lineUsers = { success: true, count: 0, failedCount: 0 };
                console.info('[Notification] No eligible LINE Bot recipients found.');
              }
            }
          } else {
            result.lineUsers = { success: false, error: 'Failed to obtain LINE Channel Access Token.' };
          }
        } catch (error) {
          console.error('Error sending LINE Channel messages:', error);
          result.lineUsers = { success: false, error: getErrorMessage(error) };
        }
      } else if (!lineNotifyToken) {
        result.lineUsers = { success: false, error: 'LINE Messaging API / LINE Notify is not configured.' };
      }
    } catch (error) {
      console.error('NotificationService failed to evaluate settings or send messages:', error);
      result.lineUsers = { success: false, error: getErrorMessage(error) };
    }
    return result;
  }
}
