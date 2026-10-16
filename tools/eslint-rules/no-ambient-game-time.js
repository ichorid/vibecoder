/** @typedef {'game'|'content'|'app'|'unknown'} PureLayer */

/**
 * @param {string} filename
 * @returns {PureLayer}
 */
function pureLayer(filename) {
  const path = filename.replace(/\\/g, '/');
  const hasSrc = (segment) => new RegExp(`(^|/)src/${segment}/`).test(path);
  if (hasSrc('game') || /\/(valid|invalid)-game-/.test(path)) return 'game';
  if (hasSrc('content') || /\/(valid|invalid)-content-/.test(path)) return 'content';
  if (hasSrc('app') || /valid-app-/.test(path)) return 'app';
  return 'unknown';
}

const RESTRICTED_GLOBALS = new Set([
  'Date',
  'performance',
  'crypto',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
]);

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    name: 'no-ambient-game-time',
    schema: [],
    messages: {
      forbiddenGlobal:
        'forbidden ambient time/random API in {{layer}}; pass elapsed ms and seeded rng explicitly',
      forbiddenMember:
        'forbidden ambient time API ({{name}}); use explicit arguments or app-owned runtime',
      forbiddenRandom: 'forbidden ambient random (Math.random); use seeded rng state',
    },
  },
  create(context) {
    const layer = pureLayer(context.filename ?? '');
    if (layer !== 'game' && layer !== 'content') {
      return {};
    }

    return {
      Identifier(node) {
        if (!RESTRICTED_GLOBALS.has(node.name)) return;
        if (node.name === 'setTimeout' || node.name === 'setInterval') return;
        if (node.parent.type === 'MemberExpression' && node.parent.object === node) return;
        if (node.parent.type === 'NewExpression' && node.parent.callee === node) return;
        context.report({
          node,
          messageId: 'forbiddenGlobal',
          data: { layer },
        });
      },
      MemberExpression(node) {
        if (node.object.type !== 'Identifier' || node.property.type !== 'Identifier') {
          return;
        }
        const objectName = node.object.name;
        const memberName = node.property.name;

        if (objectName === 'Date' && memberName === 'now') {
          context.report({
            node,
            messageId: 'forbiddenMember',
            data: { name: 'Date.now' },
          });
          return;
        }
        if (objectName === 'Math' && memberName === 'random') {
          context.report({
            node,
            messageId: 'forbiddenRandom',
          });
          return;
        }
        if (objectName === 'performance' && memberName === 'now') {
          context.report({
            node,
            messageId: 'forbiddenMember',
            data: { name: 'performance.now' },
          });
          return;
        }
        if (objectName === 'crypto') {
          context.report({
            node,
            messageId: 'forbiddenMember',
            data: { name: `crypto.${memberName}` },
          });
        }
      },
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'Date') {
          context.report({
            node,
            messageId: 'forbiddenMember',
            data: { name: 'new Date' },
          });
        }
      },
      CallExpression(node) {
        if (node.callee.type !== 'Identifier') return;
        if (node.callee.name !== 'setTimeout' && node.callee.name !== 'setInterval') return;
        context.report({
          node,
          messageId: 'forbiddenMember',
          data: { name: node.callee.name },
        });
      },
    };
  },
};

export default rule;
