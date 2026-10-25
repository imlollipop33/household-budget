(function(root){
'use strict';
class Feeding{
 constructor(){this.amount=0;this.visible=false;this.phase='empty';this.lastTick=0;this.startAt=0;this.fullBowlMs=15000;this.delayMs=3000;this.meals=0;}
 show(){if(!this.visible){this.visible=true;this.phase='empty';this.amount=0;}}
 add(now){this.tick(now);this.visible=true;this.amount=Math.min(1,this.amount+1/3);this.phase='waiting';this.startAt=now+this.delayMs;this.lastTick=now;return this.amount;}
 tick(now){
  if(this.phase==='waiting'&&now>=this.startAt){this.phase='eating';this.lastTick=this.startAt;}
  if(this.phase==='eating'){this.amount=Math.max(0,this.amount-(now-this.lastTick)/this.fullBowlMs);this.lastTick=now;if(this.amount<1e-6){this.amount=0;this.phase='finished';this.visible=false;this.meals++;}}
  return this;
 }
}
// A free string of fixed length: the lure hangs below the rod tip and swings independently.
class Teaser{
 constructor(){this.length=132;this.reset();}
 reset(){this.angle=0;this.speed=0;this.previousTip=null;this.velocity=0;}
 kick(direction){this.speed+=direction*2.3;}
 step(tip,seconds){
  const dt=Math.max(.001,Math.min(seconds,.05)),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const velocity=this.previousTip?clamp((tip.x-this.previousTip.x)/dt,-1600,1600):0;
  const acceleration=this.previousTip?clamp((velocity-this.velocity)/dt,-2200,2200):0;
  const steps=Math.ceil(dt/.008),h=dt/steps;
  for(let i=0;i<steps;i++){
   this.speed+=(-15*Math.sin(this.angle)-3*this.speed-acceleration/this.length*Math.cos(this.angle))*h;
   this.angle=clamp(this.angle+this.speed*h,-1.05,1.05);
  }
  this.previousTip={...tip};this.velocity=velocity;
  return{x:tip.x+Math.sin(this.angle)*this.length,y:tip.y+Math.cos(this.angle)*this.length};
 }
}
const api={Feeding,Teaser};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LedgerCatPlay=api;
})(typeof window!=='undefined'?window:globalThis);
