const PROFILE_PARENT = {
  profile:'menu', profileRegister:'profile', profileConfirm:'profileRegister',
  profileForgot:'profile', profileCode:'profileForgot', profilePassword:'profileCode', profileEdit:'profile'
};
let profileMessage = '';

function resolveProfileRoute(route){
  const challenge = profileAuth.challenge();
  if(route !== 'profileConfirm' && route !== 'profileCode' && route !== 'profilePassword') profileAuth.cancel();
  if(!Object.hasOwn(PROFILE_PARENT, route)) return route;
  if(profileAuth.current()) return route === 'profileEdit' ? route : 'profile';
  if(route === 'profileEdit') return 'profile';
  if(route === 'profileConfirm' && challenge?.purpose !== 'register') return 'profileRegister';
  if((route === 'profileCode' || route === 'profilePassword') && challenge?.purpose !== 'recover') return 'profileForgot';
  if(route === 'profilePassword' && !challenge.verified) return 'profileCode';
  return route;
}

function profileNav(active){
  const tab = (route, label, path) => `<button type="button" data-act="go" data-mode="${route}"${active===route?' aria-current="page"':''}>${svgIcon(path)}<span>${label}</span></button>`;
  return `<nav class="profile-nav" aria-label="Основные разделы">${tab('menu','Главная','<path d="m3 10 9-7 9 7v10h-6v-7H9v7H3z"/>')}${tab('profile','Профиль','<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>')}</nav>`;
}
function profileAvatar(account){
  const initials = account.name.trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join('').toUpperCase();
  return `<span class="profile-avatar" aria-hidden="true">${account.avatar ? `<img alt="" src="${esc(account.avatar)}">` : esc(initials)}</span>`;
}
function deviceStats(){
  let answers = 0, correct = 0;
  for(const [id, cfg] of Object.entries(SESSION)){
    const sessions = cfg.sem ? Object.values(semRead(id)) : cfg.block ? Object.values(readAll(KEYS[id])) : [store.get(KEYS[id])];
    for(const session of sessions){
      if(!Array.isArray(session?.state)) continue;
      for(const answer of session.state){
        if(answer?.checked){ answers++; if(answer.correct) correct++; }
      }
    }
  }
  return [[answers,'Проверено ответов'],[correct,'Верных ответов'],[favRead().length,'В избранном'],[mistakeCount(),'На повторение']];
}
const profileLink = (route, label) => `<button type="button" class="btn btn-secondary btn-block" data-act="go" data-mode="${route}">${label}</button>`;
function profileField(label, name, props, value=''){
  return `<label class="profile-field">${label}<input class="input" name="${name}" ${props} value="${esc(value)}"></label>`;
}
function viewProfile(){
  const account = profileAuth.current(), challenge = profileAuth.challenge();
  const form = (title, intro, fields, submit, extra='') => `<header class="page-head"><h1>${title}</h1>${intro ? `<p>${intro}</p>` : ''}</header>
    <form class="profile-form" data-profile-form="${mode}" method="post">
      ${fields}<p role="alert" class="profile-error" hidden></p>
      <button class="btn btn-primary btn-block" type="submit">${submit}</button>${extra}</form>`;
  const email = profileField('Почта','email','type="email" autocomplete="email" autocapitalize="none" maxlength="254" required');
  const password = (fresh) => profileField(fresh?'Новый пароль (от 8 символов)':'Пароль','password',
    `type="password" autocomplete="${fresh?'new-password':'current-password'}" maxlength="256" ${fresh?'minlength="8"':''} required`);
  const nick = (value='') => profileField('Ник (необязательно)','nick','autocomplete="nickname" maxlength="40"',value);
  const name = (value='') => profileField('Имя','name','autocomplete="name" maxlength="60" required',value);
  const notice = profileMessage;
  profileMessage = '';
  setTop(mode==='profile' ? {} : {back:'Назад'});
  switch(mode){
    case 'profileRegister': return form('Создать профиль','Профиль сохранится в этом браузере. Для пробного входа придумайте отдельный пароль.',
      name()+nick()+email+password(true),'Получить тестовый код');
    case 'profileForgot': return form('Восстановить пароль','Введите почту локального профиля. Тестовый код появится на следующем экране.',email,'Получить тестовый код');
    case 'profileConfirm':
    case 'profileCode': return form('Введите код',esc(challenge.email),
      `<div class="profile-demo">В демонстрационном режиме письмо не отправляется. Код действует 10 минут.<strong>${challenge.code}</strong></div>`+
      profileField('Шестизначный код','code','inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required'),
      mode==='profileConfirm'?'Подтвердить и войти':'Подтвердить код',
      '<button type="button" data-profile-action="resend" class="profile-link">Получить новый код</button>');
    case 'profilePassword': return form('Новый пароль','После сохранения войдите с новым паролем.',password(true),'Сохранить пароль');
    case 'profileEdit': return form('Редактировать профиль','',
      `<div class="profile-photo">${profileAvatar(account)}<label class="profile-field">Фото профиля<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label></div>
      <label class="profile-restore"><input type="checkbox" name="initials"> Использовать инициалы</label>`+
      name(account.name)+nick(account.nick),'Сохранить');
  }
  if(!account) return form('Профиль',notice || 'Вход по почте на этом устройстве. Учиться можно и без профиля.',
    email+password(false),'Войти',profileLink('profileRegister','Создать профиль')+
    '<button type="button" data-act="go" data-mode="profileForgot" class="profile-link">Забыли пароль?</button>');
  return `<header class="page-head"><h1>Профиль</h1></header>
    <section class="profile-panel"><div class="profile-identity">${profileAvatar(account)}<div><h2>${esc(account.name)}</h2>
    ${account.nick?`<p>@${esc(account.nick)}</p>`:''}<p>${esc(account.email)}</p></div></div>
    ${profileLink('profileEdit','Редактировать профиль')}</section>
    <section class="profile-panel"><h2>Учёба на устройстве</h2><p>По текущему сохранённому прогрессу в этом браузере.</p>
    <dl class="profile-stats">${deviceStats().map(([n,label])=>`<div><dt>${label}</dt><dd>${n}</dd></div>`).join('')}</dl></section>
    <button class="profile-link" type="button" data-profile-action="logout">Выйти из профиля</button>`;
}
async function profilePhoto(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>8*1024*1024)
    throw new Error('Выберите JPG, PNG или WebP размером до 8 МБ.');
  const url = URL.createObjectURL(file);
  try{
    const img = new Image(); img.src = url;
    try{ await img.decode(); }catch{ throw new Error('Не удалось прочитать изображение.'); }
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 192;
    const ctx = canvas.getContext('2d'), side = Math.min(img.naturalWidth,img.naturalHeight);
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,192,192);
    ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,192,192);
    return canvas.toDataURL('image/jpeg',0.85);
  }finally{ URL.revokeObjectURL(url); }
}
document.addEventListener('submit', async event => {
  const form = event.target;
  if(!form.matches('[data-profile-form]')) return;
  event.preventDefault();
  const button = form.querySelector('[type="submit"]'), error = form.querySelector('[role="alert"]');
  if(button.disabled) return;
  const data = new FormData(form);
  const value = key => String(data.get(key) || '').trim();
  const password = data.get('password');
  button.disabled = true; error.hidden = true;
  let next = 'profile';
  try{
    switch(form.dataset.profileForm){
      case 'profile': await profileAuth.login(value('email'),password); break;
      case 'profileRegister':
        if(!value('name')) throw new Error('Введите имя.');
        await profileAuth.register(value('name'),value('nick').replace(/^@+/,''),value('email'),password); next='profileConfirm'; break;
      case 'profileConfirm': await profileAuth.verify(value('code')); break;
      case 'profileForgot': profileAuth.recover(value('email')); next='profileCode'; break;
      case 'profileCode': await profileAuth.verify(value('code')); next='profilePassword'; break;
      case 'profilePassword': await profileAuth.reset(password); profileMessage='Пароль обновлён. Войдите с новым паролем.'; break;
      case 'profileEdit': {
        const account = profileAuth.current();
        if(!account) throw new Error('Войдите в профиль ещё раз.');
        if(!value('name')) throw new Error('Введите имя.');
        const values = {name:value('name'),nick:value('nick').replace(/^@+/,'')};
        const file = data.get('photo');
        if(data.has('initials')) values.avatar='';
        else if(file?.size) values.avatar=await profilePhoto(file);
        await profileAuth.update(account,values); break;
      }
    }
    if(form.isConnected) go(next);
  }catch(e){
    error.textContent=e.message; error.hidden=false;
  }finally{ button.disabled=false; }
});
document.addEventListener('click', event=>{
  const action = event.target.closest('[data-profile-action]')?.dataset.profileAction;
  if(action==='resend'){ profileAuth.resend(); render(); announce('Выдан новый тестовый код'); }
  if(action==='logout'){ profileAuth.logout(); go('profile'); }
});
addEventListener('storage', event=>{
  if(Object.hasOwn(PROFILE_PARENT,mode) && (!event.key || event.key===profileAuth.sessionKey || event.key.startsWith(profileAuth.prefix))) render();
});
