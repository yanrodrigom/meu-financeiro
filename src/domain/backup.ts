import type { AppData } from './types';
import { isValidISO } from './dates';
import { defaultSettings, emptyData } from './ops';

export const BACKUP_APP = 'meu-financeiro';

export interface BackupFile { app: typeof BACKUP_APP; schemaVersion: 1; exportedAt: string; data: AppData }

export function makeBackup(data: AppData): BackupFile {
  return { app: BACKUP_APP, schemaVersion: 1, exportedAt: new Date().toISOString(), data };
}

const isObj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);
const isInt = (x: unknown) => typeof x === 'number' && Number.isInteger(x);
const isStr = (x: unknown) => typeof x === 'string';

/** Valida um arquivo de backup. Retorna os dados normalizados ou lista de erros (em português). */
export function parseBackup(raw: unknown): { ok: true; data: AppData } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  let obj: any = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return { ok: false, errors: ['O arquivo não é um JSON válido.'] }; }
  }
  if (!isObj(obj) || obj.app !== BACKUP_APP) return { ok: false, errors: ['Este arquivo não é um backup do Meu Financeiro.'] };
  if (obj.schemaVersion !== 1) return { ok: false, errors: [`Versão de backup não suportada (${String(obj.schemaVersion)}).`] };
  const d = obj.data;
  if (!isObj(d)) return { ok: false, errors: ['Backup sem dados.'] };
  for (const k of ['movements', 'bills', 'series', 'lists']) if (!Array.isArray(d[k])) errors.push(`Campo "${k}" ausente ou inválido.`);
  if (!isObj(d.settings)) errors.push('Configurações ausentes.');
  if (errors.length) return { ok: false, errors };
  const ids = new Set<string>();
  d.movements.forEach((m: any, i: number) => {
    if (!isObj(m) || !isStr(m.id) || !isStr(m.description) || !isInt(m.amount) || !isValidISO(m.date) || !['receita', 'despesa', 'reserva_deposito', 'reserva_retirada', 'ajuste'].includes(m.type) || !['conta', 'va', 'outra'].includes(m.source) || !['prevista', 'pendente', 'realizada', 'paga'].includes(m.status)) errors.push(`Movimentação #${i + 1} inválida.`);
    else if (m.type !== 'ajuste' && m.amount < 0) errors.push(`Movimentação #${i + 1} com valor negativo.`);
    else if (ids.has(m.id)) errors.push(`Movimentação duplicada (${m.id}).`);
    else ids.add(m.id);
  });
  const billIds = new Set<string>();
  d.bills.forEach((b: any, i: number) => {
    if (!isObj(b) || !isStr(b.id) || !isStr(b.name) || !isInt(b.amount) || b.amount < 0 || !isValidISO(b.dueDate) || !['pendente', 'paga', 'cancelada'].includes(b.status) || !['salario', 'va', 'outra'].includes(b.source)) errors.push(`Conta #${i + 1} inválida.`);
    else if (billIds.has(b.id)) errors.push(`Conta duplicada (${b.id}).`);
    else billIds.add(b.id);
  });
  d.series.forEach((s: any, i: number) => {
    if (!isObj(s) || !isStr(s.id) || !isValidISO(s.startDate) || !isInt(s.amount) || !Array.isArray(s.skipped)) errors.push(`Recorrência #${i + 1} inválida.`);
  });
  d.lists.forEach((l: any, i: number) => {
    if (!isObj(l) || !isStr(l.id) || !/^\d{4}-\d{2}$/.test(l.month) || !Array.isArray(l.items)) errors.push(`Lista de compras #${i + 1} inválida.`);
    else l.items.forEach((it: any, j: number) => { if (!isObj(it) || !isStr(it.name) || typeof it.qty !== 'number' || it.qty <= 0 || !isInt(it.estPrice) || it.estPrice < 0) errors.push(`Item ${j + 1} da lista "${l.name}" inválido.`); });
  });
  if (errors.length) return { ok: false, errors: errors.slice(0, 10) };
  const base = emptyData();
  const data: AppData = {
    ...base, ...d, schemaVersion: 1,
    settings: { ...defaultSettings(), ...d.settings },
    reserve: { ...base.reserve, ...(isObj(d.reserve) ? d.reserve : {}) },
    plans: isObj(d.plans) ? d.plans : {},
    frequentItems: Array.isArray(d.frequentItems) ? d.frequentItems : [],
    notified: Array.isArray(d.notified) ? d.notified : [],
  };
  return { ok: true, data };
}
