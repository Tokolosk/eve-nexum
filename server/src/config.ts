import { createHash } from 'node:crypto';

const CORP_ID       = process.env.CORP_ID       ? parseInt(process.env.CORP_ID,       10) : null;
const ADMIN_CHAR_ID = process.env.ADMIN_CHAR_ID ? parseInt(process.env.ADMIN_CHAR_ID, 10) : null;
const CORP_MAP_TIME = parseInt(process.env.CORP_MAP_TIME ?? '30', 10);

if (CORP_ID !== null && ADMIN_CHAR_ID === null) {
  console.error('FATAL: CORP_ID is set but ADMIN_CHAR_ID is missing');
  process.exit(1);
}

const isProd = process.env.NODE_ENV === 'production';

// Session secret must be explicitly set in production — a guessable default
// is a critical session-forgery risk.
if (isProd && !process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET must be set in production');
  process.exit(1);
}

if (isProd && !process.env.EVE_CLIENT_ID) {
  console.error('FATAL: EVE_CLIENT_ID must be set in production');
  process.exit(1);
}

if (isProd && !process.env.EVE_CLIENT_SECRET) {
  console.error('FATAL: EVE_CLIENT_SECRET must be set in production');
  process.exit(1);
}

// 32 bytes (64 hex) for AES-256. Required in prod; derived from SESSION_SECRET
// in dev so first-run developers don't have to generate one. If you change
// SESSION_SECRET in dev, existing encrypted tokens will be unreadable — that's
// fine, they'll be re-issued on next login.
const TOKEN_ENC_HEX = process.env.TOKEN_ENCRYPTION_KEY;
if (isProd && (!TOKEN_ENC_HEX || TOKEN_ENC_HEX.length !== 64)) {
  console.error('FATAL: TOKEN_ENCRYPTION_KEY must be 64 hex chars in production (openssl rand -hex 32)');
  process.exit(1);
}
const tokenEncryptionKey = TOKEN_ENC_HEX
  ?? createHash('sha256').update(`dev-token-key:${process.env.SESSION_SECRET ?? 'dev'}`).digest('hex');

if (tokenEncryptionKey.length !== 64) {
  console.error('FATAL: TOKEN_ENCRYPTION_KEY must be 64 hex characters');
  process.exit(1);
}

export const config = {
  corpMode:            CORP_ID !== null,
  corpId:              CORP_ID,
  adminCharId:         ADMIN_CHAR_ID,
  corpMapExpireDays:   CORP_MAP_TIME,
  maxCorpMaps:         parseInt(process.env.MAX_CORP_MAPS ?? '5', 10),
  sessionSecret:       process.env.SESSION_SECRET ?? 'dev-secret-change-me',
  tokenEncryptionKey,
  isProd,
} as const;
