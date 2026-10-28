import type { ShoppingItem } from './types';
import type { AppData } from './types';
import { parseMoney } from './money';
import { addItem, updateItem } from './ops';

export interface ImportedItem {
  name: string;
  qty: number;
  unit: string;
  /** Preço unitário previsto, em centavos. */
  estPrice: number;
  category: string;
  /** Total da linha em centavos (qty × preço unitário, antes de arredondar de novo). */
  lineTotal: number;
}

export interface ImportIssue {
  line: number;
  text: string;
  reason: string;
}

export interface ColumnMap {
  name: number | null;
  qty: number | null;
  unit: number | null;
  price: number | null;
  category: number | null;
}

export interface ShoppingParse {
  format: 'checklist' | 'csv' | 'json';
  items: ImportedItem[];
  issues: ImportIssue[];
  columns: string[];
  map: ColumnMap;
  /** No CSV/JSON, se a coluna escolhida for um total da linha (não o preço unitário). */
  priceIsTotal: boolean;
}

export interface PlannedImport {
  item: ImportedItem;
  action: 'add' | 'skip' | 'sum';
  existingId?: string;
  note: string;
}

const EMPTY_MAP: ColumnMap = { name: null, qty: null, unit: null, price: null, category: null };

const UNIT_MAP: Record<string, string> = {
  kg: 'kg', quilo: 'kg', quilos: 'kg', kilo: 'kg', kilos: 'kg',
  g: 'g', gr: 'g', grama: 'g', gramas: 'g',
  l: 'L', lt: 'L', litro: 'L', litros: 'L',
  ml: 'ml',
  un: 'un', und: 'un', unidade: 'un', unidades: 'un',
  pct: 'pct', pacote: 'pct', pacotes: 'pct',
  cx: 'cx', caixa: 'cx', caixas: 'cx',
  dz: 'dz', duzia: 'dz', duzias: 'dz',
};

function norm(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function clean(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function normalizeUnit(unit: string): string {
  const trimmed = clean(unit);
  if (!trimmed) return 'un';
  return UNIT_MAP[norm(trimmed)] ?? trimmed;
}

function emptyParse(): ShoppingParse {
  return { format: 'checklist', items: [], issues: [], columns: [], map: { ...EMPTY_MAP }, priceIsTotal: false };
}

function fieldOf(header: string): 'name' | 'qty' | 'unit' | 'price' | 'category' | 'total' | null {
  const h = norm(header);
  if (!h) return null;
  if (['total', 'valor total', 'preco total', 'total r$'].includes(h)) return 'total';
  if (['nome', 'item', 'produto', 'descricao', 'name', 'product', 'mercadoria'].includes(h)) return 'name';
  if (['qtd', 'qtde', 'quantidade', 'qty', 'quant', 'qnt'].includes(h)) return 'qty';
  if (['unidade', 'un', 'unit', 'medida', 'und'].includes(h)) return 'unit';
  if (['preco', 'preco unitario', 'valor', 'valor unitario', 'price', 'estprice', 'r$'].includes(h)) return 'price';
  if (['categoria', 'category', 'cat', 'secao', 'grupo', 'tipo'].includes(h)) return 'category';
  return null;
}

function suggestMap(columns: string[]): { map: ColumnMap; priceIsTotal: boolean } {
  const map: ColumnMap = { ...EMPTY_MAP };
  let totalIdx: number | null = null;
  columns.forEach((col, i) => {
    const kind = fieldOf(col);
    if (kind === 'total') totalIdx = i;
    else if (kind && map[kind] === null) map[kind] = i;
  });
  if (totalIdx !== null) return { map: { ...map, price: totalIdx }, priceIsTotal: true };
  const anyHeader = columns.some((c) => fieldOf(c));
  if (!anyHeader) {
    return {
      map: { name: columns.length ? 0 : null, qty: columns.length > 1 ? 1 : null, unit: columns.length > 2 ? 2 : null, price: columns.length > 3 ? 3 : null, category: columns.length > 4 ? 4 : null },
      priceIsTotal: false,
    };
  }
  return { map, priceIsTotal: false };
}

function withUnitPrice(name: string, qty: number, unit: string, category: string, cents: number, asTotal: boolean): ImportedItem {
  const lineTotal = asTotal ? cents : Math.round(qty * cents);
  const estPrice = asTotal ? (qty > 0 ? Math.round(cents / qty) : cents) : cents;
  return { name, qty, unit, category: category || 'Outros', estPrice, lineTotal };
}

function parseQtyText(raw: string): number | null {
  const s = raw.trim();
  if (!s) return 1;
  if (s.includes(',')) {
    const n = Number(s.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || n > 100000) return null;
    return Math.round(n * 1000) / 1000;
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    const n = Number(s.replace(/\./g, ''));
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > 100000) return null;
  return Math.round(n * 1000) / 1000;
}

function rowsToItems(rows: string[][], columns: string[], map: ColumnMap, priceIsTotal: boolean, lineOffset: number): { items: ImportedItem[]; issues: ImportIssue[] } {
  const items: ImportedItem[] = [];
  const issues: ImportIssue[] = [];
  const cell = (row: string[], idx: number | null) => (idx === null ? '' : clean(row[idx] ?? ''));
  rows.forEach((row, i) => {
    if (row.every((c) => !clean(c))) return;
    const line = lineOffset + i;
    const name = cell(row, map.name);
    if (!name) {
      issues.push({ line, text: row.join(' · '), reason: 'Sem nome do item.' });
      return;
    }
    const qty = parseQtyText(cell(row, map.qty));
    if (qty === null) {
      issues.push({ line, text: name, reason: 'Quantidade inválida.' });
      return;
    }
    const unit = normalizeUnit(cell(row, map.unit));
    const priceRaw = cell(row, map.price);
    let cents = 0;
    if (priceRaw) {
      const parsed = parseMoney(priceRaw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        issues.push({ line, text: name, reason: 'Preço inválido.' });
        return;
      }
      cents = parsed;
    }
    items.push(withUnitPrice(name, qty, unit, cell(row, map.category), cents, priceIsTotal && cents > 0));
  });
  return { items: mergeItems(items), issues };
}

function mergeItems(items: ImportedItem[]): ImportedItem[] {
  const out: ImportedItem[] = [];
  for (const it of items) {
    const key = `${norm(it.name)}\0${norm(it.unit)}\0${norm(it.category)}`;
    const prev = out.find((p) => `${norm(p.name)}\0${norm(p.unit)}\0${norm(p.category)}` === key);
    if (!prev) {
      out.push({ ...it });
      continue;
    }
    prev.qty = Math.round((prev.qty + it.qty) * 1000) / 1000;
    prev.lineTotal += it.lineTotal;
    prev.estPrice = prev.qty > 0 ? Math.round(prev.lineTotal / prev.qty) : prev.lineTotal;
  }
  return out;
}

function splitCsv(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function detectDelim(line: string): string | null {
  const counts = [
    { d: ';', n: splitCsv(line, ';').length },
    { d: '\t', n: splitCsv(line, '\t').length },
    { d: ',', n: splitCsv(line, ',').length },
  ].sort((a, b) => b.n - a.n);
  return counts[0].n > 1 ? counts[0].d : null;
}

function looksChecklist(lines: string[]): boolean {
  return lines.some((line) => /^\s*-{2,}\s*.+\s*-{2,}\s*$/.test(line) || /^\s*\[[^\]]*\]/.test(line));
}

function checklistBody(body: string, lineNo: number, category: string): { item?: ImportedItem; issue?: ImportIssue } {
  const priceMatch = body.match(/^(.*?)(?:\s[-–—]\s*)?R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s*$/i);
  const left = clean(priceMatch ? priceMatch[1].replace(/\s[-–—]\s*$/, '') : body);
  const priceRaw = priceMatch ? priceMatch[2] : '';
  const paren = left.match(/^(.*\S)\s*\(([^)]*)\)\s*$/);
  let name = left;
  let qty = 1;
  let unit = 'un';
  if (paren) {
    const inside = paren[2].trim();
    const qtyMatch = inside.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
    if (qtyMatch) {
      const parsedQty = parseQtyText(qtyMatch[1]);
      if (parsedQty === null) return { issue: { line: lineNo, text: left, reason: 'Quantidade inválida.' } };
      name = clean(paren[1]);
      qty = parsedQty;
      unit = normalizeUnit(qtyMatch[2]);
    }
  }
  if (!name) return { issue: { line: lineNo, text: body, reason: 'Sem nome do item.' } };
  let cents = 0;
  if (priceRaw) {
    const parsed = parseMoney(priceRaw);
    if (!Number.isFinite(parsed) || parsed < 0) return { issue: { line: lineNo, text: name, reason: 'Preço inválido.' } };
    cents = parsed;
  }
  return { item: withUnitPrice(name, qty, unit, category, cents, true) };
}

function parseChecklist(lines: string[]): ShoppingParse {
  const items: ImportedItem[] = [];
  const issues: ImportIssue[] = [];
  let category = 'Outros';
  lines.forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;
    const section = line.match(/^-{2,}\s*(.+?)\s*-{2,}$/);
    if (section) {
      category = clean(section[1]) || 'Outros';
      return;
    }
    const box = line.match(/^\[[^\]]*\]\s*(.*)$/);
    const body = box ? box[1].trim() : line;
    if (box && !body) {
      issues.push({ line: lineNo, text: line, reason: 'Linha de item vazia.' });
      return;
    }
    if (!box && !body.includes('R$') && !/\([^)]+\)/.test(body) && /[;,\t]/.test(body)) {
      issues.push({ line: lineNo, text: line, reason: 'Linha ignorada.' });
      return;
    }
    const parsed = checklistBody(body, lineNo, category);
    if (parsed.issue) issues.push(parsed.issue);
    else if (parsed.item) items.push(parsed.item);
  });
  return { format: 'checklist', items: mergeItems(items), issues, columns: [], map: { ...EMPTY_MAP }, priceIsTotal: true };
}

function tableFromMatrix(matrix: string[][], format: 'csv' | 'json', override?: Partial<ColumnMap>): ShoppingParse {
  if (!matrix.length) return { ...emptyParse(), format };
  const headerCells = matrix[0].map((c) => clean(c));
  const hasHeader = headerCells.some((c) => fieldOf(c));
  const columns = hasHeader ? headerCells : headerCells.map((_, i) => `Coluna ${i + 1}`);
  const data = hasHeader ? matrix.slice(1) : matrix;
  const suggested = suggestMap(columns);
  const map = applyOverride(suggested.map, override);
  const priceIsTotal = map.price !== null && fieldOf(columns[map.price] || '') === 'total';
  if (map.name === null) {
    return { format, items: [], issues: [{ line: 1, text: '', reason: 'Não achei a coluna do nome. Escolha qual coluna é o item.' }], columns, map, priceIsTotal };
  }
  const { items, issues } = rowsToItems(data, columns, map, priceIsTotal, hasHeader ? 2 : 1);
  return { format, items, issues, columns, map, priceIsTotal };
}

function applyOverride(base: ColumnMap, override?: Partial<ColumnMap>): ColumnMap {
  if (!override) return base;
  const map = { ...base };
  (Object.keys(base) as (keyof ColumnMap)[]).forEach((k) => {
    if (override[k] !== undefined) map[k] = override[k] ?? null;
  });
  return map;
}

function parseCsv(text: string, override?: Partial<ColumnMap>): ShoppingParse {
  const lines = text.split('\n').filter((l) => l.trim());
  const delim = detectDelim(lines[0] || '') || ';';
  const matrix = lines.map((l) => splitCsv(l, delim).map((c) => c.trim()));
  return tableFromMatrix(matrix, 'csv', override);
}

function jsonRows(value: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(value)) {
    if (value.every((v) => v && typeof v === 'object' && !Array.isArray(v))) return value as Record<string, unknown>[];
    return null;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of ['items', 'itens', 'lista', 'list']) {
      if (Array.isArray(obj[key])) return jsonRows(obj[key]);
    }
    if (fieldOf(Object.keys(obj)[0] || '') || 'nome' in obj || 'name' in obj) return [obj];
  }
  return null;
}

function parseJson(text: string, override?: Partial<ColumnMap>): ShoppingParse {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { return { ...emptyParse(), format: 'json', issues: [{ line: 1, text: '', reason: 'JSON inválido.' }] }; }
  const records = jsonRows(value);
  if (!records) return { ...emptyParse(), format: 'json', issues: [{ line: 1, text: '', reason: 'O JSON precisa ser uma lista de itens.' }] };
  const keys: string[] = [];
  for (const rec of records) for (const k of Object.keys(rec)) if (!keys.includes(k)) keys.push(k);
  const matrix = [keys, ...records.map((rec) => keys.map((k) => rec[k] === undefined || rec[k] === null ? '' : String(rec[k])))];
  return tableFromMatrix(matrix, 'json', override);
}

function looksCsv(lines: string[]): boolean {
  const filled = lines.map((l) => l.trim()).filter(Boolean);
  if (!filled.length) return false;
  const delim = detectDelim(filled[0]);
  if (!delim) return false;
  const width = splitCsv(filled[0], delim).length;
  if (width < 2) return false;
  const consistent = filled.filter((l) => splitCsv(l, delim).length === width).length;
  return consistent >= Math.min(2, filled.length) && (filled.length >= 2 || filled[0].split(delim).some((c) => fieldOf(c)));
}

/** Lê texto de lista: seções com [ ] item, CSV ou JSON. */
export function parseShoppingText(text: string, override?: Partial<ColumnMap>): ShoppingParse {
  const raw = text.replace(/^\uFEFF/, '').replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const trimmed = raw.trim();
  if (!trimmed) return emptyParse();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return parseJson(trimmed, override);
    } catch { /* texto comum */ }
  }
  const lines = raw.split('\n');
  if (looksChecklist(lines)) return parseChecklist(lines);
  if (looksCsv(lines)) return parseCsv(trimmed, override);
  return parseChecklist(lines);
}

export function planShoppingImport(existing: ShoppingItem[], incoming: ImportedItem[], sumExisting: boolean): PlannedImport[] {
  return incoming.map((item) => {
    const sameName = existing.filter((e) => norm(e.name) === norm(item.name));
    if (!sameName.length) return { item, action: 'add' as const, note: 'Novo' };
    const sameUnit = sameName.find((e) => norm(e.unit) === norm(item.unit) && e.status === 'pendente');
    if (sumExisting && sameUnit) return { item, action: 'sum' as const, existingId: sameUnit.id, note: 'Soma na quantidade que já está pendente' };
    const bought = sameName.find((e) => e.status === 'comprado');
    if (bought && !sameName.some((e) => e.status === 'pendente')) return { item, action: 'skip' as const, existingId: bought.id, note: 'Já está na lista como comprado' };
    return { item, action: 'skip' as const, existingId: sameName[0].id, note: 'Já está na lista' };
  });
}

export function applyShoppingImport(data: AppData, listId: string, rows: PlannedImport[]): AppData {
  let next = data;
  for (const row of rows) {
    if (row.action === 'skip') continue;
    if (row.action === 'add') {
      next = addItem(next, listId, {
        name: row.item.name,
        qty: row.item.qty,
        unit: row.item.unit,
        estPrice: row.item.estPrice,
        category: row.item.category || 'Outros',
        status: 'pendente',
      });
      continue;
    }
    if (row.action === 'sum') {
      if (!row.existingId) continue;
      const cur = next.lists.find((l) => l.id === listId)?.items.find((i) => i.id === row.existingId);
      if (!cur || cur.status !== 'pendente') continue;
      const qty = Math.round((cur.qty + row.item.qty) * 1000) / 1000;
      next = updateItem(next, listId, cur.id, {
        qty,
        ...(cur.estPrice === 0 && row.item.estPrice > 0 ? { estPrice: row.item.estPrice } : {}),
      });
      continue;
    }
    const exhaustive: never = row.action;
    return exhaustive;
  }
  return next;
}
