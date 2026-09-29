// io.js — ورود و خروج داده: پشتیبان کامل، دک JSON (سازگار با نسخه‌ی اول)، Anki TSV، ورود CSV/TSV.
import * as store from './store.js';
import { download, uid } from './util.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

export function exportBackup() {
  store.flush();
  const S = store.state();
  download(`social-srs-backup-${stamp()}.json`, JSON.stringify({ format: 'social-srs-backup', version: 2, exportedAt: new Date().toISOString(), state: S }));
}

export function exportDeck() {
  const S = store.state();
  download(`social-srs-deck-${stamp()}.json`, JSON.stringify({
    format: 'social-srs-anki-json', version: 1, name: S.deckName, description: '',
    cards: S.cards.map(({ id, front, example, rule, back, tags }) => ({ id, front, example, rule, back, tags })),
  }, null, 2));
}

export function exportAnki() {
  const S = store.state();
  const clean = (v) => String(v).replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
  const rows = S.cards.map((c) => [
    esc(c.front),
    `<b>${esc(c.rule)}</b><br>${esc(c.back)}` + (c.example ? `<br><br><i>مثال اجتماعی: ${esc(c.example)}</i>` : ''),
    c.tags.map((t) => t.replace(/\s+/g, '_')).join(' '),
    c.id,
  ].map(clean).join('\t'));
  const head = ['#separator:tab', '#html:true', '#tags column:3', '#guid column:4'];
  download(`social-srs-anki-${stamp()}.txt`, head.concat(rows).join('\n'), 'text/tab-separated-values;charset=utf-8');
}

// ── تجزیه‌ی ورودی ───────────────────────────────────────────────────────────
function parseDelimited(text) {
  const t = text.replace(/^﻿/, '');
  const lines = t.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
  if (!lines.length) return [];
  const first = lines[0];
  const delim = first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
  const rows = [];
  let row = [], cell = '', q = false;
  const src = lines.join('\n');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"' && cell === '') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell); rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim()));
}

const HEAD = {
  id: ['id', 'guid', 'شناسه'], front: ['front', 'question', 'سوال', 'سؤال', 'روی کارت'],
  example: ['example', 'مثال'], rule: ['rule', 'قانون'], back: ['back', 'answer', 'پاسخ', 'پشت کارت'], tags: ['tags', 'tag', 'برچسب', 'برچسب‌ها'],
};
function tsvToCards(rows) {
  if (!rows.length) return [];
  const lower = rows[0].map((c) => c.trim().toLowerCase());
  const map = {};
  lower.forEach((name, i) => { for (const [k, alts] of Object.entries(HEAD)) if (alts.includes(name)) map[k] = i; });
  const hasHeader = map.front !== undefined;
  const data = hasHeader ? rows.slice(1) : rows;
  return data.map((r) => {
    if (hasHeader) {
      const g = (k) => (map[k] !== undefined ? (r[map[k]] || '').trim() : '');
      return { id: g('id'), front: g('front'), example: g('example'), rule: g('rule'), back: g('back'), tags: g('tags') };
    }
    if (r.length >= 5) return { front: r[0], example: r[1], rule: r[2], back: r[3], tags: r[4] };
    return { front: r[0], back: r[1] || '', tags: r[2] || '' };
  }).filter((c) => c.front && String(c.front).trim());
}

/** خروجی: {kind, cards?, state?, name} یا خطا (throw). */
export function parseImport(text) {
  const t = text.trim();
  if (!t) throw new Error('فایل خالی است.');
  if (t[0] === '{' || t[0] === '[') {
    let j;
    try { j = JSON.parse(t); } catch { throw new Error('فایل JSON معتبر نیست.'); }
    if (j && j.format === 'social-srs-backup' && j.state) return { kind: 'backup', state: j.state, cards: j.state.cards || [], name: 'پشتیبان کامل' };
    const cards = Array.isArray(j) ? j : j && j.cards;
    if (!Array.isArray(cards)) throw new Error('ساختار JSON شناخته نشد؛ آرایه‌ی «cards» یافت نشد.');
    return { kind: 'deck', cards, name: (j && j.name) || 'دک' };
  }
  const cards = tsvToCards(parseDelimited(t));
  if (!cards.length) throw new Error('هیچ کارتی در فایل پیدا نشد.');
  return { kind: 'table', cards, name: 'جدول' };
}

/** پیش‌نمایش اثر ورود: چند کارت جدید/به‌روز/نادیده. mode: skip | replace */
export function planImport(parsed, mode = 'skip') {
  if (parsed.kind === 'backup') return { add: parsed.cards.length, update: 0, skip: 0, replaceAll: true };
  const S = store.state();
  const byId = new Map(S.cards.map((c) => [c.id, c]));
  const byFront = new Map(S.cards.map((c) => [c.front.trim(), c]));
  const ops = [];
  let add = 0, update = 0, skip = 0;
  for (const raw of parsed.cards) {
    if (!raw || !String(raw.front ?? '').trim()) { skip++; continue; }
    const existing = (raw.id && byId.get(String(raw.id))) || byFront.get(String(raw.front).trim());
    if (existing) {
      if (mode === 'replace') { update++; ops.push({ ...raw, id: existing.id }); } else skip++;
    } else { add++; ops.push({ ...raw, id: raw.id ? String(raw.id) : uid() }); }
  }
  return { add, update, skip, ops };
}

export function applyImport(parsed, mode = 'skip') {
  if (parsed.kind === 'backup') { store.replaceState(parsed.state); return planImport(parsed, mode); }
  const plan = planImport(parsed, mode);
  for (const op of plan.ops) store.upsertCard(op);
  store.save();
  return plan;
}
