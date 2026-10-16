/**
 * A genome as horn-script text (the notation of the Organic Art preservation port's grammar
 * panel), for the dev Demo lab: readable, and easy to compare with other horn grammars.
 */
import { WAVE_PERIODS, type Ball, type Genome, type Horn, type Param } from './genome';

const n = (x: number) => String(Number(x.toFixed(2)));
const param = (p: Param) =>
  typeof p === 'number'
    ? n(p)
    : `${n(p.base)} + ${n(p.amp)} * w${p.osc}` +
      (p.amp2 !== undefined && p.osc2 !== undefined ? ` + ${n(p.amp2)} * w${p.osc2}` : '') +
      (p.ripple ? ` ~ripple ${n(p.ripple / (2 * Math.PI))}` : '');

export function hornScript(g: Genome): string {
  const lines = WAVE_PERIODS.map(
    (period, i) =>
      `w${i} = sin(T * ${n(360 / period)} + ${n(((g.phase[i] ?? 0) * 180) / Math.PI)})`,
  );
  let id = 0;
  const visit = (node: Horn | Ball): string => {
    if (node.prim === 'ball') return `ball[${node.tone}]`;
    const child = visit(node.child);
    const h = `${node.kind}${++id}`;
    lines.push('', `tube ${h}`, `${h}.child(${child})`, `${h}.ribs(${param(node.ribs)})`);
    for (const rule of node.rules) {
      switch (rule.op) {
        case 'tilt':
          lines.push(`${h}.position(rotX(${n(rule.deg)}))`);
          break;
        case 'twist':
          lines.push(`${h}.twist(${param(rule.a)}, ${param(rule.b)})`);
          break;
        case 'branch':
          lines.push(`${h}.branch(${param(rule.a)}, ${rule.k})`);
          break;
        default:
          lines.push(`${h}.${rule.op}(${param(rule.a)})`);
      }
    }
    if (node.lay) lines.push(`${h}.lay(center ${n(node.lay.center)}, rotZ(${n(node.lay.turn)}))`);
    if (node.alt) lines.push(`${h}.alternate()`);
    if (node.bulb !== null) lines.push(`${h}.tip(ball[2], scale(${n(node.bulb)}))`);
    return h;
  };
  const root = visit(g.root);
  lines.push(
    '',
    g.view === 'vortex'
      ? `pose = rotX(${n(g.tiltAmp * 0.4)} * w${g.tiltOsc} - 90) then rotZ(${n(g.spinAmp)} * w${g.spinOsc} + T * ${n(g.drift)})   # vortex`
      : `pose = rotX(${n(g.tiltAmp)} * w${g.tiltOsc} - 15) then rotY(${n(g.spinAmp)} * w${g.spinOsc} + T * ${n(g.drift)})`,
    `colour ${g.colour.mode} [${g.colour.pattern.join(' ')}] bands ${g.colour.bands} speed ${n(g.colour.speed)} ripple ${g.colour.ripple} pulse ${n(g.colour.pulse)}`,
    `render(${root}, ${g.copies} copies${g.mirror ? ', mirrored' : ''}, pose)`,
    `# palette ${g.palette}, ${g.style}, ${g.backdrop}${g.trails ? `, trails every ${g.trails} frames` : ''}`,
  );
  return lines.join('\n');
}
