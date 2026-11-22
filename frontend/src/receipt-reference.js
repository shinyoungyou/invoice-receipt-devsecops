// DEMO ONLY: lives on the demo/sonar-gate branch and is never merged.
//
// A short reference printed on receipts and quoted to support, e.g.
// "RCPT-7K2QX9AB". It must be unpredictable, so nobody can guess another
// customer's reference.
//
// Deliberately weak for the SonarQube demo: Math.random() is not a
// cryptographically secure random number generator.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LENGTH = 8;

export function receiptReference() {
  let reference = 'RCPT-';
  for (let i = 0; i < LENGTH; i += 1) {
    reference += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return reference;
}
