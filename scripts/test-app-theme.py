"""Exercise rendered website controls, theme persistence and cache isolation."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
css=Path(os.environ.get('ORIGINAL_SITE_CSS',root/'build/site-theme.css')).read_text()
variables=['bg','surface','surface-2','fg','muted','border','line','primary','primary-fg','primary-soft','accent','accent-fg','mark','danger','success','warning','ring','pop2','pop3']
paths=['/discover','/matches','/matches/thread','/likes','/likes/sent','/visitors','/notifications','/browse','/me','/u/peer','/posts','/posts/post','/posts/new','/profile/edit','/profile/edit/photos','/profile/edit/bio','/settings','/settings/privacy','/settings/notifications','/settings/appearance','/settings/energy','/settings/membership','/settings/language','/settings/blocks','/settings/login-methods','/login','/register']
body='''<html data-preset="pop" data-scheme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>CSS</style></head><body><header class="app-top bg-surface h-14">vrcrp</header><main id="main" class="px-3 pt-5"><h1 class="display text-2xl">设置</h1><section id="controls" class="card p-4"><button id="primary" class="btn btn-primary bg-primary text-primary-fg rounded-ctl h-10 px-4">保存</button><button class="btn btn-secondary bg-surface2 text-fg rounded-ctl h-10 px-4">取消</button><input class="input" placeholder="输入内容"><div class="bubble-me bg-primary text-primary-fg p-2">我的消息</div><div class="bubble-them bg-surface text-fg p-2">对方消息</div><span class="chip">资料标签</span><span class="chip-hot">高亮标签</span><span class="text-danger">错误提示</span><span class="text-success">成功提示</span><span class="text-warning">警告提示</span><span class="text-sky-500">网站链接标记</span><div class="bg-primary-soft text-primary">选中项</div><button class="act act-like">♥</button><button class="act act-super">★</button><button class="act act-pass">×</button><div class="tile">卡片</div></section><div id="media"><img width="40" height="40" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='red'/%3E%3C/svg%3E"></div></main><nav class="app-bottom bg-surface border-border">底栏</nav><div role="dialog" class="dialog-panel card p-4">弹窗</div></body></html>'''.replace('CSS',css)
reports=[]
with sync_playwright() as p:
 for engine in ['chromium','webkit']:
  args={'headless':True}
  if engine=='chromium':args.update(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  browser=getattr(p,engine).launch(**args);page=browser.new_page(viewport={'width':393,'height':793},has_touch=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script('''window.messages=[];window.clearCount=0;window.__vrcrpPageTemplates={clear:()=>clearCount++};window.webkit={messageHandlers:{erpNativeApp:{postMessage:m=>{messages.push(m);if(m.kind==='backgroundStatus')setTimeout(()=>__vrcrpBackgroundState({enabled:false,state:'off',description:'后台监听已关闭'}),0)}}}};'''+(root/'ERPStable/app-theme.js').read_text())
  page.route('https://erp.sex/**',lambda r:r.fulfill(body=body,content_type='text/html'))
  page.goto('https://erp.sex/settings');page.wait_for_selector('#vrcrp-palette-settings')
  assert page.get_by_role('button',name='官网原样',exact=True).get_attribute('aria-pressed')=='true'
  all_palettes=page.evaluate('__vrcrpTheme.palettes()');assert len(all_palettes)>=7
  for scheme in ['light','dark']:
   for preset in ['pop','mist','nightfall','spatial','club','clean']:
    page.evaluate('v=>{document.documentElement.dataset.scheme=v[0];document.documentElement.dataset.preset=v[1]}',[scheme,preset])
    for palette in [x['id'] for x in all_palettes if x['id']!='default']:
     geometry=page.evaluate("[...document.querySelectorAll('#controls *')].map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})")
     page.evaluate('__vrcrpTheme.select',palette)
     result=page.evaluate('''keys=>{
       const s=getComputedStyle(document.documentElement),read=k=>(s.getPropertyValue('--'+k).trim().match(/[\\d.]+/g)||[]).map(Number);
       const mono=keys.every(k=>new Set(read(k)).size===1),rgb=value=>(value.match(/[\\d.]+/g)||[]).slice(0,3).map(Number);
       const primary=document.getElementById('primary'),style=getComputedStyle(primary),luma=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
       const bg=(style.backgroundColor.match(/[\\d.]+/g)||[]).map(Number),under=read('surface'),alpha=bg[3]??1;
       const a=luma(rgb(style.color)),b=luma(bg.slice(0,3).map((v,i)=>v*alpha+under[i]*(1-alpha))),contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
       const nodes=[...document.querySelectorAll('#controls *,[role=dialog],.app-top,.app-bottom')];
       const colored=nodes.filter(e=>['color','backgroundColor','borderTopColor'].some(k=>{const style=getComputedStyle(e),v=rgb(style[k]);return (k!=='borderTopColor'||parseFloat(style.borderTopWidth)>0)&&v.length===3&&new Set(v).size>1})).map(e=>({name:e.className,color:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderTopColor}));
       const media=document.querySelector('#media img');return {mono,colored,contrast,primary:read('primary'),photoFilter:getComputedStyle(media).filter,photoSource:media.src,tokenCount:keys.filter(k=>read(k).length===3).length};
     }''',variables)
     assert result['tokenCount']==len(variables),(engine,scheme,preset,palette,result)
     assert result['contrast']>=4.5,(engine,scheme,preset,palette,result)
     if palette=='mono':assert result['mono'] and not result['colored'],(engine,scheme,preset,result)
     assert result['photoFilter']=='none' and 'fill=' in result['photoSource'],result
     unchanged=page.evaluate('''before=>{const after=[...document.querySelectorAll('#controls *')].map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]});return before.every((a,i)=>a.every((x,k)=>Math.abs(x-after[i][k])<.01))}''',geometry)
     assert unchanged,(engine,scheme,preset,palette)
     reports.append({'engine':engine,'scheme':scheme,'preset':preset,'palette':palette,'contrast':round(result['contrast'],2)})
  # Route changes must not change control geometry when selecting a palette.
  for i,path in enumerate(paths):
   unchanged=page.evaluate('''v=>{history.replaceState({},'',v[0]);const before=[...document.querySelectorAll('#controls *')].map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]});__vrcrpTheme.select(v[1]);const after=[...document.querySelectorAll('#controls *')].map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]});return before.every((a,i)=>a.every((x,k)=>Math.abs(x-after[i][k])<.01))}''',[path,all_palettes[1+i%6]['id']])
   assert unchanged,(engine,path)
  # Theme-provider changes must survive underneath custom colors.
  page.evaluate("document.documentElement.dataset.scheme='light';__vrcrpTheme.select('blue');document.documentElement.style.setProperty('--primary','1 2 3');document.documentElement.style.setProperty('--bg','230 231 232')")
  page.wait_for_function("document.documentElement.style.getPropertyValue('--primary')!=='1 2 3'")
  page.evaluate("__vrcrpTheme.select('default')")
  restored=page.evaluate("({primary:document.documentElement.style.getPropertyValue('--primary'),bg:document.documentElement.style.getPropertyValue('--bg'),priority:document.documentElement.style.getPropertyPriority('--primary')})")
  assert restored['primary'].split()==['1','2','3'] and restored['bg'].split()==['230','231','232'],(engine,restored)
  assert page.evaluate("document.documentElement.style.getPropertyPriority('--primary')")==''
  page.evaluate("__vrcrpTheme.select('mono')");page.reload();page.wait_for_function("__vrcrpTheme.current()==='mono'")
  assert page.evaluate("document.documentElement.style.getPropertyPriority('--primary')")=='important'
  assert page.evaluate('clearCount')>0
  assert page.evaluate("messages.filter(m=>m.kind==='paletteChanged').every(m=>m.background.length===4&&m.surface.length===4&&m.primary.length===4)")
  # Actual settings controls send preferences, never network credentials.
  page.evaluate("history.replaceState({},'','/settings/notifications');document.getElementById('main').insertAdjacentHTML('beforeend','<section id=vrcrp-system-notifications></section>');__vrcrpPreferencesUpdate()")
  switch=page.get_by_role('switch',name='后台监听（实验）');assert switch.get_attribute('aria-checked')=='false';switch.click()
  assert page.evaluate("messages.filter(m=>m.kind==='backgroundListening').at(-1)")=={'kind':'backgroundListening','enabled':True}
  page.evaluate('__vrcrpPreferencesUpdate()');assert switch.get_attribute('aria-busy')=='true'
  page.evaluate("__vrcrpBackgroundState({enabled:true,state:'foreground',description:'前台同步中'})")
  assert switch.get_attribute('aria-checked')=='true' and switch.get_attribute('aria-busy') is None
  page.screenshot(path=str(root/'build'/f'theme-mono-{engine}.png'),full_page=True)
  assert not errors,errors;browser.close()
  print(f'PASS ({engine}): six custom palettes x light/dark x six original designs; all semantic UI colors including Mono; readable primary buttons; photo preservation; unchanged layouts on 27 route families; preference persistence/provider restoration; native palette/cache messages and background switch')
(root/'build/app-theme-verification.json').write_text(json.dumps({'cases':len(reports),'engines':['Chromium','WebKit'],'routes':len(paths),'semanticColors':len(variables),'renderedCases':reports},indent=2))
