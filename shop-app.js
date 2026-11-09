/* BLOSSOM rewards shop: all balances, ownership and attendance verified by server. */
(() => {
 'use strict';
 const API='https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/blossom-rewards';
 const SESSION_KEY='blossom_test_auth_v1';
 const $=id=>document.getElementById(id);
 const kinds=[['all','전체','🛍️'],['theme','테마','🎨'],['nickname','닉네임','✨'],['title','칭호','🏷️'],['timer','미니 타이머','⏱️'],['checklist','체크리스트','☑️']];
 let state=null, view='shop',category='all', busy=false;
 const strip=s=>String(s||'').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g,'');
 const own=()=>new Set((state?.inventory||[]).map(x=>x.product_id));
 const wears=()=>Object.fromEntries((state?.equipped||[]).map(x=>[x.category,x.product_id]));
 const escSession=()=>{try{const x=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');return x?.access_token&&Number(x.expires_at)>Date.now()/1000+10?x:null}catch{return null}};
 const el=(tag,cl,text)=>{const e=document.createElement(tag);if(cl)e.className=cl;if(text!==undefined)e.textContent=String(text);return e};
 function status(message,error=false){const n=$('actionStatus');n.textContent=message;n.classList.toggle('error',error)}
 async function api(payload){
  const ss=escSession();if(!ss)throw Error('로그인 정보가 없어요. 내 계정에서 다시 로그인해 주세요.');
  const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ss.access_token},body:JSON.stringify(payload),cache:'no-store'});
  const data=await response.json().catch(()=>null);if(!response.ok||!data?.success)throw Error(data?.message||'서버 요청에 실패했습니다.');
  return data;
 }
 function kstDayParts(){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const o=Object.fromEntries(parts.map(x=>[x.type,x.value]));return [Number(o.year),Number(o.month),Number(o.day)];
 }
 function dateISO(d){return [d.getUTCFullYear(),String(d.getUTCMonth()+1).padStart(2,'0'),String(d.getUTCDate()).padStart(2,'0')].join('-')}
 function renderWeek(){
  const [y,m,d]=kstDayParts();const today=new Date(Date.UTC(y,m-1,d));const dow=(today.getUTCDay()+6)%7;
  const start=new Date(today.getTime()-dow*86400000);const checks=new Set((state?.attendance||[]).map(x=>x.day_kst));
  $('week').replaceChildren();
  for(let i=0;i<7;i++){
   const day=new Date(start.getTime()+i*86400000);const done=checks.has(dateISO(day));
   const cell=el('div','day'+(done?' checked':'')+(dateISO(day)===dateISO(today)?' today':''));
   cell.append(el('strong',['월','화','수','목','금','토','일'][i]),el('span','',done?'✓':'·'));
   cell.append(el('small','',`${day.getUTCDate()}일`));$('week').append(cell);
  }
 }
 function previewLabel(p){
  if(p.category==='theme')return '✿ BLOSSOM';
  if(p.category==='nickname')return '✦ 닉네임';
  if(p.category==='title')return '['+p.name+']';
  if(p.category==='timer')return '◷ 01:23:45';
  return '☑ 완료';
 }
 function mkButton(label,cls,fn,disabled=false){const b=el('button',cls,label);b.type='button';b.disabled=disabled||busy;if(fn)b.addEventListener('click',fn);return b}
 function renderProducts(){
  const list=$('products');list.replaceChildren();
  if(!state){list.append(el('div','empty','로그인 후 상품을 확인해 주세요.'));return}
  const inventory=own(),equipped=wears(),search=strip($('search').value),balance=Number(state.wallet?.balance||0);
  let chosen=(state.products||[]).filter(p=>
   (category==='all'||p.category===category)&&
   (view==='shop'||inventory.has(p.id))&&
   (!search||strip([p.name,p.description,p.category,p.id].join(' ')).includes(search))
  );
  const sort=$('sortProducts').value;
  if(sort==='cheap')chosen.sort((a,b)=>a.price-b.price||a.sort_order-b.sort_order);
  else if(sort==='expensive')chosen.sort((a,b)=>b.price-a.price||a.sort_order-b.sort_order);
  else if(sort==='name')chosen.sort((a,b)=>a.name.localeCompare(b.name,'ko'));
  else if(sort==='affordable')chosen.sort((a,b)=>Number(b.price<=balance)-Number(a.price<=balance)||a.price-b.price);
  else chosen.sort((a,b)=>a.sort_order-b.sort_order);
  const selectedLabel=kinds.find(k=>k[0]===category)?.[1]||'전체';
  $('listingInfo').textContent=`${view==='shop'?'판매 상품':'내 보유 상품'} · ${selectedLabel} ${chosen.length}개`+(search?' · 검색 결과':'');
  $('clearSearch').classList.toggle('hidden',!$('search').value);
  if(!chosen.length){list.append(el('div','empty',view==='inventory'?'해당 카테고리에 구매한 상품이 없어요. 다른 카테고리를 눌러 보세요!':'검색 결과가 없어요. 검색어 또는 카테고리를 바꿔 보세요.'));return}
  for(const p of chosen){
   const card=el('article','product');card.dataset.id=p.id;card.dataset.type=p.category;
   const preview=el('div','preview');const label=el('span','',previewLabel(p));
   if(p.category==='nickname')label.className='bl-nick-'+p.id.slice(9);preview.append(label);
   card.append(preview);
   const body=el('div','pbody');body.append(el('strong','',p.name),el('p','',p.description));
   const foot=el('div','pfoot');
   if(inventory.has(p.id))foot.append(el('span','pill'+(p.rarity==='epic'?' epic':''),equipped[p.category]===p.id?'✓ 적용 중':'✓ 보유'));
   else foot.append(el('span','price',p.price.toLocaleString()+' BP'));
   let button;
   if(view==='inventory'){
    const isOn=equipped[p.category]===p.id;
    button=mkButton(isOn?'해제':'적용',isOn?'btn buy secondary':'btn buy',()=>mutation({action:'equip',category:p.category,product_id:isOn?null:p.id}));
   }else if(inventory.has(p.id)){
    button=mkButton('보관함 보기','btn buy secondary',()=>{view='inventory';setActiveView();renderProducts()});
   }else{
    button=mkButton(p.price>balance?'BP 부족':'구매','btn buy',()=>{
     if(!window.confirm(`${p.name}을(를) ${p.price} BP로 구매할까요?`))return;
     mutation({action:'buy',product_id:p.id});
    },p.price>balance);
   }
   foot.append(button);body.append(foot);card.append(body);list.append(card);
  }
 }
 function setActiveView(){
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 }
 function render(){
  if(!state)return;
  $('userBadge').textContent=(state.user?.nickname||state.user?.username||'길드원')+' 님';
  $('balance').replaceChildren(document.createTextNode(Number(state.wallet?.balance||0).toLocaleString()+' '),el('small','','BP'));
  $('earned').textContent=Number(state.wallet?.lifetime_earned||0).toLocaleString()+' BP';
  const history=state.attendance||[];
  $('streak').textContent=(history[0]?.streak||0)+'일';
  $('lastDay').textContent=history[0]?.day_kst||'없음';
  $('ownedCount').textContent=String((state.inventory||[]).length);
  const today=state.today_kst;
  const checked=history.some(row=>row.day_kst===today);
  $('checkinBtn').disabled=checked||busy;$('checkinBtn').textContent=checked?'✓ 오늘 출석 완료':'🌸 오늘 출석하고 +10 BP';
  const isOwner=state.can_adjust===true&&state.user?.role==='site_owner';
  $('ownerBox').classList.toggle('hidden',!isOwner);
  $('ownerJump').classList.toggle('hidden',!isOwner);
  $('totalGoods').textContent=(state.products||[]).length+'종 상품';
  updateCategories();
  renderWeek();renderProducts();
  if(window.BlossomSkin)window.BlossomSkin.apply(state.equipped,state.products,state.user?.nickname);
 }
 async function load(showStatus=true){
  const data=await api({action:'bootstrap'});state=data;render();
  if(showStatus)status('상점과 내 보관함을 불러왔어요!');
 }
 async function mutation(body){
  if(busy)return;busy=true;$('checkinBtn').disabled=true;status('Supabase에 저장하고 있어요...');
  try{
   const res=await api(body);await load(false);
   const extra=res.result?.earned?` +${res.result.earned} BP` :'';
   status((res.message||'완료!')+extra);
  }catch(e){status(e.message||'저장 실패',true)}
  finally{busy=false;if(state)render()}
 }
 function updateCategories(){
  const filters=$('filters');filters.replaceChildren();
  for(const [id,label,emoji] of kinds){
   const count=(state?.products||[]).filter(p=>(id==='all'||p.category===id)&&(view==='shop'||own().has(p.id))).length;
   const b=el('button','category-btn'+(id===category?' active':''));b.type='button';
   b.setAttribute('aria-pressed',String(id===category));
   b.append(el('span','cat-emoji',emoji),el('span','cat-label',label),el('span','cat-count',count+'개'));
   b.addEventListener('click',()=>{category=id;updateCategories();renderProducts()});filters.append(b);
  }
 }
 function setup(){
  updateCategories();
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;setActiveView();updateCategories();renderProducts()}));
  $('search').addEventListener('input',renderProducts);
  $('clearSearch').addEventListener('click',()=>{$('search').value='';$('search').focus();renderProducts()});
  $('sortProducts').addEventListener('change',renderProducts);
  $('resetFilters').addEventListener('click',()=>{category='all';view='shop';$('search').value='';$('sortProducts').value='recommended';setActiveView();updateCategories();renderProducts();});
  $('checkinBtn').addEventListener('click',()=>mutation({action:'checkin'}));
  const radios=[...document.querySelectorAll('input[name="adjustMode"]')];
  function updateAdminButton(){const give=radios.find(r=>r.checked)?.value!=='take';const btn=$('adjustSubmit');btn.textContent=give?'＋ BP 지급하기':'− BP 차감하기';btn.classList.toggle('deduct',!give)}
  radios.forEach(r=>r.addEventListener('change',updateAdminButton));updateAdminButton();
  $('adjustForm').addEventListener('submit',e=>{
   e.preventDefault();
   if(!state?.can_adjust||state.user?.role!=='site_owner')return status('최고관리자만 BP를 조정할 수 있습니다.',true);
   const username=$('adjustUsername').value.trim().toLowerCase();
   const amount=Number($('adjustAmount').value);
   const mode=radios.find(r=>r.checked)?.value;
   const delta=mode==='take'?-amount:amount;
   if(!/^[a-z0-9_]{3,40}$/.test(username))return status('회원 아이디를 확인해 주세요.',true);
   if(!Number.isInteger(amount)||amount<1||amount>2000)return status('1~2,000 사이 정수 BP를 입력해 주세요.',true);
   if(!window.confirm(`${username} 회원에게 ${amount.toLocaleString()} BP를 ${delta>0?'지급':'차감'}할까요?`))return;
   mutation({action:'adjust',username,delta});
  });
  if(!escSession()){
   $('userBadge').textContent='로그인 필요';status('로그인이 필요해요. 상단의 [내 계정]에서 로그인한 뒤 돌아와 주세요.',true);
   $('week').append(el('div','empty','로그인 후 출석할 수 있어요.'));renderProducts();return;
  }
  load().catch(e=>{status(e.message||'데이터를 불러오지 못했습니다.',true);$('userBadge').textContent='연결 확인 필요'});
 }
 setup();
})();
