'use strict';
// Restrict atlas sampling to this cat's connected silhouette; nearby frames cannot leak through.
window.LedgerCatPainter=Object.freeze({
  create(canvas,image,data){
    const ctx=canvas.getContext('2d'),paths=new Map();
    if(!ctx||data.frames.length!==15||data.masks?.length!==15)throw Error('Incomplete cat silhouettes');
    return index=>{
      const [sx,sy,sw,sh,ax,ay]=data.frames[index],scale=canvas.height*.87/data.frames[7][5];
      const dx=canvas.width*.5-ax*scale,dy=canvas.height*.96-ay*scale;
      if(!paths.has(index)){
        const path=new Path2D();
        for(const [x,y,w,h] of data.masks[index])path.rect(dx+x*scale,dy+y*scale,w*scale,h*scale);
        paths.set(index,path);
      }
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.save();
      try{
        ctx.clip(paths.get(index));
        ctx.drawImage(image,sx+.5,sy+.5,sw-1,sh-1,dx,dy,(sw-1)*scale,(sh-1)*scale);
      }finally{ctx.restore();}
    };
  }
});

