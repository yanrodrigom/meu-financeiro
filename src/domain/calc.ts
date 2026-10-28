import type { AppData, Bill, BillSeries, ISODate, Month, Movement, MovementStatus } from './types';
import { addDays, addMonth, addMonthsKeepDay, dateInMonth, diffDays, monthOf, monthsBetween, today } from './dates';

export const isDone = (s: MovementStatus) => s === 'realizada' || s === 'paga';
export const isOpen = (s: MovementStatus) => s === 'prevista' || s === 'pendente';

/** Efeito de uma movimentação no saldo da CONTA (salário). VA e "outra" nunca afetam a conta. */
export function accountEffect(m: Movement): number {
  if (m.source !== 'conta' || !isDone(m.status)) return 0;
  switch (m.type) {
    case 'receita': return m.amount;
    case 'despesa': return -m.amount;
    case 'reserva_deposito': return -m.amount;
    case 'reserva_retirada': return m.amount;
    case 'ajuste': return m.amount;
  }
}

/** Saldo atual calculado da conta: saldo informado no início + movimentações realizadas a partir daquela data. */
export function accountBalance(data: AppData, upTo?: ISODate): number {
  const start = data.settings.initialBalanceDate;
  let total = data.settings.initialBalance;
  for (const m of data.movements) {
    if (m.date < start) continue;
    if (upTo && m.date > upTo) continue;
    total += accountEffect(m);
  }
  return total;
}

/** Próximo dia de recebimento do salário (>= hoje; se o salário de hoje já foi recebido, o do mês seguinte). */
export function nextPayday(data: AppData, ref: ISODate = today()): ISODate {
  const d = data.settings.payday || 5;
  const m = monthOf(ref);
  let cand = dateInMonth(m, d);
  if (cand < ref) cand = dateInMonth(addMonth(m, 1), d);
  if (cand === ref) {
    const sal = data.movements.find((x) => x.id === `mov-sal-${m}`);
    if (sal && isDone(sal.status)) cand = dateInMonth(addMonth(m, 1), d);
  }
  return cand;
}

export interface Commitment { id: string; name: string; amount: number; date: ISODate; kind: 'conta' | 'lancamento'; overdue: boolean }

/** Compromissos do dinheiro da conta (salário) ainda não pagos, com vencimento até `until` (inclui atrasados). */
export function commitmentsUntil(data: AppData, until: ISODate, ref: ISODate = today()): Commitment[] {
  const out: Commitment[] = [];
  for (const b of data.bills) {
    if (b.status !== 'pendente' || b.source !== 'salario' || b.dueDate > until) continue;
    out.push({ id: b.id, name: b.name, amount: b.amount, date: b.dueDate, kind: 'conta', overdue: b.dueDate < ref });
  }
  for (const m of data.movements) {
    if (m.source !== 'conta' || m.type !== 'despesa' || !isOpen(m.status) || m.date > until) continue;
    out.push({ id: m.id, name: m.description, amount: m.amount, date: m.date, kind: 'lancamento', overdue: m.date < ref });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function sum<T>(arr: T[], f: (x: T) => number): number {
  let s = 0;
  for (const x of arr) s += f(x);
  return s;
}

/** "Meu dinheiro hoje": saldo calculado menos compromissos pendentes até o próximo recebimento. */
export function availableToday(data: AppData, ref: ISODate = today()) {
  const balance = accountBalance(data);
  const payday = nextPayday(data, ref);
  const commitments = commitmentsUntil(data, payday, ref);
  const committed = sum(commitments, (c) => c.amount);
  const available = balance - committed;
  const days = Math.max(1, diffDays(ref, payday));
  return { balance, payday, commitments, committed, available, perDay: Math.max(0, Math.floor(available / days)), days };
}

const consumption = (m: Movement) => m.type === 'despesa';

export function monthSummary(data: AppData, month: Month) {
  const ms = data.movements.filter((m) => monthOf(m.date) === month);
  const notVa = ms.filter((m) => m.source !== 'va');
  const incomeDone = sum(notVa.filter((m) => m.type === 'receita' && isDone(m.status)), (m) => m.amount);
  const incomeOpen = sum(notVa.filter((m) => m.type === 'receita' && isOpen(m.status)), (m) => m.amount);
  const expenseDone = sum(notVa.filter((m) => consumption(m) && isDone(m.status)), (m) => m.amount);
  const expenseOpenMov = sum(notVa.filter((m) => consumption(m) && isOpen(m.status)), (m) => m.amount);
  const bills = data.bills.filter((b) => monthOf(b.dueDate) === month && b.source !== 'va');
  const billsPending = bills.filter((b) => b.status === 'pendente');
  const expenseOpenBills = sum(billsPending, (b) => b.amount);
  const reserveIn = sum(ms.filter((m) => m.type === 'reserva_deposito' && isDone(m.status)), (m) => m.amount);
  const reserveOut = sum(ms.filter((m) => m.type === 'reserva_retirada' && isDone(m.status)), (m) => m.amount);
  return {
    incomeDone, incomeOpen, incomePlanned: incomeDone + incomeOpen,
    expenseDone, expenseOpen: expenseOpenMov + expenseOpenBills, expensePlanned: expenseDone + expenseOpenMov + expenseOpenBills,
    billsPendingCount: billsPending.length, billsPendingTotal: expenseOpenBills,
    reserveIn, reserveOut,
    result: incomeDone - expenseDone,
  };
}

export function categoryBreakdown(data: AppData, month: Month, source: 'dinheiro' | 'va' = 'dinheiro') {
  const map = new Map<string, number>();
  for (const m of data.movements) {
    if (monthOf(m.date) !== month || m.type !== 'despesa' || !isDone(m.status)) continue;
    if (source === 'va' ? m.source !== 'va' : m.source === 'va') continue;
    map.set(m.category || 'Outros', (map.get(m.category || 'Outros') || 0) + m.amount);
  }
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

// ---------- Vale-alimentação ----------

export const itemEstTotal = (i: { qty: number; estPrice: number }) => Math.round(i.qty * i.estPrice);
export const itemRealTotal = (i: { qty: number; realPrice?: number; estPrice: number }) => Math.round(i.qty * (i.realPrice ?? i.estPrice));

export function vaSpentInMonth(data: AppData, month: Month): number {
  return sum(data.movements.filter((m) => m.source === 'va' && m.type === 'despesa' && isDone(m.status) && monthOf(m.date) === month), (m) => m.amount);
}

export function vaMonth(data: AppData, month: Month) {
  const s = data.settings;
  const credit = s.vaStartMonth && month >= s.vaStartMonth ? s.vaMonthly : 0;
  let carry = 0;
  if (s.vaCarryOver && s.vaStartMonth && month > s.vaStartMonth) {
    const n = Math.min(monthsBetween(s.vaStartMonth, month), 240);
    for (let i = 0; i < n; i++) {
      const m = addMonth(s.vaStartMonth, i);
      carry = Math.max(0, carry + s.vaMonthly - vaSpentInMonth(data, m));
    }
  }
  const available = credit + carry;
  const spent = vaSpentInMonth(data, month);
  const lists = data.lists.filter((l) => l.month === month);
  const items = lists.flatMap((l) => l.items);
  const estimatedTotal = sum(items, itemEstTotal);
  const pendingEstimate = sum(items.filter((i) => i.status === 'pendente'), itemEstTotal);
  const remaining = available - spent;
  const usedPct = available ? Math.round((spent / available) * 1000) / 10 : 0;
  const projected = spent + pendingEstimate;
  const alertLevel = available === 0 ? 'none' : projected > available ? 'over' : usedPct >= s.vaAlertPercent ? 'warn' : 'ok';
  return { credit, carry, available, spent, remaining, usedPct, estimatedTotal, pendingEstimate, projected, alertLevel } as const;
}

// ---------- Contas ----------

export function billBuckets(data: AppData, ref: ISODate = today(), horizonDays = 30) {
  const pend = data.bills.filter((b) => b.status === 'pendente').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const limit = addDays(ref, horizonDays);
  return {
    overdue: pend.filter((b) => b.dueDate < ref),
    today: pend.filter((b) => b.dueDate === ref),
    upcoming: pend.filter((b) => b.dueDate > ref && b.dueDate <= limit),
    later: pend.filter((b) => b.dueDate > limit),
  };
}

/** Quanto do salário do mês está comprometido por contas (pagas + pendentes) pagas com salário. */
export function salaryCommitment(data: AppData, month: Month) {
  const bills = data.bills.filter((b) => b.source === 'salario' && b.status !== 'cancelada' && monthOf(b.dueDate) === month);
  const committed = sum(bills, (b) => (b.status === 'paga' ? b.paidAmount ?? b.amount : b.amount));
  const salary = data.settings.salary;
  return { committed, salary, pct: salary ? Math.round((committed / salary) * 1000) / 10 : 0, leftover: salary - committed };
}

/** Datas de ocorrência de uma série (determinísticas a partir da data inicial). */
export function seriesDates(s: BillSeries, from: ISODate, until: ISODate, max = 500): ISODate[] {
  const out: ISODate[] = [];
  const startDay = Number(s.startDate.slice(8, 10));
  for (let k = 0; k < max; k++) {
    let d: ISODate;
    if (s.recurrence === 'mensal') d = addMonthsKeepDay(s.startDate, k, startDay);
    else if (s.recurrence === 'anual') d = addMonthsKeepDay(s.startDate, 12 * k, startDay);
    else d = addDays(s.startDate, (s.recurrence === 'semanal' ? 7 : 14) * k);
    if (d > until) break;
    if (s.endDate && d > s.endDate) break;
    if (d >= from && !s.skipped.includes(d)) out.push(d);
  }
  return out;
}

export const occurrenceId = (seriesId: string, date: ISODate) => `${seriesId}@${date}`;

// ---------- Reserva ----------

export function reserveStatus(data: AppData, ref: ISODate = today()) {
  const r = data.reserve;
  const moves = data.movements.filter((m) => (m.type === 'reserva_deposito' || m.type === 'reserva_retirada') && isDone(m.status));
  const deposits = sum(moves.filter((m) => m.type === 'reserva_deposito'), (m) => m.amount);
  const withdrawals = sum(moves.filter((m) => m.type === 'reserva_retirada'), (m) => m.amount);
  const accumulated = r.initialAmount + deposits - withdrawals;
  const byMonths = r.essentialMonthly * r.targetMonths;
  const target = r.customTarget && r.customTarget > 0 ? r.customTarget : byMonths;
  const missing = Math.max(0, target - accumulated);
  const pctDone = target ? Math.min(100, Math.round((accumulated / target) * 1000) / 10) : 0;
  let suggested = r.monthlyContribution;
  let monthsToDeadline: number | null = null;
  if (r.deadline && r.deadline > ref) {
    monthsToDeadline = Math.max(1, monthsBetween(monthOf(ref), monthOf(r.deadline)));
    suggested = Math.ceil(missing / monthsToDeadline);
  }
  const monthsEstimate = missing === 0 ? 0 : r.monthlyContribution > 0 ? Math.ceil(missing / r.monthlyContribution) : null;
  const references = [3, 6, 12].map((n) => ({ months: n, value: r.essentialMonthly * n, reached: accumulated >= r.essentialMonthly * n && r.essentialMonthly > 0 }));
  const coverMonths = r.essentialMonthly ? Math.floor((accumulated / r.essentialMonthly) * 10) / 10 : 0;
  return { accumulated, deposits, withdrawals, target, byMonths, missing, pct: pctDone, suggested, monthsToDeadline, monthsEstimate, references, coverMonths, history: moves.sort((a, b) => b.date.localeCompare(a.date)) };
}

/** Valor da reserva ao final de cada mês (para gráfico). */
export function reserveAt(data: AppData, upTo: ISODate): number {
  let v = data.reserve.initialAmount;
  for (const m of data.movements) {
    if (!isDone(m.status) || m.date > upTo) continue;
    if (m.type === 'reserva_deposito') v += m.amount;
    if (m.type === 'reserva_retirada') v -= m.amount;
  }
  return v;
}

// ---------- Planejamento (estimativas) ----------

export function planFor(data: AppData, month: Month) {
  const p = data.plans[month];
  return {
    extras: p?.extras ?? 0,
    variable: p?.variable ?? data.settings.defaultVariable,
    savingsGoal: p?.savingsGoal ?? data.settings.defaultSavingsGoal,
  };
}

/** Contas (do dinheiro da conta) previstas no mês, incluindo ocorrências futuras de séries ainda não geradas. */
export function billsInMonth(data: AppData, month: Month): Bill[] {
  const from = `${month}-01`;
  const until = dateInMonth(month, 31);
  const existing = data.bills.filter((b) => monthOf(b.dueDate) === month && b.status !== 'cancelada');
  const ids = new Set(data.bills.map((b) => b.id));
  const virtual: Bill[] = [];
  for (const s of data.series) {
    for (const d of seriesDates(s, from, until)) {
      const id = occurrenceId(s.id, d);
      if (ids.has(id)) continue;
      virtual.push({ id, name: s.name, amount: s.amount, dueDate: d, category: s.category, source: s.source, kind: s.kind, recurrence: s.recurrence, seriesId: s.id, status: 'pendente', createdAt: '', updatedAt: '' });
    }
  }
  return [...existing, ...virtual];
}

export function projection(data: AppData, month: Month) {
  const plan = planFor(data, month);
  const salMov = data.movements.find((m) => m.id === `mov-sal-${month}`);
  const salary = salMov ? salMov.amount : data.settings.salary;
  const bills = billsInMonth(data, month).filter((b) => b.source !== 'va');
  const billVal = (b: Bill) => (b.status === 'paga' ? b.paidAmount ?? b.amount : b.amount);
  const fixed = sum(bills.filter((b) => b.kind === 'fixa'), billVal);
  const installments = sum(bills.filter((b) => b.kind === 'parcela'), billVal);
  const purchases = sum(bills.filter((b) => b.kind === 'compra'), billVal);
  const eventual = sum(bills.filter((b) => b.kind === 'eventual'), billVal);
  const otherPlanned = sum(data.movements.filter((m) => monthOf(m.date) === month && m.source !== 'va' && m.type === 'despesa' && isOpen(m.status)), (m) => m.amount);
  const income = salary + plan.extras;
  const committed = fixed + installments + purchases + eventual + otherPlanned;
  const expenses = committed + plan.variable;
  const balance = income - expenses;
  const summary = monthSummary(data, month);
  return {
    month, salary, extras: plan.extras, fixed, installments, purchases, eventual, otherPlanned, variable: plan.variable, savingsGoal: plan.savingsGoal,
    income, committed, expenses, balance,
    committedPct: income ? Math.round((committed / income) * 1000) / 10 : 0,
    canSave: Math.max(0, balance),
    afterGoal: balance - plan.savingsGoal,
    realized: { income: summary.incomeDone, expenses: summary.expenseDone, reserve: summary.reserveIn - summary.reserveOut },
  };
}
