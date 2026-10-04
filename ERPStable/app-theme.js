(() => {
  'use strict';
  if (window !== window.top || location.origin !== 'https://erp.sex') return;
  function start(root) {
  const bridge=window.webkit?.messageHandlers?.erpNativeApp;
  const storageKey='vrcrp.palette.v1';
  const palettes=[
    {id:'default',name:'官网原样',note:'沿用网站配色',light:[255,90,78],dark:[255,125,116]},
    {id:'mono',name:'Mono',note:'黑 · 白 · 灰',light:[24,24,24],dark:[235,235,235]},
    {id:'blue',name:'海盐蓝',note:'清澈 · 平静',light:[37,99,235],dark:[147,197,253]},
    {id:'green',name:'苔绿',note:'自然 · 柔和',light:[21,128,61],dark:[134,239,172]},
    {id:'purple',name:'莓紫',note:'温柔 · 深邃',light:[124,58,237],dark:[196,181,253]},
    {id:'orange',name:'暖橙',note:'明亮 · 温暖',light:[194,65,12],dark:[253,186,116]},
    {id:'pink',name:'樱粉',note:'轻盈 · 亲切',light:[190,24,93],dark:[249,168,212]}
  ];
  let selected='default';try{const saved=localStorage.getItem(storageKey);if(palettes.some(p=>p.id===saved))selected=saved;}catch{}
  const original=new Map(),applied=new Map();let queued=false,lastFingerprint='',lastMode='',themeFrame=0,background=null;
  const setRootProperty=root.style.setProperty.bind(root.style),removeRootProperty=root.style.removeProperty.bind(root.style);
  // WebKit can reject a lower-priority setProperty over an !important value.
  // Retain the site's intended updates even when our active palette wins.
  root.style.setProperty=(key,value,priority='')=>{if(applied.has(key))original.set(key,{value:String(value),priority:String(priority)});return setRootProperty(key,value,priority);};
  root.style.removeProperty=key=>{if(applied.has(key))original.set(key,{value:'',priority:''});return removeRootProperty(key);};
  const post=value=>{try{bridge?.postMessage(value);}catch{}};
  const rgb=v=>v.join(' '),hex=v=>'#'+v.map(n=>Math.round(n).toString(16).padStart(2,'0')).join('');
  const blend=(a,b,t)=>a.map((v,i)=>Math.round(v*(1-t)+b[i]*t));
  const seenSheets=new WeakSet();let decorationCSS='';
  function themeDecorations(){
    if(!document.head)return;
    const scope='html[data-vrcrp-palette]:not([data-vrcrp-palette="default"])';
    const scoped=selector=>selector.split(',').map(raw=>{const s=raw.trim();return s.startsWith('[data-preset')||s.startsWith('[data-scheme')?scope+s:s.startsWith(':root')?scope+s.slice(5):scope+' '+s;}).join(',');
    const recolor=value=>value.replace(/rgba?\(([\d.,\s]+)\)/g,(whole,parts)=>{const channels=parts.trim().split(/[\s,]+/).map(Number);return channels.length>=3&&channels.every(Number.isFinite)&&new Set(channels.slice(0,3)).size>1?`rgb(var(--primary) / ${channels[3]??1})`:whole;});
    function rules(items){let out='';for(const rule of items){if(rule.selectorText&&rule.style){const declarations=['box-shadow','text-shadow'].map(key=>{const value=rule.style.getPropertyValue(key),mapped=recolor(value);return mapped!==value?`${key}:${mapped}!important;`:'';}).join('');if(declarations)out+=scoped(rule.selectorText)+'{'+declarations+'}';}
      else if(rule.cssRules){const inside=rules(rule.cssRules);if(inside){const prelude=rule.cssText.slice(0,rule.cssText.indexOf('{'));out+=prelude+'{'+inside+'}';}}}return out;}
    for(const sheet of document.styleSheets){if(seenSheets.has(sheet)||sheet.ownerNode?.id?.startsWith('vrcrp-'))continue;try{decorationCSS+=rules(sheet.cssRules);seenSheets.add(sheet);}catch{}}
    if(decorationCSS){let style=document.getElementById('vrcrp-palette-decorations');if(!style){style=document.createElement('style');style.id='vrcrp-palette-decorations';document.head.append(style);}if(style.textContent!==decorationCSS)style.textContent=decorationCSS;}
  }
  function dark(){const scheme=root.dataset.scheme||root.dataset.theme;return scheme==='dark'||scheme!=='light'&&(root.classList.contains('dark')||matchMedia('(prefers-color-scheme: dark)').matches);}
  function tokens(p,isDark){
    const mono=p.id==='mono',primary=isDark?p.dark:p.light,neutral=mono?[24,24,24]:[22,25,31];
    const bg=isDark?blend([14,14,14],primary,mono?0:.035):blend([250,250,250],primary,mono?0:.025);
    const surface=isDark?blend([23,23,23],primary,mono?0:.025):[255,255,255];
    const surface2=isDark?blend([35,35,35],primary,mono?0:.035):blend([243,243,243],primary,mono?0:.045);
    const foreground=isDark?(mono?[238,238,238]:[235,238,244]):neutral;
    const primaryFg=isDark?[17,17,17]:[255,255,255];
    const accent=mono?(isDark?[190,190,190]:[72,72,72]):blend(primary,isDark?[245,245,245]:[35,35,35],.12);
    return {'--bg':rgb(bg),'--surface':rgb(surface),'--surface-2':rgb(surface2),'--surface-a':'1','--surface-2-a':'1',
      '--fg':rgb(foreground),'--muted':rgb(isDark?(mono?[166,166,166]:[160,166,179]):(mono?[96,96,96]:[88,96,112])),
      '--border':rgb(isDark?blend(surface,[170,170,170],.25):blend(surface,[110,110,110],.19)),'--border-a':'1','--line':rgb(foreground),
      '--primary':rgb(primary),'--primary-fg':rgb(primaryFg),'--primary-soft':rgb(blend(surface,primary,isDark?.15:.09)),
      '--accent':rgb(accent),'--accent-fg':rgb(primaryFg),'--mark':rgb(primary),'--ring':rgb(primary),
      '--danger':rgb(mono?(isDark?[219,219,219]:[66,66,66]):(isDark?[253,164,175]:[190,18,60])),
      '--success':rgb(mono?(isDark?[187,187,187]:[74,74,74]):(isDark?[134,239,172]:[21,128,61])),
      '--warning':rgb(mono?(isDark?[201,201,201]:[92,92,92]):(isDark?[253,211,77]:[161,98,7])),
      '--pop2':rgb(blend(surface,primary,isDark?.23:.17)),'--pop3':rgb(blend(surface,accent,isDark?.16:.11)),
      '--veil':`rgb(${rgb(bg)} / .8)`,'--scene':`linear-gradient(145deg,rgb(${rgb(bg)}),rgb(${rgb(surface2)}))`,
      '--shadow-card':isDark?'0 8px 24px -18px rgb(0 0 0 / .5)':'none','--shadow-glow':`0 0 0 3px rgb(${rgb(primary)} / .22)`,
      '--shine-glow':`0 0 24px rgb(${rgb(primary)} / .16)`,'--shadow-pop':'0 18px 40px -20px rgb(0 0 0 / .35)',
      'color-scheme':isDark?'dark':'light'};
  }
  const css=`
    html[data-vrcrp-theme-changing] *,html[data-vrcrp-theme-changing] *:before,html[data-vrcrp-theme-changing] *:after{transition-property:none!important}
    html[data-vrcrp-palette]:not([data-vrcrp-palette="default"]) body{background-color:rgb(var(--bg))!important;color:rgb(var(--fg))!important;transition:none!important}
    html[data-vrcrp-palette]:not([data-vrcrp-palette="default"]) :is(.app-top,.app-bottom,.dialog-panel,.composer,.messages){background-color:rgb(var(--surface))!important}
    html[data-vrcrp-palette]:not([data-vrcrp-palette="default"]) .text-sky-500{color:rgb(var(--accent))!important}
    html[data-vrcrp-palette]:not([data-vrcrp-palette="default"]) [data-vrcrp-unread]{color:rgb(var(--primary-fg))!important}
    #vrcrp-palette-settings{margin-top:16px;padding:16px}
    .vrcrp-palette-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}
    .vrcrp-palette-option{display:flex;align-items:center;gap:10px;min-height:68px;padding:10px;text-align:left;border:1px solid rgb(var(--border));border-radius:var(--radius-ctl,12px);background:rgb(var(--surface));color:rgb(var(--fg));position:relative;transition:background-color .14s,border-color .14s;touch-action:manipulation}
    .vrcrp-palette-option[aria-pressed=true]{border:2px solid rgb(var(--primary));padding:9px;background:rgb(var(--primary-soft))}
    .vrcrp-palette-swatches{width:32px;height:36px;position:relative;flex-shrink:0}.vrcrp-palette-swatches i{position:absolute;border:1px solid rgb(0 0 0 / .12);border-radius:50%;width:25px;height:25px}.vrcrp-palette-swatches i:last-child{left:8px;top:10px}
    .vrcrp-palette-label{min-width:0;line-height:1.5}.vrcrp-palette-label strong{display:block;font-size:14px}.vrcrp-palette-label small{display:block;font-size:11px;color:rgb(var(--muted))}
    .vrcrp-background-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;padding-top:14px;border-top:1px solid rgb(var(--border))}
    .vrcrp-background-switch{width:52px;height:32px;border:0;border-radius:16px;background:rgb(var(--muted)/.3);padding:3px;flex-shrink:0;transition:background-color .15s;touch-action:manipulation}
    .vrcrp-background-switch:before{content:'';display:block;width:26px;height:26px;border-radius:50%;background:rgb(var(--surface));box-shadow:0 1px 3px rgb(0 0 0/.2);transform:translateX(0);transition:transform .15s}
    .vrcrp-background-switch[aria-checked=true]{background:rgb(var(--primary))}.vrcrp-background-switch[aria-checked=true]:before{background:rgb(var(--primary-fg));transform:translateX(20px)}
    .vrcrp-background-switch[aria-busy=true]{opacity:.55}.vrcrp-background-status{font-size:12px;color:rgb(var(--muted));margin-top:8px}
    @media(prefers-reduced-motion:reduce){.vrcrp-palette-option,.vrcrp-background-switch,.vrcrp-background-switch:before{transition:none}}
  `;
  function rememberUnderlying(){
    for(const [key,value] of applied){const current=root.style.getPropertyValue(key),priority=root.style.getPropertyPriority(key);if(current!==value||priority!=='important')original.set(key,{value:current,priority});}
  }
  function apply(){
    queued=false;if(!root)return;
    updateSettings();
    themeDecorations();
    rememberUnderlying();const palette=palettes.find(p=>p.id===selected),isDark=dark();
    const mode=[selected,isDark,root.dataset.preset].join('|');
    if(mode!==lastMode&&(selected!=='default'||lastMode&&!lastMode.startsWith('default|'))){
      root.setAttribute('data-vrcrp-theme-changing','');cancelAnimationFrame(themeFrame);
      themeFrame=requestAnimationFrame(()=>{themeFrame=requestAnimationFrame(()=>root.removeAttribute('data-vrcrp-theme-changing'));});
    }
    lastMode=mode;
    if(selected==='default'){
      for(const [key,value] of applied)if(root.style.getPropertyValue(key)===value&&root.style.getPropertyPriority(key)==='important'){const prior=original.get(key);removeRootProperty(key);if(prior?.value)setRootProperty(key,prior.value,prior.priority);}
      applied.clear();original.clear();
    }else{
      for(const [key,value] of Object.entries(tokens(palette,isDark))){
        if(!applied.has(key))original.set(key,{value:root.style.getPropertyValue(key),priority:root.style.getPropertyPriority(key)});
        if(root.style.getPropertyValue(key)!==value||root.style.getPropertyPriority(key)!=='important')setRootProperty(key,value,'important');
        applied.set(key,value);
      }
    }
    if(root.dataset.vrcrpPalette!==selected)root.dataset.vrcrpPalette=selected;
    const computed=getComputedStyle(root);
    const fingerprint=[selected,isDark,root.dataset.preset,...['--bg','--surface','--fg','--primary','--radius-card','--radius-ctl'].map(k=>computed.getPropertyValue(k))].join('|');
    if(fingerprint!==lastFingerprint){
      lastFingerprint=fingerprint;
      {
        window.__vrcrpPageTemplates?.clear();
        const theme=getComputedStyle(root),defaults={'--bg':[245,246,248],'--surface':[255,255,255],'--primary':[255,90,78]},array=key=>{const values=(theme.getPropertyValue(key).trim().match(/[\d.]+/g)||[]).slice(0,3).map(Number);return (values.length===3?values:defaults[key]).map(n=>n/255).concat(1);};
        post({kind:'paletteChanged',palette:selected,dark:isDark,background:array('--bg'),surface:array('--surface'),primary:array('--primary')});
        window.__vrcrpThemeChanged?.();window.__vrcrpRefreshSurface?.();window.__vrcrpRefreshChrome?.();
      }
    }
    updateSettings();
  }
  function schedule(){if(!queued){queued=true;queueMicrotask(apply);}}
  function select(id){if(!palettes.some(p=>p.id===id))return false;selected=id;try{localStorage.setItem(storageKey,id);}catch{}apply();return true;}
  function updateBackground(){
    const button=document.getElementById('vrcrp-background-switch'),status=document.getElementById('vrcrp-background-status');if(!button)return;
    const checked=String(background?.enabled===true);if(button.getAttribute('aria-checked')!==checked)button.setAttribute('aria-checked',checked);button.removeAttribute('aria-busy');
    const description=background?.description||'正在获取监听状态';const text=description+(background?.networkRetry?' · 网络重试中':'');if(status.textContent!==text)status.textContent=text;
  }
  function updateSettings(){
    if(!document.head)return;
    if(!document.getElementById('vrcrp-app-theme-style')){const style=document.createElement('style');style.id='vrcrp-app-theme-style';style.textContent=css;document.head.append(style);}
    const path=location.pathname,main=document.getElementById('main');
    if(!['/settings','/settings/appearance'].includes(path))document.getElementById('vrcrp-palette-settings')?.remove();
    if(main&&['/settings','/settings/appearance'].includes(path)&&!document.getElementById('vrcrp-palette-settings')){
      const card=document.createElement('section');card.id='vrcrp-palette-settings';card.className='card';
      const title=document.createElement('h2');title.className='font-semibold';title.textContent='App 主题';
      const note=document.createElement('p');note.className='mt-2 text-sm text-muted';note.textContent='配色随网站的浅色／深色模式切换';
      const grid=document.createElement('div');grid.className='vrcrp-palette-grid';
      for(const p of palettes){const button=document.createElement('button');button.type='button';button.className='vrcrp-palette-option';button.dataset.vrcrpPaletteOption=p.id;button.setAttribute('aria-label',p.name);button.setAttribute('aria-pressed',String(p.id===selected));
        const swatches=document.createElement('span');swatches.className='vrcrp-palette-swatches';swatches.setAttribute('aria-hidden','true');for(const color of [p.light,p.dark]){const dot=document.createElement('i');dot.style.backgroundColor=hex(color);swatches.append(dot);}
        const label=document.createElement('span');label.className='vrcrp-palette-label';const name=document.createElement('strong'),detail=document.createElement('small');name.textContent=p.name;detail.textContent=p.note;label.append(name,detail);button.append(swatches,label);button.addEventListener('click',()=>select(p.id));grid.append(button);}
      card.append(title,note,grid);main.append(card);
    }
    for(const button of document.querySelectorAll('[data-vrcrp-palette-option]')){const current=String(button.dataset.vrcrpPaletteOption===selected);if(button.getAttribute('aria-pressed')!==current)button.setAttribute('aria-pressed',current);}
    const host=path==='/settings/notifications'?document.getElementById('vrcrp-system-notifications'):null;
    if(host&&!document.getElementById('vrcrp-background-switch')){
      const row=document.createElement('div');row.className='vrcrp-background-row';const name=document.createElement('span');name.className='font-semibold';name.textContent='后台监听（实验）';
      const button=document.createElement('button');button.id='vrcrp-background-switch';button.type='button';button.className='vrcrp-background-switch';button.setAttribute('role','switch');button.setAttribute('aria-label','后台监听（实验）');button.setAttribute('aria-checked',String(background?.enabled===true));
      button.addEventListener('click',()=>{if(button.getAttribute('aria-busy')==='true')return;button.setAttribute('aria-busy','true');post({kind:'backgroundListening',enabled:button.getAttribute('aria-checked')!=='true'});setTimeout(()=>{if(button.isConnected&&button.hasAttribute('aria-busy')){button.removeAttribute('aria-busy');post({kind:'backgroundStatus'});}},2000);});
      const note=document.createElement('p');note.className='mt-2 text-sm text-muted';note.textContent='离开 App 后尝试继续接收消息，可能增加耗电。手动划掉 App 后停止。';
      const status=document.createElement('p');status.id='vrcrp-background-status';status.className='vrcrp-background-status';status.setAttribute('role','status');row.append(name,button);host.append(row,note,status);
      post({kind:'backgroundStatus'});
    }
    updateBackground();
  }
  window.__vrcrpBackgroundState=value=>{if(value&&typeof value.enabled==='boolean'){background=value;updateBackground();}};
  window.__vrcrpPreferencesUpdate=updateSettings;
  window.__vrcrpTheme={select,current:()=>selected,palettes:()=>palettes.map(({id,name})=>({id,name}))};
  new MutationObserver(schedule).observe(root,{attributes:true,attributeFilter:['style','class','data-scheme','data-theme','data-preset']});
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',schedule);
  window.addEventListener('storage',event=>{if(event.key===storageKey&&palettes.some(p=>p.id===event.newValue)){selected=event.newValue;apply();}});
  document.addEventListener('DOMContentLoaded',()=>{apply();updateSettings();});apply();
  document.addEventListener('load',event=>{if(event.target instanceof HTMLLinkElement&&event.target.rel==='stylesheet')schedule();},true);
  }
  if(document.documentElement)start(document.documentElement);
  else {const ready=new MutationObserver(()=>{if(document.documentElement){ready.disconnect();start(document.documentElement);}});ready.observe(document,{childList:true});}
})();
