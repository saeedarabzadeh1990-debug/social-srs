// editor.js — ویرایشگر کارت (دیالوگ) و توصیف وضعیت کارت.
import * as store from '../store.js';
import { NEW, LEARN, REVIEW, RELEARN } from '../srs.js';
import { h, icon, n, fmtDelay, openDialog, closeDialog, confirmBox, toast } from '../util.js';

/** وضعیت خوانا برای یک کارت. */
export function cardStatus(p) {
  const now = Date.now(), t = store.today();
  if (p && p.susp) return { key: 'susp', label: 'معلق', due: '' };
  if (!p || p.st === NEW) return { key: 'new', label: 'جدید', due: '' };
  if (p.st === LEARN || p.st === RELEARN) {
    return { key: 'learn', label: p.st === RELEARN ? 'یادگیری مجدد' : 'در حال یادگیری', due: p.due <= now ? 'اکنون' : 'تا ' + fmtDelay(p.due - now) };
  }
  const mature = (p.ivl || 0) >= 21;
  const days = p.due - t;
  return { key: mature ? 'mature' : 'young', label: mature ? 'مسلط' : 'مرور', due: days <= 0 ? 'موعد رسیده' : n(days) + ' روز دیگر' };
}

export function allTags() {
  return [...new Set(store.cards().flatMap((c) => c.tags))].sort((a, b) => a.localeCompare(b, 'fa'));
}

/** ویرایشگر؛ id = null یعنی کارت جدید. */
export async function openEditor(id, { onDone } = {}) {
  const existing = id ? store.card(id) : null;
  const c = existing || { front: '', rule: '', back: '', example: '', tags: [] };
  const err = h('div', { class: 'field-err', role: 'alert' });
  const field = (label, name, val, { rows = 2, hint, ph } = {}) =>
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, label),
      h('textarea', { name, rows, placeholder: ph || '', value: val || '' }), hint && h('span', { class: 'hint' }, hint));

  const tagList = h('datalist', { id: 'tag-list' }, ...allTags().map((t) => h('option', { value: t })));
  const form = h('form', { class: 'dlg-body editor', novalidate: true },
    h('h2', {}, existing ? 'ویرایش کارت' : 'کارت جدید'),
    field('روی کارت (پرسش یا موقعیت)', 'front', c.front, { ph: 'مثلاً: در جمع کسی از سفرش با ذوق می‌گوید؛ چه کار کن؟' }),
    field('قانون کوتاه', 'rule', c.rule, { rows: 1, ph: 'یک جمله‌ی کوتاه و قابل‌حفظ' }),
    field('توضیح', 'back', c.back, { rows: 4 }),
    field('مثال (چه بگویم؟)', 'example', c.example, { rows: 2 }),
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'برچسب‌ها'),
      h('input', { name: 'tags', list: 'tag-list', value: (c.tags || []).join('، '), placeholder: 'گفتگو، گوش‌دادن' }),
      h('span', { class: 'hint' }, 'با ویرگول یا فاصله جدا کن.')),
    tagList, err,
    existing && progressBlock(existing.id),
    h('div', { class: 'dlg-actions' },
      existing && h('button', { type: 'button', class: 'btn danger ghost push-end', onclick: () => remove(existing) }, icon('trash'), 'حذف'),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => closeDialog('cancel') }, 'انصراف'),
      h('button', { type: 'submit', class: 'btn primary' }, 'ذخیره')));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = { id: existing?.id, front: fd.get('front'), rule: fd.get('rule'), back: fd.get('back'), example: fd.get('example'), tags: fd.get('tags') };
    if (!String(data.front).trim()) { err.textContent = 'متن روی کارت را بنویس.'; form.elements.front.focus(); return; }
    if (!String(data.rule).trim() && !String(data.back).trim()) { err.textContent = 'حداقل «قانون کوتاه» یا «توضیح» لازم است.'; form.elements.rule.focus(); return; }
    store.upsertCard(data);
    closeDialog('saved');
    toast(existing ? 'کارت ذخیره شد.' : 'کارت اضافه شد.');
  });

  async function remove(card) {
    if (!(await confirmBox({ title: 'حذف کارت؟', text: 'کارت و پیشرفت آن حذف می‌شود.', ok: 'حذف', danger: true }))) { openEditor(id, { onDone }); return; }
    const snap = store.deleteCard(card.id);
    toast('کارت حذف شد.', { action: 'بازگردانی', onAction: () => { store.restoreCard(snap); onDone && onDone(); }, ms: 6000 });
    onDone && onDone();
  }

  const r = await openDialog(form, { sheet: true });
  if (r === 'saved' || r === 'deleted') onDone && onDone();
  return r;
}

function progressBlock(id) {
  const p = store.prog(id);
  const st = cardStatus(store.state().prog[id]);
  const item = (k, v) => h('div', { class: 'kv' }, h('span', {}, k), h('b', {}, v));
  const started = p.reps > 0;
  return h('div', { class: 'prog-box' },
    h('div', { class: 'prog-head' }, h('b', {}, 'وضعیت مرور'), h('span', { class: 'badge ' + st.key }, st.label)),
    started && h('div', { class: 'kvs' },
      item('فاصله', p.st === REVIEW ? n(p.ivl) + ' روز' : '—'),
      item('ضریب سهولت', p.ease ? n(Math.round(p.ease * 100)) + '٪' : '—'),
      item('تعداد مرور', n(p.reps)),
      item('فراموشی', n(p.lapses || 0)),
      st.due && item('موعد', st.due)),
    !started && h('p', { class: 'hint' }, 'این کارت هنوز مرور نشده است.'),
    h('div', { class: 'row-actions' },
      h('button', { type: 'button', class: 'btn small', onclick: () => { store.patchProg(id, { susp: !p.susp || undefined }); closeDialog('progress'); openEditor(id); } }, p.susp ? 'برداشتن تعلیق' : 'معلق کردن'),
      started && h('button', { type: 'button', class: 'btn small', onclick: async () => { store.resetCard(id); toast('پیشرفت این کارت بازنشانی شد.'); closeDialog('progress'); openEditor(id); } }, 'بازنشانی پیشرفت')));
}
