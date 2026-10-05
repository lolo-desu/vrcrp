(() => {
  'use strict';
  const bridge = window.webkit?.messageHandlers?.erpNativeNotifications;
  if (window !== window.top || location.origin !== 'https://erp.sex' || !bridge) return;
  const originalFetch = window.fetch, OriginalWebSocket = window.WebSocket;
  const seen = new Set(), matches = new Map(), reads = new Map();
  const localEvents = new WeakSet(), hydration = new Map();
  let detailRequested = false;
  let userId = '', unread = null, socket = null, active = true, busy = false;
  window.__vrcrpForeground=true;
  let pollTimer = null, fallbackTimer = null, lastDetailed = 0, sessionStarted = Date.now();
  let epoch = 0, controller = null, retryDelay = 0, syncAgain = false;
  let requestHeaders = { Accept: 'application/json', 'X-Content-Mode': 'sfw' };
  function post(value) { try { bridge.postMessage(value); } catch {} }
  function validId(value) { return typeof value === 'string' && /^[\w-]{1,120}$/.test(value); }
  function unwrap(value) { return value?.data ?? value; }
  function remember(id) { seen.add(id); if (seen.size > 512) seen.delete(seen.values().next().value); }
  function isRead(matchId,messageId,createdAt){
    if(window.__vrcrpSiteCache?.isMessageRead?.(matchId,messageId,createdAt))return true;
    const read=reads.get(matchId);if(!read)return false;
    if(read.ids.has(messageId))return true;
    const time=Date.parse(createdAt),through=Date.parse(read.createdAt);
    return Number.isFinite(time)&&Number.isFinite(through)&&time<through;
  }
  window.__vrcrpChatRead = value => {
    if(!userId||value?.userId!==userId||!validId(value.matchId)||!validId(value.lastMessageId))return;
    const prior=reads.get(value.matchId),ids=new Set(prior?.ids||[]);
    for(const id of [value.lastMessageId,...(value.messageIds||[])])if(validId(id)){ids.add(id);remember(id);}
    while(ids.size>512)ids.delete(ids.values().next().value);
    const createdAt=!prior||Date.parse(value.createdAt)>=Date.parse(prior.createdAt)||!prior.createdAt?value.createdAt:prior.createdAt;
    reads.set(value.matchId,{ids,createdAt});while(reads.size>256)reads.delete(reads.keys().next().value);
    const peer=matches.get(value.matchId);
    if(peer&&(!peer.messageId||isRead(value.matchId,peer.messageId,peer.createdAt)))matches.set(value.matchId,{...peer,unread:0,delta:0,changed:false});
    clearTimeout(fallbackTimer);detailRequested=false;
    post({kind:'chatRead',...value});schedule(0);
  };
  function body(message) {
    if (message.type === 'image') return '[图片]';
    if (message.type === 'voice') return '[语音]';
    if (message.type === 'vrc_link') return '[VRChat 链接]';
    if (message.type === 'system') return '有新的聊天动态';
    if (message.type === 'notice') return message.text || '有新的聊天通知';
    return Array.from(typeof message.text === 'string' ? message.text : '你有新的聊天消息').slice(0,140).join('');
  }
  function peerInfo(peer) {
    let avatarURL='';const media=peer?.avatar;
    if(media?.view==='show')try{const url=new URL(media.thumbUrl||media.url,location.href);if(url.protocol==='https:'&&!url.username&&!url.password&&url.href.length<4096)avatarURL=url.href;}catch{}
    return {title:String(peer?.displayName||'新聊天消息').slice(0,80),displayId:validId(peer?.id)?peer.id:'',avatarURL};
  }
  function message(value, title) {
    if (!userId || !validId(value?.id) || !validId(value?.matchId) || seen.has(value.id) || isRead(value.matchId,value.id,value.createdAt)) return;
    remember(value.id);
    if (value.recalled || String(value.senderId) === userId) return;
    lastDetailed = Date.now(); clearTimeout(fallbackTimer);
    detailRequested = false;
    if (active && !document.hidden && location.pathname === '/matches/' + value.matchId) return;
    const peer=matches.get(value.matchId)||{};
    post({ kind: 'chatMessage', messageId: value.id, matchId: value.matchId, createdAt:String(value.createdAt||''), senderId: String(value.senderId ?? ''), title: String(title || peer.title || '新聊天消息').slice(0,80), displayId:peer.displayId || String(value.senderId ?? ''), avatarURL:peer.avatarURL || '', body: body(value) });
  }
  function counters(value) {
    const count = value?.unreadMessages;
    if (!Number.isSafeInteger(count) || count < 0 || count > 100000) return;
    const increased = unread !== null && count > unread;
    unread = count;window.__vrcrpChatUnread?.(count);post({ kind: 'counters', unread: count });
    if(count===0){clearTimeout(fallbackTimer);detailRequested=false;}
    window.__vrcrpSiteCache?.commitCounters(value);
    if (increased && Date.now() - lastDetailed > 3000) {
      clearTimeout(fallbackTimer);
      detailRequested = true; schedule(0);
      // Counts can arrive before the summary, or its lastMessage can omit id.
      // Resolve real messages before considering a generic alert.
      fallbackTimer = setTimeout(async () => {
        const owner=epoch;
        await Promise.allSettled([...matches].filter(([,peer])=>peer.unread>0).slice(0,8).map(([id])=>hydrate(id)));
        // A counter alone cannot identify an unread message. Retry detail
        // instead of emitting an unverified notification after a read.
        if(owner===epoch && detailRequested && unread>0)schedule(600);
      }, 2200);
    }
  }
  window.__vrcrpCountersChanged = value => {
    const count=value?.unreadMessages;if(!Number.isSafeInteger(count)||count<0||count>100000)return;
    unread=count;window.__vrcrpChatUnread?.(count);post({kind:'counters',unread:count});
    if(count===0){clearTimeout(fallbackTimer);detailRequested=false;}
  };
  function session(value) {
    const id = value?.id == null ? '' : String(value.id);
    if (id === userId) { if (id) postSession(); return; }
    if (userId) socket = null;
    epoch++; controller?.abort();
    userId = validId(id) ? id : ''; unread = null; window.__vrcrpChatUnread?.(0); seen.clear(); matches.clear(); reads.clear(); hydration.clear(); detailRequested=false; sessionStarted = Date.now();
    clearTimeout(fallbackTimer); clearTimeout(pollTimer);
    postSession(); if (userId) schedule(0);
  }
  function postSession() {
    window.__vrcrpSiteCache?.session(userId, requestHeaders);
    post({ kind: 'session', userId, mode: requestHeaders['X-Content-Mode'], language: requestHeaders['Accept-Language'] || navigator.language || 'en', userAgent: navigator.userAgent });
  }
  function fingerprint(value) {
    return value ? JSON.stringify([value.createdAt||'',value.senderId||'',value.type||'',value.text||'']) : '';
  }
  async function hydrate(id, limit=1) {
    if(!validId(id)||!userId)return;
    if(hydration.has(id))return hydration.get(id);
    const owner=epoch, abort=new AbortController(), timer=setTimeout(()=>abort.abort(),12000);
    const task=(async()=>{
      const options={credentials:'include',cache:'no-store',headers:{...requestHeaders},signal:abort.signal};
      const [detail,response]=await Promise.all([originalFetch.call(window,'/api/v1/matches/'+id,options),originalFetch.call(window,'/api/v1/matches/'+id+'/messages?limit=20',options)]);
      if(owner!==epoch||!response.ok)return;
      if(detail.ok){const value=unwrap(await detail.json());if(owner!==epoch)return;if(value?.user)matches.set(id,{...matches.get(id),...peerInfo(value.user)});}
      const value=unwrap(await response.json());if(owner!==epoch||!Array.isArray(value?.items))return;
      const peer=matches.get(id)||{};
      const items=value.items.filter(m=>validId(m?.id)&&!m.recalled&&m.senderId!==userId&&!seen.has(m.id)).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))||a.id.localeCompare(b.id));
      const fresh=items.filter(m=>Date.parse(m.createdAt)>=sessionStarted || peer.changed && fingerprint(m)===peer.fingerprint);
      // A known unread increase is also evidence when the phone clock differs.
      const chosen=peer.delta>0?items.slice(-Math.min(peer.delta,20)):fresh.slice(-limit);
      for(const m of chosen)message({...m,matchId:id});
      if(peer.delta>0)matches.set(id,{...matches.get(id),delta:0,changed:false});
    })().catch(()=>{}).finally(()=>{clearTimeout(timer);if(owner===epoch)hydration.delete(id);});
    hydration.set(id,task);return task;
  }
  function snapshot(value, state = 'active', firstPage = true) {
    value=window.__vrcrpSiteCache?.reconcileMatches?.(value)||value;
    if (!userId || !Array.isArray(value?.items)) return;
    const summaries = [];
    for (const item of value.items.slice(0,200)) {
      const id = String(item.id ?? ''), latest = item.lastMessage;
      if (!validId(id)) continue;
      const info=peerInfo(item.user),prior=matches.get(id),print=fingerprint(latest);
      const hasBaseline=!!prior&&typeof prior.fingerprint==='string'&&Number.isSafeInteger(prior.unread);
      const changed=hasBaseline&&print!==prior.fingerprint;
      const delta=hasBaseline?Math.max(0,(item.unreadCount||0)-(prior.unread||0)):0;
      matches.set(id,{...info,messageId:latest?.id,createdAt:latest?.createdAt||'',fingerprint:print,unread:item.unreadCount||0,delta:item.unreadCount>0?Math.max(delta,prior?.delta||0):0,changed:item.unreadCount>0&&(changed||prior?.changed)});
      const created=Date.parse(latest?.createdAt);
      const fresh=latest&&item.unreadCount>0&&(changed||delta>0||!hasBaseline&&Number.isFinite(created)&&created>=sessionStarted);
      if(fresh && validId(latest.id) && (latest.type!=='text'||typeof latest.text==='string'))message({...latest,matchId:id});
      else if(fresh||detailRequested&&item.unreadCount>0)hydrate(id);
      if(!fresh&&validId(latest?.id))remember(latest.id);
      summaries.push({ matchId:id,...info,messageId:latest?.id||'',fingerprint:print,createdAt:latest?.createdAt||'',unread:item.unreadCount||0,baseline:!fresh });
    }
    post({ kind:'snapshot',items:summaries });
    if(firstPage)window.__vrcrpSiteCache?.commitMatches(value,state);
    if(firstPage&&state==='active')window.__vrcrpSiteCache?.warmList(value);
  }
  window.__vrcrpDispatchServerEvent = (type,data) => {
    if (!socket) return false;
    const event = new MessageEvent('message',{data:JSON.stringify({type,data})});
    localEvents.add(event); socket.dispatchEvent(event); return true;
  };
  function refreshList(value, state='active') {
    if (!active || document.hidden) return;
    if (value && window.__vrcrpSiteCache?.commitMatches(value,state)) return;
    if (window.__vrcrpSiteCache?.refreshList()) return;
    window.__vrcrpDispatchServerEvent('match.updated',{});
  }
  async function sync() {
    if (!userId || !active || document.hidden || busy || !navigator.onLine) return;
    busy = true;
    let owner = epoch;
    const readStamp=window.__vrcrpSiteCache?.readVersion?.();
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 12000);
    try {
      const options = { credentials: 'include', cache: 'no-store', headers: requestHeaders, signal: controller.signal };
      const states = window.__vrcrpSiteCache?.states() || ['active'];
      let nextCursor=null;
      const responses = await Promise.all([originalFetch.call(window,'/api/v1/me/counters',options),originalFetch.call(window,'/api/v1/matches?state=active',options),...(states.includes('unmatched')?[originalFetch.call(window,'/api/v1/matches?state=unmatched',options)]:[])]);
      if (owner !== epoch) return;
      if (responses.some(r => r.status === 401)) { session(null); return; }
      retryDelay = responses.some(r => r.status === 429 || r.status >= 500) ? 30000 : 0;
      for (const r of responses) if (r.status === 429) retryDelay = Math.max(retryDelay, Math.min(120000, (Number(r.headers.get('Retry-After')) || 30) * 1000));
      for (let i=0;i<responses.length;i++) if (responses[i].ok) {
        const value = unwrap(await responses[i].json()); if (owner !== epoch) return;
        if (i === 0) {
          const reconciled=window.__vrcrpSiteCache?.reconcileCounters?.(value,readStamp)||value;
          counters(reconciled);
          if (!window.__vrcrpSiteCache?.commitCounters(reconciled)) window.__vrcrpDispatchServerEvent('counters',reconciled);
        } else {
          if (i === 1){snapshot(value);nextCursor=value?.nextCursor;}
          if (location.pathname === '/matches') refreshList(value,i===1?'active':'unmatched');
        }
      }
      await Promise.allSettled([...hydration.values()]);
      const cursors=new Set();
      // A new unread conversation may be beyond the summary's first page.
      for(let page=0;detailRequested&&nextCursor&&page<6&&!cursors.has(nextCursor);page++){
        cursors.add(nextCursor);
        const r=await originalFetch.call(window,'/api/v1/matches?state=active&cursor='+encodeURIComponent(nextCursor),options);
        if(owner!==epoch||!r.ok)break;
        const value=unwrap(await r.json());if(owner!==epoch)break;
        snapshot(value,'active',false);nextCursor=value?.nextCursor;
        await Promise.allSettled([...hydration.values()]);
      }
      if (/^\/matches\/[^/]+$/.test(location.pathname)) window.__vrcrpSiteCache?.refreshChat().catch(()=>{});
    } catch { if(owner===epoch)retryDelay = 30000; } finally { busy = false; controller = null; clearTimeout(timeout); }
  }
  function schedule(delay) {
    clearTimeout(pollTimer);
    if (!userId || !active || document.hidden) return;
    if (busy) { if(delay<=350)syncAgain=true; return; }
    pollTimer = setTimeout(async () => { await sync(); const urgent=syncAgain;syncAgain=false; schedule(Math.max(retryDelay,urgent?200:['/matches','/notifications','/me','/likes','/visitors'].includes(location.pathname)?2000:/^\/matches\/[^/]+$/.test(location.pathname)?4000:5000)); }, delay);
  }
  window.__vrcrpSyncChats = () => schedule(0);
  window.__vrcrpAppActive = value => { active = value === true;window.__vrcrpForeground=active;window.__vrcrpRefreshNotificationReads?.(); window.__vrcrpSiteCache?.active(active); if (active) schedule(0); else clearTimeout(pollTimer); };
  window.fetch = function (...args) {
    let owner = epoch;
    const readStamp=window.__vrcrpSiteCache?.readVersion?.();
    const result = Reflect.apply(originalFetch,this,args);
    let url, method;
    try {
      url = new URL(args[0] instanceof Request ? args[0].url : String(args[0]),location.href);
      method = String(args[1]?.method || (args[0] instanceof Request ? args[0].method : 'GET')).toUpperCase();
      if (url.origin === location.origin && url.pathname.startsWith('/api/v1/')) {
        const h = new Headers(args[1]?.headers || (args[0] instanceof Request ? args[0].headers : {}));
        const mode = h.get('X-Content-Mode'), language = h.get('Accept-Language');
        const changed = mode && mode !== requestHeaders['X-Content-Mode'] || language && language !== requestHeaders['Accept-Language'];
        if (['sfw','mixed','r18','nsfw'].includes(mode)) requestHeaders['X-Content-Mode'] = mode;
        if (language && language.length < 80) requestHeaders['Accept-Language'] = language;
        if(changed){epoch++;controller?.abort();retryDelay=0;if(userId){postSession();schedule(0);}}
      }
    } catch {}
    owner=epoch;
    if (url?.origin === location.origin) result.then(response => {
      if (owner !== epoch) return;
      if (url.pathname === '/api/v1/me' && response.status === 401 || url.pathname === '/api/v1/auth/logout' && response.ok) { session(null); return; }
      if(response.ok && method==='POST' && (/^\/api\/v1\/matches\/[^/]+\/(read|messages)$/.test(url.pathname)||url.pathname==='/api/v1/notifications/read'||/^\/api\/v1\/announcements\/[^/]+\/read$/.test(url.pathname)))schedule(0);
      if(response.ok && method==='GET' && ['/api/v1/likes/received','/api/v1/visitors'].includes(url.pathname))schedule(150);
      if (!response.ok || method !== 'GET') return;
      if (['/api/v1/me','/api/v1/me/counters','/api/v1/matches'].includes(url.pathname)) response.clone().json().then(data => {
        if (owner !== epoch) return;
        const value = unwrap(data);
        if (url.pathname === '/api/v1/me') session(value);
        else if (url.pathname.endsWith('/counters')) counters(window.__vrcrpSiteCache?.reconcileCounters?.(value,readStamp)||value);
        else snapshot(value, url.searchParams.get('state') || 'active', !url.searchParams.has('cursor'));
      }).catch(()=>{});
    }).catch(()=>{});
    return result;
  };
  window.WebSocket = new Proxy(OriginalWebSocket,{
    construct(target,args,newTarget) {
      const connection = Reflect.construct(target,args,newTarget);
      let url; try { url = new URL(String(args[0]),location.href); } catch {}
      if (url?.protocol === 'wss:' && url.host === location.host && url.pathname === '/api/v1/ws') {
        socket = connection;
        connection.addEventListener('message',event => { try {
          if (connection !== socket || localEvents.has(event)) return;
          const value = JSON.parse(event.data);
          window.__vrcrpSiteCache?.serverEvent(value.type,value.data);
          if (value.type === 'counters') counters(value.data);
          else if (value.type === 'message.new') { if(!matches.get(value.data?.matchId)?.displayId && validId(value.data?.matchId)){const owner=epoch;hydrate(value.data.matchId).finally(()=>{if(owner===epoch)message(value.data);});}else message(value.data); if (location.pathname === '/matches') setTimeout(()=>refreshList(),0); schedule(150); }
          else if (['match.new','match.updated','match.closed','message.recalled','presence.updated','account.updated','notification.new','like.received','like.new','visitor.new','announcement.new','announcement.changed','reconnected'].includes(value.type)) { if(location.pathname==='/matches')refreshList(); schedule(150); }
        } catch {} });
        connection.addEventListener('open',()=>schedule(0));
        connection.addEventListener('close',()=>schedule(1000));
      }
      return connection;
    }
  });
  document.addEventListener('visibilitychange',()=>{ if (!document.hidden) schedule(0); else clearTimeout(pollTimer); });
  window.addEventListener('online',()=>schedule(0));
  window.addEventListener('popstate',()=>schedule(0));
  window.addEventListener('pageshow',()=>schedule(0));
  window.addEventListener('focus',()=>schedule(0));
})();
