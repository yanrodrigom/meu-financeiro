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
- **No navegador (PWA):** as notificações só são verificadas **quando o app está aberto ou foi aberto recentemente**. Com o app totalmente fechado, o Android não garante o aviso. Abra o app uma vez por dia para receber os avisos.
- **No APK (seção 6):** os lembretes são agendados no Android e tocam por volta das **9h** mesmo com o app fechado — no dia do vencimento, X dias antes e no dia seguinte se a conta continuar pendente. Abra o app depois de pagar ou editar uma conta para atualizar os alarmes. Os dados do PWA **não** passam sozinhos para o APK: use o backup JSON.

## 3. Backup (muito importante)

- Os dados ficam salvos no armazenamento do navegador (IndexedDB) deste aparelho.
- **Se você limpar os dados do Chrome/do app, desinstalar o app ou trocar de celular, os dados são perdidos.**
- Em **Mais → Backup e restauração → Exportar backup (JSON)** você baixa um arquivo com tudo. Guarde no Google Drive, e-mail ou computador. Faça isso pelo menos uma vez por semana ou mês.
- Para restaurar (ex.: celular novo): abra o app, toque em **"Já usava o app? Restaurar um backup"** na tela de boas-vindas (ou em Backup → Escolher arquivo de backup). O arquivo é validado e o app pede confirmação antes de substituir os dados.
- Também dá para exportar **CSV** (abre no Excel/Google Planilhas, separador `;`) em **Mais → Relatórios**, e imprimir/salvar em PDF um resumo do mês.

## 4. Importar lista de compras

Em **Compras → Importar lista**, cole um texto ou escolha um arquivo `.txt` (também aceita CSV e JSON).

```text
--- COMIDA E MARMITAS ---
[ ] Peito de Frango (4 kg) - R$ 72,00
[ ] Carne Moída (1,5 kg) - R$ 45,00
--- HIGIENE E LIMPEZA ---
[ ] Papel higiênico, Shampoo... - R$ 78,00
```

A seção vira a categoria. A quantidade e a unidade ficam entre parênteses, quando existem. O valor depois de `R$` é o **total da linha** (4 kg a R$ 72 entram como R$ 18 o quilo). Os itens entram **pendentes** na lista do mês que está aberto — não gastam o VA até serem marcados como comprados. Se o nome já está na lista, ele não é copiado de novo. Dá para marcar "somar a quantidade" só para itens pendentes com a mesma unidade.

## 5. Rodar localmente (computador)

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

## 6. APK Android (Capacitor)

O mesmo app também é empacotado como aplicativo Android, sem Play Store e sem servidor. O arquivo pronto para instalar é:

`artifacts/MeuFinanceiro-debug.apk`

É um **APK de depuração** (assinado com a chave de debug do Android). Não precisa de conta Google nem de chave de publicação.

### Instalar no celular

1. Copie `MeuFinanceiro-debug.apk` para o Android (e-mail, Drive, cabo USB ou download do repositório).
2. Abra o arquivo. Se o sistema bloquear, permita a instalação:
   - Android 8 ou mais novo: ao abrir o APK, toque em **Configurações** e ative **Permitir desta fonte** (ou **Instalar apps desconhecidos**) para o app que está abrindo o arquivo (Arquivos, Chrome, Drive…). Volte e confirme **Instalar**.
   - Android mais antigo: **Configurações → Segurança → Fontes desconhecidas**.
3. Abra **Meu Financeiro**. O ícone fica na gaveta de apps como um aplicativo normal. Funciona sem internet.

Na primeira vez em que ativar os lembretes, o Android pede permissão de notificação. Aceite para os avisos tocarem com o app fechado.

### Os dados do PWA não migram sozinhos

O PWA (Chrome) e o APK são instalações diferentes. O IndexedDB de um **não** aparece no outro. Se você já usa o app no navegador:

1. No PWA: **Mais → Backup e restauração → Exportar backup (JSON)**.
2. Guarde o arquivo.
3. No APK: na tela de boas-vindas, **Já usava o app? Restaurar um backup** (ou **Mais → Backup e restauração**).
4. Confirme a substituição.

Desinstalar o APK ou limpar os dados do app apaga o que está nele. Continue exportando o JSON de vez em quando.

### Gerar o APK de novo

Requisitos: Node.js 20+, JDK 21, Android SDK com a plataforma 36 (`ANDROID_HOME` apontando para o SDK).

```bash
npm install
npm run android:debug
```

O comando gera o site em `dist/`, sincroniza o projeto em `android/`, roda `assembleDebug` e copia o resultado para `artifacts/MeuFinanceiro-debug.apk`. O arquivo intermediário do Gradle fica em `android/app/build/outputs/apk/debug/app-debug.apk`.

Na primeira vez, se a pasta `android/` não existir:

```bash
npx cap add android
npm run android:debug
```

App id: `br.yan.meufinanceiro`. Nome: **Meu Financeiro**. A WebView carrega `dist/` (`webDir`). Não há backend nem chave de release.
