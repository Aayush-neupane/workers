const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no lookalikes

/** Human-readable referral code, e.g. GITA-4F8K2Q. */
export function referralCodeFor(name: string, rand: () => number = Math.random): string {
  const stem = (name || "SAJILO").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "SAJILO";
  let tail = "";
  for (let i = 0; i < 6; i++) tail += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return `${stem}-${tail}`;
}

export function normalizeReferral(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}
