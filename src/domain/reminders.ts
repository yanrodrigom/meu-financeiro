import type { AppData, Bill } from './types';
import { addDays, fmtDate } from './dates';
import { brl } from './money';

/** Hora local em que o APK dispara o lembrete de uma conta. */
export const REMINDER_HOUR = 9;

export type ReminderKind = 'antes' | 'vence' | 'atrasou';

export interface PlannedReminder {
  id: number;
  billId: string;
  kind: ReminderKind;
  title: string;
  body: string;
  at: Date;
}

const TITLE = 'Meu Financeiro · lembrete de conta';
const MAX_SCHEDULED = 50;

/** Id positivo de 32 bits, estável para a mesma conta e o mesmo tipo de aviso. */
export function reminderId(billId: string, kind: string): number {
  let h = 2166136261;
  const s = `${billId}|${kind}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 2147483646) + 1;
}

function atLocalHour(iso: string, hour: number): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

function bodyFor(bill: Bill, kind: ReminderKind, daysBefore: number): string {
  const money = brl(bill.amount);
  const when = fmtDate(bill.dueDate);
  switch (kind) {
    case 'antes':
      return `${bill.name}: ${money} — vence em ${daysBefore} dia(s) (${when})`;
    case 'vence':
      return `${bill.name}: ${money} — vence hoje`;
    case 'atrasou':
      return `${bill.name}: ${money} — venceu em ${when}`;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

/**
 * Alarmes futuros (9h) para contas pendentes: N dias antes, no dia e no dia seguinte.
 * Só entra o que ainda não passou e cabe no horizonte — o app reabre e reagenda.
 */
export function planNativeReminders(data: AppData, now: Date, horizonDays = 45): PlannedReminder[] {
  if (!data.settings.onboarded || !data.settings.notifications) return [];
  const daysBefore = data.settings.notifyDaysBefore;
  const horizonMs = horizonDays * 86400000;
  const latest = now.getTime() + horizonMs;
  const out: PlannedReminder[] = [];
  const used = new Set<number>();

  const push = (bill: Bill, kind: ReminderKind, at: Date) => {
    const t = at.getTime();
    if (t <= now.getTime() || t > latest) return;
    let id = reminderId(bill.id, kind);
    while (used.has(id)) id = id === 2147483647 ? 1 : id + 1;
    used.add(id);
    out.push({ id, billId: bill.id, kind, title: TITLE, body: bodyFor(bill, kind, daysBefore), at });
  };

  for (const bill of data.bills) {
    if (bill.status !== 'pendente') continue;
    if (daysBefore > 0) push(bill, 'antes', atLocalHour(addDays(bill.dueDate, -daysBefore), REMINDER_HOUR));
    push(bill, 'vence', atLocalHour(bill.dueDate, REMINDER_HOUR));
    push(bill, 'atrasou', atLocalHour(addDays(bill.dueDate, 1), REMINDER_HOUR));
  }

  out.sort((a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id);
  return out.slice(0, MAX_SCHEDULED);
}
