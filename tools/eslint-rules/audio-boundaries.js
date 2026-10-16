/**
 * Audio boundaries (sound architecture §2, §11): only `src/music/backend/` imports Tone; the pure
 * music core touches no browser/storage globals; game rules never import music; the game entry
 * (ui/app) never imports the Music Lab or its review store.
 */

/** @typedef {'backend'|'core'|'music'|'lab'|'game'|'ui'|'app'|'other'} AudioLayer */

/** @param {string} filename @returns {AudioLayer} */
function layerOf(filename) {
  const path = filename.replace(/\\/g, '/');
  if (/(^|\/)src\/music\/backend\//.test(path)) return 'backend';
  if (/(^|\/)src\/music\/(core|data)\//.test(path)) return 'core';
  if (/(^|\/)src\/music\//.test(path)) return 'music';
  if (/(^|\/)src\/music-lab\//.test(path)) return 'lab';
  if (/(^|\/)src\/(game|content)\//.test(path)) return 'game';
  if (/(^|\/)src\/ui\//.test(path)) return 'ui';
  if (/(^|\/)src\/(app|world)\//.test(path) || /(^|\/)src\/main\.ts$/.test(path)) return 'app';
  return 'other';
}

const BROWSER_GLOBALS = new Set([
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'navigator',
  'AudioContext',
  'indexedDB',
]);

/** @param {string} spec @param {AudioLayer} layer @returns {string | null} */
function importProblem(spec, layer) {
  if ((spec === 'tone' || spec.startsWith('tone/')) && layer !== 'backend') {
    return 'Tone may only be imported in src/music/backend/; use the public music API';
  }
  if (layer === 'game' && /(^|\/)music(-lab)?(\/|$)/.test(spec)) {
    return 'game rules must not import music; app composition binds committed facts to the music director';
  }
  if (
    layer === 'core' &&
    (/(^|\/)backend(\/|$)/.test(spec) || /svelte/.test(spec) || /(^|\/)game\//.test(spec))
  ) {
    return 'music core must stay pure: no backend, Svelte or game imports';
  }
  if ((layer === 'ui' || layer === 'app') && (/music-lab/.test(spec) || /reviewStore/.test(spec))) {
    return 'the game entry must not import the Music Lab or its review store; link to /music-lab/ instead';
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    name: 'audio-boundaries',
    schema: [],
    messages: { forbidden: '{{message}}' },
  },
  create(context) {
    const layer = layerOf(context.filename ?? '');
    const check = (node, spec) => {
      const message = importProblem(spec, layer);
      if (message) context.report({ node, messageId: 'forbidden', data: { message } });
    };
    return {
      ImportDeclaration(node) {
        if (typeof node.source.value === 'string') check(node.source, node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source && typeof node.source.value === 'string')
          check(node.source, node.source.value);
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal' && typeof node.source.value === 'string') {
          check(node.source, node.source.value);
        }
      },
      Identifier(node) {
        if (layer !== 'core' || !BROWSER_GLOBALS.has(node.name)) return;
        const parent = node.parent;
        if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed)
          return;
        if (parent.type === 'Property' && parent.key === node) return;
        if (parent.type === 'ImportSpecifier' || parent.type === 'TSPropertySignature') return;
        context.report({
          node,
          messageId: 'forbidden',
          data: {
            message: `music core must not use browser/storage globals (${node.name}); inject them`,
          },
        });
      },
    };
  },
};

export default rule;
