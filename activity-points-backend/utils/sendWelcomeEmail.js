const SibApiV3Sdk = require('sib-api-v3-sdk');

const client = SibApiV3Sdk.ApiClient.instance;
client.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

async function sendWelcomeEmail({ name, email, registerNumber, password }) {
  const appLink = (process.env.FRONTEND_URL || '').trim();
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeRegisterNumber = escapeHtml(registerNumber);
  const safePassword = escapeHtml(password);

  if (!process.env.BREVO_API_KEY || !process.env.FROM_EMAIL) {
    throw new Error('Brevo email configuration is missing');
  }

  await emailApi.sendTransacEmail({
    sender: {
      email: process.env.FROM_EMAIL,
      name: process.env.FROM_NAME || 'Activity Points System',
    },
    to: [{ email }],
    subject: 'Welcome to APMS — Your Account is Ready',
    htmlContent: `
      <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:28px;">
        <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <div style="background:#1e3a8a;color:#fff;padding:24px 28px;">
            <h1 style="margin:0;font-size:24px;">Welcome to APMS, ${safeName}! 🎉</h1>
            <p style="margin:8px 0 0;opacity:.9;">Your Activity Points Management System account is ready.</p>
          </div>
          <div style="padding:28px;">
            <p style="color:#374151;line-height:1.6;">Your account has been created. Use the details below to sign in to APMS.</p>
            <div style="background:#eff6ff;border-radius:12px;padding:18px 20px;margin:22px 0;">
              <p style="margin:6px 0;color:#1e3a8a;"><strong>Register Number:</strong> ${safeRegisterNumber}</p>
              <p style="margin:6px 0;color:#1e3a8a;"><strong>Password:</strong> ${safePassword}</p>
            </div>
            ${appLink ? `
              <div style="text-align:center;margin:28px 0;">
                <a href="${escapeHtml(appLink)}" style="display:inline-block;background:#1e3a8a;color:#fff;text-decoration:none;padding:13px 28px;border-radius:9px;font-weight:700;">Open APMS</a>
              </div>
            ` : ''}
            <p style="color:#6b7280;font-size:13px;line-height:1.5;">
              Your password was randomly generated. You can keep using it or change it later from
              <strong>Reset / Forgot Password</strong> in the APMS login page.
            </p>
            <p style="color:#6b7280;font-size:13px;margin-bottom:0;">If you did not expect this account, please contact your tutor or department administrator.</p>
          </div>
        </div>
      </div>
    `,
  });
}

module.exports = sendWelcomeEmail;
