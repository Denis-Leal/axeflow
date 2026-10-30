# Auditoria técnica de UX/UI

Data: 29/10/2026.

Continuação: as pendências de código e os limites atuais de validação estão atualizados em [UX_FOLLOWUP.md](UX_FOLLOWUP.md). O conteúdo abaixo registra a primeira rodada.

## Escopo e método

Inspeção estática das rotas, componentes, hooks e CSS do frontend Next.js 14/React 18. A identidade visual utiliza Bootstrap 5, Bootstrap Icons, variáveis CSS próprias e componentes em `components/ui/index.js`. Há implementações separadas de tabelas e cards para desktop/mobile; foram preservadas. Foram examinados navegação, autenticação, criação/edição de giras, inscrição pública, consulentes, membros, estoque, atendimentos e agendamentos. A avaliação responsiva foi feita pelo código, sem inspeção visual em navegador.

## Problemas e correções implementadas

| Prioridade | Tela/componente | Evidência e impacto | Correção e princípio |
| --- | --- | --- | --- |
| Alta | Inscrição pública | Campos obrigatórios fora de um formulário, envio apenas por clique e checkbox com `display:none`; dificuldade de concluir por teclado e ausência de validação nativa. | Formulário com submit, rótulos associados, autocomplete, checkbox focável, foco visível, anúncio de erro/sucesso e estado ocupado. Dados continuam preservados em falhas. Jakob, prevenção de erros e acessibilidade. |
| Alta | ConfirmModal | Sem nome acessível, foco inicial, contenção de Tab ou restauração do foco; usuário podia operar conteúdo atrás da confirmação. | Semântica de diálogo, foco inicial em Cancelar, ciclo de Tab, restauração de foco, bloqueio de rolagem e limite de altura com rolagem interna. Jakob e prevenção de erros. |
| Alta | Button | A variante com `href` continuava navegável quando desabilitada ou carregando. | Remove destino e bloqueia callback nesses estados; mantém callback quando habilitada. Jakob e feedback coerente. |
| Alta | Histórico de estoque | Falha de rede era convertida em lista vazia e apresentada como ausência de movimentações. | Erro explícito com nova tentativa, reinício do carregamento e descarte de respostas de consultas anteriores. Estado vazio da lista principal também deixa de aparecer junto do erro. Feedback e prevenção de decisões incorretas. |
| Média | FormField | Label sem `htmlFor`; dicas sem associação ao controle. | IDs estáveis, vínculo de label e `aria-describedby`, preservando IDs e descrições existentes. Jakob e acessibilidade. |
| Média | Criação/edição de giras | Seletores clicáveis sem operação por teclado; responsável opcional marcado como obrigatório. | Seletores acessíveis por Enter/Espaço e remoção do asterisco contraditório. Corrigida também importação ausente de Badge no painel de promovidos, que podia falhar após clicar no WhatsApp. Jakob e clareza. |
| Média | Navegação | Sidebar fixa sem área rolável; menus mobile sem estado expandido ou fechamento por Escape/mudança de rota. | Rolagem da navegação lateral; estados acessíveis e fechamento dos menus. Mantidos agrupamentos existentes. Jakob, Hick-Hyman e Miller. |
| Média | CSS responsivo | Regra comentada como 44px implementava 36px; grid exigia 300px mínimos; barra inferior ignorava área segura. | Alvos mínimos de 44px no mobile, grid adaptável e espaço para área segura em barra, conteúdo e menus. Fitts. |
| Média | Feedback compartilhado | Spinner sem estado acessível e foco inconsistente em controles. | Status de carregamento nomeado e contorno de foco visível. Von Restorff aplicado ao foco necessário à navegação. |

Não foram criados indicadores de progresso: Goal-Gradient não justificou alteração localizada nos fluxos examinados. Zeigarnik foi considerado na preservação dos dados durante falhas; não foi introduzida persistência de dados pessoais no navegador. Os agrupamentos de Hick-Hyman/Miller já existentes foram mantidos, sem impor quantidade artificial de opções.

## Arquivos

- `frontend/components/ui/index.js`
- `frontend/components/ConfirmModal.js`
- `frontend/components/BottomNav.js`
- `frontend/styles/globals.css`
- `frontend/pages/public/[slug].js`
- `frontend/pages/inventario.js`
- `frontend/pages/giras/nova.js`
- `frontend/pages/giras/editar/[id].js`
- `frontend/tests/ux-ui.test.cjs`

## Validação

- `node --test tests/ux-ui.test.cjs`, em `frontend`: seis testes aprovados. Verificam associações de labels/dicas, preservação de constraints e descrições, bloqueio de links desabilitados/carregando, callback de links habilitados, status de carregamento e operação por teclado de StatCard.
- `npm run build`, em `frontend`: compilação de produção e geração de 28 páginas concluídas. O projeto não define scripts próprios de lint ou verificação de tipos e não tem configuração TypeScript; a etapa padrão de verificação do Next não equivale a uma auditoria ESLint dedicada.
- `git diff --check`: sem erros de whitespace.
- Nenhuma dependência foi adicionada. Os testes usam Node, React e o compilador SWC já distribuído pelo Next.

## Pendências e limites

- Não houve validação visual em navegador, dispositivo físico ou leitor de tela. O ciclo de foco dos modais, os estados de rede da inscrição e do histórico, o recorte em viewports e as áreas seguras precisam de verificação interativa.
- Não foram executados fluxos autenticados com backend/banco ou teste multi-tenant de ponta a ponta. As alterações não modificam endpoints, payloads, autorização ou regras de negócio.
- Há modais locais em membros, consulentes, atendimentos, agendamentos e financeiro que não reutilizam ConfirmModal. A uniformização completa de foco e semântica permanece pendente; exige avaliação específica de cada formulário para preservar os fluxos.
- `useConsulentes` captura erros que a tela não apresenta, podendo mostrar uma lista vazia após falha. O ranking também merece revisão de tentativas automáticas. Permaneceram sem correção nesta rodada, que concentrou o tratamento de recuperação no inventário.
- Alguns campos fora de FormField continuam com labels sem associação. A correção compartilhada cobre seus consumidores diretos, sem certificar acessibilidade integral das demais telas.
- O build alertou sobre a base Browserslist desatualizada. Não foi atualizada por não ser necessária às correções.
