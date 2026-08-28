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
  currency: string;
  datetime: string;
  sender: string;
  codepro: string;
  label: string;
  unaccepted: string;
  sha1_hash: string;
}

async function sha1Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies the sha1_hash ЮMoney sends with every notification, per their
 * documented field order:
 *   sha1(type&operation_id&amount&currency&datetime&sender&codepro&secret&label)
 * This is the ONLY thing that proves a POST to the webhook actually came
 * from ЮMoney — the endpoint itself has no other auth (ЮMoney doesn't
 * support custom headers on notifications), so every field read from an
 * unverified notification must be treated as attacker-controlled until
 * this returns true.
 */
export async function verifyNotificationSignature(env: Env, n: YooMoneyNotification): Promise<boolean> {
  if (!env.YOOMONEY_NOTIFICATION_SECRET) return false;
  const base = [n.notification_type, n.operation_id, n.amount, n.currency, n.datetime, n.sender, n.codepro, env.YOOMONEY_NOTIFICATION_SECRET, n.label].join(
    '&'
  );
  const expected = await sha1Hex(base);
  return timingSafeEqual(expected, n.sha1_hash.toLowerCase());
}

/** Parses the notification's `application/x-www-form-urlencoded` body into the typed shape above. */
export function parseNotification(formData: URLSearchParams): YooMoneyNotification {
  return {
    notification_type: formData.get('notification_type') ?? '',
    operation_id: formData.get('operation_id') ?? '',
    amount: formData.get('amount') ?? '',
    currency: formData.get('currency') ?? '',
    datetime: formData.get('datetime') ?? '',
    sender: formData.get('sender') ?? '',
    codepro: formData.get('codepro') ?? '',
    label: formData.get('label') ?? '',
    unaccepted: formData.get('unaccepted') ?? '',
    sha1_hash: formData.get('sha1_hash') ?? '',
  };
}
