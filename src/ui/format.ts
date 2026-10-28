import { brl } from '../domain/money';

let hidden = false;
export function setPrivacy(v: boolean) { hidden = v; }
export function isPrivate() { return hidden; }

/** Valor em R$ respeitando o modo privacidade. */
export function money(cents: number, opts: { sign?: boolean } = {}): string {
  if (hidden) return 'R$ •••••';
  const s = brl(Math.abs(cents));
  if (cents < 0) return `− ${s}`;
  return opts.sign && cents > 0 ? `+ ${s}` : s;
}
