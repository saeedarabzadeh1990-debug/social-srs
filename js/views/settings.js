// settings.js — تنظیمات: ظاهر، پارامترهای SRS، نصب/تمام‌صفحه، داده و پشتیبان.
import * as store from '../store.js';
import * as P from '../platform.js';
import * as io from '../io.js';
import { DEFAULTS as SRS } from '../srs.js';
import { h, mount, icon, n, toast, openDialog, closeDialog, confirmBox, fmtStamp } from '../util.js';
import { iosHelp } from './home.js';

const ACCENTS = [['blue', 'آبی'], ['green', 'سبز'], ['violet', 'بنفش'], ['rose', 'صورتی'], ['amber', 'کهربایی']];
const SRS_KEYS = ['newPerDay', 'revPerDay', 'learnSteps', 'relearnSteps', 'gradIvl', 'easyIvl', 'startEase', 'easyBonus', 'hardIvl', 'maxIvl', 'rollover', 'leechAt'];
const VERSION = '2.0.0';

export function render(root) {
  let info = null;
  const storageText = (i) => `${i.persisted ? 'دائمی' : 'مرورگر ممکن است پاک کند'} • ${(i.usage / 1024).toFixed(0)} KB`;
  const draw = () => mount(root, body());
  draw();
  const evs = ['install-available', 'installed', 'fullscreen', 'sw-ready'];
  evs.forEach((e) => P.events.addEventListener(e, draw));
  P.storageInfo().then((i) => { info = i; const el = root.querySelector('[data-storage]'); if (el) el.textContent = storageText(i); });
  return () => evs.forEach((e) => P.events.removeEventListener(e, draw));

  function body() {
    const s = store.settings();
    const set = (k, v) => { store.setSetting(k, v); if (['theme', 'accent', 'fontScale', 'persianDigits', 'motion'].includes(k)) P.applyAppearance(); };

    return h('div', { class: 'page settings' },
      h('header', { class: 'page-head' }, h('div', {}, h('h1', {}, 'تنظیمات'))),

      group('ظاهر',
        row('تم', null, seg([['auto', 'خودکار'], ['dark', 'تیره'], ['light', 'روشن']], s.theme, (v) => { set('theme', v); draw(); })),
        row('رنگ اصلی', null, h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'رنگ اصلی' },
          ...ACCENTS.map(([k, l]) => h('button', { class: 'swatch a-' + k + (s.accent === k ? ' on' : ''), role: 'radio', 'aria-checked': s.accent === k ? 'true' : 'false', 'aria-label': l, title: l, onclick: () => { set('accent', k); draw(); } })))),
        row('اندازه‌ی متن', `${n(Math.round(s.fontScale * 100))}٪`, slider(s.fontScale, 0.85, 1.4, 0.05, (v) => set('fontScale', v), (v) => `${n(Math.round(v * 100))}٪`)),
        row('ارقام فارسی', 'نمایش ۱۲۳ به‌صورت ۱۲۳', toggle(s.persianDigits, (v) => { set('persianDigits', v); draw(); })),
        row('کاهش انیمیشن', 'حرکت‌های کمتر در رابط', toggle(s.motion === 'reduce', (v) => set('motion', v ? 'reduce' : 'auto')))),

      group('مرور',
        row('کارت جدید در روز', null, num(s.newPerDay, 0, 500, 1, (v) => set('newPerDay', v))),
        row('مرور بیشینه در روز', null, num(s.revPerDay, 1, 9999, 10, (v) => set('revPerDay', v))),
        row('مثال روی کارت', 'مثال را همراه پرسش نشان بده (پیش‌فرض: پشت کارت)', toggle(s.exampleOnFront, (v) => set('exampleOnFront', v))),
        row('زمان‌سنج', 'نمایش ثانیه‌شمار برای هر کارت', toggle(s.showTimer, (v) => set('showTimer', v))),
        row('لرزش هنگام پاسخ', 'روی دستگاه‌هایی که پشتیبانی می‌کنند', toggle(s.haptics, (v) => set('haptics', v))),
        row('شروع روز مطالعه', 'ساعتی که «فردا» از آن آغاز می‌شود', num(s.rollover, 0, 12, 1, (v) => set('rollover', v), 'ساعت')),
        h('details', { class: 'adv' },
          h('summary', {}, 'تنظیمات پیشرفته‌ی SRS'),
          row('مراحل یادگیری', 'دقیقه، با فاصله؛ مثلاً «۱ ۱۰»', steps(s.learnSteps, (v) => set('learnSteps', v))),
          row('مراحل یادگیری مجدد', 'پس از فراموشی', steps(s.relearnSteps, (v) => set('relearnSteps', v))),
          row('فاصله‌ی اولیه', 'روز، پس از یادگیری با «خوب»', num(s.gradIvl, 1, 30, 1, (v) => set('gradIvl', v), 'روز')),
          row('فاصله‌ی «آسان»', 'روز، برای کارت جدید', num(s.easyIvl, 1, 60, 1, (v) => set('easyIvl', v), 'روز')),
          row('ضریب سهولت اولیه', 'درصد', num(Math.round(s.startEase * 100), 130, 400, 5, (v) => set('startEase', v / 100), '٪')),
          row('پاداش «آسان»', 'درصد', num(Math.round(s.easyBonus * 100), 100, 200, 5, (v) => set('easyBonus', v / 100), '٪')),
          row('ضریب «سخت»', 'درصد', num(Math.round(s.hardIvl * 100), 100, 200, 5, (v) => set('hardIvl', v / 100), '٪')),
          row('بیشینه‌ی فاصله', 'روز', num(s.maxIvl, 7, 3650, 30, (v) => set('maxIvl', v), 'روز')),
          row('آستانه‌ی «مشکل‌دار»', 'تعداد فراموشی', num(s.leechAt, 2, 50, 1, (v) => set('leechAt', v))),
          h('div', { class: 'row-actions' },
            h('button', { class: 'btn small', onclick: () => { store.setSettings(Object.fromEntries(SRS_KEYS.map((k) => [k, SRS[k]]))); draw(); toast('تنظیمات SRS به پیش‌فرض برگشت.'); } }, 'بازگشت به پیش‌فرض')))),

      group('برنامه', ...appRows()),

      group('داده و پشتیبان',
        row('پشتیبان کامل', 'کارت‌ها، پیشرفت، آمار و تنظیمات (JSON)', btn('download', 'دریافت', () => { io.exportBackup(); toast('فایل پشتیبان ساخته شد.'); })),
        row('خروجی دک', 'فقط کارت‌ها (JSON سازگار با نسخه‌ی اول)', btn('download', 'دریافت', io.exportDeck)),
        row('خروجی Anki', 'فایل متنی برای وارد کردن در Anki', btn('download', 'دریافت', io.exportAnki)),
        row('ورود از فایل', 'پشتیبان، دک JSON یا جدول CSV/TSV', importBtn()),
        row('بازنشانی پیشرفت', 'کارت‌ها می‌مانند؛ زمان‌بندی و آمار پاک می‌شود', h('button', { class: 'btn danger small', onclick: async () => { if (await confirmBox({ title: 'پیشرفت پاک شود؟', text: 'زمان‌بندی مرور، آمار و تمرین‌ها بازنشانی می‌شود. کارت‌ها حفظ می‌شوند.', ok: 'پاک کن', danger: true })) { store.resetAllProgress(); toast('پیشرفت بازنشانی شد.'); draw(); } } }, 'بازنشانی')),
        row('پاک کردن همه چیز', 'برگشت به دک پیش‌فرض', h('button', { class: 'btn danger small', onclick: async () => { if (await confirmBox({ title: 'همه‌ی داده‌ها پاک شود؟', text: 'این کار قابل بازگشت نیست؛ ابتدا پشتیبان بگیر.', ok: 'پاک کن', danger: true })) { store.eraseEverything(); P.applyAppearance(); toast('همه‌چیز پاک شد.'); draw(); } } }, 'پاک کردن'))),

      group('میان‌بر صفحه‌کلید (در حالت مرور)',
        h('div', { class: 'keys' },
          key('Space', 'نمایش پاسخ / «خوب»'), key('1 – 4', 'دوباره، سخت، خوب، آسان'), key('Z', 'بازگردانی'), key('E', 'ویرایش کارت'), key('Esc', 'خروج'))),

      h('p', { class: 'muted foot' }, `Social SRS نسخه‌ی ${VERSION} • داده‌ها فقط روی همین دستگاه ذخیره می‌شوند.`));
  }

  function appRows() {
    const installed = P.isStandalone();
    const rows = [];
    rows.push(row('نصب برنامه', installed ? 'روی این دستگاه نصب شده است ✓' : 'تمام‌صفحه و بدون نوار مرورگر',
      installed ? h('span', { class: 'badge mature' }, 'نصب‌شده')
        : P.canPromptInstall() ? btn('download', 'نصب', () => P.promptInstall())
          : P.isIOS() ? btn('share', 'راهنما', iosHelp)
            : h('span', { class: 'muted small' }, 'از منوی مرورگر: Install app')));
    if (P.fsSupported()) rows.push(row('تمام‌صفحه', 'حالت غوطه‌ور، بدون نوار مرورگر', btn(P.isFullscreen() ? 'exitfs' : 'fullscreen', P.isFullscreen() ? 'خروج' : 'ورود', P.toggleFullscreen)));
    rows.push(row('حالت آفلاین', P.swActive() ? 'فعال — بدون اینترنت هم کار می‌کند' : 'پس از یک بار بارگذاری کامل فعال می‌شود', h('span', { class: 'badge ' + (P.swActive() ? 'mature' : 'susp') }, P.swActive() ? 'فعال' : 'در انتظار')));
    rows.push(row('به‌روزرسانی', `نسخه‌ی ${VERSION}`, btn('refresh', 'بررسی', async () => {
      const r = await P.checkForUpdate();
      toast(r === 'available' ? 'نسخه‌ی جدید در حال آماده‌سازی است.' : r === 'latest' ? 'نسخه‌ی شما به‌روز است.' : r === 'offline' ? 'اتصال برقرار نشد.' : 'سرویس‌ورکر در دسترس نیست.');
    })));
    rows.push(row('ذخیره‌سازی', h('span', { 'data-storage': '' }, info ? storageText(info) : '…'), null));
    return rows;
  }
}

// ── اجزای فرم ─────────────────────────────────────────────────────────────────
function group(title, ...kids) { return h('section', { class: 'card group' }, h('h2', { class: 'g-title' }, title), ...kids); }
function row(label, hint, control) {
  return h('div', { class: 'srow' },
    h('div', { class: 'srow-tx' }, h('b', {}, label), hint && h('span', { class: 'hint' }, hint)),
    control && h('div', { class: 'srow-ctl' }, control));
}
function btn(ic, label, fn) { return h('button', { class: 'btn small', onclick: fn }, icon(ic), label); }
function key(k, d) { return h('div', { class: 'keyrow' }, h('kbd', {}, k), h('span', {}, d)); }

function seg(opts, val, onPick) {
  return h('div', { class: 'seg-ctl', role: 'radiogroup' }, ...opts.map(([k, l]) =>
    h('button', { class: k === val ? 'on' : '', role: 'radio', 'aria-checked': k === val ? 'true' : 'false', onclick: () => onPick(k) }, l)));
}
function toggle(val, onChange) {
  const b = h('button', { class: 'switch' + (val ? ' on' : ''), role: 'switch', 'aria-checked': val ? 'true' : 'false' }, h('i', {}));
  b.addEventListener('click', () => { val = !val; b.classList.toggle('on', val); b.setAttribute('aria-checked', String(val)); onChange(val); });
  return b;
}
function num(val, min, max, step, onChange, unit) {
  const inp = h('input', { type: 'number', class: 'num', inputmode: 'numeric', min, max, step, value: String(val) });
  inp.addEventListener('change', () => {
    let v = parseFloat(inp.value);
    if (!Number.isFinite(v)) v = val;
    v = Math.min(max, Math.max(min, v));
    inp.value = String(v); val = v; onChange(v);
  });
  return h('div', { class: 'num-wrap' }, inp, unit && h('span', { class: 'muted small' }, unit));
}
function slider(val, min, max, step, onChange, fmt) {
  const out = h('output', { class: 'muted small' }, fmt(val));
  const inp = h('input', { type: 'range', min, max, step, value: String(val), class: 'range' });
  inp.addEventListener('input', () => { const v = parseFloat(inp.value); out.textContent = fmt(v); onChange(v); });
  return h('div', { class: 'range-wrap' }, inp, out);
}
function steps(val, onChange) {
  const inp = h('input', { type: 'text', class: 'num wide', value: val.map((x) => n(x)).join(' '), inputmode: 'decimal', dir: 'ltr' });
  inp.addEventListener('change', () => {
    const arr = inp.value.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).split(/[\s,،]+/).filter(Boolean).map(Number);
    if (arr.every((x) => Number.isFinite(x) && x > 0 && x <= 1440) && arr.length <= 8) { val = arr; onChange(arr); inp.value = arr.map((x) => n(x)).join(' '); }
    else { toast('مراحل باید عددهای مثبت (دقیقه) باشند.'); inp.value = val.map((x) => n(x)).join(' '); }
  });
  return inp;
}

// ── ورود از فایل ──────────────────────────────────────────────────────────────
function importBtn() {
  const inp = h('input', { type: 'file', accept: '.json,.csv,.tsv,.txt,application/json,text/csv,text/plain', hidden: true });
  inp.addEventListener('change', async () => {
    const f = inp.files[0]; inp.value = '';
    if (!f) return;
    try { confirmImport(io.parseImport(await f.text()), f.name); }
    catch (e) { toast('خطا: ' + e.message, { kind: 'bad', ms: 5000 }); }
  });
  return h('div', {}, inp, h('button', { class: 'btn small', onclick: () => inp.click() }, icon('upload'), 'انتخاب فایل'));
}

async function confirmImport(parsed, filename) {
  let mode = 'skip';
  const summary = h('p', { class: 'muted' });
  const paint = () => {
    if (parsed.kind === 'backup') { summary.textContent = `پشتیبان کامل با ${n(parsed.cards.length)} کارت. تمام داده‌های فعلی جایگزین می‌شود.`; return; }
    const p = io.planImport(parsed, mode);
    summary.textContent = `${n(p.add)} کارت جدید` + (mode === 'replace' ? `، ${n(p.update)} به‌روزرسانی` : '') + `، ${n(p.skip)} نادیده` + ' — پیشرفت کارت‌های موجود حفظ می‌شود.';
  };
  const modeSeg = parsed.kind === 'backup' ? null : h('div', { class: 'seg-ctl' },
    ...[['skip', 'فقط کارت‌های جدید'], ['replace', 'به‌روزرسانی کارت‌های موجود']].map(([k, l]) => h('button', { type: 'button', class: k === mode ? 'on' : '', onclick: (e) => { mode = k; e.target.parentNode.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.target)); paint(); } }, l)));
  paint();
  const r = await openDialog(h('form', { method: 'dialog', class: 'dlg-body' },
    h('h2', {}, 'ورود از فایل'),
    h('p', { class: 'hint' }, filename),
    modeSeg, summary,
    h('div', { class: 'dlg-actions' },
      h('button', { class: 'btn ghost', value: 'no' }, 'انصراف'),
      h('button', { class: 'btn ' + (parsed.kind === 'backup' ? 'danger' : 'primary'), value: 'yes' }, parsed.kind === 'backup' ? 'جایگزین کن' : 'وارد کن'))));
  if (r !== 'yes') return;
  const res = io.applyImport(parsed, mode);
  P.applyAppearance();
  toast(parsed.kind === 'backup' ? 'پشتیبان بازیابی شد.' : `${n(res.add)} کارت اضافه شد.`);
  location.hash = '#/browse';
}
