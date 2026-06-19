// Symmetric encryption for secrets at rest (per-user OpenAI keys). AES-256-GCM with a key derived
// from AI_KEY_ENCRYPTION_SECRET. Set that env to a strong random value in production — without it
// the derived key is fixed and the encryption is effectively obfuscation only.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const keyFromSecret = (): Buffer =>
  createHash("sha256").update(process.env.AI_KEY_ENCRYPTION_SECRET ?? "dd-dev-key").digest();

/** Encrypt a plaintext secret to an `iv:tag:ciphertext` (base64) blob. */
export const encryptSecret = (plain: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
};

/** Decrypt a blob produced by encryptSecret; null on any tampering/format/key mismatch. */
export const decryptSecret = (blob: string): string | null => {
  try {
    const [ivB, tagB, ctB] = blob.split(":");
    if (!ivB || !tagB || !ctB) return null;
    const decipher = createDecipheriv("aes-256-gcm", keyFromSecret(), Buffer.from(ivB, "base64"));
    decipher.setAuthTag(Buffer.from(tagB, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ctB, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
};
