"""Check mounted UI with real React and TanStack Query in Chromium and WebKit."""
from pathlib import Path
from urllib.parse import urlparse,parse_qs
import json,os,subprocess
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
modules=Path(os.environ.get('TEST_NODE_MODULES','/workspace/vrcrp-test-tools/node_modules'))
bundle=root/'build/cache-fixture.js'
subprocess.run([str(modules/'.bin/esbuild'),str(root/'scripts/cache-fixture.jsx'),'--bundle','--format=esm','--platform=browser','--outfile='+str(bundle)],check=True,env={**os.environ,'NODE_PATH':str(modules)},capture_output=True)
results=[]
with sync_playwright() as p:
 for engine in ['chromium','webkit']:
  args={'headless':True}
  if engine=='chromium':args.update(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  browser=getattr(p,engine).launch(**args);page=browser.new_page(viewport={'width':393,'height':793},is_mobile=True,has_touch=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  peers=[{'user':{'id':f'peer-{i}','displayName':f'用户 {i}'}} for i in range(1,5)]
  server={'likes':peers[:2],'older':peers[2:],'posts':[{'id':'post-1','text':'初始帖子'}],'notices':[{'id':'notice-1','text':'初始通知','read':False}],'fail':False}
  requests=[]
  def route(r):
   url=urlparse(r.request.url);query=parse_qs(url.query)
   if url.path.startswith('/api/'):
    requests.append((url.path,query,r.request.method))
    if r.request.method!='GET':
     if server['fail']:r.fulfill(status=400,body='{}',content_type='application/json');return
     body=r.request.post_data_json or {}
     if url.path.endswith('/swipes'):
      for key in ['likes','older']:server[key]=[v for v in server[key] if v['user']['id']!=body['targetId']]
     value={'ok':True}
    elif url.path.endswith('/me'):value={'id':'self'}
    elif url.path.endswith('/me/counters'):value={'unreadMessages':0,'newLikes':0,'newVisitors':0,'unreadNotifications':0}
    elif url.path.endswith('/likes/received'):value={'items':server['older'] if query.get('cursor') else server['likes'],'nextCursor':None if query.get('cursor') else 'older'}
    elif url.path.endswith('/notifications'):value={'items':server['notices'],'nextCursor':None}
    elif url.path.endswith('/posts'):value={'items':server['posts'],'nextCursor':None}
    elif '/profiles/' in url.path:value={'id':url.path.rsplit('/',1)[-1],'displayName':'资料详情','relation':{'swiped':'none'}}
    else:value={'items':[],'nextCursor':None}
    r.fulfill(body=json.dumps(value),content_type='application/json')
   elif url.path.endswith('index-test.js'):r.fulfill(body=bundle.read_text(),content_type='text/javascript')
   else:r.fulfill(body='<html><head><style>:root{--surface:255 255 255;--primary:237 83 82}body{margin:0}.app-top{height:56px}button{height:44px}li{min-height:70px}main{min-height:900px}[role=dialog]{position:fixed;inset:90px 20px;background:white}</style></head><body><div id="root"></div><script type="module" src="/assets/index-test.js"></script></body></html>',content_type='text/html')
  page.route('https://erp.sex/**',route)
  page.add_init_script("window.nativeMessages=[];window.webkit={messageHandlers:{erpNativeApp:{postMessage:m=>nativeMessages.push(m)},erpNativeNotifications:{postMessage:m=>nativeMessages.push(m)}}}")
  for name in ['page-surfaces','interaction','site-cache','notifications','keyboard','page-templates','app-experience','content-experience']:page.add_init_script((root/'ERPStable'/f'{name}.js').read_text())
  page.goto('https://erp.sex/likes');page.wait_for_selector('[data-peer="peer-1"]');page.wait_for_timeout(150)
  untouched=page.locator('[data-peer="peer-1"]').element_handle();page.click('.like-more');page.wait_for_selector('[data-peer="peer-4"]')
  page.get_by_role('button',name='用户 3',exact=True).click();page.wait_for_selector('.pass');page.click('.pass');page.wait_for_selector('[data-peer="peer-3"]',state='detached',timeout=1500)
  assert untouched.evaluate('e=>e.isConnected'),'Successful skip remounted the original list'
  assert page.locator('[data-peer="peer-4"]').count()==1,'Skip discarded a later cached page'
  assert page.locator('.loading').count()==0
  server['fail']=True;page.get_by_role('button',name='用户 2',exact=True).click();page.click('.pass');page.get_by_text('跳过失败').wait_for();assert page.locator('[data-peer="peer-2"]').count()==1;page.click('.close-detail');server['fail']=False
  # A visible list receives new data without manual refresh or a WebSocket.
  server['likes'].append({'user':{'id':'live-peer','displayName':'及时更新的喜欢'}})
  page.wait_for_selector('[data-peer="live-peer"]',timeout=7000)
  page.evaluate("fixtureOpen('/notifications')");page.wait_for_selector('[data-notice="notice-1"]');page.wait_for_timeout(150)
  notice=page.locator('[data-notice="notice-1"]').element_handle();server['notices'].append({'id':'notice-2','text':'新的通知','read':False})
  page.evaluate("__vrcrpSiteCache.serverEvent('notification.new',{})");page.wait_for_selector('[data-notice="notice-2"]',timeout=1500);assert notice.evaluate('e=>e.isConnected')
  page.evaluate("fixtureOpen('/posts')");page.wait_for_selector('[data-post="post-1"]');page.wait_for_timeout(150)
  server['posts'][0]['text']='保存后更新的帖子'
  page.evaluate("fetch('/api/v1/posts/post-1',{method:'PATCH',headers:{'X-Content-Mode':'sfw','Accept-Language':'zh'},body:JSON.stringify({text:'保存后更新的帖子'})})")
  page.wait_for_function("document.querySelector('[data-post=post-1]').textContent==='保存后更新的帖子'",timeout=1500)
  # Returning to a warm screen preserves data; freshly added observers revalidate.
  page.evaluate("fixtureOpen('/likes')");page.wait_for_selector('[data-peer="live-peer"]',timeout=1000);assert page.locator('.loading').count()==0
  assert page.evaluate('fixtureBoots')==1 and page.evaluate("performance.getEntriesByType('navigation').length")==1
  assert not errors,errors
  results.append({'engine':engine,'successfulSkip':'immediate, stable list and later pages','failedSkip':'row retained','visibleLikesWithoutWS':'automatic','notifications':'event updates mounted UI','posts':'save updates mounted UI','warmReturn':'no spinner or document reload','requests':len(requests)})
  browser.close()
(root/'build/page-coherence-verification.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print('PASS: Chromium + WebKit mounted likes skip/failure/pagination, automatic live list, notification events, post-save updates and warm return without spinner or reload')
