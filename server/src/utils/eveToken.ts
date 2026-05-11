import { db } from '../db.js';

const CLIENT_ID     = process.env.EVE_CLIENT_ID!;
const CLIENT_SECRET = process.env.EVE_CLIENT_SECRET!;
const EVE_TOKEN_URL = 'https://login.eveonline.com/v2/oauth/token';

interface TokenRow {
  access_token: string;
  refresh_token: string;
  token_expires_at: Date;
  character_id: number;
}

export async function getValidToken(userId: number): Promise<string> {
  const { rows } = await db.query<TokenRow>(
    `SELECT access_token, refresh_token, token_expires_at, character_id
     FROM users WHERE id = $1`,
    [userId],
  );

  if (!rows.length) throw new Error('User not found');
  const row = rows[0];

  // Return existing token if still valid (with 60s buffer)
  if (new Date(row.token_expires_at).getTime() - Date.now() > 60_000) {
    return row.access_token;
  }

  // Refresh the token
  const res = await fetch(EVE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: row.refresh_token,
    }),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);

  const tokens = await res.json() as { access_token: string; refresh_token: string; expires_in: number };
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await db.query(
    `UPDATE users SET access_token = $1, refresh_token = $2, token_expires_at = $3, updated_at = NOW()
     WHERE id = $4`,
    [tokens.access_token, tokens.refresh_token, expiresAt, userId],
  );

  return tokens.access_token;
}
