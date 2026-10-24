'use strict';
// Presentation layer over the ORIGINAL ledger. No schema conversion or demo records.
const llData=window.LedgerData;
let llMonth=String(new Date().getMonth()+1).padStart(2,'0'),llPage='overview',llIncomeMode=false,llSyncBusy=false,llMovedForm=null,llInitialized=false;
const llLabels={overview:['OUR LITTLE LIFE','我們的小日子','每一筆日常，都在往喜歡的生活靠近。'],records:['THE EVERYDAY DETAILS','把日常記清楚','完整保留數量、金額、稅額、歸屬、付款人與備註。'],calendar:['LITTLE DAYS, LITTLE ENTRIES','日子裡的每一筆','用月曆看看這個月的生活軌跡。'],settlement:['BETTER, TOGETHER','兩個人，剛剛好','每一筆代付與還款，沿用原帳本的計算方式。'],year:['A YEAR OF OUR LITTLE LIFE','回頭看，也走了好遠','完整保留全年收支、累計資產、圖表與月份明細。'],settings:['MAKE IT YOURS','我們的帳本設定','備份、匯出匯入，和手機電腦共用的雲端帳本。']};
const llEsc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const llOriginal={showPanel,renderMonth,renderYear,saveExp,saveInc,addExpense,addIncome};
function llLocal(){try{return llData.collect(localStorage);}catch{return {hh_cats:JSON.stringify(CATS),hh_cur_year:String(currentYear)};}}
function llSnapshot(){return {...llLocal(),['hh_exp_'+currentYear]:JSON.stringify(expenses),['hh_inc_'+currentYear]:JSON.stringify(incomes),hh_cats:JSON.stringify(CATS)};}
function llHasRecords(d){return Object.keys(d).some(k=>/^hh_(exp|inc)_\d{4}$/.test(k)&&JSON.parse(d[k]).length);}
function llStatus(text,error=false){const e=document.getElementById('ll-cloud-status');if(e){e.textContent=text;e.classList.toggle('ll-warning',error);}const s=document.getElementById('ll-save-indicator');if(s)s.textContent=text;}
function llMarkDirty(){localStorage.setItem('ll_unsynced','1');llStatus('已儲存於此裝置・有新變更待雲端同步');}
function llSafety(label,raw=llSnapshot()){
 const backup={format:'household-budget-safety',savedAt:new Date().toISOString(),label,data:raw};
 const previous=localStorage.getItem('ll_safety_latest');if(previous)localStorage.setItem('ll_safety_previous',previous);
 localStorage.setItem('ll_safety_latest',JSON.stringify(backup));return backup;
}
function llDownload(text,name,type='application/json;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function llExportSafety(){const text=localStorage.getItem('ll_migration_backup_v1')||localStorage.getItem('ll_safety_latest');if(!text){showToast('尚無自動備份，請先匯出目前帳本。');return;}llDownload(text,'家庭帳本_更新前自動備份.json');}
function llRestoreSafety(){const text=localStorage.getItem('ll_safety_latest');if(!text){showToast('尚無自動備份');return;}const b=JSON.parse(text);if(!confirm('還原最近一次自動備份（'+b.label+'）？目前帳目也會先備份。'))return;llApply(b.data,false);llMarkDirty();showToast('已還原備份；確認後可再雲端同步。');}
function llEnsureMonth(mm){const p=document.getElementById('panel-m'+mm);if(!p.dataset.built){p.innerHTML=buildMonthPanel(mm);p.dataset.built='1';bindListeners(mm);}llTagMonth(p,mm);return p;}
function llTagMonth(p,mm){
 p.classList.add('ll-month-panel');
 const forms=p.querySelectorAll('.form-section');forms[0]?.classList.add('ll-income-form');forms[1]?.classList.add('ll-expense-form');
 p.querySelector('.income-grid')?.classList.add('ll-income-records');p.querySelector('#list-view-'+mm)?.closest('.section')?.classList.add('ll-record-section');
 if(!p.querySelector('.ll-record-controls'))p.insertAdjacentHTML('afterbegin',`<div class="ll-record-controls"><div class="segmented"><button onclick="llSetIncome(false)">支出</button><button onclick="llSetIncome(true)">收入</button></div><div><button class="text-button" onclick="exportMonthCSV('${mm}')">匯出本月 CSV ↗</button><button class="button subtle" onclick="llOpenAdd('income')">＋ 新增收入</button></div></div>`);
 p.classList.toggle('ll-income-mode',llIncomeMode);
}
function llNavigate(page){
 if(!llLabels[page])page='overview';llCloseAdd();llPage=page;
 const panelName=['records','calendar','settlement'].includes(page)?'m'+llMonth:page;
 llOriginal.showPanel(panelName,document.querySelector(`[data-ll-page="${page}"]`));
 if(panelName.startsWith('m')){llEnsureMonth(llMonth);switchView(llMonth,page==='calendar'?'cal':'list');}
 document.body.className='ll-page-'+page;
 document.querySelectorAll('[data-ll-page]').forEach(b=>b.classList.toggle('active',b.dataset.llPage===page));
 const labels=llLabels[page];document.getElementById('ll-eyebrow').textContent=labels[0];document.getElementById('ll-title').textContent=labels[1];document.getElementById('ll-description').textContent=labels[2];
 document.getElementById('ll-month').value=llMonth;
 const years=new Set([currentYear,new Date().getFullYear(),currentYear-1,currentYear+1]);for(const k of Object.keys(llLocal())){const m=k.match(/^hh_(?:exp|inc)_(\d{4})$/);if(m)years.add(Number(m[1]));}
 document.getElementById('ll-year').innerHTML=[...years].sort((a,b)=>a-b).map(y=>`<option value="${y}" ${y===currentYear?'selected':''}>${y}</option>`).join('');
 document.getElementById('ll-cats').innerHTML=CATS.map(c=>'<span>'+llEsc(c)+'</span>').join('');
 document.getElementById('ll-sync-url').value=getSyncUrl();
 history.replaceState(null,'','#'+page);if(page==='overview')llOverview();
 document.dispatchEvent(new Event('ledger:render'));window.scrollTo({top:0,behavior:'instant'});
}
showPanel=function(name,btn){if(!llInitialized)return llOriginal.showPanel(name,btn);if(name==='year')return llNavigate('year');if(name.startsWith('m')){llMonth=name.slice(1);llIncomeMode=false;return llNavigate('records');}return llOriginal.showPanel(name,btn);};
function llChangeMonth(mm){llMonth=mm;llNavigate(llPage);}
function llChangeYear(value){const page=llPage,delta=Number(value)-currentYear;if(delta)switchYear(delta);llNavigate(page);}
function llShiftMonth(n){const d=new Date(currentYear,Number(llMonth)-1+n,1),page=llPage;llMonth=String(d.getMonth()+1).padStart(2,'0');if(d.getFullYear()!==currentYear)switchYear(d.getFullYear()-currentYear);llNavigate(page);}
function llSetIncome(value){llIncomeMode=value;llEnsureMonth(llMonth).classList.toggle('ll-income-mode',value);}
function llOverview(){
 const ex=monthExp(llMonth),inc=monthInc(llMonth),out=ex.reduce((s,e)=>s+total(e),0),incoming=inc.reduce((s,i)=>s+i.amount,0),due=calcSettle(ex),paid=localStorage.getItem('hh_spaid_'+currentYear+'_'+llMonth)==='1';
 const metrics=[['↗','本月支出',out,ex.length+' 筆被好好記下的日常'],['↙','本月收入',incoming,inc.length+' 筆收入・包含原帳本還款紀錄'],['＋','本月收支差額',incoming-out,'每人本月結餘與累計資產詳見兩人分帳'],['♡',paid?'本月已標記還款':'待分帳金額',paid?0:Math.abs(due),due<0?'涵 → 凱':due>0?'凱 → 涵':'本月帳目已平']];
 document.getElementById('ll-metrics').innerHTML=metrics.map(([symbol,label,n,foot])=>`<article class="metric"><p class="metric-label"><span class="metric-symbol">${symbol}</span>${label}</p><p class="metric-amount">${Number(n).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})}<small>CAD</small></p><p class="metric-foot">${foot}</p></article>`).join('');
 document.getElementById('ll-recent').innerHTML=[...ex].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).slice(0,6).map(e=>`<button class="recent-row" onclick="llEditExpense(${e.id},'${llMonth}')"><span class="category-icon">${e.cat==='外食'?'🍜':e.cat==='蔬菜'?'🥬':e.cat==='咖啡'?'☕':'✳'}</span><span class="recent-description"><strong>${llEsc(e.name)}</strong><small>${e.date.slice(5)} · ${llEsc(e.cat)} · ${e.who==='shared'?'一起的':e.who==='kai'?'凱的':'涵的'}</small></span><span class="recent-amount"><strong>− ${total(e).toFixed(2)}</strong><small>${e.paidBy==='kai'?'凱先付':'涵先付'}</small></span></button>`).join('')||'<p class="ll-empty">這個月還沒有支出紀錄。</p>';
 const categories={};ex.forEach(e=>categories[e.cat]=(categories[e.cat]||0)+total(e));const rows=Object.entries(categories).sort((a,b)=>b[1]-a[1]);
 let offset=0;const colors=['#baa7d4','#d8b8c4','#bfd1bd','#c7c5df','#ddc6b4','#b9ced8'];const stops=rows.map(([k,v],i)=>{const start=offset;offset+=out?v/out*100:0;return `${colors[i%colors.length]} ${start}% ${offset}%`;});
 document.getElementById('ll-categories').innerHTML=`<div class="ll-donut" style="background:${out?'conic-gradient('+stops.join(',')+')':'#eeeaf4'}"><div><span>本月花費</span><strong>${out.toFixed(2)}</strong><small>CAD</small></div></div><div class="ll-category-list">${rows.map(([k,v],i)=>`<div><span style="background:${colors[i%colors.length]}"></span><p>${llEsc(k)}</p><strong>${v.toFixed(2)}</strong><small>${out?(v/out*100).toFixed(0):0}%</small></div>`).join('')}</div>`;
 document.getElementById('ll-settle-text').textContent=paid?'本月已標記涵還款。還款收入與原始分帳明細都完整保留。':Math.abs(due)<.01?'本月帳目已平，不需要互轉。':`${due<0?'涵需要轉給凱':'凱需要轉給涵'} ${fmtCad(Math.abs(due))}。不用心算，分帳在這裡。`;
}
function llEditExpense(id,mm){llEnsureMonth(mm);openEditExpense(id,mm);}
function llOpenAdd(kind){
 llCloseAdd();const p=llEnsureMonth(llMonth),form=p.querySelector(kind==='income'?'.ll-income-form':'.ll-expense-form');
 const marker=document.createComment('original form location');form.before(marker);llMovedForm={form,marker};document.getElementById('ll-add-host').append(form);
 document.getElementById('ll-add-title').textContent=kind==='income'?'新增收入':'新增支出';document.getElementById('ll-add-modal').classList.add('open');
 const date=form.querySelector('input[type=date]'),today=new Date(),key=currentYear+'-'+llMonth;if(!date.value||date.value===key+'-01')date.value=today.getFullYear()===currentYear&&String(today.getMonth()+1).padStart(2,'0')===llMonth?key+'-'+String(today.getDate()).padStart(2,'0'):key+'-01';
 form.querySelector(kind==='income'?'[id^=ifn-]':'[id^=fn-]')?.focus();
}
function llCloseAdd(){if(llMovedForm){llMovedForm.marker.replaceWith(llMovedForm.form);llMovedForm=null;}document.getElementById('ll-add-modal')?.classList.remove('open');}
addExpense=function(mm){const count=expenses.length;llOriginal.addExpense(mm);if(expenses.length!==count)llCloseAdd();};
addIncome=function(mm){const count=incomes.length;llOriginal.addIncome(mm);if(incomes.length!==count)llCloseAdd();};
saveExp=function(){const before=localStorage.getItem('hh_exp_'+currentYear);llOriginal.saveExp();if(before!==localStorage.getItem('hh_exp_'+currentYear))llMarkDirty();};
saveInc=function(){const before=localStorage.getItem('hh_inc_'+currentYear);llOriginal.saveInc();if(before!==localStorage.getItem('hh_inc_'+currentYear))llMarkDirty();};
renderMonth=function(mm){llOriginal.renderMonth(mm);if(llInitialized)llOverview();};
renderYear=function(){llOriginal.renderYear();if(llInitialized)llOverview();};
for(const name of ['saveBulkDate','markSettlePaid','toggleSettled','handleCatChange']){const original=window[name];window[name]=function(...args){const before=llData.signature(llSnapshot());const result=original.apply(this,args);if(before!==llData.signature(llSnapshot()))llMarkDirty();return result;};}
getSyncUrl=function(){return localStorage.getItem('hh_sync_url')||SYNC_URL;};
function llSaveCloudUrl(){const url=document.getElementById('ll-sync-url').value.trim();if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/.test(url)){showToast('請填寫 Google Apps Script Web App 的 HTTPS 網址。');return;}localStorage.setItem('hh_sync_url',url);localStorage.removeItem('ll_cloud_baseline');showToast('同步網址已儲存；可先從雲端載入確認。');}
async function llReadCloud(){const url=getSyncUrl(),r=await fetch(url+(url.includes('?')?'&':'?')+'t='+Date.now(),{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('雲端服務回應 '+r.status);const json=await r.json();if(!json.ok||!json.data)throw Error(json.error||'雲端格式不正確');return llData.validate(json.data);}
function llApply(data,clean=true){
 data=llData.validate(data);llCloseAdd();const hadYear=localStorage.getItem('hh_cur_year');if(llHasRecords(llLocal()))llSafety('載入或匯入前自動備份');
 llData.replace(localStorage,data);if((!hadYear||!clean)&&/^\d{4}$/.test(data.hh_cur_year||'')){currentYear=Number(data.hh_cur_year);localStorage.setItem('hh_cur_year',String(currentYear));document.getElementById('hdr-year').textContent=currentYear;document.title='凱 & 涵 家庭帳本 '+currentYear;}
 CATS=JSON.parse(localStorage.getItem('hh_cats')||'[]');expenses=JSON.parse(localStorage.getItem('hh_exp_'+currentYear)||'[]');incomes=JSON.parse(localStorage.getItem('hh_inc_'+currentYear)||'[]');
 nextExpId=expenses.length?Math.max(...expenses.map(e=>e.id))+1:1;nextIncId=incomes.length?Math.max(...incomes.map(i=>i.id))+1:1;expenseSelections.clear();
 MONTHS.forEach(mm=>{const p=document.getElementById('panel-m'+mm);p.innerHTML='';delete p.dataset.built;});populateCatSel(document.getElementById('eed-cat'),CATS[0]);
 if(clean){localStorage.setItem('ll_cloud_baseline',llData.signature(llLocal()));localStorage.removeItem('ll_unsynced');}
 llOriginal.renderYear();llNavigate(llPage);
}
cloudSync=async function(){
 if(llSyncBusy)return;llSyncBusy=true;const button=document.getElementById('sync-btn');button.disabled=true;button.textContent='☁️ 同步中…';
 try{
  const remote=await llReadCloud(),remoteSig=llData.signature(remote),local=llData.validate(llSnapshot()),localSig=llData.signature(local),baseline=localStorage.getItem('ll_cloud_baseline');
  if(remoteSig!==localSig&&(!baseline||remoteSig!==baseline))throw Error('另一台裝置的雲端帳目已變動。本機資料已保留，請先匯出備份並從雲端載入確認，避免互相覆蓋。');
  llSafety('雲端同步前本機備份',local);
  const response=await fetch(getSyncUrl(),{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'setAll',data:llData.chunks(local)}),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('上傳回應 '+response.status);const result=await response.json();if(!result.ok)throw Error(result.error||'上傳未完成');
  const verified=await llReadCloud();if(llData.signature(verified)!==localSig)throw Error('上傳後的逐欄資料核對不一致，本機備份已保留。');
  localStorage.setItem('ll_cloud_baseline',localSig);
  if(llData.signature(llSnapshot())!==localSig){llMarkDirty();showToast('這次上傳已核對完成；同步期間新增的變更仍保留於此裝置，請再同步一次。');}
  else{localStorage.removeItem('ll_unsynced');llStatus('✓ 雲端同步完成・手機可查看最新帳目');showToast('✓ 雲端同步完成，資料核對一致！');}
 }catch(error){llStatus(error.message,true);showToast('同步尚未完成：'+error.message);}finally{llSyncBusy=false;button.disabled=false;button.innerHTML='<div class="nav-dot"></div>☁️ 雲端同步';}
};
cloudLoad=async function(){if(llSyncBusy)return;if(!confirm('從雲端載入最新帳本？目前本機資料會先自動備份。'))return;llSyncBusy=true;try{llApply(await llReadCloud());llStatus('✓ 已載入雲端最新資料');showToast('✓ 雲端資料已載入，原本本機帳目已備份。');}catch(error){llStatus(error.message,true);showToast('載入失敗，本機資料保持不變：'+error.message);}finally{llSyncBusy=false;}};
exportJSON=function(){const data=llSnapshot();delete data.hh_sync_url;llDownload(JSON.stringify(data,null,2),'家庭帳本_'+new Date().toISOString().slice(0,10)+'.json');showToast('✓ 原格式完整資料已匯出');};
importJSON=function(input){const file=input.files[0];if(!file)return;file.text().then(text=>{const parsed=JSON.parse(text),data=llData.validate(parsed.format==='household-budget-safety'?parsed.data:parsed);if(!confirm('匯入完整帳本？現有本機資料會先自動備份；雲端不會自動覆蓋。'))return;llApply(data,false);llMarkDirty();showToast('✓ 匯入完成，所有原始欄位與精度已保留。');}).catch(error=>showToast('匯入失敗，原帳目未變更：'+error.message));};
function llCSV(mm){const ex=mm?monthExp(mm):expenses,inc=mm?monthInc(mm):incomes,rows=[['月份','日期','項目','分類','屬於','付款人','數量','金額','GST','PST','小計','備註','單價','原始金額算式','編號']];
 [...ex].sort((a,b)=>a.date.localeCompare(b.date)).forEach(e=>rows.push([e.date.slice(5,7),e.date,e.name,e.cat,e.who==='kai'?'凱':e.who==='han'?'涵':'共同',e.paidBy==='kai'?'凱':'涵',e.qty,sub(e).toFixed(2),(e.gst||0).toFixed(2),(e.pst||0).toFixed(2),total(e).toFixed(2),e.note||'',e.price,e.priceExpr,e.id]));
 rows.push([],['收入記錄'],['月份','日期','來源','金額','誰的','編號']);[...inc].sort((a,b)=>a.date.localeCompare(b.date)).forEach(i=>rows.push([i.date.slice(5,7),i.date,i.source,i.amount,i.who==='kai'?'凱':'涵',i.id]));
 const cell=x=>'"'+String(x??'').replace(/"/g,'""')+'"';llDownload('\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n'),`凱涵帳本_${currentYear}_${mm?mm+'月':'全年'}.csv`,'text/csv;charset=utf-8');showToast('✓ CSV 已匯出');}
exportCSV=function(){llCSV(null);};exportMonthCSV=function(mm){llCSV(mm);};
document.addEventListener('keydown',event=>{if(event.key==='Escape')llCloseAdd();});
llInitialized=true;
if(['overview','records','calendar','settlement','year','settings'].includes(location.hash.slice(1)))llPage=location.hash.slice(1);
try{const local=llLocal();if(llHasRecords(local)&&!localStorage.getItem('ll_migration_backup_v1'))localStorage.setItem('ll_migration_backup_v1',JSON.stringify({format:'household-budget-safety',label:'介面更新前原始本機帳目',savedAt:new Date().toISOString(),data:local}));}catch(error){llStatus('自動備份未完成，請先手動匯出資料。',true);}
llNavigate(llPage);
(async()=>{
 try{
  const remote=await llReadCloud(),local=llLocal(),r=llData.signature(remote),l=llData.signature(local),baseline=localStorage.getItem('ll_cloud_baseline');
  if(r===l){localStorage.setItem('ll_cloud_baseline',l);localStorage.removeItem('ll_unsynced');llStatus('✓ 本機與雲端資料一致');}
  else if(!llHasRecords(local)||(!localStorage.getItem('ll_unsynced')&&baseline===l)){llApply(remote);llStatus('✓ 已載入雲端最新帳目');}
  else{llStatus('本機與雲端有差異，已保留本機帳目。請先匯出備份後確認同步。',true);}
 }catch(error){llStatus('目前使用本機帳目・雲端連接未完成：'+error.message,true);}
})();
