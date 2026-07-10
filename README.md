# AxeFlow

Sistema multi-tenant para gestão de giras, inscrições, presença, membros, consulentes, estoque, Ajeum, notificações e integrações externas para terreiros de Umbanda e Candomblé.

## Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy, Alembic, PostgreSQL, JWT, SlowAPI, APScheduler, Firebase Admin e Web Push.
- **Frontend**: Next.js 14, React 18, Axios, Bootstrap 5, Bootstrap Icons, Firebase Messaging e React Toastify.
- **Infra**: Docker, Docker Compose, Render para backend, Neon para banco e Vercel para frontend.
- **Banco**: PostgreSQL com migrations Alembic em `backend/migrations`.

## Funcionalidades Atuais

### Autenticação e multi-tenant

- Cadastro de terreiro com primeiro usuário administrador.
- Login com JWT.
- Papéis de usuário: `admin`, `operador` e `membro`.
- Isolamento por `terreiro_id` nas principais entidades.
- Alteração de senha autenticada.
- Recuperação de senha em fluxo multi-tenant:
  - busca de terreiros por email;
  - envio de link por email;
  - redefinição por token com expiração e invalidação após uso.

### Dashboard

- Visão geral do terreiro.
- Indicadores de total de giras, giras abertas, inscritos e concluídas.
- Destaque para a próxima gira.
- Confirmação de presença do membro em giras abertas para confirmação.
- Lista de giras recentes.

### Giras

- Cadastro, edição, listagem, detalhe e exclusão lógica de giras.
- Giras públicas, com inscrição de consulentes por link público.
- Giras fechadas, com confirmação/controle de presença de membros.
- Status de gira: `aberta`, `fechada` e `concluida`.
- Configuração de data, horário, tipo, limites, período de abertura/fechamento de lista e responsável.
- Slug público gerado para compartilhamento.
- Promoção automática de consulentes da fila quando o limite de vagas aumenta.
- Finalização de gira com processamento de consumo de estoque.

### Inscrições e presença

- Inscrição pública de consulentes por `/public/[slug]`.
- Inscrição interna de consulentes pela equipe do terreiro.
- Lista de inscritos por gira.
- Marcação de presença/falta de consulentes.
- Cancelamento e reativação de inscrições.
- Busca de consulentes por nome/telefone.
- Confirmação de presença de membros em giras públicas e fechadas.
- Controle de presença de membros pela equipe.

### Consulentes

- Lista de consulentes do terreiro.
- Perfil individual com histórico.
- Edição e exclusão lógica.
- Ranking de presença e faltas.
- Notas internas por consulente.
- Detecção/alerta de possível duplicidade durante inscrições.

### Membros

- Cadastro, listagem, edição e desativação de membros.
- Perfil individual com histórico.
- Ranking de presença.
- Confirmação de presença pelo próprio membro.
- Controle administrativo de presença por gira.

### Estoque, inventário e consumo por gira

- Itens de estoque do terreiro.
- Itens individuais de médiuns/membros.
- Criação de itens próprios por membros.
- Criação de itens do terreiro por `admin` e `operador`.
- Criação de itens para outro membro por `admin`.
- Saldo calculado por movimentações.
- Histórico de movimentações por item.
- Movimentações manuais de entrada, saída e ajuste.
- Registro de consumo de itens em uma gira.
- Registro de consumo próprio pelo membro.
- Registro de consumo para outro membro por `admin`.
- Edição de consumo pendente.
- Finalização da gira com baixa automática e idempotente do estoque.

### Ajeum

- Criação de Ajeum por gira.
- Cadastro de itens necessários e limites por item.
- Seleção/cancelamento de item pelo membro.
- Controle de vagas restantes por item.
- Confirmação administrativa de entrega ou não entrega.
- Edição e remoção lógica de itens por `admin` ou `operador`.
- Controle de concorrência por versionamento nas confirmações.

### Notificações e PWA

- Manifest PWA em `frontend/public/manifest.json`.
- Página offline em `frontend/public/offline.html`.
- Service workers em `frontend/public/sw.js` e `frontend/public/firebase-messaging-sw.js`.
- Registro de devices FCM por usuário e terreiro.
- Push por Firebase Cloud Messaging.
- Suporte legado a Web Push/VAPID.
- Notificações para eventos como novas giras, inscrições, alterações, Ajeum e consumo/estoque.

### API e integrações

- Tela `/api-docs` para documentação de API e gestão de chaves.
- Criação, listagem e revogação de API keys.
- API keys com scopes.
- Valor completo da chave exibido apenas no momento da criação.
- Endpoints `/v1` para integrações com WhatsApp, n8n, Make e automações externas.

### Auditoria e monitoramento

- Registro de ações sensíveis em audit log.
- Scheduler de limpeza periódica dos logs de auditoria.
- Health check em `/health`.
- Métricas simples em `/metrics`.
- Rate limiting em fluxos sensíveis, como recuperação de senha.

## Rotas do Frontend

| Rota | Descrição |
| --- | --- |
| `/` | Entrada/redirecionamento inicial |
| `/login` | Login |
| `/registro` | Cadastro de novo terreiro |
| `/esqueci-senha` | Início da recuperação de senha |
| `/redefinir-senha` | Redefinição de senha por token |
| `/dashboard` | Visão geral do terreiro |
| `/giras` | Listagem de giras |
| `/giras/nova` | Nova gira |
| `/giras/editar/[id]` | Editar gira |
| `/giras/[id]` | Detalhe da gira, inscrições, membros e Ajeum |
| `/giras/[id]/inscricoes` | Gestão de inscrições da gira |
| `/giras/[id]/consumo` | Consumo de estoque da gira |
| `/public/[slug]` | Página pública de inscrição |
| `/consulentes` | Gestão de consulentes |
| `/consulentes/[id]` | Perfil do consulente |
| `/membros` | Gestão de membros |
| `/membros/[id]` | Perfil do membro |
| `/inventario` | Painel de estoque |
| `/estoque` | Gestão de estoque |
| `/configuracoes` | Perfil, senha e sessão |
| `/api-docs` | API keys, documentação e exemplos de integração |
| `/contato` | Formulário de contato |
| `/sobre` | Página institucional/sobre |

## Principais Endpoints do Backend

### Sistema

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/` | Status básico da aplicação |
| `GET` | `/health` | Saúde da aplicação, banco e serviços configurados |
| `GET` | `/metrics` | Métricas simples de uso |
| `GET` | `/docs` | Swagger UI do FastAPI |

### Autenticação

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/auth/register` | Cria terreiro e usuário admin |
| `POST` | `/auth/login` | Login JWT |
| `GET` | `/auth/me` | Dados do usuário autenticado |
| `PATCH` | `/auth/senha` | Alterar senha autenticada |
| `POST` | `/auth/esqueci-senha/buscar` | Busca terreiros vinculados ao email |
| `POST` | `/auth/esqueci-senha/enviar` | Envia link de recuperação |
| `POST` | `/auth/redefinir-senha` | Redefine senha por token |

### Giras

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/giras` | Lista giras do terreiro |
| `POST` | `/giras` | Cria gira |
| `GET` | `/giras/{gira_id}` | Detalha gira |
| `GET` | `/giras/{gira_id}/consumo` | Detalha gira para consumo |
| `PATCH` | `/giras/{gira_id}` | Atualiza gira |
| `DELETE` | `/giras/{gira_id}` | Exclusão lógica de gira |
| `POST` | `/giras/{gira_id}/finalizar` | Finaliza gira e processa estoque |

### Inscrições e consulentes

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/giras/{gira_id}/inscricoes` | Lista inscrições de consulentes |
| `POST` | `/gira/{slug}/inscrever/publico` | Inscrição pública via slug |
| `POST` | `/gira/{gira_id}/inscrever/interno` | Inscrição interna |
| `PATCH` | `/inscricao/{inscricao_id}/presenca` | Marca presença/falta |
| `DELETE` | `/inscricao/{inscricao_id}` | Cancela inscrição |
| `POST` | `/inscricao/{inscricao_id}/reativar` | Reativa inscrição |
| `GET` | `/consulentes/search` | Busca consulentes |
| `GET` | `/consulentes` | Lista consulentes |
| `GET` | `/consulentes/ranking` | Ranking de presença |
| `PUT` | `/consulentes/{consulente_id}` | Atualiza consulente |
| `DELETE` | `/consulentes/{consulente_id}` | Exclui consulente logicamente |
| `GET` | `/consulentes/{consulente_id}/perfil` | Perfil do consulente |

### Público

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/public/gira/{slug}` | Dados públicos da gira |
| `POST` | `/public/gira/{slug}/inscrever` | Inscrição pública de consulente |

### Membros

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/membros` | Lista membros |
| `POST` | `/membros` | Cria membro |
| `PUT` | `/membros/{membro_id}` | Atualiza membro |
| `GET` | `/membros/consulentes-lista` | Lista auxiliar de consulentes |
| `PATCH` | `/membros/consulentes/{consulente_id}/notas` | Atualiza notas internas |
| `GET` | `/membros/giras/{gira_id}/presenca-membros` | Lista presença de membros |
| `POST` | `/membros/giras/{gira_id}/presenca-membros/{membro_id}` | Atualiza presença de membro |
| `POST` | `/membros/giras/{gira_id}/confirmar-presenca` | Confirma presença em gira fechada |
| `GET` | `/membros/giras/{gira_id}/presenca-membros-publica` | Lista presença pública de membros |
| `POST` | `/membros/giras/{gira_id}/confirmar-presenca-publica` | Confirma presença em gira pública |
| `GET` | `/membros/ranking` | Ranking de membros |
| `GET` | `/membros/{membro_id}/perfil` | Perfil do membro |

### Inventário e consumo

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/inventory/items/terreiro` | Cria item do terreiro |
| `POST` | `/inventory/items/medium` | Cria item do próprio membro |
| `POST` | `/inventory/items/medium/admin` | Cria item para um membro específico |
| `GET` | `/inventory/items/by-owner` | Lista itens de médiuns |
| `GET` | `/inventory/items` | Lista itens com saldo |
| `GET` | `/inventory/items/{item_id}/stock` | Saldo atual do item |
| `GET` | `/inventory/items/{item_id}/history` | Histórico de movimentações |
| `POST` | `/inventory/items/{item_id}/movements` | Movimentação manual |
| `GET` | `/giras/{gira_id}/consumption` | Lista consumos da gira |
| `POST` | `/giras/{gira_id}/consumption` | Registra consumo |
| `PATCH` | `/giras/{gira_id}/consumption/{consumo_id}` | Edita consumo |

### Ajeum

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/giras/{gira_id}/ajeum` | Cria Ajeum da gira |
| `GET` | `/giras/{gira_id}/ajeum` | Busca Ajeum da gira |
| `POST` | `/ajeum/{ajeum_id}/itens` | Adiciona item ao Ajeum |
| `POST` | `/ajeum/itens/{item_id}/selecionar` | Seleciona item para levar |
| `PATCH` | `/ajeum/itens/{item_id}` | Edita item |
| `DELETE` | `/ajeum/itens/{item_id}` | Remove item logicamente |
| `DELETE` | `/ajeum/selecoes/{selecao_id}` | Cancela seleção |
| `PATCH` | `/ajeum/selecoes/{selecao_id}/confirmar` | Confirma entrega ou não entrega |

### Push e devices

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/push/subscribe` | Registra Web Push subscription |
| `POST` | `/push/test` | Envia push de teste |
| `GET` | `/push/status` | Mostra quantidade de subscriptions |
| `POST` | `/push/devices/register` | Registra device FCM |
| `DELETE` | `/push/devices/unregister` | Desativa device FCM |

### API keys e API v1

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api-keys` | Lista chaves do terreiro |
| `POST` | `/api-keys` | Cria API key |
| `DELETE` | `/api-keys/{key_id}` | Revoga API key |
| `GET` | `/api-keys/scopes` | Lista scopes disponíveis |
| `GET` | `/v1/giras` | Lista giras via API key |
| `GET` | `/v1/giras/{gira_id}/inscricoes` | Lista inscrições via API key |
| `POST` | `/v1/giras/{slug}/inscrever` | Inscreve consulente via API key |
| `GET` | `/v1/relatorios/consulentes` | Ranking de consulentes via API key |
| `PATCH` | `/v1/inscricoes/{inscricao_id}/presenca` | Marca presença via API key |

### Outros

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/contato` | Envia contato |
| `POST` | `/audit/log` | Registra evento de auditoria |

## Como Subir Localmente

### Com Docker Compose

```bash
docker-compose up --build
```

Acesse:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Swagger: http://localhost:8000/docs
- Health check: http://localhost:8000/health

O container do backend executa `alembic upgrade head` antes de iniciar o FastAPI.

### Primeiro acesso

1. Acesse `http://localhost:3000/registro`.
2. Cadastre o terreiro e o primeiro usuário administrador.
3. Faça login em `http://localhost:3000/login`.
4. Crie membros, giras, listas, estoque e integrações conforme necessário.

### Desenvolvimento sem Docker

Backend:

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Em desenvolvimento Docker, o frontend usa o rewrite `/api/:path*` para encaminhar chamadas ao backend em `http://backend:8000`.

## Variáveis de Ambiente

Use placeholders em desenvolvimento e segredos reais apenas no ambiente seguro de deploy.

### Backend

```env
ENVIRONMENT=local
DATABASE_URL=postgresql://terreiro:terreiro123@postgres:5432/axeflow
SECRET_KEY=troque-este-valor
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

APP_URL=http://localhost:3000

BREVO_API_KEY=sua-chave-brevo
GMAIL_USER=remetente@dominio.com
DEV_EMAIL=dev@dominio.com

VAPID_PRIVATE_KEY=sua-chave-vapid-privada
VAPID_PUBLIC_KEY=sua-chave-vapid-publica
VAPID_EMAIL=mailto:admin@axeflow.app

FIREBASE_CREDENTIALS={"type":"service_account", "...":"..."}

AUDIT_LOG_RETENTION_DAYS=90
```

### Frontend

```env
BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_FIREBASE_API_KEY=sua-chave
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu-projeto
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:xxxxxxxx
NEXT_PUBLIC_FIREBASE_VAPID_KEY=sua-chave-publica-fcm
```

Observação: o cliente HTTP do frontend usa `/api` como base. Em Docker/Next.js, esse caminho é encaminhado para o backend via `next.config.js`.

## Estrutura do Projeto

```text
.
├── backend/
│   ├── app/
│   │   ├── core/          # Configuração, banco, segurança e Firebase
│   │   ├── models/        # Models SQLAlchemy
│   │   ├── repositories/  # Acesso a dados especializado
│   │   ├── routers/       # Rotas FastAPI
│   │   ├── schemas/       # Schemas Pydantic
│   │   ├── services/      # Regras de negócio
│   │   ├── utils/         # Validadores, enums, datas e slug
│   │   └── workers/       # Processamento assíncrono de push
│   ├── migrations/        # Migrations Alembic
│   ├── requirements.txt
│   └── Procfile
├── frontend/
│   ├── components/        # Componentes React
│   ├── contexts/          # Contextos React
│   ├── hooks/             # Hooks de dados e UI
│   ├── pages/             # Páginas Next.js
│   ├── public/            # PWA, ícones, service workers e assets
│   ├── selectors/         # Seletores de estado/view
│   ├── services/          # Cliente API, Firebase, push e logout
│   ├── styles/            # CSS global
│   ├── utils/             # Helpers de formatação
│   └── viewModels/        # Transformação de dados para UI
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── render.yaml
├── DEPLOY_GUIDE.md
└── PWA_PUSH_GUIDE.md
```

## Deploy

- Backend: `render.yaml` define serviço web Python, banco PostgreSQL e `healthCheckPath: /health`.
- Start do backend em produção: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- Frontend: preparado para Next.js/Vercel, com proxy local por `next.config.js`.
- Consulte `DEPLOY_GUIDE.md` para detalhes de publicação.
- Consulte `PWA_PUSH_GUIDE.md` para detalhes de PWA e push.

## Observações de Segurança

- Nunca commite valores reais de `SECRET_KEY`, `BREVO_API_KEY`, `FIREBASE_CREDENTIALS`, VAPID ou API keys.
- API keys do AxeFlow são exibidas uma única vez ao criar.
- A autenticação de integrações usa `Authorization: Bearer axf_...`.
- Fluxos sensíveis usam rate limiting e auditoria.
- Exclusões principais são lógicas quando o histórico precisa ser preservado.
