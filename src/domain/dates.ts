import type { ISODate, Month } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function isValidISO(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = fromISO(s);
  return toISO(d) === s && d.getFullYear() >= 1990 && d.getFullYear() <= 2200;
}

let clock: () => Date = () => new Date();
export function setClock(fn: () => Date) { clock = fn; }
export function today(): ISODate { return toISO(clock()); }

export function monthOf(d: ISODate): Month { return d.slice(0, 7); }
export function currentMonth(): Month { return monthOf(today()); }

export function daysInMonth(y: number, m1: number): number {
  return new Date(y, m1, 0).getDate();
}

/** Data com dia limitado ao tamanho do mês (ex.: dia 31 em fevereiro => 28/29). */
export function dateInMonth(month: Month, day: number): ISODate {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${pad(Math.min(Math.max(1, day), daysInMonth(y, m)))}`;
}

export function addDays(d: ISODate, n: number): ISODate {
  const x = fromISO(d);
  x.setDate(x.getDate() + n);
  return toISO(x);
}

export function addMonthsKeepDay(d: ISODate, n: number, day?: number): ISODate {
  const [y, m, dd] = d.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return dateInMonth(`${ny}-${pad(nm)}`, day ?? dd);
}

export function addMonth(month: Month, n: number): Month {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);
}

export function monthsBetween(a: Month, b: Month): number {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

export function fmtDate(d: ISODate | undefined): string {
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

export function fmtShort(d: ISODate): string {
  const [, m, dd] = d.split('-');
  return `${dd}/${m}`;
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function monthLabel(month: Month, short = false): string {
  const [y, m] = month.split('-').map(Number);
  return short ? `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}` : `${MONTHS[m - 1]} de ${y}`;
}

export function weekdayLabel(d: ISODate): string {
  return fromISO(d).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
}

export function relativeDay(d: ISODate, ref: ISODate = today(), compact = false): string {
  const n = diffDays(ref, d);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  if (n > 1) return compact ? `${n} dias` : `em ${n} dias`;
  return compact ? `${-n}d atrás` : `há ${-n} dias`;
}
