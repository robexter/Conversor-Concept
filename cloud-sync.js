(() => {
  const cfg = window.U39_CLOUD_CONFIG || {};
  const status = { ready:false, isAdmin:false, client:null, session:null };
  const rawSet = (k,v) => Storage.prototype.setItem.call(localStorage,k,v);
  const rawRemove = (k) => Storage.prototype.removeItem.call(localStorage,k);

  function injectStyle(){
    const s=document.createElement('style');
    s.textContent=`
      .cloud-status{display:inline-flex;align-items:center;gap:6px;padding:8px 10px;border-radius:12px;border:1px solid #39566f;background:#0a1c29;color:#cfe9f8;font-size:11px;font-weight:800}
      .cloud-status.ok{border-color:#4e793a;color:#d8ffc8}.cloud-status.err{border-color:#8a552b;color:#ffd8b2}
      .cloud-admin-btn{display:none}.cloud-admin-btn.show{display:inline-flex}
      .cloud-modal{position:fixed;inset:0;z-index:9999;background:#000b;display:none;place-items:center;padding:16px}
      .cloud-modal.open{display:grid}.cloud-box{width:min(430px,100%);background:#0d1d2a;border:1px solid #41617a;border-radius:22px;padding:20px;box-shadow:0 20px 70px #000a}
      .cloud-box h3{margin:0 0 6px}.cloud-box p{color:#9db3c5;font-size:12px;line-height:1.45}
      .cloud-box label{display:block;margin-top:11px;color:#d8eeff;font-size:11px;font-weight:800}.cloud-box input{width:100%;margin-top:5px;padding:11px 12px;border-radius:11px;border:1px solid #39566f;background:#071522;color:#fff}
      .cloud-box .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.cloud-msg{min-height:18px;margin-top:10px;color:#ffd8b2;font-size:11px}
    `;
    document.head.appendChild(s);
  }
  function injectUI(){
    injectStyle();
    const actions=document.querySelector('.actions');
    if(actions){
      const st=document.createElement('span'); st.id='cloudStatus'; st.className='cloud-status'; st.textContent='☁️ Conectando...'; actions.appendChild(st);
      const auth=document.createElement('button'); auth.id='cloudAdminBtn'; auth.className='btn cloud-admin-btn show'; auth.textContent='🔐 Administrador'; actions.appendChild(auth);
      const pub=document.createElement('button'); pub.id='cloudPublishBtn'; pub.className='btn cloud-admin-btn'; pub.textContent='☁️ Publicar edição deste aparelho'; actions.appendChild(pub);
      auth.addEventListener('click',()=> status.isAdmin ? logout() : openLogin());
      pub.addEventListener('click',publishLocal);
    }
    const modal=document.createElement('div'); modal.id='cloudModal'; modal.className='cloud-modal';
    modal.innerHTML=`<div class="cloud-box">
      <h3>Administrador</h3>
      <p>Somente o administrador pode ativar o modo edição. As alterações salvas são publicadas no Supabase e passam a aparecer para todos os usuários.</p>
      <label>E-mail</label><input id="cloudEmail" type="email" autocomplete="username" placeholder="seu@email.com">
      <label>Senha</label><input id="cloudPassword" type="password" autocomplete="current-password" placeholder="Senha do Supabase Auth">
      <div class="row"><button class="btn primary" id="cloudLoginBtn">Entrar</button><button class="btn" id="cloudSignupBtn">Criar conta</button><button class="btn" id="cloudCancelBtn">Cancelar</button></div>
      <div class="cloud-msg" id="cloudMsg"></div>
    </div>`;
    document.body.appendChild(modal);
    document.getElementById('cloudCancelBtn').onclick=closeLogin;
    document.getElementById('cloudLoginBtn').onclick=login;
    document.getElementById('cloudSignupBtn').onclick=signup;
    modal.addEventListener('click',e=>{ if(e.target===modal) closeLogin(); });
  }
  function setStatus(text,cls=''){
    const el=document.getElementById('cloudStatus'); if(!el) return;
    el.className='cloud-status'+(cls?' '+cls:''); el.textContent=text;
  }
  function setAuthButton(){
    const b=document.getElementById('cloudAdminBtn'); if(!b) return;
    b.textContent=status.isAdmin?'🔓 Sair do administrador':'🔐 Administrador';
    const edit=document.getElementById('editBtn');
    if(edit && (typeof editMode==='undefined' || !editMode)) edit.textContent=status.isAdmin?'Modo edição':'🔒 Entrar para editar';
    const pub=document.getElementById('cloudPublishBtn'); if(pub) pub.classList.toggle('show',status.isAdmin);
  }
  function openLogin(){ document.getElementById('cloudModal')?.classList.add('open'); }
  function closeLogin(){ document.getElementById('cloudModal')?.classList.remove('open'); const m=document.getElementById('cloudMsg'); if(m)m.textContent=''; }
  function msg(t){ const m=document.getElementById('cloudMsg'); if(m)m.textContent=t; }

  async function checkAdmin(){
    const {data:{session}}=await status.client.auth.getSession();
    status.session=session;
    if(!session){ status.isAdmin=false; return false; }
    const {data,error}=await status.client.rpc('is_app_admin_rpc',{target_app:cfg.appSlug});
    if(error){ console.warn(error); status.isAdmin=false; return false; }
    status.isAdmin=!!data; return status.isAdmin;
  }
  async function login(){
    const email=document.getElementById('cloudEmail').value.trim();
    const password=document.getElementById('cloudPassword').value;
    if(!email||!password){ msg('Informe e-mail e senha.'); return; }
    msg('Entrando...');
    const {error}=await status.client.auth.signInWithPassword({email,password});
    if(error){ msg('Não foi possível entrar: '+error.message); return; }
    if(!(await checkAdmin())){ await status.client.auth.signOut(); msg('Este usuário não está autorizado como administrador deste app.'); return; }
    closeLogin(); setAuthButton(); setStatus('☁️ Nuvem ativa • ADMIN','ok');
    window.dispatchEvent(new CustomEvent('u39-cloud-auth',{detail:{isAdmin:true}}));
  }
  async function signup(){
    const email=document.getElementById('cloudEmail').value.trim();
    const password=document.getElementById('cloudPassword').value;
    if(!email||!password){ msg('Informe e-mail e senha.'); return; }
    msg('Criando conta...');
    const {data,error}=await status.client.auth.signUp({email,password});
    if(error){ msg('Não foi possível criar a conta: '+error.message); return; }
    if(data.session){
      if(await checkAdmin()){ closeLogin(); setAuthButton(); setStatus('☁️ Nuvem ativa • ADMIN','ok'); }
      else msg('Conta criada, mas o e-mail ainda não está autorizado como administrador no SQL.');
    }else msg('Conta criada. Verifique o e-mail de confirmação e depois entre novamente.');
  }
  async function logout(){
    if(typeof editMode!=='undefined' && editMode && status.isAdmin){ document.getElementById('editBtn')?.click(); }
    await status.client.auth.signOut(); status.session=null; status.isAdmin=false;
    setAuthButton(); setStatus('☁️ Nuvem ativa • somente leitura','ok');
    window.dispatchEvent(new CustomEvent('u39-cloud-auth',{detail:{isAdmin:false}}));
  }

  function isManagedKey(key){ return (cfg.localPrefixes||[]).some(p=>key===p || key.startsWith(p)); }
  async function hydrate(){
    const {data,error}=await status.client.from('u39_app_state').select('state_key,payload,updated_at').eq('app_slug',cfg.appSlug).like('state_key','ls:%');
    if(error){ throw error; }
    const remoteKeys=new Set();
    (data||[]).forEach(row=>{
      const key=row.state_key.slice(3); remoteKeys.add(key);
      if(row.payload?.deleted) rawRemove(key); else if(row.payload && typeof row.payload.value==='string') rawSet(key,row.payload.value);
    });
    refreshUI();
  }
  function refreshUI(){
    try{ if(typeof loadHotspots==='function') loadHotspots(); }catch(_){ }
    try{ if(typeof loadMediaNotes==='function') loadMediaNotes(); }catch(_){ }
    try{ if(typeof currentId!=='undefined' && currentId && typeof render==='function') render(currentId); }catch(_){ }
  }
  async function setLocal(key,value){
    rawSet(key,value);
    if(!status.isAdmin) return;
    const {error}=await status.client.from('u39_app_state').upsert({app_slug:cfg.appSlug,state_key:'ls:'+key,payload:{value},updated_by:status.session?.user?.id},{onConflict:'app_slug,state_key'});
    if(error){ console.warn(error); setStatus('☁️ Erro ao salvar na nuvem','err'); throw error; }
    setStatus('☁️ Alteração publicada','ok');
  }
  async function removeLocal(key){
    rawRemove(key);
    if(!status.isAdmin) return;
    const {error}=await status.client.from('u39_app_state').upsert({app_slug:cfg.appSlug,state_key:'ls:'+key,payload:{deleted:true},updated_by:status.session?.user?.id},{onConflict:'app_slug,state_key'});
    if(error){ console.warn(error); throw error; }
    setStatus('☁️ Alteração publicada','ok');
  }
  async function uploadMedia(key,file){
    if(!status.isAdmin) throw new Error('Apenas o administrador pode enviar mídia.');
    const clean=String(key).replace(/[^a-zA-Z0-9_-]/g,'_');
    const path=`${cfg.appSlug}/${clean}`;
    const {error:upErr}=await status.client.storage.from(cfg.bucket||'u39-app-media').upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});
    if(upErr) throw upErr;
    const payload={path,name:file.name,type:file.type,size:file.size,version:Date.now()};
    const {error}=await status.client.from('u39_app_state').upsert({app_slug:cfg.appSlug,state_key:'media:'+key,payload,updated_by:status.session?.user?.id},{onConflict:'app_slug,state_key'});
    if(error) throw error;
    setStatus('☁️ Mídia publicada','ok');
    return getMediaUrl(key,true);
  }
  async function getMediaUrl(key,force=false){
    const {data,error}=await status.client.from('u39_app_state').select('payload,updated_at').eq('app_slug',cfg.appSlug).eq('state_key','media:'+key).maybeSingle();
    if(error){ console.warn(error); return null; }
    if(data?.payload?.deleted) return false;
    if(!data?.payload?.path) return null;
    const {data:urlData}=status.client.storage.from(cfg.bucket||'u39-app-media').getPublicUrl(data.payload.path);
    const url=urlData?.publicUrl; if(!url) return null;
    return url+'?v='+encodeURIComponent(data.payload.version||data.updated_at||'1');
  }
  async function deleteMedia(key){
    if(!status.isAdmin) throw new Error('Apenas o administrador pode remover mídia.');
    const {data}=await status.client.from('u39_app_state').select('payload').eq('app_slug',cfg.appSlug).eq('state_key','media:'+key).maybeSingle();
    if(data?.payload?.path) await status.client.storage.from(cfg.bucket||'u39-app-media').remove([data.payload.path]);
    await status.client.from('u39_app_state').upsert({app_slug:cfg.appSlug,state_key:'media:'+key,payload:{deleted:true,version:Date.now()},updated_by:status.session?.user?.id},{onConflict:'app_slug,state_key'});
    setStatus('☁️ Mídia removida','ok');
  }
  async function publishLocal(){
    if(!status.isAdmin){ openLogin(); return; }
    const rows=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key && isManagedKey(key)) rows.push({app_slug:cfg.appSlug,state_key:'ls:'+key,payload:{value:localStorage.getItem(key)},updated_by:status.session?.user?.id});
    }
    if(!rows.length){ setStatus('☁️ Nenhuma edição local para publicar','ok'); return; }
    setStatus('☁️ Publicando dados locais...');
    const {error}=await status.client.from('u39_app_state').upsert(rows,{onConflict:'app_slug,state_key'});
    if(error){ console.warn(error); setStatus('☁️ Falha ao publicar dados locais','err'); return; }
    setStatus('☁️ Edição deste aparelho publicada','ok');
    window.dispatchEvent(new CustomEvent('u39-cloud-published'));
  }
  function subscribe(){
    status.client.channel('u39-state-'+cfg.appSlug)
      .on('postgres_changes',{event:'*',schema:'public',table:'u39_app_state',filter:`app_slug=eq.${cfg.appSlug}`},payload=>{
        const row=payload.new || payload.old; const sk=row?.state_key||'';
        if(sk.startsWith('ls:')){
          const key=sk.slice(3);
          if(payload.eventType==='DELETE') rawRemove(key);
          else if(payload.new?.payload?.deleted) rawRemove(key); else if(payload.new?.payload && typeof payload.new.payload.value==='string') rawSet(key,payload.new.payload.value);
          refreshUI();
        }else if(sk.startsWith('media:')){
          window.dispatchEvent(new CustomEvent('u39-cloud-media-changed',{detail:{key:sk.slice(6)}}));
        }
      }).subscribe();
  }
  async function init(){
    injectUI();
    if(!cfg.supabaseUrl || !cfg.publishableKey || !window.supabase?.createClient){
      setStatus('☁️ Configuração pendente','err'); setAuthButton(); return;
    }
    status.client=window.supabase.createClient(cfg.supabaseUrl,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    try{
      await checkAdmin(); setAuthButton();
      await hydrate(); subscribe(); status.ready=true;
      setStatus(status.isAdmin?'☁️ Nuvem ativa • ADMIN':'☁️ Nuvem ativa • somente leitura','ok');
      window.dispatchEvent(new CustomEvent('u39-cloud-ready',{detail:{isAdmin:status.isAdmin}}));
    }catch(err){
      console.warn('Cloud sync indisponível:',err); setStatus('☁️ Execute o SQL do Supabase','err');
    }
    status.client.auth.onAuthStateChange(async()=>{ await checkAdmin(); setAuthButton(); });
  }
  window.U39Cloud={
    get ready(){return status.ready}, get isAdmin(){return status.isAdmin},
    openLogin,closeLogin,login,logout,publishLocal,setLocal,removeLocal,uploadMedia,getMediaUrl,deleteMedia,
    refresh:hydrate
  };
  init();
})();
