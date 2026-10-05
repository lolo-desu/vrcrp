(() => {
  'use strict';
  if (window !== window.top || location.origin !== 'https://erp.sex') return;
  let user = '', pins = [], press = null, timer = 0, queued = false, menu = null, suppressed = null;
  let serverMode=false,migrating=false;
  const attempted=new Set();
  const idOK = id => typeof id === 'string' && /^[\w-]{1,120}$/.test(id);
  const idOf = row => row?.getAttribute('href')?.match(/^\/matches\/([\w-]{1,120})$/)?.[1];
  const rowOf = target => location.pathname === '/matches' ? target?.closest?.('#main li > a[href^="/matches/"]') : null;
  const rowMenu=row=>row?.parentElement?.querySelector('button[aria-haspopup="menu"]');
  function persist(){try{if(user)localStorage.setItem('vrcrp.chatPins.v1.'+user,JSON.stringify(pins));}catch{}}
  function close() { menu?.remove(); menu = null; }
  function cancel() { clearTimeout(timer); timer = 0; press = null; }
  function session(id) {
    if (id === user) return;
    user = idOK(id) ? id : ''; pins = []; cancel(); close(); suppressed = null;serverMode=false;migrating=false;attempted.clear();
    try { const data = JSON.parse(localStorage.getItem('vrcrp.chatPins.v1.'+user) || '[]'); if (user && Array.isArray(data)) pins = [...new Set(data.filter(idOK))].slice(0,100); } catch {}
    schedule();
  }
  async function toggle(id) {
    if (!user || !idOK(id)) return;
    if(serverMode){const match=window.__vrcrpSiteCache?.chatMatch(id);if(match)await window.__vrcrpSiteCache.setChatPinned(id,!match.pinned);close();return;}
    pins = pins.includes(id) ? pins.filter(p => p !== id) : [id, ...pins].slice(0,100);
    persist();
    close(); schedule();
  }
  function open(row) {
    const id = idOf(row); if (!user || !idOK(id) || !row.isConnected) return;
    cancel(); window.__vrcrpClearRowPress?.('longpress');
    suppressed = {id, until:performance.now()+1400};
    close();
    const original=rowMenu(row);
    if(original){if(original.getAttribute('aria-expanded')!=='true')original.click();try{window.webkit?.messageHandlers?.erpNativeApp?.postMessage({kind:'haptic',style:'light'});}catch{}return;}
    menu = document.createElement('div'); menu.id = 'vrcrp-pin-menu'; menu.setAttribute('role','dialog'); menu.setAttribute('aria-modal','true'); menu.setAttribute('aria-label','聊天选项');
    menu.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgb(0 0 0 / .25);display:flex;align-items:flex-end;padding:12px 12px max(12px,env(safe-area-inset-bottom));';
    const panel = document.createElement('div'); panel.className = 'card w-full overflow-hidden';
    const action = document.createElement('button'); action.type = 'button'; action.className = 'w-full border-b border-border p-4 text-center font-semibold text-primary'; action.textContent = pins.includes(id) ? '取消置顶' : '置顶聊天';
    action.addEventListener('click', () => toggle(id));
    const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.className = 'w-full p-4 text-center font-semibold'; dismiss.textContent = '取消'; dismiss.addEventListener('click', close);
    panel.append(action, dismiss); menu.append(panel); menu.addEventListener('click', event => { if (event.target === menu) close(); }); document.body.append(menu);
    try { window.webkit?.messageHandlers?.erpNativeApp?.postMessage({kind:'haptic',style:'light'}); } catch {}
    action.focus({preventScroll:true});
  }
  function update() {
    queued = false;
    session(window.__vrcrpSiteCache?.account?.() || '');
    if (!document.head) return;
    if (!document.getElementById('vrcrp-pin-style')) {
      const style = document.createElement('style'); style.id = 'vrcrp-pin-style';
      style.textContent = `#main ul[data-vrcrp-pin-list]{display:flex;flex-direction:column}
        #main ul[data-vrcrp-pin-list]>li{border-top:0!important;border-bottom:1px solid rgb(var(--border))}
        #main ul[data-vrcrp-pin-list]>li[data-vrcrp-pin-last]{border-bottom:0}
        [data-vrcrp-chat-pinned]{position:relative}
        [data-vrcrp-chat-pinned]::after{content:'置顶';position:absolute;left:12px;bottom:3px;font-size:9px;line-height:12px;color:rgb(var(--primary));pointer-events:none}`;
      document.head.append(style);
    }
    if (location.pathname !== '/matches') { close(); cancel(); return; }
    const rows=[...document.querySelectorAll('#main li > a[href^="/matches/"]')];
    if(rows.some(rowMenu))serverMode=true;
    if(serverMode){
      // The website now owns pinning, sorting, grouping and menus. Retain the
      // long-press shortcut without a second local order or duplicate badge.
      for(const row of rows){const li=row.parentElement,list=li.parentElement;if(li.style.order)li.style.order='';row.removeAttribute('data-vrcrp-chat-pinned');li.removeAttribute('data-vrcrp-pin-last');list.removeAttribute('data-vrcrp-pin-list');}
      migrate(rows);return;
    }
    const lists = new Map();
    for (const row of rows) {
      const index = pins.indexOf(idOf(row)), li = row.parentElement, list = li.parentElement;
      const order = index < 0 ? '' : String(index-pins.length);
      if (li.style.order !== order) li.style.order = order;
      if (index >= 0 && user) row.setAttribute('data-vrcrp-chat-pinned','true'); else row.removeAttribute('data-vrcrp-chat-pinned');
      if (!lists.has(list)) lists.set(list, []); lists.get(list).push({li,order:index<0?0:index-pins.length});
    }
    for (const [list, rows] of lists) {
      list.dataset.vrcrpPinList = 'true';
      rows.sort((a,b) => a.order-b.order);
      for (const {li} of rows) li.removeAttribute('data-vrcrp-pin-last');
      rows.at(-1)?.li.setAttribute('data-vrcrp-pin-last','true');
    }
  }
  async function migrate(rows){
    if(migrating||!user||!window.__vrcrpSiteCache?.setChatPinned)return;
    const owner=user,ids=rows.map(idOf).filter(id=>pins.includes(id)&&!attempted.has(id)&&window.__vrcrpSiteCache.chatMatch(id));
    if(!ids.length)return;migrating=true;
    try{for(const id of ids){if(owner!==user)break;attempted.add(id);const match=window.__vrcrpSiteCache.chatMatch(id);if(!match)continue;
      const done=match.pinned||await window.__vrcrpSiteCache.setChatPinned(id,true);
      if(owner!==user)break;if(done){pins=pins.filter(p=>p!==id);persist();}
    }}finally{if(owner===user)migrating=false;}
  }
  function schedule() { if (!queued) { queued = true; queueMicrotask(update); } }
  document.addEventListener('pointerdown', event => {
    cancel(); const row = rowOf(event.target);
    if (!row || !user || event.button !== 0 || event.isPrimary === false) return;
    press = {row,x:event.clientX,y:event.clientY}; timer = setTimeout(() => open(row), 500);
  }, {capture:true,passive:true});
  document.addEventListener('pointermove', event => { if (press && Math.hypot(event.clientX-press.x,event.clientY-press.y)>8) cancel(); }, {capture:true,passive:true});
  for (const name of ['pointerup','pointercancel','scroll']) document.addEventListener(name,cancel,{capture:true,passive:true});
  document.addEventListener('click', event => {
    if (suppressed && performance.now()<suppressed.until && idOf(rowOf(event.target))===suppressed.id) { event.preventDefault(); event.stopImmediatePropagation(); suppressed = null; }
  }, true);
  document.addEventListener('contextmenu', event => { const row=rowOf(event.target); if(row && user) { event.preventDefault(); if(!menu) open(row); } }, true);
  document.addEventListener('keydown', event => { if(event.key==='Escape')close(); });
  new MutationObserver(schedule).observe(document,{childList:true,subtree:true});
  window.addEventListener('popstate',schedule); window.addEventListener('blur',cancel); window.addEventListener('pagehide',()=>{cancel();close();});
  window.__vrcrpChatPins = {session,toggle,ids:()=>serverMode?[...new Set([...document.querySelectorAll('#main li > a[href^="/matches/"]')].map(idOf).filter(id=>window.__vrcrpSiteCache?.chatMatch(id)?.pinned))]:[...pins]};
  schedule();
})();
