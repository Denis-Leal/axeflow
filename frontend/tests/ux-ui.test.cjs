const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transformSync } = require('next/dist/build/swc');
const filename = path.resolve(__dirname, '../components/ui/index.js');
const output = transformSync(fs.readFileSync(filename, 'utf8'), {
  filename,
  jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
  module: { type: 'commonjs' },
});
const compiled = new Module(filename, module);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(output.code, filename);
const { Button, FormField, Spinner } = compiled.exports;

test('FormField associates generated labels and hints with each control', () => {
  const markup = renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement(FormField, { label: 'Name', hint: 'Full name' }, React.createElement('input')),
    React.createElement(FormField, { label: 'Category' }, React.createElement('select'))));
  const labels = [...markup.matchAll(/for="([^"]+)"/g)].map(match => match[1]);
  assert.equal(labels.length, 2);
  assert.notEqual(labels[0], labels[1]);
  for (const id of labels) assert.ok(markup.includes(`id="${id}"`));
  assert.ok(markup.includes(`aria-describedby="${labels[0]}-hint"`));
  assert.ok(markup.includes(`id="${labels[0]}-hint"`));
});
test('FormField preserves explicit IDs, descriptions and native constraints', () => {
  const markup = renderToStaticMarkup(React.createElement(FormField, { label: 'Quantity', hint: 'Units' },
    React.createElement('input', { id: 'quantity', required: true, min: 1, 'aria-describedby': 'existing' })));
  assert.ok(markup.includes('for="quantity"'));
  assert.ok(markup.includes('aria-describedby="existing quantity-hint"'));
  assert.ok(markup.includes('required=""'));
  assert.ok(markup.includes('min="1"'));
});
test('disabled and loading links cannot navigate or invoke actions', () => {
  for (const state of [{ disabled: true }, { loading: true }]) {
    let calls = 0, prevented = false;
    const element = Button({ ...state, href: '/giras', onClick: () => calls++, children: 'Open' });
    assert.equal(element.props.href, undefined);
    assert.equal(element.props['aria-disabled'], true);
    assert.equal(element.props.tabIndex, -1);
    element.props.onClick({ preventDefault() { prevented = true; } });
    assert.equal(calls, 0);
    assert.equal(prevented, true);
  }
});
test('enabled link preserves destination and click action', () => {
  let calls = 0;
  const element = Button({ href: '/giras', onClick: () => calls++ });
  assert.equal(element.props.href, '/giras');
  element.props.onClick({});
  assert.equal(calls, 1);
});
test('spinner exposes a named loading status', () => {
  const markup = renderToStaticMarkup(React.createElement(Spinner));
  assert.ok(markup.includes('role="status"'));
  assert.ok(markup.includes('aria-label="Carregando"'));
});
const { StatCard } = compiled.exports;
test('interactive statistics support Enter and Space without changing static cards', () => {
  let calls = 0, prevented = 0;
  const interactive = StatCard({ onClick: () => calls++, value: 'Public' });
  assert.equal(interactive.props.role, 'button');
  assert.equal(interactive.props.tabIndex, 0);
  for (const key of ['Enter', ' ', 'ArrowDown']) interactive.props.onKeyDown({ key, preventDefault() { prevented++; } });
  assert.equal(calls, 2);
  assert.equal(prevented, 2);
  const staticCard = StatCard({ value: 10 });
  assert.equal(staticCard.props.role, undefined);
  assert.equal(staticCard.props.tabIndex, undefined);
});
