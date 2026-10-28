let counter = 0;
export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 1e6;
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${rnd}`;
}
export function nowStamp(): string { return new Date().toISOString(); }
