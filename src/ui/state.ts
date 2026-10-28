import { useEffect, useState } from 'preact/hooks';
import { currentMonth } from '../domain/dates';

// Estado de interface compartilhado (mês selecionado e rota).
let month = sessionStorage.getItem('mf-month') || currentMonth();
const ml = new Set<() => void>();
export function setMonth(m: string) { month = m; sessionStorage.setItem('mf-month', m); ml.forEach((l) => l()); }
export function useMonth(): [string, (m: string) => void] {
  const [, s] = useState(0);
  useEffect(() => { const l = () => s((n) => n + 1); ml.add(l); return () => { ml.delete(l); }; }, []);
  return [month, setMonth];
}

export function parseRoute(): { path: string; query: URLSearchParams } {
  const h = location.hash.replace(/^#\/?/, '');
  const [p, q] = h.split('?');
  return { path: p || 'inicio', query: new URLSearchParams(q || '') };
}
export function navigate(path: string) { location.hash = `#/${path}`; }
export function useRoute() {
  const [r, setR] = useState(parseRoute());
  useEffect(() => {
    const l = () => { setR(parseRoute()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', l);
    return () => window.removeEventListener('hashchange', l);
  }, []);
  return r;
}
