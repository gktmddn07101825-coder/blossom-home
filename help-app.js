/* BLOSSOM 도움 인증소: 보상은 서버 DB 트랜잭션 + 최고관리자 확인 */
(()=>{
 'use strict';
 const API='https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/blossom-help',KEY='blossom_test_auth_v1';
 const $=id=>document.getElementById(id),el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=String(txt);return n};
 let state={claims:[],viewer_id:'',can_review:false,can_award:false},scope='approved',busy=false;
 const getToken=()=>{try{return JSON.parse(sessionStorage.getItem(KEY)||'null')?.access_token||''}catch{return ''}};
 async function api(body){const token=getToken();if(!token)throw Error('로그인 후 이용해 주세요.');const opt={method:body?'POST':'GET',headers:{Authorization:'Bearer '+token},cache:'no-store'};if(body){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(body)}const r=await fetch(API,opt),d=await r.json().catch(()=>null);if(!r.ok||!d?.success)throw Error(d?.message||'요청 실패');return d;}
 const label=d=>{const parts=String(d||'').split('-');return parts.length===3?parts.join('.'):''};
 function status(s,error=false,id='helpStatus'){const n=$(id);n.textContent=s;n.classList.toggle('error',!!error)}
 const btn=(s,fn,cls='outline')=>{const b=el('button',cls,s);b.type='button';b.onclick=fn;return b};
 function kstToday(){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${map.year}-${map.month}-${map.day}`}
 async function shrinkPhoto(file){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('스크린샷은 PNG·JPG·WEBP 파일이어야 해요.');
  const image=await createImageBitmap(file),sc=Math.min(1,1600/Math.max(image.width,image.height));
  const cv=document.createElement('canvas');cv.width=Math.round(image.width*sc);cv.height=Math.round(image.height*sc);
  cv.getContext('2d').drawImage(image,0,0,cv.width,cv.height);image.close?.();
  let q=.87,blob;do{blob=await new Promise(ok=>cv.toBlob(ok,'image/jpeg',q));q-=.1}while(blob&&blob.size>1700000&&q>.35);
  if(!blob||blob.size>2000000)throw Error('이미지를 더 줄여서 올려 주세요.');
  const data=await new Promise((ok,reject)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=reject;r.readAsDataURL(blob)});
  return {mime:'image/jpeg',image_base64:data.split(',')[1]};
 }
 function render(){
  $('staffFilter').hidden=!state.can_review;
  const claims=state.claims||[];
  $('approvedHelpCount').textContent=claims.filter(x=>x.state==='approved').length+'건';
  $('pendingHelpCount').textContent=claims.filter(x=>x.helper_id===state.viewer_id&&['pending','reviewed'].includes(x.state)).length+'건';
  const filtered=claims.filter(x=>scope==='approved'?x.state==='approved':scope==='mine'?x.helper_id===state.viewer_id:['pending','reviewed'].includes(x.state));
  const root=$('helpList');root.replaceChildren();if(!filtered.length){root.append(el('div','empty',scope==='pending'?'심사할 인증이 없습니다.':'등록된 인증이 없습니다. 새로운 도움을 기록해 보세요!'));return}
  for(const c of filtered){
   const article=el('article','post');const top=el('div','post-top'),body=el('div');body.style.flex='1';
   const tags=el('div','tags');const kind=c.state==='approved'?['tag good','✅ 승인 완료']:c.state==='rejected'?['tag bad','반려']:c.state==='reviewed'?['tag warn','운영진 검토 완료']:['tag','심사 대기'];tags.append(el('span',kind[0],kind[1]));if(c.awarded_bp)tags.append(el('span','tag good','+'+c.awarded_bp+' BP'));
   body.append(tags,el('div','post-title',`${c.helper_name} → ${c.helped_nickname} 님`),el('div','post-meta','활동 '+label(c.activity_day)));
   top.append(body);if(c.image_url){const a=el('a');a.href=c.image_url;a.target='_blank';a.rel='noopener';const img=el('img','post-thumb');img.src=c.image_url;img.alt='도움 활동 인증 사진';img.loading='lazy';a.append(img);top.append(a)}
   article.append(top,el('div','post-desc',c.summary));if(c.review_note&&(state.can_review||c.helper_id===state.viewer_id))article.append(el('div','muted','운영진 메모: '+c.review_note));
   const actions=el('div','post-actions');if(state.can_review&&['pending','reviewed'].includes(c.state)){
    if(c.state==='pending')actions.append(btn('✓ 검토 완료',()=>act(c,'review')));
    if(state.can_award)actions.append(btn('🎁 최종 승인 · 50 BP',()=>act(c,'approve'),'button'));
    actions.append(btn('반려',()=>act(c,'reject'),'danger-button'));
   }
   article.append(actions);root.append(article);
  }
 }
 async function load(){try{state=await api();render();status('도움 인증 목록을 불러왔어요.')}catch(e){status(e.message,true)}}
 async function act(c,action){if(busy)return;let note='';if(action==='reject'){note=prompt('반려 이유를 간단히 입력해 주세요.','증빙 확인이 어렵습니다.');if(note===null)return}else if(action==='approve'){if(!confirm(`${c.helper_name}님의 도움 인증을 승인하고 50 BP를 지급할까요?`))return}
  busy=true;status('서버에서 처리 중...');try{const d=await api({action,id:c.id,note});await load();status(d.message)}catch(e){status(e.message,true)}finally{busy=false}}
 $('openHelpForm').onclick=()=>{$('helpForm').reset();$('helpDay').value=kstToday();$('helpFormDialog').showModal()};$('cancelHelp').onclick=()=>$('helpFormDialog').close();$('reloadHelp').onclick=load;
 document.querySelectorAll('#helpFilters [data-scope]').forEach(b=>b.addEventListener('click',()=>{scope=b.dataset.scope;document.querySelectorAll('#helpFilters [data-scope]').forEach(x=>x.classList.toggle('active',x===b));render()}));
 $('helpForm').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;$('sendHelp').disabled=true;
  status('스크린샷을 최적화하고 있어요...',false,'helpFormStatus');try{
   const image=await shrinkPhoto($('helpImage').files[0]);status('서버에 인증을 등록하는 중...',false,'helpFormStatus');
   const body={action:'submit',helped_nickname:$('helpedNickname').value.trim(),summary:$('helpSummary').value.trim(),activity_day:$('helpDay').value,...image};
   const d=await api(body);$('helpFormDialog').close();scope='mine';document.querySelectorAll('#helpFilters [data-scope]').forEach(b=>b.classList.toggle('active',b.dataset.scope==='mine'));await load();status(d.message);
  }catch(err){status(err.message,true,'helpFormStatus')}finally{busy=false;$('sendHelp').disabled=false}}
 window.addEventListener('blossom:authorized',load);if(document.documentElement.dataset.blossomAccess==='approved')load();
})();
