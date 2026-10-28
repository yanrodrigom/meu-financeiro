import { useData, isLoaded } from '../store/store';
import { Icon } from './icons';
import { OverlayHost } from './components/kit';
import { navigate, useRoute } from './state';
import { Home } from './screens/Home';
import { Shopping } from './screens/Shopping';
import { House } from './screens/House';
import { Bills } from './screens/Bills';
import { More } from './screens/More';
import { Movements } from './screens/Movements';
import { Planning } from './screens/Planning';
import { Reserve } from './screens/Reserve';
import { Reports } from './screens/Reports';
import { Settings } from './screens/Settings';
import { Backup } from './screens/Backup';
import { Onboarding } from './screens/Onboarding';
import { billBuckets } from '../domain/calc';

const TABS = [
  { path: 'inicio', label: 'Início', icon: 'home' },
  { path: 'compras', label: 'Compras', icon: 'cart' },
  { path: 'casa', label: 'Casa', icon: 'house' },
  { path: 'contas', label: 'Contas', icon: 'bill' },
  { path: 'mais', label: 'Mais', icon: 'more' },
];
const MORE = ['movimentacoes', 'planejamento', 'reserva', 'relatorios', 'perfil', 'backup'];

export function App() {
  const d = useData();
  const { path } = useRoute();
  if (!isLoaded()) return <div class="splash">Carregando…</div>;
  if (!d.settings.onboarded) return <><Onboarding /><OverlayHost /></>;
  const active = MORE.includes(path) ? 'mais' : path;
  const late = billBuckets(d).overdue.length;
  let screen;
  switch (path) {
    case 'compras': screen = <Shopping />; break;
    case 'casa': screen = <House />; break;
    case 'contas': screen = <Bills />; break;
    case 'mais': screen = <More />; break;
    case 'movimentacoes': screen = <Movements />; break;
    case 'planejamento': screen = <Planning />; break;
    case 'reserva': screen = <Reserve />; break;
    case 'relatorios': screen = <Reports />; break;
    case 'perfil': screen = <Settings />; break;
    case 'backup': screen = <Backup />; break;
    default: screen = <Home />;
  }
  return (
    <div class={`app ${d.settings.privacy ? 'privacy' : ''}`}>
      {d.settings.demo && <div class="demo-bar no-print" role="status">Dados de demonstração <button type="button" onClick={() => navigate('perfil')}>Remover</button></div>}
      <main key={path}>{screen}</main>
      <nav class="tabbar no-print" aria-label="Navegação principal">
        {TABS.map((t) => (
          <a href={`#/${t.path}`} class={active === t.path ? 'on' : ''} aria-current={active === t.path ? 'page' : undefined}>
            <span class="tab-ic"><Icon name={t.icon} size={23} />{t.path === 'contas' && late > 0 && <i class="dot-badge">{late}</i>}</span>
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
      <OverlayHost />
    </div>
  );
}
