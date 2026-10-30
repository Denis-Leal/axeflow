# Correções finais — edição de gira e histórico

Data: 29/10/2026. Escopo: exclusivamente os dois defeitos reproduzidos em `UX_VALIDATION_FINAL.md`.

## Alterações de produção

- `frontend/pages/giras/editar/[id].js`: `saving=true` passou do envio do formulário para a confirmação positiva, imediatamente antes de processar o salvamento. Cancelar pelo botão, Escape ou fundo do diálogo não inicia o estado de gravação. Os campos permanecem preenchidos e o botão continua habilitado. O PATCH, o tratamento de erros e o reset no `finally` foram preservados; não foi criado um reset paralelo para cancelamento.
- `frontend/pages/inventario.js`: `ModalHistorico` utiliza o `useModalDialog` existente, com nome acessível específico do item, foco inicial, Tab/Shift+Tab contidos, restauração de foco, Escape e fundo inerte. A pilha do hook continua limitando Escape ao diálogo superior. O estado de carregamento é anunciado com `aria-busy`; como a requisição é somente leitura, o usuário pode fechar o histórico durante a espera. O cleanup existente ignora respostas posteriores ao fechamento. Botão de fechar, rolagem interna, erro e nova tentativa foram preservados.

Não houve alteração de backend, contratos HTTP, permissões, autenticação, regras de negócio, outras telas ou dependências.

## Testes automatizados

`node --test tests/*.test.cjs`, em `frontend`: **17 aprovados**, incluindo três novos testes de regressão:

1. Cancelar a confirmação mantém o salvamento habilitado, conserva a edição e não envia PATCH.
2. Confirmar inicia o estado ocupado, envia o PATCH correto e recupera o formulário após erro, preservando os campos.
3. O histórico integra o hook real de diálogo, mantém foco e fundo inerte e pode ser fechado por Escape durante uma consulta pendente.

Os testes anteriores de requisições fora de ordem, erro/retry, foco e diálogos sobrepostos também passaram. Os testes de estado em Node continuam usando um agendador de hooks e DOM de teste; a comprovação interativa foi feita separadamente no Chrome real.

## Chrome real com API fictícia

Resultado final: **35 cenários aprovados, nenhuma falha**, além de 15 registros de medidas de viewport. Resultados em [artifacts/ux-fixes/results.json](artifacts/ux-fixes/results.json).

- Edição de gira: cancelamento pelo botão, Escape e clique no fundo; campos preservados e botão habilitado nos três casos; nenhuma requisição PATCH nesses cancelamentos.
- Confirmação positiva: envio do PATCH e navegação após sucesso. Falha 503 com atraso: botão ocupado durante a requisição, erro apresentado, campos preservados e nova tentativa bem-sucedida.
- Histórico: nome acessível, foco dentro do diálogo, Tab/Shift+Tab, Escape, restauração do foco no botão “Ver histórico” e desbloqueio do fundo.
- Histórico em viewport móvel: fechamento durante carregamento, reabertura, erro 503, nova tentativa, dados exibidos, rolagem interna mantida e fechamento pelo botão.
- Demais fluxos de confirmação e modal: consulentes, membros, atendimentos, agendamentos, pagamento e diálogos sobrepostos com React real em StrictMode passaram novamente.
- Também foram reexecutados os cenários existentes de navegação, inscrição pública e responsividade em 1440×900, 1024×600, 390×844 e 320×740.

A primeira execução da suíte expôs uma dependência entre fixtures: cadastrar uma gira fechada alterava a mesma estrutura usada pela página pública. A fixture pública foi separada, sem alterar o backend real, e o cenário afetado e suas capturas foram repetidos com sucesso. O saldo acima inclui essas repetições, não declara aprovação da tentativa inicial.

Capturas inspecionadas:

- [Edição preservada e botão habilitado após cancelar](artifacts/ux-fixes/gira-cancel-all-mechanisms.png).
- [Histórico com foco visível no botão de fechar](artifacts/ux-fixes/history-accessible-dialog.png).
- [Erro e nova tentativa no histórico mobile](artifacts/ux-fixes/mobile-history-error-focus.png).

O Chrome utilizou perfil isolado, frontend em `127.0.0.1:3100` e API fictícia em `127.0.0.1:8101`, sem banco. Nenhum dado real foi excluído e nenhum pagamento real foi executado. A pasta de evidências anterior foi preservada; esta execução utilizou `UX_ARTIFACT_DIR=artifacts/ux-fixes`.

## Verificações e limitações

- Build de produção: **aprovado**, 28 páginas geradas.
- `git diff --check`: **sem erros** após restaurar os artefatos gerados de `.next`.
- Teste Python existente do backend: tentativa repetida com SQLite em memória e configurações fictícias; **bloqueado na coleta por ausência de `pywebpush`**, exit code 2. Não foi declarado aprovado.
- Não foram adicionadas dependências. Não existem scripts dedicados de lint/typecheck no projeto.
- Integração com FastAPI/PostgreSQL real, isolamento multi-tenant e acessibilidade com leitor de tela/dispositivo físico permanecem fora da comprovação desta execução. A aprovação no navegador se refere explicitamente à API fictícia.

## Arquivos desta correção

- Produção: `frontend/pages/giras/editar/[id].js` e `frontend/pages/inventario.js`.
- Testes: `frontend/tests/ux-state.test.cjs` e `frontend/tests/browser/{driver.py,fixture_api.py,validate.py}`.
- Evidências e documentação: `artifacts/ux-fixes/`, este relatório e referência de atualização em `UX_VALIDATION_FINAL.md`.
