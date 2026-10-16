/** Which pixel icon a counter, a primary action or a card shows (presentation only). */
import type { PrimaryActionId, UpgradeId } from '../game/ids';
import type { StatId } from '../game/catalog';
import * as icons from './icons';
import type { PixelMap } from './pixelArt';

export const STAT_ICONS: Readonly<Record<StatId, PixelMap>> = {
  output: icons.codeIcon,
  tokens: icons.tokensIcon,
  debt: icons.debtIcon,
  automation: icons.automationIcon,
  revenue: icons.revenueIcon,
  margin: icons.marginIcon,
};

export const ACTION_ICONS: Readonly<Record<PrimaryActionId, PixelMap>> = {
  writeCode: icons.writeCodeIcon,
  prompt: icons.promptIcon,
  delegate: icons.delegateIcon,
  supervise: icons.superviseIcon,
  optimize: icons.optimizeIcon,
  observe: icons.observeIcon,
};

/** Non-progression cards; progression cards show their technology's illustration instead. */
const CARD_ICONS: Partial<Record<UpgradeId, PixelMap>> = {
  'token-supply': icons.buyTokensIcon,
  'compute-slot': icons.computeIcon,
  'additional-agent': icons.agentIcon,
  'review-capacity': icons.reviewIcon,
  'auto-refill-v1': icons.refillV1Icon,
  'auto-refill-v2': icons.refillV2Icon,
  'token-review': icons.tokenReviewIcon,
  'auto-reviewer': icons.autoReviewerIcon,
};

export function cardIcon(id: UpgradeId): PixelMap {
  return CARD_ICONS[id] ?? icons.automationIcon;
}

export const DECISION_ICON = icons.decisionIcon;
