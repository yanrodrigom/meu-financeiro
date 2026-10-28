import { useEffect, useState } from 'preact/hooks';
import type { AppData } from '../domain/types';
import { emptyData, runMaintenance, ValidationError } from '../domain/ops';
import { clearData, loadData, saveData } from './db';
import { setPrivacy } from '../ui/format';

type Listener = () => void;
let state: AppData = emptyData();
let loaded = false;
const listeners = new Set<Listener>();

function emit() { listeners.forEach((l) => l()); }

function applySideEffects() {
  document.documentElement.dataset.theme = state.settings.theme;
  setPrivacy(state.settings.privacy);
  try { localStorage.setItem('mf-theme', JSON.stringify(state.settings.theme)); } catch { /* sem localStorage */ }
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', state.settings.theme === 'dark' ? '#0b1714' : '#f4f7f6');
}

export function getData(): AppData { return state; }
export function isLoaded() { return loaded; }

export async function initStore() {
  try {
    const saved = await loadData<AppData>();
    if (saved && saved.schemaVersion === 1) state = { ...emptyData(), ...saved, settings: { ...emptyData().settings, ...saved.settings } };
  } catch (e) {
    console.error('Falha ao abrir dados locais', e);
  }
  if (state.settings.onboarded) state = runMaintenance(state);
  loaded = true;
  applySideEffects();
  emit();
}

// Grava imediatamente (encadeado para manter a ordem). Um único documento pequeno: barato e seguro
// mesmo se o app for fechado logo após uma ação.
let chain: Promise<void> = Promise.resolve();
function scheduleSave() {
  const snapshot = state;
  chain = chain.then(() => saveData(snapshot)).catch((e) => console.error('Falha ao salvar', e));
}

export async function flushSave() {
  scheduleSave();
  await chain;
}

/** Aplica uma operação. Retorna mensagem de erro (string) se a validação falhar. */
export function act(fn: (d: AppData) => AppData): string | null {
  try {
    state = fn(state);
    applySideEffects();
    scheduleSave();
    emit();
    return null;
  } catch (e) {
    if (e instanceof ValidationError) return e.message;
    console.error(e);
    return (e as Error).message || 'Algo deu errado.';
  }
}

export function replaceAll(d: AppData) {
  state = runMaintenance(d);
  applySideEffects();
  emit();
  return flushSave();
}

export async function wipeAll() {
  await chain;
  await clearData();
  state = emptyData();
  applySideEffects();
  emit();
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useData(): AppData {
  const [, set] = useState(0);
  useEffect(() => {
    const l = () => set((n) => n + 1);
    listeners.add(l);
    // Se os dados carregaram/mudaram antes da inscrição, re-renderiza agora (evita ficar em "Carregando…").
    l();
    return () => { listeners.delete(l); };
  }, []);
  return state;
}

// Nunca grava antes de carregar: evitaria sobrescrever os dados salvos com um estado vazio.
const saveIfLoaded = () => { if (loaded) void saveData(state); };
window.addEventListener('pagehide', saveIfLoaded);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveIfLoaded(); });
