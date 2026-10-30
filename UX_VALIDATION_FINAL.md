# Validação final de UX/UI — AxeFlow

Data: 29/10/2026. Escopo exclusivo: validar o diff das duas rodadas anteriores. Nenhum arquivo de produção foi modificado nesta etapa.

**Atualização posterior:** os dois defeitos abaixo foram corrigidos por solicitação explícita e revalidados no Chrome. Consulte [UX_FINAL_FIXES.md](UX_FINAL_FIXES.md): 17 testes de Node e 35 cenários de navegador aprovados. Este documento preserva os resultados históricos da validação anterior; os limites de integração com backend real continuam vigentes.

## Resultado

- Testes existentes do frontend: **14 aprovados**.
- Build de produção: **aprovado**, 28 páginas geradas.
- Navegador real com API de teste controlada: **33 cenários**, sendo **31 aprovados e dois reprovados**. Há também 15 registros de medidas de viewport; eles não são testes adicionais.
- Testes Python do backend: **bloqueados na coleta** por ausência de `pywebpush`.
- Não foi demonstrada regressão atribuível ao diff nos cenários cobertos. Duas falhas preexistentes foram reproduzidas e permanecem abertas.
- Integração com o backend real e isolamento entre terreiros: **não validados**. A auditoria não está integralmente concluída.

## Método e segurança

O navegador conectado permitiu leitura e screenshots, mas o clique falhou novamente com timeout de `Input.dispatchMouseEvent`. Não foram repetidas tentativas equivalentes nesse conector.

Foram encontrados no ambiente Chrome 155.0.8059.86 e ChromeDriver 155.0.8059.84 já instalados. Playwright, Puppeteer e Selenium não estavam disponíveis como bibliotecas nos runtimes consultados. Um cliente W3C WebDriver em Python, usando apenas a biblioteca padrão, permitiu executar os testes sem instalar dependências. O Chrome iniciado no sandbox apresentou `tab crashed`; o ChromeDriver fora do sandbox, autorizado pela revisão automática, funcionou.

O navegador utilizou um perfil novo e headless, sem acessar o perfil pessoal. O frontend executou em `127.0.0.1:3100`, com `BACKEND_URL=http://127.0.0.1:8101`. Essa API responde com dados fictícios, mantém tudo em memória e não acessa banco de dados. As exclusões de consulentes afetaram apenas essa memória. Nenhum pagamento real foi registrado; o envio de pagamento recebeu uma falha HTTP 503 deliberada. Nenhuma escrita de validação foi feita no backend real ou na produção.

Os processos da API fictícia, frontend de teste e ChromeDrivers foram encerrados após os testes.

## 1. Inspeção de código

Foram revisados o diff das duas rodadas, os dois arquivos de testes existentes, `useModalDialog`, `useConsulentes`, os estados de inventário, os campos e constraints dos formulários e os consumidores modificados.

A revisão confirma que os oito testes de estado anteriores usam um agendador mínimo de hooks e um DOM em memória. Isso não foi tratado como prova de integração com React DOM, validação nativa ou acessibilidade integral. Nesta etapa essas lacunas foram parcialmente cobertas por testes no Chrome real.

## 2. Testes automatizados existentes

Comando executado novamente após os testes de navegador:

```powershell
cd frontend
node --test tests/*.test.cjs
npm run build
```

Resultado: **14/14 aprovados**, compilação de produção bem-sucedida e 28 páginas geradas. `git diff --check` não apresentou erros de whitespace. Não há scripts dedicados de lint ou typecheck no projeto. O aviso preexistente de Browserslist desatualizado permanece.

O teste disponível do backend foi executado com `python -m pytest -q app/services/test_ajeum_service.py --disable-warnings --maxfail=1`, em `backend`, com configurações fictícias e `DATABASE_URL=sqlite:///:memory:` para evitar acesso acidental a um banco existente. A coleta parou em `ModuleNotFoundError: No module named 'pywebpush'`, importado por `push_service.py`; exit code 2. Nenhum teste do backend foi aprovado ou executado até o corpo do teste. O repositório também não fornece o `conftest.py` com as fixtures de banco descritas nesse arquivo.

## 3. Testes interativos no Chrome, com API controlada

| Fluxo | Execução e resultado |
| --- | --- |
| Login | Campos obrigatórios acionaram validação nativa; credenciais fictícias levaram ao dashboard. A rota protegida redirecionou para login sem token. |
| Navegação | Menus mobile abriram, fecharam com Escape e devolveram foco ao acionador. O link do menu navegou para membros e fechou o menu. |
| Permissões de interface | Dados de usuário fictício com papel `membro` impediram acesso à criação de gira e ocultaram o link correspondente na listagem. Isso testa somente a interface, não autorização do backend. |
| Cadastro de gira | Validação nativa, seleção de gira fechada, preenchimento, falha 503, preservação dos campos e nova tentativa bem-sucedida. |
| Edição de gira | Dados carregaram e a confirmação com “Sim, salvar” enviou PATCH para a API fictícia. Cancelar a confirmação reproduziu o defeito descrito abaixo. |
| Inscrição pública | Nome e telefone obrigatórios, checkbox de primeira visita, falha 503, preservação dos campos, nova tentativa e confirmação com posição. |
| Consulentes | Consulta, edição, estado ocupado, Escape bloqueado durante envio, mensagem de erro interna, campos preservados e sucesso após nova tentativa. Exclusão cancelada e depois confirmada exclusivamente no registro fictício; estado vazio exibido. |
| Falha da lista/ranking | Falha inicial apareceu como erro, sem falso vazio. Nova tentativa recuperou os dados. O ranking não repetiu solicitações durante a observação da falha; nova tentativa explícita exibiu sucesso vazio. |
| Histórico de estoque | Falha 503 exibida, sem mensagem enganosa de ausência de movimentações. Nova tentativa exibiu o histórico. O botão de fechar funcionou; Escape não fechou o overlay. |
| Membros, atendimentos e agendamentos | Modais de cadastro abriram e passaram em foco inicial dentro do diálogo, contenção de Tab/Shift+Tab, Escape e desbloqueio do fundo. Isso não representa teste de gravação de todos esses cadastros. |
| Financeiro | Detalhes e pagamento abriram e passaram nas verificações de teclado. Envio com erro 503 testou estado ocupado, bloqueio de Escape durante a requisição, mensagem de erro, preservação do valor e cancelamento posterior. |
| `useModalDialog` sobreposto | Uma página de teste serviu o código real do hook e React/React DOM instalados, em StrictMode. Ao abrir dois modais, apenas o superior recebeu foco e Escape; ao fechá-lo, o inferior deixou de ser inerte e recuperou o acionador. Fechar o inferior devolveu o foco ao botão original e desbloqueou o fundo. |

Os cenários foram registrados em [results.json](artifacts/ux-final/results.json). A execução do cliente retorna exit code 1 enquanto as duas falhas conhecidas estiverem presentes. Falhas iniciais do próprio roteiro — seleção com capitalização incorreta, clique antes do término da rolagem suave e expectativa de título que havia sido alterado pela fixture — foram corrigidas no roteiro e os cenários afetados foram repetidos; não foram classificados como defeitos do produto.

## 4. Validação visual

Foram produzidas capturas reais e inspecionadas amostras representativas de telas, estados de erro e modais:

| Viewport | Evidência |
| --- | --- |
| 1440 × 900 | Giras, consulentes, inventário, agendamentos e inscrição pública; modais de edição, confirmação, cadastro e pagamento. Layout desktop e foco visível. |
| 1024 × 600 | Sidebar com rolagem interna; link “Sobre” alcançado e acionado, com rodapé acessível. |
| 390 × 844 | Cards mobile, barra inferior, formulários e modal de agendamento com ações visíveis e foco. |
| 320 × 740 | Giras, consulentes, inventário, agendamentos e inscrição pública; conteúdo longo utiliza rolagem vertical. |

As 15 combinações das cinco telas principais com larguras 1440, 390 e 320 não apresentaram largura de documento maior que o viewport. Isso, isoladamente, não comprova ausência de cortes: também foram inspecionadas capturas e exercitada a rolagem até ações dos formulários. A 320px os textos dos cards de consulentes se dividem em mais linhas; não foi identificado desaparecimento de ações nessas capturas.

O foco em botões dos modais aparece com contorno dourado. Os principais botões mobile mantêm áreas amplas nas capturas; não foi certificada uma dimensão mínima para todos os links e controles da aplicação. A área segura com inset real diferente de zero não foi testada em aparelho físico. Não houve teste de teclado virtual de celular ou leitor de tela.

Capturas representativas:

- [Edição de consulente e foco visível](artifacts/ux-final/desktop-consulente-edit.png).
- [Erro de pagamento com valor preservado](artifacts/ux-final/payment-error-preserved.png).
- [Modal de agendamento mobile](artifacts/ux-final/mobile-appointment-modal.png).
- [Sidebar em desktop baixo](artifacts/ux-final/1024x600-sidebar-scroll.png).
- [Inscrição confirmada na API de teste](artifacts/ux-final/desktop-public-success.png).
- [Consulentes em 320px](artifacts/ux-final/320x740-consulentes.png).

## 5. Defeitos reproduzidos e decisão de atuação

### Edição de gira: cancelar confirmação deixa salvar bloqueado

1. Abrir `/giras/editar/gira-test` no ambiente fictício.
2. Alterar o título e clicar em “Salvar Alterações”.
3. Clicar em “Cancelar” na confirmação.
4. O diálogo fecha, mas o botão de salvar continua desabilitado e em estado de carregamento.

`handleSubmit` define `saving=true` antes da confirmação, enquanto `fecharModal` apenas fecha o diálogo. O cancelamento não restaura `saving`. O mesmo código existe no `HEAD` **c1d2b45**, anterior ao diff das auditorias. A confirmação positiva e o envio funcionaram em teste separado. Permanece sem correção nesta etapa porque o usuário autorizou correção localizada de regressões introduzidas pelas rodadas, e este comportamento é preexistente.

### Histórico de estoque: Escape não fecha o overlay

1. Abrir inventário e clicar em “Ver histórico”.
2. Pressionar Escape após carregar os dados.
3. O histórico permanece aberto.

`ModalHistorico` não integra `useModalDialog` nem possui handler de Escape. O overlay também não expõe a mesma semântica e contenção de foco dos modais tratados na segunda rodada. A ausência desses mecanismos já existe no `HEAD` c1d2b45; não é regressão do tratamento de erro/retry. Botão de fechar e nova tentativa funcionaram. Permanece registrado, sem ampliar a implementação na validação final.

**Não foi realizada correção de código de produção.** Foram adicionados somente o ambiente/roteiro de validação, capturas e este relatório.

## 6. Integração e pendências críticas

Os testes do Chrome são integração entre o frontend real e uma **API fictícia**, não testes de FastAPI/PostgreSQL. Os HTTP 503 e atrasos foram controlados nessa API; não equivalem a interrupção real de conectividade. Os dados, respostas de autenticação e papéis também são fictícios.

Continuam sem evidência suficiente:

- Fluxos completos com backend real em um banco de teste isolado.
- Autorização entre usuários de terreiros distintos e isolamento multi-tenant real.
- Os testes Python, bloqueados na coleta por dependência ausente e sem fixtures de banco fornecidas.
- Correção e revalidação das duas falhas preexistentes.
- Leitor de tela, teclado virtual mobile e área segura em dispositivo físico.

Não se recomenda tratar este relatório como aceite integral da auditoria enquanto os dois defeitos e a validação real de autorização permanecerem pendentes.

## Reprodução do ambiente controlado

Arquivos: `frontend/tests/browser/fixture_api.py`, `driver.py` e `validate.py`. Utilizam Python padrão, React já instalado e o ChromeDriver disponível no ambiente; nenhuma dependência do produto foi adicionada.

1. Iniciar o ChromeDriver instalado na porta 9517, limitado a `127.0.0.1`.
2. Em `frontend`, executar `python tests/browser/fixture_api.py`.
3. Em outro terminal de `frontend`, definir `BACKEND_URL=http://127.0.0.1:8101` e executar `npm run dev -- -p 3100 -H 127.0.0.1`.
4. Executar `python tests/browser/validate.py`. Em Windows, usar `PYTHONIOENCODING=utf-8` para o log.
5. Encerrar os processos de teste. O roteiro encerra sua sessão de navegador em `finally`.

Não apontar o roteiro ou a fixture para produção. Os caminhos do Chrome e a porta do ChromeDriver estão explícitos no cliente para tornar a sessão local verificável.
