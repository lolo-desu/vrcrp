// Exercise real TanStack Query observers, cancellation and network responses.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {QueryClient,QueryObserver}=require(path.join(process.env.TEST_NODE_MODULES||'/workspace/vrcrp-test-tools/node_modules','@tanstack/query-core'));
const tick=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture(withNotifications=false){
 const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity,gcTime:Infinity}}});client.setQueryData(['me'],{id:'self'});
 const received=['peer-1','peer-2'].map(id=>({user:{id},createdAt:'2026-01-01'}));
 const server={received,sent:clone(received),secret:[],groups:{groups:[],defaultCount:1,unmatchedCount:0},browse:[],visitors:[{user:{id:'visitor-1'},new:true}],matches:[{id:'thread-1',unreadCount:2}],posts:[{id:'post-1',text:'old'}],notifications:[{id:'notice-1',read:false}],profile:{id:'peer-1',displayName:'old',relation:{swiped:'none'}},counters:{unreadMessages:7,newLikes:3,newVisitors:1,unreadNotifications:1},failure:false};
 const timers=new Map(),requests=[],held=[];let timerID=0,offset=0,holdRead=false;
 const document=new EventTarget();document.hidden=false;document.querySelectorAll=()=>[];document.getElementById=id=>id==='root'?{__reactContainer$fixture:{memoizedProps:{value:client}}}:null;
 const location={origin:'https://erp.sex',href:'https://erp.sex/likes',pathname:'/likes'};
 const window=new EventTarget();window.top=window;window.webkit={messageHandlers:{erpNativeApp:{postMessage(){}}}};
 const response=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
 window.fetch=(input,options={})=>{
  const url=new URL(input instanceof Request?input.url:String(input),location.href),method=options.method||input.method||'GET';requests.push({url:url.pathname,method});
  const run=()=>{
   if(method!=='GET'){
    if(server.failure)return response({error:'failed'},500);
    const b=typeof options.body==='string'?JSON.parse(options.body):{};
    if(url.pathname==='/api/v1/swipes')server.received=server.received.filter(i=>i.user.id!==b.targetId);
    if(url.pathname.startsWith('/api/v1/likes/sent/')&&method==='DELETE')server.sent=server.sent.filter(i=>i.user.id!==url.pathname.split('/').at(-1));
    if(url.pathname.startsWith('/api/v1/likes/sent/')&&method==='DELETE')server.secret=server.secret.filter(i=>i.user.id!==url.pathname.split('/').at(-1));
    if(url.pathname==='/api/v1/matches/thread-1/pin')server.matches=server.matches.map(i=>i.id==='thread-1'?{...i,pinned:b.pinned}:i);
    if(url.pathname==='/api/v1/matches/thread-1/group')server.matches=server.matches.map(i=>i.id==='thread-1'?{...i,groupId:b.groupId}:i);
    if(url.pathname==='/api/v1/notifications/read'){server.notifications=server.notifications.map(i=>b.all||b.ids?.includes(i.id)?{...i,read:true}:i);server.counters.unreadNotifications=server.notifications.filter(i=>!i.read).length;}
    if(url.pathname==='/api/v1/matches/thread-1/read'){server.matches=server.matches.map(i=>({...i,unreadCount:0}));server.counters.unreadMessages=5;}
    return response({ok:true});
   }
   const p=url.pathname;
   const value=p.endsWith('/me')?{id:'self'}:p.endsWith('/messages')?{items:server.chatMessages||[]}:p.endsWith('/me/counters')?server.counters:p.endsWith('/match-groups')?server.groups:p.endsWith('/browse')?{items:server.browse,nextCursor:null}:p.endsWith('/likes/secret')?{items:server.secret,nextCursor:null}:p.endsWith('/likes/received')?{items:server.received,nextCursor:null}:p.endsWith('/likes/sent')?{items:server.sent,nextCursor:null}:p.endsWith('/visitors')?{items:server.visitors,nextCursor:null}:p.endsWith('/matches')?{items:server.matches,nextCursor:null}:p.endsWith('/notifications')?{items:server.notifications,nextCursor:null}:p.endsWith('/posts')?{items:server.posts,nextCursor:null}:server.profile;
   return response(clone(value));
  };
  const value=run();let promise;
  if(method!=='GET'&&server.blockReadResponse&&url.pathname.endsWith('/read')){promise=new Promise(resolve=>(server.heldReadResponses||=[]).push(()=>resolve(value)));}else if(method==='GET'&&holdRead){promise=new Promise(resolve=>held.push(()=>resolve(value)));}else promise=Promise.resolve(value);
  window.lastNetworkPromise=promise;return promise;
 };
 class Clock extends Date{static now(){return Date.now()+offset;}}
 const context={window,document,location,navigator:{onLine:true},URL,Headers,Request,Response,AbortController,DOMException,Date:Clock,
  setTimeout:(fn,delay)=>{const id=++timerID;timers.set(id,{fn,delay});return id},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../ERPStable/site-cache.js','utf8'),context);
 window.__vrcrpSiteCache.session('self',{'X-Content-Mode':'sfw','Accept-Language':'zh'});
 const nativeMessages=[];
 if(withNotifications){location.host='erp.sex';window.WebSocket=class extends EventTarget{incoming(value){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(value)}));}};window.webkit.messageHandlers.erpNativeNotifications={postMessage:v=>nativeMessages.push(clone(v))};context.MessageEvent=MessageEvent;vm.runInNewContext(fs.readFileSync(__dirname+'/../ERPStable/notifications.js','utf8'),context);}
 const get=url=>window.fetch(url,{headers:{'X-Content-Mode':'sfw','Accept-Language':'zh'}}).then(r=>r.json());
 const observers=[];
 function query(key,url,initial){client.setQueryData(key,initial);const observer=new QueryObserver(client,{queryKey:key,queryFn:async()=>{const value=await get(url);return initial.pages?{pages:[value],pageParams:[null]}:value},staleTime:Infinity});const off=observer.subscribe(()=>{});observers.push(off);return observer;}
 async function run(delay){const selected=[...timers].filter(([,t])=>t.delay===delay);for(const [id,t] of selected)if(timers.delete(id))await t.fn();await tick();}
 return{window,location,nativeMessages,client,server,get,query,requests,timers,document,held,run,tick,hold(v){holdRead=v},age(v){offset=v},destroy(){window.__vrcrpSiteCache.session('');for(const off of observers)off();client.clear();}};
}
const likesKey=['m','sfw','zh','likes','received'],sentKey=['m','sfw','zh','likes','sent'];
const pages=items=>({pages:[{items,nextCursor:null}],pageParams:[null]});
(async()=>{
 const f=fixture();const observer=f.query(likesKey,'/api/v1/likes/received',pages(clone(f.server.received)));
 await f.get('/api/v1/likes/received');await tick();
 // A query's explicit refetch must receive a fresh result, not a warm HTTP body.
 f.server.received.push({user:{id:'new-peer'}});await observer.refetch();await tick();
 assert.equal(f.client.getQueryData(likesKey).pages[0].items.length,3);
 // Keep two loaded pages/pageParams while removing a successfully skipped user.
 f.client.setQueryData(likesKey,{pages:[{items:[{user:{id:'peer-1'}}],nextCursor:'cursor-2'},{items:[{user:{id:'peer-2'}}],nextCursor:null}],pageParams:[null,'cursor-2']});
 const mixed=['m','r18','zh','likes','received'];f.client.setQueryData(mixed,pages([{user:{id:'peer-1'}}]));
 const write=f.window.fetch('/api/v1/swipes',{method:'POST',body:JSON.stringify({targetId:'peer-1',action:'pass'})});assert.equal(write,f.window.lastNetworkPromise);await write;await tick();
 const data=f.client.getQueryData(likesKey);assert.deepEqual(data.pageParams,[null,'cursor-2']);assert.deepEqual(data.pages.map(p=>p.items.map(i=>i.user.id)),[[],['peer-2']]);
 assert.equal(f.client.getQueryData(mixed).pages[0].items[0].user.id,'peer-1','mutation crossed content mode');
 await f.run(120);assert(!f.client.getQueryData(likesKey).pages[0].items.some(i=>i.user.id==='peer-1'));
 // A failed operation leaves the row and warm response intact.
 const before=clone(f.client.getQueryData(likesKey));f.server.failure=true;
 await f.window.fetch('/api/v1/swipes',{method:'POST',body:JSON.stringify({targetId:'peer-2',action:'pass'})});await tick();assert.deepEqual(f.client.getQueryData(likesKey),before);f.server.failure=false;
 // An old GET finishing after success cannot resurrect a removed item or cache.
 f.server.received=[{user:{id:'racing-peer'}}];await observer.refetch();await tick();f.hold(true);const oldFetch=observer.refetch();await tick();
 await f.window.fetch('/api/v1/swipes',{method:'POST',body:JSON.stringify({targetId:'racing-peer',action:'pass'})});await tick();assert.equal(f.client.getQueryData(likesKey).pages[0].items.length,0);
 f.hold(false);await f.run(120);for(const release of f.held.splice(0))release();await oldFetch;await tick();
 assert.equal(f.client.getQueryData(likesKey).pages[0].items.length,0);assert.equal((await f.get('/api/v1/likes/received')).items.length,0);
 // Cancelling a sent like and marking notifications read update mounted data.
 const sent=f.query(sentKey,'/api/v1/likes/sent',pages(clone(f.server.sent)));
 await f.window.fetch('/api/v1/likes/sent/peer-2',{method:'DELETE'});await tick();assert(!f.client.getQueryData(sentKey).pages[0].items.some(i=>i.user.id==='peer-2'));
 f.query(['notifications'],'/api/v1/notifications',pages(clone(f.server.notifications)));
 await f.window.fetch('/api/v1/notifications/read',{method:'POST',body:JSON.stringify({ids:['notice-1']})});await tick();assert.equal(f.client.getQueryData(['notifications']).pages[0].items[0].read,true);
 // Site-owned refetch plus our batch must share one network request.
 f.hold(true);let count=f.requests.filter(r=>r.url==='/api/v1/likes/sent'&&r.method==='GET').length;
 await f.window.fetch('/api/v1/likes/sent/peer-1',{method:'DELETE'});await tick();const own=sent.refetch();await tick();await f.run(120);
 assert.equal(f.requests.filter(r=>r.url==='/api/v1/likes/sent'&&r.method==='GET').length-count,1);
 f.hold(false);for(const release of f.held.splice(0))release();await own;await tick();
 // Passive updates must not reload an editor's own profile or its draft.
 f.query(['ownProfile'],'/api/v1/me/profile',{id:'self',displayName:'draft source'});
 // Visible page polling/resume works without WS; hidden pages stop polling.
 f.age(6000);f.server.received=[{user:{id:'new-live'}}];await f.run(5000);await f.run(120);assert.equal(f.client.getQueryData(likesKey).pages[0].items[0].user.id,'new-live');
 f.document.hidden=true;f.document.dispatchEvent(new Event('visibilitychange'));assert(![...f.timers.values()].some(t=>t.delay===5000));
 const n=f.requests.length;await f.run(5000);await f.run(120);assert.equal(f.requests.length,n);
 f.document.hidden=false;f.server.received=[{user:{id:'resumed-live'}}];f.document.dispatchEvent(new Event('visibilitychange'));await f.run(120);assert.equal(f.client.getQueryData(likesKey).pages[0].items[0].user.id,'resumed-live');
 assert(!f.requests.some(r=>r.url==='/api/v1/me/profile'&&r.method==='GET'),'passive refresh reread editor draft source');
 // Mutation response from an earlier account cannot affect the current one.
 f.hold(true);const late=f.get('/api/v1/likes/received');f.window.__vrcrpSiteCache.session('other');f.client.setQueryData(['me'],{id:'other'});f.hold(false);for(const release of f.held.splice(0))release();await late;await tick();
 assert([...f.timers.values()].every(t=>t.delay===250),'previous account left sync work active');f.destroy();assert.equal(f.timers.size,0);
 // Warm safe lists before visiting tabs without consuming incoming reminders.
 const g=fixture();
 g.window.__vrcrpSiteCache.commitCounters({unreadMessages:2,newLikes:3,newVisitors:1,unreadNotifications:1});
 await g.window.__vrcrpSiteCache.preloadLists();await tick();
 assert.equal(g.client.getQueryData(likesKey),undefined);
 assert.equal(g.client.getQueryData(sentKey).pages[0].items.length,2);
 assert.equal(g.client.getQueryData(['m','sfw','zh','visitors']),undefined);
 assert.equal(g.client.getQueryData(['m','sfw','zh','matches','active','','']).pages[0].items[0].unreadCount,2);
 assert.equal(g.client.getQueryData(['notifications']).pages[0].items[0].read,false);
 assert.equal(g.client.getQueryData(['counters']).newLikes,3);
 assert.equal(g.client.getQueryData(['counters']).newVisitors,1);
 assert(!g.requests.some(r=>/\/likes\/received|\/visitors/.test(r.url)),'preload consumed a visit acknowledgement');
 assert(g.requests.every(r=>r.method==='GET'),'preload marked an unseen list as read');
 const warmed=g.requests.length;await g.window.__vrcrpSiteCache.preloadLists();assert.equal(g.requests.length,warmed,'warm lists were repeatedly fetched');
 g.server.notifications=[{id:'new-background-notice',read:false}];g.window.__vrcrpSiteCache.serverEvent('notification.new',{});
 await g.run(250);assert.equal(g.client.getQueryData(['notifications']).pages[0].items[0].id,'new-background-notice','inactive notification list missed event');
 g.window.__vrcrpSiteCache.serverEvent('like.received',{});await g.run(250);
 assert.equal(g.client.getQueryData(likesKey),undefined,'background like event consumed an unseen list');
 g.document.hidden=true;g.document.dispatchEvent(new Event('visibilitychange'));const asleep=g.requests.length;
 await g.window.__vrcrpSiteCache.preloadLists();assert.equal(g.requests.length,asleep,'hidden app warmed lists');
 g.document.hidden=false;g.client.clear();g.client.setQueryData(['me'],{id:'self'});g.hold(true);
 const oldWarm=g.window.__vrcrpSiteCache.preloadLists();await tick();g.window.__vrcrpSiteCache.session('other');g.client.clear();g.client.setQueryData(['me'],{id:'other'});
 g.hold(false);for(const release of g.held.splice(0))release();await oldWarm;await tick();
 assert.equal(g.client.getQueryData(sentKey),undefined,'previous-account preload leaked');g.destroy();
 // Successful read updates shared counters immediately, preserving unseen chats.
 const r=fixture();const badgeEvents=[],readEvents=[];r.window.__vrcrpCountersChanged=v=>badgeEvents.push(clone(v));r.window.__vrcrpChatRead=v=>readEvents.push(clone(v));
 r.server.matches=[{id:'thread-1',unreadCount:2,lastMessage:{id:'last-read',senderId:'peer',createdAt:'2026-01-01'}}];
 r.query(['m','sfw','zh','matches','active'],'/api/v1/matches',pages(clone(r.server.matches)));
 r.query(['notifications'],'/api/v1/notifications',pages(clone(r.server.notifications)));
 r.client.setQueryData(['counters'],clone(r.server.counters));
 r.hold(true);const oldCounters=r.get('/api/v1/me/counters'),oldList=r.get('/api/v1/matches');await tick();
 await r.window.fetch('/api/v1/matches/thread-1/read',{method:'POST',body:JSON.stringify({lastMessageId:'last-read'})});await tick();
 assert.equal(readEvents.length,1,'successful read did not notify the shared message layer');
 assert.equal(readEvents[0].lastMessageId,'last-read');assert.equal(readEvents[0].createdAt,'2026-01-01');assert.equal(readEvents[0].userId,'self');
 assert(r.window.__vrcrpSiteCache.isMessageRead('thread-1','last-read','2026-01-01'));
 assert(r.window.__vrcrpSiteCache.isMessageRead('thread-1','older-unlisted','2025-12-31'));
 assert(!r.window.__vrcrpSiteCache.isMessageRead('thread-1','different-same-time','2026-01-01'),'same-time new message was read');
 assert.equal(r.client.getQueryData(['counters']).unreadMessages,5,'read erased other conversation counts');
 assert.equal(r.client.getQueryData(['m','sfw','zh','matches','active']).pages[0].items[0].unreadCount,0,'chat row remained unread');
 await r.window.fetch('/api/v1/notifications/read',{method:'POST',body:JSON.stringify({ids:['notice-1']})});await tick();
 assert.equal(r.client.getQueryData(['counters']).unreadNotifications,0,'header/Me counter did not clear');
 r.hold(false);for(const release of r.held.splice(0))release();
 assert.equal((await oldCounters).unreadMessages,5,'old counter response resurrected unread');
 assert.equal((await oldList).items[0].unreadCount,0,'old list response resurrected unread');
 assert.equal(badgeEvents.at(-1).unreadNotifications,0,'native counter bridge diverged');
 // A later message is authoritative, even immediately after a read.
 r.server.matches=[{id:'thread-1',unreadCount:1,lastMessage:{id:'next-unread',senderId:'peer',createdAt:'2026-01-02'}}];
 r.server.counters.unreadMessages=6;r.window.__vrcrpSiteCache.commitCounters(clone(r.server.counters));r.window.__vrcrpSiteCache.commitMatches(clone({items:r.server.matches,nextCursor:null}));
 assert.equal(r.client.getQueryData(['counters']).unreadMessages,6,'fresh unread was suppressed');
 assert.equal(r.client.getQueryData(['m','sfw','zh','matches','active']).pages[0].items[0].unreadCount,1,'new message was marked read');
 // Repeated acknowledgements and failures do not decrement unrelated reminders.
 await r.window.fetch('/api/v1/notifications/read',{method:'POST',body:JSON.stringify({ids:['notice-1']})});await tick();
 assert.equal(r.client.getQueryData(['counters']).unreadNotifications,0);
 const readCount=readEvents.length;r.server.failure=true;
 await r.window.fetch('/api/v1/matches/thread-1/read',{method:'POST',body:JSON.stringify({lastMessageId:'failed-read'})});await tick();
 assert.equal(readEvents.length,readCount,'failed read cancelled a notification');
 assert(!r.window.__vrcrpSiteCache.isMessageRead('thread-1','failed-read','2026-01-03'));
 r.server.failure=false;
 r.server.failure=true;r.client.setQueryData(['counters'],{...r.server.counters,unreadNotifications:3});
 await r.window.fetch('/api/v1/notifications/read',{method:'POST',body:JSON.stringify({all:true})});await tick();
 assert.equal(r.client.getQueryData(['counters']).unreadNotifications,3,'failed read cleared notifications');r.destroy();
 { // Actual notifications.js + QueryClient + POST read, with late message GETs.
 const n=fixture(true);await n.get('/api/v1/me');await tick();await n.run(0);
 const created=new Date().toISOString(),delayed={id:'integrated-delayed',matchId:'integrated-thread',senderId:'peer',type:'text',text:'已经读过',createdAt:created};
 n.server.chatMessages=[delayed];n.hold(true);const ws=new n.window.WebSocket('wss://erp.sex/api/v1/ws');ws.incoming({type:'message.new',data:delayed});await tick();
 assert(n.held.length>=2,'message hydration was not delayed');
 n.client.setQueryData(['m','sfw','zh','matches','messages','integrated-thread'],{items:[delayed]});
 n.location.pathname='/matches/integrated-thread';
 n.server.blockReadResponse=true;const ackPending=n.window.fetch('/api/v1/matches/integrated-thread/read',{method:'POST',body:JSON.stringify({lastMessageId:delayed.id})});await tick();
 assert(!n.window.__vrcrpSiteCache.isMessageRead('integrated-thread',delayed.id,created),'unconfirmed read changed server-owned read fence');
 n.location.pathname='/posts';n.hold(false);for(const release of n.held.splice(0))release();await tick();
 assert(!n.nativeMessages.some(v=>v.kind==='chatMessage'&&v.messageId===delayed.id),'late GET notified while read acknowledgement was still pending');
 assert(n.nativeMessages.some(v=>v.kind==='chatRead'&&v.lastMessageId===delayed.id),'locally viewed notification waited for server acknowledgement');
 for(const release of n.server.heldReadResponses.splice(0))release();await ackPending;await tick();n.server.blockReadResponse=false;
 assert(n.window.__vrcrpSiteCache.isMessageRead('integrated-thread',delayed.id,created),'confirmed read was lost');
 const fresh={...delayed,id:'integrated-new',text:'新的消息',createdAt:new Date(Date.parse(created)+1).toISOString()};n.server.chatMessages.push(fresh);ws.incoming({type:'message.new',data:fresh});await tick();
 assert.equal(n.nativeMessages.filter(v=>v.kind==='chatMessage'&&v.messageId===fresh.id).length,1,'fresh message was lost or duplicated after integrated read');n.destroy();
 console.log('PASS: integrated real QueryClient + notifications + delayed GET + successful read, with fresh next-message delivery');
 }
 { // October website: seven-part list keys, filtered lists, server pins and secret likes.
 const v=fixture(),globalKey=['m','sfw','zh','matches','active','',''],groupKey=['m','sfw','zh','matches','active','friends',''],searchKey=['m','sfw','zh','matches','active','','target'];
 const thread={id:'thread-1',user:{id:'peer-1',displayName:'target'},groupId:'friends',pinned:false,unreadCount:2,lastMessage:{id:'viewed-october',senderId:'peer-1',createdAt:'2026-10-05'}};
 v.server.matches=[thread,{id:'other-thread',user:{id:'other'},groupId:null,unreadCount:5}];
 v.query(globalKey,'/api/v1/matches?state=active',pages(clone(v.server.matches)));
 v.query(groupKey,'/api/v1/matches?state=active&group=friends',{pages:[{items:[clone(thread)],nextCursor:'group-next'}],pageParams:[null]});
 v.query(searchKey,'/api/v1/matches?q=target',{pages:[{items:[clone(thread)],nextCursor:'search-next'}],pageParams:[null]});
 v.query(['m','sfw','zh','matches','unmatched','',''],'/api/v1/matches?state=unmatched',pages([]));
 v.client.setQueryData(['counters'],clone(v.server.counters));
 await v.window.fetch('/api/v1/matches/thread-1/read',{method:'POST',body:JSON.stringify({lastMessageId:'viewed-october'})});await tick();
 for(const key of [globalKey,groupKey,searchKey])assert.equal(v.client.getQueryData(key).pages[0].items[0].unreadCount,0,'new list key retained read badge');
 assert.equal(v.client.getQueryData(['counters']).unreadMessages,5,'duplicate list variants decremented counters twice');
 assert(v.window.__vrcrpSiteCache.states().includes('unmatched'),'new closed-list key omitted from sync');
 v.window.__vrcrpSiteCache.commitMatches({items:[{...thread,unreadCount:1,lastMessage:{...thread.lastMessage,id:'new-october',createdAt:'2026-10-06'}},{id:'not-in-filter',groupId:null}],nextCursor:'global-next'});
 for(const [key,cursor] of [[groupKey,'group-next'],[searchKey,'search-next']]){const page=v.client.getQueryData(key).pages[0];assert.deepEqual(page.items.map(i=>i.id),['thread-1']);assert.equal(page.nextCursor,cursor);assert.equal(page.items[0].unreadCount,1);}
 v.server.failure=true;assert.equal(await v.window.__vrcrpSiteCache.setChatPinned('thread-1',true),false);assert.equal(v.window.__vrcrpSiteCache.chatMatch('thread-1').pinned,false);v.server.failure=false;
 assert(await v.window.__vrcrpSiteCache.setChatPinned('thread-1',true));await tick();assert.equal(v.window.__vrcrpSiteCache.chatMatch('thread-1').pinned,true);
 await v.window.fetch('/api/v1/matches/thread-1/group',{method:'PUT',body:JSON.stringify({groupId:'other-group'})});await tick();
 assert.equal(v.client.getQueryData(groupKey).pages[0].items.length,0,'moved chat remained in its former group');
 assert.equal(v.client.getQueryData(globalKey).pages[0].items[0].groupId,'other-group');
 const secretKey=['m','sfw','zh','likes','secret'],profileKey=['m','sfw','zh','profile','peer-1'];
 v.client.setQueryData(secretKey,pages([{user:{id:'peer-1'},action:'like',secret:true}]));v.client.setQueryData(sentKey,pages([]));v.client.setQueryData(likesKey,pages([{user:{id:'peer-1'}}]));v.client.setQueryData(profileKey,{id:'peer-1',relation:{swiped:'none',secret:false}});
 await v.window.fetch('/api/v1/swipes',{method:'POST',body:JSON.stringify({targetId:'peer-1',action:'like',secret:true})});await tick();
 assert.equal(v.client.getQueryData(profileKey).relation.secret,true);assert.equal(v.client.getQueryData(likesKey).pages[0].items.length,0);
 await v.window.fetch('/api/v1/swipes/upgrade',{method:'POST',body:JSON.stringify({targetId:'peer-1',action:'superlike',secret:true})});await tick();assert.equal(v.client.getQueryData(secretKey).pages[0].items[0].action,'superlike');
 v.server.failure=true;await v.window.fetch('/api/v1/swipes/upgrade',{method:'POST',body:JSON.stringify({targetId:'peer-1',action:'superlike'})});await tick();assert.equal(v.client.getQueryData(secretKey).pages[0].items.length,1);assert.equal(v.client.getQueryData(profileKey).relation.secret,true);v.server.failure=false;
 await v.window.fetch('/api/v1/swipes/upgrade',{method:'POST',body:JSON.stringify({targetId:'peer-1',action:'superlike'})});await tick();assert.equal(v.client.getQueryData(secretKey).pages[0].items.length,0);assert.equal(v.client.getQueryData(profileKey).relation.secret,false);
 v.client.setQueryData(secretKey,pages([{user:{id:'peer-1'},action:'like',secret:true}]));await v.window.fetch('/api/v1/likes/sent/peer-1',{method:'DELETE'});await tick();assert.equal(v.client.getQueryData(secretKey).pages[0].items.length,0);assert.equal(v.client.getQueryData(profileKey).relation.swiped,'none');
 const hotKey=['m','sfw','zh','browse','hot',{}];v.server.browse=[{id:'server-first',likes:1},{id:'server-second',likes:999}];const ranking=v.query(hotKey,'/api/v1/browse?sort=hot',pages([]));await ranking.refetch();assert.deepEqual(v.client.getQueryData(hotKey).pages[0].items.map(i=>i.id),['server-first','server-second'],'client replaced official ranking');v.server.browse.reverse();await ranking.refetch();assert.deepEqual(v.client.getQueryData(hotKey).pages[0].items.map(i=>i.id),['server-second','server-first'],'ranking refetch returned stale cache');
 v.destroy();console.log('PASS: October list keys, groups/search/cursor isolation, server pin success/failure, secret upgrade/cancel relations, official ranking order and fresh results');
 }
 fs.mkdirSync(path.join(__dirname,'../build'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../build/live-cache-verification.json'),JSON.stringify({queryCore:'5.104.1',checks:['fresh-query-refetch','successful-skip','failed-write','pagination-preserved','content-mode-isolation','stale-read-fence','cancel-sent-like','notification-read','request-coalescing','visible-page-polling','hidden-page-paused','resume-sync','editor-draft-source-preserved','account-isolation','read-ack-shared-counters','late-counter-read-fence','late-list-read-fence','fresh-message-after-read','failed-read-preserves-badge','october-seven-part-match-keys','filtered-list-membership-and-cursor','server-pin-failure-and-success','group-move-removes-old-row','secret-upgrade-and-cancel','official-ranking-order-and-refetch'],passed:true},null,2));
 console.log('PASS: real QueryCore fresh refetch, successful/failed operations, loaded pages, mode isolation, stale-read race, sent-like/read patches, request coalescing, visible polling/resume and account isolation');
})().catch(error=>{console.error(error);process.exitCode=1});
