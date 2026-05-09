const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');
const SibApiV3Sdk = require('sib-api-v3-sdk');

// Brevo (Sendinblue) client setup
const client = SibApiV3Sdk.ApiClient.instance;
client.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

// Send password reset email via Brevo
async function sendResetEmail(toEmail, resetUrl) {
  const sendSmtpEmail = {
    sender: {
      email: process.env.FROM_EMAIL,
      name: process.env.FROM_NAME || 'Activity Points System',
    },
    to: [{ email: toEmail }],
    subject: 'Password Reset Request - Activity Points System',
    htmlContent: `
      <div style="font-family: Arial; padding: 20px; max-width: 500px;">
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password.</p>
        <p>Click the button below to reset it:</p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:10px 20px;background:#4F46E5;
           color:white;text-decoration:none;border-radius:5px;margin-top:10px;">
           Reset Password
        </a>
        <p style="margin-top:15px;color:#666;">This link expires in 1 hour. If you did not request this, ignore this email.</p>
      </div>
    `,
  };
  await emailApi.sendTransacEmail(sendSmtpEmail);
}

// POST /api/auth/forgot-password
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await Student.findOne({ email });
    if (!user) return res.status(404).json({ message: 'No account found with that email' });

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await sendResetEmail(email, resetUrl);

    res.json({ message: 'Password reset link sent to your email' });
  } catch (error) {
    console.error('Password reset error:', error.response?.body || error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const user = await Student.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: 'Reset link is invalid or has expired' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password updated successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};
