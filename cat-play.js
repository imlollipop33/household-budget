'use strict';
(() => {
 const ASSET='assets/play/',teaser=new LedgerCatPlay.Teaser(),assetImages=new Map(),sessions=new Map();
 const catNames={'1':'黑貓','2':'左邊虎斑貓','3':'中間虎斑貓','4':'賓士貓','5':'橘白貓'};
 let manifest,ready=false,mode=null,menuOpen=false,stage=null,cats=[],raf=0,previous=0,pointer=null,soundEnabled=false,audio=null,lastSound=0,particles=[],pour=null,bagMouth=null,lastBagGrip=null;
 const paw='<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="12" cy="26" rx="6" ry="8" transform="rotate(-22 12 26)"/><ellipse cx="25" cy="15" rx="6.5" ry="8" transform="rotate(-8 25 15)"/><ellipse cx="40" cy="15" rx="6.5" ry="8" transform="rotate(8 40 15)"/><ellipse cx="53" cy="26" rx="6" ry="8" transform="rotate(22 53 26)"/><path d="M18 52C8 48 18 32 26 30c4-2 8-2 12 0 8 2 18 18 8 22-5 2-8-2-14-2s-9 4-14 2Z"/></svg>';
 const dock=document.createElement('div');dock.className='cat-play-dock';dock.hidden=true;dock.innerHTML=`<div id="cat-play-menu" class="cat-play-menu" hidden role="group" aria-label="貓咪互動選單"><button class="cat-play-option" data-cat-tool="treat" aria-pressed="false"><canvas width="264" height="212" aria-hidden="true"></canvas><span>肉泥</span></button><button class="cat-play-option" data-cat-tool="wand" aria-pressed="false"><canvas width="264" height="212" aria-hidden="true"></canvas><span>逗貓棒</span></button><button class="cat-play-option" data-cat-tool="feed" aria-pressed="false"><canvas width="264" height="212" aria-hidden="true"></canvas><span>餵飯</span></button></div><button class="cat-play-toggle" aria-label="開啟貓咪互動選單" aria-expanded="false" aria-controls="cat-play-menu">${paw}</button>`;
 const status=document.createElement('div');status.className='cat-play-status';status.hidden=true;status.setAttribute('role','status');status.innerHTML='<div class="cat-play-message"></div><div class="cat-play-tools"><button data-play-reset>重新玩</button><button data-play-sound aria-pressed="false">音效：關</button><button data-play-stop>收起 · Esc</button></div>';
 const cursor=document.createElement('div');cursor.className='cat-play-cursor';cursor.hidden=true;cursor.innerHTML='<canvas width="600" height="600"></canvas>';
 const particleCanvas=document.createElement('canvas');particleCanvas.className='cat-play-particles';particleCanvas.setAttribute('aria-hidden','true');
 document.body.append(dock,status,cursor,particleCanvas);
 const message=status.querySelector('.cat-play-message'),cursorCanvas=cursor.querySelector('canvas'),cursorContext=cursorCanvas.getContext('2d');
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),lerp=(a,b,n)=>a+(b-a)*n;
 function imageFor(file){if(!assetImages.has(file)){const image=new Image();image.src=file;assetImages.set(file,image.decode().then(()=>image));}return assetImages.get(file);}
 function clipped(ctx,image,source,runs,dx,dy,dw,dh){const [sx,sy,sw,sh]=source,path=new Path2D();for(const [x,y,w,h]of runs)path.rect(dx+x/sw*dw,dy+y/sh*dh,w/sw*dw,h/sh*dh);ctx.save();ctx.clip(path);ctx.drawImage(image,sx,sy,sw,sh,dx,dy,dw,dh);ctx.restore();}
 function prop(ctx,name,x,y,w,h){const p=manifest.props[name],im=p.image,[,,sw,sh]=p.source,scale=Math.min(w/sw,h/sh),dw=sw*scale,dh=sh*scale;clipped(ctx,im,p.source,p.runs,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}
 function kibble(ctx,cx,cy,rx,ry,amount,seed=0){
  if(amount<=0)return;ctx.save();ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.clip();
  const count=Math.max(1,Math.ceil(amount*43));for(let i=0;i<count;i++){const t=(i*2.399963+seed),r=Math.sqrt((i+.5)/43),x=cx+Math.cos(t)*r*rx*.92,y=cy+Math.sin(t)*r*ry*.85,sz=rx*.16;ctx.save();ctx.translate(x,y);ctx.rotate(t);const g=ctx.createRadialGradient(-sz*.25,-sz*.3,0,0,0,sz);g.addColorStop(0,'#b18556');g.addColorStop(1,'#75502f');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,0,sz,sz*.77,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#704b2e55';ctx.lineWidth=.5;ctx.stroke();ctx.restore();}ctx.restore();
 }
 function drawBowl(canvas,amount){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);prop(ctx,'bowl-empty',0,0,canvas.width,canvas.height);kibble(ctx,canvas.width*.51,canvas.height*.315,canvas.width*.29,canvas.height*.1,amount);}
 function drawBowlLayers(item,amount){
  drawBowl(item.bowlBack,amount);
  const canvas=item.bowl.querySelector('canvas'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);ctx.save();ctx.beginPath();ctx.moveTo(0,h*.30);ctx.quadraticCurveTo(w*.5,h*.70,w,h*.30);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.clip();
  prop(ctx,'bowl-empty',0,0,w,h);ctx.restore();
 }
 function drawWand(ctx,tip,end,swing,lureHeight=74){
  // The thin rod ends at the ring. A separate, released string holds the lure below it.
  ctx.save();ctx.lineCap='round';ctx.strokeStyle='#dbb34e';ctx.lineWidth=3.7;
  ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(51,-105,tip.x,tip.y);ctx.stroke();
  ctx.strokeStyle='#ffe87f';ctx.lineWidth=1.6;ctx.stroke();
  ctx.strokeStyle='#df6580';ctx.lineWidth=1.15;ctx.beginPath();ctx.moveTo(tip.x,tip.y);
  ctx.quadraticCurveTo((tip.x+end.x)/2+5*Math.sin(swing),(tip.y+end.y)/2+4,end.x,end.y);ctx.stroke();
  ctx.strokeStyle='#a17d8d';ctx.lineWidth=1;ctx.beginPath();ctx.arc(tip.x,tip.y,2.2,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='#de5a71';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-5,9);ctx.lineTo(9,-17);ctx.stroke();
  ctx.strokeStyle='#f9a0ae';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-6,7);ctx.lineTo(7,-16);ctx.stroke();
  const p=manifest.props['wand-lure'],[,,w,h]=p.source,scale=lureHeight/h;
  ctx.translate(end.x,end.y);ctx.rotate(-swing*.55);
  clipped(ctx,p.image,p.source,p.runs,-w*scale*.55,0,w*scale,lureHeight);ctx.restore();
 }
 function menuIcons(){for(const el of dock.querySelectorAll('[data-cat-tool]')){const cv=el.querySelector('canvas'),ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);if(el.dataset.catTool==='feed')drawBowl(cv,1);else if(el.dataset.catTool==='wand'){ctx.save();ctx.translate(65,145);ctx.scale(.75,.75);drawWand(ctx,{x:90,y:-150},{x:90,y:-18},0,100);ctx.restore();}else prop(ctx,'treat-icon',0,0,cv.width,cv.height);}}
 function setMessage(text){message.textContent=text;}
 function setMenu(value){menuOpen=value;dock.querySelector('.cat-play-menu').hidden=!value;const toggle=dock.querySelector('.cat-play-toggle');toggle.setAttribute('aria-expanded',String(value));toggle.setAttribute('aria-label',value?'收合貓咪互動選單':'開啟貓咪互動選單');status.hidden=!mode&&!value;if(value&&!mode)setMessage(ready?'和五隻貓咪玩一會兒吧。':'貓咪動作準備中…');}
 function setMode(value){
  if(!ready){setMenu(true);setMessage('貓咪動作準備中，馬上就好。');return;}
  mode=value;pour=null;bagMouth=null;lastBagGrip=null;teaser.reset();document.body.classList.toggle('cat-play-mode',!!value);document.body.dataset.catTool=value||'';
  for(const el of dock.querySelectorAll('[data-cat-tool]'))el.setAttribute('aria-pressed',String(el.dataset.catTool===value));
  cursor.hidden=!value;status.hidden=!value&&!menuOpen;pointer=null;cats.forEach(item=>item.playUntil=0);
  if(value==='feed'){cats.forEach(item=>item.feeding.show());setMessage('拿飼料袋點貓碗，袋子會傾斜倒料；每次 1/3 碗，3 次裝滿。');}
  else if(value==='treat')setMessage('把肉泥尖端移到任何一隻貓咪嘴邊，牠就會舔。');
  else if(value==='wand')setMessage('拿著棒柄移動，讓繩尾的小老鼠靠近貓咪，牠會抬手撥弄。');
  if(!value){cursor.hidden=true;document.dispatchEvent(new CustomEvent('cat:target',{detail:null}));}
  schedule();
 }
 dock.querySelector('.cat-play-toggle').addEventListener('click',()=>setMenu(!menuOpen));
 dock.querySelectorAll('[data-cat-tool]').forEach(el=>el.addEventListener('click',()=>{setMode(el.dataset.catTool);setMenu(false);}));
 status.querySelector('[data-play-stop]').addEventListener('click',()=>{setMode(null);setMenu(false);});
 status.querySelector('[data-play-reset]').addEventListener('click',()=>{for(const item of sessions.values()){item.feeding=new LedgerCatPlay.Feeding();item.batCount=0;item.restoreUntil=0;item.restoreKind='';}particles=[];setMode(mode);});
 status.querySelector('[data-play-sound]').addEventListener('click',async event=>{soundEnabled=!soundEnabled;event.currentTarget.setAttribute('aria-pressed',String(soundEnabled));event.currentTarget.textContent='音效：'+(soundEnabled?'開':'關');if(soundEnabled){audio??=new (window.AudioContext||window.webkitAudioContext)();await audio.resume();}});
 function crunch(time,lick=false){if(!soundEnabled||!audio||audio.state!=='running'||time-lastSound<(lick?280:420))return;lastSound=time;const duration=lick?.045:.08,buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate),a=buffer.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/a.length,3);const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=lick?700:1650;gain.gain.value=lick?.012:.02;source.connect(filter).connect(gain).connect(audio.destination);source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};}
 function positionBowl(item){if(!stage||!item.bowl)return;const r=item.baseCanvas.getBoundingClientRect(),s=stage.getBoundingClientRect(),width=clamp(r.width*.74,34,108),height=width*.94;for(const layer of [item.bowl,item.bowlBack]){layer.style.width=width+'px';layer.style.height=height+'px';layer.style.left=(r.left-s.left+r.width*.5-width*.5)+'px';layer.style.top=(r.top-s.top+r.height*.90-height*.84)+'px';}if(item.headCanvas){Object.assign(item.headCanvas.style,{left:(r.left-s.left)+'px',top:(r.top-s.top)+'px',width:r.width+'px',height:r.height+'px'});}}
 function beginPour(item,now){
  if(pour?.item===item&&now<pour.end-300){pour.end=Math.min(pour.start+2100,Math.max(pour.end,now+1400));return;}
  pour={item,start:now,end:now+1400,from:lastBagGrip||bagGripAt(pointer||bowlTarget(item),bagHeight()),nextGrain:now+250};
 }
 function bowlTarget(item){const r=item.bowl.getBoundingClientRect();return{x:r.left+r.width*.51,y:r.top+r.height*.32};}
 function bagOpening(height){const p=manifest.props['food-bag'],w=p.source[2]/p.source[3]*height;return{x:w*.35,y:-height*.55};}
 function bagHeight(){return innerWidth<=650?80:104;}
 function bagGripAt(point,height){const opening=bagOpening(height);return{x:point.x-opening.x,y:point.y-opening.y};}
 function bagPose(now){
  if(!pour)return null;if(now>=pour.end){pour=null;return null;}
  const elapsed=now-pour.start,target=bowlTarget(pour.item),height=bagHeight(),tilt=Math.PI*2/3,opening=bagOpening(height);
  const dx=opening.x*Math.cos(tilt)-opening.y*Math.sin(tilt),dy=opening.x*Math.sin(tilt)+opening.y*Math.cos(tilt),hold={x:target.x-dx,y:target.y-48-dy};
  const ease=n=>{n=clamp(n,0,1);return n*n*(3-2*n);};let angle,grip;
  if(elapsed<250){const t=ease(elapsed/250);angle=tilt*t;grip={x:lerp(pour.from.x,hold.x,t),y:lerp(pour.from.y,hold.y,t)};}
  else if(now>pour.end-300){const t=ease((now-pour.end+300)/300),to=pointer?bagGripAt(pointer,height):pour.from;angle=tilt*(1-t);grip={x:lerp(hold.x,to.x,t),y:lerp(hold.y,to.y,t)};}
  else{angle=tilt;grip=hold;}
  return{grip,angle,height,mouth:{x:grip.x+opening.x*Math.cos(angle)-opening.y*Math.sin(angle),y:grip.y+opening.x*Math.sin(angle)+opening.y*Math.cos(angle)}};
 }
 function drawBag(ctx,height,angle){const p=manifest.props['food-bag'],[,,w,h]=p.source,scale=height/h;ctx.save();ctx.rotate(angle);clipped(ctx,p.image,p.source,p.runs,-w*scale*.5,-height*.62,w*scale,height);ctx.restore();}
 function bind(){
  const next=document.querySelector('.hero');if(next===stage)return;
  for(const item of cats){delete item.cat.dataset.playActive;clearTimeout(item.signalTimer);}
  stage=next;cats=[];dock.hidden=!stage;status.hidden=dock.hidden||!mode&&!menuOpen;
  if(!stage){cursor.hidden=true;document.body.classList.remove('cat-play-mode');return;}
  stage.dataset.interactive='true';
  for(const cat of stage.querySelectorAll('.cat-portrait')){
   const id=cat.dataset.cat;
   if(!sessions.has(id))sessions.set(id,{id,name:catNames[id],prefix:id==='1'?'black':'cat-'+id,feeding:new LedgerCatPlay.Feeding(),playStarted:0,playUntil:0,lastBat:0,batCount:0,lastAction:'',restoreUntil:0,restoreKind:''});
   const item=sessions.get(id);item.cat=cat;item.baseCanvas=cat.querySelector('.cat-motion');item.lastAction='';item.playUntil=0;item.restoreUntil=0;
   const actionCanvas=document.createElement('canvas');actionCanvas.className='cat-play-frame';actionCanvas.width=512;actionCanvas.height=768;actionCanvas.setAttribute('aria-hidden','true');actionCanvas.dataset.cat=id;cat.append(actionCanvas);item.actionCanvas=actionCanvas;
   const headCanvas=document.createElement('canvas');headCanvas.className='cat-play-head';headCanvas.width=512;headCanvas.height=768;headCanvas.dataset.cat=id;headCanvas.dataset.region='head-only';headCanvas.hidden=true;headCanvas.setAttribute('aria-hidden','true');stage.append(headCanvas);item.headCanvas=headCanvas;
   const bowlBack=document.createElement('canvas');bowlBack.className='cat-play-bowl-back';bowlBack.width=330;bowlBack.height=310;bowlBack.dataset.cat=id;bowlBack.hidden=true;bowlBack.setAttribute('aria-hidden','true');stage.append(bowlBack);item.bowlBack=bowlBack;
   const bowl=document.createElement('button');bowl.className='cat-play-bowl';bowl.dataset.cat=id;bowl.hidden=true;bowl.innerHTML='<canvas width="330" height="310" aria-hidden="true"></canvas><span class="cat-play-bowl-label">加料</span>';stage.append(bowl);item.bowl=bowl;item.lastBowlAmount=-1;
   bowl.addEventListener('click',event=>{event.stopPropagation();if(mode!=='feed')setMode('feed');const time=performance.now(),feeding=item.feeding;item.visualFood??=feeding.amount;item.foodStartsAt=time+500;feeding.add(time);beginPour(item,time);setMessage(item.name+'：'+(feeding.amount>=.999?'裝滿了！等 3 秒開始吃，滿碗約 15 秒。':'正在從袋口倒入 '+Math.round(feeding.amount*3)+'/3 碗。'));schedule();});
   const signal=document.createElement('span');signal.className='cat-play-signal';cat.append(signal);item.signal=signal;cats.push(item);positionBowl(item);
  }
  if(mode)document.body.classList.add('cat-play-mode');schedule();
 }
 function signalText(item,text){const signal=item.signal;signal.textContent=text;signal.classList.add('show');clearTimeout(item.signalTimer);item.signalTimer=setTimeout(()=>signal.classList.remove('show'),1200);}
 function paintEatingHead(item,data,f,scale,dx,dy,index){
  // Repaint only the lowered head above the complete bowl. Chest and forelegs stay behind it.
  const canvas=item.headCanvas,ctx=canvas.getContext('2d'),[,,w,h]=f.source;
  const chin={1:.56,2:.64,3:.69,4:.66,5:.70}[item.id]*h,side=chin*.72,cx=f.anchor[0],radius=data.neutralHeight*.24;
  ctx.clearRect(0,0,512,768);ctx.save();ctx.beginPath();ctx.moveTo(dx+(cx-radius)*scale,dy);ctx.lineTo(dx+(cx+radius)*scale,dy);ctx.lineTo(dx+(cx+radius)*scale,dy+side*scale);ctx.quadraticCurveTo(dx+cx*scale,dy+(2*chin-side)*scale,dx+(cx-radius)*scale,dy+side*scale);ctx.closePath();ctx.clip();
  clipped(ctx,data.image,f.source,f.runs,dx,dy,w*scale,h*scale);ctx.restore();canvas.hidden=false;canvas.dataset.frame=String(index);canvas.dataset.bodyExcluded='true';
 }
 function paintAction(item,action,index,flip=false){
  if(!ready)return;const kind=item.prefix+'-'+action,data=manifest.actions[kind];if(!data)return;
  const key=kind+':'+index+':'+flip;if(item.lastAction===key)return;
  const actionCanvas=item.actionCanvas,f=data.frames[index],ctx=actionCanvas.getContext('2d'),scale=actionCanvas.height*.87/data.neutralHeight,[,,w,h]=f.source;
  const dx=256-f.anchor[0]*scale,dy=768*.96-f.anchor[1]*scale;
  ctx.clearRect(0,0,512,768);ctx.save();if(flip){ctx.translate(512,0);ctx.scale(-1,1);}clipped(ctx,data.image,f.source,f.runs,dx,dy,w*scale,h*scale);ctx.restore();
  if(action==='eat'&&index>=3&&index<=5&&item.feeding.visible)paintEatingHead(item,data,f,scale,dx,dy,index);else item.headCanvas.hidden=true;
  item.cat.dataset.playActive='true';actionCanvas.dataset.action=kind;actionCanvas.dataset.frame=String(index);actionCanvas.dataset.bats=String(item.batCount);actionCanvas.dataset.facing=flip?'left':'right';item.lastAction=key;
 }
 function restAction(item){delete item.cat.dataset.playActive;item.headCanvas.hidden=true;item.actionCanvas.dataset.action='idle';item.actionCanvas.dataset.frame='-1';item.lastAction='';}
 function drawParticles(now){
  const ctx=particleCanvas.getContext('2d'),dpr=Math.min(devicePixelRatio||1,2);if(particleCanvas.width!==innerWidth*dpr||particleCanvas.height!==innerHeight*dpr){particleCanvas.width=innerWidth*dpr;particleCanvas.height=innerHeight*dpr;}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,innerWidth,innerHeight);
  if(pour&&bagMouth&&!cursor.hidden&&now>=pour.nextGrain&&now<pour.end-300){const target=bowlTarget(pour.item);pour.nextGrain=now+27;particles.push({start:now,x:bagMouth.x,y:bagMouth.y,tx:target.x+(Math.random()-.5)*pour.item.bowl.getBoundingClientRect().width*.26,ty:target.y+(Math.random()-.5)*4,rotation:Math.random()*6});particleCanvas.dataset.originX=bagMouth.x.toFixed(2);particleCanvas.dataset.originY=bagMouth.y.toFixed(2);}
  particles=particles.filter(p=>now-p.start<430);particleCanvas.dataset.grains=String(particles.length);
  for(const p of particles){const t=(now-p.start)/420;if(t<0||t>1)continue;const x=lerp(p.x,p.tx,t),y=lerp(p.y,p.ty,t*t);ctx.save();ctx.translate(x,y);ctx.rotate(p.rotation+t*4);ctx.fillStyle=t>.94?'#92653b99':'#92653b';ctx.beginPath();ctx.ellipse(0,0,3.1,2.5,0,0,Math.PI*2);ctx.fill();ctx.restore();}
 }
 function pointerInHero(p){if(!p||!stage)return false;const r=stage.getBoundingClientRect();return p.x>=r.left&&p.x<=r.right&&p.y>=r.top-90&&p.y<=r.bottom+30;}
 function drawCursor(now,dt){
  if((!pointer&&!pour)||!mode||!stage||document.querySelector('dialog[open]')){cursor.hidden=true;bagMouth=null;return null;}
  const visible=!!pour||pointerInHero(pointer);cursor.hidden=!visible;if(!visible)return null;
  const ctx=cursorContext;ctx.clearRect(0,0,600,600);let target,cursorPosition=pointer;bagMouth=null;
  if(mode==='feed'){
   const pose=bagPose(now),height=pose?.height||bagHeight();cursorPosition=pose?.grip||(pointer?bagGripAt(pointer,height):null);if(!cursorPosition){cursor.hidden=true;return null;}lastBagGrip={...cursorPosition};
   cursorCanvas.style.width='200px';cursorCanvas.style.height='200px';cursorCanvas.style.left='-100px';cursorCanvas.style.top='-120px';cursorCanvas.style.transform='none';
   ctx.save();ctx.scale(3,3);ctx.translate(100,120);drawBag(ctx,height,pose?.angle||0);ctx.restore();
   bagMouth=pose?.mouth||{x:cursorPosition.x+bagOpening(height).x,y:cursorPosition.y+bagOpening(height).y};target=bagMouth;
   cursorCanvas.dataset.pouring=String(!!pose);cursorCanvas.dataset.bagMouthX=bagMouth.x.toFixed(2);cursorCanvas.dataset.bagMouthY=bagMouth.y.toFixed(2);
  }
  else if(mode==='treat'){cursorCanvas.style.width='105px';cursorCanvas.style.height='105px';cursorCanvas.style.left='-89px';cursorCanvas.style.top='-12px';cursorCanvas.style.transform='none';prop(ctx,'treat-icon',0,0,600,600);target={x:pointer.x,y:pointer.y};}
  else{
   const tip={x:90,y:-150},worldTip={x:pointer.x+tip.x,y:pointer.y+tip.y},end=teaser.step(worldTip,dt/1000);
   cursorCanvas.style.width='400px';cursorCanvas.style.height='400px';cursorCanvas.style.left='-80px';cursorCanvas.style.top='-215px';cursorCanvas.style.transform='none';
   ctx.save();ctx.scale(1.5,1.5);ctx.translate(80,215);drawWand(ctx,tip,{x:end.x-pointer.x,y:end.y-pointer.y},teaser.angle);ctx.restore();
   target={x:end.x+Math.sin(teaser.angle*.55)*20,y:end.y+Math.cos(teaser.angle*.55)*20};
   cursorCanvas.dataset.stringLength=String(teaser.length);cursorCanvas.dataset.tipX=worldTip.x.toFixed(2);cursorCanvas.dataset.tipY=worldTip.y.toFixed(2);cursorCanvas.dataset.lureX=end.x.toFixed(2);cursorCanvas.dataset.lureY=end.y.toFixed(2);
  }
  cursor.style.transform=`translate(${cursorPosition.x}px,${cursorPosition.y}px)`;document.dispatchEvent(new CustomEvent('cat:target',{detail:target}));return target;
 }
 function nearestCat(target){
  if(!target||!['treat','wand'].includes(mode))return null;let nearest=null,best=Infinity;
  for(const item of cats){const r=item.baseCanvas.getBoundingClientRect(),dx=(target.x-r.left-r.width*.5)/r.width,dy=(target.y-r.top-r.height*(mode==='treat'?.43:.3))/r.height;
   const near=mode==='treat'?Math.abs(dx)<.38&&Math.abs(dy)<.115:Math.abs(dx)<.95&&dy>-.32&&dy<.34;
   const distance=dx*dx+dy*dy;if(near&&distance<best){nearest=item;best=distance;}
  }return nearest;
 }
 function updateCat(item,time,target,isTarget){
  const {feeding,bowl}=item,previousPhase=feeding.phase;feeding.tick(time);positionBowl(item);const r=item.baseCanvas.getBoundingClientRect();
  bowl.hidden=!feeding.visible;item.bowlBack.hidden=!feeding.visible;if(!feeding.visible)item.headCanvas.hidden=true;bowl.dataset.phase=feeding.phase;bowl.dataset.portions=feeding.amount.toFixed(4);bowl.setAttribute('aria-label',`${item.name}的碗，約 ${Math.round(feeding.amount*100)}% 滿，點擊增加三分之一碗`);
  if(feeding.visible){item.visualFood??=feeding.amount;if(feeding.phase==='waiting'){if(time>=(item.foodStartsAt||0))item.visualFood+=(feeding.amount-item.visualFood)*.18;}else item.visualFood=feeding.amount;const key=Math.ceil(item.visualFood*43);if(item.lastBowlAmount!==key){drawBowlLayers(item,item.visualFood);item.lastBowlAmount=key;}const label=bowl.querySelector('.cat-play-bowl-label');label.textContent=feeding.phase==='eating'?Math.ceil(feeding.amount*15)+'秒':feeding.amount?Math.round(feeding.amount*3)+'/3':'加料';}
  let action=false;
  if(feeding.phase==='eating'){
   const elapsed=time-feeding.startAt,frame=elapsed<480?Math.min(4,Math.floor(elapsed/120)):[3,4,5,4][Math.floor((elapsed-480)/150)%4];paintAction(item,'eat',frame);crunch(time);action=true;
  }else if(previousPhase==='eating'&&feeding.phase==='finished'){item.restoreUntil=time+420;item.restoreKind='eat';signalText(item,'吃飽了，謝謝你 ♡');setMessage(item.name+'吃飽了，牠的碗收好囉。');}
  if(!action&&item.restoreUntil>time&&item.restoreKind==='eat'){paintAction(item,'eat',time>item.restoreUntil-200?7:6);action=true;}
  if(!action&&mode==='treat'){
   if(isTarget){if(item.restoreKind!=='lick'){item.playStarted=time;item.restoreKind='lick';}const seq=[1,2,3,4,5,6],index=seq[Math.floor((time-item.playStarted)/105)%seq.length];paintAction(item,'lick',index);crunch(time,true);action=true;}
   else if(item.restoreKind==='lick'){item.restoreUntil=time+140;item.restoreKind='rest';}
  }
  if(!action&&mode==='wand'&&target){const dx=target.x-(r.left+r.width*.5);
   if(isTarget&&time>item.playUntil+260){item.playStarted=time;item.playUntil=time+850;}
   if(time<item.playUntil){const t=time-item.playStarted,index=clamp(Math.floor(t/112),0,7),flip=dx<0;paintAction(item,'play',index,flip);action=true;const pawX=r.left+r.width*(flip?.2:.8),pawY=r.top+r.height*.31;if(isTarget&&index>=3&&index<=5&&Math.hypot(target.x-pawX,target.y-pawY)<Math.max(35,r.width*.6)&&time-item.lastBat>450){item.lastBat=time;item.batCount++;teaser.kick(flip?-1:1);signalText(item,'撥到了！');item.actionCanvas.dataset.bats=String(item.batCount);}}
  }
  if(!action&&item.restoreUntil>time&&item.restoreKind==='rest'){paintAction(item,'lick',7);action=true;}
  if(!action)restAction(item);
 }
 function tick(time){
  raf=0;if(!stage||!ready)return;const dt=Math.min(50,time-(previous||time-16));previous=time;const target=drawCursor(time,dt),nearest=nearestCat(target);
  for(const item of cats)updateCat(item,time,target,item===nearest);drawParticles(time);
  if(mode||cats.some(item=>item.feeding.visible||item.restoreUntil>time)||particles.length)raf=requestAnimationFrame(tick);
 }
 function schedule(){if(!raf)raf=requestAnimationFrame(tick);}
 const onPointer=event=>{if(event.target.closest('.cat-play-dock,.cat-play-status'))return;pointer={x:event.clientX,y:event.clientY};if(mode)schedule();};
 window.addEventListener('pointermove',onPointer,{passive:true});window.addEventListener('pointerdown',onPointer,{passive:true});window.addEventListener('resize',()=>{cats.forEach(positionBowl);schedule();},{passive:true});window.addEventListener('scroll',()=>{cats.forEach(positionBowl);schedule();},{passive:true});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){setMode(null);setMenu(false);}});document.addEventListener('ledger:render',bind);
 window.addEventListener('blur',()=>{pointer=null;cursor.hidden=true;});window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);raf=0;audio?.suspend();});
 (async()=>{try{manifest=await fetch(ASSET+'manifest.json').then(r=>{if(!r.ok)throw Error('素材尚未載入');return r.json();});await Promise.all([...Object.values(manifest.actions),...Object.values(manifest.props)].map(async a=>a.image=await imageFor(a.file)));ready=true;menuIcons();bind();if(menuOpen)setMessage('和五隻貓咪玩一會兒吧。');schedule();}catch(error){setMessage('貓咪素材載入未完成，重新整理後再試一次。');console.warn('Cat play:',error.message);}})();
 bind();
})();
