from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
I18NEXT=Path(os.environ.get('TEST_I18NEXT_MODULES',os.environ.get('TEST_NODE_MODULES',str(ROOT/'build/verification-deps/node_modules')))) / 'i18next/dist/esm/i18next.js'
fixture='''<!doctype html><html lang="zh-Hant"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}main{padding:16px}li{list-style:none}a{display:flex;height:68px;color:black;text-decoration:none}button{padding:16px}.card{background:white;border:1px solid #ddd}:root{--border:220 220 220;--fg:30 30 30;--primary:80 100 230}</style></head><body><div id="root"></div><script type="module" src="/assets/index-language-fixture.js"></script></body></html>'''
# An actual i18next singleton is exposed by react-i18next's getter shape.
module='''import i18n from "/assets/i18next.js";
await i18n.init({lng:"zh-Hant",fallbackLng:"en",resources:{"zh-Hant":{chat:{localNote:"聊天記錄存在這個瀏覽器。"},common:{profile:"個人資料",send:"發送圖片",notice:"通知",dynamic:"收到 {{count}} 則通知"}},en:{common:{profile:"Profile"}}},backend:{}});
i18n.services.backendConnector.backend={read:(lng,ns,done)=>done(null,{label:"載入新的資料"})};
const localeGetter=()=>i18n;export{localeGetter};
window.siteI18n=i18n;
window.account="self";window.__vrcrpSiteCache={account:()=>account};
window.notices=[{id:'visible-notice',read:false},{id:'offscreen-notice',read:false}];window.readCalls=[];
__vrcrpSiteCache.notificationItems=()=>notices;__vrcrpSiteCache.readVisibleNotifications=async ids=>{readCalls.push(ids);for(const n of notices)if(ids.includes(n.id))n.read=true;render()};
function render(){let path=location.pathname;document.getElementById("root").innerHTML='<main id="main">'+(path==='/settings/language'?'<h1>语言</h1><button id="traditional">繁體中文</button>':path==='/notifications'?'<ul><li data-notification-id="visible-notice"><div style="height:90px">可见通知</div></li><li data-notification-id="offscreen-notice" style="margin-top:1200px"><div style="height:90px">尚未查看的通知</div></li></ul>':path==='/matches'?'<ul class="card"><li><a href="/matches/a">阿甲</a></li><li><a href="/matches/b">乙乙</a></li></ul>':path==='/matches/a'?'<p class="text-xs text-muted">'+i18n.t("chat:localNote")+'</p>':'')+'<button id="translated">'+i18n.t("common:send")+'</button><p id="user-content">繁體暱稱，這是聊天內容與簡介</p></main>';document.getElementById("traditional")?.addEventListener("click",()=>i18n.changeLanguage("zh-Hant"));}
i18n.on("languageChanged",render);window.openPage=p=>{history.pushState({},"",p);render()};window.addEventListener("popstate",render);render();'''
with sync_playwright() as p:
 results=[]
 for engine in ['chromium','webkit']:
  browser=getattr(p,engine).launch(**({'executable_path':os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),'args':['--no-sandbox']} if engine=='chromium' else {}))
  page=browser.new_page(viewport={'width':393,'height':793},has_touch=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   url=r.request.url
   if url.endswith('/assets/index-language-fixture.js'):r.fulfill(body=module,content_type='text/javascript')
   elif url.endswith('/assets/i18next.js'):r.fulfill(body=I18NEXT.read_text(),content_type='text/javascript')
   else:r.fulfill(body=fixture,content_type='text/html')
  page.route('https://erp.sex/**',route)
  script='window.webkit={messageHandlers:{erpNativeApp:{postMessage(){}}}};'
  for f in ['chinese-converter','app-language','content-experience','chat-pins','notification-read']:script+='\n'+(ROOT/'ERPStable'/f'{f}.js').read_text()
  page.add_init_script(script);page.goto('https://erp.sex/settings/language')
  page.wait_for_function('!!window.__vrcrpI18n')
  page.locator('#vrcrp-simplified-language').click();page.wait_for_function('document.querySelector("#translated").textContent==="发送图片"')
  assert page.locator('#user-content').inner_text()=='繁體暱稱，這是聊天內容與簡介'
  assert page.evaluate('siteI18n.t("common:dynamic",{count:2})')=='收到 2 则通知'
  assert page.evaluate('siteI18n.t("chat:localNote")')==''
  # New namespaces are converted at backend load, before interpolation/rendering.
  assert page.evaluate('new Promise(resolve=>siteI18n.services.backendConnector.backend.read("zh-Hant","extra",(e,d)=>resolve(d.label)))')=='载入新的资料'
  page.reload();page.wait_for_function('document.querySelector("#translated")?.textContent==="发送图片"')
  page.locator('#traditional').click();page.wait_for_function('document.querySelector("#translated").textContent==="發送圖片"')
  page.evaluate('openPage("/matches/a")');page.wait_for_timeout(100);assert '聊天記錄存在' not in page.locator('#main').inner_text()
  page.evaluate('openPage("/matches")');page.wait_for_selector('a[data-vrcrp-chat-row]')
  row=page.locator('a[href="/matches/b"]')
  row.dispatch_event('pointerdown',{'clientX':80,'clientY':140,'button':0,'isPrimary':True});page.wait_for_timeout(580)
  assert page.locator('#vrcrp-pin-menu').is_visible();row.dispatch_event('pointerup',{'clientX':80,'clientY':140,'button':0});
  page.locator('#vrcrp-pin-menu button').first.click();page.wait_for_function('__vrcrpChatPins.ids()[0]==="b"')
  assert row.bounding_box()['y']<page.locator('a[href="/matches/a"]').bounding_box()['y']
  page.reload();page.wait_for_function('__vrcrpChatPins.ids()[0]==="b"')
  page.evaluate('account="other";openPage("/matches")');page.wait_for_function('__vrcrpChatPins.ids().length===0')
  page.evaluate('account="self";openPage("/matches")');page.wait_for_function('__vrcrpChatPins.ids()[0]==="b"')
  row=page.locator('a[href="/matches/b"]');row.dispatch_event('pointerdown',{'clientX':80,'clientY':45,'button':0});row.dispatch_event('pointermove',{'clientX':80,'clientY':80});page.wait_for_timeout(550);assert not page.locator('#vrcrp-pin-menu').count()
  page.evaluate('__vrcrpForeground=false;openPage("/notifications")');page.wait_for_timeout(400);assert page.evaluate('readCalls.length')==0
  page.evaluate('__vrcrpForeground=true;__vrcrpRefreshNotificationReads()');page.wait_for_function('notices[0].read===true')
  assert not page.evaluate('notices[1].read'),'offscreen notification was acknowledged'
  page.evaluate('scrollTo(0,1350)');page.wait_for_function('notices[1].read===true')
  assert page.evaluate('readCalls.flat().length')==2,'notification read repeated'
  assert not errors,errors
  results.append({'engine':engine,'language':True,'newNamespace':True,'userContentUnchanged':True,'localNoteRemoved':True,'longPressPin':True,'persisted':True,'accountIsolation':True,'scrollCancelsLongPress':True})
  browser.close();print('PASS',engine,'simplified resources/interpolation/lazy namespaces, original user text, removed note, long-press pin, persistence, account isolation and scroll cancellation')
 (ROOT/'build').mkdir(exist_ok=True);(ROOT/'build/v017-ui.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
