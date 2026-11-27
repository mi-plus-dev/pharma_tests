// Одна запись на проверенный вопрос. Повторная синхронизация сохраняет тот же ключ.
const STUDY_METRICS = {
  recipes:{label:'Верно написано рецептов',tab:'Рецепты',hint:'Полностью верные ответы в режиме «Впиши сам».'},
  streak:{label:'Лучшая серия без ошибок',tab:'Серия',hint:'Дни подряд с проверенными ответами и без единой ошибки.'},
  mistakes:{label:'Ошибочные ответы',tab:'Ошибки',hint:'Выше участники с меньшим числом ошибок. При равенстве учитывается число проверенных ответов.'}
};
const studyPrefix='pharma_answers_v1:';
function studyRunId(){
  if(crypto.randomUUID) return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  bytes[6]=(bytes[6]&15)|64; bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
function studyOwner(){
  const account=profileAuth.current();
  if(!profileAuth.remote) return account?.email || '';
  // В офлайне профиль мог ещё не загрузиться. Сервер повторно проверит владельца при отправке.
  return store.get(profileAuth.sessionKey)?.user?.id || '';
}
function studyNamespace(owner){
  return studyPrefix + (profileAuth.remote ? profileServer.url : 'local') + '/' + encodeURIComponent(owner) + '/';
}
function studyKeys(prefix){
  try{ return Object.keys(localStorage).filter(key=>key.startsWith(prefix)); }catch{ return []; }
}
function studyRecords(owner){
  const prefix=studyNamespace(owner);
  return studyKeys(prefix).map(key=>{
    const value=store.get(key);
    if(!Array.isArray(value)) return null;
    const [run_id,position]=key.slice(prefix.length).split('/');
    return {key,run_id,question:Number(position),study_day:value[0],written:!!(value[1]&1),correct:!!(value[1]&2),sent:!!(value[1]&4)};
  }).filter(Boolean);
}
function recordStudyAnswer(session,written,correct){
  const owner=studyOwner(), date=new Date();
  const day=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  const key=studyNamespace(owner)+session.runId+'/'+session.pos;
  if(store.has(key)) return;
  if(!store.set(key,[day,Number(written)+2*Number(correct)])){
    announce('Не удалось сохранить статистику на устройстве.');
    return;
  }
  if(profileAuth.remote && owner) syncStudy(owner).catch(()=>{});
}
function summarizeStudy(records){
  const days=new Map();
  let recipes=0,mistakes=0,streak=0,consecutive=0,previous=null;
  for(const answer of records){
    if(answer.correct && answer.written) recipes++;
    if(!answer.correct) mistakes++;
    days.set(answer.study_day,answer.correct && days.get(answer.study_day)!==false);
  }
  for(const day of [...days.keys()].sort()){
    const ordinal=Date.parse(day+'T00:00:00Z')/86400000;
    consecutive=days.get(day) ? (ordinal===previous+1 ? consecutive+1 : 1) : 0;
    streak=Math.max(streak,consecutive); previous=ordinal;
  }
  return {recipes,mistakes,streak,attempts:records.length};
}
const studySyncs=new Map();
function syncStudy(owner){
  if(!owner || !profileAuth.remote) return Promise.resolve();
  if(studySyncs.has(owner)) return studySyncs.get(owner);
  const task=(async()=>{
    while(owner===studyOwner()){
      const batch=studyRecords(owner).filter(a=>!a.sent).slice(0,100);
      if(!batch.length) break;
      const answers=batch.map(({run_id,question,study_day,written,correct})=>({run_id,question,study_day,written,correct}));
      await profileAuth.studyRpc('submit_study_answers',{account:owner,answers},owner);
      for(const a of batch){
        if(!store.set(a.key,[a.study_day,4+Number(a.written)+2*Number(a.correct)])) throw new Error('Недостаточно памяти.');
      }
    }
  })().finally(()=>studySyncs.delete(owner));
  studySyncs.set(owner,task); return task;
}
function metricNumber(key,n){
  return Number(n).toLocaleString('ru-RU')+(key==='streak' ? ' '+plural(n,'день','дня','дней') : '');
}
function statsGrid(stats){
  return Object.entries(STUDY_METRICS).map(([key,m])=>`<div><dt>${m.label}</dt><dd>${metricNumber(key,stats[key] || 0)}</dd></div>`).join('');
}
function studyPanel(){
  const owner=studyOwner(), remote=profileAuth.remote && owner;
  const cacheKey='pharma_totals:'+studyNamespace(owner);
  const local=summarizeStudy(studyRecords(owner));
  if(remote) queueMicrotask(async()=>{
    const panel=document.getElementById('studyPanel');
    if(!panel) return;
    try{
      await syncStudy(owner);
      const [stats]=await profileAuth.studyRpc('my_study_stats',{},owner);
      const totals=stats || {recipes:0,streak:0,mistakes:0};
      store.set(cacheKey,totals);
      if(panel.isConnected && owner===studyOwner()){
        panel.querySelector('dl').innerHTML=statsGrid(totals);
        panel.querySelector('small').textContent='По всем устройствам';
      }
    }catch{
      if(panel.isConnected){
        panel.querySelector('dl').innerHTML=statsGrid(local);
        panel.querySelector('small').textContent='На этом устройстве · нет связи с рейтингом';
      }
    }
  });
  return `<section class="profile-panel study-panel" id="studyPanel"><h2>Статистика обучения</h2>
    <p>Только встроенные рецепты. Для серии нужен хотя бы один ответ за день и ни одной ошибки.</p>
    <dl class="profile-stats">${statsGrid((remote && store.get(cacheKey)) || local)}</dl>
    <small>${remote?'Синхронизация…':owner?'На этом устройстве':'Гостевой прогресс на этом устройстве'}</small></section>`;
}
function localLeaders(metric){
  const owner=studyOwner();
  return studyKeys(profileAuth.prefix).map(key=>store.get(key)).filter(a=>a?.email).map(a=>{
    const stats=summarizeStudy(studyRecords(a.email));
    return {id:a.email,display_name:a.nick || a.name,score:stats[metric],attempts:stats.attempts,mine:a.email===owner};
  }).filter(row=>row.attempts && (metric==='mistakes' || row.score>0))
    .sort((a,b)=>(metric==='mistakes'?a.score-b.score:b.score-a.score) || b.attempts-a.attempts || a.id.localeCompare(b.id));
}
let rankingMetric='recipes';
function rankMember(row,index,metric){
  const placement=index+1, podium=placement<=3;
  const className=podium?'podium-member place-'+placement:'rank-row';
  const name=String(row.display_name), initials=name.trim().split(/\s+/u).slice(0,2).map(s=>Array.from(s)[0]).join('');
  const identity=`<span class="rank-name">${esc(name)}${row.mine?' <small>Вы</small>':''}</span>`;
  const score=`<b class="rank-score">${metricNumber(metric,row.score)}</b>`;
  return `<li class="${className}" value="${placement}">${podium
    ? `<span class="rank-avatar" aria-hidden="true">${esc(initials)}</span>${identity}${score}<span class="rank-step" aria-label="Место ${placement}">${placement}</span>`
    : `<span class="rank-position">${placement}</span>${identity}${score}`}</li>`;
}
async function loadRanking(container,metric,offset=0){
  const status=container.querySelector('[role=status]'), more=container.querySelector('[data-rank-more]');
  more.hidden=true; status.textContent='Загружаем результаты…';
  try{
    let rows;
    if(profileAuth.remote){
      await syncStudy(studyOwner());
      rows=await profileAuth.studyRpc('study_leaderboard',{metric,start_at:offset});
    }else rows=localLeaders(metric).slice(offset,offset+21);
    if(!container.isConnected) return;
    const podium=container.querySelector('.rank-podium'), list=container.querySelector('.rank-list');
    rows.slice(0,20).forEach((row,i)=>{
      const index=offset+i;
      (index<3?podium:list).insertAdjacentHTML('beforeend',rankMember(row,index,metric));
    });
    status.textContent=rows.length || offset ? '' : 'Пока нет результатов по этому показателю.';
    more.hidden=rows.length<=20;
    more.dataset.offset=String(offset+20);
  }catch{
    if(!container.isConnected) return;
    status.textContent='Не удалось загрузить рейтинг.';
    more.hidden=false; more.textContent='Повторить'; more.dataset.offset=String(offset);
    return;
  }
  more.textContent='Показать ещё';
}
function viewRanking(){
  setTop({});
  const metric=rankingMetric;
  queueMicrotask(()=>{
    const container=document.getElementById('rankingResults');
    if(container && metric===rankingMetric) loadRanking(container,metric);
  });
  return `<header class="page-head"><h1>Рейтинг</h1><p>${profileAuth.remote?'Участники тренажёра':'Участники на этом устройстве'}</p></header>
    <div class="rank-tabs" role="group" aria-label="Показатель рейтинга">${Object.entries(STUDY_METRICS).map(([key,m])=>`<button type="button" data-rank-metric="${key}" aria-pressed="${key===metric}">${m.tab}</button>`).join('')}</div>
    <section class="ranking-results" id="rankingResults"><h2>${STUDY_METRICS[metric].label}</h2><p>${STUDY_METRICS[metric].hint}</p>
    <ol class="rank-podium" aria-label="Пьедестал"></ol><ol class="rank-list" start="4" aria-label="Остальные участники"></ol>
    <p role="status"></p><button type="button" class="btn btn-secondary" data-rank-more hidden>Показать ещё</button></section>`;
}
document.addEventListener('click',event=>{
  const metric=event.target.closest('[data-rank-metric]')?.dataset.rankMetric;
  if(metric && Object.hasOwn(STUDY_METRICS,metric) && metric!==rankingMetric){ rankingMetric=metric; render(); }
  const more=event.target.closest('[data-rank-more]');
  if(more) loadRanking(more.parentElement,rankingMetric,Number(more.dataset.offset));
});
window.addEventListener('online',()=>{
  if(mode==='ranking' || mode==='profile') render();
  else if(profileAuth.remote) syncStudy(studyOwner()).catch(()=>{});
});
