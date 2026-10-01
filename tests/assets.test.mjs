import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sw = readFileSync(join(root, 'sw.js'), 'utf8');

test('همه‌ی فایل‌های پیش‌کش سرویس‌ورکر وجود دارند (یک فایل گمشده کل نصب آفلاین را می‌شکند)', () => {
  const list = [...sw.matchAll(/'(\.\/[^']*)'/g)].map((m) => m[1]).filter((p) => p !== './');
  assert.ok(list.length > 10);
  for (const p of list) assert.ok(existsSync(join(root, p)), `فایل گمشده: ${p}`);
});

test('هر ماژول JS در پوشه‌ی js در فهرست پیش‌کش هست', async () => {
  const { readdirSync } = await import('node:fs');
  const files = [...readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js')).map((f) => './js/' + f),
    ...readdirSync(join(root, 'js/views')).filter((f) => f.endsWith('.js')).map((f) => './js/views/' + f)];
  for (const f of files) assert.ok(sw.includes(`'${f}'`), `در ASSETS نیست: ${f}`);
});

test('VERSION در sw.js و settings.js با یک الگو قابل جایگزینی است (workflow به آن وابسته است)', () => {
  const re = /const VERSION = '[^']*';/;
  assert.match(sw, re);
  assert.match(readFileSync(join(root, 'js/views/settings.js'), 'utf8'), re);
});

test('مانیفست معتبر است و همه‌ی آیکن‌هایش وجود دارند', () => {
  const m = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
  assert.ok(m.start_url && m.scope && m.name);
  for (const i of [...m.icons, ...(m.screenshots || [])]) assert.ok(existsSync(join(root, i.src)), `گمشده: ${i.src}`);
});

test('دک‌های افزودنی: شناسه‌ها یکتا و فیلدها کامل است، و نصب دک تکراری کارت اضافه نمی‌کند', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.addEventListener = () => {};
  globalThis.document = { addEventListener() {}, visibilityState: 'visible' };
  const { PACKS } = await import('../js/packs.js');
  const ids = PACKS.flatMap((p) => p.cards.map((c) => c.id));
  assert.equal(new Set(ids).size, ids.length, 'شناسه‌ی تکراری');
  for (const p of PACKS) for (const c of p.cards) for (const k of ['front', 'example', 'rule', 'back']) assert.ok(c[k] && c[k].length > 3, `${c.id}.${k}`);
  const store = await import('../js/store.js');
  store.load();
  const before = store.cards().length;
  assert.ok(store.installedPacks().includes('core') && !store.installedPacks().includes('level2'));
  const k = store.installPack('level2');
  assert.equal(k, 20);
  assert.equal(store.cards().length, before + 20);
  assert.equal(store.installPack('level2'), 0);
  // داده‌ی قدیمی بدون فیلد packs: دک از روی شناسه‌ها حدس زده می‌شود
  const s = store.normalize({ cards: store.cards() });
  assert.deepEqual([...s.packs].sort(), ['core', 'level2']);
});

test('دک‌های ۳ و ۴: هرکدام ۲۰ کارت دارند و نصب می‌شوند', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.addEventListener = () => {};
  globalThis.document = { addEventListener() {}, visibilityState: 'visible' };
  const store = await import('../js/store.js');
  store.load();
  assert.equal(store.installPack('level3'), 20);
  assert.equal(store.installPack('level4'), 20);
  assert.ok(['level3', 'level4'].every((id) => store.installedPacks().includes(id)));
});
