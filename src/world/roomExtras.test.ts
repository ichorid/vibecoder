import { describe, expect, it } from 'vitest';
import { ROOM_ADDITION, withRoomExtras } from '../content/world';

describe('room extras', () => {
  it('stacks one server unit per compute slot, bottom first, each 4 px above the last', () => {
    const room = withRoomExtras(ROOM_ADDITION, { releases: 0, computeSlots: 3 });
    const units = room.placements.filter((p) => p.sprite === 'compute-slot');
    expect(units).toHaveLength(3);
    expect(units.map((u) => u.y)).toEqual([53, 49, 45]);
    expect(new Set(units.map((u) => u.x)).size).toBe(1);
  });

  it('caps the stack at the eight slots the upgrade can reach and adds frames separately', () => {
    const room = withRoomExtras(ROOM_ADDITION, { releases: 2, computeSlots: 12 });
    expect(room.placements.filter((p) => p.sprite === 'compute-slot')).toHaveLength(8);
    expect(room.placements.filter((p) => p.sprite === 'release-frame')).toHaveLength(2);
    expect(withRoomExtras(ROOM_ADDITION, { releases: 0, computeSlots: 0 })).toBe(ROOM_ADDITION);
  });
});
