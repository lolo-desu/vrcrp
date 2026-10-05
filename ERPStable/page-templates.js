(() => {
  'use strict';
  if (window !== window.top || location.origin !== 'https://erp.sex') return;
  // In-memory, data-free layouts. Unlike navigation screenshots, these may be
  // reused for a different person/thread. Never retain names, drafts or media.
  const templates = new Map();
  const staticArea = /^(?:\/settings(?:\/|$)|\/profile\/edit(?:\/|$)|\/(?:login|register|forgot-password|reset-password)(?:\/|$))/;
  const excluded = 'script,style,.app-bottom,#vrcrp-page-placeholder,.vrcrp-inline-placeholder,[data-vrcrp-loading-surface],[role="dialog"],[data-dialog],[data-vrcrp-profile-overlay]';
  let header = null;
  const dictionaries=new Map(),staticLabels=new Set();let labelsFlight=null,labelEpoch=0;
  const normalized=s=>s.replace(/\s+/g,' ').trim();
  const labelKeys={'配对':'chat.list.title','聊天中':'chat.list.active','已结束':'chat.list.closed','输入消息…':'chat.placeholder','发送图片':'chat.attachImage','录制语音':'chat.voice.record','喜欢':'discover.likes.title','收到的喜欢':'discover.likes.tab','发出的喜欢':'discover.likesSent.tab','访客':'discover.visitors.tab','探索':'discover.title','筛选':'discover.filters.title','广场':'posts.title','发布':'posts.new','全部':'posts.all','我的':'posts.mine','综合':'posts.sortMix','最新':'posts.sortNew','热门':'posts.sortHot','搜索帖子':'posts.search','分类':'posts.category','编辑名片':'editor.title','预览':'editor.preview','基本资料':'editor.sections.basics','照片':'editor.sections.photos','简介':'editor.sections.bio','偏好':'editor.sections.preferences','设置':'settings.index.title','隐私':'settings.index.privacy','通知':'settings.index.notifications','账号':'settings.index.account','内容设置':'settings.index.content','会员':'settings.index.membership','能量':'settings.index.energy','邀请':'settings.index.invite','语言':'settings.index.language','黑名单':'settings.index.blocks','处罚记录':'settings.index.sanctions','登录':'auth.login.submit','注册':'auth.register.submit','邮箱':'auth.email','密码':'auth.password','昵称':'editor.basics.displayName','保存':'common.action.save'};
  Object.assign(labelKeys,{'喜欢我的人':'discover.likes.title','我喜欢的人':'discover.likesSent.title','我悄悄喜欢的人':'discover.likesSecret.title','喜欢我':'discover.likes.tab','我喜欢的':'discover.likesSent.tab','我悄悄喜欢的':'discover.likesSecret.tab','对方还看不到这些喜欢，配对后才会知道。':'discover.likesSecret.subtitle','默认分组':'chat.groups.default','新增分组':'chat.groups.new','搜索配对的人':'chat.list.search','最近对话':'chat.list.viewRecent','分组':'chat.list.viewGroups','长按 ♥ 或 ★ 可以悄悄喜欢，对方要等你们配对才知道。':'discover.secret.hint'});
  function translate(ns,key,fallback){const d=dictionaries.get(ns);let v=d;for(const part of key.split('.'))v=v?.[part];return typeof v==='string'&&!v.includes('{{')?v:fallback;}
  function label(text){
    if(/^聊天[記记][錄录]存在[這这][個个][瀏浏][覽览]器[。.]?$/.test(text))return '';
    const key=labelKeys[text],dot=key?.indexOf('.');
    const value=key?translate(key.slice(0,dot),key.slice(dot+1),text):text;
    return window.__vrcrpLanguage?.current()==='zh-Hans'?window.__vrcrpToSimplified(value):value;
  }
  async function loadLabels(){
    if(labelsFlight)return labelsFlight;
    const asset=document.querySelector('script[type="module"][src*="/assets/index-"]')?.src;if(!asset)return;
    const owner=labelEpoch;labelsFlight=(async()=>{
      try{
        let language;try{language=localStorage.getItem('erp_locale');}catch{}
        const chosen=language||document.documentElement.lang||navigator.language||'en';
        language=/^zh/i.test(chosen)?'zh-Hant':/^ja/i.test(chosen)?'ja':/^ko/i.test(chosen)?'ko':'en';
        const url=new URL(asset,location.href);if(url.origin!==location.origin)return;
        const response=await fetch(url,{cache:'force-cache'});if(!response.ok)return;const source=await response.text();if(source.length>2000000)return;
        await Promise.allSettled(['common','chat','discover','editor','settings','posts','me','auth','profile','notifications'].map(async ns=>{
          const prefix='"./locales/'+language+'/'+ns+'.json":',start=source.indexOf(prefix);if(start<0)return;
          const match=source.slice(start,start+240).match(/import\("(\.\/[^"/]+\.js)"\)/);if(!match)return;
          const module=await import(new URL(match[1],url).href);if(!module.default||typeof module.default!=='object')return;
          if(owner!==labelEpoch)return;dictionaries.set(ns,module.default);
          const walk=o=>{for(const v of Object.values(o)){if(typeof v==='string'&&!v.includes('{{'))staticLabels.add(normalized(v));else if(v&&typeof v==='object')walk(v);}};walk(module.default);
        }));
        if(owner===labelEpoch&&window.__vrcrpPaintState?.().ready)remember(location.pathname);
      }catch{}
    })();return labelsFlight;
  }
  const rect = e => {const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
  function context() {
    const r=document.documentElement,s=getComputedStyle(r);
    let locale='',chatView='';try{locale=localStorage.getItem('erp_locale')||'';const prefs=JSON.parse(localStorage.getItem('erp_prefs')||'{}').state||{};chatView=JSON.stringify([prefs.chatView,prefs.chatOpenGroups,prefs.chatGroup]);}catch{}
    return [innerWidth,innerHeight,r.lang,locale,r.dataset.preset,r.dataset.scheme,r.dataset.vrcrpPalette,
      chatView,...['--surface','--bg','--fg','--primary','--radius-card'].map(k=>s.getPropertyValue(k))].join('|');
  }
  function family(path) {
    if(/^\/matches\/[^/]+$/.test(path))return '/matches/:thread';
    if(/^\/u\/[^/]+$/.test(path))return '/u/:person';
    if(/^\/posts\/[^/]+$/.test(path)&&path!=='/posts/new')return '/posts/:post';
    return path;
  }
  function inertCopy(source) {
    const copy=source.cloneNode(true);
    for(const el of [copy,...copy.querySelectorAll('*')]){
      el.removeAttribute('id');el.removeAttribute('href');el.removeAttribute('src');
      for(const a of [...el.attributes])if(/^on/.test(a.name)||/^data-vrcrp/.test(a.name))el.removeAttribute(a.name);
      if(el.matches('button,input,textarea,select,a')){el.setAttribute('tabindex','-1');el.setAttribute('aria-hidden','true');}
    }
    copy.style.pointerEvents='none';return copy;
  }
  function liveHeader() {
    const source=document.querySelector('.app-top:not(#vrcrp-page-placeholder .app-top)');
    if(source&&source.getBoundingClientRect().height>0){header=inertCopy(source);header.style.flexShrink='0';}
    return header?.cloneNode(true)||null;
  }
  function clipped(r,parent) {
    let clip={x:0,y:0,width:innerWidth,height:innerHeight};
    for(let n=parent;n&&n!==document.body;n=n.parentElement){
      const s=getComputedStyle(n);if(!/(hidden|clip|auto|scroll)/.test(s.overflowX+' '+s.overflowY))continue;
      const b=rect(n),right=Math.min(clip.x+clip.width,b.x+b.width),bottom=Math.min(clip.y+clip.height,b.y+b.height);
      clip.x=Math.max(clip.x,b.x);clip.y=Math.max(clip.y,b.y);clip.width=Math.max(0,right-clip.x);clip.height=Math.max(0,bottom-clip.y);
    }
    return r.width>0&&r.height>0&&r.y<innerHeight&&r.y+r.height>0&&clip.width>0&&clip.height>0?clip:null;
  }
  function fixedText(el,path) {
    if(el.closest('.app-top'))return true;
    // Names, badges, counts, profile titles and user-supplied button captions
    // stay variable even when they happen to look like structural labels.
    if(el.closest('[data-vrcrp-unread],.bubble-me,.bubble-them,[data-message-id]'))return false;
    if(/^\/u\//.test(path)&&el.closest('h1'))return false;
    if(/^\/matches\//.test(path)&&el.closest('[data-vrcrp-chat-bar] a[href^="/u/"]'))return false;
    if(staticLabels.has(normalized(el.textContent)))return true;
    if(el.closest('button,[role="tab"],label,legend'))return true;
    if(el.closest('nav'))return true;
    if(el.closest('h1')&&!/^\/(?:u\/|me$)/.test(path))return true;
    if(/^\/matches\//.test(path))return !!el.closest('form+p');
    if(staticArea.test(path))return !!el.closest('h2,h3,fieldset')||el.matches('label,legend')||path==='/settings'&&el.classList.contains('font-semibold');
    return false;
  }
  function elementStyle(el) {
    const s=getComputedStyle(el),keys=['backgroundColor','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','borderTopColor','borderRightColor','borderBottomColor','borderLeftColor','borderTopStyle','borderRightStyle','borderBottomStyle','borderLeftStyle','borderTopLeftRadius','borderTopRightRadius','borderBottomRightRadius','borderBottomLeftRadius','boxShadow','color'];
    return Object.fromEntries(keys.map(k=>[k,s[k]]));
  }
  function textStyle(el) {
    const s=getComputedStyle(el);return Object.fromEntries(['fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','lineHeight','color','textTransform','textDecorationLine'].map(k=>[k,s[k]]));
  }
  function fixedLines(node) {
    const lines=[],range=document.createRange();let start=0;
    // Ask WebKit where the real text wraps. Binary search keeps this bounded;
    // no approximation from character counts or a second layout engine.
    while(start<node.length&&lines.length<64){
      let lo=start+1,hi=node.length;
      while(lo<hi){const end=Math.ceil((lo+hi)/2);range.setStart(node,start);range.setEnd(node,end);
        const boxes=[...range.getClientRects()].filter(b=>b.width>0&&b.height>0);
        if(boxes.length<=1)lo=end;else hi=end-1;}
      range.setStart(node,start);range.setEnd(node,lo);const b=range.getBoundingClientRect(),text=node.textContent.slice(start,lo).replace(/\s+/g,' ').trim();
      if(b.y>=innerHeight)break;
      if(text&&b.width>0&&b.height>0)lines.push({rect:{x:b.x,y:b.y,width:b.width,height:b.height},text});
      start=lo;
    }
    range.detach();return lines;
  }
  function svgCopy(el) {
    const copy=el.cloneNode(true);for(const node of [copy,...copy.querySelectorAll('*')]){
      for(const a of [...node.attributes])if(/^on/.test(a.name)||/href|^id$/.test(a.name))node.removeAttribute(a.name);
    }
    copy.querySelectorAll('script,foreignObject,image,use').forEach(n=>n.remove());
    copy.removeAttribute('class');copy.setAttribute('width','100%');copy.setAttribute('height','100%');
    copy.style.color=getComputedStyle(el).color;return copy.outerHTML;
  }
  function scene(path) {
    const main=document.getElementById('main');if(!main)return null;
    const roots=[document.querySelector('.app-top'),main].filter(Boolean),layers=[];
    for(const root of roots)for(const el of [root,...root.querySelectorAll('*')]){
      if(layers.length>=240)break;
      if(el.closest(excluded)||el.parentElement?.closest('svg'))continue;
      const s=getComputedStyle(el),r=rect(el),clip=clipped(r,el.parentElement);
      let hidden=false;for(let n=el.parentElement;n&&n!==document.body;n=n.parentElement){const t=getComputedStyle(n);if(t.display==='none'||t.visibility==='hidden'||Number(t.opacity)===0){hidden=true;break;}}
      if(hidden||!clip||s.visibility==='hidden'||s.display==='none'||Number(s.opacity)===0)continue;
      let alpha=Number(s.opacity);for(let n=el.parentElement;n&&n!==document.body;n=n.parentElement)alpha*=Number(getComputedStyle(n).opacity);
      const add=o=>layers.push({...o,rect:r,clip,alpha});
      if(el instanceof SVGElement){add({svg:svgCopy(el),style:{color:s.color}});continue;}
      if(el.matches('img,video,canvas,[style*="background-image"]')){
        add({mask:true,style:{borderRadius:s.borderRadius},media:true});continue;
      }
      if(el.matches('button,input,textarea,label,nav,[role="tab"],[role="switch"]')||s.backgroundColor!=='rgba(0, 0, 0, 0)'||parseFloat(s.borderTopWidth)||parseFloat(s.borderBottomWidth)||s.boxShadow!=='none')add({style:elementStyle(el)});
      const back=el.matches('button')&&!!el.querySelector('svg')&&(/返回|back/i.test(el.getAttribute('aria-label')||'')||el.hasAttribute('data-vrcrp-page-back')||el.hasAttribute('data-vrcrp-chat-back'));
      if(back)add({back:true,style:{}});
      if(el.matches('input,textarea,select')){
        // Values are account-specific. Keep the real field outline and its
        // empty hint, measured at the original padding/font, never the draft.
        const hint=el.getAttribute('placeholder');if(hint){const x=parseFloat(s.paddingLeft)||0,y=parseFloat(s.paddingTop)||0;
          layers.push({rect:{x:r.x+x,y:r.y+y,width:Math.max(0,r.width-x-(parseFloat(s.paddingRight)||0)),height:parseFloat(s.lineHeight)||24},clip,alpha,style:{...textStyle(el),color:getComputedStyle(el,'::placeholder').color},text:hint});}
        continue;
      }
      for(const node of el.childNodes){
        if(node.nodeType!==Node.TEXT_NODE||!node.textContent.trim())continue;
        const range=document.createRange();range.selectNodeContents(node);const boxes=[...range.getClientRects()];range.detach();
        const fixed=fixedText(el,path);
        if(fixed){for(const line of fixedLines(node))layers.push({...line,clip,alpha,style:textStyle(el)});}
        else for(const b of boxes){if(b.width<1||b.height<1)continue;const h=Math.min(12,b.height*.55);
          layers.push({rect:{x:b.x,y:b.y+(b.height-h)/2,width:b.width,height:h},clip,alpha,mask:true,style:{borderRadius:'6px'}});}
      }
    }
    return {width:innerWidth,height:innerHeight,layers:layers.slice(0,256)};
  }
  function remember(path) {
    if(!window.__vrcrpPaintState?.().ready||document.querySelector('[role="dialog"],[data-vrcrp-profile-overlay]')||Math.abs(scrollY)>1||document.documentElement.dataset.vrcrpKeyboard==='true')return;
    loadLabels();liveHeader();const model=scene(path);if(!model?.layers.length)return;
    const key=context()+'|';templates.delete(key+path);templates.set(key+path,model);
    // A closed/read-only chat must never supply another chat's composer.
    if(family(path)!==path&&(!/^\/matches\//.test(path)||document.querySelector('#main form textarea'))){templates.delete(key+family(path));templates.set(key+family(path),model);}
    while(templates.size>32)templates.delete(templates.keys().next().value);
  }
  function install(shell,path) {
    const prefix=context()+'|',model=templates.get(prefix+path)||templates.get(prefix+family(path));if(!model)return false;
    shell.dataset.vrcrpMeasuredTemplate='true';shell.style.display='block';
    for(const item of model.layers){
      const wrap=document.createElement('div');wrap.style.cssText=`position:absolute;left:${item.clip.x}px;top:${item.clip.y}px;width:${item.clip.width}px;height:${item.clip.height}px;overflow:hidden;pointer-events:none;`;
      const el=document.createElement(item.back?'button':'div'),r=item.rect;
      Object.assign(el.style,item.style,{position:'absolute',left:(r.x-item.clip.x)+'px',top:(r.y-item.clip.y)+'px',width:r.width+'px',height:r.height+'px',boxSizing:'border-box',margin:'0',padding:'0',opacity:String(item.alpha??1)});
      el.dataset.vrcrpShape='';
      if(item.mask){el.className='vr-page-block';el.style.animation='';}
      if(item.text){el.dataset.vrcrpFixedText='true';el.textContent=item.text;el.style.whiteSpace='nowrap';el.style.lineHeight=r.height+'px';}
      if(item.svg){el.innerHTML=item.svg;el.dataset.vrcrpRaster='true';}
      if(item.back){el.dataset.vrcrpSkeletonBack='true';el.type='button';el.setAttribute('aria-label','返回');el.style.background='transparent';el.style.border='0';el.style.pointerEvents='auto';el.addEventListener('click',()=>window.__vrcrpBack?.());}
      wrap.append(el);shell.append(wrap);
    }
    return true;
  }
  // Canvas uses WebKit's own SVG paths and fonts. UIKit receives tiny PNG
  // layers, so it doesn't replace the website's icons with SF Symbols.
  function raster(el) {
    const svg=el.matches('svg')?el:el.querySelector(':scope>svg');const s=getComputedStyle(el),r=rect(el);
    if(r.width<1||r.height<1||r.width>1200||r.height>120)return null;
    const canvas=document.createElement('canvas'),scale=2;canvas.width=Math.ceil(r.width*scale);canvas.height=Math.ceil(r.height*scale);
    const c=canvas.getContext('2d');c.scale(scale,scale);
    try{
      if(svg){
        const v=(svg.getAttribute('viewBox')||'0 0 24 24').split(/[,\s]+/).map(Number);c.scale(r.width/v[2],r.height/v[3]);c.translate(-v[0],-v[1]);
        for(const n of svg.querySelectorAll('path,circle,ellipse,line,rect,polyline,polygon')){
          const q=getComputedStyle(n);if(q.display==='none')continue;c.save();
          const base=svg.getCTM(),matrix=n.getCTM();if(base&&matrix){const m=base.inverse().multiply(matrix);c.transform(m.a,m.b,m.c,m.d,m.e,m.f);}
          c.strokeStyle=q.stroke==='none'?'transparent':q.stroke;c.fillStyle=q.fill==='none'?'transparent':q.fill;c.lineWidth=parseFloat(q.strokeWidth)||2;c.lineCap=q.strokeLinecap;c.lineJoin=q.strokeLinejoin;
          const a=k=>Number(n.getAttribute(k)||0);let p;
          if(n.tagName==='path')p=new Path2D(n.getAttribute('d')||'');
          else {p=new Path2D();if(n.tagName==='circle')p.arc(a('cx'),a('cy'),a('r'),0,Math.PI*2);
            else if(n.tagName==='ellipse')p.ellipse(a('cx'),a('cy'),a('rx'),a('ry'),0,0,Math.PI*2);
            else if(n.tagName==='line'){p.moveTo(a('x1'),a('y1'));p.lineTo(a('x2'),a('y2'));}
            else if(n.tagName==='rect'){if(p.roundRect)p.roundRect(a('x'),a('y'),a('width'),a('height'),a('rx'));else p.rect(a('x'),a('y'),a('width'),a('height'));}
            else {const points=(n.getAttribute('points')||'').trim().split(/[,\s]+/).map(Number);for(let i=0;i<points.length;i+=2)i?p.lineTo(points[i],points[i+1]):p.moveTo(points[i],points[i+1]);if(n.tagName==='polygon')p.closePath();}}
          let alpha=Number(q.opacity);for(let parent=n.parentElement;parent&&parent!==svg;parent=parent.parentElement)alpha*=Number(getComputedStyle(parent).opacity);
          if(q.fill!=='none'){c.globalAlpha=alpha*Number(q.fillOpacity);c.fill(p);}if(q.stroke!=='none'){c.globalAlpha=alpha*Number(q.strokeOpacity);c.stroke(p);}c.restore();
        }
      }else{
        c.font=`${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;c.fillStyle=s.color;c.textBaseline='middle';c.fillText(el.textContent.trim(),0,r.height/2);
      }
      return canvas.toDataURL('image/png').split(',')[1];
    }catch{return null;}
  }
  window.__vrcrpPageTemplates={remember,install,header:liveHeader,raster,label,translate,
    clear(){templates.clear();header=null;dictionaries.clear();staticLabels.clear();labelEpoch++;labelsFlight=null;},
    // Synthetic browser fixtures only; no network or disk storage.
    size:()=>templates.size};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadLabels,{once:true});else loadLabels();
  document.fonts?.addEventListener('loadingdone',()=>{
    setTimeout(()=>{if(window.__vrcrpPaintState?.().ready)remember(location.pathname);},50);
  });
})();
