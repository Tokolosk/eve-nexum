import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from '../config.js';

// AES-256-GCM. 12-byte IV (GCM standard), 16-byte auth tag. Wire format:
//   "enc:v1:" + base64(iv || tag || ciphertext)
// The prefix lets us distinguish legacy plaintext rows from encrypted ones
// during the rolling migration in migrate.ts.

const ALGO    = 'aes-256-gcm';
const PREFIX  = 'enc:v1:';
const IV_LEN  = 12;
const TAG_LEN = 16;

const key = Buffer.from(config.tokenEncryptionKey, 'hex');

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

// Returns the value as-is when it lacks the prefix — that's a legacy plaintext
// row that hasn't been migrated yet.
export function decryptToken(value: string): string {
  if (!value.startsWith(PREFIX)) return value;
  const buf = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv  = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct  = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}
