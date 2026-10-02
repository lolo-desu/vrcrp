(() => {
  'use strict';
  if(window!==window.top || location.origin!=='https://erp.sex')return;
  const kinds={like:{action:'right',label:'喜欢',symbol:'♥',color:'--success',fallback:'#a0d99a'},pass:{action:'left',label:'跳过',symbol:'×',color:'--danger',fallback:'#ff9b8d'},super:{action:'up',label:'超级喜欢',symbol:'★',color:'--accent',fallback:'#f4ca3a'}};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const css=`
    .stage[data-vrcrp-motion]{isolation:isolate;overflow:hidden;border-radius:var(--radius-card,20px)}
    .stage[data-vrcrp-motion] > .cursor-grab{z-index:5}
    [data-vrcrp-motion-card]{z-index:6!important;will-change:transform,opacity;transform-origin:50% 65%!important}
    [data-vrcrp-motion-card="dragging"]{transform:var(--vrcrp-swipe-transform)!important}
    [data-vrcrp-motion-card="waiting"]{opacity:0!important;pointer-events:none!important}
    [data-vrcrp-motion-card] [data-vrcrp-stamp]{opacity:0!important}
    [data-vrcrp-swipe-field]{position:absolute;pointer-events:none;z-index:2;opacity:0;will-change:transform,opacity;background:var(--vrcrp-swipe-color);border:2px solid #24221e;box-sizing:border-box}
    [data-vrcrp-swipe-field="like"]{width:360px;height:360px;border-radius:50%;left:calc(100% - 100px);top:calc(50% - 180px)}
    [data-vrcrp-swipe-field="pass"]{width:210px;height:250px;border-radius:32px;left:-115px;top:calc(50% - 125px);box-shadow:inset 0 0 0 15px #ffffff40}
    [data-vrcrp-swipe-field="super"]{width:75%;height:160%;left:12.5%;top:-85%;border:0;border-radius:50%;box-shadow:0 0 0 18px #ffffff38,0 0 0 38px #ffffff20}
    [data-vrcrp-swipe-beam]{position:absolute;inset:0 22%;z-index:2;pointer-events:none;opacity:0;will-change:opacity;background:linear-gradient(0deg,transparent,var(--vrcrp-swipe-color));clip-path:polygon(30% 0,70% 0,100% 100%,0 100%)}
    [data-vrcrp-swipe-cue]{position:absolute;pointer-events:none;z-index:25;left:50%;top:14%;transform:translateX(-50%) rotate(-7deg);color:#24221e;background:var(--vrcrp-swipe-color);border:3px solid #24221e;border-radius:9px;padding:7px 14px;box-shadow:3px 3px 0 #24221e;white-space:nowrap;font:900 clamp(24px,7vw,34px)/1.15 system-ui;opacity:0}
    [data-vrcrp-swipe-cue="pass"]{transform:translateX(-50%) rotate(7deg)}
    [data-vrcrp-swipe-cue="super"]{transform:translateX(-50%);top:22%}
    [data-vrcrp-swipe-hint]{position:absolute;pointer-events:none;z-index:25;left:12px;right:12px;bottom:12px;border:2px solid #24221e;border-radius:10px;color:#24221e;background:#fffcf3;padding:8px 10px;box-shadow:2px 2px 0 #24221e;font:650 12px/1.3 system-ui;opacity:0}
    [data-vrcrp-swipe-hint] small{display:block;font:500 10px/1.2 system-ui;opacity:.7;margin-top:3px}
    [data-vrcrp-swipe-hint][data-ready="true"]{background:#24221e;color:#fffcf3}
    [data-vrcrp-swipe-meter]{height:4px;margin-top:7px;background:#8885;position:relative;border-radius:4px}
    [data-vrcrp-swipe-meter] i{display:block;height:100%;width:var(--vrcrp-swipe-progress,0%);max-width:100%;border-radius:4px;background:currentColor}
    [data-vrcrp-swipe-meter]::after{content:"";position:absolute;left:77%;top:-2px;bottom:-2px;width:2px;background:currentColor}
    @media(prefers-reduced-motion:reduce){[data-vrcrp-motion-card]{will-change:opacity}[data-vrcrp-swipe-beam]{display:none}}
  `;
  let drag=null,frame=0,owner=0,ignoreClickUntil=0,ignoredCard=null,pending=null;
  const animations=new Set(),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const transform=(x=0,y=0,r=0,s=1,rx=0,ry=0)=>`translate3d(${x}px,${y}px,0) rotate(${r}deg) scale(${s}) rotateX(${rx}deg) rotateY(${ry}deg)`;
  const post=body=>window.webkit?.messageHandlers?.erpNativeApp?.postMessage(body);
  function label(card){
    const labels=[...card.querySelectorAll('span.pointer-events-none.absolute.border-4')];
    for(const el of labels){
      const kind=el.classList.contains('border-success')?'like':el.classList.contains('border-danger')?'pass':el.classList.contains('border-accent')?'super':null;
      if(kind)el.dataset.vrcrpStamp=kind;
    }
    return labels.filter(el=>el.dataset.vrcrpStamp);
  }
  function install(){if(!document.head || document.getElementById('vrcrp-swipe-feedback'))return;const style=document.createElement('style');style.id='vrcrp-swipe-feedback';style.textContent=css;document.head.appendChild(style);}
  function committedAction(card){
    const root=document.getElementById('root'),key=root&&Object.keys(root).find(k=>k.startsWith('__reactContainer$')),fiber=key&&root[key],stack=fiber?[{node:fiber.stateNode?.current||fiber,action:null}]:[],seen=new Set();
    // Child edges belong to the committed render. Reused Fiber.return pointers
    // can reference callbacks for an obsolete card after a photo change.
    for(let i=0;stack.length&&i<5000;i++){
      const entry=stack.pop(),node=entry.node;if(!node||seen.has(node))continue;seen.add(node);const props=node.memoizedProps;
      const action=typeof props?.onSwipe==='function'?((event,kind)=>props.onSwipe(kinds[kind].action)):entry.action||(typeof props?.onDragEnd==='function'?((event,kind)=>props.onDragEnd(event,{offset:{x:kind==='like'?160:kind==='pass'?-160:0,y:kind==='super'?-160:0},velocity:{x:0,y:0},point:{x:0,y:0},delta:{x:0,y:0}})):null);
      if(node.stateNode===card&&action)return action;
      if(node.sibling)stack.push({node:node.sibling,action:entry.action});if(node.child)stack.push({node:node.child,action});
    }
    return null;
  }
  function blockedTarget(target,card){
    if(target.closest?.('button,input,textarea,select,a,[contenteditable]:not([contenteditable="false"]),[role="slider"],[role="button"],video[controls]'))return true;
    for(let node=target;node&&node!==card;node=node.parentElement){const s=getComputedStyle(node);if(node.scrollWidth>node.clientWidth+8&&/auto|scroll/.test(s.overflowX))return true;}return false;
  }
  function animate(el,keyframes,ms,easing='cubic-bezier(.2,.75,.2,1)'){
    const a=el.animate(keyframes,{duration:reduced.matches?Math.min(ms,120):ms,easing,fill:'forwards'});animations.add(a);return a.finished.catch(()=>{});
  }
  function release(d){if(d&&d.id!==null&&d.card.hasPointerCapture(d.id))d.card.releasePointerCapture(d.id);if(d)d.id=null;}
  function clear(){
    owner++;cancelAnimationFrame(frame);frame=0;const d=drag;drag=null;release(d);for(const a of animations)a.cancel();animations.clear();clearTimeout(pending);pending=null;if(!d)return;
    d.card.removeAttribute('data-vrcrp-motion-card');d.card.style.removeProperty('--vrcrp-swipe-transform');
    for(const el of [d.field,d.beam,d.cue,d.hint])el.remove();d.stage.removeAttribute('data-vrcrp-motion');d.stage.removeAttribute('data-vrcrp-swipe-direction');
  }
  function color(d,kind){if(d.colorKind===kind)return;d.colorKind=kind;const info=kinds[kind],value=getComputedStyle(document.documentElement).getPropertyValue(info.color).trim(),c=/^\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?$/.test(value)?`rgb(${value})`:info.fallback;for(const el of [d.field,d.beam,d.cue])el.style.setProperty('--vrcrp-swipe-color',c);}
  function create(card,stage,action,event){
    label(card);const field=document.createElement('div'),beam=document.createElement('div'),cue=document.createElement('div'),hint=document.createElement('div');field.dataset.vrcrpSwipeField='like';beam.dataset.vrcrpSwipeBeam='true';cue.dataset.vrcrpSwipeCue='like';hint.dataset.vrcrpSwipeHint='true';hint.setAttribute('role','status');hint.setAttribute('aria-live','polite');for(const el of [field,beam,cue])el.setAttribute('aria-hidden','true');
    const title=document.createElement('span'),note=document.createElement('small'),meter=document.createElement('div');meter.dataset.vrcrpSwipeMeter='true';meter.setAttribute('aria-hidden','true');meter.append(document.createElement('i'));hint.append(title,note,meter);stage.append(field,beam,cue,hint);
    stage.dataset.vrcrpMotion='pending';card.dataset.vrcrpMotionCard='dragging';const initial=getComputedStyle(card).transform;card.style.setProperty('--vrcrp-swipe-transform',initial==='none'?transform():initial);
    return {card,stage,action,field,beam,cue,hint,title,note,phase:'pending',id:event.pointerId,start:{x:event.clientX,y:event.clientY},raw:{x:0,y:0},pose:{x:0,y:0,r:0},kind:null,ready:false,moved:false,committed:false,limit:Math.min(118,stage.clientWidth*.34),path:location.pathname};
  }
  function render(){
    frame=0;const d=drag;if(!d||!d.card.isConnected||d.path!==location.pathname){clear();return;}if(d.phase!=='dragging')return;
    const {x,y}=d.raw,ax=Math.abs(x),up=Math.max(0,-y),kind=up>ax*.9&&up>8?'super':ax>8?(x>0?'like':'pass'):null;if(kind!==d.kind){d.kind=kind;d.ready=false;}
    const amount=kind==='super'?up:ax,ratio=amount/d.limit,wasReady=d.ready;if(!d.ready&&ratio>=1)d.ready=true;else if(d.ready&&ratio<.86)d.ready=false;if(wasReady!==d.ready)post({kind:'haptic',style:'selection'});
    const pull=amount<=d.limit?amount*.4:d.limit*.4+(amount-d.limit)*.86,factor=amount?pull/amount:.4;d.pose={x:kind==='super'?x*.2:x*factor,y:kind==='super'?y*factor:clamp(y*.16,-24,28),r:reduced.matches?0:kind==='super'?x*.015:clamp(x*.045,-14,14)};
    d.card.style.setProperty('--vrcrp-swipe-transform',transform(d.pose.x,d.pose.y,d.pose.r));d.stage.dataset.vrcrpSwipeDirection=kind||'none';d.stage.dataset.vrcrpMotion=d.ready?'ready':'dragging';d.hint.dataset.ready=String(d.ready);
    if(kind){const info=kinds[kind];color(d,kind);d.field.dataset.vrcrpSwipeField=d.cue.dataset.vrcrpSwipeCue=kind;d.field.style.opacity=String(clamp(ratio*.9,0,1));d.field.style.transform=`scale(${(kind==='pass'?.22:.1)+clamp(ratio,0,1.3)*(kind==='pass'?.95:1.15)+(d.ready?.10:0)})`;d.beam.style.opacity=kind==='super'?String(clamp(ratio*.65,0,.85)):'0';const cue=info.symbol+' '+info.label;if(d.cue.textContent!==cue)d.cue.textContent=cue;d.cue.style.opacity=String(clamp((ratio-.15)*1.25,0,1));
      const text=d.ready?'松手确认 · '+info.label:info.label+' · 回拉可取消';if(d.title.textContent!==text)d.title.textContent=text;const note=d.ready?'向中心回拉，仍可反悔':'越过刻度后松手确认';if(d.note.textContent!==note)d.note.textContent=note;d.hint.style.opacity='1';
    }else{d.field.style.opacity=d.beam.style.opacity=d.cue.style.opacity='0';d.title.textContent='回到中心 · 松手取消';d.note.textContent='向右喜欢 · 向左跳过 · 向上超级喜欢';}
    d.hint.style.setProperty('--vrcrp-swipe-progress',clamp(ratio*.77*100,0,100)+'%');
  }
  function moved(event){const d=drag;if(!d||d.id!==event.pointerId||!['pending','dragging'].includes(d.phase))return;d.raw={x:event.clientX-d.start.x,y:event.clientY-d.start.y};if(!d.moved&&Math.hypot(d.raw.x,d.raw.y)<6)return;if(!d.moved){d.moved=true;d.phase='dragging';d.card.setPointerCapture(d.id);}event.stopImmediatePropagation();event.preventDefault();if(!frame)frame=requestAnimationFrame(render);}
  async function cancel(){const d=drag;if(!d)return;if(frame){cancelAnimationFrame(frame);render();}const token=owner;d.phase='returning';d.stage.dataset.vrcrpMotion='returning';release(d);d.card.dataset.vrcrpMotionCard='returning';const p=d.pose;
    await Promise.all([animate(d.card,reduced.matches?[{opacity:1},{opacity:1}]:[{transform:transform(p.x,p.y,p.r)},{transform:transform(-p.x*.12,-p.y*.12,-p.r*.12),offset:.7},{transform:transform()}],350),animate(d.field,[{opacity:d.field.style.opacity},{opacity:0}],200),animate(d.hint,[{opacity:1},{opacity:0}],180),animate(d.cue,[{opacity:d.cue.style.opacity},{opacity:0}],160),animate(d.beam,[{opacity:d.beam.style.opacity},{opacity:0}],200)]);if(token===owner)clear();
  }
  function exitFrames(d){const {x,y,r}=d.pose,w=d.stage.clientWidth,h=d.stage.clientHeight,start={transform:transform(x,y,r),opacity:1};if(d.kind==='like')return [start,{transform:transform(x-10,y,r-3),offset:.13},{transform:transform(w*.96,-32,26),opacity:1,offset:.8},{transform:transform(w*1.2,-52,34),opacity:0}];if(d.kind==='pass')return [start,{transform:transform(-w*.3,18,-8,.75,0,55),opacity:1,offset:.5},{transform:transform(-w*.52,24,-6,.04,0,86),opacity:0}];return [start,{transform:transform(0,-h*.12,0,1.06),opacity:1,offset:.26},{transform:transform(0,-h*.95,0,.68),opacity:0}];}
  async function commit(event){const d=drag;if(!d?.kind||d.committed)return;const token=owner;d.phase='exiting';d.stage.dataset.vrcrpMotion='exiting';release(d);d.card.dataset.vrcrpMotionCard='exiting';d.title.textContent='已确认 · '+kinds[d.kind].label;d.note.textContent='';d.hint.dataset.ready='true';d.hint.style.setProperty('--vrcrp-swipe-progress','100%');const ms=d.kind==='like'?480:d.kind==='pass'?540:620;
    await Promise.all([animate(d.card,reduced.matches?[{opacity:1},{opacity:0}]:exitFrames(d),ms,d.kind==='like'?'cubic-bezier(.32,0,.7,.2)':'cubic-bezier(.35,.1,.5,1)'),animate(d.field,[{opacity:d.field.style.opacity,transform:d.field.style.transform},{opacity:1,transform:d.kind==='pass'?'scale(1.65)':'scale(2.6)'}],ms),animate(d.beam,[{opacity:d.beam.style.opacity},{opacity:d.kind==='super'?1:0}],ms)]);
    if(token!==owner||d.path!==location.pathname||!d.card.isConnected){if(token===owner)clear();return;}d.committed=true;d.phase='waiting';d.stage.dataset.vrcrpMotion='waiting';d.card.dataset.vrcrpMotionCard='waiting';
    // Original callbacks retain busy/energy guards, errors, visitor login and
    // super-like note confirmation. Never submit an API request independently.
    try{(committedAction(d.card)||d.action)(event,d.kind);}catch{clear();return;}if(token!==owner)return;
    await Promise.all([animate(d.field,[{opacity:1},{opacity:0}],240),animate(d.hint,[{opacity:1},{opacity:0}],180),animate(d.cue,[{opacity:1},{opacity:0}],180),animate(d.beam,[{opacity:d.kind==='super'?1:0},{opacity:0}],240)]);if(token!==owner)return;if(d.kind==='super'||document.querySelector('[role="dialog"]')||!d.stage.parentElement.querySelector('.act-like:disabled,.act-pass:disabled,.act-super:disabled')&&!d.stage.querySelector('.cursor-grab:not([data-vrcrp-motion-card])')){clear();return;}
    pending=setTimeout(()=>{if(token===owner)clear();},1800);
  }
  document.addEventListener('pointerdown',event=>{
    if(location.pathname!=='/discover'||event.isPrimary===false||event.button!==0||document.querySelector('[role="dialog"]'))return;const card=event.target.closest?.('.stage .cursor-grab'),stage=card?.closest('.stage');if(!card||blockedTarget(event.target,card))return;if(stage.parentElement.querySelector('.act-like:disabled,.act-pass:disabled,.act-super:disabled'))return;
    if(drag){if(['returning','pending'].includes(drag.phase))clear();else return;}const action=committedAction(card);if(!action||typeof card.animate!=='function')return;install();drag=create(card,stage,action,event);event.stopImmediatePropagation();
  },{capture:true});
  document.addEventListener('pointermove',moved,{capture:true,passive:false});
  document.addEventListener('pointerup',event=>{const d=drag;if(!d||d.id!==event.pointerId||!['pending','dragging'].includes(d.phase))return;if(!d.moved){clear();return;}event.stopImmediatePropagation();event.preventDefault();d.raw={x:event.clientX-d.start.x,y:event.clientY-d.start.y};if(frame)cancelAnimationFrame(frame);render();ignoreClickUntil=performance.now()+700;ignoredCard=d.card;if(d.ready&&d.kind)commit(event);else cancel();},{capture:true,passive:false});
  for(const type of ['pointercancel','lostpointercapture'])document.addEventListener(type,event=>{if(drag?.id===event.pointerId&&['pending','dragging'].includes(drag.phase)){event.stopImmediatePropagation();ignoreClickUntil=performance.now()+700;ignoredCard=drag.card;cancel();}},{capture:true});
  document.addEventListener('click',event=>{if(performance.now()<ignoreClickUntil&&ignoredCard?.contains(event.target)||drag&&['exiting','waiting'].includes(drag.phase)&&event.target.closest?.('.stage .cursor-grab,.act-like,.act-pass,.act-super')){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
  new MutationObserver(()=>{if(drag&&(!drag.card.isConnected||location.pathname!==drag.path||drag.phase==='waiting'&&document.querySelector('[role="dialog"]')))clear();}).observe(document,{subtree:true,childList:true});
  window.addEventListener('popstate',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});window.addEventListener('pagehide',clear);reduced.addEventListener('change',clear);
  document.addEventListener('DOMContentLoaded',install);install();
})();
