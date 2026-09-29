// platform.js — ویژگی‌های PWA: نصب، تمام‌صفحه، سرویس‌ورکر، نشان (badge)، تم و تنظیمات ظاهری.
import * as store from './store.js';
import { setDigits, toast } from './util.js';

export const events = new EventTarget();
const fire = (name, detail) => events.dispatchEvent(new CustomEvent(name, { detail }));

export const navigate = (path) => { location.hash = '#/' + path.replace(/^\/+/, ''); };

// ── ظاهر ────────────────────────────────────────────────────────────────────
const mqLight = matchMedia('(prefers-color-scheme: light)');
export function applyAppearance() {
  const s = store.settings();
  const theme = s.theme === 'auto' ? (mqLight.matches ? 'light' : 'dark') : s.theme;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.accent = s.accent;
  root.dataset.motion = s.motion;
  root.style.setProperty('--fs', s.fontScale);
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = theme === 'light' ? '#f4f5f8' : '#0d0e11';
  setDigits(s.persianDigits);
}
mqLight.addEventListener('change', () => { if (store.settings().theme === 'auto') applyAppearance(); });

// ── نصب ─────────────────────────────────────────────────────────────────────
let deferredPrompt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; fire('install-available'); });
addEventListener('appinstalled', () => { deferredPrompt = null; fire('installed'); toast('برنامه نصب شد ✓'); });

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches ||
  matchMedia('(display-mode: minimal-ui)').matches || navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const canPromptInstall = () => !!deferredPrompt;
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  fire('install-available');
  return outcome;
}

// ── تمام‌صفحه ───────────────────────────────────────────────────────────────
export const fsSupported = () => !!(document.fullscreenEnabled && document.documentElement.requestFullscreen);
export const isFullscreen = () => !!document.fullscreenElement;
export async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch { toast('مرورگر اجازه‌ی تمام‌صفحه نداد.'); }
}
document.addEventListener('fullscreenchange', () => fire('fullscreen', isFullscreen()));

// ── نشان روی آیکن برنامه ────────────────────────────────────────────────────
export function updateBadge(count) {
  try {
    if (!('setAppBadge' in navigator)) return;
    if (count > 0) navigator.setAppBadge(count); else navigator.clearAppBadge();
  } catch { /* ignore */ }
}

// ── سرویس‌ورکر ──────────────────────────────────────────────────────────────
let reg = null;
let updating = false;
export async function initSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    reg = await navigator.serviceWorker.register('sw.js');
    const notify = (w) => w && w.state === 'installed' && navigator.serviceWorker.controller && fire('update-ready', w);
    if (reg.waiting) notify(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => notify(w));
    });
    // فقط وقتی کاربر خودش «به‌روزرسانی» را زده صفحه دوباره بارگذاری می‌شود؛
    // در اولین نصب (clients.claim) نباید وسط کار صفحه ناگهان رفرش شود.
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating) location.reload(); });
    fire('sw-ready');
  } catch (e) { fire('sw-error', e); }
}
export function applyUpdate() {
  updating = true;
  if (reg && reg.waiting) reg.waiting.postMessage('SKIP_WAITING'); else location.reload();
}
export async function checkForUpdate() {
  if (!reg) return 'unsupported';
  try {
    await reg.update();
    return reg.waiting || reg.installing ? 'available' : 'latest';
  } catch { return 'offline'; }
}
export const swActive = () => !!(navigator.serviceWorker && navigator.serviceWorker.controller);

export async function persistStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch { /* ignore */ }
  return false;
}
export async function storageInfo() {
  try {
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : {};
    return { persisted, usage: est.usage || 0, quota: est.quota || 0 };
  } catch { return { persisted: false, usage: 0, quota: 0 }; }
}

export function haptic(ms = 12) {
  if (store.settings().haptics && navigator.vibrate) { try { navigator.vibrate(ms); } catch { /* ignore */ } }
}
