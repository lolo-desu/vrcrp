(() => {
  'use strict';
  const bridge = window.webkit?.messageHandlers?.erpNativeApp;
  if (window !== window.top || location.origin !== 'https://erp.sex' || !bridge) return;
  const tabPages = new Set(['/', '/discover', '/browse', '/likes', '/likes/sent', '/likes/secret', '/matches', '/posts', '/me']);
  const roots = new Set([...tabPages, '/login', '/register'].filter(path=>path!=='/browse'));
  const topPages = new Set(['/', '/discover', '/likes', '/likes/sent', '/likes/secret', '/matches', '/posts', '/me']);
  const chatPath = path => /^\/matches\/[^/]+\/?$/.test(path);
  window.__vrcrpIsTopPage = path => topPages.has(path);
  const refreshable = new Set(['/likes', '/likes/sent', '/likes/secret', '/matches', '/posts', '/visitors', '/notifications']);
  const css = `
    html[data-vrcrp-app="true"] .app-top {
      background: rgb(var(--surface)) !important;
      -webkit-backdrop-filter: none !important; backdrop-filter: none !important;
    }
    html[data-vrcrp-top-level="false"] .app-top { display:none !important; }
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
    /* Row/group menu anchors use transforms and create stacking contexts. */
    #main li:has([aria-haspopup="menu"][aria-expanded="true"]),
    #main section.card:has([aria-haspopup="menu"][aria-expanded="true"]) { position:relative; z-index:41; }
    #vrcrp-page-placeholder { position:fixed; inset:0; z-index:47; overflow:hidden; background:rgb(var(--bg, 245 245 245)); color:rgb(var(--fg, 35 35 35)); pointer-events:none; }
    #vrcrp-page-placeholder { display:flex; flex-direction:column; box-sizing:border-box; height:var(--vrcrp-viewport-height,100dvh); }
    .vr-page-top { flex-shrink:0; height:56px; display:flex; align-items:center; gap:12px; padding:0 16px; background:rgb(var(--surface,255 255 255)); border-bottom:1px solid rgb(var(--border,230 232 236)); }
    [data-preset="pop"] .vr-page-top { border-bottom:2.5px solid rgb(var(--line,22 24 29)); }
    .vr-page-top .vr-page-block { margin:0; }
    .vr-page-end { margin-left:auto; display:flex; align-items:center; gap:16px; }
    .vr-page-body { width:100%; padding:20px 12px 16px; max-width:672px; margin:0 auto; box-sizing:border-box; }
    .vr-page-wide { max-width:1024px; }
    .vr-page-heading { display:flex; align-items:center; gap:12px; min-height:28px; margin-bottom:16px; }
    .vr-page-title { margin:0; }
    #vrcrp-page-placeholder button[data-vrcrp-skeleton-back] { pointer-events:auto; background:transparent; border:0; color:inherit; height:40px; width:40px; flex-shrink:0; padding:0; display:grid; place-items:center; touch-action:manipulation; }
    #vrcrp-page-placeholder .vr-page-chat-top button[data-vrcrp-skeleton-back] { min-height:44px; }
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
    .vr-page-compose { display:flex; align-items:flex-end; gap:6px; flex-shrink:0; padding:8px; margin-top:8px; }
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
    if(header&&getComputedStyle(header).display!=='none'&&getComputedStyle(header).visibility!=='hidden'&&!document.querySelector('[data-vrcrp-profile-overlay],[role="dialog"],dialog[open]')) {
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
    const nav = document.querySelector('.app-bottom');
    // Fixed-position layout can already reflect the new iOS viewport while
    // innerHeight is still stale. Fit against the bar actually on screen.
    const bottom = (navHeight && nav ? nav.getBoundingClientRect().top + scrollY : height) - 12;
    const tail = parent.height - r.height;
    const room = bottom - (r.top + scrollY) - tail;
    // The buttons retain their own widths and stay centered even when their
    // row is wider than the card. Their span must not set a minimum card height.
    const width = Math.min(r.width, Math.max(210, room * r.width / r.height));
    const setWidth = width => {
      const value = `${Math.floor(width * 100) / 100}px`;
      if (group.style.getPropertyValue('--vrcrp-swipe-width') !== value) group.style.setProperty('--vrcrp-swipe-width', value);
    };
    // The temporary measurements belong to this group. Mutating the root
    // during each hint-wrap adjustment would reschedule the entire app on
    // every frame even after its final geometry had stopped changing.
    setWidth(width);
    group.dataset.vrcrpSwipeGroup = 'true';
    // The new hold hint may wrap after the card narrows. Recheck that actual
    // layout so its extra line and the progress rings stay above the tab bar.
    for (let i = 0; i < 3; i++) {
      const card = stage.getBoundingClientRect();
      const overflow = group.getBoundingClientRect().bottom + scrollY - bottom;
      if (overflow <= 0.5 || card.width <= 210.5) break;
      const fitted = Math.max(210, card.width - overflow * card.width / card.height);
      setWidth(fitted);
    }
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
    for(const el of main.querySelectorAll('button.touch-none,[role="button"].touch-none'))if(window.__vrcrpOwnsPointerPress?.(el))elements.add(el);
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
      const ownsPress=window.__vrcrpOwnsPointerPress?.(el);
      if(horizontal||customDrag||ownsPress)elements.add(el);
      const ownsGesture=horizontal||customDrag||ownsPress||el.matches('.stage,.cursor-grab,.snap-x,[role="slider"],[role="scrollbar"],input,textarea,select,video,canvas,[contenteditable]:not([contenteditable="false"])');
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
  const iosHistory=!!window.webkit?.messageHandlers?.erpNativeApp&&window.__vrcrpPlatform!=='android';
  const trailState=(paths,keys,at,base)=>{const start=Math.max(0,at-32),end=Math.min(paths.length,start+64);return {version:1,paths:paths.slice(start,end),keys:keys.slice(start,end),index:at-start,base:base+start};};
  const savedTrail=history.state?.vrcrpTrail;
  if(iosHistory&&savedTrail?.version===1&&Array.isArray(savedTrail.paths)&&Array.isArray(savedTrail.keys)&&
     savedTrail.paths.length<=64&&savedTrail.paths.length===savedTrail.keys.length&&
     savedTrail.paths.every(p=>typeof p==='string'&&p.startsWith('/')&&p.length<=2048)&&
     savedTrail.keys.every(k=>typeof k==='string'&&k.length<=180)&&
     Number.isInteger(savedTrail.index)&&savedTrail.index>=0&&savedTrail.index<savedTrail.paths.length&&
     Number.isInteger(savedTrail.base)&&savedTrail.base+savedTrail.index===history.state?.idx&&
     savedTrail.paths[savedTrail.index]===location.pathname+location.search){
    entries=savedTrail.paths.slice();entryKeys=savedTrail.keys.slice();index=savedTrail.index;baseIndex=savedTrail.base;
  }
  const entryKey = () => String(entryKeys[index] || 'vr-' + index);
  window.__vrcrpEntryKey=entryKey;
  let placeholder=null, presentation=null, departedMain=null, departedNodes=[], departedText='', domVersion=0, paintMemo=null;
  const loadingSelector='.animate-spin,[role="progressbar"],[aria-busy="true"],.loading,[data-loading="true"],[role="status"]';
  const rawPageTitle=path=>/^\/matches\//.test(path)?'聊天':/^\/profile\/edit/.test(path)?'编辑名片':/^\/u\//.test(path)?'个人资料':/^\/posts\//.test(path)?'帖子':({'/matches':'配对','/likes':'喜欢我的人','/likes/sent':'我喜欢的人','/likes/secret':'我悄悄喜欢的人','/posts':'广场','/notifications':'通知','/visitors':'访客','/me':'我的','/discover':'探索','/browse':'排行榜','/login':'登录','/register':'注册','/settings':'设置','/settings/privacy':'隐私','/settings/notifications':'通知设置','/settings/appearance':'外观','/settings/account':'账号','/settings/energy':'能量','/settings/membership':'会员'})[path]||(/^\/settings/.test(path)?'设置':'详情');
  const translated=text=>window.__vrcrpPageTemplates?.label(text)||text;
  const pageTitle=path=>translated(rawPageTitle(path));
  const skeletonBlock=(width='100%',height=12,extra='')=>`<div data-vrcrp-shape class="vr-page-block ${extra}" style="width:${width};height:${height}px"></div>`;
  const skeletonRow=(size=48)=>`<div class="vr-page-row">${skeletonBlock(size+'px',size,'vr-page-avatar')}<div class="vr-page-lines">${skeletonBlock('46%')}${skeletonBlock('82%',10)}</div></div>`;
  const skeletonCard=(content,extra='',padding=true)=>`<div data-vrcrp-shape class="card vr-page-panel ${padding?'vr-page-card':''} ${extra}">${content}</div>`;
  const htmlText=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fixedText=(label,extra='')=>`<span data-vrcrp-shape data-vrcrp-fixed-text="true" class="${extra}">${htmlText(translated(label))}</span>`;
  // The same Button, IconButton, Textarea, Tabs and PageHeader classes used by
  // the site. Static controls are real controls with interaction suppressed.
  const buttonBase='btn inline-flex items-center justify-center gap-2 font-semibold rounded-ctl select-none whitespace-nowrap border border-transparent transition-[filter,background-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-[.98] disabled:opacity-45 disabled:pointer-events-none';
  const iconPaths={
    search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    down:'<path d="m6 9 6 6 6-6"/>',
    undo:'<path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7"/>',
    back:'<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    image:'<path d="M16 5h6"/><path d="M19 2v6"/><path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/><circle cx="9" cy="9" r="2"/>',
    mic:'<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/>',
    send:'<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
    more:'<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    next:'<path d="m9 18 6-6-6-6"/>',grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    filter:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    x:'<path d="M18 6 6 18m0-12 12 12"/>',heart:'<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>',
    star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>'
  };
  Object.assign(iconPaths,{"user-cog": "<path d=\"M10 15H6a4 4 0 0 0-4 4v2\"/><path d=\"m14.305 16.53.923-.382\"/><path d=\"m15.228 13.852-.923-.383\"/><path d=\"m16.852 12.228-.383-.923\"/><path d=\"m16.852 17.772-.383.924\"/><path d=\"m19.148 12.228.383-.923\"/><path d=\"m19.53 18.696-.382-.924\"/><path d=\"m20.772 13.852.924-.383\"/><path d=\"m20.772 16.148.924.383\"/><circle cx=\"18\" cy=\"15\" r=\"3\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/>", "eye": "<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>", "lock": "<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\"/><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"/>", "bell": "<path d=\"M10.268 21a2 2 0 0 0 3.464 0\"/><path d=\"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326\"/>", "gamepad-2": "<line x1=\"6\" x2=\"10\" y1=\"11\" y2=\"11\"/><line x1=\"8\" x2=\"8\" y1=\"9\" y2=\"13\"/><line x1=\"15\" x2=\"15.01\" y1=\"12\" y2=\"12\"/><line x1=\"18\" x2=\"18.01\" y1=\"10\" y2=\"10\"/><path d=\"M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z\"/>", "crown": "<path d=\"M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z\"/><path d=\"M5 21h14\"/>", "zap": "<path d=\"M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z\"/>", "gift": "<path d=\"M12 7v14\"/><path d=\"M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8\"/><path d=\"M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5\"/><rect x=\"3\" y=\"7\" width=\"18\" height=\"4\" rx=\"1\"/>", "globe": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\"/><path d=\"M2 12h20\"/>", "shield-ban": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\"/><path d=\"m4.243 5.21 14.39 12.472\"/>", "scale": "<path d=\"M12 3v18\"/><path d=\"m19 8 3 8a5 5 0 0 1-6 0zV7\"/><path d=\"M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1\"/><path d=\"m5 8 3 8a5 5 0 0 1-6 0zV7\"/><path d=\"M7 21h10\"/>"});
  const icon=(name,size=20)=>`<svg data-vrcrp-shape data-vrcrp-icon="${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]||iconPaths.more}</svg>`;
  const iconButton=(name,label,disabled=false)=>`<button data-vrcrp-shape data-vrcrp-control="${name}" type="button" tabindex="-1" aria-label="${label}" class="${buttonBase} btn-ghost text-fg h-10 w-10 p-0 ${disabled?'opacity-45':''}" ${disabled?'disabled':''}>${icon(name)}</button>`;
  const fixedButton=(label,variant='outline',name='')=>`<button data-vrcrp-shape type="button" tabindex="-1" class="${buttonBase} btn-${variant} ${variant==='primary'?'bg-primary text-primary-fg':variant==='secondary'?'bg-surface2 text-fg':'border-border bg-surface text-fg'} h-8 px-3 text-xs">${name?icon(name,16):''}${fixedText(label)}</button>`;
  const skeletonTabs=(path=location.pathname)=>{
    if(/^\/profile\/edit/.test(path))return `<nav data-vrcrp-shape class="scrollbar-none -mx-3 flex gap-1 overflow-x-auto px-3 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 mb-4">${['basics','photos','vrc','identity','bio','models','questionnaire','preferences','adult','links'].map((key,i)=>`<span data-vrcrp-shape class="shrink-0 rounded-ctl px-3 py-2 text-sm font-medium ${path.endsWith('/'+key)||i===0&&!path.match(/edit\/./)?'bg-primary text-primary-fg':'text-muted'}">${fixedText(window.__vrcrpPageTemplates?.translate('editor','sections.'+key,{'basics':'基本资料','photos':'照片','vrc':'VRChat','identity':'身份','bio':'简介','models':'模型','questionnaire':'问卷','preferences':'偏好','adult':'成人','links':'链接'}[key]))}</span>`).join('')}</nav>`;
    const items=path==='/matches'?['聊天中','已结束']:['喜欢我','我喜欢的','我悄悄喜欢的','访客'];
    const selected=path==='/likes/sent'?1:path==='/likes/secret'?2:path==='/visitors'?3:0;
    return `<nav data-vrcrp-shape class="scrollbar-none flex gap-1 overflow-x-auto border-b border-border mb-4" role="tablist">${items.map((t,i)=>`<button data-vrcrp-shape type="button" tabindex="-1" role="tab" aria-selected="${i===selected}" class="relative -mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-2.5 pt-2 text-sm font-semibold ${i===selected?'border-primary text-fg':'border-transparent text-muted'}">${fixedText(t)}</button>`).join('')}</nav>`;
  };
  const chatComposer=()=>skeletonCard(`${iconButton('image','发送图片')}${iconButton('mic','录制语音')}<textarea data-vrcrp-shape rows="1" readonly tabindex="-1" placeholder="${htmlText(translated('输入消息…'))}" class="input !rounded-2xl resize-y leading-relaxed max-h-32 min-h-[40px] flex-1 resize-none border-0 bg-transparent focus:ring-0" style="min-width:0"></textarea>${iconButton('send','发送',true)}`,'vr-page-compose',false)+`<p data-vrcrp-shape data-vrcrp-fixed-text="true" class="mt-1 text-center text-[11px] text-muted vr-page-note-line">${htmlText(translated('聊天记录存在这个浏览器。'))}</p>`;

  const skeletonTiles=(n=4)=>`<div class="vr-page-grid">${Array.from({length:n},()=>skeletonCard(skeletonBlock('100%',0,'vr-page-media')+`<div class="vr-page-tile-label">${skeletonBlock('64%')}${skeletonBlock('86%',8)}</div>`,'vr-page-tile',false).replace('height:0px','')).join('')}</div>`;
  const skeletonBubbles=()=>[62,74,48,68].map((w,i)=>`<div data-vrcrp-shape class="vr-page-bubble ${i%2?'bubble-me':'bubble-them'}" style="width:${w}%">${skeletonBlock('84%')}${i===1?skeletonBlock('64%'):''}${skeletonBlock('26%',6)}</div>`).join('');
  function chatPreferences(){try{return JSON.parse(localStorage.getItem('erp_prefs')||'{}').state||{};}catch{return {};}}
  function skeletonBody(path,fragment=false){
    if(/^\/matches\//.test(path))return fragment?skeletonBubbles():skeletonCard(skeletonBubbles(),'vr-page-chat-pane',false)+chatComposer();
    if(['/likes','/likes/sent','/likes/secret','/browse'].includes(path))return (path==='/browse'?'':skeletonTabs(path))+skeletonTiles(6);
    if(path==='/settings')return skeletonCard(['账号','内容设置','隐私','通知','VRChat','会员','能量','邀请','语言','黑名单','处罚记录'].map((label,i)=>`<div class="vr-page-row" style="padding:16px"><span data-vrcrp-shape class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">${icon(['user-cog','eye','lock','bell','gamepad-2','crown','zap','gift','globe','shield-ban','scale'][i])}</span><span class="min-w-0 flex-1">${fixedText(label,'font-semibold')}${skeletonBlock('70%',8)}</span>${icon('next',16)}</div>`).join(''),'vr-page-list',false);
    if(['/matches','/notifications','/visitors'].includes(path)){
      const size=path==='/matches'?52:path==='/notifications'?36:40;
      const search=path==='/matches'?`<div data-vrcrp-shape class="relative mb-4"><span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">${icon('search',16)}</span><input data-vrcrp-shape class="input w-full pl-9 pr-9" readonly tabindex="-1" placeholder="${htmlText(translated('搜索配对的人'))}" aria-label="${htmlText(translated('搜索配对的人'))}" maxlength="50"></div>`:'';
      if(path==='/matches'&&chatPreferences().chatView==='groups'){
        const prefs=chatPreferences(),groups=window.__vrcrpSiteCache?.chatGroups?.()||[];
        return search+`<div class="space-y-3">${[{id:'default',label:'默认分组'},...groups.map(g=>({id:g.id})),{id:'unmatched',label:'已结束'}].map(g=>skeletonCard(`<div class="flex items-center pr-2"><div class="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-left">${icon((prefs.chatOpenGroups||['default']).includes(g.id)?'down':'next',16)}<span class="min-w-0 flex-1 font-semibold">${g.label?fixedText(g.label):skeletonBlock('112px',14)}</span>${skeletonBlock('18px',12)}</div></div>`+((prefs.chatOpenGroups||['default']).includes(g.id)?`<div class="border-t border-border">${Array.from({length:3},()=>skeletonRow(52)).join('')}</div>`:''),'overflow-visible',false)).join('')}${fixedButton('新增分组','secondary')}</div>`;
      }
      return search+(path==='/matches'||path==='/visitors'?skeletonTabs(path):'')+skeletonCard(Array.from({length:6},()=>skeletonRow(size)).join(''),'vr-page-list'+(path==='/notifications'||path==='/settings'?' vr-page-menu':''),false);
    }
    if(/^\/u\//.test(path))return skeletonCard(skeletonBlock('100%',0,'vr-page-media').replace('height:0px','')+`<div class="vr-page-tile-label">${skeletonBlock('48%',20)}${skeletonBlock('74%')}${skeletonBlock('56%',8)}</div>`,'vr-page-card vr-page-hero',false)+skeletonCard(skeletonBlock('38%',16)+skeletonBlock('96%')+skeletonBlock('84%')+skeletonBlock('68%'));
    if(path==='/discover'||path==='/')return `<div class="vr-page-swipe">`+skeletonCard(skeletonBlock('100%',0,'vr-page-media').replace('height:0px','')+`<div class="vr-page-tile-label">${skeletonBlock('54%',20)}${skeletonBlock('78%')}</div>`,'vr-page-card vr-page-hero',false)+`<div class="mt-5 flex items-center justify-center gap-3.5">${[['undo',44],['x',64],['star',56],['heart',64]].map(([n,size])=>`<div data-vrcrp-shape class="act grid place-items-center rounded-full border border-border bg-surface ${n==='heart'?'!border-transparent !bg-primary text-primary-fg':n==='star'?'text-accent':'text-muted'}" style="width:${size}px;height:${size}px;flex-shrink:0">${icon(n,n==='undo'?18:n==='star'?24:28)}</div>`).join('')}</div><p data-vrcrp-shape class="mt-3 grid px-2 text-center text-xs text-muted">${fixedText('长按 ♥ 或 ★ 可以悄悄喜欢，对方要等你们配对才知道。')}</p></div>`;
    if(path==='/me')return skeletonCard(skeletonBlock('100%',128,'vr-page-cover')+`<div style="padding:20px">${skeletonRow(64)}${skeletonBlock('100%',8)}${skeletonBlock('54%')}</div>`,'vr-page-card',false)+skeletonCard(Array.from({length:5},()=>skeletonRow(36)).join(''),'vr-page-list',false);
    if(path==='/posts')return `<div class="mb-3 flex flex-wrap items-center justify-between gap-2">${segmented(['全部','我的'])}${segmented(['综合','最新','热门'])}</div><div class="mb-4 flex flex-wrap items-center gap-2">${fixedButton('分类') }<div data-vrcrp-shape class="input flex-1 h-8">${fixedText('搜索帖子','text-muted text-sm')}</div></div>`+`<div class="vr-page-feed">${Array.from({length:3},()=>skeletonCard(skeletonBlock('100%',0,'vr-page-media').replace('height:0px','')+`<div style="padding:16px">${skeletonRow(32)}${skeletonBlock('94%')}${skeletonBlock('68%')}<div class="vr-page-actions">${['heart','more','send'].map(n=>iconButton(n,n)).join('')}</div></div>`,'vr-page-card vr-page-post',false)).join('')}</div>`;
    if(/^\/posts\/(?:new|[^/]+\/edit)/.test(path))return skeletonCard(skeletonBlock('38%')+skeletonCard(skeletonBlock('78%'),'vr-page-input',false)+skeletonBlock('100%',180,'vr-page-media')+skeletonBlock('100%',44));
    if(/^\/posts\//.test(path))return skeletonCard(skeletonRow(40)+skeletonBlock('92%')+skeletonBlock('78%')+skeletonBlock('100%',200,'vr-page-media')+`<div class="vr-page-actions">${['heart','more','send'].map(n=>iconButton(n,n)).join('')}</div>`)+skeletonCard(skeletonBlock('36%',16)+skeletonRow(32)+skeletonBlock('88%'));
    if(/^\/profile\/edit/.test(path)){
      const progress=skeletonCard(`<div class="flex items-center justify-between text-sm">${fixedText('名片完整度','font-semibold')}${skeletonBlock('40px',12)}</div>`+skeletonBlock('100%',8)+skeletonBlock('72%',8),'p-4 mb-4',false);
      const form=/\/photos$/.test(path)?skeletonTiles(4):/\/(?:bio|about)$/.test(path)?skeletonCard(skeletonBlock('40%')+skeletonBlock('100%',180,'vr-page-media')+skeletonBlock('100%',44)):skeletonForm(3);
      return progress+skeletonTabs(path)+form;
    }
    if(/^\/(?:login|register|forgot-password|reset-password)/.test(path))return skeletonForm(path==='/register'?3:2)+skeletonBlock('64%',10);
    if(path==='/settings/privacy')return skeletonToggleGroup(3,['隐身模式','暂停展示','隐藏访问记录'])+skeletonForm(1);
    if(path==='/settings/notifications')return skeletonToggleGroup(2,['新配对','新消息'])+skeletonToggleGroup(4,['新配对','新消息','收到喜欢','系统通知']);
    if(path==='/settings/appearance')return segmented(['跟随系统','浅色','深色'])+`<div style="height:16px"></div>`+skeletonTiles(4)+skeletonCard(skeletonBlock('32%')+skeletonBlock('100%',8));
    if(['/settings/energy','/settings/membership'].includes(path))return skeletonCard(skeletonBlock('40%')+skeletonBlock('34%',32)+skeletonBlock('82%'))+skeletonToggleGroup(3);
    if(['/settings/language','/settings/blocks','/settings/login-methods'].includes(path))return skeletonCard(Array.from({length:5},()=>skeletonRow(36)).join(''),'vr-page-list vr-page-menu',false);
    return skeletonForm(3)+skeletonCard(skeletonBlock('36%',16)+skeletonBlock('94%')+skeletonBlock('72%'));
  }
  function skeletonToggleGroup(count,labels=[]){return skeletonCard(`<div class="space-y-4">${Array.from({length:count},(_,i)=>`<label class="flex items-start gap-3"><span data-vrcrp-shape class="grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 border-border bg-surface"></span><span class="min-w-0">${labels[i]?fixedText(labels[i],'block text-sm text-fg'):skeletonBlock('160px')}${skeletonBlock('220px',8)}</span></label>`).join('')}</div>`,'p-4',false);}
  const segmented=(items,selected=0)=>`<div data-vrcrp-shape class="seg inline-flex flex-wrap gap-0.5 rounded-ctl bg-surface2 p-1" role="radiogroup">${items.map((label,i)=>`<button data-vrcrp-shape type="button" tabindex="-1" class="seg-item rounded-[calc(var(--radius-ctl)-2px)] font-semibold px-2.5 py-1 text-xs ${i===selected?'on bg-surface text-fg shadow-sm':'text-muted'}">${fixedText(label)}</button>`).join('')}</div>`;
  function skeletonForm(count){
    const auth=/^\/(?:login|register|forgot-password|reset-password)/.test(location.pathname),labels=auth?(location.pathname==='/register'?['昵称','邮箱','密码']:['邮箱','密码']):['昵称','所在地','简介'];
    return skeletonCard(`<div class="space-y-4">${Array.from({length:count},(_,i)=>`<div><label data-vrcrp-shape data-vrcrp-fixed-text="true" class="mb-1.5 block text-sm font-semibold">${labels[i]||'资料'}</label><div data-vrcrp-shape class="input w-full" style="min-height:44px">${auth?'':skeletonBlock('66%')}</div></div>`).join('')}${fixedButton(auth?(location.pathname==='/register'?'注册':'登录'):'保存','primary')}</div>`);
  }
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
    if(window.__vrcrpPageTemplates?.install(shell,path)){document.body.append(shell);placeholder=shell;document.documentElement.dataset.vrcrpPagePending='true';return;}
    const top=document.createElement('div');top.className=chat?'card vr-page-chat-top':'vr-page-top';top.dataset.vrcrpShape='';
    const heading=document.createElement('div');heading.className='mb-5 flex items-center gap-3';
    if(chat||index>0&&!roots.has(path)){
      const back=document.createElement('button');back.type='button';back.setAttribute('aria-label','返回');
      back.dataset.vrcrpSkeletonBack='true';back.dataset.vrcrpShape='';back.innerHTML=icon('back');
      back.addEventListener('click',()=>{if(!window.__vrcrpBack?.()&&chat)window.__vrcrpOpenRoot?.('/matches');});(chat?top:heading).append(back);
    }
    const title=document.createElement('span');title.className='vr-page-title page-title display truncate text-2xl sm:text-[28px]';title.dataset.vrcrpShape='';title.dataset.vrcrpFixedText='true';title.textContent=pageTitle(path);heading.append(title);
    if(path==='/likes/secret'){
      const labels=document.createElement('div');labels.className='min-w-0 flex-1';heading.replaceChildren(labels);labels.append(title);
      labels.insertAdjacentHTML('beforeend',`<p class="mt-1 text-sm text-muted">${fixedText('对方还看不到这些喜欢，配对后才会知道。')}</p>`);
    }
    if(path==='/browse'||/^\/profile\/edit/.test(path)){heading.className='mb-4 flex flex-wrap items-center gap-3';title.className='vr-page-title text-xl font-extrabold';}
    if(path==='/discover'||path==='/'){heading.insertAdjacentHTML('beforeend',`<div class="ml-auto flex shrink-0 items-center gap-2">${fixedButton('','secondary','grid')}${fixedButton('筛选','outline','filter')}</div>`);}
    if(path==='/posts')heading.insertAdjacentHTML('beforeend',`<div class="ml-auto">${fixedButton('发布','primary')}</div>`);
    if(path==='/matches')heading.insertAdjacentHTML('beforeend',`<div class="ml-auto">${fixedButton(chatPreferences().chatView==='groups'?'分组':'最近对话','outline','down')}</div>`);
    if(/^\/profile\/edit/.test(path))heading.insertAdjacentHTML('beforeend',`<div class="ml-auto">${fixedButton('预览')}</div>`);
    if(chat)top.insertAdjacentHTML('beforeend',skeletonBlock('40px',40,'vr-page-avatar')+`<div class="vr-page-lines">${skeletonBlock('112px',14)}${skeletonBlock('74px',8)}</div>${iconButton('more','更多')}`);
    else {const real=window.__vrcrpPageTemplates?.header?.();if(real){top.replaceChildren(...real.childNodes);top.className=real.className;top.style.cssText=real.style.cssText;top.style.flexShrink='0';}else top.innerHTML=fixedText('vrcrp','font-semibold')+`<div class="vr-page-end">${icon('more')}</div>`;}
    const body=document.createElement('div');body.className='vr-page-body'+(chat?' vr-page-chat-body':/^\/u\/|^\/profile\/edit|^\/likes|^\/browse/.test(path)?' vr-page-wide':'');
    if(!chat&&path!=='/me')body.append(heading);
    if(path==='/posts'||/^\/posts\//.test(path))body.style.maxWidth='768px';
    if(path==='/browse')body.style.maxWidth='1280px';
    body.insertAdjacentHTML('beforeend',skeletonBody(path));
    if(!auth&&(chat||topPages.has(path)))shell.append(top);else if(auth)body.style.maxWidth='448px';
    shell.append(body);document.body.append(shell);placeholder=shell;
    for(const el of top.querySelectorAll('*')){if(el.closest('svg')&&!el.matches('svg'))continue;el.dataset.vrcrpShape='';if(!el.children.length&&el.textContent.trim()&&!el.closest('svg'))el.dataset.vrcrpFixedText='true';}
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
      let opacity=1;for(let n=el;n&&n!==placeholder;n=n.parentElement)opacity*=Number(getComputedStyle(n).opacity);layer.opacity=opacity;
      if(el.matches('svg,[data-vrcrp-fixed-text="true"],[data-vrcrp-raster="true"]')){const png=window.__vrcrpPageTemplates?.raster(el);if(png)layer.image=png;else if(!el.querySelector('svg')&&!el.matches('svg')){layer.text=el.textContent;layer.fontSize=parseFloat(style.fontSize)||20;layer.weight=Number(style.fontWeight)||800;layer.ink=rgba(style.color);}}
      if(el.matches('textarea,input')&&el.placeholder){const hint=document.createElement('span');hint.textContent=el.placeholder;const padding=parseFloat(style.paddingLeft)||0;hint.style.cssText=`position:fixed;left:${rect.x+padding}px;top:${rect.y+(parseFloat(style.paddingTop)||0)}px;font:${style.font};color:${getComputedStyle(el,'::placeholder').color};height:${style.lineHeight};white-space:nowrap`;placeholder.append(hint);const png=window.__vrcrpPageTemplates?.raster(hint),r=box(hint);hint.remove();if(png)layers.push({rect:r,clip,fill:[0,0,0,0],image:png});}
      layers.push(layer);if(layers.length>=256)break;
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
      if(!text||!el||el.closest(loadingSelector+' ,h1,h2,[data-vrcrp-page-back],[data-vrcrp-chat-back],[data-vrcrp-back-strip],.chat-header,[data-vrcrp-chat-bar],.app-top,.app-bottom,#vrcrp-system-notifications,script,style'))continue;
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
        requestAnimationFrame(()=>requestAnimationFrame(()=>{if(owner===settleGeneration&&key===entryKey()&&paintState().ready){post({kind:'pagePainted',entryKey:key,path:location.pathname});setTimeout(()=>{if(owner===settleGeneration&&key===entryKey())window.__vrcrpPageTemplates?.remember(location.pathname);},350);}}));
      };paint();
    }
    attempt();
  }
  function announceRoute() {
    generation++;settleGeneration++;
    paintMemo=null;
    document.documentElement.dataset.vrcrpTopLevel=String(topPages.has(location.pathname));
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
    root.dataset.vrcrpTopLevel = String(topPages.has(location.pathname));
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
        card.append(caption,button,description); main.appendChild(card);
      }
    }
    window.__vrcrpPreferencesUpdate?.();
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
  window.__vrcrpThemeChanged=()=>{window.__vrcrpPageTemplates?.clear();announceRoute();updateTopSurface();schedule();};
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
  window.__vrcrpClearNavigation = () => { views.clear();pathViews.clear();window.__vrcrpPageTemplates?.clear(); pendingRestore=null;departedMain=null;departedNodes=[];paintMemo=null;clearPlaceholder(); };
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
  const pushEntry=history.pushState.bind(history);
  // Normalize a cold deep link before React constructs its browser history.
  // It then reads the correct index and never sees an intermediate list.
  if(chatPath(location.pathname)&&index===0){
    const path=location.pathname+location.search,state=history.state||{},idx=Number.isInteger(state.idx)?state.idx:baseIndex;
    const parent={usr:null,key:'vr-matches-'+Math.random().toString(36).slice(2),idx};
    const key=state.key||entryKey();entries=['/matches',path];entryKeys=[parent.key,key];index=1;baseIndex=idx;
    replaceEntry(parent,'','/matches');pushEntry({...state,key,idx:idx+1,...(iosHistory?{vrcrpTrail:trailState(entries,entryKeys,index,baseIndex)}:{})},'',path);
  }
  const editorPath=path=>/^\/profile\/edit(?:\/|$)/.test(path);
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      let nextPath;try{nextPath=new URL(args[2] || location.href,location.href).pathname;}catch{nextPath=location.pathname;}
      const changed=nextPath!==location.pathname;
      const sibling=changed&&editorPath(nextPath)&&editorPath(location.pathname);
      const chatSibling=changed&&chatPath(nextPath)&&chatPath(location.pathname);
      const enteringChat=changed&&chatPath(nextPath)&&!chatSibling;
      if(changed) {
        backQueue=0;forwardIntent=null;
        direction=sibling?'tab':roots.has(nextPath)?(roots.has(location.pathname)?'tab':'pop'):'push';
        willNavigate(nextPath,direction);
      }
      if(enteringChat){
        // Notifications and links from any tab must not attach a conversation
        // to the unrelated page currently on screen. Rebase that entry onto
        // the list without changing React Router's expected history index.
        if(location.pathname!=='/matches'){
          const parent={usr:null,key:'vr-matches-'+Math.random().toString(36).slice(2),idx:history.state?.idx??baseIndex+index};
          replaceEntry(parent,'','/matches');entries[index]='/matches';entryKeys[index]=parent.key;
        }
        args[0]={...(args[0]||{}),idx:(history.state?.idx??baseIndex+index)+1};
      }
      if((sibling||chatSibling)&&args[0]&&typeof args[0]==='object')args[0]={...args[0],idx:history.state?.idx??baseIndex+index};
      const pushes=enteringChat||method==='pushState'&&!sibling&&!chatSibling;
      const nextEntryKey=args[0]?.key||(pushes?'vr-'+Math.random().toString(36).slice(2):entryKeys[index]);
      if(iosHistory&&(args[0]===null||typeof args[0]==='object')){
        const url=new URL(args[2]||location.href,location.href),path=url.pathname+url.search;
        const paths=pushes?entries.slice(0,index+1).concat(path):entries.map((p,i)=>i===index?path:p);
        const keys=pushes?entryKeys.slice(0,index+1).concat(nextEntryKey):entryKeys.map((k,i)=>i===index?String(nextEntryKey):k);
        const base=!pushes&&index===0&&Number.isInteger(args[0]?.idx)?args[0].idx:baseIndex;
        // Add data-free route metadata to the existing write. An extra
        // replaceState on every route hits Safari's write-frequency limit.
        args[0]={...args[0],vrcrpTrail:trailState(paths,keys,pushes?index+1:index,base)};
      }
      const result = sibling||chatSibling?replaceEntry(...args):enteringChat?pushEntry(...args):Reflect.apply(original, this, args);
      const path = location.pathname + location.search;
      if (enteringChat||method === 'pushState'&&!sibling&&!chatSibling) { entries.splice(index + 1);entryKeys.splice(index+1); entries.push(path);entryKeys.push(history.state?.key || nextEntryKey); index++; }
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
  window.visualViewport?.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, { passive: true });
  let snapshotTimer;
  const snapshotSoon=()=>{clearTimeout(snapshotTimer);snapshotTimer=setTimeout(()=>post({kind:'viewUpdated',entryKey:entryKey()}),100);};
  window.addEventListener('scroll',snapshotSoon,{passive:true,capture:true});
  new MutationObserver(records=>{if(records.some(r=>r.target.closest?.('#main') && (r.type!=='attributes' || r.attributeName==='aria-current')))snapshotSoon();}).observe(document,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-current']});
  document.addEventListener('focusin', schedule);
  if(iosHistory&&!history.state?.vrcrpTrail)replaceEntry({...history.state,vrcrpTrail:trailState(entries,entryKeys,index,baseIndex)},'',location.href);
  routePending = true; schedule();
})();
