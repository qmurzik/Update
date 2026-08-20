/**
 * Validates Telegram Mini App `initData` per the official algorithm:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 *   secret_key = HMAC_SHA256(key = "WebAppData", data = bot_token)
 *   data_check_string = all "key=value" pairs except "hash", sorted by key, joined with "\n"
 *   hash must equal HEX(HMAC_SHA256(key = secret_key, data = data_check_string))
 *
 * Runs on Web Crypto (SubtleCrypto) — no Node crypto dependency, keeps the
 * Worker bundle free of node:* polyfills.
 */

export interface WebAppUser {
  id: number;
  first_name?: string;
  username?: string;
}

export interface ValidatedInitData {
  user: WebAppUser;
  authDate: number;
}

const MAX_AGE_SECONDS = 24 * 60 * 60; // reject stale initData (replay protection)

async function hmacSha256(key: BufferSource, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function validateInitData(initData: string, botToken: string): Promise<ValidatedInitData | null> {
  if (!initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const pairs: string[] = [];
  for (const key of [...params.keys()].sort()) {
    pairs.push(`${key}=${params.get(key)}`);
  }
  const dataCheckString = pairs.join('\n');

  const secretKey = await hmacSha256(new TextEncoder().encode('WebAppData'), botToken);
  const computed = bufferToHex(await hmacSha256(secretKey, dataCheckString));

  if (computed.length !== hash.length) return null;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
  if (diff !== 0) return null;

  const authDate = parseInt(params.get('auth_date') ?? '0', 10);
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;
  let user: WebAppUser;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return null;
  }
  if (!user || typeof user.id !== 'number') return null;

  return { user, authDate };
}

/** Extracts the initData string from an `Authorization: tma <initData>` header. */
export function extractInitData(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = /^tma\s+(.+)$/.exec(authHeader.trim());
  return match ? match[1] : null;
}
