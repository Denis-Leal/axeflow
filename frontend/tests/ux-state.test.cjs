const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('next/dist/build/swc');

// Minimal hook scheduler for deterministic request ordering and effect cleanup.
// This tests state/lifecycle logic, not React DOM integration or visual accessibility.
function harness(file, exportName, api = {}, globals = {}) {
  const slots = [], pending = [];
  let index = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = index++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef(initial) {
      const i = index++;
      return slots[i] ||= { current: initial };
    },
    useCallback(fn, deps) {
      const i = index++;
      if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = index++;
      if (!slots[i] || !same(slots[i].deps, deps)) {
        const previous = slots[i];
        slots[i] = { deps };
        pending.push(() => { previous?.cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
  };
  const filename = path.resolve(__dirname, '../', file);
  const source = fs.readFileSync(filename, 'utf8') + (file.startsWith('pages/') ? `\nexport { ${exportName} };` : '');
  const { code } = transformSync(source, {
    filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' },
  });
  let modalModule;
  const context = { exports: {}, process: { env: {} }, ...globals };
  context.require = name => {
    if (name === 'react') return react;
    if (name.includes('jsx-runtime')) return require(name);
    if (name.endsWith('/useModalDialog')) {
      if (!modalModule) {
        const filename = path.resolve(__dirname, '../hooks/useModalDialog.js');
        const compiled = transformSync(fs.readFileSync(filename, 'utf8'), { filename, jsc: { parser: { syntax: 'ecmascript' } }, module: { type: 'commonjs' } });
        const local = { ...context, exports: {} };
        vm.runInNewContext(compiled.code, local);
        modalModule = local.exports;
      }
      return modalModule;
    }
    if (name.endsWith('components/ui')) return Object.fromEntries(['Button', 'Card', 'CardHeader', 'CardBody', 'StatCard', 'EmptyState', 'Spinner'].map(key => [key, 'mock-' + key]));
    if (['next/head', 'next/link'].includes(name) || /components\/(Sidebar|BottomNav|ConfirmModal)$/.test(name)) return function Mock() {};
    return api;
  };
  vm.runInNewContext(code, context);
  return {
    render(props) { index = 0; return context.exports[exportName](props); },
    renderMany(props) { index = 0; return props.map(p => context.exports[exportName](p)); },
    effects() { pending.splice(0).forEach(run => run()); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

test('consulentes: initial failure is explicit, retry can return a successful empty list', async () => {
  let attempts = 0;
  const h = harness('hooks/useConsulentes.js', 'useConsulentes', {
    listConsulentes: async () => { if (++attempts === 1) throw Error('offline'); return { data: [] }; },
  });
  assert.equal(h.render().loading, true);
  h.effects(); await settle();
  let state = h.render();
  assert.equal(state.loading, false);
  assert.equal(state.error.message, 'offline');
  await state.reload();
  state = h.render();
  assert.equal(state.error, null);
  assert.equal(state.loading, false);
  assert.equal(state.consulentes.length, 0);
  assert.equal(attempts, 2);
  h.unmount();
});

test('consulentes: failed refresh preserves data and older replies cannot overwrite a newer request', async () => {
  const requests = [];
  const h = harness('hooks/useConsulentes.js', 'useConsulentes', {
    listConsulentes: () => { const d = deferred(); requests.push(d); return d.promise; },
  });
  h.render(); h.effects();
  const newer = h.render().reload();
  requests[1].resolve({ data: [{ id: 'new' }] }); await newer;
  requests[0].resolve({ data: [{ id: 'old' }] }); await settle();
  assert.equal(h.render().consulentes[0].id, 'new');
  const failure = h.render().reload();
  requests[2].reject(Error('network')); await failure;
  assert.equal(h.render().consulentes[0].id, 'new');
  assert.equal(h.render().error.message, 'network');
  h.unmount();
});

test('ranking: failure does not cause automatic retry; explicit retries are deduplicated', async () => {
  let attempts = 0;
  const retry = deferred();
  const h = harness('hooks/useConsulentes.js', 'useConsulentes', {
    listConsulentes: async () => ({ data: [] }),
    getRankingConsulentes: () => { if (++attempts === 1) return Promise.reject(Error('offline')); return retry.promise; },
  });
  h.render(); h.effects(); await settle();
  const load = h.render().loadRanking;
  await load();
  for (let i = 0; i < 8; i++) { assert.equal(h.render().loadRanking, load); await h.render().loadRanking(); }
  assert.equal(attempts, 1);
  assert.equal(h.render().rankingError.message, 'offline');
  assert.equal(h.render().error, null);
  const pending = load(true);
  await load(true);
  assert.equal(attempts, 2);
  retry.resolve({ data: [] }); await pending;
  assert.equal(h.render().rankingCarregado, true);
  assert.equal(h.render().rankingError, null);
  h.unmount();
});

test('consulentes: a delayed list response cannot resurrect a deleted record', async () => {
  const late = deferred(); let calls = 0;
  const h = harness('hooks/useConsulentes.js', 'useConsulentes', {
    listConsulentes: () => ++calls === 1 ? Promise.resolve({ data: [{ id: 'one' }] }) : late.promise,
    deleteConsulente: async () => {},
  });
  h.render(); h.effects(); await settle();
  const refresh = h.render().reload();
  await h.render().deletarConsulente('one');
  late.resolve({ data: [{ id: 'one' }] }); await refresh;
  assert.equal(h.render().consulentes.length, 0);
  assert.equal(h.render().loading, false);
  h.unmount();
});

function fakeDOM() {
  const events = {};
  const document = {
    addEventListener(type, callback) { (events[type] ||= new Set()).add(callback); },
    removeEventListener(type, callback) { events[type]?.delete(callback); },
  };
  class Element {
    constructor(parent) { this.parentElement = parent; this.children = []; this.inert = false; this.tabIndex = 0; this.isConnected = true; parent?.children.push(this); }
    contains(el) { return el === this || this.children.some(child => child.contains(el)); }
    closest() { return this.inert ? this : this.parentElement?.closest() || null; }
    getClientRects() { return [1]; }
    querySelectorAll() { return this.children; }
    focus() { if (!this.closest()) document.activeElement = this; }
  }
  document.body = new Element(); document.body.style = { overflow: 'auto' };
  const page = new Element(document.body), trigger = new Element(page), root = new Element(document.body);
  const first = new Element(root), last = new Element(root);
  document.activeElement = trigger;
  const key = (value, shiftKey = false) => {
    const event = { key: value, shiftKey, prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {} };
    [...events.keydown || []].forEach(callback => callback(event)); return event;
  };
  return { document, Element, page, trigger, root, first, last, key };
}

test('modal: initial focus, background inertness, Tab containment, Escape and focus restoration', () => {
  const dom = fakeDOM(); let closed = 0;
  const h = harness('hooks/useModalDialog.js', 'useModalDialog', {}, { document: dom.document });
  const props = { label: 'Edit', onClose: () => closed++ };
  const result = h.render(props); result.ref.current = dom.root; h.effects();
  assert.equal(result.role, 'dialog'); assert.equal(result['aria-label'], 'Edit');
  assert.equal(dom.page.inert, true); assert.equal(dom.document.body.style.overflow, 'hidden');
  assert.equal(dom.document.activeElement, dom.first);
  assert.equal(dom.key('Tab', true).prevented, true); assert.equal(dom.document.activeElement, dom.last);
  dom.key('Tab'); assert.equal(dom.document.activeElement, dom.first);
  h.render({ ...props, busy: true }); dom.key('Escape'); assert.equal(closed, 0);
  h.render(props); dom.key('Escape'); assert.equal(closed, 1);
  h.unmount();
  assert.equal(dom.page.inert, false); assert.equal(dom.document.activeElement, dom.trigger);
  assert.equal(dom.document.body.style.overflow, 'auto');
});

test('modal: only the top dialog handles Escape and closing it restores the underlying dialog', () => {
  const dom = fakeDOM(); let parentClosed = 0, childClosed = 0;
  const childRoot = new dom.Element(dom.document.body); const childControl = new dom.Element(childRoot);
  const h = harness('hooks/useModalDialog.js', 'useModalDialog', {}, { document: dom.document });
  const parentProps = { onClose: () => parentClosed++, label: 'Parent' };
  const childProps = { onClose: () => childClosed++, label: 'Child' };
  const [parent, child] = h.renderMany([parentProps, childProps]);
  parent.ref.current = dom.root; child.ref.current = childRoot; h.effects();
  assert.equal(dom.root.inert, true); assert.equal(childRoot.inert, false);
  assert.equal(dom.document.activeElement, childControl);
  dom.key('Escape'); assert.equal(parentClosed, 0); assert.equal(childClosed, 1);
  h.renderMany([parentProps, { ...childProps, open: false }]); h.effects();
  assert.equal(dom.root.inert, false); assert.equal(dom.page.inert, true);
  assert.equal(dom.document.activeElement, dom.first);
  dom.key('Escape'); assert.equal(parentClosed, 1);
  h.unmount(); assert.equal(dom.page.inert, false);
});

function findElement(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null;
  if (predicate(tree)) return tree;
  const children = tree.props?.children;
  for (const child of Array.isArray(children) ? children.flat(Infinity) : [children]) {
    const result = findElement(child, predicate); if (result) return result;
  }
  return null;
}

test('public registration: native form constraints, error preserves fields and retry reaches success', async () => {
  let attempts = 0, sent;
  const h = harness('pages/public/[slug].js', 'FormularioInscricao', {
    inscreverPublico: async (slug, payload) => {
      sent = payload;
      if (++attempts === 1) throw Error('offline');
      return { data: { status: 'confirmado', consulente_nome: payload.nome, posicao: 1 } };
    },
    handleApiError: () => 'Falha de rede',
  });
  const props = { slug: 'test', listaEspera: false, posicaoFila: 0 };
  let tree = h.render(props);
  assert.equal(tree.type, 'form');
  const name = findElement(tree, el => el.props?.id === 'inscricao-nome');
  assert.equal(name.props.required, true);
  assert.equal(new RegExp(name.props.pattern).test('   '), false);
  name.props.onChange({ target: { value: 'Example' } });
  tree = h.render(props);
  findElement(tree, el => el.props?.id === 'inscricao-telefone').props.onChange({ target: { value: '11999999999' } });
  tree = h.render(props);
  const checkbox = findElement(tree, el => el.props?.id === 'primeira-visita');
  assert.equal(checkbox.props.type, 'checkbox'); assert.equal(checkbox.props.className, 'visually-hidden');
  await tree.props.onSubmit({ preventDefault() {} });
  tree = h.render(props);
  assert.ok(findElement(tree, el => el.props?.role === 'alert'));
  assert.equal(findElement(tree, el => el.props?.id === 'inscricao-nome').props.value, 'Example');
  assert.ok(findElement(tree, el => el.props?.id === 'inscricao-telefone').props.value);
  await tree.props.onSubmit({ preventDefault() {} });
  tree = h.render(props);
  assert.equal(tree.props.role, 'status'); assert.equal(attempts, 2);
  assert.equal(sent.nome, 'Example'); assert.equal(sent.primeira_visita, false);
});

test('stock history: failure is not empty success; explicit retry and older item response are handled', async () => {
  const requests = [];
  const h = harness('pages/inventario.js', 'ModalHistorico', {
    getHistoricoItem: () => { const d = deferred(); requests.push(d); return d.promise; },
    handleApiError: () => 'Falha de rede',
  });
  const item = { id: 'first', name: 'Item' };
  h.render({ item }); h.effects();
  requests[0].reject(Error('offline')); await settle();
  let tree = h.render({ item });
  assert.ok(findElement(tree, el => el.props?.role === 'alert'));
  assert.equal(findElement(tree, el => el.props?.icon === 'clock-history'), null);
  findElement(tree, el => el.props?.children === 'Tentar novamente').props.onClick();
  h.render({ item }); h.effects();
  const newerItem = { id: 'second', name: 'Other' };
  h.render({ item: newerItem }); h.effects();
  requests[2].resolve({ data: [] }); await settle();
  requests[1].resolve({ data: [{ id: 'stale' }] }); await settle();
  tree = h.render({ item: newerItem });
  assert.ok(findElement(tree, el => el.props?.icon === 'clock-history'));
  assert.equal(findElement(tree, el => el.type === 'table'), null);
  h.unmount();
});

test('stock history: shared dialog keeps focus contained and Escape safely dismisses an outstanding read', async () => {
  const dom = fakeDOM();
  const pending = deferred();
  let closed = 0;
  const h = harness('pages/inventario.js', 'ModalHistorico', {
    getHistoricoItem: () => pending.promise,
  }, { document: dom.document });
  const props = { item: { id: 'one', name: 'Velas' }, onClose: () => closed++ };
  const tree = h.render(props);
  tree.ref.current = dom.root;
  h.effects();
  assert.equal(tree.props.role, 'dialog');
  assert.equal(tree.props['aria-label'], 'Histórico de Velas');
  assert.equal(tree.props['aria-busy'], true);
  assert.equal(dom.document.activeElement, dom.first);
  assert.equal(dom.page.inert, true);
  dom.key('Tab', true);
  assert.equal(dom.document.activeElement, dom.last);
  dom.key('Escape');
  assert.equal(closed, 1);
  h.unmount();
  assert.equal(dom.document.activeElement, dom.trigger);
  assert.equal(dom.page.inert, false);
  pending.resolve({ data: [{ id: 'late' }] });
  await settle(); // The cancelled read must not write after cleanup.
});

function giraHarness(updateGira) {
  const pushes = [];
  const gira = { titulo: 'Original', tipo: '', acesso: 'fechada', data: '2026-12-10', horario: '19:00:00', status: 'aberta', limite_membros: 5 };
  const h = harness('pages/giras/editar/[id].js', 'EditarGira', {
    useRouter: () => ({ query: { id: 'gira-test' }, push: route => pushes.push(route) }),
    getGira: async () => ({ data: gira }),
    listMembros: async () => ({ data: [] }),
    updateGira,
    handleApiError: () => 'Falha de teste',
  }, { localStorage: { getItem: () => 'fixture-token' } });
  return { h, pushes };
}

test('gira: cancelling confirmation keeps save enabled and preserves edits without a PATCH', async () => {
  let patches = 0;
  const { h } = giraHarness(async () => { patches++; });
  h.render(); h.effects(); await settle();
  let tree = h.render();
  findElement(tree, el => el.type === 'input' && el.props.value === 'Original').props.onChange({ target: { value: 'Alterada' } });
  tree = h.render();
  await findElement(tree, el => el.type === 'form').props.onSubmit({ preventDefault() {} });
  tree = h.render();
  const confirmation = findElement(tree, el => el.props?.aberto === true);
  assert.equal(confirmation.props.titulo, 'Confirmar edição');
  confirmation.props.onCancelar();
  tree = h.render();
  assert.equal(findElement(tree, el => el.props?.type === 'submit').props.disabled, false);
  assert.ok(findElement(tree, el => el.type === 'input' && el.props.value === 'Alterada'));
  assert.equal(patches, 0);
  h.unmount();
});

test('gira: positive confirmation still sends PATCH, exposes busy state and recovers from error', async () => {
  const request = deferred();
  const sent = [];
  const { h, pushes } = giraHarness((id, payload) => { sent.push({ id, payload }); return request.promise; });
  h.render(); h.effects(); await settle();
  let tree = h.render();
  findElement(tree, el => el.type === 'input' && el.props.value === 'Original').props.onChange({ target: { value: 'Alterada' } });
  tree = h.render();
  await findElement(tree, el => el.type === 'form').props.onSubmit({ preventDefault() {} });
  const confirm = findElement(h.render(), el => el.props?.aberto === true);
  const saving = confirm.props.onConfirmar();
  assert.equal(findElement(h.render(), el => el.props?.type === 'submit').props.disabled, true);
  assert.equal(sent[0].id, 'gira-test');
  assert.equal(sent[0].payload.titulo, 'Alterada');
  request.reject(Error('offline')); await saving;
  tree = h.render();
  assert.equal(findElement(tree, el => el.props?.aberto === true).props.titulo, 'Erro ao salvar');
  assert.equal(findElement(tree, el => el.props?.type === 'submit').props.disabled, false);
  assert.ok(findElement(tree, el => el.type === 'input' && el.props.value === 'Alterada'));
  assert.equal(pushes.length, 0);
  h.unmount();
});
