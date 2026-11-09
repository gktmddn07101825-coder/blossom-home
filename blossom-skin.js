/* BLOSSOM site-wide purchased cosmetic effects. No points or ownership trusted client-side. */
(() => {
  'use strict';
  const API = 'https://hweouohzkwqhiwwsjlxu.supabase.co/functions/v1/blossom-rewards';
  const KEY = 'blossom_test_auth_v1';
  const kinds = ['theme','nickname','title','timer','checklist'];
  function session(){try{const x=JSON.parse(sessionStorage.getItem(KEY)||'null');return x?.access_token && x.expires_at > Date.now()/1000+20 ? x : null}catch{return null}}
  function reset(){
    document.documentElement.removeAttribute('data-blossom-theme');
    document.documentElement.removeAttribute('data-blossom-timer');
    document.documentElement.removeAttribute('data-blossom-checklist');
    document.querySelector('#authNav')?.classList.forEach(x=>{if(x.startsWith('bl-nick-'))document.querySelector('#authNav')?.classList.remove(x)});
    document.querySelectorAll('[data-bl-title="yes"]').forEach(n=>n.remove());
  }
  function apply(equipped, products, nickname){
    reset();
    const ids = Object.fromEntries((equipped||[]).map(x=>[x.category,x.product_id]));
    const owns = new Map((products||[]).map(p=>[p.id,p]));
    if(ids.theme && owns.has(ids.theme))document.documentElement.dataset.blossomTheme=ids.theme;
    if(ids.timer && owns.has(ids.timer))document.documentElement.dataset.blossomTimer=ids.timer;
    if(ids.checklist && owns.has(ids.checklist))document.documentElement.dataset.blossomChecklist=ids.checklist;
    const nav=document.getElementById('authNav');
    if(nav && ids.nickname && owns.has(ids.nickname))nav.classList.add('bl-nick-'+ids.nickname.slice('nickname-'.length));
    if(nav && ids.title && owns.has(ids.title)) {
      const name=owns.get(ids.title).name;
      const tag=document.createElement('span');tag.dataset.blTitle='yes';tag.className='bl-title-tag';tag.textContent='['+name+']';
      nav.insertAdjacentElement('afterend',tag);
    }
    document.dispatchEvent(new CustomEvent('blossom:skin-ready',{detail:{equipped:ids,nickname:nickname||''}}));
  }
  async function refresh(){
    const ss=session();if(!ss){reset();return}
    try{
      const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ss.access_token},body:JSON.stringify({action:'bootstrap'}),cache:'no-store'});
      const data=await r.json();if(!r.ok||!data.success)throw Error('검증 실패');
      apply(data.equipped,data.products,data.user?.nickname);
      return data;
    }catch{reset();return null}
  }
  window.BlossomSkin={apply,refresh};
  if(!document.body?.dataset?.blossomShop)refresh();
})();
