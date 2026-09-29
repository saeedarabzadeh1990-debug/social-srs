// study.js — صفحه‌ی مرور (تمام‌صفحه). حالت عادی با SRS و «مرور آزاد» بدون تأثیر روی زمان‌بندی.
import * as store from '../store.js';
import * as P from '../platform.js';
import { NEW, REVIEW, pickNext, preview, nextDue } from '../srs.js';
import { h, mount, icon, n, $, fmtDelay, fmtDuration, openDialog, closeDialog, toast } from '../util.js';
import { openEditor } from './editor.js';

const LABELS = { 1: 'دوباره', 2: 'سخت', 3: 'خوب', 4: 'آسان' };
const KIND = { new: 'جدید', learn: 'یادگیری', review: 'مرور', free: 'مرور آزاد' };
const DIGITS = { '۱': '1', '۲': '2', '۳': '3', '۴': '4' };

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function render(root, route) {
  const free = route.rest[0] === 'free';
  const tag = route.q.get('tag');
  const sessionStart = Date.now();

  let cur = null;             // {card, p, kind}
  let counts = { new: 0, learn: 0, review: 0 };
  let revealed = false;
  let t0 = Date.now();
  let ahead = null;           // «مرور زودتر»
  let forceId = null;         // پس از بازگردانی، همان کارت دوباره نشان داده شود
  const undoStack = [];
  const ses = { n: 0, ms: 0, known: 0 };
  let freeQ = free ? shuffle(store.cards().filter((c) => !tag || c.tags.includes(tag))) : [];
  const freeTotal = freeQ.length;
  let timerEl = null;
  const timerId = setInterval(tick, 1000);

  const kindOf = (p) => (!p || p.st === NEW ? 'new' : p.st === REVIEW ? 'review' : 'learn');

  function tick() {
    if (timerEl && cur) timerEl.textContent = clock(Date.now() - t0);
  }
  const clock = (ms) => { const sec = Math.floor(ms / 1000); return n(Math.floor(sec / 60)) + ':' + (sec % 60 < 10 ? n(0) : '') + n(sec % 60); };

  // ── انتخاب کارت بعدی ───────────────────────────────────────────────────────
  function next() {
    revealed = false; t0 = Date.now();
    if (free) {
      cur = freeQ.length ? { card: freeQ[0], p: store.prog(freeQ[0].id), kind: 'free' } : null;
    } else if (forceId) {
      const card = store.card(forceId); forceId = null;
      const p = card && store.prog(card.id);
      cur = card ? { card, p, kind: kindOf(store.state().prog[card.id]) } : null;
      counts = store.session(ahead).counts;
    } else {
      const sess = store.session(ahead);
      counts = sess.counts;
      const pick = pickNext(sess);
      cur = pick ? { card: pick.card, p: pick.p, kind: pick.kind } : null;
    }
    draw();
  }

  function reveal() { if (cur && !revealed) { revealed = true; draw(); } }

  function grade(r) {
    if (!cur || !revealed) return;
    const ms = Math.min(Date.now() - t0, 60000);
    if (free) {
      const c = freeQ.shift();
      if (r === 1) freeQ.splice(Math.min(3, freeQ.length), 0, c); else ses.known++;
      ses.n++; ses.ms += ms; P.haptic(); next(); return;
    }
    const tok = store.grade(cur.card.id, r, ms);
    undoStack.push({ ...tok, ms }); if (undoStack.length > 30) undoStack.shift();
    ses.n++; ses.ms += ms; P.haptic(r === 1 ? 30 : 12);
    if (tok.becameLeech) toast('این کارت «مشکل‌دار» شد؛ شاید بازنویسی‌اش کمک کند.', { ms: 5000 });
    next();
  }

  function undo() {
    if (free || !undoStack.length) return;
    const tok = undoStack.pop();
    store.undo(tok);
    ses.n = Math.max(0, ses.n - 1); ses.ms = Math.max(0, ses.ms - (tok.ms || 0));
    forceId = tok.id;
    next();
  }

  function exit() { P.navigate('home'); }

  // ── منوی بیشتر ─────────────────────────────────────────────────────────────
  function more() {
    if (!cur) return;
    const id = cur.card.id;
    const p = store.prog(id);
    const item = (ic, label, fn) => h('button', { class: 'menu-item', onclick: () => { closeDialog('x'); fn(); } }, icon(ic), label);
    openDialog(h('div', { class: 'dlg-body menu' },
      item('edit', 'ویرایش کارت', () => openEditor(id, { onDone: () => { const c = store.card(id); if (!c) { freeQ = freeQ.filter((x) => x.id !== id); next(); } else { cur.card = c; if (free) freeQ[0] = c; draw(); } } })),
      item('bookmark', p.flag ? 'برداشتن نشان' : 'نشان‌دار کردن', () => { store.patchProg(id, { flag: !p.flag || undefined }); cur.p = store.prog(id); draw(); toast(p.flag ? 'نشان برداشته شد.' : 'کارت نشان‌دار شد.'); }),
      !free && item('eyeoff', 'امروز دیگر نشان نده', () => { store.patchProg(id, { bury: store.today() }); next(); }),
      !free && item('pause', 'معلق کردن کارت', () => { store.patchProg(id, { susp: true }); toast('کارت معلق شد.', { action: 'بازگردانی', onAction: () => store.patchProg(id, { susp: undefined }), ms: 5000 }); next(); }),
      h('button', { class: 'btn ghost block', onclick: () => closeDialog('x') }, 'بستن')), { sheet: true });
  }

  // ── رسم صفحه ───────────────────────────────────────────────────────────────
  function draw() {
    timerEl = null;
    const s = store.settings();
    mount(root, h('div', { class: 'study' },
      topbar(s),
      progressBar(),
      cur ? cardArea(s) : finished(),
      cur ? actions() : null));
    tick();
  }

  function topbar(s) {
    const cnt = (k, label) => h('span', { class: 'cnt ' + k + (cur && cur.kind === k ? ' cur' : '') }, h('b', {}, n(counts[k])), label);
    timerEl = s.showTimer ? h('span', { class: 'timer' }) : null;
    return h('header', { class: 'study-top' },
      h('button', { class: 'icon-btn', 'aria-label': 'خروج', title: 'خروج (Esc)', onclick: exit }, icon('x')),
      h('div', { class: 'study-counts' },
        free
          ? h('span', { class: 'cnt free cur' }, h('b', {}, n(freeQ.length)), 'باقی‌مانده' + (tag ? ` • ${tag}` : ''))
          : [cnt('new', 'جدید'), cnt('learn', 'یادگیری'), cnt('review', 'مرور')],
        timerEl),
      h('div', { class: 'study-tools' },
        !free && h('button', { class: 'icon-btn', 'aria-label': 'بازگردانی', title: 'بازگردانی (Z)', disabled: !undoStack.length, onclick: undo }, icon('undo')),
        P.fsSupported() && h('button', { class: 'icon-btn', 'aria-label': 'تمام‌صفحه', title: 'تمام‌صفحه', onclick: () => { P.toggleFullscreen(); } }, icon(P.isFullscreen() ? 'exitfs' : 'fullscreen')),
        h('button', { class: 'icon-btn', 'aria-label': 'بیشتر', title: 'بیشتر', disabled: !cur, onclick: more }, icon('more'))));
  }

  function progressBar() {
    let f;
    if (free) f = freeTotal ? (freeTotal - freeQ.length) / freeTotal : 0;
    else { const left = counts.new + counts.learn + counts.review; f = ses.n + left ? ses.n / (ses.n + left) : 1; }
    return h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': Math.round(f * 100), 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: { width: (f * 100).toFixed(1) + '%' } }));
  }

  function cardArea(s) {
    const c = cur.card, p = store.state().prog[c.id];
    return h('div', { class: 'study-body' },
      h('article', { class: 'card face' + (revealed ? ' revealed' : ''), onclick: () => { if (!revealed) reveal(); } },
        h('div', { class: 'face-top' },
          h('span', { class: 'kind ' + cur.kind }, KIND[cur.kind]),
          p?.leech && h('span', { class: 'badge warn' }, 'مشکل‌دار'),
          p?.flag && h('span', { class: 'flag' }, icon('bookmark')),
          h('span', { class: 'spacer' }),
          ...c.tags.slice(0, 3).map((t) => h('span', { class: 'tag ghost' }, t))),
        h('h2', { class: 'front' }, c.front),
        s.exampleOnFront && c.example && h('p', { class: 'ex-front' }, c.example),
        revealed
          ? h('div', { class: 'back' },
              c.rule && h('div', { class: 'rule' }, c.rule),
              c.back && h('p', { class: 'expl' }, c.back),
              !s.exampleOnFront && c.example && h('blockquote', { class: 'ex' }, h('span', { class: 'ex-lb' }, 'مثال'), c.example))
          : h('p', { class: 'tap' }, 'برای دیدن پاسخ ضربه بزن')));
  }

  function actions() {
    if (!revealed) {
      return h('footer', { class: 'study-actions' },
        h('button', { class: 'btn primary big block reveal', onclick: reveal, autofocus: true }, 'نمایش پاسخ', h('kbd', {}, 'Space')));
    }
    if (free) {
      return h('footer', { class: 'study-actions two' },
        h('button', { class: 'grade g1', onclick: () => grade(1) }, h('span', { class: 'gl' }, 'هنوز نه'), h('span', { class: 'gi' }, 'بعداً دوباره'), h('kbd', {}, n(1))),
        h('button', { class: 'grade g3', onclick: () => grade(3) }, h('span', { class: 'gl' }, 'بلدم'), h('span', { class: 'gi' }, 'کنار می‌رود'), h('kbd', {}, n(3))));
    }
    const pv = preview(cur.p, Date.now(), store.settings());
    return h('footer', { class: 'study-actions' },
      ...pv.map(({ rating, ms }) => h('button', { class: 'grade g' + rating, onclick: () => grade(rating) },
        h('span', { class: 'gl' }, LABELS[rating]), h('span', { class: 'gi' }, fmtDelay(ms)), h('kbd', {}, n(rating)))));
  }

  function finished() {
    const S = store.state();
    let sub = '';
    const acts = [];
    if (free) {
      sub = ses.n ? `${n(ses.known)} کارت را بلد بودی.` : 'کارتی برای مرور پیدا نشد.';
      acts.push(h('button', { class: 'btn primary', onclick: () => { P.navigate('home'); } }, 'بازگشت'));
      acts.push(h('button', { class: 'btn', onclick: () => location.reload() }, 'یک دور دیگر'));
    } else {
      const nd = nextDue(S.cards, S.prog, Date.now(), S.settings);
      if (nd.learnMs) sub = 'کارت بعدی ' + fmtDelay(nd.learnMs - Date.now()) + ' دیگر آماده می‌شود.';
      else if (nd.reviewDay != null) sub = nd.reviewDay - nd.today === 1 ? 'مرور بعدی: فردا.' : `مرور بعدی: ${n(nd.reviewDay - nd.today)} روز دیگر.`;
      const freshLeft = S.cards.filter((c) => { const p = S.prog[c.id]; return (!p || p.st === NEW) && !(p && p.susp); }).length;
      acts.push(h('button', { class: 'btn primary', onclick: exit }, 'بازگشت'));
      if (freshLeft) acts.push(h('button', { class: 'btn', onclick: () => { store.addExtraNew(5); next(); } }, `${n(Math.min(5, freshLeft))} کارت جدید بیشتر`));
      if (nd.learnMs && nd.learnMs - Date.now() < 24 * 3600000) acts.push(h('button', { class: 'btn', onclick: () => { ahead = 24 * 60; next(); } }, 'مرور زودتر'));
      acts.push(h('a', { class: 'btn ghost', href: '#/study/free' }, 'مرور آزاد'));
    }
    return h('div', { class: 'study-body center' },
      h('div', { class: 'done-box' },
        h('div', { class: 'done-ic' }, icon('check')),
        h('h2', {}, ses.n ? 'تمام شد 🎉' : (free ? 'کارتی نیست' : 'برای الان کارتی نیست')),
        ses.n > 0 && h('p', {}, `${n(ses.n)} کارت • ${fmtDuration(Date.now() - sessionStart)}`),
        sub && h('p', { class: 'muted' }, sub),
        h('div', { class: 'done-actions' }, ...acts)));
  }

  // ── صفحه‌کلید ──────────────────────────────────────────────────────────────
  function onKey(e) {
    const d = $('#dlg');
    if ((d && d.open) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    const k = DIGITS[e.key] || e.key;
    if (k === 'Escape') { exit(); return; }
    if (!cur) return;
    if (k === ' ' || k === 'Enter') { e.preventDefault(); if (revealed) grade(3); else reveal(); }
    else if (['1', '2', '3', '4'].includes(k)) { if (revealed) grade(free ? (k === '1' ? 1 : 3) : +k); else reveal(); }
    else if (k === 'z' || k === 'Z' || k === 'ز') undo();
    else if (k === 'e' || k === 'E' || k === 'ث') openEditor(cur.card.id, { onDone: next });
  }
  document.addEventListener('keydown', onKey);

  next();
  return () => { clearInterval(timerId); document.removeEventListener('keydown', onKey); };
}

