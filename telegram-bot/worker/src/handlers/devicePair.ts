import type { Ctx } from './context';
import { claimDevicePairing } from '../db';
import { mainMenu } from '../telegram/keyboards';
import { esc } from '../util';
import { reply } from './reply';

/**
 * Handles `/start devicelink_<CODE>` — the deep link the Android app opens
 * once it has started a pairing (`POST /device/pair/start` in index.ts).
 * Requires the chat's Telegram account to already be linked to a qmods.ru
 * account (via the normal `/link` flow); claiming just binds that same
 * account to whichever device generated the code.
 */
export async function handleDevicePairClaim(ctx: Ctx, code: string): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!me.linked || !me.user) {
    await reply(
      ctx,
      '🔒 Чтобы привязать приложение, сначала привяжите сам Telegram к аккаунту QMods — нажмите «Привязать аккаунт» ниже, затем откройте ссылку из приложения ещё раз (она действует 10 минут).',
      mainMenu(ctx.env, false, false)
    );
    return;
  }

  const token = await claimDevicePairing(ctx.env, code, me.user.username);
  if (!token) {
    await reply(
      ctx,
      '❌ Код устарел или уже был использован. Вернитесь в приложение и запросите новую привязку.',
      mainMenu(ctx.env, true, false)
    );
    return;
  }

  // Mirrors the token into qmods.ru's own device_id field so the app shows
  // up in the bot's/cabinet's "Устройства" section — best-effort: a failure
  // here shouldn't break the pairing itself (the app is already usable via
  // the device_token regardless of whether it's visible in that list).
  await ctx.api.deviceRegister(ctx.telegramId, token).catch(() => undefined);

  await reply(
    ctx,
    `✅ Приложение привязано к аккаунту <b>${esc(me.user.username)}</b>. Возвращаться сюда больше не нужно — приложение само определит, что привязка прошла.`,
    mainMenu(ctx.env, true, false)
  );
}
