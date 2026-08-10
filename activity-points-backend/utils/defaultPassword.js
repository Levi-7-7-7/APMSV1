const crypto = require('crypto');

// Generates a secure random password for newly created accounts.
// Ambiguous characters (0/O, 1/l/I) are excluded for readability.
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const LENGTH = 10;

function generateDefaultPassword(_name) {
  let password = '';
  for (let i = 0; i < LENGTH; i++) {
    password += CHARSET[crypto.randomInt(0, CHARSET.length)];
  }
  return password;
}

module.exports = generateDefaultPassword;
