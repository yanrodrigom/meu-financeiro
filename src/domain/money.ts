const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const num = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Formata centavos em R$ (pt-BR). */
export function brl(cents: number): string {
  return fmt.format((cents || 0) / 100).replace(/\u00a0/g, ' ');
}

/** Formata centavos sem símbolo, para inputs: 1234,50 */
export function centsToInput(cents: number | undefined): string {
  if (cents === undefined || cents === null || isNaN(cents)) return '';
  return num.format(cents / 100).replace(/\./g, '');
}

/** Converte texto digitado (pt-BR ou com ponto decimal) para centavos. Retorna NaN se inválido. */
export function parseMoney(input: string | number | undefined | null): number {
  if (input === undefined || input === null) return NaN;
  if (typeof input === 'number') return Math.round(input * 100);
  let s = String(input).trim().replace(/R\$\s?/i, '').replace(/\s/g, '');
  if (!s) return NaN;
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1 || /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  if (!/^\d+(\.\d{0,2})?$/.test(s) && !/^\d+\.\d+$/.test(s)) return NaN;
  const v = Math.round(parseFloat(s) * 100);
  return neg ? -v : v;
}

export function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function pctLabel(v: number): string {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}
