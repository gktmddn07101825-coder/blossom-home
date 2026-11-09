/* BLOSSOM v14.1 - 도움받은 길드원이 고수분을 추천하는 감사 인증소 */
(()=>{
 'use strict';
 const API='https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/blossom-help',KEY='blossom_test_auth_v1';
 const $=id=>document.getElementById(id);
 const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=String(txt);return n};
 let state={claims:[],helpers:[],viewer_id:'',can_review:false,can_award:false},scope='approved',busy=false;
 let photos=[];
 const getToken=()=>{try{return JSON.parse(sessionStorage.getItem(KEY)||'null')?.access_token||''}catch{return ''}};
 async function api(body){const token=getToken();if(!token)throw Error('로그인 후 이용해 주세요.');const opt={method:body?'POST':'GET',headers:{Authorization:'Bearer '+token},cache:'no-store'};
  if(body){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(body)}
  const r=await fetch(API,opt),d=await r.json().catch(()=>null);if(!r.ok||!d?.success)throw Error(d?.message||'요청 실패');return d;}
 const label=d=>{const parts=String(d||'').split('-');return parts.length===3?parts.join('.'):''};
 function status(s,error=false,id='helpStatus'){const n=$(id);n.textContent=s;n.classList.toggle('error',!!error)}
 const btn=(s,fn,cls='outline')=>{const b=el('button',cls,s);b.type='button';b.onclick=fn;return b};
 function kstToday(){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${map.year}-${map.month}-${map.day}`}
 async function shrinkPhoto(file){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('스크린샷은 PNG·JPG·WEBP 파일이어야 해요.');
  const image=await createImageBitmap(file),sc=Math.min(1,1600/Math.max(image.width,image.height));
  const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(image.width*sc));cv.height=Math.max(1,Math.round(image.height*sc));
  cv.getContext('2d').drawImage(image,0,0,cv.width,cv.height);image.close?.();
  let q=.87,blob;do{blob=await new Promise(ok=>cv.toBlob(ok,'image/jpeg',q));q-=.1}while(blob&&blob.size>1700000&&q>.35);
  if(!blob||blob.size>2000000)throw Error('이미지를 더 줄여서 올려 주세요.');
  const data=await new Promise((ok,reject)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=reject;r.readAsDataURL(blob)});
  return {mime:'image/jpeg',image_base64:data.split(',')[1]};
 }
 function discardPhotos(){for(const x of photos)URL.revokeObjectURL(x.url);photos=[];renderPicker()}
 function renderPicker(){const g=$('helpPhotoGrid');g.replaceChildren();$('helpPhotoCount').textContent=photos.length+' / 6장 · 선택 순서대로 표시됩니다';
  photos.forEach((p,i)=>{const cell=el('div','photo-item');const img=el('img');img.src=p.url;img.alt='스크린샷 '+(i+1);const x=btn('×',()=>{URL.revokeObjectURL(photos[i].url);photos.splice(i,1);renderPicker()},'photo-remove');x.title='이 사진 삭제';cell.append(img,x,el('span','photo-index',(i+1)+'번'));g.append(cell)})}
 function chooseHelpers(){const select=$('helperSelect'),selected=select.value,q=$('helperSearch').value.trim().toLocaleLowerCase('ko');select.replaceChildren();
  const first=el('option','', '— 도와주신 길드원을 선택하세요 —');first.value='';select.append(first);
  for(const m of state.helpers||[]){if(q&&!`${m.name} ${m.username}`.toLocaleLowerCase('ko').includes(q))continue;
   const opt=el('option','',`${m.name} (${m.username})`);opt.value=m.id;select.append(opt)}
  if([...select.options].some(o=>o.value===selected))select.value=selected;
 }
 function displayGallery(parent,urls){const good=(urls||[]).filter(Boolean);if(!good.length)return;
  const gallery=el('div','photo-gallery help-gallery');for(let i=0;i<good.length;i++){
   const a=el('a');a.href=good[i];a.target='_blank';a.rel='noopener noreferrer';a.title='원본 스크린샷 열기';const img=el('img');img.src=good[i];img.alt='감사 인증 스크린샷 '+(i+1);img.loading='lazy';a.append(img);gallery.append(a)}
  parent.append(gallery);
 }
 function render(){
  $('staffFilter').hidden=!state.can_review;
  const claims=state.claims||[];
  $('approvedHelpCount').textContent=claims.filter(x=>x.state==='approved').length+'건';
  $('pendingHelpCount').textContent=claims.filter(x=>[x.submitter_id,x.helper_id].includes(state.viewer_id)&&['pending','reviewed'].includes(x.state)).length+'건';
  const filtered=claims.filter(x=>scope==='approved'?x.state==='approved':scope==='mine'?[x.submitter_id,x.helper_id].includes(state.viewer_id):['pending','reviewed'].includes(x.state));
  const root=$('helpList');root.replaceChildren();if(!filtered.length){root.append(el('div','empty',scope==='pending'?'심사할 인증이 없습니다.':'등록된 감사 인증이 없습니다. 새로운 도움을 기록해 보세요!'));return}
  for(const c of filtered){
   const article=el('article','post');const top=el('div','post-top'),body=el('div');body.style.flex='1';
   const tags=el('div','tags');const kind=c.state==='approved'?['tag good','✅ 승인 완료']:c.state==='rejected'?['tag bad','반려']:c.state==='reviewed'?['tag warn','운영진 검토 완료']:['tag','심사 대기'];
   tags.append(el('span',kind[0],kind[1]));if(c.awarded_bp)tags.append(el('span','tag good','도움 주신 분 +'+c.awarded_bp+' BP'));
   const heading=c.submitter_id?`${c.submitter_name}님이 ${c.helper_name}님께 감사 💜`:`${c.helper_name}님의 기존 도움 인증`;
   const meta=c.submitter_id?'도움을 받은 날짜 '+label(c.activity_day):`도움받은 분: ${c.helped_nickname} · ${label(c.activity_day)}`;
   body.append(tags,el('div','post-title',heading),el('div','post-meta',meta));
   top.append(body);article.append(top,el('div','post-desc',c.summary));
   displayGallery(article,c.image_urls?.length?c.image_urls:(c.image_url?[c.image_url]:[]));
   if(c.review_note&&(state.can_review||c.submitter_id===state.viewer_id||c.helper_id===state.viewer_id))article.append(el('div','muted','운영진 메모: '+c.review_note));
   const actions=el('div','post-actions');if(state.can_review&&['pending','reviewed'].includes(c.state)){
    if(c.state==='pending')actions.append(btn('✓ 검토 완료',()=>act(c,'review')));
    if(state.can_award)actions.append(btn('🎁 고수분께 50 BP 최종 지급',()=>act(c,'approve'),'button'));
    actions.append(btn('반려',()=>act(c,'reject'),'danger-button'));
   }
   article.append(actions);root.append(article);
  }
 }
 async function load(){try{state=await api();chooseHelpers();render();status('도움 인증 목록을 불러왔어요.')}catch(e){status(e.message,true)}}
 async function act(c,action){if(busy)return;let note='';if(action==='reject'){note=prompt('반려 이유를 간단히 입력해 주세요.','증빙 확인이 어렵습니다.');if(note===null)return}
  else if(action==='approve'){if(!confirm(`${c.helper_name}님께 도움 보상 50 BP를 지급할까요?`))return}
  busy=true;status('서버에서 처리 중...');try{const d=await api({action,id:c.id,note});await load();status(d.message)}catch(e){status(e.message,true)}finally{busy=false}}
 $('openHelpForm').onclick=()=>{$('helpForm').reset();$('helpDay').value=kstToday();discardPhotos();chooseHelpers();status('',false,'helpFormStatus');$('helpFormDialog').showModal()};
 $('cancelHelp').onclick=()=>{$('helpFormDialog').close();discardPhotos()};$('reloadHelp').onclick=load;
 $('helperSearch').oninput=chooseHelpers;
 $('helpImage').addEventListener('change',()=>{
  const files=[...$('helpImage').files];$('helpImage').value='';
  if(photos.length+files.length>6){status('스크린샷은 최대 6장까지 등록할 수 있어요.',true,'helpFormStatus');return}
  if(files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type))){status('PNG/JPG/WEBP 이미지만 가능해요.',true,'helpFormStatus');return}
  files.forEach(file=>photos.push({file,url:URL.createObjectURL(file),uploadedPath:null}));renderPicker();status('',false,'helpFormStatus');
 });
 document.querySelectorAll('#helpFilters [data-scope]').forEach(b=>b.addEventListener('click',()=>{scope=b.dataset.scope;document.querySelectorAll('#helpFilters [data-scope]').forEach(x=>x.classList.toggle('active',x===b));render()}));
 $('helpForm').onsubmit=async e=>{e.preventDefault();if(busy)return;
  if(!photos.length){status('감사 인증 스크린샷을 1장 이상 선택해 주세요.',true,'helpFormStatus');return}
  if(!$('helperSelect').value){status('도움을 주신 길드원을 선택해 주세요.',true,'helpFormStatus');return}
  busy=true;$('sendHelp').disabled=true;
  try{
   for(let i=0;i<photos.length;i++){
    if(photos[i].uploadedPath)continue;
    status(`스크린샷 업로드 중... ${i+1}/${photos.length}`,false,'helpFormStatus');
    const image=await shrinkPhoto(photos[i].file);const d=await api({action:'upload',...image});photos[i].uploadedPath=d.image_path;
   }
   status('감사 인증을 접수하는 중...',false,'helpFormStatus');
   const body={action:'submit',helper_id:$('helperSelect').value,summary:$('helpSummary').value.trim(),activity_day:$('helpDay').value,image_paths:photos.map(x=>x.uploadedPath)};
   const d=await api(body);$('helpFormDialog').close();discardPhotos();scope='mine';document.querySelectorAll('#helpFilters [data-scope]').forEach(b=>b.classList.toggle('active',b.dataset.scope==='mine'));await load();status(d.message);
  }catch(err){status(err.message,true,'helpFormStatus')}finally{busy=false;$('sendHelp').disabled=false}
 };
 window.addEventListener('blossom:authorized',load);if(document.documentElement.dataset.blossomAccess==='approved')load();
})();
