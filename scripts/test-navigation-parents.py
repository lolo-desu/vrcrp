"""Check chat ancestry against real React Router, not just URL fixtures."""
from pathlib import Path
import json, os, subprocess
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
modules = Path(os.environ.get('TEST_NODE_MODULES', '/workspace/vrcrp-test-tools/node_modules'))
bundle = root / 'build/continuity-fixture.js'
subprocess.run([str(modules / '.bin/esbuild'), str(root / 'scripts/continuity-fixture.jsx'), '--bundle', '--format=esm', '--platform=browser', '--outfile=' + str(bundle)], check=True, env={**os.environ, 'NODE_PATH': str(modules)}, capture_output=True)
with sync_playwright() as p:
    for engine in os.environ.get('NAV_TEST_ENGINES', 'chromium,webkit').split(','):
        options = {'headless': True}
        if engine == 'chromium':
            options.update(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        browser = getattr(p, engine).launch(**options)
        page = browser.new_page(viewport={'width': 393, 'height': 793}, has_touch=True)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        def route(r):
            if '/api/v1/' in r.request.url:
                r.fulfill(body=json.dumps({'items': [{'id': 'peer', 'name': '缓存会话'}], 'text': '资料实际内容'}), content_type='application/json')
            elif '/assets/continuity-test.js' in r.request.url:
                r.fulfill(body=bundle.read_text(), content_type='text/javascript')
            else:
                r.fulfill(body='<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--bg:245 245 245;--surface:255 255 255;--fg:30 30 30;--primary:230 80 90}body{margin:0}.app-top{height:56px;background:white}.chat-header{height:56px}main{min-height:700px}</style></head><body><div id="root"></div><script type="module" src="/assets/continuity-test.js"></script></body></html>', content_type='text/html')
        page.route('https://erp.sex/**', route)
        init='window.nativeMessages=[];window.webkit={messageHandlers:{erpNativeApp:{postMessage:m=>nativeMessages.push(m)}}};'
        init+='\n'.join((root / 'ERPStable' / f'{name}.js').read_text() for name in ['app-theme','page-surfaces','keyboard','page-templates','app-experience'])
        page.add_init_script(init)
        page.goto('https://erp.sex/notifications')
        page.wait_for_function('__vrcrpPaintState().ready')
        for origin in ['/notifications', '/discover', '/settings/privacy']:
            page.evaluate('continuityOpen', origin)
            page.wait_for_function('p=>location.pathname===p&&__vrcrpPaintState().ready', arg=origin)
            page.evaluate("__vrcrpOpenChat('thread')")
            page.wait_for_function("location.pathname==='/matches/thread'&&!!document.querySelector('#main textarea')&&__vrcrpPaintState().ready")
            state = page.evaluate("nativeMessages.filter(m=>m.kind==='route').at(-1)")
            assert state['parentPath'] == '/matches' and state['canGoBack'], state
            assert not page.locator('.app-top').is_visible()
            chat_index = page.evaluate('history.state.idx')
            page.evaluate("__vrcrpOpenChat('another')")
            page.wait_for_function("location.pathname==='/matches/another'&&__vrcrpPaintState().ready")
            assert page.evaluate('history.state.idx') == chat_index, 'notification stacked chats'
            page.evaluate("continuityOpen('/u/peer')")
            page.wait_for_function("typeof releaseProfileModule==='function'")
            page.evaluate('releaseProfileModule()')
            page.wait_for_function("location.pathname==='/u/peer'&&__vrcrpPaintState().ready")
            page.evaluate('__vrcrpBack();__vrcrpBack()')
            page.wait_for_function("location.pathname==='/matches'&&__vrcrpPaintState().ready")
            assert not page.evaluate('__vrcrpBack()'), 'chat returned through an unrelated tab'
            assert page.locator('.app-top').is_visible()
        # Direct deep links also get a list parent before BrowserRouter mounts.
        page.goto('https://erp.sex/matches/cold')
        page.wait_for_function("location.pathname==='/matches/cold'&&__vrcrpPaintState().ready")
        assert page.evaluate("nativeMessages.filter(m=>m.kind==='route').at(-1).parentPath") == '/matches'
        page.evaluate('__vrcrpBack()')
        page.wait_for_function("location.pathname==='/matches'&&__vrcrpPaintState().ready")
        assert not errors, errors
        browser.close()
        print(f'PASS ({engine}): notifications/other origins and cold deep links return to chat list; nested detail returns; replacement chat; correct header levels; one mounted router')
