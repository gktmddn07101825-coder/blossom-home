/* BLOSSOM v14: optional remembered login. This is a public browser script; never put service keys here. */
(() => {
 'use strict';
 const KEY='blossom_test_auth_v1', REMEMBER='blossom_remember_v14';
 const API='https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/blossom-session';
 let busy=null;
 const read=(store,key)=>{try{return JSON.parse(store.getItem(key)||'null')}catch{return null}};
 const valid=s=>s&&typeof s.access_token==='string'&&s.status==='approved'&&Number(s.expires_at)>Date.now()/1000+30;
 const saved=()=>read(localStorage,REMEMBER);
 function store(s,remember=false){
  if(!s?.access_token)return;
  try{sessionStorage.setItem(KEY,JSON.stringify(s));if(remember&&s.refresh_token)localStorage.setItem(REMEMBER,JSON.stringify(s));}catch(_){}
 }
 function logout(){try{sessionStorage.removeItem(KEY);localStorage.removeItem(REMEMBER)}catch(_){}window.dispatchEvent(new Event('blossom:logout'))}
 async function refresh(){
  if(busy)return busy;
  busy=(async()=>{
   const p=saved();if(!p?.refresh_token)return false;
   try{
    const res=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refresh',refresh_token:p.refresh_token}),cache:'no-store'});
    const data=await res.json().catch(()=>null);
    if(res.status===401||res.status===403){logout();return false}
    if(!res.ok||!data?.success||!data.session?.refresh_token)return false;
    const next={...p,...data.user,...data.session,status:'approved'};
    store(next,true);window.dispatchEvent(new Event('blossom:session-updated'));
    return true;
   }catch{return false}
   finally{busy=null}
  })();return busy;
 }
 function bootstrap(){
  const remembered=saved(),current=read(sessionStorage,KEY);
  if(!remembered)return;
  if(valid(remembered)&&(!valid(current)||Number(current.expires_at)<Number(remembered.expires_at)))store(remembered,true);
  if(!valid(current)&&!valid(remembered))refresh().then(ok=>{if(ok)location.reload()});
 }
 async function get(){
  let s=read(sessionStorage,KEY)||saved();
  if(valid(s))return s;
  if(saved()?.refresh_token){const ok=await refresh();if(ok){s=read(sessionStorage,KEY);if(valid(s))return s;}}
  return null;
 }
 window.BlossomSession=Object.freeze({save:(s,remember)=>{if(!remember){try{localStorage.removeItem(REMEMBER)}catch(_){}}store(s,!!remember)},logout,refresh,get,hasRemembered:()=>!!saved()?.refresh_token});
 bootstrap();
 const maintain=()=>{
  const p=saved();if(p?.refresh_token&&Number(p.expires_at)<Date.now()/1000+300)refresh();
 };
 setInterval(maintain,60000);
 window.addEventListener('focus',maintain);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)maintain()});
 window.addEventListener('storage',e=>{
  if(e.key===REMEMBER){if(e.newValue===null){try{sessionStorage.removeItem(KEY)}catch(_){}}
  else{const s=saved();if(valid(s))store(s,true)}}
 });
})();
