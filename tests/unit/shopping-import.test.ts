import { describe, expect, it } from 'vitest';
import * as ops from '../../src/domain/ops';
import { itemEstTotal } from '../../src/domain/calc';
import { applyShoppingImport, parseShoppingText, planShoppingImport } from '../../src/domain/shopping-import';
import type { AppData } from '../../src/domain/types';

const REF = '2026-10-28';

/** Lista real do Yan: seções e linhas com checkbox. */
const SAMPLE = `--- COMIDA E MARMITAS ---
[ ] Peito de Frango (4 kg) - R$ 72,00
[ ] Carne Moída (1,5 kg) - R$ 45,00
--- FRUTAS E LEGUMES ---
[ ] Maçã (3 kg) - R$ 30,00
--- FIM DE SEMANA ---
[ ] Refrigerante em Lata (2 fardos c/ 12) - R$ 70,00
--- HIGIENE E LIMPEZA ---
[ ] Papel higiênico, Shampoo... - R$ 78,00
`;

function monthList(): AppData {
  return ops.addList(ops.completeOnboarding(ops.emptyData(), {
    salary: 300000, payday: 5, vaMonthly: 80000, vaDay: 1, initialBalance: 150000, fixed: [],
    reserveInitial: 0, reserveMonths: 3, essentialMonthly: 100000, monthlyContribution: 0,
  }, REF), '2026-10', 'Compras do mês');
}

describe('lista de compras em texto', () => {
  it('lê o exemplo: seção vira categoria, preço é o total da linha, item fica pendente', () => {
    const { items, issues } = parseShoppingText(SAMPLE);
    expect(issues).toEqual([]);
    expect(items.map((i) => [i.name, i.qty, i.unit, i.category, i.estPrice, itemEstTotal(i)])).toEqual([
      ['Peito de Frango', 4, 'kg', 'COMIDA E MARMITAS', 1800, 7200],
      ['Carne Moída', 1.5, 'kg', 'COMIDA E MARMITAS', 3000, 4500],
      ['Maçã', 3, 'kg', 'FRUTAS E LEGUMES', 1000, 3000],
      ['Refrigerante em Lata', 2, 'fardos c/ 12', 'FIM DE SEMANA', 3500, 7000],
      ['Papel higiênico, Shampoo...', 1, 'un', 'HIGIENE E LIMPEZA', 7800, 7800],
    ]);
  });

  it('aceita CSV e JSON com colunas de nome, qtd, unidade, preço e categoria', () => {
    const csv = parseShoppingText('produto;quantidade;medida;preço;categoria\nArroz;2;kg;8,50;Mercearia\n');
    expect(csv.items[0]).toMatchObject({ name: 'Arroz', qty: 2, unit: 'kg', estPrice: 850, category: 'Mercearia' });
    const json = parseShoppingText(JSON.stringify([{ nome: 'Leite', qtd: 3, unidade: 'L', preco: 5.5, categoria: 'Laticínios' }]));
    expect(json.items[0]).toMatchObject({ name: 'Leite', qty: 3, unit: 'L', estPrice: 550, category: 'Laticínios' });
  });

  it('não duplica o que já está na lista; somar só quando pedido, mesma unidade e pendente', () => {
    let data = monthList();
    const listId = data.lists[0].id;
    data = ops.addItem(data, listId, { name: 'peito de frango', category: 'Outros', qty: 1, unit: 'kg', estPrice: 2000 }, REF);
    data = ops.addItem(data, listId, { name: 'Maçã', category: 'FRUTAS E LEGUMES', qty: 1, unit: 'kg', estPrice: 900, status: 'comprado' }, REF);
    const { items } = parseShoppingText(SAMPLE);
    const skip = planShoppingImport(data.lists[0].items, items, false);
    expect(skip.find((r) => r.item.name === 'Peito de Frango')?.action).toBe('skip');
    expect(skip.find((r) => r.item.name === 'Maçã')?.action).toBe('skip');
    expect(skip.find((r) => r.item.name === 'Carne Moída')?.action).toBe('add');

    const sum = planShoppingImport(data.lists[0].items, items, true);
    expect(sum.find((r) => r.item.name === 'Peito de Frango')?.action).toBe('sum');
    expect(sum.find((r) => r.item.name === 'Maçã')?.action).toBe('skip');

    const applied = applyShoppingImport(data, listId, sum.filter((r) => r.action !== 'skip'));
    const list = applied.lists[0];
    const frango = list.items.find((i) => i.name === 'peito de frango')!;
    expect(frango.qty).toBe(5);
    expect(frango.estPrice).toBe(2000);
    expect(frango.status).toBe('pendente');
    expect(list.items.filter((i) => i.name.toLowerCase().includes('frango'))).toHaveLength(1);
    expect(list.items.find((i) => i.name === 'Maçã')!.qty).toBe(1);
    expect(list.items.find((i) => i.name === 'Maçã')!.status).toBe('comprado');
    expect(applied.movements.filter((m) => m.originType === 'compras')).toHaveLength(1);
    expect(list.items.some((i) => i.name === 'Carne Moída' && i.status === 'pendente')).toBe(true);
  });

  it('junta repetidos do próprio arquivo e não mexe no VA ao importar só pendentes', () => {
    const { items } = parseShoppingText(`[ ] Arroz (1 kg) - R$ 8,00\n[ ] Arroz (2 kg) - R$ 16,00\n`);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: 'Arroz', qty: 3, unit: 'kg', estPrice: 800 });
    const data = monthList();
    const next = applyShoppingImport(data, data.lists[0].id, planShoppingImport([], items, false));
    expect(next.lists[0].items).toHaveLength(1);
    expect(next.lists[0].items[0].status).toBe('pendente');
    expect(next.movements.filter((m) => m.originType === 'compras')).toHaveLength(0);
  });
});
