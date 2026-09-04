import type { Env } from './config';
import { timingSafeEqual } from './security';

const QUICKPAY_BASE = 'https://yoomoney.ru/quickpay/confirm.xml';

/**
 * Builds a ЮMoney Quickpay ("shop" form) payment URL — this is the classic
 * personal-wallet API (receiver = wallet account number), not YooKassa's
 * merchant REST API. No request/auth needed to build it: anyone can
 * construct this URL, the wallet owner only needs to enable HTTP-
 * notifications (see verifyNotificationSignature below) in their wallet
 * settings once. `label` becomes the ONE thing tying the eventual
 * notification back to our own payment_orders row.
 */
export function buildQuickpayUrl(env: Env, opts: { orderId: string; amount: number; description: string; successUrl: string }): string {
  const qs = new URLSearchParams({
    receiver: env.YOOMONEY_WALLET,
    'quickpay-form': 'shop',
    targets: opts.description,
    sum: opts.amount.toFixed(2),
    label: opts.orderId,
    successURL: opts.successUrl,
  });
  return `${QUICKPAY_BASE}?${qs.toString()}`;
}

/** Fields ЮMoney POSTs (application/x-www-form-urlencoded) to the notification URL configured in wallet settings. */
export interface YooMoneyNotification {
  notification_type: string;
  operation_id: string;
  amount: string;
  withdraw_amount: string;
  currency: string;
  datetime: string;
  sender: string;
  codepro: string;
  label: string;
  unaccepted: string;
  /** Current signature field — see verifyNotificationSignature. Empty on notifications from before ЮMoney's sha1_hash→sign migration, which we no longer support (see git history for the old scheme). */
  sign: string;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies the `sign` field ЮMoney sends with every notification — this
 * used to be `sha1_hash` (plain SHA1 over a fixed, short list of fields
 * with the secret concatenated in the middle), but live production
 * notifications no longer carry that field at all; they carry `sign`
 * instead, a 64-hex-char (SHA-256-length) value. Per ЮMoney's current
 * docs, the algorithm is: take every notification parameter EXCEPT
 * `sign`, sort by key name alphabetically, join the pairs (still in their
 * original percent-encoded form) with `&`, then HMAC-SHA256 that string
 * using the notification secret as the HMAC key (not concatenated into
 * the message, unlike the old scheme) — hex-encoded, lowercase.
 *
 * This works on the RAW request body rather than a parsed/decoded
 * notification object specifically to avoid re-encoding the string
 * ourselves — any difference from ЮMoney's own percent-encoding (e.g. `:`
 * as `%3A` vs literal) would silently break the HMAC even with a
 * perfectly correct secret. Reusing their exact original `key=value`
 * substrings sidesteps that entirely.
 */
export async function verifyNotificationSignature(env: Env, rawBody: string): Promise<boolean> {
  if (!env.YOOMONEY_NOTIFICATION_SECRET) return false;

  const entries: Array<{ key: string; raw: string }> = [];
  let receivedSign = '';
  for (const pair of rawBody.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    let key: string;
    try {
      key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    } catch {
      continue; // malformed percent-encoding — can't be a legit field name, skip it
    }
    if (key === 'sign') {
      const rawValue = eq === -1 ? '' : pair.slice(eq + 1);
      try {
        receivedSign = decodeURIComponent(rawValue.replace(/\+/g, ' ')).toLowerCase();
      } catch {
        return false;
      }
      continue;
    }
    entries.push({ key, raw: pair });
  }
  if (!receivedSign) return false;

  entries.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const signedString = entries.map((e) => e.raw).join('&');

  const expected = await hmacSha256Hex(env.YOOMONEY_NOTIFICATION_SECRET, signedString);
  return timingSafeEqual(expected, receivedSign);
}

/** Parses the notification's `application/x-www-form-urlencoded` body into the typed shape above — for the business fields (label, amount, ...), NOT for signature verification (that reads the raw body directly, see verifyNotificationSignature). */
export function parseNotification(formData: URLSearchParams): YooMoneyNotification {
  return {
    notification_type: formData.get('notification_type') ?? '',
    operation_id: formData.get('operation_id') ?? '',
    amount: formData.get('amount') ?? '',
    withdraw_amount: formData.get('withdraw_amount') ?? '',
    currency: formData.get('currency') ?? '',
    datetime: formData.get('datetime') ?? '',
    sender: formData.get('sender') ?? '',
    codepro: formData.get('codepro') ?? '',
    label: formData.get('label') ?? '',
    unaccepted: formData.get('unaccepted') ?? '',
    sign: formData.get('sign') ?? '',
  };
}
