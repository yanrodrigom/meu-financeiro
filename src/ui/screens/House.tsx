import { useState } from 'preact/hooks';
import { useData, act } from '../../store/store';
import * as calc from '../../domain/calc';
import * as ops from '../../domain/ops';
import { fmtDate, monthOf } from '../../domain/dates';
import type { Movement } from '../../domain/types';
import { money } from '../format';
import { Icon } from '../icons';
import { Badge, Card, Empty, MonthBar, PageHeader, Segmented, Stat, toast } from '../components/kit';
import { MovementForm, STATUS_LABEL } from '../components/forms';
import { useMonth, navigate } from '../state';

export function House() {
  const d = useData();
  const [month, setMonth] = useMonth();
  const [tab, setTab] = useState<'despesa' | 'receita'>('despesa');
  const [filter, setFilter] = useState<'todas' | 'abertas' | 'feitas'>('todas');
  const [form, setForm] = useState<{ open: boolean; m?: Movement; type?: 'despesa' | 'receita' }>({ open: false });
  const s = calc.monthSummary(d, month);
  const rows = d.movements
    .filter((m) => monthOf(m.date) === month && m.source !== 'va' && m.type === tab)
    .filter((m) => filter === 'todas' || (filter === 'abertas' ? calc.isOpen(m.status) : calc.isDone(m.status)))
    .sort((a, b) => b.date.localeCompare(a.date));
  const fixed = calc.sum(rows.filter((m) => m.recurrence === 'fixa'), (m) => m.amount);
  const variable = calc.sum(rows.filter((m) => m.recurrence !== 'fixa'), (m) => m.amount);
  const done = (m: Movement) => { act((x) => ops.markMovementDone(x, m.id)); toast(m.type === 'receita' ? 'Marcada como recebida' : 'Marcada como paga'); };

  return (
    <div class="page">
      <PageHeader title="Casa" subtitle="Salário, receitas e despesas da casa" />
      <MonthBar month={month} onChange={setMonth} />
      <div class="stats3">
        <Stat label="Recebido" value={money(s.incomeDone)} tone="pos" sub={s.incomeOpen ? `${money(s.incomeOpen)} previsto` : undefined} />
        <Stat label="Pago" value={money(s.expenseDone)} tone="neg" sub={s.expenseOpen ? `${money(s.expenseOpen)} a pagar` : undefined} />
        <Stat label="Sobra" value={money(s.result)} tone={s.result >= 0 ? 'pos' : 'neg'} sub="realizado" />
      </div>
      {s.billsPendingCount > 0 && (
        <button type="button" class="action-card warn as-btn" onClick={() => navigate('contas')}>
          <Icon name="bill" /><p>{s.billsPendingCount} conta(s) deste mês ainda em aberto ({money(s.billsPendingTotal)}).</p><Icon name="chevronR" />
        </button>
      )}
      <Segmented name="Receitas ou despesas" value={tab} onChange={setTab} options={[{ value: 'despesa', label: 'Despesas' }, { value: 'receita', label: 'Receitas' }]} />
      <div class="row between">
        <div class="chips">
          {(['todas', 'abertas', 'feitas'] as const).map((f) => <button type="button" class={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>{f === 'todas' ? 'Todas' : f === 'abertas' ? 'Previstas/pendentes' : tab === 'receita' ? 'Recebidas' : 'Pagas'}</button>)}
        </div>
      </div>
      <Card>
        {rows.length === 0 ? (
          <Empty icon="house" title={tab === 'receita' ? 'Nenhuma receita aqui' : 'Nenhuma despesa aqui'} text={tab === 'receita' ? 'Registre salário, renda extra ou outros valores que entraram.' : 'Anote aluguel, luz, mercado no dinheiro… Fixas e variáveis, previstas ou pagas.'}
            action={<button class="btn primary" type="button" onClick={() => setForm({ open: true, type: tab })}>Adicionar {tab === 'receita' ? 'receita' : 'despesa'}</button>} />
        ) : (
          <>
            <p class="muted small">Fixas {money(fixed)} · Variáveis {money(variable)}</p>
            <ul class="list">
              {rows.map((m) => (
                <li class="list-item">
                  <div class={`cat-dot ${m.type}`}><Icon name={m.type === 'receita' ? 'arrowDown' : 'arrowUp'} size={16} /></div>
                  <div class="grow" onClick={() => setForm({ open: true, m })}>
                    <p class="title">{m.description}</p>
                    <p class="muted small">{fmtDate(m.date)} · {m.category}{m.recurrence === 'fixa' ? ' · fixa' : ''}{m.paymentMethod ? ` · ${m.paymentMethod}` : ''}</p>
                  </div>
                  <div class="right">
                    <b class={m.type === 'receita' ? 'pos' : 'neg'}>{money(m.amount)}</b>
                    <div>{calc.isOpen(m.status) ? <button class="btn tiny" type="button" onClick={() => done(m)}>{m.type === 'receita' ? 'Recebi' : 'Paguei'}</button> : <Badge tone="ok">{m.type === 'receita' && m.status === 'realizada' ? 'Recebida' : STATUS_LABEL[m.status]}</Badge>}</div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <div class="row gap sticky-actions">
        <button class="btn soft grow" type="button" onClick={() => setForm({ open: true, type: 'receita' })}><Icon name="plus" size={18} /> Receita</button>
        <button class="btn primary grow" type="button" onClick={() => setForm({ open: true, type: 'despesa' })}><Icon name="plus" size={18} /> Despesa</button>
      </div>
      <MovementForm open={form.open} initial={form.m} defaults={form.type ? { type: form.type, status: form.type === 'receita' ? 'realizada' : 'paga', category: form.type === 'receita' ? 'Salário líquido' : 'Outros' } : undefined} onClose={() => setForm({ open: false })} />
    </div>
  );
}
