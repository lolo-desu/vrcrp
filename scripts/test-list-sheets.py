from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
fixture=(root/'scripts/gesture-fixture.html').read_text()
with sync_playwright() as p:
 results=[]
 for engine in ['chromium','webkit']:
  args={'headless':True}
  if engine=='chromium':args.update(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
  browser=getattr(p,engine).launch(**args)
  page=browser.new_page(viewport={'width':393,'height':793},is_mobile=True,has_touch=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("window.nativeMessages=[];window.webkit={messageHandlers:{erpNativeApp:{postMessage:m=>nativeMessages.push(m)}}}")
  for name in ['page-surfaces','interaction','keyboard','app-experience','content-experience']:
   page.add_init_script((root/'ERPStable'/f'{name}.js').read_text())
  page.route('https://erp.sex/**',lambda r:r.fulfill(body=fixture,content_type='text/html'))
  page.goto('https://erp.sex/matches');page.wait_for_selector('[data-vrcrp-chat-row]')
  row=page.get_by_role('link',name='留在列表')
  def background():return row.evaluate('e=>getComputedStyle(e).backgroundColor')
  row.hover();assert background()=='rgba(0, 0, 0, 0)'
  b=row.bounding_box();x,y=b['x']+50,b['y']+20
  page.mouse.move(x,y);page.mouse.down();assert background()=='rgb(224, 231, 240)'
  page.mouse.up();page.wait_for_timeout(260);assert background()=='rgba(0, 0, 0, 0)'
  row.focus();assert background()=='rgba(0, 0, 0, 0)'
  page.mouse.down();page.mouse.move(x,y-15);page.wait_for_timeout(150);assert background()=='rgba(0, 0, 0, 0)';page.mouse.up()
  page.mouse.move(x,y);page.mouse.down();page.dispatch_event('body','pointercancel');page.wait_for_timeout(150);assert background()=='rgba(0, 0, 0, 0)';page.mouse.up()
  assert page.evaluate("nativeMessages.some(m=>m.kind==='rowPress'&&m.active)")
  assert page.evaluate("nativeMessages.filter(m=>m.kind==='rowPress').at(-1).active") is False
  page.get_by_role('link',name='虚构会话').click();page.wait_for_function("location.pathname==='/matches/thread'")
  page.evaluate('__vrcrpBack()');page.wait_for_function("location.pathname==='/matches'")
  assert page.locator('[data-vrcrp-row-pressed]').count()==0
  page.evaluate("openPage('/likes')");page.wait_for_timeout(150)
  def open_sheet():
   page.get_by_role('button',name='打开喜欢详情').click();page.wait_for_selector('[data-vrcrp-dismissible-sheet]');page.wait_for_function("nativeMessages.filter(m=>m.kind==='navigation').at(-1)?.overlay===true");page.wait_for_timeout(120)
  def photo_origin():
   b=page.get_by_role('button',name='喜欢资料照片').bounding_box();return b['x']+b['width']*.25,b['y']+b['height']*.45
  def drag(dx,dy,reverse=False):
   x,y=photo_origin();page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+dx,y+dy,steps=12)
   if reverse:page.mouse.move(x+20,y+10,steps=8)
   page.wait_for_timeout(130);page.mouse.up();page.wait_for_timeout(450)
  open_sheet();page.get_by_role('button',name='喜欢资料照片').click();assert page.evaluate('sheetActions')==1
  drag(70,0);assert page.get_by_role('dialog').is_visible();assert page.evaluate('sheetCloses')==0
  drag(230,0,True);assert page.get_by_role('dialog').is_visible();assert page.evaluate('sheetCloses')==0
  drag(260,0);assert page.get_by_role('dialog').count()==0;assert page.evaluate('sheetCloses')==1
  assert page.evaluate('location.pathname')=='/likes' and page.evaluate('sheetActions')==1
  open_sheet();drag(0,290);assert page.get_by_role('dialog').count()==0;assert page.evaluate('sheetCloses')==2
  open_sheet();body=page.locator('[data-dialog-body]');body.evaluate('e=>e.scrollTop=240');page.wait_for_timeout(100)
  b=body.bounding_box();x,y=b['x']+b['width']/2,b['y']+150
  page.mouse.move(x,y);page.mouse.down();page.mouse.move(x,y+250,steps=10);page.mouse.up();page.wait_for_timeout(250)
  assert page.get_by_role('dialog').is_visible(),'scrolled body was dismissed'
  assert page.locator('.dialog-panel').evaluate('e=>getComputedStyle(e).transform')=='none'
  # Header can close even while the body is scrolled.
  b=page.locator('.sheet-header').bounding_box();x,y=b['x']+60,b['y']+25
  page.mouse.move(x,y);page.mouse.down();page.mouse.move(x,y+300,steps=12);page.wait_for_timeout(130);page.mouse.up();page.wait_for_timeout(450)
  assert page.get_by_role('dialog').count()==0 and page.evaluate('sheetCloses')==3
  open_sheet();album=page.locator('[data-dialog-body] .overflow-x-auto');b=album.bounding_box();x,y=b['x']+30,b['y']+30
  page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+240,y,steps=10);page.mouse.up();page.wait_for_timeout(250)
  assert page.get_by_role('dialog').is_visible() and page.locator('.dialog-panel').evaluate('e=>getComputedStyle(e).transform')=='none'
  body=page.locator('[data-dialog-body]');body.evaluate('e=>e.scrollTop=e.scrollHeight');field=page.get_by_placeholder('弹层输入');field.focus()
  b=field.bounding_box();x,y=b['x']+10,b['y']+10
  page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+200,y,steps=10);page.mouse.up();page.wait_for_timeout(200)
  assert page.get_by_role('dialog').is_visible() and page.locator('.dialog-panel').evaluate('e=>getComputedStyle(e).transform')=='none'
  field.evaluate('e=>e.blur()');page.get_by_role('button',name='关闭',exact=True).click()
  # System cancellation restores the panel and retains the same route.
  open_sheet();x,y=photo_origin();page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+160,y,steps=10)
  page.dispatch_event('body','pointercancel',{'pointerType':'mouse','clientX':x+160,'clientY':y});page.mouse.up();page.wait_for_timeout(300)
  assert page.get_by_role('dialog').is_visible() and page.locator('.dialog-panel').evaluate('e=>getComputedStyle(e).transform')=='none'
  # Removing an in-flight sheet cannot close the next one.
  x,y=photo_origin();page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+260,y,steps=10);page.mouse.up()
  page.evaluate("document.querySelector('.dialog-host').remove();showSheet()");page.wait_for_timeout(450)
  assert page.get_by_role('dialog').is_visible()
  if engine=='chromium':
   cdp=page.context.new_cdp_session(page)
   def touch_drag(x,y,dx,dy):
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for step in range(1,19):
     cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx*step/18,'y':y+dy*step/18}]})
     page.wait_for_timeout(15)
    page.wait_for_timeout(130);cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(450)
   page.evaluate("window.touchTrace=[];for(const type of ['touchstart','touchmove','touchend'])document.addEventListener(type,e=>touchTrace.push({type,x:e.touches[0]?.clientX,y:e.touches[0]?.clientY,blocked:e.defaultPrevented,cancelable:e.cancelable}),{passive:true})")
   x,y=photo_origin();touch_drag(x,y,260,0);assert page.get_by_role('dialog').count()==0
   open_sheet();x,y=photo_origin();touch_drag(x,y,0,-100)
   assert page.get_by_role('dialog').is_visible() and page.locator('[data-dialog-body]').evaluate('e=>e.scrollTop')>0, page.evaluate("({touch:touchTrace.slice(-22),photo:document.querySelector('.sheet-photo').outerHTML,action:getComputedStyle(document.querySelector('.sheet-photo')).touchAction,body:document.querySelector('[data-dialog-body]').scrollTop})")
   b=page.locator('.sheet-header').bounding_box();touch_drag(b['x']+60,b['y']+20,0,320)
   assert page.get_by_role('dialog').count()==0
   open_sheet();x,y=photo_origin();touch_drag(x,y,0,290);assert page.get_by_role('dialog').count()==0
  assert not errors,errors
  results.append({'realBrowserTouch':engine=='chromium','engine':engine,'rowIdleHoverFocus':'no highlight','rowImmediatePressAndScrollCancel':'pass','rowNoCachedSelection':'pass','sheetRightDownAndCancellation':'pass','bodyScrollHeaderClose':'pass','horizontalAlbumAndEditor':'preserved','replacedSheet':'pass'})
  browser.close()
 (root/'build/list-sheet-verification.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print('PASS: Chromium + WebKit row press/idle/hover/scroll/cancel/back, right/down modal dismiss, reversal/system cancellation, body scroll, album/editor and replaced-sheet safety')
