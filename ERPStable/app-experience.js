(() => {
  'use strict';
  const bridge = window.webkit?.messageHandlers?.erpNativeApp;
  if (window !== window.top || location.origin !== 'https://erp.sex' || !bridge) return;
  const tabPages = new Set(['/', '/discover', '/browse', '/likes', '/likes/sent', '/matches', '/posts', '/me']);
  const roots = new Set([...tabPages, '/login', '/register']);
  const refreshable = new Set(['/likes', '/likes/sent', '/matches', '/posts', '/visitors', '/notifications']);
  const css = `
    html[data-vrcrp-app="true"] .app-top {
      background: rgb(var(--surface)) !important;
      -webkit-backdrop-filter: none !important; backdrop-filter: none !important;
    }
    html[data-vrcrp-native-nav="true"] .app-bottom { opacity: 0 !important; }
    html[data-vrcrp-detail="true"] .app-bottom,
    html[data-vrcrp-keyboard="true"] .app-bottom { visibility: hidden !important; pointer-events: none !important; }
    html[data-vrcrp-app="true"] #main { padding-bottom: calc(var(--vrcrp-nav-space, 0px) + 16px) !important; }
    html[data-vrcrp-detail="true"] #main { padding-bottom: calc(16px + env(safe-area-inset-bottom)) !important; }
    html[data-vrcrp-chat="true"] #main { padding-bottom: calc(6px + env(safe-area-inset-bottom)) !important; }
    html[data-vrcrp-explore-grid="true"] .app-bottom a[href="/discover"] { color: rgb(var(--primary)) !important; font-weight: 600 !important; }
    html[data-vrcrp-app="true"] [data-vrcrp-passive-touch="true"] { touch-action: manipulation !important; }
    [data-vrcrp-swipe-group="true"] { max-width: min(100%, var(--vrcrp-swipe-width)) !important; }
    [data-vrcrp-swipe-actions="true"] > * { flex-shrink: 0 !important; }
    #vrcrp-page-placeholder { position:fixed; inset:0; z-index:47; overflow:hidden; background:rgb(var(--bg, 245 245 245)); color:rgb(var(--fg, 35 35 35)); pointer-events:none; }
    #vrcrp-page-placeholder { display:flex; flex-direction:column; box-sizing:border-box; height:var(--vrcrp-viewport-height,100dvh); }
    .vr-page-top { flex-shrink:0; height:56px; display:flex; align-items:center; gap:12px; padding:0 16px; background:rgb(var(--surface,255 255 255)); border-bottom:1px solid rgb(var(--border,230 232 236)); }
    [data-preset="pop"] .vr-page-top { border-bottom:2.5px solid rgb(var(--line,22 24 29)); }
    .vr-page-top .vr-page-block { margin:0; }
    .vr-page-end { margin-left:auto; display:flex; align-items:center; gap:16px; }
    .vr-page-body { width:100%; padding:20px 12px 16px; max-width:672px; margin:0 auto; box-sizing:border-box; }
    .vr-page-wide { max-width:1024px; }
    .vr-page-heading { display:flex; align-items:center; gap:12px; min-height:28px; margin-bottom:16px; }
    .vr-page-title { font:800 20px/28px system-ui; margin:0; }
    #vrcrp-page-placeholder button { pointer-events:auto; background:transparent; border:0; color:inherit; height:44px; width:44px; flex-shrink:0; padding:0; display:grid; place-items:center; touch-action:manipulation; }
    .vr-page-card { padding:20px; margin-bottom:16px; }
    /* Keep the actual website card class: its presets own borders and shadows. */
    :where(.vr-page-panel) { background:rgb(var(--surface,255 255 255)); border-radius:var(--radius-card,16px); border:1px solid rgb(var(--border,230 232 236)); }
    .vr-page-row { display:flex; align-items:center; gap:12px; }
    .vr-page-row .vr-page-lines .vr-page-block { margin:6px 0; }
    .vr-page-lines { flex:1; min-width:0; }
    .vr-page-block { background:rgb(var(--fg,35 35 35) / .10); border-radius:7px; height:12px; margin:10px 0; flex-shrink:0; animation:vr-page-breathe 1.8s ease-in-out infinite alternate; }
    .vr-page-avatar { flex-shrink:0; border-radius:50%; margin:0; }
    .vr-page-icon { border-radius:10px; margin:0; }
    .vr-page-list { padding:0; overflow:hidden; }
    .vr-page-list > .vr-page-row { padding:12px; border-bottom:1px solid rgb(var(--border,230 232 236)); }
    .vr-page-list > .vr-page-row:last-child { border-bottom:0; }
    .vr-page-menu > .vr-page-row { padding:16px; }
    .vr-page-tabs { display:flex; gap:8px; margin-bottom:16px; }
    .vr-page-tabs > .vr-page-block { width:28%; height:36px; border-radius:var(--radius-ctl,10px); margin:0; }
    .vr-page-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .vr-page-tile { aspect-ratio:3/4; overflow:hidden; margin:0; position:relative; }
    .vr-page-media { width:100%; border-radius:12px; margin:0; }
    .vr-page-tile > .vr-page-media { height:100%; border-radius:0; }
    .vr-page-tile-label { position:absolute; bottom:12px; left:12px; right:12px; }
    .vr-page-cover { height:128px; border-radius:0; margin:0; }
    .vr-page-hero { padding:0; overflow:hidden; position:relative; }
    .vr-page-hero > .vr-page-media { height:auto; aspect-ratio:4/5; max-height:70vh; border-radius:0; }
    .vr-page-hero .vr-page-tile-label { bottom:24px; left:20px; right:20px; }
    .vr-page-swipe { width:min(100%,380px,calc((var(--vrcrp-viewport-height,100dvh) - var(--vrcrp-placeholder-nav-height,74px) - 212px)*3/4.3)); margin:auto; }
    .vr-page-swipe .vr-page-hero { margin-bottom:0; }
    .vr-page-swipe .vr-page-hero > .vr-page-media { aspect-ratio:3/4.3; max-height:none; }
    .vr-page-post { padding:0; overflow:hidden; margin-bottom:12px; }
    .vr-page-post > .vr-page-media { height:auto; aspect-ratio:2/1; border-radius:0; }
    .vr-page-toggle { width:38px; height:22px; border-radius:20px; }
    .vr-page-input { height:44px; border-radius:var(--radius-ctl,10px); padding:0 12px; margin:0 0 20px; }
    .vr-page-input .vr-page-block { display:inline-block; }
    .vr-page-actions { display:flex; gap:16px; margin-top:16px; }
    .vr-page-actions > .vr-page-block { width:24px; height:24px; margin:0; }
    .vr-page-chat-top { display:flex; flex-shrink:0; align-items:center; gap:8px; padding:8px 20px; min-height:60px; margin:0 0 8px; border-radius:0!important; border-top:0!important; border-left:0!important; border-right:0!important; background:rgb(var(--surface,255 255 255))!important; }
    .vr-page-chat-top .vr-page-block { margin:4px 0; }
    .vr-page-chat-top > .vr-page-block { margin:0; }
    .vr-page-chat-body { display:flex; flex-direction:column; flex:1; min-height:0; max-width:792px; padding:0 12px calc(6px + env(safe-area-inset-bottom)); }
    .vr-page-chat-pane { flex:1; min-height:0; padding:12px; overflow:hidden; margin:0; }
    .vr-page-bubble { max-width:78%; width:62%; border-radius:24px; background:rgb(var(--fg,35 35 35) / .035); padding:8px 14px; margin:4px 0 16px; box-sizing:border-box; }
    .vr-page-bubble:nth-child(even) { margin-left:auto; width:74%; border-bottom-right-radius:6px; }
    .vr-page-bubble:nth-child(odd) { border-bottom-left-radius:6px; }
    .vr-page-compose { display:flex; align-items:center; gap:6px; flex-shrink:0; padding:8px; margin-top:8px; min-height:58px; }
    .vr-page-compose .vr-page-block { margin:0; }
    .vr-page-compose .vr-page-lines { min-height:var(--vrcrp-compose-field-height,40px); display:flex; align-items:center; }
    .vr-page-note-line { height:16.5px; margin-top:4px; display:flow-root; flex-shrink:0; }
    .vr-page-note { margin:5.25px auto; height:6px; width:44%; }
    .vrcrp-inline-placeholder { visibility:visible!important; width:100%; padding:0; box-sizing:border-box; }
    .vrcrp-inline-placeholder .vr-page-body { padding:0; }
    @media(min-width:640px) { .vr-page-body { padding-left:20px; padding-right:20px; } .vr-page-chat-body { padding-top:0; } .vr-page-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } .vr-page-feed { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; } }
    html[data-vrcrp-page-pending="true"] #main { pointer-events:none; }
    [data-vrcrp-loading-surface="true"] { position:relative!important; display:block!important; width:100%; overflow:hidden; }
    [data-vrcrp-loading-surface="true"] > :not(.vrcrp-inline-placeholder) { visibility:hidden!important; position:absolute; }
    @keyframes vr-inline-breathe { to { opacity:.55; } }
    @keyframes vr-page-breathe { to { background:rgb(var(--fg, 35 35 35) / .14); } }
    @media(prefers-reduced-motion:reduce) { #vrcrp-page-placeholder .vr-page-block,[data-vrcrp-loading-surface="true"]::after { animation:none; } }
  `;
  function post(value) { try { bridge.postMessage(value); } catch {} }
  function rgba(value) {
    const match = value.match(/^rgba?\(([^)]+)\)$/);
    if (!match) return [0, 0, 0, 1];
    const numbers = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [numbers[0] / 255, numbers[1] / 255, numbers[2] / 255, numbers[3] ?? 1];
  }
  function box(element, relative) {
    const r = element.getBoundingClientRect();
    return { x: r.x - (relative?.x ?? 0), y: r.y - (relative?.y ?? 0), width: r.width, height: r.height };
  }
  function setProperty(name, value) {
    const style = document.documentElement.style;
    if (style.getPropertyValue(name) !== value) style.setProperty(name, value);
  }
  let surfaceFingerprint = '';
  function updateTopSurface() {
    const header=document.querySelector('[data-vrcrp-chat-bar]')||document.querySelector('.app-top');
    if(header&&!document.querySelector('[data-vrcrp-profile-overlay],[role="dialog"],dialog[open]')) {
      const color=rgba(getComputedStyle(header).backgroundColor);
      if(color[3]>.99){const fp=JSON.stringify(color);if(fp!==surfaceFingerprint){surfaceFingerprint=fp;post({kind:'topSurface',color});}return;}
    }
    // Read painted CSS surfaces, never pixels from profile/chat media. A modal
    // or full-screen preview can cover the regular header without changing URL.
    const width = document.documentElement.clientWidth || innerWidth;
    const layers = document.elementsFromPoint(width / 2, 4).reverse();
    let color = [1, 1, 1, 1];
    for (const element of new Set(layers)) {
      const style = getComputedStyle(element);
      let opacity = 1;
      for (let node = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
      if (style.visibility === 'hidden' || opacity <= 0) continue;
      const layer = rgba(style.backgroundColor), alpha = layer[3] * opacity;
      color = color.map((value, i) => i === 3 ? 1 : layer[i] * alpha + value * (1 - alpha));
    }
    color = color.map(value => Math.round(value * 100000) / 100000);
    const fingerprint = JSON.stringify(color);
    if (fingerprint !== surfaceFingerprint) { surfaceFingerprint = fingerprint; post({ kind: 'topSurface', color }); }
  }
  function fitSwipeControls(navHeight) {
    const stage = document.querySelector('#main .stage');
    const actions = document.querySelector('#main .act-pass')?.parentElement;
    const group = stage?.parentElement;
    if (!stage || !actions || !group || !group.contains(actions)) return;
    if (location.pathname !== '/discover' || document.documentElement.dataset.vrcrpKeyboard === 'true' || innerWidth >= 1024) {
      group.removeAttribute('data-vrcrp-swipe-group'); actions.removeAttribute('data-vrcrp-swipe-actions'); return;
    }
    // Measure the site's natural size, then shrink only the card group when
    // needed. Keep the action order, button dimensions and Framer drag intact.
    group.removeAttribute('data-vrcrp-swipe-group');
    actions.dataset.vrcrpSwipeActions = 'true';
    const r = stage.getBoundingClientRect(), parent = group.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const height = parseFloat(document.documentElement.style.getPropertyValue('--vrcrp-viewport-height')) || innerHeight;
    const gap = parseFloat(getComputedStyle(actions).columnGap) || 0;
    const intrinsic = [...actions.children].reduce((sum, el) => sum + el.getBoundingClientRect().width, 0) + gap * Math.max(0, actions.children.length - 1);
    const tail = parent.height - r.height;
    const room = height - navHeight - 12 - (r.top + scrollY) - tail;
    const width = Math.min(r.width, Math.max(210, intrinsic, room * r.width / r.height));
    setProperty('--vrcrp-swipe-width', `${Math.round(width * 100) / 100}px`);
    group.dataset.vrcrpSwipeGroup = 'true';
  }
  function renderedSurface(element) {
    const height = parseFloat(document.documentElement.style.getPropertyValue('--vrcrp-viewport-height')) || innerHeight;
    const bounds = element.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0 || bounds.bottom <= 0 || bounds.top >= height) return false;
    for (let node = element; node instanceof Element; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    return true;
  }
  function navigationBlocked(nav, rect) {
    const height = parseFloat(document.documentElement.style.getPropertyValue('--vrcrp-viewport-height')) || innerHeight;
    // WebKit can keep the CSS viewport at its pre-keyboard height briefly.
    // A hidden source nav can therefore be outside hit testing even though the
    // native nav is correctly placed. Only an actual overlay should hide it.
    if ([...document.querySelectorAll('[data-dialog],[role="dialog"],dialog[open]')].some(renderedSurface)) return true;
    const y = Math.min(rect.y + Math.min(15, rect.height / 2), height - 15);
    const hit = document.elementFromPoint(rect.x + rect.width / 2, Math.max(0, y));
    if (!hit || nav.contains(hit)) return false;
    const navLayer = parseInt(getComputedStyle(nav).zIndex) || 0;
    for (let node = hit; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.position === 'fixed' && (parseInt(style.zIndex) || 0) > navLayer && renderedSurface(node)) return true;
    }
    return false;
  }
  let zonesFingerprint='',zoneFrame=false,observedMain=null;
  const zoneObserver=new ResizeObserver(scheduleGestureZones);
  function scheduleGestureZones(){if(!zoneFrame){zoneFrame=true;requestAnimationFrame(()=>{zoneFrame=false;updateGestureZones();});}}
  function updateGestureZones() {
    updateSelection();
    const main=document.querySelector('[data-vrcrp-dismissible-sheet]')||document.querySelector('[data-vrcrp-profile-overlay]')||document.getElementById('main');
    if(main!==observedMain){zoneObserver.disconnect();observedMain=main;if(main)zoneObserver.observe(main);}
    if(!main){if(zonesFingerprint!=='[]'){zonesFingerprint='[]';post({kind:'gestureZones',zones:[]});}return;}
    // Clickable photos and ordinary buttons do not own a horizontal gesture.
    // A protected zone must actually scroll/drag horizontally, or edit text.
    const elements=new Set(main.querySelectorAll('.stage,.cursor-grab,.snap-x,[role="slider"],[role="scrollbar"],input,textarea,select,[contenteditable]:not([contenteditable="false"]),video[controls]'));
    const visible=new Set();
    for(let x=0;x<5;x++)for(let y=0;y<9;y++){
      let el=document.elementFromPoint((x+.5)*innerWidth/5,(y+.5)*innerHeight/9);
      for(let n=0;el&&main.contains(el)&&n<20;n++,el=el.parentElement)visible.add(el);
    }
    for(const el of visible){
      const style=getComputedStyle(el);
      const horizontal=['auto','scroll'].includes(style.overflowX)&&el.scrollWidth>el.clientWidth+4;
      const key=Object.keys(el).find(k=>k.startsWith('__reactProps$'));
      const props=key&&el[key];
      const fiberKey=Object.keys(el).find(k=>k.startsWith('__reactFiber$'));
      let fiber=fiberKey&&el[fiberKey],framerDrag=false;
      for(let i=0;fiber&&i<18;i++,fiber=fiber.return){
        const p=fiber.memoizedProps;
        if((p?.drag===true||p?.drag==='x')&&p.dragListener!==false){framerDrag=true;break;}
        if(fiber!==el[fiberKey]&&typeof fiber.type==='string')break;
      }
      // Framer drag and actual pointer/touch handlers still retain their area;
      // touch-action alone (often applied to ordinary media) is insufficient.
      const customDrag=framerDrag||(style.touchAction==='pan-y'||style.touchAction==='none'||el.hasAttribute('data-vrcrp-passive-touch'))&&
        (el.draggable===true&&!el.matches('img,a')||typeof props?.onPointerMove==='function'||typeof props?.onTouchMove==='function');
      if(horizontal||customDrag)elements.add(el);
      const ownsGesture=horizontal||customDrag||el.matches('.stage,.cursor-grab,.snap-x,[role="slider"],[role="scrollbar"],input,textarea,select,video,canvas,[contenteditable]:not([contenteditable="false"])');
      if(ownsGesture){if(el.hasAttribute('data-vrcrp-passive-touch'))el.removeAttribute('data-vrcrp-passive-touch');}
      else if(style.touchAction==='none'&&!el.hasAttribute('data-vrcrp-passive-touch'))el.dataset.vrcrpPassiveTouch='true';
    }
    const zones=[];
    for(const el of elements){
      const r=el.getBoundingClientRect();let left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);
      if(right<=left||bottom<=top)continue;
      for(let node=el;node&&node!==document.body;node=node.parentElement){
        const style=getComputedStyle(node);
        if(style.visibility==='hidden'||style.display==='none'){right=left;break;}
        if(node===el)continue;
        const clip=node.getBoundingClientRect();
        if(style.overflowX!=='visible'){left=Math.max(left,clip.left);right=Math.min(right,clip.right);}
        if(style.overflowY!=='visible'){top=Math.max(top,clip.top);bottom=Math.min(bottom,clip.bottom);}
        if(right<=left||bottom<=top)break;
      }
      if(right>left&&bottom>top)zones.push({x:left,y:top,width:right-left,height:bottom-top});
      if(zones.length===100)break;
    }
    const fingerprint=entryKey()+JSON.stringify(zones);if(fingerprint!==zonesFingerprint){zonesFingerprint=fingerprint;post({kind:'gestureZones',entryKey:entryKey(),zones});}
  }
  window.__vrcrpRefreshGestureZones=updateGestureZones;
  document.addEventListener('scroll',scheduleGestureZones,{capture:true,passive:true});
  document.addEventListener('pointerdown',updateGestureZones,{capture:true,passive:true});
  let selectionFingerprint='';
  function updateSelection(){
    const selection=getSelection(),zones=[];
    if(selection&&!selection.isCollapsed&&selection.toString().trim())for(let i=0;i<selection.rangeCount;i++){
      const range=selection.getRangeAt(i);if(!range.commonAncestorContainer.isConnected)continue;
      for(const r of range.getClientRects())if(r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight)
        zones.push({x:Math.max(0,r.left-12),y:Math.max(0,r.top-12),width:r.width+24,height:r.height+24});
    }
    const value={kind:'selection',entryKey:entryKey(),selected:zones.length>0,zones:zones.slice(0,100)},fp=JSON.stringify(value);
    if(fp!==selectionFingerprint){selectionFingerprint=fp;post(value);}
  }
  document.addEventListener('selectionchange',updateSelection);
  document.addEventListener('pointerdown',updateSelection,{capture:true,passive:true});
  const icons = new Map();
  function rasterIcon(svg, color) {
    let source = svg.outerHTML.replace(/currentColor/g, color);
    if (!svg.hasAttribute('xmlns')) source = source.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    // The source is the site's navigation SVG, never a profile or chat image.
    if (icons.has(source)) return icons.get(source);
    const promise = new Promise(resolve => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 66;
        canvas.getContext('2d').drawImage(image, 0, 0, 66, 66);
        resolve(canvas.toDataURL('image/png').split(',')[1]);
      };
      image.onerror = () => resolve('');
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
    });
    icons.set(source, promise);
    if (icons.size > 48) icons.delete(icons.keys().next().value);
    return promise;
  }
  let navFingerprint = '';
  let generation = 0;
  let queued = false;
  let ready = false;
  let routePending = false, routeAnnounced = false;
  let lastPath = location.pathname;
  let entries = [location.pathname + location.search];
  let entryKeys = [history.state?.key || 'vr-initial'];
  const views = new Map();
  const pathViews = new Map();
  let index = 0;
  let direction = 'none', pendingRestore = null, settleGeneration = 0;
  let backQueue=0,backInFlight=false,backTimer=null,forwardIntent=null;
  let baseIndex = Number.isInteger(history.state?.idx) ? history.state.idx : 0;
  const entryKey = () => String(entryKeys[index] || 'vr-' + index);
  window.__vrcrpEntryKey=entryKey;
  let placeholder=null, presentation=null, departedMain=null, departedNodes=[], departedText='', domVersion=0, paintMemo=null;
  const loadingSelector='.animate-spin,[role="progressbar"],[aria-busy="true"],.loading,[data-loading="true"],[role="status"]';
  const pageTitle=path=>/^\/matches\//.test(path)?'聊天':/^\/profile\/edit/.test(path)?'编辑名片':/^\/u\//.test(path)?'个人资料':/^\/posts\//.test(path)?'帖子':({'/matches':'配对','/likes':'喜欢','/likes/sent':'喜欢','/posts':'广场','/notifications':'通知','/visitors':'访客','/me':'我的','/discover':'探索','/browse':'探索','/login':'登录','/register':'注册','/settings':'设置','/settings/privacy':'隐私','/settings/notifications':'通知设置','/settings/appearance':'外观','/settings/account':'账号','/settings/energy':'能量','/settings/membership':'会员'})[path]||(/^\/settings/.test(path)?'设置':'详情');
  const skeletonBlock=(width='100%',height=12,extra='')=>`<div data-vrcrp-shape class="vr-page-block ${extra}" style="width:${width};height:${height}px"></div>`;
  const skeletonRow=(size=48)=>`<div class="vr-page-row">${skeletonBlock(size+'px',size,'vr-page-avatar')}<div class="vr-page-lines">${skeletonBlock('46%')}${skeletonBlock('82%',10)}</div></div>`;
  const skeletonCard=(content,extra='',padding=true)=>`<div data-vrcrp-shape class="card vr-page-panel ${padding?'vr-page-card':''} ${extra}">${content}</div>`;
  const skeletonTabs=()=>`<div class="vr-page-tabs">${Array.from({length:3},()=>skeletonBlock('28%',36)).join('')}</div>`;
  const skeletonTiles=(n=4)=>`<div class="vr-page-grid">${Array.from({length:n},()=>skeletonCard(skeletonBlock('100%',0,'vr-page-media')+`<div class="vr-page-tile-label">${skeletonBlock('64%')}${skeletonBlock('86%',8)}</div>`,'vr-page-tile',false).replace('height:0px','')).join('')}</div>`;
  const skeletonBubbles=()=>[62,74,48,68].map((w,i)=>`<div data-vrcrp-shape class="vr-page-bubble ${i%2?'bubble-me':'bubble-them'}" style="width:${w}%">${skeletonBlock('84%')}${i===1?skeletonBlock('64%'):''}${skeletonBlock('26%',6)}</div>`).join('');
  function skeletonBody(path,fragment=false){
    if(/^\/matches\//.test(path))return fragment?skeletonBubbles():skeletonCard(skeletonBubbles(),'vr-page-chat-pane',false)+skeletonCard(`${skeletonBlock('24px',24,'vr-page-icon')}${skeletonBlock('24px',24,'vr-page-icon')}<div class="vr-page-lines">${skeletonBlock('70%')}</div>${skeletonBlock('40px',40,'vr-page-icon')}`,'vr-page-compose',false)+`<div class="vr-page-note-line">${skeletonBlock('44%',6,'vr-page-note')}</div>`;
    if(['/likes','/likes/sent','/browse'].includes(path))return skeletonTabs()+skeletonTiles(6);
    if(['/matches','/notifications','/visitors','/settings'].includes(path)){
      const size=path==='/matches'?52:path==='/notifications'?36:40;
      return (path==='/matches'||path==='/visitors'?skeletonTabs():'')+skeletonCard(Array.from({length:6},()=>skeletonRow(size)).join(''),'vr-page-list'+(path==='/notifications'||path==='/settings'?' vr-page-menu':''),false);
    }
    if(/^\/u\//.test(path))return skeletonCard(skeletonBlock('100%',0,'vr-page-media').replace('height:0px','')+`<div class="vr-page-tile-label">${skeletonBlock('48%',20)}${skeletonBlock('74%')}${skeletonBlock('56%',8)}</div>`,'vr-page-card vr-page-hero',false)+skeletonCard(skeletonBlock('38%',16)+skeletonBlock('96%')+skeletonBlock('84%')+skeletonBlock('68%'));
    if(path==='/discover'||path==='/')return `<div class="vr-page-swipe">`+skeletonCard(skeletonBlock('100%',0,'vr-page-media').replace('height:0px','')+`<div class="vr-page-tile-label">${skeletonBlock('54%',20)}${skeletonBlock('78%')}</div>`,'vr-page-card vr-page-hero',false)+`<div class="vr-page-actions" style="justify-content:center">${[1,2,3].map(()=>skeletonBlock('60px',60,'vr-page-avatar')).join('')}</div></div>`;
    if(path==='/me')return skeletonCard(skeletonBlock('100%',128,'vr-page-cover')+`<div style="padding:20px">${skeletonRow(64)}${skeletonBlock('100%',8)}${skeletonBlock('54%')}</div>`,'vr-page-card',false)+skeletonCard(Array.from({length:5},()=>skeletonRow(36)).join(''),'vr-page-list',false);
    if(path==='/posts')return skeletonTabs()+`<div class="vr-page-feed">${Array.from({length:3},()=>skeletonCard(skeletonBlock('100%',0,'vr-page-media').replace('height:0px','')+`<div style="padding:16px">${skeletonRow(32)}${skeletonBlock('94%')}${skeletonBlock('68%')}<div class="vr-page-actions">${[1,2,3].map(()=>skeletonBlock('24px',24)).join('')}</div></div>`,'vr-page-card vr-page-post',false)).join('')}</div>`;
    if(/^\/posts\/(?:new|[^/]+\/edit)/.test(path))return skeletonCard(skeletonBlock('38%')+skeletonCard(skeletonBlock('78%'),'vr-page-input',false)+skeletonBlock('100%',180,'vr-page-media')+skeletonBlock('100%',44));
    if(/^\/posts\//.test(path))return skeletonCard(skeletonRow(40)+skeletonBlock('92%')+skeletonBlock('78%')+skeletonBlock('100%',200,'vr-page-media')+`<div class="vr-page-actions">${[1,2,3].map(()=>skeletonBlock('24px',24)).join('')}</div>`)+skeletonCard(skeletonBlock('36%',16)+skeletonRow(32)+skeletonBlock('88%'));
    if(/^\/profile\/edit/.test(path)){
      const progress=skeletonCard(skeletonBlock('36%')+skeletonBlock('100%',8)+skeletonBlock('72%',8));
      const form=/\/photos$/.test(path)?skeletonTiles(4):/\/(?:bio|about)$/.test(path)?skeletonCard(skeletonBlock('40%')+skeletonBlock('100%',180,'vr-page-media')+skeletonBlock('100%',44)):skeletonForm(3);
      return progress+skeletonTabs()+form;
    }
    if(/^\/(?:login|register|forgot-password|reset-password)/.test(path))return skeletonForm(path==='/register'?3:2)+skeletonBlock('64%',10);
    if(['/settings/privacy','/settings/notifications'].includes(path))return skeletonToggleGroup(4)+skeletonToggleGroup(3);
    if(path==='/settings/appearance')return skeletonTabs()+skeletonTiles(4)+skeletonCard(skeletonBlock('32%')+skeletonBlock('100%',8));
    if(['/settings/energy','/settings/membership'].includes(path))return skeletonCard(skeletonBlock('40%')+skeletonBlock('34%',32)+skeletonBlock('82%'))+skeletonToggleGroup(3);
    if(['/settings/language','/settings/blocks','/settings/login-methods'].includes(path))return skeletonCard(Array.from({length:5},()=>skeletonRow(36)).join(''),'vr-page-list vr-page-menu',false);
    return skeletonForm(3)+skeletonCard(skeletonBlock('36%',16)+skeletonBlock('94%')+skeletonBlock('72%'));
  }
  function skeletonToggleGroup(count){return skeletonCard(Array.from({length:count},()=>`<div class="vr-page-row" style="margin-bottom:16px"><div class="vr-page-lines">${skeletonBlock('46%')}${skeletonBlock('78%',10)}</div>${skeletonBlock('38px',22,'vr-page-toggle')}</div>`).join(''));}
  function skeletonForm(count){return skeletonCard(Array.from({length:count},()=>skeletonBlock('32%')+skeletonCard(skeletonBlock('66%'),'input vr-page-input',false)).join('')+skeletonBlock('100%',44));}
  const loadingSurfaces=new Map();
  function updateLoadingSurfaces(){
    const next=new Set();
    // LoadingBlock is shared by cold routes, profile dialogs and inner panes.
    // Keep the original status/locale and controls; style only its waiting UI.
    for(const el of document.querySelectorAll('#main [role="status"],[data-dialog] [role="status"],[role="dialog"] [role="status"]')){
      if(!el.querySelector('.animate-spin')||el.closest('button,.app-top,.app-bottom')||el.querySelector('button,a[href],input,textarea,select,[role="alert"]'))continue;
      const label=el.textContent.trim()||el.getAttribute('aria-label')||'加载中';if(label.length>120)continue;
      next.add(el);
      const path=el.closest('[data-dialog],[role="dialog"],[data-vrcrp-profile-overlay]')?'/u/pending':location.pathname;
      if(!loadingSurfaces.has(el)){loadingSurfaces.set(el,el.getAttribute('aria-label'));el.dataset.vrcrpLoadingSurface='true';if(!el.hasAttribute('aria-label'))el.setAttribute('aria-label',label);}
      let content=el.querySelector(':scope > .vrcrp-inline-placeholder');
      if(!content){content=document.createElement('div');content.className='vrcrp-inline-placeholder';content.setAttribute('aria-hidden','true');el.append(content);}
      if(content.dataset.path!==path){content.dataset.path=path;content.innerHTML=skeletonBody(path,true);}
    }
    for(const [el,label] of loadingSurfaces)if(!next.has(el)){
      el.querySelector(':scope > .vrcrp-inline-placeholder')?.remove();el.removeAttribute('data-vrcrp-loading-surface');if(label===null)el.removeAttribute('aria-label');else el.setAttribute('aria-label',label);loadingSurfaces.delete(el);
    }
  }
  function installPlaceholder(path){
    placeholder?.remove();placeholder=null;
    presentation={key:entryKey(),path};
    if(!document.body)return;
    if(!document.getElementById('vrcrp-app-surfaces')){const style=document.createElement('style');style.id='vrcrp-app-surfaces';style.textContent=css;document.head.append(style);}
    const shell=document.createElement('section');shell.id='vrcrp-page-placeholder';shell.setAttribute('aria-label','正在加载'+pageTitle(path));
    const chat=/^\/matches\//.test(path),auth=/^\/(?:login|register|forgot-password|reset-password)/.test(path);
    const top=document.createElement('div');top.className=chat?'card vr-page-chat-top':'vr-page-top';top.dataset.vrcrpShape='';
    const heading=document.createElement('div');heading.className='vr-page-heading';
    if(chat||index>0&&!roots.has(path)){
      const back=document.createElement('button');back.type='button';back.setAttribute('aria-label','返回');
      back.dataset.vrcrpGlyph='back';back.dataset.vrcrpShape='';back.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 5-7 7 7 7"/></svg>';
      back.addEventListener('click',()=>{if(!window.__vrcrpBack?.()&&chat)window.__vrcrpOpenRoot?.('/matches');});(chat?top:heading).append(back);
    }
    const title=document.createElement('span');title.className='vr-page-title';title.dataset.vrcrpShape='';title.textContent=pageTitle(path);heading.append(title);
    if(chat)top.insertAdjacentHTML('beforeend',skeletonBlock('40px',40,'vr-page-avatar')+`<div class="vr-page-lines">${skeletonBlock('112px',14)}${skeletonBlock('74px',8)}</div>${skeletonBlock('24px',24,'vr-page-icon')}`);
    else top.innerHTML=skeletonBlock('28px',28,'vr-page-icon')+skeletonBlock('96px',14)+`<div class="vr-page-end">${skeletonBlock('22px',22,'vr-page-avatar')}${skeletonBlock('22px',22,'vr-page-avatar')}</div>`;
    const body=document.createElement('div');body.className='vr-page-body'+(chat?' vr-page-chat-body':/^\/u\/|^\/profile\/edit|^\/likes|^\/browse/.test(path)?' vr-page-wide':'');
    if(!chat&&path!=='/me')body.append(heading);
    body.insertAdjacentHTML('beforeend',skeletonBody(path));
    if(!auth)shell.append(top);else body.style.maxWidth='448px';
    shell.append(body);document.body.append(shell);placeholder=shell;
    if(chat){
      // The pop preset also styles inputs. Measure the same one-row input
      // classes, including their borders, rather than assuming a fixed height.
      const field=document.createElement('textarea');field.rows=1;field.className='input max-h-32 min-h-[40px] flex-1 resize-none border-0 bg-transparent focus:ring-0';field.style.cssText='position:absolute;visibility:hidden;width:120px;pointer-events:none';shell.append(field);
      body.style.setProperty('--vrcrp-compose-field-height',`${Math.max(40,field.getBoundingClientRect().height)}px`);field.remove();
    }
    if(path==='/discover'||path==='/'){const nav=document.querySelector('.app-bottom');body.style.setProperty('--vrcrp-placeholder-nav-height',`${nav?.getBoundingClientRect().height||74}px`);}
    document.documentElement.dataset.vrcrpPagePending='true';
  }
  function placeholderLayout(){
    if(!placeholder)return null;
    // UIKit draws this measured, themed DOM layout, rather than maintaining
    // a second approximation of every route and every website preset.
    const layers=[];
    for(const el of placeholder.querySelectorAll('[data-vrcrp-shape]')){
      const rect=box(el),style=getComputedStyle(el);if(rect.width<1||rect.height<1||rect.y>=innerHeight||rect.y+rect.height<=0)continue;
      let clip={x:0,y:0,width:innerWidth,height:innerHeight};
      for(let node=el.parentElement;node&&node!==placeholder;node=node.parentElement)if(['hidden','clip','auto','scroll'].includes(getComputedStyle(node).overflowY)){
        const r=box(node),right=Math.min(clip.x+clip.width,r.x+r.width),bottom=Math.min(clip.y+clip.height,r.y+r.height);clip.x=Math.max(clip.x,r.x);clip.y=Math.max(clip.y,r.y);clip.width=Math.max(0,right-clip.x);clip.height=Math.max(0,bottom-clip.y);
      }
      const border=['Top','Right','Bottom','Left'].map(side=>({width:parseFloat(style['border'+side+'Width'])||0,color:rgba(style['border'+side+'Color'])}));
      const layer={rect,clip,fill:rgba(style.backgroundColor),radius:['TopLeft','TopRight','BottomRight','BottomLeft'].map(c=>parseFloat(style['border'+c+'Radius'])||0),border};
      const shadow=style.boxShadow.match(/^(rgba?\([^)]+\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px(?:\s+(-?[\d.]+)px)?$/);
      if(shadow)layer.shadow={color:rgba(shadow[1]),x:Number(shadow[2]),y:Number(shadow[3]),blur:Number(shadow[4])};
      if(el.dataset.vrcrpGlyph)layer.glyph=el.dataset.vrcrpGlyph;
      if(el.classList.contains('vr-page-title')){layer.text=el.textContent;layer.fontSize=parseFloat(style.fontSize)||20;layer.weight=Number(style.fontWeight)||800;layer.ink=rgba(style.color);}
      layers.push(layer);if(layers.length===120)break;
    }
    return {width:innerWidth,height:innerHeight,layers};
  }
  function clearPlaceholder(){
    placeholder?.remove();placeholder=null;presentation=null;
    delete document.documentElement.dataset.vrcrpPagePending;
  }
  function meaningfulContent(main){
    if(!main)return false;
    const laidOut=el=>{for(let node=el;node&&node!==main.parentElement;node=node.parentElement){const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;}return true;};
    if([...main.querySelectorAll('[role="alert"]')].some(laidOut))return true;
    // A spinner beside existing rows is background work; an empty route with
    // only its heading/filter/back controls is still waiting for content.
    const inputs=[...main.querySelectorAll('textarea,form input:not([type="hidden"]),form select')].filter(el=>!el.closest(loadingSelector)&&laidOut(el));
    if(inputs.length)return true;
    const walker=document.createTreeWalker(main,NodeFilter.SHOW_TEXT);
    for(let n=0,node;(node=walker.nextNode())&&n<180;n++){
      const text=node.textContent.trim(),el=node.parentElement;
      if(!text||!el||el.closest(loadingSelector+' ,h1,h2,[data-vrcrp-page-back],[data-vrcrp-chat-back],[data-vrcrp-back-strip],.chat-header,[data-vrcrp-chat-bar],.app-top,.app-bottom,#vrcrp-system-notifications,#vrcrp-own-rank,script,style'))continue;
      if(el.closest('button')&&!el.closest('li,article,.card,[role="listitem"]')&&main.querySelector(loadingSelector))continue;
      if(/^(?:正在)?(?:加载|载入|连接|缓冲|loading|connecting)(?:中|消息|资料|内容|页面)?[.。…\s]*$/i.test(text))continue;
      if(el.closest('[hidden],[aria-hidden="true"]')||!laidOut(el))continue;
      return true;
    }
    return [...main.querySelectorAll('img[src]:not([src=""]),video[poster],canvas,.stage')].some(laidOut)&&!main.querySelector(loadingSelector);
  }
  function paintState(){
    const key=entryKey(),path=location.pathname;
    if(paintMemo?.key===key&&paintMemo.version===domVersion)return paintMemo.value;
    const main=document.getElementById('main')||document.getElementById('root');let usable=meaningfulContent(main);
    if(main&&(getComputedStyle(main).display==='none'||getComputedStyle(main).visibility==='hidden'))usable=false;
    const loading=main?.querySelector(loadingSelector);
    const committed=usable?committedMainPath():null;
    if(committed!==null&&committed.replace(/\/$/,'')!==path.replace(/\/$/,''))usable=false;
    // Plain-DOM adapters have no router context. Reusing the untouched source
    // cannot acknowledge an incoming route merely because it contains text.
    if(usable&&presentation&&departedMain===main&&committed===null&&departedNodes.length&&departedNodes.every(node=>node.parentElement===main)&&main.textContent===departedText)usable=false;
    const chat=/^\/matches\/[^/]+\/?$/.test(path);
    if(chat&&!main?.querySelector('textarea,.messages,.card.relative.min-h-0.flex-1.overflow-y-auto,[role="alert"]'))usable=false;
    const value={key,path,ready:!!usable,loading:!!loading};
    paintMemo={key,version:domVersion,value};return value;
  }
  window.__vrcrpPaintState=()=>{paintMemo=null;const state=paintState();return {...state,contentReady:state.ready,placeholder:!!placeholder,ready:state.ready&&!placeholder};};
  function saveView() {
    const main = document.getElementById('main'); if (!main) return;
    const chat = /^\/matches\/[^/]+$/.test(lastPath), editor = chat ? main.querySelector('textarea') : null;
    const state = { x:scrollX,y:scrollY,scrollers:[...main.querySelectorAll('.overflow-y-auto,.messages')].map(e=>({top:e.scrollTop,bottom:e.scrollHeight-e.scrollTop-e.clientHeight<80})),draft:editor?.value?.slice(0,8000) || '' };
    views.delete(entryKey()); views.set(entryKey(),state); if(views.size>24)views.delete(views.keys().next().value);
    pathViews.delete(lastPath);pathViews.set(lastPath,state);if(pathViews.size>24)pathViews.delete(pathViews.keys().next().value);
  }
  function willNavigate(path, motion) {
    saveView();
    departedMain=document.getElementById('main')||document.getElementById('root');departedNodes=[...(departedMain?.children||[])];departedText=departedMain?.textContent||'';
    post({kind:'willNavigate',entryKey:entryKey(),toPath:path,direction:motion});
  }
  function committedRouterPath(){
    // Read only the committed root, never a work-in-progress alternate tree.
    const root=document.getElementById('root'),attachment=root&&Object.keys(root).find(k=>k.startsWith('__reactContainer$'));
    const fiber=attachment&&root[attachment],queue=fiber?[fiber.stateNode?.current||fiber]:[],seen=new Set();
    for(let n=0;queue.length&&n<300;n++){
      const node=queue.shift();if(!node||seen.has(node))continue;seen.add(node);
      const value=node.memoizedProps?.value,path=value?.location?.pathname;
      if(typeof path==='string'&&('navigationType' in value||'matches' in value))return path;
      if(node.child)queue.push(node.child);if(node.sibling)queue.push(node.sibling);
    }
    return null;
  }
  function committedMainPath(){
    const main=document.getElementById('main'),root=document.getElementById('root'),key=root&&Object.keys(root).find(k=>k.startsWith('__reactContainer$'));
    const attached=key&&root[key],stack=attached?[{node:attached.stateNode?.current||attached,path:null}]:[],seen=new Set();
    // The visible main can belong to the previous Suspense route while the
    // outer router/header already advertises the next location. Follow the
    // committed child edges: reused fibers can retain stale return pointers.
    for(let i=0;stack.length&&i<3500;i++){
      const entry=stack.pop(),node=entry.node;if(!node||seen.has(node))continue;seen.add(node);
      const matches=node.memoizedProps?.value?.matches;
      const matched=Array.isArray(matches)&&matches[matches.length-1]?.pathname;
      const path=typeof matched==='string'?matched:entry.path;
      if(node.stateNode===main)return path||committedRouterPath();
      if(node.sibling)stack.push({node:node.sibling,path:entry.path});
      if(node.child)stack.push({node:node.child,path});
    }
    return committedRouterPath();
  }
  function settle() {
    const owner = ++settleGeneration, key = entryKey(), saved = pendingRestore;
    const started = performance.now();
    // History is acknowledged independently of network/paint. Restoration,
    // however, waits for the actual destination instead of scrolling a loader.
    post({kind:'routeSettled',entryKey:key,path:location.pathname});
    function attempt() {
      if(owner!==settleGeneration || key!==entryKey())return;
      const main=document.getElementById('main'), chat=/^\/matches\/[^/]+$/.test(location.pathname);
      const editor=chat?main?.querySelector('textarea'):null;
      const usable=paintState().ready;
      const scrolls=main?[...main.querySelectorAll('.overflow-y-auto,.messages')]:[];
      const pendingHeight=saved?.scrollers?.some((s,i)=>s.top>0 && scrolls[i] && scrolls[i].scrollHeight-scrolls[i].clientHeight<s.top-1);
      if(!usable){setTimeout(attempt,100);return;}
      if(pendingHeight&&performance.now()-started<1400){setTimeout(attempt,35);return;}
      if(saved && main) {
        window.scrollTo(saved.x,saved.y);
        for(let i=0;i<scrolls.length;i++)if(saved.scrollers[i]){
          scrolls[i].scrollTop=saved.scrollers[i].bottom?scrolls[i].scrollHeight:saved.scrollers[i].top;
          scrolls[i].dispatchEvent(new Event('scroll'));
        }
        if(editor && saved.draft && !editor.value){
          Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(editor,saved.draft);
          editor.dispatchEvent(new Event('input',{bubbles:true}));
        }
      }
      pendingRestore=null;
      // A covered WebKit view may pause animation frames. Restoring an entry
      // must not depend on a paint to acknowledge that history traversal.
      const paint=()=>{
        if(owner!==settleGeneration||key!==entryKey())return;
        if(!paintState().ready){setTimeout(paint,100);return;}
        // Restore scroll and remove the waiting surface before acknowledging
        // two painted frames. No deadline turns a slow response into readiness.
        clearPlaceholder();
        requestAnimationFrame(()=>requestAnimationFrame(()=>{if(owner===settleGeneration&&key===entryKey()&&paintState().ready)post({kind:'pagePainted',entryKey:key,path:location.pathname});}));
      };paint();
    }
    attempt();
  }
  function announceRoute() {
    generation++;settleGeneration++;
    paintMemo=null;
    if(location.pathname!==lastPath||!ready)installPlaceholder(location.pathname);
    const theme=getComputedStyle(document.documentElement),surface=rgba('rgb('+ (theme.getPropertyValue('--surface').trim()||'255 255 255') +')'),canvas=rgba('rgb('+ (theme.getPropertyValue('--bg').trim()||'245 245 245') +')'),ink=rgba('rgb('+ (theme.getPropertyValue('--fg').trim()||'35 35 35') +')');
    post({ kind: 'route', path: location.pathname, entryKey:entryKey(),parentKey:index>0?String(entryKeys[index-1]):null,parentPath:index>0?entries[index-1].split('?')[0]:null,ancestors:entryKeys.slice(Math.max(0,index-24),index),direction,showTabs: tabPages.has(location.pathname),title:pageTitle(location.pathname),surfaceColor:surface,canvasColor:canvas,inkColor:ink,placeholderLayout:placeholderLayout(),canGoBack: index > 0 && !roots.has(location.pathname), refreshable: refreshable.has(location.pathname) });
    if (location.pathname === '/matches') window.__vrcrpSyncChats?.();
    window.__vrcrpSiteCache?.pageChanged?.();
    direction='none';
    const key=entryKey();setTimeout(()=>{if(key===entryKey())settle();},0);
  }
  async function update() {
    queued = false;
    let currentGeneration = ++generation;
    const modelKey=entryKey();
    const root = document.documentElement;
    if (!root || !document.head) return;
    root.dataset.vrcrpApp = 'true';
    root.dataset.vrcrpDetail = String(!tabPages.has(location.pathname));
    root.dataset.vrcrpExploreGrid = String(location.pathname === '/browse');
    if (!document.getElementById('vrcrp-app-surfaces')) {
      const style = document.createElement('style'); style.id = 'vrcrp-app-surfaces'; style.textContent = css; document.head.appendChild(style);
    }
    updateLoadingSurfaces();
    if (!ready && (document.querySelector('#root')?.innerText.trim() || document.querySelector('main,form,[role="dialog"]'))) {
      ready = true; post({ kind: 'ready' });
    }
    if (routePending) {
      routePending = false;
      if (!routeAnnounced) announceRoute();
      routeAnnounced = false; currentGeneration=generation; lastPath = location.pathname;
    }
    if(location.pathname!=='/browse')document.getElementById('vrcrp-own-rank')?.remove();
    if(location.pathname==='/browse'&&!document.getElementById('vrcrp-own-rank')){
      const heading=document.querySelector('#main h1');
      if(heading){
        const button=document.createElement('button');button.id='vrcrp-own-rank';button.type='button';button.textContent='···';
        button.className='shrink-0 rounded-ctl px-2 text-muted';button.setAttribute('aria-label','查询我的榜单位置');button.title='查询我的榜单位置';
        button.style.cssText='min-width:36px;min-height:36px;font-size:20px;letter-spacing:2px';
        button.addEventListener('click',async()=>{
          if(button.disabled)return;button.disabled=true;button.textContent='…';
          try{
            const value=await window.__vrcrpSiteCache.ownBrowsePosition();if(!button.isConnected||location.pathname!=='/browse')return;
            const text=value.position?`你出现在当前榜单返回列表的第 ${value.position} 位。\n\n沿用当前筛选和热度排序；网站可能隐藏部分用户，这不是补算的全站名次。`:`已检查当前榜单${value.complete?'全部返回内容':'前 '+value.checked+' 项'}，网站没有返回你的资料。\n\n网站可能隐藏自己，因此无法判断你是否上榜或计算真实名次。`;
            post({kind:'rankResult',body:text});
          }catch(error){if(button.isConnected&&location.pathname==='/browse')post({kind:'rankResult',body:error.name==='AbortError'?'查询已结束，请稍后重试。':error.message});}
          finally{button.disabled=false;button.textContent='···';}
        });heading.after(button);
      }
    }
    if(location.pathname!=='/settings/notifications')document.getElementById('vrcrp-system-notifications')?.remove();
    if (location.pathname === '/settings/notifications' && !document.getElementById('vrcrp-system-notifications')) {
      const main = document.getElementById('main');
      if (main) {
        const card = document.createElement('section'); card.id = 'vrcrp-system-notifications'; card.className = 'card mt-4 p-4';
        const caption = document.createElement('p'); caption.textContent = 'iOS 消息通知'; caption.className = 'font-semibold';
        const button = document.createElement('button'); button.type = 'button'; button.textContent = '系统通知设置';
        button.className = 'mt-3 rounded-ctl border border-border bg-surface2 px-4 py-3 text-fg';
        button.addEventListener('click', () => post({ kind: 'notificationSettings' }));
        const description = document.createElement('p'); description.textContent = '管理横幅、锁屏提醒、声音和消息预览'; description.className = 'mt-2 text-sm text-muted';
        const test=document.createElement('button');test.type='button';test.textContent='测试通知';test.className=button.className+' ml-2';test.addEventListener('click',()=>post({kind:'testNotification'}));
        card.append(caption,button,test,description); main.appendChild(card);
      }
    }
    const nav = document.querySelector('.app-bottom');
    const anchors = nav ? [...nav.querySelectorAll('a[href]')] : [];
    const keyboard = root.dataset.vrcrpKeyboard === 'true';
    const showTabs = tabPages.has(location.pathname) && !keyboard;
    const navHeight = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().height : 0;
    setProperty('--vrcrp-nav-space', `${showTabs ? navHeight : 0}px`);
    fitSwipeControls(showTabs ? navHeight : 0);
    updateTopSurface(); updateGestureZones();
    let model = { kind: 'navigation', entryKey:modelKey, visible: false, overlay: [...document.querySelectorAll('[data-dialog],[role="dialog"],dialog[open]')].some(renderedSurface) };
    if (nav && anchors.length === 5 && getComputedStyle(nav).display !== 'none' && nav.getBoundingClientRect().width > 0) {
      const rect = nav.getBoundingClientRect();
      // Native views must not cover a site's modal, menu backdrop or lightbox.
      const overlay = navigationBlocked(nav, rect);
      const visible = showTabs && getComputedStyle(nav).visibility !== 'hidden' && !overlay;
      const navStyle = getComputedStyle(nav);
      const items = await Promise.all(anchors.map(async (a, slot) => {
        const style = getComputedStyle(a), svg = a.querySelector('svg');
        const labelNodes = [...a.childNodes].filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
        const label = labelNodes.map(n => n.textContent.trim()).join(' ');
        let labelFrame = null;
        if (labelNodes.length) {
          const range = document.createRange(); range.selectNodeContents(labelNodes[labelNodes.length - 1]);
          const r = range.getBoundingClientRect(), parent = a.getBoundingClientRect();
          labelFrame = { x: r.x - parent.x, y: r.y - parent.y, width: r.width, height: r.height };
        }
        const badge = svg?.parentElement.querySelector('span');
        const badgeStyle = badge ? getComputedStyle(badge) : null;
        return {
          slot, path: new URL(a.href, location.href).pathname, title: label || a.getAttribute('aria-label') || '',
          selected: a.getAttribute('aria-current') === 'page' || location.pathname === '/browse' && new URL(a.href, location.href).pathname === '/discover', frame: box(a, rect), iconFrame: svg ? box(svg, a.getBoundingClientRect()) : null, labelFrame,
          icon: svg ? await rasterIcon(svg, getComputedStyle(svg).color) : '', color: rgba(style.color), fontSize: parseFloat(style.fontSize), bold: parseInt(style.fontWeight) >= 600, radius: parseFloat(style.borderRadius) || 0,
          badge: badge ? { title: badge.textContent, frame: box(badge, a.getBoundingClientRect()), color: rgba(badgeStyle.color), background: rgba(badgeStyle.backgroundColor) } : null,
        };
      }));
      if (currentGeneration !== generation || modelKey!==entryKey() || nav !== document.querySelector('.app-bottom')) return;
      let background = rgba(navStyle.backgroundColor);
      if (background[3] < .05) background = rgba(getComputedStyle(document.body).backgroundColor);
      const theme=getComputedStyle(root);
      model = { kind: 'navigation', entryKey:modelKey, visible, overlay, frame: box(nav), bottomPadding: parseFloat(navStyle.paddingBottom) || 0, background, borderColor: rgba(navStyle.borderTopColor), borderWidth: parseFloat(navStyle.borderTopWidth) || 0, selectedColor:rgba('rgb('+theme.getPropertyValue('--primary').trim()+')'),mutedColor:theme.getPropertyValue('--muted').trim()?rgba('rgb('+theme.getPropertyValue('--muted').trim()+')'):items.find(i=>!i.selected)?.color || [0.45,0.5,0.6,1], items };
    }
    const fingerprint = JSON.stringify(model);
    if (fingerprint !== navFingerprint) { navFingerprint = fingerprint; post(model); }
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  window.__vrcrpRefreshChrome=()=>{updateTopSurface();schedule();};
  window.__vrcrpNativeNavReady = () => {
    const nav = document.querySelector('.app-bottom');
    if (nav) {
      document.documentElement.dataset.vrcrpNativeNav = 'true';
      nav.setAttribute('aria-hidden', 'true');
    }
  };
  window.__vrcrpNativeNavFallback = () => {
    document.documentElement.dataset.vrcrpNativeNav = 'false';
    document.querySelector('.app-bottom')?.removeAttribute('aria-hidden');
  };
  window.__vrcrpAccessibility = value => {
    document.documentElement.dataset.vrcrpReduceTransparency = String(value.reduceTransparency === true);
    document.documentElement.dataset.vrcrpReduceMotion = String(value.reduceMotion === true);
  };
  window.__vrcrpActivateTab = slot => {
    if (!tabPages.has(location.pathname) || document.documentElement.dataset.vrcrpKeyboard === 'true') return;
    const anchors = [...(document.querySelector('.app-bottom')?.querySelectorAll('a[href]') ?? [])];
    if (Number.isInteger(slot) && slot >= 0 && slot < anchors.length) {
      const anchor = anchors[slot];
      if (new URL(anchor.href, location.href).pathname === location.pathname) {
        window.scrollTo({ top: 0, behavior: document.documentElement.dataset.vrcrpReduceMotion === 'true' || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        if (location.pathname === '/matches') window.__vrcrpSyncChats?.();
      } else anchor.click();
      return true;
    }
    return false;
  };
  function drainBack(){
    if(backInFlight||!backQueue)return;
    if(index<=0||roots.has(location.pathname)){backQueue=0;return;}
    backQueue--;backInFlight=true;saveView();document.activeElement?.blur?.();
    // One browser traversal at a time; a second intent waits for popstate.
    history.back();clearTimeout(backTimer);
    backTimer=setTimeout(()=>{backInFlight=false;backQueue=0;replayForward();},800);
  }
  function replayForward(){
    const intent=forwardIntent;forwardIntent=null;if(!intent)return;
    setTimeout(()=>{
      const fresh=[...document.querySelectorAll('a[href]')].find(a=>a.href===intent.href);
      if(fresh)fresh.click();else if(intent.node.isConnected)intent.node.click();
    },0);
  }
  window.__vrcrpBack = () => {
    if(index<=0||roots.has(location.pathname))return false;
    if(backQueue<index-(backInFlight?1:0))backQueue++;
    drainBack();return true;
  };
  document.addEventListener('click',event=>{
    if(!backInFlight)return;
    const a=event.target.closest?.('a[href]');if(!a||a.target||a.hasAttribute('download'))return;
    const url=new URL(a.href,location.href);if(url.origin!==location.origin)return;
    event.preventDefault();event.stopImmediatePropagation();
    forwardIntent={href:a.href,node:a};backQueue=0;
  },true);
  window.__vrcrpOpenRoot = path => { const a=document.querySelector(`.app-bottom a[href="${path}"]`);if(a)a.click();else location.assign(path); };
  window.__vrcrpClearNavigation = () => { views.clear();pathViews.clear(); pendingRestore=null;departedMain=null;departedNodes=[];paintMemo=null;clearPlaceholder(); };
  window.__vrcrpOpenMatches = () => {
    const link = document.querySelector('.app-bottom a[href="/matches"]');
    if (link) link.click(); else location.assign('/matches');
  };
  window.__vrcrpOpenChat = id => {
    if (typeof id !== 'string' || !/^[\w-]{1,120}$/.test(id)) return;
    const path = '/matches/' + id;
    if (location.pathname === path) return;
    const link = [...document.querySelectorAll('a[href]')].find(a => new URL(a.href, location.href).pathname === path);
    if (link) { link.click(); return; }
    const state = { usr: null, key: Math.random().toString(36).slice(2), idx: (history.state?.idx ?? 0) + 1 };
    history.pushState(state, '', path);
    window.dispatchEvent(new PopStateEvent('popstate', { state }));
  };
  const replaceEntry=history.replaceState.bind(history);
  const editorPath=path=>/^\/profile\/edit(?:\/|$)/.test(path);
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      let nextPath;try{nextPath=new URL(args[2] || location.href,location.href).pathname;}catch{nextPath=location.pathname;}
      const changed=nextPath!==location.pathname;
      const sibling=changed&&editorPath(nextPath)&&editorPath(location.pathname);
      if(changed) {
        backQueue=0;forwardIntent=null;
        direction=sibling?'tab':roots.has(nextPath)?(roots.has(location.pathname)?'tab':'pop'):'push';
        willNavigate(nextPath,direction);
      }
      if(sibling&&args[0]&&typeof args[0]==='object')args[0]={...args[0],idx:history.state?.idx??baseIndex+index};
      const result = sibling?replaceEntry(...args):Reflect.apply(original, this, args);
      const path = location.pathname + location.search;
      if (method === 'pushState'&&!sibling) { entries.splice(index + 1);entryKeys.splice(index+1); entries.push(path);entryKeys.push(history.state?.key || 'vr-'+Math.random().toString(36).slice(2)); index++; }
      else { entries[index] = path;entryKeys[index]=history.state?.key || entryKeys[index]; if (index === 0 && Number.isInteger(history.state?.idx)) baseIndex = history.state.idx; }
      if(changed)pendingRestore=sibling?null:views.get(entryKey()) || pathViews.get(location.pathname) || null;
      // Tell UIKit the new history key before waiting for a paint frame.
      // A quick nested gesture must use the latest parent even during layout.
      announceRoute(); routeAnnounced = true; lastPath = location.pathname;
      routePending = true; schedule();
      return result;
    };
  }
  window.addEventListener('popstate', event => {
    const path = location.pathname + location.search;
    if(!event.isTrusted && entries[index]===path && Number.isInteger(history.state?.idx) && history.state.idx-baseIndex===index)return;
    const oldIndex=index;
    clearTimeout(backTimer);backInFlight=false;
    saveView();
    departedMain=document.getElementById('main')||document.getElementById('root');departedNodes=[...(departedMain?.children||[])];departedText=departedMain?.textContent||'';
    const target = Number.isInteger(history.state?.idx) ? history.state.idx - baseIndex : -1;
    index = target >= 0 && target < entries.length && entries[target] === path ? target : Math.max(0, entries.lastIndexOf(path));
    // Profile dialogs use a ?u= history entry and close with navigate(-1).
    // Traversing those entries changes presentation, not the page hierarchy.
    // Leave the mounted list and its scroll position alone behind the dialog.
    const samePage=location.pathname===lastPath;
    direction=samePage?'none':index<oldIndex?'pop':index>oldIndex?'push':'none';
    pendingRestore=samePage?null:views.get(entryKey()) || null;
    announceRoute(); routeAnnounced = true; lastPath = location.pathname;
    routePending = true; schedule();
    if(forwardIntent)replayForward();else setTimeout(drainBack,0);
  });
  document.addEventListener('click', event => {
    if (!event.isTrusted) return;
    const el = event.target instanceof Element ? event.target : event.target.parentElement;
    const control = el?.closest('button,[role="button"],.app-bottom a');
    if (control && !control.matches(':disabled,[aria-disabled="true"]')) post({ kind: 'haptic', style: control.closest('.app-bottom') ? 'selection' : 'light' });
  }, { passive: true, capture: true });
  document.addEventListener('pointerdown',event=>{
    const a=event.target.closest?.('a[href]');if(!a)return;
    try{const url=new URL(a.href,location.href);if(url.origin===location.origin&&url.pathname!==location.pathname&&!roots.has(url.pathname))post({kind:'willNavigate',entryKey:entryKey(),toPath:url.pathname,direction:'push'});}catch{}
  },{passive:true,capture:true});
  // Observe successful operations without reading request/response bodies or
  // changing the site's promises, errors, animation timing or event handlers.
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const promise = Reflect.apply(originalFetch, this, args);
    let url, method;
    try { url = new URL(args[0] instanceof Request ? args[0].url : String(args[0]), location.href); method = args[1]?.method ?? (args[0] instanceof Request ? args[0].method : 'GET'); } catch {}
    if (url?.origin === location.origin && String(method).toUpperCase() === 'POST' && (url.pathname === '/api/v1/swipes' || /^\/api\/v1\/matches\/[^/]+\/messages$/.test(url.pathname))) {
      promise.then(response => { if (response.ok) post({ kind: 'haptic', style: url.pathname === '/api/v1/swipes' ? 'light' : 'success' }); }).catch(() => {});
    }
    return promise;
  };
  new MutationObserver(records => {
    if(records.some(r=>r.target===document.getElementById('main')||r.target.parentElement?.closest('#main'))){domVersion++;paintMemo=null;}
    if (!ready || records.some(record => record.type !== 'attributes' || record.target === document.documentElement || record.target === document.body || record.target.closest?.('.app-bottom,.app-top,[role="dialog"],.dialog-panel') || record.attributeName === 'open')) schedule();
  }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true, attributeFilter: ['class', 'style', 'aria-current', 'open', 'data-preset', 'data-theme', 'data-vrcrp-keyboard'] });
  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, { passive: true });
  let snapshotTimer;
  const snapshotSoon=()=>{clearTimeout(snapshotTimer);snapshotTimer=setTimeout(()=>post({kind:'viewUpdated',entryKey:entryKey()}),100);};
  window.addEventListener('scroll',snapshotSoon,{passive:true,capture:true});
  new MutationObserver(records=>{if(records.some(r=>r.target.closest?.('#main') && (r.type!=='attributes' || r.attributeName==='aria-current')))snapshotSoon();}).observe(document,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-current']});
  document.addEventListener('focusin', schedule);
  routePending = true; schedule();
})();
