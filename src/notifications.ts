import type { AppData, Bill } from './domain/types';
import { diffDays, fmtDate, today } from './domain/dates';
import { brl } from './domain/money';
import { act, getData } from './store/store';

export const notifSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!notifSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
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
  if (!data.settings.onboarded || !data.settings.notifications || !notifSupported() || Notification.permission !== 'granted') return 0;
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

export function startReminderLoop() {
  void checkReminders();
  setInterval(() => void checkReminders(), 30 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void checkReminders(); });
}
