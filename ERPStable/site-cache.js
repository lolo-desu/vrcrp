(() => {
  'use strict';
  if (window !== window.top || location.origin !== 'https://erp.sex' || !window.webkit?.messageHandlers?.erpNativeApp) return;
  const network = window.fetch, bodies = new Map(), flights = new Map(), ownedControllers = new Set();
  let user = '', epoch = 0, queryClient = null, bus = null, importing = false, active = true;
  let headers = { Accept: 'application/json', 'X-Content-Mode': 'sfw' };
  let warmVisit = '', warmCount = 0;
  const revisions=new Map(), pendingRefresh=new Map();
  let unsubscribe=null, refreshTimer=0, pollTimer=0, pauseUntil=0;
  let warmTimer=0;
  const listWarming=new Map();
  const pendingEvents=[];
  const idOK = value => typeof value === 'string' && /^[\w-]{1,120}$/.test(value);
  const unwrap = value => value?.data ?? value;
  const family=q=>q.queryKey?.[0]==='m'?q.queryKey[3]:({ownProfile:'profile',myTonight:'profile',worldRef:'world'}[q.queryKey?.[0]]||q.queryKey?.[0]);
  const scoped=q=>q.queryKey?.[0]!=='m'||q.queryKey[1]===headers['X-Content-Mode']&&(!headers['Accept-Language']||q.queryKey[2]===headers['Accept-Language']);
  const observed=q=>typeof q.isActive==='function'?q.isActive():q.getObserversCount()>0;
  const pageFamilies=new Set(['likes','visitors','notifications','posts','profile','guestbook','guestbookDanmaku','browse','world','worldUsers','sameModel']);
  const livePage=q=>pageFamilies.has(family(q))&&!['ownProfile','myTonight','worldRef'].includes(q.queryKey?.[0]);
  function resource(url){
    const p=url.pathname.slice('/api/v1/'.length).split('/');
    if(p[0]==='profiles')return p[2]==='guestbook'?'guestbook':'profile';
    if(p[0]==='worlds')return p[2]==='users'?'worldUsers':'world';
    if(p[0]==='users'&&p[2]==='posts')return 'posts';
    if(p[0]==='guestbook')return p[1]==='danmaku'?'guestbookDanmaku':'guestbook';
    return p[0];
  }
  const revision=d=>revisions.get(d.resource)||0;
  function stopSync(){clearTimeout(refreshTimer);clearTimeout(pollTimer);clearTimeout(warmTimer);refreshTimer=pollTimer=warmTimer=0;queryClient?.cancelQueries({predicate:q=>listWarming.has(JSON.stringify(q.queryKey))},{silent:true}).catch(()=>{});listWarming.clear();unsubscribe?.();unsubscribe=null;pendingRefresh.clear();revisions.clear();pendingEvents.length=0;pauseUntil=0;}
  const foreground=()=>active&&!document.hidden&&navigator.onLine!==false&&!!user;
  function queueRefresh(groups,at=Date.now(),passive=false){
    for(const group of groups){const before=pendingRefresh.get(group);pendingRefresh.set(group,{at:Math.max(at,before?.at||0),passive:before?before.passive&&passive:passive});}
    clearTimeout(refreshTimer);if(foreground())refreshTimer=setTimeout(flushRefresh,120);
  }
  function flushRefresh(){
    refreshTimer=0;if(!foreground())return;
    const c=client();if(!c)return;
    const pending=new Map(pendingRefresh);pendingRefresh.clear();
    // Site mutation handlers may already have fetched this exact query.
    // Keep their request, and refresh only observers that still need new data.
    c.refetchQueries({type:'active',predicate:q=>{
      const intent=pending.get(family(q));
      if(!scoped(q)||!intent||q.state.fetchStatus==='fetching')return false;
      if(intent.passive&&(!livePage(q)||q.state.status==='error'&&Date.now()-(q.state.errorUpdatedAt||0)<30000))return false;
      return q.state.isInvalidated||q.state.dataUpdatedAt<intent.at;
    }},{cancelRefetch:false}).catch(()=>{});
  }
  function changed(groups){
    const affected=new Set(groups);for(const group of affected)revisions.set(group,(revisions.get(group)||0)+1);
    for(const [key,b] of bodies)if(affected.has(b.d.resource))bodies.delete(key);
    // An older request can finish, but cannot populate the cache after a write.
    // A fresh refetch must not be coalesced with that older request either.
    for(const [key,f] of flights)if(affected.has(f.resource))flights.delete(key);
    const c=client();if(c){
      const predicate=q=>scoped(q)&&affected.has(family(q));
      c.cancelQueries({predicate},{silent:true}).catch(()=>{});
      c.invalidateQueries({predicate,refetchType:'none'}).catch(()=>{});
    }
    queueRefresh(affected);
    scheduleListWarm();
  }
  function armPoll(){
    if(pollTimer||!foreground())return;
    const c=client();if(pollTimer||!c||!c.getQueryCache().getAll().some(q=>scoped(q)&&observed(q)&&livePage(q)))return;
    pollTimer=setTimeout(()=>{
      pollTimer=0;if(!foreground())return;
      const c=client();if(!c)return;
      if(Date.now()>=pauseUntil){
        const groups=new Set(c.getQueryCache().getAll().filter(q=>scoped(q)&&observed(q)&&livePage(q)&&q.state.fetchStatus!=='fetching'&&Date.now()-Math.max(q.state.dataUpdatedAt,q.state.errorUpdatedAt||0)>(q.state.status==='error'?30000:4000)).map(family));
        if(groups.size)queueRefresh(groups,Date.now()-4000,true);
      }
      armPoll();
    },bus?.status==='open'?20000:5000);
  }
  function watch(c){
    if(unsubscribe)return;
    unsubscribe=c.getQueryCache().subscribe(event=>{
      if(event.type==='observerAdded'&&scoped(event.query)&&livePage(event.query)&&event.query.state.data!==undefined)queueRefresh([family(event.query)],Date.now()-1500,true);
      if(event.type==='observerAdded'||event.type==='observerRemoved')armPoll();
    });armPoll();
  }
  // These are the site's actual infinite-list keys. Warm data only: the
  // component's on-screen read/seen effects must never run during preloading.
  const warmLists=[
    {key:['likes','received'],url:'/api/v1/likes/received'},
    {key:['likes','sent'],url:'/api/v1/likes/sent'},
    {key:['visitors'],url:'/api/v1/visitors'},
    {key:['notifications'],url:'/api/v1/notifications',global:true},
    {key:['matches','active'],url:'/api/v1/matches?state=active'},
    {key:['matches','unmatched'],url:'/api/v1/matches?state=unmatched'}
  ];
  function scheduleListWarm(){
    if(warmTimer||!foreground())return;
    warmTimer=setTimeout(()=>{warmTimer=0;preloadLists();},250);
  }
  async function preloadLists(){
    if(!foreground()||Date.now()<pauseUntil)return;
    const c=client();if(!c){scheduleListWarm();return;}
    // Prefer an existing scope; the API client's exact language header also
    // lets the home page warm lists before any scoped tab has been mounted.
    const scopedQueries=scopes(c),sample=scopedQueries.find(q=>observed(q))||scopedQueries[0];
    if(!sample&&!headers['Accept-Language']){scheduleListWarm();return;}
    const prefix=sample?.queryKey.slice(0,3)||['m',headers['X-Content-Mode'],headers['Accept-Language']],owner=epoch;
    await Promise.allSettled(warmLists.map(async list=>{
      const key=list.global?list.key:[...prefix,...list.key],token=JSON.stringify(key),q=c.getQueryCache().find({queryKey:key,exact:true});
      if(listWarming.has(token)||q&&(observed(q)||q.state.fetchStatus==='fetching'||q.state.status==='error'&&Date.now()-(q.state.errorUpdatedAt||0)<30000||q.state.data!==undefined&&!q.state.isInvalidated))return;
      listWarming.set(token,owner);
      try{
        await c.prefetchInfiniteQuery({
          queryKey:key,initialPageParam:null,staleTime:15000,retry:false,
          queryFn:async({pageParam,signal})=>{
            const response=await get(list.url+(pageParam?(list.url.includes('?')?'&':'?')+'cursor='+encodeURIComponent(pageParam):''));
            if(owner!==epoch||signal.aborted)throw new DOMException('Cancelled preload','AbortError');
            if(!response?.ok)throw new Error('List preload failed');
            const value=unwrap(await response.json());
            if(owner!==epoch||signal.aborted)throw new DOMException('Cancelled preload','AbortError');
            if(!value||typeof value!=='object'||!Array.isArray(value.items)&&value.locked!==true)throw new Error('Invalid list');
            return value;
          },
          getNextPageParam:page=>page.locked?undefined:page.nextCursor??undefined
        });
      }finally{if(listWarming.get(token)===owner)listWarming.delete(token);}
    }));
  }
  function backoff(response){
    if(response.status===429||response.status>=500)pauseUntil=Math.max(pauseUntil,Date.now()+Math.min(120000,Math.max(30000,(Number(response.headers.get('Retry-After'))||0)*1000)));
  }
  function patchItems(c,predicate,update){
    for(const q of c.getQueryCache().getAll())if(scoped(q)&&predicate(q))c.setQueryData(q.queryKey,old=>{
      if(!old)return old;
      if(Array.isArray(old.pages))return {...old,pages:old.pages.map(page=>Array.isArray(page.items)?{...page,items:update(page.items)}:page)};
      return Array.isArray(old.items)?{...old,items:update(old.items)}:old;
    });
  }
  function mutationPlan(url,method){
    if(!['POST','PATCH','PUT','DELETE'].includes(method)||url.origin!==location.origin)return null;
    const p=url.pathname.slice('/api/v1/'.length).split('/');let groups;
    // Chat read/send already have an immediate, message-specific sync path.
    if(p[0]==='matches'&&['read','messages'].includes(p[2])||p[0]==='messages'&&p[2]==='translate')return null;
    if(p[0]==='swipes'||p[0]==='likes')groups=['likes','profile','browse','matches','counters','energy','passes'];
    else if(p[0]==='posts'||p[0]==='guestbook'||p[0]==='profiles'&&p[2]==='guestbook')groups=['posts','profile','guestbook','guestbookDanmaku','notifications','counters'];
    else if(p[0]==='profiles'||p[0]==='me'&&['profile','reactions','avatar','avoid','passes','vrc','settings','tag-attitudes','tonight'].includes(p[1])||p[0]==='users'&&p[2]==='block')groups=['me','profile','tagAttitudes','browse','likes','visitors','worldUsers','sameModel','blocks','avoid','counters',...(p[2]==='block'?['matches']:[])];
    else if(p[0]==='notifications')groups=['notifications','counters'];
    else if(p[0]==='matches'||p[0]==='messages')groups=['matches','counters'];
    else if(p[0]==='visitors')groups=['visitors','counters'];
    else if(p[0]==='worlds')groups=['world','worldUsers','profile'];
    return groups?{groups,path:p,method}:null;
  }
  function mutationSucceeded(plan,body){
    changed(plan.groups);const c=client();if(!c)return;
    const p=plan.path,target=body?.targetId;
    // Patch only consequences confirmed by the successful server operation.
    // Keep loaded pages/pageParams, then reconcile their cursor boundaries.
    if(p[0]==='swipes'&&p.length===1&&idOK(target)&&['like','pass','superlike'].includes(body?.action)){
      patchItems(c,q=>family(q)==='likes'&&q.queryKey[4]==='received',items=>items.filter(item=>item.user?.id!==target));
      for(const q of c.getQueryCache().getAll())if(scoped(q)&&family(q)==='profile'&&q.queryKey[4]===target)c.setQueryData(q.queryKey,old=>old?.relation?{...old,relation:{...old.relation,swiped:body.action}}:old);
    }
    if(p[0]==='likes'&&p[1]==='sent'&&idOK(p[2])&&plan.method==='DELETE')patchItems(c,q=>family(q)==='likes'&&q.queryKey[4]==='sent',items=>items.filter(item=>item.user?.id!==p[2]));
    if(p[0]==='posts'&&idOK(p[1])&&p.length===2&&plan.method==='DELETE')patchItems(c,q=>family(q)==='posts',items=>items.filter(item=>item.id!==p[1]));
    if(p[0]==='notifications'&&p[1]==='read'){
      const ids=new Set(Array.isArray(body?.ids)?body.ids.filter(idOK):[]);
      patchItems(c,q=>family(q)==='notifications',items=>items.map(item=>body?.all===true||ids.has(item.id)?{...item,read:true}:item));
    }
    // setQueryData must not make inactive/other variants look authoritative.
    c.invalidateQueries({predicate:q=>scoped(q)&&plan.groups.includes(family(q)),refetchType:'none'}).catch(()=>{});
    if(plan.groups.includes('matches'))window.__vrcrpSyncChats?.();
  }
  function configure(next) {
    const mode = next['X-Content-Mode'] || headers['X-Content-Mode'];
    const language = next['Accept-Language'] || headers['Accept-Language'] || '';
    if (mode !== headers['X-Content-Mode'] || language !== (headers['Accept-Language'] || '')) { epoch++;stopSync();for(const c of ownedControllers)c.abort(); bodies.clear(); flights.clear(); warmVisit = ''; warmCount = 0; }
    headers = { ...headers, ...next };
  }
  const isClient = value => value && typeof value.getQueryCache === 'function' && typeof value.setQueryData === 'function' && typeof value.invalidateQueries === 'function';
  function client() {
    if (!queryClient) {
      // Read the existing provider; all changes use TanStack's public methods.
      // If React changes this attachment, the WS/refetch fallback remains usable.
      const root = document.getElementById('root');
      const key = root && Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      const fiber = key && root[key];
      const queue = fiber ? [fiber.stateNode?.current || fiber] : [];
      const visited = new Set();
      for (let n = 0; queue.length && n < 500; n++) {
        const node = queue.shift(); if (!node || visited.has(node)) continue; visited.add(node);
        const value = node.memoizedProps?.value;
        if (isClient(value)) { queryClient = value; break; }
        if (node.child) queue.push(node.child); if (node.sibling) queue.push(node.sibling);
      }
    }
    if (!queryClient || !user || String(queryClient.getQueryData(['me'])?.id || '') !== user) return null;
    watch(queryClient);
    return queryClient;
  }
  function scopes(c) {
    const queries = c.getQueryCache().getAll().filter(q => Array.isArray(q.queryKey) && q.queryKey[0] === 'm' && q.queryKey[1] === headers['X-Content-Mode']);
    if(headers['Accept-Language'])return queries.filter(q=>q.queryKey[2]===headers['Accept-Language']);
    const observed=queries.filter(q=>q.getObserversCount()>0);return observed.length?observed:queries;
  }
  function commitCounters(value) {
    const c = client(); if (!c || !value || !Number.isSafeInteger(value.unreadMessages)) return false;
    const previous=c.getQueryData(['counters']);c.setQueryData(['counters'], value);
    if(previous){const groups=[];if(value.newLikes!==previous.newLikes)groups.push('likes');if(value.newVisitors!==previous.newVisitors)groups.push('visitors');if(value.unreadNotifications!==previous.unreadNotifications)groups.push('notifications');if(groups.length)changed(groups);}
    scheduleListWarm();return true;
  }
  function commitMatches(value, state = 'active') {
    const c = client(); if (!c || !Array.isArray(value?.items)) return false;
    let applied = false;
    for (const q of scopes(c)) {
      const k = q.queryKey;
      if (k[3] !== 'matches' || k[4] !== state || k.length !== 5) continue;
      c.setQueryData(k, old => {
        if (!old?.pages?.length || !Array.isArray(old.pages[0]?.items)) return old;
        applied = true;
        const firstIDs = new Set(value.items.map(i => i.id));
        const displaced = old.pages[0].items.filter(i => !firstIDs.has(i.id));
        const seen = new Set(firstIDs);
        const rest = old.pages.slice(1).map((page, index) => ({ ...page, items: [...(index === 0 ? displaced : []), ...page.items].filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; }) }));
        return { ...old, pages: [value, ...rest] };
      });
      // Keep cursor boundaries correct when the user has loaded later pages.
      if (q.state.data?.pages?.length > 1) c.invalidateQueries({ queryKey: k, exact: true, refetchType: 'active' }).catch(() => {});
    }
    return applied;
  }
  function commitDetail(id, value) {
    const c = client(); if (!c || !value || value.id && value.id !== id) return;
    const list = scopes(c);
    const prefixes = new Map(list.map(q => [JSON.stringify(q.queryKey.slice(0,3)), q.queryKey.slice(0,3)]));
    for (const prefix of prefixes.values()) c.setQueryData([...prefix, 'matches', 'detail', id], value);
  }
  function refreshList() {
    const c = client(); if (!c) return emit('match.updated', {});
    c.invalidateQueries({ predicate: q => q.queryKey[0] === 'm' && q.queryKey[3] === 'matches' && q.queryKey.length === 5, refetchType: 'active' }).catch(() => {});
    return true;
  }
  function findBus() {
    if (bus || importing || !queryClient) return;
    const script = [...document.querySelectorAll('script[type="module"][src]')].find(s => new URL(s.src, location.href).origin === location.origin && /\/assets\/index-[^/]+\.js$/.test(new URL(s.src, location.href).pathname));
    if (!script) return;
    importing = true;const owner=epoch;
    // This is the already executed module URL, so import reuses its instance.
    import(script.src).then(module => {
      if(owner!==epoch)return;
      bus = Object.values(module).find(v => v && typeof v.on === 'function' && typeof v.emit === 'function' && typeof v.resume === 'function' && ['open','closed','connecting'].includes(v.status)) || null;
      if(bus){for(const event of pendingEvents.splice(0))if(event.owner===epoch)bus.emit(event.type,event.value);}
    }).catch(() => {}).finally(() => { if(owner===epoch)importing = false; });
  }
  function emit(type, value) {
    client(); findBus();
    if (bus) { bus.emit(type, value); return true; }
    if(window.__vrcrpDispatchServerEvent?.(type, value)===true)return true;
    if(importing && JSON.stringify(value).length<32768){pendingEvents.push({owner:epoch,type,value});if(pendingEvents.length>60)pendingEvents.shift();return true;}
    return false;
  }
  function descriptor(url, method = 'GET') {
    if (method !== 'GET' || url.origin !== location.origin || !user) return null;
    const m = url.pathname.match(/^\/api\/v1\/matches\/([\w-]{1,120})(\/messages)?$/);
    if (!m) {
      if (!/^\/api\/v1\/(notifications|posts|worlds|users|profiles|likes|visitors)(?:\/|$)/.test(url.pathname)&&url.pathname!=='/api/v1/matches') return null;
      if (/\/(auth|token|export|download|check|verify)(?:\/|$)/.test(url.pathname)) return null;
      return { page:true, resource:resource(url),url, key:JSON.stringify([user,headers['X-Content-Mode'],headers['Accept-Language'] || '',url.pathname+url.search]) };
    }
    if (m[2] && (url.searchParams.has('before') || url.searchParams.has('after') || url.searchParams.get('limit') && url.searchParams.get('limit') !== '50')) return null;
    return { id: m[1], resource:'matches',messages: !!m[2], url, key: JSON.stringify([user,headers['X-Content-Mode'],headers['Accept-Language'] || '',url.pathname + url.search]) };
  }
  function save(d, response, raw, prior) {
    if (!response.ok || response.status !== 200) return;
    const value = unwrap(raw);
    if (d.messages ? !Array.isArray(value?.items) : !value || typeof value !== 'object') return;
    const text = JSON.stringify(raw); if (text.length > 1024 * 1024) return;
    bodies.delete(d.key); bodies.set(d.key,{ d, raw, text, at: Date.now(), headers: [...response.headers] });
    while (bodies.size > 32 || [...bodies.values()].reduce((n,b) => n + b.text.length,0) > 6 * 1024 * 1024) bodies.delete(bodies.keys().next().value);
    if (d.page) {
      const c=client();
      // Update already-existing notification queries after validating warm data.
      // Do not guess keys for unrelated profile, post or world queries.
      if(c && d.url.pathname==='/api/v1/notifications' && !d.url.searchParams.has('cursor')) {
        for(const q of c.getQueryCache().getAll())if(q.queryKey.some(k=>k==='notifications') && (q.queryKey[0]!=='m'||q.queryKey[1]===headers['X-Content-Mode']&&(!headers['Accept-Language']||q.queryKey[2]===headers['Accept-Language']))) {
          c.setQueryData(q.queryKey,old=>{
            if(!old)return old;
            if(old.pages?.length&&Array.isArray(value.items))return {...old,pages:[value,...old.pages.slice(1)]};
            return Array.isArray(old.items)&&Array.isArray(value.items)?value:old;
          });
        }
      }
    } else if (!d.messages) commitDetail(d.id, value);
    else if (prior && location.pathname === '/matches/' + d.id) {
      const old = new Map((unwrap(prior.raw)?.items || []).map(m => [m.id,m]));
      for (const m of value.items) {
        if (!idOK(m.id)) continue;
        const before = old.get(m.id);
        if (!before || JSON.stringify(before) !== JSON.stringify(m)) emit('message.new', { ...m, matchId: d.id });
        if (m.recalled && !before?.recalled) emit('message.recalled',{matchId:d.id,messageId:m.id});
      }
    }
  }
  function request(d, args, receiver = window) {
    const flight=flights.get(d.key);
    if(flight&&flight.revision===revision(d))return flight.response.then(r=>r.clone());
    const owner = epoch, stamp=revision(d),prior = bodies.get(d.key);
    const result = Reflect.apply(network, receiver, args);
    const owned = result.then(r => r.clone()),record={response:owned,resource:d.resource,revision:stamp};flights.set(d.key,record);
    owned.then(response => {
      if (response.status === 401 && owner === epoch) reset('');
      if(owner===epoch)backoff(response);
      if (!response.ok) return;
      return response.clone().json().then(raw => { if (owner === epoch&&stamp===revision(d)) save(d, response, raw, prior); });
    }).catch(error => {if(owner===epoch&&error?.name!=='AbortError')pauseUntil=Date.now()+30000;}).finally(() => { if (flights.get(d.key) === record) flights.delete(d.key); });
    return result;
  }
  function get(url) {
    const resolved = new URL(url, location.href), d = descriptor(resolved);
    if (!d) return Promise.resolve(null);
    const control=new AbortController();ownedControllers.add(control);const timeout=setTimeout(()=>control.abort(),9000);
    return request(d,[resolved.href,{credentials:'include',headers,cache:'no-store',signal:control.signal}]).finally(()=>{clearTimeout(timeout);ownedControllers.delete(control);});
  }
  window.fetch = function (...args) {
    let d, mutation, signal, plan,bodyPromise,method = 'GET';
    try {
      const request = args[0] instanceof Request ? args[0] : null;
      signal=args[1]?.signal || request?.signal;
      const url = new URL(request?.url || String(args[0]),location.href);
      method = String(args[1]?.method || request?.method || 'GET').toUpperCase();
      if (url.origin === location.origin && url.pathname.startsWith('/api/v1/')) {
        const h = new Headers(args[1]?.headers || request?.headers || {});
        const next = {};
        if (['sfw','mixed','r18'].includes(h.get('X-Content-Mode'))) next['X-Content-Mode'] = h.get('X-Content-Mode');
        if (h.get('Accept-Language')) next['Accept-Language'] = h.get('Accept-Language');
        configure(next);
        plan=mutationPlan(url,method);
        if(plan){
          const body=args[1]?.body;
          try{bodyPromise=typeof body==='string'&&body.length<65536?Promise.resolve(JSON.parse(body)):body===undefined&&request?.body?request.clone().json().catch(()=>null):Promise.resolve(null);}catch{bodyPromise=Promise.resolve(null);}
        }
        if (method !== 'GET' && /^\/api\/v1\/(matches|messages|auth)\//.test(url.pathname)) {
          const match = url.pathname.match(/^\/api\/v1\/matches\/([\w-]+)(?:\/|$)/);
          const recall = url.pathname.match(/^\/api\/v1\/messages\/([\w-]+)\/recall$/);
          if (recall) for (const [key,b] of bodies) if (b.d.messages && unwrap(b.raw)?.items?.some(m => m.id === recall[1])) bodies.delete(key);
          if (match && url.pathname.endsWith('/messages') && method === 'POST') mutation = match[1];
          else if (match && !url.pathname.endsWith('/read')) invalidate(match[1]);
        }
      }
      d = descriptor(url,method);
    } catch {}
    if (!d || args[1]?.cache === 'reload' || signal?.aborted) {
      const owner = epoch, result = Reflect.apply(network,this,args);
      if(plan)result.then(response=>{if(response.ok&&owner===epoch)bodyPromise.then(body=>{if(owner===epoch)mutationSucceeded(plan,body);}).catch(()=>{});}).catch(()=>{});
      if (mutation) result.then(response => { if (response.ok) response.clone().json().then(raw => { if (owner === epoch) serverEvent('message.new',{...unwrap(raw),matchId:mutation}); }).catch(() => {}); }).catch(() => {});
      return result;
    }
    const cached = bodies.get(d.key), maxAge = d.messages ? 90000 : d.page ? 300000 : 30000;
    const c=d.page?client():null;
    // TanStack already preserves mounted data while it refetches. Returning a
    // second stale HTTP cache here would falsely finish that refetch with old
    // rows. Let an executing page query receive the real network response.
    const queryRead=c?.getQueryCache().getAll().some(q=>scoped(q)&&family(q)===d.resource&&q.state.fetchStatus==='fetching');
    if (cached && !queryRead&&Date.now() - cached.at < maxAge) {
      const owner = epoch;
      // Serve the warm page immediately; validate in the background.
      if (active && !document.hidden && Date.now() - cached.at > 1200) request(d,args,this).catch(() => {});
      return Promise.resolve().then(() => {
        if (owner !== epoch) return Reflect.apply(network,this,args);
        if (signal?.aborted) throw new DOMException('Aborted','AbortError');
        return new Response(cached.text,{status:200,headers:cached.headers});
      });
    }
    return request(d,args,this);
  };
  function reset(id) {
    if (user !== id) { epoch++;stopSync();for(const c of ownedControllers)c.abort(); bodies.clear(); flights.clear(); queryClient = null; bus = null;importing=false; warmVisit = ''; warmCount = 0; }
    user = idOK(id) ? id : '';
  }
  function invalidate(id) { for (const [k,b] of bodies) if (b.d.id === id) bodies.delete(k); }
  function serverEvent(type, value) {
    if (!user) return;
    const eventGroups=type==='notification.new'?['notifications']:type==='like.received'||type==='like.new'?['likes','profile']:type==='visitor.new'?['visitors']:type==='profile.updated'?['profile','browse','likes']:type.startsWith('post.')?['posts']:type.startsWith('guestbook.')?['guestbook','guestbookDanmaku']:type==='account.updated'?['me','profile','likes','browse']:[];
    if(eventGroups.length)changed(eventGroups);
    if (['match.closed','match.updated','message.recalled','account.updated'].includes(type)) {
      if (idOK(value?.matchId)) invalidate(value.matchId); else if (type === 'account.updated') bodies.clear();
    }
    if (type === 'message.new' && idOK(value?.id) && idOK(value?.matchId)) {
      for (const b of bodies.values()) if (b.d.messages && b.d.id === value.matchId) {
        const payload = unwrap(b.raw), map = new Map(payload.items.map(m => [m.id,m])); map.set(value.id,value);
        const all = [...map.values()].sort((a,b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.id.localeCompare(b.id));
        payload.items = all.slice(-50); payload.hasMore = payload.hasMore || all.length > 50;
        b.text = JSON.stringify(b.raw);
      }
    }
  }
  function prefetch(id) {
    if (!user || !idOK(id) || !active || document.hidden) return;
    for (const suffix of ['', '/messages?limit=50']) {
      const url = '/api/v1/matches/' + id + suffix, d = descriptor(new URL(url,location.href));
      if (!d) continue;
      const b = bodies.get(d.key);
      if (!b || Date.now() - b.at > (d.messages ? 60000 : 15000)) get(url).catch(() => {});
    }
  }
  function warmList(value) {
    if (location.pathname !== '/matches' || !Array.isArray(value?.items)) return;
    const visit = history.state?.key || 'initial';
    if (warmVisit !== visit) { warmVisit = visit; warmCount = 0; }
    if (warmCount) return;
    warmCount = 1; value.items.slice(0,3).forEach(item => prefetch(item.id));
  }
  window.__vrcrpSiteCache = {
    session(id, nextHeaders) { reset(id); if (nextHeaders) configure(nextHeaders);scheduleListWarm(); },
    active(value) { active = value === true;if(!active){clearTimeout(pollTimer);clearTimeout(refreshTimer);clearTimeout(warmTimer);pollTimer=refreshTimer=warmTimer=0;}else{queueRefresh(pageFamilies,Date.now()-1500,true);armPoll();scheduleListWarm();} }, commitCounters, commitMatches, refreshList, warmList, prefetch, serverEvent, preloadLists,
    pageChanged(){if(foreground()){armPoll();scheduleListWarm();}},
    refreshPage() {
      const c=client();if(!c)return false;
      const groups=new Set(c.getQueryCache().getAll().filter(q=>scoped(q)&&observed(q)).map(family));changed(groups);
      pendingRefresh.clear();clearTimeout(refreshTimer);refreshTimer=0;
      return c.refetchQueries({type:'active',predicate:q=>scoped(q)&&groups.has(family(q))},{cancelRefetch:false}).then(()=>true,()=>true);
    },
    states() { const c = client(); return c ? [...new Set(scopes(c).filter(q => q.getObserversCount() > 0 && q.queryKey[3] === 'matches' && q.queryKey.length === 5).map(q => q.queryKey[4]))].filter(s => s === 'active' || s === 'unmatched') : ['active']; },
    async refreshChat() {
      const m = location.pathname.match(/^\/matches\/([\w-]{1,120})$/); if (!m || !active || document.hidden) return;
      await Promise.allSettled([get('/api/v1/matches/'+m[1]),get('/api/v1/matches/'+m[1]+'/messages?limit=50')]);
    },
    clear() { epoch++;stopSync();for(const c of ownedControllers)c.abort(); bodies.clear(); flights.clear(); queryClient = null; bus = null;importing=false; }
  };
  document.addEventListener('pointerdown',event => {
    const a = event.target?.closest?.('a[href]'); if (!a) return;
    try { const url = new URL(a.href,location.href), m = url.pathname.match(/^\/matches\/([\w-]{1,120})$/); if (url.origin === location.origin && m) prefetch(m[1]); } catch {}
  },{capture:true,passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(pollTimer);clearTimeout(refreshTimer);clearTimeout(warmTimer);pollTimer=refreshTimer=warmTimer=0;}else if(active){queueRefresh(pageFamilies,Date.now()-1500,true);armPoll();scheduleListWarm();}});
  window.addEventListener('online',()=>{pauseUntil=0;queueRefresh(pageFamilies,Date.now()-1500,true);armPoll();});
})();
