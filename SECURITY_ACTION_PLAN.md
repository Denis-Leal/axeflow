# Plano de ação de segurança do AxeFlow

Base da avaliação inicial em `2559790`, na branch `dev`.

## Fluxo de aprovação

Cada etapa passa por requisitos, plano técnico, implementação e gates de QA,
Reviewer e Security. DevOps e documentação participam conforme o impacto.
Após a validação, apresentar escopo, diff, comandos, resultados e pendências ao
responsável pelo projeto para aprovação do commit e push em `dev`.
O avanço à próxima etapa depende de autorização do responsável pelo projeto.

## Etapa 1 — Três P0 de autorização

### Critérios de aceite

- **AC-P0-001** — inscrição interna permite administradores e operadores do
  terreiro autenticado. Gira de outro terreiro retorna 404 antes de qualquer
  gravação ou notificação. Membros recebem 403 nesse fluxo administrativo.
- **AC-P0-002** — operadores podem criar membros e operadores. A concessão de
  `admin` exige um administrador e é validada no serviço antes de persistência,
  hash ou envio de convite. O cadastro inicial de um terreiro conserva seu fluxo.
- **AC-P0-003** — toda rota que aceita API key exige o scope correspondente.
  A chave e seu proprietário devem pertencer ao mesmo terreiro. As integrações
  documentadas e os papéis autorizados por JWT continuam funcionando.

### Decisões técnicas

- A inscrição interna recebe o usuário autenticado e filtra a gira pelo tenant
  desse usuário no serviço, com verificação defensiva do papel.
- A criação de membro recebe o papel do ator autenticado para autorizar a
  concessão de privilégios.
- `get_current_user` autentica JWT. A aceitação de API keys passa a ser explícita
  nas dependências e rotas com contrato de integração.
- A leitura de membros exige `membros:read`, a leitura de inscrições exige
  `inscricoes:read` e a exportação de gira exige `relatorios:read` para API keys.
- As rotas mistas de giras usam `giras:write`, as de tipos de atendimento usam
  `atendimentos:write` e as de agendamento usam `agendamentos:read/write`, conforme
  o catálogo de scopes existente. Preservar os endpoints `/v1` e os endpoints
  documentados de atendimentos, agendamentos e financeiro.
- Rotas de conta, dispositivos e demais operações sem contrato de API exigem JWT.

### Validação

- Exercitar os endpoints reais com dados sintéticos de dois terreiros e papéis
  distintos, incluindo rejeições sem efeitos colaterais e operações permitidas.
- Testar chaves com scope correto, incorreto e ausente, validade e consistência
  entre tenant da chave e proprietário.
- Executar regressões isoladas de banco e serviços externos de produção.
- Revisar consumidores, diff final e cobertura das entradas de API keys.
- Registrar as limitações do banco de testes em relação ao PostgreSQL.

Comando de regressão de segurança, executado a partir da raiz do projeto.

```powershell
.\.venv\Scripts\python.exe -B -m unittest discover -s backend/tests -p test_security_p0.py -v
```

A suíte usa SQLite em memória, autenticação e rotas reais, credenciais sintéticas
e substituição das integrações de email e push. O adaptador de testes acomoda
JSONB, UUID e a função de similaridade usada nas consultas. A execução não comprova
o comportamento de locks, migrations ou concorrência no PostgreSQL.

## Etapa 2 — Segredos e backups versionados

### Critérios de aceite

- **AC-001** — Dado o snapshot destinado ao próximo commit, quando a configuração
  de implantação e os arquivos distribuíveis forem verificados, então a chave
  privada VAPID deve vir de configuração externa e dumps devem estar ausentes.
- **AC-002** — Dados o backup e os 29 arquivos de `.next` anteriormente rastreados,
  quando saírem do índice Git, então suas cópias locais devem permanecer presentes
  e com os mesmos hashes SHA-256 do inventário anterior à operação.
- **AC-003** — Dados arquivos locais de ambiente, credenciais, dumps e caches,
  quando o Git avaliar seus caminhos, então deve ignorá-los e permitir exemplos
  explicitamente sanitizados.
- **AC-004** — Dados os contextos Docker `backend/` e `frontend/`, quando forem
  preparados para build, então suas regras de exclusão devem retirar segredos,
  dumps e artefatos locais do conteúdo enviado ao build.
- **AC-005** — Dado um snapshot contendo um segredo sintético ou arquivo proibido,
  quando o verificador de segurança executar, então deve falhar sem revelar o
  conteúdo. Um snapshot limpo deve passar. O modo `--staged` deve avaliar os bytes
  do índice, incluindo divergências em relação ao diretório de trabalho.
- **AC-006** — Dadas as exposições encontradas, quando os resultados forem
  entregues, então devem registrar as evidências, a exposição no histórico e as
  pendências de rotação e validação operacional com seus limites.

### Inventário e decisões

A chave privada VAPID presente em `render.yaml` na base `8e0c294` é uma chave EC
DER válida, com par público correspondente. Sua igualdade com a configuração
local foi confirmada sem imprimir os valores. O uso efetivo nos ambientes remotos
permanece desconhecido. A configuração do Render passa a solicitar o segredo
externamente, preservando o nome da variável consumida pela aplicação.

O guia `PWA_PUSH_GUIDE.md` também continha a mesma chave privada. A seção afetada
foi substituída por instruções de configuração externa e rotação. Duas versões
históricas do guia contendo essa chave foram confirmadas por comparação interna.

O catálogo de `axeflow.backup`, com 48.556 bytes, contém 13 tabelas e 13 seções de
dados, incluindo usuários, consulentes, auditoria, API keys, recuperação de senha
e subscriptions de push. Os registros não foram extraídos. O arquivo requer
tratamento restrito por seu potencial de conter dados pessoais e credenciais.

Foram identificadas duas versões únicas do arquivo de implantação com chave
privada e duas versões do backup no histórico alcançável. `.env.local` está fora
do índice e não foi encontrado no histórico por esse caminho. Essa inspeção não
comprova ausência de outras cópias ou de segredos em todo o histórico.

A retirada do backup e de `.next` é feita somente no índice Git. As 30 cópias
locais, somando 18.590.906 bytes, foram verificadas por SHA-256 antes e depois da
operação. Elas continuam sob responsabilidade do operador da estação de trabalho.

### Rotação e exposição histórica

A remediação da credencial exposta depende de rotação e validação operacional.
Após autorização para atuar nos ambientes afetados, o responsável deve executar
os passos abaixo.

1. Confirmar quais ambientes e fluxos usam o par VAPID exposto. Verificar o Web
   Push legado e identificar separadamente as credenciais do Firebase/FCM.
2. Gerar um novo par compatível com a integração em ambiente controlado e guardar
   a chave privada no gerenciador de segredos do provedor, com acesso restrito.
3. Atualizar de forma coordenada a chave privada do backend e a chave pública dos
   clientes que usam esse par. Avaliar renovação das subscriptions vinculadas à
   chave antiga e testar envio em subscriptions novas e existentes.
4. Registrar o ambiente, a versão da credencial, o responsável e o resultado dos
   testes, sem registrar a chave. Confirmar a retirada do par exposto dos fluxos
   ativos e verificar os acessos aos repositórios e aos artifacts de backup.
5. Decidir sobre reescrita do histórico e sobre as cópias em clones, forks e
   artifacts. Coordenar essas operações com os colaboradores e os provedores.

A configuração por `sync: false` deve receber o segredo no ambiente de implantação
antes de um novo provisionamento. As configurações efetivas dos serviços existentes
precisam ser conferidas pelo responsável pelo ambiente.

Rotação remota, alterações de serviços, reescrita de histórico e exclusão de cópias
externas permanecem pendentes de autorização específica. Os commits históricos
continuam contendo as versões expostas após a limpeza do snapshot atual.

### Prevenção e validação local

O verificador `scripts/check_repository_security.py` usa o Gitleaks 8.30.1 e as
regras padrão, complementadas por detecção de VAPID privado e de caminhos e
cabeçalhos de dumps. A saída contém apenas regra, caminho e linha. As exceções
combinam regra, caminho e valor público exato para a configuração cliente Firebase
existente e para o placeholder de API key na documentação.

O modo padrão avalia os arquivos rastreados e os novos arquivos que o Git não
ignora. O modo `--staged` avalia os bytes preparados no índice Git. Links são
rejeitados durante a materialização do snapshot. A análise de segredos cobre esse
snapshot e não representa uma auditoria completa de todos os commits anteriores.

O executável do Gitleaks foi obtido da publicação oficial e teve seu checksum
conferido. Instale a versão 8.30.1 ou informe o caminho do binário com `--gitleaks`.
O workflow `.github/workflows/security.yml` instala essa versão com checksum,
executa o verificador e suas regressões. As ações usadas estão fixadas por SHA.
[Publicação oficial do Gitleaks](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1).

```powershell
python -B scripts/check_repository_security.py --gitleaks "$env:GITLEAKS_BIN"
python -B scripts/check_repository_security.py --staged --gitleaks "$env:GITLEAKS_BIN"
python -B -m unittest discover -s scripts/tests -v
```

`GITLEAKS_BIN` deve apontar para o executável validado ao usar esses comandos.

| Verificação da etapa 2 | Resultado |
| --- | --- |
| QA do verificador | APROVADO, 17 testes com Gitleaks real, sem falhas ou testes ignorados |
| Scanner no diretório de trabalho | APROVADO, zero achados |
| Scanner no índice Git | APROVADO, zero achados |
| Integridade das cópias locais | APROVADO, 30 arquivos com hashes preservados |
| Regressões P0 | APROVADO, 14 testes |
| Regressões de interface | APROVADO, 17 testes |
| Reviewer | APROVADO no diff da etapa |
| DevOps | APROVADO na verificação estática de configuração |

O daemon Docker estava indisponível. Build das imagens e execução remota do novo
workflow permanecem não executados. As mudanças de configuração não foram
aplicadas aos serviços remotos. A etapa continua com pendências operacionais de
rotação e de tratamento das cópias históricas.

## Etapa 3 — Autenticação e recuperação de conta

- Uniformizar a política de senhas e a proteção de login e registro contra abuso.
- Revogar sessões após recuperação e conforme a política de troca de senha.
- Impedir consulta pública à associação entre email e terreiro na recuperação.
- Substituir o envio de senha por convite com token de uso único e expiração.
- Validar seleção do tenant para emails presentes em mais de um terreiro.
- Cobrir expiração, revogação, enumeração e tentativas automatizadas.

## Etapa 4 — Proteção de dados e superfície da aplicação

- Revisar autorização dos demais fluxos, incluindo presença de membros e push.
- Proteger auditoria contra falsificação, abuso e exposição de dados pessoais.
- Neutralizar fórmulas em exportações e restringir métricas operacionais.
- Corrigir redirecionamentos controlados por URL e o estado após troca de conta.
- Avaliar armazenamento de sessão e headers de segurança, com testes dos fluxos
  afetados e das proteções necessárias à solução escolhida.

## Etapa 5 — Dependências e operação

- Inventariar versões efetivas e vulnerabilidades aplicáveis às dependências.
- Atualizar por grupos compatíveis, com build e regressões a cada grupo.
- Validar configuração de produção, TLS, headers, permissões e exposição de rede.
- Fortalecer backup e restore com falha explícita e checagem de integridade.
- Definir RPO/RTO, alertas e procedimentos de recuperação e incidentes.
- Estabelecer CI de testes e análise de dependências, código e segredos.

## Etapa 6 — Privacidade e preparação comercial

- Inventariar dados, finalidades, bases legais e responsabilidades de tratamento,
  incluindo os dados pessoais sensíveis vinculados à atividade religiosa.
- Definir retenção, descarte, atendimento aos titulares e encerramento de tenant.
- Revisar transparência, contratos de tratamento, fornecedores, regiões e
  mecanismos aplicáveis a transferências internacionais.
- Documentar resposta a incidentes, responsabilidades, suporte e compromissos
  comerciais compatíveis com a operação comprovada.
- Montar matriz de evidências de OWASP ASVS e de gestão de segurança e privacidade,
  conforme os requisitos comerciais e legais aplicáveis.

## Situação de execução

A etapa 1 foi implementada, validada e publicada em `origin/dev`, no commit
`8e0c294`, com referência remota conferida. A implementação local da etapa 2 foi
validada. Seu commit e push aguardam aprovação do responsável pelo projeto.
A conclusão operacional depende da rotação e das decisões sobre cópias históricas.
As etapas 3 a 6 dependem de autorização para início.

| Verificação | Resultado |
| --- | --- |
| AC-P0-001, AC-P0-002 e AC-P0-003 | Atendidos no escopo avaliado |
| QA de segurança | APROVADO, 14 testes HTTP com dados sintéticos |
| Regressões de interface existentes | APROVADO, 17 testes |
| Reviewer | APROVADO, sem bloqueantes no diff da etapa |
| Security | APROVADO na análise estática dos três P0 |
| Arquitetura | APROVADO para o diff desta etapa |
| Sintaxe Python e `git diff --check` | APROVADOS |
| Build de produção por DevOps | NÃO APLICÁVEL à alteração Python sem mudanças de empacotamento, dependências ou infraestrutura |

As regressões cobrem as rejeições entre tenants sem gravação, matriz de papéis,
concessão de privilégios antes de hash e convite, scopes de leitura, escrita e
exportação, credenciais inválidas e preservação dos acessos autorizados.

Comando das regressões existentes de interface.

```powershell
node --test frontend/tests/ux-state.test.cjs frontend/tests/ux-ui.test.cjs
```

A execução SQLite apresentou aviso preexistente de relacionamento sobreposto
entre os models de gira e consumo. A validação PostgreSQL e o ambiente de produção
permanecem pendentes. A avaliação inicial e este plano não constituem certificação
ou comprovação integral de conformidade.
