# ☽✦☾ AxeFlow

Sistema de gestão de giras para terreiros de Umbanda e Candomblé.

## Stack

- **Backend**: Python · FastAPI · SQLAlchemy · PostgreSQL · JWT
- **Frontend**: Next.js · React · Bootstrap 5
- **Infra**: Docker · docker-compose

## Subir o projeto

```bash
docker-compose up --build
```

Acesse:
- **Painel**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs

## Primeiro acesso

1. Acesse http://localhost:3000/registro
2. Cadastre seu terreiro e crie o primeiro usuário (admin)
3. Faça login e comece a criar giras

## Fluxo principal

### Painel do terreiro
1. Admin faz login
2. Cria uma gira com título, data, horário, limite de vagas e período de inscrição
3. O sistema gera automaticamente um slug público
4. Admin compartilha o link público com os consulentes

### Inscrição do consulente
1. Consulente acessa o link: `http://localhost:3000/public/nome-da-gira-2026-04-10`
2. Preenche nome e telefone
3. Recebe confirmação com posição na fila

### Controle de presença
1. No dia da gira, admin acessa a lista de inscritos
2. Marca presença ✔ ou falta ✖ para cada consulente

## Estrutura

```
axeflow/
├── backend/
│   └── app/
│       ├── core/         # config, db, security
│       ├── models/       # SQLAlchemy models
│       ├── schemas/      # Pydantic schemas
│       ├── services/     # business logic
│       └── routers/      # FastAPI routers
├── frontend/
│   ├── pages/            # Next.js pages
│   ├── components/       # React components
│   └── services/         # Axios API client
├── docker-compose.yml
├── Dockerfile.backend
└── Dockerfile.frontend
```

## Endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /auth/login | Login JWT |
| POST | /auth/register | Criar terreiro + admin |
| GET | /auth/me | Dados do usuário |
| GET | /giras | Listar giras |
| POST | /giras | Criar gira |
| GET | /giras/{id} | Detalhar gira |
| PUT | /giras/{id} | Atualizar gira |
| DELETE | /giras/{id} | Excluir gira |
| GET | /giras/{id}/inscricoes | Lista de inscritos |
| PATCH | /inscricao/{id}/presenca | Marcar presença |
| DELETE | /inscricao/{id} | Cancelar inscrição |
| GET | /public/gira/{slug} | Info pública da gira |
| POST | /public/gira/{slug}/inscrever | Inscrição pública |

## Variáveis de ambiente

```env
# Backend
DATABASE_URL=postgresql://terreiro:terreiro123@postgres:5432/axeflow
SECRET_KEY=mude-em-producao

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```
