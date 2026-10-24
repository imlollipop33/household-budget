'use strict';
// Whole-cat frames, decoded once and synchronously painted to one canvas per cat.
(() => {
  let dispose=()=>{};
  const images=new Map();
  let manifestPromise;
  const manifest=()=>manifestPromise||(manifestPromise=fetch('assets/cats/full-turn-frames.json').then(r=>{if(!r.ok)throw Error('Cat frames unavailable');return r.json();}).catch(error=>{manifestPromise=null;throw error;}));
  function imageFor(file){if(!images.has(file)){const image=new Image();image.src=file;images.set(file,image.decode().then(()=>image).catch(error=>{images.delete(file);throw error;}));}return images.get(file);}
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  function axis(value,previous,max){if(value>previous+.63)return Math.min(max,Math.floor(value+.37));if(value<previous-.63)return Math.max(0,Math.ceil(value-.37));return previous;}
  function bind(){
    dispose();const family=document.querySelector('.cat-family');if(!family)return;
    const reduced=matchMedia('(prefers-reduced-motion:reduce)'),desktop=matchMedia('(min-width:651px) and (pointer:fine)');
    const cats=[...family.querySelectorAll('.cat-portrait')].map(cat=>({cat,canvas:cat.querySelector('canvas'),x:2,y:1,selectedX:2,selectedY:1,painted:'',ready:false,lastChange:0}));
    let raf=0,pointer=null,disposed=false,previousTime=0;
    function paint(item,x,y){
      const key=x+','+y;if(item.painted===key)return;
      const canvas=item.canvas;item.painter(y*5+x);
      item.painted=key;canvas.dataset.pose=key;canvas.dataset.drawCount=String(Number(canvas.dataset.drawCount||0)+1);
    }
    function tick(time){
      raf=0;if(disposed)return;const dt=Math.min(50,time-(previousTime||time-16));previousTime=time;
      const amount=reduced.matches?1:1-Math.exp(-dt/90);let moving=false;
      cats.forEach(item=>{
        if(!item.ready)return;
        const r=item.canvas.getBoundingClientRect(),active=pointer&&!reduced.matches&&desktop.matches;
        const tx=active?clamp(2+(pointer.x-r.left-r.width*.5)/Math.max(innerWidth*.25,220)*2,0,4):2;
        const ty=active?clamp(1+(pointer.y-r.top-r.height*.22)/Math.max(innerHeight*.36,180),0,2):1;
        item.x+=(tx-item.x)*amount;item.y+=(ty-item.y)*amount;
        const sx=axis(item.x,item.selectedX,4),sy=axis(item.y,item.selectedY,2),changed=sx!==item.selectedX||sy!==item.selectedY;
        if(changed&&time-item.lastChange>=65){item.selectedX=sx;item.selectedY=sy;paint(item,sx,sy);item.lastChange=time;}
        if(Math.abs(tx-item.x)>.002||Math.abs(ty-item.y)>.002||(changed&&time-item.lastChange<65))moving=true;
      });
      if(moving)raf=requestAnimationFrame(tick);
    }
    const schedule=()=>{if(!raf)raf=requestAnimationFrame(tick);};
    const move=e=>{if(e.pointerType==='touch')return;pointer={x:e.clientX,y:e.clientY};schedule();};
    const rest=()=>{pointer=null;schedule();};
    cats.forEach(async item=>{
      try{
        item.data=(await manifest())[item.cat.dataset.cat];if(!item.data||item.data.frames.length!==15)throw Error('Incomplete cat frames');
        item.image=await imageFor(item.data.file);if(disposed)return;
        item.painter=window.LedgerCatPainter.create(item.canvas,item.image,item.data);
        paint(item,2,1);item.ready=true;item.cat.dataset.ready='true';schedule();
      }catch{if(!disposed)item.cat.dataset.ready='error';}
    });
    window.addEventListener('pointermove',move,{passive:true});document.documentElement.addEventListener('pointerleave',rest,{passive:true});window.addEventListener('blur',rest);window.addEventListener('resize',schedule,{passive:true});window.addEventListener('scroll',schedule,{passive:true});reduced.addEventListener('change',schedule);desktop.addEventListener('change',schedule);
    dispose=()=>{disposed=true;cancelAnimationFrame(raf);window.removeEventListener('pointermove',move);document.documentElement.removeEventListener('pointerleave',rest);window.removeEventListener('blur',rest);window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule);reduced.removeEventListener('change',schedule);desktop.removeEventListener('change',schedule);};
  }
  document.addEventListener('ledger:render',bind);window.addEventListener('pagehide',()=>dispose());window.addEventListener('pageshow',e=>{if(e.persisted)bind();});bind();
})();

