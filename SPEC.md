# PROJETO: MEU FINANCEIRO — APLICATIVO DE ORGANIZAÇÃO FINANCEIRA PESSOAL

## 1. OBJETIVO

Aplicativo de controle financeiro pessoal chamado Meu Financeiro, em português brasileiro, com moeda em reais (R$), datas no padrão brasileiro e foco em simplicidade, organização e planejamento financeiro.

Permitir que o usuário controle vale-alimentação, salário, gastos da casa, contas futuras, compras mensais e reserva de emergência.

Implementar funcionalidades reais, formulários funcionais, cálculos corretos, persistência dos dados e navegação completa — não apenas protótipo visual.

## 2. TECNOLOGIA E INSTALAÇÃO

- Priorizar PWA web responsiva, instalável na tela inicial do Android.
- Arquitetura organizada, componentes reutilizáveis, código fácil de manter.
- Dados no dispositivo (IndexedDB ou similar).
- Funções principais offline.
- Notificações locais quando suportadas; explicar limitações do navegador.
- Sem assinatura, servidor ou conta externa para funções básicas.
- Sem dependências pagas obrigatórias.
- Estrutura preparada para futura conversão em APK Android.
- Se a plataforma suportar Android nativo compilável, pode usá-lo.

## 3. IDENTIDADE VISUAL

Paleta: verde-esmeralda (positivo/saldo), azul-petróleo (secundário), fundo branco/cinza claro, vermelho discreto (despesas/atrasos), cinza (auxiliar).

Design: mobile-first, cartões arredondados e sombras suaves, tipografia moderna, ícones vetoriais, gráficos simples, tema claro padrão + tema escuro. Evitar excesso, animações desnecessárias e visual de painel admin. Ilustrações vetoriais próprias leves.

## 4. NAVEGAÇÃO

Barra inferior com 5 áreas: Início | Compras | Casa | Contas | Mais.

Em Mais: Movimentações, Planejamento, Reserva de emergência, Relatórios, Perfil/configurações, Backup e restauração.

## 5. INÍCIO — DASHBOARD

Saldo disponível calculado; receitas/despesas do mês; contas pendentes; previsto próximos dias; reserva de emergência; progresso de metas; resumo VA; próximas contas; previsto vs realizado. Filtros mês/ano. Botão de privacidade para ocultar valores. VA e dinheiro em conta SEMPRE separados.

## 6. COMPRAS — VALE-ALIMENTAÇÃO

Itens: nome, categoria, quantidade, unidade, preço previsto, preço real, mercado opcional, mês, observações, status pendente/comprado.

Funções: listas mensais, marcar comprados, total estimado e gasto real, saldo restante VA, % usado, alerta de limite, duplicar listas, itens frequentes, exclusão com confirmação.

VA com saldo próprio independente do salário. Só entra no gasto real quando realizada. Sem dupla contagem.

## 7. CASA — SALÁRIO E DESPESAS

Receitas: salário líquido, renda extra, outros.
Despesas: aluguel/prestação, água, energia, internet, telefone, supermercado (dinheiro), limpeza, transporte, saúde, lazer, assinaturas, parcelas, outros.

Cada registro: descrição, categoria, valor, data, forma de pagamento, status, observações.
Diferenciar: prevista, realizada, paga, pendente. Fixas recorrentes e variáveis. Pagar atualiza status — não duplica.

## 8. CONTAS E LEMBRETES (prioritário)

Gastos futuros antecipados. Campos: nome, valor previsto, data, categoria, origem (salário/VA/outra), tipo (fixa/parcela/compra/eventual), recorrência, observações, status.

Lista + calendário, filtros, marcar paga, editar/cancelar, avisos, atrasadas, quanto do salário comprometido, sobra estimada. Lembretes in-app + notificações se suportadas (dia e N dias antes). Recorrentes geram próximos sem duplicar.

## 9. PLANEJAMENTO

Orçamento dos próximos meses: salário, extras, fixas, parcelas, compras, variáveis, meta de economia. Previsão: receitas, despesas, saldo, comprometido, disponível poupar. Parcelas com quantidade, valor, primeira data, periodicidade. Previsto vs realizado separados. Estimativas claramente identificadas.

## 10. RESERVA DE EMERGÊNCIA

Config: valor atual, meta em meses de despesas, essenciais mensais, contribuição mensal, meta personalizada, prazo. Cálculos: meta total, acumulado, %, falta, contribuição sugerida, prazo estimado. Referências 3/6/12 meses. Depósitos/retiradas separados. Transferência para reserva NÃO é despesa de consumo.

## 11. MOVIMENTAÇÕES

Histórico central: id, descrição, tipo, valor, data, categoria, fonte, status, referência origem. Busca/filtro/editar/excluir. Correções atualizam totais. Sem duplicar ao pagar conta ou concluir compra.

## 12. REGRAS OBRIGATÓRIAS

- Nunca misturar VA com salário
- Contas futuras ≠ despesas pagas
- Saldo atual vs projetado separados
- Saldo bancário informado vs calculado
- Sem negativos onde não cabem
- Validar datas/valores/obrigatórios
- Confirmar exclusões
- Identificar estimativas
- Sem duplicação
- Indicadores atualizam na hora
- Corrigir lançamentos sem quebrar totais

## 13. RELATÓRIOS

Mensais: receitas vs despesas, por categoria, previsto vs realizado, evolução saldo, evolução reserva, gastos casa, uso VA. Barras e rosca. Export CSV + resumo imprimível.

## 14. BACKUP

Local, auto-save, persistência. Export JSON, restore com validação, confirmação antes de substituir, aviso antes de limpar. Explicar risco de perda se apagar dados do app. Sem enviar dados a terceiros.

## 15. ONBOARDING

Primeira abertura: salário líquido, VA mensal, dia de recebimento, despesas fixas conhecidas, meta inicial da reserva. Tudo editável depois. Empty state amigável. Sem inventar valores. Exemplos só se marcados como demo.

## 16. TESTES E ENTREGA

Testar CRUD, persistência, saldos, separação VA/salário, recorrentes, parcelas, lembretes, reserva, backup, mobile, offline. Entregar projeto completo + instruções instalação/compilação. Limitações claras + alternativa. Prioridade: confiável e funcional; visual depois.

## 17. EXPERIÊNCIA DIÁRIA

App permanente. Prioridade: uso contínuo anos.

Início: saldo disponível considerando compromissos; contas próximas; VA separado; reserva; uma ação do dia; botão destacado gasto/receita; registro em segundos.
Compras: saldo VA; lista; add rápido; orçamento sempre visível.
Casa: receitas/despesas; prevista/realizada/paga; registro curto.
Contas: hoje / próximos / atrasadas; futuros; lembretes; pagar sem duplicar.
Planejamento/reserva: sobra até próximo recebimento; planejar; progresso; contribuição sugerida.

Retenção: poucos campos; auto-save; lembretes sem excesso; retomada fácil; sem culpa; progresso realista; empty states com orientação; backup fácil; UI rápida; tudo funcional.

Sucesso = entender situação em segundos e registrar gasto sem esforço.
