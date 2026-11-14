/* Recipe-бот: приводит текст рецепта к шаблону. Файл взят из recipe-bot.html без изменений логики.
   API: RecipeBot.format(text) -> {text, warnings, fixes, error} */
(function () {
  /* ---------- служебное ---------- */
  var MAX_LEN = 20000;
  var HOMO = {'а':'a','е':'e','о':'o','р':'p','с':'c','у':'y','х':'x','к':'k','м':'m','т':'t','і':'i',
              'А':'A','В':'B','Е':'E','К':'K','М':'M','Н':'H','О':'O','Р':'P','С':'C','Т':'T','Х':'X','У':'Y','І':'I'};
  var EXAMPLE = 'Recipe: Solutionis Adrenalini hydrochloridi 0,1% — 1 ml\n    Da tales doses numero 10 in ampullis\n    Signa: по 1 мл подкожно, 1 р/д\n(Альфа- и бета-адреномиметики)';

  // кириллица, похожая на латиницу -> латиница (длина строки не меняется)
  function deHomo(s) { return s.replace(/[а-яіА-ЯІ]/g, function (c) { return HOMO[c] || c; }); }
  function deHomoWord(w) { var c = deHomo(w); return /[А-Яа-яЁё]/.test(c) ? w : c; }
  function orig(line, s) { return line.slice(line.length - s.length); }
  function cap(w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }

  /* ---------- нечёткое сравнение (опечатки) ---------- */
  function dist(a, b) {            // расстояние Дамерау–Левенштейна
    a = a.toLowerCase(); b = b.toLowerCase();
    var m = a.length, n = b.length, d = [], i, j, c;
    for (i = 0; i <= m; i++) d[i] = [i];
    for (j = 1; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) {
      c = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1))
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[m][n];
  }
  function near(w, list, max) {    // ближайшее слово из списка или null
    var best = null, bd = 99;
    list.forEach(function (x) { var k = dist(w, x); if (k < bd) { bd = k; best = x; } });
    return bd <= max ? best : null;
  }
  var FORMS = ['ampullis', 'tabulettis', 'capsulis', 'suppositoriis', 'pulveribus', 'unguento'];

  // перенос строки перед каждым маркером (включая слова с опечатками)
  function splitMarkers(t) {
    var d = deHomo(t), br = [], toks = [], m;
    var TOK = /(?<![A-Za-zА-Яа-яЁё])[A-Za-z]+(?![A-Za-zА-Яа-яЁё])/g;
    while ((m = TOK.exec(d))) toks.push({ w: m[0].toLowerCase(), s: m.index, e: m.index + m[0].length });

    toks.forEach(function (tk, i) {
      var colon = /^\s*[.:]/.test(d.slice(tk.e));
      if (colon && (tk.w === 'rp' || tk.w === 'rec' || (tk.w.length >= 5 && near(tk.w, ['recipe'], 2))))
        br.push({ pos: tk.s, brk: '\n\n' });
      if (tk.w === 'signa' || tk.w === 'signs' || (colon && tk.w.length >= 4 && near(tk.w, ['signa', 'signs'], 1)))
        br.push({ pos: tk.s, brk: '\n' });
      var nx = toks[i + 1], pv = toks[i - 1];
      if (tk.w.length >= 4 && nx && near(tk.w, ['tales'], 1) && /^\s+$/.test(d.slice(tk.e, nx.s)) && near(nx.w, ['doses'], 2)) {
        var pos = tk.s;
        if (pv && pv.w.length <= 4 && /^\s+$/.test(d.slice(pv.e, tk.s)) && near(pv.w, ['da'], 1)) pos = pv.s;
        br.push({ pos: pos, brk: '\n' });
      }
    });
    var DTD = /(?<![A-Za-z])D\.\s*t\.\s*d/gi;
    while ((m = DTD.exec(d))) br.push({ pos: m.index, brk: '\n' });

    br.sort(function (a, b) { return a.pos - b.pos; });
    var out = '', last = 0;
    br.forEach(function (b, i) {
      if (i && br[i - 1].pos === b.pos) return;
      out += t.slice(last, b.pos).replace(/\s+$/, '') + b.brk;
      last = b.pos;
    });
    return out + t.slice(last);
  }

  // исправление опечаток в маркере в начале строки (длина «хвоста» не меняется)
  function fuzzyLine(d, line) {
    var notes = [], m = /^([A-Za-z]+)(?![A-Za-zА-Яа-яЁё])/.exec(d);
    if (!m) return { d: d, notes: notes };
    var tk = m[1], lw = tk.toLowerCase();

    var m3 = /^([A-Za-z]{1,4})(\s+)([A-Za-z]+)(\s+)([A-Za-z]+)(?![A-Za-zА-Яа-яЁё])(.*)$/.exec(d);
    if (m3 && near(m3[3].toLowerCase(), ['tales'], 1) && near(m3[5].toLowerCase(), ['doses'], 2) && (lw === 'da' || near(lw, ['da'], 1))) {
      var pre = d.slice(0, d.length - m3[6].length), rest = m3[6];
      if (pre.replace(/\s+/g, ' ').toLowerCase() !== 'da tales doses') notes.push('«' + line.slice(0, pre.length) + '» → Da tales doses');
      var mn = /^(\s*)([A-Za-z]+)(\.?)(?=\s*\d)/.exec(rest);
      if (mn && !/^(numero|num|no|n)$/i.test(mn[2]) && near(mn[2], ['numero'], 2)) {
        notes.push('«' + line.substr(pre.length + mn[1].length, mn[2].length) + '» → numero');
        rest = rest.replace(mn[0], ' numero');
      }
      return { d: 'Da tales doses' + rest, notes: notes };
    }
    if (!/^(recipe|rp|rec)$/.test(lw) && tk.length >= 5 && near(lw, ['recipe'], 2)) {
      notes.push('«' + tk + '» → Recipe');
      return { d: 'Recipe' + d.slice(tk.length), notes: notes };
    }
    if (!/^(signa|signs|sig|s|d)$/.test(lw) && tk.length >= 4 && near(lw, ['signa', 'signs'], 1)) {
      notes.push('«' + tk + '» → Signa');
      return { d: 'Signa' + d.slice(tk.length), notes: notes };
    }
    return { d: d, notes: notes };
  }

  var RE_REC = /^(?:recipe|rp|rec)(?![a-z])\s*[.:;]*\s*(.*)$/i;
  var RE_DTD = /^(?:da\s+tales\s+doses?|d\.\s*t\.\s*d\.?)\s*(?:numero|num\.?|no\.?|n(?![a-z])\.?|№)?\s*:?\s*(\d+)\s*(.*)$/i;
  var RE_DTD_LOOSE = /^(?:da\s+tales\s+doses?|d\.\s*t\.\s*d)(?![a-z])/i;
  var RE_SIG = /^(?:signa|signs|sig|s\.|d\.\s*s)(?![a-z])[.:;]*\s*(.*)$/i;
  var RE_TAB = /^tab(?:ulettas?|ulettae|letta[es]?|l)?\.?$/i;
  var RE_SOL = /^sol(?:utionis|utio)?\.?$/i;

  /* ---------- строка Recipe ---------- */
  function fixHead(rest, warn, note) {
    rest = rest.replace(/\s+/g, ' ').trim();
    var im = /(?<![A-Za-zА-Яа-я\d])\d/.exec(rest);   // B12 остаётся в названии
    var idx = im ? im.index : -1;
    var name = (idx < 0 ? rest : rest.slice(0, idx)).replace(/[\s—–,:-]+$/, '');
    var dose = idx < 0 ? '' : rest.slice(idx);
    var w = name.split(' ').filter(Boolean).map(deHomoWord), out = [], i = 0, nameOk = true;

    if (w[0] && RE_TAB.test(w[0])) { out.push('Tabulettas'); i = 1; }
    else if (w[0] && RE_SOL.test(w[0])) { out.push('Solutionis'); i = 1; }
    else if (w[0] && w[0].length >= 6 && near(w[0], ['tabulettas'], 2)) { note('«' + w[0] + '» → Tabulettas'); out.push('Tabulettas'); i = 1; }
    else if (w[0] && w[0].length >= 6 && near(w[0], ['solutionis'], 2)) { note('«' + w[0] + '» → Solutionis'); out.push('Solutionis'); i = 1; }
    if (!w[i]) { nameOk = false; warn(i ? 'после ' + out[0] + ' не указано название препарата' : 'не найдено название препарата'); }
    else {
      out.push(/\d/.test(w[i]) ? w[i] : cap(w[i]));
      for (var j = i + 1; j < w.length; j++) out.push(/\d/.test(w[j]) ? w[j] : w[j].toLowerCase());
      if (/[А-Яа-яЁё]/.test(w.slice(i).join(' '))) warn('название препарата написано не латиницей');
    }

    dose = dose
      .replace(/(\d)\.(\d)/g, '$1,$2')
      .replace(/(\d)\s*%/g, '$1%')
      .replace(/(\d)\s*(mcg|mg|ml|g|ED|IE|UI|ME)(?![A-Za-z])/gi, function (a, n, u) {
        return n + ' ' + (/^(ed|ie|ui|me)$/i.test(u) ? u.toUpperCase() : u.toLowerCase());
      })
      .replace(/\s+[-–—]\s+/g, ' — ')
      .replace(/(%|\s(?:mcg|mg|ml|g))\s*[-–—]\s*(?=\d)/g, '$1 — ')
      .replace(/\s+/g, ' ').trim();

    if (!dose) warn('не найдена дозировка / концентрация');
    else if (!/(%|\b(?:mcg|mg|ml|g|ED|IE|UI|ME)\b)/.test(dose)) warn('у дозировки нет единицы измерения: ' + dose);

    return { head: ['Recipe:', out.join(' '), dose].filter(Boolean).join(' '), nameOk: nameOk };
  }

  /* ---------- поиск фармакологической группы в тексте ----------
     Список групп задаётся снаружи: RecipeBot.setGroups([...]). Группу ищем в любом месте текста:
     отдельной строкой до или после рецепта, в скобках, внутри любой строки. Опечатки допускаются. */
  var GROUPS = [];
  function nw(w) { return w.toLowerCase().replace(/ё/g, 'е'); }
  function wtol(n) { return n >= 9 ? 2 : n >= 5 ? 1 : 0; }
  function wordsOf(s) { return s.match(/[A-Za-zА-Яа-яЁё0-9]+/g) || []; }
  function normKey(s) { return nw(s).replace(/[^a-zа-я0-9]/g, ''); }
  function setGroups(list) {
    GROUPS = [];
    (list || []).forEach(function (g) {
      var parts = [g];
      if (g.indexOf(',') >= 0) g.split(',').forEach(function (p) { parts.push(p); });   // «Макролиды, азалиды» — подходит и целиком, и по части
      parts.forEach(function (p, k) {
        var raw = wordsOf(p), w = raw.map(nw), letters = 0;
        w.forEach(function (x) { if (x.length >= 3) letters += x.length; });
        var acr = k > 0 && raw.length === 1 && raw[0].length >= 4 && raw[0] === raw[0].toUpperCase();   // НПВС: только точно
        if (k === 0 || letters >= 6 || acr) GROUPS.push({ g: g, w: w, acr: acr });
      });
    });
  }
  function matchAt(toks, i, G) {
    var p = i, first = -1, last = -1, edits = 0, letters = 0, j, w, t, d;
    for (j = 0; j < G.w.length; j++) {
      w = G.w[j];
      if (w.length < 3) {                                            // короткое слово («м», «и») необязательно
        if (toks[p] && toks[p].w === w) { if (first < 0) first = p; last = p; p++; }
        continue;
      }
      if (first >= 0) while (toks[p] && toks[p].w.length < 3) p++;
      t = toks[p]; if (!t) return null;
      d = t.w === w ? 0 : (G.acr || Math.abs(t.w.length - w.length) > wtol(w.length)) ? 99 : dist(t.w, w);
      if (d > wtol(w.length)) return null;
      edits += d; letters += w.length;
      if (first < 0) first = p; last = p; p++;
    }
    return letters ? { s: toks[first].s, e: toks[last].e, letters: letters, edits: edits, g: G.g } : null;
  }
  function tidy(s) {
    return s.replace(/\(\s*\)|\[\s*\]/g, ' ').replace(/\s+/g, ' ').replace(/^[\s,;:—–\-.]+|[\s,;:—–\-]+$/g, '').trim();
  }
  var GLABEL = '(?:фармакологическая\\s+группа|фарм\\.?\\s*группа|фармгруппа|группа)';
  function findGroup(line) {
    var toks = [], m, best = null, re = /[A-Za-zА-Яа-яЁё0-9]+/g;
    while ((m = re.exec(line))) toks.push({ w: nw(m[0]), s: m.index, e: m.index + m[0].length });
    toks.forEach(function (_, i) {
      GROUPS.forEach(function (G) {
        var r = matchAt(toks, i, G);
        if (r && (!best || r.letters > best.letters || (r.letters === best.letters && r.edits < best.edits))) best = r;
      });
    });
    if (best) {
      var before = line.slice(0, best.s).replace(new RegExp(GLABEL + '\\s*[:\\-—–]?\\s*$', 'i'), '');   // «Группа:» перед названием — не оставляем
      return { name: best.g, typed: line.slice(best.s, best.e), rest: tidy(before + ' ' + line.slice(best.e)) };
    }
    m = new RegExp('^\\s*' + GLABEL + '\\s*[:\\-—–]\\s*(.+?)\\s*$', 'i').exec(line);   // «Фармгруппа: …» — группы нет в словаре, берём как написано
    if (m) {
      var nm = m[1].replace(/^[(\s]+|[)\s.]+$/g, '');
      if (nm) return { name: nm.charAt(0).toUpperCase() + nm.slice(1), typed: nm, rest: '' };
    }
    return null;
  }

  /* ---------- главная функция ---------- */
  function format(text) {
    var warnings = [], fixes = [];
    var res = function (t, e) { return { text: t, warnings: warnings, fixes: fixes, error: e || null }; };

    var t = String(text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/[\u00A0\u2007\u202F]/g, ' ')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\t/g, ' ');
    if (!t.trim()) return res('');
    if (t.length > MAX_LEN) return res('', { title: 'Слишком длинный текст', detail: 'Вставьте не более ' + MAX_LEN + ' символов.' });

    t = splitMarkers(t);

    var lines = t.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var blocks = [], cur = null, markers = 0, pending = null, m, d;

    function newBlock(head) {
      cur = { n: blocks.length + 1, head: head, nameOk: false, dtd: null, signa: null, group: [], extra: [], gm: pending };
      pending = null;
      blocks.push(cur);
    }
    function W(b) { return function (s) { warnings.push('Рецепт ' + b.n + ': ' + s); }; }
    function N(b) { return function (s) { fixes.push('Рецепт ' + b.n + ': ' + s); }; }

    function proc(line) {
      var f = fuzzyLine(deHomo(line), line);
      d = f.d;
      if ((m = RE_REC.exec(d))) {
        markers++;
        newBlock(null);
        f.notes.forEach(N(cur));
        var h = fixHead(orig(line, m[1]), W(cur), N(cur));
        cur.head = h.head; cur.nameOk = h.nameOk;
        return;
      }
      if (!cur) { newBlock(null); }
      f.notes.forEach(N(cur));

      if ((m = RE_DTD.exec(d))) {
        markers++;
        if (cur.dtd) { cur.extra.push({ l: line, msg: 'повторная строка Da tales doses' }); return; }
        var form = orig(line, m[2]).trim().toLowerCase().replace(/\s+/g, ' ').replace(/^in\s+/, '');
        form = form.replace(/^(?:inn|im)\s+/, '');
        if (/^amp/.test(form)) form = 'ampullis';
        else if (/^tab/.test(form)) form = 'tabulettis';
        else if (/^caps/.test(form)) form = 'capsulis';
        else if (/^supp/.test(form)) form = 'suppositoriis';
        else if (/^[a-z]{5,}$/.test(form)) {
          var nf = near(form, FORMS, 2);
          if (nf && nf !== form) { N(cur)('«' + form + '» → ' + nf); form = nf; }
        }
        if (!form) W(cur)('не указана форма в строке Da tales doses (например, in ampullis)');
        if (parseInt(m[1], 10) === 0) W(cur)('количество доз равно нулю');
        cur.dtd = '    Da tales doses numero ' + m[1] + (form ? ' in ' + form : '');
      } else if (RE_DTD_LOOSE.test(d)) {
        markers++;
        if (cur.dtd) { cur.extra.push({ l: line, msg: 'повторная строка Da tales doses' }); return; }
        W(cur)('в строке Da tales doses не указано число');
        cur.dtd = '    ' + line;
      } else if ((m = RE_SIG.exec(d))) {
        markers++;
        var sg = orig(line, m[1]).trim();
        if (cur.signa !== null) { cur.extra.push({ l: 'Signa: ' + sg, msg: 'повторная строка Signa' }); return; }
        if (!sg) W(cur)('после Signa нет текста');
        cur.signa = sg;
      } else if (cur.signa !== null || line.charAt(0) === '(') {
        cur.group.push(line);
      } else {
        cur.extra.push({ l: line, msg: 'строка не распознана: ' + line });
      }
    }
    lines.forEach(function (line0) {
      var gm = findGroup(line0), line = gm ? gm.rest : line0;
      if (gm && !line) {                                   // строка целиком из названия группы
        if (!cur || cur.gm || cur.group.length) pending = gm;   // группа стоит заголовком — относится к следующему рецепту
        else cur.gm = gm;                                  // группа после рецепта — к нему
        return;
      }
      proc(line);
      if (gm && cur) cur.gm = gm;                          // группа внутри строки рецепта
    });

    // что можно привести, а что нет
    if (!markers) {
      return res('', { title: 'Текст не соответствует образцу',
        detail: 'Не найдено ни одной строки Recipe, Da tales doses или Signa, поэтому привести текст к шаблону нельзя.', example: true });
    }
    if (!blocks.some(function (b) { return b.nameOk || b.dtd; })) {
      return res('', { title: 'Не удалось собрать рецепт',
        detail: 'Нет ни строки Recipe с названием препарата, ни строки Da tales doses. Одной Signa недостаточно.', example: true });
    }

    var result = blocks.map(function (b) {
      var out = [], w = W(b);
      if (b.head) out.push(b.head); else w('нет строки Recipe');
      if (b.dtd) out.push(b.dtd); else w('нет строки Da tales doses');
      if (b.signa !== null) out.push('    Signa: ' + b.signa); else w('нет строки Signa');
      b.extra.forEach(function (x) { out.push('    ' + x.l); w(x.msg); });
      if (b.gm) {
        out.push('(' + b.gm.name + ')');
        if (normKey(b.gm.typed) !== normKey(b.gm.name)) N(b)('группа «' + b.gm.typed + '» → ' + b.gm.name);
      } else if (b.group.length) {
        var g = b.group.join(' ').trim();
        if (g.charAt(0) !== '(') g = '(' + g;
        if (g.charAt(g.length - 1) !== ')') g += ')';
        out.push(g);
      } else w('нет фармакологической группы в скобках');
      return out.join('\n');
    });
    return res(result.join('\n\n'));
  }

  /* ---------- интерфейс ---------- */
  function mount(el) {
    el.innerHTML =
      '<div class="rb-card"><label for="rb-in">Исходный текст</label>' +
      '<textarea id="rb-in" spellcheck="false" placeholder="Вставьте рецепт (можно несколько)"></textarea>' +
      '<div class="rb-row"><button type="button" id="rb-go">Привести к шаблону</button>' +
      '<button type="button" class="rb-ghost" id="rb-clear">Очистить</button></div></div>' +
      '<div class="rb-err" id="rb-err" role="alert" hidden></div>' +
      '<div class="rb-card"><label>Результат</label><pre id="rb-out" aria-live="polite"></pre>' +
      '<ul class="rb-fix" id="rb-fix"></ul>' +
      '<ul class="rb-warn" id="rb-warn"></ul>' +
      '<div class="rb-row"><button type="button" id="rb-copy" disabled>Скопировать</button></div></div>';

    var inp = el.querySelector('#rb-in'), out = el.querySelector('#rb-out'), warn = el.querySelector('#rb-warn'), fix = el.querySelector('#rb-fix'),
        err = el.querySelector('#rb-err'), copy = el.querySelector('#rb-copy');

    function run() {
      var r = format(inp.value);
      out.textContent = r.text;
      copy.disabled = !r.text;
      warn.innerHTML = '';
      r.warnings.forEach(function (w) { var li = document.createElement('li'); li.textContent = w; warn.appendChild(li); });
      fix.innerHTML = '';
      if (r.fixes.length) {
        var h = document.createElement('div'); h.textContent = 'Исправлено автоматически:';
        h.style.listStyle = 'none'; h.style.marginLeft = '-18px'; fix.appendChild(h);
        r.fixes.forEach(function (x) { var li = document.createElement('li'); li.textContent = x; fix.appendChild(li); });
      }
      err.innerHTML = '';
      err.hidden = !r.error;
      inp.setAttribute('aria-invalid', r.error ? 'true' : 'false');
      if (r.error) {
        var b = document.createElement('b'); b.textContent = r.error.title; err.appendChild(b);
        var p = document.createElement('div'); p.textContent = r.error.detail; err.appendChild(p);
        if (r.error.example) {
          var c = document.createElement('div'); c.style.marginTop = '8px'; c.textContent = 'Ожидаемый вид:'; err.appendChild(c);
          var pre = document.createElement('pre'); pre.textContent = EXAMPLE; err.appendChild(pre);
        }
      }
    }
    inp.addEventListener('input', run);
    el.querySelector('#rb-go').addEventListener('click', run);
    el.querySelector('#rb-clear').addEventListener('click', function () { inp.value = ''; run(); inp.focus(); });
    copy.addEventListener('click', function () {
      var txt = out.textContent;
      function done() { copy.textContent = 'Скопировано'; setTimeout(function () { copy.textContent = 'Скопировать'; }, 1500); }
      function fallback() {
        var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta);
        ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} document.body.removeChild(ta);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback);
      else fallback();
    });
    run();
  }

  /* API: RecipeBot.format(text) -> {text, warnings, fixes, error}; RecipeBot.mount(element) */
  window.RecipeBot = { format: format, mount: mount, setGroups: setGroups };
  var root = document.getElementById('recipe-bot');
  if (root) mount(root);
})();
