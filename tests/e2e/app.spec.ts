import { test, expect } from '@playwright/test';
import { boot, onboard, sheet, tab, more, settle } from './helpers';

test.describe('Onboarding e Início', () => {
  test('onboarding valida campos, cria dados reais e persiste após recarregar', async ({ page }) => {
    await boot(page);
    await expect(page.getByRole('heading', { name: 'Meu Financeiro' })).toBeVisible();
    await page.getByRole('button', { name: 'Começar configuração' }).click();
    await page.locator('input[name=dia-pagamento]').fill('40');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('alert')).toContainText('entre 1 e 31');
    await page.getByRole('button', { name: 'Voltar' }).click();
    await page.reload();
    await onboard(page, { fixed: true });
    await expect(page.getByTestId('saldo-conta')).toHaveText('R$ 1.500,00');
    await expect(page.getByTestId('va-saldo')).toHaveText('R$ 800,00');
    await expect(page.getByText('Dados de demonstração')).toHaveCount(0);
    await settle(page);
    await page.reload();
    await expect(page.getByTestId('saldo-conta')).toHaveText('R$ 1.500,00');
    await expect(page.getByText('Olá, Yan').or(page.getByText(/Yan/)).first()).toBeVisible();
    // despesa fixa do onboarding virou conta recorrente
    await tab(page, 'Contas');
    await expect(page.getByText('Internet').first()).toBeVisible();
  });

  test('lançamento rápido: gasto na conta e gasto no VA ficam separados', async ({ page }) => {
    await onboard(page);
    await page.locator('button.fab').click();
    const s = sheet(page);
    await s.locator('input[name=valor]').fill('50');
    await s.getByRole('button', { name: 'Transporte' }).click();
    await s.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByTestId('saldo-conta')).toHaveText('R$ 1.450,00');
    await page.locator('button.fab').click();
    await sheet(page).locator('input[name=valor]').fill('20,50');
    await sheet(page).getByRole('radio', { name: 'VA' }).click();
    await sheet(page).getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByTestId('va-saldo')).toHaveText('R$ 779,50');
    await expect(page.getByTestId('saldo-conta')).toHaveText('R$ 1.450,00');
    await settle(page);
    await page.reload();
    await expect(page.getByTestId('saldo-conta')).toHaveText('R$ 1.450,00');
    await expect(page.getByTestId('va-saldo')).toHaveText('R$ 779,50');
  });

  test('modo demonstração é identificado e removível', async ({ page }) => {
    await boot(page);
    await page.getByRole('button', { name: 'Explorar com dados de demonstração' }).click();
    await expect(page.getByText('Dados de demonstração')).toBeVisible();
    await page.getByRole('status').getByRole('button', { name: 'Remover' }).click();
    await page.getByRole('button', { name: 'Remover dados de demonstração e começar' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remover demo' }).click();
    await expect(page.getByRole('button', { name: 'Começar configuração' })).toBeVisible();
  });
});

test.describe('Compras (VA)', () => {
  test('lista, itens, marcar comprado sem duplicar e persistência', async ({ page }) => {
    await onboard(page);
    await tab(page, 'Compras');
    await page.getByRole('button', { name: /Criar lista/ }).click();
    await page.getByLabel('Adicionar item rápido').fill('Arroz 5kg');
    await page.getByLabel('Adicionar item rápido').press('Enter');
    await expect(page.getByRole('listitem').filter({ hasText: 'Arroz 5kg' })).toBeVisible();
    // item detalhado
    await page.getByRole('button', { name: 'Detalhado' }).click();
    const s = sheet(page);
    await s.locator('input[name=item]').fill('Café 500g');
    await s.locator('input[name=qtd]').fill('2');
    await s.locator('input[name=previsto]').fill('18,90');
    await s.locator('button[type=submit]').click();
    await expect(page.getByText('Café 500g')).toBeVisible();
    await expect(page.getByTestId('va-gasto')).toHaveText('R$ 0,00');
    await page.getByRole('button', { name: 'Marcar Café 500g como comprado' }).click();
    await expect(page.getByTestId('va-gasto')).toHaveText('R$ 37,80');
    await expect(page.getByTestId('va-restante')).toHaveText('R$ 762,20');
    // desmarca e marca de novo: continua um único gasto
    await page.getByRole('button', { name: 'Desmarcar Café 500g' }).click();
    await expect(page.getByTestId('va-gasto')).toHaveText('R$ 0,00');
    await page.getByRole('button', { name: 'Marcar Café 500g como comprado' }).click();
    await expect(page.getByTestId('va-gasto')).toHaveText('R$ 37,80');
    // Início mostra o mesmo saldo do VA e o saldo da conta não muda
    await tab(page, 'Início');
    await expect(page.getByTestId('va-saldo')).toHaveText('R$ 762,20');
    await expect(page.getByTestId('saldo-conta')).toHaveText('R$ 1.500,00');
    // Movimentações tem 1 lançamento de compras
    await more(page, 'Movimentações');
    await expect(page.getByText(/Compras: /)).toHaveCount(1);
    await settle(page);
    await page.reload();
    await tab(page, 'Compras');
    await expect(page.getByTestId('va-gasto')).toHaveText('R$ 37,80');
    // excluir item
    await page.getByRole('button', { name: 'Excluir Arroz 5kg' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Arroz 5kg' })).toHaveCount(0);
    await expect(page.getByRole('listitem').filter({ hasText: 'Café 500g' })).toHaveCount(1);
  });

  test('importa txt com seções na lista do mês sem duplicar e sem gastar VA', async ({ page }) => {
    await onboard(page);
    await tab(page, 'Compras');
    const sample = [
      '--- COMIDA E MARMITAS ---',
      '[ ] Peito de Frango (4 kg) - R$ 72,00',
      '[ ] Carne Moída (1,5 kg) - R$ 45,00',
      '--- FRUTAS E LEGUMES ---',
      '[ ] Maçã (3 kg) - R$ 30,00',
      '--- FIM DE SEMANA ---',
      '[ ] Refrigerante em Lata (2 fardos c/ 12) - R$ 70,00',
      '--- HIGIENE E LIMPEZA ---',
      '[ ] Papel higiênico, Shampoo... - R$ 78,00',
    ].join('\n');
    await page.getByRole('button', { name: 'Importar lista' }).click();
    await sheet(page).locator('textarea[name=lista-texto]').fill(sample);
    await expect(sheet(page).getByRole('button', { name: 'Adicionar 5 item(ns)' })).toBeEnabled();
    await sheet(page).getByRole('button', { name: 'Adicionar 5 item(ns)' }).click();
    await expect(page.getByText('Peito de Frango')).toBeVisible();
    await expect(page.getByText('1,5 kg')).toBeVisible();
    await expect(page.getByText('fardos c/ 12')).toBeVisible();
    await expect(page.getByText('Papel higiênico, Shampoo...')).toBeVisible();
    await expect(page.getByText('COMIDA E MARMITAS').first()).toBeVisible();
    await expect(page.getByText(/previsto R\$ 295,00/)).toBeVisible();
    await expect(page.getByTestId('va-gasto')).toHaveText('R$ 0,00');
    await page.getByRole('button', { name: 'Importar lista' }).click();
    await sheet(page).locator('input[type=file]').setInputFiles({ name: 'lista.txt', mimeType: 'text/plain', buffer: Buffer.from(sample, 'utf-8') });
    await expect(sheet(page).getByText('0 novo(s) · 5 já na lista')).toBeVisible();
    await expect(sheet(page).getByRole('button', { name: 'Nada novo para adicionar' })).toBeDisabled();
  });
});

test.describe('Casa', () => {
  test('despesa pendente → Paguei atualiza o mesmo registro', async ({ page }) => {
    await onboard(page);
    await tab(page, 'Casa');
    await page.getByRole('button', { name: /Despesa$/ }).click();
    const s = sheet(page);
    await s.locator('input[name=descricao]').fill('Gás de cozinha');
    await s.locator('input[name=valor]').fill('120');
    await s.getByRole('radio', { name: 'Pendente' }).click();
    await s.locator('button[type=submit]').click();
    await expect(page.getByText('Gás de cozinha')).toBeVisible();
    await page.getByRole('button', { name: 'Paguei' }).click();
    await expect(page.getByRole('button', { name: 'Paguei' })).toHaveCount(0);
    // receita extra
    await page.getByRole('button', { name: /Receita$/ }).click();
    await sheet(page).locator('input[name=descricao]').fill('Freela');
    await sheet(page).locator('input[name=valor]').fill('300');
    await sheet(page).locator('button[type=submit]').click();
    await tab(page, 'Início');
    await expect(page.getByTestId('saldo-conta')).toHaveText('R$ 1.680,00');
    await more(page, 'Movimentações');
    await expect(page.getByText('Gás de cozinha')).toHaveCount(1);
  });
});

test.describe('Contas', () => {
  test('cadastrar, pagar (sem duplicar), desfazer, parcelas e excluir', async ({ page }) => {
    await onboard(page);
    await tab(page, 'Contas');
    await page.getByRole('button', { name: 'Nova' }).click();
    let s = sheet(page);
    await s.locator('input[name=nome]').fill('Celular');
    await s.locator('input[name=valor]').fill('60');
    await s.locator('input[name=vencimento]').fill('2026-10-30');
    await s.locator('button[type=submit]').click();
    const row = page.getByRole('listitem').filter({ hasText: 'Celular' });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Pagar' }).click();
    await sheet(page).getByRole('button', { name: 'Confirmar pagamento' }).click();
    await tab(page, 'Início');
    await expect(page.getByTestId('saldo-conta')).toHaveText('R$ 1.440,00');
    await more(page, 'Movimentações');
    await expect(page.getByText('Celular')).toHaveCount(1);
    // desfazer pelo detalhe
    await tab(page, 'Contas');
    await page.getByRole('button', { name: 'Pagas no mês' }).click();
    await page.getByText('Celular').first().click();
    await sheet(page).getByRole('button', { name: 'Desfazer pagamento' }).click();
    await tab(page, 'Início');
    await expect(page.getByTestId('saldo-conta')).toHaveText('R$ 1.500,00');
    // parcelamento 3x
    await tab(page, 'Contas');
    await page.getByRole('button', { name: 'Nova' }).click();
    s = sheet(page);
    await s.locator('input[name=nome]').fill('Tênis');
    await s.getByRole('radio', { name: /Parcela/ }).click();
    await s.locator('input[name=valor]').fill('90');
    await s.locator('input[name=vencimento]').fill('2026-11-10');
    await s.locator('input[name=parcelas]').fill('3');
    await s.locator('button[type=submit]').click();
    await page.getByRole('button', { name: 'Pendentes' }).click();
    await expect(page.getByText(/Tênis \(\d\/3\)/)).toHaveCount(3);
    // excluir conta avulsa
    await page.getByText('Celular').first().click();
    await sheet(page).getByRole('button', { name: 'Excluir', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button').last().click();
    await expect(page.getByText('Celular')).toHaveCount(0);
    // calendário
    await page.getByRole('radio', { name: 'Calendário' }).or(page.getByRole('button', { name: 'Calendário' })).first().click();
    await expect(page.getByRole('grid')).toBeVisible();
  });
});

test.describe('Reserva, Movimentações, Planejamento, Perfil', () => {
  test('reserva: guardar reduz saldo mas não é despesa; retirada maior que a reserva é bloqueada', async ({ page }) => {
    await onboard(page);
    await more(page, 'Reserva');
    await expect(page.getByTestId('reserva-total')).toHaveText('R$ 500,00');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await sheet(page).locator('input[name=valor-reserva]').fill('200');
    await sheet(page).getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByTestId('reserva-total')).toHaveText('R$ 700,00');
    await page.getByRole('button', { name: 'Retirar' }).click();
    await sheet(page).locator('input[name=valor-reserva]').fill('5000');
    await sheet(page).getByRole('button', { name: 'Confirmar' }).click();
    await expect(sheet(page).locator('.err')).toBeVisible();
    await sheet(page).getByRole('button', { name: 'Fechar' }).click();
    await tab(page, 'Início');
    await expect(page.getByTestId('saldo-conta')).toHaveText('R$ 1.300,00');
    await expect(page.locator('.stat', { hasText: 'Despesas' })).toContainText('R$ 0,00');
  });

  test('movimentações: criar, buscar, editar e excluir', async ({ page }) => {
    await onboard(page);
    await more(page, 'Movimentações');
    await page.getByRole('button', { name: 'Novo' }).click();
    let s = sheet(page);
    await s.locator('input[name=descricao]').fill('Farmácia');
    await s.locator('input[name=valor]').fill('45,90');
    await s.locator('button[type=submit]').click();
    await page.getByLabel('Buscar').fill('farm');
    await expect(page.getByText('Farmácia')).toHaveCount(1);
    await page.getByText('Farmácia').click();
    s = sheet(page);
    await s.locator('input[name=valor]').fill('50');
    await s.locator('button[type=submit]').click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Farmácia' })).toContainText('R$ 50,00');
    await page.getByText('Farmácia').click();
    await sheet(page).getByRole('button', { name: /Excluir/ }).click();
    await page.getByRole('alertdialog').getByRole('button').last().click();
    await expect(page.getByText('Farmácia')).toHaveCount(0);
    await tab(page, 'Início');
    await expect(page.getByTestId('saldo-conta')).toHaveText('R$ 1.500,00');
  });

  test('planejamento: editar orçamento do mês', async ({ page }) => {
    await onboard(page);
    await more(page, 'Planejamento');
    await expect(page.getByText('Estimativa').first()).toBeVisible();
    await page.getByRole('button', { name: /Editar orçamento de novembro/ }).click();
    await sheet(page).locator('input[name=extras]').fill('400');
    await sheet(page).locator('input[name=variaveis]').fill('600');
    await sheet(page).getByRole('button', { name: 'Salvar' }).click();
    await settle(page);
    await page.reload();
    await page.getByRole('button', { name: /Editar orçamento de novembro/ }).click();
    await expect(sheet(page).locator('input[name=extras]')).toHaveValue('400,00');
  });

  test('perfil: ajuste de saldo pelo banco', async ({ page }) => {
    await onboard(page);
    await more(page, 'Perfil');
    await expect(page.getByTestId('saldo-calculado')).toHaveText('R$ 1.500,00');
    await page.locator('input[name=saldo-banco]').fill('1.480,00');
    await page.getByRole('button', { name: 'Conferir e ajustar' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Ajustar' }).click();
    await expect(page.getByTestId('saldo-calculado')).toHaveText('R$ 1.480,00');
  });
});

test.describe('Tema, privacidade, exportação e backup', () => {
  test('modo escuro e privacidade persistem', async ({ page }) => {
    await onboard(page);
    await page.getByRole('button', { name: 'Tema escuro' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Ocultar valores' }).click();
    await expect(page.getByTestId('saldo-conta')).toHaveText(/•/);
    await expect(page.getByTestId('disponivel')).not.toContainText('1.500');
    await settle(page);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByTestId('saldo-conta')).toHaveText(/•/);
    await page.getByRole('button', { name: 'Mostrar valores' }).click();
    await expect(page.getByTestId('saldo-conta')).toHaveText('R$ 1.500,00');
  });

  test('CSV (BOM, ;) e backup JSON: exportar, apagar, importar', async ({ page }) => {
    await onboard(page);
    await page.locator('button.fab').click();
    await sheet(page).locator('input[name=valor]').fill('12,34');
    await sheet(page).locator('input[name=descricao]').fill('Lanche; com "aspas"');
    await sheet(page).getByRole('button', { name: 'Salvar' }).click();
    await more(page, 'Relatórios');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /CSV das movimentações do mês/ }).click()]);
    expect(dl.suggestedFilename()).toBe('movimentacoes-2026-10.csv');
    const csv = await (await import('node:fs/promises')).readFile(await dl.path());
    expect(csv.subarray(0, 3).toString('hex')).toBe('efbbbf');
    const text = csv.toString('utf8');
    expect(text).toContain(';');
    expect(text).toContain('"Lanche; com ""aspas"""');
    expect(text).toContain('12,34');

    await more(page, 'Backup');
    const [bk] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar backup (JSON)' }).click()]);
    const json = JSON.parse(await (await import('node:fs/promises')).readFile(await bk.path(), 'utf8'));
    expect(json.app).toBe('meu-financeiro');
    expect(json.data.movements.some((m: { description: string }) => m.description.startsWith('Lanche'))).toBe(true);

    // arquivo inválido é recusado
    await page.getByLabel('Arquivo de backup').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"foo":1}') });
    await expect(page.getByText('Backup inválido').first()).toBeVisible();

    // apagar tudo
    await page.getByRole('button', { name: 'Apagar todos os dados' }).click();
    const dlg = page.getByRole('alertdialog');
    await expect(dlg.getByRole('button', { name: 'Apagar tudo' })).toBeDisabled();
    await dlg.getByLabel('Confirmação').fill('APAGAR');
    await dlg.getByRole('button', { name: 'Apagar tudo' }).click();
    await expect(page.getByRole('button', { name: 'Começar configuração' })).toBeVisible();

    // aparelho "zerado": restaurar direto da tela de boas-vindas
    await page.getByLabel('Restaurar backup').setInputFiles(await bk.path());
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restaurar' }).click();
    await expect(page.getByTestId('saldo-conta')).toHaveText('R$ 1.487,66');
  });
});

test('offline: recarrega sem rede depois que o service worker instala', async ({ page, context }) => {
  await onboard(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect.poll(() => page.evaluate(async () => {
    const k = (await caches.keys()).find((x) => x.startsWith('mf-shell-'));
    return k ? (await (await caches.open(k)).keys()).length : 0;
  })).toBeGreaterThanOrEqual(9);
  await settle(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('saldo-conta')).toHaveText('R$ 1.500,00');
  await tab(page, 'Compras');
  await expect(page.getByRole('heading', { name: 'Compras' })).toBeVisible();
  await context.setOffline(false);
});

test('manifesto e ícones', async ({ request }) => {
  const r = await request.get('manifest.webmanifest');
  expect(r.ok()).toBe(true);
  const m = await r.json();
  expect(m.name).toBe('Meu Financeiro');
  expect(m.display).toBe('standalone');
  for (const i of m.icons) expect((await request.get(i.src)).ok()).toBe(true);
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
});

test('dados salvos mesmo recarregando imediatamente após a ação', async ({ page }) => {
  await onboard(page);
  await page.locator('button.fab').click();
  await sheet(page).locator('input[name=valor]').fill('10');
  await sheet(page).getByRole('button', { name: 'Salvar' }).click();
  await page.reload();
  await expect(page.getByTestId('saldo-conta')).toHaveText('R$ 1.490,00');
});

test('notificações: ativar com permissão concedida e lembrete de conta que vence hoje', async ({ page, context }) => {
  await context.grantPermissions(['notifications']);
  await onboard(page);
  await tab(page, 'Contas');
  await page.getByRole('button', { name: 'Nova' }).click();
  await sheet(page).locator('input[name=nome]').fill('Luz');
  await sheet(page).locator('input[name=valor]').fill('150');
  await sheet(page).locator('input[name=vencimento]').fill('2026-10-28');
  await sheet(page).locator('button[type=submit]').click();
  await more(page, 'Perfil');
  await page.getByRole('button', { name: 'Ativar notificações do sistema' }).click();
  await expect(page.getByText(/lembrete\(s\) enviados|Lembretes ativados/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Desativar notificações' })).toBeVisible();
  // aviso dentro do app no Início
  await tab(page, 'Início');
  await expect(page.getByText('Luz').first()).toBeVisible();
});
