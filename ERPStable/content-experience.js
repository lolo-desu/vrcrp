(() => {
  'use strict';
  if (window !== window.top || location.origin !== 'https://erp.sex') return;
  const reduce = () => document.documentElement?.dataset.vrcrpReduceMotion === 'true' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const roots = new Set(['/','/discover','/browse','/likes','/likes/sent','/matches','/posts','/me']);
  let lastPath = location.pathname, queued = false;
  let seen = new WeakSet(), initializedPane = null;
  let press=null,pressTimer=0;
  const post=value=>{try{window.webkit?.messageHandlers?.erpNativeApp?.postMessage({...value,entryKey:window.__vrcrpEntryKey?.()});}catch{}};
  function clearPress(){clearTimeout(pressTimer);if(!press)return;press.row.removeAttribute('data-vrcrp-row-pressed');press=null;post({kind:'rowPress',active:false});}
  function rowFor(target){return location.pathname==='/matches'?target.closest?.('#main [data-vrcrp-chat-row]'):null;}
  function startPress(row,event){clearPress();press={row,x:event.clientX,y:event.clientY,started:performance.now()};row.dataset.vrcrpRowPressed='true';post({kind:'rowPress',active:true});}
  function animate(element, frames, duration = 150) {
    if (!element || reduce() || element.getAnimations().length) return;
    element.animate(frames, { duration, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  const compare = (a,b) => {
    if (!!a.pending !== !!b.pending) return a.pending ? 1 : -1;
    const ta = Date.parse(a.createdAt), tb = Date.parse(b.createdAt);
    return Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb ? ta-tb : String(a.createdAt).localeCompare(String(b.createdAt)) || String(a.id).localeCompare(String(b.id));
  };
  function orderMessages(pane) {
    const id = location.pathname.match(/^\/matches\/([^/]+)$/)?.[1];
    if (!id || !pane) return;
    // Locate the site's existing message useState. Use its bound React setter;
    // preserve message objects, server timestamps and the original row handlers.
    const key = Object.keys(pane).find(k => k.startsWith('__reactFiber$'));
    let fiber = key && pane[key];
    for (let i=0; fiber && i<40; i++,fiber=fiber.return) {
      let hook=fiber.memoizedState;
      for(let n=0; hook && n<80; n++,hook=hook.next) {
        const data=hook.memoizedState;
        if(!Array.isArray(data)||!data.length||data.length>5000||!data.every(m=>m&&typeof m.id==='string'&&m.matchId===id&&typeof m.createdAt==='string'&&typeof m.senderId==='string'))continue;
        if(typeof hook.queue?.dispatch!=='function')continue;
        if(data.some((m,j)=>j>0&&compare(data[j-1],m)>0))hook.queue.dispatch(current=>{
          if(!Array.isArray(current)||!current.every(m=>m?.matchId===id))return current;
          return current.some((m,j)=>j>0&&compare(current[j-1],m)>0)?[...current].sort(compare):current;
        });
        return;
      }
    }
  }
  function update() {
    queued=false;
    const path=location.pathname, main=document.getElementById('main');
    if(!document.getElementById('vrcrp-row-feedback')&&document.head){
      const style=document.createElement('style');style.id='vrcrp-row-feedback';style.textContent=`
        [data-vrcrp-chat-row]{background-color:transparent!important;-webkit-tap-highlight-color:transparent;transition:background-color 100ms ease-out!important}
        [data-vrcrp-chat-row][data-vrcrp-row-pressed]{background-color:rgb(var(--surface2,var(--surface)))!important;transition:none!important}
      `;document.head.appendChild(style);
    }
    if(path!==lastPath){clearPress();seen=new WeakSet();initializedPane=null;if(roots.has(path))animate(main,[{opacity:.82},{opacity:1}]);lastPath=path;}
    if(press&&!press.row.isConnected)clearPress();
    if(path==='/matches')for(const row of main?.querySelectorAll('li > a[href^="/matches/"]')||[])row.dataset.vrcrpChatRow='true';
    const pane=document.querySelector('#main .card.relative.min-h-0.flex-1.overflow-y-auto')||document.querySelector('#main .messages');
    orderMessages(pane);
    if(pane){
      for(const bubble of pane.querySelectorAll('.bubble-me,.bubble-them'))if(!seen.has(bubble)){
        seen.add(bubble);if(initializedPane===pane)animate(bubble,[{opacity:.7,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],170);
      }
      initializedPane=pane;
    }
    for(const dialog of document.querySelectorAll('[role="dialog"],dialog[open]'))if(!seen.has(dialog)){seen.add(dialog);animate(dialog,[{opacity:.85},{opacity:1}],140);}
  }
  function schedule(){if(!queued){queued=true;queueMicrotask(update);}}
  new MutationObserver(schedule).observe(document,{childList:true,subtree:true});
  window.addEventListener('popstate',schedule);
  document.addEventListener('pointerdown',event=>{
    const row=rowFor(event.target);if(row&&(event.isPrimary!==false)&&event.button===0)startPress(row,event);
    const button=event.target.closest?.('#main button,#main [role="button"]');
    if(button&&!button.matches(':disabled,[aria-disabled="true"]')&&!button.closest('.stage'))animate(button,[{filter:'brightness(.92)'},{filter:'brightness(1)'}],160);
  },{passive:true,capture:true});
  document.addEventListener('pointermove',event=>{if(press&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>8)clearPress();},{passive:true,capture:true});
  document.addEventListener('pointerup',()=>{if(press)pressTimer=setTimeout(clearPress,Math.max(0,110-(performance.now()-press.started)));},{passive:true,capture:true});
  document.addEventListener('pointercancel',clearPress,{passive:true,capture:true});
  document.addEventListener('scroll',clearPress,{passive:true,capture:true});
  document.addEventListener('click',event=>{const row=rowFor(event.target);if(row&&!press&&event.detail===0){startPress(row,event);pressTimer=setTimeout(clearPress,110);}},{passive:true,capture:true});
  window.__vrcrpClearRowPress=clearPress;
  window.addEventListener('blur',clearPress);window.addEventListener('pagehide',clearPress);
  schedule();
})();
