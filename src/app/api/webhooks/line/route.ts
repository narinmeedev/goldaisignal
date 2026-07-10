import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    
    // 1. Get LINE Channel Credentials from Settings
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: { in: ['LINE_CHANNEL_ID', 'LINE_CHANNEL_SECRET'] }
      }
    });
    const settingsMap = new Map(settings.map(s => [s.key, s.value]));
    
    const channelId = settingsMap.get('LINE_CHANNEL_ID');
    const channelSecret = settingsMap.get('LINE_CHANNEL_SECRET');

    if (!channelId || !channelSecret) {
      console.error('LINE webhook received but credentials are not configured in settings.');
      return NextResponse.json({ error: 'LINE_CREDENTIALS_NOT_CONFIGURED' }, { status: 400 });
    }

    // 2. Validate LINE Signature
    const signature = request.headers.get('x-line-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const expectedSignature = crypto
      .createHmac('SHA256', channelSecret.trim())
      .update(rawBody)
      .digest('base64');

    if (expectedSignature !== signature) {
      console.error('LINE Webhook Signature Validation Failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const events = payload.events || [];

    // 3. Issue Channel Access Token
    const accessToken = await getLineAccessToken(channelId.trim(), channelSecret.trim());
    if (!accessToken) {
      console.error('Failed to issue LINE access token.');
      return NextResponse.json({ error: 'TOKEN_ISSUANCE_FAILED' }, { status: 500 });
    }

    // 4. Process LINE Events
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const replyToken = event.replyToken;
        const lineUserId = event.source.userId;
        const text = event.message.text.trim();

        // Check if text input is a valid email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
        if (emailRegex.test(text)) {
          const emailInput = text.toLowerCase();

          // Query user by email
          const user = await prisma.user.findUnique({
            where: { email: emailInput }
          });

          if (user) {
            // Update user lineId
            await prisma.user.update({
              where: { id: user.id },
              data: { lineId: lineUserId }
            });

            await replyToLine(accessToken, replyToken, `✅ เชื่อมต่อบัญชีสำเร็จแล้ว!\n\nระบบได้เชื่อมโยงบัญชี LINE ของคุณกับอีเมล ${user.email} เรียบร้อยแล้ว ต่อไปนี้คุณจะได้รับสัญญาณซื้อขายทองคำและรายงานเป้าหมายตรงสู่แชทนี้ทันทีครับ 🚀`);
          } else {
            await replyToLine(accessToken, replyToken, `❌ ไม่พบอีเมลนี้ในระบบ\n\nกรุณาตรวจสอบว่าพิมพ์อีเมลถูกต้อง หรือทำการสมัครสมาชิกที่เว็บไซต์ goldaisig.com เรียบร้อยแล้ว`);
          }
        } else {
          // Send instructions
          await replyToLine(accessToken, replyToken, `👋 สวัสดีครับ ยินดีต้อนรับสู่ Gold AI Signal!\n\nกรุณาพิมพ์ *อีเมล* ที่คุณใช้สมัครสมาชิกในเว็บไซต์ เพื่อทำการเชื่อมต่อแชท LINE นี้เข้ากับระบบแจ้งเตือนจุดเข้าซื้อขายทองคำครับ\n\n(ตัวอย่าง: email@example.com)`);
        }
      } else if (event.type === 'follow') {
        const replyToken = event.replyToken;
        await replyToLine(accessToken, replyToken, `👋 สวัสดีครับ ยินดีต้อนรับสู่ Gold AI Signal!\n\nขอบคุณที่ติดตามบอทแจ้งเตือนสัญญาณเทรดทองคำของเราครับ\n\nกรุณาพิมพ์ *อีเมล* ที่คุณใช้สมัครสมาชิกในระบบ เพื่อเริ่มต้นเชื่อมต่อสัญญาณส่งตรงถึงมือถือคุณครับ`);
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (err: any) {
    console.error('Error handling LINE webhook:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

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

async function replyToLine(accessToken: string, replyToken: string, text: string) {
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text }]
      }),
    });
  } catch (err) {
    console.error('Failed to reply to LINE:', err);
  }
}
