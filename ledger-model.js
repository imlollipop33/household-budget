(function(root){
'use strict';
const LD=typeof module!=='undefined'&&module.exports?require('./ledger-data.js'):root.LedgerData;
const DEFAULT_SYNC='https://script.google.com/macros/s/AKfycbz2fyFw2U5FY7Uvz6fn04b2lk_FdOVTBR4pQvP8Cj29NhDzSXT9482t8BCtSUvebg/exec';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const total=e=>e.qty*e.price+(e.gst||0)+(e.pst||0);
function personalTotals(records){let kaiSpend=0,hanSpend=0,kaiPaid=0,hanPaid=0;records.forEach(e=>{const t=total(e);if(e.who==='kai')kaiSpend+=t;else if(e.who==='han')hanSpend+=t;else{kaiSpend+=t/2;hanSpend+=t/2;}if(e.paidBy==='kai')kaiPaid+=t;else hanPaid+=t;});return {kaiSpend,hanSpend,kaiPaid,hanPaid};}
function calcSettle(records){let balance=0;records.forEach(e=>{const t=total(e);if(e.who==='kai'){if(e.paidBy!=='kai')balance+=t;}else if(e.who==='han'){if(e.paidBy!=='han')balance-=t;}else balance+=e.paidBy==='kai'?-t/2:t/2;});return balance;}
function fromRaw(input,prefs={}){
 const raw=LD.validate(input),expenses=[],incomes=[],settlements={};
 for(const [key,text]of Object.entries(raw)){const m=key.match(/^hh_(exp|inc)_(\d{4})$/);if(!m)continue;const target=m[1]==='exp'?expenses:incomes;for(const r of JSON.parse(text))target.push({...r,id:Number(m[2])*1e9+Number(r.id),_ledgerId:r.id,_ledgerYear:m[2]});}
 for(const [key,value]of Object.entries(raw)){const m=key.match(/^hh_spaid_(\d{4})_(\d{2})$/);if(!m||value!=='1')continue;const k=m[1]+'-'+m[2],id=raw['hh_spaid_id_'+m[1]+'_'+m[2]],inc=incomes.find(i=>i._ledgerYear===m[1]&&String(i._ledgerId)===String(id));if(inc){inc._derivedSettlementKey=true;inc.settlementKey=k;}settlements[k]={amount:inc?.amount||Math.round(Math.abs(calcSettle(expenses.filter(e=>e.date.startsWith(k))))*100)/100,from:'han',to:'kai',date:inc?.date||k+'-01',incomeId:inc?.id};}
 for(const [key,value]of Object.entries(raw)){const m=key.match(/^hh_settled_transfer_(\d{4})_(\d{2})$/);if(m){const paid=JSON.parse(value),k=m[1]+'-'+m[2],inc=incomes.find(i=>i._ledgerYear===m[1]&&String(i._ledgerId)===String(paid.incomeId));if(inc){inc._derivedSettlementKey=true;inc.settlementKey=k;}settlements[k]={...paid,incomeId:inc?.id};}}
 return {version:1,demo:false,people:{kai:'凱',han:'涵',...(prefs.people||{})},categories:JSON.parse(raw.hh_cats||'[]'),expenses,incomes,settlements,config:{year:Number(raw.hh_cur_year)||new Date().getFullYear(),month:Number(prefs.month)||new Date().getMonth()+1,budget:Number(prefs.budget)||0,cloudUrl:raw.hh_sync_url||DEFAULT_SYNC}};
}
function toRaw(view,input){
 const raw={...LD.validate(input)},old=fromRaw(raw),idMap=new Map();
 for(const [collection,prefix]of [['expenses','hh_exp_'],['incomes','hh_inc_']]){
  const lists={},used={};
  const stationary=view[collection].filter(r=>r._ledgerYear===r.date.slice(0,4)),moved=view[collection].filter(r=>r._ledgerYear!==r.date.slice(0,4));
  for(const r of [...stationary,...moved]){const y=r.date.slice(0,4);used[y]??=new Set();let id=r._ledgerId;if(id===undefined||used[y].has(String(id))){const oldIds=JSON.parse(raw[prefix+y]||'[]').map(e=>Number(e.id));id=Math.max(0,...oldIds,...[...used[y]].map(Number))+1;}used[y].add(String(id));idMap.set(collection+':'+r.id,{id,year:y});}
  for(const r of view[collection]){const y=r.date.slice(0,4),copy={...r,id:idMap.get(collection+':'+r.id).id};delete copy._ledgerId;delete copy._ledgerYear;delete copy._derivedSettlementKey;if(r._derivedSettlementKey)delete copy.settlementKey;(lists[y]??=[]).push(copy);}
  const years=new Set([...Object.keys(raw).filter(k=>k.startsWith(prefix)).map(k=>k.slice(prefix.length)),...Object.keys(lists)]);
  for(const y of years){const key=prefix+y,list=lists[y]||[];if(!Object.hasOwn(raw,key)||!same(JSON.parse(raw[key]),list))raw[key]=JSON.stringify(list);}
 }
 if(!same(view.categories,old.categories))raw.hh_cats=JSON.stringify(view.categories);
 for(const key of new Set([...Object.keys(old.settlements),...Object.keys(view.settlements)])){
  if(same(old.settlements[key],view.settlements[key]))continue;
  const [year,mm]=key.split('-'),paid=view.settlements[key];delete raw['hh_spaid_'+year+'_'+mm];delete raw['hh_spaid_id_'+year+'_'+mm];delete raw['hh_settled_transfer_'+year+'_'+mm];
  if(paid){const id=idMap.get('incomes:'+paid.incomeId)?.id;if(paid.from==='han'){raw['hh_spaid_'+year+'_'+mm]='1';if(id!==undefined)raw['hh_spaid_id_'+year+'_'+mm]=String(id);}else raw['hh_settled_transfer_'+year+'_'+mm]=JSON.stringify({...paid,incomeId:id});}
 }
 raw.hh_cur_year=String(view.config.year);return LD.validate(raw);
}
function summary(view,year,mm){
 const key=year+'-'+mm,ex=view.expenses.filter(e=>e.date.startsWith(key)),inc=view.incomes.filter(e=>e.date.startsWith(key)),p=personalTotals(ex);
 const income=w=>inc.filter(i=>i.who===w).reduce((s,i)=>s+i.amount,0),extra=mm>='02'?ex.filter(e=>e.who==='kai'&&e.cat==='個人消費').reduce((s,e)=>s+total(e),0):0;
 let kaiInc=0,hanInc=0,kaiSpend=0,hanSpend=0,kaiExtraDeduct=0;
 for(let m=1;m<=Number(mm);m++){const k=year+'-'+String(m).padStart(2,'0'),es=view.expenses.filter(e=>e.date.startsWith(k)),is=view.incomes.filter(i=>i.date.startsWith(k)),pt=personalTotals(es);kaiInc+=is.filter(i=>i.who==='kai').reduce((s,i)=>s+i.amount,0);hanInc+=is.filter(i=>i.who==='han').reduce((s,i)=>s+i.amount,0);kaiSpend+=pt.kaiSpend;hanSpend+=pt.hanSpend;if(m>=2)kaiExtraDeduct+=es.filter(e=>e.who==='kai'&&e.cat==='個人消費').reduce((s,e)=>s+total(e),0);}
 return {p,extra,income:{kai:income('kai'),han:income('han')},balance:{kai:income('kai')-p.kaiSpend-extra,han:income('han')-p.hanSpend},cumulative:{kai:kaiInc-kaiSpend-kaiExtraDeduct,han:hanInc-hanSpend},cumulativeRaw:{kaiInc,hanInc,kaiSpend,hanSpend,kaiExtraDeduct}};
}
const api={DEFAULT_SYNC,fromRaw,toRaw,total,personalTotals,calcSettle,summary};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LedgerModel=api;
})(typeof window!=='undefined'?window:globalThis);
