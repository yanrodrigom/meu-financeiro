import { test, expect } from '@playwright/test';
import { boot } from './helpers';

// Gera capturas de tela em 390x844 (dados de demonstração) para revisão visual.
const shots: [string, string][] = [
  ['inicio', 'inicio'], ['compras', 'compras'], ['casa', 'casa'], ['contas', 'contas'], ['mais', 'mais'],
  ['movimentacoes', 'movimentacoes'], ['planejamento', 'planejamento'], ['reserva', 'reserva'], ['relatorios', 'relatorios'],
  ['perfil', 'perfil'], ['backup', 'backup'],
];

test('capturas de tela (claro e escuro)', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/00-boas-vindas.png' });
  await page.getByRole('button', { name: 'Começar configuração' }).click();
  await page.locator('input[name=salario]').fill('3.200,00');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'screenshots/01-onboarding-salario.png' });
  await page.goto('./');
  await page.getByRole('button', { name: 'Explorar com dados de demonstração' }).click();
  await expect(page.getByTestId('saldo-conta')).toBeVisible();
  let i = 2;
  for (const [route, name] of shots) {
    await page.goto(`./#/${route}`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(350);
    await page.screenshot({ path: `screenshots/${String(i++).padStart(2, '0')}-${name}.png` });
  }
  await page.goto('./#/inicio');
  await page.locator('button.fab').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `screenshots/${String(i++).padStart(2, '0')}-registrar.png` });
  await page.keyboard.press('Escape');
  await page.goto('./#/contas');
  await page.getByRole('radio', { name: 'Calendário' }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `screenshots/${String(i++).padStart(2, '0')}-contas-calendario.png` });
  // escuro
  await page.goto('./#/inicio');
  await page.getByRole('button', { name: 'Tema escuro' }).click();
  for (const r of ['inicio', 'compras', 'contas', 'relatorios']) {
    await page.goto(`./#/${r}`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `screenshots/${String(i++).padStart(2, '0')}-escuro-${r}.png` });
  }
  await page.goto('./#/inicio');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'Ocultar valores' }).click();
  await page.screenshot({ path: `screenshots/${String(i++).padStart(2, '0')}-escuro-privacidade.png` });
});
