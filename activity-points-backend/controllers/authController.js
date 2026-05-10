const bcrypt = require('bcryptjs');
const Student = require('../models/Student');
const SibApiV3Sdk = require('sib-api-v3-sdk');

// Brevo client setup
const client = SibApiV3Sdk.ApiClient.instance;
client.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendResetOTPEmail(toEmail, studentName, otp) {
  await emailApi.sendTransacEmail({
    sender: {
      email: process.env.FROM_EMAIL,
      name: process.env.FROM_NAME || 'Activity Points System',
    },
    to: [{ email: toEmail }],
    subject: 'Password Reset OTP - Activity Points System',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 480px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #1e3a8a; margin-bottom: 8px;">Password Reset</h2>
        <p style="color: #374151;">Hi <strong>${studentName}</strong>,</p>
        <p style="color: #374151;">Use the OTP below to reset your password. It expires in <strong>10 minutes</strong>.</p>
        <div style="background: #eff6ff; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #1e3a8a;">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 13px;">If you did not request this, please ignore this email. Your password will remain unchanged.</p>
      </div>
    `,
  });
}

// POST /api/auth/forgot-password
// Accepts: { registerNumber }
// Finds student, generates OTP, emails it
exports.requestPasswordReset = async (req, res) => {
  const { registerNumber } = req.body;
  try {
    if (!registerNumber) return res.status(400).json({ message: 'Register number is required' });

    const student = await Student.findOne({ registerNumber });
    if (!student) return res.status(404).json({ message: 'No account found with that register number' });
    if (!student.isVerified) return res.status(400).json({ message: 'Account not yet verified. Please complete first-time setup.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    student.resetPasswordToken = otp;
    student.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await student.save();

    await sendResetOTPEmail(student.email, student.name, otp);

    // Return masked email so frontend can show "OTP sent to j***@gmail.com"
    const masked = student.email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c);
    res.json({ message: 'OTP sent to your registered email', maskedEmail: masked });
  } catch (error) {
    console.error('Forgot password error:', error.response?.body || error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// POST /api/auth/reset-password
// Accepts: { registerNumber, otp, newPassword }
exports.resetPassword = async (req, res) => {
  const { registerNumber, otp, newPassword } = req.body;
  try {
    if (!registerNumber || !otp || !newPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const student = await Student.findOne({
      registerNumber,
      resetPasswordToken: otp,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!student) return res.status(400).json({ message: 'Invalid or expired OTP' });

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    student.password = await bcrypt.hash(newPassword, 10);
    student.resetPasswordToken = null;
    student.resetPasswordExpires = null;
    await student.save();

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};
