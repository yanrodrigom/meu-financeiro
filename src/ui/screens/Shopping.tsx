import { useEffect, useState } from 'preact/hooks';
import { useData, act, getData } from '../../store/store';
import * as calc from '../../domain/calc';
import * as ops from '../../domain/ops';
import { addMonth, monthLabel } from '../../domain/dates';
import { pctLabel } from '../../domain/money';
import type { ShoppingItem } from '../../domain/types';
import { money } from '../format';
import { Icon } from '../icons';
import { Card, confirmDialog, Empty, Field, MonthBar, PageHeader, Progress, Sheet, toast } from '../components/kit';
import { ItemForm } from '../components/forms';
import { useMonth } from '../state';

export function Shopping() {
  const d = useData();
  const [month, setMonth] = useMonth();
  const lists = d.lists.filter((l) => l.month === month);
  const [sel, setSel] = useState<string | null>(null);
  const list = lists.find((l) => l.id === sel) ?? lists[0];
  const [itemForm, setItemForm] = useState<{ open: boolean; item?: ShoppingItem }>({ open: false });
  const [quick, setQuick] = useState('');
  const [dup, setDup] = useState(false);
  const [dupMonth, setDupMonth] = useState(addMonth(month, 1));
  const [rename, setRename] = useState<string | null>(null);
  useEffect(() => { setSel(null); }, [month]);
  const va = calc.vaMonth(d, month);
  const prev = d.lists.filter((l) => l.month === addMonth(month, -1));

  const createList = () => {
    const name = lists.length ? `Lista ${lists.length + 1}` : 'Compras do mês';
    act((x) => ops.addList(x, month, name));
    const created = useDataLast();
    setSel(created);
  };
  const quickAdd = (e: Event) => {
    e.preventDefault();
    if (!list || !quick.trim()) return;
    const f = d.frequentItems.find((x) => x.name.toLowerCase() === quick.trim().toLowerCase());
    const msg = act((x) => ops.addItem(x, list.id, { name: quick.trim(), category: f?.category || 'Mercearia', qty: 1, unit: f?.unit || 'un', estPrice: f?.estPrice || 0 }));
    if (msg) toast(msg, 'err'); else setQuick('');
  };
  const addFrequent = (name: string) => {
    if (!list) return;
    const f = d.frequentItems.find((x) => x.name === name)!;
    act((x) => ops.addItem(x, list.id, { name: f.name, category: f.category, qty: 1, unit: f.unit, estPrice: f.estPrice }));
    toast(`${f.name} adicionado`);
  };
  const delItem = async (it: ShoppingItem) => {
    if (!list) return;
    if (await confirmDialog({ title: `Excluir "${it.name}"?`, text: it.status === 'comprado' ? 'O valor deste item sai do gasto do VA.' : undefined, ok: 'Excluir', danger: true })) { act((x) => ops.deleteItem(x, list.id, it.id)); toast('Item excluído'); }
  };
  const delList = async () => {
    if (!list) return;
    if (await confirmDialog({ title: `Excluir a lista "${list.name}"?`, text: `${list.items.length} item(ns) serão apagados e o gasto do VA desta lista deixa de contar.`, ok: 'Excluir lista', danger: true })) { act((x) => ops.deleteList(x, list.id)); setSel(null); toast('Lista excluída'); }
  };
  const doDup = (e: Event) => {
    e.preventDefault();
    if (!list) return;
    const msg = act((x) => ops.duplicateList(x, list.id, dupMonth));
    if (msg) return toast(msg, 'err');
    setDup(false); toast(`Lista copiada para ${monthLabel(dupMonth)}`); setMonth(dupMonth);
  };

  const pending = list?.items.filter((i) => i.status === 'pendente') ?? [];
  const bought = list?.items.filter((i) => i.status === 'comprado') ?? [];
  const listEst = list ? calc.sum(list.items, calc.itemEstTotal) : 0;
  const listReal = list ? calc.sum(bought, calc.itemRealTotal) : 0;
  const freq = d.frequentItems.filter((f) => !list?.items.some((i) => i.name.toLowerCase() === f.name.toLowerCase())).slice(0, 12);

  return (
    <div class="page">
      <PageHeader title="Compras" subtitle="Vale-alimentação · saldo próprio, separado do salário" />
      <MonthBar month={month} onChange={setMonth} />

      <section class="va-budget">
        <div class="row between baseline">
          <div><p class="small">Saldo do VA</p><p class="big-num" data-testid="va-restante">{money(va.remaining)}</p></div>
          <div class="right"><p class="small">de {money(va.available)}</p><p class="small">{pctLabel(va.usedPct)} usado</p></div>
        </div>
        <Progress value={va.usedPct} tone={va.alertLevel === 'over' ? 'danger' : va.alertLevel === 'warn' ? 'warn' : 'emerald'} label="Uso do VA" />
        <div class="row between small">
          <span>Gasto real: <b data-testid="va-gasto">{money(va.spent)}</b></span>
          <span>Previsto nas listas: <b>{money(va.estimatedTotal)}</b></span>
        </div>
        {va.carry > 0 && <p class="small">Inclui {money(va.carry)} de saldo acumulado.</p>}
        {va.alertLevel === 'over' && <p class="alert-line"><Icon name="alert" size={16} /> Com os itens pendentes, a compra ficaria {money(va.projected - va.available)} acima do VA.</p>}
        {va.alertLevel === 'warn' && <p class="alert-line"><Icon name="alert" size={16} /> Você passou de {d.settings.vaAlertPercent}% do VA.</p>}
      </section>

      {lists.length === 0 ? (
        <Card>
          <Empty icon="cart" title="Nenhuma lista neste mês" text="Monte sua lista do mercado e acompanhe quanto do VA vai usar antes de chegar ao caixa."
            action={<div class="stack-sm"><button class="btn primary" type="button" onClick={createList}>Criar lista de {monthLabel(month)}</button>
              {prev.length > 0 && <button class="btn ghost" type="button" onClick={() => { act((x) => ops.duplicateList(x, prev[0].id, month)); toast('Lista do mês anterior copiada'); }}>Copiar lista do mês anterior</button>}</div>} />
        </Card>
      ) : (
        <>
          <div class="tabs-scroll">
            {lists.map((l) => <button type="button" class={`chip ${list?.id === l.id ? 'on' : ''}`} onClick={() => setSel(l.id)}>{l.name}</button>)}
            <button type="button" class="chip add" onClick={createList}><Icon name="plus" size={16} /> Nova lista</button>
          </div>
          {list && (
            <Card class="list-card">
              <div class="row between">
                <div><h3>{list.name}</h3><p class="muted small">{list.items.length} itens · previsto {money(listEst)} · comprado {money(listReal)}</p></div>
                <div class="row">
                  <button class="icon-btn" type="button" aria-label="Renomear lista" onClick={() => setRename(list.name)}><Icon name="edit" size={19} /></button>
                  <button class="icon-btn" type="button" aria-label="Duplicar lista" onClick={() => { setDupMonth(addMonth(month, 1)); setDup(true); }}><Icon name="copy" size={19} /></button>
                  <button class="icon-btn" type="button" aria-label="Excluir lista" onClick={delList}><Icon name="trash" size={19} /></button>
                </div>
              </div>
              <form class="quick-item" onSubmit={quickAdd}>
                <input aria-label="Adicionar item rápido" list="freq-q" placeholder="Adicionar item… (Enter)" value={quick} onInput={(e) => setQuick((e.target as HTMLInputElement).value)} />
                <datalist id="freq-q">{d.frequentItems.map((f) => <option value={f.name} />)}</datalist>
                <button class="icon-btn filled" type="submit" aria-label="Adicionar"><Icon name="plus" /></button>
                <button class="btn ghost small" type="button" onClick={() => setItemForm({ open: true })}>Detalhado</button>
              </form>
              {freq.length > 0 && (
                <div class="freq"><p class="muted small">Itens frequentes</p><div class="chips">{freq.map((f) => <button type="button" class="chip" onClick={() => addFrequent(f.name)}>+ {f.name}</button>)}</div></div>
              )}
              {list.items.length === 0 && <p class="muted center pad">Lista vazia. Digite acima ou toque em um item frequente.</p>}
              <ul class="list items">
                {[...pending, ...bought].map((it) => (
                  <li class={`list-item item ${it.status}`}>
                    <button type="button" class={`check-btn ${it.status === 'comprado' ? 'on' : ''}`} aria-label={it.status === 'comprado' ? `Desmarcar ${it.name}` : `Marcar ${it.name} como comprado`} onClick={() => act((x) => ops.toggleItem(x, list.id, it.id))}><Icon name="check" size={16} stroke={3} /></button>
                    <div class="grow" onClick={() => setItemForm({ open: true, item: it })}>
                      <p class="title">{it.name}</p>
                      <p class="muted small">{String(it.qty).replace('.', ',')} {it.unit} · {it.category}{it.market ? ` · ${it.market}` : ''}</p>
                    </div>
                    <div class="right" onClick={() => setItemForm({ open: true, item: it })}>
                      <b>{money(it.status === 'comprado' ? calc.itemRealTotal(it) : calc.itemEstTotal(it))}</b>
                      <p class="muted tiny">{it.status === 'comprado' ? 'pago' : 'previsto'}</p>
                    </div>
                    <button class="icon-btn subtle" type="button" aria-label={`Excluir ${it.name}`} onClick={() => delItem(it)}><Icon name="trash" size={17} /></button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {list && <ItemForm open={itemForm.open} listId={list.id} initial={itemForm.item} onClose={() => setItemForm({ open: false })} />}
      <Sheet open={dup} title="Duplicar lista" onClose={() => setDup(false)}>
        <form class="stack" onSubmit={doDup}>
          <Field label="Para o mês"><input type="month" name="mes-destino" value={dupMonth} onInput={(e) => setDupMonth((e.target as HTMLInputElement).value)} /></Field>
          <p class="muted small">Os itens são copiados como pendentes, sem preço pago.</p>
          <button class="btn primary block" type="submit">Duplicar</button>
        </form>
      </Sheet>
      <Sheet open={rename !== null} title="Renomear lista" onClose={() => setRename(null)}>
        <form class="stack" onSubmit={(e) => { e.preventDefault(); const m = list && act((x) => ops.renameList(x, list.id, rename || '')); if (m) toast(m, 'err'); else setRename(null); }}>
          <Field label="Nome"><input name="nome-lista" value={rename || ''} onInput={(e) => setRename((e.target as HTMLInputElement).value)} /></Field>
          <button class="btn primary block" type="submit">Salvar</button>
        </form>
      </Sheet>
    </div>
  );
}

function useDataLast(): string { const l = getData().lists; return l[l.length - 1]?.id; }
