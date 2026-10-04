(() => {
  'use strict';
  if (window!==window.top || location.origin!=='https://erp.sex') return;
  // The site already has an installed-app branch. Use that branch rather than
  // removing arbitrary translated text or intercepting its installation flow.
  try { Object.defineProperty(navigator,'standalone',{get:()=>true,configurable:true}); } catch {}
  const post=value=>{try{window.webkit?.messageHandlers?.erpNativeApp?.postMessage({...value,entryKey:window.__vrcrpEntryKey?.()||history.state?.key});}catch{}};
  const editing=()=>/^\/profile\/edit(?:\/|$)/.test(location.pathname);
  const chat=()=>/^\/matches\/[^/]+\/?$/.test(location.pathname);
  const detail=()=>window.__vrcrpIsTopPage&&!window.__vrcrpIsTopPage(location.pathname)&&!chat()&&!['/login','/register'].includes(location.pathname);
  let unread=0,queued=false,overlay=null,lastOverlay=false,lastHeader='';
  let sheet=null,sheetGesture=null,sheetMotion=null,suppressedClick=null;
  const visible=el=>{const r=el.getBoundingClientRect();return el.isConnected&&r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';};
  const saveStyle=(el,names)=>names.map(name=>[el,name,el.style.getPropertyValue(name),el.style.getPropertyPriority(name)]);
  const restoreStyle=saved=>{for(const [el,name,value,priority] of saved)if(value)el.style.setProperty(name,value,priority);else el.style.removeProperty(name);};
  function restoreSheet(state){if(!state)return;clearTimeout(state.timer);restoreStyle(state.saved);}
  function refreshSheet(){
    const panels=[...document.querySelectorAll('[data-dialog] .dialog-panel[role="dialog"]')].filter(visible);
    const panel=panels.at(-1),host=panel?.closest('[data-dialog]');
    const header=panel?.firstElementChild;
    const close=header&&!header.hasAttribute('data-dialog-body')?header.querySelector(':scope > button[aria-label]'):null;
    const next=panel&&close&&!panel.hasAttribute('data-vrcrp-explore-profile')&&innerWidth<640&&getComputedStyle(host).alignItems==='flex-end'?panel:null;
    if(next===sheet)return;
    restoreSheet(sheetGesture);restoreSheet(sheetMotion);sheetGesture=null;sheetMotion=null;
    sheet?.removeEventListener('touchmove',moveSheetTouches,true);
    sheet?.removeAttribute('data-vrcrp-dismissible-sheet');sheet=next;
    if(sheet){sheet.dataset.vrcrpDismissibleSheet='true';sheet.addEventListener('touchmove',moveSheetTouches,{capture:true,passive:false});}
    window.__vrcrpRefreshGestureZones?.();
  }
  function blockedSheetTarget(target,panel,x,y){
    if(target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="slider"],[role="scrollbar"],video[controls],canvas,.stage,.cursor-grab'))return true;
    const selection=getSelection();
    if(selection&&!selection.isCollapsed)for(let i=0;i<selection.rangeCount;i++)for(const r of selection.getRangeAt(i).getClientRects())if(x>=r.left-12&&x<=r.right+12&&y>=r.top-12&&y<=r.bottom+12)return true;
    for(let el=target;el&&el!==panel;el=el.parentElement){
      const style=getComputedStyle(el);
      if(['auto','scroll'].includes(style.overflowX)&&el.scrollWidth>el.clientWidth+4)return true;
      const key=Object.keys(el).find(k=>k.startsWith('__reactProps$')),props=key&&el[key];
      if(el.draggable&&!el.matches('img,a')||typeof props?.onPointerMove==='function'||typeof props?.onTouchMove==='function')return true;
      const fiberKey=Object.keys(el).find(k=>k.startsWith('__reactFiber$'));let fiber=fiberKey&&el[fiberKey];
      for(let i=0;fiber&&i<18;i++,fiber=fiber.return){
        const p=fiber.memoizedProps;if((p?.drag===true||p?.drag==='x'||p?.drag==='y')&&p.dragListener!==false)return true;
        if(fiber!==el[fiberKey]&&typeof fiber.type==='string')break;
      }
    }
    return false;
  }
  function beginSheet(target,x,y,id,type){
    suppressedClick=null;refreshSheet();if(!sheet||sheetMotion?.closing||sheetGesture||!sheet.contains(target))return;
    if(blockedSheetTarget(target,sheet,x,y))return;
    restoreSheet(sheetMotion);sheetMotion=null;
    const host=sheet.closest('[data-dialog]'),backdrop=[...host.children].find(el=>el!==sheet&&el.getAttribute('aria-hidden')==='true');
    let atTop=true;for(let el=target;el&&el!==sheet;el=el.parentElement)if(['auto','scroll'].includes(getComputedStyle(el).overflowY)&&el.scrollTop>1)atTop=false;
    const saved=saveStyle(sheet,['transform','transition','will-change']);if(backdrop)saved.push(...saveStyle(backdrop,['opacity','transition']));
    sheetGesture={panel:sheet,host,backdrop,close:sheet.firstElementChild.querySelector(':scope > button[aria-label]'),saved,x,y,lastX:x,lastY:y,time:performance.now(),velocity:0,distance:0,axis:null,atTop,id,type,path:location.pathname};
  }
  function drawSheet(state,distance){
    const dimension=state.axis==='x'?innerWidth:state.panel.getBoundingClientRect().height;
    state.panel.style.setProperty('transform',state.axis==='x'?`translate3d(${distance}px,0,0)`:`translate3d(0,${distance}px,0)`,'important');
    state.panel.style.setProperty('will-change','transform');
    if(state.backdrop)state.backdrop.style.setProperty('opacity',String(Math.max(0,1-distance/Math.max(1,dimension))),'important');
  }
  function moveSheet(event,x,y,type){
    const state=sheetGesture;if(!state||state.type!==type)return;
    if(!state.panel.isConnected||state.path!==location.pathname){restoreSheet(state);sheetGesture=null;return;}
    const dx=x-state.x,dy=y-state.y;
    if(!state.axis){
      if(Math.hypot(dx,dy)<8)return;
      if(dx>Math.abs(dy)*1.15)state.axis='x';
      else if(dy>Math.abs(dx)*1.15&&state.atTop)state.axis='y';
      else{sheetGesture=null;return;}
      state.panel.style.setProperty('transition','none','important');
      state.backdrop?.style.setProperty('transition','none','important');
    }
    if(!event.cancelable){restoreSheet(state);sheetGesture=null;return;}
    event.preventDefault();
    const now=performance.now(),delta=state.axis==='x'?x-state.lastX:y-state.lastY;
    state.velocity=delta/Math.max(1,now-state.time)*1000;state.time=now;state.lastX=x;state.lastY=y;
    state.distance=Math.max(0,state.axis==='x'?dx:dy);drawSheet(state,state.distance);
  }
  function endSheet(x,y,type,cancelled){
    const state=sheetGesture;if(!state||state.type!==type)return;sheetGesture=null;
    if(!state.axis){restoreSheet(state);return;}
    if(performance.now()-state.time>90)state.velocity=0;
    const dimension=state.axis==='x'?innerWidth:state.panel.getBoundingClientRect().height;
    const commit=!cancelled&&state.velocity>-120&&state.distance>12&&(state.distance+state.velocity*.16>dimension*.3||state.velocity>700&&state.distance>20);
    const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:180;
    state.closing=commit;sheetMotion=state;suppressedClick={x,y,until:performance.now()+450};
    state.panel.style.setProperty('transition',`transform ${duration}ms cubic-bezier(.2,.8,.2,1)`,'important');
    state.backdrop?.style.setProperty('transition',`opacity ${duration}ms ease-out`,'important');
    drawSheet(state,commit?dimension+12:0);
    state.timer=setTimeout(()=>{
      if(sheetMotion!==state)return;
      // Close the original modal, never pop the route behind it. Keep the
      // exiting panel offscreen until React removes it to avoid a final flash.
      if(commit&&state.panel.isConnected&&sheet===state.panel){
        state.close.click();refreshSheet();if(sheetMotion!==state)return;
        state.timer=setTimeout(()=>{restoreSheet(state);sheetMotion=null;refreshSheet();},220);
      }else{restoreSheet(state);sheetMotion=null;refreshSheet();}
    },duration);
  }
  document.addEventListener('touchstart',event=>{
    if(event.touches.length!==1){restoreSheet(sheetGesture);sheetGesture=null;return;}
    const t=event.touches[0];beginSheet(event.target,t.clientX,t.clientY,t.identifier,'touch');
  },{capture:true,passive:true});
  function moveSheetTouches(event){
    if(event.touches.length!==1){restoreSheet(sheetGesture);sheetGesture=null;return;}
    const t=[...event.touches].find(t=>t.identifier===sheetGesture?.id);if(t)moveSheet(event,t.clientX,t.clientY,'touch');
  }
  for(const kind of ['touchend','touchcancel'])document.addEventListener(kind,event=>{const t=[...event.changedTouches].find(t=>t.identifier===sheetGesture?.id);if(t)endSheet(t.clientX,t.clientY,'touch',kind==='touchcancel');},{capture:true,passive:true});
  document.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'&&event.button===0)beginSheet(event.target,event.clientX,event.clientY,event.pointerId,'mouse');},{capture:true,passive:true});
  document.addEventListener('pointermove',event=>{if(event.pointerType==='mouse')moveSheet(event,event.clientX,event.clientY,'mouse');},{capture:true,passive:false});
  for(const kind of ['pointerup','pointercancel'])document.addEventListener(kind,event=>{if(event.pointerType==='mouse')endSheet(event.clientX,event.clientY,'mouse',kind==='pointercancel');},{capture:true,passive:true});
  document.addEventListener('click',event=>{if(event.isTrusted&&suppressedClick&&performance.now()<suppressedClick.until&&Math.hypot(event.clientX-suppressedClick.x,event.clientY-suppressedClick.y)<30){suppressedClick=null;event.preventDefault();event.stopImmediatePropagation();}},true);
  window.addEventListener('pagehide',()=>{restoreSheet(sheetGesture);restoreSheet(sheetMotion);sheetGesture=null;sheetMotion=null;});
  window.addEventListener('blur',()=>{restoreSheet(sheetGesture);restoreSheet(sheetMotion);sheetGesture=null;sheetMotion=null;});
  const backIcon='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
  const css=`
    html[data-vrcrp-top-level="false"] .app-top{display:none!important}
    html[data-vrcrp-profile-open="true"] .app-top{visibility:hidden!important}
    html[data-vrcrp-chat-toolbar="true"] .app-top{display:none!important}
    html[data-vrcrp-chat-toolbar="true"] #main{padding-top:0!important}
    [data-vrcrp-chat-bar]{position:sticky!important;top:0;z-index:45;flex-shrink:0;background:rgb(var(--surface))!important;border-radius:0!important;border-top:0!important;border-left:0!important;border-right:0!important;min-height:56px}
    @media(max-width:1023px){[data-vrcrp-chat-bar]{box-sizing:border-box!important;max-width:none!important;width:calc(100% + var(--vrcrp-chat-bleed-left,0px) + var(--vrcrp-chat-bleed-right,0px))!important;margin-left:calc(-1 * var(--vrcrp-chat-bleed-left,0px))!important;margin-right:calc(-1 * var(--vrcrp-chat-bleed-right,0px))!important;padding-left:calc(8px + var(--vrcrp-chat-bleed-left,0px))!important;padding-right:calc(8px + var(--vrcrp-chat-bleed-right,0px))!important}}
    [data-vrcrp-chat-back]{display:flex!important;align-items:center;gap:3px;min-width:40px;min-height:44px;flex-shrink:0}
    [data-vrcrp-unread]{display:inline-flex;justify-content:center;align-items:center;min-width:20px;height:20px;padding:0 4px;border-radius:10px;background:rgb(var(--primary));color:rgb(var(--fg));font:700 11px system-ui;border:1px solid currentColor}
    [data-vrcrp-unread][hidden]{display:none!important}
    [data-vrcrp-back-strip]{display:flex;align-items:center;gap:8px;min-height:44px;margin-bottom:8px;color:rgb(var(--fg));background:rgb(var(--surface));border-radius:12px;padding:0 8px}
    button[data-vrcrp-page-back]{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;background:transparent;color:inherit;border:0;border-radius:10px;touch-action:manipulation}
    #main[data-vrcrp-pulling]{transform:translateY(var(--vrcrp-pull-space,0px))}
    [data-vrcrp-install]{display:none!important}
    @keyframes vrcrp-profile-push{from{transform:translate3d(100%,0,0)}to{transform:translate3d(0,0,0)}}
    [data-vrcrp-explore-profile="true"]{animation:vrcrp-profile-push 240ms cubic-bezier(.2,.8,.2,1)}
    @media(prefers-reduced-motion:reduce){[data-vrcrp-explore-profile="true"]{animation:none}}
  `;
  function refreshProfileOverlay(){
    const main=document.getElementById('main');
    let next=['/discover','/browse','/visitors','/likes','/likes/sent'].includes(location.pathname)?main?.querySelector('.fixed.inset-0.overflow-y-auto.overscroll-contain'):null;
    if(next&&!next.querySelector('.sticky button'))next=null;
    if(!next&&location.pathname==='/discover'&&new URL(location.href).searchParams.has('u'))next=document.querySelector('[data-dialog] .dialog-panel[role="dialog"]');
    overlay=next;
    if(overlay){
      overlay.dataset.vrcrpProfileOverlay='true';
      if(location.pathname==='/discover'&&!overlay.hasAttribute('data-vrcrp-explore-profile'))overlay.dataset.vrcrpExploreProfile='true';
    }
    for(const el of document.querySelectorAll('[data-vrcrp-profile-overlay]'))if(el!==overlay){el.removeAttribute('data-vrcrp-profile-overlay');el.removeAttribute('data-vrcrp-explore-profile');}
    // A fixed profile already covers the header. Hide it visually without
    // removing its layout space, which would move the cached list behind it.
    document.documentElement.dataset.vrcrpProfileOpen=String(!!overlay);
    const shown=!!overlay;if(shown!==lastOverlay){lastOverlay=shown;post({kind:'profileOverlay',visible:shown});}
  }
  function chatHeader(main){
    if(!main?.querySelector('textarea,.messages,.card.relative.min-h-0.flex-1.overflow-y-auto'))return null;
    const link=main?.querySelector('a[href^="/u/"]');
    const card=link?.closest('.card');
    return card?.querySelector('button')&&card.contains(link)?card:main?.querySelector('.chat-header');
  }
  function updateUnread(){
    const button=document.querySelector('[data-vrcrp-chat-back]');if(!button)return;
    let badge=button.querySelector('[data-vrcrp-unread]');
    if(!badge){badge=document.createElement('span');badge.dataset.vrcrpUnread='true';button.appendChild(badge);}
    const text=unread>99?'99+':String(unread);if(badge.textContent!==text)badge.textContent=text;badge.hidden=unread===0;
    const title=button.dataset.vrcrpBackLabel||button.getAttribute('aria-label')||'返回';
    button.dataset.vrcrpBackLabel=title;const label=unread?`${title}，${unread} 条未读消息`:title;if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
  }
  window.__vrcrpChatUnread=count=>{if(Number.isSafeInteger(count)&&count>=0&&count<=100000){unread=count;updateUnread();}};
  function pageBack(main){
    const heading=main?.querySelector('h1');if(!heading)return;
    const group=heading.closest('.flex.items-center')||heading.parentElement.parentElement;
    const original=[...group.querySelectorAll('button')].find(b=>/^(返回|返回上一页|上一頁|返回上頁|back|go back)$/i.test((b.getAttribute('aria-label')||b.title||'').trim()));
    if(original){original.dataset.vrcrpPageBack='true';return;}
    if(!detail())return;
    if(main.querySelector('[data-vrcrp-page-back]'))return;
    const button=document.createElement('button');button.type='button';button.dataset.vrcrpPageBack='true';button.dataset.vrcrpInjectedBack='true';button.setAttribute('aria-label','返回');button.innerHTML=backIcon;
    button.addEventListener('click',()=>{if(!window.__vrcrpBack?.())window.__vrcrpOpenRoot?.('/me');});
    if(group.classList.contains('flex')&&group.classList.contains('items-center'))group.prepend(button);
    else{const strip=document.createElement('div');strip.dataset.vrcrpBackStrip='true';const label=document.createElement('span');label.textContent=heading.textContent.trim();strip.append(button,label);main.prepend(strip);}
  }
  function update(){
    queued=false;const root=document.documentElement;if(!root||!document.head)return;
    if(!document.getElementById('vrcrp-page-surfaces')){const style=document.createElement('style');style.id='vrcrp-page-surfaces';style.textContent=css;document.head.appendChild(style);}
    root.dataset.vrcrpChat=String(chat());const main=document.getElementById('main');
    if(window.__vrcrpIsTopPage)root.dataset.vrcrpTopLevel=String(window.__vrcrpIsTopPage(location.pathname));
    refreshProfileOverlay();
    if(!detail()){
      for(const el of document.querySelectorAll('[data-vrcrp-back-strip],[data-vrcrp-injected-back]'))el.remove();
    }else for(const strip of document.querySelectorAll('[data-vrcrp-back-strip]')){const label=strip.querySelector('span');const title=main?.querySelector('h1')?.textContent.trim();if(label&&title&&label.textContent!==title)label.textContent=title;}
    const header=overlay?.querySelector('.sticky,[data-dialog] .dialog-panel > :first-child')||(chat()?chatHeader(main):root.dataset.vrcrpTopLevel==='true'?document.querySelector('.app-top'):main?.querySelector('[data-vrcrp-back-strip],.page-heading,.heading'));
    for(const el of document.querySelectorAll('[data-vrcrp-chat-bar]'))if(!chat()||el!==header){el.removeAttribute('data-vrcrp-chat-bar');el.style.removeProperty('--vrcrp-chat-bleed-left');el.style.removeProperty('--vrcrp-chat-bleed-right');}
    for(const button of document.querySelectorAll('[data-vrcrp-chat-back]'))if(!chat()||!header?.contains(button)){
      const label=button.dataset.vrcrpBackLabel;if(label&&button.getAttribute('aria-label')?.includes('条未读消息'))button.setAttribute('aria-label',label);
      button.removeAttribute('data-vrcrp-chat-back');button.removeAttribute('data-vrcrp-back-label');button.querySelector('[data-vrcrp-unread]')?.remove();
    }
    root.dataset.vrcrpChatToolbar=String(chat()&&!!header);
    if(chat()&&header){
      header.dataset.vrcrpChatBar='true';
      const parent=header.parentElement,rect=parent.getBoundingClientRect(),style=getComputedStyle(parent),width=document.documentElement.clientWidth||innerWidth;
      header.style.setProperty('--vrcrp-chat-bleed-left',`${Math.max(0,rect.left+parseFloat(style.paddingLeft||0))}px`);
      header.style.setProperty('--vrcrp-chat-bleed-right',`${Math.max(0,width-rect.right+parseFloat(style.paddingRight||0))}px`);
      const back=header.querySelector('button');if(back){back.dataset.vrcrpChatBack='true';updateUnread();}
    }
    pageBack(main);
    refreshSheet();
    {const r=header?.getBoundingClientRect(),style=header?getComputedStyle(header):null;const raw=style?.backgroundColor&&style.backgroundColor!=='rgba(0, 0, 0, 0)'?style.backgroundColor:'rgb('+(getComputedStyle(root).getPropertyValue(chat()?'--surface':'--bg').trim()||'255 255 255')+')';const values=raw.match(/[\d.]+/g)?.map(Number)||[255,255,255,1];const geometry={kind:'pageHeader',height:Math.max(0,r?.height||(chat()?56:0)),color:[values[0]/255,values[1]/255,values[2]/255,values[3]??1]};const fp=(window.__vrcrpEntryKey?.()||history.state?.key||'')+JSON.stringify(geometry);if(fp!==lastHeader){lastHeader=fp;post(geometry);}}
    for(const button of document.querySelectorAll('button,[role="button"],a')){
      if(button.closest('[data-vrcrp-install]'))continue;
      const title=(button.getAttribute('aria-label')||button.textContent||'').trim();
      if(title.length<80&&/^(?:添加|加入|新增|加到).*(?:主屏幕|主螢幕|主界面|主屏幕画面|主画面|主畫面|桌面)|^(?:add to home screen|install app|安装应用|安裝應用)$/i.test(title))button.dataset.vrcrpInstall='true';
    }
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(update);}}
  window.__vrcrpRefreshSurface=update;
  window.__vrcrpCloseProfileOverlay=()=>{
    update();const close=overlay?.querySelector('.sticky button')||overlay?.firstElementChild?.querySelector(':scope > button[aria-label]');if(!close)return false;
    document.activeElement?.blur?.();close.click();queueMicrotask(update);
    const key=window.__vrcrpEntryKey?.();requestAnimationFrame(()=>requestAnimationFrame(()=>{if(key===window.__vrcrpEntryKey?.())post({kind:'pagePainted'});}));return true;
  };
  window.__vrcrpPageBack=()=>{
    update();
    if(overlay)return window.__vrcrpCloseProfileOverlay();
    if(window.__vrcrpBack?.())return true;
    const button=document.querySelector('#main [data-vrcrp-page-back]');
    if(button){document.activeElement?.blur?.();button.click();return true;}return false;
  };
  window.__vrcrpPullSurface=space=>{const main=document.getElementById('main');if(!main)return;const amount=Math.max(0,Math.min(72,Number(space)||0));main.style.transition=amount||matchMedia('(prefers-reduced-motion: reduce)').matches?'none':'transform 160ms ease-out';main.style.setProperty('--vrcrp-pull-space',`${amount}px`);if(amount)main.dataset.vrcrpPulling='true';else main.removeAttribute('data-vrcrp-pulling');};
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-vrcrp-chat-back],[data-vrcrp-page-back]')&&window.__vrcrpBack?.()){event.preventDefault();event.stopImmediatePropagation();}},true);
  new MutationObserver(records=>{if(records.some(r=>r.type==='childList')){refreshProfileOverlay();refreshSheet();}if(records.some(r=>r.type!=='attributes'||!r.attributeName.startsWith('data-vrcrp')))schedule();}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-label','data-vrcrp-chat'],characterData:true});
  window.addEventListener('popstate',schedule);window.addEventListener('resize',schedule);schedule();
})();
