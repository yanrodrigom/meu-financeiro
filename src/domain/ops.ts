// Operações puras sobre AppData: recebem os dados e retornam uma NOVA versão.
import type { AppData, Bill, BillSeries, ISODate, Month, MonthPlan, Movement, ReserveConfig, Settings, ShoppingItem, ShoppingList } from './types';
import { addDays, addMonth, addMonthsKeepDay, currentMonth, dateInMonth, isValidISO, monthOf, today } from './dates';
import { isDone, itemRealTotal, occurrenceId, seriesDates } from './calc';
import { nowStamp, uid } from './ids';

export class ValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super(Object.values(errors)[0] || 'Dados inválidos');
  }
}

export function defaultSettings(): Settings {
  return {
    onboarded: false, demo: false, salary: 0, payday: 5, vaMonthly: 0, vaDay: 1, vaCarryOver: true,
    vaStartMonth: currentMonth(), initialBalance: 0, initialBalanceDate: today(), theme: 'light', privacy: false,
    notifications: false, notifyDaysBefore: 2, salaryAuto: true, skippedSalary: [], vaAlertPercent: 80,
    defaultVariable: 0, defaultSavingsGoal: 0,
  };
}

export function emptyData(): AppData {
  return {
    schemaVersion: 1, settings: defaultSettings(), movements: [], bills: [], series: [], lists: [], frequentItems: [],
    reserve: { initialAmount: 0, targetMonths: 6, essentialMonthly: 0, monthlyContribution: 0 }, plans: {}, notified: [],
  };
}

const req = (errors: Record<string, string>, cond: boolean, key: string, msg: string) => { if (!cond) errors[key] = msg; };
const positive = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0;
const nonNeg = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

// ---------------- Onboarding ----------------

export interface OnboardingInput {
  name?: string;
  salary: number; payday: number; vaMonthly: number; vaDay: number; initialBalance: number;
  fixed: { name: string; amount: number; day: number; category: string }[];
  reserveInitial: number; reserveMonths: number; essentialMonthly: number; monthlyContribution: number;
}

export function completeOnboarding(data: AppData, input: OnboardingInput, ref: ISODate = today()): AppData {
  const e: Record<string, string> = {};
  req(e, nonNeg(input.salary), 'salary', 'Informe o salário líquido (pode ser 0).');
  req(e, Number.isInteger(input.payday) && input.payday >= 1 && input.payday <= 31, 'payday', 'Dia de recebimento entre 1 e 31.');
  req(e, nonNeg(input.vaMonthly), 'vaMonthly', 'Valor do VA não pode ser negativo.');
  req(e, Number.isFinite(input.initialBalance), 'initialBalance', 'Saldo inválido.');
  req(e, nonNeg(input.reserveInitial), 'reserveInitial', 'Valor da reserva não pode ser negativo.');
  if (Object.keys(e).length) throw new ValidationError(e);
  let d: AppData = {
    ...data,
    settings: { ...data.settings, onboarded: true, name: input.name?.trim() || undefined, salary: input.salary, payday: input.payday, vaMonthly: input.vaMonthly, vaDay: input.vaDay || 1, vaStartMonth: monthOf(ref), initialBalance: input.initialBalance, initialBalanceDate: ref },
    reserve: { ...data.reserve, initialAmount: input.reserveInitial, targetMonths: input.reserveMonths || 6, essentialMonthly: input.essentialMonthly, monthlyContribution: input.monthlyContribution },
  };
  for (const f of input.fixed) {
    if (!f.name.trim() || !positive(f.amount)) continue;
    let start = dateInMonth(monthOf(ref), f.day || 10);
    if (start < ref) start = addMonthsKeepDay(start, 1, f.day || 10);
    d = addSeries(d, { name: f.name.trim(), amount: f.amount, category: f.category || 'Outros', source: 'salario', kind: 'fixa', recurrence: 'mensal', startDate: start }, ref);
  }
  return runMaintenance(d, ref);
}

// ---------------- Movimentações ----------------

export type MovementInput = Omit<Movement, 'id' | 'createdAt' | 'updatedAt' | 'originType'> & { id?: string; originType?: Movement['originType'] };

export function validateMovement(m: Partial<Movement>): Record<string, string> {
  const e: Record<string, string> = {};
  req(e, !!m.description && m.description.trim().length > 0, 'description', 'Informe uma descrição.');
  if (m.type === 'ajuste') req(e, typeof m.amount === 'number' && Number.isFinite(m.amount) && m.amount !== 0, 'amount', 'Informe um valor.');
  else req(e, positive(m.amount), 'amount', 'O valor precisa ser maior que zero.');
  req(e, isValidISO(m.date), 'date', 'Data inválida.');
  req(e, !!m.type, 'type', 'Tipo obrigatório.');
  if (m.type === 'receita' && m.source === 'va') e.source = 'Receitas não entram no VA: o crédito do VA é configurado no Perfil.';
  return e;
}

export function addMovement(data: AppData, input: MovementInput): AppData {
  const e = validateMovement(input);
  if (Object.keys(e).length) throw new ValidationError(e);
  const stamp = nowStamp();
  const m: Movement = { ...input, description: input.description.trim(), id: input.id || uid('mov'), originType: input.originType || 'manual', createdAt: stamp, updatedAt: stamp };
  if (data.movements.some((x) => x.id === m.id)) return updateMovement(data, m.id, m);
  return { ...data, movements: [...data.movements, m] };
}

export function updateMovement(data: AppData, id: string, patch: Partial<Movement>): AppData {
  const cur = data.movements.find((m) => m.id === id);
  if (!cur) throw new Error('Lançamento não encontrado');
  if (cur.originType === 'compras' && (patch.amount !== undefined && patch.amount !== cur.amount)) {
    throw new ValidationError({ amount: 'Este valor vem da lista de compras. Edite os itens em Compras.' });
  }
  const next: Movement = { ...cur, ...patch, id: cur.id, originType: cur.originType, originId: cur.originId, createdAt: cur.createdAt, updatedAt: nowStamp() };
  const e = validateMovement(next);
  if (Object.keys(e).length) throw new ValidationError(e);
  let d: AppData = { ...data, movements: data.movements.map((m) => (m.id === id ? next : m)) };
  if (cur.originType === 'conta' && cur.originId) {
    d = { ...d, bills: d.bills.map((b) => (b.id === cur.originId ? { ...b, paidAmount: next.amount, paidDate: next.date, status: isDone(next.status) ? 'paga' : 'pendente', updatedAt: nowStamp() } : b)) };
    if (!isDone(next.status)) d = { ...d, movements: d.movements.filter((m) => m.id !== id), bills: d.bills.map((b) => (b.id === cur.originId ? { ...b, movementId: undefined, paidAmount: undefined, paidDate: undefined } : b)) };
  }
  return d;
}

export function deleteMovement(data: AppData, id: string): AppData {
  const cur = data.movements.find((m) => m.id === id);
  if (!cur) return data;
  if (cur.originType === 'compras') throw new ValidationError({ id: 'Este lançamento é gerado pela lista de compras. Desmarque ou exclua os itens em Compras.' });
  let d: AppData = { ...data, movements: data.movements.filter((m) => m.id !== id) };
  if (cur.originType === 'conta' && cur.originId) {
    d = { ...d, bills: d.bills.map((b) => (b.id === cur.originId ? { ...b, status: 'pendente', movementId: undefined, paidAmount: undefined, paidDate: undefined, updatedAt: nowStamp() } : b)) };
  }
  if (cur.originType === 'salario') {
    const month = cur.id.replace('mov-sal-', '');
    d = { ...d, settings: { ...d.settings, skippedSalary: [...new Set([...d.settings.skippedSalary, month])] } };
  }
  return d;
}

/** Marca uma receita como recebida / despesa como paga, atualizando o MESMO registro. */
export function markMovementDone(data: AppData, id: string, amount?: number, date?: ISODate): AppData {
  const cur = data.movements.find((m) => m.id === id);
  if (!cur) return data;
  const status = cur.type === 'receita' ? 'realizada' : 'paga';
  return updateMovement(data, id, { status, ...(amount !== undefined ? { amount } : {}), ...(date ? { date } : {}) });
}

// ---------------- Contas e lembretes ----------------

export type BillInput = Pick<Bill, 'name' | 'amount' | 'dueDate' | 'category' | 'source' | 'kind' | 'recurrence'> & { notes?: string };

export function validateBill(b: Partial<Bill>): Record<string, string> {
  const e: Record<string, string> = {};
  req(e, !!b.name && b.name.trim().length > 0, 'name', 'Informe o nome da conta.');
  req(e, positive(b.amount), 'amount', 'O valor precisa ser maior que zero.');
  req(e, isValidISO(b.dueDate), 'dueDate', 'Data inválida.');
  return e;
}

/** Cria conta. Se tiver recorrência, cria uma série e gera as ocorrências (sem duplicar). */
export function addBill(data: AppData, input: BillInput, ref: ISODate = today()): AppData {
  const e = validateBill(input);
  if (Object.keys(e).length) throw new ValidationError(e);
  if (input.recurrence !== 'nenhuma') {
    return addSeries(data, { name: input.name.trim(), amount: input.amount, category: input.category, source: input.source, kind: input.kind, recurrence: input.recurrence, startDate: input.dueDate, notes: input.notes }, ref);
  }
  const stamp = nowStamp();
  const b: Bill = { ...input, name: input.name.trim(), id: uid('bill'), status: 'pendente', createdAt: stamp, updatedAt: stamp };
  return { ...data, bills: [...data.bills, b] };
}

export function addSeries(data: AppData, s: Omit<BillSeries, 'id' | 'skipped'> & { id?: string }, ref: ISODate = today()): AppData {
  const series: BillSeries = { ...s, id: s.id || uid('ser'), skipped: [] };
  return ensureRecurrences({ ...data, series: [...data.series, series] }, ref);
}

/** Gera ocorrências das séries até ~45 dias à frente (mínimo: a próxima futura). Ids determinísticos evitam duplicação. */
export function ensureRecurrences(data: AppData, ref: ISODate = today()): AppData {
  const existing = new Set(data.bills.map((b) => b.id));
  const created: Bill[] = [];
  const stamp = nowStamp();
  for (const s of data.series) {
    const horizon = addDays(ref, 45);
    let dates = seriesDates(s, s.startDate, horizon);
    if (!dates.some((d) => d > ref)) {
      const more = seriesDates(s, s.startDate, addDays(ref, 400));
      const next = more.find((d) => d > ref);
      if (next) dates = [...dates, next];
    }
    for (const d of dates) {
      const id = occurrenceId(s.id, d);
      if (existing.has(id)) continue;
      existing.add(id);
      created.push({ id, name: s.name, amount: s.amount, dueDate: d, category: s.category, source: s.source, kind: s.kind, recurrence: s.recurrence, seriesId: s.id, notes: s.notes, status: 'pendente', createdAt: stamp, updatedAt: stamp });
    }
  }
  return created.length ? { ...data, bills: [...data.bills, ...created] } : data;
}

export function updateBill(data: AppData, id: string, patch: Partial<BillInput>, applyToSeries = false, ref: ISODate = today()): AppData {
  const cur = data.bills.find((b) => b.id === id);
  if (!cur) throw new Error('Conta não encontrada');
  const next: Bill = { ...cur, ...patch, recurrence: cur.recurrence, id: cur.id, updatedAt: nowStamp() };
  if (patch.name) next.name = patch.name.trim();
  const e = validateBill(next);
  if (Object.keys(e).length) throw new ValidationError(e);
  let d: AppData = { ...data, bills: data.bills.map((b) => (b.id === id ? next : b)) };
  if (cur.status === 'paga' && cur.movementId) {
    d = { ...d, movements: d.movements.map((m) => (m.id === cur.movementId ? { ...m, description: next.name, category: next.category, source: billSourceToMoney(next.source), updatedAt: nowStamp() } : m)) };
  }
  if (applyToSeries && cur.seriesId) {
    const { name, amount, category, source, kind, notes } = next;
    d = {
      ...d,
      series: d.series.map((s) => (s.id === cur.seriesId ? { ...s, name, amount, category, source, kind, notes } : s)),
      bills: d.bills.map((b) => (b.seriesId === cur.seriesId && b.status === 'pendente' && b.dueDate >= cur.dueDate ? { ...b, name, amount, category, source, kind, notes, updatedAt: nowStamp() } : b)),
    };
  }
  return ensureRecurrences(d, ref);
}

export const billSourceToMoney = (s: Bill['source']) => (s === 'salario' ? 'conta' : s === 'va' ? 'va' : 'outra') as Movement['source'];

/** Marca conta como paga. Cria exatamente UMA movimentação vinculada (id determinístico). Idempotente. */
export function payBill(data: AppData, id: string, opts: { amount?: number; date?: ISODate; paymentMethod?: string } = {}, ref: ISODate = today()): AppData {
  const b = data.bills.find((x) => x.id === id);
  if (!b) throw new Error('Conta não encontrada');
  if (b.status === 'cancelada') throw new ValidationError({ status: 'Conta cancelada não pode ser paga.' });
  const amount = opts.amount ?? b.paidAmount ?? b.amount;
  const date = opts.date ?? b.paidDate ?? ref;
  const e: Record<string, string> = {};
  req(e, positive(amount), 'amount', 'O valor pago precisa ser maior que zero.');
  req(e, isValidISO(date), 'date', 'Data inválida.');
  if (Object.keys(e).length) throw new ValidationError(e);
  const movId = `mov-bill-${b.id}`;
  const stamp = nowStamp();
  const existing = data.movements.find((m) => m.id === movId);
  const mov: Movement = {
    id: movId, description: b.name, type: 'despesa', amount, date, category: b.category, source: billSourceToMoney(b.source), status: 'paga',
    paymentMethod: opts.paymentMethod ?? existing?.paymentMethod, recurrence: b.seriesId ? 'fixa' : 'variavel', notes: b.notes, originType: 'conta', originId: b.id,
    createdAt: existing?.createdAt ?? stamp, updatedAt: stamp,
  };
  const movements = existing ? data.movements.map((m) => (m.id === movId ? mov : m)) : [...data.movements, mov];
  const bills = data.bills.map((x) => (x.id === id ? { ...x, status: 'paga' as const, paidAmount: amount, paidDate: date, movementId: movId, updatedAt: stamp } : x));
  return ensureRecurrences({ ...data, movements, bills }, ref);
}

export function unpayBill(data: AppData, id: string): AppData {
  const b = data.bills.find((x) => x.id === id);
  if (!b) return data;
  return {
    ...data,
    movements: data.movements.filter((m) => !(m.originType === 'conta' && m.originId === id)),
    bills: data.bills.map((x) => (x.id === id ? { ...x, status: 'pendente', paidAmount: undefined, paidDate: undefined, movementId: undefined, updatedAt: nowStamp() } : x)),
  };
}

export function cancelBill(data: AppData, id: string): AppData {
  const d = unpayBill(data, id);
  return { ...d, bills: d.bills.map((x) => (x.id === id ? { ...x, status: 'cancelada', updatedAt: nowStamp() } : x)) };
}

export function reactivateBill(data: AppData, id: string): AppData {
  return { ...data, bills: data.bills.map((x) => (x.id === id && x.status === 'cancelada' ? { ...x, status: 'pendente', updatedAt: nowStamp() } : x)) };
}

/** Exclui a conta (e o lançamento vinculado). Em séries, a data é registrada como "pulada" para não ser recriada. */
export function deleteBill(data: AppData, id: string): AppData {
  const b = data.bills.find((x) => x.id === id);
  if (!b) return data;
  let d = unpayBill(data, id);
  d = { ...d, bills: d.bills.filter((x) => x.id !== id) };
  if (b.seriesId) {
    const key = id.split('@')[1];
    d = { ...d, series: d.series.map((s) => (s.id === b.seriesId ? { ...s, skipped: [...new Set([...s.skipped, key])] } : s)) };
  }
  return d;
}

/** Encerra uma recorrência a partir da conta informada (inclusive): remove ocorrências pendentes futuras. */
export function endSeries(data: AppData, seriesId: string, lastDate: ISODate): AppData {
  return {
    ...data,
    series: data.series.map((s) => (s.id === seriesId ? { ...s, endDate: lastDate } : s)),
    bills: data.bills.filter((b) => !(b.seriesId === seriesId && b.status === 'pendente' && b.dueDate > lastDate)),
  };
}

export interface InstallmentInput { name: string; count: number; amount: number; firstDate: ISODate; periodicity: 'mensal' | 'quinzenal' | 'semanal'; category: string; source: Bill['source']; notes?: string }

/** Gera N contas do tipo parcela (ids determinísticos por grupo). */
export function addInstallments(data: AppData, input: InstallmentInput): AppData {
  const e: Record<string, string> = {};
  req(e, !!input.name.trim(), 'name', 'Informe a descrição.');
  req(e, Number.isInteger(input.count) && input.count >= 1 && input.count <= 120, 'count', 'Quantidade entre 1 e 120.');
  req(e, positive(input.amount), 'amount', 'Valor da parcela precisa ser maior que zero.');
  req(e, isValidISO(input.firstDate), 'firstDate', 'Data inválida.');
  if (Object.keys(e).length) throw new ValidationError(e);
  const groupId = uid('parc');
  const stamp = nowStamp();
  const day = Number(input.firstDate.slice(8, 10));
  const bills: Bill[] = [];
  for (let i = 0; i < input.count; i++) {
    const dueDate = input.periodicity === 'mensal' ? addMonthsKeepDay(input.firstDate, i, day) : addDays(input.firstDate, (input.periodicity === 'semanal' ? 7 : 14) * i);
    bills.push({ id: `${groupId}#${i + 1}`, name: `${input.name.trim()} (${i + 1}/${input.count})`, amount: input.amount, dueDate, category: input.category || 'Parcelas', source: input.source, kind: 'parcela', recurrence: 'nenhuma', installment: { groupId, n: i + 1, total: input.count }, notes: input.notes, status: 'pendente', createdAt: stamp, updatedAt: stamp });
  }
  return { ...data, bills: [...data.bills, ...bills] };
}

export function deleteInstallmentGroup(data: AppData, groupId: string, onlyPending = true): AppData {
  const target = data.bills.filter((b) => b.installment?.groupId === groupId && (!onlyPending || b.status === 'pendente'));
  let d = data;
  for (const b of target) d = deleteBill(d, b.id);
  return d;
}

// ---------------- Salário automático ----------------

/** Garante o salário previsto do mês atual e do próximo (id determinístico por mês). */
export function ensureSalary(data: AppData, ref: ISODate = today()): AppData {
  const s = data.settings;
  if (!s.onboarded || !s.salaryAuto || s.salary <= 0) return data;
  let d = data;
  const m0 = monthOf(ref);
  for (const m of [m0, addMonth(m0, 1)]) {
    const id = `mov-sal-${m}`;
    if (m < monthOf(s.initialBalanceDate) || s.skippedSalary.includes(m) || d.movements.some((x) => x.id === id)) continue;
    const date = dateInMonth(m, s.payday);
    if (date < s.initialBalanceDate) continue; // já incluído no saldo informado
    const stamp = nowStamp();
    d = { ...d, movements: [...d.movements, { id, description: 'Salário líquido', type: 'receita', amount: s.salary, date, category: 'Salário líquido', source: 'conta', status: 'prevista', recurrence: 'fixa', originType: 'salario', createdAt: stamp, updatedAt: stamp }] };
  }
  return d;
}

export function runMaintenance(data: AppData, ref: ISODate = today()): AppData {
  return ensureSalary(ensureRecurrences(data, ref), ref);
}

// ---------------- Compras (VA) ----------------

/** Mantém UM lançamento de VA por lista, igual à soma dos itens comprados. Nunca soma em dobro. */
export function syncListMovement(data: AppData, listId: string): AppData {
  const list = data.lists.find((l) => l.id === listId);
  const movId = `mov-list-${listId}`;
  const existing = data.movements.find((m) => m.id === movId);
  if (!list) return { ...data, movements: data.movements.filter((m) => m.id !== movId) };
  const bought = list.items.filter((i) => i.status === 'comprado');
  const total = bought.reduce((s, i) => s + itemRealTotal(i), 0);
  if (total <= 0) return existing ? { ...data, movements: data.movements.filter((m) => m.id !== movId) } : data;
  const lastDate = bought.map((i) => i.boughtAt || '').sort().pop() || dateInMonth(list.month, 1);
  const stamp = nowStamp();
  const mov: Movement = {
    id: movId, description: `Compras: ${list.name}`, type: 'despesa', amount: total, date: lastDate, category: 'Supermercado', source: 'va', status: 'paga',
    paymentMethod: 'VA', recurrence: 'variavel', originType: 'compras', originId: listId, createdAt: existing?.createdAt ?? stamp, updatedAt: stamp,
  };
  return { ...data, movements: existing ? data.movements.map((m) => (m.id === movId ? mov : m)) : [...data.movements, mov] };
}

export function addList(data: AppData, month: Month, name?: string): AppData {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new ValidationError({ month: 'Mês inválido.' });
  const l: ShoppingList = { id: uid('lista'), month, name: name?.trim() || 'Compras do mês', items: [], createdAt: nowStamp() };
  return { ...data, lists: [...data.lists, l] };
}

export function renameList(data: AppData, id: string, name: string): AppData {
  if (!name.trim()) throw new ValidationError({ name: 'Informe um nome.' });
  return syncListMovement({ ...data, lists: data.lists.map((l) => (l.id === id ? { ...l, name: name.trim() } : l)) }, id);
}

export function deleteList(data: AppData, id: string): AppData {
  return syncListMovement({ ...data, lists: data.lists.filter((l) => l.id !== id) }, id);
}

/** Duplica a lista para outro mês com todos os itens como pendentes (sem preço pago). */
export function duplicateList(data: AppData, id: string, targetMonth: Month): AppData {
  const src = data.lists.find((l) => l.id === id);
  if (!src) throw new Error('Lista não encontrada');
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) throw new ValidationError({ month: 'Mês inválido.' });
  const l: ShoppingList = { id: uid('lista'), month: targetMonth, name: src.name, createdAt: nowStamp(), items: src.items.map((i) => ({ ...i, id: uid('item'), status: 'pendente', realPrice: undefined, boughtAt: undefined })) };
  return { ...data, lists: [...data.lists, l] };
}

export type ItemInput = Omit<ShoppingItem, 'id' | 'status' | 'boughtAt'> & { status?: ShoppingItem['status'] };

export function validateItem(i: Partial<ShoppingItem>): Record<string, string> {
  const e: Record<string, string> = {};
  req(e, !!i.name && i.name.trim().length > 0, 'name', 'Informe o item.');
  req(e, positive(i.qty), 'qty', 'Quantidade precisa ser maior que zero.');
  req(e, nonNeg(i.estPrice), 'estPrice', 'Preço não pode ser negativo.');
  if (i.realPrice !== undefined) req(e, nonNeg(i.realPrice), 'realPrice', 'Preço não pode ser negativo.');
  return e;
}

export function addItem(data: AppData, listId: string, input: ItemInput, ref: ISODate = today()): AppData {
  const e = validateItem(input);
  if (Object.keys(e).length) throw new ValidationError(e);
  const item: ShoppingItem = { ...input, name: input.name.trim(), id: uid('item'), status: input.status || 'pendente', boughtAt: input.status === 'comprado' ? ref : undefined };
  const d: AppData = { ...data, lists: data.lists.map((l) => (l.id === listId ? { ...l, items: [...l.items, item] } : l)) };
  return syncListMovement(rememberFrequent(d, item), listId);
}

function rememberFrequent(data: AppData, item: ShoppingItem): AppData {
  const key = item.name.toLowerCase();
  const others = data.frequentItems.filter((f) => f.name.toLowerCase() !== key);
  return { ...data, frequentItems: [{ name: item.name, category: item.category, unit: item.unit, estPrice: item.realPrice ?? item.estPrice }, ...others].slice(0, 40) };
}

export function updateItem(data: AppData, listId: string, itemId: string, patch: Partial<ShoppingItem>, ref: ISODate = today()): AppData {
  const list = data.lists.find((l) => l.id === listId);
  const cur = list?.items.find((i) => i.id === itemId);
  if (!list || !cur) throw new Error('Item não encontrado');
  const next: ShoppingItem = { ...cur, ...patch, id: cur.id };
  if (next.status === 'comprado' && !next.boughtAt) next.boughtAt = ref;
  if (next.status === 'pendente') next.boughtAt = undefined;
  const e = validateItem(next);
  if (Object.keys(e).length) throw new ValidationError(e);
  const d: AppData = { ...data, lists: data.lists.map((l) => (l.id === listId ? { ...l, items: l.items.map((i) => (i.id === itemId ? next : i)) } : l)) };
  return syncListMovement(d, listId);
}

/** Alterna comprado/pendente. Ao comprar sem preço pago, assume o preço previsto (editável). */
export function toggleItem(data: AppData, listId: string, itemId: string, ref: ISODate = today()): AppData {
  const cur = data.lists.find((l) => l.id === listId)?.items.find((i) => i.id === itemId);
  if (!cur) return data;
  if (cur.status === 'comprado') return updateItem(data, listId, itemId, { status: 'pendente' }, ref);
  return updateItem(data, listId, itemId, { status: 'comprado', realPrice: cur.realPrice ?? cur.estPrice, boughtAt: ref }, ref);
}

export function deleteItem(data: AppData, listId: string, itemId: string): AppData {
  const d: AppData = { ...data, lists: data.lists.map((l) => (l.id === listId ? { ...l, items: l.items.filter((i) => i.id !== itemId) } : l)) };
  return syncListMovement(d, listId);
}

// ---------------- Reserva ----------------

export function setReserveConfig(data: AppData, cfg: Partial<ReserveConfig>): AppData {
  const next = { ...data.reserve, ...cfg };
  const e: Record<string, string> = {};
  req(e, nonNeg(next.initialAmount), 'initialAmount', 'Valor não pode ser negativo.');
  req(e, Number.isInteger(next.targetMonths) && next.targetMonths >= 1 && next.targetMonths <= 60, 'targetMonths', 'Meses entre 1 e 60.');
  req(e, nonNeg(next.essentialMonthly), 'essentialMonthly', 'Valor não pode ser negativo.');
  req(e, nonNeg(next.monthlyContribution), 'monthlyContribution', 'Valor não pode ser negativo.');
  if (next.customTarget !== undefined) req(e, nonNeg(next.customTarget), 'customTarget', 'Valor não pode ser negativo.');
  if (next.deadline) req(e, isValidISO(next.deadline), 'deadline', 'Data inválida.');
  if (Object.keys(e).length) throw new ValidationError(e);
  return { ...data, reserve: next };
}

/** Depósito/retirada da reserva. NÃO é despesa de consumo; mexe apenas no saldo da conta. */
export function reserveMove(data: AppData, kind: 'deposito' | 'retirada', amount: number, date: ISODate, notes?: string, currentReserve?: number): AppData {
  if (kind === 'retirada' && currentReserve !== undefined && amount > currentReserve) throw new ValidationError({ amount: 'A retirada é maior que o valor guardado na reserva.' });
  return addMovement(data, {
    description: kind === 'deposito' ? 'Guardado na reserva' : 'Retirada da reserva', type: kind === 'deposito' ? 'reserva_deposito' : 'reserva_retirada',
    amount, date, category: 'Reserva de emergência', source: 'conta', status: 'realizada', notes, originType: 'reserva',
  });
}

// ---------------- Planejamento / ajustes ----------------

export function setPlan(data: AppData, month: Month, plan: MonthPlan): AppData {
  if (![plan.extras, plan.variable, plan.savingsGoal].every(nonNeg)) throw new ValidationError({ plan: 'Valores não podem ser negativos.' });
  return { ...data, plans: { ...data.plans, [month]: plan } };
}

/** Lança um ajuste para igualar o saldo calculado ao saldo informado pelo banco. */
export function adjustBalance(data: AppData, informed: number, calculated: number, date: ISODate = today()): AppData {
  const diff = informed - calculated;
  if (diff === 0) return data;
  return addMovement(data, { description: 'Ajuste de saldo (conferência com o banco)', type: 'ajuste', amount: diff, date, category: 'Ajuste', source: 'conta', status: 'realizada', originType: 'ajuste' });
}

export function updateSettings(data: AppData, patch: Partial<Settings>, ref: ISODate = today()): AppData {
  const s = { ...data.settings, ...patch };
  const e: Record<string, string> = {};
  req(e, nonNeg(s.salary), 'salary', 'Salário não pode ser negativo.');
  req(e, nonNeg(s.vaMonthly), 'vaMonthly', 'VA não pode ser negativo.');
  req(e, Number.isInteger(s.payday) && s.payday >= 1 && s.payday <= 31, 'payday', 'Dia entre 1 e 31.');
  req(e, Number.isInteger(s.notifyDaysBefore) && s.notifyDaysBefore >= 0 && s.notifyDaysBefore <= 15, 'notifyDaysBefore', 'Entre 0 e 15 dias.');
  req(e, isValidISO(s.initialBalanceDate), 'initialBalanceDate', 'Data inválida.');
  if (Object.keys(e).length) throw new ValidationError(e);
  let d: AppData = { ...data, settings: s };
  // Salário previsto (ainda não recebido) acompanha mudanças de valor/dia.
  if (patch.salary !== undefined || patch.payday !== undefined) {
    d = { ...d, movements: d.movements.map((m) => (m.originType === 'salario' && m.status === 'prevista' ? { ...m, amount: s.salary, date: dateInMonth(monthOf(m.date), s.payday), updatedAt: nowStamp() } : m)) };
  }
  return runMaintenance(d, ref);
}
