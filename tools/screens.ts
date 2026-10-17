/**
 * Dev utility for visual review (not a test): screenshot named scenes from the running preview.
 * Usage: npx vite-node tools/screens.ts -- <outDir> [scene...]   (preview on 127.0.0.1:4173)
 */
import { chromium, type Page } from '@playwright/test';
import {
  lonelyRun,
  neglectedRun,
  progressedRun,
  withBuilt,
  saveText,
  strayRun,
} from '../tests/browser/fixtures';

type Scene = {
  width: number;
  height: number;
  save?: () => string;
  act?: (page: Page) => Promise<void>;
  dark?: boolean;
};

/** At the Terminal Agent with a demo built. */
const demoSave = () => saveText(withBuilt(progressedRun(4), 'demo'));
const playDemo = async (page: Page) => {
  await page.getByTestId('demo-go').click();
  await page.locator('[data-testid="demo-screen"][data-phase="play"]').waitFor();
  await page
    .locator('[data-testid="demo-variant-0"][data-fingerprint]:not([data-fingerprint=""])')
    .waitFor();
  await page.waitForTimeout(1500);
};

/** A mid-game run with a recruiter's offer on the table. */
function jobOffer() {
  const run = progressedRun(6, false, 41);
  return {
    ...run,
    job: { ...run.job, offer: { salary: 420, expiresAtMs: run.activeMs + 90_000 } },
  };
}

/** The same run, employed for seven months of its tryout. */
function employed() {
  const run = progressedRun(6, false, 41);
  return {
    ...run,
    slots: [{ target: 'job' as const, by: 'player' as const, sinceMs: run.activeMs }],
    job: {
      ...run.job,
      employed: { salary: 420, monthEmployedMs: 90_000, paydays: 7, permanent: false },
    },
  };
}

/** A missed rent waiting for its landlord wheel. */
function broke() {
  const run = progressedRun(6, false, 41);
  return {
    ...run,
    economy: { ...run.economy, money: -60 },
    rent: { ...run.rent, missedStreak: 2 },
    rentWheels: [
      {
        month: run.rent.month,
        outcome: 'friday' as const,
        hazard: 0.15,
        rent: 104,
        catAlive: true,
        activeMs: run.activeMs,
      },
    ],
  };
}

const scenes: Record<string, Scene> = {
  jobOffer: { width: 390, height: 844, save: () => saveText(jobOffer()) },
  employed: { width: 390, height: 844, save: () => saveText(employed()) },
  landlord: { width: 390, height: 844, save: () => saveText(broke()) },
  money320: { width: 320, height: 568, save: () => saveText(progressedRun(6, false, 41)) },
  demoStrip: { width: 390, height: 844, save: demoSave },
  demoPhone: { width: 390, height: 844, save: demoSave, act: playDemo },
  demoDesktop: { width: 1280, height: 800, save: demoSave, act: playDemo },
  start: { width: 390, height: 844 },
  tech1: { width: 390, height: 844, save: () => saveText(progressedRun(1)) },
  tech3: { width: 390, height: 844, save: () => saveText(progressedRun(3)) },
  tech9: { width: 390, height: 844, save: () => saveText(progressedRun(9)) },
  tech14: { width: 390, height: 844, save: () => saveText(progressedRun(14)) },
  tech20: { width: 390, height: 844, save: () => saveText(progressedRun(20)) },
  tech28: { width: 390, height: 844, save: () => saveText(progressedRun(28)) },
  tech28Dark: { width: 390, height: 844, dark: true, save: () => saveText(progressedRun(28)) },
  tech3Dark: { width: 390, height: 844, dark: true, save: () => saveText(progressedRun(3)) },
  reveal: { width: 390, height: 844, save: () => saveText(progressedRun(2, true)) },
  startDark: { width: 390, height: 844, dark: true },
  small: { width: 320, height: 568 },
  overlayLarge: { width: 390, height: 844, save: () => saveText(lonelyRun('large')) },
  overlaySmall: { width: 390, height: 844, save: () => saveText(lonelyRun('small', 32)) },
  memorial: {
    width: 390,
    height: 844,
    save: () => saveText(neglectedRun()),
    act: async (page) => page.getByTestId('cat-button').click(),
  },
  ship: { width: 390, height: 844, save: () => saveText(readyToShip(41)) },
  wheel: {
    width: 390,
    height: 844,
    save: () => saveText(readyToShip(41)),
    act: async (page) => {
      await page.locator('[data-release="1"]').click();
      await page.waitForTimeout(1500);
    },
  },
  wheelResult: {
    width: 390,
    height: 844,
    save: () => saveText(readyToShip(41)),
    act: async (page) => {
      await page.locator('[data-release="1"]').click();
      await page.waitForTimeout(4600);
    },
  },
  weekend: {
    width: 390,
    height: 844,
    save: () => saveText(readyToShip(1868)),
    act: async (page) => {
      await page.locator('[data-release="1"]').click();
      await page.waitForTimeout(5500);
    },
  },
  frames: {
    width: 390,
    height: 844,
    save: () => saveText(shippedThrice()),
  },
  compute: {
    width: 390,
    height: 844,
    save: () => {
      const run = progressedRun(4, false, 41);
      return saveText({ ...run, upgradeLevels: { ...run.upgradeLevels, 'compute-slot': 8 } });
    },
  },
  sheet: {
    width: 390,
    height: 844,
    save: () => saveText(progressedRun(9)),
    act: async (page) => page.getByTestId('offers-toggle').click(),
  },
  late320: {
    width: 320,
    height: 640,
    save: () => {
      const run = progressedRun(28);
      return saveText({ ...run, economy: { ...run.economy, money: run.economy.money + 1e7 } });
    },
  },
  setup9: {
    width: 390,
    height: 1400,
    save: () => saveText(progressedRun(9)),
    act: async (page) => page.getByTestId('open-setup').click(),
  },
  setup28: {
    width: 390,
    height: 2200,
    save: () => saveText(progressedRun(28)),
    act: async (page) => page.getByTestId('open-setup').click(),
  },
  history: {
    width: 390,
    height: 844,
    save: () => saveText(progressedRun(12)),
    act: async (page) => page.getByRole('button', { name: 'HISTORY' }).click(),
  },
  historyDead: {
    width: 390,
    height: 844,
    save: () => saveText(neglectedRun()),
    act: async (page) => page.getByRole('button', { name: 'HISTORY' }).click(),
  },
  ...Object.fromEntries(
    (['ok', 'thirsty', 'soggy', 'dead'] as const).map((look) => [
      `room-${look}`,
      {
        width: 390,
        height: 844,
        save: () => {
          const run = progressedRun(1, false, 41);
          const water = { ok: 60, thirsty: 10, soggy: 110, dead: 0 }[look];
          const releases = ([1, 2, 3, 4, 5] as const).map((window) => ({
            window,
            outcome: 'pivot' as const,
            commentId: `c0${window}`,
            catAlive: true,
            activeMs: run.activeMs,
          }));
          return saveText({
            ...run,
            releases,
            upgradeLevels: { ...run.upgradeLevels, 'compute-slot': 8 },
            plant:
              look === 'dead'
                ? {
                    water: 0,
                    alive: false,
                    diedAtActiveMs: 1,
                    cause: 'dried' as const,
                    warned: true,
                  }
                : { water, alive: true, diedAtActiveMs: null, cause: null, warned: false },
          });
        },
      },
    ]),
  ),
  ...Object.fromEntries(
    Array.from({ length: 28 }, (_, i) => i + 1).map((n) => [
      `stage${n}`,
      { width: 390, height: 844, save: () => saveText(progressedRun(n)) },
    ]),
  ),
  tech28Small: { width: 320, height: 568, save: () => saveText(progressedRun(28)) },
  tech9Small: { width: 320, height: 568, save: () => saveText(progressedRun(9)) },
  stray: {
    width: 390,
    height: 844,
    save: () => saveText(strayRun()),
    act: async (page) => page.getByTestId('cat-button').click(),
  },
  cat: { width: 390, height: 844, act: async (page) => page.getByTestId('cat-button').click() },
  play: {
    width: 390,
    height: 844,
    act: async (page) => {
      await page.getByTestId('cat-button').click();
      await page.getByRole('button', { name: 'PLAY' }).click();
      await page.waitForTimeout(1200);
    },
  },
};

/** A run at the Terminal Agent with v0.1 built. */
function readyToShip(seed: number) {
  return withBuilt(progressedRun(4, false, seed), 'release');
}

/** Three framed releases on the wall (synthetic records; the room shows one frame each). */
function shippedThrice() {
  const run = progressedRun(4, false, 41);
  const releases = ([1, 2, 3] as const).map((window) => ({
    window,
    outcome: 'pivot' as const,
    commentId: `c0${window}`,
    catAlive: true,
    activeMs: run.activeMs,
  }));
  return { ...run, releases };
}

const [outDir = '.', ...names] = process.argv.slice(2).filter((a) => a !== '--');
const browser = await chromium.launch();
for (const name of names.length ? names : Object.keys(scenes)) {
  const scene = scenes[name];
  if (!scene) throw new Error(`unknown scene ${name}`);
  const context = await browser.newContext({
    viewport: { width: scene.width, height: scene.height },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const save = scene.save?.() ?? null;
  await page.addInitScript((text) => {
    localStorage.clear();
    if (text) localStorage.setItem('vibe-coder.save', text);
  }, save);
  await page.goto('http://127.0.0.1:4173/');
  await page.getByTestId('primary-action').waitFor();
  if (scene.dark) {
    await page.getByTestId('settings-button').click();
    await page.getByRole('radio', { name: 'DARK' }).click();
    await page.keyboard.press('Escape');
  }
  await scene.act?.(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/${name}.png` });
  await context.close();
}
await browser.close();
