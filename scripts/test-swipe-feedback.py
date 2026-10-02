from pathlib import Path
import os,subprocess
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
modules=Path(os.environ.get('TEST_NODE_MODULES','/workspace/vrcrp-test-tools/node_modules'))
bundle=root/'build/swipe-fixture.js'
subprocess.run([str(modules/'.bin/esbuild'),str(root/'scripts/swipe-fixture.jsx'),'--bundle','--format=esm','--platform=browser','--outfile='+str(bundle)],check=True,env={**os.environ,'NODE_PATH':str(modules)},capture_output=True)
html='''<html><head><style>:root{--surface:255 255 255;--primary:237 83 82}*{box-sizing:border-box}body{margin:0;font:16px system-ui}.app-top{height:56px}main{padding:20px 12px}.deck{max-width:320px;margin:auto}.stage{position:relative;aspect-ratio:3/4.3;background:#aaa}.absolute{position:absolute}.inset-0{inset:0}.photo{height:100%;display:grid;place-items:center}.touch-none{touch-action:none}.pointer-events-none{pointer-events:none}.border-4{border:4px solid;font-size:30px;padding:4px 12px;font-weight:900;background:#fffc}.border-success{border-color:#15803d;color:#15803d}.border-danger{border-color:#b91c1c;color:#b91c1c}.border-accent{border-color:#eab308;color:#141414}.left-6{left:24px}.right-6{right:24px}.top-24{top:96px}.bottom-40{bottom:160px;left:40px}.actions{display:flex;justify-content:center;gap:14px;margin-top:20px}.act{width:64px;height:64px;border-radius:50%;background:white;border:2px solid black}.act-super{width:56px;height:56px}.app-bottom{position:fixed;bottom:0;height:70px;width:100%;background:white}</style></head><body><header class="app-top">测试</header><div id="root"></div><nav class="app-bottom"></nav><script type="module" src="/fixture.js"></script></body></html>'''
with sync_playwright() as p:
 results=[]
 for engine in ['chromium','webkit']:
  launch={'headless':True}
  if engine=='chromium':launch.update(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
  browser=getattr(p,engine).launch(**launch);page=browser.new_page(viewport={'width':393,'height':793},is_mobile=True,has_touch=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("window.nativeMessages=[];window.webkit={messageHandlers:{erpNativeApp:{postMessage(m){nativeMessages.push(m)}}}}")
  for name in ['app-experience','swipe-feedback']:page.add_init_script((root/'ERPStable'/f'{name}.js').read_text())
  page.route('https://erp.sex/**',lambda r:r.fulfill(body=bundle.read_text() if r.request.url.endswith('/fixture.js') else html,content_type='text/javascript' if r.request.url.endswith('/fixture.js') else 'text/html'))
  page.goto('https://erp.sex/discover');page.wait_for_selector('.cursor-grab');page.wait_for_timeout(120)
  def origin():
   bounds=page.locator('.stage').bounding_box();return bounds['x']+bounds['width']/2,bounds['y']+bounds['height']/2
  def drag(dx,dy,release=True):
   x,y=origin();page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+dx,y+dy,steps=12);page.wait_for_timeout(70)
   if release:page.mouse.up()
   return x,y
  page.locator('.photo').click();assert page.evaluate('opens')==1
  page.locator('.chip').click();assert page.evaluate('chips')==1
  assert page.evaluate('swipes.length')==0
  for kind,dx,dy in [('like',68,0),('pass',-68,0),('super',0,-68)]:
   x,y=drag(dx,dy,False)
   cue=page.locator('[data-vrcrp-swipe-cue]')
   assert cue.get_attribute('data-vrcrp-swipe-cue')==kind
   assert cue.evaluate('e=>+getComputedStyle(e).opacity')>.5
   matrix=page.locator('[data-vrcrp-motion-card]').evaluate('e=>new DOMMatrix(getComputedStyle(e).transform).toJSON()')
   assert abs(matrix['m42'] if kind=='super' else matrix['m41'])<abs(dy if kind=='super' else dx)*.7,'initial drag did not feel heavy'
   assert page.locator('[data-vrcrp-swipe-hint]').get_attribute('data-ready')=='false'
   page.mouse.move(x,y,steps=10);page.wait_for_timeout(50);page.mouse.up();page.wait_for_function("!document.querySelector('[data-vrcrp-motion-card]')")
   assert page.evaluate('swipes.length')==0,'return-to-center sent a business action'
  # Cross the threshold, then reverse well into the cancellation region.
  x,y=drag(135,0,False);assert page.locator('[data-vrcrp-swipe-hint]').get_attribute('data-ready')=='true'
  assert '松手确认' in page.locator('[data-vrcrp-swipe-hint]').inner_text()
  page.mouse.move(x+35,y,steps=8);page.wait_for_timeout(50)
  assert page.locator('[data-vrcrp-swipe-hint]').get_attribute('data-ready')=='false'
  page.mouse.up();page.wait_for_function("!document.querySelector('[data-vrcrp-motion-card]')");assert page.evaluate('swipes.length')==0
  # Fast movement below the explicit threshold must not use the site's velocity shortcut.
  x,y=origin();page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+45,y);page.mouse.up()
  page.wait_for_function("!document.querySelector('[data-vrcrp-motion-card]')");assert page.evaluate('swipes.length')==0
  samples=[]
  for kind,dx,dy,value in [('like',135,0,'right'),('pass',-135,0,'left'),('super',0,-135,'up')]:
   count=page.evaluate('swipes.length');index=page.locator('.cursor-grab').get_attribute('data-card-id');drag(dx,dy)
   page.wait_for_timeout(190)
   samples.append({'direction':kind,'transform':page.locator('[data-vrcrp-motion-card]').evaluate('e=>getComputedStyle(e).transform')})
   assert page.evaluate('swipes.length')==count,'business action happened before motion completed'
   page.wait_for_function('n=>swipes.length===n+1',arg=count)
   assert page.evaluate('swipes.at(-1)')=={'value':value,'index':int(index)}
   page.wait_for_function("!document.querySelector('[data-vrcrp-motion-card]')")
   if value=='up':
    assert page.get_by_role('dialog').is_visible();page.get_by_text('取消超级喜欢').click()
    assert page.locator('.cursor-grab').evaluate('e=>+getComputedStyle(e).opacity')==1
  assert page.evaluate('dragStarts')==0,'Framer ran a second gesture controller'
  assert page.evaluate("nativeMessages.filter(m=>m.kind==='haptic'&&m.style==='selection').length")>=4
  # A disappearing card must cancel the action captured for that card.
  count=page.evaluate('swipes.length');drag(135,0);page.wait_for_timeout(60);page.evaluate('fixtureChangeCard()');page.wait_for_timeout(900)
  assert page.evaluate('swipes.length')==count,'committed an obsolete card during replacement'
  # A failed request returns the same card visibly; no duplicate or stuck hidden card.
  page.evaluate("business='fail'");count=page.evaluate('swipes.length');drag(135,0)
  page.wait_for_function("!document.querySelector('[data-vrcrp-motion-card]')")
  assert page.evaluate('swipes.length')==count+1
  assert page.locator('.cursor-grab').evaluate('e=>+getComputedStyle(e).opacity')==1
  assert page.locator('.cursor-grab').evaluate('e=>e.getAnimations().length')==0
  page.evaluate("business='success'")
  for selector,value,size in [('.act-pass','left',64),('.act-super','up',56),('.act-like','right',64)]:
   assert page.locator(selector).bounding_box()['width']==size
   page.locator(selector).click();assert page.evaluate('swipes.at(-1).value')==value
   if value=='up':page.get_by_text('取消超级喜欢').click()
   else:page.wait_for_timeout(500)
  page.emulate_media(reduced_motion='reduce');drag(135,0)
  page.wait_for_function("!document.querySelector('[data-vrcrp-motion-card]')")
  assert not errors,errors
  results.append({'engine':engine,'commits':samples,'cancellation':'pass','thresholdReversal':'pass','singleBusinessCallback':'pass','tapAndButtons':'pass','superlikeConfirmation':'pass','requestFailureRestore':'pass','reducedMotion':'pass'})
  browser.close()
 import json
 (root/'build/swipe-verification.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print('PASS: Chromium + WebKit real React/Framer cards, heavy pull, explicit threshold and reversal, three distinct exits, single business callback, original buttons/profile taps, superlike confirmation, failed-request recovery and reduced motion')
