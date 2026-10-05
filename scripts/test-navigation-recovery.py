"""Real browser reload must retain iOS return hierarchy without user content."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
fixture=(root/'scripts/navigation-fixture.html').read_text()
reports=[]
with sync_playwright() as p:
    for engine in ['chromium','webkit']:
        options={} if engine=='webkit' else {'executable_path':os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),'args':['--no-sandbox']}
        browser=getattr(p,engine).launch(**options)
        page=browser.new_page(viewport={'width':393,'height':793},has_touch=True)
        page.add_init_script("window.nativeMessages=[];window.webkit={messageHandlers:{erpNativeApp:{postMessage:m=>nativeMessages.push(m)}}}")
        for name in ['keyboard','page-templates','app-experience','page-surfaces']:
            page.add_init_script((root/'ERPStable'/f'{name}.js').read_text())
        page.route('https://erp.sex/**',lambda r:r.fulfill(body=fixture,content_type='text/html'))
        page.goto('https://erp.sex/matches')
        page.wait_for_function("nativeMessages.some(m=>m.kind==='routeSettled')")
        page.evaluate("__fixtureOpen('/matches/thread');document.querySelector('textarea').value='PRIVATE_DRAFT';__fixtureOpen('/u/peer');__fixtureOpen('/posts/detail')")
        before=page.evaluate('history.state.vrcrpTrail')
        assert 'PRIVATE' not in json.dumps(before)
        page.reload()
        page.wait_for_function("nativeMessages.some(m=>m.kind==='routeSettled')")
        assert page.evaluate('history.state.vrcrpTrail')==before
        for path in ['/u/peer','/matches/thread','/matches']:
            assert page.evaluate('__vrcrpPageBack()')
            page.wait_for_function('(path)=>location.pathname===path',arg=path)
        assert not page.evaluate('__vrcrpPageBack()'),'recovery escaped root'
        # Reloading a conversation must reuse its existing list parent, rather
        # than manufacture an extra duplicate history entry on every reload.
        page.evaluate("__fixtureOpen('/matches/thread')")
        idx=page.evaluate('history.state.idx')
        for _ in range(3):
            page.reload();page.wait_for_function("nativeMessages.some(m=>m.kind==='routeSettled')")
            assert page.evaluate('history.state.idx')==idx
        page.evaluate('__vrcrpPageBack()');page.wait_for_function("location.pathname==='/matches'")
        reports.append({'engine':engine,'nestedReturn':True,'chatReloadNoDuplicate':True,'privateContentRetained':False})
        browser.close()
output=root/'build/navigation-recovery.json';output.parent.mkdir(exist_ok=True)
output.write_text(json.dumps(reports,indent=2))
print('PASS: iOS browser reload retains nested return hierarchy, no duplicate chat parent or private draft in metadata')
