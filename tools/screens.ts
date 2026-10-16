/**
 * Dev utility for visual review (not a test): screenshot named scenes from the running preview.
 * Usage: npx vite-node tools/screens.ts -- <outDir> [scene...]   (preview on 127.0.0.1:4173)
 */
import { chromium, type Page } from '@playwright/test';
import {
  lonelyRun,
  neglectedRun,
  progressedRun,
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

const scenes: Record<string, Scene> = {
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
  tech28Small: { width: 320, height: 568, save: () => saveText(progressedRun(28)) },
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

/** A run at the Terminal Agent with enough code to ship v0.1. */
function readyToShip(seed: number) {
  const run = progressedRun(4, false, seed);
  return { ...run, economy: { ...run.economy, output: run.economy.output + 2500 } };
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
    await page.getByRole('button', { name: 'Theme' }).click();
    await page.keyboard.press('Escape');
  }
  await scene.act?.(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/${name}.png` });
  await context.close();
}
await browser.close();
