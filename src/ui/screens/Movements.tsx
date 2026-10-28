import { useState } from 'preact/hooks';
import { useData } from '../../store/store';
import { fmtDate, monthOf } from '../../domain/dates';
import type { Movement, MovementType, MoneySource } from '../../domain/types';
import { money } from '../format';
import { Icon } from '../icons';
import { Badge, Card, Empty, MonthBar, PageHeader, Select } from '../components/kit';
import { MovementForm, SOURCE_LABEL, STATUS_LABEL, TYPE_LABEL } from '../components/forms';
import { useMonth } from '../state';
import { isDone } from '../../domain/calc';

const ORIGIN: Record<string, string> = { manual: 'Manual', conta: 'Conta paga', compras: 'Lista de compras', salario: 'Salário', reserva: 'Reserva', ajuste: 'Ajuste' };

export function Movements() {
  const d = useData();
  const [month, setMonth] = useMonth();
  const [all, setAll] = useState(false);
  const [q, setQ] = useState('');
  const [type, setType] = useState<'' | MovementType>('');
  const [src, setSrc] = useState<'' | MoneySource>('');
  const [st, setSt] = useState('');
  const [edit, setEdit] = useState<Movement | undefined>();
  const [open, setOpen] = useState(false);
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const rows = d.movements
    .filter((m) => all || monthOf(m.date) === month)
    .filter((m) => !type || m.type === type)
    .filter((m) => !src || m.source === src)
    .filter((m) => !st || (st === 'feitas' ? isDone(m.status) : !isDone(m.status)))
    .filter((m) => !q || norm(`${m.description} ${m.category} ${m.notes || ''}`).includes(norm(q)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const sign = (m: Movement) => (m.type === 'receita' || m.type === 'reserva_retirada' ? 1 : m.type === 'ajuste' ? Math.sign(m.amount) : -1);
  return (
    <div class="page">
      <PageHeader back title="Movimentações" subtitle="Histórico central de tudo que entra e sai" right={<button class="btn primary small" type="button" onClick={() => { setEdit(undefined); setOpen(true); }}><Icon name="plus" size={18} /> Novo</button>} />
      {!all && <MonthBar month={month} onChange={setMonth} />}
      <div class="search"><Icon name="search" size={18} /><input type="search" aria-label="Buscar" placeholder="Buscar descrição, categoria…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} /></div>
      <div class="grid3 filters">
        <Select name="filtro-tipo" value={type} onChange={(v) => setType(v as MovementType | '')} options={[{ value: '', label: 'Tipo: todos' }, ...(Object.keys(TYPE_LABEL) as MovementType[]).map((k) => ({ value: k, label: TYPE_LABEL[k] }))]} />
        <Select name="filtro-fonte" value={src} onChange={(v) => setSrc(v as MoneySource | '')} options={[{ value: '', label: 'Fonte: todas' }, { value: 'conta', label: 'Conta' }, { value: 'va', label: 'VA' }, { value: 'outra', label: 'Outra' }]} />
        <Select name="filtro-status" value={st} onChange={setSt} options={[{ value: '', label: 'Status: todos' }, { value: 'feitas', label: 'Realizadas/pagas' }, { value: 'abertas', label: 'Previstas/pendentes' }]} />
      </div>
      <label class="check"><input type="checkbox" checked={all} onChange={(e) => setAll((e.target as HTMLInputElement).checked)} /> Mostrar todos os meses</label>
      <Card>
        {rows.length === 0 ? <Empty icon="swap" title="Nada encontrado" text={d.movements.length ? 'Tente mudar os filtros ou o mês.' : 'Seus lançamentos aparecem aqui assim que você registrar o primeiro gasto ou receita.'} /> : (
          <ul class="list">
            {rows.map((m) => (
              <li class="list-item" onClick={() => { setEdit(m); setOpen(true); }}>
                <div class={`cat-dot ${m.type}`}><Icon name={sign(m) > 0 ? 'arrowDown' : 'arrowUp'} size={16} /></div>
                <div class="grow">
                  <p class="title">{m.description}</p>
                  <p class="muted small">{fmtDate(m.date)} · {m.category} · {SOURCE_LABEL[m.source]}{m.originType !== 'manual' ? ` · ${ORIGIN[m.originType]}` : ''}</p>
                </div>
                <div class="right">
                  <b class={sign(m) > 0 ? 'pos' : m.type.startsWith('reserva') ? 'teal' : 'neg'}>{sign(m) > 0 ? '+' : '−'} {money(Math.abs(m.amount))}</b>
                  <div><Badge tone={isDone(m.status) ? 'ok' : 'warn'}>{STATUS_LABEL[m.status]}</Badge></div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p class="muted tiny center">{rows.length} lançamento(s)</p>
      <MovementForm open={open} initial={edit} onClose={() => setOpen(false)} />
    </div>
  );
}
