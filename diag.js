/* =====================================================================================
   ВРЕМЕННАЯ ДИАГНОСТИКА — удалить после того, как баг найден.

   Зачем: у одного пользователя после выхода из «Впиши сам» экран «Тесты» перестаёт реагировать на касания
   (работает только кнопка «Меню»), а после перезапуска приложения всё снова нормально. В тестовой среде
   это не воспроизводится, поэтому нужны данные с самого телефона.

   Что делает: в правом верхнем углу показывает кнопку «Диагностика». Она лежит выше всего (в том числе выше
   подсказок и окон), поэтому нажимается, даже когда остальной экран «завис». Нажатие открывает панель:
     1) снимок состояния приложения: экран, блокировки (inert, подсказка, окно), флаги навигации, история;
     2) что лежит поверх экрана: какой элемент находится под пальцем в нескольких точках и в центре кнопок;
     3) все «плавающие» элементы страницы (position: fixed) — вдруг один из них перекрывает экран;
     4) журнал последних касаний: куда попало касание и дошёл ли до него щелчок (click).
   Кнопка «Скопировать» кладёт отчёт в буфер обмена — его можно вставить в чат.

   Ничего не меняет в данных и поведении приложения: только читает состояние и слушает события.
   Как убрать: удалить файл diag.js, строку <script src="diag.js"> в index.html, 'diag.js' в списке CORE в sw.js
   и имя diag.js в цикле сборки build.sh (после этого увеличить номер версии кэша в sw.js).
   ===================================================================================== */
(function(){
  'use strict';
  const LOG_MAX = 30;
  const log = [];
  const t0 = Date.now();
  const stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 'с';
  const safe = (fn, dflt) => { try{ const v = fn(); return v === undefined ? dflt : v; }catch(e){ return dflt === undefined ? '(ошибка: ' + e.message + ')' : dflt; } };

  // Короткое описание элемента: тег#id.класс[data-act]
  function desc(el){
    if(!el) return 'null';
    let s = el.tagName ? el.tagName.toLowerCase() : String(el.nodeName);
    if(el.id) s += '#' + el.id;
    if(el.classList && el.classList.length) s += '.' + [...el.classList].slice(0, 2).join('.');
    if(el.dataset && el.dataset.act) s += '[act=' + el.dataset.act + ']';
    return s;
  }
  const inDiag = el => !!(el && el.closest && el.closest('#diagBtn, #diagPanel'));

  /* ---------- Журнал касаний ---------- */
  // pointerdown → ждём click по тому же месту: если щелчка нет, значит касание «съели» (скролл, блокировка и т. п.)
  let pendingDown = null;
  function note(line){
    log.push(stamp() + ' ' + line);
    if(log.length > LOG_MAX) log.shift();
  }
  function stateFlags(){
    return 'inert=' + safe(() => document.querySelector('.app').inert ? 1 : 0, '?') +
      ' tour=' + safe(() => tour ? 1 : 0, '?') +
      ' sheet=' + safe(() => sheetRoot.childElementCount, '?');
  }
  addEventListener('pointerdown', e => {
    if(inDiag(e.target)) return;
    const top = document.elementFromPoint(e.clientX, e.clientY);
    pendingDown = {t: Date.now(), line: '↓ ' + e.pointerType + ' цель=' + desc(e.target) + ' под пальцем=' + desc(top) + ' | ' + stateFlags()};
    note(pendingDown.line);
    const mine = pendingDown;
    setTimeout(() => {
      if(pendingDown === mine && !mine.gotClick) note('⚠ после касания НЕ было click (цель=' + desc(e.target) + ')');
    }, 700);
  }, true);
  addEventListener('click', e => {
    if(inDiag(e.target)) return;
    if(pendingDown) pendingDown.gotClick = true;
    note('✓ click цель=' + desc(e.target) + (e.target.closest && e.target.closest('[data-act]') ? ' действие=' + e.target.closest('[data-act]').dataset.act : '') + ' | ' + stateFlags());
  }, true);
  addEventListener('pointercancel', e => { if(!inDiag(e.target)) note('⚠ pointercancel цель=' + desc(e.target)); }, true);
  addEventListener('error', e => note('⚠ ОШИБКА JS: ' + e.message + ' (' + String(e.filename || '').split('/').pop() + ':' + e.lineno + ')'));
  addEventListener('unhandledrejection', e => note('⚠ необработанный promise: ' + (e.reason && e.reason.message || e.reason)));

  /* ---------- Сторож: сам ловит момент, когда кнопки перестают принимать касания ----------
     После каждого касания/перехода (через 450 мс, когда анимации закончились) берёт первую видимую кнопку
     экрана и проверяет, есть ли она вообще в стеке elementsFromPoint. Если нет — записывает стек, цепочку
     родителей и последние строки журнала касаний в отдельный список (он не вытесняется журналом на 30 строк)
     и добавляет ⚠ на кнопку «Диагностика». Окна, подсказка и сама панель диагностики за поломку не считаются. */
  const broken = [];
  let wasBroken = false, wdTimer = 0;
  function chainOf(b){
    const out = [];
    for(let e = b; e && e.nodeType === 1; e = e.parentElement){
      const c = getComputedStyle(e);
      out.push(desc(e) + ' pe=' + c.pointerEvents + ' vis=' + c.visibility + ' pos=' + c.position + ' z=' + c.zIndex + ' tf=' + c.transform + ' op=' + c.opacity + (e.inert ? ' [inert]' : ''));
    }
    return out;
  }
  function watch(why){
    clearTimeout(wdTimer);
    wdTimer = setTimeout(() => safe(() => {
      const view = document.getElementById('view');
      if(!view || document.hidden) return;
      const panel = document.getElementById('diagPanel');
      if(panel && !panel.hidden) return;
      if(document.getElementById('tourBlock') || document.querySelector('.overlay') || document.body.classList.contains('is-locked')) return;
      const b = [...view.querySelectorAll('button, [data-act]')].find(e => { const r = e.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.top >= 0 && r.bottom <= innerHeight && getComputedStyle(e).visibility === 'visible'; });
      if(!b) return;
      const r = b.getBoundingClientRect(), x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
      const stack = document.elementsFromPoint(x, y);
      const ok = b.contains(stack[0] || null);
      const btn = document.getElementById('diagBtn');
      if(!ok){
        if(!wasBroken){
          wasBroken = true;
          broken.push({t: stamp(), why, mode: safe(() => mode), body: document.body.className, line: desc(b) + ' в (' + x + ',' + y + ')', stack: stack.map(desc).join(' > '), chain: chainOf(b), recent: log.slice(-8)});
          if(broken.length > 5) broken.shift();
          note('⚠⚠ HIT-TEST СЛОМАН: ' + desc(b) + ' не получает касание; сверху ' + desc(stack[0]));
        }
        if(btn && !/⚠/.test(btn.textContent)) btn.textContent = '🐞 Диагностика ⚠';
      } else if(wasBroken){
        wasBroken = false;
        note('✓ hit-test снова в порядке (' + desc(b) + ')');
        if(btn) btn.textContent = '🐞 Диагностика';
      }
    }), 450);
  }
  ['click', 'pointerup', 'popstate', 'pageshow', 'visibilitychange', 'resize'].forEach(ev => addEventListener(ev, () => watch(ev), true));
  setInterval(() => watch('timer'), 5000);

  /* ---------- Снимок состояния ---------- */
  function snapshot(){
    const L = [];
    const add = (k, v) => L.push(k + ': ' + v);
    const app = document.querySelector('.app'), view = document.getElementById('view');

    L.push('=== СТОРОЖ HIT-TEST: ' + (wasBroken ? 'СЕЙЧАС СЛОМАН' : 'сейчас в порядке') + ', случаев за сессию: ' + broken.length + ' ===');
    broken.forEach((m, i) => { L.push('#' + (i + 1) + ' ' + m.t + ' (' + m.why + ') mode=' + m.mode + ' body=' + (m.body || '-') + ' кнопка ' + m.line); L.push('  стек: ' + m.stack); m.chain.forEach(c => L.push('  ↑ ' + c)); L.push('  последние касания:'); m.recent.forEach(c => L.push('    ' + c)); });
    L.push('');
    L.push('=== СОСТОЯНИЕ ПРИЛОЖЕНИЯ ===');
    add('время', new Date().toLocaleString() + ', приложение открыто ' + stamp() + ' назад');
    add('режим (mode)', safe(() => mode));
    add('семестр (semIdx)', safe(() => semIdx));
    add('заголовок', safe(() => document.getElementById('topTitle').textContent.trim() || (document.querySelector('#view h1') || {}).textContent));
    add('кнопка назад', safe(() => { const b = document.getElementById('backBtn'); return b.hidden ? 'скрыта' : '«' + document.getElementById('backLabel').textContent + '»'; }));
    add('подсказка (tour)', safe(() => tour ? 'АКТИВНА key=' + tour.key + ' шаг=' + tour.i : 'нет'));
    add('inertState', safe(() => JSON.stringify(inertState)));
    add('.app inert', safe(() => app.inert));
    add('окно снизу (sheet)', safe(() => sheetRoot.childElementCount + ' эл.'));
    add('histIgnore / histWait', safe(() => histIgnore + ' / ' + histWait));
    add('история: длина / state', safe(() => history.length + ' / ' + JSON.stringify(history.state)));
    add('body class', safe(() => document.body.className || '(пусто)'));
    add('html class', safe(() => document.documentElement.className || '(пусто)'));
    add('панель kbBar', safe(() => kbBar ? (kbBar.hidden ? 'скрыта' : 'ПОКАЗАНА bottom=' + kbBar.style.bottom) : 'нет'));
    add('фокус сейчас', safe(() => desc(document.activeElement)));
    add('прокрутка / окно', safe(() => 'scrollY=' + Math.round(scrollY) + ' окно ' + innerWidth + '×' + innerHeight));
    add('visualViewport', safe(() => { const v = visualViewport; return 'масштаб=' + v.scale.toFixed(2) + ' сдвиг=' + Math.round(v.offsetLeft) + ',' + Math.round(v.offsetTop) + ' размер=' + Math.round(v.width) + '×' + Math.round(v.height); }));
    add('режим показа', safe(() => matchMedia('(display-mode: standalone)').matches ? 'установленное приложение' : 'вкладка браузера'));
    add('service worker', safe(() => navigator.serviceWorker.controller ? 'активен' : 'нет'));

    L.push('', '=== БЛОК СОДЕРЖИМОГО (#view) ===');
    add('computed', safe(() => { const c = getComputedStyle(view); return 'pointer-events=' + c.pointerEvents + ' opacity=' + c.opacity + ' visibility=' + c.visibility + ' transform=' + c.transform + ' touch-action=' + c.touchAction; }));
    add('активные анимации', safe(() => view.getAnimations().map(a => a.playState + '/' + (a.effect && a.effect.getComputedTiming().fill)).join(', ') || 'нет'));
    add('inline style', safe(() => view.getAttribute('style') || '(пусто)'));
    add('внутри [inert]', safe(() => !!view.closest('[inert]')));
    add('карточка свайпа', safe(() => { const c = document.querySelector('.card[data-swipe]'); return c ? 'style="' + (c.getAttribute('style') || '') + '"' : 'нет'; }));
    add('элементов с tour-dim/focus', safe(() => document.querySelectorAll('.tour-dim,.tour-focus,.tour-seen').length));

    L.push('', '=== ВЕРХНЯЯ КРОМКА (щель сверху) ===');
    add('DPR / screen / outer', safe(() => 'dpr=' + devicePixelRatio + ' screen=' + screen.width + '×' + screen.height + ' avail=' + screen.availWidth + '×' + screen.availHeight + ' outer=' + outerWidth + '×' + outerHeight + ' screenY=' + screenY));
    add('documentElement client', safe(() => { const e = document.documentElement; return 'clientW×H=' + e.clientWidth + '×' + e.clientHeight + ' scrollH=' + e.scrollHeight + ' scrollTop=' + e.scrollTop + ' innerH=' + innerHeight; }));
    add('visualViewport точно', safe(() => { const v = visualViewport; return 'w=' + v.width + ' h=' + v.height + ' pageTop=' + v.pageTop + ' offsetTop=' + v.offsetTop; }));
    add('safe-area top / bottom', safe(() => { const p = document.createElement('div'); p.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)'; document.body.appendChild(p); const c = getComputedStyle(p), r = c.paddingTop + ' / ' + c.paddingBottom; p.remove(); return r; }));
    add('top rect: html/body/.app/.topbar/#view', safe(() => ['html', 'body', '.app', '.topbar', '#view'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return s + ' y=' + r.top.toFixed(2) + ' h=' + r.height.toFixed(2); }).join(' | ')));
    add('topbar computed', safe(() => { const t = document.querySelector('.topbar'), c = getComputedStyle(t); return 'class=' + t.className + ' pos=' + c.position + ' pt=' + c.paddingTop + ' bg=' + c.backgroundColor + ' border-b=' + c.borderBottomWidth; }));
    add('фон html / body', safe(() => getComputedStyle(document.documentElement).backgroundColor + ' / ' + getComputedStyle(document.body).backgroundColor));
    add('theme-color meta', safe(() => document.querySelector('meta[name="theme-color"]').content));
    add('elementFromPoint у самого верха', safe(() => [0, 1, 2, 3, 5].map(y => 'y' + y + '=' + desc(document.elementFromPoint(Math.round(innerWidth / 2), y))).join('  ')));
    add('элементы на y<6px', safe(() => [...document.querySelectorAll('body *')].filter(el => { if(inDiag(el)) return false; const r = el.getBoundingClientRect(); return r.width && r.height && r.top < 6 && r.bottom > 0; }).map(desc).slice(0, 8).join(' ; ') || 'нет'));

    L.push('', '=== СТЕК В ТОЧКЕ ПЕРВОЙ КНОПКИ (elementsFromPoint) ===');
    safe(() => {
      const b0 = [...view.querySelectorAll('button, [data-act]')].find(b => { const r = b.getBoundingClientRect(); return r.width && r.height && r.top >= 0 && r.bottom <= innerHeight; });
      if(!b0){ L.push('(кнопок нет)'); return; }
      const r = b0.getBoundingClientRect(), x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
      L.push('кнопка ' + desc(b0) + ' в (' + x + ',' + y + ')');
      L.push('стек сверху вниз: ' + document.elementsFromPoint(x, y).map(desc).join(' > '));
      const chain = []; for(let e = b0; e && e.nodeType === 1; e = e.parentElement){ const c = getComputedStyle(e); chain.push(desc(e) + ' pe=' + c.pointerEvents + ' vis=' + c.visibility + ' pos=' + c.position + ' z=' + c.zIndex + ' tf=' + c.transform + ' op=' + c.opacity + ' cv=' + c.contentVisibility + ' ct=' + c.contain + (e.hasAttribute('inert') ? ' [INERT]' : '') + (e.inert ? ' [inert=true]' : '') + ' ' + Math.round(e.getBoundingClientRect().top) + '..' + Math.round(e.getBoundingClientRect().bottom)); }
      chain.forEach(s => L.push('  ↑ ' + s));
      L.push('[inert] в документе: ' + ([...document.querySelectorAll('[inert]')].map(desc).join(' ; ') || 'нет'));
      L.push('top layer / dialog / popover: ' + ([...document.querySelectorAll('dialog[open], [popover]:popover-open')].map(desc).join(' ; ') || 'нет'));
      L.push('view.checkVisibility: ' + (view.checkVisibility ? view.checkVisibility({checkOpacity: true, checkVisibilityCSS: true}) : 'н/д') + ' | view children=' + view.childElementCount + ' | view rect=' + [...Object.entries(view.getBoundingClientRect().toJSON())].filter(([k]) => /^(top|height|width)$/.test(k)).map(([k, v]) => k + ':' + Math.round(v)).join(','));
      L.push('активные анимации всего документа: ' + (document.getAnimations().map(a => (a.effect && a.effect.target ? desc(a.effect.target) : '?') + ':' + a.playState + '/' + (a.effect && a.effect.getComputedTiming().fill)).join(' ; ') || 'нет'));
    });

    L.push('', '=== ЧТО ПОД ПАЛЬЦЕМ (elementFromPoint) ===');
    const W = innerWidth, H = innerHeight;
    [[.5, .15], [.5, .3], [.5, .45], [.5, .6], [.5, .75], [.15, .5], [.85, .5], [.5, .92]].forEach(([fx, fy]) => {
      const x = Math.round(W * fx), y = Math.round(H * fy);
      const el = document.elementFromPoint(x, y);
      L.push('(' + x + ',' + y + ') → ' + desc(el) + (el && el.closest && el.closest('[inert]') ? '  [внутри inert]' : ''));
    });
    L.push('--- центры кнопок на экране ---');
    safe(() => {
      const btns = [...view.querySelectorAll('button, [data-act], a, input')].filter(b => { const r = b.getBoundingClientRect(); return r.width && r.height && r.bottom > 0 && r.top < H; }).slice(0, 8);
      btns.forEach(b => {
        const r = b.getBoundingClientRect();
        const x = Math.round(Math.min(W - 1, Math.max(0, r.left + r.width / 2))), y = Math.round(Math.min(H - 1, Math.max(0, r.top + r.height / 2)));
        const top = document.elementFromPoint(x, y);
        const ok = b.contains(top);
        L.push((ok ? 'OK       ' : 'ПЕРЕКРЫТА ') + desc(b) + ' (' + x + ',' + y + ') поверх: ' + desc(top) + ' pe=' + getComputedStyle(b).pointerEvents + (b.closest('[inert]') ? ' [inert]' : '') + (b.disabled ? ' [disabled]' : ''));
      });
      if(!btns.length) L.push('(кнопок в области видимости нет)');
    });
    safe(() => {
      const b = document.getElementById('backBtn');
      if(b.hidden) return;
      const r = b.getBoundingClientRect();
      const top = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      L.push('кнопка «назад»/«Меню» → поверх: ' + desc(top) + (b.closest('[inert]') ? ' [inert]' : ''));
    });

    L.push('', '=== ПЛАВАЮЩИЕ ЭЛЕМЕНТЫ (position: fixed) ===');
    safe(() => {
      const fixed = [...document.querySelectorAll('body *')].filter(el => !inDiag(el) && getComputedStyle(el).position === 'fixed');
      fixed.forEach(el => {
        const c = getComputedStyle(el), r = el.getBoundingClientRect();
        L.push(desc(el) + ' z=' + c.zIndex + ' pe=' + c.pointerEvents + ' vis=' + c.visibility + ' disp=' + c.display + ' ' + Math.round(r.width) + '×' + Math.round(r.height) + '@' + Math.round(r.left) + ',' + Math.round(r.top));
      });
      if(!fixed.length) L.push('(нет)');
    });

    L.push('', '=== ЖУРНАЛ КАСАНИЙ (последние ' + LOG_MAX + ', новые внизу) ===');
    if(!log.length) L.push('(пока пусто)');
    L.push(...log);
    return L.join('\n');
  }

  /* ---------- Кнопка и панель ---------- */
  const css = document.createElement('style');
  css.textContent = `
    #diagBtn{position:fixed;right:8px;top:calc(6px + env(safe-area-inset-top,0px));z-index:5000;padding:6px 10px;border:2px solid #b83a20;border-radius:99px;background:#fff7e0;color:#b83a20;font:700 12px/1.2 sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.25);touch-action:manipulation}
    #diagPanel{position:fixed;inset:0;z-index:5001;display:flex;flex-direction:column;background:#fff;color:#111;font:12px/1.35 ui-monospace,Menlo,Consolas,monospace}
    #diagPanel[hidden]{display:none}
    #diagPanel .dg-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px;border-bottom:2px solid #b83a20;background:#fff7e0;font-family:sans-serif}
    #diagPanel .dg-bar b{flex:1 1 100%;font-size:13px;color:#b83a20}
    #diagPanel button{flex:1;padding:8px 6px;border:2px solid #b83a20;border-radius:10px;background:#fff;color:#b83a20;font:700 13px sans-serif}
    #diagPanel pre{flex:1;margin:0;padding:10px;overflow:auto;white-space:pre-wrap;word-break:break-word;-webkit-user-select:text;user-select:text}
  `;
  document.head.appendChild(css);

  const btn = document.createElement('button');
  btn.id = 'diagBtn'; btn.type = 'button'; btn.textContent = '🐞 Диагностика';
  const panel = document.createElement('div');
  panel.id = 'diagPanel'; panel.hidden = true;
  panel.innerHTML = '<div class="dg-bar"><b>Диагностика (временная)</b><button type="button" data-d="refresh">Обновить</button><button type="button" data-d="copy">Скопировать</button><button type="button" data-d="close">Закрыть</button></div><pre id="diagText"></pre>';
  document.body.appendChild(btn);
  document.body.appendChild(panel);

  const txt = panel.querySelector('#diagText');
  // Панель закрывает весь экран, поэтому снимок «что под пальцем» делаем ДО её показа — иначе всё будет перекрыто самой панелью
  function open(){
    const text = snapshot();
    txt.textContent = text;
    panel.hidden = false;
  }
  btn.addEventListener('click', open);
  panel.addEventListener('click', e => {
    const d = e.target.dataset && e.target.dataset.d;
    if(d === 'close'){ panel.hidden = true; }
    else if(d === 'refresh'){ panel.hidden = true; setTimeout(open, 50); }   // скрываем панель на миг, чтобы замер был честным
    else if(d === 'copy'){
      const text = txt.textContent;
      const done = ok => { e.target.textContent = ok ? 'Скопировано ✓' : 'Не вышло — выделите текст вручную'; setTimeout(() => { e.target.textContent = 'Скопировать'; }, 2000); };
      if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
      else done(false);
    }
  });
})();
