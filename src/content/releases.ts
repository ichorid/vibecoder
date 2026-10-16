/**
 * Ship It: releases, the release wheel and its silly outcomes (docs/feature_ship_it.md).
 * Shipping has no economic reward; the joke, the frame on the wall and the lottery ticket are it.
 */
import type { ReleaseContent } from '../game/catalog';
import { releaseComments } from './releaseComments';

/**
 * The authored releases. Each needs about ×6 more code than the last and spends all of it;
 * jackpot weights sum to 20 (% of a whole run for a player who ships the five).
 */
export const RELEASE_WINDOWS: ReleaseContent['windows'] = [
  {
    window: 1,
    version: 'v0.1',
    price: 2_000,
    jackpotWeight: 0.2,
    title: 'Ship v0.1',
    description: 'It works. It is small. You could ship it.',
  },
  {
    window: 2,
    version: 'v0.2',
    price: 12_000,
    jackpotWeight: 0.8,
    title: 'Ship v0.2',
    description: 'The original project still compiles. Mostly.',
  },
  {
    window: 3,
    version: 'v1.0',
    price: 75_000,
    jackpotWeight: 2,
    title: 'Ship v1.0',
    description: 'The harness could ship the original project in an afternoon.',
  },
  {
    window: 4,
    version: 'v2.0',
    price: 450_000,
    jackpotWeight: 5,
    title: 'Ship v2.0',
    description: 'The repository offers to ship itself. It needs your approval and a lot of code.',
  },
  {
    window: 5,
    version: 'v3.0',
    price: 2_700_000,
    jackpotWeight: 12,
    title: 'Ship v3.0',
    description:
      'The company does not know what the original project is. You could ship it one last time.',
  },
];

export const releases: ReleaseContent = {
  windows: RELEASE_WINDOWS,
  availableFrom: 'terminal-agent',
  laterPriceGrowth: 6,
  laterDescription: 'Ship it again. Nobody asked. Somebody will download it.',
  slices: [
    {
      id: 'three-users',
      label: '3 USERS',
      text: "Three users. One of them is your mom. She thinks it's a calculator.",
    },
    {
      id: 'one-star',
      label: '1 STAR',
      text: 'One GitHub star, from a marketing bot. It starred 40,000 other repos today.',
    },
    { id: 'hacker-news', label: 'HN', text: '2 points on Hacker News. Flagged within the hour.' },
    { id: 'product-hunt', label: '#47', text: '#47 product of the day, right behind a to-do app.' },
    {
      id: 'viral',
      label: 'VIRAL!',
      text: 'It went viral: a screenshot of the typo on your landing page.',
    },
    {
      id: 'acquired',
      label: 'ACQUIRED',
      text: 'Acquired for $1 by a crypto project. The payment bounced.',
    },
    {
      id: 'cloud-bill',
      label: '$400',
      text: 'Revenue: $0. Cloud bill: $400. Someone left autoscaling on.',
    },
    { id: 'pivot', label: 'PIVOT', text: 'An investor loves it. As a dating app.' },
    {
      id: 'cat-review',
      label: { alive: 'CAT REVIEW', absent: 'NO REVIEW' },
      text: {
        alive: 'The cat reviewed it by sleeping on the keyboard. Approved.',
        absent: 'Nobody looked at it. Approved.',
      },
    },
  ],
  comments: releaseComments,
  jackpotEnding: 'the-infinite-weekend',
  jackpotLabel: 'RETIRE',
  shippedText: 'Shipped {version}: {label}.',
};
