# Meu Financeiro

PWA de finanças pessoais em português (pt-BR): salário, vale-alimentação (separado do salário), compras, casa, contas e lembretes, planejamento, reserva de emergência, relatórios, CSV e backup. Offline, sem conta, sem servidor. Os dados ficam no IndexedDB do aparelho.

- Especificação: [SPEC.md](SPEC.md)
- Instalação e uso: [INSTALL.md](INSTALL.md) (PWA e APK Android em `artifacts/MeuFinanceiro-debug.apk`)

Stack: Vite + Preact + TypeScript, service worker próprio, gráficos em SVG, Vitest (regras) e Playwright (ponta a ponta, 390x844).
