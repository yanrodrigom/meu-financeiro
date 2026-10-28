import type { AppData } from './types';
import { fmtDate } from './dates';

const TYPE: Record<string, string> = { receita: 'Receita', despesa: 'Despesa', reserva_deposito: 'Depósito reserva', reserva_retirada: 'Retirada reserva', ajuste: 'Ajuste' };
const SOURCE: Record<string, string> = { conta: 'Conta/salário', va: 'Vale-alimentação', outra: 'Outra' };

function cell(v: string | number | undefined): string {
  const s = v === undefined || v === null ? '' : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const money = (c: number) => (c / 100).toFixed(2).replace('.', ',');

/** CSV para Excel BR: BOM UTF-8, separador ';' e vírgula decimal. */
export function movementsCSV(data: AppData, month?: string): string {
  const rows = data.movements.filter((m) => !month || m.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date));
  const head = ['ID', 'Data', 'Descrição', 'Tipo', 'Valor (R$)', 'Categoria', 'Fonte', 'Status', 'Forma de pagamento', 'Origem', 'Observações'];
  const lines = [head.join(';')];
  for (const m of rows) {
    lines.push([m.id, fmtDate(m.date), m.description, TYPE[m.type], money(m.amount), m.category, SOURCE[m.source], m.status, m.paymentMethod, m.originType + (m.originId ? `:${m.originId}` : ''), m.notes].map(cell).join(';'));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

export function billsCSV(data: AppData, month?: string): string {
  const rows = data.bills.filter((b) => !month || b.dueDate.startsWith(month)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const head = ['ID', 'Vencimento', 'Conta', 'Valor previsto (R$)', 'Valor pago (R$)', 'Categoria', 'Origem do dinheiro', 'Tipo', 'Recorrência', 'Status'];
  const lines = [head.join(';')];
  for (const b of rows) lines.push([b.id, fmtDate(b.dueDate), b.name, money(b.amount), b.paidAmount !== undefined ? money(b.paidAmount) : '', b.category, b.source, b.kind, b.recurrence, b.status].map(cell).join(';'));
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
