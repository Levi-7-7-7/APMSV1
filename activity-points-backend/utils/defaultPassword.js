/**
 * utils/defaultPassword.js
 *
 * Generates a student's default password as: firstName (lowercase) + "12345".
 * e.g. name = "Arjun Menon"  ->  "arjun12345"
 *
 * Used when a tutor adds a student (single-add or CSV) so the student has a
 * working password from the moment their account is created — no OTP-based
 * first-time setup step needed. Students should change this via the
 * "Reset / Forgot Password" flow after their first login.
 */

function generateDefaultPassword(name) {
  const firstName = (name || '')
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase()
    .replace(/[^a-z]/g, '') || 'student';

  return `${firstName}12345`;
}

module.exports = generateDefaultPassword;
