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
  browser=getattr(p,engine).launch(**launch)
  page=browser.new_page(viewport={'width':393,'height':793},is_mobile=True,has_touch=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("window.nativeMessages=[];window.webkit={messageHandlers:{erpNativeApp:{postMessage(m){nativeMessages.push(m)}}}}")
  # Exercise the remaining app scripts together. The website owns card gestures.
  for name in ['page-surfaces','interaction','site-cache','notifications','keyboard','app-experience','content-experience']:
   page.add_init_script((root/'ERPStable'/f'{name}.js').read_text())
  page.route('https://erp.sex/**',lambda r:r.fulfill(body=bundle.read_text() if r.request.url.endswith('/fixture.js') else html,content_type='text/javascript' if r.request.url.endswith('/fixture.js') else 'text/html'))
  page.goto('https://erp.sex/discover');page.wait_for_selector('.cursor-grab');page.wait_for_timeout(150)
  def card():return page.locator('.cursor-grab').last
  def origin():
   b=page.locator('.stage').bounding_box();return b['x']+b['width']/2,b['y']+b['height']/2
  def drag(dx,dy,release=True):
   x,y=origin();page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+dx,y+dy,steps=12);page.wait_for_timeout(150)
   if release:page.mouse.up()
   return x,y
  def settle():page.wait_for_timeout(600)
  page.locator('.photo').click();assert page.evaluate('opens')==1
  page.locator('.chip').click();assert page.evaluate('chips')==1
  # Original distance and label opacity, with no custom resistance/fields/cues.
  for label,dx,dy in [('.border-success',68,0),('.border-danger',-68,0),('.border-accent',0,-68)]:
   x,y=drag(dx,dy,False)
   matrix=card().evaluate('e=>new DOMMatrix(getComputedStyle(e).transform).toJSON()')
   assert abs(matrix['m42']-dy)<2 and abs(matrix['m41']-dx)<2,matrix
   opacity=card().locator(label).evaluate('e=>+getComputedStyle(e).opacity')
   expected=(68-(40 if dy else 30))/(100 if dy else 110)
   assert abs(opacity-expected)<.025,(opacity,expected)
   page.mouse.move(x,y,steps=12);page.wait_for_timeout(150);page.mouse.up();settle()
   assert page.evaluate('swipes.length')==0,'return to center should cancel'
   assert abs(card().evaluate('e=>new DOMMatrix(getComputedStyle(e).transform).m41'))<1
  assert page.locator('[data-vrcrp-motion-card],[data-vrcrp-swipe-cue],[data-vrcrp-swipe-hint]').count()==0
  # The original 120px distance boundary remains in charge.
  drag(115,0);settle();assert page.evaluate('swipes.length')==0
  directions=[]
  for dx,dy,value in [(135,0,'right'),(-135,0,'left'),(0,-135,'up')]:
   count=page.evaluate('swipes.length');index=int(card().get_attribute('data-card-id'))
   drag(dx,dy)
   page.wait_for_function('n=>swipes.length===n+1',arg=count)
   assert page.evaluate('swipes.at(-1)')=={'value':value,'index':index}
   directions.append(value)
   if value=='up':
    assert page.get_by_role('dialog').is_visible();page.get_by_text('取消超级喜欢').click()
   settle()
  assert page.evaluate('dragStarts')>=7,'website Framer drag controller was intercepted'
  # A short, fast horizontal flick still uses the site's velocity shortcut.
  count=page.evaluate('swipes.length');x,y=origin();page.mouse.move(x,y);page.mouse.down()
  page.mouse.move(x+15,y);page.wait_for_timeout(35);page.mouse.move(x+75,y);page.wait_for_timeout(20);page.mouse.up()
  page.wait_for_function('n=>swipes.length===n+1',arg=count)
  event=page.evaluate('dragEvents.at(-1)')
  assert event['offset']['x']<120 and event['velocity']['x']>700,event
  assert page.evaluate('swipes.at(-1).value')=='right';settle()
  # Original button order/sizes and superlike dialog are untouched.
  for selector,value,size in [('.act-pass','left',64),('.act-super','up',56),('.act-like','right',64)]:
   assert page.locator(selector).bounding_box()['width']==size
   count=page.evaluate('swipes.length');page.locator(selector).click()
   assert page.evaluate('swipes.length')==count+1 and page.evaluate('swipes.at(-1).value')==value
   if value=='up':page.get_by_text('取消超级喜欢').click()
   settle()
  assert not errors,errors
  results.append({'engine':engine,'originalFramerController':True,'directions':directions,'originalDistanceThreshold':120,'originalVelocityShortcut':event,'originalLabelOpacity':True,'noCustomResistanceOrMotion':True,'cancelAndButtons':'pass','superlikeConfirmation':'pass','appScripts':7})
  browser.close()
 import json
 (root/'build/swipe-verification.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print('PASS: Chromium + WebKit official Framer drag, three directions, unchanged label opacity, distance/velocity thresholds, return-to-center cancellation, buttons and superlike confirmation; all seven app scripts coexist without custom swipe control')
