'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const browserGlobals = new Set([
  ...Object.getOwnPropertyNames(globalThis),
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage',
  'alert', 'confirm', 'File', 'FileReader', 'Image', 'HTMLElement',
  'requestAnimationFrame', 'cancelAnimationFrame'
]);

function findUndefinedReferences(source, filename = 'source.jsx') {
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'], sourceFilename: filename });
  const errors = [];
  traverse(ast, {
    ReferencedIdentifier(reference) {
      const name = reference.node.name;
      if (reference.isJSXIdentifier() && /^[a-z]/.test(name)) return;
      if (!reference.scope.hasBinding(name) && !browserGlobals.has(name)) {
        errors.push(`${filename}:${reference.node.loc.start.line}: referência não definida: ${name}`);
      }
    }
  });
  return errors;
}

if (require.main === module) {
  const sources = process.argv.slice(2);
  const files = sources.length ? sources : [
    path.resolve(__dirname, '../src/pages/Oportunidades.jsx'),
    path.resolve(__dirname, '../src/components/OpportunityForm.jsx'),
    path.resolve(__dirname, '../src/utils/opportunity-negotiation.mjs')
  ];
  const errors = files.flatMap(filename => findUndefinedReferences(fs.readFileSync(filename, 'utf8'), filename));
  if (errors.length) {
    console.error('Build bloqueado: o fluxo de edição de oportunidades contém referências inválidas.\n' + errors.join('\n'));
    process.exitCode = 1;
  } else console.log('Proteção da edição B2B: referências verificadas.');
}
module.exports = { findUndefinedReferences };
