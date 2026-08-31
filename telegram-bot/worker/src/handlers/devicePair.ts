import type { Ctx } from './context';
import { claimDevicePairing, rejectDevicePairing } from '../db';
import { mainMenu } from '../telegram/keyboards';
import { esc } from '../util';
import { reply } from './reply';

/**
 * Claims a device pairing code — reused by two different triggers that
 * both guarantee "only the account being paired could have reached this":
 *   1. `/start devicelink_<CODE>` — the deep link the Android app opens
 *      directly (`POST /device/pair/start` in index.ts).
 *   2. `devicepair:confirm:<CODE>` — a button tap on the confirmation
 *      message sent to a chat_id resolved from a typed @username (the
 *      "нет Telegram на этом телефоне" flow — see
 *      `/device/pair/notify-username` in index.ts and android-client/
 *      README.md "Привязка по юзернейму"). Only the matching account's own
 *      chat ever receives that message, so tapping Confirm has the same
 *      security property as opening the deep link.
 * Requires the chat's Telegram account to already be linked to a qmods.ru
 * account (via the normal `/link` flow); claiming just binds that same
 * account to whichever device generated the code.
 */
export async function handleDevicePairClaim(ctx: Ctx, code: string): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!me.linked || !me.user) {
    await reply(
      ctx,
      '🔒 Чтобы привязать приложение, сперва привяжите сам Telegram к аккаунту QMods — нажмите «Привязать аккаунт» ниже, а затем откройте ссылку из приложения ещё раз (действует 10 минут).',
      mainMenu(ctx.env, false, false)
    );
    return;
  }

  const maxDevices = me.user.max_devices ?? 1;
  const result = await claimDevicePairing(ctx.env, code, me.user.username, maxDevices);
  if (!result.ok) {
    if (result.reason === 'device_limit') {
      const extra =
        maxDevices > 1
          ? ''
          : ' Либо купите второе устройство («клон») за 200 ₽ в разделе «⚙️ Устройства» — тогда войти можно будет сразу с двух.';
      await reply(
        ctx,
        `❌ К этому аккаунту уже привязано максимум устройств (${maxDevices}). Сначала отвяжите одно в разделе «⚙️ Устройства», затем откройте ссылку из нового приложения ещё раз.${extra}`,
        mainMenu(ctx.env, true, false)
      );
      return;
    }
    await reply(
      ctx,
      '❌ Код устарел или уже был использован. Вернитесь в приложение и запросите новую привязку — не страшно, бывает.',
      mainMenu(ctx.env, true, false)
    );
    return;
  }
  const token = result.token;

  // Mirrors the token into qmods.ru's own device_id field so the app shows
  // up in the bot's/cabinet's "Устройства" section — best-effort: a failure
  // here shouldn't break the pairing itself (the app is already usable via
  // the device_token regardless of whether it's visible in that list).
  await ctx.api.deviceRegister(ctx.telegramId, token).catch(() => undefined);

  await reply(
    ctx,
    `✅ Готово, приложение привязано к аккаунту <b>${esc(me.user.username)}</b>. Возвращаться сюда не нужно — приложение само поймёт, что привязка прошла.`,
    mainMenu(ctx.env, true, false)
  );
}

/** `devicepair:reject:<CODE>` — the "Отклонить" button on the same confirmation message as handleDevicePairClaim's second trigger above. */
export async function handleDevicePairReject(ctx: Ctx, code: string): Promise<void> {
  await rejectDevicePairing(ctx.env, code);
  const me = await ctx.api.me(ctx.telegramId);
  await reply(
    ctx,
    '❌ Вход отклонён. Если это были не вы — можно больше ничего не делать, я не пущу, попытка входа не завершится.',
    mainMenu(ctx.env, !!me.linked, false)
  );
}
