'use strict';
Object.setPrototypeOf(INFO, null);   // название препарата вроде «constructor» не должно находить служебные свойства





/* =========================================================
   ДАННЫЕ: [название, доза/форма, путь введения, группа, латынь]
   ========================================================= */
/* ===== «Мои рецепты» в тестах: включённые рецепты дописываются в конец DB ===== */
const MYRX_KEY = 'pharma_myrx_v1';
const MYRX_TEST_ID = /^(exam|s[01]|b[0-4]|g_[a-z0-9]{1,12})$/;   // g_<id> — рецепт входит в группу
const MYGRP_KEY = 'pharma_myrx_groups_v1';
const BASE_LEN = DB.length;
const MY_ACTIVE = [];          // {id, r, d, tests:Set}
const MY_SET = new Set();      // кортежи DB, которые добавлены пользователем
function myrxDoseStr(r){
  const dose = String(r.dose||'').trim(), vol = String(r.vol||'').trim();
  switch(r.form){
    case 'caps':    return dose + ' капс.';
    case 'supp':    return dose + ' супп.';
    case 'powder':  return dose;
    case 'amp': case 'flac': return dose + ' ' + vol + ' мл';
    case 'tinct':   return 'настойка ' + vol + ' мл';
    case 'aerosol': return dose + ', аэрозоль';
    default:        return dose + ' таб.';
  }
}
(function(){
  let raw = null;
  try{ raw = JSON.parse(localStorage.getItem(MYRX_KEY)); }catch(_){}
  if(!Array.isArray(raw)) return;
  const taken = new Set(DB.map(d => d[0].trim().toLowerCase()));
  for(const r of raw){
    if(!r || typeof r!=='object' || !Array.isArray(r.tests)) continue;
    const tests = new Set(r.tests.filter(t => MYRX_TEST_ID.test(t)));
    const f = k => String(r[k]||'').trim();
    if(!f('drug') || !f('latin') || !f('route') || !f('group') || !f('signa')) continue;   // неполный рецепт в тестах не участвует
    const key = f('drug').toLowerCase();
    if(taken.has(key)) continue;
    taken.add(key);
    const d = [f('drug'), myrxDoseStr(r), f('route'), f('group'), f('latin')];
    DB.push(d); MY_SET.add(d); MY_ACTIVE.push({id: r.id, r, d, tests});
  }
})();
const MY_EXAM = new Set(MY_ACTIVE.filter(m => m.tests.has('exam')).map(m => m.d));
const myGrpPool = gid => MY_ACTIVE.filter(m => m.tests.has('g_' + gid)).map(m => m.d);   // пул группы своих рецептов
let curGrp = '';   // открытая группа
const EXAM_ITEMS = DB.filter(d => !MY_SET.has(d) || MY_EXAM.has(d));   // пул «Экзамена» и «Впиши сам»

const allRoutes = [...new Set(DB.map(d=>d[2]))];
const allGroups = [...new Set(DB.map(d=>d[3]))];
// Вторая (и далее) группа препарата — необязательный 6-й элемент строки DB: ["группа", …]
const grpExtra = d => d[5] || [];
const grpText = d => [d[3], ...grpExtra(d)].join(' / ');
const DB_INDEX = new Map(DB.map((d,i)=>[d,i]));   // только для разметки текущего экрана; в хранилище препараты записываются по НАЗВАНИЮ
const DB_BY_NAME = new Map(DB.map(d=>[d[0],d]));

/* ---- Фон: бегущая строка с латинскими названиями препаратов ---- */
(function(){
  const names = DB.filter((_,i) => i % 9 === 0).map(d => d[4].split('(')[0].trim().toUpperCase());
  const half = names.map(t => `<span>✚ ${t.replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';')}</span>`).join('');
  const track = document.getElementById('tickerTrack');
  track.innerHTML = half + half;
  track.style.setProperty('--tick-dur', Math.round(names.join('').length * 0.32) + 's');
})();


/* =========================================================
   ЕДИНЫЕ ТЕМАТИЧЕСКИЕ БЛОКИ — общие для «Теста по блокам»,
   «Впиши сам по блокам» и «Карточек». Внутри блока препараты идут
   в порядке перечисления групп. Если группу забыли вписать в блок,
   она попадёт в последний, чтобы препараты не потерялись.
   ========================================================= */
const BLOCKS = [
  {title:'Вегетативная нервная система и анальгетики',
   desc:'Холино- и адреносредства, ганглиоблокаторы, опиоиды и НПВС',
   groups:['М-холиномиметики','Антихолинэстеразные средства','М-холиноблокаторы','Ганглиоблокаторы',
     'Альфа-адреномиметики','Бета-адреномиметики','Альфа- и бета-адреномиметики',
     'Альфа-адреноблокаторы','Бета-адреноблокаторы','Альфа- и бета-адреноблокаторы',
     'Наркотические анальгетики','Антагонисты опиоидных рецепторов','Ненаркотические анальгетики, НПВС','Энтеросорбенты']},
  {title:'Центральная нервная система и анестезия',
   desc:'Наркоз, анестетики, психотропные, противоэпилептические',
   groups:['Средства для наркоза','Местные анестетики','Снотворные','Седативные','Анксиолитики','Нейролептики',
     'Антидепрессанты','Противоэпилептические','Противопаркинсонические','Ноотропы',
     'Аналептики, стимуляторы дыхания','Противомигренозные средства']},
  {title:'Сердце, сосуды и кровь',
   desc:'Гликозиды, нитраты, гипотензивные, диуретики, средства для крови',
   groups:['Сердечные гликозиды','Негликозидные кардиотоники','Антиангинальные, нитраты','Блокаторы кальциевых каналов','Ингибиторы АПФ',
     'Антагонисты рецепторов ангиотензина II','Диуретики','Антиаритмики','Гиполипидемические средства',
     'Метаболики, антиоксиданты','Ангиопротекторы','Антикоагулянты, антиагреганты','Гемостатики','Плазмозаменители']},
  {title:'Противомикробные средства и иммунитет',
   desc:'Антибиотики, противовирусные, иммуномодуляторы, антигистаминные',
   groups:['Пенициллины','Цефалоспорины','Макролиды, азалиды','Тетрациклины','Аминогликозиды','Амфениколы',
     'Фторхинолоны','Сульфаниламиды','Производные нитрофурана','Противотуберкулёзные','Противогрибковые',
     'Противовирусные','Противопротозойные','Прочие противомикробные','Иммуномодуляторы, противовирусные',
     'Антигистаминные средства','Цитостатики']},
  {title:'Дыхание, пищеварение, гормоны и витамины',
   desc:'Отхаркивающие, средства для ЖКТ, гормоны, ГКС, инсулины, витамины',
   groups:['Муколитики, отхаркивающие','Противокашлевые','Бронхолитики','Противорвотные','Спазмолитики',
     'Слабительные','Блокаторы Н2-рецепторов','Глюкокортикостероиды','Гормоны','Антитиреоидные',
     'Инсулины','Гипогликемические средства','Анаболические стероиды','Витамины','Ферменты']},
];
(function(){
  const listed = new Set(BLOCKS.flatMap(b=>b.groups));
  const rest = [...new Set(DB.filter(d=>!MY_SET.has(d)).map(d=>d[3]))].filter(g=>!listed.has(g));
  if(rest.length) BLOCKS[BLOCKS.length-1].groups.push(...rest);
  BLOCKS.forEach((b,i)=>{ b.num = i+1; b.items = b.groups.flatMap(g=>DB.filter(d=>d[3]===g && !MY_SET.has(d))); });
  // свой рецепт попадает в блок только если пользователь отметил именно этот блок
  for(const m of MY_ACTIVE) for(const t of m.tests){
    const k = /^b(\d)$/.exec(t);
    if(k && BLOCKS[+k[1]]) BLOCKS[+k[1]].items.push(m.d);
  }
})();

/* =========================================================
   СЕМЕСТРЫ — какие тематические блоки входят в какой семестр.
   Порядок блоков: 1 — вегетативная НС и анальгетики, 2 — центральная НС и анестезия,
   3 — сердце, сосуды и кровь, 4 — противомикробные и иммунитет,
   5 — дыхание, пищеварение, гормоны и витамины.
   Чтобы поменять распределение, достаточно переписать массивы blocks.
   ========================================================= */
const SEMESTERS = [
  {title:'1 семестр', short:'Зимний зачёт',  desc:'Вегетативная и центральная нервная система, анестезиология', blocks:[0, 1]},
  {title:'2 семестр', short:'Летний зачёт', desc:'Кровообращение, противомикробные средства, дыхание, пищеварение, гормоны', blocks:[2, 3, 4],
   names:["Карведилол", "Верапамил", "Винпоцетин (Кавинтон)", "Эналаприл", "Каптоприл", "Эноксапарин натрия (Клексан)", "Коргликон", "Рибоксин", "Амантадин", "Лозартан", "Реополиглюкин", "Актовегин", "Левосимендан", "Дигоксин", "Амлодипин", "Амиодарон", "Кокарбоксилаза", "Дибазол", "Нитроглицерин", "Курантил", "Нифедипин", "Никотиновая кислота", "Фуросемид", "Прогестерон", "Окситоцин", "Варфарин", "Преднизолон", "Ретаболил", "Спиронолактон", "Дексаметазон", "Гепарин", "Гидрохлоротиазид", "Диклофенак", "Целекоксиб", "Лидаза", "Лонгидаза", "Викасол", "Цианокобаламин", "Ретинола ацетат", "Аскорбиновая кислота", "Рибофлавин", "Тиамина бромид", "Левофлоксацин", "Цефтриаксон", "Амоксициллин", "Азитромицин", "Бензилпенициллина натриевая соль", "Гентамицин", "Тетрациклин", "Эритромицин", "Ампициллин", "Ко-тримоксазол", "Левомицетин", "Фуразолидон", "Уросульфан", "Виферон", "Немозол", "Изониазид", "Кеторолак", "Фурадонин (Нитрофурантоин)", "Нистатин", "Аминокапроновая кислота", "Лантус", "Ирунин", "Суматриптан", "Супрастин", "Мерказолил", "Калия йодид", "Пентоксифиллин", "Розувастатин", "Триметазидин", "Метформин", "Пироксикам", "Дезлоратадин", "Симвастатин"]}
];


/* ========================= Утилиты ========================= */
function shuffle(a){const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
const ESC = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c=>ESC[c]); }
function plural(n, one, few, many){
  const a = n%10, b = n%100;
  return a===1 && b!==11 ? one : a>=2 && a<=4 && (b<12 || b>14) ? few : many;
}
function objOf(v){ return v && typeof v==='object' && !Array.isArray(v) ? v : {}; }
const store = {
  gen: 0,   // «поколение» хранилища: растёт при любой записи, по нему кешируются дорогие производные (значки сброса)
  get(k){ try{ const v = localStorage.getItem(k); return v===null ? null : JSON.parse(v); }catch{ return null; } },
  set(k,v){ this.gen++; try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch{ return false; } },   // false — память заполнена или недоступна
  del(k){ this.gen++; try{ localStorage.removeItem(k); }catch{} },
  has(k){ try{ return localStorage.getItem(k)!==null; }catch{ return false; } }
};
/* [Оптимизация 4] Кэш разобранных и нормализованных данных: JSON.parse и проверка каждого рецепта выполняются только когда изменилась
   сохранённая строка. Ключ кэша — сама строка из localStorage, поэтому запись из другой вкладки тоже подхватывается.
   Вызывающий получает копию: части кода правят полученный список на месте (push, unshift, g.name = …),
   поэтому отдавать сам кэшированный объект нельзя — он бы менялся без записи в localStorage.
   key  — ключ localStorage; build(v) — разбор и очистка данных (выполняется только при промахе кэша);
   copy(v) — копия, которая уходит вызывающему. Битый JSON или недоступный localStorage дают build(null), как раньше. */
const loadCache = new Map();
function loadCached(key, build, copy){
  let raw = null;
  try{ raw = localStorage.getItem(key); }catch{}
  let c = loadCache.get(key);
  if(!c || c.raw !== raw){
    let v = null;
    if(raw !== null) try{ v = JSON.parse(raw); }catch{}
    c = {raw, v: build(v)};
    loadCache.set(key, c);
  }
  return copy(c.v);
}

/* =========================================================
   ВАРИАНТЫ ОТВЕТОВ для режимов с выбором
   ========================================================= */
// Похожие группы: неверные варианты подбираются по близости (общие кластеры)
const GROUP_CLUSTERS = [
  ["Альфа-адреномиметики","Бета-адреномиметики","Альфа- и бета-адреномиметики"],
  ["Бета-адреноблокаторы","Альфа- и бета-адреноблокаторы","Альфа-адреноблокаторы"],
  ["Альфа-адреномиметики","Альфа-адреноблокаторы","Бета-адреномиметики","Бета-адреноблокаторы"],
  ["Альфа- и бета-адреномиметики","Альфа- и бета-адреноблокаторы"],
  ["Наркотические анальгетики","Ненаркотические анальгетики, НПВС","Антагонисты опиоидных рецепторов"],
  ["Пенициллины","Цефалоспорины"],
  ["Макролиды, азалиды","Тетрациклины","Аминогликозиды","Амфениколы"],
  ["Фторхинолоны","Сульфаниламиды","Производные нитрофурана"],
  ["Пенициллины","Цефалоспорины","Макролиды, азалиды","Тетрациклины","Аминогликозиды","Фторхинолоны","Амфениколы","Сульфаниламиды","Производные нитрофурана","Противотуберкулёзные","Прочие противомикробные"],
  ["Противогрибковые","Противовирусные","Противопротозойные","Прочие противомикробные","Иммуномодуляторы, противовирусные"],
  ["Сердечные гликозиды","Негликозидные кардиотоники"],
  ["Сердечные гликозиды","Негликозидные кардиотоники","Антиаритмики","Антиангинальные, нитраты"],
  ["Антиангинальные, нитраты","Блокаторы кальциевых каналов","Метаболики, антиоксиданты"],
  ["Ингибиторы АПФ","Антагонисты рецепторов ангиотензина II","Диуретики","Блокаторы кальциевых каналов"],
  ["Ингибиторы АПФ","Антагонисты рецепторов ангиотензина II"],
  ["Бета-адреноблокаторы","Блокаторы кальциевых каналов","Антиаритмики","Ингибиторы АПФ"],
  ["Антикоагулянты, антиагреганты","Гемостатики","Ангиопротекторы"],
  ["Гиполипидемические средства","Антикоагулянты, антиагреганты","Ангиопротекторы"],
  ["Аналептики, стимуляторы дыхания","Ноотропы","Метаболики, антиоксиданты"],
  ["Нейролептики","Анксиолитики","Антидепрессанты","Снотворные","Седативные"],
  ["Снотворные","Седативные","Анксиолитики"],
  ["Противоэпилептические","Анксиолитики","Противопаркинсонические","Нейролептики"],
  ["Ноотропы","Метаболики, антиоксиданты","Ангиопротекторы"],
  ["Муколитики, отхаркивающие","Противокашлевые","Бронхолитики"],
  ["Бронхолитики","М-холиноблокаторы","Бета-адреномиметики"],
  ["Противорвотные","Спазмолитики","Слабительные","Блокаторы Н2-рецепторов"],
  ["Спазмолитики","М-холиноблокаторы","Антихолинэстеразные средства","Бронхолитики"],
  ["М-холиноблокаторы","М-холиномиметики","Антихолинэстеразные средства","Ганглиоблокаторы"],
  ["Глюкокортикостероиды","Гормоны","Анаболические стероиды","Антитиреоидные"],
  ["Инсулины","Гипогликемические средства","Гормоны"],
  ["Витамины","Метаболики, антиоксиданты","Ферменты"],
  ["Местные анестетики","Средства для наркоза","Наркотические анальгетики"],
  ["Антигистаминные средства","Блокаторы Н2-рецепторов","Противомигренозные средства","Глюкокортикостероиды"],
  ["Цитостатики","Иммуномодуляторы, противовирусные","Глюкокортикостероиды"],
  ["Плазмозаменители","Гемостатики","Витамины"],
  ["Ферменты","Муколитики, отхаркивающие"],
  ["Антитиреоидные","Гормоны"],
  ["Энтеросорбенты","Слабительные","Антихолинэстеразные средства"]
];
// Неверные варианты: берём 2 из самых близких групп (чем меньше и теснее общий кластер, тем выше вес), остальное — запасной вариант
function pickGroup(correct, avoid=[]){
  const score = new Map();
  for(const cl of GROUP_CLUSTERS){
    if(!cl.includes(correct)) continue;
    for(const g of cl) if(g!==correct && !avoid.includes(g)) score.set(g, (score.get(g)||0)+1/(cl.length-1));
  }
  const ranked = shuffle([...score.keys()]).sort((a,b)=>score.get(b)-score.get(a));
  let wrong = shuffle(ranked.slice(0,3)).slice(0,2);
  if(wrong.length<2){
    const rest = shuffle(allGroups.filter(g=>g!==correct && !avoid.includes(g) && !wrong.includes(g)));
    wrong = wrong.concat(rest.slice(0,2-wrong.length));
  }
  return shuffle([correct, ...wrong]);
}
function pick3(correct, pool){
  const others = [...new Set(pool.filter(x=>x!==correct))];
  const wrong = shuffle(others).slice(0,2);
  return shuffle([correct, ...wrong]);
}
// Грубая категория формы по пути введения — чтобы варианты дозы не были все «на один вид»
// (иначе по формату записи, напр. одни таблетки, путь введения угадывается без знания препарата)
function routeCategory(route){
  route = String(route).split(',')[0].trim();
  if(route==='внутрь' || route==='сублингвально') return 'oral';
  if(route==='в/м' || route==='в/в' || route==='п/к') return 'injection';
  return 'other'; // местно, капли, ректально, интраназально, назально, ингаляционно
}
// Дистрактор не должен повторять часть верной дозы («1% 5 мл; 0,1% 1 мл» и «0,1% 1 мл» — оба верны по смыслу)
function doseSegs(s){ return doseVariants(s).map(doseCanon).filter(x => /[^\d.\s]/.test(x)); }
function doseOverlap(a, b){ const sb = doseSegs(b); return doseSegs(a).some(x => sb.includes(x)); }
// 2 неверных варианта дозы: один — из ТОЙ ЖЕ категории формы, что и верный, другой — из другой.
// Если брать оба из другой категории, верная доза — единственная «своей» формы, и её видно по пути введения.
function pick3Dose(correctDose, correctRoute){
  const cat = routeCategory(correctRoute);
  const sameCat = [], otherCat = [];
  for(const d of DB){
    if(d[1] === correctDose || doseOverlap(d[1], correctDose)) continue;
    if(routeCategory(d[2]) === cat) sameCat.push(d[1]);
    else otherCat.push(d[1]);
  }
  // одна и та же строка дозы бывает у препаратов разных категорий — в «другую» её не берём, иначе будет дубль
  const same = shuffle([...new Set(sameCat)]), other = shuffle([...new Set(otherCat)].filter(x => !sameCat.includes(x)));
  const wrong = [];
  if(same.length) wrong.push(same[0]);
  if(other.length) wrong.push(other[0]);
  for(const x of shuffle([...same.slice(1), ...other.slice(1)])){ if(wrong.length>=2) break; if(!wrong.includes(x)) wrong.push(x); }
  return shuffle([correctDose, ...wrong.slice(0,2)]);
}
// Пути введения: вариант, состоящий из части способов верного («в/м» при верном «в/м, п/к») или включающий верный
// («внутрь, в/в» при верном «внутрь»), двусмыслен, поэтому в дистракторы не берётся
function pick3Route(correct, pool){
  const parts = s => String(s).split(',').map(x => x.trim()).filter(Boolean);
  const cp = parts(correct);
  const overlaps = x => { const xp = parts(x); return xp.every(p => cp.includes(p)) || cp.every(p => xp.includes(p)); };
  const others = [...new Set(pool.filter(x => x!==correct))];
  const clean = shuffle(others.filter(x => !overlaps(x)));
  const wrong = clean.slice(0,2);
  if(wrong.length<2) wrong.push(...shuffle(others.filter(x => !wrong.includes(x))).slice(0, 2-wrong.length));
  return shuffle([correct, ...wrong]);
}

/* =========================================================
   ПРОВЕРКА ВПИСАННЫХ ОТВЕТОВ («Впиши сам»)
   ========================================================= */
function levenshtein(a,b){
  const m=a.length, n=b.length;
  if(m===0) return n;
  if(n===0) return m;
  const dp = new Array(n+1);
  for(let j=0;j<=n;j++) dp[j]=j;
  for(let i=1;i<=m;i++){
    let prev = dp[0];
    dp[0] = i;
    for(let j=1;j<=n;j++){
      const tmp = dp[j];
      dp[j] = a[i-1]===b[j-1] ? prev : 1+Math.min(prev, dp[j], dp[j-1]);
      prev = tmp;
    }
  }
  return dp[n];
}
function normalizeAnswer(s){
  return String(s||'')
    .toLowerCase()
    .replace(/ё/g,'е')
    .replace(/[«»"']/g,'')
    .replace(/\s+/g,' ')
    .trim();
}
// Дозы с несколькими вариантами («0,5; 0,25 таб.», «0,1; 0,2 капс.; 0,1 таб.») — достаточно ввести ЛЮБОЙ один.
// Для сегмента без формы (напр. «0,5») форма берётся из ближайшего следующего сегмента («0,5 таб.»).
function doseVariants(correct){
  const parts = String(correct).split(';').map(s=>s.trim()).filter(Boolean);
  const out = [String(correct)];
  if(parts.length < 2) return out;
  for(let i=0;i<parts.length;i++){
    let seg = parts[i];
    if(/^[\d\s.,]+$/.test(seg)){
      for(let j=i+1;j<parts.length;j++){
        const m = parts[j].match(/^[\d\s.,]+(.*)$/);
        if(m && m[1].trim()){ seg = seg + ' ' + m[1].trim(); break; }
      }
    }
    out.push(seg);
  }
  return out;
}
// Строгое сравнение дозы: ВСЕ числа/концентрации должны совпасть ТОЧНО (0,5 ≠ 0,05 ≠ 0,03; «1% 5 мл» → «1 5»); форма (таб., капс., мл)
// и знак % необязательны и не проверяются. Запятая/точка равнозначны, «500 000» = «500000», МЕ = ЕД.
function doseCanon(s){
  return String(s||'').toLowerCase().replace(/ё/g,'е')
    .replace(/[«»"']/g,'')
    .replace(/,/g,'.')
    .replace(/(^|\s)(\d{1,3})\s(\d{3})\s(\d{3})(?!\d)/g,'$1$2$3$4')
    .replace(/(^|\s)(\d{1,3})\s+(?=000(?!\d))/g,'$1$2')
    .replace(/\.(?!\d)/g,' ')
    .replace(/(^|\s)ме(?=[\s/]|$)/g,'$1ед')
    .replace(/\s+/g,' ').trim();
}
// Числа строки: «№10» (число в упаковке) не считается, слова и знак % тоже
const doseNums = x => (doseCanon(x).replace(/№\s*\d+/g,' ').match(/\d+(?:\.\d+)?/g) || []).map(Number);
// Один и тот же ввод читается по-разному: «1 500» — это 1500 или 1 и 500; «500.000» — 500000 или 500; «0, 5» — 0,5 или 0 и 5.
// Берутся все прочтения: ответ верен, если подходит любое из них.
function doseReadings(user){
  const t = String(user||'').replace(/№\s*\d+/g,' ').normalize('NFKC');   // «№10» убирается до NFKC: он превращает «№» в «No»; полноширинные цифры → обычные
  const space = x => x.replace(/(^|[^\d.,])([1-9]\d{0,2})(?:[\s\u00a0\u202f]\d{3})+(?!\d)/g, m => m.replace(/(?<=\d)[\s\u00a0\u202f]+(?=\d)/g, ''));   // 1 500 → 1500
  const sep   = x => x.replace(/(^|[^\d.,])([1-9]\d{0,2})(?:[.,’'`´]\d{3})+(?!\d)/g, m => m.replace(/(?<=\d)[.,’'`´](?=\d)/g, ''));            // 500.000 → 500000
  const dec   = x => x.replace(/(\d)\s*,\s*(\d)/g, '$1.$2');                                                                                   // 0, 5 → 0.5
  return [t, space(t), sep(t), dec(t), dec(sep(space(t)))].map(doseNums);
}
function doseMatchOne(user, correct){
  // нужны ВСЕ числа: и концентрация, и объём; форма (таб., мл) и знак % не проверяются
  const c = doseNums(correct);
  return c.length>0 && doseReadings(user).some(u => u.length===c.length && u.every((w,i) => w === c[i]));
}
// Слово после запятой с пробелом («0,00025 г/доза, аэрозоль») — второй допустимый ответ (напр. форма «аэрозоль»).
function doseAltVariants(correct){
  const out = [];
  for(const part of String(correct).split(';')){
    part.split(/,\s+/).slice(1).forEach(x => { x = x.trim(); if(/^[а-яёa-z]/i.test(x)) out.push(x); });
  }
  return out;
}
function doseAltMatch(user, alt){
  const ucanon = doseCanon(user);
  const uw = ucanon.split(' ').filter(w => w.length>=3 && !/\d/.test(w));
  const aw = doseCanon(alt).split(' ').filter(w => w.length>=3 && !/\d/.test(w));
  if(!uw.length || !aw.length) return false;
  const wordsOk = uw.every(w => aw.some(x => w===x || (Math.min(w.length,x.length)>=4 && (w.startsWith(x)||x.startsWith(w))) || (Math.min(w.length,x.length)>=3 && levenshtein(w,x)<=1)));
  // слово формы («аэрозоль») — ответ само по себе; с числом нужно и слово: одно число «15» — лишь часть дозы
  return wordsOk && (!/\d/.test(ucanon) || doseMatchOne(user, alt));
}
function isCloseMatch(user, correct, isDose){
  if(isDose) return doseVariants(correct).some(v => doseMatchOne(user, v)) || doseAltVariants(correct).some(v => doseAltMatch(user, v));
  return isCloseMatchOne(user, correct);
}
// Название группы вписывается целиком: пользователь печатает как хочет, а панель подсказок над клавиатурой (kbBar) предлагает точное написание.
// Сравнение — без регистра, ё=е и лишних пробелов; нечёткого угадывания по отдельным словам нет.
const groupKey = s => normalizeAnswer(s).replace(/[,;.\-–—()]/g,' ').replace(/\s+/g,' ').trim();   // знаки препинания не важны
// Название через запятую («Ненаркотические анальгетики, НПВС») — это несколько групп сразу: подходит и целиком, и любая часть,
// но часть должна быть осмысленной (не «для», не «и», не «средства»)
const GROUP_STOP = new Set(['и','для','средства','средство','препараты','препарат','группа','лекарственные']);
function isCloseMatchOne(user, correct){
  const u = groupKey(user);
  if(!u) return false;
  if(u === groupKey(correct)) return true;
  return String(correct).split(',').map(groupKey).some(part => part.length>=4 && !GROUP_STOP.has(part) && u === part);
}
// Все названия групп, включая вторые группы препаратов: из них строится подсказка
const GROUP_LIST = [...new Set(DB.flatMap(d => [d[3], ...grpExtra(d)]))].sort((a, b) => a.localeCompare(b, 'ru'));
if(window.RecipeBot && RecipeBot.setGroups) RecipeBot.setGroups(GROUP_LIST);   // Recipe-бот ищет группу в вставленном тексте по этому списку
const GROUP_TOK = GROUP_LIST.map(g => ({g, n: normalizeAnswer(g), words: normalizeAnswer(g).split(/[\s,;\-–—/()]+/).filter(Boolean)}));
// Подсказка по набранному: каждое слово запроса — начало какого-то слова группы (с допуском на одну опечатку от 5 букв)
function groupHits(q){
  const qw = normalizeAnswer(q).split(/[\s,;\-–—/()]+/).filter(Boolean);
  if(!qw.length) return [];
  const n = normalizeAnswer(q), out = [];
  for(const t of GROUP_TOK){
    const ok = qw.every(w => t.words.some(x => x.startsWith(w) || (w.length>=5 && levenshtein(w, x.slice(0, w.length)) <= 1)));
    if(ok) out.push([t.n.startsWith(n) ? 0 : 1, t.g]);
  }
  return out.sort((a, b) => a[0]-b[0] || a[1].localeCompare(b[1], 'ru')).map(x => x[1]);
}
// Сохранённые вердикты пересчитываются по ТЕКУЩИМ правилам проверки
// (иначе ответ, проверенный в старой версии, навсегда остаётся с прежним «неверно»).
function reevalWrite(st, entry){
  // ответы старого формата («доза + группа») не пересчитываются — остаётся прежний вердикт
  if(st.checked && entry && st.v===3 && (st.typed.latin.trim() || st.typed.dose.trim() || st.typed.group.trim())){
    const lm = latinMatch(st.typed.latin, entry[4], entry[0]);
    st.latinOk = lm > 0; st.latinTypo = lm === 2;
    st.doseOk = isCloseMatch(st.typed.dose, entry[1], true);
    st.groupOk = [entry[3], ...grpExtra(entry)].some(g => isCloseMatch(st.typed.group, g, false));
    st.correct = st.latinOk && st.doseOk && st.groupOk;
  }
  return st;
}

/* =========================================================
   «ВПИШИ САМ»: латинское название, концентрация, форма выпуска
   и эталонный рецепт на обороте карточки
   ========================================================= */
// Кириллические буквы, неотличимые от латинских: при наборе с русской раскладки их легко вписать вместо латинских
const LAT_LOOK_UP = {'А':'A','В':'B','Е':'E','К':'K','М':'M','Н':'H','О':'O','Р':'P','С':'C','Т':'T','Х':'X','У':'Y','І':'I','Ј':'J','Ѕ':'S'};
const LAT_LOOK_LO = {'а':'a','е':'e','о':'o','р':'p','с':'c','х':'x','у':'y','к':'k','м':'m','т':'t','і':'i','ј':'j','ѕ':'s'};
function latinNorm(s){
  return String(s||'')
    .normalize('NFKD').replace(/[\u0300-\u036f\u00ad\u200b-\u200d\u2060\ufeff]/g,'')   // диакритика (İ → I), мягкий перенос, невидимые символы
    .replace(/[АВЕКМНОРСТХУІЈЅ]/g, c => LAT_LOOK_UP[c])
    .toLowerCase().replace(/æ/g,'ae').replace(/œ/g,'oe')
    .replace(/[аеорсхукмтіјѕ]/g, c => LAT_LOOK_LO[c])
    .replace(/[«»"'`´“”„‘’‚‹›.,:;()]/g,' ')
    .replace(/[-‐‑‒–—―−]/g,' ').replace(/\s+/g,' ').trim();
}
// В поле «латынь» иногда пишут сразу с формой («Tab. Labetaloli») — форму отбрасываем
const LAT_FORM_WORDS = /^(?:recipe|rp|tab|tabulettas?|tabulettae|sol|solutionis|solutio|caps|capsulas?|capsulae|supp|suppositoria|tinct|tincturae|tinctura|aerosoli|aerosolum|ampullas?|ampullae|guttas?|guttae|pulveris|pulvis|ung|unguenti|sirupi|et)(?:\s+|$)/;
function latinStrip(s){
  let x = latinNorm(s), prev;
  do { prev = x; x = x.replace(LAT_FORM_WORDS, '').trim(); } while(x !== prev);
  return x;
}
// «Mesatoni (Phenylephrini)» → допустимы оба названия; в скобках через запятую — несколько
function latinOptions(latin){
  const m = String(latin).match(/^(.*?)\s*\((.*)\)\s*$/);
  const opts = (m ? [m[1], ...m[2].split(',')] : [latin]).map(latinNorm).filter(Boolean);
  if(m) opts.push(latinNorm(latin));            // можно вписать и целиком, как в справочнике
  return opts;
}
// Пробелы и дефисы в латинском названии не важны: «Co-trimoxazoli» = «Co trimoxazoli» = «Cotrimoxazoli»
const latinKey = x => x.replace(/ /g, '');
// Название из заголовка эталонного рецепта на обороте карточки («Tabulettas Metamizoli sodii 0,5» → «metamizoli sodii»)
// тоже верно: иначе ученик, написавший как на карточке, получил бы «неверно»
const RX_LAT_CACHE = new Map();
function recipeLatinOptions(name){
  if(!name || !RX_DATA[name]) return [];
  if(!RX_LAT_CACHE.has(name)){
    const head = String(RX_DATA[name][0] && RX_DATA[name][0][0] || '').replace(/^\s*(?:recipe|rp)\s*:\s*/i, '');
    const typed = head.replace(/\s+\d[\d\s,.]*\s*(?:%|ED|ME|ml|мл)?.*$/i, '').replace(/\s*[—–-]\s*$/, '');
    const o = latinStrip(typed);
    RX_LAT_CACHE.set(name, o ? [o] : []);
  }
  return RX_LAT_CACHE.get(name);
}
// Ровно одна опечатка: лишняя, пропущенная или заменённая буква, либо две соседние буквы местами
function oneTypo(a, b){
  if(a === b) return true;
  const la = a.length, lb = b.length;
  if(Math.abs(la-lb) > 1) return false;
  let i = 0; while(i<la && i<lb && a[i]===b[i]) i++;
  if(la === lb) return a.slice(i+1) === b.slice(i+1) || (a[i]===b[i+1] && a[i+1]===b[i] && a.slice(i+2) === b.slice(i+2));
  return la > lb ? a.slice(i+1) === b.slice(i) : b.slice(i+1) === a.slice(i);
}
// 0 — неверно, 1 — верно, 2 — верно, но с опечаткой (допускается только в длинных названиях — от 9 букв, чтобы короткие не путались)
function latinMatch(user, latin, name){
  const u = latinKey(latinStrip(user));
  if(!u) return 0;
  const opts = [...latinOptions(latin), ...recipeLatinOptions(name)].map(latinKey).filter(Boolean);
  if(opts.includes(u)) return 1;
  return opts.some(o => o.length >= 9 && oneTypo(u, o)) ? 2 : 0;   // длина считается по эталону: в 9-буквенном названии пропущенная буква — тоже одна опечатка
}
const latinOk = (user, latin, name) => latinMatch(user, latin, name) > 0;

// Дозировка может состоять из нескольких вариантов («0,005 таб.; 0,5% 2 мл»)
function rxSegments(dose){
  const parts = String(dose).split(';').map(s => s.trim()).filter(Boolean);
  return parts.map((seg, i) => {
    if(/^[\d\s.,]+$/.test(seg)){
      for(let j = i+1; j < parts.length; j++){
        const m = parts[j].match(/^[\d\s.,]+(.*)$/);
        if(m && m[1].trim()) return seg + ' ' + m[1].trim();
      }
    }
    return seg;
  });
}
function rxKind(seg){
  const s = seg.toLowerCase();
  if(/таб\./.test(s)) return 'tab';
  if(/капс\./.test(s)) return 'caps';
  if(/супп/.test(s)) return 'supp';
  if(/аэрозол/.test(s)) return 'aerosol';
  if(/настойк/.test(s)) return 'tincture';
  if(/пор\.|д\/р/.test(s)) return 'powder';
  if(/мл/.test(s)) return 'liquid';
  return 'powder';        // «500 000 ЕД», «1500 ЕД»: сухое вещество во флаконе
}

const ROUTE_RU = {'в/в':'внутривенно','в/м':'внутримышечно','п/к':'подкожно','капли':'в виде капель'};
const INJ_ROUTE = new Set(['в/в','в/м','п/к','инфильтрационно']);
const routeRu = r => ROUTE_RU[r] || r;
function routeParts(route){ return String(route).split(',').map(s => s.trim()).filter(Boolean); }
function rxRoute(route, wantInj){
  const parts = routeParts(route);
  const inj = parts.filter(p => INJ_ROUTE.has(p)), other = parts.filter(p => !INJ_ROUTE.has(p));
  const pick = wantInj === true ? inj[0] : wantInj === false ? other[0] : null;
  return routeRu(pick || parts[0] || '');
}
const GAP = '<span class="gap">…</span>';

// Рецепт: «Recipe:» стоит один в левой колонке, а все строки — и первая, и «Da tales doses…», и «Signa…» —
// начинаются в одном месте, правее него. Под словом Recipe ничего не пишется.
const RX_KEY = /^(Recipe:|Rp\.:?)(?:\s+|$)/;
// Сокращённая запись (допустимые сокращения) — применяется, если полная не помещается в строку
function rxShort(lines){
  const ab = t => t
    .replace(/^Recipe:/, 'Rp.:')
    .replace(/Da tales doses numero/, 'D.t.d.n.')
    .replace(/^Da\. Signa:/, 'D.S.:')
    .replace(/^Signa:/, 'S.:')
    .replace(/Solutionis /, 'Sol. ')
    .replace(/Tabulettas /, 'Tab. ')
    .replace(/Suppositoria /, 'Supp. ')
    .replace(/in\u00a0ampullis/, 'in\u00a0amp.')
    .replace(/in\u00a0capsulis/, 'in\u00a0caps.')
    .replace(/in\u00a0flaconibus/, 'in\u00a0flac.');
  return lines.map(([t, c]) => [ab(t), c]);
}
function rxDoc(lines){
  const m = RX_KEY.exec(lines[0][0]);
  if(!m) return lines.map(([t, c]) => `<span class="bl${c ? ' ' + c : ''}">${t}</span>`).join('');
  // русский текст (Signa) оборачиваем в .ru — его размер подгоняется под визуальный размер латиницы
  const ru = v => v.split(/(<[^>]+>)/).map(x => x.charAt(0)==='<' ? x : x.replace(/[А-Яа-яЁё]+(?:[\s\u00a0.,;:\-–()\d\/]+[А-Яа-яЁё]+)*/g, '<span class="ru">$&</span>')).join('');
  const row = (k, v, c) => `<span class="bl${c==='in2' ? ' in2' : ''}"><span class="k">${k}</span><span class="v${/^(Signa|Da\. Signa|S\.|D\.S\.)/.test(v) ? ' wrap' : ''}">${ru(v)}</span></span>`;
  return row(m[1], lines[0][0].slice(m[0].length), '') + lines.slice(1).map(([t, c]) => row('', t, c)).join('');
}
// Эталонный рецепт: строки бланка + название формы выпуска + число «Выпиши»
function rxBuild(d){
  const [, dose, route, group, latin] = d;
  const segs = rxSegments(dose), seg = segs[0], kind = rxKind(seg);
  const lat = String(latin).replace(/\s*\(.*\)\s*$/, '');
  const num = x => x.replace(/\s*(таб|капс|супп)\.?\s*$/i, '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s*г\s*$/, '').trim();
  const parts = routeParts(route);
  const hasInj = parts.some(p => INJ_ROUTE.has(p)), hasOther = parts.some(p => !INJ_ROUTE.has(p));
  let lines, form;
  if(kind === 'tab'){
    form = 'таблетки';
    lines = [['Recipe: Tabulettas ' + lat + ' ' + num(seg), ''], ['Da tales doses numero 20', 'in1'],
             ['Signa: ' + rxRoute(route, false) + ', по 1 таблетке ' + GAP + ' раз в день', 'in1']];
  } else if(kind === 'caps'){
    form = 'капсулы';
    lines = [['Recipe: ' + lat + ' ' + num(seg), ''], ['Da tales doses numero 20 in\u00a0capsulis', 'in1'],
             ['Signa: ' + rxRoute(route, false) + ', по 1 капсуле ' + GAP + ' раз в день', 'in1']];
  } else if(kind === 'supp'){
    form = 'свечи (суппозитории)';
    lines = [['Recipe: Suppositoria ' + lat + ' ' + num(seg), ''], ['Da tales doses numero 10', 'in1'],
             ['Signa: ' + rxRoute(route) + ', по 1 свече ' + GAP + ' раз в день', 'in1']];
  } else if(kind === 'aerosol'){
    form = 'аэрозоль';
    lines = [['Recipe: Aerosoli ' + lat + ' ' + seg.replace(/,?\s*аэрозоль.*$/i, '').trim(), ''],
             ['Da. Signa: ' + rxRoute(route) + ', по ' + GAP + ' вдоха ' + GAP + ' раз в день', 'in1']];
  } else if(kind === 'tincture'){
    form = 'настойка';
    lines = [['Recipe: Tincturae ' + lat + ' —\u00a0' + seg.replace(/настойка\s*/i, '').replace(/\s*мл/, '\u00a0ml'), ''],
             ['Da. Signa: ' + rxRoute(route) + ', по ' + GAP + ' капель ' + GAP + ' раз в день', 'in1']];
  } else if(kind === 'powder'){
    form = 'порошок во флаконах';
    lines = [['Recipe: ' + lat + ' ' + num(seg), ''], ['Da tales doses numero 10 in\u00a0flaconibus', 'in1'],
             ['Signa: растворить в ' + GAP + ', вводить ' + rxRoute(route, hasInj ? true : null) + ' ' + GAP + ' раз в день', 'in1']];
  } else {
    const m = seg.match(/^(.*?)\s*(\d+(?:[.,]\d+)?)\s*мл\s*$/);
    let conc = m ? m[1].trim() : '', vol = m ? m[2] : '';
    const oily = /масл/i.test(conc);
    conc = conc.replace(/\s*масляный\s*р-р/i, '').trim();
    const volN = parseFloat(vol.replace(',', '.')) || 0;
    // ампулы — если путь только инъекционный или объём небольшой; флакон — для капель и носа
    const inj = hasInj && (!hasOther || (volN < 5 && !parts.includes('капли')) || (volN < 5));
    const head = 'Recipe: Solutionis ' + lat + (oily ? ' oleosae' : '') + ' ' + conc + ' —\u00a0' + vol + '\u00a0ml';
    if(inj){
      form = 'раствор в ампулах';
      lines = [[head, ''], ['Da tales doses numero 10 in\u00a0ampullis', 'in1'],
               ['Signa: ' + rxRoute(route, true) + ', по ' + GAP + ' мл ' + GAP + ' раз в день', 'in1']];
    } else {
      form = 'флакон';
      const unit = /интраназ|капли/.test(route) ? 'капель' : 'мл';
      const rt = rxRoute(route, false);
      lines = [[head, ''], ['Da. Signa: ' + (rt === 'в виде капель' ? '' : rt + ', ') + 'по ' + GAP + ' ' + unit + ' ' + GAP + ' раз в день', 'in1']];
    }
  }
  return {lines, form, group, extra: segs.slice(1)};
}

/* Эталонные рецепты — из файла «Рецепты 2023» (метопролол, атенолол, изосорбида динитрат и ко-тримоксазол — из файла с рецептами на экзамен) */
const RX_DATA = {"Ламотриджин":[["Recipe: Tabulettas Lamotrigini 0,1",""],["Da tales doses numero 10","in1"],["Signa: По 1 таб 3 р. в день","in1"]],"Суматриптан":[["Recipe: Tabulettas Sumatriptani 0,1",""],["Da tales doses numero 2","in1"],["Signa: По 1 таб 2 р. в день","in1"]],"Нимесулид":[["Recipe: Tabulettas Nimesulidi 0,1",""],["Da tales doses numero 20","in1"],["Signa: внутрь, по 1 таблетке 2 раза в сутки","in1"]],"Пентоксифиллин":[["Recipe: Tabulettas Pentoxyfillini 0,1",""],["Da tales doses numero 60","in1"],["Signa: По 1 таб 3 р. в день, сразу после еды","in1"]],"Амантадин":[["Recipe: Tabulettas Amantadini 0,1",""],["Da tales doses numero 30","in1"],["Signa: По 1 таб 3 р. в день","in1"]],"Лабеталол":[["Recipe: Tabulettas Labetaloli 0,1",""],["Da tales doses numero 30","in1"],["Signa: По 1 таб 3 р. в день","in1"]],"Этимизол":[["Recipe: Tabulettas Aethymizoli 0,1",""],["Da tales doses numero 50","in1"],["Signa: по 2 таблетке 2-3 р/д","in1"]],"Умифеновир":[["Recipe: Tabulettas Umifenoviri 0,1",""],["Da tales doses numero 20","in1"],["Signa: По 1 таб 3 р. в день","in1"]],"Тетрациклин":[["Recipe: Tabulettas Tetracyclini 0,1",""],["Da tales doses numero 20","in1"],["Signa: По 1 таб 4 р. в день, после еды","in1"]],"Целекоксиб":[["Recipe: Tabulettas Celecoxibi 0,2",""],["Da tales doses numero 20","in1"],["Signa: Внутрь, по 1 таб 2 р. в день","in1"]],"Эналаприл":[["Recipe: Tabulettas Enalaprili 0,01",""],["Da tales doses numero 20","in1"],["Signa: По 1 таб 2 р. в день","in1"]],"Кодеина фосфат":[["Recipe: Tabulettas Codeini phosphatis 0,01",""],["Da tales doses numero 6","in1"],["Signa: По 1 таб 2-3 р. в день","in1"]],"Домперидон":[["Recipe: Tabulettas Domperidoni 0,01",""],["Da tales doses numero 30","in1"],["Signa: По 1 таб 3 р. в день, за 15-30 мин до еды","in1"]],"Метоклопрамид":[["Recipe: Tabulettas Metoclopramidi 0,01",""],["Da tales doses numero 50","in1"],["Signa: По 1 таб 3 р. в день, после еды","in1"]],"Нифедипин":[["Recipe: Tabulettas Nifedipini 0,01",""],["Da tales doses numero 50","in1"],["Signa: По 1 таб 3 р. в день, после еды","in1"]],"Рибофлавин":[["Recipe: Tabulettas Riboflavini 0,01",""],["Da tales doses numero 50","in1"],["Signa: По 1 таб 1 р. в день","in1"]],"Афобазол":[["Recipe: Tabulettas «Aphobazolum» 0,01",""],["Da tales doses numero 50","in1"],["Signa: По 1 таб 2 р. в день","in1"]],"Кларитин":[["Recipe: Tabulettas Claritini 0,01",""],["Da tales doses numero 10","in1"],["Signa: По 1 таб 1 р. в день","in1"]],"Бисопролол":[["Recipe: Tabulettas Bisoprololi 0,01",""],["Da tales doses numero 30","in1"],["Signa: По 1 таб 1 р. в день, утром натощак или во время завтрака","in1"]],"Розувастатин":[["Recipe: Tabulettas Rosuvastatini 0,01",""],["Da tales doses numero 30","in1"],["Signa: По 1 таб 1 р. в день","in1"]],"Кеторолак":[["Recipe: Tabulettas Ketorolaci 0,01",""],["Da tales doses numero 10","in1"],["Signa: По 1 таб 2 р. в день","in1"]],"Анаприлин":[["Recipe: Tabulettas Anaprilini 0,01",""],["Da tales doses numero 50","in1"],["Signa: По 1 таб 3-4 р. в день","in1"]],"Имудон":[["Recipe: Tabulettas «Imudon» 0,01",""],["Da tales doses numero 40","in1"],["Signa: рассасывать таблетку в полости рта с интервалом 1-2 часа по 8 таблеток в сутки","in1"]],"Торасемид":[["Recipe: Tabulettas Torasemidi 0,01",""],["Da tales doses numero 20","in1"],["Signa: по 1 таблетке 1р/д для лечения ХСН","in1"]],"Лизиноприл":[["Recipe: Tabulettas Lisinoprili 0,01",""],["Da tales doses numero 30","in1"],["Signa: Внутрь, по 1 таб 3 р. в день","in1"]],"Феназепам":[["Recipe: Tabulettas Phenazepami 0,001",""],["Da tales doses numero 50","in1"],["Signa: По 1 таб на ночь","in1"]],"Левамизол":[["Recipe: Tabulettas Levamisoli 0,15",""],["Da tales doses numero 3","in1"],["Signa: По 1 таб 1 р/д, повтор курс через 2 недели","in1"]],"Галоперидол":[["Recipe: Tabulettas Haloperidoli 0,0015",""],["Da tales doses numero 50","in1"],["Signa: По 1 таб 3р/д, через 30 мин после еды","in1"]],"Мексидол":[["Recipe: Tabulettas Mexidoli 0,125",""],["Da tales doses numero 30","in1"],["Signa: По 1 таб 3р/д","in1"]],"Карведилол":[["Recipe: Tabulettas Carvediloli 0,0125",""],["Da tales doses numero 50","in1"],["Signa: По 1 таб 2 р/д","in1"]],"Лозартан":[["Recipe: Tabulettas Losartani 0,0125",""],["Da tales doses numero 20","in1"],["Signa: По 1 таб 2 р/д","in1"]],"Дифенин":[["Recipe: Tabulettas Diphenini 0,117",""],["Da tales doses numero 20","in1"],["Signa: По 1 таб 2-3 р/д","in1"]],"Пирацетам":[["Recipe: Tabulettas Pyracetami 0,2",""],["Da tales doses numero 60","in1"],["Signa: По 2 таб 3-4 р/д","in1"]],"Рибоксин":[["Recipe: Tabulettas Riboxini 0,2",""],["Da tales doses numero 30","in1"],["Signa: По 1 таб 3 р/д","in1"]],"Актовегин":[["Recipe: Tabulettas Actovegini 0,2",""],["Da tales doses numero 50","in1"],["Signa: По 1 таб 3 р/д","in1"]],"Флуконазол":[["Recipe: Fluconazoli 0,2",""],["Da tales doses numero 20 in\xa0capsulis","in1"],["Signa: По 1 капс 1 р/д","in1"]],"Ибупрофен":[["Recipe: Tabulettas Ibuprofeni 0,2",""],["Da tales doses numero 30","in1"],["Signa: По 1 таб 3 р/д","in1"]],"Ацетилцистеин":[["Recipe: Tabulettas Acetylcysteini 0,2",""],["Da tales doses numero 50","in1"],["Signa: По 1 таб 3 р/д","in1"]],"Симвастатин":[["Recipe: Tabulettas Simvastatini 0,02",""],["Da tales doses numero 30","in1"],["Signa: По 1 таб 1 р/д","in1"]],"Триметазидин":[["Recipe: Tabulettas Trimetazidini 0,02",""],["Da tales doses numero 10","in1"],["Signa: По 1 таб 2 р/д","in1"]],"Фамотидин":[["Recipe: Tabulettas Famotidini 0,02",""],["Da tales doses numero 20","in1"],["Signa: По 1 таб 2 р/д","in1"]],"Сальбутамол":[["Recipe: Tabulettas Salbutamoli 0,002",""],["Da tales doses numero","in1"],["Signa: По 1 таб 1-2 р/д","in1"]],"Эритромицин":[["Recipe: Tabulettas Erythromycini 0,25",""],["Da tales doses numero 10","in1"],["Signa: По 2 таб 4 р/д","in1"]],"Ампициллин":[["Recipe: Tabulettas Ampicillini 0,25",""],["Da tales doses numero 20","in1"],["Signa: По 1 таб 3 р/д","in1"]],"Леводопа":[["Recipe: Tabulettas Levodopae 0,25",""],["Da tales doses numero 20","in1"],["Signa: Внутрь, при лечении паркинсонизма","in1"]],"Метронидазол":[["Recipe: Tabulettas Metronidazoli 0,25",""],["Da tales doses numero 20","in1"],["Signa: По 2 таб 2 р/д","in1"]],"Амитриптилин":[["Recipe: Tabulettas Amitriptylini 0,025",""],["Da tales doses numero 50","in1"],["Signa: По 1 таб 3 р/д","in1"]],"Пирензепин":[["Recipe: Tabulettas Pirenzepini 0,025",""],["Da tales doses numero 50","in1"],["Signa: По 1 таб 4 р/д","in1"]],"Спиронолактон":[["Recipe: Tabulettas Spironolactoni 0,025",""],["Da tales doses numero 20","in1"],["Signa: По 1 таб утром, независимо от приема пищи","in1"]],"Каптоприл":[["Recipe: Tabulettas Captoprili 0,025",""],["Da tales doses numero 20","in1"],["Signa: По 1 таб 2 р/д, за час до еды","in1"]],"Курантил":[["Recipe: Tabulettas Curantyli 0,025",""],["Da tales doses numero 120","in1"],["Signa: По 1 таб 3 р/д, натощак, запивая небольшим количеством воды.","in1"]],"Гидрохлоротиазид":[["Recipe: Tabulettas Hydrochlorothiazidi 0,025",""],["Da tales doses numero 20","in1"],["Signa: По 1 таб утром натощак","in1"]],"Метотрексат":[["Recipe: Tabulettas Methotrexati 0,0025",""],["Da tales doses numero 50","in1"],["Signa: По 1 таб 3 р с интервалом в 12 часов 1 раз в неделю","in1"]],"Варфарин":[["Recipe: Tabulettas Warfarini 0,0025",""],["Da tales doses numero 50","in1"],["Signa: Внутрь, 1 р в сутки, в одно и то же время, независимо от приема пищи","in1"]],"Дигоксин":[["Recipe: Tabulettas Digoxini 0,00025",""],["Da tales doses numero 50","in1"],["Signa: Внутрь, по ½ таб 2 р/д","in1"]],"Амброксол":[["Recipe: Tabulettas Ambroxoli 0,03",""],["Da tales doses numero 30","in1"],["Signa: По 1 таб 3 р/д","in1"]],"Мелатонин":[["Recipe: Tabulettas Melatonini 0,003",""],["Da tales doses numero 30","in1"],["Signa: По 1 таб в сутки, за 30 мин перед сном","in1"]],"Бисептол":[["Recipe: Tabulettas «Biseptol» 0,48",""],["Da tales doses numero 20","in1"],["Signa: По 2 таб 2 р/д","in1"]],"Немозол":[["Recipe: Tabulettas «Nemozol» 0,4",""],["Da tales doses numero 1","in1"],["Signa: однократно","in1"]],"Верапамил":[["Recipe: Tabulettas Verapamili 0,04",""],["Da tales doses numero 50","in1"],["Signa: По 1 таб 1 р/д, после еды","in1"]],"Дротаверин":[["Recipe: Tabulettas Drotaverini 0,04",""],["Da tales doses numero 30","in1"],["Signa: По 1 таб 3 р/д, независимо от приема пищи","in1"]],"Фуросемид":[["Recipe: Tabulettas Furosemidi 0,04",""],["Da tales doses numero 50","in1"],["Signa: Внутрь, по 1 таб натощак","in1"]],"Папаверин":[["Recipe: Tabulettas Papaverini hydrochloridi 0,04",""],["Da tales doses numero 10","in1"],["Signa: По 1 таб 3-4 р/д","in1"]],"Парацетамол":[["Recipe: Tabulettas Paracetamoli 0,5",""],["Da tales doses numero 10","in1"],["Signa: По 1 таб 4 р/д, при высокой температуре","in1"]],"Ацетилсалициловая кислота":[["Recipe: Tabulettas Acidi acetylsalicylici 0,5",""],["Da tales doses numero 10","in1"],["Signa: По 1 таб 3-4 р в сутки, после еды","in1"]],"Левомицетин":[["Recipe: Tabulettas Laevomycetini 0,5",""],["Da tales doses numero 20","in1"],["Signa: По 1 таб 4 р/д, за 30 мин до приема еды","in1"]],"Азитромицин":[["Recipe: Tabulettas Azithromycini 0,5",""],["Da tales doses numero 3","in1"],["Signa: По 1 таб 1 р/д, за час до еды","in1"]],"Уросульфан":[["Recipe: Tabulettas Urosulfani 0,5",""],["Da tales doses numero 12","in1"],["Signa: По 1 таб 4 р/д","in1"]],"Вальпроат натрия":[["Recipe: Tabulettas Natrii valproatis 0,5",""],["Da tales doses numero 100","in1"],["Signa: По 1 таб 2 р/д","in1"]],"Транексам":[["Recipe: Tabulettas «Tranexam» 0,5",""],["Da tales doses numero 30","in1"],["Signa: По 1 таб 2 р/д","in1"]],"Метамизол натрия (Анальгин)":[["Recipe: Tabulettas Metamizoli sodii 0,5",""],["Da tales doses numero 10","in1"],["Signa: По 1 таб 3 р/д","in1"]],"Левофлоксацин":[["Recipe: Tabulettas Levofloxacini 0,5",""],["Da tales doses numero 10","in1"],["Signa: По 1 таб 1 р/д","in1"]],"Амоксициллин":[["Recipe: Tabulettas Amoxicillini 0,5",""],["Da tales doses numero 20","in1"],["Signa: По 1 таб 3 р/д, до или после приема пищи","in1"]],"Метформин":[["Recipe: Tabulettas «Metformin» 0,5",""],["Da tales doses numero 60","in1"],["Signa: По 1 таб 2 р/д","in1"]],"Трамадол":[["Recipe: Tabulettas Tramadoli 0,05",""],["Da tales doses numero 20","in1"],["Signa: По 1 таб 2 р/д","in1"]],"Дифенгидрамин (Димедрол)":[["Recipe: Tabulettas Diphenhydramini 0,05",""],["Da tales doses numero 40","in1"],["Signa: По 1 таб 3 р/д","in1"]],"Фуразолидон":[["Recipe: Tabulettas Furazolidoni 0,05",""],["Da tales doses numero 10","in1"],["Signa: По 2 таб 4 р/д","in1"]],"Фурадонин (Нитрофурантоин)":[["Recipe: Tabulettas Furadonini 0,05",""],["Da tales doses numero 30","in1"],["Signa: По 1 таб 3 р/д, после еды","in1"]],"Аскорбиновая кислота":[["Recipe: Tabulettas Acidi ascorbinici 0,05",""],["Da tales doses numero 50","in1"],["Signa: По 2 таб 3 р/д","in1"]],"Мукалтин":[["Recipe: Tabulettas Mucaltini 0,05",""],["Da tales doses numero 20","in1"],["Signa: По 1-2 таб 3 р/д","in1"]],"Мерказолил":[["Recipe: Tabulettas «Mercazolil» 0,005",""],["Da tales doses numero 10","in1"],["Signa: По 1 таб 3 р/д, после еды","in1"]],"Винпоцетин (Кавинтон)":[["Recipe: Tabulettas Vinpocetini 0,005",""],["Da tales doses numero 50","in1"],["Signa: По 1 таб 3 р/д","in1"]],"Дезлоратадин":[["Recipe: Tabulettas Desloratadini 0,005",""],["Da tales doses numero 10","in1"],["Signa: По 1 таб 1 р/д","in1"]],"Бисакодил":[["Recipe: Tabulettas Bisacodyli 0,005",""],["Da tales doses numero 30","in1"],["Signa: Внутрь, вечером перед сном, взрослым в начальной дозе 5 мг, при отсутствии эффекта 10-15 мг.","in1"]],"Преднизолон":[["Recipe: Tabulettas Prednisoloni 0,005",""],["Da tales doses numero 30","in1"],["Signa: Внутрь, 3 таб в 7 часов, 2 таб в 11 часов, 1 табл в 13 ч, независимо от приема пищи","in1"]],"Амлодипин":[["Recipe: Tabulettas Amlodipini 0,005",""],["Da tales doses numero 30","in1"],["Signa: По 1 таб 1 р/д","in1"]],"Дексаметазон":[["Recipe: Tabulettas Dexamethasoni 0,0005",""],["Da tales doses numero 30","in1"],["Signa: По 1 таб 1 р/д, во время или после еды","in1"]],"Нитроглицерин":[["Recipe: Tabulettas Nitroglycerini 0,0005",""],["Da tales doses numero 20","in1"],["Signa: Сублингвально, по 1 таб, независимо от приема пищи","in1"]],"Валидол":[["Recipe: Tabulettas Validoli 0,06",""],["Da tales doses numero 10","in1"],["Signa: По 1 таб 2-3 р/д, держать под языком до полного рассасывания","in1"]],"Бромгексин":[["Recipe: Tabulettas Bromhexini 0,008",""],["Da tales doses numero 20","in1"],["Signa: Внутрь, по 1 таб 4 р/д","in1"]],"Нистатин":[["Recipe: Tabulettas Nystatini 500 000 ED",""],["Da tales doses numero 20","in1"],["Signa: Внутрь, по 1 таб 3 р/д","in1"]],"Цианокобаламин":[["Recipe: Solutionis Cyanocobalamini 0,02% — 1 ml",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: в/м 1 р/д","in1"]],"Налоксон":[["Recipe: Solutionis Naloxoni hydrochloridi 0,4% — 1 ml",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: По 1 мл в/в 1 р/д","in1"]],"Прозерин":[["Recipe: Solutionis Proserini 0,05% — 1 ml",""],["Da tales doses numero 6 in ampullis","in1"],["Signa: п/к по 1 мл 1-2 р/д","in1"]],"Коргликон":[["Recipe: Solutionis Corglyconi 0,06% — 1 ml",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: Вводить в/в по 1 мл в 20 мл 20% глюкозы","in1"]],"Атропина сульфат":[["Recipe: Solutionis Atropini sulfatis 0,1% — 1 ml",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: в/м и в/в для устранения брадикардии, премедикация, при отравлениях м-холиномиметиками и антихолинэстеразными","in1"]],"Адреналина гидрохлорид":[["Recipe: Solutionis Adrenalini hydrochloridi 0,1% — 1 ml",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: по 1 мл подкожно, 1 р/д","in1"]],"Платифиллина гидротартрат":[["Recipe: Solutionis Platyphyllini hydrotartratis 0,2% — 1 ml",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: Подкожно, по 1 мл 2 р/д","in1"]],"Прогестерон":[["Recipe: Solutionis Progesteroni 0,5% — 1 ml",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: По 1 мл в/м","in1"]],"Морфина гидрохлорид":[["Recipe: Solutionis Morphini hydrochloridi 1% — 1 ml",""],["Da tales doses numero 1 in ampullis","in1"],["Signa: Вводить подкожно, по 1 мл","in1"]],"Мезатон":[["Recipe: Solutionis Mesatoni 1% — 1 ml",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: под кожу или в/м 0,3-1 мл","in1"]],"Викасол":[["Recipe: Solutionis Vicasoli 1% — 1 ml",""],["Da tales doses numero 4 in ampullis","in1"],["Signa: в/м по 1 мл в течение 4 дней","in1"]],"Никотиновая кислота":[["Recipe: Solutionis Acidi nicotinici 1% — 1 ml",""],["Da tales doses numero 20 in ampullis","in1"],["Signa: вводить в/м по 1 мл 1 р/д","in1"]],"Промедол":[["Recipe: Solutionis Promedoli 2% — 1 ml",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: Вводить в/м по 1 мл, при болевом синдроме","in1"]],"Супрастин":[["Recipe: Solutionis Suprastini 2% — 1 ml",""],["Da tales doses numero 5 in ampullis","in1"],["Signa: в/м по 1 мл","in1"]],"Тиамина бромид":[["Recipe: Solutionis Thiamini bromidi 3% — 1 ml",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: По 1 мл, в/м глубоко","in1"]],"Пентамин":[["Recipe: Solutionis Pentamini 5% — 1 ml",""],["Da tales doses numero 5 in ampullis","in1"],["Signa: в/м 1 мл 2 р/д","in1"]],"Ретаболил":[["Recipe: Solutionis Retabolili 5% — 1 ml",""],["Da tales doses numero 1 in ampullis","in1"],["Signa: в/м, по 1 мл 1 р/3 нед","in1"]],"Кофеин бензоат натрия":[["Recipe: Solutionis Coffeini natrii benzoatis 10% — 1 ml",""],["Da tales doses numero 6 in ampullis","in1"],["Signa: По 1 мл 2 р/д, подкожно","in1"]],"Эноксапарин натрия (Клексан)":[["Recipe: Solutionis Enoxaparini natrii 10% — 1 ml",""],["Da tales doses numero 1 in ampullis","in1"],["Signa: Подкожно в переднелатеральную область брюшной стенки 4 р/д","in1"]],"Окситоцин":[["Recipe: Solutionis Oxytocini 1 ml (5 ED)",""],["Da tales doses numero 1 in ampullis","in1"],["Signa: в/в по 1 мл, разведенный в 500 мл 5% р-ра глюкозы","in1"]],"Мелоксикам":[["Recipe: Solutionis Meloxicami 1% — 1,5 ml",""],["Da tales doses numero 3 in ampullis","in1"],["Signa: в/м по 1,5 мл 1 р/д","in1"]],"Диазепам":[["Recipe: Solutionis Diazepami 0,5% — 2 ml",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: По 1 мл 1р/д, в/м","in1"]],"Аминазин":[["Recipe: Solutionis Aminazini 2,5% — 2 ml",""],["Da tales doses numero 6 in ampullis","in1"],["Signa: в/в по 1-2 мл, предварительно развести в 20 мл 5% р-ра глюкозы для купирования психомоторного возбуждения","in1"]],"Гентамицин":[["Recipe: Solutionis Gentamycini sulfatis 4% — 2 ml",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: в/м по 2 мл 2 р/д","in1"]],"Лидокаин":[["Recipe: Solutionis Lidocaini hydrochloridi 10% — 2 ml",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: для инфильтрационной анестезии","in1"]],"Камфора":[["Recipe: Camphorae oleosae 20% — 2 ml",""],["Da tales doses numero 6 in ampullis","in1"],["Signa: По 2 мл подкожно","in1"]],"Кордиамин":[["Recipe: Solutionis Cordiamini 25% — 2 ml",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: в/м, 2 р/д","in1"]],"Диклофенак":[["Recipe: Solutionis Diclofenaci 2,5% — 3 ml",""],["Da tales doses numero 5 in ampullis","in1"],["Signa: в/м по 3 мл в день","in1"]],"Амиодарон":[["Recipe: Solutionis Amiodaroni 5% — 3 ml",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: По 3 мл в/в, медленно, на 20 мл физ р-ре, однократно","in1"]],"Ново-рапид":[["Recipe: Solutionis «Novorapid» 100 ED/ml — 3 ml",""],["Da. Signa: п/к, по 1 мл 1 р/д, перед приемом пищи","in1"]],"Новокаин":[["Recipe: Solutionis Novocaini 0,5% — 5 ml",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: для инфильтративной анестезии 0,5% р-р","in1"]],"Дибазол":[["Recipe: Solutionis Dibasoli 1% — 5 ml",""],["Da tales doses numero 5 in ampullis","in1"],["Signa: в/м по 5 мл 2 р/д","in1"]],"Изониазид":[["Recipe: Solutionis Isoniazidi 10% — 5 ml",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: в/м по 5 мл 1 р/д","in1"]],"Баралгин":[["Recipe: Solutionis Baralgini 50% — 5 ml",""],["Da tales doses numero 5 in ampullis","in1"],["Signa: при выраженном болевом синдроме и лихорадке в/в или в/м","in1"]],"Гепарин":[["Recipe: Solutionis Heparini 5 ml",""],["Da tales doses numero 5 in ampullis","in1"],["Signa: п/к по 1 мл в переднелатеральн обл брюшн стенки 4 р/д","in1"]],"Нафазолин":[["Recipe: Solutionis Naphazolini 0,1% — 10 ml",""],["Da. Signa: Интраназально, по 1-2 капли 3 р/д","in1"]],"Ксилометазолин":[["Recipe: Solutionis Xylometazolini 0,1% — 10 ml",""],["Da. Signa: По 2-3 капли в кажд половину носа 2 р/д 5-7 дней","in1"]],"Левосимендан":[["Recipe: Solutionis Levosimendani 0,25% — 10 ml",""],["Da tales doses numero 1 in ampullis","in1"],["Signa: в/в","in1"]],"Бемегрид":[["Recipe: Solutionis Bemegridi 0,5% — 10 ml",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: По 10 мл в/в","in1"]],"Пилокарпина гидрохлорид":[["Recipe: Solutionis Pilocarpini hydrochloridi 1% — 10 ml",""],["Da. Signa: Закапывать в конъюнктивальный мешок по 1 капл 3р/д","in1"]],"Эуфиллин":[["Recipe: Solutionis Euphyllini 2,4% — 10 ml",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: в/в при приступах бронхиальной астмы","in1"]],"Ретинола ацетат":[["Recipe: Solutionis Retinoli acetatis oleosae 3,44% — 10 ml",""],["Da. Signa: по 2-3 капли 4 р/д","in1"]],"Натрия оксибутират":[["Recipe: Solutionis Natrii oxybutyratis 20% — 10 ml",""],["Da tales doses numero 5 in ampullis","in1"],["Signa: По 10 мл в/м однократно","in1"]],"Сульфацил натрия (Альбуцид)":[["Recipe: Solutionis Sulfacyli natrii 20% — 10 ml",""],["Da. Signa: По 2 капли 4 р/д","in1"]],"Лантус":[["Recipe: Solutionis Lantusi 100 ED/ml — 10 ml",""],["Da tales doses numero 5 in ampullis","in1"],["Signa: п/к доза назначается эндокринологом","in1"]],"Добутамин":[["Recipe: Solutionis Dobutamini 1,25% — 20 ml",""],["Da tales doses numero 1","in1"],["Signa: в/в капельно в теч 2 ч, развести в 10 мл растворителя","in1"]],"Аминокапроновая кислота":[["Recipe: Solutionis Acidi aminocapronici 5% — 100 ml",""],["Da. Signa: в/в капельно по 100мл","in1"]],"Калия йодид":[["Recipe: Solutionis Kalii iodidi 3% — 200 ml",""],["Da. Signa: По 1 столовой ложке 3-5 р/д (запивают теплой водой)","in1"]],"Глюкоза":[["Recipe: Solutionis Glucosae 5% — 400 ml",""],["Da. Signa: в/в капельно, медленно 1-2 р/д","in1"]],"Лидаза":[["Recipe: Solutionis Lydazi 1280 ME",""],["Da tales doses numero 10 in ampullis","in1"],["Signa: п/к 1 р/д","in1"]],"Кокарбоксилаза":[["Recipe: Solutionis Cocarboxylazi 0,05",""],["Da tales doses numero 5 in ampullis","in1"],["Signa: в/в струйно развести в 5 мл воды для инъекций","in1"]],"Реополиглюкин":[["Recipe: Solutionis Rheopolyglucini 10% — 200 ml",""],["Da tales doses numero 1","in1"],["Signa: Содержимое флакона вводить в/в капельно","in1"]],"Полиоксидоний":[["Recipe: Polyoxidonii 0,006",""],["Da tales doses numero 5","in1"],["Signa: в/в в течение дней предварительно развести в 2 мл флакона в воде для инъекций","in1"]],"Цефтриаксон":[["Recipe: Ceftriaxoni 1,0",""],["Da tales doses numero 10","in1"],["Signa: Содержимое флакона растворить в 10 мл стерильной воды для инъекции, вводить в/в струйно медленно в течении 2-4 мин 1 р/д","in1"]],"Тиопентал натрия":[["Recipe: Thiopentali natrii 1,0",""],["Da tales doses numero 5","in1"],["Signa: Содержимое флакона растворить в физ р-ре до получения 2,5% р-ра. Вводить в/в, для введения в общ анастезию","in1"]],"Лонгидаза":[["Recipe: Longidazae 1500 ED",""],["Da tales doses numero 5","in1"],["Signa: Содержимое флакона растворить в 2 мл физ р-ра, в/м, 1 р в 3 дня","in1"]],"Бензилпенициллина натриевая соль":[["Recipe: Benzylpenicillini-natrii 500 000 ED",""],["Da tales doses numero 12","in1"],["Signa: Содержимое флакона вводить в/м 4 р/д. Предварительно развести его в 2 мл физ р-ра","in1"]],"Пироксикам":[["Recipe: Piroxicami 0,02",""],["Da tales doses numero 20 in capsulis","in1"],["Signa: Принимать внутрь по 1 капс 1 р/д","in1"]],"Ирунин":[["Recipe: Irunini 0,1",""],["Da tales doses numero 14 in capsulis","in1"],["Signa: По 1 капс 1 р/д","in1"]],"Рифампицин":[["Recipe: Rifampicini 0,15",""],["Da tales doses numero 30 in capsulis","in1"],["Signa: Внутрь, по 1 капс 3 р/д за 30-60 мин до еды","in1"]],"Этосуксимид":[["Recipe: Aethosuximidi 0,25",""],["Da tales doses numero 100 in capsulis","in1"],["Signa: Внутрь, по 1 капс 3 р/д во время еды","in1"]],"Тамсулозин":[["Recipe: Tamsulosini 0,0004",""],["Da tales doses numero 10 in capsulis","in1"],["Signa: По 1 капс 1 р/д","in1"]],"Виферон":[["Recipe: Suppositoria «Viferon» 500 000 ME",""],["Da tales doses numero 10","in1"],["Signa: по 1 свече ректально 2р/д","in1"]],"Ипратропия бромид":[["Recipe: Aerosolum Ipratropii bromidi 15,0",""],["Da. Signa: по 2 вдоха 4р/д при ХОБЛ, бронхиальной астме и бронхоспазме","in1"]],"Беклометазон":[["Recipe: Aerosolum Beclomethasoni dipropionatis",""],["Da. Signa: по 2 ингаляции 2 р/д","in1"]],"Бутамират (Синекод)":[["Recipe: Sirupi Butamirati 0,15% — 100 ml",""],["Da. Signa: Внутрь, по 15 мл (3 чайные или дозировочные ложки) 3 р/д, перед едой","in1"]],"Валериана":[["Recipe: Tincturae Valerianae 25 ml",""],["Da. Signa: по 25 капель на прием 3-4 р/д","in1"]],"Метопролол":[["Recipe: Tabulettas Metoprololi 0,1",""],["Da tales doses numero 30","in1"],["Signa: По 1 таб. 2 раза в день","in1"]],"Атенолол":[["Recipe: Tabulettas Atenololi 0,025",""],["Da tales doses numero 30","in1"],["Signa: По 1 таб. 2 р/д","in1"]],"Изосорбида динитрат":[["Recipe: Tabulettas Isosorbidi dinitratis 0,01",""],["Da tales doses numero 20","in1"],["Signa: По 1 таб. 3 р/д","in1"]],"Ко-тримоксазол":[["Recipe: Tabulettas Co-trimoxazoli 0,48",""],["Da tales doses numero 20","in1"],["Signa: По 2 таблетки 2 раза в день. При остром бронхите бактериальной природы","in1"]]};
Object.assign(RX_DATA, {"Гидроксизин (Атарах)": [["Recipe: Tabulettas Hydroxyzini 0,025 № 25", ""], ["Da. Signa: По 1 таблетке 2 раза в день.", "in1"]], "Тофизопам (Грандаксин)": [["Recipe: Tabulettas Tofisopami 0,05 № 20", ""], ["Da. Signa: По 1 таблетке 2 раза в день.", "in1"]], "Фенобарбитал": [["Recipe: Phenobarbitali 0,1", ""], ["Da tales doses numero 10 in tabulettis", "in1"], ["Signa: По 1 таблетке на ночь.", "in1"]], "Золпидем": [["Recipe: Tabulettas Zolpidemi 0,01 № 10", ""], ["Da. Signa: По 1 таблетке непосредственно перед сном.", "in1"]], "Фентоламин": [["Recipe: Solutionis Phentolamini 0,5% — 1 ml", ""], ["Da tales doses numero 10 in ampullis", "in1"], ["Signa: Для инъекций.", "in1"]], "Норадреналин": [["Recipe: Solutionis Noradrenalini hydrotartratis 0,2% — 1 ml", ""], ["Da tales doses numero 10 in ampullis", "in1"], ["Signa: Для внутривенного капельного введения после разведения.", "in1"]], "Пустырник": [["Recipe: Tincturae Leonuri 25 ml", ""], ["Da. Signa: По 30 капель 3 раза в день.", "in1"]], "Активированный уголь": [["Recipe: Tabulettas Carbonis activati 0,25 № 10", ""], ["Da. Signa: По 1 таблетке 3 раза в день.", "in1"]]});
Object.setPrototypeOf(RX_DATA, null);
RX_DATA["Сальбутамол"][1][0] += " " + GAP;   // в файле число доз не указано

/* =========================================================
   РЕЖИМЫ И СОХРАНЕНИЕ ПРОГРЕССА
   Ключи и формат «Теста» и «Впиши сам» прежние — сохранённый прогресс подхватывается.
   Блоки стали едиными, поэтому их прогресс хранится под ключами v2.
   ========================================================= */
for(const m of MY_ACTIVE) RX_DATA[m.d[0]] = myrxLines(m.r, true);   // бланк из рецепта пользователя
const KEYS = {
  quiz:'pharma_quiz_progress_v1',
  write:'pharma_write_progress_v1',
  study:'pharma_study_progress_v2',
  writeBlock:'pharma_writeblock_progress_v2',
  groupCards:'pharma_cards_progress_v2',
  semQuiz:'pharma_sem_progress_v1',
  semWrite:'pharma_sem_write_v1',
  mistakesQuiz:'pharma_mistakes_quiz_v1',
  mistakesWrite:'pharma_mistakes_write_v1',
  mistakes:'pharma_mistakes_v1',
  grpQuiz:'pharma_grp_quiz_v1',
  grpWrite:'pharma_grp_write_v1',
  view:'pharma_quiz_view_v1'
};
const OLD_BLOCK_KEYS = ['pharma_study_progress_v1','pharma_writeblock_progress_v1','pharma_cards_progress_v1'];

// Сессии с вопросами. kind: «choice» — выбор из трёх вариантов, «write» — свободный ввод.
// block — по одному тематическому блоку; dynamic — по текущему списку ошибок.
const SESSION = {
  quiz:          {kind:'choice', title:'Экзамен'},   // карточка «Экзамен» = полный тест
  write:         {kind:'write',  title:'Впиши сам'},
  study:         {kind:'choice', block:true},
  writeBlock:    {kind:'write',  block:true},
  mistakesQuiz:  {kind:'choice', dynamic:true, title:'Повторение'},
  mistakesWrite: {kind:'write',  dynamic:true, title:'Повторение'},
  grpQuiz:       {kind:'choice', block:true, grp:true, title:'Папка'},
  grpWrite:      {kind:'write',  block:true, grp:true, title:'Папка'},
  semQuiz:       {kind:'choice', sem:true},
  semWrite:      {kind:'write',  sem:true}
};
const MISTAKE_MODES = ['mistakesQuiz', 'mistakesWrite'];
// Списки блоков и экран, который открывается из каждого
const LISTS = {
  studyList:      {target:'study',      title:'Тест по блокам',      desc:'Те же вопросы, что в тесте, но по одному тематическому блоку. Внутри блока препараты не повторяются.'},
  writeBlockList: {target:'writeBlock', title:'Впиши сам по блокам', desc:'Видно только русское название — латынь, концентрацию и группу вписываете сами, а карточка переворачивается и показывает рецепт. Внутри блока препараты не повторяются.'},
  groupList:      {target:'groupCards', title:'Карточки',            desc:'Вся информация о препарате на одной карточке — для повторения, без вопросов.'}
};
// Куда ведёт «Назад»; всё, чего здесь нет, возвращает в меню
const PARENT = {study:'studyList', writeBlock:'writeBlockList', groupCards:'groupList', mistakesQuiz:'mistakes', mistakesWrite:'mistakes',
  semQuiz:'semMenu', semWrite:'semMenu', tests:'menu', semMenu:'tests', exam:'tests',
  quiz:'examQuiz', write:'examWrite', studyList:'examQuiz', writeBlockList:'examWrite', examQuiz:'exam', examWrite:'exam',
  myrx:'menu', myrxEdit:'myrx', myGroup:'menu', grpQuiz:'myGroup', grpWrite:'myGroup'};
// Куда ведёт «назад» с карточек: из тем — в темы, из семестра — в семестр
let cardsBack = 'menu';
let grpBack = 'menu';   // откуда открыта папка: из меню или из «Мои рецепты»
let myrxEditBack = 'myrx';   // откуда открыт редактор рецепта: из «Мои рецепты» или из папки (тогда папка уже отмечена)
// Экраны прежних версий: отдельные «Все экз. рецепты» / «По семестрам» / «По темам» (с вкладками сверху) и список блоков карточек.
// Из меню в них больше не попасть, поэтому восстановление и перерисовка уводят оттуда на главный экран.
const ORPHAN_MODES = new Set(['allRx','semesters','semester','topics']);
const parentOf = m => m==='groupCards' ? cardsBack : m==='myGroup' ? grpBack : m==='myrxEdit' ? myrxEditBack : (PARENT[m] || 'menu');
// Глубина экрана в истории браузера: каждый шаг вглубь — одна запись
function depthOf(m){ let d = 0; const seen = {}; while(m && m!=='menu' && !seen[m]){ seen[m] = 1; m = parentOf(m); d++; } return d; }

/* --- Состояние одного вопроса --- */
const CATS = ['dose', 'route', 'group'];
const rightOf = d => ({dose:d[1], route:d[2], group:d[3]});
function optsFor(cat, d){
  return cat==='dose' ? pick3Dose(d[1], d[2]) : cat==='route' ? pick3Route(d[2], allRoutes) : pickGroup(d[3], grpExtra(d));
}
// Написания, исправленные в данных: в сохранённых вариантах ответов старые строки заменяются новыми
// (две последние — возврат дозировок, которые ненадолго убирались)
const RENAMED = new Map([
  ['назально', 'интраназально'],
  ['0,5; 0,025 капс.; 0,5 таб.', '0,5; 0,25 капс.; 0,5 таб.'],
  ['1 мл; 25% 2 мл', '25% 1 мл; 25% 2 мл'],
  ['3,4% 10 мл', '3,44% 10 мл'],
  ['0,04% 1 мл', '0,04% 1 мл; 0,4% 1 мл'],
  ['100 ЕД/мл 3 мл', '100 МЕ/мл 5 мл; 100 ЕД/мл 3 мл'],
  ['0,00002 г/доза, аэрозоль 15 мл', '0,00002 г/доза, аэрозоль 15 мл; 0,25% 20 мл']
]);
// То же для отдельных препаратов: группа сменилась только у них, а не во всей базе
const RENAMED_FOR = {
  'Левосимендан': {group: new Map([['Сердечные гликозиды', 'Негликозидные кардиотоники']])}
};
// Сохранённые варианты приводятся к текущим данным: правильный ответ всегда среди трёх разных вариантов
function fixChoice(st, d){
  const right = rightOf(d);
  const renamed = (c, x) => RENAMED_FOR[d[0]]?.[c]?.get(x) ?? RENAMED.get(x) ?? x;
  for(const c of CATS) if(st.sel[c]!==null) st.sel[c] = renamed(c, st.sel[c]);
  if(st.opts){
    for(const c of CATS){
      let o = st.opts[c].map(x => renamed(c, x));
      if(o.length!==3 || new Set(o).size!==3 || !o.includes(right[c]) || (c==='group' && grpExtra(d).some(x => o.includes(x)))){
        const keep = [right[c]];
        if(st.checked && st.sel[c]!==null && st.sel[c]!==right[c]) keep.push(st.sel[c]);
        o = shuffle(keep.concat(optsFor(c, d).filter(x => !keep.includes(x))).slice(0, 3));
      }
      if(!st.checked && st.sel[c]!==null && !o.includes(st.sel[c])) st.sel[c] = null;
      st.opts[c] = o;
    }
  }
  if(st.checked) st.correct = CATS.every(c => st.sel[c]===right[c]);
  return st;
}
const strOrNull = v => typeof v==='string' ? v : null;
function isOpts(o){ return !!o && CATS.every(k => Array.isArray(o[k]) && o[k].length > 0 && o[k].every(x => typeof x==='string')); }

const KIND = {
  choice: {
    blank: () => ({opts:null, sel:{dose:null, route:null, group:null}, checked:false, correct:false}),
    restore: (st, d) => fixChoice({
      opts: isOpts(st && st.opts) ? {dose:[...st.opts.dose], route:[...st.opts.route], group:[...st.opts.group]} : null,
      sel: {dose: strOrNull(st?.sel?.dose), route: strOrNull(st?.sel?.route), group: strOrNull(st?.sel?.group)},
      checked: !!st?.checked,
      correct: !!st?.correct
    }, d),
    touched: st => st.checked || st.sel.dose!==null || st.sel.route!==null || st.sel.group!==null,
    ready: st => st.sel.dose!==null && st.sel.route!==null && st.sel.group!==null
  },
  write: {
    blank: () => ({v:3, typed:{latin:'', dose:'', group:''}, checked:false, correct:false, latinOk:false, latinTypo:false, doseOk:false, groupOk:false}),
    restore: (st, d) => reevalWrite({
      v: st?.v===3 ? 3 : 1,                       // 1 — прежние форматы: их вердикт не пересчитывается
      typed: {latin: String(st?.typed?.latin ?? ''), dose: String(st?.typed?.dose ?? ''), group: String(st?.typed?.group ?? '')},
      checked: !!st?.checked,
      correct: !!st?.correct,
      latinOk: !!st?.latinOk,
      latinTypo: !!st?.latinTypo,
      doseOk: !!st?.doseOk,
      groupOk: !!st?.groupOk
    }, d),
    touched: st => st.checked || !!st.typed.latin || !!st.typed.dose || !!st.typed.group,
    ready: st => !!(st.typed.latin.trim() && st.typed.dose.trim() && st.typed.group.trim())
  }
};
const kindOf = S => KIND[SESSION[S.mode].kind];
const readAll = key => objOf(store.get(key));
function itemsOf(mode, block){
  const cfg = SESSION[mode];
  if(cfg.grp) return myGrpPool(block);
  if(cfg.block) return BLOCKS[block].items;
  if(cfg.dynamic) return mistakeItems();
  if(cfg.sem) return semItems();
  return EXAM_ITEMS;
}
// Препараты текущего семестра — для «Зимнего» и «Летнего» зачётов
function semItems(){
  const sem = SEMESTERS[semIdx] || SEMESTERS[0];
  // зачёт — препараты его блоков (без своих) плюс свои рецепты, отмеченные для этого семестра
  const set = new Set(sem.names
    ? DB.filter(d => !MY_SET.has(d) && sem.names.includes(d[0]))
    : sem.blocks.flatMap(bi => BLOCKS[bi].items.filter(d => !MY_SET.has(d))));
  for(const m of MY_ACTIVE) if(m.tests.has('s' + semIdx)) set.add(m.d);
  return [...set];
}

// Зачёты по семестрам: в одном ключе лежит {номер семестра: прогресс}; старый формат (один семестр) переносится
function semRead(m){
  const raw = objOf(store.get(KEYS[m]));
  if(Array.isArray(raw.order) && Number.isInteger(raw.sem)) return {[raw.sem]: raw};
  return raw;
}
function semDropMode(m, i){
  const all = semRead(m); delete all[i];
  if(Object.keys(all).length) store.set(KEYS[m], all); else store.del(KEYS[m]);
}
function semDrop(i){
  for(const m of ['semQuiz','semWrite']) semDropMode(m, i);
}
function loadSession(mode, block){
  const cfg = SESSION[mode];
  const sv = objOf(cfg.sem ? semRead(mode)[semIdx] : cfg.block ? readAll(KEYS[mode])[block] : store.get(KEYS[mode]));
  const n = Array.isArray(sv.order) ? sv.order.length : 0;
  if(!n || !Array.isArray(sv.state) || sv.state.length!==n) return null;
  if(!sv.order.every(x => typeof x==='string' && DB_BY_NAME.has(x))) return null;
  const order = sv.order.map(x => DB_BY_NAME.get(x));
  if(new Set(order).size!==n) return null;
  if(!cfg.dynamic){
    const items = itemsOf(mode, block);
    if(n!==items.length) return null;
    const allowed = new Set(items);
    if(order.some(d => !allowed.has(d))) return null;
  }
  const clamp = v => Number.isInteger(v) ? Math.min(Math.max(v, 0), n) : 0;
  const K = KIND[cfg.kind];
  return {mode, block, sem: cfg.sem ? semIdx : undefined, order, pos: clamp(cfg.block ? sv.pos : sv.idx), furthest: clamp(sv.furthest),
          state: sv.state.map((st,i) => K.restore(st, order[i]))};
}
function newSession(mode, block){
  const cfg = SESSION[mode];
  const order = shuffle(itemsOf(mode, block));
  return {mode, block, sem: cfg.sem ? semIdx : undefined, order, pos:0, furthest:0,
          state: order.map(() => KIND[cfg.kind].blank())};
}
let saveTimer = 0, pendingSave = null;
function saveSession(S){
  clearTimeout(saveTimer); pendingSave = null;
  const order = S.order.map(d => d[0]);
  if(SESSION[S.mode].sem){                       // зачёт по семестру: ключ + номер семестра
    const all = semRead(S.mode);
    all[S.sem] = {order, idx:S.pos, furthest:S.furthest, state:S.state};
    store.set(KEYS[S.mode], all);
    return;
  }
  if(SESSION[S.mode].block){
    const all = readAll(KEYS[S.mode]);
    all[S.block] = {order, pos:S.pos, furthest:S.furthest, state:S.state};
    store.set(KEYS[S.mode], all);
  } else {
    store.set(KEYS[S.mode], {order, idx:S.pos, furthest:S.furthest, state:S.state});
  }
}
// Ввод текста сохраняется с небольшой задержкой, а не на каждую букву
function saveSoon(S){ pendingSave = S; clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 400); }
function dropPending(){ clearTimeout(saveTimer); pendingSave = null; }   // сброс: отложенная запись старого прогресса не нужна
function flushSave(){ if(pendingSave) saveSession(pendingSave); }
addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => { if(document.visibilityState==='hidden') flushSave(); });

function clearSaved(mode, block){
  const all = readAll(KEYS[mode]);
  delete all[block];
  store.set(KEYS[mode], all);
}
function progressOf(S){
  if(!S) return null;
  const n = S.order.length;
  if(S.pos >= n) return {done:true};
  if(S.pos===0 && S.furthest===0 && !kindOf(S).touched(S.state[0])) return null;
  return {};   // начат, но не закончен
}
function totals(S){
  let c=0, w=0; const wrong=[];
  for(let i=0;i<S.furthest;i++){
    const st = S.state[i];
    if(!st.checked) continue;
    if(st.correct) c++; else { w++; wrong.push(S.order[i]); }
  }
  return {c, w, wrong};
}

/* =========================================================
   СПИСОК ОШИБОК: препараты, на которых ошиблись в последний раз.
   Неверный ответ в любом режиме добавляет препарат, верный — убирает.
   Хранится как {индекс препарата: {n: сколько раз ошиблись, t: когда в последний раз}}.
   ========================================================= */
let mistakes = {};
const mistakeCount = () => Object.keys(mistakes).length;
function saveMistakes(){ store.set(KEYS.mistakes, mistakes); }
function mistakeItems(){
  return Object.keys(mistakes)
    .sort((a,b) => (mistakes[b].t - mistakes[a].t) || a.localeCompare(b, 'ru'))
    .map(name => DB_BY_NAME.get(name));
}
function dropMistakeSessions(){ for(const m of MISTAKE_MODES){ store.del(KEYS[m]); delete sess[m]; } }
function noteAnswer(d, ok){
  const i = d[0];
  if(ok){
    if(!(i in mistakes)) return;
    delete mistakes[i];
    // список опустел — незаконченный круг повторения больше не нужен
    if(!mistakeCount() && !SESSION[mode]?.dynamic) dropMistakeSessions();
  } else {
    mistakes[i] = {n: (mistakes[i]?.n || 0) + 1, t: Date.now()};
  }
  saveMistakes();
}
function initMistakes(){
  const v = store.get(KEYS.mistakes);
  if(v && typeof v==='object' && !Array.isArray(v)){
    for(const [k, m] of Object.entries(v)){
      if(DB_BY_NAME.has(k)){   // препарата больше нет в базе (например, удалён свой рецепт) — запись отбрасывается
        mistakes[k] = {n: Number.isInteger(m?.n) && m.n>0 ? m.n : 1, t: Number.isFinite(m?.t) ? m.t : 0};
      }
    }
    return;
  }
  // Первый запуск со списком ошибок: переносим ошибки из уже сохранённого прогресса
  const found = [sess.quiz, sess.write];
  for(const m of ['study', 'writeBlock']) BLOCKS.forEach((_,i) => { const S = loadSession(m, i); if(S) found.push(S); });
  for(const S of found) S.state.forEach((st,i) => {
    if(st.checked && !st.correct){
      const k = S.order[i][0];
      mistakes[k] = {n: (mistakes[k]?.n || 0) + 1, t: 0};
    }
  });
  saveMistakes();
}

/* Формат хранения: препараты записываются по названию (раньше — по номеру в базе, который сдвигался при правках базы
   и удалении своих рецептов). Прогресс и список ошибок старого формата сбрасываются один раз. */
(function(){
  const FMT_KEY = 'pharma_store_fmt';
  if(store.get(FMT_KEY) === 2) return;
  for(const k of ['quiz','write','study','writeBlock','semQuiz','semWrite','mistakesQuiz','mistakesWrite','mistakes','grpQuiz','grpWrite']) store.del(KEYS[k]);
  store.set(FMT_KEY, 2);
})();

/* ========================= Состояние ========================= */
const sess = {quiz: loadSession('quiz') || newSession('quiz'), write: loadSession('write') || newSession('write')};
initMistakes();
let blockSess = null;                                  // открытый блок «Теста» или «Впиши сам»
let semSess = null;                                     // открытый зачёт по семестру (Зимний / Летний)
const lastBlock = {study:0, writeBlock:0, groupCards:0};
const cards = {block:0, pos:0};
let mode = 'menu';
let checkedAt = 0;                                     // защита от двойного нажатия «Проверить» → «Далее»
let enterDir = 0;                                      // направление въезда новой карточки после свайпа

function cur(){
  const cfg = SESSION[mode];
  if(!cfg) return null;
  if(cfg.sem) return semSess;
  return (cfg.block ? blockSess : sess[mode]) || null;
}
// Набор карточек: тематический блок (число) или рецепты группы 'g_<id>'
/* Избранное: звёздочка на карточке. Хранится список названий препаратов. Набор «Избранное» фиксируется при открытии
   (favSnap): если снять звезду прямо в нём, карточка остаётся на месте до следующего захода — номера карточек не прыгают. */
const FAV_KEY = 'pharma_fav_v1';
function favRead(){ const v = store.get(FAV_KEY); return Array.isArray(v) ? v.filter(x => typeof x==='string') : []; }
const isFav = d => favRead().includes(d[0]);
function favToggle(d){   // → true, если карточка теперь в избранном
  const a = favRead(), i = a.indexOf(d[0]);
  if(i<0) a.push(d[0]); else a.splice(i, 1);
  store.set(FAV_KEY, a);
  return i<0;
}
let favSnap = null;
function cardSet(k){
  if(k==='fav'){ if(!favSnap){ const a = favRead(); favSnap = DB.filter(d => a.includes(d[0])); } return {num:0, title:'Избранное', items:favSnap}; }
  if(typeof k==='string' && k.startsWith('g_')){ const id = k.slice(2); return {num:0, title:myGrpName(id), items:myGrpPool(id)}; }
  return BLOCKS[k];
}
function cardsPos(i){
  const p = readAll(KEYS.groupCards)[i], c = cardSet(i);
  return c && Number.isInteger(p) && p>=0 && p<c.items.length ? p : 0;
}
function saveCards(){
  const all = readAll(KEYS.groupCards);
  all[cards.block] = cards.pos;
  store.set(KEYS.groupCards, all);
}
let lastViewJson = '';
function saveView(){
  const v = {mode, grpId:curGrp, semIdx, cardsBack, studyBlockIdx:lastBlock.study, wbBlockIdx:lastBlock.writeBlock, groupIdx:lastBlock.groupCards, grpBack, cardsKey: mode==='groupCards' && typeof cards.block==='string' ? cards.block : ''};
  const j = JSON.stringify(v);
  if(j === lastViewJson) return;   // ничего не изменилось — localStorage не трогаем
  lastViewJson = j;
  store.set(KEYS.view, v);
}
function restoreView(v = objOf(store.get(KEYS.view))){
  const okIdx = i => Number.isInteger(i) && i>=0 && i<BLOCKS.length;
  if(okIdx(v.studyBlockIdx)) lastBlock.study = v.studyBlockIdx;
  if(okIdx(v.wbBlockIdx)) lastBlock.writeBlock = v.wbBlockIdx;
  if(okIdx(v.groupIdx)) lastBlock.groupCards = v.groupIdx;
  if(Number.isInteger(v.semIdx) && v.semIdx>=0 && v.semIdx<SEMESTERS.length) semIdx = v.semIdx;
  cardsBack = v.cardsBack==='groupList' ? 'groupList' : v.cardsBack==='tests' ? 'tests' : v.cardsBack==='myGroup' ? 'myGroup' : 'menu';   // «назад» с карточек: в список «Карточки» или в меню (старые 'topics'/'semester' ведут в недостижимые экраны)
  if(typeof v.grpId==='string') curGrp = v.grpId;
  grpBack = v.grpBack==='myrx' ? 'myrx' : 'menu';
  let m = v.mode;
  if(m==='myrxEdit') m = 'myrx';   // черновик редактора не восстанавливается
  if(ORPHAN_MODES.has(m)) m = 'menu';
  // Первый запуск после перехода на единые блоки: прогресс старых блоков удаляется,
  // а вместо старого блока открывается список новых
  let migrated = false;
  for(const k of OLD_BLOCK_KEYS) if(store.has(k)){ store.del(k); migrated = true; }
  if(migrated && LISTS[PARENT[m]]) m = PARENT[m];
  if(m==='semQuiz' || m==='semWrite'){ const S = loadSession(m); if(S){ semSess = S; mode = m; } }
  else if(m==='quiz' || m==='write' || m==='tests' || m==='exam' || m==='examQuiz' || m==='examWrite' || m==='mistakes' || m==='reference' || m==='allRx' || m==='semesters' || m==='semester' || m==='topics' || m==='howto' || m==='myrx' || m==='semMenu' || LISTS[m]) mode = m;
  else if(m==='myGroup'){ if(myGrpOk()) mode = m; }
  else if(SESSION[m]?.grp){ if(myGrpOk() && myGrpPool(curGrp).length) openBlock(m, curGrp, true); }
  else if(m==='groupCards' && typeof v.cardsKey==='string' && v.cardsKey){ const cs = cardSet(v.cardsKey); if(cs && cs.items.length) openBlock('groupCards', v.cardsKey, true); }
  else if(m==='groupCards' || SESSION[m]?.block) openBlock(m, lastBlock[m], true);
  else if(SESSION[m]?.dynamic) openMistakes(m, true);
}

/* ========================= Действия ========================= */
function go(m){ flushSave(); mode = m; render(); }

function openBlock(target, i, silent){
  if(target!=='groupCards' || typeof i==='number') lastBlock[target] = i;
  if(target==='groupCards'){ cards.block = i; cards.pos = cardsPos(i); }
  else blockSess = loadSession(target, i) || newSession(target, i);
  mode = target;
  if(!silent) render();
}
// Зачёт по семестру: отдельная сессия и отдельный прогресс для каждого семестра
const semName = i => (i ? 'II' : 'I') + ' семестр';
function startSemTest(i, m = 'semQuiz'){
  flushSave();
  semIdx = i;
  semSess = loadSession(m) || newSession(m);
  mode = m;
  render();
}
function openMistakes(m, silent){
  let S = sess[m] || loadSession(m);
  // законченный круг начинается заново — по актуальному списку ошибок
  if(!S || S.pos >= S.order.length) S = mistakeCount() ? newSession(m) : null;
  if(S){ sess[m] = S; mode = m; } else mode = 'mistakes';
  if(!silent) render();
}
function askReset(m, i){
  const cfg = SESSION[m] || {};
  const text = m==='groupCards' ? `Карточки блока ${i+1} начнутся с первой.`
    : cfg.grp ? 'Ответы в этой папке удалятся, и она начнётся заново. Список ошибок не изменится.'
    : cfg.sem ? `Ответы в режиме «${m==='semQuiz' ? 'Тест' : 'Впиши сам'}» по ${semName(i)}у удалятся, и он начнётся заново. Список ошибок не изменится.`
    : cfg.block ? `Ответы в блоке ${i+1} удалятся, и он начнётся заново. Список ошибок не изменится.`
    : cfg.dynamic ? 'Повторение начнётся заново — по текущему списку ошибок.'
    : `Ответы в режиме «${cfg.title}» удалятся, и начнётся новый круг. Список ошибок не изменится.`;
  askConfirm('Сбросить прогресс?', text, 'Сбросить', () => {
    dropPending();
    if(m==='groupCards' || cfg.block) clearSaved(m, i);
    else if(cfg.sem){ semDropMode(m, i); if(semSess && semSess.mode===m && semSess.sem===i) semSess = null; }
    else if(cfg.dynamic){ store.del(KEYS[m]); delete sess[m]; }
    else { sess[m] = newSession(m); saveSession(sess[m]); }
    render();
  });
}

/* ===== Сброс прогресса по разделам: значок на строке главного экрана, виден только если в разделе есть прогресс ===== */
function savedHasProgress(m, sv){
  sv = objOf(sv);
  const n = Array.isArray(sv.order) ? sv.order.length : 0;
  if(!n) return false;
  if((sv.pos ?? sv.idx ?? 0) > 0 || (sv.furthest ?? 0) > 0) return true;
  try{
    const K = KIND[SESSION[m].kind], d = DB_BY_NAME.get(sv.order[0]);
    return !!(d && Array.isArray(sv.state) && K.touched(K.restore(sv.state[0], d)));   // ответ на первом вопросе без «Далее»
  }catch{ return false; }
}
const modesHaveProgress = modes => modes.some(m => {
  const raw = SESSION[m].block ? Object.values(readAll(KEYS[m])) : [store.get(KEYS[m])];
  return raw.some(sv => savedHasProgress(m, sv));
});
const cardsHaveProgress = () => Object.values(readAll(KEYS.groupCards)).some(p => Number.isInteger(p) && p>0);
const semHasProgress = i => ['semQuiz','semWrite'].some(m => savedHasProgress(m, objOf(semRead(m)[i])));
const EXAM_MODES = ['quiz','write','study','writeBlock'];
// Разделы главного экрана: есть ли прогресс, подпись и что именно удалять
const RESET_SECTIONS = {
  sem0:    {has: () => semHasProgress(0), title:'I семестр', text:'Ответы в тесте и в «Впиши сам» по I семестру удалятся, и зачёт начнётся заново.',
            run(){ semDrop(0); semSess = null; }},
  sem1:    {has: () => semHasProgress(1), title:'II семестр', text:'Ответы в тесте и в «Впиши сам» по II семестру удалятся, и зачёт начнётся заново.',
            run(){ semDrop(1); semSess = null; }},
  exam:    {has: () => modesHaveProgress(EXAM_MODES), title:'Экзамен', text:'Ответы в тесте и в «Впиши сам» удалятся — и по всем рецептам, и по блокам. Список ошибок сохранится.',
            run(){ for(const m of ['study','writeBlock']) store.del(KEYS[m]); blockSess = null; sess.quiz = newSession('quiz'); sess.write = newSession('write'); store.del(KEYS.quiz); store.del(KEYS.write); }},
  topics:  {has: cardsHaveProgress, title:'По темам', text:'Карточки всех тем начнутся с первой.',
            run(){ store.del(KEYS.groupCards); }},
  mistakes:{has: () => modesHaveProgress(MISTAKE_MODES), title:'Работа над ошибками', text:'Повторение начнётся заново — по текущему списку ошибок. Сам список сохранится.',
            run(){ for(const m of MISTAKE_MODES){ store.del(KEYS[m]); delete sess[m]; } }}
};
function askResetSection(id){
  const R = RESET_SECTIONS[id];
  if(!R) return;
  askConfirm(`Сбросить «${R.title}»?`, R.text, 'Сбросить', () => { dropPending(); R.run(); render(); });
}
// Значок сброса на углу строки; пустая строка, если сбрасывать нечего
const badgeCache = {};
const hasProgressCached = id => {
  const c = badgeCache[id];
  if(c && c.gen === store.gen) return c.v;
  const v = !!RESET_SECTIONS[id].has();
  badgeCache[id] = {gen: store.gen, v};
  return v;
};
const resetBadge = id => hasProgressCached(id)
  ? `<button class="rx-badge" type="button" data-act="resetSection" data-sec="${id}" title="Сбросить прогресс" aria-label="Сбросить прогресс: ${RESET_SECTIONS[id].title}">${ICON.reset}</button>` : '';
const withReset = (id, html) => `<div class="rx-wrap">${html}${resetBadge(id)}</div>`;
function askClearMistakes(){
  askConfirm('Очистить список ошибок?', 'Все препараты уйдут из списка. Прогресс в тестах и блоках не изменится.', 'Очистить', () => {
    mistakes = {};
    saveMistakes();
    dropMistakeSessions();
    render();
  });
}
function ensureOpts(S){
  const st = S.state[S.pos];
  if(st.opts) return;
  const d = S.order[S.pos];
  st.opts = {dose: optsFor('dose', d), route: optsFor('route', d), group: optsFor('group', d)};
  saveSession(S);
}
function selectOpt(cat, i){
  const S = cur();
  if(!S || S.pos>=S.order.length) return;
  const st = S.state[S.pos];
  if(st.checked || !st.opts || !(cat in st.sel) || st.opts[cat][i]===undefined) return;
  st.sel[cat] = st.opts[cat][i];
  saveSession(S);
  // перерисовываем только выбранный ряд и кнопку, а не всю карточку
  view.querySelectorAll(`.opt[data-cat="${cat}"]`).forEach((b,j) => {
    b.classList.toggle('is-selected', j===i);
    b.setAttribute('aria-pressed', j===i);
  });
  syncPrimary(S);
}
function syncPrimary(S){
  const btn = document.getElementById('primary');
  if(btn && btn.dataset.act==='check') btn.disabled = !kindOf(S).ready(S.state[S.pos]);
}
function check(){
  const S = cur();
  if(!S || S.pos>=S.order.length) return;
  const st = S.state[S.pos];
  if(st.checked || !kindOf(S).ready(st)) return;
  const dd = S.order[S.pos], [, dose, route, group] = dd;
  const isWrite = SESSION[S.mode].kind==='write';
  if(!isWrite){
    st.correct = st.sel.dose===dose && st.sel.route===route && st.sel.group===group;
  } else {
    st.v = 3;
    const lm = latinMatch(st.typed.latin, dd[4], dd[0]);
    st.latinOk = lm > 0; st.latinTypo = lm === 2;
    st.doseOk = isCloseMatch(st.typed.dose, dose, true);
    st.groupOk = [group, ...grpExtra(dd)].some(g => isCloseMatch(st.typed.group, g, false));
    st.correct = st.latinOk && st.doseOk && st.groupOk;
  }
  st.checked = true;
  if(S.pos+1 > S.furthest) S.furthest = S.pos+1;
  checkedAt = Date.now();
  saveSession(S);
  noteAnswer(S.order[S.pos], st.correct);
  const card = view.querySelector('.card');
  if(isWrite){
    // карточка «переворачивается»: лицо уходит ребром, на обороте — эталонный рецепт
    if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const show = () => { render(); checkedAt = Date.now(); const c = view.querySelector('.card'); if(c) c.classList.add('wr-flip-in'); };
    if(card && canAnimate()){
      let done = false, guard = 0;
      const out = card.animate([{transform:'perspective(900px) rotateY(0deg)'}, {transform:'perspective(900px) rotateY(90deg)'}], {duration:190, easing:'ease-in', fill:'forwards'});
      const go = () => { if(done) return; done = true; clearTimeout(guard); out.onfinish = out.oncancel = null; show(); try{ out.cancel(); }catch(_){} };
      guard = setTimeout(go, 450);
      out.onfinish = go; out.oncancel = go;
    } else show();
    return;
  }
  render();
  const fresh = view.querySelector('.card');   // старая карточка после render() уже отвязана от DOM
  if(fresh) fresh.classList.add('just-checked');
}
function next(fromSwipe){
  const S = cur();
  if(!S || S.pos>=S.order.length || !S.state[S.pos].checked) return;
  if(fromSwipe!==true && Date.now()-checkedAt < 200) return;
  S.pos++;
  saveSession(S);
  render();
}
// «Далее» — карточка смахивается влево так же, как при свайпе, и въезжает следующая
let leaveTimer = 0;
function nextAnimated(){
  const S = cur();
  if(!S || S.pos>=S.order.length || !S.state[S.pos].checked) return;
  if(Date.now()-checkedAt < 200) return;
  const el = view.querySelector('.card');
  if(el && el.dataset.leaving){                 // повторное нажатие во время ухода карточки — сразу следующая
    clearTimeout(leaveTimer);
    enterDir = 1; next(true); enterDir = 0;
    return;
  }
  if(!el || matchMedia('(prefers-reduced-motion: reduce)').matches){ next(); return; }
  el.dataset.leaving = '1';
  el.style.transition = 'transform .2s ease, opacity .2s ease';
  el.style.transform = 'translateX(-120%) rotate(-10deg)';
  el.style.opacity = '0';
  const pos0 = S.pos;
  leaveTimer = setTimeout(() => {
    if(cur()!==S || S.pos!==pos0) return;   // за 160 мс ушли в меню / другую сессию — не трогаем чужой прогресс
    enterDir = 1; next(true); enterDir = 0;
  }, 160);
}
// Пропуск вопроса свайпом влево: к ответу можно вернуться, а в итогах будет предупреждение
function skip(){
  const S = cur();
  if(!S || S.pos>=S.order.length || S.state[S.pos].checked) return;
  S.pos++;
  if(S.pos > S.furthest) S.furthest = S.pos;
  saveSession(S);
  render();
}
function jumpTo(i){
  const S = cur();
  if(!S || !(i>=0 && i<S.order.length)) return;
  S.pos = i;
  saveSession(S);
  render();
}
function prev(){
  const S = cur();
  if(!S || S.pos<=0) return;
  S.pos--;
  saveSession(S);
  render();
}
function restart(){
  const S = cur();
  if(!S) return;
  dropPending();   // отложенное сохранение старого круга не должно воскресить его
  const cfg = SESSION[S.mode];
  if(cfg.dynamic){
    if(!mistakeCount()){ dropMistakeSessions(); go('mistakes'); return; }
    sess[S.mode] = newSession(S.mode);
    saveSession(sess[S.mode]);
  } else if(cfg.sem){
    if(Number.isInteger(S.sem)) semIdx = S.sem;
    semSess = newSession(S.mode);
    saveSession(semSess);
  } else if(cfg.block){
    blockSess = newSession(S.mode, S.block);
    clearSaved(S.mode, S.block);
  } else {
    sess[S.mode] = newSession(S.mode);
    saveSession(sess[S.mode]);
  }
  render();
}
function cardMove(d){
  const n = cardSet(cards.block).items.length, p = cards.pos+d;
  if(p<0 || p>=n) return;
  cards.pos = p;
  saveCards();
  render();
}
function cardRestart(){
  cards.pos = 0;
  clearSaved('groupCards', cards.block);
  render();
}

/* ========================= Отрисовка ========================= */
const view = document.getElementById('view');
const $id = id => document.getElementById(id);

const svgIcon = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  choice: svgIcon('<path d="M10 6h10M10 12h10M10 18h10"/><circle cx="5" cy="6" r="1.4"/><path d="M3.3 12.2l1.4 1.4 2.6-2.8"/><circle cx="5" cy="18" r="1.4"/>'),
  pen:    svgIcon('<path d="M4 20h4L19.3 8.7a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14.5 7.5l3 3"/>'),
  cards:  svgIcon('<rect x="3.5" y="7.5" width="12.5" height="13" rx="2.5"/><path d="M8 4.5h9.5A2.5 2.5 0 0 1 20 7v10"/>'),
  target: svgIcon('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>'),
  search: svgIcon('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>'),
  chevron: svgIcon('<path d="M6 9.5l6 6 6-6"/>'),
  reset:  svgIcon('<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4.5V9h4.5"/>'),
  lock:   svgIcon('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
};
const FIELDS = {dose:'Концентрация / форма', route:'Способ введения', group:'Фармакологическая группа'};

let topName = '';
// t: {back, title, count, score, progress} — чего нет, то скрыто
function setTop(t){
  document.querySelector('.topbar').classList.toggle('is-session', !!t.compact);
  document.querySelector('.topbar').classList.toggle('is-empty', !t.back && !t.title && !t.count && t.progress==null);   // пустая шапка (главный экран) не рисуется
  $id('backBtn').hidden = !t.back;
  if(t.back) $id('backLabel').textContent = t.back;
  topName = t.title || '';   // верхний заголовок не рисуем (он дублировал заголовок страницы); название нужно только для экранных дикторов и вкладки
  $id('topTitle').innerHTML = '';
  $id('topCount').hidden = !t.count || t.progress==null;   // номер карточки — справа от шкалы
  $id('topCount').textContent = t.count || '';
  $id('topSub').hidden = t.progress==null;
  if(t.progress!=null) $id('progressFill').style.width = Math.round(t.progress*100) + '%';
  const score = $id('score');
  score.hidden = !t.score;
  if(t.score){
    $id('scoreOk').textContent = '✓ ' + t.score.c;
    $id('scoreNo').textContent = '✕ ' + t.score.w;
    score.setAttribute('aria-label', `Верно: ${t.score.c}, ошибок: ${t.score.w}`);
  }
}
function chip(p){
  if(!p) return '';
  return p.done ? '<span class="chip is-good">✓ Пройдено</span>' : '';
}
const count = n => `${n} ${plural(n,'препарат','препарата','препаратов')}`;
// Плитка режима или блока; reset — подпись кнопки сброса, если прогресс есть
function tile(o){
  const attrs = `data-mode="${o.m}"${o.i!=null ? ` data-i="${o.i}"` : ''}`;
  return `<div class="tile-wrap">
    <button class="tile${o.reset ? ' has-reset' : ''}" type="button" data-act="${o.act || 'go'}" ${attrs}>
      <span class="tile-icon">${o.icon}</span>
      <span class="tile-body"><span class="tile-title">${o.title}</span>${o.desc ? `<span class="tile-desc">${o.desc}</span>` : ''}${o.meta ? `<span class="tile-meta">${o.meta}</span>` : ''}</span>
    </button>${o.reset ? `
    <button class="icon-btn tile-reset" type="button" data-act="reset" ${attrs} title="Сбросить прогресс" aria-label="${o.reset}">${ICON.reset}</button>` : ''}
  </div>`;
}
// Строка препарата в списке ошибок и справочнике
function drugRow(d, {note, match} = {}){
  return `<button class="row" type="button" data-act="drug" data-d="${DB_INDEX.get(d)}">
    <span class="row-main"><span class="row-title">${esc(d[0])}</span><span class="row-sub">${esc(grpText(d))}</span>${match ? `<span class="row-sub">${esc(match)}</span>` : ''}</span>${note ? `<span class="row-note">${note}</span>` : ''}
  </button>`;
}

// Экран карточек открывается из разных разделов — «назад» ведёт туда, откуда пришли
let semIdx = 0;
// Раскрыт ли единый пункт «По темам» на главном экране
let topicsOpen = false;
// Вышла новая версия приложения: на главном экране появляется кнопка «Обновить»
let updateReady = false;


// «Как писать рецепты» — краткая схема оформления (учебная)

// Мини-тест в конце гайда: вопрос, варианты, индекс верного, пояснение
const HTQ = [
  {q:'С какого слова начинается рецепт?',
   o:['Signa: («Обозначь»)','Recipe: («Возьми»), сокращённо Rp.:','Da tales doses («Выдай такие дозы»)'], a:1,
   e:'Рецепт всегда открывает слово Recipe: — «Возьми:».'},
  {q:'Какая запись выписана верно?',
   o:['Rp.: Tabulettas Metoprololum 0,05','Rp.: Tabulettas Metoprololi 0,05','Rp.: Tabulettas Metoprololi 50 mg'], a:1,
   e:'Название препарата — в родительном падеже (Metoprololi), а mg и g не пишут: 50 мг — это 0,05.'},
  {q:'Как в рецепте записывается 100 мг?',
   o:['1,0','0,01','0,1'], a:2,
   e:'0,1 — это 100 мг. 1,0 — это 1 г, а 0,01 — 10 мг.'},
  {q:'Что означает D.t.d.n.?',
   o:['Da tales doses numero — «Выдай такие дозы числом»','Da. Signa — «Выдай. Обозначь»','Dragee, tabulettas — «драже, таблетки»'], a:0,
   e:'D.t.d.n. — указание фармацевту (Subscriptio): сколько доз выдать.'},
  {q:'На каком языке пишется Signa?',
   o:['На латинском','На русском, для пациента','На греческом'], a:1,
   e:'Signa — инструкция для пациента на русском: путь введения, доза, кратность и время приёма относительно еды.'},
  {q:'Что обязательно указывают в рецепте на раствор для инъекций?',
   o:['Ничего, сразу пишут Da. Signa:','Число ампул: Da tales doses numero 6 in ampullis','Массу вещества в граммах вместо объёма'], a:1,
   e:'Для инъекций пишут, сколько ампул выдать. Без этого сразу идёт Da. Signa: — выдаётся один стандартный флакон (например, капли).'}
];
function htqHtml(){
  return `<div class="htq" data-i="-1" data-res="">
    <div class="htq-intro">
      <p>Шесть коротких вопросов по этому разделу — по одному на экране. После ответа сразу видно, верно ли, и почему.</p>
      <button class="btn btn-primary btn-block" type="button" data-act="htqStart">Начать тест</button>
    </div>
    <div class="htq-stage" aria-live="polite" hidden></div>
  </div>`;
}
// Отрисовка текущего шага теста (вопрос или итог); состояние хранится в data-атрибутах корня
function htqRender(root){
  const st = root.querySelector('.htq-stage');
  delete st.dataset.answered;
  const i = +root.dataset.i, res = root.dataset.res || '', n = HTQ.length;
  const dots = Array.from({length:n}, (_, k) =>
    `<span class="htq-dot${res[k] === 'c' ? ' is-ok' : res[k] === 'w' ? ' is-no' : k === i ? ' is-cur' : ''}"></span>`).join('');
  if(i >= n){
    const good = (res.match(/c/g) || []).length;
    const msg = good === n ? 'Отлично, всё верно!' : good >= n - 2 ? 'Хороший результат. Разберите ошибки ниже.' : 'Стоит перечитать раздел и пройти тест ещё раз.';
    const missed = HTQ.map((it, k) => res[k] === 'w'
      ? `<li><span class="htq-mq">${it.q}</span><span class="htq-ma">Верно: ${it.o[it.a]}</span></li>` : '').join('');
    st.innerHTML = `<div class="htq-top"><span class="htq-count">Результат</span><span class="htq-dots" aria-hidden="true">${dots}</span></div>
      <p class="htq-big">${good}<small> из ${n}</small></p>
      <p class="htq-msg">${msg}</p>
      ${missed ? `<p class="htq-sub">Над чем стоит подумать:</p><ul class="htq-miss">${missed}</ul>` : ''}
      <button class="btn btn-primary btn-block" type="button" data-act="htqStart">Пройти заново</button>`;
    return;
  }
  const it = HTQ[i], L = ['А', 'Б', 'В', 'Г'];
  st.innerHTML = `<div class="htq-top"><span class="htq-count">Вопрос ${i + 1} из ${n}</span><span class="htq-dots" aria-hidden="true">${dots}</span></div>
    <p class="htq-t" tabindex="-1">${it.q}</p>
    <div class="htq-opts">${it.o.map((t, j) => `<button class="opt" type="button" data-act="htq" data-o="${j}"><span class="htq-ltr">${L[j]}</span><span class="htq-txt">${t}</span></button>`).join('')}</div>
    <div class="htq-fb" hidden></div>
    <button class="btn btn-primary btn-block htq-next" type="button" data-act="htqNext" hidden>${i === n - 1 ? 'Показать результат' : 'Далее'}</button>`;
}
function htqScroll(root){
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  try{ root.scrollIntoView({block:'start', behavior: calm ? 'auto' : 'smooth'}); }catch(_){}
  const t = root.querySelector('.htq-t'); if(t) try{ t.focus({preventScroll:true}); }catch(_){}
}
function viewHowTo(){
  setTop({back:'Меню', title:'Как писать рецепты'});
  const step = (n, title, body) => `<section class="ht-step"><div class="ht-head"><span class="ht-no">${n}</span><h2>${title}</h2></div>${body}</section>`;
  // под словом Recipe ничего не пишется: остальные строки начинаются правее него (кроме примера-нарушения)
  const blank = (lines, extra='', cls='') => cls.includes('is-struck')
    ? `<div class="blank${cls ? ' '+cls : ''}">${extra}${lines.map(([t,c]) => `<span class="bl${c ? ' '+c : ''}">${t}</span>`).join('')}</div>`
    : `<div class="blank${cls ? ' '+cls : ''}">${extra}<div class="rxd">${rxDoc(lines)}</div></div>`;
  return `<header class="page-head"><h1>Как писать рецепты</h1>
    <p>Рецепт — письменное обращение врача к фармацевтическому работнику с предписанием о выдаче или изготовлении лекарственного средства для конкретного пациента. Выписывается на латинском языке по установленной форме; только <i>Signa</i> пишется на русском.</p></header>

    ${step(1, 'Начинается с Recipe:', `
      <p>Каждый рецепт начинается со слова <i>Recipe:</i> (то есть «Возьми:»). Иногда сокращают как <i>Rp.:</i></p>
      <p class="ht-note"><b>Уточните у преподавателя,</b> можно ли использовать сокращения. На экзамене сокращать крайне нежелательно.</p>
      <p><b>Под</b> <i>Rp.</i> / <i>Recipe</i> нельзя ничего писать на всём протяжении рецепта.</p>
      <div class="blank is-struck"><div class="ban"><span class="bl">Recipe:</span><span class="ban-x" role="img" aria-label="Под словом Recipe писать нельзя"></span></div></div>`)}

    ${step(2, 'Лекарственная форма', `
      <p>После двоеточия обычно следует название лекарственной формы — на латыни, в винительном падеже:</p>
      <ul class="ht-forms">
        <li><span class="ht-lat">Solutionis (Sol.)</span><span>раствор</span></li>
        <li><span class="ht-lat">Tabulettas (Tab.)</span><span>таблетки</span></li>
        <li><span class="ht-lat">Dragee</span><span>драже</span></li>
        <li><span class="ht-lat">Tincturae</span><span>настойка</span></li>
        <li><span class="ht-lat">Aerosoli</span><span>аэрозоль</span></li>
        <li><span class="ht-lat">Sirupi</span><span>сироп</span></li>
        <li><span class="ht-lat">Suppositoria</span><span>свечи</span></li>
      </ul>
      <p>Есть рецепты, в которых форма в начале не указывается — их разберём ниже (шаг 9).</p>`)}

    ${step(3, 'Препарат и дозировка', `
      <p>Допустим, пишем рецепт на препарат <b>лабеталол</b>. Название препарата тоже пишется на латыни — <b>с заглавной буквы</b> и в <b>косвенном падеже</b> (родительном, <i>Genitivus</i>).</p>
      ${blank([['Recipe: Tabulettas Labetaloli 0,1','']])}
      <p>Дозировки, например таблеток, пишутся в граммах: 100 миллиграмм — это десятая доля грамма, то есть <b>0,1</b>.</p>
      <p>Количество вещества пишется в правой части строки:</p>
      <div class="ht-key">
        <div><span class="ht-lat">1,0</span>1 г</div>
        <div><span class="ht-lat">0,1</span>100 мг</div>
        <div><span class="ht-lat">0,01</span>10 мг</div>
        <div><span class="ht-lat">0,001</span>1 мг</div>
        <div><span class="ht-lat">1 ml, 10 ml, 100 ml</span>объём жидкости в миллилитрах</div>
        <div><span class="ht-lat">100 000 ED</span>единицы действия (например, антибиотики)</div>
      </div>`)}

    ${step(4, 'Da tales doses или Da. Signa', `
      <p>Затем следуют либо слова <i>Da tales doses numero</i>, либо <i>Da. Signa:</i></p>
      <p class="ht-note">Это указание фармацевту — <i>Subscriptio</i>.</p>
      <div class="ht-key">
        <div><span class="ht-lat">D.t.d.n.</span>Da tales doses numero — «Выдай такие дозы числом» (в таком количестве); встречается и написание <i>D.t.d. N.</i></div>
        <div><span class="ht-lat">D.S.:</span>Da. Signa: — «Выдай. Обозначь.» (после — двоеточие)</div>
      </div>
      <p>Если форму нужно уточнить, после числа добавляют её название: <i>in tabulettis</i> («в таблетках»), <i>in ampullis</i> («в ампулах»).</p>
      ${blank([['Recipe: Tabulettas Labetaloli 0,1',''],['Da tales doses numero 30','in1']])}`)}

    ${step(5, 'Signa — инструкция', `
      <p>Последний пункт рецепта — <i>Signa</i>. После этого слова с двоеточием идёт инструкция для пациента на русском языке. Также может быть инструкция для фармацевта (<i>сначала разведи препарат так-то, затем отдай больному и объясни, что с ним делать</i>).</p>
      <p>В <i>Signa</i> указывают: <b>путь введения, дозу, кратность</b> и, если это важно, <b>время приёма относительно еды</b> (до еды, после еды, во время еды).</p>
      <p class="ht-note">Некоторые преподаватели считают обязательным указывать здесь <b>в первую очередь путь введения</b>: внутрь, сублингвально, внутримышечно, подкожно и т. д.</p>
      ${blank([['Recipe: Tab. Labetaloli 0,1',''],['D.t.d.n. 30','in1'],['Signa: внутрь, по 1 таблетке','in1'],['3 раза в день','in2']])}
      <p>Этот рецепт предписывает выдать таблетки лабеталола по 100 мг в количестве 30 штук; пациенту принимать по одной трижды в день.</p>`)}

    ${step(6, 'Раствор: флакон и ампулы', `
      <p>Теперь не таблетки, а раствор. Концентрация указывается <b>первой</b>, затем тире и объём.</p>
      ${blank([['Recipe: Solutionis Naphazolini 0,1% — 10 ml',''],['Da. Signa: интраназально, по 1–2','in1'],['капли 3 р/д','in2']])}
      <p>Здесь не указано количество и не указано, в чём должен быть раствор. Сразу пишется <i>Da. Signa:</i> — фармацевту понятно, что нужно выдать один стандартный заводской флакон (сосудосуживающие капли в нос).</p>
      <p>Но если раствор для <b>инъекций или капельных вливаний</b>, обязательно пишем, что нужно выдать определённое число ампул:</p>
      ${blank([['Rp.: Solutionis Coffeini natrii benzoatis 10% — 1 ml',''],['Da tales doses numero 6 in ampullis','in1'],['S.: подкожно, по 1 мл 2 р/д','in1']])}
      <p class="ht-note"><b>Сокращать — так сокращать.</b> Если вы сократили <i>Recipe</i> до <i>Rp.</i>, сокращайте и дальше в этом рецепте. Либо сокращаете всё, что можно, либо пишете полностью. (В примере выше этот принцип мы проигнорировали.)</p>`)}

    ${step(7, 'Группа препарата', `
      <p>Важный момент для студентов: не забудьте указать <b>где-нибудь в сторонке</b>, к какой фармакологической группе принадлежит препарат (альфа-адреноблокатор, кардиотоник и так далее).</p>
      ${blank([['Recipe: Tab. Labetaloli 0,1',''],['D.t.d.n. 30','in1'],['S.: внутрь, по 1 таб. 3 р/д','in1']], '<span class="side">α- и β-адреноблокатор</span>')}`)}

    ${step(8, 'Кавычки: торговое название', `
      <p>Кавычки используются, когда пишем <b>торговое название</b> препарата. Таблетки «Афобазол» не содержат действующего вещества афобазол (такого вещества не существует), поэтому нельзя написать <i>таблетки афобазола</i> — пишем в <b>именительном падеже</b>:</p>
      ${blank([['Rp.: Tabulettas «Aphobazolum» 0,01',''],['D.t.d.n. 50','in1'],['S.: внутрь, по 1 таб. 2 р/д','in1']])}`)}

    ${step(9, 'Форма не в начале', `
      <p>Бывает, что форма в начале не указывается, а сразу пишется название лекарственного вещества:</p>
      ${blank([['Recipe: Tamsulosini 0,0004',''],['Da tales doses numero 10 in capsulis','in1'],['Signa: внутрь, по 1 капс. 1 р/д','in1']])}
      <p>Но, как видите, форма указана <b>во второй строчке</b>: «Выдай такие дозы числом 10 в капсулах».</p>`)}

    ${step(10, 'Твёрдые формы: таблетки, драже, порошки', `
      <p>Три типичных рецепта на твёрдые лекарственные формы. Везде одна схема: название и количество вещества → число доз → <i>Signa</i>.</p>
      <p><b>Таблетки</b> (<i>Tabulettae</i>):</p>
      ${blank([['Rp.: Tabulettas Metoprololi 0,05',''],['D.t.d.n. 30','in1'],['S.: По 1 таблетке 2 раза в день','in1']])}
      <p><b>Драже</b> (<i>Dragee</i>) — обычно принимают после еды:</p>
      ${blank([['Rp.: Dragee Diazolini 0,1',''],['D.t.d.n. 20','in1'],['S.: По 1 драже 2 раза в день после еды','in1']])}
      <p><b>Порошки</b> (<i>Pulveres</i>) — форма в начале не указана, сразу пишется название вещества и масса одной дозы (как в шаге 9):</p>
      ${blank([['Rp.: Pancreatini 0,5',''],['D.t.d.n. 20','in1'],['S.: По 1 порошку 3 раза в день во время еды','in1']])}`)}

    ${step(11, 'Проверь себя', htqHtml())}

    <button class="btn btn-secondary btn-block list-end" type="button" data-act="up">К меню</button>`;
}

const HOME_ICONS = {
  clip:'<path d="M8 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h8M14 4h3a2 2 0 0 1 2 2v6M8 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2H8zM6 10l1.5 1.5L10 9m2 1h4M6 15l1.5 1.5L10 14"/><rect x="13" y="16" width="10" height="5" rx="2.5" transform="rotate(-45 18 18.5)"/><path d="m16.2 16.7 3.6 3.6"/>',
  book:'<path d="M12 6c-2.6-2.2-6.1-3-10-2v15c3.9-1 7.4-.2 10 2 2.6-2.2 6.1-3 10-2V4c-3.9-1-7.4-.2-10 2zm0 0v15M5 8c1.5-.2 3 .1 4 1m-4 3c1.5-.2 3 .1 4 1m10-5c-1.5-.2-3 .1-4 1m4 3c-1.5-.2-3 .1-4 1"/>',
  star:'<path d="m12 2.5 2.9 5.9 6.5 1-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-1z"/>',
  cad:'<circle cx="12" cy="3.5" r="1.5"/><path d="M12 5v17M10 7C7 7 7 4 2 5c1 3 4 4 7 4m5-2c3 0 3-3 8-2-1 3-4 4-7 4M8 10c-3 0-3 3 0 4l8 2c2 .5 2 2.4 0 3l-4 1.5M16 10c3 0 3 3 0 4l-8 2c-2 .5-2 2.4 0 3l4 1.5"/>',
  scis:'<circle cx="6" cy="18.5" r="3"/><circle cx="18" cy="18.5" r="3"/><path d="M8 16.2 20 3c0 4-2.9 8.3-6 11m2 2.2L4 3c0 4 2.9 8.3 6 11"/>',
  pen:'<path d="M3 21l1.2-5.2L16.7 3.3a2.8 2.8 0 0 1 4 4L8.2 19.8 3 21zm11.8-15.8 4 4"/>',
  search:'<circle cx="10" cy="10" r="6.8"/><path d="m15 15 5.6 5.6"/>'
};
function homeIcon(icon){
  return `<span class="rx-ico-line" aria-hidden="true"><svg viewBox="0 0 24 24">${HOME_ICONS[icon]}</svg></span>`;
}
function rxRow(attrs, no, title, icon, iconHtml){
  return `<button class="rx-row" type="button" ${attrs}>
      ${icon ? '' : `<span class="rx-no">${no}</span>`}<span class="rx-lbl">${title}</span>${icon ? `${iconHtml || `<span class="rx-ico rx-i-${icon}" aria-hidden="true"></span>`}<span class="rx-go" aria-hidden="true">${ICON.chevron}</span>` : ''}</button>`;
}
// Экран «Тесты»: зачёты по семестрам, экзамен и карточки по темам
function viewTests(){
  setTop({back:'Меню', title:'Тесты'});
  const row = rxRow;
  const exams = [
    withReset('sem0', row('data-act="openSemTest" data-i="0"', '1', 'I семестр', 'r1')),
    withReset('sem1', row('data-act="openSemTest" data-i="1"', '2', 'II семестр', 'r2')),
    withReset('exam', row('data-act="go" data-mode="exam"', '3', 'Экзамен', 'cad'))
  ].join('');
  const subs = BLOCKS.map((b,i) => {
    const pos = cardsPos(i);
    const reset = pos>0 ? `<button class="rx-reset" type="button" data-act="reset" data-mode="groupCards" data-i="${i}" title="Сбросить прогресс" aria-label="Сбросить прогресс темы «${esc(b.title)}»">${ICON.reset}</button>` : '';
    return `<div class="rx-subitem">${row(`data-act="openTopic" data-mode="groupCards" data-i="${i}"`, b.num, esc(b.title), '')}${reset}</div>`;
  }).join('');
  return `<header class="page-head"><h1>Тесты</h1><p>Зачёты по семестрам, экзамен и карточки по темам.</p></header>
    <div class="rx-rows rx-acc">
      ${exams}
      <div class="rx-wrap">
        <button class="rx-row" type="button" id="topicsToggle" data-act="topicsToggle" aria-expanded="${topicsOpen ? 'true' : 'false'}" aria-controls="topicsBody">
          <span class="rx-lbl">По темам</span><span class="rx-ico rx-i-book" aria-hidden="true"></span><span class="rx-chev rx-go" aria-hidden="true">${ICON.chevron}</span>
        </button>
        ${resetBadge('topics')}
        <div class="rx-sub" id="topicsBody"${topicsOpen ? '' : ' hidden'} style="margin-top:12px">${subs}</div>
      </div>
    </div>`;
}

// Тёмная тема: выбор хранится в localStorage, оформление — в theme-dark.css
function isDark(){ return document.documentElement.getAttribute('data-theme')==='dark'; }
function setTheme(dark){
  if(dark) document.documentElement.setAttribute('data-theme','dark'); else document.documentElement.removeAttribute('data-theme');
  try{ localStorage.setItem('pharma-theme', dark ? 'dark' : 'light'); }catch{}
  const m = document.querySelector('meta[name="theme-color"]'); if(m) m.content = dark ? '#0F131C' : '#FAFBF8';
}
function viewMenu(){
  setTop({});
  const row = (attrs, no, title, icon) => rxRow(attrs, no, title, icon, homeIcon(icon));
  const upd = updateReady ? `<div class="upd-banner" role="status"><span>Вышла новая версия приложения.</span><button class="btn btn-primary" type="button" data-act="reloadApp">Обновить</button></div>` : '';
  return `
    <header class="rx-head">
      <div class="rx-brand"><h1 class="rx-title"><span class="rx-r">Р</span>ецепты</h1></div>
    </header>
    ${upd}
    <div class="rx-rows rx-acc">
      ${row('data-act="howWrite"', '?', 'Как писать рецепты', 'clip')}
      ${row('data-act="go" data-mode="groupList"', '?', 'Карточки', 'book')}
      ${favRead().length ? row('data-act="openFav"', '?', 'Избранное', 'star') : ''}
      ${row('data-act="go" data-mode="tests"', '?', 'Тесты', 'cad')}
      ${withReset('mistakes', row('data-act="go" data-mode="mistakes"', '?', 'Работа над ошибками', 'scis'))}
      ${row('data-act="go" data-mode="myrx"', '?', 'Мои рецепты', 'pen')}
      ${row('data-act="go" data-mode="reference"', '?', 'Справочник', 'search')}
    </div>
    ${myGrpMenuHtml()}
    ${footerHtml()}
    <div class="rx-tourlink rx-fb tour-dim-able"><button type="button" data-act="feedback">Предложения по улучшению</button></div>
    <div class="rx-tourlink tour-dim-able"><button type="button" data-act="tour">Показать обучение</button></div>
    <div class="theme-toggle tour-dim-able"><button type="button" data-act="theme">${isDark() ? '☀ Светлая тема' : '☾ Тёмная тема'}</button></div>`;
}
// Подвал главного экрана: © · Обратная связь · Официальный сайт
// Заполните нужное — пустое не показывается; если пусто всё, подвала нет
const COPYRIGHT_NAME = '';   // например: 'Иванов И. И.' → «© 2026 Иванов И. И.»
const FEEDBACK_EMAIL = 'mi.plus.dev@gmail.com';   // на этот адрес приходят «Предложения по улучшению» (запасной вариант через mailto)
const FEEDBACK_FORM_ID = '25b7c80b0e6428598e3e16eeedf8994a';   // случайная строка FormSubmit вместо открытого адреса в запросе
const SITE_URL = '';         // адрес сайта → кнопка «Официальный сайт»
function footerHtml(){
  const link = (href, text) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  const parts = [];
  if(COPYRIGHT_NAME) parts.push(`<span>© ${new Date().getFullYear()} ${esc(COPYRIGHT_NAME)}</span>`);
  if(SITE_URL) parts.push(link(SITE_URL, 'Официальный сайт'));
  return parts.length ? `<footer class="rx-foot">${parts.join('<span class="rx-dot" aria-hidden="true">·</span>')}</footer>` : '';
}
// «Экзамен»: сначала формат — тест или «Впиши сам»
// Зачёт по семестру: тот же выбор формата, что и в экзамене
function viewSemMenu(){
  const name = semName(semIdx), sem = SEMESTERS[semIdx] || SEMESTERS[0], n = semItems().length;
  setTop({back:'Тесты', title:name});
  const one = (m, icon, title, desc) => {
    const p = progressOf(loadSession(m));
    return tile({m, act:'openSem', i:semIdx, icon, title, desc, meta:chip(p), reset: p && 'Сбросить прогресс'});
  };
  return `<header class="page-head"><h1>${name}</h1><p>${sem.short}: ${esc(sem.desc)}. В зачёте ${n} ${plural(n,'рецепт','рецепта','рецептов')}.</p></header>
    <div class="list">${
      one('semQuiz', ICON.choice, 'Тест', 'Выбираете дозу, путь введения и группу из трёх вариантов.')}${
      one('semWrite', ICON.pen, 'Впиши сам', 'Видно только название — латынь, концентрацию и группу вписываете сами. Карточка переворачивается и показывает рецепт.')}
    </div>`;
}
function viewExam(){
  setTop({back:'Тесты', title:'Экзамен'});
  return `<header class="page-head"><h1>Экзамен</h1><p>Выберите формат подготовки.</p></header>
    <div class="list">${
      tile({m:'examQuiz',  icon:ICON.choice, title:'Тест',       desc:'Выбираете дозу, путь введения и группу из трёх вариантов.'})}${
      tile({m:'examWrite', icon:ICON.pen,    title:'Впиши сам',  desc:'Видно только название — латынь, концентрацию и группу вписываете сами. Карточка переворачивается и показывает рецепт.'})}
    </div>`;
}
// Объём: все рецепты подряд или по частям (темам)
function viewExamScope(){
  const kind = mode==='examQuiz' ? 'quiz' : 'write', isQuiz = kind==='quiz';
  const title = isQuiz ? 'Тест' : 'Впиши сам';
  setTop({back:'Экзамен', title});
  const S = sess[kind], p = progressOf(S);
  return `<header class="page-head"><h1>${title}</h1><p>Сколько рецептов проходить за раз?</p></header>
    <div class="list">${
      tile({m:kind, icon:ICON.cards, title:`Все ${EXAM_ITEMS.length} ${plural(EXAM_ITEMS.length,'рецепт','рецепта','рецептов')}`, desc:'Весь экзамен одним кругом, в случайном порядке.',
        meta:chip(p), reset: p && 'Сбросить прогресс'})}${
      tile({m:isQuiz ? 'studyList' : 'writeBlockList', icon:ICON.pen, title:'По частям', desc:'По одному тематическому блоку.',
        meta:`<span>${BLOCKS.length} ${plural(BLOCKS.length,'блок','блока','блоков')}</span>`})}
    </div>`;
}
function viewList(){
  const L = LISTS[mode];
  setTop({back: L.target==='groupCards' ? 'Меню' : mode==='studyList' ? 'Тест' : 'Впиши сам'});
  const rows = BLOCKS.map((b,i) => {
    let p = null;
    if(L.target==='groupCards'){ const pos = cardsPos(i); if(pos>0) p = {}; }
    else p = progressOf(loadSession(L.target, i));
    return tile({act:'open', m:L.target, i, icon:String(b.num), title:esc(b.title), desc:esc(b.desc),
      meta:`<span>${count(b.items.length)}</span>${chip(p)}`, reset: p && `Сбросить прогресс блока ${b.num}`});
  }).join('');
  return `<header class="page-head"><h1>${L.title}</h1><p>${L.desc}</p></header><div class="list">${rows}</div>`;
}

function viewMistakes(){
  setTop({back:'Меню'});
  const items = mistakeItems();
  const head = '<header class="page-head"><h1>Работа над ошибками</h1><p>Препараты, на которых вы ошиблись в тестах. Верный ответ в любом режиме убирает препарат из списка.</p></header>';
  if(!items.length){
    dropMistakeSessions();
    return head + `<div class="empty">${ICON.target}<p>Ошибок нет. Препараты, на которых вы ошибётесь, появятся здесь.</p></div>`;
  }
  const sTile = (m, icon, title, desc) => {
    const S = sess[m] || loadSession(m);
    const p = S && S.pos < S.order.length ? progressOf(S) : null;
    return tile({act:'openMistakes', m, icon, title, desc, meta:chip(p), reset: p && 'Начать повторение заново'});
  };
  return head + `
    <div class="list">
      ${sTile('mistakesQuiz', ICON.choice, 'Тест', 'Три варианта ответа на дозу, путь введения и группу')}
      ${sTile('mistakesWrite', ICON.pen, 'Впиши сам', 'Латынь, концентрацию и группу вписываете без подсказок')}
    </div>
    <h2 class="section-title">${count(items.length)} в списке</h2>
    <div class="rows">${items.map(d => {
      const n = mistakes[d[0]].n;
      return drugRow(d, {note:n>1 ? `${n} ${plural(n,'ошибка','ошибки','ошибок')}` : ''});
    }).join('')}</div>
    <button class="btn btn-secondary btn-block list-end" type="button" data-act="clearMistakes">Очистить список</button>`;
}

// Справочник: поиск по названию, латыни, группе и другим названиям
const REF = DB.map(d => {
  const fields = [
    {label:'Название', value:d[0]},
    {label:'Латинское название', value:d[4]},
    {label:'Группа', value:d[3]},
    {label:'Другое название', value:INFO[d[0]]?.s}
  ].map(field => ({...field, key:normalizeAnswer(field.value)}));
  return {d, fields, key:fields.map(field => field.key).filter(Boolean).join(' ')};
}).sort((a,b) => a.d[0].localeCompare(b.d[0], 'ru'));
function refRows(q){
  const nq = normalizeAnswer(q);
  const rows = REF.flatMap(({d, fields, key}) => {
    if(!nq) return [drugRow(d)];
    if(!key.includes(nq)) return [];
    const field = fields.find(field => field.key.includes(nq));
    if(!field) return [drugRow(d, {match:'Совпадение по нескольким полям'})];
    const match = field.label === 'Название' || field.label === 'Группа'
      ? `Совпадение по полю «${field.label}»`
      : `${field.label}: ${field.value}`;
    return [drugRow(d, {match})];
  });
  return rows.length
    ? `<div class="rows">${rows.join('')}</div>`
    : '<p class="empty-text">Ничего не нашлось. Проверьте написание или поищите по группе.</p>';
}
function viewReference(){
  setTop({back:'Меню'});
  return `<header class="page-head"><h1>Справочник</h1><p>Примеры поиска — «диуретики», «метопролол», «Metoprololi». Нажмите на найденный препарат, чтобы открыть карточку.</p></header>
    <div class="search">${ICON.search}<input class="input" id="refQuery" type="search" placeholder="Фармгруппа, название или латынь" aria-label="Поиск по фармакологической группе, русскому или латинскому названию"
      autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search"></div>
    <div id="refList">${refRows('')}</div>`;
}

function favoriteButton(d){
  const fav = isFav(d);
  return `<button class="fav-btn${fav ? ' is-on' : ''}" type="button" data-act="fav" data-d="${DB_INDEX.get(d)}" aria-pressed="${fav}" aria-label="${fav ? 'Убрать из избранного' : 'Добавить в избранное'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.4l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.4-4.2 6-.9z"/></svg></button>`;
}
function drugHead(d, {withInfo, counter, masked, favorite} = {}){
  const [name, , , , latin] = d;
  return `<header class="drug${counter ? ' has-count' : ''}${masked ? ' wr-nolatin' : ''}">${counter ? `<span class="drug-count" aria-label="Вопрос ${esc(counter.replace('/',' из '))}">${esc(counter)}</span>` : ''}
    ${favorite ? favoriteButton(d) : ''}
    <div class="drug-row"><h2 class="drug-name">${esc(name)}</h2>${withInfo && INFO[name] ? '<button class="btn-info" type="button" data-act="info" aria-label="Подробнее о препарате">i</button>' : ''}</div>
    ${masked ? '' : `<div class="drug-latin" lang="la">${esc(latin)}</div>`}
  </header>`;
}
function facts(rows){
  return rows.map(([k,v]) => `<div class="fact"><dt>${k}</dt><dd>${esc(v || '—')}</dd></div>`).join('');
}
// Сведения о препарате; withAnswers — вместе с дозой и способом введения
function drugFacts(d, withAnswers, hideNames){
  const info = INFO[d[0]] || {};
  const rows = [...(hideNames ? [] : [['Другие названия', info.s]]), ['Фармакокинетика', info.k], ['Фармакодинамика', info.d], ['Показание', info.i]];
  return `<dl class="facts">${facts(withAnswers ? [[FIELDS.dose, d[1]], [FIELDS.route, d[2]], ...rows] : rows)}</dl>`;
}
function choiceFields(st, right){
  return Object.entries(FIELDS).map(([cat, label]) => `
    <div class="field" role="group" aria-label="${label}">
      <div class="label">${label}</div>
      <div class="opts">${st.opts[cat].map((o,i) => {
        let cls = 'opt';
        if(st.checked){ if(o===right[cat]) cls += ' is-correct'; else if(o===st.sel[cat]) cls += ' is-wrong'; if(o===st.sel[cat]) cls += ' was-sel'; }
        else if(o===st.sel[cat]) cls += ' is-selected';
        return `<button class="${cls}" type="button" data-act="opt" data-cat="${cat}" data-i="${i}" aria-pressed="${o===st.sel[cat]}"${st.checked ? ' disabled' : ''}><span>${esc(o)}</span></button>`;
      }).join('')}</div>
    </div>`).join('');
}
// Быстрые вставки для поля дозировки: не нужно переключать клавиатуру на телефоне
const DOSE_CHIPS = ['%', 'мл', 'МЕ', 'гр'];
function wrFillText(st){
  const n = ['latin', 'dose', 'group'].filter(k => String(st.typed[k] || '').trim()).length;
  return n === 3 ? 'Всё заполнено — можно проверять' : `Заполнено ${n} из 3 — кнопка «Проверить» включится, когда будут все три`;
}
function writeFields(st){
  const field = (key, label, sub, ph, enter, cls, extra) => `
    <div class="field wr-field">
      <label class="label wr-label" for="f-${key}"><span class="wr-lab">${label}</span>${sub ? `<span class="wr-sub">${sub}</span>` : ''}</label>
      <div class="${extra ? 'wr-inwrap' : ''}"><input class="input${cls ? ' ' + cls : ''}" id="f-${key}" data-field="${key}" type="text"
        value="${esc(st.typed[key])}" placeholder="${ph}"${key==='latin' ? ' lang="la"' : ''}
        autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="${enter}">${extra || ''}</div>
    </div>`;
  const chips = `<div class="wr-chips" role="group" aria-label="Быстрая вставка">${DOSE_CHIPS.map(c => `<button class="wr-chip" type="button" data-act="ins" data-ins="${c}" aria-label="Вставить ${c}">${c}</button>`).join('')}</div>`;
  return field('latin', 'Латинское название', 'род. падеж', 'Например: Labetaloli', 'next', 'wr-lat')
       + field('dose', 'Концентрация / дозировка', '', 'Напр.: 1% 5 мл', 'next', '', chips)
       + field('group', 'Фармакологическая группа', '', 'Начните печатать…', 'done')
       + `<p class="wr-fill" id="wrFill" aria-live="polite">${wrFillText(st)}</p>`;
}
// Оборот карточки: эталонный рецепт и разбор трёх ответов
function wrMarkSvg(ok){
  return ok
    ? '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.4l2.4 2.4 4.6-5.2"/></svg>'
    : '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l6 6M9 3l-6 6"/></svg>';
}
function wrRes(label, ok, typed, right, note){
  return `<div class="wr-res ${ok ? 'is-ok' : 'is-no'}"><span class="wr-mark" aria-hidden="true">${wrMarkSvg(ok)}</span>
    <div class="wr-body"><b>${label}</b><span>${esc(String(typed).trim() || '—')}</span>${note ? `<small class="wr-note">${esc(note)}</small>` : ''}</div></div>`;
}
// Верные ответы — отдельным блоком под ответами пользователя, только для тех полей, где была ошибка
function wrFix(items){
  const bad = items.filter(x => !x[1]);
  if(!bad.length) return '';
  return `<div class="wr-fix"><div class="wr-fix-h">Правильные ответы</div>${bad.map(x => `<div class="wr-fix-row"><b>${x[0]}</b><span>${esc(String(x[2]))}</span></div>`).join('')}</div>`;
}
// Концентрацию всегда пишут в граммах: если вписали миллиграммы или микрограммы — подсказка с пересчётом
function doseUnitNote(typed){
  const m = /(\d+(?:[.,]\d+)?)\s*(мкг|мг|mcg|µg|μg|mg)(?![а-яёa-z])/i.exec(String(typed||''));
  if(!m) return '';
  const n = parseFloat(m[1].replace(',', '.')), micro = /^(мкг|mcg|µg|μg)$/i.test(m[2]);
  const g = (n / (micro ? 1e6 : 1e3)).toFixed(12).replace(/0+$/, '').replace(/\.$/, '');   // без «5e-7»
  return `Концентрацию всегда пишут в граммах: ${m[1]} ${m[2]} = ${g.replace('.', ',')} г`;
}
function viewWriteBack(d, st, counter, actions){
  const mine = MY_SET.has(d) && MY_ACTIVE.find(m => m.d===d);
  const rxLines = mine ? myrxLines(mine.r) : (RX_DATA[d[0]] || rxBuild(d).lines);   // свои рецепты — с экранированием
  const legacy = st.v !== 3;
  const rows = legacy
    ? `<div class="wr-res ${st.correct ? 'is-ok' : 'is-no'}"><span class="wr-mark" aria-hidden="true">${wrMarkSvg(st.correct)}</span><div class="wr-body"><b>Ответ</b><span>${st.correct ? 'Верно' : 'Есть неточности'}</span></div></div>`
    : wrRes('Латынь', st.latinOk, st.typed.latin, d[4], st.latinOk && st.latinTypo ? `Принято, но в написании опечатка — верно: ${d[4]}` : '') + wrRes('Концентрация', st.doseOk, st.typed.dose, d[1], doseUnitNote(st.typed.dose)) + wrRes('Группа', st.groupOk, st.typed.group, grpText(d)) + wrFix([['Латынь', st.latinOk, d[4]], ['Концентрация', st.doseOk, d[1]], ['Группа', st.groupOk, grpText(d)]]);
  return `<article class="card wr-back" data-swipe>
    <div class="card-tag"><span class="chip">${esc(grpText(d))}</span></div>
    ${drugHead(d, {withInfo:true, counter, favorite:true})}
    <div class="blank wr-blank"><div class="rxd wr-rx" data-short="${esc(rxDoc(rxShort(rxLines)))}">${rxDoc(rxLines)}</div></div>
    ${rows}
    ${actions}
  </article>`;
}
function viewSummary(S, cfg, t){
  const nm = mistakeCount();
  const skipped = S.order.map((_,i) => S.state[i].checked ? -1 : i).filter(i => i>=0);
  const skipHtml = skipped.length ? `<div class="skip-warn" role="alert">
      <b>Пропущено ${plural(skipped.length,'вопрос','вопроса','вопросов')}: ${skipped.length}</b>
      <p>Эти препараты остались без ответа и не вошли в счёт. Нажмите, чтобы вернуться к вопросу.</p>
      <div class="mistakes">${skipped.map(i => `<button class="mistake skipped" type="button" data-act="jumpTo" data-i="${i}">${esc(S.order[i][0])}</button>`).join('')}</div>
      <button class="btn btn-secondary btn-block" type="button" data-act="jumpTo" data-i="${skipped[0]}">К первому пропущенному</button>
    </div>` : '';
  let heading, primary, after = '', note = '';
  if(cfg.dynamic){
    heading = nm ? 'Круг повторения пройден' : 'Все ошибки исправлены';
    primary = nm
      ? '<button class="btn btn-primary" type="button" data-act="restart">Повторить ещё раз</button>'
      : '<button class="btn btn-primary" type="button" data-act="up">Готово</button>';
    if(nm) note = `<p class="summary-note">В списке ошибок ${plural(nm,'остался','осталось','осталось')} ${count(nm)}</p>`;
  } else {
    heading = cfg.grp ? 'Папка пройдена' : cfg.block ? `Блок ${S.block+1} пройден` : 'Круг завершён';
    primary = `<button class="btn btn-primary" type="button" data-act="restart">${cfg.block ? 'Пройти заново' : 'Новый круг'}</button>`;
    if(nm) after = '<button class="btn btn-secondary btn-block after" type="button" data-act="go" data-mode="mistakes">Работа над ошибками</button>';
  }
  setTop({back: cfg.grp ? myGrpName(S.block) : cfg.block ? 'Блоки' : cfg.dynamic ? 'Ошибки' : cfg.sem ? semName(S.sem) : mode==='quiz' ? 'Тест' : 'Впиши сам', compact:true, score:t, progress:1});
  return `<article class="card" data-swipe>
    <h2 class="summary-title">${heading}</h2>
    <div class="stats">
      <div class="stat is-good"><b>${t.c}</b><span>верно</span></div>
      <div class="stat is-bad"><b>${t.w}</b><span>${plural(t.w,'ошибка','ошибки','ошибок')}</span></div>
    </div>
    ${t.wrong.length
      ? `<div class="label">Ошибки — нажмите, чтобы посмотреть ответ</div><div class="mistakes">${t.wrong.map(d => `<button class="mistake" type="button" data-act="drug" data-d="${DB_INDEX.get(d)}">${esc(d[0])}</button>`).join('')}</div>`
      : skipped.length ? '' : '<p class="perfect">Без единой ошибки!</p>'}
    ${skipHtml}
    ${note}
    <div class="actions">
      <button class="btn btn-secondary" type="button" data-act="prev">Назад</button>
      ${primary}
    </div>
    ${after}
  </article>`;
}

function viewSession(){
  const S = cur(), cfg = SESSION[S.mode], n = S.order.length, t = totals(S);
  if(S.pos >= n) return viewSummary(S, cfg, t);
  if(cfg.kind==='choice') ensureOpts(S);
  const backLabel = cfg.grp ? myGrpName(S.block) : cfg.block ? 'Блоки' : cfg.dynamic ? 'Ошибки' : cfg.sem ? semName(S.sem) : mode==='quiz' ? 'Тест' : 'Впиши сам';
  setTop({back: backLabel, compact:true, score:t, progress:S.pos/n, count:`${S.pos+1} / ${n}`});
  const d = S.order[S.pos];
  const st = S.state[S.pos];
  const primary = st.checked
    ? `<button class="btn btn-primary" id="primary" type="button" data-act="next">${S.pos===n-1 ? 'Завершить' : 'Далее'}</button>`
    : `<button class="btn btn-primary" id="primary" type="button" data-act="check"${kindOf(S).ready(st) ? '' : ' disabled'}>Проверить</button>`;
  if(cfg.kind==='write'){
    const actions = `<div class="actions">
      <button class="btn btn-secondary" type="button" data-act="prev"${S.pos===0 ? ' disabled' : ''}>Назад</button>
      ${primary}
    </div>`;
    if(st.checked) return viewWriteBack(d, st, '', actions);
    return `<article class="card" data-swipe>
      ${drugHead(d, {withInfo:true, masked:true, favorite:true})}
      ${writeFields(st)}
      ${actions}
    </article>`;
  }
  return `<article class="card card-choice" data-swipe>
    ${drugHead(d, {withInfo:true, favorite:true})}
    ${choiceFields(st, rightOf(d))}
    <div class="actions">
      <button class="btn btn-secondary" type="button" data-act="prev"${S.pos===0 ? ' disabled' : ''}>Назад</button>
      ${primary}
    </div>
  </article>`;
}

function viewCards(){
  const b = cardSet(cards.block), n = b.items.length;
  if(!n){
    const fav = cards.block==='fav';
    setTop({back: fav ? 'Меню' : 'Мои рецепты', title:b.title});
    return `<div class="empty"><p>${fav ? 'В избранном пока пусто. Нажмите ☆ на карточке препарата.' : 'Здесь пока нет рецептов.'}</p></div>`;
  }
  cards.pos = Math.min(Math.max(cards.pos, 0), n-1);
  const d = b.items[cards.pos];
  setTop({back: cardsBack==='groupList' ? 'Блоки' : cardsBack==='tests' ? 'Тесты' : cardsBack==='menu' ? 'Меню' : cardsBack==='myGroup' ? myGrpName(curGrp) : 'Темы', title: cardsBack==='groupList' ? `Блок ${b.num}` : b.title, count:`${cards.pos+1} / ${n}`, progress:(cards.pos+1)/n});
  return `<article class="card card-study" data-swipe>
    ${favoriteButton(d)}
    <div class="card-tag"><span class="chip">${esc(grpText(d))}</span></div>
    ${drugHead(d)}
    ${(() => { const mine = MY_SET.has(d) && MY_ACTIVE.find(m => m.d===d);
      return mine ? `<dl class="facts">${facts([[FIELDS.dose, d[1]], [FIELDS.route, d[2]]])}</dl><div class="my-prev">${myrxBlank(mine.r)}</div>` : drugFacts(d, true); })()}
    <p class="swipe-hint">Смахните карточку, чтобы перейти к соседней</p>
    <div class="actions">
      <button class="btn btn-secondary" type="button" data-act="cardPrev"${cards.pos===0 ? ' disabled' : ''}>Назад</button>
      ${cards.pos===n-1
        ? '<button class="btn btn-primary" type="button" data-act="cardRestart">Пройти заново</button>'
        : '<button class="btn btn-primary" type="button" data-act="cardNext">Далее</button>'}
    </div>
  </article>`;
}


/* =========================================================
   РАСТЯЖЕНИЕ ВАРИАНТОВ ОТВЕТОВ
   Высота вариантов подбирается так, чтобы страница прокручивалась вниз
   на высоту самой большой шапки препарата (название + латынь + поля вокруг),
   после чего варианты дополнительно увеличиваются в OPT_SCALE раз — запас прокрутки получается чуть больше.
   ========================================================= */
const headCache = {};
/* Стабильная высота экрана: innerHeight на телефоне меняется при скролле (панель браузера
   прячется/появляется) и из-за этого кнопки пересчитывались «на лету». 100lvh от панели не зависит. */
let vhProbe = null;
function stableVH(){
  try{
    if(!vhProbe){
      vhProbe = document.createElement('div');
      vhProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100lvh;visibility:hidden;pointer-events:none';
      document.body.appendChild(vhProbe);
    }
    const h = vhProbe.getBoundingClientRect().height;
    if(h > 0) return h;
  }catch{}
  return Math.max(innerHeight, (screen && screen.height) ? Math.min(screen.height, innerHeight + 140) : 0);
}
/* [Оптимизация 1] Высота самого высокого заголовка препарата (название + латынь) среди всей DB.
   Результат кэшируется по «ширина заголовка × высота экрана» и сбрасывается после загрузки шрифтов (они меняют высоту строк).
   Измерение: все варианты заголовка сразу в одном скрытом контейнере, затем чтение offsetHeight у каждого —
   браузер пересчитывает раскладку один раз (при вставке контейнера), а не по разу на каждый препарат.
   Важно: измеряемые блоки должны иметь те же классы (drug has-count …), что и настоящий заголовок, иначе стили не совпадут. */
function tallestHeader(){
  const card = view.querySelector('.card'), head = card && card.querySelector('.drug');
  if(!head) return 0;
  const key = head.offsetWidth + 'x' + Math.round(stableVH());
  if(headCache[key] != null) return headCache[key];
  // Все заголовки кладём в один скрытый контейнер и измеряем за один пересчёт раскладки
  // (раньше на каждый препарат был отдельный принудительный layout — ~170 штук при первой отрисовке)
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;left:0;top:0;width:' + head.offsetWidth + 'px;visibility:hidden;pointer-events:none';
  box.innerHTML = DB.map(d => `<div class="drug has-count"><div class="drug-row"><h2 class="drug-name">${esc(d[0])}</h2> <button class="btn-info" type="button">i</button></div><div class="drug-latin">${esc(d[4])}</div></div>`).join('');
  card.appendChild(box);
  let max = 0;
  for(const el of box.children) max = Math.max(max, el.offsetHeight);
  box.remove();
  return headCache[key] = max + (parseFloat(getComputedStyle(head).marginBottom) || 0);
}
function fitOpts(){
  const y0 = scrollY;
  fitOptsRaw();
  if(Math.abs(scrollY - y0) > 1) scrollTo({top:y0, behavior:'instant'});
}
const OPT_MAX = 160;   // верхняя граница подгоняемой высоты варианта, px
/* [Оптимизация 2] Подгонка высоты вариантов ответа под экран без двоичного поиска.
   Каждый вариант имеет min-height = h, поэтому его высота — max(c_i, h), где c_i — естественная высота по тексту.
   Высота всего экрана: H(h) = H0 + Σ max(0, h − c_i), где H0 — высота при h = 0. Это ломаная линия, и нужное h
   находится прямо: идём по c_i по возрастанию и «набираем» недостающие free = target − H0 пикселей.
   Параметры: H0 — высота экрана при h = 0, cs — естественные высоты вариантов, target — желаемая высота экрана.
   Возвращает h (с запасом 0,05 px, не больше OPT_MAX) или null, если решения нет. */
function solveOptH(H0, cs, target){
  const n = cs.length, free = target - H0;
  if(!n || !(free > 0) || cs.some(c => !(c >= 0))) return null;
  cs = cs.slice().sort((a, b) => a - b);
  let acc = 0;
  for(let i = 0; i < n; i++){
    const next = i + 1 < n ? cs[i + 1] : Infinity, need = (i + 1) * (next - cs[i]);
    if(acc + need >= free) return Math.max(0, Math.min(cs[i] + (free - acc) / (i + 1), OPT_MAX) - 0.05);
    acc += need;
  }
  return null;
}
const OPT_SCALE = 1.2;   // во сколько раз варианты ответов крупнее подогнанного размера
function fitOptsRaw(){
  const S = cur();
  const on = false;   // растягивание вариантов отключено: спокойные варианты естественной высоты
  view.classList.toggle('fit-opts', on);
  view.style.removeProperty('--opt-h');
  if(!on || !view.querySelector('.opt')) return;
  const app = document.querySelector('.app');
  const target = stableVH() + tallestHeader();
  const heightAt = h => { view.style.setProperty('--opt-h', h + 'px'); return app.getBoundingClientRect().height; };
  const H0 = heightAt(0);
  if(H0 >= target){ view.classList.remove('fit-opts'); view.style.removeProperty('--opt-h'); return; }
  // Решаем уравнение из solveOptH сразу и проверяем ответ одним измерением (допуск: не выше target + 0,5 px и
  // не ниже target − 1,5 px, если не упёрлись в OPT_MAX). Если CSS раскладки поменяется и формула перестанет
  // выполняться, проверка не пройдёт и сработает прежний двоичный поиск ниже: результат останется верным, просто медленнее.
  let lo = solveOptH(H0, [...view.querySelectorAll('.card .opt')].map(el => el.getBoundingClientRect().height), target);
  if(lo !== null){
    const f = heightAt(lo);
    if(!(f <= target + 0.5 && (lo >= OPT_MAX - 0.1 || f >= target - 1.5))) lo = null;
  }
  if(lo === null){
    lo = 0;
    let hi = OPT_MAX;
    while(hi - lo > 0.05){
      const mid = (lo + hi) / 2;
      if(heightAt(mid) <= target) lo = mid; else hi = mid;
    }
  }
  view.style.setProperty('--opt-h', (lo * OPT_SCALE).toFixed(2) + 'px');   // подогнали по экрану, затем увеличили в 1,2 раза
}
let fitTimer = 0, fitW = innerWidth;
addEventListener('resize', () => {
  if(innerWidth === fitW) return;          // изменилась только высота (панель браузера при скролле) — ничего не пересчитываем
  fitW = innerWidth;
  clearTimeout(fitTimer); fitTimer = setTimeout(fitOpts, 120);
});
if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => { for(const k in headCache) delete headCache[k]; fitOpts(); });


/* =========================================================
   «МОИ РЕЦЕПТЫ»: собственные рецепты пользователя.
   Хранятся в localStorage отдельно от прогресса тестов.
   ========================================================= */
const MYRX_FORMS = [
  {id:'tab',    title:'Таблетки',  ph:'0,1',            num:true, unit:'таблеток', routes:['внутрь', 'сублингвально', 'рассасывание в полости рта'], dose:'по 1 таблетке'},
  {id:'caps',   title:'Капсулы',   ph:'0,0004',         num:true, unit:'капсул',   routes:['внутрь'], dose:'по 1 капсуле'},
  {id:'amp',    title:'Ампулы',    ph:'1%',             num:true, unit:'ампул', vol:true, conc:true, routes:['в/в', 'в/м', 'п/к', 'внутрь', 'инфильтрационно'], dose:'по 1 мл'},
  {id:'flac',   title:'Флакон', ph:'0,1%',    vol:true, conc:true, routes:['внутрь', 'в/в', 'местно', 'интраназально', 'капли'], dose:'по 1 столовой ложке'},
  {id:'tinct',  title:'Настойка',  vol:true, nodose:true, routes:['внутрь', 'капли', 'местно'], dose:'по 20 капель'},
  {id:'supp',   title:'Свечи',     ph:'500 000 ED',     num:true, unit:'свечей', routes:['ректально'], dose:'по 1 свече'},
  {id:'powder', title:'Порошок',   ph:'1,0',            num:true, unit:'порошков', routes:['внутрь', 'местно'], dose:'по 1 порошку'},
  {id:'aerosol',title:'Аэрозоль',  ph:'0,00002 г/доза', routes:['ингаляционно', 'интраназально', 'местно'], dose:'по 1 вдоху'}
];
const myrxForm = id => MYRX_FORMS.find(f => f.id===id) || MYRX_FORMS[0];
const myrxBlankDraft = () => ({id:'', form:'tab', drug:'', latin:'', dose:'', vol:'', num:'', signa:'', group:'', route:'', tests:[], abbr:false});
let rxDraft = null;
function myrxLoad(){   // [Оптимизация 4] разбор — в loadCached; копия: у рецепта свой массив tests, его правят отдельно
  return loadCached(MYRX_KEY, v => Array.isArray(v) ? v.filter(x => x && typeof x==='object' && x.id).map(x => ({...myrxBlankDraft(), ...x, tests: Array.isArray(x.tests) ? x.tests.filter(t => MYRX_TEST_ID.test(t)) : []})).map(x => x.drug && x.drug.trim() ? x : {...x, drug: String(x.latin || '').trim()}) : [],
    list => list.map(x => ({...x, tests: [...x.tests]})));
}
const MYRX_MAX = 1000;   // предел числа своих рецептов
const myrxStore = list => store.set(MYRX_KEY, list);
function myrxStorageFail(){
  openSheet(`<h2 class="sheet-title" id="sheetTitle">Не удалось сохранить</h2>
    <p class="sheet-text">Память устройства для приложения заполнена или недоступна, изменения не записаны. Удалите ненужные рецепты или освободите место и повторите. Кнопка «Отправить рецепты» сохранит ваши рецепты в файл.</p>${CLOSE_BTN}`);
}
// Есть ли незаконченный прогресс в этих тестах (id как в «Добавить в тесты»)
function myrxHasProgress(ts){
  const sv = (m, key) => key==null ? store.get(KEYS[m]) : SESSION[m].sem ? semRead(m)[key] : readAll(KEYS[m])[key];
  for(const t of ts){
    let list = [];
    if(t==='exam') list = [['quiz'], ['write']];
    else if(/^s\d$/.test(t)) list = [['semQuiz', +t[1]], ['semWrite', +t[1]]];
    else if(/^b\d$/.test(t)) list = [['study', +t[1]], ['writeBlock', +t[1]]];
    else if(t.startsWith('g_')) list = [['grpQuiz', t.slice(2)], ['grpWrite', t.slice(2)]];
    if(list.some(([m, k]) => savedHasProgress(m, sv(m, k)))) return true;
  }
  return false;
}

// Строки рецепта; пустые поля показываются красным многоточием
function myrxLines(r, plain){
  const raw = x => String(x||'').trim();
  const f = x => plain ? raw(x) : (raw(x) ? esc(raw(x)) : GAP);
  const L = f(r.latin), D = f(r.dose), V = f(r.vol), N = f(r.num), S = f(r.signa);
  switch(r.form){
    case 'caps':  return [['Recipe: ' + L + ' ' + D, ''], ['Da tales doses numero ' + N + ' in capsulis', 'in1'], ['Signa: ' + S, 'in1']];
    case 'supp':  return [['Recipe: Suppositoria ' + L + ' ' + D, ''], ['Da tales doses numero ' + N, 'in1'], ['Signa: ' + S, 'in1']];
    case 'powder':return [['Recipe: ' + L + ' ' + D, ''], ['Da tales doses numero ' + N + ' in flaconibus', 'in1'], ['Signa: ' + S, 'in1']];
    case 'amp':   return [['Recipe: Solutionis ' + L + ' ' + D + ' — ' + V + ' ml', ''], ['Da tales doses numero ' + N + ' in ampullis', 'in1'], ['Signa: ' + S, 'in1']];
    case 'flac':  return [['Recipe: Solutionis ' + L + ' ' + D + ' — ' + V + ' ml', ''], ['Da. Signa: ' + S, 'in1']];
    case 'tinct': return [['Recipe: Tincturae ' + L + ' ' + V + ' ml', ''], ['Da. Signa: ' + S, 'in1']];
    case 'aerosol':return [['Recipe: Aerosolum ' + L + ' ' + D, ''], ['Da. Signa: ' + S, 'in1']];
    default:      return [['Recipe: Tabulettas ' + L + ' ' + D, ''], ['Da tales doses numero ' + N, 'in1'], ['Signa: ' + S, 'in1']];
  }
}
// Бланк с рецептом; в полной записи длинные строки сами переходят на сокращения (fitRx)
function myrxBlank(r, noStamp){
  const lines = myrxLines(r), short = rxShort(lines);
  const body = `<div class="rxd wr-rx" data-short="${esc(rxDoc(short))}">${rxDoc(lines)}</div>`;   // сокращения включаются сами, если строка не помещается (fitRx)
  return `<div class="blank wr-blank">${body}</div>`;
}
function myrxPlain(r){
  const lines = myrxLines(r);
  const tmp = document.createElement('div');
  const text = lines.map(([t]) => { tmp.innerHTML = t; return tmp.textContent; });
  return text.map((t, i) => i ? '    ' + t : t).join('\n') + (String(r.group).trim() ? '\n(' + String(r.group).trim() + ')' : '');
}
// Чего не хватает рецепту, чтобы он работал в тестах и карточках
function myrxMissing(r){
  const f = k => String(r[k]||'').trim();
  return [['drug', 'название'], ['latin', 'латынь'], ['signa', 'Signa'], ['route', 'путь введения'], ['group', 'группа']].filter(([k]) => !f(k)).map(x => x[1]);
}
// Путь введения и группа для вставленного текста: по латинскому названию из справочника, иначе по словам в Signa
function myrxGuess(r){
  const lat = x => normalizeAnswer(String(x).replace(/\s*\(.*\)\s*$/, ''));
  const key = lat(r.latin);
  const d = key ? DB.slice(0, BASE_LEN).find(x => lat(x[4])===key) : null;
  if(d){ if(!r.route) r.route = d[2]; if(!r.group) r.group = d[3]; }
  if(!r.route){
    const t = String(r.signa).toLowerCase();
    const map = [[/внутривенно|\bв\/в\b/, 'в/в'], [/внутримышечно|\bв\/м\b/, 'в/м'], [/подкожно|\bп\/к\b/, 'п/к'], [/сублингвально/, 'сублингвально'],
      [/ингаляц/, 'ингаляционно'], [/интраназально|в нос/, 'интраназально'], [/ректально/, 'ректально'], [/местно|наружно/, 'местно'], [/внутрь|перорально/, 'внутрь']];
    const hit = map.find(([re]) => re.test(t));
    if(hit) r.route = hit[1];
  }
}
function myrxError(r){
  const F = myrxForm(r.form);
  if(!r.drug.trim()) return 'Впишите название препарата — из справочника или своё.';
  if(!r.latin.trim()) return 'Впишите латинское название препарата.';
  if(/[А-Яа-яЁё]/.test(r.latin)) return 'Название пишется латиницей, в родительном падеже (например, Labetaloli).';
  if(!F.nodose && !r.dose.trim()) return F.conc ? 'Укажите концентрацию.' : 'Укажите дозировку.';
  if(F.vol && !r.vol.trim()) return 'Укажите объём в миллилитрах.';
  if(F.num && !r.num.trim()) return 'Укажите число доз.';
  if(!r.signa.trim()) return 'Напишите Signa — инструкцию для пациента.';
  const key = r.drug.trim().toLowerCase();
  if(DB.slice(0, BASE_LEN).some(d => d[0].trim().toLowerCase()===key))
    return 'Препарат с таким названием уже есть в справочнике. Измените название (например, добавьте «(мой)»).';
  if(myrxLoad().some(x => x.id!==r.id && x.drug.trim().toLowerCase()===key))
    return 'Среди ваших рецептов уже есть препарат с таким названием.';
  if(!r.route.trim()) return 'Укажите путь введения (например, внутрь или в/в).';
  if(!r.group.trim()) return 'Укажите фармакологическую группу.';
  return '';
}
// Подстановка из справочника: форма, латынь, дозировка, объём, число доз, Signa и группа
function myrxFill(r, d){
  const seg = rxSegments(d[1])[0], kind = rxKind(seg), parts = routeParts(d[2]);
  const hasInj = parts.some(p => INJ_ROUTE.has(p)), hasOther = parts.some(p => !INJ_ROUTE.has(p));
  const ed = x => x.replace(/ЕД/g, 'ED').replace(/МЕ/g, 'ME');
  const num = x => ed(x.replace(/\s*(таб|капс|супп)\.?\s*$/i, '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s*г\s*$/, '').trim());
  r.latin = String(d[4]).replace(/\s*\(.*\)\s*$/, '');
  r.group = d[3]; r.route = d[2]; r.dose = ''; r.vol = ''; r.num = ''; r.signa = '';
  if(kind==='tab' || kind==='caps' || kind==='supp' || kind==='powder'){ r.form = kind; r.dose = num(seg); }
  else if(kind==='aerosol'){ r.form = 'aerosol'; r.dose = seg.replace(/,?\s*аэрозоль.*$/i, '').trim(); }
  else if(kind==='tincture'){ r.form = 'tinct'; const m = seg.match(/(\d+(?:[.,]\d+)?)\s*мл/); r.vol = m ? m[1] : ''; }
  else {
    const m = seg.match(/^(.*?)\s*(\d+(?:[.,]\d+)?)\s*мл\s*$/);
    if(m){
      r.dose = m[1].replace(/\s*масляный\s*р-р/i, '').trim(); r.vol = m[2];
      const v = parseFloat(m[2].replace(',', '.')) || 0;
      r.form = hasInj && (!hasOther || v < 5) ? 'amp' : 'flac';
    } else { r.form = 'powder'; r.dose = num(seg); }
  }
  const rx = RX_DATA[d[0]];
  if(rx){
    for(const [t] of rx){
      let m;
      if((m = t.match(/numero\s+(\d+)/))) r.num = m[1];
      if((m = t.match(/^(?:Da\. )?Signa:\s*(.*)$/))) r.signa = m[1].replace(/<[^>]+>/g, '').trim();
    }
  }
  if(!r.signa) r.signa = rxRoute(d[2], hasInj ? true : null) + ', ';
}

const myrxTests = () => [
  {id:'exam', title:'Экзамен', short:'Экзамен'},
  ...SEMESTERS.map((_, i) => ({id:'s' + i, title:(i ? 'II' : 'I') + ' семестр (зачёт)', short:(i ? 'II' : 'I') + ' семестр'})),
  ...BLOCKS.map((b, i) => ({id:'b' + i, title:'Блок ' + (i + 1) + '. ' + b.title, short:'Блок ' + (i + 1)})),
  ...myGrpLoad().map(g => ({id:'g_' + g.id, title:'Папка «' + g.name + '»', short:g.name}))
];
const rxTopicsSet = new WeakSet();   // у черновика отмечено «По темам» (ещё до выбора самой темы)
const isBlockTest = t => /^b\d$/.test(t.id);
const myrxTopicsOn = r => rxTopicsSet.has(r) || r.tests.some(id => /^b\d$/.test(id));
const myrxTestsSummary = r => {
  const all = myrxTests().filter(t => !isBlockTest(t) && r.tests.includes(t.id)).map(t => t.short);
  if(myrxTopicsOn(r)) all.push('По темам');
  return all.length ? all.join(', ') : 'Не добавлять в тесты';
};
const myrxTopicSummary = r => {
  const all = myrxTests().filter(t => isBlockTest(t) && r.tests.includes(t.id)).map(t => t.short);
  return all.length ? all.join(', ') : 'Выберите тему';
};
const myrxTestsText = r => {
  const all = myrxTests().filter(t => r.tests.includes(t.id)).map(t => t.short);
  return all.length ? 'В тестах: ' + all.join(' · ') : 'Не добавлен в тесты';
};
// Неполный рецепт (старый, сохранённый без группы или пути введения) или с занятым названием: в тестах не участвует
function myrxProblem(r){
  if(MY_ACTIVE.some(m => m.id===r.id)) return '';
  const miss = myrxMissing(r);
  return miss.length ? 'Не хватает: ' + miss.join(', ') + '. Нажмите «Изменить» и дополните — тогда рецепт появится в тестах и карточках.'
    : 'Название совпадает с другим препаратом. Нажмите «Изменить» и переименуйте — тогда рецепт появится в тестах и карточках.';
}
// ===== Экспорт и импорт своих рецептов (файл .json) =====
const MYRX_NOTE = 'pharma_myrx_note';
const MYRX_EXPORT_FIELDS = ['form', 'drug', 'latin', 'dose', 'vol', 'num', 'signa', 'group', 'route', 'tests', 'abbr'];
// Файл из выбранных рецептов; папки, в которых они лежат, едут вместе с ними (название и id)
function myrxBuildFor(recs, pretty){
  const ids = new Set(recs.flatMap(r => r.tests.filter(t => t.startsWith('g_')).map(t => t.slice(2))));
  const gl = myGrpLoad().filter(g => ids.has(g.id));
  const data = {app:'pharma-recipes', version:1, exported:new Date().toISOString(), ...(gl.length ? {groups:gl} : {}),
    recipes: recs.map(r => { const o = {}; MYRX_EXPORT_FIELDS.forEach(k => o[k] = r[k]); return o; })};
  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}
function myrxDownload(text, name){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type:'application/json'}));
  a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
// Из чужого файла берём только известные поля нужного типа и длины
function myrxSanitize(x){
  if(!x || typeof x!=='object' || Array.isArray(x)) return null;
  const r = {...myrxBlankDraft(), form: MYRX_FORMS.some(f => f.id===x.form) ? x.form : 'tab'};
  for(const k of ['drug', 'latin', 'dose', 'vol', 'num', 'signa', 'group', 'route'])
    r[k] = (typeof x[k]==='string' || (typeof x[k]==='number' && isFinite(x[k]))) ? String(x[k]).trim().slice(0, 300) : '';   // объекты, списки и т. п. — пусто
  r.tests = Array.isArray(x.tests) ? [...new Set(x.tests.filter(t => typeof t==='string' && MYRX_TEST_ID.test(t)))] : [];
  r.abbr = false;   // сокращения подбираются автоматически
  if(!r.drug && r.latin) r.drug = r.latin;   // название обязательно: у старых файлов берём латинское
  return r;
}
const myrxKey = r => [r.form, r.drug, r.latin, r.dose, r.vol, r.num, r.signa].map(v => String(v).trim().toLowerCase()).join('|');
const MYRX_ICO = {
  paste: svgIcon('<rect x="6" y="5" width="12" height="15.5" rx="2"/><path d="M9.5 5V4h5v1"/><path d="M9 11h6M9 14.5h4"/>'),
  down:  svgIcon('<path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>'),
  up:    svgIcon('<path d="M12 15V4"/><path d="M7.5 8.5L12 4l4.5 4.5"/><path d="M5 19.5h14"/>'),
  copy:  svgIcon('<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>'),
  share: svgIcon('<circle cx="6" cy="12" r="2.2"/><circle cx="17.5" cy="6" r="2.2"/><circle cx="17.5" cy="18" r="2.2"/><path d="M8 11l7.5-4M8 13l7.5 4"/>'),
  file:  svgIcon('<path d="M6 3.5h8l4 4V20a.5.5 0 0 1-.5.5H6.5A.5.5 0 0 1 6 20V4a.5.5 0 0 1 0-.5z"/><path d="M14 3.5V8h4"/>'),
  ok:    svgIcon('<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.7 2.7 5.3-5.6"/>'),
  trash: svgIcon('<path d="M5 7h14"/><path d="M9.5 7V4.5h5V7"/><path d="M7 7l.8 12.5h8.4L17 7"/>'),
  warn:  svgIcon('<path d="M12 4l9 16H3z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.3" r=".6" fill="currentColor"/>')
};
const myrxRecipes = n => n + ' ' + plural(n, 'рецепт', 'рецепта', 'рецептов');
let myrxPlanCur = null, myrxLastText = '';

// Меняем содержимое уже открытого окна без повторного появления
function myrxSheet(inner){
  const sh = sheetRoot.querySelector('.sheet');
  if(!sh){ openSheet(inner); return; }
  sh.innerHTML = '<div class="sheet-handle"></div>' + inner;
  kbBarHide();
  sh.scrollTop = 0; sh.focus({preventScroll:true});
}

/* ---------- Отправка: все / выбранные / папка → файл → «Поделиться» (или скачивание) ---------- */
let myrxSend = {mode:'all', pick:new Set(), folder:''};
function myrxSendRecs(){
  const list = myrxLoad(), s = myrxSend;
  if(s.mode==='pick') return list.filter(r => s.pick.has(r.id));
  if(s.mode==='folder') return list.filter(r => r.tests.includes('g_' + s.folder));
  return list;
}
function myrxSendName(){
  const d = new Date().toISOString().slice(0, 10), g = myGrpLoad().find(x => x.id===myrxSend.folder);
  const TR = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};   // кириллица в имени файла ломает скачивание на части устройств; полное название папки лежит внутри файла
  const slug = g && myrxSend.mode==='folder' ? g.name.toLowerCase().replace(/[а-яё]/g, c => TR[c]).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) : '';
  return (slug ? slug : 'my-recipes') + '-' + d + '.json';
}
function myrxSendBtn(){
  const n = myrxSendRecs().length;
  return 'Отправить' + (n ? ' ' + n : '');
}
function myrxSendHtml(msg, bad){
  const list = myrxLoad(), s = myrxSend;
  const folders = myGrpLoad().map(g => ({g, n:list.filter(r => r.tests.includes('g_' + g.id)).length})).filter(x => x.n);
  if(s.mode==='folder' && !folders.some(x => x.g.id===s.folder)) s.folder = folders.length ? folders[0].g.id : '';
  if(s.mode==='folder' && !folders.length) s.mode = 'all';
  const tabs = [['all', 'Все'], ['pick', 'Выбранные'], ...(folders.length ? [['folder', 'Папка']] : [])];
  const body = s.mode==='pick'
    ? `<div class="my-togs is-col my-gadd">${list.map(r => `<label class="my-tog${s.pick.has(r.id) ? ' is-on' : ''}"><input type="checkbox" data-sendpick="${esc(r.id)}"${s.pick.has(r.id) ? ' checked' : ''}><span>${esc(r.drug || r.latin || 'Без названия')}</span></label>`).join('')}</div>
       <button class="my-linkbtn" type="button" data-act="myrxSendAll">${s.pick.size===list.length ? 'Снять все отметки' : 'Отметить все'}</button>`
    : s.mode==='folder'
    ? `<div class="my-togs is-col">${folders.map(x => `<button class="my-tog${x.g.id===s.folder ? ' is-on' : ''}" type="button" data-act="myrxSendFolder" data-g="${esc(x.g.id)}"><span>${esc(x.g.name)} · ${x.n}</span></button>`).join('')}</div>`
    : `<p class="sheet-text">Все ваши рецепты (${myrxRecipes(list.length)}) уйдут одним файлом.</p>`;
  return `<h2 class="sheet-title" id="sheetTitle">Отправить рецепты</h2>
    <nav class="tabs my-tabs" aria-label="Что отправить">${tabs.map(([m, t]) => `<button class="tab${m===s.mode ? ' is-active' : ''}" type="button" data-act="myrxSendMode" data-m="${m}">${t}</button>`).join('')}</nav>
    ${body}
    <p class="my-status${bad ? ' is-bad' : ''}" id="myrxStatus" role="status" aria-live="polite"${msg ? '' : ' hidden'}>${esc(msg || '')}</p>
    <div class="actions actions-even">
      <button class="btn btn-secondary" type="button" data-act="close">Закрыть</button>
      <button class="btn btn-primary" type="button" id="myrxSendGo" data-act="myrxSendGo">${myrxSendBtn()}</button>
    </div>`;
}
function myrxOpenSend(){
  if(!myrxLoad().length){
    openSheet(`<h2 class="sheet-title" id="sheetTitle">Отправить рецепты</h2>
      <p class="sheet-text">Отправлять пока нечего. Создайте рецепт — и его можно будет отправить.</p>${CLOSE_BTN}`);
    return;
  }
  myrxSend = {mode:'all', pick:new Set(), folder:''};
  openSheet(myrxSendHtml());
}
function myrxStatus(msg, bad){
  const st = $id('myrxStatus'); if(!st) return;
  st.textContent = msg; st.classList.toggle('is-bad', !!bad); st.hidden = false;
}
/* ---------- Импорт: шаг 1 — источник, шаг 2 — проверка, затем добавление ---------- */
function myrxImpHtml1(){
  const canClip = !!(navigator.clipboard && navigator.clipboard.readText);
  return `<h2 class="sheet-title" id="sheetTitle">Загрузить рецепты</h2>
    <input type="file" id="myrxFile" class="my-file-in" accept=".json,.txt,application/json,text/plain">
    <label class="my-drop" for="myrxFile" id="myrxDrop">${MYRX_ICO.file}<b>Выбрать файл</b>
      <small>Файл .json или текстовый файл с рецептами<span class="my-drop-dd">. Можно перетащить сюда</span></small></label>
    <p class="my-or"><span>или вставьте текст</span></p>
    <textarea class="input my-ta is-short" id="myrxText" rows="4" placeholder='Recipe: …  или  {"recipes": [ … ]}' spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Текст рецептов">${esc(myrxLastText)}</textarea>
    ${canClip ? `<button class="my-linkbtn" type="button" data-act="myrxPasteClip">${MYRX_ICO.copy}Вставить из буфера</button>` : ''}
    <p class="my-err" id="myrxImpErr" role="alert" hidden></p>
    <div class="actions actions-even">
      <button class="btn btn-secondary" type="button" data-act="close">Отмена</button>
      <button class="btn btn-primary" type="button" data-act="myrxImpText">Загрузить</button>
    </div>`;
}
function myrxImpErr(msg){
  const e = $id('myrxImpErr'); if(!e) return;
  e.textContent = msg; e.hidden = false;
  try{ e.scrollIntoView({block:'nearest', behavior:'smooth'}); }catch(_){}
}
// Одно окно на всё: JSON (из файла или текста) и обычный рецепт, который разбирает бот
const myrxLooksJson = t => /^\s*[\[{]/.test(t) || /"recipes"\s*:/.test(t);
function myrxImpRun(text){
  if(!String(text).trim()){ myrxImpErr('Выберите файл или вставьте текст.'); return; }
  if(myrxLooksJson(text)) myrxJsonRun(text); else myrxBotRun(text);
}
// Вернуться к окну загрузки с сообщением об ошибке
function myrxBack(msg){ myrxSheet(myrxImpHtml1()); myrxImpErr(msg); }
function myrxImpFile(file){
  if(!file) return;
  if(file.size > 1024 * 1024){ myrxImpErr('Файл слишком большой для списка рецептов (больше 1 МБ).'); return; }
  const fr = new FileReader();
  fr.onload = () => { myrxLastText = ''; myrxImpRun(String(fr.result || '')); };
  fr.onerror = () => myrxImpErr('Не удалось открыть файл.');
  fr.readAsText(file);
}

// Из чужого файла разбираем всё, но ничего не сохраняем — только план
function myrxJsonSrc(text){
  let data;
  try{ data = JSON.parse(text); }
  catch(_){
    const m = String(text).match(/[\[{][\s\S]*[\]}]/);       // текст мог попасть из мессенджера с лишними словами вокруг
    try{ data = m ? JSON.parse(m[0]) : null; }catch(__){ data = null; }
    if(data===null) return {error:'Это не похоже на рецепты. Нужен файл или текст, созданный кнопкой «Отправить рецепты».'};
  }
  if(data && !Array.isArray(data) && typeof data==='object'){
    if(data.app!==undefined && data.app!=='pharma-recipes') return {error:'Этот файл создан другим приложением.'};
    if(typeof data.version==='number' && data.version > 1) return {error:'Файл создан более новой версией приложения. Обновите приложение и повторите.'};
  }
  const src = Array.isArray(data) ? data : (data && Array.isArray(data.recipes) ? data.recipes : null);
  if(!src) return {error:'В файле нет списка рецептов.'};
  if(!src.length) return {error:'Список рецептов пуст.'};
  return {data, src};
}
function myrxPlan(text, fill){
  const pr = myrxJsonSrc(text); if(pr.error) return pr;
  const data = pr.data, src = fill || pr.src;
  // группы из файла: совпавшие по id или названию привязываем к своим, остальные создадим
  const gl = myGrpLoad(), gmap = new Map(), groups = []; let groupsCut = 0;
  if(!Array.isArray(data) && Array.isArray(data.groups)) for(const x of data.groups.slice(0, 30)){
    if(!x || typeof x!=='object') continue;
    const id = String(x.id || ''), name = String(x.name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if(!/^[a-z0-9]{1,12}$/.test(id) || !name) continue;
    const same = gl.find(g => g.id===id) || gl.find(g => g.name.toLowerCase()===name.toLowerCase())
      || groups.find(g => g.id===id || g.name.toLowerCase()===name.toLowerCase());
    if(same){ gmap.set(id, same.id); continue; }
    if(gl.length + groups.length >= 30){ groupsCut++; continue; }
    groups.push({id, name}); gmap.set(id, id);
  }
  const list = myrxLoad(), seen = new Set(list.map(myrxKey)), names = new Set(), localByKey = new Map(list.map(x => [myrxKey(x), x]));
  const room = Math.max(0, MYRX_MAX - list.length);
  const p = {items:[], fresh:[], merge:[], groups, groupsCut, tests:new Set(), dup:0, bad:0, cut:0, over:Math.max(0, src.length - 500)};
  for(const raw of src.slice(0, 500)){
    const r = myrxSanitize(raw);
    if(!r){ p.bad++; p.items.push({st:'bad', name:'Запись без названия', why:'Это не рецепт'}); continue; }
    r.tests = [...new Set(r.tests.map(t => t.startsWith('g_') ? (gmap.has(t.slice(2)) ? 'g_' + gmap.get(t.slice(2)) : '') : t).filter(Boolean))];
    const name = r.drug || r.latin || 'Без названия';
    if(seen.has(myrxKey(r))){
      // такой рецепт уже есть: пропускаем, но если в файле он состоит в группах — добавляем его в эти группы
      const ex = localByKey.get(myrxKey(r));
      const add = ex ? r.tests.filter(t => t.startsWith('g_') && !ex.tests.includes(t)) : [];
      if(add.length && !myrxError({...ex, tests:[...ex.tests, ...add]})){
        p.merge.push({id:ex.id, add}); add.forEach(t => p.tests.add(t));
        p.items.push({st:'dup', name, why:'Уже есть — будет добавлен в папку из файла'});
      } else p.items.push({st:'dup', name, why:'Уже есть в вашем списке — будет пропущен'});
      p.dup++; continue;
    }
    let err = myrxError(r), cut = false;
    if(err && r.tests.length){ r.tests = []; cut = true; err = myrxError(r); }   // для тестов не подошёл — сохраняем только в разделе
    const nm = r.drug.toLowerCase();
    if(err){ p.bad++; p.items.push({st:'bad', name, why:err}); continue; }
    if(names.has(nm)){ p.bad++; p.items.push({st:'bad', name, why:'В файле уже есть препарат с таким названием'}); continue; }
    if(p.fresh.length >= room){ p.bad++; p.items.push({st:'bad', name, why:'Достигнут предел: не больше ' + MYRX_MAX + ' рецептов'}); continue; }
    if(cut) p.cut++;
    names.add(nm);
    seen.add(myrxKey(r)); p.fresh.push(r);
    r.tests.forEach(t => p.tests.add(t));
    p.items.push(cut ? {st:'cut', name, why:'Добавится только в этот раздел: название, группа или путь введения не подходят для тестов'}
                     : {st:'new', name, why:'Будет добавлен'});
  }
  // новые группы создаём только если ими что-то пользуется
  const used = new Set([...p.fresh.flatMap(r => r.tests), ...p.merge.flatMap(m => m.add)]);
  p.groups = p.groups.filter(g => used.has('g_' + g.id));
  return p;
}
function myrxImpHtml2(p){
  const n = p.fresh.length, total = p.items.length, act = n + p.merge.length;
  const MARK = {new:'+', cut:'~', dup:'=', bad:'✕'};
  const stat = (cls, t) => `<span class="my-stat ${cls}">${t}</span>`;
  const stats = [
    n ? stat('is-new', 'Новых: ' + n) : '',
    p.dup ? stat('', 'Уже есть: ' + p.dup) : '',
    p.merge.length ? stat('is-new', 'В папки: ' + p.merge.length) : '',
    p.groups.length ? stat('', 'Новых папок: ' + p.groups.length) : '',
    p.skipped ? stat('', 'Пропущено: ' + p.skipped) : '',
    p.bad ? stat('is-bad', 'Не прошли проверку: ' + p.bad) : ''
  ].join('');
  myrxSheet(`<h2 class="sheet-title" id="sheetTitle">Проверьте перед добавлением</h2>
    <p class="my-sum">В файле ${myrxRecipes(total)}</p>
    <div class="my-stats">${stats}</div>
    ${p.groupsCut ? `<p class="my-warn">Можно иметь не больше 30 папок. Не создано папок: ${p.groupsCut}, их рецепты войдут без папки.</p>` : ''}
    ${p.over ? `<p class="my-warn">За один раз добавляется не больше 500 рецептов. Остальные (${p.over}) не учтены.</p>` : ''}
    <ul class="my-plan" aria-label="Список рецептов из файла">${p.items.map(it => `<li class="my-plan-i is-${it.st}">
      <span class="my-plan-m" aria-hidden="true">${MARK[it.st]}</span>
      <span class="my-plan-t"><b>${esc(it.name)}</b><small>${esc(it.why)}</small></span></li>`).join('')}</ul>
    ${p.tests.size ? `<p class="my-warn">Часть рецептов войдёт в тесты. Прогресс тестов, куда входят ваши рецепты, будет сброшен, а страница обновится.</p>` : ''}
    ${act ? '' : '<p class="my-hint">Добавлять нечего: все рецепты уже есть или не прошли проверку.</p>'}
    <p class="my-err" id="myrxImpErr" role="alert" hidden></p>
    <div class="actions actions-even">
      <button class="btn btn-secondary" type="button" data-act="myrxImpBack">Назад</button>
      <button class="btn btn-primary" type="button" data-act="myrxImpGo"${act ? '' : ' disabled'}>${n ? 'Добавить ' + n : act ? 'Применить' : 'Добавить'}</button>
    </div>`);
}
function myrxImportCommit(){
  const p = myrxPlanCur;
  if(!p || (!p.fresh.length && !p.merge.length)) return;
  const base = Date.now();
  const fresh = p.fresh.map((r, i) => ({...r, id: base.toString(36) + Math.random().toString(36).slice(2, 6) + i, t: base}));
  const before = myrxLoad(), oldGroups = myGrpLoad();
  const cur = before.map(x => { const m = p.merge.find(q => q.id===x.id); return m ? {...x, tests:[...new Set([...x.tests, ...m.add])]} : x; });
  const fail = () => { myrxImpErr('Не удалось сохранить: память устройства заполнена. Освободите место и повторите.'); };
  if(!myrxStore([...fresh, ...cur])){ fail(); return; }
  if(p.groups.length && !store.set(MYGRP_KEY, [...oldGroups, ...p.groups])){ myrxStore(before); fail(); return; }   // откат: рецепты без групп не оставляем
  const lines = [];
  if(p.groups.length) lines.push('Создано папок: ' + p.groups.length);
  if(p.merge.length) lines.push('Уже были, добавлены в папки: ' + p.merge.length);
  if(p.dup - p.merge.length > 0) lines.push('Уже были, пропущены: ' + (p.dup - p.merge.length));
  if(p.groupsCut) lines.push('Папок сверх лимита в 30, не создано: ' + p.groupsCut);
  if(p.cut) lines.push('Добавлены без участия в тестах: ' + p.cut);
  if(p.skipped) lines.push('Пропущено при дополнении: ' + p.skipped);
  if(p.bad) lines.push('Не прошли проверку: ' + p.bad);
  if(p.over) lines.push('Сверх лимита в 500, не учтены: ' + p.over);
  const note = {kind: lines.length ? 'warn' : 'ok', title: fresh.length ? 'Добавлено: ' + myrxRecipes(fresh.length) : 'Рецепты добавлены в папки', lines};
  try{ sessionStorage.setItem(MYRX_NOTE, JSON.stringify(note)); }catch(_){}
  myrxPlanCur = null; myrxLastText = '';
  closeSheet(true);
  // рецепты с тестами меняют наборы вопросов: сбрасываем затронутые прохождения и перезагружаем
  myrxApplied(undefined, true, [...p.tests]);
}
/* ---------- «Вставить»: текст из буфера → Recipe-бот → сохранённые рецепты ---------- */
const MYRX_EXAMPLE = 'Recipe: Solutionis Adrenalini hydrochloridi 0,1% — 1 ml\n    Da tales doses numero 10 in ampullis\n    Signa: по 1 мл подкожно, 1 р/д\n(Альфа- и бета-адреномиметики)';
const MYRX_PASTE_SKIP = /нет строки Da tales doses|не указана форма в строке Da tales doses|нет единицы измерения|нет фармакологической группы|нет строки Signa|после Signa нет текста|не найдена дозировка|строка не распознана/;   // всё это мастер дополнения спросит сам (для таблеток, настоек и т. п. это нормально), после сохранения предупреждать не о чем
// Один рецепт в шаблоне бота → поля рецепта приложения
function myrxFromBot(block){
  let head = '', dtd = '', signa = '', group = '', m;
  for(const l of block.split('\n').map(s => s.trim()).filter(Boolean)){
    if((m = /^Recipe:\s*(.*)$/i.exec(l))) head = m[1];
    else if(/^Da tales doses/i.test(l)) dtd = l;
    else if((m = /^Signa:\s*(.*)$/i.exec(l))) signa = m[1].trim();
    else if(l.charAt(0)==='(') group = l.replace(/^\(\s*/, '').replace(/\s*\)$/, '').trim();
  }
  const r = myrxBlankDraft();
  m = /^(Tabulettas|Solutionis|Suppositoria|Tincturae|Aerosolum)\s+/i.exec(head);
  const pre = m ? m[1].toLowerCase() : '';
  if(m) head = head.slice(m[0].length);
  const im = /(?<![A-Za-zА-Яа-яЁё\d])\d/.exec(head);
  r.latin = (im ? head.slice(0, im.index) : head).replace(/[\s—–,:-]+$/, '').trim();
  r.latin = r.latin.charAt(0).toUpperCase() + r.latin.slice(1);
  let dose = im ? head.slice(im.index).trim() : '';
  const nm = /numero\s+(\d+)/i.exec(dtd); r.num = nm ? nm[1] : '';
  const fw = ((/\bin\s+([a-z]+)/i.exec(dtd) || [])[1] || '').toLowerCase();
  let form;
  if(/^amp/.test(fw)) form = 'amp'; else if(/^tab/.test(fw)) form = 'tab'; else if(/^caps/.test(fw)) form = 'caps';
  else if(/^supp/.test(fw)) form = 'supp'; else if(/^(flac|pulv)/.test(fw)) form = 'powder';
  else if(pre==='tabulettas') form = 'tab'; else if(pre==='suppositoria') form = 'supp';
  else if(pre==='tincturae') form = 'tinct'; else if(pre==='aerosolum') form = 'aerosol';
  else if(pre==='solutionis' || /ml$/i.test(dose)) form = r.num ? 'amp' : 'flac';
  else form = 'tab';
  r.form = form;
  if(form==='amp' || form==='flac' || form==='tinct'){
    const vm = /^(.*?)\s*(?:[—–-]\s*)?(\d+(?:,\d+)?)\s*ml$/i.exec(dose);
    if(vm){ dose = vm[1].replace(/[\s—–-]+$/, ''); r.vol = vm[2]; }
  }
  r.dose = form==='tinct' ? '' : dose;
  if(form!=='amp' && form!=='caps' && form!=='supp' && form!=='powder' && form!=='tab') r.num = '';
  r.signa = signa; r.group = group;
  r.drug = r.latin;   // название обязательно: из вставленного текста берём латинское, потом можно изменить
  return r;
}
/* ---------- Дополнение недостающих данных: один рецепт на экране, только пустые поля ---------- */
let myrxWiz = null;   // {items, todo, pos, keys, cur, note, skip, done}
const myrxGapLabel = (k, F) => ({route:'Путь введения:', group:'Фармакологическая группа:', latin:'Латинское название:',
  dose:F.conc ? 'Концентрация:' : 'Дозировка:', vol:'Объём, мл:', num:'Число доз:', signa:'Signa:'})[k];
const myrxGapHint = (k, F) => ({route:'внутрь, в/в, в/м…', group:'Начните вводить название', latin:'Например: Labetaloli',
  dose:F.ph || '', vol:'1', num:'10', signa:'внутрь, по 1 таблетке 3 раза в день'})[k];
// Чего не хватает рецепту: сначала путь введения и группа, потом остальное
function myrxGaps(r){
  const F = myrxForm(r.form), e = k => !String(r[k] || '').trim(), g = [];
  if(e('route')) g.push('route');
  if(e('group')) g.push('group');
  if(e('latin')) g.push('latin');
  if(!F.nodose && e('dose')) g.push('dose');
  if(F.vol && e('vol')) g.push('vol');
  if(F.num && e('num')) g.push('num');
  if(e('signa')) g.push('signa');
  return g;
}
// items — все разобранные рецепты пачки; done(пропущенные) вызывается, когда дополнять больше нечего
function myrxFillStart(items, done){
  const todo = items.filter(r => myrxGaps(r).length);
  myrxWiz = {items, todo, pos:0, keys:[], cur:{}, note:'', skip:new Set(), done};
  if(!todo.length){ myrxWiz = null; done(new Set()); return; }
  myrxFillShow();
}
function myrxFillShow(){
  const f = myrxWiz;
  f.keys = myrxGaps(f.todo[f.pos]); f.cur = {}; f.note = '';
  myrxFillRender();
}
function myrxFillRender(err){
  const f = myrxWiz, r = f.todo[f.pos], F = myrxForm(r.form), rest = f.todo.slice(f.pos + 1);
  const total = f.items.length, num = f.items.indexOf(r) + 1;
  const field = k => {
    const share = (k==='route' || k==='group') && rest.some(x => !String(x[k] || '').trim());
    return `<div class="my-field"><label class="label" for="myrxF_${k}">${myrxGapLabel(k, F)}</label>
      <input class="input" id="myrxF_${k}" data-fill="${k}" type="text" maxlength="300" value="${esc(f.cur[k] || '')}" placeholder="${esc(myrxGapHint(k, F))}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
      ${share ? `<button class="my-linkbtn" type="button" data-act="myrxFillAll" data-k="${k}">Применить ко всем остальным</button>` : ''}</div>`;
  };
  const last = !f.todo.slice(f.pos + 1).length;
  myrxSheet(`<h2 class="sheet-title" id="sheetTitle">Нужно дополнить рецепт</h2>
    <p class="my-sum">${total > 1 ? 'Рецепт ' + num + ' из ' + total + ' · ' : ''}<b>${esc(r.latin || r.drug || 'Без названия')}</b></p>
    ${f.keys.map(field).join('')}
    ${f.note ? `<p class="my-hint">${esc(f.note)}</p>` : ''}
    <p class="my-err" id="myrxImpErr" role="alert"${err ? '' : ' hidden'}>${esc(err || '')}</p>
    <div class="actions actions-even">
      <button class="btn btn-secondary" type="button" data-act="${total > 1 ? 'myrxFillSkip' : 'close'}">${total > 1 ? 'Пропустить' : 'Отмена'}</button>
      <button class="btn btn-primary" type="button" data-act="myrxFillNext">${last ? 'Готово' : 'Далее'}</button>
    </div>`);
  const first = f.keys.find(k => !f.cur[k]);
  const el = first && $id('myrxF_' + first); if(el) try{ el.focus({preventScroll:true}); }catch(_){}
}
function myrxFillRead(){ const f = myrxWiz; f.keys.forEach(k => { const el = $id('myrxF_' + k); if(el) f.cur[k] = el.value.trim(); }); }
function myrxFillNorm(k, v){   // группа — точное написание из списка, если оно одно
  if(k==='group'){ const h = groupHits(v); if(h.length===1) return h[0]; }
  return v;
}
function myrxFillAdvance(){
  const f = myrxWiz;
  f.pos++;
  while(f.pos < f.todo.length && !myrxGaps(f.todo[f.pos]).length) f.pos++;
  if(f.pos >= f.todo.length){ const done = f.done, skip = f.skip; myrxWiz = null; done(skip); }
  else myrxFillShow();
}

/* ---------- Загрузка: JSON ---------- */
function myrxJsonRun(text){
  const pr = myrxJsonSrc(text); if(pr.error){ myrxImpErr(pr.error); return; }
  const seen = new Set(myrxLoad().map(myrxKey));
  const recs = pr.src.slice(0, 500).map(raw => { const r = myrxSanitize(raw); if(r) myrxGuess(r); return r; });
  myrxFillStart(recs.filter(r => r && !seen.has(myrxKey(r))), skip => {
    const src = [...recs.filter(r => !r || !skip.has(r)), ...pr.src.slice(500)];
    const plan = myrxPlan(text, src); if(plan.error){ myrxBack(plan.error); return; }
    plan.skipped = skip.size;
    myrxPlanCur = plan;
    myrxImpHtml2(plan);
  });
}

/* ---------- Загрузка: обычный текст рецепта (Recipe-бот) ---------- */
function myrxBotRun(text){
  text = String(text || '');
  if(!window.RecipeBot){ myrxImpErr('Модуль разбора рецептов не загрузился. Обновите приложение.'); return; }
  const res = RecipeBot.format(text.replace(/\bDa\.\s*(?=Signa)/gi, ''));   // «Da. Signa» (так копирует приложение для настоек и растворов) → «Signa»
  if(res.error || !res.text){
    myrxImpErr(res.error ? res.error.title + '. ' + res.error.detail + (res.error.example ? '\n\nОжидаемый вид:\n' + MYRX_EXAMPLE : '') : 'В тексте не найден рецепт.');
    return;
  }
  const lines = [], names = new Map();
  const parsed = res.text.split(/\n{2,}/).map(blk => myrxFromBot(blk));
  // «рецепт» без названия, Signa и дозы — это просто лишняя строка перед настоящим рецептом (например, группа, которой нет в словаре): молча пропускаем
  const junk = new Set(parsed.map((r, i) => (!r.latin && !r.signa && !r.dose) ? i + 1 : 0).filter(Boolean));
  const ofJunk = s => { const m = /^Рецепт (\d+):/.exec(s); return !!m && junk.has(+m[1]); };
  // в сообщениях вместо номера — название препарата: «Рецепт Labetaloli: …»; если названия нет, остаётся номер
  const rxName = i => 'Рецепт ' + ((parsed[i - 1] && parsed[i - 1].latin) || i);
  const rename = s => s.replace(/^Рецепт (\d+):/, (_, n) => rxName(+n) + ':');
  const dot = s => /[.!?…]$/.test(s) ? s : s + '.';
  res.fixes.filter(x => !ofJunk(x)).forEach(x => lines.push('Исправлено: ' + dot(rename(x))));
  res.warnings.filter(w => !MYRX_PASTE_SKIP.test(w) && !ofJunk(w)).forEach(w => lines.push(dot(rename(w))));
  const items = [];
  parsed.forEach((r, i) => {
    if(junk.has(i + 1)) return;
    myrxGuess(r);
    if(r.group){                              // группа из текста → точное написание из имеющихся групп, если оно одно
      const h = groupHits(r.group);
      if(h.length===1 && h[0]!==r.group){ lines.push(rxName(i + 1) + ': группа «' + r.group + '» → «' + h[0] + '».'); r.group = h[0]; }
    }
    names.set(r, rxName(i + 1));
    items.push(r);
  });
  myrxFillStart(items, skip => myrxBotCommit(items.filter(r => !skip.has(r)), lines, names, skip.size));
}
function myrxBotCommit(items, lines, names, skipped){
  const list = myrxLoad(), seen = new Set(list.map(myrxKey)), fresh = [], base = Date.now();
  const dot = s => /[.!?…]$/.test(s) ? s : s + '.';
  items.forEach(r => {
    const pfx = names.get(r) + ': ';
    const err = myrxError(r);
    if(err){ lines.push(pfx + dot(err)); return; }
    if(seen.has(myrxKey(r))){ lines.push(pfx + 'такой рецепт уже есть, пропущен.'); return; }
    if(fresh.some(x => x.drug.trim().toLowerCase()===r.drug.trim().toLowerCase())){ lines.push(pfx + 'препарат с таким названием уже добавляется, пропущен.'); return; }
    if(list.length + fresh.length >= MYRX_MAX){ lines.push(pfx + 'не сохранён: предел ' + MYRX_MAX + ' рецептов.'); return; }
    seen.add(myrxKey(r));
    fresh.push({...r, id: base.toString(36) + Math.random().toString(36).slice(2, 6) + fresh.length, t: base});
  });
  if(!fresh.length){
    myrxBack(lines.filter(l => !/^Исправлено/.test(l)).join(' ') || 'Ни один рецепт не сохранён.');
    return;
  }
  if(skipped) lines.push('Пропущено при дополнении: ' + skipped + '.');
  if(!myrxStore([...fresh, ...list])){ myrxStorageFail(); return; }
  const note = {kind: lines.length ? 'warn' : 'ok', title: 'Добавлено: ' + myrxRecipes(fresh.length), lines};
  try{ sessionStorage.setItem(MYRX_NOTE, JSON.stringify(note)); }catch(_){}
  closeSheet(true);
  myrxApplied(undefined, true, []);   // страница перезагружается: DB и блоки собираются при загрузке
}
function myrxNoteHtml(raw){
  if(!raw) return '';
  let n; try{ n = JSON.parse(raw); }catch(_){ n = null; }
  if(!n || typeof n!=='object') n = {kind:'warn', title:String(raw), lines:[]};
  const warn = n.kind==='warn';
  return `<div class="my-res${warn ? ' is-warn' : ''}" role="status">
    <span class="my-res-ico">${warn ? MYRX_ICO.warn : MYRX_ICO.ok}</span>
    <div><b>${esc(n.title)}</b>${Array.isArray(n.lines) && n.lines.length ? `<ul>${n.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}</div>
    <button class="my-res-x" type="button" data-act="myrxNoteClose" aria-label="Скрыть сообщение">✕</button></div>`;
}

/* ===== Папки со своими рецептами: название, кнопка на главном экране, тесты и карточки по папке ===== */
function myGrpLoad(){   // [Оптимизация 4] то же, что myrxLoad: разбор кэшируется, наружу уходит копия
  return loadCached(MYGRP_KEY, v => Array.isArray(v) ? v.filter(g => g && typeof g.id==='string' && /^[a-z0-9]{1,12}$/.test(g.id) && typeof g.name==='string' && g.name.trim())
    .map(g => ({id:g.id, name:g.name.trim().slice(0, 40)})) : [],
    list => list.map(g => ({...g})));
}
function myGrpName(id){
  const g = myGrpLoad().find(x => x.id===id), n = g ? g.name : 'Папка';
  return n.length > 16 ? n.slice(0, 15) + '…' : n;
}
function myGrpOk(){ return myGrpLoad().some(x => x.id===curGrp); }   // папка существует (пустая тоже открывается)
const myGrpNewId = () => (Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 6)).slice(0, 12);
function myGrpMenuHtml(){
  const rows = myGrpLoad().map(g => ({g, n:myGrpPool(g.id).length})).filter(x => x.n).map(({g, n}) =>
    `<button class="rx-row" type="button" data-act="myGrpOpen" data-g="${esc(g.id)}"><span class="rx-lbl">${esc(g.name)}</span><span class="rx-pg">${n}</span>${homeIcon('pen')}<span class="rx-go" aria-hidden="true">${ICON.chevron}</span></button>`).join('');
  return rows ? `<h2 class="rx-sec" style="margin-top:42px">Мои папки</h2><div class="rx-rows">${rows}</div>` : '';
}
// Экран папки: добавить рецепты, пройти тест / «Впиши сам» / карточки, посмотреть и убрать рецепты
function viewMyGroup(){
  const g = myGrpLoad().find(x => x.id===curGrp), pool = g ? myGrpPool(g.id) : [];
  setTop({back: grpBack==='myrx' ? 'Мои рецепты' : 'Меню', title: g ? g.name : ''});
  if(!g) return '';
  const tl = (m, icon, title, desc) => { const p = progressOf(loadSession(m, g.id));
    return tile({act:'myGrpTest', m, i:g.id, icon, title, desc, meta:`<span>${count(pool.length)}</span>${chip(p)}`, reset: p && 'Сбросить прогресс папки'}); };
  const inside = myrxLoad().filter(r => r.tests.includes('g_' + g.id));
  const rows = inside.map(r => { const bad = myrxProblem(r), sub = [String(r.latin).trim(), String(r.group).trim()].filter(Boolean).join(' · ');
    return `<div class="my-grp${bad ? ' is-bad' : ''}"><div class="my-grp-t"><b>${esc(r.drug || r.latin || 'Без названия')}</b><small>${esc(bad ? 'Не хватает данных: в тестах не участвует' : sub)}</small></div>
      <button class="my-grp-b my-grp-rm" type="button" data-act="myGrpRemove" data-id="${esc(r.id)}" aria-label="Убрать «${esc(r.drug || r.latin)}» из папки">Убрать</button></div>`; }).join('');
  return `<header class="page-head"><h1>${esc(g.name)}</h1><p>${pool.length ? 'Выберите формат подготовки.' : 'Папка пока пуста.'}</p></header>
    <div class="my-newrow">
      <button class="btn btn-primary my-new" type="button" data-act="myGrpNewRx">+ Новый рецепт</button>
      <button class="btn btn-secondary my-new" type="button" data-act="myGrpAdd">Добавить из моих рецептов</button>
    </div>
    ${pool.length ? `<div class="list">${
      tl('grpQuiz', ICON.choice, 'Тест', 'Выбираете дозу, путь введения и группу из трёх вариантов.')}${
      tl('grpWrite', ICON.pen, 'Впиши сам', 'Видно только название — латынь, концентрацию и группу вписываете сами.')}${
      tile({act:'myGrpTest', m:'groupCards', i:g.id, icon:ICON.cards, title:'Карточки', desc:'Вся информация о препарате на одной карточке — для повторения, без вопросов.', meta:`<span>${count(pool.length)}</span>`})}
    </div>` : ''}
    ${rows ? `<div class="label my-rows-h">Рецепты в папке · ${inside.length}</div>${rows}` : ''}`;
}
// Окно «Добавить в папку»: рецепты, которых в папке ещё нет
function myGrpAddSheet(){
  const g = myGrpLoad().find(x => x.id===curGrp); if(!g) return;
  const free = myrxLoad().filter(r => !r.tests.includes('g_' + g.id) && MY_ACTIVE.some(m => m.id===r.id));
  if(!free.length){
    openSheet(`<h2 class="sheet-title" id="sheetTitle">Добавить в папку</h2>
      <p class="sheet-text">${myrxLoad().length ? 'Все ваши готовые рецепты уже лежат в этой папке.' : 'Пока нет ни одного рецепта. Создайте рецепт на экране «Мои рецепты» — потом его можно будет положить в папку.'}</p>${CLOSE_BTN}`);
    return;
  }
  openSheet(`<h2 class="sheet-title" id="sheetTitle">Добавить в папку «${esc(g.name)}»</h2>
    ${free.length > 1 ? `<div class="my-selbar-h"><span id="myGaddCnt" aria-live="polite">Ничего не выбрано</span><button class="my-linkbtn" type="button" id="myGaddAllBtn" data-act="myGaddAll">Выбрать все</button></div>` : ''}
    <div class="my-togs is-col my-gadd">${free.map(r => `<label class="my-tog"><input type="checkbox" data-gadd="${esc(r.id)}"><span>${esc(r.drug || r.latin)}</span></label>`).join('')}</div>
    <p class="my-err" id="myGaddErr" role="alert" hidden></p>
    <div class="actions actions-even">
      <button class="btn btn-secondary" type="button" data-act="close">Отмена</button>
      <button class="btn btn-primary" type="button" id="myGaddGo" data-act="myGrpAddGo">Добавить</button>
    </div>`);
}
function myGaddRefresh(){
  const all = [...document.querySelectorAll('input[data-gadd]')], n = all.filter(x => x.checked).length;
  const c = $id('myGaddCnt'); if(c) c.textContent = n ? 'Выбрано: ' + n : 'Ничего не выбрано';
  const b = $id('myGaddGo'); if(b) b.textContent = n ? 'Добавить (' + n + ')' : 'Добавить';
  const a = $id('myGaddAllBtn'); if(a) a.textContent = n===all.length ? 'Снять все' : 'Выбрать все';
}
function myGrpAddGo(){
  const ids = [...document.querySelectorAll('input[data-gadd]:checked')].map(x => x.dataset.gadd);
  if(!ids.length){ const e = $id('myGaddErr'); if(e){ e.textContent = 'Отметьте хотя бы один рецепт.'; e.hidden = false; } return; }
  const list = myrxLoad().map(r => ids.includes(r.id) ? {...r, tests:[...new Set([...r.tests, 'g_' + curGrp])]} : r);
  if(!myrxStore(list)){ myrxStorageFail(); return; }
  closeSheet(true);
  myrxApplied(undefined, true, ['g_' + curGrp], 'myGroup');
}
function myGrpRemove(id){
  const g = myGrpLoad().find(x => x.id===curGrp), r = myrxLoad().find(x => x.id===id); if(!g || !r) return;
  const doRemove = () => {
    if(!myrxStore(myrxLoad().map(x => x.id===id ? {...x, tests:x.tests.filter(t => t!=='g_' + g.id)} : x))){ myrxStorageFail(); return; }
    myrxApplied(undefined, true, ['g_' + g.id], 'myGroup');
  };
  if(myrxHasProgress(['g_' + g.id])) askConfirm('Убрать из папки?', 'Рецепт останется в «Мои рецепты». Прогресс тестов этой папки будет сброшен, а страница обновится.', 'Убрать', doRemove);
  else doRemove();
}
function myGrpListHtml(){
  const gs = myGrpLoad(), rs = myrxLoad();
  const rows = gs.map(g => { const n = rs.filter(r => r.tests.includes('g_' + g.id)).length;
    return `<div class="my-grp"><button class="my-grp-t my-grp-open" type="button" data-act="myGrpOpen" data-g="${esc(g.id)}"><b>${esc(g.name)}</b><small>${n ? myrxRecipes(n) : 'Пока пусто'}</small></button>
      <button class="my-grp-b" type="button" data-act="myGrpEdit" data-g="${esc(g.id)}" aria-label="Переименовать папку «${esc(g.name)}»">${ICON.pen}</button>
      <button class="my-grp-b" type="button" data-act="myGrpDel" data-g="${esc(g.id)}" aria-label="Удалить папку «${esc(g.name)}»">${MYRX_ICO.trash}</button></div>`; }).join('');
  // TODO (обучение): добавить в обучение «Мои рецепты» два текста, убранных с экрана:
  //  1) «Собирайте рецепты в папки: для каждой на главном экране появится кнопка с тестами и карточками.» (раньше показывался, пока папок нет);
  //  2) «Откройте папку, чтобы добавить в неё рецепты.» (раньше показывался под списком папок).
  return `<div class="my-groups"><div class="my-grp-head"><h2>Папки</h2><button class="my-linkbtn" type="button" data-act="myGrpNew">+ Новая папка</button></div>${rows}</div>`;
}
let myGrpEditId = '';
function myGrpSheet(id){
  myGrpEditId = id || '';
  const g = id ? myGrpLoad().find(x => x.id===id) : null;
  openSheet(`<h2 class="sheet-title" id="sheetTitle">${g ? 'Название папки' : 'Новая папка'}</h2>
    <div class="my-field"><label class="label wr-label" for="myrxGrpName"><span class="wr-lab">Название</span></label>
      <input class="input" id="myrxGrpName" type="text" maxlength="40" value="${esc(g ? g.name : '')}" placeholder="Например: Диуретики" autocomplete="off" enterkeyhint="done"></div>
    <p class="my-err" id="myrxGrpErr" role="alert" hidden></p>
    <div class="actions actions-even">
      <button class="btn btn-secondary" type="button" data-act="close">Отмена</button>
      <button class="btn btn-primary" type="button" data-act="myrxGrpSave">Сохранить</button>
    </div>`);
  const inp = $id('myrxGrpName'); if(inp){ inp.focus(); inp.select(); }
}
function myGrpSave(){
  const inp = $id('myrxGrpName'), err = $id('myrxGrpErr'); if(!inp || !err) return;
  const name = inp.value.trim().replace(/\s+/g, ' ').slice(0, 40), list = myGrpLoad();
  const bad = !name ? 'Введите название папки.'
    : list.some(g => g.id!==myGrpEditId && g.name.toLowerCase()===name.toLowerCase()) ? 'Папка с таким названием уже есть.'
    : (!myGrpEditId && list.length >= 30) ? 'Можно создать не больше 30 папок.' : '';
  if(bad){ err.textContent = bad; err.hidden = false; inp.focus(); return; }
  const g = myGrpEditId ? list.find(x => x.id===myGrpEditId) : null;
  if(g) g.name = name; else list.push({id:myGrpNewId(), name});
  if(!store.set(MYGRP_KEY, list)){ err.textContent = 'Не удалось сохранить: память устройства заполнена.'; err.hidden = false; return; }
  myGrpEditId = '';
  render();
}
function myGrpDelete(id){
  const g = myGrpLoad().find(x => x.id===id); if(!g) return;
  const had = myrxLoad().some(r => r.tests.includes('g_' + id));
  askConfirm('Удалить папку?', `Папка «${esc(g.name)}» пропадёт с главного экрана. Рецепты останутся в «Мои рецепты», но выйдут из неё.${had ? ' Прогресс тестов, куда входят ваши рецепты, будет сброшен.' : ''}`, 'Удалить', () => {
    const oldGroups = myGrpLoad(), oldRx = myrxLoad();
    if(!store.set(MYGRP_KEY, oldGroups.filter(x => x.id!==id))){ myrxStorageFail(); return; }
    if(had && !myrxStore(oldRx.map(r => ({...r, tests:r.tests.filter(t => t!=='g_' + id)})))){ store.set(MYGRP_KEY, oldGroups); myrxStorageFail(); return; }   // откат
    for(const m of ['grpQuiz', 'grpWrite']) clearSaved(m, id);
    if(curGrp===id){ curGrp = ''; grpBack = 'menu'; }
    if(had) myrxApplied(undefined, true, []);
    else render();
  });
}
document.addEventListener('keydown', e => { if(e.key==='Enter' && e.target && e.target.id==='myrxGrpName'){ e.preventDefault(); myGrpSave(); } });
let myrxOpen = new Set();   // раскрытые строки списка: остаются раскрытыми после возврата с экрана «Изменить»
let myrxDestOpen = false;   // раскрыт ли блок «Куда добавить» в редакторе (переживает перерисовку)

/* ----- Серия: «Сохранить и добавить ещё» -----
   Рецепты пишутся в память сразу, прогресс затронутых тестов сбрасывается сразу, а перезагрузка страницы
   (без неё рецепты не попадут в тесты — DB собирается при загрузке) откладывается до выхода с экрана редактора. */
const myrxNoSeries = () => ({n:0, last:'', dirty:false});
let myrxSeries = myrxNoSeries();
let myrxReloading = false;   // идёт перезагрузка после серии: историю браузера больше не трогаем (иначе history.go отменит перезагрузку)
const myrxNoteSet = title => { try{ sessionStorage.setItem(MYRX_NOTE, JSON.stringify({kind:'ok', title, lines:[]})); }catch(_){} };
function myrxSeriesReload(){   // вызывается из draw(): редактор закрыт, а в серии есть сохранённое
  const n = myrxSeries.n;
  myrxSeries = myrxNoSeries(); myrxReloading = true;
  dropPending();
  if(n > 0 && myrxEditBack !== 'myGroup') myrxNoteSet(n===1 ? 'Рецепт добавлен.' : 'Добавлено: ' + myrxRecipes(n) + '.');
  store.set(KEYS.view, mode==='myGroup' ? {mode:'myGroup', grpId:curGrp, grpBack} : {mode: mode==='menu' ? 'menu' : 'myrx'});
  location.reload();
}
// Следующий черновик серии: форма, «куда добавить», группа и путь остаются — обычно подряд идут похожие рецепты
function myrxNextDraft(prev){
  const d = myrxBlankDraft();
  d.form = prev.form; d.tests = [...prev.tests]; d.group = prev.group; d.route = prev.route;
  if(myrxTopicsOn(prev)) rxTopicsSet.add(d);
  return d;
}
function myrxSaveDraft(more){
  const r = rxDraft; if(!r) return;
  const err = myrxError(r);
  if(err){ const e = $id('myrxErr'); if(e){ e.textContent = err; e.hidden = false; try{ e.scrollIntoView({block:'center', behavior:'smooth'}); }catch(_){} } return; }
  const list = myrxLoad(), item = {...r, drug: r.drug.trim(), latin: r.latin.trim(), t: Date.now()};
  const i = item.id ? list.findIndex(x => x.id===item.id) : -1;
  if(i < 0 && list.length >= MYRX_MAX){
    const e = $id('myrxErr'); if(e){ e.textContent = 'Можно хранить не больше ' + MYRX_MAX + ' рецептов. Удалите ненужные.'; e.hidden = false; }
    return;
  }
  if(i >= 0) list[i] = item;
  else { item.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); list.unshift(item); }
  const was = MY_ACTIVE.find(m => m.id===item.id);      // участвовал ли рецепт в тестах при загрузке
  const commit = () => {
    if(!myrxStore(list)){ myrxStorageFail(); return; }  // рецепт не записан — черновик остаётся
    if(more){                                            // остаёмся в редакторе: чистая форма для следующего рецепта
      myrxResetProgress(new Set(item.tests));
      myrxSeries = {n: myrxSeries.n + 1, last: item.drug, dirty: true};
      rxDraft = myrxNextDraft(item);
      render();
      announce('Рецепт «' + item.drug + '» добавлен. Можно вводить следующий.');
      scrollTo({top:0, behavior:'smooth'});
      const f = $id('my-drug'); if(f) f.focus({preventScroll:true});
      return;
    }
    rxDraft = null;
    const n = myrxSeries.n + 1, wasSeries = myrxSeries.dirty;
    myrxSeries = myrxNoSeries();
    if(wasSeries && n > 1 && myrxEditBack !== 'myGroup') myrxNoteSet('Добавлено: ' + myrxRecipes(n) + '.');
    myrxApplied(was, true, item.tests, myrxEditBack==='myGroup' ? 'myGroup' : undefined);
  };
  const ts = new Set([...item.tests, ...(was ? [...was.tests] : [])]);
  if(ts.size && myrxHasProgress(ts)) askConfirm('Сохранить рецепт?', 'Прогресс тестов, куда входит этот рецепт, будет сброшен' + (more ? '.' : ', а страница обновится.') + ' Список ошибок сохранится.', 'Сохранить', commit);
  else commit();
}

/* ----- Выбор нескольких рецептов на экране «Мои рецепты» ----- */
let myrxSel = {on:false, ids:new Set()};
const myrxSelCount = n => n ? 'Выбрано: ' + n : 'Ничего не выбрано';
const MYRX_CHECK = svgIcon('<path d="M5 12.5l4.2 4.2L19 7"/>');
function myrxSelBar(){
  const n = myrxSel.ids.size, total = myrxLoad().length, hasGrp = myGrpLoad().length > 0;
  return `<div class="my-selbar" role="region" aria-label="Действия с выбранными рецептами">
    <div class="my-selbar-top"><b id="mySelCnt" aria-live="polite">${myrxSelCount(n)}</b><span>
      <button class="my-linkbtn" type="button" id="mySelAll" data-act="myrxSelAll">${n===total ? 'Снять все' : 'Выбрать все'}</button>
      <button class="my-linkbtn" type="button" data-act="myrxSelOff">Отмена</button></span></div>
    <div class="my-selbar-btns">${hasGrp ? `<button class="btn btn-secondary" type="button" id="mySelMove" data-act="myrxSelMove"${n ? '' : ' disabled'}>В папку</button>` : ''}<button class="btn btn-danger" type="button" id="mySelDel" data-act="myrxSelDel"${n ? '' : ' disabled'}>${MYRX_ICO.trash}Удалить${n ? ' (' + n + ')' : ''}</button></div>
  </div>`;
}
function myrxSelRefresh(){   // без перерисовки экрана: список может быть длинным
  const n = myrxSel.ids.size, total = myrxLoad().length;
  const c = $id('mySelCnt'); if(c) c.textContent = myrxSelCount(n);
  const a = $id('mySelAll'); if(a) a.textContent = n===total ? 'Снять все' : 'Выбрать все';
  const d = $id('mySelDel'); if(d){ d.disabled = !n; d.innerHTML = MYRX_ICO.trash + 'Удалить' + (n ? ' (' + n + ')' : ''); }
  const m = $id('mySelMove'); if(m) m.disabled = !n;
}
function myrxSelEnter(id){ myrxSel = {on:true, ids:new Set(id ? [id] : [])}; render(); }
function myrxSelLeave(){ myrxSel = {on:false, ids:new Set()}; }
function viewMyList(){
  setTop({back:'Меню', title:'Мои рецепты'});
  const list = myrxLoad(), sel = myrxSel.on;
  if(sel){ const have = new Set(list.map(r => r.id)); myrxSel.ids = new Set([...myrxSel.ids].filter(id => have.has(id))); }
  let note = ''; try{ note = myrxNoteHtml(sessionStorage.getItem(MYRX_NOTE)); sessionStorage.removeItem(MYRX_NOTE); }catch(_){}
  const head = `<header class="page-head"><h1>Мои рецепты</h1><p>Составляйте собственные рецепты на бланке и сохраняйте их на этом устройстве.</p></header>
    <button class="btn btn-primary my-new" type="button" data-act="myrxNew">+ Новый рецепт</button>
    <div class="my-xfer">
      <button class="btn btn-secondary" type="button" data-act="myrxImportOpen">${MYRX_ICO.down}Загрузить рецепты</button>
      <button class="btn btn-secondary" type="button" data-act="myrxExportOpen">${MYRX_ICO.up}Отправить рецепты</button>
    </div>
    ${note}
    ${myGrpListHtml()}`;
  if(!list.length) return head + `<div class="empty">${ICON.pen}<p>Пока пусто. Нажмите «Новый рецепт» — можно выбрать препарат из справочника, и поля заполнятся сами. Уже есть рецепты (файл или текст) — нажмите «Загрузить рецепты».</p></div>`;
  const ids = new Set(list.map(r => r.id)); myrxOpen = new Set([...myrxOpen].filter(id => ids.has(id)));
  const listHead = `<div class="my-listhead"><div class="label my-rows-h">${sel ? 'Отметьте рецепты' : 'Рецепты'} · ${list.length}</div>${sel ? '' : '<button class="my-linkbtn" type="button" data-act="myrxSelOn">Выбрать</button>'}</div>`;
  return head + listHead + list.map(r => {
    const name = r.drug || r.latin || 'Без названия', bad = myrxProblem(r), sub = [String(r.latin).trim(), String(r.group).trim()].filter(Boolean).join(' · ');
    if(sel){
      const on = myrxSel.ids.has(r.id);
      return `<button class="my-row my-selrow${on ? ' is-sel' : ''}${bad ? ' is-bad' : ''}" type="button" role="checkbox" aria-checked="${on}" data-act="myrxSelRow" data-id="${esc(r.id)}"><span class="my-chk" aria-hidden="true">${MYRX_CHECK}</span><span class="my-row-t"><b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>${bad ? '<span class="my-row-warn" role="img" aria-label="Нужно дополнить">!</span>' : ''}</button>`;
    }
    return `<details class="my-row${bad ? ' is-bad' : ''}" data-rx="${esc(r.id)}"${myrxOpen.has(r.id) ? ' open' : ''}>
      <summary class="my-row-s"><span class="my-row-t"><b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>${bad ? '<span class="my-row-warn" role="img" aria-label="Нужно дополнить">!</span>' : ''}<span class="my-dd-arr" aria-hidden="true">${ICON.chevron}</span></summary>
      <div class="my-row-b">
        <div class="my-prev">${myrxBlank(r, true)}</div>
        ${bad ? `<p class="my-meta is-bad">${esc(bad)}</p>` : `<p class="my-meta is-on">${esc(myrxTestsText(r))}</p>`}
        <div class="my-acts">
          <button class="btn btn-secondary" type="button" data-act="myrxEdit" data-id="${esc(r.id)}">Изменить</button>
          <button class="btn btn-secondary" type="button" data-act="myrxCopy" data-id="${esc(r.id)}">Копировать</button>
          <button class="btn btn-secondary" type="button" data-act="myrxDel" data-id="${esc(r.id)}">Удалить</button>
        </div>
      </div>
    </details>`; }).join('') + (sel ? myrxSelBar() + '<div class="my-selpad"></div>' : '');
}
// Строка списка раскрылась или свернулась: запоминаем и подгоняем бланк по ширине (в закрытой строке у него нулевая ширина)
document.addEventListener('toggle', e => {
  const d = e.target;
  if(d && d.classList && d.classList.contains('my-dest')){ myrxDestOpen = d.open; return; }
  if(!d || !d.classList || !d.classList.contains('my-row')) return;
  const id = d.dataset.rx;
  if(d.open){ myrxOpen.add(id); fitRx(); } else myrxOpen.delete(id);
}, true);

// Пути введения под форму выпуска: пути формы, которых ещё нет в строке, продолжают уже набранное («внутрь, » → «внутрь, в/в»),
// плюс готовые сочетания из справочника, целиком состоящие из путей этой формы
function myrxRouteOptions(F, typed){
  const parts = routeParts(typed), done = /,\s*$/.test(typed) ? parts : parts.slice(0, -1);
  const out = F.routes.filter(x => !done.includes(x)).map(x => [...done, x].join(', '));
  allRoutes.forEach(x => { const p = routeParts(x); if(p.length > 1 && p.every(y => F.routes.includes(y)) && done.every(y => p.includes(y))) out.push(x); });
  return [...new Set(out)];
}
// Signa: кнопки из этого списка дописывают текст в поле (панель kbBar)
// Подсказки зависят от выбранной формы: для таблеток нет инъекций, для ампул — «после еды»
function myrxQuickSigna(F){
  const oral = (F.routes || []).includes('внутрь') && !F.vol || F.id==='tinct' || F.id==='flac';
  const inj = (F.routes || []).some(x => /^(в\/в|в\/м|п\/к)$/.test(x));
  return [...F.routes.filter(x => x.length < 14), F.dose, '1 раз в день', '2 раза в день', '3 раза в день', ...(oral ? ['до еды', 'после еды', 'во время еды'] : []), ...(inj ? ['при необходимости'] : [])];
}
const kbButtons = (list, mode) => list.map(v => `<button class="my-q" type="button" data-act="kbPick" data-m="${mode}" data-v="${esc(v)}">${esc(v)}</button>`).join('');
function viewMyEdit(){
  if(!rxDraft) rxDraft = myrxBlankDraft();
  const r = rxDraft, F = myrxForm(r.form);
  setTop({back: myrxEditBack==='myGroup' ? myGrpName(curGrp) : 'Мои рецепты', title: r.id ? 'Изменить рецепт' : 'Новый рецепт'});
  const field = (key, label, ph, attrs='', cls='', after='') => `<div class="my-field ${cls}">
      <label class="label wr-label" for="my-${key}"><span class="wr-lab">${label}</span></label>
      ${key==='signa'
        ? `<textarea class="input my-area" id="my-${key}" data-my="${key}" rows="2" maxlength="300" placeholder="${esc(ph)}" enterkeyhint="done"
        autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" ${attrs}>${esc(r[key])}</textarea>`
        : `<input class="input${key==='latin' ? ' wr-lat' : ''}" id="my-${key}" data-my="${key}" type="text" maxlength="300" value="${esc(r[key])}" placeholder="${esc(ph)}"
        autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" ${attrs}>`}${after}</div>`;
  const row2 = [
    F.vol ? field('vol', 'Объём, мл', 'Например: 5', 'inputmode="decimal"') : '',
    F.num ? field('num', 'Число доз' + (F.unit ? ' (' + F.unit + ')' : ''), 'Например: 10', 'inputmode="numeric"') : ''
  ].filter(Boolean);
  const tog = (id, text, on, extra='') => `<label class="my-tog${on ? ' is-on' : ''}"><input type="checkbox" ${extra || `data-mytest="${id}"`}${on ? ' checked' : ''}><span>${esc(text)}</span></label>`;
  const T = myrxTests(), semT = T.filter(t => /^s\d$/.test(t.id)), examT = T.find(t => t.id==='exam'), blockT = T.filter(isBlockTest), grpT = T.filter(t => t.id.startsWith('g_'));
  const ser = myrxSeries.dirty && !r.id ? myrxSeries : null;
  const inFolder = !r.id && myrxEditBack==='myGroup' && myGrpOk() ? myGrpLoad().find(g => g.id===curGrp) : null;
  return `<header class="page-head"><h1>${r.id ? 'Изменить рецепт' : 'Новый рецепт'}</h1>
      ${ser ? '' : `<p>Начните с названия: если препарат есть в справочнике, поля заполнятся сами. Все поля обязательны.${inFolder ? ' Рецепт сразу попадёт в папку «' + esc(inFolder.name) + '».' : ''}</p>`}</header>
    ${ser ? `<div class="my-series" role="status"><span class="my-series-ico" aria-hidden="true">${MYRX_ICO.ok}</span>
      <div class="my-series-t"><b>«${esc(ser.last)}» добавлен</b><small>В серии: ${ser.n} · форма, группа и путь остались прежними</small></div>
      <button class="btn btn-secondary" type="button" data-act="myrxFinish">Готово</button></div>` : ''}
    <div class="my-field">
      <label class="label wr-label" for="my-drug"><span class="wr-lab">Препарат</span><span class="wr-sub">при выборе из справочника добавится «(мой)»: название не должно совпадать с оригиналом</span></label>
      <input class="input" id="my-drug" data-my="drug" type="text" maxlength="300" value="${esc(r.drug)}" placeholder="Начните вводить название"
        role="combobox" aria-expanded="false" aria-controls="mySug" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
      <div class="my-sug" id="mySug" role="listbox" hidden></div>
    </div>
    <div class="label wr-label my-formlab"><span class="wr-lab">Форма выпуска</span></div>
    <nav class="tabs my-tabs" aria-label="Форма выпуска">${MYRX_FORMS.map(f => `<button class="tab${f.id===r.form ? ' is-active' : ''}" type="button" data-act="myrxForm" data-f="${f.id}">${f.title}</button>`).join('')}</nav>
    ${field('latin', 'Латинское название', 'Например: Labetaloli', 'lang="la"')}
    ${F.nodose ? '' : field('dose', F.conc ? 'Концентрация' : 'Дозировка', F.ph || '')}
    ${row2.length ? `<div class="my-row2">${row2.join('')}</div>` : ''}
    ${field('signa', 'Signa — инструкция для пациента', 'внутрь, по 1 таблетке 3 раза в день')}
    ${field('group', 'Фармакологическая группа', 'Начните вводить — появятся подсказки')}
    ${field('route', 'Путь введения', 'внутрь, в/в, в/м…')}
    <details class="my-dest" id="myDest"${myrxDestOpen ? ' open' : ''}>
      <summary class="my-dest-s"><span class="my-dest-k">Куда добавить</span><span class="my-dest-v" id="myDestVal">${esc(myrxDestText(r))}</span><span class="my-dd-arr" aria-hidden="true">${ICON.chevron}</span></summary>
      <fieldset class="my-tests">
      <legend class="sr-only">Куда добавить рецепт</legend>
      <div class="my-togs">${semT.map(t => tog(t.id, t.short, r.tests.includes(t.id))).join('')}${tog('', 'Экзамен', r.tests.includes('exam'), 'data-mytest="exam"')}${tog('', 'Темы', myrxTopicsOn(r), 'data-mytopics')}</div>
      <div class="my-topic" id="myTopicBox"${myrxTopicsOn(r) ? '' : ' hidden'}>
        <div class="label wr-label"><span class="wr-lab">Темы</span><span class="wr-sub">можно отметить несколько</span></div>
        <div class="my-togs is-col">${blockT.map(t => tog(t.id, t.title, r.tests.includes(t.id))).join('')}</div>
      </div>
      ${grpT.length ? `<div class="label wr-label my-formlab"><span class="wr-lab">Папки</span></div><div class="my-togs">${grpT.map(t => tog(t.id, t.short, r.tests.includes(t.id))).join('')}</div>` : ''}
      </fieldset>
    </details>
    <p class="my-need" id="myNeed" role="status" aria-live="polite" hidden></p>
    <div class="label wr-label my-formlab"><span class="wr-lab">Так рецепт выглядит на бланке</span></div>
    <div class="my-prev" id="myrxPreview">${myrxBlank(r)}</div>
    <p class="my-err" id="myrxErr" role="alert" hidden></p>
    ${r.id ? `<div class="actions actions-even">
      <button class="btn btn-secondary" type="button" data-act="up">Отмена</button>
      <button class="btn btn-primary" type="button" data-act="myrxSave">Сохранить</button>
    </div>` : `<div class="my-save">
      <button class="btn btn-primary btn-block" type="button" data-act="myrxSaveMore">+ Сохранить и добавить ещё</button>
      <div class="actions actions-even">
        <button class="btn btn-secondary" type="button" data-act="${ser ? 'myrxFinish' : 'up'}">${ser ? 'Готово' : 'Отмена'}</button>
        <button class="btn btn-secondary" type="button" data-act="myrxSave">Сохранить</button>
      </div>
    </div>`}`;
}
// Короткая запись «куда добавлен рецепт» для свёрнутого блока
function myrxDestText(r){
  const all = myrxTests().filter(t => r.tests.includes(t.id)).map(t => isBlockTest(t) ? t.short : t.short);
  return all.length ? all.join(', ') : 'не выбрано';
}
function myrxDestUpdate(){ const el = $id('myDestVal'); if(el && rxDraft) el.textContent = myrxDestText(rxDraft); }
// Что ещё не заполнено в форме (показывается над кнопкой «Сохранить», пока есть пропуски)
function myrxNeedUpdate(){
  const el = $id('myNeed'); if(!el || !rxDraft) return;
  const r = rxDraft, F = myrxForm(r.form), f = k => String(r[k]||'').trim();
  const miss = [];
  if(!f('drug')){ el.hidden = true; return; }   // пока не начали — не шумим
  if(!f('latin')) miss.push('латинское название');
  if(!F.nodose && !f('dose')) miss.push(F.conc ? 'концентрация' : 'дозировка');
  if(F.vol && !f('vol')) miss.push('объём');
  if(F.num && !f('num')) miss.push('число доз');
  if(!f('signa')) miss.push('Signa');
  if(!f('group')) miss.push('фармакологическая группа');
  if(!f('route')) miss.push('путь введения');
  el.hidden = !miss.length;
  el.textContent = miss.length ? 'Чтобы сохранить, заполните: ' + miss.join(', ') + '.' : '';
}
// Изменился набор рецептов в тестах: DB и блоки собираются при загрузке, поэтому сбрасываем
// незаконченные прохождения тестов со своими рецептами (в них сдвигаются номера) и перезагружаем страницу
// Сбрасывает незаконченные прохождения тестов, куда входят (или войдут) свои рецепты
function myrxResetProgress(targets){
  dropPending();
  for(const t of targets){
    if(t==='exam'){ store.del(KEYS.quiz); store.del(KEYS.write); }
    else if(/^s\d$/.test(t)) semDrop(+t[1]);
    else if(/^b\d$/.test(t)) for(const m of ['study', 'writeBlock', 'groupCards']) clearSaved(m, +t[1]);
    else if(t.startsWith('g_')) for(const m of ['grpQuiz', 'grpWrite']) clearSaved(m, t.slice(2));
  }
  // ошибки хранятся по названию: записи удалённых рецептов отбрасываются при следующей загрузке (initMistakes)
  dropMistakeSessions();
}
function myrxApplied(was, now, newTests, stay){
  if(!was && !now){ go(stay || 'myrx'); return; }
  const targets = new Set(newTests);          // сбрасываем только тесты, где рецепт был или будет
  if(was) was.tests.forEach(t => targets.add(t));
  myrxResetProgress(targets);
  mode = stay || 'myrx';
  store.set(KEYS.view, stay==='myGroup' ? {mode:'myGroup', grpId:curGrp, grpBack} : {mode: 'myrx'});
  location.reload();
}
// [Оптимизация 6] Нормализованные название и латынь считаются один раз при загрузке, а не для каждого препарата
// на каждое нажатие клавиши. DB к этому моменту уже окончательная (свои рецепты дописаны выше): если когда-нибудь
// DB станет меняться во время работы, SUG_KEYS нужно будет пересобирать.
// RU_COLLATOR — один общий компаратор вместо localeCompare(…, 'ru') на каждое сравнение при сортировке.
const SUG_KEYS = DB.map(d => ({d, name: normalizeAnswer(d[0]), lat: normalizeAnswer(d[4])}));
const RU_COLLATOR = new Intl.Collator('ru');
// Подсказки по названию или латыни: до 8 совпадений, сначала те, что начинаются с запроса
function myrxSuggest(q){
  const box = $id('mySug'), inp = $id('my-drug');
  if(!box) return;
  const n = normalizeAnswer(q);
  let hits = [];
  if(n){
    const scored = [];
    for(const k of SUG_KEYS){
      const a = k.name.indexOf(n), b = k.lat.indexOf(n);
      const pos = a < 0 ? (b < 0 ? 99 : b) : (b < 0 ? a : Math.min(a, b));
      if(pos < 99) scored.push([pos, k.d]);
    }
    hits = scored.sort((a, b) => a[0] - b[0] || RU_COLLATOR.compare(a[1][0], b[1][0])).slice(0, 8).map(x => x[1]);
    if(hits.length===1 && normalizeAnswer(hits[0][0])===n) hits = [];   // название уже набрано целиком
  }
  box.innerHTML = hits.map(d => `<button class="my-sug-i" type="button" role="option" data-act="myrxPick" data-d="${DB_INDEX.get(d)}">
      <b>${esc(d[0])}</b><small>${esc(d[4])} · ${esc(grpText(d))}</small></button>`).join('');
  box.hidden = !hits.length;
  if(inp) inp.setAttribute('aria-expanded', String(!!hits.length));
}
// Панель подсказок над клавиатурой вместо подсказок Chrome (<datalist>): работает и в <textarea>, и в окнах.
// Поля: Signa (кнопки дописывают текст), «Путь введения» (варианты под форму выпуска) и «Фармакологическая группа» (поиск по списку групп)
let kbBar = null, kbEl = null;
const kbKind = el => !el ? '' : el.id==='my-signa' ? 'signa' : (el.id==='my-route' || el.id==='myrxF_route') ? 'route' : (el.id==='my-group' || el.id==='myrxF_group' || el.id==='f-group') ? 'group' : '';
function kbBarHide(){ if(kbBar) kbBar.hidden = true; kbEl = null; }
// что предложить для поля: {mode:'add'|'set', list}
function kbItems(el){
  const k = kbKind(el), typed = el.value.trim();
  if(k==='signa') return rxDraft ? {mode:'add', list: myrxQuickSigna(myrxForm(rxDraft.form))} : null;
  if(k==='route'){
    const w = myrxWiz && myrxWiz.todo[myrxWiz.pos], F = el.id==='my-route' ? (rxDraft && myrxForm(rxDraft.form)) : (w && myrxForm(w.form));
    if(!F) return null;
    const q = typed.toLowerCase();
    return {mode:'set', list: myrxRouteOptions(F, el.value).filter(x => x.toLowerCase().includes(q) && x.toLowerCase()!==q)};
  }
  if(k==='group'){
    const hits = groupHits(el.value).slice(0, 12);
    return {mode:'set', list: hits.filter(g => groupKey(g)!==groupKey(el.value))};   // название уже набрано целиком — не предлагаем
  }
  return null;
}
function kbBarPlace(){
  const inp = kbEl;
  if(!kbBar || !inp || !inp.isConnected || document.activeElement!==inp){ kbBarHide(); return; }
  const vv = window.visualViewport, top = vv ? vv.offsetTop : 0, h = vv ? vv.height : innerHeight;
  const gap = Math.max(0, innerHeight - top - h);
  kbBar.style.bottom = gap + 'px';      // нижний край видимой области = верх клавиатуры
  kbBar.classList.toggle('is-kb', gap > 80);   // клавиатура открыта — нижний отступ под жестовую панель не нужен (иначе между панелью и клавиатурой тёмная полоса)
  const over = inp.getBoundingClientRect().bottom - (top + h - kbBar.offsetHeight) + 12;   // поле не должно прятаться за панелью
  if(over > 0){ const sc = inp.closest('.sheet'); if(sc) sc.scrollTop += over; else scrollBy(0, over); }
}
// показать / обновить панель для поля в фокусе (вызывается при фокусе и при каждом вводе)
function kbBarShow(el){
  const it = kbKind(el) && kbItems(el);
  if(!it || !it.list.length){ kbBarHide(); return; }
  if(!kbBar){
    kbBar = document.createElement('div');
    kbBar.id = 'kbBar'; kbBar.className = 'kb-bar'; kbBar.setAttribute('role', 'group'); kbBar.setAttribute('aria-label', 'Подсказки');
    document.body.appendChild(kbBar);
  }
  const same = kbEl===el;
  kbEl = el;
  kbBar.innerHTML = kbButtons(it.list, it.mode);
  if(!same) kbBar.scrollLeft = 0;
  kbBar.hidden = false;
  kbBarPlace();
}
if(window.visualViewport) ['resize', 'scroll'].forEach(ev => visualViewport.addEventListener(ev, () => { if(kbBar && !kbBar.hidden) { kbBarPlace(); requestAnimationFrame(kbBarPlace); } }));
addEventListener('resize', () => { if(kbBar && !kbBar.hidden) kbBarPlace(); });
// iPhone: клавиатура не уменьшает страницу, а ложится поверх неё, и поле ввода (особенно в нижних окнах) оказывается под ней.
// Здесь: (1) в CSS-переменные кладём размер видимой области, окна подстраиваются под неё (см. «Клавиатура на iPhone» в style.css);
// (2) поле в фокусе всегда прокручиваем в видимую область — внутри окна или на странице.
const kbVV = window.visualViewport;
function kbSync(){
  if(!kbVV) return;
  const st = document.documentElement.style, top = Math.max(0, Math.round(kbVV.offsetTop)), h = Math.round(kbVV.height);
  const gap = Math.max(0, Math.round(innerHeight - top - h));
  const open = gap > 80 && kbVV.scale < 1.05;   // при щипке-масштабе область тоже уменьшается — это не клавиатура
  document.documentElement.classList.toggle('kb-open', open);
  if(open){ st.setProperty('--vv-top', top + 'px'); st.setProperty('--vv-bottom', gap + 'px'); st.setProperty('--vv-h', h + 'px'); }
  else { st.removeProperty('--vv-top'); st.removeProperty('--vv-bottom'); st.removeProperty('--vv-h'); }
}
const kbIsText = el => !!el && (el.tagName==='TEXTAREA' || (el.tagName==='INPUT' && !/^(checkbox|radio|range|file|button|submit|reset|image|color)$/i.test(el.type)));
function kbReveal(){
  const el = document.activeElement;
  if(!kbVV || !kbIsText(el) || !el.isConnected) return;
  const bar = kbBar && !kbBar.hidden ? kbBar.offsetHeight : 0;
  const bottom = kbVV.offsetTop + kbVV.height - bar - 14, top = kbVV.offsetTop + 8;
  const r = el.getBoundingClientRect();
  const d = r.bottom > bottom ? r.bottom - bottom : r.top < top ? r.top - top : 0;
  if(Math.abs(d) < 2) return;
  const sc = el.closest('.sheet');
  if(sc) sc.scrollTop += d; else scrollBy(0, d);
}
if(kbVV){
  let kbRaf = 0;
  ['resize', 'scroll'].forEach(ev => kbVV.addEventListener(ev, () => {
    if(kbRaf) return;
    kbRaf = requestAnimationFrame(() => { kbRaf = 0; kbSync(); kbReveal(); });
  }));
  document.addEventListener('focusin', e => {
    if(!kbIsText(e.target)) return;
    // клавиатура выезжает ~0,3 с: проверяем несколько раз, пока область не устоялась
    [0, 120, 350, 700].forEach(t => setTimeout(() => { kbSync(); kbReveal(); }, t));
  });
  document.addEventListener('focusout', () => setTimeout(() => { if(!kbIsText(document.activeElement)) kbSync(); }, 150));
}
function myrxSuggestHide(){
  const box = $id('mySug'); if(box) box.hidden = true;
  const inp = $id('my-drug'); if(inp) inp.setAttribute('aria-expanded', 'false');
}
function myrxPreviewUpdate(){
  const box = $id('myrxPreview');
  if(box && rxDraft){ box.innerHTML = myrxBlank(rxDraft); fitRx(); }
  const e = $id('myrxErr'); if(e) e.hidden = true;
}
function myrxCopyText(text){
  if(navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
  return new Promise((ok, no) => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy') ? ok() : no(); }catch(err){ no(err); } finally { ta.remove(); }
  });
}

const VIEWS = {tests: viewTests, semMenu: viewSemMenu, myGroup: viewMyGroup, myrx: viewMyList, myrxEdit: viewMyEdit, menu: viewMenu, exam: viewExam, examQuiz: viewExamScope, examWrite: viewExamScope, mistakes: viewMistakes, reference: viewReference, groupCards: viewCards,
  howto: viewHowTo};

// Плавный подъём к началу страницы (около полсекунды, с замедлением к концу)
let glideRaf = 0, glideStop = () => {};
function glideToTop(){
  cancelAnimationFrame(glideRaf);
  glideStop();
  const from = scrollY;
  if(from <= 0) return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){ scrollTo({top:0, behavior:'instant'}); return; }
  const t0 = performance.now(), dur = 520;
  glideStop();
  const stop = () => { cancelAnimationFrame(glideRaf); glideStop(); };
  glideStop = () => { removeEventListener('touchstart', stop); removeEventListener('wheel', stop); glideStop = () => {}; };
  addEventListener('touchstart', stop, {passive:true});
  addEventListener('wheel', stop, {passive:true});
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    scrollTo({top: from * (1 - e), behavior:'instant'});
    if(k < 1) glideRaf = requestAnimationFrame(step); else glideStop();
  };
  glideRaf = requestAnimationFrame(step);
}
let drawnKey = '';
/* ---- Доступность: постоянная область для озвучивания, заголовок страницы, фокус ---- */
const liveBox = $id('liveRegion');
let liveTimer = 0, lastScreenId = '', lastKey = '';
function announce(text){
  if(!liveBox || !text) return;
  liveBox.textContent = '';
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => { liveBox.textContent = text; }, 60);   // пауза нужна, чтобы повтор той же фразы тоже озвучивался
}
const SESS_TITLE = {quiz:'Тест, все рецепты', write:'Впиши сам, все рецепты', study:'Тест по блоку', writeBlock:'Впиши сам по блоку',
  mistakesQuiz:'Повторение ошибок: тест', mistakesWrite:'Повторение ошибок: впиши сам'};
function screenName(S){
  const top = (topName || '').trim();
  if(top) return top;
  if(S){
    if(S.sem!==undefined) return semName(S.sem) + (mode==='semQuiz' ? ': тест' : ': впиши сам');
    if(mode==='grpQuiz' || mode==='grpWrite') return myGrpName(S.block) + (mode==='grpQuiz' ? ': тест' : ': впиши сам');
    const base = SESS_TITLE[mode] || 'Тест';
    return (mode==='study' || mode==='writeBlock') ? base + ' ' + (S.block + 1) : base;
  }
  return 'Рецепты';
}
// Какой элемент был в фокусе до перерисовки (чтобы вернуть фокус на «тот же» после неё)
function focusSignature(){
  const ae = document.activeElement;
  if(!ae || ae===document.body || !view.contains(ae) || ae.disabled) return null;
  const d = ae.dataset || {};
  if(ae.id) return {sel:'#' + CSS.escape(ae.id), input: /^(INPUT|TEXTAREA)$/.test(ae.tagName)};
  if(ae.tagName==='BUTTON' && d.act){
    let sel = `button[data-act="${CSS.escape(d.act)}"]`;
    for(const k of ['cat','i','mode','f','m']) if(d[k]!==undefined) sel += `[data-${k}="${CSS.escape(d[k])}"]`;
    return {sel, input:false};
  }
  return null;
}
function restoreFocus(sig){
  if(!sig || tour) return;
  const el = view.querySelector(sig.sel);
  if(!el || el.disabled){
    // прежнего элемента нет или он пока отключён (например, «Проверить» на новом вопросе) — фокус на заголовок карточки, а не в никуда
    const hd = view.querySelector('.card h2, .card h3, h1');
    if(hd){ hd.setAttribute('tabindex', '-1'); try{ hd.focus({preventScroll:true}); }catch{} }
    return;
  }
  try{ el.focus({preventScroll:true}); if(sig.input && el.setSelectionRange && /^(text|search|textarea)$/.test(el.type)){ const n = el.value.length; el.setSelectionRange(n, n); } }catch{}
}
// Браузер хранит заголовок для каждой записи истории. Если заголовок сменился до history.go(-1), после перехода вкладка
// показывает старый заголовок той записи, а document.title уже «верный» и повторная запись того же текста ничего не меняет.
// Поэтому после перехода по истории заголовок обновляем принудительно (через промежуточное значение).
let docTitle = '';
function setDocTitle(t){ docTitle = t; document.title = t; }
function refreshDocTitle(){
  if(!docTitle) return;
  document.title = docTitle + '\u200B';
  document.title = docTitle;
}
function afterDraw(sig, firstDraw){
  const S = cur();
  const screenId = [mode, S ? (S.block ?? S.sem) : cards.block].join('|');
  const key = [screenId, S ? S.pos : cards.pos].join('|');
  const screenChanged = screenId !== lastScreenId;
  // у экранов-сессий нет видимого заголовка страницы: добавляем скрытый, чтобы у экрана был <h1>
  let h1 = view.querySelector('h1');
  const name = screenName(S);
  if(!h1){ view.insertAdjacentHTML('afterbegin', `<h1 class="sr-only" tabindex="-1">${esc(name)}</h1>`); h1 = view.querySelector('h1'); }
  const pageName = (h1.textContent || name).trim();
  setDocTitle(mode==='menu' ? 'Тест по фармакологии' : pageName + ' — Тест по фармакологии');
  if(screenChanged){
    if(!firstDraw && !tour){
      h1.setAttribute('tabindex', '-1'); try{ h1.focus({preventScroll:true}); }catch{}   // экранный диктор прочтёт название нового экрана
      if(S && S.pos < S.order.length) announce(`${S.order[S.pos][0]}, вопрос ${S.pos + 1} из ${S.order.length}`);
    }
  } else {
    restoreFocus(sig);
    if(key !== lastKey){
      if(S && S.pos < S.order.length) announce(`${S.order[S.pos][0]}, вопрос ${S.pos + 1} из ${S.order.length}`);
      else if(S) announce(((view.querySelector('.summary-title') || {}).textContent || '').trim());
      else if(mode==='groupCards'){ const n = cardSet(cards.block).items.length; announce(`Карточка ${cards.pos + 1} из ${n}`); }
    }
  }
  lastScreenId = screenId; lastKey = key;
}
function draw(){
  if(myrxSeries.dirty && mode!=='myrxEdit'){ myrxSeriesReload(); return; }   // серия закончена: перезагрузка, чтобы рецепты попали в тесты
  if(mode!=='myrx' && myrxSel.on) myrxSelLeave();
  if(ORPHAN_MODES.has(mode) || (!VIEWS[mode] && !LISTS[mode] && !SESSION[mode])) mode = 'menu';
  if(SESSION[mode] && !cur()) mode = parentOf(mode);   // сессия не найдена — на уровень выше
  if(mode==='myGroup' && !myGrpOk()) mode = 'menu';
  saveView();
  closeSheet(true);
  if(!tour && !sheetRoot.childElementCount){      // страховка: если блокировка страницы «залипла», снимаем её
    setInert('sheet', false); setInert('tour', false);
    document.body.classList.remove('is-locked', 'tour-on');
    ['tourBlock','tourCard'].forEach(x => { const e = $id(x); if(e) e.remove(); });
  }
  const keepY = scrollY;                 // положение прокрутки до перерисовки
  const focusSig = focusSignature();
  const firstDraw = lastScreenId === '';
  view.innerHTML = (VIEWS[mode] || (LISTS[mode] ? viewList : viewSession))();
  document.body.classList.toggle('rx-home', mode==='menu');
  fitOpts();
  // новый экран или другой препарат — показываем его с начала, а не с места прокрутки прошлого
  const S = cur();
  const key = [mode, S ? S.block : cards.block, S ? S.pos : cards.pos].join('|');
  if(key!==drawnKey){
    const sameScreen = drawnKey.split('|').slice(0,2).join('|') === key.split('|').slice(0,2).join('|');
    drawnKey = key;
    if(sameScreen && keepY > 0){
      // следующий вопрос того же экрана: остаёмся на месте и плавно поднимаемся вверх
      if(Math.abs(scrollY - keepY) > 1) scrollTo({top:keepY, behavior:'instant'});
      glideToTop();
    } else if(scrollY > 0) scrollTo({top:0, behavior:'instant'});   // другой экран — сразу с начала
  }
  else if(Math.abs(scrollY - keepY) > 1) scrollTo({top:keepY, behavior:'instant'});   // тот же вопрос (например, после «Проверить») — экран не двигаем
  fitRx();
  view.querySelectorAll('textarea[data-my]').forEach(autosizeArea);
  myrxNeedUpdate();
  afterDraw(focusSig, firstDraw);
  tourRefresh();
  if(enterDir){
    const el = view.querySelector('.card');
    if(el && el.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches){
      el.animate([{transform:`translateX(${enterDir*48}px)`, opacity:0}, {transform:'none', opacity:1}], {duration:220, easing:'ease-out'});
    }
    enterDir = 0;
  }
}
function render(){ kbBarHide(); draw(); syncHistory(); }
const canAnimate = () => !!view.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches;
/* ===================== Нижнее окно: сведения и подтверждения ===================== */
const sheetRoot = $id('sheetRoot');
let sheetOpener = null, onConfirm = null;
// Пока открыто окно или идёт обучение, остальная страница недоступна ни касанием, ни клавишей Tab, ни скринридеру
const inertState = {sheet:false, tour:false};
function setInert(key, on){
  inertState[key] = on;
  const app = document.querySelector('.app');
  if(app) app.inert = inertState.sheet || inertState.tour;
}
function openSheet(inner){
  onConfirm = null;
  sheetOpener = document.activeElement;
  sheetRoot.innerHTML = `<div class="overlay" data-act="overlay">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle" tabindex="-1"><div class="sheet-handle"></div>${inner}</div>
  </div>`;
  document.body.classList.add('is-locked');
  setInert('sheet', true);
  sheetRoot.querySelector('.sheet').focus({preventScroll:true});
}
function closeSheet(silent){
  if(!sheetRoot.childElementCount) return false;
  kbBarHide();
  sheetRoot.innerHTML = '';
  onConfirm = null;
  document.body.classList.remove('is-locked');
  setInert('sheet', false);
  if(!silent && sheetOpener && sheetOpener.isConnected) sheetOpener.focus({preventScroll:true});
  sheetOpener = null;
  return true;
}
const CLOSE_BTN = '<button class="btn btn-secondary btn-block" type="button" data-act="close">Закрыть</button>';

// Ручка сверху окна: потяните вниз — окно закроется, отпустите раньше — вернётся на место
(() => {
  const CLOSE_DIST = 90, CLOSE_SPEED = .6, ANIM = 200;   // px, px/мс, мс
  let drag = null;
  sheetRoot.addEventListener('pointerdown', e => {
    const handle = e.target.closest('.sheet-handle');
    if(!handle || !e.isPrimary || drag) return;
    const sh = handle.closest('.sheet');
    drag = {sh, handle, id:e.pointerId, y0:e.clientY, t0:e.timeStamp, dy:0};
    sh.style.animation = 'none';
    sh.style.transition = 'none';
    handle.setPointerCapture(e.pointerId);
  });
  sheetRoot.addEventListener('pointermove', e => {
    if(!drag || e.pointerId !== drag.id) return;
    drag.dy = Math.max(0, e.clientY - drag.y0);
    drag.sh.style.transform = `translateY(${drag.dy}px)`;
  });
  const finish = (e, cancelled) => {
    if(!drag || e.pointerId !== drag.id) return;
    const {sh, dy} = drag, fast = dy / Math.max(1, e.timeStamp - drag.t0) > CLOSE_SPEED;
    drag = null;
    sh.style.transition = `transform ${ANIM}ms cubic-bezier(.2,.8,.2,1)`;
    if(!cancelled && (dy > CLOSE_DIST || (fast && dy > 24))){
      sh.style.transform = 'translateY(100%)';
      setTimeout(() => { if(sh.isConnected) closeSheet(); }, ANIM);
    } else {
      sh.style.transform = '';
    }
  };
  sheetRoot.addEventListener('pointerup', e => finish(e, false));
  sheetRoot.addEventListener('pointercancel', e => finish(e, true));
})();
const sheetHead = (d, hideLatin) => `<header class="drug"><h2 class="drug-name" id="sheetTitle">${esc(d[0])}</h2>${hideLatin ? '' : `<div class="drug-latin" lang="la">${esc(d[4])}</div>`}</header>`;
// Подсказка «i» во время вопроса: только сведения о препарате, без ответов
function openInfo(){
  const S = cur();
  if(!S || S.pos>=S.order.length || !INFO[S.order[S.pos][0]]) return;
  const d = S.order[S.pos];
  const hide = SESSION[S.mode].kind==='write' && !S.state[S.pos].checked;   // «Впиши сам»: латынь и синонимы пока скрыты
  openSheet(sheetHead(d, hide) + drugFacts(d, false, hide) + CLOSE_BTN);
}
// Полная карточка препарата — из итогов, списка ошибок и справочника
function openDrug(d){
  if(!d) return;
  openSheet(`<div class="card-tag"><span class="chip">${esc(grpText(d))}</span></div>` + sheetHead(d) + drugFacts(d, true) + CLOSE_BTN);
}
function askConfirm(title, text, ok, fn){
  openSheet(`<h2 class="sheet-title" id="sheetTitle">${title}</h2><p class="sheet-text">${text}</p>
    <div class="actions actions-even">
      <button class="btn btn-secondary" type="button" data-act="close">Отмена</button>
      <button class="btn btn-danger" type="button" data-act="confirm">${ok}</button>
    </div>`);
  onConfirm = fn;
}

/* ========================= События ========================= */
const ACTIONS = {
  up: () => go(parentOf(mode)),
  go: el => go(el.dataset.mode),
  ins: el => {                                           // быстрая вставка единицы в поле дозировки
    const inp = $id('f-dose'); if(!inp) return;
    const add = el.dataset.ins, pre = (add === '%' || /[\s(]$/.test(inp.value.slice(0, inp.selectionStart ?? inp.value.length)) || !inp.value) ? '' : ' ';
    const a = inp.selectionStart ?? inp.value.length, b = inp.selectionEnd ?? a;
    inp.focus({preventScroll:true});
    inp.setRangeText(pre + add, a, b, 'end');
    inp.dispatchEvent(new Event('input', {bubbles:true}));
  },
  htqStart: el => {                                      // тест открывается по кнопке (и перезапускается ею же)
    const root = el.closest('.htq'); if(!root) return;
    root.dataset.i = '0'; root.dataset.res = '';
    root.querySelector('.htq-intro').hidden = true;
    root.querySelector('.htq-stage').hidden = false;
    htqRender(root); htqScroll(root);
  },
  htq: el => {                                           // ответ на вопрос
    const root = el.closest('.htq'), st = root && root.querySelector('.htq-stage');
    if(!st || st.dataset.answered === root.dataset.i) return;
    const i = +root.dataset.i, it = HTQ[i], pick = +el.dataset.o, ok = pick === it.a;
    st.dataset.answered = root.dataset.i;
    root.dataset.res = (root.dataset.res || '') + (ok ? 'c' : 'w');
    st.querySelectorAll('.opt').forEach((b, j) => {
      b.disabled = true;
      if(j === it.a) b.classList.add('is-correct'); else if(j === pick) b.classList.add('is-wrong');
    });
    const dot = st.querySelectorAll('.htq-dot')[i];
    if(dot){ dot.classList.remove('is-cur'); dot.classList.add(ok ? 'is-ok' : 'is-no'); }
    const fb = st.querySelector('.htq-fb');
    fb.className = 'htq-fb ' + (ok ? 'is-ok' : 'is-no');
    fb.innerHTML = `<b>${ok ? 'Верно!' : 'Не совсем.'}</b> ${it.e}`;
    fb.hidden = false;
    const next = st.querySelector('.htq-next'); next.hidden = false;
    try{ next.scrollIntoView({block:'nearest', behavior:'smooth'}); }catch(_){}
  },
  htqNext: el => {
    const root = el.closest('.htq'); if(!root) return;
    root.dataset.i = String(+root.dataset.i + 1);
    htqRender(root); htqScroll(root);
  },
  reloadApp: () => { flushSave(); location.reload(); },
  openSemTest: el => { semIdx = +el.dataset.i || 0; go('semMenu'); },
  openSem: el => startSemTest(+el.dataset.i || 0, el.dataset.mode==='semWrite' ? 'semWrite' : 'semQuiz'),
  open: el => { if(el.dataset.mode==='groupCards') cardsBack = mode; openBlock(el.dataset.mode, +el.dataset.i); },
  openTopic: el => { cardsBack = 'tests'; openBlock('groupCards', +el.dataset.i); },
  openFav: () => { favSnap = null; cardsBack = 'menu'; openBlock('groupCards', 'fav'); },
  fav: el => {   // звёздочка на карточке: обновляем кнопку на месте, без перерисовки карточки
    const d = DB[+el.dataset.d];
    if(!d) return;
    const on = favToggle(d);
    el.classList.toggle('is-on', on);
    el.setAttribute('aria-pressed', String(on));
    el.setAttribute('aria-label', on ? 'Убрать из избранного' : 'Добавить в избранное');
    announce(on ? 'Добавлено в избранное' : 'Убрано из избранного');
  },
  openMistakes: el => openMistakes(el.dataset.mode),
  reset: el => askReset(el.dataset.mode, el.dataset.i==null ? null : SESSION[el.dataset.mode]?.grp ? el.dataset.i : +el.dataset.i),
  myGrpOpen: el => { curGrp = el.dataset.g || ''; grpBack = mode==='myrx' ? 'myrx' : 'menu'; go('myGroup'); },
  myGrpAdd: () => myGrpAddSheet(),
  myGrpAddGo: () => myGrpAddGo(),
  myGrpRemove: el => myGrpRemove(el.dataset.id),
  myGrpTest: el => { if(el.dataset.mode==='groupCards'){ cardsBack = 'myGroup'; openBlock('groupCards', 'g_' + el.dataset.i); } else openBlock(el.dataset.mode, el.dataset.i); },
  myGrpNew: () => myGrpSheet(''),
  myGrpEdit: el => myGrpSheet(el.dataset.g),
  myGrpDel: el => myGrpDelete(el.dataset.g),
  myrxGrpSave: () => myGrpSave(),
  clearMistakes: () => askClearMistakes(),
  confirm: () => { const fn = onConfirm; closeSheet(); if(fn) fn(); },
  drug: el => openDrug(DB[+el.dataset.d]),
  opt: el => selectOpt(el.dataset.cat, +el.dataset.i),
  check: () => check(),
  next: () => nextAnimated(),
  prev: () => prev(),
  restart: () => restart(),
  info: () => openInfo(),
  close: () => closeSheet(),
  overlay: (el, e) => { if(e.target===el) closeSheet(); },
  jumpTo: el => jumpTo(+el.dataset.i),
  cardNext: () => cardMove(1),
  cardPrev: () => cardMove(-1),
  cardRestart: () => cardRestart(),
  howWrite: () => go('howto'),
  myrxPick: el => {
    const d = DB[+el.dataset.d];
    if(!d || !rxDraft) return;
    rxDraft.drug = +el.dataset.d < BASE_LEN ? d[0] + ' (мой)' : d[0];   // у препарата из справочника название должно отличаться, иначе в тестах оно совпадёт с оригиналом
    myrxFill(rxDraft, d);       // латынь, дозировка, число доз, Signa, группа и путь — из справочника
    render();
  },
  kbPick: el => {                                           // выбор в панели над клавиатурой
    const inp = kbEl, v = el.dataset.v;
    if(!inp || !v) return;
    let cur = v;
    if(el.dataset.m==='add'){                              // Signa: дописываем к уже набранному
      cur = inp.value.replace(/\s+$/, '');
      cur = cur && !/[,.;:]$/.test(cur) ? cur + (/^(внутрь|в\/в|в\/м|п\/к)$/.test(v) ? '; ' : ' ') + v : cur ? cur + ' ' + v : v;
    }
    inp.value = cur;
    inp.dispatchEvent(new Event('input', {bubbles:true}));   // дальше всё как при ручном вводе: черновик, бланк, проверки, пересчёт панели
    try{ inp.focus({preventScroll:true}); inp.setSelectionRange(cur.length, cur.length); }catch(_){}
  },
  myrxImportOpen: () => { myrxLastText = ''; openSheet(myrxImpHtml1()); },
  feedback: () => {
    openSheet(`<h2 class="sheet-title" id="sheetTitle">Предложения по улучшению</h2>
      <p class="sheet-text">Что неудобно, чего не хватает, где ошибка? Напишите своими словами.</p>
      <textarea class="input my-ta is-short" id="fbText" rows="5" maxlength="2000" placeholder="Например: хочу сортировку рецептов по названию" aria-label="Ваше предложение" style="font-family:inherit"></textarea>
      <p class="my-meta" id="fbMsg" role="status" hidden></p>
      <div class="actions actions-even">
        <button class="btn btn-secondary" type="button" data-act="close">Отмена</button>
        <button class="btn btn-primary" type="button" data-act="feedbackSend">Отправить</button>
      </div>`);
  },
  feedbackSend: async el => {
    const ta = $id('fbText'), msg = $id('fbMsg'); if(!ta || !msg || el.disabled) return;
    const text = ta.value.trim(), say = t => { msg.textContent = t; msg.hidden = false; };
    if(!text){ say('Напишите пару слов, и можно отправлять.'); ta.focus(); return; }
    const subj = 'Предложения по улучшению: Рецепты';
    el.disabled = true; el.textContent = 'Отправляем…'; msg.hidden = true;
    try{   // отправка на почту через FormSubmit (своего сервера у приложения нет)
      const res = await fetch('https://formsubmit.co/ajax/' + FEEDBACK_FORM_ID, {
        method:'POST', headers:{'Content-Type':'application/json', 'Accept':'application/json'},
        body: JSON.stringify({message:text, _subject:subj, _captcha:'false', _template:'table', _honey:'', устройство:navigator.userAgent.slice(0, 140)})
      });
      const j = await res.json().catch(() => ({}));
      if(!res.ok || String(j.success)==='false') throw new Error('send');
      myrxSheet(`<h2 class="sheet-title" id="sheetTitle">Спасибо!</h2><p class="sheet-text">Предложение отправлено. Мы обязательно его прочитаем.</p>${CLOSE_BTN}`);
    }catch(_){   // нет сети или сервис не ответил: письмо откроется в почтовом приложении, текст не потеряется
      el.disabled = false; el.textContent = 'Отправить';
      say('Не удалось отправить напрямую. Открываю почту: останется нажать «Отправить» в письме.');
      location.href = 'mailto:' + FEEDBACK_EMAIL + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(text);
    }
  },
  myrxExportOpen: () => myrxOpenSend(),
  myrxSendMode: el => { myrxSend.mode = el.dataset.m; myrxSheet(myrxSendHtml()); },
  myrxSendFolder: el => { myrxSend.folder = el.dataset.g; myrxSheet(myrxSendHtml()); },
  myrxSendAll: () => { const l = myrxLoad(); myrxSend.pick = myrxSend.pick.size===l.length ? new Set() : new Set(l.map(r => r.id)); myrxSheet(myrxSendHtml()); },
  myrxSendGo: async () => {
    const recs = myrxSendRecs();
    if(!recs.length){ myrxStatus(myrxSend.mode==='pick' ? 'Отметьте рецепты, которые нужно отправить.' : 'Отправлять нечего.', true); return; }
    const name = myrxSendName(), text = myrxBuildFor(recs, true), n = recs.length;
    const file = new File([text], name, {type:'application/json'});
    let can = false; try{ can = !!(navigator.share && navigator.canShare && navigator.canShare({files:[file]})); }catch(_){}
    if(can){
      try{ await navigator.share({files:[file], title:'Мои рецепты'}); myrxStatus('Готово: ' + myrxRecipes(n) + '.', false); return; }
      catch(err){ if(err && err.name==='AbortError') return; }   // окно закрыли — ничего не делаем; сбой — скачиваем файл
    }
    myrxDownload(text, name);
    myrxStatus('Файл «' + name + '» скачан (' + myrxRecipes(n) + '). Проверьте папку «Загрузки».', false);
  },
  myrxImpText: () => { const t = $id('myrxText'); myrxLastText = t ? t.value : ''; myrxImpRun(myrxLastText); },
  myrxFillNext: () => {
    const f = myrxWiz; if(!f) return;
    myrxFillRead();
    const r = f.todo[f.pos], F = myrxForm(r.form);
    const miss = f.keys.find(k => !f.cur[k]);
    if(miss){ myrxFillRender('Заполните поле «' + myrxGapLabel(miss, F).replace(/:$/, '') + '» или пропустите рецепт.'); return; }
    if(f.cur.latin && /[А-Яа-яЁё]/.test(f.cur.latin)){ myrxFillRender('Название пишется латиницей, в родительном падеже (например, Labetaloli).'); return; }
    f.keys.forEach(k => { r[k] = myrxFillNorm(k, f.cur[k]); });
    if(!String(r.drug || '').trim() && r.latin) r.drug = r.latin.charAt(0).toUpperCase() + r.latin.slice(1);
    myrxFillAdvance();
  },
  myrxFillSkip: () => { const f = myrxWiz; if(!f) return; f.skip.add(f.todo[f.pos]); myrxFillAdvance(); },
  myrxFillAll: el => {
    const f = myrxWiz; if(!f) return;
    myrxFillRead();
    const k = el.dataset.k, F = myrxForm(f.todo[f.pos].form), v = myrxFillNorm(k, f.cur[k] || '');
    if(!v){ myrxFillRender('Сначала впишите «' + myrxGapLabel(k, F).replace(/:$/, '') + '».'); return; }
    f.cur[k] = v;
    let c = 0;
    f.todo.slice(f.pos + 1).forEach(x => { if(!String(x[k] || '').trim()){ x[k] = v; c++; } });
    f.note = 'Применено ещё к ' + c + ' ' + plural(c, 'рецепту', 'рецептам', 'рецептам') + '.';
    myrxFillRender();
  },
  myrxImpBack: () => myrxSheet(myrxImpHtml1()),
  myrxImpGo: () => myrxImportCommit(),
  myrxPasteClip: async () => {
    const ta = $id('myrxText');
    try{ const t = await navigator.clipboard.readText(); if(ta){ ta.value = t; ta.focus(); } }
    catch(_){ if(ta) ta.focus(); myrxImpErr('Браузер не дал доступ к буферу. Вставьте текст в поле вручную: долгое нажатие → «Вставить».'); }
  },
  myrxNoteClose: el => { const b = el.closest('.my-res'); if(b) b.remove(); },
  myrxNew: () => { rxDraft = myrxBlankDraft(); myrxEditBack = 'myrx'; myrxDestOpen = false; myrxSeries = myrxNoSeries(); go('myrxEdit'); },
  myGrpNewRx: () => {                                        // рецепт прямо из папки: она уже отмечена, «назад» вернёт в папку
    if(!myGrpOk()) return;
    rxDraft = myrxBlankDraft(); rxDraft.tests = ['g_' + curGrp];
    myrxEditBack = 'myGroup'; myrxDestOpen = false; myrxSeries = myrxNoSeries(); go('myrxEdit');
  },
  myrxEdit: el => { const r = myrxLoad().find(x => x.id===el.dataset.id); if(!r) return; rxDraft = {...r, tests:[...r.tests]}; myrxEditBack = 'myrx'; myrxDestOpen = false; myrxSeries = myrxNoSeries(); go('myrxEdit'); },
  myrxFinish: () => {                                        // конец серии: уже сохранённое остаётся, несохранённый черновик спросим
    const r = rxDraft, filled = !!r && ['drug', 'latin', 'dose', 'vol', 'num', 'signa'].some(k => String(r[k] || '').trim());
    const out = () => { rxDraft = null; go(parentOf('myrxEdit')); };
    if(filled) askConfirm('Выйти без сохранения?', 'Текущий рецепт ещё не сохранён и пропадёт. Рецепты, добавленные ранее, останутся.', 'Выйти', out);
    else out();
  },
  myrxSelOn: () => myrxSelEnter(''),
  myrxSelOff: () => { myrxSelLeave(); render(); },
  myrxSelRow: el => {
    const id = el.dataset.id, on = !myrxSel.ids.has(id);
    if(on) myrxSel.ids.add(id); else myrxSel.ids.delete(id);
    el.classList.toggle('is-sel', on); el.setAttribute('aria-checked', String(on));
    myrxSelRefresh();
  },
  myrxSelAll: () => {
    const list = myrxLoad(), all = myrxSel.ids.size !== list.length;
    myrxSel.ids = all ? new Set(list.map(r => r.id)) : new Set();
    document.querySelectorAll('.my-selrow').forEach(b => { b.classList.toggle('is-sel', all); b.setAttribute('aria-checked', String(all)); });
    myrxSelRefresh();
  },
  myrxSelDel: () => {
    const ids = new Set(myrxSel.ids); if(!ids.size) return;
    const chosen = myrxLoad().filter(r => ids.has(r.id)), n = chosen.length;
    const act = chosen.map(r => MY_ACTIVE.find(m => m.id===r.id)).filter(Boolean);
    const tests = new Set(act.flatMap(m => [...m.tests]));
    const warn = tests.size && myrxHasProgress(tests) ? ' Прогресс тестов, куда входили эти рецепты, будет сброшен.' : '';
    askConfirm('Удалить ' + myrxRecipes(n) + '?', 'Выбранные рецепты будут удалены с этого устройства без возможности восстановления.' + warn, 'Удалить (' + n + ')', () => {
      if(!myrxStore(myrxLoad().filter(x => !ids.has(x.id)))){ myrxStorageFail(); return; }
      myrxSelLeave();
      myrxNoteSet('Удалено: ' + myrxRecipes(n) + '.');
      myrxApplied(act.length ? {tests:[...tests]} : undefined, false, []);
    });
  },
  myrxSelMove: () => {
    const n = myrxSel.ids.size, gs = myGrpLoad(); if(!n || !gs.length) return;
    const rs = myrxLoad();
    openSheet(`<h2 class="sheet-title" id="sheetTitle">В какую папку?</h2>
      <p class="sheet-text">${myrxRecipes(n)} добавятся в выбранную папку. Из «Мои рецепты» они никуда не пропадут.</p>
      <div class="my-pick">${gs.map(g => { const k = rs.filter(r => r.tests.includes('g_' + g.id)).length;
        return `<button class="btn btn-secondary btn-block my-pickrow" type="button" data-act="myrxSelToGrp" data-g="${esc(g.id)}"><span>${esc(g.name)}</span><small>${k ? myrxRecipes(k) : 'пусто'}</small></button>`; }).join('')}</div>
      <button class="btn btn-secondary btn-block" type="button" data-act="close">Отмена</button>`);
  },
  myrxSelToGrp: el => {
    const g = myGrpLoad().find(x => x.id===el.dataset.g); if(!g) return;
    const tid = 'g_' + g.id, ids = new Set(myrxSel.ids);
    const fresh = myrxLoad().filter(r => ids.has(r.id) && !r.tests.includes(tid)).length;
    if(!fresh){
      myrxSheet(`<h2 class="sheet-title" id="sheetTitle">Уже в папке</h2><p class="sheet-text">Все выбранные рецепты уже лежат в папке «${esc(g.name)}».</p>${CLOSE_BTN}`);
      return;
    }
    const run = () => {
      if(!myrxStore(myrxLoad().map(r => ids.has(r.id) ? {...r, tests:[...new Set([...r.tests, tid])]} : r))){ myrxStorageFail(); return; }
      myrxSelLeave();
      myrxNoteSet('В папку «' + g.name + '» добавлено: ' + myrxRecipes(fresh) + '.');
      myrxApplied(undefined, true, [tid]);
    };
    if(myrxHasProgress([tid])) askConfirm('Добавить в папку?', 'Прогресс тестов этой папки будет сброшен, а страница обновится.', 'Добавить', run);
    else run();
  },
  myGaddAll: () => {
    const all = [...document.querySelectorAll('input[data-gadd]')], on = !all.every(x => x.checked);
    all.forEach(x => { x.checked = on; const tg = x.closest('.my-tog'); if(tg) tg.classList.toggle('is-on', on); });
    const e = $id('myGaddErr'); if(e) e.hidden = true;
    myGaddRefresh();
  },
  myrxForm: el => { if(!rxDraft) return; rxDraft.form = el.dataset.f; render(); },
  myrxSave: () => myrxSaveDraft(false),
  myrxSaveMore: () => myrxSaveDraft(true),
  myrxDel: el => {
    const id = el.dataset.id;
    const was = MY_ACTIVE.find(m => m.id===id);
    const warn = was && myrxHasProgress(was.tests) ? ' Прогресс тестов, куда входил рецепт, будет сброшен.' : '';
    askConfirm('Удалить рецепт?', 'Рецепт будет удалён с этого устройства без возможности восстановления.' + warn, 'Удалить', () => {
      if(!myrxStore(myrxLoad().filter(x => x.id!==id))){ myrxStorageFail(); return; }
      myrxApplied(was, false, []);
    });
  },
  myrxCopy: el => {
    const r = myrxLoad().find(x => x.id===el.dataset.id); if(!r) return;
    const old = el.textContent;
    myrxCopyText(myrxPlain(r)).then(() => { el.textContent = 'Готово ✓'; }, () => { el.textContent = 'Не удалось'; });
    setTimeout(() => { if(el.isConnected) el.textContent = old; }, 1600);
  },
  theme: el => { setTheme(!isDark()); el.textContent = isDark() ? '☀ Светлая тема' : '☾ Тёмная тема'; },
  tour: el => {                                                // сбрасывает все подсказки: они покажутся при заходе на экраны
    Object.values(TOURS).forEach(T => store.del(T.key)); TOURS_OLD_KEYS.forEach(k => store.del(k));
    if(!el) return;
    const t = el.textContent; el.textContent = 'Подсказки покажутся заново';
    setTimeout(() => { if(el.isConnected) el.textContent = t; }, 2500);
  },
  resetSection: el => askResetSection(el.dataset.sec),
  topicsToggle: el => {
    topicsOpen = !topicsOpen;
    el.setAttribute('aria-expanded', topicsOpen ? 'true' : 'false');
    const body = $id('topicsBody');
    if(body) body.hidden = !topicsOpen;
  }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if(!el || el.disabled) return;
  const act = el.dataset.act, fn = ACTIONS[act];
  if(!fn) return;

  fn(el, e);
});
function autosizeArea(t){ t.style.height = 'auto'; t.style.height = t.scrollHeight + 4 + 'px'; }
document.addEventListener('keydown', e => { if(e.key==='Enter' && e.target && e.target.tagName==='TEXTAREA' && e.target.dataset.my){ e.preventDefault(); e.target.blur(); } });   // Signa — одна строка текста, без переводов строки
document.addEventListener('input', e => {
  const t = e.target;
  if(kbKind(t)) kbBarShow(t);
  if(t.id==='refQuery'){ $id('refList').innerHTML = refRows(t.value); return; }
  if(t.dataset && t.dataset.gadd !== undefined){ const tg = t.closest('.my-tog'); if(tg) tg.classList.toggle('is-on', t.checked); const e = $id('myGaddErr'); if(e) e.hidden = true; myGaddRefresh(); return; }
  if(t.dataset && t.dataset.mytest){
    if(!rxDraft) return;
    const id = t.dataset.mytest, i = rxDraft.tests.indexOf(id);
    if(t.checked && i < 0) rxDraft.tests.push(id);
    if(!t.checked && i >= 0) rxDraft.tests.splice(i, 1);
    const tg = t.closest('.my-tog'); if(tg) tg.classList.toggle('is-on', t.checked);
    const e = $id('myrxErr'); if(e) e.hidden = true;
    myrxDestUpdate();
    return;
  }
  if(t.dataset && t.dataset.mytopics !== undefined){
    if(!rxDraft) return;
    if(t.checked) rxTopicsSet.add(rxDraft);
    else { rxTopicsSet.delete(rxDraft); rxDraft.tests = rxDraft.tests.filter(id => !/^b\d$/.test(id)); document.querySelectorAll('#myTopicBox input[data-mytest]').forEach(c => { c.checked = false; const g = c.closest('.my-tog'); if(g) g.classList.remove('is-on'); }); }
    const tg = t.closest('.my-tog'); if(tg) tg.classList.toggle('is-on', t.checked);
    const box = $id('myTopicBox'); if(box) box.hidden = !t.checked;
    const e = $id('myrxErr'); if(e) e.hidden = true;
    myrxDestUpdate();
    return;
  }
  if(t.dataset && t.dataset.my){
    if(t.tagName==='TEXTAREA'){ const v = t.value.replace(/[\r\n]+/g, ' '); if(v!==t.value) t.value = v; autosizeArea(t); }
    if(!rxDraft) return;
    rxDraft[t.dataset.my] = t.type==='checkbox' ? t.checked : t.value;
    myrxPreviewUpdate(); myrxNeedUpdate();
    if(t.dataset.my==='drug') myrxSuggest(t.value);
    return;
  }
  const key = t.dataset && t.dataset.field;
  const S = cur();
  if(!key || !S || S.pos>=S.order.length) return;
  const st = S.state[S.pos];
  if(st.checked) return;
  st.typed[key] = t.value;
  saveSoon(S);
  syncPrimary(S);
  const fill = $id('wrFill'); if(fill) fill.textContent = wrFillText(st);
});
document.addEventListener('click', e => {
  for(const id of ['myDd', 'myDd2']){
    const dd = $id(id);
    if(dd && dd.open && !dd.contains(e.target)) dd.open = false;
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if(t && t.dataset && t.dataset.sendpick!==undefined){   // отметки в окне «Отправить рецепты»
    if(t.checked) myrxSend.pick.add(t.dataset.sendpick); else myrxSend.pick.delete(t.dataset.sendpick);
    const lb = t.closest('.my-tog'); if(lb) lb.classList.toggle('is-on', t.checked);
    const b = $id('myrxSendGo'); if(b) b.textContent = myrxSendBtn();
    const st = $id('myrxStatus'); if(st) st.hidden = true;
    return;
  }
  if(!t || t.id!=='myrxFile' || !t.files || !t.files[0]) return;
  const file = t.files[0];
  setTimeout(() => { try{ t.value = ''; }catch(_){} }, 0);   // чтобы тот же файл можно было выбрать повторно
  myrxImpFile(file);
});
/* Долгое нажатие на строку «Мои рецепты» включает выбор (как в галерее и почте). Палец сдвинулся или начался скролл — отмена. */
let myrxLP = null, myrxSwallow = false;
const myrxLPCancel = () => { if(myrxLP){ clearTimeout(myrxLP.t); myrxLP = null; } };
document.addEventListener('pointerdown', e => {
  const sum = e.target.closest && e.target.closest('.my-row-s');
  if(!sum || mode!=='myrx' || myrxSel.on || (e.pointerType==='mouse' && e.button!==0)) return;
  const row = sum.closest('.my-row'), id = row && row.dataset.rx; if(!id) return;
  myrxLPCancel();
  myrxLP = {x:e.clientX, y:e.clientY, t:setTimeout(() => {
    myrxLP = null; myrxSwallow = true;
    try{ if(navigator.vibrate) navigator.vibrate(12); }catch(_){}
    myrxSelEnter(id);
  }, 480)};
});
document.addEventListener('pointermove', e => { if(myrxLP && Math.hypot(e.clientX - myrxLP.x, e.clientY - myrxLP.y) > 10) myrxLPCancel(); });
['pointerup', 'pointercancel'].forEach(ev => document.addEventListener(ev, () => { myrxLPCancel(); if(myrxSwallow) setTimeout(() => { myrxSwallow = false; }, 350); }));
addEventListener('scroll', myrxLPCancel, {passive:true});
document.addEventListener('click', e => { if(myrxSwallow){ myrxSwallow = false; e.preventDefault(); e.stopPropagation(); } }, true);   // отпускание пальца после долгого нажатия не должно раскрыть строку
document.addEventListener('contextmenu', e => { if(e.target.closest && e.target.closest('.my-row-s')) e.preventDefault(); });
const myrxZone = e => e.target.closest && e.target.closest('#myrxDrop');
['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => { const z = myrxZone(e); if(z){ e.preventDefault(); z.classList.add('is-over'); } }));
document.addEventListener('dragleave', e => { const z = myrxZone(e); if(z) z.classList.remove('is-over'); });
document.addEventListener('drop', e => {
  const z = myrxZone(e); if(!z) return;
  e.preventDefault(); z.classList.remove('is-over');
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if(f) myrxImpFile(f);
});
// Подсказки закрываются при уходе из поля и по Esc; выбор пункта идёт через pointerdown, чтобы поле не теряло фокус раньше времени
document.addEventListener('pointerdown', e => { if(e.target.closest && e.target.closest('.my-sug-i, .kb-bar')) e.preventDefault(); });
document.addEventListener('focusout', e => {
  if(e.target && e.target.id==='my-drug') setTimeout(myrxSuggestHide, 120);
  if(e.target && e.target===kbEl) kbBarHide();
});
document.addEventListener('focusin', e => {
  if(!e.target) return;
  if(kbKind(e.target)) kbBarShow(e.target); else kbBarHide();
  if(e.target.id==='my-drug' && e.target.value) myrxSuggest(e.target.value);
});
document.addEventListener('keydown', e => {
  const open = $id('mySug') && !$id('mySug').hidden;
  if(e.key==='Escape' && open){ myrxSuggestHide(); e.stopPropagation(); }
}, true);
// Клавиатура: Enter — «Проверить» / «Далее», стрелки — соседний вопрос или карточка, Esc — закрыть окно
document.addEventListener('keydown', e => {
  if(e.key==='Escape'){ closeSheet(); return; }
  if(e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target, field = t.dataset && t.dataset.field;
  if(field){
    if(e.key!=='Enter') return;
    e.preventDefault();
    const nextId = field==='latin' ? 'f-dose' : field==='dose' ? 'f-group' : '';
    if(nextId){ const g = $id(nextId); if(g) g.focus(); }
    else check();
    return;
  }
  if(t.id==='refQuery'){ if(e.key==='Enter'){ e.preventDefault(); t.blur(); } return; }
  if(sheetRoot.childElementCount || (t.closest && t.closest('input, textarea, select'))) return;
  if(e.key==='ArrowRight' || e.key==='ArrowLeft'){
    const cfg = swipeConfig(), fwd = e.key==='ArrowRight';
    if(cfg && (fwd ? cfg.canNext : cfg.canPrev)){ e.preventDefault(); (fwd ? cfg.next : cfg.prev)(); }
  } else if(e.key==='Enter'){
    // на обычной кнопке Enter нажимает её саму; с варианта ответа или пустого места — главную кнопку
    // вариант ответа: ещё не выбранный выбирается нативным Enter, уже выбранный — подтверждает ответ
    if(t.closest && t.closest('button, a') && !(t.classList.contains('opt') && t.getAttribute('aria-pressed')==='true')) return;
    const p = $id('primary');
    if(p && !p.disabled){ e.preventDefault(); p.click(); }
  }
});

/* ===================== Свайп карточек ===================== */
function swipeConfig(){
  if(mode==='groupCards'){
    const n = cardSet(cards.block).items.length;
    return {canPrev: cards.pos>0, canNext: cards.pos<n-1, prev: () => cardMove(-1), next: () => cardMove(1)};
  }
  const S = cur();
  if(!S) return null;
  return {canPrev: S.pos>0, canNext: S.pos<S.order.length, prev, next: () => { const c = cur(); if(c && c.state[c.pos].checked) next(true); else skip(); }};
}
(function(){
  const THRESH = 70;
  let el = null, cfg = null, sx = 0, sy = 0, dx = 0, active = false, locked = false, pid = null, raf = 0, suppress = false;
  function frame(){
    raf = 0;
    let x = dx;
    if((x<0 && !cfg.canNext) || (x>0 && !cfg.canPrev)) x = x/4; // сопротивление, если дальше нельзя
    el.style.transform = `translateX(${x}px) rotate(${x/28}deg)`;
    el.style.opacity = String(Math.max(0.4, 1 - Math.abs(x)/320));
  }
  view.addEventListener('pointerdown', e => {
    if(e.pointerType==='mouse' && e.button!==0) return;
    const card = e.target.closest('.card[data-swipe]');
    // мышью по полю ввода — выделение текста; пальцем по полю — свайп работает как на остальной карточке
    if(!card || (e.pointerType==='mouse' && e.target.closest('input,textarea,select'))) return;
    cfg = swipeConfig();
    if(!cfg) return;
    el = card; sx = e.clientX; sy = e.clientY; dx = 0; active = true; locked = false; pid = e.pointerId;
  });
  view.addEventListener('pointermove', e => {
    if(!active || e.pointerId!==pid) return;
    const mx = e.clientX - sx, my = e.clientY - sy;
    if(!locked){
      if(Math.abs(my)>10 && Math.abs(my)>Math.abs(mx)){ active = false; return; } // вертикальная прокрутка
      if(Math.abs(mx)>10 && Math.abs(mx)>Math.abs(my)*1.2){
        locked = true;
        try{ el.setPointerCapture(pid); }catch{}
        el.style.transition = 'none';
      } else return;
    }
    dx = mx;
    e.preventDefault();
    if(!raf) raf = requestAnimationFrame(frame);
  });
  function end(commit){
    if(!active) return;
    active = false;
    if(!locked) return; // это был обычный тап — кнопки работают как обычно
    locked = false;
    if(raf){ cancelAnimationFrame(raf); raf = 0; }
    try{ el.releasePointerCapture(pid); }catch{}
    suppress = true;
    setTimeout(() => { suppress = false; }, 60);
    el.style.transition = 'transform .2s ease, opacity .2s ease';
    const dir = commit && dx<=-THRESH && cfg.canNext ? 1 : commit && dx>=THRESH && cfg.canPrev ? -1 : 0;
    if(dir){
      const move = dir>0 ? cfg.next : cfg.prev;
      el.style.pointerEvents = 'none';
      el.style.transform = `translateX(${dir>0 ? -120 : 120}%) rotate(${dir>0 ? -10 : 10}deg)`;
      el.style.opacity = '0';
      const S0 = cur(), pos0 = S0 ? S0.pos : cards.pos, mode0 = mode;
      setTimeout(() => {
        const S1 = cur();
        if(mode!==mode0 || S1!==S0 || (S1 ? S1.pos : cards.pos)!==pos0) return;   // экран сменился за время анимации
        enterDir = dir; move(); enterDir = 0;
      }, 160);
    } else {
      el.style.transform = '';
      el.style.opacity = '';
    }
  }
  view.addEventListener('pointerup', () => end(true));
  view.addEventListener('pointercancel', () => end(false));
  view.addEventListener('click', e => { if(suppress){ e.stopPropagation(); e.preventDefault(); } }, true);
})();

/* =========================================================
   СИСТЕМНАЯ КНОПКА «НАЗАД»
   Глубина экрана: 0 — меню; 1 — режимы, списки блоков, ошибки и справочник; 2 — внутри блока или повторения.
   Каждому уровню соответствует запись в истории, поэтому «назад» поднимает на уровень выше.
   ========================================================= */
let histIgnore = 0, histWait = false;
const histCur = () => (history.state && typeof history.state.d==='number') ? history.state.d : 0;
function userActive(){
  try{ return !navigator.userActivation || navigator.userActivation.hasBeenActive; }catch{ return true; }
}
// Chrome на Android пропускает записи истории, созданные без касания пользователя,
// поэтому при автовосстановлении экрана ждём первого касания
function deferSync(){
  if(histWait) return;
  histWait = true;
  const evs = ['click','touchend','pointerup','keydown'];
  const h = () => {
    if(!userActive()) return;
    histWait = false;
    evs.forEach(t => document.removeEventListener(t, h, true));
    syncHistory();
  };
  evs.forEach(t => document.addEventListener(t, h, true));
}
function syncHistory(){
  if(myrxReloading) return;
  try{
    const d = depthOf(mode);
    let c = histCur();
    if(d > c){
      if(!userActive()){ deferSync(); return; }
      const route = JSON.parse(lastViewJson);
      const path = [mode];
      while(path.length <= d) path.unshift(parentOf(path[0]));
      while(c < d){
        c++;
        history.pushState({d:c, route:{...route, mode:path[c]}}, '');
      }
    } else if(d < c){
      if(histIgnore > 0) return;      // предыдущий переход по истории ещё не завершился — второй не запускаем
      histIgnore++;
      setTimeout(() => { histIgnore = 0; }, 600);
      history.go(d - c);
    } else if(JSON.stringify(history.state?.route) !== lastViewJson){
      history.replaceState({d, route:JSON.parse(lastViewJson)}, '');
    }
  }catch{}
}
addEventListener('popstate', e => {
  if(histIgnore > 0){ histIgnore--; syncHistory(); refreshDocTitle(); return; }
  if(closeSheet()){ // открыто окно «i» — закрываем его и остаёмся на экране
    try{ history.pushState({d: depthOf(mode), route:JSON.parse(lastViewJson)}, ''); }catch{}
    return;
  }
  const target = (e.state && typeof e.state.d==='number') ? e.state.d : 0;
  if(target < depthOf(mode)){
    flushSave();
    while(depthOf(mode) > target) mode = parentOf(mode);
    draw();
  } else if(target > depthOf(mode)){
    flushSave();
    if(e.state?.route) restoreView(e.state.route);
    draw();
    if(depthOf(mode) !== target) history.replaceState({d:depthOf(mode), route:JSON.parse(lastViewJson)}, '');
  }
});

/* ========================= Запуск ========================= */
/* Встроенные браузеры iOS (ссылка из мессенджера и т.п.) рисуют страницу под строкой состояния и нижней панелью,
   а env(safe-area-inset-*) там равен 0 — тогда подставляются запасные отступы.
   Отключить: добавить к адресу ?safe=0, принудительно включить: ?safe=1 */
function edgeFallback(){
  try{
    const q = new URLSearchParams(location.search).get('safe');
    if(q==='0') return;
    const standalone = navigator.standalone===true || matchMedia('(display-mode: standalone)').matches;
    if(standalone || !(q==='1' || /iP(hone|od)/.test(navigator.userAgent))) return;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe), t = parseFloat(cs.paddingTop) || 0, b = parseFloat(cs.paddingBottom) || 0;
    probe.remove();
    if(q!=='1' && innerHeight < screen.height - 2) return;           // обычная вкладка: браузер сам оставляет место
    const root = document.documentElement.style;
    // минимум: верх — под строку состояния и «остров»/вырез (шкала прогресса начинается на 12px ниже кнопок),
    // низ — над плавающей панелью Safari (её верхний край ≈ 72px от низа экрана)
    const h = screen.height, island = h>=852 && h!==896 && h!==926;
    if(!t) root.setProperty('--safe-t', (island ? 34 : h>=812 ? 30 : 12) + 'px');
    if(!b) root.setProperty('--safe-b', '66px');
  }catch{}
}


/* =========================================================
   ПОДСКАЗКИ (ОБУЧЕНИЕ)
   При первом входе в «Мои рецепты» и в вопрос теста запускаются подсказки.
   Кнопка «Показать обучение» позволяет снова увидеть их при входе в раздел.
   ========================================================= */
const TOURS = {
  myrx: {key:'pharma_tour_myrx_v1', scope:'.my-new, .my-xfer > *, .my-groups', steps:[
    {sel:'.my-new', t:'Новый рецепт', x:'Свой рецепт собирается на бланке. Можно взять препарат из справочника — поля заполнятся сами.'},
    {sel:'[data-act="myrxImportOpen"]', t:'Загрузить рецепты', x:'Файл или текст: JSON либо обычный рецепт. Чего не хватает — приложение спросит по шагам.'},
    {sel:'[data-act="myrxExportOpen"]', t:'Отправить рецепты', x:'Все, выбранные или целая папка. Файл уйдёт через «Поделиться» или скачается.'}
  ]},
  session: {key:'pharma_tour_session_v1', scope:'.drug .fav-btn', steps:[
    {t:'Листайте вопросы', x:'Смахните влево, чтобы перейти дальше. Если не нажали «Проверить», вопрос останется пропущенным. Смахните вправо, чтобы вернуться. Подсказки тоже можно листать свайпом.'},
    {sel:'.drug .fav-btn', t:'Сохраните препарат', x:'Нажмите звёздочку у названия. Препарат появится в «Избранном» в главном меню. Повторное нажатие уберёт его из списка.'}
  ]}
};
const TOURS_OLD_KEYS = ['pharma_tour_v1', 'pharma_tour_quiz_v1'];   // ключи прежнего единого обучения

// Строки рецепта не переносятся: размер шрифта подбирается так, чтобы самая длинная строка помещалась целиком
/* Целевой размер рецепта задаёт CSS (.blank .rxd). Короткие рецепты остаются на нём, длинные чуть уменьшаются (до FIT_MIN),
   и только если и так не помещается — переходят на сокращения (Rp.:, D.t.d.n., S.:) и снова стремятся к целевому размеру */
const FIT_MIN = 14.5, FIT_MIN_SHORT = 13.5;
function fitRx(){
  view.querySelectorAll('.rxd').forEach(box => {
    if(box.dataset.short && !box.dataset.full) box.dataset.full = box.innerHTML;
    if(box.dataset.full) box.innerHTML = box.dataset.full;
    box.style.fontSize = '';
    const over = () => box.scrollWidth > box.clientWidth + 1;
    const shrink = min => {
      let fs = parseFloat(getComputedStyle(box).fontSize) || 16;
      while(over() && fs > min){ fs -= 0.5; box.style.fontSize = fs + 'px'; }
    };
    shrink(box.dataset.short ? FIT_MIN : 10);
    if(box.dataset.short && over()){
      box.innerHTML = box.dataset.short;
      box.style.fontSize = '';
      shrink(FIT_MIN_SHORT);
      if(over()) shrink(10);
    }
  });
}
addEventListener('resize', fitRx);
if(document.fonts && document.fonts.ready) document.fonts.ready.then(fitRx);
let tour = null;     // {ids, key, steps, scope, i}
const tourSeen = id => store.has(TOURS[id].key);
const tourMark = id => store.set(TOURS[id].key, 1);
const tourUnseen = ids => ids.filter(id => !tourSeen(id));
// Подсказки одного экрана: список разделов склеивается в одну последовательность шагов
function tourBuild(ids){
  return {ids, key: ids.join('+'), steps: ids.flatMap(id => TOURS[id].steps),
    scope: [...new Set(ids.flatMap(id => TOURS[id].scope.split(',').map(x => x.trim())))].join(', ')};
}
function tourTargets(step){
  if(!step.sel) return [];
  const top = step.sel.split(',').filter(x => /^\s*#(topSub|backBtn)/.test(x)).join(',');
  return [...view.querySelectorAll(step.sel), ...(top ? document.querySelectorAll(top) : [])]
    .filter((el, k, a) => a.indexOf(el) === k)
    .map(el => el.closest('.rx-rows > *') || el);
}
function tourEnsureUi(){
  if(!$id('tourBlock')){
    const b = document.createElement('div'); b.id = 'tourBlock'; b.className = 'tour-block'; document.body.appendChild(b);
    const c = document.createElement('div'); c.id = 'tourCard'; c.className = 'tour-card'; c.setAttribute('role','dialog'); c.setAttribute('aria-live','polite'); document.body.appendChild(c);
  }
}
// Обводка не должна заходить на соседние кнопки: отступ подбирается по расстоянию до ближайшего видимого соседа.
// Обводка шире на толщину линии (3px) + отступ; оставляем 2px воздуха, а если места совсем нет — отступ 0 (лёгкое касание допустимо).
const TOUR_LINE = 3, TOUR_AIR = 2, TOUR_OFF_MAX = 5, TOUR_PULSE_MAX = 3;
function tourFitOutline(targets){
  const others = [...document.querySelectorAll(tour.scope), ...document.querySelectorAll('#topSub, #backBtn')]
    .filter((el, k, a) => a.indexOf(el) === k && !el.classList.contains('tour-dim'));
  targets.forEach(t => {
    const a = t.getBoundingClientRect();
    let gap = Infinity;
    others.forEach(o => {
      if(o === t || o.contains(t) || t.contains(o)) return;
      const b = o.getBoundingClientRect();
      if(!b.width || !b.height) return;
      const dx = Math.max(0, a.left - b.right, b.left - a.right), dy = Math.max(0, a.top - b.bottom, b.top - a.bottom);
      if(dx === 0 && dy === 0) return;                 // перекрываются сами по себе (например, вложенные блоки) — не считаем
      const d = Math.max(dx, dy);
      gap = Math.min(gap, targets.includes(o) ? d / 2 : d);   // рядом тоже обведённый блок: место делим пополам
    });
    const off = Math.max(0, Math.min(TOUR_OFF_MAX, gap - TOUR_AIR - TOUR_LINE));
    t.style.setProperty('--tour-off', off + 'px');
    t.style.setProperty('--tour-pulse', Math.min(TOUR_PULSE_MAX, off) + 'px');
  });
}
function tourApply(){
  if(!tour) return;
  const steps = tour.steps;
  let step = steps[tour.i], targets = tourTargets(step);
  // шаг про элемент, которого на экране нет (например, нет справки), пропускается
  while(step.sel && !targets.length && tour.i < steps.length - 1){ tour.i++; step = steps[tour.i]; targets = tourTargets(step); }
  // накопительно: видно всё, что показано на этом и прежних шагах; скрыто остальное в области обучения
  const shown = steps.slice(0, tour.i + 1).flatMap(tourTargets).filter((el, k, a) => a.indexOf(el) === k);
  const related = (a, b) => a === b || a.contains(b) || b.contains(a);
  document.querySelectorAll(tour.scope).forEach(el => {
    el.classList.toggle('tour-dim', !!step.sel && !shown.some(t => related(el, t)));
  });
  document.querySelectorAll('.tour-focus,.tour-seen').forEach(el => { el.classList.remove('tour-focus', 'tour-seen'); el.style.removeProperty('--tour-off'); el.style.removeProperty('--tour-pulse'); });
  shown.forEach(el => el.classList.add(targets.includes(el) ? 'tour-focus' : 'tour-seen'));
  tourFitOutline(targets);
  const last = tour.i === steps.length - 1;
  const card = $id('tourCard');
  const n = steps.length;
  card.classList.toggle('is-intro', !step.sel);
  card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-label', 'Подсказки');
  card.innerHTML = `<div class="tour-top">
      <span class="tour-count">${n > 1 ? `Шаг ${tour.i+1} из ${n}` : 'Подсказка'}</span>
      ${last ? '' : '<button class="tour-skip" type="button" data-tour="skip">Пропустить</button>'}
    </div>
    ${n > 1 ? `<div class="tour-dots" aria-hidden="true">${steps.map((_,k) => `<i class="${k===tour.i ? 'on' : k<tour.i ? 'done' : ''}"></i>`).join('')}</div>` : ''}
    <h2 class="tour-title">${esc(step.t)}</h2>
    <p class="tour-text">${esc(step.x)}</p>
    <div class="tour-actions">
      ${tour.i === 0 ? '' : '<button class="btn btn-secondary tour-back" type="button" data-tour="back">Назад</button>'}
      <button class="btn btn-primary tour-next" type="button" data-tour="next">${last ? 'Готово' : 'Далее'}</button>
    </div>`;
  { const nb = card.querySelector('.tour-next'); if(nb) try{ nb.focus({preventScroll:true}); }catch(_){} }
  // карточка подсказки — на свободной половине экрана, не поверх выделенного
  const first = targets[0];
  const r = first && first.getBoundingClientRect();
  card.classList.toggle('at-top', !!r && r.top + r.height/2 > innerHeight/2);
  // если карточка всё равно закрывает выделенное — сдвигаем страницу, чтобы цель оказалась на свободной части экрана
  if(first){
    const cr = card.getBoundingClientRect(), tr = first.getBoundingClientRect();
    if(tr.bottom > cr.top && tr.top < cr.bottom){
      const dy = card.classList.contains('at-top') ? tr.top - (cr.bottom + 8) : tr.bottom - (cr.top - 8);
      scrollBy({top:dy, behavior:'instant'});
    }
  }
}
function startTour(ids){
  if(sheetRoot.childElementCount) closeSheet(true);
  tour = {...tourBuild(ids), i:0};
  setInert('tour', true);
  document.body.classList.add('tour-on');
  tourEnsureUi();
  tourApply();
  const n = document.querySelector('.tour-next'); if(n) n.focus({preventScroll:true});
}
// Конец подсказок: показанные разделы больше не появятся (пока не нажмут «Показать обучение»)
function endTour(){
  if(!tour) return;
  const ids = tour.ids;
  tour = null;
  setInert('tour', false);
  ids.forEach(tourMark);
  document.body.classList.remove('tour-on');
  ['tourBlock','tourCard'].forEach(x => { const e = $id(x); if(e) e.remove(); });
  document.querySelectorAll('.tour-dim,.tour-focus,.tour-seen').forEach(el => { el.classList.remove('tour-dim','tour-focus','tour-seen'); el.style.removeProperty('--tour-off'); el.style.removeProperty('--tour-pulse'); });
}
function tourNext(){
  if(!tour) return;
  if(tour.i < tour.steps.length - 1){ tour.i++; tourApply(); return; }
  endTour();
}
function tourBack(){
  if(!tour || tour.i <= 0) return;
  let k = tour.i - 1;
  while(k > 0 && tour.steps[k].sel && !tourTargets(tour.steps[k]).length) k--;     // пропускаем шаги, которых на экране нет
  tour.i = k; tourApply();
}
// Какие подсказки ещё не показаны на текущем экране (пусто — никаких)
function tourFor(){
  if(mode === 'myrx') return tourUnseen(['myrx']);
  const S = cur();
  return S && S.pos < S.order.length ? tourUnseen(['session']) : [];
}
let tourTimer = 0;
function tourReady(ids){
  const steps = tourBuild(ids).steps;
  return steps.every(x => !x.sel) || steps.some(x => x.sel && tourTargets(x).length);
}
function tourRefresh(){
  const ids = tourFor(), key = ids.join('+');
  if(tour){
    if(key !== tour.key) endTour(); else tourApply();
    return;
  }
  if(!ids.length) return;
  clearTimeout(tourTimer);
  tourTimer = setTimeout(() => { if(!tour && !sheetRoot.childElementCount && tourFor().join('+') === key && tourReady(ids)) startTour(ids); }, 350);
}
function tourAutostart(){ tourRefresh(); }
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-tour]');
  if(!b || !tour) return;
  e.preventDefault(); e.stopPropagation();
  if(b.dataset.tour === 'skip') return endTour();
  if(b.dataset.tour === 'back') return tourBack();
  tourNext();
}, true);
// Листание жестом: влево — дальше, вправо — назад
let tourSwipe = null;
document.addEventListener('pointerdown', e => {
  tourSwipe = tour && e.target.closest && e.target.closest('#tourCard,#tourBlock') && !e.target.closest('[data-tour]') ? {x:e.clientX, y:e.clientY} : null;
}, true);
document.addEventListener('pointerup', e => {
  if(!tourSwipe || !tour) return;
  const dx = e.clientX - tourSwipe.x, dy = e.clientY - tourSwipe.y; tourSwipe = null;
  if(Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  if(dx < 0) tourNext(); else tourBack();
}, true);
document.addEventListener('keydown', e => {
  if(!tour) return;
  if(e.key === 'Escape'){ e.stopPropagation(); return endTour(); }
  if(e.key === 'Enter' && e.target.closest('[data-tour]')) return;
  if(e.key === 'Enter' || e.key === 'ArrowRight'){
    e.preventDefault(); e.stopPropagation();
    tourNext();
  } else if(e.key === 'ArrowLeft'){ e.preventDefault(); e.stopPropagation(); tourBack(); }
}, true);


edgeFallback();
restoreView();
render();
tourAutostart();

/* Работа без интернета: service worker кэширует страницу, данные, иконки и шрифты */
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if(!navigator.serviceWorker.controller) return;
    if(!hadController){ hadController = true; return; }
    if(updateReady) return;   // первая установка — не обновление
    updateReady = true;
    if(mode==='menu') render();
  });
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // шрифты — в кэш для работы без интернета (один раз, не мешая запуску)
    navigator.serviceWorker.ready.then(r => { if(r.active) setTimeout(() => r.active.postMessage('precache-fonts'), 3000); }).catch(() => {});
  });
}
// Просим браузер не удалять сохранённые рецепты и прогресс при нехватке места (Chrome разрешает молча, Safari — для установленного приложения)
try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); }catch{}
