import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { AppData, Bill } from './domain/types';
import { diffDays, fmtDate, today } from './domain/dates';
import { brl } from './domain/money';
import { planNativeReminders, reminderId } from './domain/reminders';
import { act, getData, subscribe } from './store/store';

const CHANNEL_ID = 'contas';

export const notifSupported = () => Capacitor.isNativePlatform() || (typeof window !== 'undefined' && 'Notification' in window);

function nativePermission(display: string): NotificationPermission | 'unsupported' {
  if (display === 'granted') return 'granted';
  if (display === 'denied') return 'denied';
  return 'default';
}

export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (Capacitor.isNativePlatform()) {
    const res = await LocalNotifications.requestPermissions();
    return nativePermission(res.display);
  }
  if (!notifSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

export async function currentNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (Capacitor.isNativePlatform()) {
    const res = await LocalNotifications.checkPermissions();
    return nativePermission(res.display);
  }
  if (!notifSupported()) return 'unsupported';
  return Notification.permission;
}

/** Contas que merecem lembrete hoje: vencendo hoje, atrasadas, ou exatamente N dias antes. */
export function dueReminders(data: AppData, ref = today()): { bill: Bill; key: string; text: string }[] {
  const n = data.settings.notifyDaysBefore;
  const out: { bill: Bill; key: string; text: string }[] = [];
  for (const b of data.bills) {
    if (b.status !== 'pendente') continue;
    const days = diffDays(ref, b.dueDate);
    if (days === 0 || (n > 0 && days === n) || days === -1) {
      const when = days === 0 ? 'vence hoje' : days > 0 ? `vence em ${days} dia(s) (${fmtDate(b.dueDate)})` : `venceu em ${fmtDate(b.dueDate)}`;
      out.push({ bill: b, key: `${b.id}|${ref}`, text: `${b.name}: ${brl(b.amount)} — ${when}` });
    }
  }
  return out;
}

/** Verifica lembretes (ao abrir e periodicamente com o app aberto). Cada conta notifica no máximo 1x por dia. */
export async function checkReminders() {
  const data = getData();
  if (!data.settings.onboarded || !data.settings.notifications) return 0;
  if (Capacitor.isNativePlatform()) {
    holdNativeSyncUntil = Date.now() + 8000;
    if (nativeSyncTimer) clearTimeout(nativeSyncTimer);
    return notifyNativeNow(data);
  }
  if (!notifSupported() || Notification.permission !== 'granted') return 0;
  const pending = dueReminders(data).filter((r) => !data.notified.includes(r.key));
  if (!pending.length) return 0;
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => undefined);
  for (const r of pending.slice(0, 5)) {
    const title = 'Meu Financeiro · lembrete de conta';
    const opts: NotificationOptions = { body: r.text, tag: r.key, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
    try {
      if (reg) await reg.showNotification(title, opts);
      else new Notification(title, opts);
    } catch (e) { console.warn('Notificação falhou', e); }
  }
  const t = today();
  act((d) => ({ ...d, notified: [...d.notified.filter((k) => k.endsWith(t)), ...pending.map((p) => p.key)] }));
  return pending.length;
}

let channelReady = false;
async function ensureChannel() {
  if (channelReady) return;
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Lembretes de contas',
    description: 'Avisos de vencimento, mesmo com o app fechado',
    importance: 4,
    visibility: 1,
    vibration: true,
  });
  channelReady = true;
}

/** Substitui os alarmes pendentes pelos vencimentos futuros (9h). Retorna quantos ficaram agendados. */
export async function syncNativeReminders(): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;
  const data = getData();
  try {
    const perm = await LocalNotifications.checkPermissions();
    const planned = data.settings.onboarded && data.settings.notifications && perm.display === 'granted'
      ? planNativeReminders(data, new Date())
      : [];
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    if (!planned.length) return 0;
    await ensureChannel();
    await LocalNotifications.schedule({
      notifications: planned.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        channelId: CHANNEL_ID,
        isExactNotification: false,
        schedule: { at: p.at, allowWhileIdle: true },
      })),
    });
    return planned.length;
  } catch (e) {
    console.warn('Falha ao agendar lembretes', e);
    return 0;
  }
}

async function notifyNativeNow(data: AppData): Promise<number> {
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') return 0;
  const pending = dueReminders(data).filter((r) => !data.notified.includes(r.key));
  if (!pending.length) return 0;
  try {
    await ensureChannel();
    const at = new Date(Date.now() + 1000);
    await LocalNotifications.schedule({
      notifications: pending.slice(0, 5).map((r) => ({
        id: reminderId(r.bill.id, `agora-${r.key}`),
        title: 'Meu Financeiro · lembrete de conta',
        body: r.text,
        channelId: CHANNEL_ID,
        isExactNotification: false,
        schedule: { at, allowWhileIdle: true },
      })),
    });
  } catch (e) {
    console.warn('Notificação falhou', e);
    return 0;
  }
  const t = today();
  act((d) => ({ ...d, notified: [...d.notified.filter((k) => k.endsWith(t)), ...pending.map((p) => p.key)] }));
  return pending.length;
}

let nativeSyncTimer: ReturnType<typeof setTimeout> | undefined;
let holdNativeSyncUntil = 0;

function scheduleNativeSync() {
  if (!Capacitor.isNativePlatform()) return;
  const wait = Date.now() < holdNativeSyncUntil ? holdNativeSyncUntil - Date.now() + 50 : 400;
  if (nativeSyncTimer) clearTimeout(nativeSyncTimer);
  nativeSyncTimer = setTimeout(() => { void syncNativeReminders(); }, wait);
}

export function startReminderLoop() {
  if (Capacitor.isNativePlatform()) {
    void syncNativeReminders();
    subscribe(() => scheduleNativeSync());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') scheduleNativeSync();
    });
    return;
  }
  void checkReminders();
  setInterval(() => void checkReminders(), 30 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void checkReminders(); });
}
