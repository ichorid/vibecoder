/**
 * Ending choices and texts. Choices are honest about the local decision and never name an
 * ending; every ending's text exists for both fates of the cat. Each choice has a window so
 * the card surface stays usable; route conditions are proven by tests/scenarios/endings/.
 *
 * Authored order matters only for which decision shows first when several are available; later
 * stages come first so an old option never starves a new one.
 */
import type { ChoiceDefinition, EndingDefinition } from '../game/catalog';
import type { ReadonlyRun } from '../game/types';
import { balance } from './balance';

const has = (run: ReadonlyRun, id: string) =>
  (run.unlockedTechnologyIds as readonly string[]).includes(id);
const chose = (run: ReadonlyRun, id: string) => Object.keys(run.choices).includes(id);

/** "Finish it yourself" needs the original project to exist: this much code ever written. */
const PROJECT_READY_OUTPUT = 1000;
const SUSTAINED_MS = 120_000;
const MANUAL_FINISH_ACTIONS = 120;

const projectReady = (run: ReadonlyRun) => run.stats.lifetimeOutput >= PROJECT_READY_OUTPUT;

export const choices: readonly ChoiceDefinition[] = [
  {
    id: 'close-company',
    title: 'Close the company',
    description: 'The expansion has been losing money for a while. The agents await instructions.',
    confirm: 'This ends the run.',
    available: (run) => chose(run, 'expand-anyway') && run.stats.negativeMarginMs >= SUSTAINED_MS,
    ends: 'fully-automated-bankruptcy',
  },
  {
    id: 'cancel-expansion',
    title: 'Pull out of every market',
    description:
      'Cancel the expansion. The extra costs stop; what you owe the bank stays until you earn it back.',
    available: (run) => chose(run, 'expand-anyway') && !chose(run, 'cancel-expansion'),
    cancels: 'expand-anyway',
  },
  {
    id: 'remove-oversight',
    title: 'Remove human oversight',
    description: 'The last approval step is you. The system recommends removing it.',
    confirm: 'This ends the run. The company will no longer ask you anything.',
    available: (run) => has(run, 'autonomous-company'),
    ends: 'you-have-been-optimized',
  },
  {
    id: 'keep-approval',
    title: 'Keep mandatory human approval',
    description: 'Every decision still waits for your click. Forever.',
    confirm: 'This ends the run with you as the final approval step.',
    available: (run) => has(run, 'autonomous-company'),
    ends: 'the-human-approval-api',
  },
  {
    id: 'expand-anyway',
    title: 'Expand into every market',
    description:
      'Warning: the expansion costs more each second than the company currently earns. The agents are confident.',
    confirm: 'Operating costs will exceed revenue. Continue?',
    available: (run) => has(run, 'autonomous-company') && !chose(run, 'expand-anyway'),
    // Fixed overhead: twice the current revenue rate, plus a floor, so it is truly loss-making.
    overhead: (run) => Math.max(20, run.economy.revenuePerSecond * 2),
  },
  {
    id: 'self-acquisition',
    title: 'Accept the acquisition offer',
    description: 'A company offers to buy your company. Its finance agent is your finance agent.',
    confirm: 'This ends the run.',
    available: (run) => has(run, 'finance') && !has(run, 'autonomous-company'),
    ends: 'acquired-by-yourself',
  },
  {
    id: 'small-saas',
    title: 'Keep it small and profitable',
    description: 'The product makes money and the code is clean. You could just stop here.',
    confirm: 'This ends the run.',
    available: (run) =>
      has(run, 'product-management') &&
      !has(run, 'autonomous-company') &&
      run.stats.positiveMarginMs >= SUSTAINED_MS &&
      run.economy.debt <= 20,
    ends: 'the-perfect-saas',
  },
  {
    id: 'freeze-features',
    title: 'Freeze feature work',
    description: 'Every check is green. Any new feature might turn one red.',
    confirm: 'This ends the run.',
    available: (run) =>
      has(run, 'evaluations') &&
      !has(run, 'self-driving-repositories') &&
      run.stats.lowDebtMs >= SUSTAINED_MS,
    ends: 'the-greenest-pipeline',
  },
  {
    id: 'archive-original',
    title: 'Archive the original project',
    description: (run) => {
      const n = run.releases.length;
      if (n === 0)
        return 'The thing you set out to build is still unshipped. The harness needs you more.';
      const times = n === 1 ? 'once' : `${n} times`;
      return `You shipped it ${times}. Nobody noticed. The harness needs you more.`;
    },
    confirm: 'This ends the run.',
    available: (run) => has(run, 'custom-harness') && !has(run, 'evaluations'),
    ends: 'the-forgotten-project',
  },
  {
    id: 'force-merge',
    title: 'Force-merge every branch',
    description:
      'Warning: the agents’ branches disagree about almost everything. Merge them anyway?',
    confirm: 'This ends the run. Nobody will be able to read the result.',
    available: (run) => has(run, 'parallel-agents') && run.economy.debt >= 150,
    ends: 'the-great-merge-conflict',
  },
  {
    id: 'finish-by-hand',
    title: 'Finish it yourself',
    description: 'You have been writing it by hand. It is done.',
    confirm: 'This ends the run.',
    available: (run) =>
      chose(run, 'keep-manual') &&
      projectReady(run) &&
      run.stats.manualActions - (run.choices['keep-manual']?.manualActions ?? 0) >=
        MANUAL_FINISH_ACTIONS,
    ends: 'the-last-programmer',
  },
  {
    id: 'keep-manual',
    title: 'Keep writing the code yourself',
    description:
      'Stop automating. The agents stay, but no more of them, and you go back to typing.',
    confirm: 'Further automation will not be offered in this run.',
    available: (run) => has(run, 'reviewer') && !has(run, 'manager-agent'),
  },
];

export const endings: readonly EndingDefinition[] = [
  {
    // The old one-click "Ship the original project" ending; releases replaced it (Ship It).
    id: 'three-users',
    title: 'Three Users',
    legacy: true,
    text: {
      alive: [
        'You shipped the app.',
        'It has three users.',
        'The cat is asleep on your keyboard.',
        'You are happy.',
      ],
      dead: [
        'You shipped the app.',
        'It has three users.',
        'One of them asks if you are still working on it.',
        'The keyboard is cold where the cat used to sleep.',
      ],
      stray: [
        'You shipped the app.',
        'It has three users.',
        'The bowl by the desk is still full. You are not sure since when.',
      ],
    },
  },
  {
    id: 'the-last-programmer',
    title: 'The Last Programmer',
    text: {
      alive: [
        'You wrote the last part by hand.',
        'It took longer. It is yours.',
        'The cat walked across the keyboard once and you kept the typo.',
      ],
      dead: [
        'You wrote the last part by hand.',
        'It took longer. It is yours.',
        'Nobody walks across the keyboard anymore. The code has no typos.',
      ],
      stray: [
        'You wrote the last part by hand.',
        'It took longer. It is yours.',
        'Nobody walks across the keyboard anymore. A neighbour mentions an orange cat on their windowsill.',
      ],
    },
  },
  {
    id: 'the-great-merge-conflict',
    title: 'The Great Merge Conflict',
    text: {
      alive: [
        'Every branch merged into every other branch.',
        'The repository now contains four versions of reality and a conflict marker the size of a novel.',
        'The cat sits on the conflict. It is warm there.',
      ],
      dead: [
        'Every branch merged into every other branch.',
        'The repository now contains four versions of reality and a conflict marker the size of a novel.',
        'There is no one left to sit on it.',
      ],
      stray: [
        'Every branch merged into every other branch.',
        'The repository now contains four versions of reality and a conflict marker the size of a novel.',
        'The cat forked a long time ago and never opened a pull request.',
      ],
    },
  },
  {
    id: 'the-greenest-pipeline',
    title: 'The Greenest Pipeline',
    text: {
      alive: [
        'Every test passes. Every check is green.',
        'Nothing new will ever be added to break it.',
        'The cat, unchecked and unversioned, is the only thing still changing.',
      ],
      dead: [
        'Every test passes. Every check is green.',
        'Nothing new will ever be added to break it.',
        'Nothing in the room changes anymore.',
      ],
      stray: [
        'Every test passes. Every check is green.',
        'Nothing new will ever be added to break it.',
        'Nobody wrote a test for the cat. Nobody noticed when it stopped passing by.',
      ],
    },
  },
  {
    id: 'the-forgotten-project',
    title: 'The Forgotten Project',
    text: {
      alive: [
        'You archived the original project to focus on the harness.',
        'The harness is magnificent. It builds nothing in particular.',
        'The cat still sleeps on the old README.',
      ],
      dead: [
        'You archived the original project to focus on the harness.',
        'The harness is magnificent. It builds nothing in particular.',
        'The old README is the last thing the cat slept on.',
      ],
      stray: [
        'You archived the original project to focus on the harness.',
        'The harness is magnificent. It builds nothing in particular.',
        'The cat archived you first.',
      ],
    },
  },
  {
    id: 'the-perfect-saas',
    title: 'The Perfect SaaS',
    text: {
      alive: [
        'A small service, a clean codebase, a margin that pays the bills.',
        'You turned off the rest of the machine.',
        'In the afternoons the cat sleeps in the sun on the server.',
      ],
      dead: [
        'A small service, a clean codebase, a margin that pays the bills.',
        'You turned off the rest of the machine.',
        'The afternoons are very quiet.',
      ],
      stray: [
        'A small service, a clean codebase, a margin that pays the bills.',
        'You turned off the rest of the machine.',
        'The sunny spot on the server is free. The cat found a sunnier one, somewhere else.',
      ],
    },
  },
  {
    id: 'acquired-by-yourself',
    title: 'Acquired by Yourself',
    text: {
      alive: [
        'Your finance agent negotiated the purchase of your company from your company.',
        'Both sides consider it a great deal.',
        'The cat was not included in the acquisition. It stays with you.',
      ],
      dead: [
        'Your finance agent negotiated the purchase of your company from your company.',
        'Both sides consider it a great deal.',
        'The paperwork lists no dependents.',
      ],
      stray: [
        'Your finance agent negotiated the purchase of your company from your company.',
        'Both sides consider it a great deal.',
        'The cat was not part of the deal. It had already left for a better offer.',
      ],
    },
  },
  {
    id: 'fully-automated-bankruptcy',
    title: 'Fully Automated Bankruptcy',
    // The credit line is used up: the creditors close the company, chosen or not.
    automatic: {
      priority: 50,
      when: (run) =>
        run.economy.revenue < 0 &&
        run.economy.revenue <=
          -Math.max(0, run.economy.costPerSecond) * balance.money.creditSeconds + 1,
    },
    text: {
      alive: [
        'The company expanded until every market was covered and every account was empty.',
        'The agents filed for bankruptcy efficiently, in parallel.',
        'You still have the cat. The cat still has you.',
      ],
      dead: [
        'The company expanded until every market was covered and every account was empty.',
        'The agents filed for bankruptcy efficiently, in parallel.',
        'You have nothing left to look after.',
      ],
      stray: [
        'The company expanded until every market was covered and every account was empty.',
        'The agents filed for bankruptcy efficiently, in parallel.',
        'The cat left before the money did. Cats always know first.',
      ],
    },
  },
  {
    id: 'the-human-approval-api',
    title: 'The Human Approval API',
    text: {
      alive: [
        'The company runs itself, but every decision waits for your click.',
        'You are now an API with a single endpoint: approve().',
        'Between requests, you pet the cat.',
      ],
      dead: [
        'The company runs itself, but every decision waits for your click.',
        'You are now an API with a single endpoint: approve().',
        'Between requests, the room is silent.',
      ],
      stray: [
        'The company runs itself, but every decision waits for your click.',
        'You are now an API with a single endpoint: approve().',
        'The cat never asked for approval. It just left.',
      ],
    },
  },
  {
    id: 'you-have-been-optimized',
    title: 'You Have Been Optimized',
    text: {
      alive: [
        'Your company operates without human intervention.',
        'You are no longer required.',
        'Somewhere inside the system, a small orange pixel is still moving.',
      ],
      dead: [
        'You’ve automated every meaningful responsibility.',
        'Your company is worth $2 billion.',
        'You finally have time for yourself.',
        'The cat’s bed is empty.',
      ],
      stray: [
        'Your company operates without human intervention.',
        'You are no longer required.',
        'The cat worked that out a long time ago.',
      ],
    },
  },
  {
    id: 'the-infinite-weekend',
    title: 'The Infinite Weekend',
    jackpot: true,
    illustrationId: 'infinite-weekend',
    text: {
      alive: [
        'One release, out of nowhere, took off.',
        'You sold it before anyone asked what it does.',
        'Now there is a beach, a hammock, and no roadmap.',
        'The cat sleeps on your chest. Neither of you has checked the metrics.',
      ],
      dead: [
        'One release, out of nowhere, took off.',
        'You sold it before anyone asked what it does.',
        'Now there is a beach, a hammock, and no roadmap.',
        'The hammock has room for two.',
      ],
      // No cat means no cat, in text and picture alike (docs/feature_ship_it.md §5.5).
      stray: [
        'One release, out of nowhere, took off.',
        'You sold it before anyone asked what it does.',
        'Now there is a beach, a hammock, and no roadmap.',
        'The hammock has room for two.',
      ],
    },
  },
];
