import React,{Suspense,lazy,startTransition} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,useNavigate,Link} from 'react-router-dom';
import {QueryClient,QueryClientProvider,useQuery} from '@tanstack/react-query';
const client=new QueryClient({defaultOptions:{queries:{staleTime:30000,retry:false,refetchOnWindowFocus:false}}});
window.continuityClient=client;window.continuityBoots=(window.continuityBoots||0)+1;
const get=url=>fetch('/api/v1/'+url).then(r=>{if(!r.ok)throw Error('暂时无法连接');return r.json()});
const Loading=()=> <div role="status"><svg className="animate-spin"/><span>加载中…</span></div>;
function Frame({children}){return <><header className="app-top">vrcrp</header><main id="main"><Suspense fallback={<Loading/>}>{children}</Suspense></main></>;}
function List(){const q=useQuery({queryKey:['continuity-list'],queryFn:()=>get('fixture/list')});return <><h1>配对</h1>{q.isLoading?<Loading/>:q.error?<div role="alert">暂时无法连接<button onClick={()=>q.refetch()}>重试</button></div>:<ul>{q.data.items.map(i=><li key={i.id}><Link to="/u/peer">{i.name}</Link></li>)}</ul>}</>;}
function Profile(){const q=useQuery({queryKey:['continuity-profile'],queryFn:()=>get('fixture/profile')});return <><h1>个人资料</h1>{q.isLoading?<Loading/>:q.error?<div role="alert">暂时无法连接<button onClick={()=>q.refetch()}>重试</button></div>:<article><p>{q.data.text}</p><Link to="/posts/detail">帖子详情</Link></article>}</>;}
const SlowProfile=lazy(()=>new Promise(resolve=>{window.releaseProfileModule=()=>resolve({default:Profile});}));
const SlowPost=lazy(()=>new Promise(resolve=>{window.releasePostModule=()=>resolve({default:()=> <><h1>帖子详情</h1><article>帖子实际内容</article></>});}));
function Editor(){return <><h1>编辑名片</h1><form><input defaultValue="保留编辑内容"/><textarea defaultValue="简介草稿"/></form></>;}
function App(){const navigate=useNavigate();window.continuityOpen=path=>startTransition(()=>navigate(path));return <><Routes><Route path="/matches" element={<Frame><List/></Frame>}/><Route path="/u/peer" element={<Frame><SlowProfile/></Frame>}/><Route path="/posts/detail" element={<Frame><SlowPost/></Frame>}/><Route path="/profile/edit/basics" element={<Frame><Editor/></Frame>}/><Route path="/login" element={<form><h1>登录</h1><input placeholder="邮箱"/><input type="password"/></form>}/></Routes><nav className="app-bottom"><Link to="/matches">配对</Link><Link to="/u/peer">资料</Link></nav></>;}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><BrowserRouter future={{v7_startTransition:true}}><App/></BrowserRouter></QueryClientProvider>);
