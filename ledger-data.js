(function(root){
'use strict';
const isKey=k=>/^hh_(?:exp_\d{4}|inc_\d{4}|spaid_(?:id_)?\d{4}_\d{2}|settled_[\w-]+|cats|cur_year|sync_url)$/.test(k);
function normalize(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('帳目備份格式不正確');
 const out={};
 for(const k of Object.keys(raw)){if(!isKey(k))continue;let value=String(raw[k]??'');for(let n=1;Object.hasOwn(raw,k+'__'+n);n++)value+=String(raw[k+'__'+n]??'');out[k]=value;}
 for(const k of Object.keys(raw)){const match=k.match(/^(.*)__(\d+)$/);if(match&&isKey(match[1])&&!Object.hasOwn(out,match[1]))throw Error('資料分段不完整：'+match[1]);}
 if(!Object.keys(out).length)throw Error('找不到原帳本資料');
 return out;
}
function validate(raw){
 const d=normalize(raw);
 for(const [k,v] of Object.entries(d)){
  if(k==='hh_cats'){const a=JSON.parse(v);if(!Array.isArray(a)||a.some(c=>typeof c!=='string'))throw Error('分類格式不正確');}
  const match=k.match(/^hh_(exp|inc)_(\d{4})$/);if(!match)continue;
  const list=JSON.parse(v);if(!Array.isArray(list))throw Error('帳目格式不正確：'+k);const ids=new Set();
  for(const r of list){
   if(!r||typeof r!=='object'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||new Date(r.date+'T12:00:00Z').toISOString().slice(0,10)!==r.date)throw Error('帳目日期不正確：'+k);
   if(r.date.slice(0,4)!==match[2])throw Error('帳目年度不一致：'+k);
   if(r.id===undefined||ids.has(String(r.id)))throw Error('帳目編號重複或缺少：'+k);ids.add(String(r.id));
   const fields=match[1]==='exp'?['qty','price']:['amount'];
   for(const f of fields)if(r[f]===null||r[f]===''||!Number.isFinite(Number(r[f])))throw Error('帳目金額或數量不正確：'+k);
   if(match[1]==='exp')for(const f of ['gst','pst'])if(r[f]!=null&&!Number.isFinite(Number(r[f])))throw Error('稅額不正確：'+k);
  }
 }
 return d;
}
function collect(storage){const d={};for(let i=0;i<storage.length;i++){const k=storage.key(i);if(isKey(k)||/^(hh_(?:exp|inc)_\d{4})__\d+$/.test(k))d[k]=storage.getItem(k);}return normalize(d);}
function signature(d){return JSON.stringify(Object.fromEntries(Object.entries(normalize(d)).filter(([k])=>k!=='hh_sync_url'&&k!=='hh_cur_year').sort(([a],[b])=>a.localeCompare(b))));}
function chunks(raw){const out={};for(const [k,v]of Object.entries(validate(raw))){out[k]=v.slice(0,8000);for(let n=1;n*8000<v.length;n++)out[k+'__'+n]=v.slice(n*8000,(n+1)*8000);}return out;}
function replace(storage,raw){
 const data=validate(raw),before={};for(let i=0;i<storage.length;i++){const k=storage.key(i);if(isKey(k)||/^hh_.*__\d+$/.test(k))before[k]=storage.getItem(k);}
 const protectedKeys=['hh_sync_url','hh_cur_year'].filter(k=>Object.hasOwn(before,k));
 const clear=()=>{const keys=[];for(let i=0;i<storage.length;i++){const k=storage.key(i);if((isKey(k)||/^hh_.*__\d+$/.test(k))&&!protectedKeys.includes(k))keys.push(k);}keys.forEach(k=>storage.removeItem(k));};
 try{clear();for(const [k,v]of Object.entries(data))if(!protectedKeys.includes(k))storage.setItem(k,v);}
 catch(error){clear();for(const [k,v]of Object.entries(before))storage.setItem(k,v);throw error;}
}
const api=Object.freeze({isKey,normalize,validate,collect,signature,chunks,replace});
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LedgerData=api;
})(typeof window!=='undefined'?window:globalThis);
