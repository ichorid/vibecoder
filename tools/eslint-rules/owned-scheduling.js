const GAMEPLAY_TIMER_OWNERS = [/(^|\/)src\/app\/runtime\.ts$/, /valid-runtime-interval\.ts$/];

const PRESENTATION_TICKER_OWNERS = [
  /(^|\/)src\/world\/renderer\.ts$/,
  /valid-renderer-ticker\.ts$/,
];

/**
 * @param {string} filename
 */
function isGameplayTimerOwner(filename) {
  const path = filename.replace(/\\/g, '/');
  return GAMEPLAY_TIMER_OWNERS.some((re) => re.test(path));
}

/**
 * @param {string} filename
 */
function isPresentationOwner(filename) {
  const path = filename.replace(/\\/g, '/');
  return PRESENTATION_TICKER_OWNERS.some((re) => re.test(path));
}

/**
 * @param {string} filename
 */
function isUiLayer(filename) {
  const path = filename.replace(/\\/g, '/');
  return /(^|\/)src\/ui\//.test(path) || /invalid-ui-needs-interval/.test(path);
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    name: 'owned-scheduling',
    schema: [],
    messages: {
      uiTimer: 'forbidden gameplay interval in ui/; app/runtime.ts owns simulation scheduling',
      foreignTimer:
        'forbidden interval/timeout here; use app/runtime for gameplay or world/renderer presentation ticker',
    },
  },
  create(context) {
    const filename = context.filename ?? '';
    const ui = isUiLayer(filename);
    const gameplayOwner = isGameplayTimerOwner(filename);
    const presentationOwner = isPresentationOwner(filename);

    return {
      CallExpression(node) {
        // `window.setTimeout(...)` / `globalThis.setInterval(...)` are the same browser timers.
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          ['window', 'globalThis', 'self'].includes(node.callee.object.name) &&
          node.callee.property.type === 'Identifier' &&
          ['setTimeout', 'setInterval'].includes(node.callee.property.name)
        ) {
          if (!gameplayOwner && !presentationOwner)
            context.report({ node, messageId: 'foreignTimer' });
          return;
        }
        if (node.callee.type !== 'Identifier') return;
        const name = node.callee.name;
        if (name !== 'setInterval' && name !== 'setTimeout') return;

        if (ui) {
          context.report({ node, messageId: 'uiTimer' });
          return;
        }

        if (!gameplayOwner && !presentationOwner) {
          context.report({ node, messageId: 'foreignTimer' });
        }
      },
    };
  },
};

export default rule;
