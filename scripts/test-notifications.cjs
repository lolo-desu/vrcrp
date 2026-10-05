const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(origin='https://erp.sex') {
 const messages=[],requests=[],timers=new Map();let timerID=0;
 class Socket extends EventTarget { static OPEN=1; constructor(url){super();this.url=url;this.readyState=1} incoming(value){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(value)}))} }
 const document=new EventTarget();document.hidden=false;
 const location={origin,host:new URL(origin).host,href:origin+'/matches',pathname:'/matches'};
 const server={heldMessages:[],blockMessages:false,matchPages:{},threadMessagesByMatch:{},detail:{user:{id:'peer',displayName:'测试联系人',avatar:{view:'show',thumbUrl:'https://erp.sex/avatar-test.png'}}},threadMessages:{items:[]},me:{id:'self'},counters:{unreadMessages:3},matches:{items:[{id:'thread',user:{id:'peer',displayName:'测试联系人',avatar:{view:'show',thumbUrl:'https://erp.sex/avatar-test.png'}},unreadCount:3,lastMessage:{id:'old',senderId:'peer',type:'text',text:'old preview',createdAt:'2020-01-01T00:00:00Z'}}]}};
 const window=new EventTarget();window.top=window;window.WebSocket=Socket;window.webkit={messageHandlers:{erpNativeNotifications:{postMessage:v=>messages.push(v)}}};
 window.fetch=(url,options)=>{requests.push([String(url),options]);let body=String(url).includes('/me/counters')?server.counters:/\/matches\/[^/]+\/messages/.test(String(url))?(server.threadMessagesByMatch[String(url).split('/matches/')[1]?.split('/')[0]]||server.threadMessages):/\/matches\/[^/?]+(?:$|\?)/.test(String(url))?server.detail:String(url).includes('/matches')?(server.matchPages[new URL(String(url),location.href).searchParams.get('cursor')]||server.matches):server.me;const payload=JSON.stringify(body);window.lastPromise=server.blockMessages&&/\/matches\/[^/]+\/messages/.test(String(url))?new Promise(resolve=>server.heldMessages.push(()=>resolve(new Response(payload,{status:200})))):Promise.resolve(new Response(payload,{status:200}));return window.lastPromise};
 const context={window,document,location,navigator:{onLine:true,language:'zh',userAgent:'fixture'},URL,Request,Response,Headers,MessageEvent,Reflect,Proxy,Number,JSON,Date,Set,Map,Array,Math,AbortController,
 setTimeout:(fn,delay)=>{const id=++timerID;timers.set(id,{fn,delay});return id},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../ERPStable/notifications.js','utf8'),context);
 async function run(delay){const list=[...timers].filter(([,t])=>t.delay===delay);for(const[id,t]of list){if(timers.delete(id))await t.fn()}await tick()}
 return {...context,messages,requests,timers,server,run,Socket};
}
(async()=>{
 const f=fixture();const p=f.window.fetch('/api/v1/me');assert.equal(p,f.window.lastPromise);await p;await tick();
 await f.run(0);assert(!f.messages.some(m=>m.kind==='chatMessage'||m.kind==='genericMessage'),'launch notified old messages');
 assert(f.messages.some(m=>m.kind==='session'&&m.userId==='self'));
 assert([...f.timers.values()].some(t=>t.delay===2000),'chat list is not on two-second cadence');
 const socket=new f.window.WebSocket('wss://erp.sex/api/v1/ws');let invalidations=0;socket.addEventListener('message',e=>{if(JSON.parse(e.data).type==='match.updated')invalidations++});
 socket.incoming({type:'message.new',data:{id:'incoming',matchId:'thread',senderId:'peer',type:'text',text:'新消息预览'}});
 socket.incoming({type:'message.new',data:{id:'incoming',matchId:'thread',senderId:'peer',type:'text',text:'duplicate'}});
 await f.run(0);assert(invalidations>0,'real-time list invalidation missing');
 const alerts=()=>f.messages.filter(m=>m.kind==='chatMessage');assert.equal(alerts().length,1);assert.equal(alerts()[0].title,'测试联系人');assert.equal(alerts()[0].body,'新消息预览');assert.equal(alerts()[0].matchId,'thread');assert.equal(alerts()[0].displayId,'peer');assert.equal(alerts()[0].avatarURL,'https://erp.sex/avatar-test.png');
 socket.incoming({type:'counters',data:{unreadMessages:4}});assert(![...f.timers.values()].some(t=>t.delay===2200),'counter duplicated a message notification');
 socket.incoming({type:'message.new',data:{id:'outgoing',matchId:'thread',senderId:'self',type:'text',text:'own'}});assert.equal(alerts().length,1);
 f.location.pathname='/matches/thread';socket.incoming({type:'message.new',data:{id:'reading',matchId:'thread',senderId:'peer',type:'text',text:'reading'}});assert.equal(alerts().length,1,'currently open chat alerted');
 f.window.__vrcrpAppActive(false);socket.incoming({type:'message.new',data:{id:'inactive',matchId:'thread',senderId:'peer',type:'image'}});assert.equal(alerts().at(-1).body,'[图片]');await f.run(0);assert.equal(f.timers.size,0,'inactive polling continued');
 f.window.__vrcrpAppActive(true);f.location.pathname='/posts';await f.run(0);assert([...f.timers.values()].some(t=>t.delay===5000));
 f.server.matches.items[0].lastMessage={id:'poll-new',senderId:'peer',type:'voice',createdAt:new Date().toISOString()};f.server.matches.items[0].unreadCount=4;await f.run(5000);assert.equal(alerts().at(-1).body,'[语音]','polling missed a new latest message');
 const before=alerts().length;await f.run(5000);assert.equal(alerts().length,before,'poll repeated a message');
 const foreign=new f.window.WebSocket('wss://example.org/api/v1/ws');foreign.incoming({type:'message.new',data:{id:'foreign',matchId:'thread',senderId:'peer',text:'foreign'}});assert.equal(alerts().length,before);
 f.server.me={id:'other-account'};await f.window.fetch('/api/v1/me');await tick();assert.equal(f.messages.filter(m=>m.kind==='session').at(-1).userId,'other-account');
 socket.incoming({type:'message.new',data:{id:'late-other-user',matchId:'thread',senderId:'peer',type:'text',text:'stale'}});assert.equal(alerts().length,before,'previous account socket leaked a notification');
 f.server.me={};await f.window.fetch('/api/v1/me');await tick();assert.equal(f.timers.size,0,'logout left polling active');
 assert.equal(fixture('https://example.org').window.WebSocket.name,'Socket');
 // Real list summaries are not guaranteed to contain a message ID.
 const g=fixture();delete g.server.matches.items[0].lastMessage.id;
 await g.window.fetch('/api/v1/me');await tick();await g.run(0);
 assert(!g.messages.some(m=>m.kind==='chatMessage'),'summary baseline emitted an old alert');
 const incoming={id:'resolved-message',senderId:'peer',type:'text',text:'补取到的真实正文',createdAt:'2020-01-02T00:00:00Z'};
 g.server.matches.items[0].lastMessage={...incoming};delete g.server.matches.items[0].lastMessage.id;g.server.matches.items[0].unreadCount=4;
 g.server.threadMessages.items=[{id:'historic',senderId:'peer',type:'text',text:'old',createdAt:'2019-01-01'},incoming];
 const gs=new g.window.WebSocket('wss://erp.sex/api/v1/ws');gs.incoming({type:'counters',data:{unreadMessages:4}});
 await g.run(0);await tick();await tick();await g.run(2200);
 const rich=g.messages.filter(m=>m.kind==='chatMessage');assert.equal(rich.length,1);assert.equal(rich[0].body,'补取到的真实正文');assert.equal(rich[0].displayId,'peer');assert.equal(rich[0].avatarURL,'https://erp.sex/avatar-test.png');
 assert(!g.messages.some(m=>m.kind==='genericMessage'),'generic alert escaped before detail hydration');
 await g.run(2000);await tick();assert.equal(g.messages.filter(m=>m.kind==='chatMessage').length,1,'summary-only polling duplicated alert');
 // ID present but body omitted still needs hydration; remembering it early
 // would prevent the real body from ever being delivered.
 const omitted={id:'body-missing',senderId:'peer',type:'text',text:'完整正文',createdAt:new Date().toISOString()};
 g.server.threadMessages.items.push(omitted);g.server.matches.items[0].lastMessage={...omitted};delete g.server.matches.items[0].lastMessage.text;g.server.matches.items[0].unreadCount=5;
 await g.run(2000);await tick();await tick();assert.equal(g.messages.filter(m=>m.kind==='chatMessage').at(-1).body,'完整正文');
 // New thread WS event hydrates metadata before publishing its message.
 const h=fixture();await h.window.fetch('/api/v1/me');await tick();const hs=new h.window.WebSocket('wss://erp.sex/api/v1/ws');
 hs.incoming({type:'message.new',data:{id:'new-thread-message',matchId:'new-thread',senderId:'peer',type:'text',text:'首次消息'}});await tick();await tick();
 assert.equal(h.messages.filter(m=>m.kind==='chatMessage').at(-1).title,'测试联系人');
 h.server.matches.items[0].id='new-thread';await h.run(0);await tick();assert.equal(h.messages.filter(m=>m.kind==='chatMessage').length,1,'WS metadata was mistaken for an unread baseline');
 // A counter can refer to a thread outside the summary's first page.
 const k=fixture();await k.window.fetch('/api/v1/me');await tick();await k.run(0);
 k.server.matches.nextCursor='page-two';k.server.matchPages['page-two']={items:[{id:'paged-thread',user:k.server.detail.user,unreadCount:1,lastMessage:{type:'text',senderId:'peer',text:'第二页消息',createdAt:new Date().toISOString()}}],nextCursor:null};
 k.server.threadMessagesByMatch['paged-thread']={items:[{id:'paged-message',senderId:'peer',type:'text',text:'第二页消息',createdAt:new Date().toISOString()}]};
 const ks=new k.window.WebSocket('wss://erp.sex/api/v1/ws');ks.incoming({type:'counters',data:{unreadMessages:4}});await k.run(0);await tick();await tick();
 assert(k.messages.some(m=>m.kind==='chatMessage'&&m.matchId==='paged-thread'&&m.body==='第二页消息'),'unread thread beyond first page was missed');
 // Account change during hydration cannot reveal the previous user's message.
 const j=fixture();await j.window.fetch('/api/v1/me');await tick();const js=new j.window.WebSocket('wss://erp.sex/api/v1/ws');js.incoming({type:'message.new',data:{id:'late-detail',matchId:'new-thread',senderId:'peer',type:'text',text:'secret'}});
 j.server.me={};await j.window.fetch('/api/v1/me');await tick();await tick();assert(!j.messages.some(m=>m.kind==='chatMessage'),'late hydration leaked after logout');
 // Read while detail/metadata is in flight, then leave the chat or background.
 const z=fixture();await z.window.fetch('/api/v1/me');await tick();await z.run(0);
 const at=new Date().toISOString(),late={id:'read-during-hydration',matchId:'late-thread',senderId:'peer',type:'text',text:'已经看过的消息',createdAt:at};
 z.server.blockMessages=true;z.server.threadMessagesByMatch['late-thread']={items:[late]};
 const zs=new z.window.WebSocket('wss://erp.sex/api/v1/ws');zs.incoming({type:'message.new',data:late});await tick();assert.equal(z.server.heldMessages.length,1);
 z.location.pathname='/matches/late-thread';z.window.__vrcrpChatRead?.({userId:'self',matchId:'late-thread',lastMessageId:late.id,createdAt:at,messageIds:[late.id]});
 z.location.pathname='/posts';z.window.__vrcrpAppActive(false);z.server.blockMessages=false;for(const release of z.server.heldMessages.splice(0))release();await tick();await tick();
 assert(!z.messages.some(m=>m.kind==='chatMessage'),'hydration notified a message read before leaving/backgrounding');
 assert(z.messages.some(m=>m.kind==='chatRead'&&m.lastMessageId===late.id),'read did not reach native notification layer');
 z.window.__vrcrpAppActive(true);z.server.matches.items=[{id:'late-thread',user:z.server.detail.user,unreadCount:4,lastMessage:late}];z.server.counters.unreadMessages=4;
 await z.run(0);await tick();await z.run(2200);
 assert(!z.messages.some(m=>m.kind==='chatMessage'||m.kind==='genericMessage'),'stale summary or counter re-alerted a read message');
 zs.incoming({type:'message.new',data:{...late,id:'older-read-message',createdAt:new Date(Date.parse(at)-1).toISOString()}});
 assert(!z.messages.some(m=>m.kind==='chatMessage'),'older read message re-alerted');
 zs.incoming({type:'message.new',data:{...late,id:'genuine-next',text:'新的未读消息',createdAt:new Date(Date.parse(at)+1).toISOString()}});
 zs.incoming({type:'message.new',data:{...late,id:'same-time-new',text:'同一时间戳的新消息'}});
 assert.deepEqual(z.messages.filter(m=>m.kind==='chatMessage').map(m=>m.messageId),['genuine-next','same-time-new'],'read watermark suppressed genuine next messages');
 z.window.__vrcrpChatRead({userId:'previous-account',matchId:'late-thread',lastMessageId:'unrelated',createdAt:'2099-01-01T00:00:00Z',messageIds:[]});
 zs.incoming({type:'message.new',data:{...late,id:'after-foreign-read',createdAt:new Date(Date.parse(at)+2).toISOString()}});
 assert.equal(z.messages.filter(m=>m.kind==='chatMessage').at(-1).messageId,'after-foreign-read','foreign account read affected notifications');
 console.log('PASS: read during delayed hydration; leave/background cancellation; stale summary/counter; older read; genuine newer/same-time message; foreign read isolation');
 console.log('PASS: summary without ID/body, unread-counter hydration, actual content and sender/avatar, clock skew, new-thread metadata, no premature generic alert, deduplication and logout isolation');
 console.log('PASS: old-message baseline, previews and media, sender/current-chat exclusion, deduplication, live list updates, 2/4/5-second polling, resume, logout/account isolation and original fetch promises');
})().catch(error=>{console.error(error);process.exitCode=1});
