import type { Ticker } from 'pixi.js';

export function attachPresentation(ticker: Ticker, draw: () => void): void {
  ticker.add(draw);
}
