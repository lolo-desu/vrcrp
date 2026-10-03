import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {motion,useMotionValue,useTransform,AnimatePresence} from 'framer-motion';
window.swipes=[];window.opens=0;window.chips=0;window.dragStarts=0;window.dragEvents=[];window.business='success';
function SwipeCard({index,onSwipe}){
 const x=useMotionValue(0),y=useMotionValue(0),rotate=useTransform(x,[-300,300],[-14,14]),progress=(v,a,b)=>Math.min(1,Math.max(0,(v-a)/(b-a)));
 const like=useTransform([x,y],([x,y])=>-y>Math.abs(x)?0:progress(x,30,140)),pass=useTransform([x,y],([x,y])=>-y>Math.abs(x)?0:progress(-x,30,140)),superlike=useTransform([x,y],([x,y])=>-y>Math.abs(x)?progress(-y,40,140):0);
 const end=(e,{offset,velocity})=>{dragEvents.push({offset,velocity});-offset.y>Math.abs(offset.x)?offset.y<-120&&onSwipe('up'):offset.x>120||velocity.x>700?onSwipe('right'):(offset.x<-120||velocity.x<-700)&&onSwipe('left')};
 return <motion.div data-card-id={index} className="absolute inset-0 cursor-grab touch-none" style={{x,y,rotate}} drag dragSnapToOrigin dragElastic={.9} onDragStart={()=>dragStarts++} onDragEnd={end} initial={false} exit={{x:-600,opacity:0,transition:{duration:.3}}}>
  <div className="photo" onClick={()=>opens++}>虚构资料 {index}</div><button className="chip" onClick={()=>chips++}>资料操作</button><div className="album" style={{overflowX:'auto',width:100,height:35,position:'absolute',left:10,top:80}}><div style={{width:500}}>相册横向交互</div></div>
  <motion.span className="pointer-events-none absolute border-4 border-success left-6 top-24" style={{opacity:like}}>喜欢</motion.span><motion.span className="pointer-events-none absolute border-4 border-danger right-6 top-24" style={{opacity:pass}}>讨厌</motion.span><motion.span className="pointer-events-none absolute border-4 border-accent bottom-40" style={{opacity:superlike}}>超级喜欢</motion.span>
 </motion.div>;
}
function App(){
 const [index,setIndex]=useState(1),[busy,setBusy]=useState(false),[dialog,setDialog]=useState(false);
 window.fixtureChangeCard=()=>setIndex(i=>i+1);
 const swipe=value=>{swipes.push({value,index});if(value==='up'){setDialog(true);return;}if(window.business==='fail')return;setBusy(true);setTimeout(()=>{setIndex(i=>i+1);setBusy(false)},80);};
 return <main id="main"><div className="deck"><div className="stage"><AnimatePresence initial={false}><SwipeCard key={index} index={index} onSwipe={swipe}/></AnimatePresence></div><div className="actions"><button disabled={busy} className="act act-pass" onClick={()=>swipe('left')}>×</button><button disabled={busy} className="act act-super" onClick={()=>swipe('up')}>★</button><button disabled={busy} className="act act-like" onClick={()=>swipe('right')}>♥</button></div></div>{dialog&&<div role="dialog"><h2>超级喜欢附言确认</h2><button onClick={()=>setDialog(false)}>取消超级喜欢</button></div>}</main>
}
createRoot(document.getElementById('root')).render(<App/>);
