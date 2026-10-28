import { isPrivate } from '../format';
import { brl } from '../../domain/money';

const short = (c: number) => {
  if (isPrivate()) return '•••';
  const v = c / 100;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
};

/** Barras agrupadas (até 2 séries) em SVG puro. */
export function BarChart({ data, series, height = 170 }: { data: { label: string; values: number[] }[]; series: { name: string; color: string }[]; height?: number }) {
  const w = 340;
  const pad = { t: 16, b: 26, l: 6, r: 6 };
  const max = Math.max(1, ...data.flatMap((d) => d.values.map(Math.abs)));
  const gw = (w - pad.l - pad.r) / Math.max(1, data.length);
  const bw = Math.min(16, (gw - 10) / series.length);
  const ih = height - pad.t - pad.b;
  return (
    <figure class="chart">
      <svg viewBox={`0 0 ${w} ${height}`} role="img" aria-label={`Gráfico de barras: ${series.map((s) => s.name).join(' e ')}`}>
        <line x1={pad.l} x2={w - pad.r} y1={pad.t + ih} y2={pad.t + ih} class="axis" />
        {data.map((d, i) => {
          const gx = pad.l + i * gw + (gw - bw * series.length - 4 * (series.length - 1)) / 2;
          return (
            <g key={d.label}>
              {d.values.map((v, j) => {
                const h = Math.max(v ? 3 : 0, (Math.abs(v) / max) * ih);
                return <rect x={gx + j * (bw + 4)} y={pad.t + ih - h} width={bw} height={h} rx={4} fill={series[j].color}><title>{`${series[j].name} ${d.label}: ${isPrivate() ? '•••' : brl(v)}`}</title></rect>;
              })}
              <text x={pad.l + i * gw + gw / 2} y={height - 8} text-anchor="middle" class="tick">{d.label}</text>
            </g>
          );
        })}
        <text x={w - pad.r} y={11} text-anchor="end" class="tick">máx. {short(max)}</text>
      </svg>
      <figcaption class="legend">{series.map((s) => <span><i style={{ background: s.color }} />{s.name}</span>)}</figcaption>
    </figure>
  );
}

/** Linha simples (evolução) em SVG. */
export function LineChart({ data, color = 'var(--emerald)', height = 150 }: { data: { label: string; value: number }[]; color?: string; height?: number }) {
  const w = 340; const pad = { t: 14, b: 26, l: 10, r: 10 };
  const vals = data.map((d) => d.value);
  const max = Math.max(...vals, 0); const min = Math.min(...vals, 0);
  const span = max - min || 1; const ih = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / Math.max(1, data.length - 1);
  const y = (v: number) => pad.t + ih - ((v - min) / span) * ih;
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  return (
    <figure class="chart">
      <svg viewBox={`0 0 ${w} ${height}`} role="img" aria-label="Gráfico de evolução">
        {min < 0 && <line x1={pad.l} x2={w - pad.r} y1={y(0)} y2={y(0)} class="axis dashed" />}
        <polygon points={`${x(0)},${y(min)} ${pts} ${x(data.length - 1)},${y(min)}`} fill={color} opacity="0.12" />
        <polyline points={pts} fill="none" stroke={color} stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
        {data.map((d, i) => <g><circle cx={x(i)} cy={y(d.value)} r="3.5" fill={color}><title>{`${d.label}: ${isPrivate() ? '•••' : brl(d.value)}`}</title></circle><text x={x(i)} y={height - 8} text-anchor="middle" class="tick">{d.label}</text></g>)}
      </svg>
    </figure>
  );
}

const PALETTE = ['#0f9f6e', '#127a8a', '#3cc39a', '#2b5f75', '#8fd8b9', '#5aa9b8', '#e0a43b', '#d26a5c', '#8a7bd1', '#9aa5a0'];

/** Gráfico de rosca em SVG (stroke-dasharray). */
export function Donut({ data, size = 150, center }: { data: { label: string; value: number }[]; size?: number; center?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 52; const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div class="donut-wrap">
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label="Gráfico de rosca por categoria">
        <circle cx="70" cy="70" r={r} fill="none" class="donut-track" stroke-width="18" />
        {total > 0 && data.map((d, i) => {
          const len = (d.value / total) * c;
          const el = <circle cx="70" cy="70" r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} stroke-width="18" stroke-dasharray={`${Math.max(0, len - 1.5)} ${c}`} stroke-dashoffset={-acc} transform="rotate(-90 70 70)"><title>{`${d.label}: ${isPrivate() ? '•••' : brl(d.value)}`}</title></circle>;
          acc += len;
          return el;
        })}
        <text x="70" y="66" text-anchor="middle" class="donut-label">Total</text>
        <text x="70" y="84" text-anchor="middle" class="donut-value">{center ?? short(total)}</text>
      </svg>
      <ul class="donut-legend">
        {data.slice(0, 8).map((d, i) => (
          <li><i style={{ background: PALETTE[i % PALETTE.length] }} /><span>{d.label}</span><b>{isPrivate() ? '•••' : `${Math.round((d.value / (total || 1)) * 100)}%`}</b></li>
        ))}
      </ul>
    </div>
  );
}
