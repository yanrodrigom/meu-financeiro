import { useState } from 'preact/hooks';
import { useData, act } from '../../store/store';
import * as calc from '../../domain/calc';
import * as ops from '../../domain/ops';
import { addDays, currentMonth, fmtDate, fmtShort, monthLabel, relativeDay, today } from '../../domain/dates';
import { pctLabel } from '../../domain/money';
import { money } from '../format';
import { Icon } from '../icons';
import { Card, Fab, MonthBar, Progress, Stat, toast } from '../components/kit';
import { QuickAdd } from '../components/forms';
import { useMonth, navigate } from '../state';

export function Home() {
  const d = useData();
  const [month, setMonth] = useMonth();
  const [quick, setQuick] = useState(false);
  const t = today();
  const av = calc.availableToday(d, t);
  const sum = calc.monthSummary(d, month);
  const va = calc.vaMonth(d, month);
  const res = calc.reserveStatus(d, t);
  const buckets = calc.billBuckets(d, t, 7);
  const salaryMov = d.movements.find((m) => m.originType === 'salario' && m.status === 'prevista' && m.date <= t);
  const upcoming = [
    ...buckets.today, ...buckets.upcoming,
  ].slice(0, 5);
  const openMoves = d.movements.filter((m) => m.type === 'despesa' && calc.isOpen(m.status) && m.date >= t && m.date <= addDays(t, 7)).slice(0, 3);
  const greet = (() => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; })();

  let action: { icon: string; text: string; cta: string; go: () => void; tone: string } | null = null;
  if (buckets.overdue.length) action = { icon: 'alert', tone: 'danger', text: `${buckets.overdue.length} conta(s) passaram do vencimento. Que tal resolver agora?`, cta: 'Ver contas', go: () => navigate('contas?f=atrasadas') };
  else if (salaryMov) action = { icon: 'wallet', tone: 'ok', text: `Seu salário de ${fmtShort(salaryMov.date)} já caiu? Confirme para atualizar o saldo.`, cta: 'Recebi', go: () => { act((x) => ops.markMovementDone(x, salaryMov.id)); toast('Salário confirmado'); } };
  else if (buckets.today.length) action = { icon: 'bell', tone: 'warn', text: `Vence hoje: ${buckets.today.map((b) => b.name).join(', ')}.`, cta: 'Abrir', go: () => navigate('contas') };
  else if (va.alertLevel === 'over' || va.alertLevel === 'warn') action = { icon: 'cart', tone: 'warn', text: va.alertLevel === 'over' ? 'A lista de compras passa do saldo do VA. Vale revisar os itens.' : `Você já usou ${pctLabel(va.usedPct)} do VA deste mês.`, cta: 'Compras', go: () => navigate('compras') };
  else if (d.movements.filter((m) => m.date === t && m.originType === 'manual').length === 0) action = { icon: 'sparkle', tone: 'ok', text: 'Registrou algum gasto hoje? Leva só alguns segundos.', cta: 'Registrar', go: () => setQuick(true) };

  return (
    <div class="page">
      <header class="home-head">
        <div>
          <p class="muted small">{greet}{d.settings.name ? `, ${d.settings.name}` : ''}</p>
          <h1 class="brand">Meu Financeiro</h1>
        </div>
        <div class="row">
          <button class="icon-btn" type="button" aria-label={d.settings.privacy ? 'Mostrar valores' : 'Ocultar valores'} aria-pressed={d.settings.privacy} onClick={() => act((x) => ({ ...x, settings: { ...x.settings, privacy: !x.settings.privacy } }))}><Icon name={d.settings.privacy ? 'eyeOff' : 'eye'} /></button>
          <button class="icon-btn" type="button" aria-label={d.settings.theme === 'dark' ? 'Tema claro' : 'Tema escuro'} onClick={() => act((x) => ({ ...x, settings: { ...x.settings, theme: x.settings.theme === 'dark' ? 'light' : 'dark' } }))}><Icon name={d.settings.theme === 'dark' ? 'sun' : 'moon'} /></button>
        </div>
      </header>

      <section class="hero" aria-label="Meu dinheiro hoje">
        <p class="hero-label">Meu dinheiro hoje</p>
        <p class="hero-value" data-testid="disponivel">{money(av.available)}</p>
        <p class="hero-sub">livre até o pagamento de <b>{fmtDate(av.payday)}</b>{av.available > 0 ? <> · cerca de <b>{money(av.perDay)}</b>/dia</> : null}</p>
        <div class="hero-split">
          <div><span>Saldo em conta</span><b data-testid="saldo-conta">{money(av.balance)}</b></div>
          <div><span>Compromissos até {fmtShort(av.payday)}</span><b>{money(av.committed)}</b></div>
        </div>
      </section>

      {action && (
        <div class={`action-card ${action.tone}`}>
          <Icon name={action.icon} />
          <p>{action.text}</p>
          <button class="btn small" type="button" onClick={action.go}>{action.cta}</button>
        </div>
      )}

      <MonthBar month={month} onChange={setMonth} />

      <div class="stats3">
        <Stat label="Receitas" value={money(sum.incomeDone)} tone="pos" sub={sum.incomeOpen ? `+ ${money(sum.incomeOpen)} previsto` : 'recebido'} />
        <Stat label="Despesas" value={money(sum.expenseDone)} tone="neg" sub="pago (sem VA)" />
        <Stat label="Contas a pagar" value={String(sum.billsPendingCount)} sub={money(sum.billsPendingTotal)} />
      </div>

      <Card class="va-card" title="Vale-alimentação" action={<button class="link" type="button" onClick={() => navigate('compras')}>Compras <Icon name="chevronR" size={16} /></button>}>
        <div class="row between baseline">
          <div><p class="muted small">Saldo do VA em {monthLabel(month, true)}</p><p class="big-num teal" data-testid="va-saldo">{money(va.remaining)}</p></div>
          <div class="right"><p class="muted small">Usado</p><p class="mid-num">{money(va.spent)}</p></div>
        </div>
        <Progress value={va.usedPct} tone={va.alertLevel === 'over' ? 'danger' : va.alertLevel === 'warn' ? 'warn' : 'teal'} label="Uso do VA" />
        <p class="muted small">{va.available ? `${pctLabel(va.usedPct)} de ${money(va.available)}` : 'Configure o valor do VA no Perfil.'} · separado do salário</p>
      </Card>

      <Card title="Próximos 7 dias" action={<button class="link" type="button" onClick={() => navigate('contas')}>Contas <Icon name="chevronR" size={16} /></button>}>
        {buckets.overdue.length > 0 && <p class="pill-note danger">{buckets.overdue.length} atrasada(s) · {money(calc.sum(buckets.overdue, (b) => b.amount))}</p>}
        {upcoming.length === 0 && openMoves.length === 0 ? (
          <p class="muted">Nada vencendo nos próximos dias. Aproveite a tranquilidade 🌿</p>
        ) : (
          <ul class="list">
            {upcoming.map((b) => (
              <li class="list-item" onClick={() => navigate('contas')}>
                <div class="date-chip"><b>{b.dueDate.slice(8)}</b><span>{relativeDay(b.dueDate, t, true)}</span></div>
                <div class="grow"><p class="title">{b.name}</p><p class="muted small">{b.category} · {b.source === 'va' ? 'VA' : b.source === 'salario' ? 'Salário' : 'Outra'}</p></div>
                <b class="neg">{money(b.amount)}</b>
              </li>
            ))}
            {openMoves.map((m) => (
              <li class="list-item" onClick={() => navigate('casa')}>
                <div class="date-chip"><b>{m.date.slice(8)}</b><span>{relativeDay(m.date, t, true)}</span></div>
                <div class="grow"><p class="title">{m.description}</p><p class="muted small">{m.category} · {m.status}</p></div>
                <b class="neg">{money(m.amount)}</b>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Reserva de emergência" onClick={() => navigate('reserva')}>
        <div class="row between baseline">
          <p class="big-num pos">{money(res.accumulated)}</p>
          <p class="muted small">{res.target ? `meta ${money(res.target)}` : 'defina sua meta'}</p>
        </div>
        <Progress value={res.pct} label="Progresso da reserva" />
        <p class="muted small">{res.target ? (res.missing ? `${pctLabel(res.pct)} · faltam ${money(res.missing)}` : 'Meta alcançada! 🎉') : 'Toque para configurar sua meta.'}</p>
      </Card>

      <Card title={`Previsto x realizado · ${monthLabel(month, true)}`}>
        <PvR label="Receitas" planned={sum.incomePlanned} done={sum.incomeDone} tone="emerald" />
        <PvR label="Despesas" planned={sum.expensePlanned} done={sum.expenseDone} tone="danger" />
        <p class="muted small">Previsto inclui contas e lançamentos ainda não pagos. {month === currentMonth() ? '' : 'Mês selecionado no filtro acima.'}</p>
      </Card>

      <div class="fab-space" />
      <Fab onClick={() => setQuick(true)} label="Registrar" />
      <QuickAdd open={quick} onClose={() => setQuick(false)} />
    </div>
  );
}

function PvR({ label, planned, done, tone }: { label: string; planned: number; done: number; tone: 'emerald' | 'danger' }) {
  const pct = planned ? (done / planned) * 100 : 0;
  return (
    <div class="pvr">
      <div class="row between"><span>{label}</span><span class="small"><b>{money(done)}</b> <span class="muted">de {money(planned)}</span></span></div>
      <Progress value={pct} tone={tone === 'danger' ? 'warn' : 'emerald'} label={`${label} realizado`} />
    </div>
  );
}
