// browse.js — مرور و مدیریت همه‌ی کارت‌ها: جستجو، فیلتر وضعیت و برچسب، ویرایش.
import * as store from '../store.js';
import { h, mount, icon, n, norm, debounce } from '../util.js';
import { openEditor, cardStatus, allTags } from './editor.js';

const STATUS = [
  ['all', 'همه'], ['new', 'جدید'], ['learn', 'یادگیری'], ['young', 'مرور'], ['mature', 'مسلط'],
  ['susp', 'معلق'], ['flag', 'نشان‌دار'], ['leech', 'مشکل‌دار'],
];

// فیلترها در طول نشست حفظ می‌شوند
const F = { q: '', status: 'all', tag: '' };

export function render(root) {
  let listEl, countEl;

  const matches = (c) => {
    const p = store.state().prog[c.id];
    if (F.status !== 'all') {
      if (F.status === 'flag') { if (!p?.flag) return false; }
      else if (F.status === 'leech') { if (!p?.leech) return false; }
      else if (cardStatus(p).key !== F.status) return false;
    }
    if (F.tag && !c.tags.includes(F.tag)) return false;
    if (F.q) {
      const hay = norm([c.front, c.rule, c.back, c.example, c.tags.join(' ')].join(' '));
      if (!F.q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  };

  function row(c, i) {
    const p = store.state().prog[c.id];
    const st = cardStatus(p);
    return h('button', { class: 'row', onclick: () => openEditor(c.id, { onDone: draw }) },
      h('span', { class: 'row-n' }, n(store.cards().indexOf(c) + 1)),
      h('span', { class: 'row-main' },
        h('b', { class: 'row-title' }, c.rule || c.front),
        h('span', { class: 'row-sub' }, c.rule ? c.front : c.back),
        c.tags.length > 0 && h('span', { class: 'row-tags' }, ...c.tags.map((t) => h('i', {}, t)))),
      h('span', { class: 'row-side' },
        h('span', { class: 'badge ' + st.key }, st.label),
        st.due && h('small', {}, st.due),
        p?.flag && h('span', { class: 'flag' }, icon('bookmark'))));
  }

  function renderList() {
    const all = store.cards();
    const items = all.filter(matches);
    countEl.textContent = items.length === all.length ? `${n(all.length)} کارت` : `${n(items.length)} از ${n(all.length)} کارت`;
    mount(listEl, items.length
      ? items.map(row)
      : h('div', { class: 'empty' },
          h('p', {}, all.length ? 'کارتی با این فیلترها پیدا نشد.' : 'هنوز کارتی نداری.'),
          h('button', { class: 'btn primary', onclick: () => (all.length ? (F.q = F.tag = '', F.status = 'all', draw()) : openEditor(null, { onDone: draw })) }, all.length ? 'پاک کردن فیلترها' : 'افزودن اولین کارت')));
  }

  function draw() {
    const tags = allTags();
    const search = h('input', { type: 'search', class: 'search-in', placeholder: 'جستجو در کارت‌ها…', value: F.q, 'aria-label': 'جستجو', enterkeyhint: 'search' });
    search.addEventListener('input', debounce(() => { F.q = norm(search.value); renderList(); }, 120));
    countEl = h('span', { class: 'muted' });
    listEl = h('div', { class: 'list' });
    const chip = (label, on, fn) => h('button', { class: 'chip' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: fn }, label);

    mount(root, h('div', { class: 'page browse' },
      h('header', { class: 'page-head' },
        h('div', {}, h('h1', {}, 'کارت‌ها'), countEl),
        h('div', { class: 'head-actions' },
          h('button', { class: 'btn primary', onclick: () => openEditor(null, { onDone: draw }) }, icon('plus'), 'کارت جدید'))),
      h('div', { class: 'search' }, icon('search'), search),
      h('div', { class: 'chips-scroll', role: 'group', 'aria-label': 'فیلتر وضعیت' },
        ...STATUS.map(([k, l]) => chip(l, F.status === k, () => { F.status = k; draw(); }))),
      tags.length > 0 && h('div', { class: 'chips-scroll tags', role: 'group', 'aria-label': 'فیلتر برچسب' },
        ...tags.map((t) => chip('#' + t, F.tag === t, () => { F.tag = F.tag === t ? '' : t; draw(); }))),
      listEl,
      h('button', { class: 'fab', 'aria-label': 'کارت جدید', onclick: () => openEditor(null, { onDone: draw }) }, icon('plus'))));
    renderList();
  }
  draw();
}
