"""Small W3C WebDriver client using the already installed ChromeDriver."""
import base64
import json
import os
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / os.environ.get('UX_ARTIFACT_DIR', 'artifacts/ux-final')
OUT.mkdir(parents=True, exist_ok=True)


def request(url, method='GET', body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={'Content-Type': 'application/json'})
    try:
        return json.load(urllib.request.urlopen(req, timeout=40))
    except urllib.error.HTTPError as e:
        raise RuntimeError(e.read().decode()[:2000]) from None


class Driver:
    def __init__(self):
        result = request('http://127.0.0.1:9517/session', 'POST', {'capabilities': {'alwaysMatch': {'browserName': 'chrome', 'goog:chromeOptions': {'binary': 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'args': ['--headless=new', '--no-first-run', '--disable-background-networking', '--window-size=1440,900']}}}})
        self.session = result['value']['sessionId']
        self.base = f'http://127.0.0.1:9517/session/{self.session}'

    def call(self, path, body=None, method=None):
        result = request(self.base + path, method or ('POST' if body is not None else 'GET'), body)
        return result.get('value')

    def js(self, script, *args):
        return self.call('/execute/sync', dict(script=script, args=list(args)))

    def go(self, path):
        self.call('/url', dict(url='http://127.0.0.1:3100' + path))

    def wait(self, condition, timeout=20):
        until = time.monotonic() + timeout
        while time.monotonic() < until:
            try:
                if self.js('return Boolean(' + condition + ')'):
                    return
            except RuntimeError:
                pass
            time.sleep(.15)
        raise AssertionError('Timeout: ' + condition + '\n' + self.js('return document.body.innerText').strip()[:1800])

    def element(self, selector):
        result = self.call('/element', dict(using='css selector', value=selector))
        return result['element-6066-11e4-a52e-4f735466cecf']

    def click(self, selector):
        self.js("document.querySelector(arguments[0]).scrollIntoView({block:'center',inline:'nearest'})", selector)
        self.wait("(()=>{const r=document.querySelector(" + json.dumps(selector) + ").getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()")
        self.call('/element/' + self.element(selector) + '/click', {})

    def click_backdrop(self):
        self.call('/actions', dict(actions=[dict(type='pointer', id='mouse', parameters=dict(pointerType='mouse'), actions=[dict(type='pointerMove', origin='viewport', x=5, y=5), dict(type='pointerDown', button=0), dict(type='pointerUp', button=0)])]))

    def click_text(self, text, tag='button', exact=False):
        self.wait("[...document.querySelectorAll("+json.dumps(tag)+")].some(e=>e.getClientRects().length && ("+str(exact).lower()+" ? e.textContent.trim() === "+json.dumps(text)+" : e.textContent.includes("+json.dumps(text)+")))")
        el = self.js("return [...document.querySelectorAll(arguments[1])].find(e => e.getClientRects().length && (arguments[2] ? e.textContent.trim() === arguments[0] : e.textContent.includes(arguments[0])))", text, tag, exact)
        if not el:
            raise AssertionError('Visible control not found: ' + text)
        self.js("arguments[0].scrollIntoView({block:'center',inline:'nearest'})", el)
        # Bootstrap enables smooth scrolling; WebDriver otherwise clicks before it finishes.
        time.sleep(.5)
        self.call('/element/' + el['element-6066-11e4-a52e-4f735466cecf'] + '/click', {})

    def value(self, selector, value):
        self.js("const el=document.querySelector(arguments[0]); Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,arguments[1]); el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));", selector, value)

    def text(self, selector, value):
        element = self.element(selector)
        self.call('/element/' + element + '/clear', {})
        self.call('/element/' + element + '/value', dict(text=value))

    def key(self, value):
        self.call('/actions', dict(actions=[dict(type='key', id='keyboard', actions=[dict(type='keyDown', value=value), dict(type='keyUp', value=value)])]))

    def shift_tab(self):
        self.call('/actions', dict(actions=[dict(type='key', id='keyboard', actions=[dict(type='keyDown',value='\ue008'),dict(type='keyDown',value='\ue004'),dict(type='keyUp',value='\ue004'),dict(type='keyUp',value='\ue008')])]))

    def size(self, width, height):
        self.call('/goog/cdp/execute', dict(cmd='Emulation.setDeviceMetricsOverride', params=dict(width=width, height=height, deviceScaleFactor=1, mobile=False)))

    def screenshot(self, name):
        png = self.call('/screenshot')
        (OUT / (name + '.png')).write_bytes(base64.b64decode(png))

    def control(self, **data):
        return request('http://127.0.0.1:8101/__control', 'POST', data)


if __name__ == '__main__':
    d = Driver()
    d.go('/login')
    d.wait("document.querySelector('input[type=email]')")
    print(d.js('return document.body.innerText'))

