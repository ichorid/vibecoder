/**
 * @param {string} filename
 */
function isUiLayer(filename) {
  const path = filename.replace(/\\/g, '/');
  return /(^|\/)src\/ui\//.test(path) || /\/(valid|invalid)-ui-/.test(path);
}

/**
 * @param {string} specifier
 */
function isRawContentImport(specifier) {
  const spec = specifier.replace(/\\/g, '/');
  return (
    /content\/assets/.test(spec) ||
    /\.\.\/content\/assets/.test(spec) ||
    /@content\/assets/.test(spec) ||
    /technologyManifest/.test(spec)
  );
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    name: 'no-raw-content-in-ui',
    schema: [],
    messages: {
      rawCatalog:
        'ui must not import raw content manifest/catalog; consume discovered read models from app composition',
    },
  },
  create(context) {
    if (!isUiLayer(context.filename ?? '')) {
      return {};
    }

    const check = (specifier, node) => {
      if (typeof specifier !== 'string') return;
      if (isRawContentImport(specifier)) {
        context.report({ node, messageId: 'rawCatalog' });
      }
    };

    return {
      ImportDeclaration(node) {
        if (node.source?.value) check(node.source.value, node.source);
      },
      ExportNamedDeclaration(node) {
        if (node.source?.value) check(node.source.value, node.source);
      },
    };
  },
};

export default rule;
