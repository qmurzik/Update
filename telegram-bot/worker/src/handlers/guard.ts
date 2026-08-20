import type { Ctx } from './context';
import { mainMenu } from '../telegram/keyboards';
import { reply } from './reply';

interface MeResult {
  linked?: boolean;
  user?: unknown;
}

/**
 * Every section that needs a QMods account behind it calls this first.
 * Returns false (and already replied to the user) when the chat isn't
 * linked yet, so the calling handler can just `return`.
 */
export async function requireLinked(ctx: Ctx, me: MeResult): Promise<boolean> {
  if (me.linked && me.user) return true;
  await reply(
    ctx,
    'Этот раздел доступен только после привязки аккаунта QMods. Нажмите кнопку ниже, чтобы привязать.',
    mainMenu(false, false)
  );
  return false;
}
