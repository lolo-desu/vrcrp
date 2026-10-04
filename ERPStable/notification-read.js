(() => {
  'use strict';
  if(window!==window.top||location.origin!=='https://erp.sex')return;
  let queued=false,timer=0,flight=false;
  function update(){
    queued=false;
    if(location.pathname!=='/notifications'||document.hidden||!navigator.onLine){clearTimeout(timer);timer=0;return;}
    if(flight)return;
    const items=window.__vrcrpSiteCache?.notificationItems?.()||[],ids=new Set(items.filter(i=>!i.read).map(i=>i.id)),visible=[];
    if(!ids.size)return;
    const viewport=window.visualViewport,top=viewport?.offsetTop||0,bottom=top+(viewport?.height||innerHeight);
    for(const li of document.querySelectorAll('#main ul>li')){
      const r=li.getBoundingClientRect();if(!r.height||r.bottom<=top||r.top>=bottom||getComputedStyle(li).visibility==='hidden')continue;
      let id=li.dataset.notificationId;
      if(!ids.has(id)){
        const key=Object.keys(li).find(k=>k.startsWith('__reactFiber$'));let node=key&&li[key];
        for(let i=0;node&&i<5;i++,node=node.return)if(ids.has(node.key)){id=node.key;break;}
      }
      // A row counts as seen only after most of it is on screen.
      if(ids.has(id)&&Math.min(r.bottom,bottom)-Math.max(r.top,top)>=Math.min(r.height*.6,80))visible.push(id);
    }
    if(!visible.length)return;
    clearTimeout(timer);timer=setTimeout(async()=>{
      timer=0;if(location.pathname!=='/notifications'||document.hidden)return;
      flight=true;
      try{await window.__vrcrpSiteCache.readVisibleNotifications(visible);}catch{}
      finally{flight=false;timer=setTimeout(schedule,1800);}
    },180);
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(update);}}
  new MutationObserver(schedule).observe(document,{childList:true,subtree:true});
  document.addEventListener('scroll',schedule,{capture:true,passive:true});
  document.addEventListener('visibilitychange',schedule);window.addEventListener('popstate',schedule);window.addEventListener('online',schedule);
  schedule();
})();
