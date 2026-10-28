// Persistência local em IndexedDB (um documento com todos os dados). Nada sai do aparelho.
const DB = 'meu-financeiro';
const STORE = 'kv';
const KEY = 'app-data';
const MIRROR = 'mf-mirror';

function writeMirror<T>(value: T): void {
  try { localStorage.setItem(MIRROR, JSON.stringify(value)); } catch { /* quota ou modo privado */ }
}

function readMirror<T>(): T | undefined {
  try {
    const raw = localStorage.getItem(MIRROR);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as T;
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch { return undefined; }
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

let dbp: Promise<IDBDatabase> | null = null;
let openDb: IDBDatabase | null = null;
const db = () => (dbp ??= open().then((d) => { openDb = d; return d; }));

/** Grava na hora. localStorage é síncrono: um reload no mesmo instante ainda vê o dado. */
export function persistNow<T>(value: T): void {
  writeMirror(value);
  if (!openDb) return;
  try {
    const tx = openDb.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, KEY);
  } catch { /* saveData ainda tenta de novo */ }
}

export async function loadData<T>(): Promise<T | undefined> {
  const mirrored = readMirror<T>();
  if (mirrored) return mirrored;
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(KEY);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error);
  });
}

export async function saveData<T>(value: T): Promise<void> {
  writeMirror(value);
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearData(): Promise<void> {
  try { localStorage.removeItem(MIRROR); } catch { /* sem localStorage */ }
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Pede ao navegador para não apagar os dados automaticamente (quando suportado). */
export async function requestPersistence(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}
