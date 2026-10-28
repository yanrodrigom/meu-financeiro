import { useData } from '../../store/store';
import * as calc from '../../domain/calc';
import { addMonth, dateInMonth, fmtDate, monthLabel, today } from '../../domain/dates';
import { pctLabel } from '../../domain/money';
import { billsCSV, movementsCSV } from '../../domain/csv';
import { money } from '../format';
import { Icon } from '../icons';
import { Card, MonthBar, PageHeader, Progress } from '../components/kit';
import { BarChart, Donut, LineChart } from '../components/charts';
import { useMonth } from '../state';
import { download } from '../download';

export function Reports() {
  const d = useData();
  const [month, setMonth] = useMonth();
  const months = Array.from({ length: 6 }, (_, i) => addMonth(month, i - 5));
  const sums = months.map((m) => ({ m, s: calc.monthSummary(d, m) }));
  const s = calc.monthSummary(d, month);
  const cats = calc.categoryBreakdown(d, month, 'dinheiro');
  const vaCats = calc.categoryBreakdown(d, month, 'va');
  const va = calc.vaMonth(d, month);
  const end = (m: string) => { const e = dateInMonth(m, 31); const t = today(); return e > t && m === t.slice(0, 7) ? t : e; };
  const balance = months.map((m) => ({ label: monthLabel(m, true), value: calc.accountBalance(d, end(m)) }));
  const reserve = months.map((m) => ({ label: monthLabel(m, true), value: calc.reserveAt(d, end(m)) }));
  const vaUse = months.map((m) => { const v = calc.vaMonth(d, m); return { label: monthLabel(m, true), values: [v.available, v.spent] }; });
  const exportCSV = () => download(`movimentacoes-${month}.csv`, movementsCSV(d, month), 'text/csv;charset=utf-8');
  const exportAll = () => download(`movimentacoes-todas.csv`, movementsCSV(d), 'text/csv;charset=utf-8');
  const exportBills = () => download(`contas-${month}.csv`, billsCSV(d, month), 'text/csv;charset=utf-8');
  return (
    <div class="page report">
      <PageHeader back title="Relatórios" subtitle="Seu mês em gráficos" />
      <MonthBar month={month} onChange={setMonth} />
      <div class="print-only print-head"><h1>Meu Financeiro — Resumo de {monthLabel(month)}</h1><p>Gerado em {fmtDate(today())}</p></div>

      <Card title="Resumo do mês">
        <dl class="plan-grid">
          <dt>Receitas recebidas</dt><dd class="pos">{money(s.incomeDone)}</dd>
          <dt>Despesas pagas (dinheiro)</dt><dd class="neg">{money(s.expenseDone)}</dd>
          <dt>Resultado</dt><dd class={s.result >= 0 ? 'pos strong' : 'neg strong'}>{money(s.result)}</dd>
          <dt>Guardado na reserva</dt><dd>{money(s.reserveIn - s.reserveOut)}</dd>
          <dt>Uso do VA</dt><dd>{money(va.spent)} de {money(va.available)} ({pctLabel(va.usedPct)})</dd>
          <dt>Saldo da conta no fim do mês</dt><dd>{money(calc.accountBalance(d, end(month)))}</dd>
        </dl>
      </Card>

      <Card title="Receitas x despesas (6 meses)">
        <BarChart data={sums.map(({ m, s }) => ({ label: monthLabel(m, true), values: [s.incomeDone, s.expenseDone] }))} series={[{ name: 'Receitas', color: 'var(--emerald)' }, { name: 'Despesas', color: 'var(--red-soft)' }]} />
      </Card>

      <Card title="Gastos da casa por categoria">
        {cats.length ? <Donut data={cats} /> : <p class="muted">Sem despesas pagas neste mês.</p>}
      </Card>

      <Card title="Previsto x realizado">
        <div class="pvr"><div class="row between"><span>Receitas</span><span class="small"><b>{money(s.incomeDone)}</b> / {money(s.incomePlanned)}</span></div><Progress value={s.incomePlanned ? (s.incomeDone / s.incomePlanned) * 100 : 0} /></div>
        <div class="pvr"><div class="row between"><span>Despesas</span><span class="small"><b>{money(s.expenseDone)}</b> / {money(s.expensePlanned)}</span></div><Progress value={s.expensePlanned ? (s.expenseDone / s.expensePlanned) * 100 : 0} tone="warn" /></div>
        <BarChart data={sums.map(({ m, s }) => ({ label: monthLabel(m, true), values: [s.expensePlanned, s.expenseDone] }))} series={[{ name: 'Despesa prevista', color: 'var(--teal-soft)' }, { name: 'Despesa realizada', color: 'var(--teal)' }]} />
      </Card>

      <Card title="Evolução do saldo da conta"><LineChart data={balance} /></Card>
      <Card title="Evolução da reserva"><LineChart data={reserve} color="var(--teal)" /></Card>

      <Card title="Uso do vale-alimentação">
        <BarChart data={vaUse} series={[{ name: 'VA disponível', color: 'var(--teal-soft)' }, { name: 'VA usado', color: 'var(--teal)' }]} />
        {vaCats.length > 0 && <p class="muted small">No mês: {vaCats.map((c) => `${c.label} ${money(c.value)}`).join(' · ')}</p>}
      </Card>

      <Card title="Exportar" class="no-print">
        <div class="stack-sm">
          <button class="btn soft block" type="button" onClick={exportCSV}><Icon name="download" size={18} /> CSV das movimentações do mês</button>
          <button class="btn ghost block" type="button" onClick={exportAll}><Icon name="download" size={18} /> CSV de todas as movimentações</button>
          <button class="btn ghost block" type="button" onClick={exportBills}><Icon name="download" size={18} /> CSV das contas do mês</button>
          <button class="btn ghost block" type="button" onClick={() => window.print()}><Icon name="printer" size={18} /> Resumo para imprimir / PDF</button>
        </div>
        <p class="muted small">CSV com “;” e vírgula decimal — abre direto no Excel em português.</p>
      </Card>
    </div>
  );
}
