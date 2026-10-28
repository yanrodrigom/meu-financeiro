import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../icons';
import { addMonth, monthLabel } from '../../domain/dates';
import { centsToInput } from '../../domain/money';

// ---------- Bottom sheet ----------
export function Sheet({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ComponentChildren; footer?: ComponentChildren }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.classList.add('no-scroll');
    return () => { window.removeEventListener('keydown', k); document.body.classList.remove('no-scroll'); };
  }, [open]);
  if (!open) return null;
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div class="sheet-head">
          <h2>{title}</h2>
          <button class="icon-btn" type="button" aria-label="Fechar" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div class="sheet-body">{children}</div>
        {footer && <div class="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Confirmação e avisos ----------
type ConfirmReq = { title: string; text?: string; ok?: string; danger?: boolean; typeToConfirm?: string; resolve: (v: boolean) => void };
let pushConfirm: ((r: ConfirmReq) => void) | null = null;
let pushToast: ((t: string, kind?: 'ok' | 'err') => void) | null = null;

export function confirmDialog(opts: Omit<ConfirmReq, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => (pushConfirm ? pushConfirm({ ...opts, resolve }) : resolve(window.confirm(opts.title))));
}
export function toast(text: string, kind: 'ok' | 'err' = 'ok') { pushToast?.(text, kind); }

export function OverlayHost() {
  const [req, setReq] = useState<ConfirmReq | null>(null);
  const [typed, setTyped] = useState('');
  const [toasts, setToasts] = useState<{ id: number; text: string; kind: string }[]>([]);
  useEffect(() => {
    pushConfirm = (r) => { setTyped(''); setReq(r); };
    pushToast = (text, kind = 'ok') => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, text, kind }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
    };
  }, []);
  const close = (v: boolean) => { req?.resolve(v); setReq(null); };
  return (
    <>
      {req && (
        <div class="sheet-backdrop center" onClick={(e) => e.target === e.currentTarget && close(false)}>
          <div class="dialog" role="alertdialog" aria-modal="true" aria-label={req.title}>
            <h3>{req.title}</h3>
            {req.text && <p class="muted">{req.text}</p>}
            {req.typeToConfirm && (
              <label class="field"><span>Digite <b>{req.typeToConfirm}</b> para confirmar</span>
                <input value={typed} onInput={(e) => setTyped((e.target as HTMLInputElement).value)} aria-label="Confirmação" autoFocus />
              </label>
            )}
            <div class="row gap end">
              <button class="btn ghost" type="button" onClick={() => close(false)}>Cancelar</button>
              <button class={`btn ${req.danger ? 'danger' : 'primary'}`} type="button" disabled={!!req.typeToConfirm && typed.trim().toUpperCase() !== req.typeToConfirm} onClick={() => close(true)}>{req.ok || 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
      <div class="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} class={`toast ${t.kind}`}>{t.text}</div>)}
      </div>
    </>
  );
}

// ---------- Campos ----------
export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ComponentChildren }) {
  return (
    <label class={`field ${error ? 'has-error' : ''}`}>
      <span>{label}</span>
      {children}
      {error ? <small class="err">{error}</small> : hint ? <small class="hint">{hint}</small> : null}
    </label>
  );
}

export function MoneyInput({ value, onChange, autoFocus, big, name, placeholder = '0,00' }: { value: string; onChange: (v: string) => void; autoFocus?: boolean; big?: boolean; name?: string; placeholder?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) setTimeout(() => ref.current?.focus(), 60); }, []);
  return (
    <div class={`money-input ${big ? 'big' : ''}`}>
      <span>R$</span>
      <input ref={ref} name={name} inputMode="decimal" autoComplete="off" placeholder={placeholder} value={value} onInput={(e) => onChange((e.target as HTMLInputElement).value.replace(/[^\d.,]/g, ''))} />
    </div>
  );
}
export const moneyStr = (c?: number) => (c ? centsToInput(c) : '');

export function Segmented<T extends string>({ value, options, onChange, name }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; name?: string }) {
  return (
    <div class="segmented" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button type="button" role="radio" aria-checked={value === o.value} class={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Chips({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div class="chips">
      {options.map((o) => <button type="button" class={`chip ${value === o ? 'on' : ''}`} onClick={() => onChange(o)}>{o}</button>)}
    </div>
  );
}

export function Select({ value, options, onChange, name }: { value: string; options: (string | { value: string; label: string })[]; onChange: (v: string) => void; name?: string }) {
  return (
    <select name={name} value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value)}>
      {options.map((o) => (typeof o === 'string' ? <option value={o}>{o}</option> : <option value={o.value}>{o.label}</option>))}
    </select>
  );
}

// ---------- Visual ----------
export function Card({ children, class: cls = '', onClick, title, action }: { children: ComponentChildren; class?: string; onClick?: () => void; title?: string; action?: ComponentChildren }) {
  return (
    <section class={`card ${cls} ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      {(title || action) && <div class="card-head"><h3>{title}</h3>{action}</div>}
      {children}
    </section>
  );
}

export function Progress({ value, tone = 'emerald', label }: { value: number; tone?: 'emerald' | 'teal' | 'warn' | 'danger'; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return <div class={`progress ${tone}`} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}><div style={{ width: `${v}%` }} /></div>;
}

export function Empty({ icon = 'sparkle', title, text, action }: { icon?: string; title: string; text: string; action?: ComponentChildren }) {
  return (
    <div class="empty">
      <div class="empty-art"><Icon name={icon} size={30} /></div>
      <h4>{title}</h4>
      <p>{text}</p>
      {action}
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function MonthBar({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div class="monthbar">
      <button class="icon-btn" type="button" aria-label="Mês anterior" onClick={() => onChange(addMonth(month, -1))}><Icon name="chevronL" /></button>
      <label class="month-label">
        <span>{cap(monthLabel(month))}</span>
        <input type="month" aria-label="Escolher mês e ano" value={month} onChange={(e) => { const v = (e.target as HTMLInputElement).value; if (v) onChange(v); }} />
      </label>
      <button class="icon-btn" type="button" aria-label="Próximo mês" onClick={() => onChange(addMonth(month, 1))}><Icon name="chevronR" /></button>
    </div>
  );
}

export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'danger' | 'muted' | 'teal'; children: ComponentChildren }) {
  return <span class={`badge ${tone}`}>{children}</span>;
}

export function PageHeader({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: boolean; right?: ComponentChildren }) {
  return (
    <header class="page-head">
      {back && <button class="icon-btn" type="button" aria-label="Voltar" onClick={() => history.length > 1 ? history.back() : (location.hash = '#/mais')}><Icon name="chevronL" /></button>}
      <div class="grow"><h1>{title}</h1>{subtitle && <p class="muted">{subtitle}</p>}</div>
      {right}
    </header>
  );
}

export function Stat({ label, value, tone, sub }: { label: string; value: string; tone?: string; sub?: string }) {
  return <div class={`stat ${tone || ''}`}><span>{label}</span><strong>{value}</strong>{sub && <small>{sub}</small>}</div>;
}

export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return <button class="fab" type="button" onClick={onClick} aria-label={label}><Icon name="plus" size={26} stroke={2.4} /><span>{label}</span></button>;
}

export type Child = JSX.Element | null | false;
