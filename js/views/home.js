// home.js — صفحه‌ی «امروز»: خلاصه‌ی مرور، تمرین دنیای واقعی، آمار سریع.
import * as store from '../store.js';
import * as P from '../platform.js';
import { nextDue } from '../srs.js';
import { h, mount, icon, n, pct, fmtDelay, dayWeekday, dayDateFull, openDialog, closeDialog, toast } from '../util.js';
import { allTags, openEditor } from './editor.js';
import { PACKS } from '../packs.js';

const HIDE_MS = 14 * 86400000;

export function render(root) {
  const draw = () => mount(root, body());
  draw();
  const rerender = () => draw();
  ['install-available', 'installed', 'fullscreen'].forEach((e) => P.events.addEventListener(e, rerender));
  return () => ['install-available', 'installed', 'fullscreen'].forEach((e) => P.events.removeEventListener(e, rerender));

  function body() {
    const S = store.state();
    const t = store.today();
    const sess = store.session();
    const c = sess.counts;
    const done = store.daily(t);
    const left = sess.total;
    const counts = store.counts();
    const mastered = counts.mature;
    const ret = store.retention(30);

    return h('div', { class: 'page home' },
      h('header', { class: 'page-head' },
        h('div', {},
          h('h1', {}, 'سلام 👋'),
          h('p', { class: 'muted' }, `${dayWeekday(t)}، ${dayDateFull(t)}`)),
        h('div', { class: 'head-actions' },
          P.fsSupported() && h('button', { class: 'icon-btn', title: 'تمام‌صفحه', 'aria-label': 'تمام‌صفحه', onclick: P.toggleFullscreen }, icon(P.isFullscreen() ? 'exitfs' : 'fullscreen')),
          h('button', { class: 'icon-btn', title: 'کارت جدید', 'aria-label': 'کارت جدید', onclick: () => openEditor(null, { onDone: draw }) }, icon('plus')))),

      installBanner(),
      ...packBanners(),
      hero(sess, c, done, left, S),
      practiceCard(),

      h('section', { class: 'tiles' },
        tile('flame', n(store.streak()), 'روز پیاپی', 'warn'),
        tile('check', `${n(mastered)} / ${n(counts.total)}`, 'کارت مسلط', 'good'),
        tile('target', ret ? pct(ret.rate) : '—', 'دقت ۳۰ روز اخیر', 'accent')),

      weekStrip(t),
      freeStudy());
  }

  // ── دک‌های آماده‌ی افزودن ────────────────────────────────────────────────────
  function packBanners() {
    return PACKS.filter((p) => !store.installedPacks().includes(p.id)).map((p) =>
      h('section', { class: 'banner' },
        h('span', { class: 'banner-ic' }, icon('cards')),
        h('div', { class: 'banner-tx' }, h('b', {}, p.name), h('span', { class: 'muted' }, `${p.description} (${n(p.cards.length)} کارت)`)),
        h('button', { class: 'btn primary small', onclick: () => { const k = store.installPack(p.id); toast(`${n(k)} کارت جدید اضافه شد.`); draw(); } }, icon('plus'), 'افزودن')));
  }

  // ── بنر نصب ────────────────────────────────────────────────────────────────
  function installBanner() {
    const S = store.state();
    if (P.isStandalone()) return null;
    if (S.meta.installDismissed && Date.now() - S.meta.installDismissed < HIDE_MS) return null;
    const ios = P.isIOS();
    if (!P.canPromptInstall() && !ios) return null;
    return h('section', { class: 'banner' },
      h('div', { class: 'banner-ic' }, icon('download')),
      h('div', { class: 'banner-tx' },
        h('b', {}, 'برنامه را نصب کن'),
        h('span', { class: 'muted' }, 'تمام‌صفحه، بدون نوار مرورگر و کاملاً آفلاین.')),
      h('button', { class: 'btn primary small', onclick: async () => { if (ios && !P.canPromptInstall()) iosHelp(); else await P.promptInstall(); } }, 'نصب'),
      h('button', { class: 'icon-btn small', 'aria-label': 'بستن', onclick: () => { store.state().meta.installDismissed = Date.now(); store.saveSoon(); draw(); } }, icon('x')));
  }

  // ── کارت اصلی ──────────────────────────────────────────────────────────────
  function hero(sess, c, done, left, S) {
    const total = done.n ? done.n + left : left; // تقریب: انجام‌شده + باقی‌مانده
    const frac = total ? Math.min(1, done.n / total) : 0;
    const finished = left === 0;
    const nd = finished ? nextDue(S.cards, S.prog, Date.now(), S.settings) : null;
    let nextTxt = '';
    if (nd) {
      if (nd.learnMs) nextTxt = 'کارت بعدی ' + fmtDelay(nd.learnMs - Date.now()) + ' دیگر';
      else if (nd.reviewDay != null) nextTxt = nd.reviewDay - nd.today === 1 ? 'مرور بعدی: فردا' : 'مرور بعدی: ' + n(nd.reviewDay - nd.today) + ' روز دیگر';
    }
    return h('section', { class: 'hero' },
      ring(frac, finished ? '✓' : n(left), finished ? 'تمام شد' : 'کارت مانده'),
      h('div', { class: 'hero-main' },
        h('div', { class: 'chips' },
          chip('new', 'جدید', c.new), chip('learn', 'یادگیری', c.learn), chip('review', 'مرور', c.review)),
        finished
          ? h('p', { class: 'hero-msg' }, done.n ? `آفرین! امروز ${n(done.n)} کارت مرور کردی 🎉` : 'برای امروز کارتی نیست.', nextTxt && h('span', { class: 'muted' }, ' ' + nextTxt))
          : h('p', { class: 'hero-msg' }, done.n ? `تا اینجا ${n(done.n)} کارت انجام شده.` : 'آماده‌ای برای مرور امروز؟'),
        h('div', { class: 'hero-actions' },
          h('a', { class: 'btn primary big', href: '#/study' }, icon('play'), finished ? 'مرور بیشتر' : 'شروع مرور'))));
  }
  function chip(kind, label, v) { return h('span', { class: 'cnt ' + kind }, h('b', {}, n(v)), label); }
  function ring(frac, big, small) {
    const r = 44, C = 2 * Math.PI * r;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('class', 'ring-svg');
    const mk = (cls, off) => {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', 50); c.setAttribute('cy', 50); c.setAttribute('r', r); c.setAttribute('class', cls);
      if (off != null) { c.setAttribute('stroke-dasharray', C); c.setAttribute('stroke-dashoffset', C * (1 - off)); }
      return c;
    };
    svg.append(mk('ring-bg'), mk('ring-fg', frac));
    return h('div', { class: 'ring' }, svg, h('div', { class: 'ring-tx' }, h('b', {}, big), h('span', {}, small)));
  }

  // ── تمرین روزانه ───────────────────────────────────────────────────────────
  function practiceCard() {
    const pr = store.practiceToday();
    if (!pr || !pr.card) return null;
    const c = pr.card;
    const note = h('textarea', { class: 'note', rows: 2, placeholder: 'چطور پیش رفت؟ (اختیاری)', value: pr.note || '' });
    note.addEventListener('change', () => store.setPractice({ note: note.value }));
    return h('section', { class: 'card practice' + (pr.done ? ' done' : '') },
      h('div', { class: 'card-head' },
        h('span', { class: 'kicker' }, icon('target'), 'تمرین امروز در دنیای واقعی'),
        h('button', { class: 'icon-btn small', title: 'یک قانون دیگر', 'aria-label': 'یک قانون دیگر', onclick: () => { store.rerollPractice(); draw(); } }, icon('refresh'))),
      h('h3', {}, c.rule || c.front),
      c.example && h('blockquote', {}, c.example),
      h('div', { class: 'practice-foot' },
        h('button', {
          class: 'btn ' + (pr.done ? 'good' : 'primary'), 'aria-pressed': pr.done ? 'true' : 'false',
          onclick: () => { store.setPractice({ done: !pr.done, note: note.value }); P.haptic(20); draw(); },
        }, icon('check'), pr.done ? 'انجام شد' : 'امروز انجامش دادم'),
        store.practiceStreak() > 1 && h('span', { class: 'muted' }, `${n(store.practiceStreak())} روز پیاپی تمرین`)),
      pr.done && note);
  }

  // ── نوار هفته ──────────────────────────────────────────────────────────────
  function weekStrip(t) {
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(t - i);
    const names = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش']; // یکشنبه..شنبه (بر اساس getDay)
    return h('section', { class: 'card week' },
      h('div', { class: 'card-head' }, h('span', { class: 'kicker' }, '۷ روز اخیر')),
      h('div', { class: 'week-row' }, ...days.map((d) => {
        const v = store.daily(d).n;
        const dow = (d + 4) % 7;
        return h('div', { class: 'wd' + (d === t ? ' today' : '') + (v ? ' on' : ''), title: `${dayWeekday(d)}: ${n(v)} مرور` },
          h('i', {}, v ? icon('check') : null), h('span', {}, names[dow]));
      })));
  }

  // ── مرور آزاد ──────────────────────────────────────────────────────────────
  function freeStudy() {
    const tags = allTags();
    if (!store.cards().length) return null;
    return h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('span', { class: 'kicker' }, 'مرور آزاد (بدون تأثیر روی زمان‌بندی)')),
      h('div', { class: 'tagrow' },
        h('a', { class: 'tag', href: '#/study/free' }, 'همه (تصادفی)'),
        ...tags.slice(0, 12).map((t) => h('a', { class: 'tag', href: '#/study/free?tag=' + encodeURIComponent(t) }, t))));
  }
}

function tile(ic, value, label, tone) {
  return h('div', { class: 'tile ' + tone }, h('div', { class: 'tile-ic' }, icon(ic)), h('b', {}, value), h('span', {}, label));
}

export function iosHelp() {
  openDialog(h('div', { class: 'dlg-body' },
    h('h2', {}, 'نصب روی iPhone / iPad'),
    h('ol', { class: 'steps' },
      h('li', {}, 'این صفحه را در Safari باز کن.'),
      h('li', {}, 'دکمه‌ی اشتراک‌گذاری ', icon('share'), ' را بزن.'),
      h('li', {}, 'گزینه‌ی «Add to Home Screen» را انتخاب کن.')),
    h('div', { class: 'dlg-actions' }, h('button', { class: 'btn primary', onclick: () => closeDialog('ok') }, 'متوجه شدم'))));
}
