import { Icon } from '../icons';
import { PageHeader } from '../components/kit';
import { navigate } from '../state';
import { useData } from '../../store/store';

const items = [
  { path: 'movimentacoes', icon: 'swap', title: 'Movimentações', text: 'Histórico completo, busca e correções' },
  { path: 'planejamento', icon: 'plan', title: 'Planejamento', text: 'Próximos meses, parcelas e meta de economia' },
  { path: 'reserva', icon: 'shield', title: 'Reserva de emergência', text: 'Meta, progresso, depósitos e retiradas' },
  { path: 'relatorios', icon: 'chart', title: 'Relatórios', text: 'Gráficos, CSV e resumo para imprimir' },
  { path: 'perfil', icon: 'user', title: 'Perfil e configurações', text: 'Salário, VA, tema, lembretes, saldo' },
  { path: 'backup', icon: 'cloud', title: 'Backup e restauração', text: 'Exportar e importar seus dados' },
];

export function More() {
  const d = useData();
  return (
    <div class="page">
      <PageHeader title="Mais" subtitle={d.settings.demo ? 'Você está usando dados de demonstração' : 'Tudo fica salvo só neste aparelho'} />
      <nav class="menu" aria-label="Mais opções">
        {items.map((i) => (
          <button type="button" class="menu-item" onClick={() => navigate(i.path)}>
            <span class="menu-ic"><Icon name={i.icon} /></span>
            <span class="grow"><b>{i.title}</b><small>{i.text}</small></span>
            <Icon name="chevronR" size={18} />
          </button>
        ))}
      </nav>
      <p class="muted small center">Meu Financeiro · v1.0 · sem conta, sem servidor, sem anúncios</p>
    </div>
  );
}
