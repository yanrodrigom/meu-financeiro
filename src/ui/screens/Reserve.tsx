import { useState } from 'preact/hooks';
import { useData, act } from '../../store/store';
import * as calc from '../../domain/calc';
import * as ops from '../../domain/ops';
import { fmtDate, today } from '../../domain/dates';
import { parseMoney, pctLabel } from '../../domain/money';
import { money } from '../format';
import { Icon } from '../icons';
import { Badge, Card, confirmDialog, Field, MoneyInput, moneyStr, PageHeader, Progress, Segmented, Sheet, toast } from '../components/kit';

export function Reserve() {
  const d = useData();
  const r = calc.reserveStatus(d);
  const [move, setMove] = useState<null | 'deposito' | 'retirada'>(null);
  const [cfg, setCfg] = useState(false);
  return (
    <div class="page">
      <PageHeader back title="Reserva de emergência" subtitle="Seu colchão para imprevistos" />
      <section class="hero teal">
        <p class="hero-label">Guardado</p>
        <p class="hero-value" data-testid="reserva-total">{money(r.accumulated)}</p>
        <Progress value={r.pct} tone="emerald" label="Progresso da reserva" />
        <p class="hero-sub">{r.target ? `${pctLabel(r.pct)} de ${money(r.target)}` : 'Defina sua meta para acompanhar o progresso.'}{r.coverMonths ? ` · cobre ${r.coverMonths.toLocaleString('pt-BR')} mês(es) de gastos essenciais` : ''}</p>
      </section>
      <div class="row gap">
        <button class="btn primary grow" type="button" onClick={() => setMove('deposito')}><Icon name="plus" size={18} /> Guardar</button>
        <button class="btn soft grow" type="button" onClick={() => setMove('retirada')}><Icon name="minus" size={18} /> Retirar</button>
      </div>
      <Card title="Meta" action={<button class="icon-btn" type="button" aria-label="Configurar reserva" onClick={() => setCfg(true)}><Icon name="edit" size={18} /></button>}>
        <dl class="plan-grid">
          <dt>Gastos essenciais/mês</dt><dd>{money(d.reserve.essentialMonthly)}</dd>
          <dt>Meta</dt><dd>{d.reserve.customTarget ? `${money(r.target)} (personalizada)` : `${d.reserve.targetMonths} meses = ${money(r.byMonths)}`}</dd>
          <dt>Falta</dt><dd class="neg">{money(r.missing)}</dd>
          <dt>Contribuição mensal</dt><dd>{money(d.reserve.monthlyContribution)}</dd>
          {d.reserve.deadline && <><dt>Prazo</dt><dd>{fmtDate(d.reserve.deadline)}</dd></>}
          <dt>Sugestão por mês</dt><dd class="pos">{money(r.suggested)}{r.monthsToDeadline ? ` (${r.monthsToDeadline} meses até o prazo)` : ''}</dd>
          <dt>Tempo estimado</dt><dd>{r.missing === 0 ? 'Meta alcançada 🎉' : r.monthsEstimate ? `${r.monthsEstimate} mês(es) · Estimativa` : 'Defina uma contribuição mensal'}</dd>
        </dl>
      </Card>
      <Card title="Referências">
        <div class="refs">
          {r.references.map((x) => (
            <div class={`ref ${x.reached ? 'ok' : ''}`}><b>{x.months} meses</b><span>{money(x.value)}</span>{x.reached ? <Badge tone="ok">alcançado</Badge> : <Badge tone="muted">{x.value ? pctLabel(Math.min(100, Math.round((r.accumulated / x.value) * 1000) / 10)) : '—'}</Badge>}</div>
          ))}
        </div>
        <p class="muted small">Muita gente começa mirando 3 meses e vai ampliando. Cada depósito conta.</p>
      </Card>
      <Card title="Histórico">
        {r.history.length === 0 ? <p class="muted">Seus depósitos e retiradas aparecem aqui. Guardar para a reserva não conta como gasto — só sai do saldo da conta.</p> : (
          <ul class="list">
            {r.history.map((m) => (
              <li class="list-item">
                <div class={`cat-dot ${m.type === 'reserva_deposito' ? 'receita' : 'despesa'}`}><Icon name={m.type === 'reserva_deposito' ? 'arrowDown' : 'arrowUp'} size={16} /></div>
                <div class="grow"><p class="title">{m.type === 'reserva_deposito' ? 'Depósito' : 'Retirada'}</p><p class="muted small">{fmtDate(m.date)}{m.notes ? ` · ${m.notes}` : ''}</p></div>
                <b class={m.type === 'reserva_deposito' ? 'pos' : 'neg'}>{m.type === 'reserva_deposito' ? '+' : '−'} {money(m.amount)}</b>
                <button class="icon-btn subtle" type="button" aria-label="Excluir" onClick={async () => { if (await confirmDialog({ title: 'Excluir este registro?', ok: 'Excluir', danger: true })) act((x) => ops.deleteMovement(x, m.id)); }}><Icon name="trash" size={17} /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <MoveSheet kind={move} current={r.accumulated} onClose={() => setMove(null)} />
      <ConfigSheet open={cfg} onClose={() => setCfg(false)} />
    </div>
  );
}

function MoveSheet({ kind, current, onClose }: { kind: null | 'deposito' | 'retirada'; current: number; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');
  if (!kind) return null;
  const save = (e: Event) => {
    e.preventDefault();
    const c = parseMoney(amount);
    if (!(c > 0)) return setErr('Informe um valor maior que zero.');
    const msg = act((x) => ops.reserveMove(x, kind, c, date, notes || undefined, current));
    if (msg) return setErr(msg);
    toast(kind === 'deposito' ? 'Guardado na reserva 💚' : 'Retirada registrada');
    setAmount(''); setNotes(''); setErr(''); onClose();
  };
  return (
    <Sheet open title={kind === 'deposito' ? 'Guardar na reserva' : 'Retirar da reserva'} onClose={onClose}>
      <form class="stack" onSubmit={save}>
        <Field label="Valor" error={err}><MoneyInput big name="valor-reserva" value={amount} onChange={setAmount} autoFocus /></Field>
        <Field label="Data"><input type="date" name="data" value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} /></Field>
        <Field label="Observação"><input name="obs" value={notes} onInput={(e) => setNotes((e.target as HTMLInputElement).value)} /></Field>
        <p class="muted small">{kind === 'deposito' ? 'O valor sai do saldo da conta, mas não entra como despesa de consumo.' : 'O valor volta para o saldo da conta.'}</p>
        <button class="btn primary block" type="submit">Confirmar</button>
      </form>
    </Sheet>
  );
}

function ConfigSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useData();
  const r = d.reserve;
  const [v, setV] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<'meses' | 'valor'>('meses');
  const [was, setWas] = useState(false);
  if (open && !was) { setWas(true); setMode(r.customTarget ? 'valor' : 'meses'); setV({ initialAmount: moneyStr(r.initialAmount), targetMonths: String(r.targetMonths), essentialMonthly: moneyStr(r.essentialMonthly), monthlyContribution: moneyStr(r.monthlyContribution), customTarget: moneyStr(r.customTarget), deadline: r.deadline || '' }); }
  if (!open) { if (was) setWas(false); return null; }
  const m = (k: string) => (v[k] ? parseMoney(v[k]) : 0);
  const save = (e: Event) => {
    e.preventDefault();
    const msg = act((x) => ops.setReserveConfig(x, { initialAmount: m('initialAmount'), targetMonths: parseInt(v.targetMonths || '6', 10), essentialMonthly: m('essentialMonthly'), monthlyContribution: m('monthlyContribution'), customTarget: mode === 'valor' ? m('customTarget') : undefined, deadline: v.deadline || undefined }));
    if (msg) return toast(msg, 'err');
    toast('Reserva atualizada'); onClose();
  };
  const f = (k: string) => (x: string) => setV({ ...v, [k]: x });
  return (
    <Sheet open title="Configurar reserva" onClose={onClose}>
      <form class="stack" onSubmit={save}>
        <Field label="Valor que já estava guardado (antes do app)"><MoneyInput name="inicial" value={v.initialAmount} onChange={f('initialAmount')} /></Field>
        <Field label="Gastos essenciais por mês" hint="Moradia, contas, mercado, transporte, saúde."><MoneyInput name="essenciais" value={v.essentialMonthly} onChange={f('essentialMonthly')} /></Field>
        <Segmented name="Tipo de meta" value={mode} onChange={setMode} options={[{ value: 'meses', label: 'Meta em meses' }, { value: 'valor', label: 'Valor personalizado' }]} />
        {mode === 'meses' ? <Field label="Quantos meses de gastos essenciais"><input name="meses" type="number" min={1} max={60} inputMode="numeric" value={v.targetMonths} onInput={(e) => f('targetMonths')((e.target as HTMLInputElement).value)} /></Field>
          : <Field label="Meta personalizada"><MoneyInput name="meta" value={v.customTarget} onChange={f('customTarget')} /></Field>}
        <div class="grid2">
          <Field label="Contribuição mensal"><MoneyInput name="contribuicao" value={v.monthlyContribution} onChange={f('monthlyContribution')} /></Field>
          <Field label="Prazo (opcional)"><input type="date" name="prazo" value={v.deadline} onInput={(e) => f('deadline')((e.target as HTMLInputElement).value)} /></Field>
        </div>
        <button class="btn primary block" type="submit">Salvar</button>
      </form>
    </Sheet>
  );
}
