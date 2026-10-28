import { useState } from 'preact/hooks';
import { useData, act } from '../../store/store';
import * as calc from '../../domain/calc';
import * as ops from '../../domain/ops';
import { addMonth, currentMonth, fmtDate, monthLabel } from '../../domain/dates';
import { parseMoney, pctLabel } from '../../domain/money';
import { money } from '../format';
import { Icon } from '../icons';
import { Badge, Card, Field, MoneyInput, moneyStr, PageHeader, Progress, Sheet, toast } from '../components/kit';
import { BarChart } from '../components/charts';
import { BillForm } from '../components/forms';

export function Planning() {
  const d = useData();
  const [edit, setEdit] = useState<string | null>(null);
  const [inst, setInst] = useState(false);
  const cm = currentMonth();
  const months = Array.from({ length: 6 }, (_, i) => addMonth(cm, i));
  const proj = months.map((m) => calc.projection(d, m));
  const av = calc.availableToday(d);
  const groups = new Map<string, { name: string; left: number; total: number; next?: string; value: number }>();
  for (const b of d.bills) {
    if (!b.installment) continue;
    const g = groups.get(b.installment.groupId) || { name: b.name.replace(/ \(\d+\/\d+\)$/, ''), left: 0, total: b.installment.total, value: b.amount };
    if (b.status === 'pendente') { g.left++; if (!g.next || b.dueDate < g.next) g.next = b.dueDate; }
    groups.set(b.installment.groupId, g);
  }
  return (
    <div class="page">
      <PageHeader back title="Planejamento" subtitle="Próximos meses — valores são estimativas" />
      <Card class="tint-emerald">
        <p class="muted small">Até o próximo recebimento ({fmtDate(av.payday)})</p>
        <p class="big-num pos">{money(av.available)}</p>
        <p class="small">sobra depois das contas pendentes · {av.days} dia(s)</p>
      </Card>

      <Card title="Saldo previsto por mês" action={<Badge tone="teal">Estimativa</Badge>}>
        <BarChart data={proj.map((p) => ({ label: monthLabel(p.month, true), values: [p.income, p.expenses] }))} series={[{ name: 'Receitas previstas', color: 'var(--emerald)' }, { name: 'Despesas previstas', color: 'var(--teal-soft)' }]} />
      </Card>

      {proj.map((p) => (
        <Card title={monthLabel(p.month)} action={<div class="row"><Badge tone="teal">Estimativa</Badge><button class="icon-btn" type="button" aria-label={`Editar orçamento de ${monthLabel(p.month)}`} onClick={() => setEdit(p.month)}><Icon name="edit" size={18} /></button></div>}>
          <dl class="plan-grid">
            <dt>Salário</dt><dd>{money(p.salary)}</dd>
            <dt>Rendas extras</dt><dd>{money(p.extras)}</dd>
            <dt>Contas fixas</dt><dd class="neg">{money(p.fixed)}</dd>
            <dt>Parcelas</dt><dd class="neg">{money(p.installments)}</dd>
            <dt>Compras planejadas</dt><dd class="neg">{money(p.purchases + p.eventual + p.otherPlanned)}</dd>
            <dt>Gastos variáveis</dt><dd class="neg">{money(p.variable)}</dd>
            <dt class="strong">Saldo previsto</dt><dd class={`strong ${p.balance >= 0 ? 'pos' : 'neg'}`}>{money(p.balance)}</dd>
          </dl>
          <Progress value={p.committedPct} tone={p.committedPct > 90 ? 'danger' : p.committedPct > 70 ? 'warn' : 'teal'} label="Comprometido" />
          <p class="small muted">{pctLabel(p.committedPct)} comprometido · disponível para poupar {money(p.canSave)}{p.savingsGoal ? ` · meta ${money(p.savingsGoal)} ${p.afterGoal >= 0 ? '✓' : '(faltaria ' + money(-p.afterGoal) + ')'}` : ''}</p>
          {p.month === cm && (
            <div class="realized">
              <p class="small"><b>Realizado até agora</b></p>
              <p class="small">Receitas {money(p.realized.income)} · Despesas {money(p.realized.expenses)} · Reserva {money(p.realized.reserve)}</p>
            </div>
          )}
        </Card>
      ))}

      <Card title="Parcelamentos" action={<button class="btn soft small" type="button" onClick={() => setInst(true)}><Icon name="plus" size={16} /> Parcela</button>}>
        {groups.size === 0 ? <p class="muted">Nenhum parcelamento. Cadastre compras parceladas para ver o impacto nos próximos meses.</p> : (
          <ul class="list">{[...groups.values()].map((g) => <li class="list-item"><div class="grow"><p class="title">{g.name}</p><p class="muted small">{g.left} de {g.total} restantes{g.next ? ` · próxima ${fmtDate(g.next)}` : ''}</p></div><b>{money(g.value)}</b></li>)}</ul>
        )}
      </Card>

      <PlanSheet month={edit} onClose={() => setEdit(null)} />
      <BillForm open={inst} defaults={{ kind: 'parcela', category: 'Parcelas', recurrence: 'nenhuma' }} onClose={() => setInst(false)} />
    </div>
  );
}

function PlanSheet({ month, onClose }: { month: string | null; onClose: () => void }) {
  const d = useData();
  const plan = month ? calc.planFor(d, month) : null;
  const [v, setV] = useState({ extras: '', variable: '', savingsGoal: '' });
  const [all, setAll] = useState(false);
  const [lastMonth, setLast] = useState<string | null>(null);
  if (month !== lastMonth) { setLast(month); if (plan) setV({ extras: moneyStr(plan.extras), variable: moneyStr(plan.variable), savingsGoal: moneyStr(plan.savingsGoal) }); }
  if (!month) return null;
  const save = (e: Event) => {
    e.preventDefault();
    const p = { extras: v.extras ? parseMoney(v.extras) : 0, variable: v.variable ? parseMoney(v.variable) : 0, savingsGoal: v.savingsGoal ? parseMoney(v.savingsGoal) : 0 };
    if (Object.values(p).some((x) => isNaN(x) || x < 0)) return toast('Valores inválidos', 'err');
    const msg = act((x) => {
      let y = ops.setPlan(x, month, p);
      if (all) y = { ...y, settings: { ...y.settings, defaultVariable: p.variable, defaultSavingsGoal: p.savingsGoal } };
      return y;
    });
    if (msg) return toast(msg, 'err');
    toast('Orçamento salvo'); onClose();
  };
  return (
    <Sheet open title={`Orçamento · ${monthLabel(month)}`} onClose={onClose}>
      <form class="stack" onSubmit={save}>
        <Field label="Rendas extras previstas"><MoneyInput name="extras" value={v.extras} onChange={(x) => setV({ ...v, extras: x })} /></Field>
        <Field label="Gastos variáveis (mercado, lazer, transporte…)" hint="Quanto você imagina gastar fora das contas cadastradas."><MoneyInput name="variaveis" value={v.variable} onChange={(x) => setV({ ...v, variable: x })} /></Field>
        <Field label="Meta de economia do mês"><MoneyInput name="meta" value={v.savingsGoal} onChange={(x) => setV({ ...v, savingsGoal: x })} /></Field>
        <label class="check"><input type="checkbox" checked={all} onChange={(e) => setAll((e.target as HTMLInputElement).checked)} /> Usar variáveis e meta como padrão para os outros meses</label>
        <p class="muted small">Salário, contas fixas e parcelas vêm automaticamente das suas contas cadastradas.</p>
        <button class="btn primary block" type="submit">Salvar</button>
      </form>
    </Sheet>
  );
}
