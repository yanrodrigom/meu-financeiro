import { describe, it, expect, beforeEach } from 'vitest';
import * as ops from '../../src/domain/ops';
import * as calc from '../../src/domain/calc';
import { parseBackup, makeBackup } from '../../src/domain/backup';
import { movementsCSV } from '../../src/domain/csv';
import { parseMoney, brl } from '../../src/domain/money';
import { setClock, addMonthsKeepDay } from '../../src/domain/dates';
import { demoData } from '../../src/domain/demo';
import type { AppData } from '../../src/domain/types';

const REF = '2026-10-28';
setClock(() => new Date(2026, 9, 28, 12));

function base(): AppData {
  return ops.completeOnboarding(ops.emptyData(), {
    salary: 300000, payday: 5, vaMonthly: 60000, vaDay: 1, initialBalance: 100000, fixed: [],
    reserveInitial: 50000, reserveMonths: 6, essentialMonthly: 200000, monthlyContribution: 25000,
  }, REF);
}

describe('dinheiro e datas', () => {
  it('parseMoney aceita formatos brasileiros', () => {
    expect(parseMoney('12,50')).toBe(1250);
    expect(parseMoney('1.234,56')).toBe(123456);
    expect(parseMoney('R$ 3.000')).toBe(300000);
    expect(parseMoney('10.5')).toBe(1050);
    expect(parseMoney('abc')).toBeNaN();
    expect(parseMoney('')).toBeNaN();
  });
  it('brl formata em pt-BR', () => {
    expect(brl(123456)).toBe('R$ 1.234,56');
  });
  it('mensal mantém dia 31 limitado ao mês', () => {
    expect(addMonthsKeepDay('2026-01-31', 1, 31)).toBe('2026-02-28');
    expect(addMonthsKeepDay('2026-01-31', 2, 31)).toBe('2026-03-31');
  });
});

describe('onboarding', () => {
  it('não inventa valores e cria salário previsto', () => {
    const d = base();
    expect(d.settings.onboarded).toBe(true);
    const sal = d.movements.filter((m) => m.originType === 'salario');
    // salário de 05/10 já passou antes do início (está no saldo informado): só o de novembro é criado
    expect(sal.map((m) => m.id).sort()).toEqual(['mov-sal-2026-11']);
    expect(sal.every((m) => m.status === 'prevista')).toBe(true);
    expect(calc.accountBalance(d)).toBe(100000); // salário previsto não conta como saldo
  });
  it('valida dados obrigatórios', () => {
    expect(() => ops.completeOnboarding(ops.emptyData(), { salary: -1, payday: 40, vaMonthly: 0, vaDay: 1, initialBalance: 0, fixed: [], reserveInitial: 0, reserveMonths: 6, essentialMonthly: 0, monthlyContribution: 0 })).toThrow(ops.ValidationError);
  });
  it('é idempotente ao rodar manutenção várias vezes', () => {
    let d = base();
    d = ops.runMaintenance(ops.runMaintenance(d, REF), REF);
    expect(d.movements.filter((m) => m.originType === 'salario')).toHaveLength(1);
  });
});

describe('separação VA x salário', () => {
  it('gasto no VA não reduz saldo da conta e vice-versa', () => {
    let d = base();
    d = ops.addMovement(d, { description: 'Almoço', type: 'despesa', amount: 3000, date: REF, category: 'Alimentação', source: 'va', status: 'paga' });
    expect(calc.accountBalance(d)).toBe(100000);
    expect(calc.vaMonth(d, '2026-10').spent).toBe(3000);
    expect(calc.vaMonth(d, '2026-10').remaining).toBe(57000);
    d = ops.addMovement(d, { description: 'Mercado no débito', type: 'despesa', amount: 5000, date: REF, category: 'Supermercado', source: 'conta', status: 'paga' });
    expect(calc.accountBalance(d)).toBe(95000);
    expect(calc.vaMonth(d, '2026-10').spent).toBe(3000);
    const s = calc.monthSummary(d, '2026-10');
    expect(s.expenseDone).toBe(5000); // despesas em dinheiro não incluem VA
  });
  it('não aceita receita lançada no VA', () => {
    expect(() => ops.addMovement(base(), { description: 'x', type: 'receita', amount: 100, date: REF, category: 'Outros', source: 'va', status: 'realizada' })).toThrow();
  });
  it('saldo do VA acumula entre meses quando configurado', () => {
    let d = base();
    d = ops.addMovement(d, { description: 'Mercado', type: 'despesa', amount: 40000, date: REF, category: 'Supermercado', source: 'va', status: 'paga' });
    expect(calc.vaMonth(d, '2026-11').available).toBe(60000 + 20000);
    d = ops.updateSettings(d, { vaCarryOver: false }, REF);
    expect(calc.vaMonth(d, '2026-11').available).toBe(60000);
  });
});

describe('compras sem dupla contagem', () => {
  it('somente itens comprados contam e há um único lançamento por lista', () => {
    let d = base();
    d = ops.addList(d, '2026-10', 'Mês');
    const lid = d.lists[0].id;
    d = ops.addItem(d, lid, { name: 'Arroz', category: 'Mercearia', qty: 2, unit: 'pct', estPrice: 2500 }, REF);
    d = ops.addItem(d, lid, { name: 'Feijão... não', category: 'Mercearia', qty: 1, unit: 'un', estPrice: 1000 }, REF);
    expect(calc.vaMonth(d, '2026-10').spent).toBe(0);
    expect(calc.vaMonth(d, '2026-10').estimatedTotal).toBe(6000);
    const [a, b] = d.lists[0].items;
    d = ops.toggleItem(d, lid, a.id, REF);
    d = ops.toggleItem(d, lid, a.id, REF); // desmarca
    d = ops.toggleItem(d, lid, a.id, REF); // marca de novo
    expect(d.movements.filter((m) => m.originType === 'compras')).toHaveLength(1);
    expect(calc.vaMonth(d, '2026-10').spent).toBe(5000);
    d = ops.updateItem(d, lid, a.id, { realPrice: 2300 }, REF);
    expect(calc.vaMonth(d, '2026-10').spent).toBe(4600);
    d = ops.toggleItem(d, lid, b.id, REF);
    expect(calc.vaMonth(d, '2026-10').spent).toBe(5600);
    expect(d.movements.filter((m) => m.originType === 'compras')).toHaveLength(1);
    expect(calc.accountBalance(d)).toBe(100000);
    d = ops.deleteItem(d, lid, b.id);
    expect(calc.vaMonth(d, '2026-10').spent).toBe(4600);
    d = ops.deleteList(d, lid);
    expect(calc.vaMonth(d, '2026-10').spent).toBe(0);
    expect(d.movements.filter((m) => m.originType === 'compras')).toHaveLength(0);
  });
  it('duplicar lista copia itens como pendentes', () => {
    let d = base();
    d = ops.addList(d, '2026-10');
    const lid = d.lists[0].id;
    d = ops.addItem(d, lid, { name: 'Leite', category: 'Laticínios', qty: 6, unit: 'L', estPrice: 500 }, REF);
    d = ops.toggleItem(d, lid, d.lists[0].items[0].id, REF);
    d = ops.duplicateList(d, lid, '2026-11');
    const copy = d.lists.find((l) => l.month === '2026-11')!;
    expect(copy.items[0].status).toBe('pendente');
    expect(copy.items[0].realPrice).toBeUndefined();
    expect(calc.vaMonth(d, '2026-11').spent).toBe(0);
  });
  it('lançamento de compras não pode ser editado/excluído diretamente', () => {
    let d = base();
    d = ops.addList(d, '2026-10');
    const lid = d.lists[0].id;
    d = ops.addItem(d, lid, { name: 'Pão', category: 'Padaria', qty: 1, unit: 'un', estPrice: 800, status: 'comprado' }, REF);
    const mov = d.movements.find((m) => m.originType === 'compras')!;
    expect(() => ops.deleteMovement(d, mov.id)).toThrow();
    expect(() => ops.updateMovement(d, mov.id, { amount: 1 })).toThrow();
  });
});

describe('contas: pagar sem duplicar', () => {
  it('pagar duas vezes gera um único lançamento', () => {
    let d = base();
    d = ops.addBill(d, { name: 'Celular', amount: 5000, dueDate: '2026-11-02', category: 'Telefone', source: 'salario', kind: 'eventual', recurrence: 'nenhuma' }, REF);
    const id = d.bills[0].id;
    d = ops.payBill(d, id, {}, REF);
    d = ops.payBill(d, id, {}, REF);
    expect(d.movements.filter((m) => m.originId === id)).toHaveLength(1);
    expect(calc.accountBalance(d)).toBe(95000);
    d = ops.payBill(d, id, { amount: 5500 }, REF); // corrigir valor pago atualiza o mesmo lançamento
    expect(d.movements.filter((m) => m.originId === id)).toHaveLength(1);
    expect(calc.accountBalance(d)).toBe(94500);
    d = ops.unpayBill(d, id);
    expect(d.movements.filter((m) => m.originId === id)).toHaveLength(0);
    expect(calc.accountBalance(d)).toBe(100000);
  });
  it('excluir o lançamento volta a conta para pendente', () => {
    let d = base();
    d = ops.addBill(d, { name: 'Gás', amount: 12000, dueDate: REF, category: 'Outros', source: 'salario', kind: 'eventual', recurrence: 'nenhuma' }, REF);
    const id = d.bills[0].id;
    d = ops.payBill(d, id, {}, REF);
    d = ops.deleteMovement(d, `mov-bill-${id}`);
    expect(d.bills[0].status).toBe('pendente');
  });
  it('conta futura não é despesa paga, mas compromete o disponível', () => {
    let d = base();
    d = ops.addBill(d, { name: 'Boleto', amount: 20000, dueDate: '2026-11-03', category: 'Outros', source: 'salario', kind: 'eventual', recurrence: 'nenhuma' }, REF);
    expect(calc.monthSummary(d, '2026-11').expenseDone).toBe(0);
    const a = calc.availableToday(d, REF);
    expect(a.payday).toBe('2026-11-05');
    expect(a.balance).toBe(100000);
    expect(a.available).toBe(80000);
  });
  it('conta paga com VA não mexe na conta', () => {
    let d = base();
    d = ops.addBill(d, { name: 'Feira', amount: 10000, dueDate: REF, category: 'Supermercado', source: 'va', kind: 'compra', recurrence: 'nenhuma' }, REF);
    d = ops.payBill(d, d.bills[0].id, {}, REF);
    expect(calc.accountBalance(d)).toBe(100000);
    expect(calc.vaMonth(d, '2026-10').spent).toBe(10000);
  });
});

describe('recorrência sem duplicação', () => {
  it('gera ocorrências determinísticas e não duplica', () => {
    let d = base();
    d = ops.addBill(d, { name: 'Aluguel', amount: 90000, dueDate: '2026-10-10', category: 'Aluguel/prestação', source: 'salario', kind: 'fixa', recurrence: 'mensal' }, REF);
    const n1 = d.bills.length;
    d = ops.ensureRecurrences(ops.ensureRecurrences(d, REF), REF);
    expect(d.bills.length).toBe(n1);
    expect(d.bills.map((b) => b.dueDate).sort()).toEqual(['2026-10-10', '2026-11-10', '2026-12-10']);
    const ids = d.bills.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    // pagar e avançar o tempo gera a próxima sem duplicar
    d = ops.payBill(d, d.bills.find((b) => b.dueDate === '2026-11-10')!.id, {}, REF);
    d = ops.ensureRecurrences(d, '2026-12-20');
    expect(d.bills.filter((b) => b.dueDate === '2027-01-10')).toHaveLength(1);
    d = ops.ensureRecurrences(d, '2026-12-20');
    expect(d.bills.filter((b) => b.dueDate === '2027-01-10')).toHaveLength(1);
  });
  it('excluir ocorrência não a recria; encerrar série remove futuras', () => {
    let d = base();
    d = ops.addBill(d, { name: 'Academia', amount: 9000, dueDate: '2026-11-01', category: 'Saúde', source: 'salario', kind: 'fixa', recurrence: 'mensal' }, REF);
    const nov = d.bills.find((b) => b.dueDate === '2026-11-01')!;
    d = ops.deleteBill(d, nov.id);
    d = ops.ensureRecurrences(d, REF);
    expect(d.bills.find((b) => b.dueDate === '2026-11-01')).toBeUndefined();
    const sid = d.series[0].id;
    d = ops.endSeries(d, sid, '2026-11-30');
    d = ops.ensureRecurrences(d, '2027-03-01');
    expect(d.bills.filter((b) => b.seriesId === sid)).toHaveLength(0);
  });
  it('editar com "aplicar às próximas" atualiza as pendentes futuras', () => {
    let d = base();
    d = ops.addBill(d, { name: 'Internet', amount: 10000, dueDate: '2026-11-15', category: 'Internet', source: 'salario', kind: 'fixa', recurrence: 'mensal' }, REF);
    const first = d.bills.find((b) => b.dueDate === '2026-11-15')!;
    d = ops.updateBill(d, first.id, { amount: 12000 }, true, REF);
    expect(d.bills.filter((b) => b.seriesId).every((b) => b.amount === 12000)).toBe(true);
    expect(d.series[0].amount).toBe(12000);
  });
  it('planejamento projeta séries em meses futuros (estimativa)', () => {
    let d = base();
    d = ops.addBill(d, { name: 'Aluguel', amount: 90000, dueDate: '2026-11-10', category: 'Aluguel/prestação', source: 'salario', kind: 'fixa', recurrence: 'mensal' }, REF);
    const p = calc.projection(d, '2027-04');
    expect(p.fixed).toBe(90000);
    expect(p.income).toBe(300000);
  });
});

describe('parcelas', () => {
  it('gera N parcelas com datas e nomes corretos', () => {
    let d = base();
    d = ops.addInstallments(d, { name: 'Celular', count: 3, amount: 50000, firstDate: '2026-11-30', periodicity: 'mensal', category: 'Parcelas', source: 'salario' });
    const p = d.bills.filter((b) => b.kind === 'parcela');
    expect(p.map((b) => b.dueDate)).toEqual(['2026-11-30', '2026-12-30', '2027-01-30']);
    expect(p[2].name).toBe('Celular (3/3)');
    expect(calc.projection(d, '2026-12').installments).toBe(50000);
    d = ops.payBill(d, p[0].id, {}, REF);
    d = ops.deleteInstallmentGroup(d, p[0].installment!.groupId);
    expect(d.bills.filter((b) => b.kind === 'parcela')).toHaveLength(1);
    expect(() => ops.addInstallments(d, { name: 'x', count: 0, amount: 100, firstDate: REF, periodicity: 'mensal', category: 'P', source: 'salario' })).toThrow();
  });
});

describe('reserva de emergência', () => {
  it('depósito reduz saldo da conta mas não é despesa de consumo', () => {
    let d = base();
    d = ops.reserveMove(d, 'deposito', 30000, REF);
    expect(calc.accountBalance(d)).toBe(70000);
    expect(calc.monthSummary(d, '2026-10').expenseDone).toBe(0);
    expect(calc.categoryBreakdown(d, '2026-10')).toHaveLength(0);
    const r = calc.reserveStatus(d, REF);
    expect(r.accumulated).toBe(80000);
    expect(r.target).toBe(1200000);
    expect(r.missing).toBe(1120000);
    expect(r.monthsEstimate).toBe(Math.ceil(1120000 / 25000));
    d = ops.reserveMove(d, 'retirada', 10000, REF, undefined, r.accumulated);
    expect(calc.reserveStatus(d, REF).accumulated).toBe(70000);
    expect(calc.accountBalance(d)).toBe(80000);
    expect(() => ops.reserveMove(d, 'retirada', 999999, REF, undefined, 70000)).toThrow();
  });
  it('meta personalizada e prazo geram contribuição sugerida', () => {
    let d = base();
    d = ops.setReserveConfig(d, { customTarget: 650000, deadline: '2027-10-28' });
    const r = calc.reserveStatus(d, REF);
    expect(r.target).toBe(650000);
    expect(r.suggested).toBe(Math.ceil(600000 / 12));
    expect(r.references.map((x) => x.value)).toEqual([600000, 1200000, 2400000]);
  });
});

describe('edições e exclusões atualizam totais', () => {
  it('casa: marcar como paga atualiza o mesmo registro', () => {
    let d = base();
    d = ops.addMovement(d, { description: 'Energia', type: 'despesa', amount: 15000, date: REF, category: 'Energia', source: 'conta', status: 'pendente', recurrence: 'fixa' });
    const id = d.movements[d.movements.length - 1].id;
    expect(calc.accountBalance(d)).toBe(100000);
    const count = d.movements.length;
    d = ops.markMovementDone(d, id);
    expect(d.movements.length).toBe(count);
    expect(calc.accountBalance(d)).toBe(85000);
    d = ops.updateMovement(d, id, { amount: 16000 });
    expect(calc.accountBalance(d)).toBe(84000);
    expect(calc.monthSummary(d, '2026-10').expenseDone).toBe(16000);
    d = ops.deleteMovement(d, id);
    expect(calc.accountBalance(d)).toBe(100000);
    expect(calc.monthSummary(d, '2026-10').expenseDone).toBe(0);
  });
  it('confirmar salário soma no saldo; excluir salário não o recria', () => {
    let d = base();
    d = ops.markMovementDone(d, 'mov-sal-2026-11');
    expect(calc.accountBalance(d)).toBe(400000);
    d = ops.deleteMovement(d, 'mov-sal-2026-11');
    d = ops.runMaintenance(d, REF);
    expect(d.movements.find((m) => m.id === 'mov-sal-2026-11')).toBeUndefined();
  });
  it('rejeita valores negativos/zero e datas inválidas', () => {
    const d = base();
    expect(() => ops.addMovement(d, { description: 'x', type: 'despesa', amount: -5, date: REF, category: 'Outros', source: 'conta', status: 'paga' })).toThrow();
    expect(() => ops.addMovement(d, { description: 'x', type: 'despesa', amount: 100, date: '2026-02-30', category: 'Outros', source: 'conta', status: 'paga' })).toThrow();
    expect(() => ops.addMovement(d, { description: ' ', type: 'despesa', amount: 100, date: REF, category: 'Outros', source: 'conta', status: 'paga' })).toThrow();
  });
  it('ajuste de saldo iguala ao banco', () => {
    let d = base();
    d = ops.adjustBalance(d, 98000, calc.accountBalance(d), REF);
    expect(calc.accountBalance(d)).toBe(98000);
    expect(calc.monthSummary(d, '2026-10').expenseDone).toBe(0);
  });
});

describe('backup', () => {
  let d: AppData;
  beforeEach(() => { d = demoData(REF); });
  it('ida e volta preserva os dados', () => {
    const json = JSON.stringify(makeBackup(d));
    const r = parseBackup(json);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual(d);
      expect(calc.accountBalance(r.data)).toBe(calc.accountBalance(d));
    }
  });
  it('rejeita arquivos inválidos', () => {
    expect(parseBackup('{oops').ok).toBe(false);
    expect(parseBackup({ app: 'outro' }).ok).toBe(false);
    const bad = makeBackup(d) as any;
    bad.data.movements[0].amount = 'dez';
    expect(parseBackup(JSON.parse(JSON.stringify(bad))).ok).toBe(false);
    const dup = makeBackup(d) as any;
    dup.data.movements.push({ ...dup.data.movements[0] });
    expect(parseBackup(JSON.parse(JSON.stringify(dup))).ok).toBe(false);
  });
  it('dados demo são marcados como demo', () => {
    expect(d.settings.demo).toBe(true);
  });
});

describe('CSV', () => {
  it('usa BOM, ponto e vírgula e vírgula decimal', () => {
    let d = base();
    d = ops.addMovement(d, { description: 'Pão; leite "fresco"', type: 'despesa', amount: 1234, date: REF, category: 'Padaria', source: 'conta', status: 'paga' });
    const csv = movementsCSV(d);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(';12,34;');
    expect(csv).toContain('"Pão; leite ""fresco"""');
    expect(csv).toContain('28/10/2026');
  });
});
