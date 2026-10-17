/** Which pixel icon a counter, a primary action or a card shows (presentation only). */
import type { PrimaryActionId, UpgradeId } from '../game/ids';
import type { StatId } from '../game/catalog';
import * as icons from './icons';
import type { PixelMap } from './pixelArt';

export const STAT_ICONS: Readonly<Record<StatId, PixelMap>> = {
  code: icons.codeIcon,
  tokens: icons.tokensIcon,
  debt: icons.debtIcon,
  automation: icons.automationIcon,
  money: icons.revenueIcon,
  margin: icons.marginIcon,
  quality: icons.reviewIcon,
  team: icons.delegateIcon,
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
  'auto-reviewer': icons.autoReviewerIcon,
  'job-search-bot': icons.searchIcon,
  'auto-freelancing': icons.gigIcon,
};

export function cardIcon(id: UpgradeId): PixelMap {
  return CARD_ICONS[id] ?? icons.automationIcon;
}

export const DECISION_ICON = icons.decisionIcon;
export const RELEASE_ICON = icons.releaseIcon;
export const DEMO_ICON = icons.demoIcon;
export const GIG_ICON = icons.gigIcon;
export const JOB_ICON = icons.jobIcon;
export const SEARCH_ICON = icons.searchIcon;
export const RENT_ICON = icons.rentIcon;
export const MONEY_ICON = icons.moneyIcon;
