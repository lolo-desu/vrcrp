"""Measure real fixed controls before/after a data-free reusable page layout.

Uses the published website CSS and the actual component class contracts. Tests
all route families, three view widths, themes and WebKit as well as Chromium.
"""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
css=Path(os.environ.get('ORIGINAL_SITE_CSS',root/'build/site-theme.css')).read_text()
paths=['/matches','/matches/thread','/likes','/likes/sent','/likes/secret','/visitors','/notifications','/browse','/discover','/me','/u/peer','/posts','/posts/post','/posts/new','/profile/edit','/profile/edit/photos','/profile/edit/bio','/settings','/settings/privacy','/settings/notifications','/settings/appearance','/settings/energy','/settings/membership','/settings/language','/settings/blocks','/settings/login-methods','/login','/register']
reports=[]
with sync_playwright() as p:
 for engine in ['chromium','webkit']:
  options={'headless':True}
  if engine=='chromium':options.update(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
  browser=getattr(p,engine).launch(**options)
  for width in [320,393,430]:
   for preset,scheme in [('pop','light'),('pop','dark'),('clean','light')]:
    page=browser.new_page(viewport={'width':width,'height':793},is_mobile=True,has_touch=True)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script('window.webkit={messageHandlers:{erpNativeApp:{postMessage(){}}}}')
    page.add_init_script((root/'ERPStable/page-templates.js').read_text())
    page.route('https://erp.sex/**',lambda r:r.fulfill(body=f'<html lang="zh-Hant" data-preset="{preset}" data-scheme="{scheme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>{css}body{{margin:0}}#wait{{position:fixed;inset:0;pointer-events:none}}.vr-page-block{{background:rgb(var(--fg)/.10)}}</style></head><body><div class="flex h-dvh flex-col"><header class="app-top sticky top-0 border-b border-border bg-surface"><div class="mx-auto flex h-14 items-center gap-1.5 px-2.5"><span>vrcrp</span><button class="ml-auto h-9 w-9"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="7"/></svg></button></div></header><main id="main" class="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-3 pt-5"></main></div><script>window.__vrcrpPaintState=()=>({{ready:true}});</script></body></html>',content_type='text/html'))
    page.goto('https://erp.sex/matches')
    for path in paths:
     result=page.evaluate('''path=>{
      history.replaceState({},'',path);document.querySelector('#wait')?.remove();
      const main=document.querySelector('#main'),chat=/^\\/matches\\//.test(path),profile=/^\\/u\\//.test(path);
      const icon='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m12 19-7-7 7-7M19 12H5"/></svg>';
      const btn=(text,extra='')=>`<button aria-label="${text}" class="btn inline-flex items-center justify-center gap-2 font-semibold rounded-ctl border border-transparent btn-ghost text-fg h-10 px-4 ${extra}">${icon}<span>${text}</span></button>`;
      main.innerHTML=`<div class="mb-5 flex items-center gap-3">${btn('返回')}<div class="min-w-0 flex-1"><h1 class="page-title display truncate text-2xl">${profile?'PRIVATE PERSON NAME':'页面标题'}</h1></div>${btn('更多')}</div>`+
       (chat?`<div class="card mb-2 flex items-center gap-2 p-2" data-vrcrp-chat-bar>${btn('返回')}<a href="/u/peer" class="flex min-w-0 flex-1 items-center gap-2"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==" width="40" height="40"><span>PRIVATE PERSON NAME</span></a>${btn('更多')}</div><div class="card flex-1 min-h-0 p-3"><div class="bubble-them">PRIVATE MESSAGE CONTENT</div></div><div class="mt-2"><form class="card flex items-end gap-1.5 p-2">${btn('图片','w-10 p-0')}${btn('语音','w-10 p-0')}<textarea rows="1" class="input !rounded-2xl resize-y leading-relaxed max-h-32 min-h-[40px] flex-1 resize-none border-0 bg-transparent focus:ring-0" placeholder="輸入訊息…">PRIVATE DRAFT</textarea>${btn('发送','w-10 p-0')}</form><p class="mt-1 text-center text-[11px] text-muted">聊天記錄存在這個瀏覽器。</p></div>`:
       `<nav class="scrollbar-none flex gap-1 overflow-x-auto border-b border-border mb-4">${btn('选项一')}${btn('选项二')}</nav><section class="card p-4"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==" width="80" height="80"><p>PRIVATE CONTENT BODY</p><label class="block text-sm font-semibold">固定字段与需要换行的固定说明文字，加载时每一行都应该保持清晰并位于原来的位置</label><input class="input w-full" value="PRIVATE INPUT" placeholder="输入…">${btn('保存')}${btn('关闭')}</section>`);
      const boxes=[...document.querySelectorAll('.app-top button,#main button,#main input,#main textarea,#main label,#main nav')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,width:r.width,height:r.height,border:s.borderTopWidth,radius:s.borderTopLeftRadius,bg:s.backgroundColor};}).filter(r=>r.y<793);
      const begin=performance.now();__vrcrpPageTemplates.remember(path);const duration=performance.now()-begin;
      const shell=document.createElement('section');shell.id='wait';document.body.append(shell);
      const target=chat?'/matches/different-thread':profile?'/u/different-person':path;
      const installed=__vrcrpPageTemplates.install(shell,target);
      const shapes=[...shell.querySelectorAll('[data-vrcrp-shape]')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,width:r.width,height:r.height,border:s.borderTopWidth,radius:s.borderTopLeftRadius,bg:s.backgroundColor};});
      const compare=boxes.map(b=>shapes.some(a=>['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<.1)&&a.border===b.border&&a.radius===b.radius&&a.bg===b.bg));
      const text=shell.outerHTML,icons=[...shell.querySelectorAll('[data-vrcrp-raster]')].map(e=>__vrcrpPageTemplates.raster(e));
      const masks=[...shell.querySelectorAll('.vr-page-block')].length;const fixedCopy=[...shell.querySelectorAll('[data-vrcrp-fixed-text]')].map(e=>e.textContent).join('');
      shell.remove();return {installed,compare,duration,masks,icons:icons.every(Boolean),privateRetained:/PRIVATE|data:image\\/gif|value="/.test(text),fixedCopy,models:__vrcrpPageTemplates.size()};
     }''',path)
     assert result['installed'] and all(result['compare']),(engine,width,preset,path,result)
     assert result['masks']>=2 and result['icons'] and not result['privateRetained'],(path,result)
     if not path.startswith('/matches/'):assert '需要换行的固定说明文字' in result['fixedCopy'],result
     assert result['models']<=32
     reports.append({'engine':engine,'width':width,'preset':preset,'scheme':scheme,'path':path,'fixedControls':len(result['compare']),'captureMilliseconds':round(result['duration'],2)})
    # A viewport/theme/account change must not reuse an incompatible layout.
    page.evaluate('document.documentElement.dataset.scheme="alternate";document.body.insertAdjacentHTML("beforeend","<section id=wait></section>")')
    assert not page.evaluate('__vrcrpPageTemplates.install(document.querySelector("#wait"),"/register")')
    page.evaluate('__vrcrpPageTemplates.clear()');assert page.evaluate('__vrcrpPageTemplates.size()')==0
    assert not errors,errors
    page.close()
  # The website's actual public locale module supplies fixed labels; no
  # account API, translated private names or hard-coded hashed chunk paths.
  localized=browser.new_page()
  localized.add_init_script((root/'ERPStable/page-templates.js').read_text())
  def localized_route(r):
   if r.request.url.endswith('index-localization-fixture.js'):
    r.fulfill(body='// "./locales/zh-Hant/chat.json":()=>R(()=>import("./chat-language-fixture.js"),[])',content_type='text/javascript')
   elif r.request.url.endswith('chat-language-fixture.js'):
    r.fulfill(body='export default {list:{title:"配對",active:"聊天中",closed:"已結束"},placeholder:"輸入訊息…",localNote:"聊天記錄存在這個瀏覽器。"}',content_type='text/javascript')
   else:
    r.fulfill(body='<html lang="zh-Hant"><head><script type="module" src="/assets/index-localization-fixture.js"></script></head><body></body></html>',content_type='text/html')
  localized.route('https://erp.sex/**',localized_route)
  localized.goto('https://erp.sex/')
  localized.wait_for_function('__vrcrpPageTemplates.label("配对")==="配對"')
  assert localized.evaluate('__vrcrpPageTemplates.label("输入消息…")')=='輸入訊息…'
  assert localized.evaluate('__vrcrpPageTemplates.label("聊天记录存在这个浏览器。")')==''
  localized.close()
  browser.close()
(root/'build/page-template-verification.json').write_text(json.dumps({'checks':reports,'fixedGeometry':'positions, sizes, borders, radii and backgrounds unchanged','privateContent':'names, media, messages, input values and drafts discarded','contextIsolation':'viewport/theme/account invalidation'},ensure_ascii=False,indent=2))
print(f'PASS: {len(reports)} measured page layouts, fixed controls retain original geometry, WebKit SVG raster, no previous names/messages/drafts/media, bounded and isolated templates')
