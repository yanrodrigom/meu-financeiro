import { useState } from 'preact/hooks';
import { act, replaceAll } from '../../store/store';
import * as ops from '../../domain/ops';
import { demoData } from '../../domain/demo';
import { parseMoney } from '../../domain/money';
import { EXPENSE_CATEGORIES } from '../../domain/categories';
import { brl } from '../../domain/money';
import { Icon } from '../icons';
import { Field, MoneyInput, Select } from '../components/kit';
import { requestPersistence } from '../../store/db';
import { parseBackup } from '../../domain/backup';
import { confirmDialog, toast } from '../components/kit';

type Fixed = { name: string; amount: string; day: string; category: string };
const SUGGEST: [string, string][] = [['Aluguel', 'Aluguel/prestação'], ['Energia', 'Energia'], ['Água', 'Água'], ['Internet', 'Internet'], ['Telefone', 'Telefone'], ['Academia', 'Saúde'], ['Streaming', 'Assinaturas']];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [salary, setSalary] = useState('');
  const [payday, setPayday] = useState('5');
  const [va, setVa] = useState('');
  const [balance, setBalance] = useState('');
  const [fixed, setFixed] = useState<Fixed[]>([]);
  const [resInit, setResInit] = useState('');
  const [essential, setEssential] = useState('');
  const [months, setMonths] = useState('6');
  const [contrib, setContrib] = useState('');
  const [err, setErr] = useState('');
  const m = (s: string) => (s.trim() ? parseMoney(s) : 0);
  const total = 5;

  const next = () => {
    setErr('');
    if (step === 1) {
      if (isNaN(m(salary)) || m(salary) < 0) return setErr('Digite o salário líquido (ex.: 2.500,00) ou deixe em branco.');
      const p = parseInt(payday, 10);
      if (!(p >= 1 && p <= 31)) return setErr('O dia do pagamento deve ser entre 1 e 31.');
    }
    if (step === 2) {
      if (isNaN(m(va)) || m(va) < 0) return setErr('Valor do VA inválido.');
      if (balance.trim() && isNaN(parseMoney(balance))) return setErr('Saldo inválido.');
    }
    if (step === 3) {
      for (const f of fixed) {
        if (!f.name.trim() && !f.amount.trim()) continue;
        if (!f.name.trim()) return setErr('Dê um nome para cada despesa fixa.');
        if (!(m(f.amount) > 0)) return setErr(`Informe o valor de "${f.name}".`);
        const dd = parseInt(f.day, 10);
        if (!(dd >= 1 && dd <= 31)) return setErr(`Dia de vencimento de "${f.name}" deve ser entre 1 e 31.`);
      }
    }
    setStep(step + 1);
  };
  const finish = () => {
    if ([resInit, essential, contrib].some((x) => isNaN(m(x)) || m(x) < 0)) return setErr('Confira os valores da reserva.');
    const msg = act((d) => ops.completeOnboarding(d, {
      name, salary: m(salary), payday: parseInt(payday, 10), vaMonthly: m(va), vaDay: 1, initialBalance: balance.trim() ? parseMoney(balance) : 0,
      fixed: fixed.filter((f) => f.name.trim()).map((f) => ({ name: f.name, amount: m(f.amount), day: parseInt(f.day, 10), category: f.category })),
      reserveInitial: m(resInit), reserveMonths: parseInt(months, 10) || 6, essentialMonthly: m(essential), monthlyContribution: m(contrib),
    }));
    if (msg) return setErr(msg);
    void requestPersistence();
    location.hash = '#/inicio';
  };
  const restore = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const r = parseBackup(await file.text());
    if (!r.ok) return setErr(r.errors.join(' '));
    if (!(await confirmDialog({ title: 'Restaurar este backup?', text: `${r.data.movements.length} lançamento(s), ${r.data.bills.length} conta(s) e ${r.data.lists.length} lista(s).`, ok: 'Restaurar' }))) return;
    await replaceAll(r.data);
    void requestPersistence();
    toast('Backup restaurado');
    location.hash = '#/inicio';
  };
  const fixedSum = fixed.reduce((s, f) => s + (m(f.amount) || 0), 0);
  const setF = (i: number, p: Partial<Fixed>) => setFixed(fixed.map((f, j) => (j === i ? { ...f, ...p } : f)));

  return (
    <div class="onb">
      {step > 0 && <div class="onb-progress" aria-label={`Etapa ${step} de ${total - 1}`}>{Array.from({ length: total - 1 }, (_, i) => <i class={i < step ? 'on' : ''} />)}</div>}
      {step === 0 && (
        <div class="onb-step welcome">
          <div class="onb-art" aria-hidden="true">
            <svg viewBox="0 0 200 160" width="200" height="160"><defs><linearGradient id="g1" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#14b885" /><stop offset="1" stop-color="#0e7a86" /></linearGradient></defs>
              <circle cx="100" cy="80" r="70" fill="url(#g1)" opacity=".12" /><rect x="45" y="45" width="110" height="74" rx="16" fill="url(#g1)" /><rect x="45" y="62" width="110" height="12" fill="#0b5f57" opacity=".35" />
              <circle cx="132" cy="98" r="9" fill="#fff" opacity=".9" /><path d="M62 100h34" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".85" /><path d="M150 30l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#14b885" /><circle cx="40" cy="40" r="5" fill="#0e7a86" opacity=".5" /></svg>
          </div>
          <h1>Meu Financeiro</h1>
          <p class="lead">Salário, vale-alimentação, contas e reserva — tudo organizado, no seu celular, sem conta e sem servidor.</p>
          <button class="btn primary block big" type="button" onClick={() => setStep(1)}>Começar configuração</button>
          <button class="btn ghost block" type="button" onClick={() => { void replaceAll(demoData()); location.hash = '#/inicio'; }}>Explorar com dados de demonstração</button>
          <label class="btn link-btn block file-btn"><Icon name="upload" size={18} /> Já usava o app? Restaurar um backup<input type="file" accept="application/json,.json" aria-label="Restaurar backup" onChange={restore} /></label>
          {err && <p class="err center" role="alert">{err}</p>}
          <p class="muted small center">Leva cerca de 1 minuto. Tudo pode ser alterado depois.</p>
        </div>
      )}
      {step === 1 && (
        <div class="onb-step">
          <span class="onb-ic"><Icon name="wallet" size={28} /></span>
          <h2>Seu salário</h2>
          <p class="muted">Quanto cai na conta, já com descontos. Se preferir, deixe em branco e ajuste depois.</p>
          <Field label="Como quer ser chamado? (opcional)"><input name="nome" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} /></Field>
          <Field label="Salário líquido mensal"><MoneyInput big name="salario" value={salary} onChange={setSalary} autoFocus /></Field>
          <Field label="Dia em que o salário cai"><input name="dia-pagamento" type="number" inputMode="numeric" min={1} max={31} value={payday} onInput={(e) => setPayday((e.target as HTMLInputElement).value)} /></Field>
        </div>
      )}
      {step === 2 && (
        <div class="onb-step">
          <span class="onb-ic teal"><Icon name="cart" size={28} /></span>
          <h2>Vale-alimentação e saldo</h2>
          <p class="muted">O VA tem saldo próprio e nunca se mistura com o salário.</p>
          <Field label="Valor mensal do VA (se não tiver, deixe em branco)"><MoneyInput name="va" value={va} onChange={setVa} /></Field>
          <Field label="Quanto tem na conta hoje?" hint="Ponto de partida do saldo. Você pode conferir com o banco depois."><MoneyInput name="saldo" value={balance} onChange={setBalance} /></Field>
        </div>
      )}
      {step === 3 && (
        <div class="onb-step">
          <span class="onb-ic"><Icon name="repeat" size={28} /></span>
          <h2>Despesas fixas que você já conhece</h2>
          <p class="muted">Elas viram contas mensais com lembrete. Pode pular e cadastrar depois.</p>
          <div class="chips">{SUGGEST.filter(([n]) => !fixed.some((f) => f.name === n)).map(([n, c]) => <button type="button" class="chip" onClick={() => setFixed([...fixed, { name: n, amount: '', day: '10', category: c }])}>+ {n}</button>)}
            <button type="button" class="chip" onClick={() => setFixed([...fixed, { name: '', amount: '', day: '10', category: 'Outros' }])}>+ Outra</button></div>
          {fixed.map((f, i) => (
            <div class="fixed-row">
              <input aria-label="Nome da despesa" placeholder="Nome" value={f.name} onInput={(e) => setF(i, { name: (e.target as HTMLInputElement).value })} />
              <MoneyInput name={`fixa-${i}`} value={f.amount} onChange={(x) => setF(i, { amount: x })} />
              <input aria-label="Dia" class="day" type="number" min={1} max={31} inputMode="numeric" value={f.day} onInput={(e) => setF(i, { day: (e.target as HTMLInputElement).value })} />
              <Select name={`cat-${i}`} value={f.category} options={EXPENSE_CATEGORIES} onChange={(x) => setF(i, { category: x })} />
              <button class="icon-btn subtle" type="button" aria-label="Remover" onClick={() => setFixed(fixed.filter((_, j) => j !== i))}><Icon name="x" size={18} /></button>
            </div>
          ))}
          {fixed.length > 0 && <p class="small muted">Total das fixas: {brl(fixedSum)} · campos: nome, valor, dia do vencimento, categoria</p>}
        </div>
      )}
      {step === 4 && (
        <div class="onb-step">
          <span class="onb-ic"><Icon name="shield" size={28} /></span>
          <h2>Reserva de emergência</h2>
          <p class="muted">Sem pressa: comece com o que é possível. Tudo opcional.</p>
          <Field label="Já tem algo guardado?"><MoneyInput name="reserva-inicial" value={resInit} onChange={setResInit} /></Field>
          <Field label="Gastos essenciais por mês" hint={fixedSum ? `Suas fixas somam ${brl(fixedSum)}.` : 'Moradia, contas, mercado, transporte.'}><MoneyInput name="essenciais" value={essential} onChange={setEssential} /></Field>
          <Field label="Meta: quantos meses guardados?"><div class="chips">{['3', '6', '12'].map((x) => <button type="button" class={`chip ${months === x ? 'on' : ''}`} onClick={() => setMonths(x)}>{x} meses</button>)}</div></Field>
          <Field label="Quanto pretende guardar por mês?"><MoneyInput name="contribuicao" value={contrib} onChange={setContrib} /></Field>
        </div>
      )}
      {err && step > 0 && <p class="err center" role="alert">{err}</p>}
      {step > 0 && (
        <div class="onb-nav">
          <button class="btn ghost" type="button" onClick={() => { setErr(''); setStep(step - 1); }}>Voltar</button>
          {step < total - 1 ? <button class="btn primary grow" type="button" onClick={next}>{step === 3 && fixed.length === 0 ? 'Pular' : 'Continuar'}</button>
            : <button class="btn primary grow" type="button" onClick={finish}>Concluir</button>}
        </div>
      )}
    </div>
  );
}
