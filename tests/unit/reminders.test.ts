import { describe, expect, it } from 'vitest';
import * as ops from '../../src/domain/ops';
import { planNativeReminders, reminderId } from '../../src/domain/reminders';
import type { AppData } from '../../src/domain/types';

const REF = '2026-10-28';

function data(): AppData {
  return ops.completeOnboarding(ops.emptyData(), {
    salary: 300000, payday: 5, vaMonthly: 0, vaDay: 1, initialBalance: 0, fixed: [],
    reserveInitial: 0, reserveMonths: 3, essentialMonthly: 100000, monthlyContribution: 0,
  }, REF);
}

function withBill(d: AppData, dueDate: string, name = 'Luz'): AppData {
  return ops.addBill(d, {
    name, amount: 15000, dueDate, category: 'casa', source: 'outra', kind: 'eventual', recurrence: 'nenhuma',
  }, REF);
}

describe('lembretes nativos agendados', () => {
  const morning = new Date(2026, 9, 28, 8, 0, 0);

  it('não agenda sem onboarding ou com notificações desligadas', () => {
    const off = withBill(data(), '2026-10-30');
    expect(planNativeReminders({ ...off, settings: { ...off.settings, notifications: false } }, morning)).toEqual([]);
    const raw = ops.emptyData();
    expect(planNativeReminders({
      ...withBill({ ...raw, settings: { ...raw.settings, notifications: true } }, '2026-10-30'),
      settings: { ...raw.settings, notifications: true, onboarded: false, notifyDaysBefore: 2 },
    }, morning)).toEqual([]);
  });

  it('agenda 9h no dia, N dias antes e no dia seguinte, só no futuro e dentro do horizonte', () => {
    const d = withBill({ ...data(), settings: { ...data().settings, notifications: true, notifyDaysBefore: 2 } }, '2026-10-30');
    const planned = planNativeReminders(d, morning, 45);
    expect(planned.map((p) => [p.kind, p.at.getFullYear(), p.at.getMonth(), p.at.getDate(), p.at.getHours()])).toEqual([
      ['antes', 2026, 9, 28, 9],
      ['vence', 2026, 9, 30, 9],
      ['atrasou', 2026, 9, 31, 9],
    ]);
    expect(planned.every((p) => p.title.includes('Meu Financeiro'))).toBe(true);
    expect(planned[0].body).toContain('Luz');
    expect(planned[0].body).toContain('vence em 2 dia(s)');
    expect(planned[1].body).toContain('vence hoje');
    expect(planned[2].body).toContain('venceu em');
  });

  it('ignora horário que já passou, conta paga e vencimento além do horizonte', () => {
    const late = new Date(2026, 9, 28, 10, 0, 0);
    let d = withBill({ ...data(), settings: { ...data().settings, notifications: true, notifyDaysBefore: 2 } }, '2026-10-28', 'Hoje');
    d = withBill(d, '2026-12-31', 'Longe');
    const paid = ops.addBill(d, {
      name: 'Paga', amount: 1000, dueDate: '2026-10-29', category: 'casa', source: 'outra', kind: 'eventual', recurrence: 'nenhuma',
    }, REF);
    const bill = paid.bills.find((b) => b.name === 'Paga')!;
    d = { ...paid, bills: paid.bills.map((b) => (b.id === bill.id ? { ...b, status: 'paga' } : b)) };
    const planned = planNativeReminders(d, late, 45);
    expect(planned.map((p) => p.kind)).toEqual(['atrasou']);
    expect(planned[0].at.getDate()).toBe(29);
    expect(planned.some((p) => p.body.includes('Longe') || p.body.includes('Paga'))).toBe(false);
  });

  it('com 0 dias antes não cria o aviso antecipado', () => {
    const d = withBill({ ...data(), settings: { ...data().settings, notifications: true, notifyDaysBefore: 0 } }, '2026-10-30');
    expect(planNativeReminders(d, morning, 45).map((p) => p.kind)).toEqual(['vence', 'atrasou']);
  });

  it('id é estável e cabe em inteiro de 32 bits', () => {
    const id = reminderId('bill-luz', 'vence');
    expect(id).toBe(reminderId('bill-luz', 'vence'));
    expect(id).not.toBe(reminderId('bill-luz', 'atrasou'));
    expect(Number.isInteger(id)).toBe(true);
    expect(id).toBeGreaterThan(0);
    expect(id).toBeLessThanOrEqual(2147483647);
  });
});
