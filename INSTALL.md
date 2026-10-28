# Meu Financeiro — instalação e uso

App de controle financeiro pessoal (PWA). Funciona no navegador do celular, pode ser instalado na tela inicial e funciona sem internet. **Não tem conta nem servidor: os dados ficam só no seu aparelho.**

## 1. Instalar no Android

1. Abra o endereço do app no **Google Chrome** do celular.
2. Toque no menu **⋮** (canto superior direito) → **Instalar app** (ou **Adicionar à tela inicial**).
3. Confirme. O ícone "Financeiro" aparece na tela inicial e o app abre em tela cheia, como um app normal.
4. Abra uma vez com internet. Depois disso ele abre mesmo **sem internet**.

Dica: na primeira abertura, faça a configuração (salário, VA, saldo, contas fixas, reserva). Tudo pode ser alterado depois em **Mais → Perfil e configurações**. Se quiser só conhecer, use "Explorar com dados de demonstração" e depois remova a demo no aviso amarelo do topo.

## 2. Lembretes e notificações (limitações)

- Dentro do app, contas atrasadas, que vencem hoje e as próximas aparecem sempre no **Início** e em **Contas**.
- Em **Perfil → Lembretes** você pode ativar as notificações do sistema. O app avisa no dia do vencimento, X dias antes (você escolhe) e quando a conta atrasou.
- **Importante:** como é um app web sem servidor, as notificações só são verificadas **quando o app está aberto ou foi aberto recentemente** (o navegador pode suspender o app em segundo plano). Com o app totalmente fechado, o Android não garante o aviso. Para lembretes 100% confiáveis seria preciso empacotar como app nativo (ver seção 5). Abra o app uma vez por dia para receber os avisos.

## 3. Backup (muito importante)

- Os dados ficam salvos no armazenamento do navegador (IndexedDB) deste aparelho.
- **Se você limpar os dados do Chrome/do app, desinstalar o app ou trocar de celular, os dados são perdidos.**
- Em **Mais → Backup e restauração → Exportar backup (JSON)** você baixa um arquivo com tudo. Guarde no Google Drive, e-mail ou computador. Faça isso pelo menos uma vez por semana ou mês.
- Para restaurar (ex.: celular novo): abra o app, toque em **"Já usava o app? Restaurar um backup"** na tela de boas-vindas (ou em Backup → Escolher arquivo de backup). O arquivo é validado e o app pede confirmação antes de substituir os dados.
- Também dá para exportar **CSV** (abre no Excel/Google Planilhas, separador `;`) em **Mais → Relatórios**, e imprimir/salvar em PDF um resumo do mês.

## 4. Rodar localmente (computador)

Requisitos: Node.js 20 ou superior.

```bash
npm install
npm run dev          # servidor de desenvolvimento (http://localhost:5173)
npm test             # testes unitários (regras de cálculo)
npm run build        # gera a versão final em dist/
npx playwright install chromium   # 1ª vez, para os testes ponta a ponta
npm run test:e2e     # testes ponta a ponta (celular 390x844, usa dist/)
```

A pasta `dist/` é um site estático: pode ser publicada em qualquer hospedagem (GitHub Pages, Netlify etc.), em qualquer subpasta. O arquivo `meu-financeiro-dist.zip` contém essa pasta pronta.

**Publicar no GitHub Pages:** o repositório já tem `.github/workflows/pages.yml`. Em *Settings → Pages*, escolha **Source: GitHub Actions**. Cada push na branch `main` testa, gera o build e publica.

## 5. Futuro: APK com Capacitor

O app foi feito com caminhos relativos e sem dependência de servidor, então pode virar APK sem reescrever:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Meu Financeiro" br.yan.meufinanceiro --web-dir dist
npm run build && npx cap add android && npx cap sync
npx cap open android   # abre no Android Studio para gerar o APK
```

Com Capacitor dá para trocar os lembretes por **notificações locais agendadas** (`@capacitor/local-notifications`), que funcionam com o app fechado. Atenção: os dados do PWA instalado pelo Chrome **não** passam automaticamente para o APK. Exporte um backup JSON no PWA e importe no APK.
