// Auth выдаёт и обновляет сессии. PostgREST применяет политики profiles к каждому запросу.
function createCloudProfileAuth(config){
  const url = config.url.replace(/\/$/, '');
  const sessionKey = 'pharma_cloud_v1:' + url;
  const pendingKey = sessionKey + ':challenge';
  let account = null, clientPromise = null, status = 'idle', loadError = '', generation = 0;
  let signingOut = false;
  function challenge(){
    try{ return JSON.parse(sessionStorage.getItem(pendingKey)); }catch{ return null; }
  }
  function remember(value){
    if(value) sessionStorage.setItem(pendingKey, JSON.stringify(value));
    else sessionStorage.removeItem(pendingKey);
  }
  function fail(error){
    const messages = {
      invalid_credentials:'Проверьте почту и пароль.',
      otp_expired:'Код неверен или истёк. Запросите новый код.',
      email_not_confirmed:'Сначала подтвердите почту. Можно повторить регистрацию, чтобы получить код.',
      weak_password:'Выберите более надёжный пароль.',
      same_password:'Новый пароль должен отличаться от прежнего.',
      over_email_send_rate_limit:'Слишком много писем. Попробуйте позже.',
      over_request_rate_limit:'Слишком много запросов. Попробуйте позже.'
    };
    throw new Error(messages[error.code || error.error_code] ||
      (error.status===429 ? 'Подождите минуту перед повторной отправкой.' : 'Не удалось выполнить запрос. Проверьте соединение и попробуйте ещё раз.'));
  }
  function data(result){ if(result.error) fail(result.error); return result.data; }
  async function client(){
    if(!clientPromise) clientPromise = (async()=>{
      const endpoint = new URL(url);
      let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey);
      if(!publicKey){
        try{ publicKey = JSON.parse(atob(config.publishableKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon'; }catch{}
      }
      const loopback = ['localhost','127.0.0.1'].includes(endpoint.hostname);
      if(endpoint.origin!==url || !(endpoint.protocol==='https:' || (loopback && endpoint.protocol==='http:')) || !publicKey)
        throw new Error('Проверьте адрес проекта и публичный ключ в настройках сервера.');
      const {GoTrueClient} = await import('./vendor/auth.js');
      const auth = new GoTrueClient({
        url:url+'/auth/v1', headers:{apikey:config.publishableKey}, storageKey:sessionKey,
        persistSession:true, autoRefreshToken:true, detectSessionInUrl:false, flowType:'implicit'
      });
      auth.onAuthStateChange(event=>{
        if(event==='SIGNED_OUT' && account && !signingOut){
          generation++; account=null;
          queueMicrotask(()=>window.dispatchEvent(new Event('profile-session-change')));
        }
      });
      return auth;
    })().catch(error=>{clientPromise=null; throw error;});
    return clientPromise;
  }
  async function request(path, method, token, body){
    const headers = {apikey:config.publishableKey,'Content-Type':'application/json'};
    if(token) headers.Authorization='Bearer '+token;
    if(method==='PATCH') headers.Prefer='return=representation';
    let response;
    try{
      response = await fetch(url+path,{method, headers, body:JSON.stringify(body),cache:'no-store',referrerPolicy:'no-referrer'});
    }catch{ throw new Error('Нет связи с сервером. Проверьте интернет и повторите попытку.'); }
    if(!response.ok){
      const details=await response.json().catch(()=>({}));
      fail({...details,status:response.status});
    }
    return path.startsWith('/auth/v1/logout') || response.status===204 ? null : response.json();
  }
  async function readProfile(session, values){
    const id = session.user.id;
    const rows = await request('/rest/v1/profiles?select=id,name,nick,avatar&id=eq.'+encodeURIComponent(id),
      values ? 'PATCH':'GET', session.access_token,values);
    if(rows.length!==1) throw new Error('Профиль не найден. Проверьте настройку базы данных.');
    return {...rows[0],email:session.user.email};
  }
  async function setAccount(session, current=++generation){
    try{
      const next = session ? await readProfile(session) : null;
      if(current===generation){ account=next; status='ready'; }
    }catch(error){
      if(current!==generation) return;
      account=null; status='error'; loadError=error.message;
      window.dispatchEvent(new Event('profile-session-change'));
    }
  }
  async function load(){
    if(status==='loading') return;
    const current=++generation;
    status='loading'; loadError='';
    try{
      const auth=await client();
      await setAccount(data(await auth.getSession()).session,current);
    }catch(error){
      if(current===generation){ status='error'; loadError=error.message; }
    }
    if(current===generation) window.dispatchEvent(new Event('profile-session-change'));
  }
  async function recover(email){
    const auth=await client();
    data(await auth.resetPasswordForEmail(email));
    remember({purpose:'recover',email});
  }
  return {
    remote:true, sessionKey, challenge, load,
    get status(){ return status; }, get loadError(){ return loadError; },
    current:()=>account, cancel(){ if(challenge()) remember(null); },
    invalidate(){ generation++; account=null; status='idle'; },
    async login(email,password){
      const auth=await client();
      await setAccount(data(await auth.signInWithPassword({email,password})).session);
    },
    async register(name,nick,email,password){
      const auth=await client();
      const result=data(await auth.signUp({email,password,options:{data:{name,nick}}}));
      if(result.session){
        await auth.signOut({scope:'local'});
        throw new Error('Администратору нужно включить подтверждение почты.');
      }
      remember({purpose:'register',email});
    },
    recover,
    async resend(){
      const pending=challenge();
      if(!pending) throw new Error('Начните заново.');
      if(pending.purpose==='recover') return recover(pending.email);
      const auth=await client();
      data(await auth.resend({type:'signup',email:pending.email}));
    },
    async verify(code){
      const pending=challenge();
      if(!pending) throw new Error('Начните заново.');
      const auth=await client();
      if(pending.purpose==='recover'){
        // Изолируем сессию восстановления от обычного входа.
        const recovery=await request('/auth/v1/verify','POST',null,{type:'recovery',email:pending.email,token:code});
        remember({...pending,verified:true,access:recovery.access_token});
      }else{
        const result=data(await auth.verifyOtp({email:pending.email,token:code,type:'signup'}));
        remember(null);
        await setAccount(result.session);
      }
    },
    async reset(password){
      const pending=challenge();
      if(!pending?.verified || !pending.access) throw new Error('Подтвердите код восстановления.');
      await request('/auth/v1/user','PUT',pending.access,{password});
      remember(null);
      // Пароль уже изменён, даже если сеть оборвалась при завершении сессии.
      await request('/auth/v1/logout?scope=local','POST',pending.access).catch(()=>{});
    },
    async update(owner,values){
      const auth=await client(), session=data(await auth.getSession()).session;
      if(!session || session.user.id!==owner.id) throw new Error('Войдите в профиль ещё раз.');
      const current=++generation;
      const next=await readProfile(session,values);
      if(current===generation) account=next;
    },
    async logout(){
      const auth=await client();
      signingOut=true;
      try{
        data(await auth.signOut({scope:'local'}));
        generation++; account=null; remember(null);
      }finally{ signingOut=false; }
    }
  };
}
