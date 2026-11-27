// Локальная реализация входа. Демокод доступен на устройстве и не подтверждает владение почтой.
const localProfileAuth = (() => {
  const prefix = 'pharma_profile_account_v1:';
  const sessionKey = 'pharma_profile_login_v1';
  const iterations = 600000;
  const pendingKey = 'pharma_profile_challenge_v1';
  let pending = null;
  try{
    const saved = JSON.parse(sessionStorage.getItem(pendingKey));
    if(saved?.until > Date.now()) pending = saved;
  }catch{}
  function setPending(request){
    pending = request;
    try{
      if(request) sessionStorage.setItem(pendingKey, JSON.stringify(request));
      else sessionStorage.removeItem(pendingKey);
    }catch{} // В приватном режиме код всё равно работает до перезагрузки страницы.
  }

  const normalize = email => email.trim().toLowerCase();
  const find = email => store.get(prefix + email);
  function save(key, value){
    if(!store.set(key, value)) throw new Error('Не удалось сохранить данные. Проверьте доступ к памяти устройства.');
  }
  const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  async function passwordKey(password, salt){
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bytes = Uint8Array.from(salt.match(/../g), s => parseInt(s, 16));
    return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt:bytes, iterations}, key, 256)));
  }
  async function credentials(password){
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    return {salt, hash:await passwordKey(password, salt)};
  }
  function startCode(purpose, email, data){
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
    setPending({purpose, email, data, code, until:Date.now()+600000, verified:false});
  }
  function current(){
    const session = store.get(sessionKey);
    const account = session && find(session.email);
    return account && account.salt === session.version ? account : null;
  }
  function signIn(account){ save(sessionKey, {email:account.email, version:account.salt}); }
  function lock(email, fn){
    return navigator.locks ? navigator.locks.request(prefix + email, fn) : fn();
  }
  return {
    current, sessionKey, prefix,
    challenge(){ return pending && {purpose:pending.purpose,email:pending.email,code:pending.code,verified:pending.verified}; },
    cancel(){ if(pending) setPending(null); },
    async register(name, nick, email, password){
      email = normalize(email);
      if(find(email)) throw new Error('Профиль с этой почтой уже есть на устройстве.');
      const account = {name, email, nick, avatar:'', ...await credentials(password)};
      startCode('register', email, account);
    },
    async login(email, password){
      email = normalize(email);
      const account = find(email);
      if(!account || await passwordKey(password, account.salt) !== account.hash || find(email)?.hash !== account.hash)
        throw new Error('Проверьте почту и пароль локального профиля.');
      signIn(account);
    },
    recover(email){
      email = normalize(email);
      const account = find(email);
      if(!account) throw new Error('На этом устройстве нет профиля с такой почтой.');
      startCode('recover', email, account.salt);
    },
    resend(){
      if(pending) startCode(pending.purpose, pending.email, pending.data);
    },
    async verify(code){
      const request = pending;
      if(!request || Date.now() >= request.until) throw new Error('Срок кода истёк. Получите новый код.');
      if(code !== request.code) throw new Error('Код не совпал. Проверьте шесть цифр.');
      if(request.purpose === 'register'){
        await lock(request.email, () => {
          if(request !== pending) throw new Error('Запрос изменился.');
          if(find(request.email)) throw new Error('Профиль уже создан. Войдите с паролем.');
          save(prefix + request.email, request.data);
          setPending(null);
          signIn(request.data);
        });
      }else setPending({...request, verified:true});
    },
    async reset(password){
      const request = pending;
      if(!request?.verified || request.purpose !== 'recover') throw new Error('Подтвердите код восстановления.');
      const updated = await credentials(password);
      await lock(request.email, () => {
        const account = find(request.email);
        if(request !== pending || Date.now() >= request.until || account?.salt !== request.data)
          throw new Error('Начните восстановление заново.');
        save(prefix + account.email, {...account,...updated});
        setPending(null);
      });
    },
    async update(owner, values){
      await lock(owner.email, () => {
        const account = current();
        if(account?.email !== owner.email || account.salt !== owner.salt) throw new Error('Войдите в профиль ещё раз.');
        save(prefix + account.email, {...account,...values});
      });
    },
    logout(){ save(sessionKey, null); setPending(null); }
  };
})();

const profileAuth = profileServer.url || profileServer.publishableKey ? createCloudProfileAuth(profileServer) : localProfileAuth;
