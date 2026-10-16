/** @typedef {'game'|'content'|'ui'|'world'|'app'|'persistence'|'unknown'} Layer */

/**
 * @param {string} filename
 * @returns {Layer}
 */
export function layerFromFilename(filename) {
  const path = filename.replace(/\\/g, '/');

  const hasSrc = (segment) => new RegExp(`(^|/)src/${segment}/`).test(path);

  if (hasSrc('game') || /\/(valid|invalid)-game-/.test(path)) {
    return 'game';
  }
  if (hasSrc('content') || /\/(valid|invalid)-content-/.test(path)) {
    return 'content';
  }
  if (hasSrc('ui') || /\/(valid|invalid)-ui-/.test(path)) {
    return 'ui';
  }
  if (hasSrc('world') || /valid-renderer-/.test(path)) {
    return 'world';
  }
  if (hasSrc('app') || /valid-app-/.test(path) || /valid-runtime-/.test(path)) {
    return 'app';
  }
  if (hasSrc('persistence')) {
    return 'persistence';
  }
  return 'unknown';
}

/**
 * @param {string} specifier
 * @returns {string}
 */
function normalizeSpecifier(specifier) {
  return specifier.replace(/\\/g, '/');
}

/**
 * @param {string} specifier
 * @param {Layer} fromLayer
 * @returns {string | null}
 */
function layerViolationMessage(specifier, fromLayer) {
  const spec = normalizeSpecifier(specifier);

  if (fromLayer === 'game') {
    if (/pixi\.js/.test(spec)) {
      return 'game layer must not import Pixi; keep rendering in world/';
    }
    if (/svelte/.test(spec)) {
      return 'game layer must not import Svelte; use selectors in ui/';
    }
    if (/persistence/.test(spec) || /@persistence/.test(spec)) {
      return 'game layer must not import persistence adapter';
    }
    if (/\.\.\/ui\//.test(spec) || /\/ui\//.test(spec) || spec.includes('GameView.svelte')) {
      return 'forbidden layer import: game cannot import ui/';
    }
    if (/\.\.\/world\//.test(spec) || /\/world\//.test(spec)) {
      return 'forbidden layer import: game cannot import world/';
    }
    return null;
  }

  if (fromLayer === 'ui') {
    if (/game\/commands/.test(spec) || /@game\/commands/.test(spec)) {
      return 'ui must not import game/commands; dispatch through app composition';
    }
    if (
      /game\/(simulation|economy|progression|createRun)/.test(spec) ||
      /@game\/(simulation|economy|progression|createRun)/.test(spec)
    ) {
      return 'ui must not import raw game internals; use read models';
    }
    if (/pixi\.js/.test(spec)) {
      return 'ui must not import Pixi; use world renderer';
    }
    return null;
  }

  if (fromLayer === 'content') {
    if (/game\//.test(spec) || /@game\//.test(spec)) {
      if (!spec.endsWith('/types') && !spec.endsWith('/types.ts') && !spec.includes('/types')) {
        return 'content may only type-import game contracts';
      }
    }
    return null;
  }

  return null;
}

/**
 * @param {import('eslint').Rule.RuleContext} context
 * @param {string} specifier
 * @param {import('estree').Node} node
 * @param {boolean} isTypeOnly
 */
function checkSpecifier(context, specifier, node, isTypeOnly) {
  const fromLayer = layerFromFilename(context.filename ?? '');
  if (fromLayer === 'unknown' || fromLayer === 'app' || fromLayer === 'world') {
    return;
  }

  if (fromLayer === 'content' && isTypeOnly) {
    return;
  }

  const message = layerViolationMessage(specifier, fromLayer);
  if (message) {
    context.report({ node, message });
  }
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    name: 'layer-imports',
    schema: [],
    messages: {
      forbidden: '{{message}}',
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (!node.source?.value || typeof node.source.value !== 'string') return;
        const isTypeOnly =
          node.importKind === 'type' ||
          node.specifiers.every((s) => s.type === 'ImportSpecifier' && s.importKind === 'type');
        checkSpecifier(context, node.source.value, node.source, isTypeOnly);
      },
      ExportNamedDeclaration(node) {
        if (!node.source?.value || typeof node.source.value !== 'string') return;
        checkSpecifier(context, node.source.value, node.source, false);
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal' && typeof node.source.value === 'string') {
          checkSpecifier(context, node.source.value, node.source, false);
        }
      },
    };
  },
};

export default rule;
