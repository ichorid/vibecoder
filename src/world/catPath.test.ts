import { describe, expect, it } from 'vitest';
import { hopPosition, planCatPath, type Surface } from './catPath';

const DESK: Surface = { y: 10, minX: -34, maxX: 62 };

describe('cat paths between spots', () => {
  it('walks when the spot is on the same level', () => {
    expect(planCatPath({ x: -58, y: 52 }, { x: 40, y: 54 }, [DESK])).toEqual([
      { kind: 'walk', to: { x: 40, y: 54 } },
    ]);
  });

  it('jumps up onto the desk from the floor below the target, never walking through the air', () => {
    const path = planCatPath({ x: -58, y: 52 }, { x: 30, y: 10 }, [DESK]);
    expect(path).toEqual([
      { kind: 'walk', to: { x: 30, y: 52 } },
      { kind: 'jump', from: { x: 30, y: 52 }, to: { x: 30, y: 10 } },
    ]);
  });

  it('walks to the desk edge before jumping down to a spot beyond it', () => {
    const path = planCatPath({ x: 30, y: 10 }, { x: -58, y: 52 }, [DESK]);
    expect(path).toEqual([
      { kind: 'walk', to: { x: -34, y: 10 } },
      { kind: 'jump', from: { x: -34, y: 10 }, to: { x: -58, y: 52 } },
    ]);
  });

  it('a hop follows an arc above both ends and lands exactly', () => {
    const from = { x: 30, y: 52 };
    const to = { x: 30, y: 10 };
    expect(hopPosition(from, to, 0)).toEqual(from);
    expect(hopPosition(from, to, 1)).toEqual(to);
    expect(hopPosition(from, to, 0.6).y).toBeLessThan(to.y);
  });
});
