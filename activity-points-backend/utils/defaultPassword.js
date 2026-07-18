/**
 * utils/defaultPassword.js
 *
 * Generates a student's default password as: firstName (lowercase) + birth year.
 * e.g. name = "Arjun Menon", dateOfBirth = "2004-08-15"  ->  "arjun2004"
 *
 * Used when a tutor adds a student (single-add or CSV) so the student has a
 * working password from the moment their account is created — no OTP-based
 * first-time setup step needed. Students should change this via the
 * "Reset / Forgot Password" flow after their first login.
 */

function generateDefaultPassword(name, dateOfBirth) {
  const firstName = (name || '')
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase()
    .replace(/[^a-z]/g, '') || 'student';

  const year = new Date(dateOfBirth).getFullYear();
  const safeYear = Number.isFinite(year) ? year : '0000';

  return `${firstName}${safeYear}`;
}

module.exports = generateDefaultPassword;
