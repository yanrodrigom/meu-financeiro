import { useMemo, useState } from 'preact/hooks';
import type { ShoppingItem } from '../../domain/types';
import { itemEstTotal } from '../../domain/calc';
import { parseShoppingText, planShoppingImport, type ColumnMap, type PlannedImport } from '../../domain/shopping-import';
import { money } from '../format';
import { Field, Select, Sheet } from './kit';

const FIELDS: { key: keyof ColumnMap; label: string }[] = [
  { key: 'name', label: 'Nome' },
  { key: 'qty', label: 'Quantidade' },
  { key: 'unit', label: 'Unidade' },
  { key: 'price', label: 'Preço' },
  { key: 'category', label: 'Categoria' },
];

export function ShoppingImportSheet({ open, onClose, existing, onApply }: {
  open: boolean;
  onClose: () => void;
  existing: ShoppingItem[];
  onApply: (rows: PlannedImport[]) => void;
}) {
  const [text, setText] = useState('');
  const [userMap, setUserMap] = useState<ColumnMap | null>(null);
  const [sumExisting, setSumExisting] = useState(false);
  const draft = useMemo(() => parseShoppingText(text, userMap ?? undefined), [text, userMap]);
  const plan = useMemo(() => planShoppingImport(existing, draft.items, sumExisting), [existing, draft.items, sumExisting]);
  const adds = plan.filter((r) => r.action === 'add');
  const sums = plan.filter((r) => r.action === 'sum');
  const skips = plan.filter((r) => r.action === 'skip');
  const ready = adds.length + sums.length;
  const map = userMap ?? draft.map;
  const setTextReset = (value: string) => { setUserMap(null); setText(value); };
  const onFile = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setTextReset(String(reader.result ?? ''));
    reader.readAsText(file);
  };
  const setCol = (key: keyof ColumnMap, value: string) => {
    setUserMap({ ...(userMap ?? draft.map), [key]: value === '' ? null : Number(value) });
  };
  const label = ready === 0
    ? 'Nada novo para adicionar'
    : sums.length && adds.length
      ? `Adicionar ${adds.length} e somar ${sums.length}`
      : sums.length
        ? `Somar ${sums.length} item(ns)`
        : `Adicionar ${adds.length} item(ns)`;
  return (
    <Sheet open={open} title="Importar lista" onClose={onClose}>
      <div class="stack">
        <p class="muted small">Cole o texto ou escolha um arquivo. Linhas <b>--- seção ---</b> viram a categoria. Cada <b>[ ] Nome (qtd unidade) - R$ valor</b> entra como item pendente. O valor em R$ é o total da linha.</p>
        <Field label="Texto da lista">
          <textarea name="lista-texto" rows={8} placeholder={'--- COMIDA ---\n[ ] Peito de Frango (4 kg) - R$ 72,00'} value={text} onInput={(e) => setTextReset((e.target as HTMLTextAreaElement).value)} />
        </Field>
        <button class="btn ghost file-btn" type="button">
          Escolher arquivo .txt
          <input type="file" accept=".txt,.csv,.json,text/plain,application/json" aria-label="Arquivo da lista" onChange={onFile} />
        </button>
        {draft.columns.length > 0 && (
          <div class="stack-sm">
            <p class="muted small">{draft.priceIsTotal ? 'A coluna de preço é o total da linha.' : 'No CSV ou JSON, o preço é o valor unitário (salvo se a coluna for o total).'}</p>
            {FIELDS.map((f) => (
              <Field label={f.label} key={f.key}>
                <Select name={`col-${f.key}`} value={map[f.key] === null ? '' : String(map[f.key])} onChange={(v) => setCol(f.key, v)} options={[{ value: '', label: 'Não usar' }, ...draft.columns.map((c, i) => ({ value: String(i), label: c || `Coluna ${i + 1}` }))]} />
              </Field>
            ))}
          </div>
        )}
        {draft.issues.length > 0 && <ul class="err-list">{draft.issues.slice(0, 6).map((issue) => <li key={`${issue.line}-${issue.reason}`}>Linha {issue.line}: {issue.reason}</li>)}</ul>}
        {plan.length > 0 && (
          <>
            <p class="small">{adds.length} novo(s) · {skips.length} já na lista · {sums.length} para somar</p>
            <ul class="list">
              {plan.slice(0, 12).map((row) => (
                <li class="list-item" key={`${row.item.name}-${row.item.unit}-${row.action}`}>
                  <div class="grow">
                    <p class="title">{row.item.name}</p>
                    <p class="muted small">{String(row.item.qty).replace('.', ',')} {row.item.unit} · {row.item.category} · {row.note}</p>
                  </div>
                  <b>{money(itemEstTotal(row.item))}</b>
                </li>
              ))}
            </ul>
            {plan.length > 12 && <p class="muted small">e mais {plan.length - 12} item(ns)</p>}
          </>
        )}
        {text.trim() && (
          <label class="check">
            <input type="checkbox" checked={sumExisting} onChange={(e) => setSumExisting((e.target as HTMLInputElement).checked)} />
            Somar a quantidade quando o item já está na lista (mesma unidade e ainda pendente)
          </label>
        )}
        <button class="btn primary block" type="button" disabled={ready === 0} onClick={() => onApply(plan.filter((r) => r.action !== 'skip'))}>{label}</button>
      </div>
    </Sheet>
  );
}
