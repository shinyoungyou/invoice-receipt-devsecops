// DEMO ONLY: lives on the demo/sonar-gate branch and is never merged.
//
// A short reference printed on receipts and quoted to support, e.g.
// "RCPT-7K2QX9AB". It must be unpredictable, so nobody can guess another
// customer's reference.
//
// Uses crypto.getRandomValues(), a cryptographically secure generator.
// The first version used Math.random(), which is predictable; SonarQube
// Cloud did not flag it, so this was caught by review, not by the scanner.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LENGTH = 8;

export function receiptReference() {
  const bytes = crypto.getRandomValues(new Uint8Array(LENGTH));
  let reference = 'RCPT-';
  for (const byte of bytes) {
    // 256 is a multiple of the 32-character alphabet, so `byte % 32` is
    // uniform (no modulo bias).
    reference += ALPHABET[byte % ALPHABET.length];
  }
  return reference;
}
