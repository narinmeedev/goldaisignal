import { prisma } from './prisma';

export async function sendOtpEmail(email: string, otp: string) {
  console.log(`[EMAIL OTP] To: ${email}, OTP Code: ${otp}`);
  
  // Store in SystemSetting for test/fallback retrieval in dev mode or sandbox
  await prisma.systemSetting.upsert({
    where: { key: `otp_${email}` },
    update: { value: JSON.stringify({ otp, expiresAt: Date.now() + 5 * 60 * 1000 }) },
    create: { key: `otp_${email}`, value: JSON.stringify({ otp, expiresAt: Date.now() + 5 * 60 * 1000 }) }
  });

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD;

  const subject = 'รหัสผ่าน OTP ยืนยันตัวตน Gold AI';
  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #ffffff; color: #1f2937;">
      <h2 style="color: #f59e0b; text-align: center;">ยืนยันอีเมลของคุณ</h2>
      <p>สวัสดีครับ,</p>
      <p>รหัสสำหรับยืนยันตัวตนเพื่อสมัครสมาชิกระบบ Gold AI ของคุณคือ:</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #10b981; background-color: #f3f4f6; padding: 10px 20px; border-radius: 8px; display: inline-block;">${otp}</span>
      </div>
      <p style="color: #6b7280; font-size: 12px; text-align: center;">รหัสนี้มีอายุการใช้งาน 5 นาที หากคุณไม่ได้สมัครสมาชิก โปรดเพิกเฉยต่ออีเมลฉบับนี้</p>
    </div>
  `;

  // 1. If SMTP is configured, use nodemailer
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort || '465'),
        secure: smtpPort === '465' || !smtpPort, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const mailOptions = {
        from: `"Gold AI" <${smtpUser}>`,
        to: email,
        subject: subject,
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[SMTP EMAIL OTP] Sent successfully via SMTP. MessageId: ${info.messageId}`);
      return true;
    } catch (smtpError) {
      console.error('[SMTP EMAIL OTP ERROR] Failed to send via SMTP:', smtpError);
      // Fall through to Resend if SMTP fails
    }
  }

  // 2. Fallback to Resend HTTP API
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`Neither SMTP nor RESEND_API_KEY is configured. Stored in SystemSetting key 'otp_${email}' for local testing.`);
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'Gold AI <onboarding@resend.dev>',
        to: email,
        subject: subject,
        html: htmlContent,
      }),
    });
    
    if (res.ok) {
      console.log(`[RESEND EMAIL OTP] Sent successfully via Resend HTTP API.`);
    }
    return res.ok;
  } catch (error) {
    console.error('[RESEND EMAIL OTP ERROR] Failed to send via Resend API:', error);
    return false;
  }
}

export async function sendPasswordResetEmail(email: string, otp: string) {
  console.log(`[PASSWORD RESET OTP] To: ${email}, OTP Code: ${otp}`);
  
  // Store in SystemSetting for test/fallback retrieval in dev mode or sandbox
  await prisma.systemSetting.upsert({
    where: { key: `otp_reset_${email}` },
    update: { value: JSON.stringify({ otp, expiresAt: Date.now() + 5 * 60 * 1000 }) },
    create: { key: `otp_reset_${email}`, value: JSON.stringify({ otp, expiresAt: Date.now() + 5 * 60 * 1000 }) }
  });

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD;

  const subject = 'รหัสผ่าน OTP เพื่อตั้งค่ารหัสผ่านใหม่ - Gold AI';
  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #ffffff; color: #1f2937;">
      <h2 style="color: #f59e0b; text-align: center;">รีเซ็ตรหัสผ่านบัญชีของคุณ</h2>
      <p>สวัสดีครับ,</p>
      <p>คุณได้ทำการร้องขอรีเซ็ตรหัสผ่านบัญชีของคุณ รหัสผ่าน OTP สำหรับยืนยันการตั้งค่ารหัสผ่านใหม่คือ:</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #f59e0b; background-color: #f3f4f6; padding: 10px 20px; border-radius: 8px; display: inline-block;">${otp}</span>
      </div>
      <p style="color: #6b7280; font-size: 12px; text-align: center;">รหัสนี้มีอายุการใช้งาน 5 นาที หากคุณไม่ได้ส่งคำขอนี้ โปรดระวังความปลอดภัยของบัญชีท่าน</p>
    </div>
  `;

  // 1. If SMTP is configured, use nodemailer
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort || '465'),
        secure: smtpPort === '465' || !smtpPort,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const mailOptions = {
        from: `"Gold AI" <${smtpUser}>`,
        to: email,
        subject: subject,
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[SMTP RESET OTP] Sent successfully via SMTP. MessageId: ${info.messageId}`);
      return true;
    } catch (smtpError) {
      console.error('[SMTP RESET OTP ERROR] Failed to send via SMTP:', smtpError);
    }
  }

  // 2. Fallback to Resend HTTP API
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`Neither SMTP nor RESEND_API_KEY is configured. Stored in SystemSetting key 'otp_reset_${email}' for local testing.`);
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'Gold AI <onboarding@resend.dev>',
        to: email,
        subject: subject,
        html: htmlContent,
      }),
    });
    
    if (res.ok) {
      console.log(`[RESEND RESET OTP] Sent successfully via Resend HTTP API.`);
    }
    return res.ok;
  } catch (error) {
    console.error('[RESEND RESET OTP ERROR] Failed to send via Resend API:', error);
    return false;
  }
}
