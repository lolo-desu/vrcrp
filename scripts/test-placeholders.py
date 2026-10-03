"""Compare route skeletons with current site CSS, and the actual chat structure.

The CSS is a public website asset, used only by this browser verification.
Set ORIGINAL_SITE_CSS to a downloaded asset to run this check offline.
"""
from pathlib import Path
import hashlib,json,os,subprocess
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
css_path=Path(os.environ.get('ORIGINAL_SITE_CSS',str(root/'build/site-theme.css')))
if not css_path.exists():
 css_path.parent.mkdir(parents=True,exist_ok=True)
 subprocess.run(['curl','-fsSL','--max-time','30','-A','Mozilla/5.0','-o',str(css_path),'https://erp.sex/assets/index-DR3a8T5X.css'],check=True)
css=css_path.read_text()
paths=['/matches','/matches/thread','/likes','/likes/sent','/visitors','/notifications','/browse','/discover','/me','/u/peer','/posts','/posts/post','/posts/new','/profile/edit','/profile/edit/photos','/profile/edit/bio','/settings','/settings/privacy','/settings/notifications','/settings/appearance','/settings/energy','/settings/membership','/settings/language','/settings/blocks','/settings/login-methods','/login','/register']
reports=[]
with sync_playwright() as p:
 for engine in ['chromium','webkit']:
  options={'headless':True}
  if engine=='chromium':options.update(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  browser=getattr(p,engine).launch(**options)
  for preset,scheme in [('pop','light'),('pop','dark'),('clean','light')]:
   page=browser.new_page(viewport={'width':393,'height':793},is_mobile=True,has_touch=True)
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.add_init_script("window.nativeMessages=[];window.webkit={messageHandlers:{erpNativeApp:{postMessage:m=>nativeMessages.push(m)}}}")
   for name in ['page-surfaces','interaction','keyboard','page-templates','app-experience','content-experience']:
    page.add_init_script((root/'ERPStable'/f'{name}.js').read_text())
   html=f'''<!doctype html><html data-preset="{preset}" data-scheme="{scheme}"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>{css}</style></head><body><div class="flex h-dvh flex-col"><header class="app-top h-14">vrcrp</header><main id="main" class="mx-auto flex min-h-0 w-full flex-1 flex-col px-3 pt-5"><div role="status"><svg class="animate-spin"></svg><span>加载中…</span></div></main></div><script>history.replaceState({{idx:0,key:'cold-root'}},'',location.href);window.openCold=p=>{{history.pushState({{idx:(history.state?.idx||0)+1,key:Math.random().toString()}},'',p);document.getElementById('main').innerHTML='<div role="status"><svg class="animate-spin"></svg><span>加载中…</span></div>';}};</script></body></html>'''
   page.route('https://erp.sex/**',lambda r:r.fulfill(body=html,content_type='text/html'))
   page.goto('https://erp.sex/matches')
   for path in paths:
    if path!='/matches':page.evaluate('p=>openCold(p)',path)
    page.wait_for_function("p=>nativeMessages.filter(m=>m.kind==='route').at(-1)?.path===p",arg=path)
    assert page.locator('#vrcrp-page-placeholder').count()==1
    assert not page.evaluate('__vrcrpPaintState().ready')
    layout=page.evaluate("nativeMessages.filter(m=>m.kind==='route').at(-1).placeholderLayout")
    assert layout['width']==393 and layout['height']==793 and 8<=len(layout['layers'])<=256,(path,layout)
    assert all(l['rect']['width']>0 and l['rect']['height']>0 and len(l['fill'])==4 for l in layout['layers'])
    # Compare the exact rendered border/shadow against an ordinary website card.
    styles=page.evaluate("""()=>{const p=document.querySelector('#vrcrp-page-placeholder .card:not(.vr-page-chat-top)');const c=document.createElement('div');c.className='card';document.body.append(c);const shape=s=>({border:s.borderTopWidth,color:s.borderTopColor,radius:s.borderTopLeftRadius,shadow:s.boxShadow});const a=shape(getComputedStyle(p)),b=shape(getComputedStyle(c));c.remove();return {a,b}}""")
    assert styles['a']==styles['b'],(path,preset,scheme,styles)
    if path in ['/likes','/likes/sent','/browse']:assert page.locator('#vrcrp-page-placeholder .vr-page-grid').count()==1
    if path=='/u/peer':assert page.locator('#vrcrp-page-placeholder .vr-page-hero .vr-page-media').bounding_box()['height']>350
    if path=='/profile/edit/photos':assert page.locator('#vrcrp-page-placeholder .vr-page-grid').count()==1
    if path in ['/login','/register']:assert page.locator('#vrcrp-page-placeholder .app-top').count()==0
    if path=='/matches/thread':
     assert page.locator('#vrcrp-page-placeholder [data-vrcrp-control]').count()==4
     assert page.locator('#vrcrp-page-placeholder textarea').get_attribute('placeholder')=='输入消息…'
     assert sum(bool(l.get('image')) for l in layout['layers'])>=5
     assert page.locator('#vrcrp-page-placeholder .vr-page-compose .vr-page-block').count()==0
     pane=page.locator('#vrcrp-page-placeholder .vr-page-chat-pane').bounding_box()
     compose=page.locator('#vrcrp-page-placeholder .vr-page-compose').bounding_box()
     assert abs(pane['x']-12)<1 and abs(pane['width']-369)<1
     assert abs(compose['y']-pane['y']-pane['height']-8)<1 and compose['y']+compose['height']<793
     assert page.locator('#vrcrp-page-placeholder .vr-page-chat-top').bounding_box()['width']==393
     page.screenshot(path=str(root/'build'/f'placeholder-chat-{engine}-{preset}-{scheme}.png'))
    reports.append({'engine':engine,'preset':preset,'scheme':scheme,'path':path,'shapes':len(layout['layers']),'siteCardStyle':styles['a']})
   # Use the original Chat component's actual structural classes and sizes.
   page.evaluate("openCold('/matches/thread')")
   page.wait_for_function("nativeMessages.filter(m=>m.kind==='route').at(-1)?.path==='/matches/thread'")
   before=page.locator('#vrcrp-page-placeholder .vr-page-compose').bounding_box()
   before_children=page.locator('#vrcrp-page-placeholder .vr-page-compose').evaluate('e=>[...e.children].map(c=>({width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height,x:c.getBoundingClientRect().x,y:c.getBoundingClientRect().y}))')
   before_header=page.locator('#vrcrp-page-placeholder .vr-page-chat-top').bounding_box()
   page.evaluate("""document.getElementById('main').innerHTML='<div class="relative mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col"><div class="card mb-2 flex items-center gap-2 p-2"><button class="h-10 w-10" aria-label="返回">‹</button><a class="flex min-w-0 flex-1 items-center gap-2" href="/u/peer"><div style="width:40px;height:40px"></div><span>测试联系人</span></a></div><div class="card relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-3"><div class="bubble-them">聊天内容</div></div><div class="mt-2"><form class="card flex items-end gap-1.5 p-2"><button class="h-10 w-10" type="button">+</button><button class="h-10 w-10" type="button">声</button><textarea class="input !rounded-2xl resize-y leading-relaxed max-h-32 min-h-[40px] flex-1 resize-none border-0 bg-transparent focus:ring-0" rows="1"></textarea><button class="h-10 w-10" type="button">发</button></form><p class="mt-1 text-center text-[11px] text-muted">消息说明</p></div></div>'""")
   page.wait_for_function('__vrcrpPaintState().ready')
   real=page.locator('#main form').bounding_box();real_header=page.locator('[data-vrcrp-chat-bar]').bounding_box()
   assert abs(before['height']-real['height'])<2,(before,real,page.locator('#main form').evaluate("e=>({form:getComputedStyle(e).cssText,padding:getComputedStyle(e).padding,border:getComputedStyle(e).borderWidth,children:[...e.children].map(c=>({tag:c.tagName,height:c.getBoundingClientRect().height,min:getComputedStyle(c).minHeight,padding:getComputedStyle(c).padding,box:getComputedStyle(c).boxSizing}))})"))
   assert abs(before['y']-real['y'])<5,(before,real)
   assert abs(before_header['height']-real_header['height'])<2,(before_header,real_header)
   real_children=page.locator('#main form').evaluate('e=>[...e.children].map(c=>({width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height,x:c.getBoundingClientRect().x,y:c.getBoundingClientRect().y}))')
   for a,b in zip(before_children,real_children):
    for k in ['width','height','x','y']:assert abs(a[k]-b[k])<2,(engine,preset,k,a,b)
   assert not errors,errors
   page.close()
  browser.close()
(root/'build/placeholder-verification.json').write_text(json.dumps({'cssSha256':hashlib.sha256(css.encode()).hexdigest(),'checks':reports,'realChatGeometry':'header and composer match original structural classes'},ensure_ascii=False,indent=2))
print('PASS: Chromium + WebKit, 27 route layouts × 3 themes, original website borders/shadows and real chat header/composer geometry')
