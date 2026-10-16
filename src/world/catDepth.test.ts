import { describe, expect, it } from 'vitest';
import { ROOM_ADDITION } from '../content/world';
import { coversCat } from './catDepth';

describe('cat depth in the room', () => {
  const programmer = ROOM_ADDITION.placements.find((p) => p.sprite === 'programmer-typing');
  if (!programmer) throw new Error('no programmer in the room');
  const desk = ROOM_ADDITION.catSurfaces?.[0];
  if (!desk) throw new Error('no desk surface');

  it('walks behind the programmer on the desk top', () => {
    expect(coversCat(programmer, desk.y)).toBe(true);
    const onDesk = ROOM_ADDITION.catSpots.filter((s) => s.y === desk.y);
    expect(onDesk.length).toBeGreaterThan(0);
    for (const spot of onDesk) expect(coversCat(programmer, spot.y)).toBe(true);
  });

  it('stays in front of the programmer on the floor, by the chair included', () => {
    const onFloor = ROOM_ADDITION.catSpots.filter((s) => s.y > desk.y);
    expect(onFloor.length).toBeGreaterThan(0);
    for (const spot of onFloor) expect(coversCat(programmer, spot.y)).toBe(false);
  });

  it('never hides the cat behind the rest of the room', () => {
    const others = ROOM_ADDITION.placements.filter((p) => p !== programmer);
    for (const placement of others) expect(coversCat(placement, desk.y)).toBe(false);
  });
});
