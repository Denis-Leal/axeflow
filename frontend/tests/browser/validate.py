"""Real Chrome UI checks against fixture_api.py only. No real API/database writes."""
import json
import os
import time
import traceback
import sys
from driver import Driver, OUT

d = Driver()
results = []
only = os.environ.get('UX_ONLY', '').split('|') if os.environ.get('UX_ONLY') else []
if only and (OUT / 'results.json').exists():
    results = [r for r in json.loads((OUT / 'results.json').read_text(encoding='utf-8')) if not any(term in r['name'] for term in only)]


def case(name, fn):
    if only and not any(term in name for term in only):
        return
    try:
        fn()
        results.append(dict(name=name, status='passed'))
        print('PASS ' + name, flush=True)
    except Exception as e:
        results.append(dict(name=name, status='failed', error=str(e)[:3000]))
        print('FAIL ' + name + ': ' + str(e)[:1200], flush=True)
        try:
            d.screenshot('failure-' + str(len(results)))
        except Exception:
            pass
    (OUT / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')


def modal():
    d.wait("document.querySelector('[role=dialog]')")
    assert d.js("const m=[...document.querySelectorAll('[role=dialog]')].find(e=>!e.closest('[inert]'));return m.contains(document.activeElement)"), 'Initial focus escaped modal'
    assert d.js("return document.querySelectorAll('[inert]').length>0"), 'Background is not inert'
    # Set focus to boundaries, then send real key events through WebDriver.
    d.js("const m=[...document.querySelectorAll('[role=dialog]')].find(e=>!e.closest('[inert]')); const c=[...m.querySelectorAll('button,input,textarea,select,a[href],[tabindex]')].filter(e=>!e.disabled&&e.tabIndex>=0&&e.getClientRects().length); c.at(-1).focus()")
    d.key('\ue004')
    assert d.js("const m=[...document.querySelectorAll('[role=dialog]')].find(e=>!e.closest('[inert]')); const c=[...m.querySelectorAll('button,input,textarea,select,a[href],[tabindex]')].filter(e=>!e.disabled&&e.tabIndex>=0&&e.getClientRects().length); return document.activeElement===c[0]"), 'Tab did not wrap'
    d.shift_tab()
    assert d.js("const m=[...document.querySelectorAll('[role=dialog]')].find(e=>!e.closest('[inert]')); const c=[...m.querySelectorAll('button,input,textarea,select,a[href],[tabindex]')].filter(e=>!e.disabled&&e.tabIndex>=0&&e.getClientRects().length); return document.activeElement===c.at(-1)"), 'Shift+Tab did not wrap'


def dismiss():
    d.key('\ue00c')
    d.wait("!document.querySelector('[role=dialog]')")
    assert d.js("return !document.querySelector('[inert]')"), 'Background remained inert'


def login():
    d.go('/login')
    d.wait("document.querySelector('input[type=email]')")
    d.click('button[type=submit]')
    assert d.js("return document.querySelector('input[type=email]').validity.valueMissing")
    d.text('input[type=email]', 'ux@example.test')
    d.text('input[type=password]', 'fixture-only-password')
    d.click('button[type=submit]')
    d.wait("location.pathname==='/dashboard' && document.querySelector('.main-content .page-content')", 30)
    d.screenshot('desktop-dashboard')


def consulentes():
    d.go('/consulentes')
    d.wait("document.body.innerText.includes('Consulente Ficticio')")
    d.click('button[aria-label^="Editar "]')
    modal()
    d.screenshot('desktop-consulente-edit')
    d.control(rules={'PUT /consulentes/consulente-test': dict(status=503, delay=1.0)})
    d.text('[role=dialog] input:first-of-type', 'Consulente Alterado UX')
    d.click('[role=dialog] button[type=submit]')
    d.wait("document.querySelector('[role=dialog][aria-busy=true]')")
    d.key('\ue00c')
    assert d.js("return !!document.querySelector('[role=dialog]')"), 'Busy modal closed'
    d.wait("document.querySelector('[role=dialog] [role=alert]')")
    assert d.js("return document.querySelector('[role=dialog] input').value==='Consulente Alterado UX'")
    d.screenshot('desktop-consulente-error')
    d.control(rules={'PUT /consulentes/consulente-test': {}})
    d.click('[role=dialog] button[type=submit]')
    d.wait("!document.querySelector('[role=dialog]') && document.body.innerText.includes('Consulente Alterado UX')")
    d.click('button[aria-label^="Excluir "]')
    modal()
    assert d.js("return document.activeElement.textContent.includes('Deletar')"), 'Unexpected last control after Shift+Tab'
    d.click_text('Cancelar', exact=True)
    d.wait("!document.querySelector('[role=dialog]')")
    d.click('button[aria-label^="Excluir "]')
    d.click_text('Deletar', exact=True)  # In-memory fixture record only.
    d.wait("document.body.innerText.includes('Nenhum consulente')")
    d.control(restore_consulente=True)


def consulente_errors():
    d.control(rules={'GET /consulentes/lista': dict(status=503), 'GET /consulentes/ranking': dict(status=503)})
    d.go('/consulentes')
    d.wait("document.querySelector('[role=alert]') && document.body.innerText.includes('Tentar novamente')")
    assert not d.js("return document.body.innerText.includes('Nenhum consulente')")
    d.control(rules={'GET /consulentes/lista': {}})
    d.click_text('Tentar novamente')
    d.wait("document.body.innerText.includes('Consulente Ficticio')")
    d.click_text('Ranking')
    d.wait("document.querySelector('[role=alert]')")
    before = d.control()['counts'].get('GET /consulentes/ranking', 0)
    time.sleep(1)
    after = d.control()['counts'].get('GET /consulentes/ranking', 0)
    assert before == after, 'Ranking is automatically retrying failures'
    d.control(rules={'GET /consulentes/ranking': {}})
    d.click_text('Tentar novamente')
    d.wait("document.body.innerText.includes('Nenhum dado')")


def inventario():
    d.control(rules={'GET /inventory/items/item-test/history': dict(status=503, delay=.5)})
    d.go('/inventario')
    d.wait("document.body.innerText.includes('Vela Ficticia')")
    d.click_text('Ver histórico')
    d.wait("document.body.innerText.includes('Tentar novamente')")
    assert not d.js("return document.body.innerText.includes('Nenhuma movimentação')")
    d.screenshot('desktop-history-error')
    d.control(rules={'GET /inventory/items/item-test/history': {}})
    d.click_text('Tentar novamente')
    d.wait("document.body.innerText.includes('Movimento ficticio')")
    d.click('button[aria-label="Fechar histórico"]')


def giras():
    d.go('/giras/nova')
    d.wait("document.querySelector('form input')")
    d.click('button[type=submit]')
    assert d.js("return !document.querySelector('form').checkValidity()")
    d.click_text('Fechada', tag='[role=button]')
    d.text('form input:not([type])', 'Gira Criada UX')
    d.value('input[type=date]', '2026-12-10')
    d.value('input[type=time]', '19:00')
    d.value('input[type=number]', '5')
    d.control(rules={'POST /giras': dict(status=503)})
    d.click('button[type=submit]')
    d.wait("document.querySelector('.alert-danger-custom')")
    assert d.js("return document.querySelector('form input:not([type])').value==='Gira Criada UX'")
    d.control(rules={'POST /giras': {}})
    d.click('button[type=submit]')
    d.wait("location.pathname==='/giras/gira-test'", 30)
    d.go('/giras/editar/gira-test')
    d.wait("document.querySelector('form input')")
    d.screenshot('desktop-gira-edit')
    d.text('form input:not([type])', 'Gira Editada UX')
    d.click('button[type=submit]')
    modal()
    d.screenshot('desktop-gira-confirm')
    d.click_text('Cancelar', exact=True)
    d.wait("!document.querySelector('[role=dialog]')")
    d.screenshot('gira-cancel-enabled')
    assert d.js("return !document.querySelector('button[type=submit]').disabled"), 'Save stays disabled after cancelling confirmation'


def public_registration():
    d.go('/public/ux-test')
    d.wait("document.querySelector('#inscricao-nome')")
    d.click('button[type=submit]')
    assert d.js("return document.querySelector('#inscricao-nome').validity.valueMissing")
    d.text('#inscricao-nome', 'Visitante Ficticio UX')
    d.text('#inscricao-telefone', '11999999999')
    d.click('label[for=primeira-visita]')
    assert d.js("return document.querySelector('#primeira-visita').checked")
    d.control(rules={'POST /public/gira/ux-test/inscrever': dict(status=503)})
    d.click('button[type=submit]')
    d.wait("document.querySelector('[role=alert]')")
    assert d.js("return document.querySelector('#inscricao-nome').value==='Visitante Ficticio UX'")
    d.control(rules={'POST /public/gira/ux-test/inscrever': {}})
    d.click('button[type=submit]')
    d.wait("document.querySelector('[role=status]') && document.body.innerText.includes('Inscrição confirmada')")
    d.screenshot('desktop-public-success')


def form_modal(route, button_text, screenshot):
    d.go(route)
    d.wait("document.querySelector('.page-content')")
    d.wait("[...document.querySelectorAll('button')].some(e=>e.textContent.includes(" + json.dumps(button_text) + "))")
    d.click_text(button_text)
    modal()
    d.screenshot(screenshot)
    dismiss()


def financeiro():
    d.go('/financeiro')
    d.wait("document.body.innerText.includes('Cobranca Ficticia')")
    d.click_text('Detalhes')
    modal()
    d.click_text('Registrar pagamento')
    modal()
    d.screenshot('desktop-payment-modal')
    # No backend/payment call: native validation then cancel.
    d.click('[role=dialog]:not([inert]) button[type=submit]')
    assert d.js("return !!document.querySelector('[role=dialog]')")
    dismiss()


def nested_hook():
    d.call('/url', dict(url='http://127.0.0.1:8101/__modal-harness'))
    d.wait("document.querySelector('#open-parent')")
    d.click('#open-parent')
    modal()
    d.click('#open-child')
    d.wait("document.querySelector('#child')")
    assert d.js("return document.querySelector('#parent').inert && !document.querySelector('#child').inert")
    modal()
    d.key('\ue00c')
    d.wait("!document.querySelector('#child') && document.querySelector('#parent')")
    assert d.js("return document.activeElement.id==='open-child' && !document.querySelector('#parent').inert")
    d.key('\ue00c')
    d.wait("!document.querySelector('[role=dialog]')")
    assert d.js("return document.activeElement.id==='open-parent' && !document.querySelector('[inert]')")


def menus():
    d.size(390,844)
    d.go('/consulentes')
    d.wait("document.querySelector('button[aria-label=Mais]')")
    for label in ['Mais','Criar']:
        selector='button[aria-label='+label+']'
        d.click(selector)
        d.wait("document.querySelector("+json.dumps(selector)+").getAttribute('aria-expanded')==='true'")
        d.key('\ue00c')
        d.wait("document.querySelector("+json.dumps(selector)+").getAttribute('aria-expanded')==='false'")
        assert d.js("return document.activeElement===document.querySelector(arguments[0])",selector)
    d.click('button[aria-label=Mais]')
    d.click('#nav-mais a[href="/membros"]')
    d.wait("location.pathname==='/membros' && !document.querySelector('#nav-mais')")


def edit_confirm():
    d.size(1440,900)
    d.go('/giras/editar/gira-test')
    d.wait("document.querySelector('form input')")
    d.text('form input:not([type])','Gira Confirmada UX')
    d.click('button[type=submit]')
    modal()
    d.click_text('Sim, salvar')
    d.wait("location.pathname==='/giras/gira-test'")
    assert d.control()['counts'].get('PATCH /giras/gira-test',0)>0


def history_keyboard():
    d.size(1440,900)
    d.go('/inventario')
    d.wait("document.body.innerText.includes('Vela Ficticia')")
    d.click_text('Ver histórico')
    modal()
    assert d.js("return document.querySelector('[role=dialog]').getAttribute('aria-label')==='Histórico de Vela Ficticia'")
    d.screenshot('history-accessible-dialog')
    dismiss()
    assert d.js("return document.activeElement.textContent.includes('Ver histórico')")


def gira_cancel_mechanisms():
    d.size(1440,900)
    d.go('/giras/editar/gira-test')
    d.wait("document.querySelector('form input')")
    d.text('form input:not([type])','Gira Preservada UX')
    before = d.control()['counts'].get('PATCH /giras/gira-test',0)
    for mechanism in ['button','escape','backdrop']:
        d.click('button[type=submit]')
        modal()
        if mechanism == 'button':
            d.click_text('Cancelar',exact=True)
        elif mechanism == 'escape':
            d.key('\ue00c')
        else:
            d.click_backdrop()
        d.wait("!document.querySelector('[role=dialog]')")
        assert d.js("return !document.querySelector('button[type=submit]').disabled")
        assert d.js("return document.querySelector('form input:not([type])').value==='Gira Preservada UX'")
        assert d.control()['counts'].get('PATCH /giras/gira-test',0) == before
    d.screenshot('gira-cancel-all-mechanisms')
    d.control(rules={'PATCH /giras/gira-test':dict(status=503,delay=1)})
    d.click('button[type=submit]')
    d.click_text('Sim, salvar')
    d.wait("document.querySelector('button[type=submit]').disabled")
    d.wait("document.querySelector('[role=dialog]') && document.body.innerText.includes('Erro ao salvar')")
    modal()
    dismiss()
    assert d.js("return !document.querySelector('button[type=submit]').disabled && document.querySelector('form input:not([type])').value==='Gira Preservada UX'")
    d.control(rules={'PATCH /giras/gira-test':{}})
    d.click('button[type=submit]')
    d.click_text('Sim, salvar')
    d.wait("location.pathname==='/giras/gira-test'")


def history_loading_and_retry():
    d.size(390,844)
    d.control(rules={'GET /inventory/items/item-test/history':dict(delay=1.5,status=503)})
    d.go('/inventario')
    d.wait("document.body.innerText.includes('Vela Ficticia')")
    d.click_text('Ver histórico')
    d.wait("document.querySelector('[role=dialog][aria-busy=true]')")
    dismiss()  # Read-only pending request may be abandoned safely.
    assert d.js("return document.activeElement.textContent.includes('Ver histórico')")
    d.click_text('Ver histórico')
    d.wait("document.querySelector('[role=dialog] [role=alert]')")
    modal()
    d.screenshot('mobile-history-error-focus')
    d.control(rules={'GET /inventory/items/item-test/history':{}})
    d.click_text('Tentar novamente')
    d.wait("document.body.innerText.includes('Movimento ficticio')")
    assert d.js("return getComputedStyle(document.querySelector('[role=dialog] table').parentElement).overflowY==='auto'")
    d.click('button[aria-label="Fechar histórico"]')
    d.wait("!document.querySelector('[role=dialog]')")
    assert d.js("return document.activeElement.textContent.includes('Ver histórico') && !document.querySelector('[inert]')")


def payment_error():
    d.size(1440,900)
    d.go('/financeiro')
    d.wait("document.body.innerText.includes('Cobranca Ficticia')")
    d.click_text('Detalhes')
    d.click_text('Registrar pagamento')
    d.wait("document.querySelector('[role=dialog] input')")
    d.text('[role=dialog] input','5')
    d.control(rules={'POST /contas-receber/conta-test/pagamentos':dict(status=503,delay=1.0)})
    d.click('[role=dialog] button[type=submit]')
    d.wait("document.querySelector('[role=dialog][aria-busy=true]')")
    d.key('\ue00c')
    assert d.js("return !!document.querySelector('[role=dialog]')")
    d.wait("document.querySelector('[role=dialog] [role=alert]')")
    assert d.js("return document.querySelector('[role=dialog] input').value==='5'")
    d.screenshot('payment-error-preserved')
    d.click_text('Cancelar',exact=True)
    d.wait("!document.querySelector('[role=dialog]')")


def navigation_permissions():
    d.go('/consulentes')
    d.wait("document.querySelector('.page-content')")
    d.js("localStorage.removeItem('token')")
    d.go('/consulentes')
    d.wait("location.pathname==='/login'")
    login()
    d.control(role='membro')
    try:
        d.go('/giras/nova')
        d.wait("location.pathname==='/giras'")
        d.wait("document.querySelector('.page-content')")
        assert not d.js("return !!document.querySelector('.main-content a[href=\"/giras/nova\"]')")
    finally:
        d.control(role='admin')


def short_desktop():
    d.size(1024,600)
    d.go('/consulentes')
    d.wait("document.querySelector('.sidebar-nav a[href=\"/sobre\"]')")
    d.js("document.querySelector('.sidebar-nav a[href=\"/sobre\"]').scrollIntoView({block:'center'})")
    d.wait("document.querySelector('.sidebar-nav').scrollTop>0")
    d.screenshot('1024x600-sidebar-scroll')
    d.click('.sidebar-nav a[href="/sobre"]')
    d.wait("location.pathname==='/sobre'")
    assert d.js("const e=document.querySelector('.sidebar-nav');return e.scrollHeight>e.clientHeight")


def visual(width, height, route, name):
    d.size(width, height)
    d.go(route)
    d.wait("document.querySelector('.page-content, .public-card, .login-card')")
    d.wait("!document.querySelector('.spinner-gold')")
    time.sleep(.2)
    metrics = d.js("return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth,bottomNav:document.querySelector('.bottom-nav')?getComputedStyle(document.querySelector('.bottom-nav')).display:null}")
    d.screenshot(name)
    assert not metrics['overflow'], str(metrics)
    results.append(dict(name=name+' metrics',status='observed',metrics=metrics))


try:
    d.size(1440, 900)
    case('login: native required fields and fixture login', login)
    case('consulentes: edit busy/error/success, delete cancel/confirm, empty state', consulentes)
    case('consulentes/ranking: errors, explicit retry and no request loop', consulente_errors)
    case('inventory: history error and retry', inventario)
    case('giras: create failure/success, edit and confirmation cancellation', giras)
    case('public registration: native validation, checkbox, failure and success', public_registration)
    case('members: create modal keyboard lifecycle', lambda: form_modal('/membros', 'Convidar', 'desktop-member-modal'))
    case('appointments: create modal keyboard lifecycle', lambda: form_modal('/agendamentos', 'Novo Agendamento', 'desktop-appointment-modal'))
    case('services: create modal keyboard lifecycle', lambda: form_modal('/atendimentos', 'Novo Atendimento', 'desktop-service-modal'))
    case('finance: details and payment modal keyboard lifecycle', financeiro)
    for width, height in [(1440, 900), (390, 844), (320, 740)]:
        for route, name in [('/giras/nova','gira'),('/consulentes','consulentes'),('/inventario','stock'),('/agendamentos','appointments'),('/public/ux-test','public')]:
            case(f'visual {width}x{height} {name}', lambda w=width,h=height,r=route,n=name: visual(w,h,r,f'{w}x{h}-{n}'))
    d.size(390,844)
    case('mobile: appointment form focus and overflow', lambda: form_modal('/agendamentos','Novo Agendamento','mobile-appointment-modal'))
    case('hook: real React StrictMode nested dialogs', nested_hook)
    case('mobile menus: Escape, focus restoration, navigation', menus)
    case('gira save confirmation: successful fixture update', edit_confirm)
    case('history overlay: Escape dismissal', history_keyboard)
    case('payment: busy state, error, preserved input and cancel', payment_error)
    case('navigation: unauthenticated redirect and fixture member role', navigation_permissions)
    case('desktop 1024x600: sidebar scrolling and navigation', short_desktop)
    case('regression gira: cancel button, Escape, backdrop, PATCH failure and retry', gira_cancel_mechanisms)
    case('regression history: loading dismissal, focus, error and retry', history_loading_and_retry)
finally:
    try:
        d.call('', method='DELETE')
    except Exception:
        pass
    (OUT / 'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
sys.exit(1 if any(result['status']=='failed' for result in results) else 0)
