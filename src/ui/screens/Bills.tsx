import { useState } from 'preact/hooks';
import { useData, act } from '../../store/store';
import * as calc from '../../domain/calc';
import * as ops from '../../domain/ops';
import { addDays, dateInMonth, daysInMonth, fmtDate, fromISO, monthLabel, monthOf, relativeDay, today } from '../../domain/dates';
import { pctLabel } from '../../domain/money';
import type { Bill } from '../../domain/types';
import { money } from '../format';
import { Icon } from '../icons';
import { Badge, Card, confirmDialog, Empty, MonthBar, PageHeader, Progress, Segmented, Sheet, toast } from '../components/kit';
import { BILL_SOURCE_LABEL, BillForm, KIND_LABEL, PayBillSheet, REC_LABEL } from '../components/forms';
import { useMonth, navigate, parseRoute } from '../state';

type Filter = 'pendentes' | 'atrasadas' | 'mes' | 'pagas';

export function Bills() {
  const d = useData();
  const [month, setMonth] = useMonth();
  const t = today();
  const initialF = (parseRoute().query.get('f') as Filter) || 'pendentes';
  const [filter, setFilter] = useState<Filter>(initialF);
  const [src, setSrc] = useState<'todas' | Bill['source']>('todas');
  const [view, setView] = useState<'lista' | 'calendario'>('lista');
  const [form, setForm] = useState<{ open: boolean; bill?: Bill; defaults?: Partial<Bill> }>({ open: false });
  const [pay, setPay] = useState<Bill | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const commit = calc.salaryCommitment(d, month);
  const buckets = calc.billBuckets(d, t);
  const bySrc = (b: Bill) => src === 'todas' || b.source === src;

  let rows: Bill[] = [];
  if (filter === 'pendentes') rows = d.bills.filter((b) => b.status === 'pendente');
  if (filter === 'atrasadas') rows = buckets.overdue;
  if (filter === 'mes') rows = d.bills.filter((b) => monthOf(b.dueDate) === month);
  if (filter === 'pagas') rows = d.bills.filter((b) => b.status === 'paga' && monthOf(b.paidDate || b.dueDate) === month);
  rows = rows.filter(bySrc).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const groups: { title: string; items: Bill[]; tone?: string }[] = filter === 'pendentes'
    ? [
      { title: 'Atrasadas', items: rows.filter((b) => b.dueDate < t), tone: 'danger' },
      { title: 'Hoje', items: rows.filter((b) => b.dueDate === t), tone: 'warn' },
      { title: 'Próximos 30 dias', items: rows.filter((b) => b.dueDate > t && b.dueDate <= addDays(t, 30)) },
      { title: 'Mais adiante', items: rows.filter((b) => b.dueDate > addDays(t, 30)) },
    ]
    : [{ title: '', items: rows }];
  const current = d.bills.find((b) => b.id === detail) || null;

  return (
    <div class="page">
      <PageHeader title="Contas e lembretes" subtitle="O que vem por aí, sem surpresas" right={<button class="btn primary small" type="button" onClick={() => setForm({ open: true })}><Icon name="plus" size={18} /> Nova</button>} />

      <div class="stats3">
        <button type="button" class={`stat as-btn ${buckets.overdue.length ? 'neg' : ''}`} onClick={() => setFilter('atrasadas')}><span>Atrasadas</span><strong>{buckets.overdue.length}</strong><small>{money(calc.sum(buckets.overdue, (b) => b.amount))}</small></button>
        <button type="button" class="stat as-btn" onClick={() => setFilter('pendentes')}><span>Hoje</span><strong>{buckets.today.length}</strong><small>{money(calc.sum(buckets.today, (b) => b.amount))}</small></button>
        <button type="button" class="stat as-btn" onClick={() => setFilter('pendentes')}><span>Próx. 30 dias</span><strong>{buckets.upcoming.length}</strong><small>{money(calc.sum(buckets.upcoming, (b) => b.amount))}</small></button>
      </div>

      <MonthBar month={month} onChange={setMonth} />
      <Card title={`Salário comprometido · ${monthLabel(month, true)}`}>
        <div class="row between baseline"><p class="big-num">{pctLabel(commit.pct)}</p><p class="small muted">{money(commit.committed)} de {money(commit.salary)}</p></div>
        <Progress value={commit.pct} tone={commit.pct > 90 ? 'danger' : commit.pct > 70 ? 'warn' : 'teal'} label="Salário comprometido" />
        <p class="small">Sobra estimada: <b class={commit.leftover >= 0 ? 'pos' : 'neg'}>{money(commit.leftover)}</b> <span class="muted">(Estimativa: salário − contas do salário no mês)</span></p>
      </Card>

      <Segmented name="Visualização" value={view} onChange={setView} options={[{ value: 'lista', label: 'Lista' }, { value: 'calendario', label: 'Calendário' }]} />

      {view === 'lista' ? (
        <>
          <div class="chips">
            {([['pendentes', 'Pendentes'], ['atrasadas', 'Atrasadas'], ['mes', 'Do mês'], ['pagas', 'Pagas no mês']] as const).map(([v, l]) => <button type="button" class={`chip ${filter === v ? 'on' : ''}`} onClick={() => setFilter(v)}>{l}</button>)}
          </div>
          <div class="chips">
            {(['todas', 'salario', 'va', 'outra'] as const).map((v) => <button type="button" class={`chip small ${src === v ? 'on' : ''}`} onClick={() => setSrc(v)}>{v === 'todas' ? 'Todas origens' : BILL_SOURCE_LABEL[v]}</button>)}
          </div>
          {rows.length === 0 ? (
            <Card><Empty icon="calendar" title={filter === 'atrasadas' ? 'Nada atrasado 🎉' : 'Nenhuma conta por aqui'} text="Cadastre contas futuras — aluguel, internet, parcelas, aquela compra planejada — e o app lembra você antes do vencimento."
              action={<button class="btn primary" type="button" onClick={() => setForm({ open: true })}>Cadastrar conta</button>} /></Card>
          ) : groups.filter((g) => g.items.length).map((g) => (
            <Card title={g.title || undefined} class={g.tone ? `group-${g.tone}` : ''}>
              <ul class="list">{g.items.map((b) => <BillRow b={b} t={t} onPay={() => setPay(b)} onOpen={() => setDetail(b.id)} />)}</ul>
            </Card>
          ))}
        </>
      ) : (
        <Calendar month={month} bills={d.bills.filter(bySrc)} t={t} day={day} setDay={setDay} onOpen={(b) => setDetail(b.id)} onPay={(b) => setPay(b)} />
      )}

      <p class="muted small center">Lembretes: {d.settings.notifications ? `ativos (no dia e ${d.settings.notifyDaysBefore} dia(s) antes)` : 'só dentro do app'} · <button class="link" type="button" onClick={() => navigate('perfil')}>configurar</button></p>

      <BillForm open={form.open} initial={form.bill} defaults={form.defaults} onClose={() => setForm({ open: false })} />
      <PayBillSheet bill={pay} onClose={() => setPay(null)} />
      <BillDetail bill={current} onClose={() => setDetail(null)} onEdit={(b) => { setDetail(null); setForm({ open: true, bill: b }); }} onPay={(b) => { setDetail(null); setPay(b); }} />
    </div>
  );
}

function BillRow({ b, t, onPay, onOpen }: { b: Bill; t: string; onPay: () => void; onOpen: () => void }) {
  const late = b.status === 'pendente' && b.dueDate < t;
  return (
    <li class={`list-item bill ${b.status} ${late ? 'late' : ''}`}>
      <div class="date-chip" onClick={onOpen}><b>{b.dueDate.slice(8)}/{b.dueDate.slice(5, 7)}</b><span>{b.status === 'pendente' ? relativeDay(b.dueDate, t, true) : b.status}</span></div>
      <div class="grow" onClick={onOpen}>
        <p class="title">{b.name}</p>
        <p class="muted small">{KIND_LABEL[b.kind]}{b.seriesId ? ` · ${REC_LABEL[b.recurrence]}` : ''} · {BILL_SOURCE_LABEL[b.source]}</p>
      </div>
      <div class="right">
        <b class={b.status === 'paga' ? 'muted' : 'neg'}>{money(b.status === 'paga' ? b.paidAmount ?? b.amount : b.amount)}</b>
        <div>{b.status === 'pendente' ? <button class="btn tiny primary" type="button" onClick={onPay}>Pagar</button> : b.status === 'paga' ? <Badge tone="ok">Paga</Badge> : <Badge tone="muted">Cancelada</Badge>}</div>
      </div>
    </li>
  );
}

function Calendar({ month, bills, t, day, setDay, onOpen, onPay }: { month: string; bills: Bill[]; t: string; day: string | null; setDay: (d: string | null) => void; onOpen: (b: Bill) => void; onPay: (b: Bill) => void }) {
  const [y, m] = month.split('-').map(Number);
  const n = daysInMonth(y, m);
  const first = fromISO(`${month}-01`).getDay();
  const inMonth = bills.filter((b) => monthOf(b.dueDate) === month && b.status !== 'cancelada');
  const cells: (string | null)[] = [...Array(first).fill(null), ...Array.from({ length: n }, (_, i) => dateInMonth(month, i + 1))];
  const sel = day && monthOf(day) === month ? day : null;
  const list = sel ? inMonth.filter((b) => b.dueDate === sel) : inMonth;
  return (
    <Card>
      <div class="cal" role="grid" aria-label={`Calendário de ${monthLabel(month)}`}>
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((w) => <span class="cal-w">{w}</span>)}
        {cells.map((c) => {
          if (!c) return <span />;
          const its = inMonth.filter((b) => b.dueDate === c);
          const late = its.some((b) => b.status === 'pendente' && b.dueDate < t);
          const pend = its.some((b) => b.status === 'pendente');
          return (
            <button type="button" class={`cal-d ${c === t ? 'today' : ''} ${sel === c ? 'sel' : ''}`} aria-label={`${fmtDate(c)}: ${its.length} conta(s)`} onClick={() => setDay(sel === c ? null : c)}>
              {Number(c.slice(8))}
              {its.length > 0 && <i class={late ? 'late' : pend ? 'pend' : 'paid'} />}
            </button>
          );
        })}
      </div>
      <p class="muted small">{sel ? `Contas de ${fmtDate(sel)}` : `Todas as contas de ${monthLabel(month)}`} · <i class="dot pend" /> pendente <i class="dot late" /> atrasada <i class="dot paid" /> paga</p>
      {list.length === 0 ? <p class="muted center pad">Nenhuma conta {sel ? 'neste dia' : 'neste mês'}.</p> : <ul class="list">{list.map((b) => <BillRow b={b} t={t} onPay={() => onPay(b)} onOpen={() => onOpen(b)} />)}</ul>}
    </Card>
  );
}

function BillDetail({ bill, onClose, onEdit, onPay }: { bill: Bill | null; onClose: () => void; onEdit: (b: Bill) => void; onPay: (b: Bill) => void }) {
  if (!bill) return null;
  const run = (fn: Parameters<typeof act>[0], msg: string) => { const e = act(fn); if (e) toast(e, 'err'); else { toast(msg); onClose(); } };
  const del = async () => {
    if (await confirmDialog({ title: `Excluir "${bill.name}"?`, text: bill.status === 'paga' ? 'O lançamento do pagamento também será removido.' : bill.seriesId ? 'Só esta ocorrência será excluída; as próximas continuam.' : undefined, ok: 'Excluir', danger: true })) run((d) => ops.deleteBill(d, bill.id), 'Conta excluída');
  };
  const endRec = async () => {
    if (await confirmDialog({ title: 'Encerrar a recorrência?', text: `Esta conta (${fmtDate(bill.dueDate)}) será a última. Ocorrências futuras pendentes serão removidas.`, ok: 'Encerrar' })) run((d) => ops.endSeries(d, bill.seriesId!, bill.dueDate), 'Recorrência encerrada');
  };
  const delGroup = async () => {
    if (await confirmDialog({ title: 'Excluir parcelas pendentes?', text: 'As parcelas já pagas continuam no histórico.', ok: 'Excluir', danger: true })) run((d) => ops.deleteInstallmentGroup(d, bill.installment!.groupId), 'Parcelas excluídas');
  };
  return (
    <Sheet open title={bill.name} onClose={onClose}>
      <dl class="details">
        <div><dt>Valor previsto</dt><dd>{money(bill.amount)}</dd></div>
        <div><dt>Vencimento</dt><dd>{fmtDate(bill.dueDate)}</dd></div>
        {bill.status === 'paga' && <div><dt>Pago</dt><dd>{money(bill.paidAmount ?? bill.amount)} em {fmtDate(bill.paidDate)}</dd></div>}
        <div><dt>Categoria</dt><dd>{bill.category}</dd></div>
        <div><dt>Pagar com</dt><dd>{BILL_SOURCE_LABEL[bill.source]}</dd></div>
        <div><dt>Tipo</dt><dd>{KIND_LABEL[bill.kind]}{bill.installment ? ` ${bill.installment.n}/${bill.installment.total}` : ''}</dd></div>
        <div><dt>Recorrência</dt><dd>{REC_LABEL[bill.recurrence]}</dd></div>
        <div><dt>Status</dt><dd>{bill.status}</dd></div>
        {bill.notes && <div><dt>Observações</dt><dd>{bill.notes}</dd></div>}
      </dl>
      <div class="stack-sm">
        {bill.status === 'pendente' && <button class="btn primary block" type="button" onClick={() => onPay(bill)}>Marcar como paga</button>}
        {bill.status === 'paga' && <button class="btn soft block" type="button" onClick={() => run((d) => ops.unpayBill(d, bill.id), 'Pagamento desfeito')}>Desfazer pagamento</button>}
        <button class="btn ghost block" type="button" onClick={() => onEdit(bill)}><Icon name="edit" size={18} /> Editar</button>
        {bill.status !== 'cancelada' ? <button class="btn ghost block" type="button" onClick={() => run((d) => ops.cancelBill(d, bill.id), 'Conta cancelada')}>Cancelar conta</button>
          : <button class="btn ghost block" type="button" onClick={() => run((d) => ops.reactivateBill(d, bill.id), 'Conta reativada')}>Reativar</button>}
        {bill.seriesId && <button class="btn ghost block" type="button" onClick={endRec}><Icon name="repeat" size={18} /> Encerrar recorrência aqui</button>}
        {bill.installment && <button class="btn ghost block danger-text" type="button" onClick={delGroup}>Excluir parcelas pendentes</button>}
        <button class="btn ghost block danger-text" type="button" onClick={del}><Icon name="trash" size={18} /> Excluir</button>
      </div>
    </Sheet>
  );
}
