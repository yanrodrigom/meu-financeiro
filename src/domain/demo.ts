import type { AppData } from './types';
import { addMonth, dateInMonth, monthOf, today } from './dates';
import { addBill, addInstallments, addItem, addList, addMovement, completeOnboarding, emptyData, payBill, reserveMove, toggleItem } from './ops';

/** Dados de DEMONSTRAÇÃO (fictícios), sempre marcados com settings.demo = true. */
export function demoData(ref = today()): AppData {
  let d = completeOnboarding(emptyData(), {
    name: 'Demonstração', salary: 320000, payday: 5, vaMonthly: 80000, vaDay: 1, initialBalance: 145000,
    fixed: [
      { name: 'Aluguel', amount: 90000, day: 10, category: 'Aluguel/prestação' },
      { name: 'Internet', amount: 9990, day: 15, category: 'Internet' },
      { name: 'Energia', amount: 18000, day: 20, category: 'Energia' },
    ],
    reserveInitial: 150000, reserveMonths: 6, essentialMonthly: 180000, monthlyContribution: 30000,
  }, ref);
  const m = monthOf(ref);
  d = addMovement(d, { description: 'Farmácia', type: 'despesa', amount: 4590, date: ref, category: 'Saúde', source: 'conta', status: 'paga', paymentMethod: 'Pix' });
  d = addMovement(d, { description: 'Freela fim de semana', type: 'receita', amount: 25000, date: ref, category: 'Renda extra', source: 'conta', status: 'realizada' });
  d = addBill(d, { name: 'Água', amount: 7500, dueDate: dateInMonth(m, 28), category: 'Água', source: 'salario', kind: 'fixa', recurrence: 'nenhuma' }, ref);
  d = addInstallments(d, { name: 'Tênis de corrida', count: 4, amount: 8990, firstDate: dateInMonth(addMonth(m, 1), 12), periodicity: 'mensal', category: 'Parcelas', source: 'salario' });
  d = addList(d, m, 'Compras do mês');
  const lid = d.lists[0].id;
  for (const [name, cat, qty, unit, price] of [['Arroz 5kg', 'Mercearia', 1, 'pct', 2890], ['Frango', 'Carnes', 2, 'kg', 1599], ['Leite', 'Laticínios', 6, 'L', 549], ['Banana', 'Hortifrúti', 1.5, 'kg', 699], ['Café 500g', 'Mercearia', 1, 'pct', 1890]] as const) {
    d = addItem(d, lid, { name, category: cat, qty, unit, estPrice: price }, ref);
  }
  d = toggleItem(d, lid, d.lists[0].items[0].id, ref);
  d = toggleItem(d, lid, d.lists[0].items[1].id, ref);
  d = reserveMove(d, 'deposito', 20000, ref);
  const internet = d.bills.find((b) => b.name === 'Internet');
  if (internet) d = payBill(d, internet.id, { date: ref }, ref);
  return { ...d, settings: { ...d.settings, demo: true } };
}
