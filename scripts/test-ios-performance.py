"""Compare iOS layout reads with the same official frontend and mock account.

The baseline uses the unchanged Android measurement path. Both paths must
produce identical placeholder DOM, so reducing reads cannot alter geometry.
"""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright

source=Path(__file__).with_name('test-upstream-ui.py')
ns={'__file__':str(source)}
exec(source.read_text().split('with sync_playwright() as p:')[0],ns)
reports=[]
with sync_playwright() as p:
    for engine in ['chromium','webkit']:
        options={'headless':True}
        if engine=='chromium':options.update(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
        browser=getattr(p,engine).launch(**options)
        for path in ['/discover','/matches','/likes','/likes/secret','/browse']:
            app=ns['App'](browser,path=path)
            page=app.page
            page.wait_for_timeout(1600)
            value=page.evaluate('''()=>{
              const originalStyle=window.getComputedStyle,originalRect=Element.prototype.getBoundingClientRect;
              function measure(platform){
                window.__vrcrpPlatform=platform;let styles=0,rects=0;
                window.getComputedStyle=function(...args){styles++;return originalStyle.apply(this,args)};
                Element.prototype.getBoundingClientRect=function(...args){rects++;return originalRect.apply(this,args)};
                const start=performance.now();__vrcrpPageTemplates.remember(location.pathname);
                const shell=document.createElement('section');shell.id='vrcrp-page-placeholder';
                const installed=__vrcrpPageTemplates.install(shell,location.pathname);
                const result={installed,styles,rects,ms:performance.now()-start,html:shell.innerHTML};
                window.getComputedStyle=originalStyle;Element.prototype.getBoundingClientRect=originalRect;
                return result;
              }
              try{const baseline=measure('android'),ios=measure('ios');const identical=baseline.html===ios.html;
                delete baseline.html;delete ios.html;return {baseline,ios,identical};}
              finally{delete window.__vrcrpPlatform;window.getComputedStyle=originalStyle;Element.prototype.getBoundingClientRect=originalRect;}
            }''')
            assert value['identical'] and value['baseline']['installed'] and value['ios']['installed'],(engine,path,value)
            assert value['ios']['styles']<value['baseline']['styles']*.4,(engine,path,value)
            assert value['ios']['rects']<=value['baseline']['rects'],(engine,path,value)
            reports.append({'engine':engine,'path':path,**value})
            app.close()
        browser.close()
output=source.parent.parent/'build/ios-performance-verification.json'
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps({'checks':reports,'geometry':'identical placeholder DOM','account':'mock, no real user data'},indent=2))
print('PASS: official frontend, 10 iOS layout comparisons, identical placeholders with fewer style and rectangle reads')
