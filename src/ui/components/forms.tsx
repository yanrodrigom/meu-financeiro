import { useLayoutEffect as useEffect, useState } from 'preact/hooks';
import type { Bill, BillKind, BillSource, Movement, MovementStatus, MovementType, MoneySource, Recurrence, ShoppingItem } from '../../domain/types';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, SHOPPING_CATEGORIES, UNITS } from '../../domain/categories';
import { parseMoney } from '../../domain/money';
import { today, isValidISO } from '../../domain/dates';
import * as ops from '../../domain/ops';
import { act, getData } from '../../store/store';
import { Chips, confirmDialog, Field, MoneyInput, moneyStr, Segmented, Select, Sheet, toast } from './kit';
import { money } from '../format';

export const STATUS_LABEL: Record<MovementStatus, string> = { prevista: 'Prevista', pendente: 'Pendente', realizada: 'Realizada', paga: 'Paga' };
export const TYPE_LABEL: Record<MovementType, string> = { receita: 'Receita', despesa: 'Despesa', reserva_deposito: 'Guardado na reserva', reserva_retirada: 'Retirada da reserva', ajuste: 'Ajuste de saldo' };
export const SOURCE_LABEL: Record<MoneySource, string> = { conta: 'Conta', va: 'VA', outra: 'Outra' };
export const BILL_SOURCE_LABEL: Record<BillSource, string> = { salario: 'Salário', va: 'VA', outra: 'Outra' };
export const KIND_LABEL: Record<BillKind, string> = { fixa: 'Fixa', parcela: 'Parcela', compra: 'Compra', eventual: 'Eventual' };
export const REC_LABEL: Record<Recurrence, string> = { nenhuma: 'Não repete', mensal: 'Mensal', semanal: 'Semanal', quinzenal: 'Quinzenal', anual: 'Anual' };

function errs(msg: string | null, set: (e: string) => void) {
  if (msg) { set(msg); toast(msg, 'err'); return false; }
  return true;
}

// ---------------- Lançamento rápido ----------------
export function QuickAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [type, setType] = useState<'despesa' | 'receita'>('despesa');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('Alimentação');
  const [source, setSource] = useState<MoneySource>('conta');
  const [date, setDate] = useState(today());
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setAmount(''); setDesc(''); setErr(''); setDate(today()); } }, [open]);
  useEffect(() => { setCat(type === 'receita' ? 'Renda extra' : 'Alimentação'); if (type === 'receita') setSource('conta'); }, [type]);
  const cats = type === 'receita' ? INCOME_CATEGORIES : ['Alimentação', 'Supermercado', 'Transporte', 'Lazer', 'Saúde', 'Assinaturas', 'Outros'];
  const save = (e: Event) => {
    e.preventDefault();
    const cents = parseMoney(amount);
    if (!(cents > 0)) return errs('Digite um valor maior que zero.', setErr);
    const ok = errs(act((d) => ops.addMovement(d, { description: desc.trim() || cat, type, amount: cents, date, category: cat, source, status: type === 'receita' ? 'realizada' : 'paga', paymentMethod: source === 'va' ? 'VA' : undefined })), setErr);
    if (ok) { toast(type === 'receita' ? 'Receita registrada' : 'Gasto registrado'); onClose(); }
  };
  return (
    <Sheet open={open} title="Registrar agora" onClose={onClose}>
      <form onSubmit={save} class="stack" aria-label="Lançamento rápido">
        <Segmented name="Tipo" value={type} onChange={setType} options={[{ value: 'despesa', label: 'Gasto' }, { value: 'receita', label: 'Receita' }]} />
        <MoneyInput big name="valor" value={amount} onChange={setAmount} autoFocus />
        {err && <small class="err">{err}</small>}
        <Chips value={cat} onChange={setCat} options={cats} />
        <Field label="Descrição (opcional)"><input name="descricao" value={desc} placeholder={cat} onInput={(e) => setDesc((e.target as HTMLInputElement).value)} /></Field>
        <div class="grid2">
          {type === 'despesa' ? (
            <Field label="Pago com"><Segmented name="Fonte" value={source} onChange={setSource} options={[{ value: 'conta', label: 'Conta' }, { value: 'va', label: 'VA' }]} /></Field>
          ) : <div />}
          <Field label="Data"><input type="date" name="data" value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} /></Field>
        </div>
        <button class="btn primary block" type="submit">Salvar</button>
      </form>
    </Sheet>
  );
}

// ---------------- Formulário completo de lançamento ----------------
export function MovementForm({ open, onClose, initial, defaults }: { open: boolean; onClose: () => void; initial?: Movement; defaults?: Partial<Movement> }) {
  const blank = (): Partial<Movement> => ({ type: 'despesa', source: 'conta', status: 'paga', date: today(), category: 'Outros', recurrence: 'variavel', ...defaults });
  const [m, setM] = useState<Partial<Movement>>(initial ?? blank());
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  useEffect(() => { if (open) { const v = initial ?? blank(); setM(v); setAmount(moneyStr(v.amount)); setErr({}); } }, [open, initial?.id]);
  const set = (p: Partial<Movement>) => setM((x) => ({ ...x, ...p }));
  const isSpecial = m.type === 'reserva_deposito' || m.type === 'reserva_retirada' || m.type === 'ajuste';
  const lockedAmount = initial?.originType === 'compras' || m.type === 'ajuste';
  const cats = m.type === 'receita' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const statusOpts: MovementStatus[] = m.type === 'receita' ? ['prevista', 'realizada'] : ['prevista', 'pendente', 'paga'];
  const save = (e: Event) => {
    e.preventDefault();
    const cents = lockedAmount ? (m.amount as number) : parseMoney(amount);
    const data = { ...m, amount: cents, description: (m.description || '').trim() } as Movement;
    const v = ops.validateMovement(data);
    if (Object.keys(v).length) { setErr(v); return; }
    const msg = initial ? act((d) => ops.updateMovement(d, initial.id, data)) : act((d) => ops.addMovement(d, data));
    if (msg) { setErr({ form: msg }); return; }
    toast(initial ? 'Alterações salvas' : 'Lançamento salvo');
    onClose();
  };
  const del = async () => {
    if (!initial) return;
    if (!(await confirmDialog({ title: 'Excluir lançamento?', text: `"${initial.description}" (${money(initial.amount)}) será removido e os totais serão recalculados.`, ok: 'Excluir', danger: true }))) return;
    const msg = act((d) => ops.deleteMovement(d, initial.id));
    if (msg) toast(msg, 'err'); else { toast('Lançamento excluído'); onClose(); }
  };
  return (
    <Sheet open={open} title={initial ? 'Editar lançamento' : m.type === 'receita' ? 'Nova receita' : 'Nova despesa'} onClose={onClose}>
      <form class="stack" onSubmit={save} aria-label="Lançamento">
        {!isSpecial && <Segmented name="Tipo" value={m.type as 'despesa' | 'receita'} onChange={(t) => set({ type: t, category: t === 'receita' ? 'Salário líquido' : 'Outros', status: t === 'receita' ? 'realizada' : 'paga', source: 'conta' })} options={[{ value: 'despesa', label: 'Despesa' }, { value: 'receita', label: 'Receita' }]} />}
        {isSpecial && <p class="pill-note">{TYPE_LABEL[m.type!]}</p>}
        <Field label="Descrição" error={err.description}><input name="descricao" value={m.description || ''} onInput={(e) => set({ description: (e.target as HTMLInputElement).value })} placeholder="Ex.: Conta de luz" /></Field>
        <Field label="Valor" error={err.amount} hint={m.type === 'ajuste' ? 'Para corrigir um ajuste, exclua-o e confira o saldo de novo no Perfil.' : lockedAmount ? 'Valor calculado pelos itens comprados da lista.' : undefined}>
          {lockedAmount ? <input value={money(m.amount || 0)} disabled /> : <MoneyInput name="valor" value={amount} onChange={setAmount} />}
        </Field>
        <div class="grid2">
          <Field label="Data" error={err.date}><input type="date" name="data" value={m.date} onInput={(e) => set({ date: (e.target as HTMLInputElement).value })} /></Field>
          {!isSpecial && <Field label="Categoria"><Select name="categoria" value={m.category || 'Outros'} options={cats.includes(m.category || '') ? cats : [...cats, m.category!]} onChange={(v) => set({ category: v })} /></Field>}
        </div>
        {!isSpecial && (
          <>
            {m.type === 'despesa' && !lockedAmount && (
              <Field label="Dinheiro usado" error={err.source}>
                <Segmented name="Fonte" value={m.source as MoneySource} onChange={(v) => set({ source: v })} options={[{ value: 'conta', label: 'Conta/salário' }, { value: 'va', label: 'VA' }, { value: 'outra', label: 'Outra' }]} />
              </Field>
            )}
            <Field label="Status"><Segmented name="Status" value={m.status as MovementStatus} onChange={(v) => set({ status: v })} options={statusOpts.map((s) => ({ value: s, label: s === 'realizada' && m.type === 'receita' ? 'Recebida' : STATUS_LABEL[s] }))} /></Field>
            <div class="grid2">
              <Field label="Forma de pagamento"><Select name="forma" value={m.paymentMethod || ''} options={[{ value: '', label: '—' }, ...PAYMENT_METHODS]} onChange={(v) => set({ paymentMethod: v || undefined })} /></Field>
              <Field label="Tipo de gasto"><Select name="recorrencia" value={m.recurrence || 'variavel'} options={[{ value: 'variavel', label: 'Variável' }, { value: 'fixa', label: 'Fixa (todo mês)' }]} onChange={(v) => set({ recurrence: v as 'fixa' | 'variavel' })} /></Field>
            </div>
          </>
        )}
        <Field label="Observações"><textarea name="obs" rows={2} value={m.notes || ''} onInput={(e) => set({ notes: (e.target as HTMLTextAreaElement).value || undefined })} /></Field>
        {err.form && <small class="err">{err.form}</small>}
        {initial?.originType === 'conta' && <small class="hint">Lançamento gerado ao pagar uma conta. Editar aqui atualiza a conta também.</small>}
        <div class="row gap">
          {initial && initial.originType !== 'compras' && <button type="button" class="btn ghost danger-text" onClick={del}>Excluir</button>}
          <button class="btn primary grow" type="submit">Salvar</button>
        </div>
      </form>
    </Sheet>
  );
}

// ---------------- Contas ----------------
export function BillForm({ open, onClose, initial, defaults }: { open: boolean; onClose: () => void; initial?: Bill; defaults?: Partial<Bill> }) {
  const blank = (): Partial<Bill> => ({ dueDate: today(), category: 'Outros', source: 'salario', kind: 'eventual', recurrence: 'nenhuma', ...defaults });
  const [b, setB] = useState<Partial<Bill>>(blank());
  const [amount, setAmount] = useState('');
  const [count, setCount] = useState('3');
  const [period, setPeriod] = useState<'mensal' | 'quinzenal' | 'semanal'>('mensal');
  const [applyAll, setApplyAll] = useState(true);
  const [err, setErr] = useState<Record<string, string>>({});
  useEffect(() => { if (open) { const v = initial ?? blank(); setB(v); setAmount(moneyStr(v.amount)); setErr({}); setCount('3'); } }, [open, initial?.id]);
  const set = (p: Partial<Bill>) => setB((x) => ({ ...x, ...p }));
  const isInstallment = !initial && b.kind === 'parcela';
  const save = (e: Event) => {
    e.preventDefault();
    const cents = parseMoney(amount);
    const input = { ...b, name: (b.name || '').trim(), amount: cents } as Bill;
    const v = ops.validateBill(input);
    if (isInstallment && !(Number(count) >= 1 && Number(count) <= 120)) v.count = 'Quantidade entre 1 e 120.';
    if (Object.keys(v).length) { setErr(v); return; }
    let msg: string | null;
    if (initial) msg = act((d) => ops.updateBill(d, initial.id, input, applyAll));
    else if (isInstallment) msg = act((d) => ops.addInstallments(d, { name: input.name, count: Number(count), amount: cents, firstDate: input.dueDate, periodicity: period, category: input.category, source: input.source, notes: input.notes }));
    else msg = act((d) => ops.addBill(d, input as ops.BillInput));
    if (msg) { setErr({ form: msg }); return; }
    toast(initial ? 'Conta atualizada' : isInstallment ? `${count} parcelas criadas` : 'Conta criada');
    onClose();
  };
  return (
    <Sheet open={open} title={initial ? 'Editar conta' : 'Nova conta'} onClose={onClose}>
      <form class="stack" onSubmit={save} aria-label="Conta">
        <Field label="Nome" error={err.name}><input name="nome" value={b.name || ''} placeholder="Ex.: Internet" onInput={(e) => set({ name: (e.target as HTMLInputElement).value })} /></Field>
        <div class="grid2">
          <Field label={isInstallment ? 'Valor da parcela' : 'Valor previsto'} error={err.amount}><MoneyInput name="valor" value={amount} onChange={setAmount} /></Field>
          <Field label={isInstallment ? '1ª parcela' : 'Vencimento'} error={err.dueDate}><input type="date" name="vencimento" value={b.dueDate} onInput={(e) => set({ dueDate: (e.target as HTMLInputElement).value })} /></Field>
        </div>
        {!initial?.installment && <Field label="Tipo"><Segmented name="Tipo de conta" value={b.kind as BillKind} onChange={(k) => set({ kind: k, recurrence: k === 'fixa' ? 'mensal' : 'nenhuma', category: k === 'parcela' ? 'Parcelas' : b.category })} options={(Object.keys(KIND_LABEL) as BillKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} /></Field>}
        {isInstallment && (
          <div class="grid2">
            <Field label="Quantidade de parcelas" error={err.count}><input name="parcelas" type="number" inputMode="numeric" min={1} max={120} value={count} onInput={(e) => setCount((e.target as HTMLInputElement).value)} /></Field>
            <Field label="Periodicidade"><Select name="periodicidade" value={period} onChange={(v) => setPeriod(v as typeof period)} options={[{ value: 'mensal', label: 'Mensal' }, { value: 'quinzenal', label: 'Quinzenal' }, { value: 'semanal', label: 'Semanal' }]} /></Field>
          </div>
        )}
        {isInstallment && amount && Number(count) > 0 && <small class="hint">Total: {money(parseMoney(amount) * Number(count) || 0)} em {count}x</small>}
        <div class="grid2">
          <Field label="Categoria"><Select name="categoria" value={b.category || 'Outros'} options={EXPENSE_CATEGORIES} onChange={(v) => set({ category: v })} /></Field>
          {!initial && !isInstallment && <Field label="Repetir"><Select name="recorrencia" value={b.recurrence || 'nenhuma'} onChange={(v) => set({ recurrence: v as Recurrence })} options={(Object.keys(REC_LABEL) as Recurrence[]).map((r) => ({ value: r, label: REC_LABEL[r] }))} /></Field>}
        </div>
        <Field label="Pagar com" hint="VA e salário são controlados separadamente.">
          <Segmented name="Origem" value={b.source as BillSource} onChange={(v) => set({ source: v })} options={[{ value: 'salario', label: 'Salário' }, { value: 'va', label: 'VA' }, { value: 'outra', label: 'Outra' }]} />
        </Field>
        <Field label="Observações"><textarea name="obs" rows={2} value={b.notes || ''} onInput={(e) => set({ notes: (e.target as HTMLTextAreaElement).value || undefined })} /></Field>
        {initial?.seriesId && <label class="check"><input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll((e.target as HTMLInputElement).checked)} /> Aplicar também às próximas desta recorrência</label>}
        {err.form && <small class="err">{err.form}</small>}
        <button class="btn primary block" type="submit">Salvar</button>
      </form>
    </Sheet>
  );
}

export function PayBillSheet({ bill, onClose }: { bill: Bill | null; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState('Pix');
  const [err, setErr] = useState('');
  useEffect(() => { if (bill) { setAmount(moneyStr(bill.paidAmount ?? bill.amount)); setDate(bill.paidDate ?? today()); setMethod(bill.source === 'va' ? 'VA' : 'Pix'); setErr(''); } }, [bill?.id]);
  if (!bill) return null;
  const save = (e: Event) => {
    e.preventDefault();
    const cents = parseMoney(amount);
    if (!(cents > 0)) return setErr('O valor pago precisa ser maior que zero.');
    if (!isValidISO(date)) return setErr('Data inválida.');
    const msg = act((d) => ops.payBill(d, bill.id, { amount: cents, date, paymentMethod: method }));
    if (msg) return setErr(msg);
    toast('Conta marcada como paga');
    onClose();
  };
  return (
    <Sheet open title={`Pagar: ${bill.name}`} onClose={onClose}>
      <form class="stack" onSubmit={save} aria-label="Pagar conta">
        <Field label="Valor pago" error={err}><MoneyInput big name="valor-pago" value={amount} onChange={setAmount} /></Field>
        <div class="grid2">
          <Field label="Data do pagamento"><input type="date" name="data-pagamento" value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} /></Field>
          <Field label="Forma"><Select name="forma" value={method} onChange={setMethod} options={PAYMENT_METHODS} /></Field>
        </div>
        <small class="hint">Será criado um único lançamento em Movimentações, vinculado a esta conta. Pagar de novo só atualiza o mesmo lançamento.</small>
        <button class="btn primary block" type="submit">Confirmar pagamento</button>
      </form>
    </Sheet>
  );
}

// ---------------- Itens de compra ----------------
export function ItemForm({ open, onClose, listId, initial }: { open: boolean; onClose: () => void; listId: string; initial?: ShoppingItem }) {
  const [it, setIt] = useState<Partial<ShoppingItem>>({});
  const [qty, setQty] = useState('1');
  const [est, setEst] = useState('');
  const [real, setReal] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    const v = initial ?? { category: 'Mercearia', unit: 'un', status: 'pendente' as const };
    setIt(v); setQty(String(initial?.qty ?? 1).replace('.', ',')); setEst(moneyStr(initial?.estPrice)); setReal(moneyStr(initial?.realPrice)); setErr({});
  }, [open, initial?.id]);
  const set = (p: Partial<ShoppingItem>) => setIt((x) => ({ ...x, ...p }));
  const freq = getData().frequentItems;
  const onName = (name: string) => {
    const f = freq.find((x) => x.name.toLowerCase() === name.toLowerCase());
    set({ name, ...(f && !initial ? { category: f.category, unit: f.unit } : {}) });
    if (f && !initial && !est) setEst(moneyStr(f.estPrice));
  };
  const save = (e: Event) => {
    e.preventDefault();
    const q = parseFloat(qty.replace(',', '.'));
    const estC = est ? parseMoney(est) : 0;
    const realC = real ? parseMoney(real) : undefined;
    const data = { ...it, name: (it.name || '').trim(), qty: q, estPrice: estC, realPrice: realC } as ShoppingItem;
    const v = ops.validateItem(data);
    if (est && isNaN(estC)) v.estPrice = 'Preço inválido.';
    if (real && (realC === undefined || isNaN(realC))) v.realPrice = 'Preço inválido.';
    if (Object.keys(v).length) { setErr(v); return; }
    const msg = initial ? act((d) => ops.updateItem(d, listId, initial.id, data)) : act((d) => ops.addItem(d, listId, data));
    if (msg) { setErr({ form: msg }); return; }
    toast(initial ? 'Item atualizado' : 'Item adicionado');
    onClose();
  };
  return (
    <Sheet open={open} title={initial ? 'Editar item' : 'Novo item'} onClose={onClose}>
      <form class="stack" onSubmit={save} aria-label="Item de compra">
        <Field label="Item" error={err.name}><input name="item" list="freq-items" value={it.name || ''} placeholder="Ex.: Arroz 5kg" onInput={(e) => onName((e.target as HTMLInputElement).value)} /></Field>
        <datalist id="freq-items">{freq.map((f) => <option value={f.name} />)}</datalist>
        <div class="grid3">
          <Field label="Qtd." error={err.qty}><input name="qtd" inputMode="decimal" value={qty} onInput={(e) => setQty((e.target as HTMLInputElement).value)} /></Field>
          <Field label="Unidade"><Select name="unidade" value={it.unit || 'un'} options={UNITS} onChange={(v) => set({ unit: v })} /></Field>
          <Field label="Categoria"><Select name="categoria" value={it.category || 'Mercearia'} options={SHOPPING_CATEGORIES} onChange={(v) => set({ category: v })} /></Field>
        </div>
        <div class="grid2">
          <Field label="Preço unit. previsto" error={err.estPrice}><MoneyInput name="previsto" value={est} onChange={setEst} /></Field>
          <Field label="Preço unit. pago" error={err.realPrice} hint="Preencha ao comprar"><MoneyInput name="pago" value={real} onChange={setReal} /></Field>
        </div>
        <div class="grid2">
          <Field label="Mercado (opcional)"><input name="mercado" value={it.market || ''} onInput={(e) => set({ market: (e.target as HTMLInputElement).value || undefined })} /></Field>
          <Field label="Status"><Segmented name="Status do item" value={(it.status || 'pendente') as 'pendente' | 'comprado'} onChange={(v) => set({ status: v })} options={[{ value: 'pendente', label: 'Pendente' }, { value: 'comprado', label: 'Comprado' }]} /></Field>
        </div>
        <Field label="Observações"><input name="obs" value={it.notes || ''} onInput={(e) => set({ notes: (e.target as HTMLInputElement).value || undefined })} /></Field>
        {err.form && <small class="err">{err.form}</small>}
        <button class="btn primary block" type="submit">Salvar item</button>
      </form>
    </Sheet>
  );
}
