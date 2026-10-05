(() => {
  'use strict';
  if (window !== window.top || location.origin !== 'https://erp.sex' || !window.VRBridge) return;
  window.__vrcrpPlatform='android';
  const send = channel => ({postMessage: body => VRBridge.postMessage(JSON.stringify({channel,body}))});
  window.webkit={messageHandlers:{erpNativeApp:send('app'),erpNativeNotifications:send('notifications')}};
  Object.defineProperty(navigator,'standalone',{get:()=>true,configurable:true});
  // Preserve browser text selection; return consumes an open sheet first.
  window.__vrcrpAndroidBack=()=>{
    document.activeElement?.blur?.();
    const dialogs=[...document.querySelectorAll('[role="dialog"],dialog[open],[data-vrcrp-profile-overlay]')].filter(e=>e.getBoundingClientRect().height&&getComputedStyle(e).visibility!=='hidden');
    const dialog=dialogs.at(-1);
    if(dialog){
      const buttons=[...dialog.querySelectorAll('button')],close=buttons.find(b=>/^(关闭|關閉|取消|close|cancel)$/i.test(b.getAttribute('aria-label')||b.textContent));
      if(close){close.click();return true;}
      const overlay=dialog.parentElement;overlay?.click();return true;
    }
    return window.__vrcrpBack?.()===true;
  };
  const roots=new Set(['/','/discover','/browse','/likes','/likes/sent','/likes/secret','/matches','/posts','/me']);
  let previous=location.pathname,mode='none';
  const observe=()=>{
    const path=location.pathname;
    if(path!==previous){
      const main=document.getElementById('main');
      if(main&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!roots.has(path))main.animate([{opacity:.7,transform:'translateX(14px)'},{opacity:1,transform:'none'}],{duration:180,easing:'cubic-bezier(.2,.8,.2,1)'});
      previous=path;
    }
    const note=document.querySelector('#vrcrp-background-switch')?.closest('section')?.querySelector('.mt-2.text-sm.text-muted');
    const text='离开 App 后通过前台服务接收消息，系统会显示常驻通知；可能增加耗电。关闭开关或划掉 App 后停止。';
    if(note&&note.textContent!==text)note.textContent=text;
  };
  new MutationObserver(observe).observe(document,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',observe);window.addEventListener('popstate',observe);
})();
(() => {
  if(window!==window.top||location.origin!=='https://erp.sex')return;
  const allowed=new Set(['/matches','/likes','/likes/sent','/likes/secret','/visitors','/notifications','/posts','/me','/browse']);
  let pull=null,hint=null,busy=false;
  function clear(){hint?.remove();hint=null;pull=null;}
  document.addEventListener('touchstart',event=>{
    clear();if(busy||!allowed.has(location.pathname)||scrollY>1||event.touches.length!==1)return;
    const target=event.target;if(target.closest('input,textarea,button,.stage,[role="dialog"],[data-vrcrp-profile-overlay]'))return;
    for(let e=target;e&&e!==document.body;e=e.parentElement){const s=getComputedStyle(e);if(['auto','scroll'].includes(s.overflowY)&&e.scrollTop>1)return;if(['auto','scroll'].includes(s.overflowX)&&e.scrollWidth>e.clientWidth+4)return;}
    pull={x:event.touches[0].clientX,y:event.touches[0].clientY,distance:0,path:location.pathname};
  },{passive:true});
  document.addEventListener('touchmove',event=>{
    if(!pull)return;const point=event.touches[0],dx=point.clientX-pull.x,dy=point.clientY-pull.y;
    if(dy<0||Math.abs(dx)>Math.abs(dy)*.7){clear();return;}
    pull.distance=Math.min(110,dy*.5);if(pull.distance<12)return;
    if(!hint){hint=document.createElement('div');hint.style.cssText='position:fixed;left:50%;transform:translateX(-50%);z-index:80;pointer-events:none;border:1px solid rgb(var(--border));border-radius:999px;background:rgb(var(--surface));color:rgb(var(--fg));padding:8px 16px;box-shadow:0 3px 12px rgb(var(--fg) / .16);font-size:13px;font-weight:600;';document.body.append(hint);}
    hint.style.top=(document.querySelector('.app-top')?.getBoundingClientRect().bottom||0)+8+'px';hint.textContent=pull.distance>=64?'松开刷新':'↓ 下拉刷新';
  },{passive:true});
  document.addEventListener('touchend',async()=>{
    if(!pull||pull.distance<64||pull.path!==location.pathname){clear();return;}
    busy=true;pull=null;if(hint)hint.textContent='正在刷新…';
    const deadline=setTimeout(()=>{busy=false;clear();},12000);
    try{window.__vrcrpSyncChats?.();await window.__vrcrpSiteCache?.refreshPage?.();}catch{}
    finally{clearTimeout(deadline);busy=false;clear();}
  },{passive:true});
  document.addEventListener('touchcancel',clear,{passive:true});window.addEventListener('popstate',clear);
})();
