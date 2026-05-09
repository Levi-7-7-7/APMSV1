const SibApiV3Sdk = require('sib-api-v3-sdk');

// Brevo (Sendinblue) transactional email
const client = SibApiV3Sdk.ApiClient.instance;
client.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

const sendOTPEmail = async (email, otp) => {
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

  await apiInstance.sendTransacEmail({
    sender: {
      email: process.env.FROM_EMAIL,
      name: process.env.FROM_NAME || 'Activity Points System',
    },
    to: [{ email }],
    subject: 'Your OTP Code - Activity Points System',
    htmlContent: `
      <div style="font-family: Arial; padding: 20px; max-width: 400px;">
        <h2>Your OTP Code</h2>
        <p>Use this code to complete your login:</p>
        <h1 style="color:#4F46E5; letter-spacing: 6px;">${otp}</h1>
        <p style="color:#666;">This code expires in <strong>5 minutes</strong>.</p>
        <p style="color:#999; font-size:0.85rem;">If you didn't request this, ignore this email.</p>
      </div>
    `,
  });

  console.log(`OTP email sent to ${email}`);
};

module.exports = sendOTPEmail;
