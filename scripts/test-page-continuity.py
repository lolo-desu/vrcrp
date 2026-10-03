"""Real React Router/Suspense commits must not acknowledge old, blank or loading UI."""
from pathlib import Path
import os,json,subprocess
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
modules=Path(os.environ.get('TEST_NODE_MODULES','/workspace/vrcrp-test-tools/node_modules'))
bundle=root/'build/continuity-fixture.js'
subprocess.run([str(modules/'.bin/esbuild'),str(root/'scripts/continuity-fixture.jsx'),'--bundle','--format=esm','--platform=browser','--outfile='+str(bundle)],check=True,env={**os.environ,'NODE_PATH':str(modules)},capture_output=True)
reports=[]
with sync_playwright() as p:
 for engine in ['chromium','webkit']:
  options={'headless':True}
  if engine=='chromium':options.update(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  browser=getattr(p,engine).launch(**options);page=browser.new_page(viewport={'width':393,'height':793},is_mobile=True,has_touch=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  held=[];hold_list=[False]
  def route(r):
   if '/api/v1/fixture/profile' in r.request.url or '/api/v1/fixture/modal' in r.request.url or '/api/v1/fixture/list' in r.request.url and hold_list[0]:held.append(r)
   elif '/api/v1/fixture/list' in r.request.url:r.fulfill(body=json.dumps({'items':[{'id':'peer','name':'缓存会话'}]}),content_type='application/json')
   elif 'continuity-test.js' in r.request.url:r.fulfill(body=bundle.read_text(),content_type='text/javascript')
   else:r.fulfill(body='<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--surface:255 255 255;--bg:255 235 117;--fg:35 35 35;--primary:235 75 80}body{margin:0;font:16px system-ui}.app-top{height:56px;background:white}main{min-height:700px}h1{font-size:20px}.app-bottom{position:fixed;bottom:0;background:white;width:100%;height:60px}li{height:72px}article{height:1100px}button{height:44px}</style></head><body><div id="root"></div><script type="module" src="/assets/continuity-test.js"></script></body></html>',content_type='text/html')
  page.route('https://erp.sex/**',route)
  page.add_init_script('window.nativeMessages=[];window.webkit={messageHandlers:{erpNativeApp:{postMessage:m=>nativeMessages.push({...m,time:performance.now()})}}}')
  for name in ['page-surfaces','interaction','site-cache','notifications','keyboard','app-experience','content-experience']:page.add_init_script((root/'ERPStable'/f'{name}.js').read_text())
  page.goto('https://erp.sex/matches');page.wait_for_function("__vrcrpPaintState().ready")
  page.evaluate("continuityOpen('/u/peer')");page.wait_for_function("typeof releaseProfileModule==='function'")
  page.wait_for_timeout(2300)
  assert page.locator('#vrcrp-page-placeholder').count()==1
  assert page.locator('#vrcrp-page-placeholder .vr-page-block').count()>3
  assert not page.evaluate("__vrcrpPaintState().contentReady"),'Suspended incoming profile acknowledged outgoing list'
  assert not page.evaluate("nativeMessages.some(m=>m.kind==='pagePainted'&&m.path==='/u/peer')")
  page.evaluate('releaseProfileModule()');page.wait_for_function("!!document.querySelector('#main [role=status]')")
  page.wait_for_timeout(300)
  assert not page.evaluate("__vrcrpPaintState().contentReady"),'Spinner/heading-only profile counted as usable'
  assert held
  held.pop(0).fulfill(body=json.dumps({'text':'资料实际内容'}),content_type='application/json')
  page.wait_for_function("__vrcrpPaintState().ready&&nativeMessages.some(m=>m.kind==='pagePainted'&&m.path==='/u/peer')")
  page.evaluate('scrollTo(0,250)');page.wait_for_timeout(100)
  page.evaluate("continuityOpen('/posts/detail')");page.wait_for_function("typeof releasePostModule==='function'")
  page.wait_for_timeout(300);assert not page.evaluate("__vrcrpPaintState().contentReady"),'Old profile acknowledged suspended incoming post'
  page.evaluate('releasePostModule()');page.wait_for_function("__vrcrpPaintState().ready")
  page.evaluate('__vrcrpBack()');page.wait_for_function("location.pathname==='/u/peer'&&__vrcrpPaintState().ready&&Math.abs(scrollY-250)<2")
  # Force a parent data miss. Its cached native surface must remain until this
  # state reports real content, even after the previous two-second deadline.
  hold_list[0]=True;page.evaluate("continuityClient.removeQueries({queryKey:['continuity-list']});__vrcrpBack()")
  page.wait_for_function("location.pathname==='/matches'&&!!document.querySelector('#main [role=status]')")
  page.wait_for_timeout(2300)
  assert not page.evaluate('__vrcrpPaintState().ready') and page.locator('#vrcrp-page-placeholder').count()==1
  assert held
  held.pop(0).fulfill(body=json.dumps({'items':[{'id':'peer','name':'返回后同步会话'}]}),content_type='application/json')
  page.wait_for_function('__vrcrpPaintState().ready')
  assert page.locator('[data-vrcrp-back-strip],[data-vrcrp-injected-back]').count()==0,'Profile back control leaked into the reused parent'
  page.get_by_role('button',name='详情弹层').click()
  page.wait_for_selector('[role=dialog] [data-vrcrp-loading-surface]')
  waiting=page.locator('[role=dialog] [data-vrcrp-loading-surface]')
  assert waiting.bounding_box()['height']>=200
  assert waiting.locator('.animate-spin').evaluate('e=>getComputedStyle(e).visibility')=='hidden'
  assert waiting.get_attribute('aria-label')=='加载中…'
  assert page.locator('button[aria-label="操作反馈"] [data-vrcrp-loading-surface]').count()==0,'Operation feedback became a page skeleton'
  page.screenshot(path=str(root/'build'/f'continuity-modal-{engine}.png'))
  assert held
  held.pop(0).fulfill(body=json.dumps({'text':'喜欢详情实际内容'}),content_type='application/json')
  page.get_by_text('喜欢详情实际内容').wait_for()
  assert page.locator('[role=dialog] [data-vrcrp-loading-surface]').count()==0
  page.get_by_role('button',name='关闭详情').click()
  page.evaluate("continuityOpen('/profile/edit/basics')");page.wait_for_function('__vrcrpPaintState().ready')
  assert page.locator('input').input_value()=='保留编辑内容'
  page.evaluate('__vrcrpBack()');page.wait_for_function("location.pathname==='/matches'&&__vrcrpPaintState().ready")
  assert page.locator('[data-vrcrp-back-strip],[data-vrcrp-injected-back]').count()==0,'Editor back control leaked into the reused parent'
  page.evaluate("continuityOpen('/settings/notifications')");page.wait_for_selector('#vrcrp-system-notifications');page.wait_for_function('__vrcrpPaintState().ready')
  page.evaluate("continuityOpen('/settings/privacy')");page.wait_for_function('__vrcrpPaintState().ready')
  assert page.locator('#vrcrp-system-notifications').count()==0,'System settings card leaked into the reused next route'
  page.evaluate('__vrcrpBack();__vrcrpBack()');page.wait_for_function("location.pathname==='/matches'&&__vrcrpPaintState().ready")
  page.evaluate("continuityOpen('/login')");page.wait_for_function('__vrcrpPaintState().ready')
  assert page.locator('input[placeholder="邮箱"]').is_visible(),'Login outside #main stayed covered'
  assert page.evaluate('continuityBoots')==1 and page.evaluate("performance.getEntriesByType('navigation').length")==1
  page.evaluate("continuityOpen('/settings/notifications')");page.wait_for_selector('#vrcrp-system-notifications')
  assert page.get_by_role('button',name='测试通知',exact=True).count()==0
  assert page.locator('#vrcrp-system-notifications button').count()==1
  page.get_by_role('button',name='系统通知设置',exact=True).click()
  assert page.evaluate("nativeMessages.some(m=>m.kind==='notificationSettings')"),'System notification settings stopped working'
  page.evaluate("continuityOpen('/browse')");page.wait_for_function('__vrcrpPaintState().ready')
  assert page.locator('#vrcrp-own-rank').count()==0
  assert page.get_by_role('button',name='查询我的榜单位置').count()==0
  page.evaluate("continuityOpen('/matches')");page.wait_for_function('__vrcrpPaintState().ready')
  assert not errors,errors
  reports.append({'engine':engine,'suspendedRoute':'outgoing content rejected','slowData':'placeholder persists beyond two seconds','parentMiss':'paint delayed until parent content exists','warmBack':'scroll restored before reveal','modalWaiting':'localized skeleton, original close and operation feedback preserved','reusedContainers':'owned back and settings controls removed on departure','editorAndLogin':'usable forms reveal','documentLoads':1})
  browser.close()
(root/'build/page-continuity-verification.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
print('PASS: Chromium + WebKit real React Router/Suspense, slow data/parent miss, route and modal placeholders, original action feedback, warm scroll restoration and editor/login readiness')
