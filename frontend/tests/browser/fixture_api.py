"""Disposable in-memory API for UI validation only. Never connects to a database."""
import json
import time
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
from pathlib import Path

FRONTEND = Path(__file__).resolve().parents[2]

USER = dict(id='user-test', nome='Pessoa Teste', email='ux@example.test', role='admin', terreiro_id='tenant-test', terreiro_nome='Terreiro Ficticio UX', ativo=True)
GIRA = dict(id='gira-test', titulo='Gira Ficticia UX', tipo='Umbanda', acesso='publica', data='2026-12-10', horario='19:00:00', status='aberta', limite_consulentes=20, limite_membros=5, abertura_lista='2020-01-01T00:00:00Z', fechamento_lista='2030-12-10T19:00:00Z', slug_publico='ux-test', slug='ux-test', vagas_disponiveis=20, lista_aberta=True, terreiro_nome='Terreiro Ficticio UX', total_inscritos=0, responsavel_lista_id=None)
PUBLIC_GIRA = {**GIRA, 'id': 'public-gira-test'}  # Independent from create/edit scenarios.
CONSULENTES = [dict(id='consulente-test', nome='Consulente Ficticio', telefone='11999999999', observacoes='Nota de teste', total_inscricoes=0, total_giras=0)]
TIPO = dict(id='tipo-test', nome='Atendimento Ficticio', descricao='Teste', valor='150.00', tipo_cobranca='servico', ativo=True)
AGENDAMENTO = dict(id='agendamento-test', consulente_id='consulente-test', consulente=CONSULENTES[0], atendimento_tipo_id='tipo-test', atendimento_tipo=TIPO, inicio='2026-12-10T14:00:00', fim=None, valor='150.00', status='agendado', observacoes='Teste')
CONTA = dict(id='conta-test', agendamento_id='agendamento-test', descricao='Cobranca Ficticia', valor='150.00', status='pendente', total_pago='0', valor_restante='150.00', created_at='2026-10-29T12:00:00Z')
ITEM = dict(id='item-test', name='Vela Ficticia', category='velas', unit='un', owner_type='terreiro', current_stock=10, minimum_threshold=2, low_stock=False)
COUNTS = Counter()
RULES = {}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def handle_request(self):
        path = urlparse(self.path).path
        assets = {
            '/__react': FRONTEND / 'node_modules/react/umd/react.development.js',
            '/__react_dom': FRONTEND / 'node_modules/react-dom/umd/react-dom.development.js',
        }
        if path in assets:
            return self.raw('application/javascript', assets[path].read_bytes())
        if path == '/__hook':
            source = (FRONTEND / 'hooks/useModalDialog.js').read_text(encoding='utf-8')
            source = source.replace("import { useEffect, useRef } from 'react';", 'const {useEffect,useRef}=React;').replace('export function useModalDialog', 'function useModalDialog')
            return self.raw('application/javascript', source.encode())
        if path == '/__modal-harness':
            return self.raw('text/html', b'''<!doctype html><html><body><div id="root"></div>
<script src="/__react"></script><script src="/__react_dom"></script><script src="/__hook"></script>
<script>
const h=React.createElement;
function Child({close}) {const props=useModalDialog({label:'Child',onClose:close});return h('div',{...props,id:'child'},h('button',{id:'child-close',onClick:close},'Close child'));}
function Parent({close}) {const [child,setChild]=React.useState(false);const props=useModalDialog({label:'Parent',onClose:close});return h(React.Fragment,null,h('div',{...props,id:'parent'},h('input',{id:'parent-input'}),h('button',{id:'open-child',onClick:()=>setChild(true)},'Open child'),h('button',{id:'close-parent',onClick:close},'Close parent')),child&&h(Child,{close:()=>setChild(false)}));}
function App(){const [open,setOpen]=React.useState(false);return h(React.Fragment,null,h('button',{id:'open-parent',onClick:()=>setOpen(true)},'Open parent'),open&&h(Parent,{close:()=>setOpen(false)}));}
ReactDOM.createRoot(document.getElementById('root')).render(h(React.StrictMode,null,h(App)));
</script></body></html>''')
        key = self.command + ' ' + path
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        payload = json.loads(body) if body else {}
        if path == '/__control':
            RULES.update(payload.get('rules', {}))
            if payload.get('role'):
                USER['role'] = payload['role']
            if payload.get('restore_consulente'):
                CONSULENTES[:] = [dict(id='consulente-test', nome='Consulente Ficticio', telefone='11999999999', observacoes='Nota de teste', total_inscricoes=0, total_giras=0)]
            return self.send(200, dict(counts=dict(COUNTS)))
        COUNTS[key] += 1
        rule = RULES.get(key, {})
        if rule.get('delay'):
            time.sleep(rule['delay'])
        if rule.get('status'):
            return self.send(rule['status'], dict(detail='Falha controlada de teste'))
        if rule.get('empty'):
            return self.send(200, [])
        if path == '/auth/login':
            return self.send(200, dict(access_token='fixture-only-token'))
        if path == '/auth/me':
            return self.send(200, USER)
        if path == '/giras':
            if self.command == 'POST':
                GIRA.update(payload)
            return self.send(200, [GIRA] if self.command == 'GET' else GIRA)
        if path == '/giras/gira-test':
            if self.command == 'PATCH':
                GIRA.update(payload)
            return self.send(200, GIRA)
        if path in ['/public/gira/ux-test', '/gira/ux-test']:
            return self.send(200, PUBLIC_GIRA)
        if path == '/public/gira/ux-test/inscrever':
            return self.send(200, dict(status='confirmado', consulente_nome=payload.get('nome'), posicao=1))
        if path in ['/consulentes/lista', '/consulentes/search']:
            return self.send(200, CONSULENTES)
        if path == '/consulentes/ranking':
            return self.send(200, [])
        if path == '/consulentes/consulente-test':
            if self.command == 'DELETE':
                CONSULENTES.clear()
                return self.send(204, None)
            CONSULENTES[0].update(payload)
            return self.send(200, CONSULENTES[0])
        if path == '/membros':
            return self.send(200, [USER])
        if path == '/membros/user-test':
            return self.send(200, {**USER, **payload})
        if path == '/inventory/items':
            return self.send(200, [ITEM])
        if path == '/inventory/items/item-test/history':
            return self.send(200, [dict(id='movement-test', type='IN', quantity=10, notes='Movimento ficticio', created_at='2026-10-29T12:00:00Z')])
        if path == '/atendimentos':
            return self.send(200, [TIPO] if self.command == 'GET' else {**TIPO, **payload})
        if path == '/atendimentos/tipo-test':
            return self.send(200, {**TIPO, **payload})
        if path == '/agendamentos':
            return self.send(200, [AGENDAMENTO] if self.command == 'GET' else {**AGENDAMENTO, **payload})
        if path == '/agendamentos/agendamento-test':
            return self.send(200, {**AGENDAMENTO, **payload})
        if path == '/formas-pagamento':
            return self.send(200, [dict(id='forma-test', nome='Forma Ficticia', ativo=True)])
        if path == '/contas-receber':
            return self.send(200, [CONTA])
        if path == '/contas-receber/conta-test':
            return self.send(200, CONTA)
        if path == '/contas-receber/conta-test/pagamentos':
            return self.send(200, dict(id='payment-test', **payload))
        if path == '/pagamentos':
            return self.send(200, [])
        if 'presenca-membros' in path or path.endswith('/inscricoes') or path.endswith('/consumption'):
            return self.send(200, [])
        if path.endswith('/ajeum'):
            return self.send(404, dict(detail='Sem Ajeum de teste'))
        return self.send(404, dict(detail='Fixture route not configured: ' + key))

    def send(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        if data is not None:
            self.wfile.write(json.dumps(data).encode())

    def raw(self, content_type, data):
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.end_headers()
        self.wfile.write(data)

    do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = handle_request


if __name__ == '__main__':
    print('Fixture API listening on 127.0.0.1:8101; no database', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8101), Handler).serve_forever()
