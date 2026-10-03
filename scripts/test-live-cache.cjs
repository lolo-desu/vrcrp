// Exercise real TanStack Query observers, cancellation and network responses.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {QueryClient,QueryObserver}=require(path.join(process.env.TEST_NODE_MODULES||'/workspace/vrcrp-test-tools/node_modules','@tanstack/query-core'));
const tick=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture(){
 const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity,gcTime:Infinity}}});client.setQueryData(['me'],{id:'self'});
 const received=['peer-1','peer-2'].map(id=>({user:{id},createdAt:'2026-01-01'}));
 const server={received,sent:clone(received),posts:[{id:'post-1',text:'old'}],notifications:[{id:'notice-1',read:false}],profile:{id:'peer-1',displayName:'old',relation:{swiped:'none'}},failure:false};
 const timers=new Map(),requests=[],held=[];let timerID=0,offset=0,holdRead=false;
 const document=new EventTarget();document.hidden=false;document.querySelectorAll=()=>[];document.getElementById=id=>id==='root'?{__reactContainer$fixture:{memoizedProps:{value:client}}}:null;
 const location={origin:'https://erp.sex',href:'https://erp.sex/likes',pathname:'/likes'};
 const window=new EventTarget();window.top=window;window.webkit={messageHandlers:{erpNativeApp:{postMessage(){}}}};
 const response=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
 window.fetch=(input,options={})=>{
  const url=new URL(input instanceof Request?input.url:String(input),location.href),method=options.method||input.method||'GET';requests.push({url:url.pathname,search:url.search,headers:options.headers,method});
  const run=()=>{
   if(method!=='GET'){
    if(server.failure)return response({error:'failed'},500);
    const b=typeof options.body==='string'?JSON.parse(options.body):{};
    if(url.pathname==='/api/v1/swipes')server.received=server.received.filter(i=>i.user.id!==b.targetId);
    if(url.pathname.startsWith('/api/v1/likes/sent/')&&method==='DELETE')server.sent=server.sent.filter(i=>i.user.id!==url.pathname.split('/').at(-1));
    return response({ok:true});
   }
   const p=url.pathname;
   const value=p.endsWith('/browse')?(server.browsePages?.[url.searchParams.get('cursor')||'first']||{items:[],nextCursor:null}):p.endsWith('/likes/received')?{items:server.received,nextCursor:null}:p.endsWith('/likes/sent')?{items:server.sent,nextCursor:null}:p.endsWith('/notifications')?{items:server.notifications,nextCursor:null}:p.endsWith('/posts')?{items:server.posts,nextCursor:null}:server.profile;
   return response(clone(value));
  };
  const value=run();let promise;
  if(method==='GET'&&holdRead){promise=new Promise(resolve=>held.push(()=>resolve(value)));}else promise=Promise.resolve(value);
  window.lastNetworkPromise=promise;return promise;
 };
 class Clock extends Date{static now(){return Date.now()+offset;}}
 const context={window,document,location,navigator:{onLine:true},URL,URLSearchParams,Headers,Request,Response,AbortController,DOMException,Date:Clock,
  setTimeout:(fn,delay)=>{const id=++timerID;timers.set(id,{fn,delay});return id},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../ERPStable/site-cache.js','utf8'),context);
 window.__vrcrpSiteCache.session('self',{'X-Content-Mode':'sfw','Accept-Language':'zh'});
 const get=url=>window.fetch(url,{headers:{'X-Content-Mode':'sfw','Accept-Language':'zh'}}).then(r=>r.json());
 const observers=[];
 function query(key,url,initial){client.setQueryData(key,initial);const observer=new QueryObserver(client,{queryKey:key,queryFn:async()=>{const value=await get(url);return initial.pages?{pages:[value],pageParams:[null]}:value},staleTime:Infinity});const off=observer.subscribe(()=>{});observers.push(off);return observer;}
 async function run(delay){const selected=[...timers].filter(([,t])=>t.delay===delay);for(const [id,t] of selected)if(timers.delete(id))await t.fn();await tick();}
 return{window,client,server,get,query,requests,timers,document,held,run,tick,hold(v){holdRead=v},age(v){offset=v},destroy(){window.__vrcrpSiteCache.session('');for(const off of observers)off();client.clear();}};
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
 assert.equal(f.timers.size,0);f.destroy();
 // Own position is a read-only lookup of the site's exact scoped hot list.
 const rank=fixture(),rankKey=['m','sfw','zh','browse','hot',{languages:'zh',intents:'chat'}];
 rank.query(rankKey,'/api/v1/browse?sort=hot',pages([{id:'cached-other'}]));
 rank.server.browsePages={first:{items:[{id:'a'},{id:'b'}],nextCursor:'next'},next:{items:[{id:'b'},{id:'self'}],nextCursor:null}};
 const position=await rank.window.__vrcrpSiteCache.ownBrowsePosition();assert.equal(position.position,3);
 assert(rank.requests.filter(r=>r.url.endsWith('/browse')).every(r=>r.method==='GET'&&r.search.includes('sort=hot')&&r.search.includes('languages=zh')&&r.headers['X-Content-Mode']==='sfw'));
 assert.equal(rank.client.getQueryData(rankKey).pages[0].items[0].id,'cached-other','lookup replaced the original list');
 rank.server.browsePages={first:{items:[{id:'a'}],nextCursor:null}};
 const absent=await rank.window.__vrcrpSiteCache.ownBrowsePosition();assert.equal(absent.position,null);assert.equal(absent.complete,true,'absence must remain unknown, not rank zero');
 rank.server.browsePages={first:{items:[{id:'a'}],nextCursor:'loop'},loop:{items:[{id:'a'}],nextCursor:'loop'}};
 const repeated=await rank.window.__vrcrpSiteCache.ownBrowsePosition();assert.equal(repeated.position,null);assert.equal(repeated.complete,false);assert.equal(repeated.checked,1);
 rank.hold(true);const race=rank.window.__vrcrpSiteCache.ownBrowsePosition();await tick();rank.window.__vrcrpSiteCache.session('other');rank.hold(false);for(const release of rank.held.splice(0))release();await assert.rejects(race,/账号/);
 rank.destroy();
 fs.mkdirSync(path.join(__dirname,'../build'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../build/live-cache-verification.json'),JSON.stringify({queryCore:'5.104.1',checks:['fresh-query-refetch','successful-skip','failed-write','pagination-preserved','content-mode-isolation','stale-read-fence','cancel-sent-like','notification-read','request-coalescing','visible-page-polling','hidden-page-paused','resume-sync','editor-draft-source-preserved','account-isolation','rank-scoped-read-only','rank-no-fabricated-absence','rank-cursor-loop','rank-account-race'],passed:true},null,2));
 console.log('PASS: real QueryCore fresh refetch, successful/failed operations, loaded pages, mode isolation, stale-read race, sent-like/read patches, request coalescing, visible polling/resume and account isolation');
})().catch(error=>{console.error(error);process.exitCode=1});
