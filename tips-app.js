/* BLOSSOM 꿀팁 저장소 - 서버에서 회원/운영진 권한 확인 */
(()=>{
 'use strict';
 const API='https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/blossom-community',K='blossom_test_auth_v1';
 const CATS={all:'전체',newbie:'🌱 뉴비 가이드',farming:'🗺 사냥터',spec:'⚡ 스펙업',raid:'⚔ 레이드',economy:'💰 재화·파밍',other:'✨ 기타'};
 const $=id=>document.getElementById(id),node=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=String(txt);return x;};
 let state={posts:[],viewer_id:'',can_manage:false},cat='all',view='all',editing=null,current=null,busy=false;
 const token=()=>{try{return JSON.parse(sessionStorage.getItem(K)||'null')?.access_token||''}catch{return ''}};
 async function api(body){const tok=token();if(!tok)throw Error('로그인 상태를 확인해 주세요.');const opts={method:body?'POST':'GET',headers:{Authorization:'Bearer '+tok},cache:'no-store'};if(body){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body)}const r=await fetch(API,opts),d=await r.json().catch(()=>null);if(!r.ok||!d?.success)throw Error(d?.message||'서버 요청 실패');return d;}
 function status(msg,bad=false,id='tipStatus'){const x=$(id);x.textContent=msg;x.classList.toggle('error',bad)}
 const date=x=>{try{return new Date(x).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'})}catch{return ''}};
 async function imageData(file){
  if(!file)return null;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('PNG, JPG, WEBP 이미지만 가능해요.');
  const image=await createImageBitmap(file);const scale=Math.min(1,1440/Math.max(image.width,image.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close?.();
  let quality=.87,blob;
  do{blob=await new Promise(ok=>canvas.toBlob(ok,'image/jpeg',quality));quality-=.12}while(blob&&blob.size>1800000&&quality>.35);
  if(!blob||blob.size>2000000)throw Error('이미지를 더 작게 줄여서 올려 주세요.');
  const data=await new Promise((ok,fail)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=fail;r.readAsDataURL(blob)});
  return {mime:'image/jpeg',image_base64:data.split(',')[1]};
 }
 function categoryButtons(){const holder=$('tipCategories');holder.replaceChildren();for(const [id,label] of Object.entries(CATS)){const btn=node('button','chip'+(cat===id?' active':''),label);btn.type='button';btn.setAttribute('aria-pressed',String(cat===id));btn.addEventListener('click',()=>{cat=id;categoryButtons();render()});holder.append(btn)}}
 function render(){
  const q=$('tipSearch').value.trim().toLocaleLowerCase('ko');let posts=state.posts.filter(p=>(cat==='all'||p.category===cat)&&
   (view==='all'||view==='mine'&&p.author_id===state.viewer_id||view==='featured'&&p.featured||view==='bookmarked'&&p.my_bookmarked)&&
   (!q||[p.title,p.content,p.author_name].join(' ').toLocaleLowerCase('ko').includes(q)));
  posts.sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||($('tipOrder').value==='likes'?b.like_count-a.like_count:Date.parse(b.created_at)-Date.parse(a.created_at)));
  $('tipCount').textContent=state.posts.filter(p=>!p.hidden).length+'개';$('featuredCount').textContent=state.posts.filter(p=>p.featured&&!p.hidden).length+'개';$('bookmarkCount').textContent=state.posts.filter(p=>p.my_bookmarked).length+'개';
  const root=$('tipsList');root.replaceChildren();if(!posts.length){root.append(node('div','empty','해당 조건의 꿀팁이 아직 없어요. 첫 번째 팁을 등록해 보세요!'));return}
  posts.forEach(p=>{
   const card=node('article','post');const top=node('div','post-top'),info=node('div');info.style.minWidth='0';
   const tags=node('div','tags');if(p.pinned)tags.append(node('span','tag pin','📌 고정'));if(p.featured)tags.append(node('span','tag feature','⭐ 운영진 추천'));if(p.hidden)tags.append(node('span','tag bad','숨김'));tags.append(node('span','tag',CATS[p.category]||'기타'));
   info.append(tags,node('div','post-title',p.title),node('div','post-meta',`${p.author_name} · ${date(p.created_at)}`));top.append(info);
   if(p.image_url){const img=node('img','post-thumb');img.src=p.image_url;img.alt='스크린샷';img.loading='lazy';top.append(img)}
   const desc=node('div','post-desc',p.content),row=node('div','post-actions');
   const btn=node('button','outline',`♡ ${p.like_count} · 댓글 보기 ↗`);btn.type='button';btn.onclick=()=>openPost(p);row.append(btn);
   const save=node('button','outline',p.my_bookmarked?'★ 즐겨찾기 완료':'☆ 즐겨찾기');save.type='button';save.onclick=()=>change({action:'bookmark',id:p.id});row.append(save);
   card.append(top,desc,row);root.append(card);
  });
 }
 function formOpen(post=null){editing=post;$('tipForm').reset();$('tipEditorTitle').textContent=post?'✎ 꿀팁 수정':'✎ 꿀팁 작성';$('saveTip').textContent=post?'수정 저장':'등록하기';$('removeImageRow').hidden=!post?.image_path;
  if(post){$('editCategory').value=post.category;$('editTitle').value=post.title;$('editContent').value=post.content}status('','', 'editorStatus');$('tipEditor').showModal()}
 async function load(){try{const d=await api();state=d;categoryButtons();render();status('공략 '+d.posts.length+'건을 불러왔어요.')}catch(e){status(e.message,true)}}
 async function change(body){if(busy)return;busy=true;status('서버에 저장 중...');try{const d=await api(body);await load();status(d.message)}catch(e){status(e.message,true)}finally{busy=false}}
 const btn=(label,action,cls='outline')=>{const b=node('button',cls,label);b.type='button';b.addEventListener('click',action);return b};
 async function openPost(p){current=p;$('detailTags').replaceChildren();if(p.pinned)$('detailTags').append(node('span','tag pin','📌 상단 고정'));if(p.featured)$('detailTags').append(node('span','tag feature','⭐ 추천'));$('detailTags').append(node('span','tag',CATS[p.category]||'기타'));
  $('detailTitle').textContent=p.title;$('detailMeta').textContent=p.author_name+' · 작성 '+date(p.created_at)+(p.updated_at&&p.updated_at!==p.created_at?' · 수정 '+date(p.updated_at):'');$('detailText').textContent=p.content;
  $('detailPhoto').hidden=!p.image_url;if(p.image_url)$('detailPhoto').src=p.image_url;
  const act=$('detailActions');act.replaceChildren();act.append(btn(p.my_liked?'♥ 좋아요 취소':'♡ 좋아요 '+p.like_count,()=>{change({action:'like',id:p.id}).then(()=>{$('tipDetail').close()})}));act.append(btn(p.my_bookmarked?'★ 즐겨찾기 해제':'☆ 즐겨찾기',()=>{change({action:'bookmark',id:p.id}).then(()=>{$('tipDetail').close()})}));
  if(p.author_id===state.viewer_id||state.can_manage){act.append(btn('✎ 수정',()=>{$('tipDetail').close();formOpen(p)}),btn('삭제',async()=>{if(!confirm('이 꿀팁을 정말 삭제할까요?'))return;$('tipDetail').close();await change({action:'delete',id:p.id})},'danger-button'))}
  if(state.can_manage){for(const [key,caption] of [['pinned','상단 고정'],['featured','운영진 추천'],['hidden','숨기기']]){act.append(btn(p[key]?caption+' 해제':caption,async()=>{$('tipDetail').close();await change({action:'moderate',id:p.id,field:key,value:!p[key]})}))}}
  $('tipDetail').showModal();await comments(p.id);
 }
 async function comments(id){const root=$('commentList');root.replaceChildren(node('div','muted','댓글을 불러오는 중...'));try{const d=await api({action:'comments',tip_id:id});root.replaceChildren();if(!d.comments.length)root.append(node('div','muted','첫 번째 댓글을 남겨보세요.'));for(const c of d.comments){const el=node('div','comment');const meta=node('div');meta.append(node('strong','',c.author_name),node('span','comment-time',' · '+date(c.created_at)));el.append(meta,node('div','',c.content));if(c.author_id===state.viewer_id||state.can_manage)el.append(btn('댓글 삭제',async()=>{if(!confirm('댓글을 삭제할까요?'))return;try{await api({action:'comment_delete',id,comment_id:c.id});await comments(id)}catch(e){status(e.message,true,'detailStatus')}},'ghost'));root.append(el)}}catch(e){root.replaceChildren(node('div','muted',e.message))}}
 $('newTip').onclick=()=>formOpen();$('cancelTip').onclick=()=>$('tipEditor').close();$('closeDetail').onclick=()=>$('tipDetail').close();$('reloadTips').onclick=load;
 $('tipSearch').oninput=render;$('tipOrder').onchange=render;
 document.querySelectorAll('#tipViews [data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;document.querySelectorAll('#tipViews [data-view]').forEach(x=>x.classList.toggle('active',x===b));render()}));
 $('tipForm').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;$('saveTip').disabled=true;status('저장하는 중...','', 'editorStatus');try{
  let image_path=editing?.image_path||null;
  const file=$('editImage').files[0];if(file){status('이미지 최적화 및 업로드 중...','', 'editorStatus');const payload=await imageData(file);const uploaded=await api({action:'upload',...payload});image_path=uploaded.image_path}
  if($('removeImage').checked&&!file)image_path=null;
  const body={action:editing?'update':'create',category:$('editCategory').value,title:$('editTitle').value.trim(),content:$('editContent').value.trim(),image_path};if(editing)body.id=editing.id;
  const d=await api(body);$('tipEditor').close();await load();status(d.message);
 }catch(err){status(err.message,true,'editorStatus')}finally{busy=false;$('saveTip').disabled=false}};
 $('commentForm').onsubmit=async e=>{e.preventDefault();if(!current)return;const text=$('commentText').value.trim();if(!text)return;try{await api({action:'comment',id:current.id,content:text});$('commentText').value='';await comments(current.id)}catch(e){status(e.message,true,'detailStatus')}};
 window.addEventListener('blossom:authorized',load);if(document.documentElement.dataset.blossomAccess==='approved')load();
})();
