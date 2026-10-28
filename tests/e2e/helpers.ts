import { expect, type Page } from '@playwright/test';

/** Data fixa para os testes: 28/10/2026 12:00 (São Paulo). */
export async function boot(page: Page, path = '') {
  // Desloca o relógio (sem congelar timers) para 28/10/2026 12:00 -03:00.
  await page.addInitScript(() => {
    const target = Date.parse('2026-10-28T12:00:00-03:00');
    const RealDate = Date;
    const offset = target - RealDate.now();
    class FakeDate extends RealDate {
      constructor(...args: any[]) {
        if (args.length === 0) super(RealDate.now() + offset);
        else super(...(args as []));
      }
      static now() { return RealDate.now() + offset; }
    }
    (globalThis as any).Date = FakeDate;
  });
  page.on('pageerror', (e) => { throw e; });
  await page.goto('./' + path);
}

export const sheet = (page: Page) => page.getByRole('dialog').last();

/** Onboarding completo com valores conhecidos. */
export async function onboard(page: Page, opts: { fixed?: boolean } = {}) {
  await boot(page);
  await page.getByRole('button', { name: 'Começar configuração' }).click();
  await page.locator('input[name=nome]').fill('Yan');
  await page.locator('input[name=salario]').fill('3.000,00');
  await page.locator('input[name=dia-pagamento]').fill('5');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.locator('input[name=va]').fill('800');
  await page.locator('input[name=saldo]').fill('1500');
  await page.getByRole('button', { name: 'Continuar' }).click();
  if (opts.fixed) {
    await page.getByRole('button', { name: '+ Internet' }).click();
    await page.locator('input[name=fixa-0]').fill('100');
    await page.getByLabel('Dia', { exact: true }).fill('15');
    await page.getByRole('button', { name: 'Continuar' }).click();
  } else {
    await page.getByRole('button', { name: 'Pular' }).click();
  }
  await page.locator('input[name=reserva-inicial]').fill('500');
  await page.locator('input[name=essenciais]').fill('2000');
  await page.locator('input[name=contribuicao]').fill('200');
  await page.getByRole('button', { name: 'Concluir' }).click();
  await expect(page.getByTestId('saldo-conta')).toBeVisible();
}

export async function tab(page: Page, name: 'Início' | 'Compras' | 'Casa' | 'Contas' | 'Mais') {
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: new RegExp(name) }).click();
}

export async function more(page: Page, item: string) {
  await tab(page, 'Mais');
  await page.getByRole('navigation', { name: 'Mais opções' }).getByRole('button', { name: new RegExp(item) }).click();
}

/** Espera o auto-save (debounce de 60 ms) antes de recarregar. */
export const settle = (page: Page) => page.waitForTimeout(300);
